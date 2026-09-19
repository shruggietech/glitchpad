import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? '') : '';
};
const receiptPath = argument('--receipt');
const manifestPath = argument('--manifest');
const sourceCommit = argument('--source-commit');
const receiptRequested = Boolean(receiptPath || manifestPath || sourceCommit);
if (
  receiptRequested &&
  (!receiptPath || !manifestPath || !/^[a-f0-9]{40}$/u.test(sourceCommit))
)
  throw new Error(
    'scale receipt requires receipt, manifest, and source commit arguments',
  );
const manifestBytes = receiptRequested ? await readFile(manifestPath) : null;
const manifest = manifestBytes
  ? JSON.parse(manifestBytes.toString('utf8'))
  : null;
if (manifest && manifest.source_commit !== sourceCommit)
  throw new Error('scale receipt manifest source commit is stale');
const assetDirectory = join(
  repositoryRoot,
  'apps',
  'glitchpad',
  'dist',
  'assets',
);
const cssAsset = (await readdir(assetDirectory)).find((name) =>
  name.endsWith('.css'),
);
assert.ok(cssAsset, 'the production build must contain a CSS asset');
const css = await readFile(join(assetDirectory, cssAsset), 'utf8');
const [applicationSource, indexSource] = await Promise.all([
  readFile(join(repositoryRoot, 'apps', 'glitchpad', 'src', 'App.tsx'), 'utf8'),
  readFile(join(repositoryRoot, 'apps', 'glitchpad', 'index.html'), 'utf8'),
]);
for (const marker of [
  '<AppFrameEnvironmentBridge />',
  '<AppFrame host="tauri" layout="full-bleed">',
])
  assert.ok(
    applicationSource.includes(marker),
    `production shell omits ${marker}`,
  );
assert.ok(
  indexSource.includes('viewport-fit=cover'),
  'production viewport must opt into safe-area geometry',
);

