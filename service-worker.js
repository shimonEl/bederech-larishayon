/* Manifest version: ProRvw9Y */
// Caution! Be sure you understand the caveats before publishing an application with
// offline support. See https://aka.ms/blazor-offline-considerations

self.importScripts('./service-worker-assets.js');
self.addEventListener('install', event => event.waitUntil(onInstall(event)));
self.addEventListener('activate', event => event.waitUntil(onActivate(event)));
self.addEventListener('fetch', event => event.respondWith(onFetch(event)));

const cacheNamePrefix = 'offline-cache-';
const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`;
// .svg added to the template's list: the favicon is an SVG and was the one
// asset left uncached, so offline it silently fell back to the PNG.
const offlineAssetsInclude = [ /\.dll$/, /\.pdb$/, /\.wasm/, /\.html/, /\.js$/, /\.json$/, /\.css$/, /\.woff$/, /\.png$/, /\.jpe?g$/, /\.gif$/, /\.svg$/, /\.ico$/, /\.blat$/, /\.dat$/, /\.webmanifest$/ ];
const offlineAssetsExclude = [ /^service-worker\.js$/ ];

// Assets the app runs without. There are 556 question images and one of them
// failing must not cost the whole update — see onInstall.
const offlineAssetsOptional = [ /^data\/images\// ];

// Bounded, but not throttled. 12 was over-cautious and cost real time: 556
// images took ~170s against the ~30s the unbounded addAll managed, because the
// link was idle between rounds. The origin is HTTP/2, where these multiplex
// over one connection rather than opening a socket each, so the old
// six-per-origin instinct does not apply. A round that does time out is
// retried, which is what the caution was for.
const OPTIONAL_BATCH = 48;

// A dropped image is invisible: the install still succeeds and that question is
// simply blank offline, for good. So a transient failure gets retried before it
// is accepted, and onFetch repairs whatever still slips through.
const OPTIONAL_ATTEMPTS = 3;

// Derived from where this worker actually lives, not hardcoded. The app is
// served from a sub-path on GitHub Pages, and a base of "/" made every entry in
// manifestUrlList resolve against the domain root — so the navigate-vs-asset
// test below compared against URLs that do not exist.
const baseUrl = new URL('./', self.location.href);
const manifestUrlList = self.assetsManifest.assets.map(asset => new URL(asset.url, baseUrl).href);

function assetRequest(asset) {
    return new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' });
}

/// True for assets the app runs without. Takes an absolute URL, since that is
/// what a fetch event carries, and tests it the same way the install does.
function isOptional(absoluteUrl) {
    const relative = absoluteUrl.startsWith(baseUrl.href)
        ? absoluteUrl.slice(baseUrl.href.length)
        : absoluteUrl;
    return offlineAssetsOptional.some(pattern => pattern.test(relative));
}

/// Caches what it can and returns what it could not, instead of throwing the
/// batch away. Retries first: one timeout on a phone should not cost a picture
/// permanently. Used only for assets the app runs without.
async function cacheOptional(cache, assets) {
    let pending = assets;
    for (let attempt = 1; attempt <= OPTIONAL_ATTEMPTS && pending.length; attempt++) {
        const failed = [];
        for (let i = 0; i < pending.length; i += OPTIONAL_BATCH) {
            await Promise.all(pending.slice(i, i + OPTIONAL_BATCH).map(async asset => {
                try {
                    await cache.add(assetRequest(asset));
                } catch {
                    failed.push(asset);
                }
            }));
        }
        pending = failed;
        if (pending.length && attempt < OPTIONAL_ATTEMPTS) {
            console.info(`Service worker: ${pending.length} image(s) failed, retrying`);
        }
    }
    return pending.map(asset => asset.url);
}

async function onInstall(event) {
    console.info('Service worker: Install');

    const wanted = self.assetsManifest.assets
        .filter(asset => offlineAssetsInclude.some(pattern => pattern.test(asset.url)))
        .filter(asset => !offlineAssetsExclude.some(pattern => pattern.test(asset.url)));

    const essential = wanted.filter(a => !offlineAssetsOptional.some(p => p.test(a.url)));
    const optional = wanted.filter(a => offlineAssetsOptional.some(p => p.test(a.url)));

    const cache = await caches.open(cacheName);

    // addAll is all-or-nothing, which is exactly right for the runtime, the
    // markup and the question bank: a half-cached app is worse than no cache,
    // and failing here correctly leaves the OLD worker serving a version that
    // works. It was the wrong tool for 556 images — one flaky request on a
    // phone threw the entire update away, install after install, and because
    // skipWaiting() sat after it the old worker then served forever.
    await cache.addAll(essential.map(assetRequest));

    // Best effort: a missing image is one broken picture offline, not a broken
    // app, and onFetch falls through to the network for anything not held.
    const failed = await cacheOptional(cache, optional);
    if (failed.length) {
        console.warn(`Service worker: ${failed.length} of ${optional.length} images not cached; ` +
                     'they will be fetched on demand.', failed.slice(0, 5));
    }

    // Last, and NOT awaited. skipWaiting() resolves only once this worker is
    // the active one, and it cannot become active until this install settles —
    // awaiting it here would be a deadlock by construction. Calling it sets the
    // flag; the browser activates as soon as this function returns.
    //
    // Last because onActivate deletes the previous cache: nothing should be
    // half-written when that happens. And needed at all because otherwise a new
    // worker waits until every tab of the origin is closed — reloading does not
    // release it — so on a phone's home screen a fix could go unseen for days.
    self.skipWaiting().catch(() => { /* nothing to recover; the flag is set */ });
}

async function onActivate(event) {
    console.info('Service worker: Activate');

    // Delete unused caches
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys
        .filter(key => key.startsWith(cacheNamePrefix) && key !== cacheName)
        .map(key => caches.delete(key)));

    // Take over open pages now, so the next load is already the new version.
    await self.clients.claim();
}

async function onFetch(event) {
    if (event.request.method !== 'GET') return fetch(event.request);

    // For all navigation requests, try to serve index.html from cache,
    // unless that request is for an offline resource.
    // If you need some URLs to be server-rendered, edit the following check to exclude those URLs
    const shouldServeIndexHtml = event.request.mode === 'navigate'
        && !manifestUrlList.some(url => url === event.request.url);

    const request = shouldServeIndexHtml ? 'index.html' : event.request;
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    const response = await fetch(event.request);

    // Repair. An optional asset the install could not get is otherwise missing
    // offline forever — the install already reported success, and nothing goes
    // back for it. Caching it the first time it is fetched online means a device
    // that came out of a flaky install heals itself as the learner uses it.
    //
    // Narrow on purpose: same-origin 200s only, since an opaque or error
    // response stored here would be served offline in place of the picture; and
    // no query string, so a cache-busted URL cannot fill the cache with
    // duplicates of one image.
    if (response.ok && response.type === 'basic'
        && isOptional(event.request.url)
        && !new URL(event.request.url).search) {
        // Not awaited: the learner should not wait on a cache write to see the
        // image, and a failed write is a retry next time, not an error now.
        cache.put(event.request, response.clone()).catch(() => { /* quota, most likely */ });
    }

    return response;
}
