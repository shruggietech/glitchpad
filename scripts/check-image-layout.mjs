import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { build } from '../apps/glitchpad/node_modules/vite/dist/node/index.js';

if (process.platform === 'win32')
  throw new Error(
    'Use scripts/invoke-docker-hidden.ps1 for image layout qualification',
  );
const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = join(root, 'artifacts/image-layout');
await mkdir(scratch, { recursive: true });
const manifest = JSON.parse(
  await readFile(join(root, 'fixtures/images/manifest.json'), 'utf8'),
);
assert.equal(manifest.license, 'Apache-2.0');
assert.equal(manifest.files.length, 30);
for (const file of manifest.files) {
  assert.match(
    file.name,
    /^(?:original\.(?:png|jpg|webp|bmp|tiff|gif|svg)|orientation-[1-8]\.jpg|s047-playback\.gif|animated\.webp|entries\.ico|hostile\.svg|svg-(?:presentation|namespaced|reuse|external|cycle|malformed|unsupported|missing|resource|viewport|read-denied)\.svg)$/u,
  );
  const bytes = await readFile(join(root, 'fixtures/images', file.name));
  assert.equal(bytes.length, file.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
}
const source = await readFile(
  join(root, 'scripts/fixtures/image-layout.tsx'),
  'utf8',
);
await writeFile(
  join(scratch, 'entry.tsx'),
  source.replaceAll("'../../", "'" + root.replaceAll('\\', '/')),
);
await writeFile(
  join(scratch, 'index.html'),
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="./entry.tsx"></script></body></html>',
);
await build({
  configFile: join(root, 'apps/glitchpad/vite.config.ts'),
  root: scratch,
  logLevel: 'warn',
  build: {
    outDir: join(scratch, 'built'),
    emptyOutDir: true,
    rollupOptions: { input: join(scratch, 'index.html') },
  },
  resolve: { dedupe: ['react', 'react-dom'] },
});
const built = join(scratch, 'built');
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const target = resolve(
      built,
      '.' + (pathname === '/' ? '/index.html' : pathname),
    );
    if (!target.startsWith(built + '/')) throw new Error('outside root');
    const bytes = await readFile(target);
    res.setHeader(
      'Content-Type',
      { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[
        extname(target)
      ] ?? 'application/octet-stream',
    );
    res.end(bytes);
  } catch {
    res.statusCode = 404;
    res.end('missing');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await puppeteer.launch({
  headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const results = [];
let page;
try {
  page = await browser.newPage();
  const failures = [];
  page.on('pageerror', (e) => failures.push(e.message));
  const click = async (name) => {
    const selector = await page.evaluate((name) => {
      const scope =
        document.querySelector('.task-surface[data-state="open"]') || document;
      const button = [...scope.querySelectorAll('button')].find((e) => {
        const r = e.getBoundingClientRect();
        return (
          (e.getAttribute('aria-label') || e.textContent.trim()) === name &&
          !e.disabled &&
          r.width > 0 &&
          r.height > 0 &&
          getComputedStyle(e).visibility !== 'hidden' &&
          !e.closest('[aria-hidden="true"],[inert],[hidden]')
        );
      });
      if (!button) throw new Error('Missing ' + name);
      button.dataset.layoutTarget = 'true';
      delete button.dataset.layoutPriorRectangle;
      window.__layoutTrustedClick = false;
      button.addEventListener('click', event => { window.__layoutTrustedClick = event.isTrusted; }, { once: true });
      button.scrollIntoView({ block: 'center' });
      return '[data-layout-target="true"]';
    }, name);
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-layout-target="true"]');
      if (!button || button.disabled) return false;
      const r = button.getBoundingClientRect();
      const rectangle = JSON.stringify([r.left, r.top, r.width, r.height]);
      const stable = button.dataset.layoutPriorRectangle === rectangle;
      button.dataset.layoutPriorRectangle = rectangle;
      const hit = document.elementFromPoint((r.left+r.right)/2, (r.top+r.bottom)/2);
      return stable && r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth+1 && r.top >= 0 && r.bottom <= innerHeight+1 && (hit === button || button.contains(hit));
    }, { timeout: 30000 });
    await page.click(selector);
    await page.waitForFunction(() => window.__layoutTrustedClick === true, { timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() =>
      document
        .querySelector('[data-layout-target]')
        ?.removeAttribute('data-layout-target'),
    );
  };
  const viewportAction = async (family, name) => {
    const primaryVisible = await page.evaluate(
      (name) =>
        [
          ...document.querySelectorAll(
            '.diagram-controls button,.image-actions button',
          ),
        ].some((e) => {
          const r = e.getBoundingClientRect();
          return (
            (e.getAttribute('aria-label') || e.textContent.trim()) === name &&
            r.width > 0 &&
            r.height > 0 &&
            getComputedStyle(e).visibility !== 'hidden'
          );
        }),
      name,
    );
    if (primaryVisible) {
      await click(name);
      return 'primary';
    }
    await click(
      family === 'diagram' ? 'More diagram tools' : 'More image tools',
    );
    await page.waitForSelector('.task-surface[data-state="open"]');
    await click(name);
    await click(
      family === 'diagram' ? 'Close Diagram tools' : 'Close Image tools',
    );
    await page.waitForFunction(
      () => !document.querySelector('[role="dialog"]'),
    );
    return 'more';
  };
  const measure = () =>
    page.evaluate(() => {
      const image = document.querySelector('.diagram-image,.image-preview');
      const pane = document.querySelector('.diagram-canvas,.image-pane');
      const r = image.getBoundingClientRect();
      const p = pane.getBoundingClientRect();
      return {
        width: r.width,
        height: r.height,
        pane: { width: p.width, height: p.height },
        scale: Number(pane.dataset.viewportScale),
        mode: pane.dataset.viewportMode,
        panX: Number(pane.dataset.viewportPanX),
        panY: Number(pane.dataset.viewportPanY),
      };
    });
  for (const frame of [
    { width: 320, height: 240 },
    { width: 360, height: 640 },
    { width: 640, height: 360 },
    { width: 1280, height: 720 },
  ])
    for (const touch of [false, true])
      for (const font of [1, 2])
        for (const family of ['diagram', 'raster', 'svg', 'animation', 'ico']) {
          console.log(
            JSON.stringify({
              case: results.length + 1,
              frame,
              touch,
              font,
              family,
            }),
          );
          await page.setViewport({
            ...frame,
            hasTouch: touch,
            isMobile: touch,
          });
          await page.goto(
            'http://127.0.0.1:' + server.address().port + '/?family=' + family,
          );
          await page.evaluate(
            (font) =>
              (document.documentElement.style.fontSize = font * 100 + '%'),
            font,
          );
          await page.waitForSelector('[data-preview-ready="true"]');
          await page.waitForFunction(() => {
            const img = document.querySelector('.diagram-image,.image-preview'),
              pane = document.querySelector('.diagram-canvas,.image-pane');
            const r = img.getBoundingClientRect(),
              p = pane.getBoundingClientRect();
            const scale = Math.min(
              1,
              p.width / img.naturalWidth,
              p.height / img.naturalHeight,
            );
            return (
              img.complete &&
              Math.abs(r.width - img.naturalWidth * scale) < 1 &&
              Math.abs(r.height - img.naturalHeight * scale) < 1
            );
          });
          const fit = await measure();
          assert.ok(
            fit.width <= fit.pane.width + 1 &&
              fit.height <= fit.pane.height + 1,
            'Fit stays within actual canvas',
          );
          const geometry = await page.evaluate(() => {
            const root = document
              .querySelector('.document-surface')
              .getBoundingClientRect();
            const pane = document
              .querySelector('.diagram-canvas,.image-pane')
              .getBoundingClientRect();
            const controls = [
              ...document.querySelectorAll(
                '.diagram-controls button,.image-actions button',
              ),
            ].map((e) => {
              const r = e.getBoundingClientRect();
              return {
                name: e.getAttribute('aria-label') || e.textContent.trim(),
                exposed:
                  r.width > 0 &&
                  r.height > 0 &&
                  getComputedStyle(e).visibility !== 'hidden',
                w: r.width,
                h: r.height,
                left: r.left,
                right: r.right,
              };
            });
            return {
              ratio: pane.height / root.height,
              controls,
              width: document.documentElement.scrollWidth,
            };
          });
          assert.ok(
            geometry.ratio >= 0.7,
            'viewport must own at least70% of document area ' +
              JSON.stringify(geometry),
          );
          assert.ok(
            geometry.width <= frame.width,
            'no horizontal page overflow',
          );
          const exposedControls = geometry.controls.filter((r) => r.exposed);
          assert.ok(exposedControls.length > 0, 'primary More remains exposed');
          for (const r of geometry.controls.filter((r) => !r.exposed))
            assert.ok(
              ['Fit', 'Zoom out', 'Zoom in'].includes(r.name),
              'only controls verified in More may be deferred ' +
                JSON.stringify(r),
            );
          for (const r of exposedControls) {
            assert.ok(
              r.w >= 48 && r.h >= 48,
              'primary target48px ' + JSON.stringify(r),
            );
            assert.ok(
              r.left >= 0 && r.right <= frame.width + 1,
              'primary target within frame',
            );
          }
          const zoomRoute = await viewportAction(family, 'Zoom in');
          const zoom = await measure();
          assert.ok(
            Math.abs(zoom.width / fit.width - 1.25) < 0.01,
            'first Fit zoom must be multiplicative',
          );
          const fitRoute = await viewportAction(family, 'Fit');
          const pane = family === 'diagram' ? '.diagram-canvas' : '.image-pane';
          await page.focus(pane);
          await page.keyboard.press('ArrowRight');
          const pan = await measure();
          assert.ok(
            Math.abs(pan.width - fit.width) < 1,
            'Fit pan preserves effective scale ' + JSON.stringify({ fit, pan }),
          );
          await page.keyboard.press('+');
          const keyed = await measure();
          assert.ok(
            Math.abs(keyed.width / fit.width - 1.25) < 0.01,
            'keyboard zoom targets same viewport',
          );
          await page.keyboard.press('0');
          await click(
            family === 'diagram' ? 'More diagram tools' : 'More image tools',
          );
          await page.waitForSelector('[role="dialog"]');
          const targets = await page.$$eval(
            '[role="dialog"] button,[role="dialog"] input,[role="dialog"] select',
            (elements) =>
              elements.map((e, index) => {
                e.dataset.layoutIndex = String(index);
                return index;
              }),
          );
          for (const index of targets) {
            await page.$eval('[data-layout-index="' + index + '"]', (e) =>
              e.scrollIntoView({ block: 'center' }),
            );
            const fact = await page.$eval(
              '[data-layout-index="' + index + '"]',
              (e) => {
                const r = e.getBoundingClientRect(),
                  hit = document.elementFromPoint(
                    (r.left + r.right) / 2,
                    (r.top + r.bottom) / 2,
                  );
                return {
                  w: r.width,
                  h: r.height,
                  left: r.left,
                  right: r.right,
                  top: r.top,
                  bottom: r.bottom,
                  hit: e === hit || e.contains(hit),
                };
              },
            );
            assert.ok(fact.w >= 48 && fact.h >= 48, 'disclosed target48px');
            assert.ok(
              fact.left >= 0 &&
                fact.right <= frame.width + 1 &&
                fact.top >= 0 &&
                fact.bottom <= frame.height + 1 &&
                fact.hit,
              'disclosed control is visible and hit-testable after scroll',
            );
          }
          await click('Fit');
          const disclosedFit = await measure();
          assert.equal(
            disclosedFit.mode,
            'fit',
            'More Fit targets current viewport',
          );
          assert.ok(
            Math.abs(disclosedFit.width - fit.width) < 1,
            'More Fit restores measured scale',
          );
          await click('Zoom in');
          const disclosedZoom = await measure();
          assert.ok(
            Math.abs(disclosedZoom.width / disclosedFit.width - 1.25) < 0.01,
            'More Zoom in multiplies the same viewport scale',
          );
          await click('Zoom out');
          const disclosedZoomOut = await measure();
          assert.ok(
            Math.abs(disclosedZoomOut.width - disclosedFit.width) < 1,
            'More Zoom out reverses the same viewport Zoom in',
          );
          await click('Fit');
          assert.equal(
            (await measure()).mode,
            'fit',
            'More Fit restores fit mode after zoom',
          );
          await click('Actual size');
          const actual = await measure();
          assert.equal(actual.scale, 1, 'actual size is intrinsic scale1');
          if (family !== 'diagram') {
            await page.select('[aria-label="Image background"]', 'dark');
            if (family === 'ico') {
              await page.select('[aria-label="Icon entry"]', '1');
              await page.waitForFunction(
                () =>
                  document.querySelector('.image-pane').dataset
                    .imageSelection === '1' &&
                  document.querySelector('.image-pane').dataset.previewReady ===
                    'true',
              );
            }
            if (family === 'animation') {
              await page.click('[aria-label="Animation frame"]');
              await page.keyboard.down('Control');
              await page.keyboard.press('KeyA');
              await page.keyboard.up('Control');
              await page.keyboard.type('2');
              await page.keyboard.press('Tab');
              await page.waitForFunction(
                () =>
                  document.querySelector('.image-pane').dataset
                    .imageSelection === '1' &&
                  document.querySelector('.image-pane').dataset.previewReady ===
                    'true',
              );
            }
          }
          await click('Reset view');
          const reset = await measure();
          assert.equal(reset.mode, 'fit');
          assert.ok(
            Math.abs(reset.width - fit.width) < 1,
            'Reset restores measured Fit ' + JSON.stringify({ fit, reset }),
          );
          if (family !== 'diagram')
            assert.equal(
              await page.$eval(
                '.image-pane',
                (e) => e.dataset.viewportBackground,
              ),
              'dark',
              'Reset retains background',
            );
          if (family === 'ico' || family === 'animation')
            assert.equal(
              await page.$eval('.image-pane', (e) => e.dataset.imageSelection),
              '1',
              'Reset retains selection',
            );
          await click(
            family === 'diagram' ? 'Close Diagram tools' : 'Close Image tools',
          );
          await page.waitForFunction(
            () => !document.querySelector('[role="dialog"]'),
          );
          await page.waitForFunction(
            (name) =>
              document.activeElement?.getAttribute('aria-label') === name,
            {},
            family === 'diagram' ? 'More diagram tools' : 'More image tools',
          );
          assert.equal(
            await page.evaluate(() =>
              document.activeElement?.getAttribute('aria-label'),
            ),
            family === 'diagram' ? 'More diagram tools' : 'More image tools',
            'dismissal restores invoking focus',
          );
          assert.deepEqual(
            failures,
            [],
            'composed component has no page errors',
          );
          results.push({
            frame,
            touch,
            font,
            family,
            fit,
            zoom,
            zoomRoute,
            fitRoute,
            geometry,
            disclosedFit,
            disclosedZoom,
            disclosedZoomOut,
            pan,
            actual,
            reset,
          });
        }
  await writeFile(
    join(scratch, 'result.json'),
    JSON.stringify(
      {
        browser: await browser.version(),
        cases: results.length,
        results,
        evidence:
          'Actual React ImageSurface/DiagramViewport and generated AppFrame, production-target bundle with deterministic synthetic gateway; not native decode/export qualification',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Verified ' +
      manifest.files.length +
      ' fixture digests and ' +
      results.length +
      ' actual React/AppFrame image/diagram cases.',
  );
} catch (error) {
  if (page) {
    await page.screenshot({ path: join(scratch, 'failed.png') });
    await writeFile(
      join(scratch, 'failed.json'),
      JSON.stringify(
        await page.evaluate(() => ({
          text: document.body.innerText.slice(0, 4096),
          frame: document.querySelector('[aria-label="Animation frame"]')
            ?.value,
          pane: document
            .querySelector('.image-pane,.diagram-canvas')
            ?.outerHTML.slice(0, 2048),
        })),
        null,
        2,
      ),
    );
  }
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
