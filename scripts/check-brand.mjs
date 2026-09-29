import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyAgentContract } from './brand-agent-contract.mjs';
import {
  androidResources,
  integratedCopies,
  isSafeBrandPath,
  legalFileDigests,
  releasePin,
} from './brand-kit-contract.mjs';

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
  return width === 1024 && height === 258
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

export function verifyWebIconRoles(manifest) {
  const expected = [
    ['/android-chrome-192x192.png', 'any'],
    ['/android-chrome-512x512.png', 'any'],
    ['/maskable-icon-192x192.png', 'maskable'],
    ['/maskable-icon-512x512.png', 'maskable'],
  ];
  const observed = manifest.icons?.map(({ src, purpose }) => [src, purpose]);
  return JSON.stringify(observed) === JSON.stringify(expected)
    ? []
    : ['brand web manifest icon roles mismatch'];
}

export function verifyReleaseReceipt(receipt, bundle, consumer, manifestDigest) {
  const problems = [];
  for (const [field, expected, label] of [
    ['packageId', releasePin.packageId, 'package ID'],
    ['archiveName', releasePin.archiveName, 'archive name'],
    ['archiveSha256', releasePin.archiveSha256, 'archive checksum'],
    [
      'sourceManifestSha256',
      releasePin.sourceManifestSha256,
      'source manifest checksum',
    ],
    [
      'integratedManifestSha256',
      releasePin.integratedManifestSha256,
      'integrated manifest checksum',
    ],
    ['sourceRevision', releasePin.sourceRevision, 'source revision'],
    ['releaseTag', releasePin.releaseTag, 'release tag'],
    ['releaseUrl', releasePin.releaseUrl, 'release URL'],
    ['brandVersion', releasePin.brandVersion, 'brand version'],
    ['canonVersion', releasePin.canonVersion, 'canon version'],
    ['compilerVersion', releasePin.compilerVersion, 'compiler version'],
    ['recoverySha256', releasePin.recoverySha256, 'recovery checksum'],
    ['governedFileCount', releasePin.governedFileCount, 'governed file count'],
  ]) {
    if (receipt[field] !== expected)
      problems.push(`brand integration receipt ${label} mismatch`);
  }
  if (receipt.integratedManifestSha256 !== manifestDigest) {
    problems.push('brand integration receipt manifest digest does not match');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receipt.retrievedAt ?? '')) {
    problems.push('brand integration receipt has no retrieval date');
  }
  if (
    receipt.correction?.path !== 'README.md' ||
    receipt.correction?.from !== '../../LICENSE-BRAND.md' ||
    receipt.correction?.to !== 'LICENSE-BRAND.md'
  ) {
    problems.push('brand integration receipt legal-link correction mismatch');
  }
  for (const [path, expected] of Object.entries(legalFileDigests)) {
    if (receipt.legalFileDigests?.[path] !== expected) {
      problems.push(
        `brand integration receipt legal file digest mismatch: ${path}`,
      );
    }
  }
  if (
    bundle.package?.id !== releasePin.packageId ||
    bundle.package?.filename !== releasePin.archiveName ||
    bundle.source_revision !== releasePin.sourceRevision ||
    bundle.publication?.status !== 'release' ||
    bundle.publication?.tag !== releasePin.releaseTag ||
    bundle.versions?.compiler_version !== releasePin.compilerVersion ||
    bundle.versions?.egui_adapter_version !== releasePin.eguiAdapterVersion
  ) {
    problems.push('brand release bundle identity mismatch');
  }
  if (
    consumer.bundle?.package?.id !== releasePin.packageId ||
    consumer.versions?.brand_version !== releasePin.brandVersion ||
    consumer.versions?.canon_version !== releasePin.canonVersion ||
    consumer.versions?.compiler_version !== releasePin.compilerVersion ||
    consumer.recovery?.sha256 !== releasePin.recoverySha256
  ) {
    problems.push('brand consumer contract identity mismatch');
  }
  if (
    !Array.isArray(receipt.publicComparisons) ||
    receipt.publicComparisons.length < 3
  ) {
    problems.push('brand integration receipt lacks public derivative comparisons');
  }
  return problems;
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
    manifest.version !== releasePin.brandVersion ||
    manifest.canon !== releasePin.canonVersion ||
    manifest.files.length !== releasePin.governedFileCount
  ) {
    problems.push(
      `brand/manifest.json must identify Glitchpad ${releasePin.brandVersion} under canon ${releasePin.canonVersion} with ${releasePin.governedFileCount} governed files`,
    );
  }

  const manifestFiles = new Set();
  const allowedProjectFiles = new Set([
    'INTEGRATION.json',
    'INTEGRATION.md',
    'manifest.json',
    ...Object.keys(legalFileDigests),
  ]);

  for (const entry of manifest.files) {
    if (!isSafeBrandPath(entry.path)) {
      problems.push(`unsafe canonical path: ${entry.path}`);
      continue;
    }
    if (manifestFiles.has(entry.path)) {
      problems.push(`duplicate canonical path: ${entry.path}`);
      continue;
    }
    manifestFiles.add(entry.path);
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

  for (const [path, expected] of Object.entries(legalFileDigests)) {
    try {
      const observed = createHash('sha256')
        .update(await readFile(join(brandRoot, path)))
        .digest('hex');
      if (observed !== expected) problems.push(`legal file drift: brand/${path}`);
    } catch {
      problems.push(`missing release legal file: brand/${path}`);
    }
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
    const manifestDigest = createHash('sha256')
      .update(await readFile(manifestPath))
      .digest('hex');
    const [bundle, consumer] = await Promise.all([
      readFile(join(brandRoot, 'enforcement', 'bundle.json'), 'utf8').then(
        JSON.parse,
      ),
      readFile(
        join(brandRoot, 'enforcement', 'consumer-contract.json'),
        'utf8',
      ).then(JSON.parse),
    ]);
    problems.push(...verifyReleaseReceipt(receipt, bundle, consumer, manifestDigest));
    const recoveryPath = join(
      brandRoot,
      'enforcement',
      'distributions',
      'shruggie-brandbuilder-2.0.3.skill',
    );
    const recoveryDigest = createHash('sha256')
      .update(await readFile(recoveryPath))
      .digest('hex');
    if (recoveryDigest !== releasePin.recoverySha256) {
      problems.push('bundled BrandBuilder recovery checksum mismatch');
    }
    const brandReadme = await readFile(join(brandRoot, 'README.md'), 'utf8');
    if (
      brandReadme.includes('../../LICENSE-BRAND.md') ||
      !brandReadme.includes('(LICENSE-BRAND.md)')
    ) {
      problems.push('brand README legal link must resolve to bundled license');
    }

    const webManifest = JSON.parse(
      await readFile(join(brandRoot, 'icons', 'web', 'site.webmanifest'), 'utf8'),
    );
    problems.push(...verifyWebIconRoles(webManifest));

    const [projectInstructions, generatedAgentContract] = await Promise.all([
      readFile(join(projectRoot, 'AGENTS.md'), 'utf8'),
      readFile(join(brandRoot, 'enforcement', 'AGENTS.md'), 'utf8'),
    ]);
    problems.push(
      ...verifyAgentContract(projectInstructions, generatedAgentContract),
    );

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

  const allIntegratedCopies = [...integratedCopies];
  for (const resource of androidResources) {
    allIntegratedCopies.push(
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

  for (const [canonical, integrated] of integrations
    ? allIntegratedCopies
    : []) {
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
      `Glitchpad brand ${releasePin.brandVersion} / canon ${releasePin.canonVersion} verified: manifest, release receipt, provenance, agent contract, integrations, encoding, and licenses are clean.`,
    );
  }
}
