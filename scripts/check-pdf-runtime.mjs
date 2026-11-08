import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { installNativeSeams } from './check-android-authoring-layout.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'apps/glitchpad/dist');
const legacy = process.argv.includes('--legacy');
const output = resolve(
  root,
  'artifacts/pdf-runtime',
  legacy ? 'chrome69' : 'current',
);
await mkdir(output, { recursive: true });
const fixture = await readFile(
  resolve(root, 'fixtures/pdf/s049-compatibility.pdf'),
);
const errors = [];
const consoleMessages = [];
const requests = [];
const workerDenialRequests = [];
let page;
let version;
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname.includes('__pdf_denial_probe__'))
      workerDenialRequests.push(url.pathname);
    const path = resolve(
      dist,
      '.' +
        (url.pathname === '/'
          ? '/index.html'
          : decodeURIComponent(url.pathname)),
    );
    if (!path.startsWith(dist + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    const headers = {
      'Content-Type':
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.woff2': 'font/woff2',
        }[extname(path)] || 'application/octet-stream',
    };
    if (/^\/assets\/pdf-worker-[A-Za-z0-9_-]+\.js$/.test(url.pathname))
      headers['Content-Security-Policy'] =
        "default-src 'none'; connect-src 'none'; script-src 'none'; worker-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'";
    const bytes = await readFile(path);
    response.writeHead(200, headers);
    response.end(bytes);
  } catch {
    if (!response.headersSent) response.writeHead(404);
    response.end();
  }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const implementation = legacy
  ? await import('/tmp/glitchpad-browser-compat/client/node_modules/puppeteer-core/index.js')
  : await import('puppeteer');
