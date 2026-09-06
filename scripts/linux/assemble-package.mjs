import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { classifyPackageSize } from '../check-linux-package.mjs';

const repositoryRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const sourceCommitPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const workflowIdentityPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/.github\/workflows\/linux-package\.yml@refs\/(?:heads|tags)\/.+$/u;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function parseArguments(arguments_) {
  const result = {};
  const names = new Map([
    ['--appimage', 'appImagePath'],
    ['--deb', 'debPath'],
    ['--output', 'outputRoot'],
    ['--source-commit', 'sourceCommit'],
    ['--workflow-identity', 'workflowIdentity'],
    ['--baseline', 'baselinePath'],
    ['--appimage-inventory', 'appImageInventoryPath'],
    ['--deb-inventory', 'debInventoryPath'],
  ]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const key = names.get(arguments_[index]);
    const value = arguments_[++index];
    if (!key || !value || value.startsWith('--')) throw new Error('argument_invalid');
    result[key] = value;
  }
  for (const key of names.values())
    if (!result[key]) throw new Error(`argument_missing:${key}`);
  return result;
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function assembleLinuxCandidate({
  appImagePath,
  debPath,
  outputRoot,
  sourceCommit,
  workflowIdentity,
  buildBaseline,
  inventories,
}) {
  if (!sourceCommitPattern.test(sourceCommit ?? ''))
    throw new Error('Linux candidate requires the exact source commit');
  if (!workflowIdentityPattern.test(workflowIdentity ?? ''))
    throw new Error('Linux candidate requires the exact workflow identity');
  if (!buildBaseline || typeof buildBaseline !== 'object')
    throw new Error('Linux candidate requires build baseline evidence');
  if (!inventories?.appimage || !inventories?.deb)
    throw new Error('Linux candidate requires both package inventories');

  const [contract, appImageMetadata, debMetadata] = await Promise.all([
    readFile(join(repositoryRoot, 'packaging', 'linux', 'package-contract.json'), 'utf8').then(JSON.parse),
    stat(resolve(appImagePath)),
    stat(resolve(debPath)),
  ]);
  if (!appImageMetadata.isFile() || !debMetadata.isFile())
    throw new Error('Linux candidate requires both package files');

  const destinationRoot = resolve(outputRoot);
  await mkdir(destinationRoot, { recursive: true });
  const inputByKind = { appimage: resolve(appImagePath), deb: resolve(debPath) };
  const artifactRecords = [];
  const checksumLines = [];
  for (const artifact of contract.artifacts) {
    const source = inputByKind[artifact.kind];
    const destination = join(destinationRoot, artifact.name);
    await cp(source, destination);
    const bytes = await readFile(destination);
    const inventory = inventories[artifact.kind];
    if (!Array.isArray(inventory) || inventory.some(({ path }) => typeof path !== 'string'))
      throw new Error(`Linux ${artifact.kind} inventory is invalid`);
    const inventoryPaths = inventory.map(({ path }) => path.replace(/^\.\//u, '').replace(/\/$/u, ''));
    for (const requiredPath of contract.required_content[artifact.kind])
      if (!inventoryPaths.includes(requiredPath))
        throw new Error(`Linux ${artifact.kind} is missing required content: ${requiredPath}`);
    for (const forbidden of contract.dependency_policy.forbidden_bundled_components)
      if (inventoryPaths.some((path) => path.toLowerCase().includes(forbidden.toLowerCase())))
        throw new Error(`Linux ${artifact.kind} bundles forbidden component: ${forbidden}`);
    const inventoryBytes = Buffer.from(canonicalJson(inventory));
    const artifactDigest = sha256(bytes);
    artifactRecords.push({
      ...artifact,
      bytes: bytes.length,
      sha256: artifactDigest,
      inventory_sha256: sha256(inventoryBytes),
      size_classification: classifyPackageSize(bytes.length, contract.size_budget),
    });
    checksumLines.push(`${artifactDigest}  ${artifact.name}`);
    await writeFile(
      join(destinationRoot, `${artifact.kind}-inventory.json`),
      inventoryBytes,
    );
  }
  if (artifactRecords.some(({ size_classification: value }) => value === 'failure'))
    throw new Error('Linux candidate exceeds the package hard size limit');

  const manifest = {
    schema_version: 1,
    version: contract.candidate_version,
    platform: contract.platform,
    architecture: contract.architecture,
    source_commit: sourceCommit,
    workflow_identity: workflowIdentity,
    official: false,
    gate_status: 'candidate_valid',
    build_baseline: buildBaseline,
    artifacts: artifactRecords,
    desktop_entry: contract.desktop_entry,
    repository_attestation_status: contract.candidate_trust.repository_attestation_status,
  };
  const manifestPath = join(destinationRoot, 'linux-package-manifest.json');
  const checksumsPath = join(destinationRoot, 'SHA256SUMS');
  const provenance = {
    schema_version: 1,
    predicate_type: 'https://slsa.dev/provenance/v1',
    candidate_only: true,
    repository: contract.official.repository,
    source_commit: sourceCommit,
    workflow_identity: workflowIdentity,
    build_baseline: buildBaseline,
    subjects: artifactRecords.map(({ name, sha256: digest }) => ({ name, sha256: digest })),
  };
  await Promise.all([
    writeFile(manifestPath, canonicalJson(manifest), 'utf8'),
    writeFile(checksumsPath, `${checksumLines.join('\n')}\n`, 'utf8'),
    writeFile(join(destinationRoot, 'provenance.json'), canonicalJson(provenance), 'utf8'),
    writeFile(join(destinationRoot, 'build-baseline.json'), canonicalJson(buildBaseline), 'utf8'),
  ]);
  return { manifest, manifestPath, checksumsPath, outputRoot: destinationRoot };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [buildBaseline, appimage, deb] = await Promise.all([
    readFile(resolve(options.baselinePath), 'utf8').then(JSON.parse),
    readFile(resolve(options.appImageInventoryPath), 'utf8').then(JSON.parse),
    readFile(resolve(options.debInventoryPath), 'utf8').then(JSON.parse),
  ]);
  const result = await assembleLinuxCandidate({
    ...options,
    buildBaseline,
    inventories: { appimage, deb },
  });
  console.log(`Assembled ${basename(result.outputRoot)} Linux candidate.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'linux_package_assembly_failed'}\n`);
    process.exitCode = 1;
  });
}
