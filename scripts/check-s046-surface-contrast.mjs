import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const colorAudit = String.raw`import json, sys
from coloraide import Color
rows = json.load(sys.stdin)
for row in rows:
    foreground = Color(row['foreground'])
    background = Color(row['background'])
    if row['opacity'] < 1:
        behind = Color(row['behind'])
        foreground = Color.layer([foreground.set('alpha', row['opacity']), behind], space='srgb')
        background = Color.layer([background.set('alpha', row['opacity']), behind], space='srgb')
    row['contrast'] = foreground.contrast(background, method='wcag21')
    row['canonical_foreground'] = Color(row['foreground']).convert('srgb').coords() == Color(row['expectedForeground']).convert('srgb').coords()
json.dump(rows, sys.stdout)
`;

export function auditSurfaceColors(samples) {
  return JSON.parse(
    execFileSync(
      process.platform === 'win32' ? 'python' : 'python3',
      ['-c', colorAudit],
      {
        input: JSON.stringify(samples),
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10_000,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      },
    ),
  );
}

export function assertSurfaceContrast(measurement) {
  assert.equal(
    measurement.observedTheme,
    measurement.preference,
    'the persisted app theme must be applied',
  );
  assert.equal(
    measurement.observedOsLight,
    measurement.os === 'light',
    'the requested OS color scheme must be active',
  );
  assert.ok(
    measurement.previewUnchanged,
    'pending export must retain the exact frozen diagnostic JSON',
  );
  assert.deepEqual(
    measurement.errors,
    [],
    'the real application must complete the contrast journey without render errors',
  );
  for (const [stage, expectedButtons] of [
    ['decision', 3],
    ['decision_pending', 3],
    ['diagnostics', 4],
    ['diagnostics_pending', 4],
  ]) {
    const samples = measurement.samples.filter(
      (sample) => sample.stage === stage,
    );
    for (const kind of stage.startsWith('decision')
      ? ['heading', 'body', 'status']
      : ['heading', 'body', 'status', 'json']) {
      assert.ok(
        samples.some((sample) => sample.kind === kind),
        stage + ' must measure actual ' + kind + ' text',
      );
    }
    const buttons = samples.filter((sample) => sample.kind === 'action');
    assert.equal(
      buttons.length,
      expectedButtons,
      stage + ' must measure every real action',
    );
    for (const button of buttons)
      assert.equal(
        button.disabled,
        stage.endsWith('_pending'),
        stage + ' must preserve existing pending availability',
      );
    for (const sample of samples) {
      assert.equal(
        sample.canonical_foreground,
        true,
        stage +
          '/' +
          sample.kind +
          ' must follow the app preference through inherited AppFrame color',
      );
      if (sample.disabled) continue; // Disabled controls are retained as measured evidence, rather than counted as enabled text.
      assert.ok(
        Number.isFinite(sample.contrast) && sample.contrast >= 4.5,
        stage +
          '/' +
          sample.kind +
          ' contrast=' +
          sample.contrast +
          ' must meet normal-text AA',
      );
    }
  }
}

async function captureSurface(page, stage) {
  return page.evaluate((stage) => {
    const rootStyle = getComputedStyle(document.documentElement);
    const theme = document.documentElement.dataset.theme;
    const light =
      theme === 'light' ||
      (theme === 'system' &&
        matchMedia('(prefers-color-scheme: light)').matches);
    const foreground = rootStyle
      .getPropertyValue(light ? '--gl-light-text' : '--gl-text')
      .trim();
    const muted = rootStyle
      .getPropertyValue(light ? '--gl-light-text-muted' : '--gl-text-muted')
      .trim();
    function backgroundOf(element) {
      while (element) {
        const color = getComputedStyle(element).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent')
          return color;
        element = element.parentElement;
      }
      throw Error('surface has no painted background');
    }
    const specs = stage.startsWith('decision')
      ? [
          ['heading', '.resolution-dialog h2'],
          ['body', '.resolution-dialog p:not([role="status"])'],
          ['status', '.resolution-dialog [role="status"]'],
          ['action', '.resolution-actions button'],
        ]
      : [
          ['heading', '.task-surface-heading h2'],
          ['body', '.diagnostics-sheet p:not([role="status"])'],
          ['status', '.diagnostics-sheet [role="status"]'],
          ['json', '.diagnostic-preview'],
          ['action', '.task-surface:has(.diagnostics-sheet) button'],
        ];
    const samples = [];
    for (const spec of specs) {
      const nodes = document.querySelectorAll(spec[1]);
      for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        const style = getComputedStyle(node);
        if (!node.textContent.trim())
          throw Error('measured text must be populated');
        samples.push({
          stage,
          kind: spec[0],
          index,
          foreground: style.color,
          background: backgroundOf(node),
          behind: backgroundOf(node.parentElement),
          opacity: Number(style.opacity),
          disabled: node.disabled === true,
          expectedForeground:
            stage.startsWith('decision') && spec[0] === 'status'
              ? muted
              : foreground,
        });
      }
    }
    return samples;
  }, stage);
}

