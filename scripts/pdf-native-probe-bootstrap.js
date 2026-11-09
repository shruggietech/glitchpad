(function () {
  var deadline = Date.now() + 90000;
  var memorySamples = [];
  var memoryFailure = null;
  var memoryPending = null;
  var memoryTimer = setInterval(function(){
    if(memoryPending || !window.__TAURI_INTERNALS__) return;
    memoryPending=window.__TAURI_INTERNALS__.invoke("sample_desktop_pdf_memory").then(function(value){
      memorySamples.push(value);
      if(memorySamples.length>58) {
        var peak=Math.max.apply(Math,memorySamples);
        memorySamples.splice(0,memorySamples.length-56);
        memorySamples.unshift(peak);
      }
    }).catch(function(error){memoryFailure=String(error);}).then(function(){memoryPending=null;});
  },1000);
  var readingResult = null;
  var diagnostics = function () {
    var root = document.querySelector('.pdf-layout');
    return {
      body: document.body.innerText.slice(0, 3072),
      state: root ? root.getAttribute('data-pdf-state') : null,
      error: root ? root.getAttribute('data-pdf-error') : null,
    };
  };
  var timer = setInterval(function () {
    var documentRoot = document.querySelector(
      '[data-pdf-ready=true][data-pdf-worker=true]',
    );
    if (!documentRoot) {
      if (Date.now() > deadline) {
        clearInterval(timer);
        clearInterval(memoryTimer);
        if (window.__TAURI_INTERNALS__)
          window.__TAURI_INTERNALS__
            .invoke('record_desktop_pdf_probe', {
              owner: '',
              proof: {
                error: 'PDF startup timeout',
                diagnostics: diagnostics(),
              },
            })
            .catch(function () {});
      }
      return;
    }
    var firstVisibleEpoch = Date.now();
    clearInterval(timer);
    var owner = documentRoot.getAttribute('data-pdf-owner');
    window
      .runGlitchpadPdfReadingJourney()
      .then(async function (proof) {
        readingResult = proof;
        proof.first_visible_epoch_ms = firstVisibleEpoch;
        proof.memory_samples = memorySamples;
        var disposals = [];
        var observeDisposal = function(event) { if(event.detail.owner_id === owner) disposals.push(event.detail); };
        window.addEventListener("glitchpad-pdf-disposed", observeDisposal);
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
          var completionEpoch = null;
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
            completionEpoch = Date.now();
          };
          window.addEventListener('afterprint', completed, { once: true });
          window.addEventListener(
            'glitchpad-native-print-completed',
            completed,
            { once: true },
          );
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
          window.removeEventListener(
            'glitchpad-native-print-completed',
            completed,
          );
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
            completion_epoch_ms: completionEpoch,
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
          var closeTools = document.querySelector(
            'button[aria-label="Close PDF tools"]',
          );
          if (closeTools) closeTools.click();
          await wait(function () {
            return !document.querySelector(
              'button[aria-label="Close PDF tools"]',
            );
          }, 'close tools');
          await wait(function () {
            return document.querySelector(
              '[data-pdf-ready=true][data-pdf-worker=true]',
            );
          }, 'PDF resumes after printing');
        }
        proof.resource_phases = [proof.resources, JSON.parse(document.querySelector(".pdf-layout").getAttribute("data-pdf-observations") || "null")];
        document.querySelector(".add-document-trigger").click();
        (await wait(function(){return Array.from(document.querySelectorAll(".add-document-menu button")).find(function(node){return node.textContent.trim()==="New text file";});},"new text to suspend PDF")).click();
        await wait(function(){return !document.querySelector(".pdf-layout") && disposals.some(function(row){return row.worker_terminated===true && row.workers===0 && row.surfaces===0 && row.surfaceBytes===0;});},"actual suspended PDF worker disposal");
        window.removeEventListener("glitchpad-pdf-disposed", observeDisposal);
        proof.disposal = disposals[disposals.length-1];
        clearInterval(memoryTimer);
        if(memoryPending) await memoryPending;
        if(memoryFailure) throw new Error("Native memory sampling failed: "+memoryFailure);
        proof.resource_phases.push(proof.disposal.observations);
        if (proof.disposal.elapsed_ms > 250) throw new Error("Native PDF disposal exceeded250ms");
        return window.__TAURI_INTERNALS__.invoke('record_desktop_pdf_probe', {
          owner: owner,
          proof: proof,
        });
      })
      .catch(function (error) {
        clearInterval(memoryTimer);
        window.__TAURI_INTERNALS__
          .invoke('record_desktop_pdf_probe', {
            owner: owner,
            proof: {
              error: String(error).slice(0, 1024),
              reading: readingResult,
              diagnostics: diagnostics(),
            },
          })
          .catch(function () {});
      });
  }, 50);
})();
