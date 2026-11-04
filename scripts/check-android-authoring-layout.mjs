import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { checkS046SurfaceContrast } from './check-s046-surface-contrast.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const minimumTarget = 48;
const tolerance = 0.6;

export function assertAuthoringMeasurement(measurement) {
  const {
    viewport,
    actions,
    document: surface,
    trigger,
    paddingBottom,
  } = measurement;
  assert.ok(
    actions.length > 0,
    'the real application must expose Add document controls',
  );
  for (const action of actions) {
    const label = action.label;
    assert.ok(
      action.width >= minimumTarget - tolerance &&
        action.height >= minimumTarget - tolerance,
      label +
        ' must retain a 48 CSS-pixel target in the emulated Android viewport',
    );
    assert.ok(
      action.left >= viewport.left - tolerance &&
        action.right <= viewport.left + viewport.width + tolerance &&
        action.top >= viewport.top - tolerance &&
        action.bottom <= viewport.top + viewport.height + tolerance,
      label +
        ' must be fully inside the visible viewport after local menu scrolling',
    );
    assert.ok(
      action.visibleWidth >= minimumTarget - tolerance &&
        action.visibleHeight >= minimumTarget - tolerance,
      label + ' must retain an unclipped reachable target',
    );
    assert.equal(
      action.hit,
      true,
      label + ' must receive input at its visible center',
    );
  }
  assert.ok(
    surface.width > 0 && surface.height > 0,
    'the actual document surface must remain mounted with area',
  );
  assert.ok(
    paddingBottom + tolerance >= surface.bottom - trigger.top,
    'document bottom padding must reserve the actual floating Add document target (padding=' +
      paddingBottom +
      ', required=' +
      (surface.bottom - trigger.top) +
      ', target=' +
      trigger.height +
      ')',
  );
}

export function assertNativeAuthoringMeasurement(measurement) {
  assertAuthoringMeasurement(measurement);
  assert.equal(
    measurement.frameCount,
    1,
    'Native Add must retain one AppFrame',
  );
  assert.ok(
    measurement.actions.some((action) => action.label === 'Add document'),
    'The persistent Add trigger must be measured with every choice',
  );
  for (const action of measurement.actions) {
    const visible = measurement.nativeVisible;
    assert.ok(
      action.left >= visible.left - tolerance &&
        action.right <= visible.right + tolerance &&
        action.top >= visible.top - tolerance &&
        action.bottom <= visible.bottom + tolerance,
      action.label + ' must fit the actual modeled native visible frame',
    );
  }
}

export function assertNativeObservation(measurement) {
  assert.equal(
    measurement.nativeCurrent,
    true,
    'Native Add observation must match the current layout dimensions',
  );
  assert.equal(
    measurement.nativeApplied,
    true,
    'Native Add requires a current native viewport observation',
  );
  assert.deepEqual(
    measurement.nativeRemaining,
    measurement.expectedRemaining,
    'Already consumed canonical insets must not be applied twice',
  );
}

export function assertDiagnosticMeasurement(measurement) {
  assert.equal(
    measurement.inactiveAddInvisible,
    true,
    'Inactive Add chrome must be hidden, not painted above diagnostic controls',
  );
  assert.ok(
    measurement.addReservedHeight > 0,
    'Hidden inactive Add chrome must retain its mounted geometry measurement',
  );
  assert.equal(
    measurement.frameCount,
    1,
    'Diagnostics must retain one AppFrame',
  );
  assert.equal(
    measurement.actions.length,
    4,
    'Every diagnostic control must be measured',
  );
  for (const action of measurement.actions) {
    assert.ok(
      action.width >= 44 - tolerance && action.height >= 44 - tolerance,
      action.label + ' must retain its touch target',
    );
    assert.ok(
      action.left >= measurement.visible.left - tolerance &&
        action.right <= measurement.visible.right + tolerance &&
        action.top >= measurement.visible.top - tolerance &&
        action.bottom <= measurement.visible.bottom + tolerance,
      action.label +
        ' must be fully inside the actual modeled native visible frame',
    );
    assert.equal(
      action.hit,
      true,
      action.label + ' must receive input after ordinary local scrolling',
    );
  }
  assert.equal(
    measurement.previewUnchanged,
    true,
    'Geometry and scrolling must retain the exact frozen preview',
  );
  for (const endpoint of measurement.preview) {
    assert.equal(endpoint.character, endpoint.end === 'first' ? '{' : '}');
    assert.ok(
      endpoint.top >= measurement.visible.top &&
        endpoint.bottom <= measurement.visible.bottom &&
        endpoint.top >= endpoint.clipTop &&
        endpoint.bottom <= endpoint.clipBottom,
      endpoint.end +
        ' JSON line must be completely readable after real inner and outer scrolling',
    );
    assert.equal(
      endpoint.hit,
      true,
      endpoint.end + ' JSON line must remain unobscured',
    );
  }
  assert.equal(
    measurement.remainingBottom,
    measurement.expectedRemainingBottom,
    'Already applied safe insets must not be duplicated',
  );
}