export async function checkS046SurfaceContrast({
  browser,
  origin,
  installNativeSeams,
}) {
  const cases = [];
  const failures = [];
  for (const os of ['light', 'dark'])
    for (const preference of ['system', 'light', 'dark']) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.setViewport({
          width: 390,
          height: 844,
          deviceScaleFactor: 1,
          isMobile: true,
          hasTouch: true,
        });
        await page.setUserAgent(
          'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
        );
        await page.emulateMediaFeatures([
          { name: 'prefers-color-scheme', value: os },
        ]);
        await page.evaluateOnNewDocument(installNativeSeams, preference);
        await page.evaluateOnNewDocument(() => {
          const invoke = window.__TAURI_INTERNALS__.invoke;
          window.__TAURI_INTERNALS__.invoke = function (command, args) {
            if (command === 'create_android_document')
              return new Promise((_resolve, reject) => {
                window.__contrastCancelNative = () =>
                  reject({
                    category: 'unavailable',
                    summary: 'Synthetic picker cancellation',
                    context: { reason: 'picker_cancelled' },
                  });
              });
            return invoke(command, args);
          };
        });
        await page.goto(origin, { waitUntil: 'load' });
        await page.waitForSelector('.add-document-trigger');
        await page.waitForFunction(
          (theme) => document.documentElement.dataset.theme === theme,
          {},
          preference,
        );
        const clickText = (label) =>
          page.evaluate((label) => {
            const button = Array.from(document.querySelectorAll('button')).find(
              (node) =>
                (node.getAttribute('aria-label') || node.textContent.trim()) ===
                label,
            );
            if (!button) throw Error('missing action ' + label);
            button.click();
          }, label);
        await clickText('Add document');
        await clickText('New text file');
        await page.waitForSelector('.cm-content[contenteditable="true"]');
        await page.focus('.cm-content');
        await page.keyboard.type('Synthetic surface contrast fixture');
        await page.$eval('.app-shell', (node) =>
          node.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'w',
              ctrlKey: true,
              bubbles: true,
            }),
          ),
        );
        await page.waitForSelector('.resolution-dialog');
        const samples = await captureSurface(page, 'decision');
        await clickText('Save As');
        await page.waitForFunction(() => {
          const actions = document.querySelectorAll(
            '.resolution-actions button',
          );
          return (
            actions.length === 3 &&
            Array.from(actions).every((button) => button.disabled)
          );
        });
        samples.push(...(await captureSurface(page, 'decision_pending')));
        await page.evaluate(() => window.__contrastCancelNative());
        await page.waitForFunction(
          () => !document.querySelector('.resolution-dialog'),
        );
        await page.click('.application-menu-trigger');
        await clickText('Diagnostics');
        await page.waitForSelector('.diagnostic-preview');
        const preview = await page.$eval(
          '.diagnostic-preview',
          (node) => node.textContent,
        );
        samples.push(...(await captureSurface(page, 'diagnostics')));
        await clickText('Save previewed bundle');
        await page.waitForSelector('.diagnostics-sheet[aria-busy="true"]');
        samples.push(...(await captureSurface(page, 'diagnostics_pending')));
        await page.evaluate(() => window.__contrastCancelNative());
        await page.waitForSelector('.diagnostics-sheet[aria-busy="false"]');
        const observed = await page.evaluate(() => ({
          observedTheme: document.documentElement.dataset.theme,
          observedOsLight: matchMedia('(prefers-color-scheme: light)').matches,
        }));
        cases.push({
          os,
          preference,
          ...observed,
          previewUnchanged:
            preview ===
            (await page.$eval(
              '.diagnostic-preview',
              (node) => node.textContent,
            )),
          samples,
          errors,
        });
      } catch (error) {
        failures.push({
          profile: os + '/' + preference,
          text_scale: 1,
          stage: 's046_contrast',
          message: error.message,
        });
      } finally {
        await page.close();
      }
    }
  const allSamples = auditSurfaceColors(
    cases.flatMap((entry) => entry.samples),
  );
  let offset = 0;
  for (const entry of cases) {
    entry.samples = allSamples.slice(offset, offset + entry.samples.length);
    offset += entry.samples.length;
    try {
      assertSurfaceContrast(entry);
    } catch (error) {
      failures.push({
        profile: entry.os + '/' + entry.preference,
        text_scale: 1,
        stage: 's046_contrast',
        message: error.message,
        measurement: entry,
      });
    }
  }
  return { cases, failures };
}
