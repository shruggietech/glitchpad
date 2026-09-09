import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(repositoryRoot, 'brand');

const integrations = [
  ['fonts/woff2/Geist-Regular.woff2', 'site/public/fonts/Geist-Regular.woff2'],
  ['fonts/woff2/Geist-Medium.woff2', 'site/public/fonts/Geist-Medium.woff2'],
  ['fonts/woff2/GeistMono-Regular.woff2', 'site/public/fonts/GeistMono-Regular.woff2'],
  ['fonts/woff2/SpaceGrotesk-Medium.woff2', 'site/public/fonts/SpaceGrotesk-Medium.woff2'],
  ['fonts/woff2/SpaceGrotesk-Bold.woff2', 'site/public/fonts/SpaceGrotesk-Bold.woff2'],
  ['fonts/licenses/OFL-Geist.txt', 'site/public/fonts/OFL-Geist.txt'],
  ['fonts/licenses/OFL-Space-Grotesk.txt', 'site/public/fonts/OFL-Space-Grotesk.txt'],
  ['logos/svg/glitchpad-horizontal-color.svg', 'site/public/logos/glitchpad-horizontal-color.svg'],
  ['logos/svg/glitchpad-horizontal-light.svg', 'site/public/logos/glitchpad-horizontal-light.svg'],
  ['logos/png/glitchpad-social-preview-1280.png', 'site/public/social-preview.png'],
  ['logos/svg/glitchpad-mark-color.svg', 'site/public/logos/glitchpad-mark-color.svg'],
  ['icons/web/favicon.svg', 'site/public/favicon.svg'],
  ['icons/web/favicon.ico', 'site/public/favicon.ico'],
  ['icons/web/favicon-16x16.png', 'site/public/favicon-16x16.png'],
  ['icons/web/favicon-32x32.png', 'site/public/favicon-32x32.png'],
  ['icons/web/apple-touch-icon.png', 'site/public/apple-touch-icon.png'],
  ['icons/web/android-chrome-192x192.png', 'site/public/android-chrome-192x192.png'],
  ['icons/web/android-chrome-512x512.png', 'site/public/android-chrome-512x512.png'],
  ['icons/web/site.webmanifest', 'site/public/site.webmanifest'],
  ['icons/web/favicon.svg', 'apps/glitchpad/public/favicon.svg'],
  ['icons/web/favicon-32x32.png', 'crates/glitchpad-host/icons/32x32.png'],
  ['icons/web/favicon-128x128.png', 'crates/glitchpad-host/icons/128x128.png'],
  ['icons/web/favicon-256x256.png', 'crates/glitchpad-host/icons/128x128@2x.png'],
  ['icons/web/favicon-512x512.png', 'crates/glitchpad-host/icons/icon.png'],
  ['icons/windows/classic/app.ico', 'crates/glitchpad-host/icons/icon.ico'],
  ['icons/apple/macos/AppIcon.icns', 'crates/glitchpad-host/icons/icon.icns'],
  ['icons/android/play-store/google-play-512.png', 'crates/glitchpad-host/icons/android/play-store/google-play-512.png'],
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

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined)
      throw new Error(`invalid argument sequence near ${key ?? '<end>'}`);
    values.set(key.slice(2), value);
  }
  for (const required of ['source', 'revision', 'run-id', 'artifact-id', 'retrieved-at']) {
    if (!values.has(required)) throw new Error(`missing --${required}`);
  }
  if (!/^[0-9a-f]{40}$/.test(values.get('revision')))
    throw new Error('--revision must be a full lowercase commit SHA');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.get('retrieved-at')))
    throw new Error('--retrieved-at must be YYYY-MM-DD');
  return values;
}

async function verifyManifest(root, manifest) {
  if (
    manifest.name !== 'glitchpad-brand-kit' ||
    manifest.version !== '1.1.0' ||
    manifest.canon !== '1.2.1'
  ) {
    throw new Error('source manifest is not Glitchpad brand 1.1.0 / canon 1.2.1');
  }
  const seen = new Set();
  const recovered = new Map();
  for (const entry of manifest.files) {
    if (seen.has(entry.path)) throw new Error(`duplicate manifest path: ${entry.path}`);
    seen.add(entry.path);
    let bytes;
    try {
      bytes = await readFile(join(root, ...entry.path.split('/')));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      const existing = join(destination, ...entry.path.split('/'));
      bytes = await readFile(existing);
      recovered.set(entry.path, bytes);
    }
    if (bytes.byteLength !== entry.bytes || digest(bytes) !== entry.sha256)
      throw new Error(`source manifest mismatch: ${entry.path}`);
  }
  return recovered;
}