const browser = await puppeteer.launch({
  headless: 'shell',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
let cases = 0;
const scaleCases = new Map([
  [100, 0],
  [125, 0],
  [150, 0],
  [200, 0],
]);
try {
  const page = await browser.newPage();
  const client = await page.createCDPSession();
  let variant = 0;
  for (const viewport of [
    { width: 480, height: 360 },
    { width: 960, height: 680 },
    { width: 1440, height: 900 },
  ]) {
    for (const deviceScaleFactor of [1, 1.25, 1.5, 2]) {
      for (const hasTabs of [false, true]) {
        for (const coarsePointer of [false, true]) {
          const theme = variant % 2 === 0 ? 'dark' : 'light';
          const reducedMotion = variant % 3 === 0;
          const forcedColors = variant % 4 === 0;
          const pageScaleFactor = [1, 1.25, 1.5, 2][variant % 4];
          const textScaleFactor = [1, 1.25, 1.5, 2][variant % 4];
          await page.setViewport({
            ...viewport,
            deviceScaleFactor,
            hasTouch: coarsePointer,
            isMobile: coarsePointer,
          });
          await client.send('Emulation.setEmulatedMedia', {
            features: [
              { name: 'prefers-color-scheme', value: theme },
              {
                name: 'prefers-reduced-motion',
                value: reducedMotion ? 'reduce' : 'no-preference',
              },
              {
                name: 'forced-colors',
                value: forcedColors ? 'active' : 'none',
              },
            ],
          });
          await page.setContent(
            `<!doctype html><html data-theme="${theme}" style="font-size: ${textScaleFactor * 100}%"><head><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><style>${css}</style></head><body><div class="bb-app-frame" data-bb-app-frame data-bb-host="tauri" data-bb-layout="full-bleed"><a class="bb-skip-link bb-control" href="#bb-main">Skip to content</a><div class="bb-app-frame__scroll"><main id="bb-main" class="bb-app-frame__content" tabindex="-1"><div class="app-shell" data-has-tabs="${hasTabs}"><div class="shell-chrome" data-has-tabs="${hasTabs}"><div class="application-menu-shell application-toolbar" data-menu-active="true" data-menu-open="false"><button class="application-menu-trigger" type="button" aria-label="Menu"><span class="application-menu-glyph">☰</span></button></div>${hasTabs ? '<div class="tab-strip-shell"><div class="tab-list-shell">Fixture tab</div></div>' : ''}</div><section class="document-surface" aria-label="Document surface"><div class="document-render-failure"><p>Contained failure</p><button type="button">View source</button><button type="button">Retry preview</button></div></section></div></main></div><div id="bb-overlay-root" class="bb-app-frame__overlay" data-bb-overlay-root></div></div><script>const trigger=document.querySelector('.application-menu-trigger');trigger.addEventListener('click',()=>{const shell=document.querySelector('.application-menu-shell');const popup=document.createElement('div');popup.className='application-menu';popup.setAttribute('role','menu');popup.innerHTML='<button role="menuitem">Open</button><button role="menuitem">Preferences</button>';shell.append(popup);shell.dataset.menuOpen='true';});document.addEventListener('keydown',(event)=>{if(event.key!=='Escape')return;document.querySelector('.application-menu')?.remove();document.querySelector('.application-menu-shell').dataset.menuOpen='false';trigger.focus();});</script></body></html>`,
          );
          await client.send('Emulation.setPageScaleFactor', {
            pageScaleFactor,
          });
          const before = await page.evaluate(() => {
            const rect = (selector) => {
              const value = document
                .querySelector(selector)
                .getBoundingClientRect();
              return {
                top: value.top,
                right: value.right,
                bottom: value.bottom,
                left: value.left,
                width: value.width,
                height: value.height,
              };
            };
            const documentSurface = document.querySelector('.document-surface');
            const frame = rect('.bb-app-frame');
            const frameScroll = rect('.bb-app-frame__scroll');
            const spacer = document.createElement('div');
            spacer.setAttribute('aria-hidden', 'true');
            spacer.style.cssText =
              'height: calc(100vh + 200px); width: 1px';
            documentSurface.append(spacer);
            documentSurface.scrollTop = 37;
            return {
              frame,
              frameScroll,
              toolbar: rect('.application-toolbar'),
              trigger: rect('.application-menu-trigger'),
              glyph: rect('.application-menu-glyph'),
              document: rect('.document-surface'),
              action: rect('.document-render-failure button'),
              scrollTop: documentSurface.scrollTop,
              colorScheme: matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light',
              reducedMotion: matchMedia('(prefers-reduced-motion: reduce)')
                .matches,
              forcedColors: matchMedia('(forced-colors: active)').matches,
              pageScaleFactor: visualViewport?.scale ?? 1,
              rootFontSize: Number.parseFloat(
                getComputedStyle(document.documentElement).fontSize,
              ),
              frameCount: document.querySelectorAll('[data-bb-app-frame]')
                .length,
              mainCount: document.querySelectorAll('main').length,
              frameHost: document
                .querySelector('[data-bb-app-frame]')
                ?.getAttribute('data-bb-host'),
              frameLayout: document
                .querySelector('[data-bb-app-frame]')
                ?.getAttribute('data-bb-layout'),
              shellInsideMain: document
                .querySelector('main')
                ?.contains(document.querySelector('.app-shell')),
              rootOverflow: getComputedStyle(document.documentElement).overflow,
              bodyOverflow: getComputedStyle(document.body).overflow,
            };
          });
          await page.click('.application-menu-trigger');
          const after = await page.evaluate(() => {
            const rect = (selector) => {
              const value = document
                .querySelector(selector)
                .getBoundingClientRect();
              return {
                top: value.top,
                right: value.right,
                bottom: value.bottom,
                left: value.left,
                width: value.width,
                height: value.height,
              };
            };
            const documentSurface = document.querySelector('.document-surface');
            return {
              trigger: rect('.application-menu-trigger'),
              popup: rect('.application-menu'),
              document: rect('.document-surface'),
              scrollTop: documentSurface.scrollTop,
            };
          });
          const tolerance = 1 / deviceScaleFactor;
          assert.equal(
            before.frameCount,
            1,
            'fixture must contain one generated AppFrame',
          );
          assert.equal(
            before.mainCount,
            1,
            'generated AppFrame must own the only main landmark',
          );
          assert.equal(
            before.frameHost,
            'tauri',
            'generated AppFrame must use the Tauri host profile',
          );
          assert.equal(
            before.frameLayout,
            'full-bleed',
            'generated AppFrame must use the full-bleed layout',
          );
          assert.equal(
            before.shellInsideMain,
            true,
            'product shell must be inside the generated main landmark',
          );
          assert.equal(
            before.rootOverflow,
            'hidden',
            'generated AppFrame must own root overflow',
          );
          assert.equal(
            before.bodyOverflow,
            'hidden',
            'generated AppFrame must own body overflow',
          );
          assert.ok(
            Math.abs(before.frameScroll.top - before.frame.top) <= tolerance &&
              Math.abs(before.frameScroll.bottom - before.frame.bottom) <=
                tolerance,
            'headerless AppFrame scroll row must fill the governed viewport',
          );
          assert.ok(
            before.toolbar.bottom <= before.document.top + tolerance,
            'toolbar must not overlap the document',
          );
          assert.ok(
            before.trigger.bottom <= before.document.top + tolerance,
            'trigger must not overlap the document',
          );
          assert.ok(
            before.trigger.width >= (coarsePointer ? 44 : 32) - tolerance,
            'trigger width must preserve its pointer target',
          );
          assert.ok(
            before.trigger.height >= (coarsePointer ? 44 : 32) - tolerance,
            'trigger height must preserve its pointer target',
          );
          assert.ok(
            Math.abs(before.glyph.width - 18) <= tolerance &&
              Math.abs(before.glyph.height - 18) <= tolerance,
            'glyph must retain the compact visual footprint',
          );
          assert.ok(
            before.action.height >= (coarsePointer ? 44 : 32) - tolerance,
            'recovery actions must preserve their pointer target',
          );
          assert.ok(
            before.action.height <= 44 * textScaleFactor + tolerance,
            'recovery actions must retain intrinsic compact height at the governed text scale',
          );
          assert.ok(
            before.scrollTop > 0,
            'governed scroll case must start from a nonzero offset',
          );
          assert.ok(
            Math.abs(after.trigger.left - before.trigger.left) <= tolerance &&
              Math.abs(after.trigger.top - before.trigger.top) <= tolerance,
            'trigger must remain stable within one device pixel',
          );
          assert.ok(
            after.popup.top >= after.trigger.bottom - tolerance,
            'popup must remain below the trigger',
          );
          assert.ok(
            after.popup.left >= -tolerance &&
              after.popup.right <= viewport.width + tolerance &&
              after.popup.bottom <= viewport.height + tolerance,
            'popup must remain inside the viewport',
          );
          assert.deepEqual(
            after.document,
            before.document,
            'menu disclosure must not reflow the document',
          );
          assert.equal(
            after.scrollTop,
            before.scrollTop,
            'menu disclosure must preserve document scroll position',
          );
          assert.equal(
            before.forcedColors,
            forcedColors,
            'forced-colors emulation must match the governed case',
          );
          assert.equal(
            before.colorScheme,
            theme,
            'color-scheme emulation must match the governed case',
          );
          assert.equal(
            before.reducedMotion,
            reducedMotion,
            'motion emulation must match the governed case',
          );
          assert.ok(
            Math.abs(before.pageScaleFactor - pageScaleFactor) <= 0.01,
            `page-scale emulation must match the governed case (expected ${pageScaleFactor}, received ${before.pageScaleFactor})`,
          );
          assert.ok(
            Math.abs(before.rootFontSize - 16 * textScaleFactor) <= 0.01,
            `text scaling must match the governed case (expected ${16 * textScaleFactor}px, received ${before.rootFontSize}px)`,
          );
          await page.keyboard.press('Escape');
          const dismissed = await page.evaluate(() => {
            const trigger = document.querySelector('.application-menu-trigger');
            const documentSurface = document.querySelector('.document-surface');
            const triggerBounds = trigger.getBoundingClientRect();
            const documentBounds = documentSurface.getBoundingClientRect();
            return {
              trigger: {
                top: triggerBounds.top,
                left: triggerBounds.left,
                width: triggerBounds.width,
                height: triggerBounds.height,
              },
              document: {
                top: documentBounds.top,
                right: documentBounds.right,
                bottom: documentBounds.bottom,
                left: documentBounds.left,
                width: documentBounds.width,
                height: documentBounds.height,
              },
              focused: document.activeElement === trigger,
              popupPresent: Boolean(
                document.querySelector('.application-menu'),
              ),
              scrollTop: documentSurface.scrollTop,
            };
          });
          assert.deepEqual(
            dismissed.trigger,
            {
              top: before.trigger.top,
              left: before.trigger.left,
              width: before.trigger.width,
              height: before.trigger.height,
            },
            'trigger must remain stable after keyboard dismissal',
          );
          assert.deepEqual(
            dismissed.document,
            before.document,
            'keyboard dismissal must not reflow the document',
          );
          assert.equal(
            dismissed.focused,
            true,
            'Escape must restore trigger focus',
          );
          assert.equal(
            dismissed.popupPresent,
            false,
            'Escape must dismiss the popup',
          );
          assert.equal(
            dismissed.scrollTop,
            before.scrollTop,
            'keyboard dismissal must preserve document scroll position',
          );
          cases += 1;
          const scale = Math.round(deviceScaleFactor * 100);
          scaleCases.set(scale, (scaleCases.get(scale) ?? 0) + 1);
          variant += 1;
        }
      }
    }
  }
} finally {
  await browser.close();
}

process.stdout.write(
  `Shell layout geometry passed ${cases} production-CSS cases.\n`,
);
if (receiptRequested && manifestBytes && manifest) {
  const results = Object.fromEntries(
    [...scaleCases].map(([scale, count]) => [
      `geometry_scale_${scale}`,
      count === 12 ? 'pass' : 'fail',
    ]),
  );
  assert.ok(Object.values(results).every((result) => result === 'pass'));
  await writeFile(
    receiptPath,
    `${JSON.stringify(
      {
        schema_version: 1,
        candidate_manifest_sha256: createHash('sha256')
          .update(manifestBytes)
          .digest('hex'),
        evidence_authority: {
          kind: 'github_actions_workflow',
          workflow_identity: manifest.workflow_identity,
          source_commit: sourceCommit,
        },
        content_free: true,
        ...results,
        case_count: cases,
        completed_utc: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}
