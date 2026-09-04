// Success feedback, tiered by how much the learner just achieved.
//
// Sound is synthesised with Web Audio rather than loaded from files: the app is
// offline-first, and generated tones cost zero bytes in the cache. Confetti is
// built from DOM nodes driven by the Web Animations API for the same reason.
//
// Both are opt-out in settings, and animation also yields to the operating
// system's reduce-motion preference without asking.
window.theoryPrep = (function () {
    let ctx = null;

    function audioContext() {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        if (!ctx) ctx = new Ctor();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    // An audio context may only be started from inside a user gesture. These
    // tones are played from .NET, which reaches JS asynchronously — by then the
    // gesture has ended and resume() is ignored, so nothing was ever audible.
    // This listener runs synchronously inside the very first real gesture,
    // where starting IS allowed; every later programmatic play then works.
    function unlock() {
        const ac = audioContext();
        if (!ac) return;
        // A zero-length silent buffer is the smallest thing that counts as
        // "played" for the browsers that need one before they will unmute.
        try {
            const source = ac.createBufferSource();
            source.buffer = ac.createBuffer(1, 1, 22050);
            source.connect(ac.destination);
            source.start(0);
        } catch { /* context already running */ }
        if (ac.state === 'running') {
            for (const type of ['pointerdown', 'touchend', 'keydown']) {
                document.removeEventListener(type, unlock, true);
            }
        }
    }

    for (const type of ['pointerdown', 'touchend', 'keydown']) {
        // Capture phase, so it fires even when the app stops propagation.
        document.addEventListener(type, unlock, true);
    }

    // [frequency Hz, start offset s, duration s]
    //
    // A single note reads as a machine acknowledging input — testers called it a
    // beep, which is exactly what one note is. Two notes RISING read as
    // approval, because a rising interval is what a pleased voice does. So the
    // plain correct answer is now a rising fifth, and the ladder above it grows
    // by adding notes rather than by getting longer: this plays on nearly every
    // question, and anything past a quarter of a second starts to nag.
    const TUNES = {
        correct: [[880, 0, 0.13], [1318.5, 0.075, 0.20]],        // A5 -> E6, a fifth
        streak: [[880, 0, 0.11], [1108.7, 0.075, 0.11],          // A major, arpeggiated
                 [1318.5, 0.15, 0.30]],
        pass: [[523, 0, 0.16], [659, 0.13, 0.16], [784, 0.26, 0.16], [1046, 0.39, 0.38]],
        perfect: [[523, 0, 0.14], [659, 0.11, 0.14], [784, 0.22, 0.14],
                  [1046, 0.33, 0.14], [1318, 0.44, 0.46]],
    };

    const PEAK_GAIN = { correct: 0.18, streak: 0.20, pass: 0.22, perfect: 0.24 };

    // A triangle rather than a sine. A sine is a single frequency with no
    // harmonics, and a phone speaker reproduces almost none of it — the tone was
    // technically playing and practically inaudible. A triangle keeps a soft
    // character but carries enough overtones to be heard on a small speaker.
    const WAVEFORM = 'triangle';

    function play(level) {
        const ac = audioContext();
        const tune = TUNES[level];
        if (!ac || !tune) return;
        const peak = PEAK_GAIN[level] || 0.06;
        for (const [freq, at, dur] of tune) {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = WAVEFORM;
            osc.frequency.value = freq;
            const t0 = ac.currentTime + at;
            // Attack, hold, decay. Ramping down from the very first instant, as
            // this did before, means the note spends nearly all of its length
            // already fading, so it is far quieter than its peak suggests.
            // Still ramped at both ends: a hard start or stop reads as a click.
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
            gain.gain.setValueAtTime(peak, t0 + dur * 0.45);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            osc.connect(gain).connect(ac.destination);
            osc.start(t0);
            osc.stop(t0 + dur + 0.03);
        }
    }

    const PIECES = { correct: 0, streak: 26, pass: 90, perfect: 150 };
    const COLORS = ['#1565c0', '#2e7d32', '#f9a825', '#c62828', '#6a1b9a', '#00838f'];

    function confetti(level) {
        const count = PIECES[level] || 0;
        if (!count) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const host = document.createElement('div');
        host.className = 'confetti-host';
        host.setAttribute('aria-hidden', 'true');
        document.body.appendChild(host);

        let longest = 0;
        for (let i = 0; i < count; i++) {
            const piece = document.createElement('i');
            const size = 6 + Math.random() * 7;
            piece.style.background = COLORS[i % COLORS.length];
            piece.style.left = (Math.random() * 100) + 'vw';
            piece.style.width = size + 'px';
            piece.style.height = (size * (0.4 + Math.random() * 0.8)) + 'px';
            host.appendChild(piece);

            const duration = 2200 + Math.random() * 1600;
            const delay = Math.random() * 350;
            longest = Math.max(longest, duration + delay);
            piece.animate([
                { transform: 'translate3d(0, -12vh, 0) rotate(0deg)', opacity: 1 },
                {
                    transform: `translate3d(${(Math.random() - 0.5) * 180}px, 108vh, 0) ` +
                               `rotate(${540 + Math.random() * 720}deg)`,
                    opacity: 0.85,
                },
            ], { duration, delay, easing: 'cubic-bezier(.2,.6,.5,1)', fill: 'forwards' });
        }
        setTimeout(() => host.remove(), longest + 400);
    }

    return {
        celebrate(level, sound, animate) {
            // Never let a failed effect take the answer flow down with it.
            if (sound) { try { play(level); } catch { /* no audio device */ } }
            if (animate) { try { confetti(level); } catch { /* no WAAPI */ } }
        },
    };
})();
