// Installing the app to the home screen.
//
// Loaded from <head> because the browser fires `beforeinstallprompt` on its own
// schedule, often before the .NET runtime has booted. A listener registered any
// later simply misses it, and the install button would then never appear on the
// one platform that can offer a real one.
window.theoryPrepInstall = (function () {
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', function (e) {
        // Chrome would otherwise show its own mini-infobar; we want the offer to
        // live on our own screen, where it can be explained.
        e.preventDefault();
        deferredPrompt = e;
    });

    window.addEventListener('appinstalled', function () {
        deferredPrompt = null;
    });

    /// Running as an installed app rather than in a browser tab.
    function standalone() {
        try {
            return window.matchMedia('(display-mode: standalone)').matches
                // iOS predates the standard and reports it here instead.
                || window.navigator.standalone === true;
        } catch {
            return false;
        }
    }

    /// Which instructions to show when there is no promptable install.
    function platform() {
        const ua = navigator.userAgent;
        // iPadOS reports itself as a Mac; the touch points give it away.
        const ios = /iPhone|iPod/.test(ua)
            || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
            || /iPad/.test(ua);
        if (ios) return 'ios';
        if (/Android/.test(ua)) return 'android';
        return 'desktop';
    }

    return {
        state() {
            return { standalone: standalone(), canPrompt: !!deferredPrompt, platform: platform() };
        },

        /// Opens the browser's own install dialog. Returns what the user chose,
        /// or 'unavailable' when there was no stored prompt to open.
        async prompt() {
            if (!deferredPrompt) return 'unavailable';
            try {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                // A prompt may be used once; a second call would throw.
                deferredPrompt = null;
                return outcome;          // 'accepted' | 'dismissed'
            } catch {
                deferredPrompt = null;
                return 'failed';
            }
        },
    };
})();
