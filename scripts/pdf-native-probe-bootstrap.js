(function () {
  var deadline = Date.now() + 90000;
  var readingResult = null;
  var diagnostics = function () {
    var root = document.querySelector('.pdf-layout');
    return { body: document.body.innerText.slice(0,3072), state: root ? root.getAttribute('data-pdf-state') : null, error: root ? root.getAttribute('data-pdf-error') : null };
  };
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
              proof: { error: 'PDF startup timeout', diagnostics: diagnostics() },
            })
            .catch(function () {});
      }
      return;
    }
    clearInterval(timer);
    var owner = documentRoot.getAttribute('data-pdf-owner');
    window
      .runGlitchpadPdfReadingJourney()
      .then(async function (proof) {
        readingResult = proof;
        var wait = async function (predicate, label) {
          var until = Date.now() + 45000;
          while (Date.now() < until) {
            var value = predicate();
            if (value) return value;
            await new Promise(function (resolve) {
              setTimeout(resolve, 50);
            });
          }
          throw new Error('Native print timeout: ' + label);
        };
        var button = function (label) {
          return Array.from(document.querySelectorAll('button'))
            .reverse()
            .find(function (node) {
              return (
                !node.disabled &&
                node.textContent.trim() === label &&
                node.getBoundingClientRect().height > 0
              );
            });
        };
        proof.prints = [];
        for (var range of ['2,4', 'all']) {
          document.querySelector('button[aria-label="More PDF tools"]').click();
          (
            await wait(function () {
              return button('Print');
            }, 'Print control')
          ).click();
          var field = await wait(function () {
            return document.getElementById('pdf-print-range');
          }, 'range');
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
          ).set.call(field, range);
          field.dispatchEvent(new Event('input', { bubbles: true }));
          var snapshot = null;
          var after = false;
          var completionEvent = null;
          var observe = function () {
            if (!document.body.classList.contains('pdf-print-active')) return;
            var images = Array.from(
              document.querySelectorAll('.pdf-print-document img'),
            );
            snapshot = {
              pages: images.length,
              decoded: images.every(function (image) {
                return image.complete && image.naturalWidth > 0;
              }),
            };
          };
          var observer = new MutationObserver(observe);
          observer.observe(document.body, {
            attributes: true,
            subtree: true,
            childList: true,
            attributeFilter: ['class'],
          });
          var completed = function (event) {
            after = true;
            completionEvent = event.type;
          };
          window.addEventListener('afterprint', completed, { once: true });
          window.addEventListener('glitchpad-native-print-completed', completed, { once: true });
          (
            await wait(function () {
              return button('Open system print dialog');
            }, 'submit')
          ).click();
          await wait(function () {
            return after;
          }, 'actual native operation or browser print completion');
          await wait(function () {
            return (
              !document.body.classList.contains('pdf-print-active') &&
              !document.querySelector('.pdf-print-document')
            );
          }, 'snapshot cleanup');
          observer.disconnect();
          window.removeEventListener('afterprint', completed);
          window.removeEventListener('glitchpad-native-print-completed', completed);
          if (
            !snapshot ||
            snapshot.pages !== (range === 'all' ? 4 : 2) ||
            !snapshot.decoded
          )
            throw new Error('Native print snapshot mismatch');
          proof.prints.push({
            range: range,
            snapshot: snapshot,
            completed: after,
            completion_event: completionEvent,
            cleaned: true,
            paper_completion: false,
          });
          document
            .querySelector('button[aria-label="Close Print PDF"]')
            .click();
          await wait(function () {
            return !document.querySelector(
              'button[aria-label="Close Print PDF"]',
            );
          }, 'close print task');
          document
            .querySelector('button[aria-label="Close PDF tools"]')
            .click();
          await wait(function () {
            return !document.querySelector(
              'button[aria-label="Close PDF tools"]',
            );
          }, 'close tools');
        }
        return window.__TAURI_INTERNALS__.invoke('record_desktop_pdf_probe', {
          owner: owner,
          proof: proof,
        });
      })
      .catch(function (error) {
        window.__TAURI_INTERNALS__
          .invoke('record_desktop_pdf_probe', {
            owner: owner,
            proof: { error: String(error).slice(0, 1024), reading: readingResult, diagnostics: diagnostics() },
          })
          .catch(function () {});
      });
  }, 50);
})();
