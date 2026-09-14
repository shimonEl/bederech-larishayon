// Reports how much of the app is actually stored for offline use.
//
// This exists because the failure it describes is invisible from the device.
// The service worker caches 556 question images individually and tolerates the
// ones it cannot get, so an install can succeed with pictures missing — and on
// a phone there is no console to notice it in. The learner finds out on a train.
window.theoryPrepOffline = (function () {
    async function status() {
        try {
            if (!('caches' in window)) return { supported: false };

            const name = (await caches.keys()).find(k => k.startsWith('offline-cache-'));
            if (!name) return { supported: true, installed: false };

            const cache = await caches.open(name);
            const keys = await cache.keys();
            // Counted from what is actually stored, not from what the install
            // believed it stored: the point is to catch the two disagreeing.
            const images = keys.filter(k => k.url.includes('/data/images/')).length;

            return {
                supported: true,
                installed: true,
                images,
                total: keys.length,
                controlled: !!navigator.serviceWorker?.controller,
            };
        } catch {
            return { supported: false };   // storage disabled, private mode
        }
    }

    return { status };
})();