async function updateIntegratedManifest(revision) {
  const readmePath = join(destination, 'README.md');
  const readme = await readFile(readmePath, 'utf8');
  const integratedReadme = readme.replace(
    '../../LICENSE-BRAND.md',
    `https://raw.githubusercontent.com/shruggietech/shruggie-brand/${revision}/LICENSE-BRAND.md`,
  );
  if (integratedReadme === readme)
    throw new Error('upstream README legal-link integration point was not found');
  await writeFile(readmePath, integratedReadme, 'utf8');

  const manifestPath = join(destination, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const entry = manifest.files.find(({ path }) => path === 'README.md');
  if (!entry) throw new Error('source manifest does not govern README.md');
  const bytes = await readFile(readmePath);
  entry.bytes = bytes.byteLength;
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
  const values = parseArguments(process.argv.slice(2));
  const source = resolve(values.get('source'));
  const sourceManifestBytes = await readFile(join(source, 'manifest.json'));
  const sourceManifest = JSON.parse(sourceManifestBytes);
  const recoveredFiles = await verifyManifest(source, sourceManifest);

  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true, force: true });
  for (const [path, bytes] of recoveredFiles) {
    const target = join(destination, ...path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const integratedManifestSha256 = await updateIntegratedManifest(values.get('revision'));

  for (const mapping of integrations) await copyIntegration(...mapping);
  for (const resource of androidResources) {
    const canonical = `icons/android/app/src/main/res/${resource}`;
    await copyIntegration(canonical, `crates/glitchpad-host/icons/android/${resource}`);
    await copyIntegration(canonical, `crates/glitchpad-host/gen/android/app/src/main/res/${resource}`);
  }

  const receipt = {
    brandVersion: sourceManifest.version,
    canonVersion: sourceManifest.canon,
    sourceRepository: 'https://github.com/ShruggieTech/shruggie-brand',
    sourceRevision: values.get('revision'),
    workflowRunId: Number(values.get('run-id')),
    artifactId: Number(values.get('artifact-id')),
    artifactName: 'verified-brand-kits',
    retrievedAt: values.get('retrieved-at'),
    sourceManifestSha256: digest(sourceManifestBytes),
    integratedManifestSha256,
    governedFileCount: sourceManifest.files.length,
    recoveredArtifactFiles: [...recoveredFiles.keys()],
    publicComparisons: [
      {
        path: 'logos/provenance.json',
        url: 'https://brand.shruggie.tech/glitchpad/downloads/files/logos/provenance.json',
        sha256: '439b20c4cc8db1fb8fe84a3ea04012bb20f1a4b5db42e3d2830465806fb5ac3d',
      },
      {
        path: 'icons/manifest.json',
        url: 'https://brand.shruggie.tech/glitchpad/downloads/files/icons/manifest.json',
        sha256: '90a04bfe418cf6d6f5ff35eea720f663e41d5375f03ca3bc41ab5de4ecfaa362',
      },
      {
        path: 'logos/svg/glitchpad-horizontal-white.svg',
        url: 'https://brand.shruggie.tech/glitchpad/downloads/files/logos/svg/glitchpad-horizontal-white.svg',
        sha256: 'f23b0aba814c9988d97a1a65d84f263ec69e36d9162fda58bdbaefe21c88fc1f',
      },
    ],
  };
  await writeFile(
    join(destination, 'INTEGRATION.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(destination, 'INTEGRATION.md'),
    `# Repository integration\n\nGlitchpad brand ${receipt.brandVersion} under ShruggieTech canon ${receipt.canonVersion} was imported from the successful \`${receipt.artifactName}\` artifact produced by upstream commit \`${receipt.sourceRevision}\` in Build run \`${receipt.workflowRunId}\` (artifact \`${receipt.artifactId}\`). That commit also produced the Pages deployment served at \`https://brand.shruggie.tech\`.\n\nThe artifact was retrieved on ${receipt.retrievedAt}. Its upstream manifest SHA-256 is \`${receipt.sourceManifestSha256}\`; the integrated manifest SHA-256 is \`${receipt.integratedManifestSha256}\` after the deterministic legal-link correction described below. All ${receipt.governedFileCount} governed files were verified against the upstream manifest before import. Publicly exposed derivative manifests and the repaired lockup were independently compared with the live download surface; their digests are recorded in \`INTEGRATION.json\`.\n\nOne deterministic integration correction intentionally differs from the artifact bytes: \`brand/README.md\` replaces the artifact-layout-relative \`../../LICENSE-BRAND.md\` target with the immutable upstream URL at the pinned commit so the legal terms remain reachable from this repository. \`brand/manifest.json\` governs the corrected file bytes. This correction is performed only by \`scripts/sync-brand-kit.mjs\`, never by hand.\n\nFiles named in \`manifest.json\` are immutable governed inputs. \`INTEGRATION.md\` and \`INTEGRATION.json\` are the only project-owned files inside this directory and are intentionally excluded from the upstream manifest. Do not regenerate, optimize, recolor, resize, or edit governed files in place.\n\nThe public site copies approved fonts, lockups, the social preview, and web icons from this directory. Desktop packages copy the Windows ICO, macOS ICNS, and approved web raster sizes. Android copies the supplied legacy, adaptive, and monochrome resources into both Tauri icon inputs and the generated Android project. Every mapping is enforced by \`scripts/check-brand.mjs\` as an exact byte comparison.\n\nRun \`pnpm check:brand\` for manifest, provenance, receipt, encoding, licensing, stale-file, README, site, desktop, and Android integration validation. Run \`pnpm check:brand:freshness\` only when network access is intentionally available to compare the recorded public derivatives with \`brand.shruggie.tech\`. Run the complete \`cargo xtask check\` gate before describing the update as verified.\n`,
    'utf8',
  );

  const unexpected = (await readdir(destination)).filter((name) => name === '.git');
  if (unexpected.length) throw new Error('refusing imported nested repository metadata');
  console.log(
    `Imported Glitchpad brand ${receipt.brandVersion} from ${receipt.sourceRevision}; ${receipt.governedFileCount} governed files verified.`,
  );
}

await main();