function installNativeSeams(theme = 'system') {
  let callbackId = 0;
  const callbacks = new Map();
  const records = new Map();
  const preferences = {
    schema_version: 1,
    theme,
    editor_font_family: 'ui-monospace',
    editor_font_size: 14,
    line_wrap: true,
    tab_width: 4,
    markdown_default_mode: 'rendered',
    language_overrides: {},
  };
  const session = {
    schema_version: 1,
    window: { active_session_index: null, inspector: 'closed' },
    sessions: [],
  };
  const calls = [];
  Object.defineProperty(window, '__authoringNativeCalls', { value: calls });
  window.__TAURI_INTERNALS__ = {
    transformCallback(callback) {
      const id = ++callbackId;
      callbacks.set(id, callback);
      return id;
    },
    unregisterCallback(id) {
      callbacks.delete(id);
    },
    async invoke(command, args = {}) {
      calls.push(command);
      if (command === 'preview_diagnostics')
        return {
          status: 'loaded',
          warning_code: null,
          value: {
            schema_version: 1,
            generated_unix_ms: 1,
            environment: {
              product_version: '0.2.0',
              specification_version: '1',
              platform: 'android',
              architecture: 'x86_64',
              webview_version: '131',
              core_version: '0.2.0',
              build_commit: 'a'.repeat(40),
            },
            events: Array.from({ length: 12 }, (_, index) => ({
              event_id: 'task_failed',
              unix_ms: index,
              environment: { platform: 'android' },
              failure: {
                component: 'markdown',
                stage: 'parse',
                reason: 'markdown_parse_failed',
                correlation_id: 'a'.repeat(32),
              },
            })),
          },
        };
      if (command === 'android_diagnostic_environment')
        return {
          android_version: '16',
          api_level: 36,
          webview_version: '131',
          webview_package: 'com.android.webview',
          ...(args.includeViewport
            ? { viewport: window.__diagnosticNativeViewport ?? null }
            : {}),
        };
      if (command === 'load_preferences')
        return { status: 'defaulted', warning_code: null, value: preferences };
      if (command === 'load_session_state')
        return { status: 'defaulted', warning_code: null, value: session };
      if (command === 'inventory_recovery') return [[], 0, 0];
      if (command === 'drain_android_deliveries')
        return { sources: [], rejections: [] };
      if (command === 'restore_android_sources') return [];
      if (command === 'persist_recovery') {
        const record = args.record;
        records.set(record.record_id, record);
        return {
          record_id: record.record_id,
          display_hint: record.display_hint,
          updated_unix_ms: record.updated_unix_ms,
          expires_unix_ms: record.updated_unix_ms + 86_400_000,
          committed_bytes: record.content.length,
          status: 'available',
        };
      }
      if (command === 'remove_recovery') return records.delete(args.recordId);
      if (
        command === 'open_android_document' ||
        command === 'create_android_document'
      )
        throw {
          category: 'unavailable',
          summary: 'Synthetic native picker cancelled',
          context: { reason: 'picker_cancelled' },
        };
      if (
        command.startsWith('plugin:glitchpad-android-source|') ||
        [
          'append_diagnostic',
          'persist_preferences',
          'persist_session_state',
          'close_android_source',
          'complete_android_back',
        ].includes(command)
      )
        return null;
      throw {
        category: 'unavailable',
        summary: 'Unexpected native operation in composed browser layout check',
        context: { reason: 'provider_unavailable' },
      };
    },
  };
}

