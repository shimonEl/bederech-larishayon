// Small DOM courtesies .NET cannot do on its own.
window.theoryPrepUi = {
    // A balloon (Balloon.razor) has just been rendered: put the keyboard on its
    // first button, so Enter answers it and a screen reader lands inside it.
    focusBalloon() {
        var balloons = document.querySelectorAll('.balloon');
        var last = balloons[balloons.length - 1];
        if (!last) return;
        var button = last.querySelector('.balloon-actions button, .balloon-actions a');
        if (button) button.focus({ preventScroll: true });
    }
};
