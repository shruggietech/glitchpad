import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

async function sha256(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

function assertSourceCommit(sourceCommit) {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(sourceCommit))
    throw new Error('Android assembly requires the exact source commit');
}

export async function assembleAndroidPackage({
  contract,
  inputs,
  output,
  sourceCommit,
  authority,
  generatedAt = new Date().toISOString(),
}) {
  assertSourceCommit(sourceCommit);
  if (!['candidate', 'official'].includes(authority))
    throw new Error('Android assembly authority must be candidate or official');
  if (!Array.isArray(contract.artifacts) || contract.artifacts.length !== 3)
    throw new Error(
      'Android package contract must define exactly three artifacts',
    );
  const roles = new Set(inputs.map(({ role }) => role));
  if (
    inputs.length !== 3 ||
    roles.size !== 3 ||
    contract.artifacts.some(({ role }) => !roles.has(role))
  )
    throw new Error(
      'Android assembly requires exactly three unique artifact roles',
    );
  await mkdir(output, { recursive: true });
  const artifacts = [];
  for (const declared of [...contract.artifacts].sort((left, right) =>
    left.role.localeCompare(right.role),
  )) {
    const input = inputs.find(({ role }) => role === declared.role);
    const destination = join(output, declared.name);
    await copyFile(input.artifact, destination);
    const observed = await stat(destination);
    const digest = await sha256(destination);
    const inventory = JSON.parse(await readFile(input.inventory, 'utf8'));
    const inventoryName = `${declared.role}-inventory.json`;
    const normalizedInventory = {
      ...inventory,
      artifact_name: declared.name,
      role: declared.role,
      kind: declared.kind,
      sha256: digest,
      size_bytes: observed.size,
    };
    await writeFile(
      join(output, inventoryName),
      `${JSON.stringify(normalizedInventory, null, 2)}\n`,
      'utf8',
    );
    artifacts.push({
      role: declared.role,
      name: declared.name,
      sha256: digest,
      size_bytes: observed.size,
      inventory: inventoryName,
    });
  }
  for (const name of ['LICENSE', 'NOTICE'])
    await copyFile(resolve(name), join(output, name));
  await copyFile(
    resolve('packaging/android/THIRD_PARTY_NOTICES.txt'),
    join(output, 'THIRD_PARTY_NOTICES.txt'),
  );
  await writeFile(
    join(output, 'SHA256SUMS'),
    `${artifacts
      .map(({ sha256: digest, name }) => `${digest}  ${name}`)
      .sort()
      .join('\n')}\n`,
    'utf8',
  );
  const publicationStatus =
    authority === 'candidate'
      ? contract.candidate_trust.publication_status
      : 'eligible_official';
  const manifest = {
    schema_version: 1,
    platform: 'android',
    version: contract.candidate_version,
    source_commit: sourceCommit,
    authority,
    publication_status: publicationStatus,
    artifacts,
    sbom: 'glitchpad-android.cdx.json',
    provenance: 'provenance.json',
    generated_at: generatedAt,
  };
  await writeFile(
    join(output, 'android-package-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  const provenance = {
    schema_version: 1,
    platform: 'android',
    version: contract.candidate_version,
    source_commit: sourceCommit,
    authority,
    publication_status: publicationStatus,
    builder: 'scripts/android/assemble-package.mjs',
    artifact_digests: Object.fromEntries(
      artifacts.map(({ role, sha256: digest }) => [role, digest]),
    ),
    generated_at: generatedAt,
  };
  await writeFile(
    join(output, 'provenance.json'),
    `${JSON.stringify(provenance, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(output, 'artifact-digests.json'),
    `${JSON.stringify(provenance.artifact_digests, null, 2)}\n`,
    'utf8',
  );
  return manifest;
}

function parseArguments(arguments_) {
  const values = { inputs: [], inventories: new Map() };
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (!value) throw new Error(`missing value for ${flag}`);
    if (flag === '--input') {
      const [role, path] = value.split('=', 2);
      values.inputs.push({ role, artifact: path });
    } else if (flag === '--inventory') {
      const [role, path] = value.split('=', 2);
      values.inventories.set(role, path);
    } else values[flag.slice(2).replaceAll('-', '_')] = value;
  }
  values.inputs = values.inputs.map((input) => ({
    ...input,
    inventory: values.inventories.get(input.role),
  }));
  return values;
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  if (
    !values.contract ||
    !values.output ||
    !values.source_commit ||
    !values.authority ||
    values.inputs.some(({ inventory }) => !inventory)
  ) {
    throw new Error(
      'usage: assemble-package.mjs --contract <json> --output <dir> --source-commit <sha> --authority <candidate|official> --input <role=artifact> --inventory <role=json> (three pairs)',
    );
  }
  const contract = JSON.parse(await readFile(resolve(values.contract), 'utf8'));
  const result = await assembleAndroidPackage({
    contract,
    inputs: values.inputs,
    output: resolve(values.output),
    sourceCommit: values.source_commit,
    authority: values.authority,
  });
  console.log(
    `Assembled ${result.artifacts.length} Android artifacts in ${basename(resolve(values.output))}.`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