async function measureDiagnostics(page, expectedRemainingBottom) {
  const before = await page.$eval(
    '.diagnostic-preview',
    (node) => node.textContent,
  );
  const visible = await page.evaluate(() => window.__diagnosticVisibleFrame);
  const actions = [];
  for (const label of [
    'Close diagnostics',
    'Save previewed bundle',
    'Share previewed bundle',
    'Clear diagnostics',
  ]) {
    actions.push(
      await page.evaluate((label) => {
        const button = Array.from(
          document.querySelectorAll('.diagnostics-sheet button'),
        ).find((node) => node.textContent.trim() === label);
        const panel = button.closest('.diagnostics-sheet');
        panel.scrollTop = 0;
        button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(
          (rect.left + rect.right) / 2,
          (rect.top + rect.bottom) / 2,
        );
        return {
          label,
          ...rect.toJSON(),
          hit: hit === button || button.contains(hit),
        };
      }, label),
    );
  }
  const preview = [];
  for (const end of ['first', 'last']) {
    preview.push(
      await page.evaluate((end) => {
        const pre = document.querySelector('.diagnostic-preview');
        pre.scrollTop = end === 'first' ? 0 : pre.scrollHeight;
        pre.scrollIntoView({ block: 'center', inline: 'nearest' });
        const text = pre.firstChild;
        const from = end === 'first' ? 0 : text.textContent.length - 1;
        const range = document.createRange();
        range.setStart(text, from);
        range.setEnd(text, from + 1);
        const rect = range.getBoundingClientRect();
        const clip = pre.getBoundingClientRect();
        const panel = pre.closest('.diagnostics-sheet').getBoundingClientRect();
        const hit = document.elementFromPoint(
          (rect.left + rect.right) / 2,
          (rect.top + rect.bottom) / 2,
        );
        return {
          end,
          character: text.textContent.slice(from, from + 1),
          ...rect.toJSON(),
          clipTop: Math.max(clip.top, panel.top),
          clipBottom: Math.min(clip.bottom, panel.bottom),
          hit: hit === pre || pre.contains(hit),
          innerScrollTop: pre.scrollTop,
          outerScrollTop: pre.closest('.diagnostics-sheet').scrollTop,
        };
      }, end),
    );
  }
  return {
    visible,
    actions,
    preview,
    previewUnchanged:
      before ===
      (await page.$eval('.diagnostic-preview', (node) => node.textContent)),
    previewSha256: createHash('sha256').update(before).digest('hex'),
    frameCount: await page.$$eval(
      '[data-bb-app-frame]',
      (nodes) => nodes.length,
    ),
    remainingBottom: await page.$eval('.diagnostics-sheet', (node) =>
      Number.parseFloat(
        node.style.getPropertyValue('--gl-diagnostic-block-end'),
      ),
    ),
    expectedRemainingBottom,
    ...(await page.evaluate(() => {
      const add = document.querySelector('[data-add-document]');
      const trigger = document.querySelector('.add-document-trigger');
      return {
        inactiveAddInvisible:
          trigger.disabled && getComputedStyle(add).visibility === 'hidden',
        addReservedHeight: trigger.getBoundingClientRect().height,
      };
    })),
  };
}

