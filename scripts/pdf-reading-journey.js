/* Original Glitchpad candidate journey. Runs inside the real composed WebView. */
window.runGlitchpadPdfReadingJourney = async function () {
  var wait = async function (predicate, label) {
    var deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      var result = predicate();
      if (result) return result;
      await new Promise(function (resolve) {
        setTimeout(resolve, 25);
      });
    }
    throw new Error('PDF journey timeout: ' + label);
  };
  var text = function (node) {
    return (node.textContent || '').trim();
  };
  var button = function (label) {
    return Array.from(document.querySelectorAll('button'))
      .reverse()
      .find(function (node) {
        return (
          !node.disabled &&
          text(node) === label &&
          node.getBoundingClientRect().height > 0
        );
      });
  };
  var click = async function (label) {
    var target = await wait(function () {
      return button(label);
    }, label);
    target.click();
    await new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  };
  var close = async function (title) {
    var target = await wait(function () {
      return document.querySelector('button[aria-label="Close ' + title + '"]');
    }, 'close ' + title);
    target.click();
    await wait(function () {
      return !document.querySelector(
        'button[aria-label="Close ' + title + '"]',
      );
    }, 'closed ' + title);
  };
  var input = function (id, value) {
    var target = document.getElementById(id);
    if (!target) throw new Error('Input missing ' + id);
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    ).set.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  };
  var rendered = function (number) {
    var page = document.querySelector('.pdf-page[data-current=true]');
    return (
      page &&
      Number(page.getAttribute('data-pdf-page')) === number &&
      page
        .querySelector('.pdf-text-layer')
        .textContent.indexOf('page ' + String(number + 1)) >= 0 &&
      page.querySelector('canvas').width > 0
    );
  };
  var checks = {};
  var samples = [];
  var timingStart = performance.now();
  var longTasks = [];
  var longTaskObserver = null;
  try {
    longTaskObserver = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (entry) {
        longTasks.push(entry.duration);
      });
    });
    longTaskObserver.observe({ entryTypes: ['longtask'] });
    if (
      PerformanceObserver.supportedEntryTypes &&
      PerformanceObserver.supportedEntryTypes.indexOf('longtask') < 0
    ) {
      longTaskObserver.disconnect();
      longTaskObserver = null;
    }
  } catch (_) {
    longTaskObserver = null;
  }
  var eventStarts = new WeakMap();
  var handlerSamples = [];
  var startEvent = function (event) {
    eventStarts.set(event, performance.now());
  };
  var endEvent = function (event) {
    if (eventStarts.has(event))
      handlerSamples.push(performance.now() - eventStarts.get(event));
  };
  ['click', 'keydown', 'input'].forEach(function (type) {
    document.addEventListener(type, startEvent, true);
    window.addEventListener(type, endEvent);
  });
  var sample = function (metric, scope) {
    samples.push({
      metric: metric,
      scope: scope,
      milliseconds: performance.now() - timingStart,
    });
  };
  try {
    await wait(function () {
      return rendered(0);
    }, 'first page');
    if (
      document
        .querySelector('.pdf-page[data-current=true] .pdf-text-layer')
        .textContent.indexOf('Embedded Courier Prime text.') < 0
    )
      throw new Error('Embedded font text missing');
    checks.embedded_font_text = true;
    var initial = document.querySelector('.pdf-page[data-current=true] canvas');
    var pixels = initial
      .getContext('2d')
      .getImageData(0, 0, initial.width, initial.height).data;
    var ink = 0;
    for (var pixel = 0; pixel < pixels.length; pixel += 4)
      if (
        pixels[pixel] < 200 &&
        pixels[pixel + 1] < 200 &&
        pixels[pixel + 2] < 200
      )
        ink++;
    if (ink < 500) throw new Error('No representative PDF ink');
    checks.canvas_ink = ink;
    document.querySelector('button[aria-label="More PDF tools"]').click();
    await click('Outline');
    timingStart = performance.now();
    await click('Second chapter');
    await wait(function () {
      return rendered(1);
    }, 'outline destination');
    sample('navigation', 'previously_unmeasured_page_2_via_outline');
    checks.outline_named_destination = true;
    await click('Search');
    input('pdf-search', 'cats');
    timingStart = performance.now();
    await click('Search PDF');
    await wait(function () {
      var dialogs = Array.from(document.querySelectorAll('.task-surface'));
      return dialogs.some(function (node) {
        return node.innerText.indexOf('4 matches') >= 0;
      });
    }, 'ordered search');
    sample('search_complete', 'complete_four_page_query_cats');
    timingStart = performance.now();
    await click('Next match');
    await close('Search PDF');
    await wait(function () {
      return rendered(0);
    }, 'search destination');
    sample('navigation', 'warm_page_1_via_search');
    checks.search = true;
    timingStart = performance.now();
    await click('Thumbnails');
    await wait(function () {
      return Array.from(
        document.querySelectorAll('.pdf-thumbnail canvas'),
      ).some(function (node) {
        return node.width > 0 && node.height > 0;
      });
    }, 'thumbnail');
    sample('first_thumbnail', 'first_nonzero_decoded_thumbnail_canvas');
    await close('PDF thumbnails');
    checks.thumbnail = true;
    await click('Page links');
    await click('Link 1');
    await wait(function () {
      return rendered(1);
    }, 'internal page link');
    checks.internal_link = true;
    await click('Page links');
    await click('Link 2: https://example.invalid/s049');
    await wait(function () {
      return document.querySelector(
        'button[aria-label="Close Open external link"]',
      );
    }, 'external disclosure');
    await click('Cancel');
    await close('Page links');
    checks.external_link_disclosure = true;
    await click('Rotate');
    await close('PDF tools');
    await wait(function () {
      var canvas = document.querySelector(
        '.pdf-page[data-current=true] canvas',
      );
      return (
        canvas &&
        canvas.width > canvas.height &&
        document.querySelector('[data-pdf-ready=true]')
      );
    }, 'rotation');
    checks.rotation = true;
    document.querySelector('button[aria-label="Go to page"]').click();
    await wait(function () {
      return document.getElementById('pdf-page-number');
    }, 'page number field');
    input('pdf-page-number', '4');
    await click('Go to page');
    await wait(function () {
      return rendered(3);
    }, 'last page');
    checks.go_to_page = true;
    var pane = document.querySelector('.pdf-pane');
    pane.focus();
    pane.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
    );
    await wait(function () {
      return rendered(0);
    }, 'keyboard Home');
    checks.keyboard = true;
    document.querySelector('button[aria-label="More PDF tools"]').click();
    await click('File information');
    await wait(function () {
      return (
        document.body.innerText.indexOf('S049 local PDF') >= 0 &&
        document.body.innerText.indexOf('Glitchpad fixtures') >= 0
      );
    }, 'PDF metadata');
    checks.metadata = true;
    var metadataClose = Array.from(
      document.querySelectorAll('button[aria-label^="Close "]'),
    )
      .reverse()
      .find(function (node) {
        return !/PDF tools/.test(node.getAttribute('aria-label'));
      });
    if (metadataClose) metadataClose.click();
    await close('PDF tools');
    await new Promise(function (resolve) {
      setTimeout(resolve, 75);
    });
    return {
      measurements: {
        samples: samples,
        clock: 'performance.now',
        poll_interval_ms: 25,
        interaction: {
          method: 'capture_to_window_bubble_synchronous_event_interval',
          scope: 'click_keydown_input_handlers; deferred callbacks excluded',
          samples_ms: handlerSamples,
        },
        long_tasks: {
          method: 'PerformanceObserver_longtask',
          supported: longTaskObserver !== null,
          scope:
            'main_realm_reading_journey_only; worker_heap_and_native_dialogs_excluded',
          samples_ms: longTaskObserver ? longTasks : null,
        },
      },
      engine: document
        .querySelector('.pdf-layout')
        .getAttribute('data-pdf-engine'),
      schema_version: 1,
      runtime: navigator.userAgent,
      source_identity: {
        native: document
          .querySelector('.app-shell')
          .getAttribute('data-native-source-commit'),
        frontend: document
          .querySelector('.app-shell')
          .getAttribute('data-frontend-source-commit'),
      },
      resources: JSON.parse(
        document
          .querySelector('.pdf-layout')
          .getAttribute('data-pdf-observations') || 'null',
      ),
      checks: checks,
      worker: document
        .querySelector('.pdf-layout')
        .getAttribute('data-pdf-worker'),
      surfaces: Number(
        document.querySelector('.pdf-layout').getAttribute('data-pdf-surfaces'),
      ),
    };
  } finally {
    if (longTaskObserver) longTaskObserver.disconnect();
    ['click', 'keydown', 'input'].forEach(function (type) {
      document.removeEventListener(type, startEvent, true);
      window.removeEventListener(type, endEvent);
    });
  }
};