const browser = await implementation.default.launch({
  headless: legacy ? true : 'shell',
  ...(legacy
    ? {
        executablePath:
          '/tmp/glitchpad-browser-compat/chromium/linux-576753/chrome-linux/chrome',
      }
    : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  version = await browser.version();
  if (legacy) assert.match(version, /69\.0\.3497\.0/);
  page = await browser.newPage();
  await page.setViewport({ width: 480, height: 800 });
  await page.setUserAgent(
    'Mozilla/5.0 (Linux; Android 7.0) AppleWebKit/537.36 Chrome/69.0.3497.0 Mobile Safari/537.36',
  );
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => consoleMessages.push(message.text()));
  page.on('request', (request) => requests.push(request.url()));
  const require = createRequire(
    new URL('../apps/glitchpad/package.json', import.meta.url),
  );
  const ts = require('typescript');
  const nativeSeam = ts.transpileModule(
    '(' + installNativeSeams.toString() + ')()',
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2018,
        module: ts.ModuleKind.ESNext,
      },
    },
  ).outputText;
  await page.evaluateOnNewDocument(nativeSeam);
  await page.evaluateOnNewDocument(function (encoded) {
    var binary = atob(encoded),
      bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    var original = window.__TAURI_INTERNALS__.invoke;
    var identity = {
      authority: 'synthetic',
      scope: 's049-browser',
      token: 'pdf-fixture',
      strength: 'strong',
    };
    var revision = {
      identity: identity,
      byte_length: bytes.length,
      modified_unix_nanos: '1',
      change_token: null,
    };
    var summary = {
      source_id: 'pdf-fixture',
      descriptor: {
        identity: identity,
        restoration_reference: null,
        display_name: 's049-compatibility.pdf',
        claimed_media_type: 'application/pdf',
        byte_length: bytes.length,
        modified_unix_ms: 1,
        kind: 'document_uri',
        capabilities: {
          read: true,
          seek: true,
          stream: true,
          metadata: true,
          observe_revision: true,
          revalidate: true,
          watch: false,
          write: false,
          replace_atomically: false,
          persistent_permission: false,
          rename: false,
          observe_deletion: false,
          reopen: true,
          reveal_location: false,
        },
      },
      external_revision: revision,
      delivery_kind: 'open_result',
      grant: {
        read: true,
        write: false,
        persisted_read: false,
        persisted_write: false,
        restorable: false,
      },
    };
    var fixtureSequence = 0;
    window.__setPdfFixture = function (base64, name, declaredLength) {
      bytes = Uint8Array.from(atob(base64), function (character) {
        return character.charCodeAt(0);
      });
      fixtureSequence++;
      identity = {
        authority: 'synthetic',
        scope: 's049-browser',
        token: 'pdf-fixture-' + fixtureSequence,
        strength: 'strong',
      };
      revision = {
        identity: identity,
        byte_length:
          declaredLength === undefined ? bytes.length : declaredLength,
        modified_unix_nanos: '1',
        change_token: null,
      };
      summary = JSON.parse(JSON.stringify(summary));
      summary.source_id = identity.token;
      summary.descriptor.identity = identity;
      summary.descriptor.display_name = name;
      summary.descriptor.byte_length = revision.byte_length;
      summary.external_revision = revision;
    };
    window.__pdfReads = [];
    window.__pdfForbiddenCalls = [];
    window.__pdfWorkerEvents = [];
    var NativeWorker = window.Worker;
    function ObservedWorker(url, options) {
      var worker;
      try {
        worker = new NativeWorker(url, options);
      } catch (error) {
        window.__pdfWorkerEvents.push({
          stage: 'constructor',
          message: String(error),
        });
        throw error;
      }
      var nativePost = worker.postMessage;
      worker.postMessage = function (message, transfer) {
        try {
          return nativePost.apply(this, arguments);
        } catch (error) {
          window.__pdfWorkerEvents.push({
            stage: 'postMessage',
            action: message && message.action,
            message: String(error),
            transfer_kind: transfer === null ? 'null' : typeof transfer,
          });
          throw error;
        }
      };
      worker.addEventListener('error', function (event) {
        window.__pdfWorkerEvents.push({
          stage: 'error',
          message: event.message,
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
        });
      });
      worker.addEventListener('messageerror', function () {
        window.__pdfWorkerEvents.push({ stage: 'messageerror' });
      });
      worker.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'glitchpad-pdf-worker-ready')
          window.__pdfWorkerEvents.push({
            stage: 'ready',
            version: event.data.version,
            native_bridge: event.data.native_bridge,
            code_evaluation_allowed: event.data.code_evaluation_allowed,
          });
      });
      return worker;
    }
    ObservedWorker.prototype = NativeWorker.prototype;
    Object.setPrototypeOf(ObservedWorker, NativeWorker);
    window.Worker = ObservedWorker;
    window.__TAURI_INTERNALS__.invoke = async function (command, args) {
      args = args || {};
      if (command === 'open_android_document') return summary;
      if (command === 'identify_image_source') return null;
      if (command === 'identify_pdf_source') return true;
      if (command === 'revalidate_android_source')
        return {
          source_id: summary.source_id,
          expected: revision,
          current: revision,
          status: 'match',
        };
      if (command === 'read_android_range') {
        if (
          args.sourceId !== summary.source_id ||
          args.length > 262144 ||
          args.offset < 0 ||
          args.offset + args.length > bytes.length
        )
          throw new Error('Invalid bounded source read');
        window.__pdfReads.push({ offset: args.offset, length: args.length });
        var chunk = Array.from(
          bytes.slice(args.offset, args.offset + args.length),
        );
        return args.binary
          ? [args.offset + args.length >= bytes.length ? 1 : 0].concat(chunk)
          : {
              source_id: summary.source_id,
              offset: args.offset,
              bytes: chunk,
              end_of_source: args.offset + args.length >= bytes.length,
            };
      }
      if (/save|write|open_external/.test(command))
        window.__pdfForbiddenCalls.push(command);
      return original(command, args);
    };
  }, fixture.toString('base64'));
  await page.goto('http://127.0.0.1:' + server.address().port, {
    waitUntil: 'networkidle0',
  });
  const baselineFonts = await page.evaluate(function () {
    return Array.from(document.fonts).map(function (face) {
      return face.family;
    });
  });
  await page.waitForSelector('.add-document-trigger');
  await page.click('.add-document-trigger');
  await page.evaluate(function () {
    var button = Array.from(
      document.querySelectorAll('.add-document-menu button'),
    ).find(function (node) {
      return /Open/.test(node.textContent);
    });
    if (!button) throw new Error('Open picker action missing');
    button.click();
  });
  try {
    await page.waitForFunction(
      "document.querySelector('[data-pdf-ready=true][data-pdf-worker=true]')",
      { timeout: 60000 },
    );
  } catch (error) {
    await writeFile(
      resolve(output, 'failure.json'),
      JSON.stringify(
        {
          version,
          errors,
          consoleMessages,
          body: await page.$eval('body', (node) => node.innerText),
        },
        null,
        2,
      ) + '\n',
    );
    await page.screenshot({ path: resolve(output, 'failure.png') });
    throw error;
  }
  await page.waitForFunction(
    "document.querySelector('.pdf-page[data-current=true] .pdf-text-layer') && document.querySelector('.pdf-page[data-current=true] .pdf-text-layer').textContent.includes('page 1')",
    { timeout: 30000 },
  );
  const facts = await page.evaluate(function () {
    var canvas = document.querySelector('.pdf-page[data-current=true] canvas');
    var pixels = canvas
      .getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height).data;
    var ink = 0;
    var colored = 0;
    for (var i = 0; i < pixels.length; i += 4) {
      if (pixels[i] < 200 && pixels[i + 1] < 200 && pixels[i + 2] < 200) ink++;
      if (
        Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) -
          Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) >
        40
      )
        colored++;
    }
    var text = document.querySelector(
      '.pdf-page[data-current=true] .pdf-text-layer',
    );
    var content = text.textContent;
    var selection = window.getSelection();
    selection.selectAllChildren(text);
    var selected = selection.toString();
    selection.removeAllRanges();
    return {
      width: canvas.width,
      height: canvas.height,
      ink: ink,
      colored_pixels: colored,
      text: content,
      selected: selected,
      reads: window.__pdfReads,
      forbidden: window.__pdfForbiddenCalls,
      executed: window.__s049PdfExecuted === true,
      engine: document
        .querySelector('.pdf-layout')
        .getAttribute('data-pdf-engine'),
      frames: document.querySelectorAll('[data-bb-app-frame]').length,
    };
  });
  assert.ok(facts.ink > 500, 'Actual canvas needs representative text ink');
  assert.match(facts.text, /Glitchpad PDF compatibility page 1/);
  assert.match(facts.selected, /Glitchpad PDF compatibility/);
  assert.match(facts.text, /Embedded Courier Prime text/);
  assert.ok(
    facts.colored_pixels > 100,
    'Embedded JPEG must contribute actual colored pixels',
  );
  assert.equal(facts.engine, '6.5.438');
  assert.equal(facts.frames, 1);
  assert.equal(facts.executed, false);
  assert.deepEqual(facts.forbidden, []);
  assert.ok(
    facts.reads.reduce((sum, r) => sum + r.length, 0) < fixture.length,
    'First content must not require whole-source reads',
  );
  assert.ok(!requests.some((url) => url.includes('example.invalid')));
  await page.click('button[aria-label="Next page"]');
  await page.waitForFunction(
    "document.querySelector('[data-pdf-ready=true]') && document.querySelector('.pdf-page[data-current=true] .pdf-text-layer').textContent.includes('page 2')",
    { timeout: 30000 },
  );
  await page.click('button[aria-label="Previous page"]');
  await page.waitForFunction(
    "document.querySelector('.pdf-page[data-current=true] .pdf-text-layer').textContent.includes('page 1')",
    { timeout: 30000 },
  );
  await page.addScriptTag({
    content: await readFile(
      resolve(root, 'scripts/pdf-reading-journey.js'),
      'utf8',
    ),
  });
  const readingJourney = await page.evaluate(function () {
    return window.runGlitchpadPdfReadingJourney();
  });
  const actualWorker = page
    .workers()
    .find((worker) => worker.url().includes('pdf-worker-'));
  assert.ok(actualWorker, 'Actual parser worker must be inspectable');
  const workerAuthority = await actualWorker.evaluate(async function () {
    var nativeBridge = '__TAURI_INTERNALS__' in self || '__TAURI__' in self;
    var scriptDenied = false;
    var evalDenied = false;
    var fetchDenied = false;
    var childDenied = false;
    try {
      importScripts(self.location.origin + '/__pdf_denial_probe__-script.js');
    } catch {
      scriptDenied = true;
    }
    try {
      await fetch(self.location.origin + '/__pdf_denial_probe__-fetch');
    } catch {
      fetchDenied = true;
    }
    try {
      var child = new Worker(
        self.location.origin + '/__pdf_denial_probe__-worker.js',
      );
      await new Promise(function (resolve) {
        child.onerror = function () {
          childDenied = true;
          resolve();
        };
        setTimeout(resolve, 1000);
      });
      child.terminate();
    } catch {
      childDenied = true;
    }
    return {
      nativeBridge: nativeBridge,
      scriptDenied: scriptDenied,
      evalDenied: evalDenied,
      fetchDenied: fetchDenied,
      childDenied: childDenied,
    };
  });
  const normalRealmReady = await page.evaluate(function () {
    return window.__pdfWorkerEvents.find(function (event) {
      return event.stage === 'ready';
    });
  });
  workerAuthority.evalDenied =
    normalRealmReady.code_evaluation_allowed === false;
  assert.deepEqual(workerAuthority, {
    nativeBridge: false,
    scriptDenied: true,
    evalDenied: true,
    fetchDenied: true,
    childDenied: true,
  });
  assert.deepEqual(workerDenialRequests, []);
  await page.screenshot({ path: resolve(output, 'page.png') });
  const pdfFonts = await page.evaluate(function () {
    return Array.from(document.fonts).map(function (face) {
      return face.family;
    });
  });
  const addedFonts = pdfFonts.filter(
    (family) => !baselineFonts.includes(family),
  );
  assert.ok(
    addedFonts.length > 0,
    'Representative font cleanup must exercise actual installed PDF font faces',
  );
  await page.click('.add-document-trigger');
  await page.evaluate(function () {
    var button = Array.from(
      document.querySelectorAll('.add-document-menu button'),
    ).find(function (node) {
      return node.textContent.trim() === 'New text file';
    });
    if (!button) throw new Error('New text action missing');
    button.click();
  });
  await page.waitForFunction(
    "!document.querySelector('.pdf-layout')&&document.querySelector('.cm-editor')",
    { timeout: 30000 },
  );
  const remainingFonts = await page.evaluate(function () {
    return Array.from(document.fonts).map(function (face) {
      return face.family;
    });
  });
  assert.deepEqual(
    addedFonts.filter((family) => remainingFonts.includes(family)),
    [],
    'Closing PDF must remove only its actual registered font faces',
  );
  const corpus = [];
  const openCase = async (name, declaredLength) => {
    await page.evaluate(
      function (base64, name, length) {
        window.__setPdfFixture(base64, name, length);
      },
      (await readFile(resolve(root, 'fixtures/pdf/' + name))).toString(
        'base64',
      ),
      name,
      declaredLength,
    );
    await page.click('.add-document-trigger');
    await page.evaluate(function () {
      var open = Array.from(
        document.querySelectorAll('.add-document-menu button'),
      ).find(function (node) {
        return /Open/.test(node.textContent);
      });
      if (!open) throw new Error('Open action missing');
      open.click();
    });
  };
  const closeCase = async () => {
    await page.click('.add-document-trigger');
    await page.evaluate(function () {
      Array.from(document.querySelectorAll('.add-document-menu button'))
        .find(function (node) {
          return node.textContent.trim() === 'New text file';
        })
        .click();
    });
    await page.waitForFunction("!document.querySelector('.pdf-layout')", {
      timeout: 30000,
    });
  };
  for (const [name, error] of [
    ['s049-malformed.pdf', 'malformed'],
    ['s049-page-limit.pdf', 'page_limit'],
    ['s049-unsupported-encryption.pdf', 'unsupported_encryption'],
  ]) {
    await openCase(name);
    await page.waitForFunction(
      function (code) {
        var root = document.querySelector('[data-pdf-state=failed]');
        return root && root.getAttribute('data-pdf-error') === code;
      },
      { timeout: 30000 },
      error,
    );
    corpus.push({ name: name, outcome: error });
    await closeCase();
  }
  await openCase('s049-small.pdf', 268435457);
  await page.waitForFunction(
    "document.querySelector('[data-pdf-state=failed]') && document.querySelector('[data-pdf-state=failed]').getAttribute('data-pdf-error')==='source_limit'",
    { timeout: 30000 },
  );
  corpus.push({ name: 'android_source_above_256MiB', outcome: 'source_limit' });
  await closeCase();
  await openCase('s049-encrypted.pdf');
  await page.waitForSelector('#pdf-password');
  await page.type('#pdf-password', 'wrong');
  await page.evaluate(function () {
    document.getElementById('pdf-password').form.requestSubmit
      ? document.getElementById('pdf-password').form.requestSubmit()
      : document
          .getElementById('pdf-password')
          .form.querySelector('button[type=submit]')
          .click();
  });
  await page.waitForFunction(
    "document.body.innerText.includes('The password was not accepted.')",
    { timeout: 30000 },
  );
  await page.evaluate(function () {
    document.getElementById('pdf-password').value = '';
  });
  await page.type('#pdf-password', 'fixture-open');
  await page.evaluate(function () {
    document
      .getElementById('pdf-password')
      .form.querySelector('button[type=submit]')
      .click();
  });
  await page.waitForSelector('[data-pdf-ready=true]');
  corpus.push({
    name: 's049-encrypted.pdf',
    outcome: 'wrong_password_then_decrypted',
  });
  await closeCase();
  await openCase('s049-large.pdf');
  await page.waitForSelector('[data-pdf-ready=true]');
  await page.setViewport({ width: 3600, height: 1800 });
  await page.waitForFunction(
    "document.querySelector('.pdf-layout').innerText.includes('Reduced cache; thumbnails paused.')",
    { timeout: 30000 },
  );
  const responsiveness = await page.evaluate(async function () {
    var samples = [];
    var prior = performance.now();
    for (var index = 0; index < 30; index++) {
      await new Promise(requestAnimationFrame);
      var now = performance.now();
      samples.push(now - prior);
      prior = now;
    }
    samples.sort(function (a, b) {
      return a - b;
    });
    return {
      raf_p95_ms: samples[Math.ceil(samples.length * 0.95) - 1],
      surfaces: Number(
        document.querySelector('.pdf-layout').getAttribute('data-pdf-surfaces'),
      ),
      reduced: document
        .querySelector('.pdf-layout')
        .innerText.includes('Reduced cache; thumbnails paused.'),
    };
  });
  assert.ok(responsiveness.reduced);
  assert.ok(responsiveness.surfaces <= 16);
  assert.ok(
    responsiveness.raf_p95_ms < 250,
    'Reduced-cache UI frame response must remain under 250ms',
  );
  corpus.push({
    name: 's049-large.pdf',
    outcome: 'reduced_cache',
    ...responsiveness,
  });
  await closeCase();
  await page.setViewport({ width: 480, height: 800 });
  await writeFile(
    resolve(output, 'result.json'),
    JSON.stringify(
      {
        schema_version: 1,
        diagnostic_only: true,
        candidate_qualified: false,
        evidence_class: 'production_browser_synthetic_native_boundary',
        source: process.env.SOURCE_REF || null,
        browser: version,
        fixture_sha256: createHash('sha256').update(fixture).digest('hex'),
        facts,
        errors,
        consoleMessages,
        requests,
        second_page: true,
        reading_journey: readingJourney,
        state_limit_corpus: corpus,
        worker_authority: workerAuthority,
        display_resources: {
          baseline_fonts: baselineFonts,
          pdf_fonts: addedFonts,
          remaining_pdf_fonts: addedFonts.filter((family) =>
            remainingFonts.includes(family),
          ),
        },
      },
      null,
      2,
    ) + '\n',
  );
  assert.deepEqual(errors, []);
  console.log('PDF production browser read/navigation passed: ' + version);
} catch (error) {
  await writeFile(
    resolve(output, 'failure.json'),
    JSON.stringify(
      {
        version,
        error: String(error),
        errors,
        consoleMessages,
        requests,
        worker_events: page
          ? await page
              .evaluate(function () {
                return window.__pdfWorkerEvents || [];
              })
              .catch(() => [])
          : [],
        source_reads: page
          ? await page
              .evaluate(function () {
                return window.__pdfReads || [];
              })
              .catch(() => [])
          : [],
        body: page
          ? await page.$eval('body', (node) => node.innerText).catch(() => null)
          : null,
      },
      null,
      2,
    ) + '\n',
  );
  if (page)
    await page
      .screenshot({ path: resolve(output, 'failure.png') })
      .catch(() => undefined);
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
