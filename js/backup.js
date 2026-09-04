// Hand the learner a file. Blazor cannot start a download on its own, so this
// builds a Blob and clicks a link at it. Nothing leaves the device unless the
// learner picks somewhere to send it in their own share sheet.
window.theoryPrepBackup = {
    /// Whether this device can hand the FILE to another app. Asked about a real
    /// file rather than about navigator.share: several browsers expose sharing
    /// but refuse file payloads, and answering yes there offers a button that
    /// cannot work.
    canShare() {
        try {
            const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
            return !!(navigator.canShare && navigator.canShare({ files: [probe] }));
        } catch {
            return false;   // no File constructor, or a browser that throws on the probe
        }
    },

    /// Opens the device's own share sheet with the backup attached — WhatsApp,
    /// mail, AirDrop. On a phone this is the difference between one tap and
    /// hunting for a file in Downloads to attach by hand.
    async share(fileName, text, title) {
        try {
            const file = new File([text], fileName, { type: 'application/json' });
            if (!navigator.canShare || !navigator.canShare({ files: [file] })) return 'unsupported';
            await navigator.share({ files: [file], title, text: title });
            return 'shared';
        } catch (e) {
            // Dismissing the sheet is a choice, not a failure, and must not
            // trigger the download fallback.
            return e && e.name === 'AbortError' ? 'cancelled' : 'failed';
        }
    },

    download(fileName, text) {
        const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Give the browser a moment to start the download before revoking.
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
};
