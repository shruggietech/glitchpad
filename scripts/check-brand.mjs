import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.py',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
]);
const mojibakeMarkers = [
  [0xfeff],
  [0xfffd],
  [0x00c3, 0x00a2],
  [0x00c3, 0x00a9],
  [0x00e2, 0x20ac],
].map((codes) => String.fromCharCode(...codes));

async function collectFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await collectFiles(path)));
    else result.push(path);
  }
  return result;
}

function parseTagAttributes(tag) {
  const attributes = new Map();
  const duplicates = new Set();
  const pattern =
    /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (attributes.has(name)) duplicates.add(name);
    else attributes.set(name, match[2] ?? match[3] ?? match[4]);
  }
  return { attributes, duplicates };
}

export function verifyReadmeBanner(readme) {
  const problems = [];
  const headingIndex = readme.search(/^# Glitchpad$/m);
  if (headingIndex < 0) {
    return ['README banner must precede the existing # Glitchpad heading'];
  }

  const pictures = [
    ...readme
      .slice(0, headingIndex)
      .matchAll(/<picture\b[^>]*>([\s\S]*?)<\/picture>/g),
  ];
  if (pictures.length !== 1) {
    return [
      'README banner introduction must contain exactly one <picture> before the # Glitchpad heading',
    ];
  }

  const children = pictures[0][1].match(
    /^\s*(<source\b[^>]*>)\s*(<img\b[^>]*>)\s*$/,
  );
  if (!children) {
    problems.push(
      'README banner must contain one direct <source> followed by one direct <img>',
    );
    return problems;
  }

  const { attributes: source, duplicates: sourceDuplicates } =
    parseTagAttributes(children[1]);
  const { attributes: image, duplicates: imageDuplicates } =
    parseTagAttributes(children[2]);
  for (const [label, duplicates, governedAttributes] of [
    ['dark source', sourceDuplicates, ['media', 'srcset']],
    ['fallback image', imageDuplicates, ['src', 'alt', 'width']],
  ]) {
    for (const attribute of governedAttributes) {
      if (duplicates.has(attribute)) {
        problems.push(
          `README banner ${label} must not repeat the "${attribute}" attribute`,
        );
      }
    }
  }
  for (const [label, actual, expected] of [
    ['dark source media', source.get('media'), '(prefers-color-scheme: dark)'],
    [
      'dark source srcset',
      source.get('srcset'),
      'brand/logos/svg/glitchpad-horizontal-white.svg',
    ],
    [
      'light fallback src',
      image.get('src'),
      'brand/logos/svg/glitchpad-horizontal-black.svg',
    ],
    ['fallback alternative text', image.get('alt'), 'Glitchpad'],
    ['fallback width', image.get('width'), '480'],
  ]) {
    if (actual !== expected) {
      problems.push(
        `README banner ${label} must be "${expected}" (received ${JSON.stringify(actual)})`,
      );
    }
  }

  return problems;
}

export async function verifyPublicCopy(
  canonicalPath,
  integratedPath,
  integratedLabel = integratedPath,
) {
  try {
    const [expected, actual] = await Promise.all([
      readFile(canonicalPath),
      readFile(integratedPath),
    ]);
    return expected.equals(actual)
      ? []
      : [`site asset drift: ${integratedLabel}`];
  } catch {
    return [`missing site asset copy: ${integratedLabel}`];
  }
}

export async function verifyBrand(
  brandRoot = join(repositoryRoot, 'brand'),
  projectRoot = repositoryRoot,
  options = {},
) {
  const integrations =
    options.integrations ?? resolve(projectRoot) === repositoryRoot;
  const problems = [];
  const manifestPath = join(brandRoot, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (
    manifest.name !== 'glitchpad-brand-kit' ||
    manifest.version !== '1.0.0' ||
    manifest.canon !== '1.0.0'
  ) {
    problems.push('brand/manifest.json must identify Glitchpad canon 1.0.0');
  }

  for (const entry of manifest.files) {
    const path = join(brandRoot, ...entry.path.split('/'));
    let bytes;
    try {
      bytes = await readFile(path);
    } catch {
      problems.push(`missing canonical file: brand/${entry.path}`);
      continue;
    }
    if (bytes.byteLength !== entry.bytes)
      problems.push(`byte-length drift: brand/${entry.path}`);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== entry.sha256)
      problems.push(`checksum drift: brand/${entry.path}`);
  }

  for (const path of await collectFiles(brandRoot)) {
    if (!textExtensions.has(extname(path).toLowerCase())) continue;
    const source = await readFile(path, 'utf8');
    const name = relative(projectRoot, path).replaceAll('\\', '/');
    if (source.charCodeAt(0) === 0xfeff) problems.push(`UTF-8 BOM: ${name}`);
    for (const marker of mojibakeMarkers) {
      if (source.includes(marker)) {
        problems.push(`possible mojibake: ${name}`);
        break;
      }
    }
  }

  const requiredLicenses = [
    'fonts/licenses/OFL-Geist.txt',
    'fonts/licenses/OFL-Space-Grotesk.txt',
  ];
  for (const license of requiredLicenses) {
    try {
      if (!(await stat(join(brandRoot, ...license.split('/')))).isFile())
        throw new Error('not a file');
    } catch {
      problems.push(`missing bundled-font license: brand/${license}`);
    }
  }

  const readme = integrations
    ? await readFile(join(projectRoot, 'README.md'), 'utf8')
    : '';
  if (integrations) problems.push(...verifyReadmeBanner(readme));

  const publicCopies = [
    [
      'fonts/woff2/Geist-Regular.woff2',
      'site/public/fonts/Geist-Regular.woff2',
    ],
    ['fonts/woff2/Geist-Medium.woff2', 'site/public/fonts/Geist-Medium.woff2'],
    [
      'fonts/woff2/GeistMono-Regular.woff2',
      'site/public/fonts/GeistMono-Regular.woff2',
    ],
    [
      'fonts/woff2/SpaceGrotesk-Medium.woff2',
      'site/public/fonts/SpaceGrotesk-Medium.woff2',
    ],
    [
      'fonts/woff2/SpaceGrotesk-Bold.woff2',
      'site/public/fonts/SpaceGrotesk-Bold.woff2',
    ],
    ['fonts/licenses/OFL-Geist.txt', 'site/public/fonts/OFL-Geist.txt'],
    [
      'fonts/licenses/OFL-Space-Grotesk.txt',
      'site/public/fonts/OFL-Space-Grotesk.txt',
    ],
    [
      'logos/svg/glitchpad-horizontal-white.svg',
      'site/public/logos/glitchpad-horizontal-white.svg',
    ],
    [
      'logos/svg/glitchpad-horizontal-black.svg',
      'site/public/logos/glitchpad-horizontal-black.svg',
    ],
    [
      'logos/png/glitchpad-social-preview-1280.png',
      'site/public/social-preview.png',
    ],
    [
      'logos/svg/glitchpad-mark-color.svg',
      'site/public/logos/glitchpad-mark-color.svg',
    ],
    ['favicons/favicon.svg', 'site/public/favicon.svg'],
    ['favicons/favicon.ico', 'site/public/favicon.ico'],
    ['favicons/favicon-16x16.png', 'site/public/favicon-16x16.png'],
    ['favicons/favicon-32x32.png', 'site/public/favicon-32x32.png'],
    ['favicons/apple-touch-icon.png', 'site/public/apple-touch-icon.png'],
    ['favicons/site.webmanifest', 'site/public/site.webmanifest'],
  ];
  for (const [canonical, integrated] of integrations ? publicCopies : []) {
    problems.push(
      ...(await verifyPublicCopy(
        join(brandRoot, ...canonical.split('/')),
        join(projectRoot, ...integrated.split('/')),
        integrated,
      )),
    );
  }

  const governed = [join(projectRoot, 'README.md'), join(projectRoot, 'site')];
  for (const root of governed) {
    let paths;
    try {
      paths = (await stat(root)).isDirectory()
        ? await collectFiles(root)
        : [root];
    } catch {
      continue;
    }
    for (const path of paths) {
      if (!textExtensions.has(extname(path).toLowerCase())) continue;
      const source = await readFile(path, 'utf8');
      if (/brand\/(?:concepts|qc)\//.test(source)) {
        problems.push(
          `non-production brand reference: ${relative(projectRoot, path).replaceAll('\\', '/')}`,
        );
      }
    }
  }

  return problems;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const problems = await verifyBrand();
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      'Brand canon 1.0.0 verified: manifest, encoding, licenses, and governed references are clean.',
    );
  }
}