async function measureActions(page, open) {
  const selectors = open
    ? [
        '.add-document-menu button:nth-of-type(1)',
        '.add-document-menu button:nth-of-type(2)',
        '.add-document-menu button:nth-of-type(3)',
        '.add-document-menu button:nth-of-type(4)',
        '.add-document-trigger',
      ]
    : ['.add-document-trigger'];
  const actions = [];
  for (const selector of selectors) {
    await page.$eval(selector, (element) =>
      element.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
    );
    const action = await page.$eval(selector, (element) => {
      const rect = element.getBoundingClientRect();
      const panel = element
        .closest('.add-document-menu')
        ?.getBoundingClientRect();
      const clip = {
        left: Math.max(rect.left, panel?.left ?? -Infinity),
        right: Math.min(rect.right, panel?.right ?? Infinity),
        top: Math.max(rect.top, panel?.top ?? -Infinity),
        bottom: Math.min(rect.bottom, panel?.bottom ?? Infinity),
      };
      const target = document.elementFromPoint(
        (clip.left + clip.right) / 2,
        (clip.top + clip.bottom) / 2,
      );
      return {
        label: element.textContent.trim(),
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        visibleWidth: clip.right - clip.left,
        visibleHeight: clip.bottom - clip.top,
        hit: target === element || element.contains(target),
        disabled: element.disabled,
      };
    });
    assert.equal(
      action.disabled,
      false,
      action.label + ' must be available in the native Android seam',
    );
    actions.push(action);
  }
  return page.evaluate((actions) => {
    const rect = (element) => {
      const value = element.getBoundingClientRect();
      return {
        left: value.left,
        right: value.right,
        top: value.top,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
      };
    };
    const surface = document.querySelector('.document-surface');
    return {
      actions,
      document: rect(surface),
      trigger: rect(document.querySelector('.add-document-trigger')),
      paddingBottom: Number.parseFloat(getComputedStyle(surface).paddingBottom),
      viewport: {
        left: visualViewport?.offsetLeft ?? 0,
        top: visualViewport?.offsetTop ?? 0,
        width: visualViewport?.width ?? innerWidth,
        height: visualViewport?.height ?? innerHeight,
      },
      rootFontSize: Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      ),
      imeInset: getComputedStyle(document.documentElement)
        .getPropertyValue('--bb-ime-block-end')
        .trim(),
      frameCount: document.querySelectorAll('[data-bb-app-frame]').length,
      shellCount: document.querySelectorAll('.app-shell[data-android="true"]')
        .length,
    };
  }, actions);
}

async function clickChoice(page, label) {
  await page.evaluate((label) => {
    const button = [
      ...document.querySelectorAll('.add-document-menu button'),
    ].find((element) => element.textContent.trim() === label);
    if (!button)
      throw new Error('Actual Add document choice missing: ' + label);
    button.click();
  }, label);
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}

