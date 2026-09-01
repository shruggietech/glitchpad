import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(siteRoot, 'out');

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path)));
    else result.push(path);
  }
  return result;
}

export async function auditExport() {
  const problems = [];
  const all = await files(outRoot);
  const html = all.filter((path) => extname(path) === '.html');
  const routeSet = new Set(
    html.map((path) => {
      const name = relative(outRoot, path).replaceAll('\\', '/');
      return name === 'index.html'
        ? '/'
        : `/${name.replace(/(?:\/index)?\.html$/, '')}`;
    }),
  );
  for (const required of [
    '/',
    '/docs',
    '/docs/technical-specification',
    '/license',
    '/support',
    '/security',
  ]) {
    if (!routeSet.has(required))
      problems.push(`missing exported route: ${required}`);
  }
  for (const path of html) {
    const source = await readFile(path, 'utf8');
    const name = relative(outRoot, path).replaceAll('\\', '/');
    if (
      /fonts\.(?:googleapis|gstatic)\.com|google-analytics|googletagmanager/i.test(
        source,
      )
    )
      problems.push(`remote runtime dependency: ${name}`);
    if (/example\.com|localhost|temporary mark/i.test(source))
      problems.push(`placeholder public value: ${name}`);
    if (!/<meta name="description" content="[^"]+"/.test(source))
      problems.push(`missing description metadata: ${name}`);
  }
  return problems;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const problems = await auditExport();
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      'Static export routes, metadata, and runtime-resource policy are clean.',
    );
}
