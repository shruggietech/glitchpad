import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

import puppeteer from 'puppeteer';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1));
const distribution = join(root, 'apps', 'glitchpad', 'dist');

export const isAllowedRuntimeRequest = (target, origin) => {
  const url = new URL(target, origin);
  return url.origin === origin || url.protocol === 'blob:' || url.protocol === 'data:';
};

const contentType = (path) => ({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
}[extname(path)] ?? 'application/octet-stream');

const serve = async (request, response) => {
  const requested = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  const relative = normalize(requested === '/' ? 'index.html' : requested.slice(1));
  if (relative.startsWith('..')) {
    response.writeHead(403).end();
    return;
  }
  let path = join(distribution, relative);
  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    response.writeHead(200, { 'content-type': contentType(path), 'cache-control': 'no-store' });
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
};

export const verifyMermaidRuntime = async () => {
  await stat(join(distribution, 'index.html'));
  const server = createServer((request, response) => void serve(request, response));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('runtime_server_address_failed');
  const origin = `http://127.0.0.1:${address.port}`;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    const externalRequests = [];
    const dialogs = [];
    const pageErrors = [];
    page.on('request', (request) => {
      if (!isAllowedRuntimeRequest(request.url(), origin)) externalRequests.push(request.url());
    });
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        configurable: false,
        value: { invoke: () => { throw new Error('native_invocation_blocked_by_test'); } },
      });
      window.open = () => { throw new Error('navigation_blocked_by_test'); };
    });
    await page.goto(origin, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[role="tab"][aria-label*="diagram.mmd"]');
    await page.$eval('[role="tab"][aria-label*="diagram.mmd"]', (tab) => tab.click());
    await page.waitForSelector('img.diagram-image', { timeout: 10_000 });
    const source = await page.$eval('img.diagram-image', (image) => image.getAttribute('src'));
    if (!source?.startsWith('blob:')) throw new Error('runtime_diagram_is_not_inert_blob');
    if (externalRequests.length || dialogs.length || pageErrors.length)
      throw new Error(`runtime_boundary_failed requests=${externalRequests.length} dialogs=${dialogs.length} errors=${pageErrors.join('|')}`);
    process.stdout.write('Mermaid runtime rendered inertly with zero external requests, navigation dialogs, or native invocation.\n');
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  verifyMermaidRuntime().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
