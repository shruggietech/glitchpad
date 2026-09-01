import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'out');
const port = Number(process.argv[3] ?? 4174);
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.woff2', 'font/woff2'],
]);

async function resolveRequest(pathname) {
  const decoded = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidates = decoded
    ? [
        join(root, decoded),
        join(root, `${decoded}.html`),
        join(root, decoded, 'index.html'),
      ]
    : [join(root, 'index.html')];
  for (const candidate of candidates) {
    const resolved = resolve(candidate);
    if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) continue;
    try {
      if ((await stat(resolved)).isFile()) return resolved;
    } catch {}
  }
  return join(root, '404.html');
}

await access(root);
createServer(async (request, response) => {
  const path = await resolveRequest(
    new URL(request.url ?? '/', 'http://localhost').pathname,
  );
  response.statusCode = path.endsWith('404.html') ? 404 : 200;
  response.setHeader(
    'Content-Type',
    mime.get(extname(path)) ?? 'application/octet-stream',
  );
  createReadStream(path).pipe(response);
}).listen(port, '127.0.0.1', () =>
  console.log(`Serving ${root} at http://127.0.0.1:${port}`),
);
