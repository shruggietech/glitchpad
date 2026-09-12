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

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const prohibitedEvidenceFields = new Set([
  'document_content',
  'document_body',
  'private_filename',
  'private_path',
  'link_destination',
  'embedded_metadata',
]);

function entries(value) {
  if (Array.isArray(value))
    return value.flatMap((child, index) => [
      [String(index), child],
      ...entries(child),
    ]);
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([key, child]) => [
      [key, child],
      ...entries(child),
    ]);
  return [];
}

function valueAtPath(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value);
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
  const platformManifests = new Map();
  for (const [platform, name] of Object.entries(manifestNames)) {
    const matches = available.filter(
      (path) => basename(path) === name && path.includes(platform),
    );
    if (matches.length !== 1)
      throw new Error(`expected exactly one ${platform} package manifest`);
    const platformManifestBytes = await readFile(matches[0]);
    const platformManifest = JSON.parse(platformManifestBytes.toString('utf8'));
    platformManifests.set(platform, platformManifestBytes);
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
  const practicalUseEvidence = contract.practical_use_evidence;
  const practicalUseRequiredPasses = contract.practical_use_required_passes;
  if (
    !practicalUseEvidence ||
    Object.keys(practicalUseEvidence).sort().join(',') !== 'linux,macos,windows'
  )
    throw new Error('practical-use evidence contract is invalid');
  if (
    !practicalUseRequiredPasses ||
    Object.keys(practicalUseRequiredPasses).sort().join(',') !==
      'linux,macos,windows'
  )
    throw new Error('practical-use required-pass contract is invalid');
  for (const [platform, names] of Object.entries(practicalUseEvidence)) {
    if (
      !Array.isArray(names) ||
      names.length === 0 ||
      new Set(names).size !== names.length
    )
      throw new Error(`${platform} practical-use evidence contract is invalid`);
    const requiredPasses = practicalUseRequiredPasses[platform];
    if (
      !Array.isArray(requiredPasses) ||
      requiredPasses.length === 0 ||
      new Set(requiredPasses).size !== requiredPasses.length
    )
      throw new Error(`${platform} practical-use required passes are invalid`);
    for (const name of names) {
      const matches = available.filter(
        (path) => basename(path) === name && path.includes(platform),
      );
      if (matches.length !== 1)
        throw new Error(
          `${platform} practical-use evidence ${name} is missing or duplicated`,
        );
      const receipt = JSON.parse(await readFile(matches[0], 'utf8'));
      if (receipt.evidence_authority?.source_commit !== sourceCommit)
        throw new Error(
          `${platform} practical-use evidence has a stale source commit`,
        );
      if (
        receipt.candidate_manifest_sha256 !==
        sha256(platformManifests.get(platform))
      )
        throw new Error(
          `${platform} practical-use evidence has a stale manifest digest`,
        );
      if (receipt.content_free !== true)
        throw new Error(
          `${platform} practical-use evidence is not content-free`,
        );
      for (const [key, value] of entries(receipt)) {
        if (prohibitedEvidenceFields.has(key.toLowerCase()))
          throw new Error(
            `${platform} practical-use evidence contains prohibited field ${key}`,
          );
        if (
          typeof value === 'string' &&
          /(?:^|[^a-z])fail(?:ed|ure)?(?:$|[^a-z])/iu.test(value)
        )
          throw new Error(
            `${platform} practical-use evidence contains a failed practical-use result`,
          );
      }
      for (const path of requiredPasses) {
        if (valueAtPath(receipt, path) !== 'pass')
          throw new Error(
            `${platform} practical-use evidence lacks required pass ${path}`,
          );
      }
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
      sha256: sha256(bytes),
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
    practical_use_evidence: practicalUseEvidence,
    practical_use_required_passes: practicalUseRequiredPasses,
    evidence_bundles: Object.keys(contract.trust_states).map(
      (platform) => `glitchpad-${contract.version}-${platform}-evidence.tar.gz`,
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
