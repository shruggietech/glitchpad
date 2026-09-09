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
  const attributeText = tag
    .replace(/^<\s*[^\s/>]+/, '')
    .replace(/\/?>\s*$/, '');
  const pattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of attributeText.matchAll(pattern)) {
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

  const introduction = readme.slice(0, headingIndex);
  if (introduction.includes('<!--') || introduction.includes('-->')) {
    return [
      'README banner introduction must not contain HTML comments or inert banner markup',
    ];
  }
  const centeredWrapper = introduction.match(/^\s*(<div\b[^>]*>)([\s\S]*)$/i);
  if (!centeredWrapper || /<\/div\s*>/i.test(centeredWrapper[2])) {
    return [
      'README banner must remain inside the centered introduction before the # Glitchpad heading',
    ];
  }
  const { attributes: wrapper, duplicates: wrapperDuplicates } =
    parseTagAttributes(centeredWrapper[1]);
  if (wrapper.get('align') !== 'center' || wrapperDuplicates.has('align')) {
    return [
      'README banner introduction must use one centered <div align="center"> wrapper',
    ];
  }

  const pictures = [
    ...centeredWrapper[2].matchAll(/<picture>([\s\S]*?)<\/picture>/g),
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
  const { attributes: image, duplicates: imageDuplicates } = parseTagAttributes(
    children[2],
  );
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
      'brand/logos/png/glitchpad-horizontal-color-1024.png',
    ],
    [
      'light fallback src',
      image.get('src'),
      'brand/logos/png/glitchpad-horizontal-light-1024.png',
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

export function verifyPngHeader(bytes, label) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature))
    return [`README banner asset is not a valid PNG: ${label}`];
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  return width === 1024 && height === 259
    ? []
    : [
        `README banner asset has unexpected ${width}x${height} geometry: ${label}`,
      ];
}