export async function checkAndroidAuthoringLayout({
  receiptPath = '',
  sourceCommit = null,
} = {}) {
  if (sourceCommit !== null)
    assert.match(
      sourceCommit,
      /^[a-f0-9]{40}$/u,
      'source commit must be an exact SHA',
    );
  const appRoot = join(root, 'apps/glitchpad/dist');
  const index = await readFile(join(appRoot, 'index.html'));
  const assetHashes = [];
  for (const name of (await readdir(join(appRoot, 'assets'))).sort()) {
    if (/\.(?:js|css)$/u.test(name))
      assetHashes.push({
        name,
        sha256: createHash('sha256')
          .update(await readFile(join(appRoot, 'assets', name)))
          .digest('hex'),
      });
  }
  assert.ok(
    assetHashes.some((asset) => asset.name.endsWith('.js')),
    'build the production React application before geometry validation',
  );
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.svg': 'image/svg+xml',
  };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const path = resolve(
        appRoot,
        '.' +
          decodeURIComponent(
            url.pathname === '/' ? '/index.html' : url.pathname,
          ),
      );
      if (!path.startsWith(appRoot + sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      const bytes = await readFile(path);
      response.writeHead(200, {
        'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
      });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  const cases = [];
  const failures = [];
  const diagnosticCases = [];
  const nativeAuthoringCases = [];
  const audit = (profile, textScale, stage, measurement) => {
    try {
      assertAuthoringMeasurement(measurement);
    } catch (error) {
      failures.push({
        profile,
        text_scale: textScale,
        stage,
        message: error.message,
        measurement,
      });
    }
  };
  try {
    browser = await puppeteer.launch({
      headless: 'shell',
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    for (const profile of [
      { name: 'narrow', width: 320, height: 640 },
      { name: 'portrait', width: 360, height: 720 },
      { name: 'landscape', width: 640, height: 360 },
      { name: 'short', width: 480, height: 240 },
      {
        name: 'ime-like-contraction',
        width: 360,
        height: 720,
        contractedHeight: 480,
      },
    ]) {
      for (const textScale of [1, 2]) {
        const page = await browser.newPage();
        try {
          const errors = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await page.setViewport({
            width: profile.width,
            height: profile.height,
            deviceScaleFactor: 1,
            isMobile: true,
            hasTouch: true,
          });
          await page.setUserAgent(
            'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
          );
          await page.evaluateOnNewDocument(installNativeSeams);
          await page.setRequestInterception(true);
          page.on('request', (request) => {
            if (
              request.url().startsWith(origin + '/') ||
              /^(?:blob:|data:)/u.test(request.url())
            )
              void request.continue();
            else void request.abort();
          });
          await page.goto(origin, { waitUntil: 'load' });
          await page.waitForSelector(
            '.app-shell[data-android="true"] .document-surface',
          );
          await page.waitForSelector('.add-document-trigger');
          await page.evaluate((scale) => {
            document.documentElement.style.fontSize = scale * 100 + '%';
          }, textScale);
          await settle(page);
          const cold = await measureActions(page, false);
          assert.equal(cold.frameCount, 1);
          assert.equal(cold.shellCount, 1);
          audit(profile.name, textScale, 'cold', cold);
          await page.click('.add-document-trigger');
          await page.waitForSelector('.add-document-menu');
          const choices = await measureActions(page, true);
          audit(profile.name, textScale, 'choices', choices);
          await page.keyboard.press('Escape');
          assert.equal(
            await page.$('.add-document-menu'),
            null,
            'Escape must dismiss the actual menu',
          );
          assert.equal(
            await page.$eval(
              '.add-document-trigger',
              (element) => element === document.activeElement,
            ),
            true,
            'dismissal must restore Add focus',
          );
          await page.click('.add-document-trigger');
          await clickChoice(page, 'Open file');
          await page.waitForFunction(() =>
            window.__authoringNativeCalls.includes('open_android_document'),
          );
          assert.equal(
            await page.$('.add-document-menu'),
            null,
            'native Open choice must dismiss its menu',
          );
          await page.click('.add-document-trigger');
          await clickChoice(page, 'New Markdown');
          await page.waitForSelector('.cm-content[contenteditable="true"]');
          await page.click('.cm-content');
          await page.keyboard.type('# Layout fixture');
          if (profile.contractedHeight) {
            await page.setViewport({
              width: profile.width,
              height: profile.contractedHeight,
              deviceScaleFactor: 1,
              isMobile: true,
              hasTouch: true,
            });
          }
          await settle(page);
          const loaded = await measureActions(page, false);
          audit(profile.name, textScale, 'loaded', loaded);
          await page.click('.add-document-trigger');
          const loadedChoices = await measureActions(page, true);
          audit(profile.name, textScale, 'loaded_choices', loadedChoices);
          await clickChoice(page, 'New text file');
          await page.waitForFunction(() =>
            document.body.textContent.includes('Untitled.txt'),
          );
          assert.equal(
            await page.$('.add-document-menu'),
            null,
            'New text must dismiss its menu',
          );
          assert.equal(
            await page.$eval('.add-document-trigger', (element) =>
              element.getAttribute('aria-expanded'),
            ),
            'false',
          );
          assert.deepEqual(
            errors,
            [],
            'the production app must not throw during measured authoring tasks',
          );
          cases.push({
            profile: profile.name,
            text_scale: textScale,
            requested_viewport: profile,
            cold,
            choices,
            loaded,
            loaded_choices: loadedChoices,
          });
        } catch (error) {
          const observed = await page
            .evaluate(() => ({
              body: document.body.innerText.slice(0, 1500),
              fontSize: getComputedStyle(document.documentElement).fontSize,
              document: document
                .querySelector('.document-surface')
                ?.getBoundingClientRect()
                .toJSON(),
              trigger: document
                .querySelector('.add-document-trigger')
                ?.getBoundingClientRect()
                .toJSON(),
              paddingBottom: getComputedStyle(
                document.querySelector('.document-surface'),
              ).paddingBottom,
              calls: window.__authoringNativeCalls?.slice(-30),
            }))
            .catch(() => null);
          throw new Error(
            'Composed authoring failed (' +
              profile.name +
              ', text scale ' +
              textScale +
              '): ' +
              error.message +
              '; observed ' +
              JSON.stringify(observed),
            { cause: error },
          );
        } finally {
          await page.close();
        }
      }
    }
    for (const profile of [
      { name: 'native-portrait', width: 320, height: 640 },
      { name: 'native-landscape', width: 640, height: 320 },
      { name: 'native-short', width: 480, height: 240 },
    ]) {
      for (const textScale of [1, 2])
        for (const consumed of [false, true]) {
          const page = await browser.newPage();
          try {
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await page.setViewport({
              width: profile.width,
              height: profile.height,
              deviceScaleFactor: 1,
              isMobile: true,
              hasTouch: true,
            });
            await page.setUserAgent(
              'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
            );
            await page.evaluateOnNewDocument(installNativeSeams);
            await page.goto(origin, { waitUntil: 'load' });
            await page.waitForSelector('.add-document-trigger');
            const fixture = await page.evaluate(
              ({ profile, textScale, consumed }) => {
                document.documentElement.style.fontSize = textScale * 100 + '%';
                const portrait = profile.height > profile.width;
                const native = portrait
                  ? {
                      left: 0,
                      top: 48,
                      right: profile.width,
                      bottom: profile.height - 48,
                    }
                  : {
                      left: 48,
                      top: 24,
                      right: profile.width - 48,
                      bottom: profile.height,
                    };
                // Model the retained API36 native bars/cutout. The parent has already consumed canonical top/left, or every inset in the deduplication row.
                const applied = consumed
                  ? {
                      left: native.left,
                      top: native.top,
                      right: profile.width - native.right,
                      bottom: profile.height - native.bottom,
                    }
                  : {
                      left: native.left,
                      top: portrait ? native.top : 0,
                      right: 0,
                      bottom: 0,
                    };
                const css = document.createElement('style');
                css.textContent =
                  '[data-bb-app-frame]{padding-top:' +
                  applied.top +
                  'px!important;padding-right:' +
                  applied.right +
                  'px!important;padding-bottom:' +
                  applied.bottom +
                  'px!important;padding-left:' +
                  applied.left +
                  'px!important}#bb-overlay-root{top:' +
                  applied.top +
                  'px!important;right:' +
                  applied.right +
                  'px!important;bottom:' +
                  applied.bottom +
                  'px!important;left:' +
                  applied.left +
                  'px!important}';
                document.head.append(css);
                // Nonzero screen origin and width scale exercise the existing uniform native-coordinate mapping.
                window.__diagnosticNativeViewport = {
                  webview_screen: {
                    left: 17,
                    top: 29,
                    right: 17 + profile.width * 2,
                    bottom: 29 + profile.height * 2,
                  },
                  visible_screen: {
                    left: 17 + native.left * 2,
                    top: 29 + native.top * 2,
                    right: 17 + native.right * 2,
                    bottom: 29 + native.bottom * 2,
                  },
                  view_width: profile.width * 2,
                  view_height: profile.height * 2,
                  density: 3,
                };
                window.dispatchEvent(new Event('resize'));
                return {
                  nativeVisible: native,
                  expectedRemaining: {
                    right: profile.width - native.right - applied.right,
                    bottom: profile.height - native.bottom - applied.bottom,
                  },
                };
              },
              { profile, textScale, consumed },
            );
            await settle(page);
            const measure = async (open) => ({
              ...(await measureActions(page, open)),
              ...fixture,
              ...(await page.$eval('[data-add-document]', (node) => ({
                nativeApplied:
                  node.getAttribute('data-native-viewport') === 'true',
                nativeCurrent:
                  Number(node.getAttribute('data-native-viewport-width')) ===
                    window.innerWidth &&
                  Number(node.getAttribute('data-native-viewport-height')) ===
                    window.innerHeight,
                nativeRemaining: {
                  right: Number.parseFloat(
                    node.style.getPropertyValue('--gl-add-native-inline-end'),
                  ),
                  bottom: Number.parseFloat(
                    node.style.getPropertyValue('--gl-add-native-block-end'),
                  ),
                },
              }))),
            });
            const closed = await measure(false);
            const auditNative = (
              stage,
              measured,
              assertion = assertNativeAuthoringMeasurement,
            ) => {
              try {
                assertion(measured);
              } catch (error) {
                failures.push({
                  profile: profile.name,
                  text_scale: textScale,
                  canonical_insets_consumed: consumed,
                  stage,
                  message: error.message,
                  measurement: measured,
                });
              }
            };
            auditNative('native_closed', closed);
            await page.click('.add-document-trigger');
            await page.waitForSelector('.add-document-menu');
            const opened = await measure(true);
            auditNative('native_choices', opened);
            auditNative(
              'native_observation_closed',
              closed,
              assertNativeObservation,
            );
            auditNative(
              'native_observation_choices',
              opened,
              assertNativeObservation,
            );
            await page.keyboard.press('Escape');
            assert.equal(await page.$('.add-document-menu'), null);
            assert.equal(
              await page.$eval(
                '.add-document-trigger',
                (node) => node === document.activeElement,
              ),
              true,
            );
            assert.deepEqual(errors, []);
            nativeAuthoringCases.push({
              profile,
              text_scale: textScale,
              canonical_insets_consumed: consumed,
              closed,
              opened,
            });
          } finally {
            await page.close();
          }
        }
    }
    for (const profile of [
      { width: 320, height: 640 },
      { width: 480, height: 240 },
      { width: 640, height: 360 },
    ]) {
      for (const textScale of [1, 2])
        for (const alreadyConsumed of [false, true]) {
          const page = await browser.newPage();
          try {
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await page.setViewport({
              ...profile,
              height: alreadyConsumed ? profile.height - 48 : profile.height,
              deviceScaleFactor: 1,
              isMobile: true,
              hasTouch: true,
            });
            await page.setUserAgent(
              'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
            );
            await page.evaluateOnNewDocument(installNativeSeams);
            await page.goto(origin, { waitUntil: 'load' });
            await page.waitForSelector('.application-menu-trigger');
            await page.evaluate(
              ({ scale, consumed }) => {
                document.documentElement.style.fontSize = scale * 100 + '%';
                document.documentElement.style.setProperty(
                  '--bb-host-titlebar-block-end',
                  '48px',
                );

                // Fixed observations reproduce the actual API36 safe frame; production supplies live native rectangles.
                const width = window.innerWidth * 2,
                  height = window.innerHeight * 2;
                window.__diagnosticVisibleFrame = {
                  left: 0,
                  top: 48,
                  right: window.innerWidth,
                  bottom: consumed
                    ? window.innerHeight
                    : window.innerHeight - 48,
                };
                window.__diagnosticNativeViewport = {
                  webview_screen: {
                    left: 17,
                    top: 29,
                    right: 17 + width,
                    bottom: 29 + height,
                  },
                  visible_screen: {
                    left: 17,
                    top: 29 + 96,
                    right: 17 + width,
                    bottom: 29 + height - (consumed ? 0 : 96),
                  },
                  view_width: width,
                  view_height: height,
                  density: 2,
                };
              },
              { scale: textScale, consumed: alreadyConsumed },
            );
            const layerCase =
              profile.width === 320 &&
              profile.height === 640 &&
              textScale === 1 &&
              !alreadyConsumed;
            if (layerCase) {
              await page.click('.add-document-trigger');
              await clickChoice(page, 'New text file');
              await page.waitForSelector('.cm-content[contenteditable="true"]');
              await page.click('.cm-content');
              await page.keyboard.type('S046_LAYER_FIXTURE');
            }
            await page.click('.application-menu-trigger');
            await page.evaluate(() =>
              Array.from(document.querySelectorAll('.application-menu button'))
                .find((node) => node.textContent.trim() === 'Diagnostics')
                .click(),
            );
            await page.waitForSelector('.diagnostic-preview');
            await page.waitForSelector(
              '.diagnostics-sheet[data-native-viewport="true"]',
            );
            const measured = await measureDiagnostics(
              page,
              alreadyConsumed ? 0 : 48,
            );
            try {
              assertDiagnosticMeasurement(measured);
            } catch (error) {
              failures.push({
                profile: profile.width + 'x' + profile.height,
                text_scale: textScale,
                stage: 'diagnostics_consumed_' + alreadyConsumed,
                message: error.message,
                measurement: measured,
              });
            }
            assert.deepEqual(
              errors,
              [],
              'The actual diagnostic flow must not throw',
            );
            if (layerCase) {
              await page.$eval('.diagnostics-sheet', (sheet) =>
                sheet.dispatchEvent(
                  new KeyboardEvent('keydown', {
                    key: 'w',
                    ctrlKey: true,
                    bubbles: true,
                  }),
                ),
              );
              await page.waitForSelector('.resolution-dialog');
              const modal = await page.evaluate(() => {
                const dialog = document.querySelector('.resolution-dialog');
                const button = Array.from(
                  dialog.querySelectorAll('button'),
                ).find((node) => node.textContent.trim() === 'Cancel');
                const rect = button.getBoundingClientRect();
                const hit = document.elementFromPoint(
                  (rect.left + rect.right) / 2,
                  (rect.top + rect.bottom) / 2,
                );
                return {
                  hit: hit === button || button.contains(hit),
                  diagnosticsMounted:
                    !!document.querySelector('.diagnostics-sheet'),
                  title: dialog.querySelector('h2').textContent,
                };
              });
              assert.equal(modal.diagnosticsMounted, true);
              assert.equal(
                modal.hit,
                true,
                'Actual dirty-close modal must remain above Diagnostics',
              );
              await page.evaluate(() =>
                Array.from(
                  document.querySelectorAll('.resolution-dialog button'),
                )
                  .find((node) => node.textContent.trim() === 'Cancel')
                  .click(),
              );
              await page.waitForFunction(
                () => !document.querySelector('.resolution-dialog'),
              );
              measured.modalPriority = modal;
            }
            await page.evaluate(() =>
              Array.from(document.querySelectorAll('.diagnostics-sheet button'))
                .find((node) => node.textContent.trim() === 'Close diagnostics')
                .click(),
            );
            await page.waitForFunction(
              () => !document.querySelector('.diagnostics-sheet'),
            );
            assert.equal(
              await page.$eval(
                '.add-document-trigger',
                (trigger) =>
                  !trigger.disabled &&
                  getComputedStyle(trigger).visibility === 'visible' &&
                  trigger.getBoundingClientRect().height > 0,
              ),
              true,
              'Closing Diagnostics must restore visible mounted Add chrome',
            );
            diagnosticCases.push({
              profile,
              text_scale: textScale,
              native_inset_already_consumed: alreadyConsumed,
              ...measured,
            });
          } finally {
            await page.close();
          }
        }
    }
    const surfaceContrast = await checkS046SurfaceContrast({
      browser,
      origin,
      installNativeSeams,
    });
    failures.push(...surfaceContrast.failures);
    const receipt = {
      schema_version: 1,
      status: failures.length ? 'failed' : 'passed',
      failures,
      evidence_class: 'headless_browser_composed_application',
      source_commit: sourceCommit,
      browser: await browser.version(),
      index_sha256: createHash('sha256').update(index).digest('hex'),
      assets: assetHashes,
      native_operations:
        'Tauri storage, picker cancellation, and listener seams only; no synthetic application markup',
      limits: [
        'Root font scaling and viewport contraction supplement Android qualification; they do not prove Android WebView textZoom, native IME, system insets, native Back, or APK behavior.',
        'Diagnostic visible-frame rectangles model the retained API36 observation with synthetic native identity/preview payloads; native input predicates and APK proof remain independent.',
      ],
      cases,
      diagnostic_cases: diagnosticCases,
      native_authoring_cases: nativeAuthoringCases,
      surface_contrast_cases: surfaceContrast.cases,
    };
    if (receiptPath) {
      await mkdir(dirname(receiptPath), { recursive: true });
      await writeFile(
        receiptPath,
        JSON.stringify(receipt, null, 2) + '\n',
        'utf8',
      );
    }
    if (failures.length)
      throw new AggregateError(
        failures.map(
          (failure) =>
            new Error(
              failure.profile +
                ' font=' +
                failure.text_scale +
                ' ' +
                failure.stage +
                ': ' +
                failure.message,
            ),
        ),
        'Composed application geometry failed ' +
          failures.length +
          ' required audit rows',
      );
    return receipt;
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const argument = (name) => {
    const index = process.argv.indexOf(name);
    return index < 0 ? '' : (process.argv[index + 1] ?? '');
  };
  const receipt = await checkAndroidAuthoringLayout({
    receiptPath: argument('--receipt'),
    sourceCommit:
      argument('--source-commit') ||
      process.env.GLITCHPAD_BUILD_COMMIT ||
      process.env.GITHUB_SHA ||
      null,
  });
  console.log(
    'Verified actual production React Add document geometry and authoring actions across ' +
      receipt.cases.length +
      ' browser profiles. Android APK/WebView qualification remains separate.',
  );
}
