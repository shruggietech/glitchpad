import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(siteRoot, 'out');
const manifestPath = join(siteRoot, 'lib', 'generated', 'documentation.json');
const metaPath = join(siteRoot, 'content', 'docs', 'meta.json');
const productionOrigin = 'https://glitchpad.com';

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path)));
    else result.push(path);
  }
  return result;
}

function routeFor(path) {
  const name = relative(outRoot, path).replaceAll('\\', '/');
  return name === 'index.html'
    ? '/'
    : `/${name.replace(/(?:\/index)?\.html$/, '')}`;
}

function htmlAttribute(source, expression) {
  return expression.exec(source)?.[1];
}

export function decodeHtmlAttribute(source) {
  return source
    ?.replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

function hasFragment(source, fragment) {
  const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:id|name)="${escaped}"`).test(source);
}

export async function auditExport() {
  const problems = [];
  const [all, manifestSource, metaSource] = await Promise.all([
    files(outRoot),
    readFile(manifestPath, 'utf8'),
    readFile(metaPath, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestSource);
  const meta = JSON.parse(metaSource);
  const deploymentPath = join(outRoot, 'deployment.json');
  if (!all.includes(deploymentPath))
    problems.push('missing deployment provenance');
  else {
    const deployment = JSON.parse(await readFile(deploymentPath, 'utf8'));
    if (deployment.productVersion !== manifest.productVersion)
      problems.push('deployment provenance has stale product version');
    if (!/^(?:local|[0-9a-f]{40})$/.test(deployment.sourceRevision ?? ''))
      problems.push('deployment provenance has invalid source revision');
  }

  const html = all.filter((path) => extname(path) === '.html');
  const exportedFiles = new Set(
    all.map((path) => `/${relative(outRoot, path).replaceAll('\\', '/')}`),
  );
  const routes = html.map(routeFor);
  const routeSet = new Set(routes);
  if (routeSet.size !== routes.length)
    problems.push('duplicate exported route');
  const expectedSectionRoutes = manifest.sections.map(({ route }) => route);
  const requiredRoutes = [
    '/',
    manifest.introductionRoute,
    ...expectedSectionRoutes,
    manifest.compatibilityRoute,
    '/license',
    '/support',
    '/security',
  ];
  for (const required of requiredRoutes) {
    if (!routeSet.has(required))
      problems.push(`missing exported route: ${required}`);
  }
  const expectedDocsRoutes = new Set([
    manifest.introductionRoute,
    ...expectedSectionRoutes,
    manifest.compatibilityRoute,
  ]);
  for (const route of routes.filter((candidate) =>
    candidate.startsWith('/docs'),
  )) {
    if (!expectedDocsRoutes.has(route))
      problems.push(`stale or unexpected documentation route: ${route}`);
  }
  const expectedPages = ['index', ...manifest.sections.map(({ slug }) => slug)];
  if (JSON.stringify(meta.pages) !== JSON.stringify(expectedPages))
    problems.push('documentation navigation order differs from the manifest');

  const htmlByRoute = new Map();
  for (const path of html) {
    const source = await readFile(path, 'utf8');
    const route = routeFor(path);
    htmlByRoute.set(route, source);
    const name = relative(outRoot, path).replaceAll('\\', '/');
    if (
      /fonts\.(?:googleapis|gstatic)\.com|google-analytics|googletagmanager/i.test(
        source,
      )
    )
      problems.push(`remote runtime dependency: ${name}`);
    if (/example\.com|localhost|temporary mark/i.test(source))
      problems.push(`placeholder public value: ${name}`);
    if (/no installable release is available|early development/i.test(source))
      problems.push(`stale release availability claim: ${name}`);
    if (!/<meta name="description" content="[^"]+"/.test(source))
      problems.push(`missing description metadata: ${name}`);
  }

  const metadataIdentities = new Set();
  for (const section of manifest.sections) {
    const source = htmlByRoute.get(section.route);
    if (!source) continue;
    const canonical = decodeHtmlAttribute(
      htmlAttribute(source, /<link rel="canonical" href="([^"]+)"/),
    );
    const description = decodeHtmlAttribute(
      htmlAttribute(source, /<meta name="description" content="([^"]+)"/),
    );
    const openGraphTitle = decodeHtmlAttribute(
      htmlAttribute(source, /<meta property="og:title" content="([^"]+)"/),
    );
    const openGraphUrl = decodeHtmlAttribute(
      htmlAttribute(source, /<meta property="og:url" content="([^"]+)"/),
    );
    const twitterTitle = decodeHtmlAttribute(
      htmlAttribute(source, /<meta name="twitter:title" content="([^"]+)"/),
    );
    const expectedTitle = `${section.number}. ${section.title}`;
    const expectedUrl = `${productionOrigin}${section.route}`;
    if (canonical !== expectedUrl)
      problems.push(`wrong canonical URL for ${section.route}`);
    if (description !== section.description)
      problems.push(`wrong description for ${section.route}`);
    if (openGraphTitle !== expectedTitle)
      problems.push(`wrong Open Graph title for ${section.route}`);
    if (openGraphUrl !== expectedUrl)
      problems.push(`wrong Open Graph URL for ${section.route}`);
    if (twitterTitle !== expectedTitle)
      problems.push(`wrong Twitter title for ${section.route}`);
    const identity = JSON.stringify([
      canonical,
      description,
      openGraphTitle,
      openGraphUrl,
      twitterTitle,
    ]);
    if (metadataIdentities.has(identity))
      problems.push(`duplicate metadata identity for ${section.route}`);
    metadataIdentities.add(identity);
  }

  const compatibility = htmlByRoute.get(manifest.compatibilityRoute) ?? '';
  if (!compatibility.includes('Technical specification moved'))
    problems.push('legacy route is missing its compatibility explanation');
  if (!compatibility.includes('href="/docs"'))
    problems.push('legacy route does not lead to /docs');
  if (/TS-FR-\d{3}|Table of Contents/.test(compatibility))
    problems.push(
      'legacy route still contains monolithic specification content',
    );

  for (const [route, source] of htmlByRoute) {
    const hrefs = [...source.matchAll(/\shref="([^"]+)"/g)].map((match) =>
      decodeHtmlAttribute(match[1]),
    );
    for (const href of hrefs) {
      if (!href || href.startsWith('/_next/') || href.startsWith('data:'))
        continue;
      let destination;
      try {
        destination = new URL(href, `${productionOrigin}${route}`);
      } catch {
        problems.push(`invalid link from ${route}: ${href}`);
        continue;
      }
      if (destination.origin !== productionOrigin) continue;
      const destinationRoute =
        destination.pathname.length > 1
          ? destination.pathname.replace(/\/$/, '')
          : destination.pathname;
      const target = htmlByRoute.get(destinationRoute);
      if (!target) {
        if (!exportedFiles.has(destination.pathname))
          problems.push(`broken internal route from ${route}: ${href}`);
        continue;
      }
      if (
        destination.hash &&
        !hasFragment(target, decodeURIComponent(destination.hash.slice(1)))
      )
        problems.push(`broken internal fragment from ${route}: ${href}`);
    }
  }
  return [...new Set(problems)];
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
      'Static export has the complete required route set, unique metadata, ordered documentation, and clean internal links.',
    );
}