export async function verifyBrandFreshness(
  receipt,
  fetchImplementation = fetch,
) {
  const problems = [];
  for (const comparison of receipt.publicComparisons ?? []) {
    let response;
    try {
      response = await fetchImplementation(comparison.url, {
        headers: { 'user-agent': 'glitchpad-brand-freshness-check' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      problems.push(
        `brand freshness request failed: ${comparison.url} (${error})`,
      );
      continue;
    }
    if (!response.ok) {
      problems.push(
        `brand freshness request returned ${response.status}: ${comparison.url}`,
      );
      continue;
    }
    const observed = createHash('sha256')
      .update(Buffer.from(await response.arrayBuffer()))
      .digest('hex');
    if (observed !== comparison.sha256)
      problems.push(`upstream brand drift: ${comparison.path}`);
  }
  return problems;
}

export async function verifyIntegratedCopy(
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
      : [`integrated asset drift: ${integratedLabel}`];
  } catch {
    return [`missing integrated asset copy: ${integratedLabel}`];
  }
}

export const verifyPublicCopy = verifyIntegratedCopy;

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
    manifest.version !== '1.1.0' ||
    manifest.canon !== '1.2.1'
  ) {
    problems.push(
      'brand/manifest.json must identify Glitchpad 1.1.0 under canon 1.2.1',
    );
  }

  const manifestFiles = new Set(manifest.files.map((entry) => entry.path));
  const allowedProjectFiles = new Set([
    'INTEGRATION.json',
    'INTEGRATION.md',
    'manifest.json',
  ]);

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
    const relativePath = relative(brandRoot, path).replaceAll('\\', '/');
    if (
      !manifestFiles.has(relativePath) &&
      !allowedProjectFiles.has(relativePath)
    ) {
      problems.push(`unexpected canonical file: brand/${relativePath}`);
    }
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

  if (integrations) {
    const receipt = JSON.parse(
      await readFile(join(brandRoot, 'INTEGRATION.json'), 'utf8'),
    );
    if (!/^[0-9a-f]{40}$/.test(receipt.sourceRevision ?? ''))
      problems.push('brand integration receipt has no pinned source revision');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receipt.retrievedAt ?? ''))
      problems.push('brand integration receipt has no retrieval date');
    if (receipt.governedFileCount !== manifest.files.length)
      problems.push(
        'brand integration receipt file count does not match manifest',
      );
    const manifestDigest = createHash('sha256')
      .update(await readFile(manifestPath))
      .digest('hex');
    if (receipt.integratedManifestSha256 !== manifestDigest)
      problems.push('brand integration receipt manifest digest does not match');
    if (
      !Array.isArray(receipt.publicComparisons) ||
      receipt.publicComparisons.length < 3
    )
      problems.push(
        'brand integration receipt lacks public derivative comparisons',
      );
    for (const recovered of receipt.recoveredArtifactFiles ?? []) {
      const entry = manifest.files.find(({ path }) => path === recovered);
      if (!entry)
        problems.push(`recovered artifact file is not governed: ${recovered}`);
    }

    for (const path of [
      'logos/png/glitchpad-horizontal-color-1024.png',
      'logos/png/glitchpad-horizontal-light-1024.png',
    ])
      problems.push(
        ...verifyPngHeader(
          await readFile(join(brandRoot, ...path.split('/'))),
          path,
        ),
      );

    const provenance = JSON.parse(
      await readFile(join(brandRoot, 'logos', 'provenance.json'), 'utf8'),
    );
    for (const derivative of provenance.derivatives ?? []) {
      if (!/^[0-9a-f]{64}$/.test(derivative.sha256 ?? ''))
        problems.push(`missing derivative sha256: ${derivative.path}`);
    }
  }

  const integratedCopies = [
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
      'logos/svg/glitchpad-horizontal-color.svg',
      'site/public/logos/glitchpad-horizontal-color.svg',
    ],
    [
      'logos/svg/glitchpad-horizontal-light.svg',
      'site/public/logos/glitchpad-horizontal-light.svg',
    ],
    [
      'logos/png/glitchpad-social-preview-1280.png',
      'site/public/social-preview.png',
    ],
    [
      'logos/svg/glitchpad-mark-color.svg',
      'site/public/logos/glitchpad-mark-color.svg',
    ],
    ['icons/web/favicon.svg', 'site/public/favicon.svg'],
    ['icons/web/favicon.ico', 'site/public/favicon.ico'],
    ['icons/web/favicon-16x16.png', 'site/public/favicon-16x16.png'],
    ['icons/web/favicon-32x32.png', 'site/public/favicon-32x32.png'],
    ['icons/web/apple-touch-icon.png', 'site/public/apple-touch-icon.png'],
    [
      'icons/web/android-chrome-192x192.png',
      'site/public/android-chrome-192x192.png',
    ],
    [
      'icons/web/android-chrome-512x512.png',
      'site/public/android-chrome-512x512.png',
    ],
    ['icons/web/site.webmanifest', 'site/public/site.webmanifest'],
    ['icons/web/favicon.svg', 'apps/glitchpad/public/favicon.svg'],
    ['icons/web/favicon-32x32.png', 'crates/glitchpad-host/icons/32x32.png'],
    [
      'icons/web/favicon-128x128.png',
      'crates/glitchpad-host/icons/128x128.png',
    ],
    [
      'icons/web/favicon-256x256.png',
      'crates/glitchpad-host/icons/128x128@2x.png',
    ],
    ['icons/web/favicon-512x512.png', 'crates/glitchpad-host/icons/icon.png'],
    ['icons/windows/classic/app.ico', 'crates/glitchpad-host/icons/icon.ico'],
    ['icons/apple/macos/AppIcon.icns', 'crates/glitchpad-host/icons/icon.icns'],
    [
      'icons/android/play-store/google-play-512.png',
      'crates/glitchpad-host/icons/android/play-store/google-play-512.png',
    ],
  ];

  const androidResources = [
    'drawable-nodpi/ic_launcher_foreground.png',
    'drawable-nodpi/ic_launcher_monochrome.png',
    'drawable/ic_launcher_background.xml',
    'mipmap-anydpi-v26/ic_launcher.xml',
    'mipmap-mdpi/ic_launcher.png',
    'mipmap-hdpi/ic_launcher.png',
    'mipmap-xhdpi/ic_launcher.png',
    'mipmap-xxhdpi/ic_launcher.png',
    'mipmap-xxxhdpi/ic_launcher.png',
    'values/ic_launcher_colors.xml',
  ];
  for (const resource of androidResources) {
    integratedCopies.push(
      [
        `icons/android/app/src/main/res/${resource}`,
        `crates/glitchpad-host/icons/android/${resource}`,
      ],
      [
        `icons/android/app/src/main/res/${resource}`,
        `crates/glitchpad-host/gen/android/app/src/main/res/${resource}`,
      ],
    );
  }

  for (const [canonical, integrated] of integrations ? integratedCopies : []) {
    problems.push(
      ...(await verifyIntegratedCopy(
        join(brandRoot, ...canonical.split('/')),
        join(projectRoot, ...integrated.split('/')),
        integrated,
      )),
    );
  }

  if (integrations) {
    try {
      await stat(
        join(
          projectRoot,
          'crates/glitchpad-host/icons/foundation-resource.svg',
        ),
      );
      problems.push('foundation packaging icon must be removed');
    } catch {
      // Expected: release packaging consumes only approved brand assets.
    }
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
  if (process.argv.includes('--freshness') && problems.length === 0) {
    const receipt = JSON.parse(
      await readFile(join(repositoryRoot, 'brand', 'INTEGRATION.json'), 'utf8'),
    );
    problems.push(...(await verifyBrandFreshness(receipt)));
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      'Glitchpad brand 1.1.0 / canon 1.2.1 verified: manifest, provenance, integrations, encoding, and licenses are clean.',
    );
  }
}
