// Reads a hint or an explanation aloud (spec §6.18, point 7).
//
// The browser's own speech, so nothing is downloaded and nothing leaves the
// device: a phone that has a Hebrew voice reads with it, one that does not
// gets no button at all — an English voice "reading" Hebrew is noise, not
// help. iPhones ship a Hebrew voice; Android usually has Google's; a Windows
// PC only with the Hebrew language pack installed.
//
// Driven straight from the button's onclick rather than through .NET: the
// call then happens inside the user's gesture, which is what iOS asks of
// speech, instead of an interop hop later.
window.theoryPrepSpeech = (function () {
    var synth = window.speechSynthesis;
    var voice = null;
    // True until the browser has actually listed its voices. Android Chrome
    // reports an empty list at load and sometimes until the first speak(),
    // so "no voices yet" must not read as "no Hebrew voice".
    var unknown = true;

    // Hebrew arrives in every spelling the platforms have: "he-IL", Android's
    // "he_IL" with an underscore, and the old code "iw" that Android still
    // uses. A \b after "he" misses the underscore — that hid the button on
    // every Android phone.
    var hebrew = /^(he|iw)([-_]|$)/i;

    function pickVoice() {
        if (!synth) return;
        var all = synth.getVoices();
        unknown = all.length === 0;
        var voices = all.filter(function (v) { return hebrew.test(v.lang); });
        // A local voice works on a train; a network one is the fallback.
        voice = voices.find(function (v) { return v.localService; }) || voices[0] || null;
        document.documentElement.classList.toggle('has-speech', !!voice || unknown);
    }

    if (synth) {
        pickVoice();
        // Chrome fills the list late, and sometimes more than once.
        synth.addEventListener('voiceschanged', pickVoice);
    }

    function stop() {
        if (!synth) return;
        synth.cancel();
        document.querySelectorAll('.btn-speak.speaking').forEach(function (b) {
            b.classList.remove('speaking');
            b.setAttribute('aria-pressed', 'false');
        });
    }

    // One button toggles: tap to read, tap again to stop. Starting one stops
    // any other, so two balloons can never talk over each other.
    function toggle(button) {
        if (!synth || (!voice && !unknown)) return;
        var wasSpeaking = button.classList.contains('speaking');
        stop();
        if (wasSpeaking) return;
        var text = button.getAttribute('data-text') || '';
        if (!text) return;
        // The list may have filled in since load — Android fills it late.
        if (!voice) pickVoice();
        var u = new SpeechSynthesisUtterance(text);
        // With no voice listed yet, the language alone lets the engine pick.
        if (voice) u.voice = voice;
        u.lang = voice ? voice.lang : 'he-IL';
        u.rate = 0.95;
        u.onend = u.onerror = function () {
            button.classList.remove('speaking');
            button.setAttribute('aria-pressed', 'false');
        };
        button.classList.add('speaking');
        button.setAttribute('aria-pressed', 'true');
        synth.speak(u);
    }

    return { toggle: toggle, stop: stop };
})();
