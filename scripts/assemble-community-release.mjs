import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1])
    throw new Error(`${name} is required`);
  return resolve(process.argv[index + 1]);
}

async function files(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) =>
        entry.isDirectory()
          ? files(join(root, entry.name))
          : [join(root, entry.name)],
      ),
    )
  ).flat();
}

export async function assembleCommunityRelease({
  input,
  output,
  sourceCommit,
  contractPath = join(
    repositoryRoot,
    'packaging/release/package-contract.json',
  ),
}) {
  if (!/^[a-f0-9]{40}$/u.test(sourceCommit))
    throw new Error('source commit must be a full lowercase Git SHA');
  const contract = JSON.parse(await readFile(contractPath, 'utf8'));
  const available = await files(input);
  const manifestNames = {
    windows: 'windows-package-manifest.json',
    macos: 'macos-package-manifest.json',
    linux: 'linux-package-manifest.json',
    android: 'android-package-manifest.json',
  };
  for (const [platform, name] of Object.entries(manifestNames)) {
    const matches = available.filter(
      (path) => basename(path) === name && path.includes(platform),
    );
    if (matches.length !== 1)
      throw new Error(`expected exactly one ${platform} package manifest`);
    const platformManifest = JSON.parse(await readFile(matches[0], 'utf8'));
    if (platformManifest.source_commit !== sourceCommit)
      throw new Error(`${platform} source commit is stale`);
    if (platform === 'android') {
      if (
        platformManifest.authority !== 'official' ||
        platformManifest.publication_status !== 'eligible_official'
      )
        throw new Error('Android package is not signed by official authority');
    } else if (
      platformManifest.official !== true ||
      platformManifest.gate_status !== 'official_valid'
    )
      throw new Error(
        `${platform} package was not promoted by the tag workflow`,
      );
    if (platform !== 'android') {
      const trustMatches = available.filter(
        (path) =>
          basename(path) === 'community-trust-evidence.json' &&
          path.includes(platform),
      );
      if (trustMatches.length !== 1)
        throw new Error(`${platform} community trust evidence is missing`);
      const trust = JSON.parse(await readFile(trustMatches[0], 'utf8'));
      if (
        trust.source_commit !== sourceCommit ||
        trust.trust_state !== contract.trust_states[platform]
      )
        throw new Error(`${platform} community trust evidence is invalid`);
    }
  }
  await mkdir(output, { recursive: true });
  const artifacts = [];
  for (const name of contract.artifacts) {
    const matches = available.filter((path) => basename(path) === name);
    if (matches.length !== 1)
      throw new Error(`expected exactly one ${name}; found ${matches.length}`);
    const bytes = await readFile(matches[0]);
    await cp(matches[0], join(output, name), {
      errorOnExist: true,
      force: false,
    });
    artifacts.push({
      name,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      source_commit: sourceCommit,
    });
  }
  const sums =
    artifacts.map(({ name, sha256 }) => `${sha256}  ${name}`).join('\n') + '\n';
  const manifest = {
    schema_version: 1,
    version: contract.version,
    tag: contract.tag,
    repository: contract.repository,
    source_commit: sourceCommit,
    artifacts,
    trust_states: contract.trust_states,
    evidence_bundles: Object.keys(contract.trust_states).map(
      (platform) => `glitchpad-0.1.1-${platform}-evidence.tar.gz`,
    ),
  };
  await writeFile(join(output, 'SHA256SUMS'), sums, 'utf8');
  await writeFile(
    join(output, 'community-release-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  await assembleCommunityRelease({
    input: option('--input'),
    output: option('--output'),
    sourceCommit:
      process.argv[process.argv.indexOf('--source-commit') + 1] ?? '',
  });
