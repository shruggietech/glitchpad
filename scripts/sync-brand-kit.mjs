import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mergeAgentContract } from './brand-agent-contract.mjs';
import {
  androidResources,
  integratedCopies,
  isSafeBrandPath,
  legalFileDigests,
  releasePin,
} from './brand-kit-contract.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(repositoryRoot, 'brand');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function parseArguments(argv) {
  const allowed = new Set(['source', 'archive', 'checksums', 'retrieved-at']);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined || !allowed.has(key.slice(2))) {
      throw new Error(`invalid argument sequence near ${key ?? '<end>'}`);
    }
    if (values.has(key.slice(2))) throw new Error(`duplicate argument ${key}`);
    values.set(key.slice(2), value);
  }
  for (const key of allowed) {
    if (!values.has(key)) throw new Error(`missing --${key}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.get('retrieved-at'))) {
    throw new Error('--retrieved-at must be YYYY-MM-DD');
  }
  return values;
}

async function collectSourceFiles(directory, root = directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`source symlink is forbidden: ${path}`);
    if (entry.isDirectory()) result.push(...(await collectSourceFiles(path, root)));
    else if (entry.isFile()) result.push(relative(root, path).replaceAll('\\', '/'));
    else throw new Error(`unsupported source file type: ${path}`);
  }
  return result;
}

export async function verifySourceInventory(
  root,
  manifest,
  expectedLegalDigests = legalFileDigests,
) {
  if (!Array.isArray(manifest.files)) throw new Error('source manifest has no files');
  const seen = new Set();
  for (const entry of manifest.files) {
    if (!isSafeBrandPath(entry.path)) {
      throw new Error(`unsafe manifest path: ${entry.path}`);
    }
    if (seen.has(entry.path)) throw new Error(`duplicate manifest path: ${entry.path}`);
    seen.add(entry.path);
    let bytes;
    try {
      bytes = await readFile(join(root, ...entry.path.split('/')));
    } catch (error) {
      if (error?.code === 'ENOENT') throw new Error(`missing source file: ${entry.path}`);
      throw error;
    }
    if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) {
      throw new Error(`source manifest mismatch: ${entry.path}`);
    }
  }
  for (const [path, expected] of Object.entries(expectedLegalDigests)) {
    let bytes;
    try {
      bytes = await readFile(join(root, path));
    } catch (error) {
      if (error?.code === 'ENOENT') throw new Error(`missing source legal file: ${path}`);
      throw error;
    }
    if (digest(bytes) !== expected) {
      throw new Error(`legal file digest mismatch: ${path}`);
    }
  }
  const expected = new Set([...seen, 'manifest.json', ...Object.keys(expectedLegalDigests)]);
  for (const path of await collectSourceFiles(root)) {
    if (!expected.has(path)) throw new Error(`unexpected source file: ${path}`);
    expected.delete(path);
  }
  if (expected.size) throw new Error(`missing source file: ${[...expected][0]}`);
}

async function verifyReleaseArchive(archivePath, checksumsPath) {
  if (basename(archivePath) !== releasePin.archiveName) {
    throw new Error(`archive must be named ${releasePin.archiveName}`);
  }
  const actual = digest(await readFile(archivePath));
  if (actual !== releasePin.archiveSha256) throw new Error('release archive checksum mismatch');
  const lines = (await readFile(checksumsPath, 'utf8')).split(/\r?\n/);
  const matches = lines.filter((line) => line.endsWith(`  ./${releasePin.archiveName}`));
  if (matches.length !== 1 || matches[0].slice(0, 64) !== actual) {
    throw new Error('release SHA256SUMS does not match the pinned archive');
  }
}

function verifyReleaseMetadata(manifest, bundle, consumer) {
  if (
    manifest.name !== 'glitchpad-brand-kit' ||
    manifest.version !== releasePin.brandVersion ||
    manifest.canon !== releasePin.canonVersion ||
    manifest.files.length !== releasePin.governedFileCount
  ) {
    throw new Error('source manifest does not identify the pinned Glitchpad release');
  }
  if (
    bundle.package?.id !== releasePin.packageId ||
    bundle.package?.filename !== releasePin.archiveName ||
    bundle.source_revision !== releasePin.sourceRevision ||
    bundle.publication?.tag !== releasePin.releaseTag ||
    bundle.publication?.status !== 'release' ||
    bundle.versions?.compiler_version !== releasePin.compilerVersion ||
    bundle.versions?.egui_adapter_version !== releasePin.eguiAdapterVersion
  ) {
    throw new Error('bundle does not identify the pinned formal release');
  }
  if (
    consumer.bundle?.package?.id !== releasePin.packageId ||
    consumer.versions?.brand_version !== releasePin.brandVersion ||
    consumer.versions?.canon_version !== releasePin.canonVersion ||
    consumer.versions?.compiler_version !== releasePin.compilerVersion ||
    consumer.recovery?.sha256 !== releasePin.recoverySha256
  ) {
    throw new Error('consumer contract does not match the pinned release');
  }
}

async function correctReadmeAndManifest() {
  const readmePath = join(destination, 'README.md');
  const readme = await readFile(readmePath, 'utf8');
  const sourceLink = '../../LICENSE-BRAND.md';
  if (readme.split(sourceLink).length !== 2) {
    throw new Error('expected one source-layout legal link in the released README');
  }
  await writeFile(readmePath, readme.replace(sourceLink, 'LICENSE-BRAND.md'), 'utf8');
  const manifestPath = join(destination, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entry = manifest.files.find(({ path }) => path === 'README.md');
  if (!entry) throw new Error('README.md is not governed by the source manifest');
  const bytes = await readFile(readmePath);
  entry.bytes = bytes.length;
  entry.sha256 = digest(bytes);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return digest(await readFile(manifestPath));
}

async function copyIntegration(canonical, integrated) {
  const source = join(destination, ...canonical.split('/'));
  const target = join(repositoryRoot, ...integrated.split('/'));
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { force: true });
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const source = resolve(args.get('source'));
  await verifyReleaseArchive(resolve(args.get('archive')), resolve(args.get('checksums')));
  const sourceManifestBytes = await readFile(join(source, 'manifest.json'));
  if (digest(sourceManifestBytes) !== releasePin.sourceManifestSha256) {
    throw new Error('source manifest checksum does not match the formal release');
  }
  const manifest = JSON.parse(sourceManifestBytes);
  await verifySourceInventory(source, manifest);
  const [bundle, consumer] = await Promise.all([
    readFile(join(source, 'enforcement', 'bundle.json'), 'utf8').then(JSON.parse),
    readFile(join(source, 'enforcement', 'consumer-contract.json'), 'utf8').then(JSON.parse),
  ]);
  verifyReleaseMetadata(manifest, bundle, consumer);

  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true, force: true });
  const integratedManifestSha256 = await correctReadmeAndManifest();
  if (integratedManifestSha256 !== releasePin.integratedManifestSha256) {
    throw new Error('integrated manifest checksum does not match the pinned correction');
  }

  for (const mapping of integratedCopies) await copyIntegration(...mapping);
  for (const resource of androidResources) {
    const canonical = `icons/android/app/src/main/res/${resource}`;
    await copyIntegration(canonical, `crates/glitchpad-host/icons/android/${resource}`);
    await copyIntegration(canonical, `crates/glitchpad-host/gen/android/app/src/main/res/${resource}`);
  }

  const generatedAgentContract = await readFile(
    join(destination, 'enforcement', 'AGENTS.md'),
    'utf8',
  );
  const projectInstructionsPath = join(repositoryRoot, 'AGENTS.md');
  const projectInstructions = await readFile(projectInstructionsPath, 'utf8');
  await writeFile(
    projectInstructionsPath,
    mergeAgentContract(projectInstructions, generatedAgentContract),
    'utf8',
  );

  const publicComparisonSources = [
    ['logos/provenance.json', 'https://brand.shruggie.tech/glitchpad/downloads/files/logos/provenance.json'],
    ['icons/manifest.json', 'https://brand.shruggie.tech/glitchpad/downloads/files/icons/manifest.json'],
    ['logos/svg/glitchpad-horizontal-white.svg', 'https://brand.shruggie.tech/glitchpad/downloads/files/logos/svg/glitchpad-horizontal-white.svg'],
  ];
  const publicComparisons = await Promise.all(
    publicComparisonSources.map(async ([path, url]) => ({
      path,
      url,
      sha256: digest(await readFile(join(destination, ...path.split('/')))),
    })),
  );
  const receipt = {
    packageId: releasePin.packageId,
    brandVersion: releasePin.brandVersion,
    canonVersion: releasePin.canonVersion,
    compilerVersion: releasePin.compilerVersion,
    sourceRepository: 'https://github.com/shruggietech/shruggie-brand',
    sourceRevision: releasePin.sourceRevision,
    releaseTag: releasePin.releaseTag,
    releaseUrl: releasePin.releaseUrl,
    archiveName: releasePin.archiveName,
    archiveSha256: releasePin.archiveSha256,
    retrievedAt: args.get('retrieved-at'),
    sourceManifestSha256: releasePin.sourceManifestSha256,
    integratedManifestSha256,
    governedFileCount: manifest.files.length,
    legalFileDigests,
    recoverySha256: releasePin.recoverySha256,
    correction: {
      path: 'README.md',
      from: '../../LICENSE-BRAND.md',
      to: 'LICENSE-BRAND.md',
    },
    publicComparisons,
  };
  await writeFile(
    join(destination, 'INTEGRATION.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(destination, 'INTEGRATION.md'),
    `# Repository integration\n\nGlitchpad uses the formal [shruggie-brand v2.0.3 release](${receipt.releaseUrl}) package \`${receipt.packageId}\` from source revision \`${receipt.sourceRevision}\`. The archive \`${receipt.archiveName}\` has SHA-256 \`${receipt.archiveSha256}\` in the release \`SHA256SUMS\`. It was retrieved on ${receipt.retrievedAt}.\n\nThe untouched source manifest SHA-256 is \`${receipt.sourceManifestSha256}\` and governs ${receipt.governedFileCount} files. The release archive also contains \`LICENSE\`, \`LICENSE-BRAND.md\`, and \`NOTICE\` outside that manifest; their individual digests are recorded in \`INTEGRATION.json\`. All archive entries were checked before import.\n\nThe sole governed-byte correction changes the released \`README.md\` legal link from \`../../LICENSE-BRAND.md\` to the bundled local \`LICENSE-BRAND.md\` so it resolves inside this repository. The integrated manifest SHA-256 is \`${receipt.integratedManifestSha256}\` after that correction. Other generated files are exact copies of the release. \`INTEGRATION.json\` and this file are the only project-owned files in \`brand/\`.\n\nThe project copies fonts, logos, web icons, and Android and desktop package assets from \`brand/\` through \`scripts/sync-brand-kit.mjs\`. \`scripts/check-brand.mjs\` compares their exact bytes and validates the release receipt, bundled recovery archive, legal files, web icon roles, agent contract, encoding, and manifest. The optional \`pnpm check:brand:freshness\` compares sampled public-site derivatives; the formal release remains the source authority.\n\nUse the exact bundled \`brand/enforcement/distributions/shruggie-brandbuilder-2.0.3.skill\` for offline recovery after confirming SHA-256 \`${receipt.recoverySha256}\`. Run the kit verifier and glyph validator under the approved validation environment. See \`specs/042-brandbuilder-release-integration/verification.md\` for S042 migration and validation evidence.\n`,
    'utf8',
  );
  console.log(`Imported ${receipt.packageId}; ${receipt.governedFileCount} governed files verified.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
