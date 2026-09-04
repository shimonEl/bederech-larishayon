// Paints the chosen palette onto <html> as data-theme.
//
// Loaded blocking from <head>, BEFORE the stylesheet has anything to paint, and
// it stamps immediately at the bottom of this file. Waiting for Blazor to boot
// would show a dark-mode learner a full white screen — splash included — for as
// long as the runtime takes to start.
//
// It reads the setting straight out of localStorage rather than being told,
// because at that point .NET has not loaded. That couples this file to
// SettingsService's storage key and to AppSettings.Theme being serialised by
// name; both are commented on the C# side.
window.theoryPrepTheme = (function () {
    const KEY = 'theoryprep.settings.v1';
    // Matched once: the object is live, so it also carries the change event.
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

    // The topbar colour of each theme, so the phone's own chrome matches the
    // page instead of staying the light theme's blue over a dark app.
    const THEME_COLOR = { light: '#ffffff', dark: '#1b5187' };

    function stored() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return 'System';
            const s = JSON.parse(raw);
            // Written by System.Text.Json as PascalCase; read either way rather
            // than depend on that.
            return s.Theme ?? s.theme ?? 'System';
        } catch {
            return 'System';   // private mode, disabled storage, corrupt JSON
        }
    }

    function apply(mode) {
        const choice = mode || stored();
        const resolved = choice === 'System'
            ? (systemDark.matches ? 'dark' : 'light')
            : String(choice).toLowerCase();
        // Always stamped with a RESOLVED value, never "system": the stylesheet
        // then needs one dark block instead of a prefers-color-scheme copy of it
        // that can drift out of step.
        document.documentElement.setAttribute('data-theme', resolved);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', THEME_COLOR[resolved]);
        return resolved;
    }

    // Following the system means following it as it CHANGES, not only at boot —
    // a phone that switches to dark at sunset should take the app with it.
    systemDark.addEventListener('change', function () {
        if (stored() === 'System') apply('System');
    });

    apply();
    return { apply };
})();
