(function () {
  var deadline = Date.now() + 90000;
  var timer = setInterval(function () {
    var documentRoot = document.querySelector(
      '[data-pdf-ready=true][data-pdf-worker=true]',
    );
    if (!documentRoot) {
      if (Date.now() > deadline) {
        clearInterval(timer);
        if (window.__TAURI_INTERNALS__)
          window.__TAURI_INTERNALS__
            .invoke('record_desktop_pdf_probe', {
              owner: '',
              proof: { error: 'PDF startup timeout' },
            })
            .catch(function () {});
      }
      return;
    }
    clearInterval(timer);
    var owner = documentRoot.getAttribute('data-pdf-owner');
    window
      .runGlitchpadPdfReadingJourney()
      .then(function (proof) {
        return window.__TAURI_INTERNALS__.invoke('record_desktop_pdf_probe', {
          owner: owner,
          proof: proof,
        });
      })
      .catch(function (error) {
        window.__TAURI_INTERNALS__
          .invoke('record_desktop_pdf_probe', {
            owner: owner,
            proof: { error: String(error).slice(0, 1024) },
          })
          .catch(function () {});
      });
  }, 50);
})();
