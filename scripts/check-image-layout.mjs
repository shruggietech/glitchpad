import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(join(root, 'fixtures/images/manifest.json'), 'utf8'));
assert.equal(manifest.license, 'Apache-2.0');
assert.equal(manifest.files.length, 13);
for (const file of manifest.files) {
  assert.match(file.name, /^(?:original\.(?:png|jpg|webp|bmp|tiff)|orientation-[1-8]\.jpg)$/u);
  const bytes = await readFile(join(root, 'fixtures/images', file.name));
  assert.equal(bytes.length, file.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
}
const png = [...await readFile(join(root, 'fixtures/images/original.png'))];
const css = await readFile(join(root, 'apps/glitchpad/src/components/ImageSurface.css'), 'utf8');
const browser = await puppeteer.launch({ headless: 'shell', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let cases = 0;
try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.url().startsWith('blob:') || request.url().startsWith('data:')) void request.continue();
    else void request.abort();
  });
  for (const viewport of [{ width: 320, height: 240 }, { width: 360, height: 640 }, { width: 480, height: 360 }, { width: 1280, height: 720 }]) {
    for (const touch of [false, true]) {
      await page.setViewport({ ...viewport, hasTouch: touch, isMobile: touch });
      await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{height:100%;margin:0}*{box-sizing:border-box}button,select{font:inherit;padding:4px}.document-surface{height:calc(100% - 32px)}${css}</style></head><body><header style="height:32px">File menu</header><main class="document-surface"><div class="image-layout"><div class="image-actions"><button>Fit</button><button>Actual size</button><button aria-label="Zoom out">−</button><output>100%</output><button aria-label="Zoom in">+</button><button>Reset view</button><label>Image background<select><option>Checkerboard</option></select></label><button>File information</button></div><div class="image-pane image-background-checker"><img class="image-preview" alt="Original fixture" style="width:4px;height:3px;transform:translate(-50%,-50%)"></div></div></main></body></html>`);
      await page.evaluate(bytes => {
        document.querySelector('img').src = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'image/png' }));
      }, png);
      await page.waitForFunction(() => document.querySelector('img').complete && document.querySelector('img').naturalWidth === 4);
      const dimensions = await page.evaluate(() => {
        const actions = document.querySelector('.image-actions').getBoundingClientRect();
        const pane = document.querySelector('.image-pane').getBoundingClientRect();
        const button = document.querySelector('button').getBoundingClientRect();
        return { pane: pane.height, actions: actions.height, width: document.documentElement.scrollWidth, viewport: innerWidth, target: button.height };
      });
      assert.ok(dimensions.pane / (dimensions.pane + dimensions.actions) >= 0.70, 'image must own the document viewport');
      assert.equal(dimensions.width, dimensions.viewport, 'toolbar must not cause page overflow');
      if (touch) assert.ok(dimensions.target >= 44, 'touch actions require reachable targets');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      for (let n = 0; n < 8; n++) await page.keyboard.press('Tab');
      await page.evaluate(() => URL.revokeObjectURL(document.querySelector('img').src));
      cases++;
    }
  }
} finally { await browser.close(); }
console.log(`Verified ${manifest.files.length} original image digests and ${cases} compact viewport cases.`);
