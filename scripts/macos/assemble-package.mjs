import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { classifyPackageSize } from '../check-macos-package.mjs';
import {
  collectApplicationInventory,
  digestApplicationInventory,
} from '../lib/macos-artifact.mjs';

export { collectApplicationInventory } from '../lib/macos-artifact.mjs';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(
  fileURLToPath(new URL('../..', import.meta.url)),
);
const sha256Pattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function parseArguments(arguments_) {
  const result = {};
  const names = new Map([
    ['--app', 'app'],
    ['--dmg', 'dmg'],
    ['--output', 'output'],
    ['--source-commit', 'sourceCommit'],
    ['--workflow-identity', 'workflowIdentity'],
    ['--runner-image', 'runnerImage'],
  ]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const key = names.get(arguments_[index]);
    const value = arguments_[++index];
    if (!key || !value || value.startsWith('--'))
      throw new Error('argument_invalid');
    result[key] = value;
  }
  for (const key of names.values())
    if (!result[key]) throw new Error(`argument_missing:${key}`);
  if (!sha256Pattern.test(result.sourceCommit))
    throw new Error('source_commit_invalid');
  return result;
}

export async function assertSafeOutputRoot(path) {
  const target = resolve(path);
  const parsed = new URL(pathToFileURL(target));
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (
    segments.length < 2 ||
    target === resolve(repositoryRoot) ||
    target === resolve(dirname(repositoryRoot))
  )
    throw new Error('unsafe output root');
  try {
    await stat(target);
    throw new Error('output root already exists');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return target;
}

export function normalizeArchitectures(output) {
  const architectures = [
    ...new Set(String(output).trim().split(/\s+/u).filter(Boolean)),
  ].sort();
  if (JSON.stringify(architectures) !== JSON.stringify(['arm64', 'x86_64']))
    throw new Error(
      'universal executable must contain exactly arm64 and x86_64',
    );
  return architectures;
}

async function command(program, arguments_) {
  try {
    return await execFileAsync(program, arguments_, {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch (error) {
    const code =
      typeof error?.code === 'string' || typeof error?.code === 'number'
        ? error.code
        : 'unknown';
    throw new Error(`native_command_failed:${program}:${code}`);
  }
}

async function main() {
  if (process.platform !== 'darwin')
    throw new Error('macos_package_assembly_requires_macos');
  const options = parseArguments(process.argv.slice(2));
  const appPath = resolve(options.app);
  const dmgPath = resolve(options.dmg);
  if (!(await stat(appPath)).isDirectory() || !(await stat(dmgPath)).isFile())
    throw new Error('candidate_inputs_invalid');
  const outputRoot = await assertSafeOutputRoot(options.output);
  const [contract, capabilities] = await Promise.all([
    readFile(
      join(repositoryRoot, 'packaging', 'macos', 'package-contract.json'),
      'utf8',
    ).then(JSON.parse),
    readFile(
      join(repositoryRoot, 'packaging', 'desktop', 'capabilities.json'),
      'utf8',
    ).then(JSON.parse),
  ]);
  const copiedApplication = join(
    outputRoot,
    'application',
    contract.bundle.name,
  );
  const copiedDmg = join(outputRoot, contract.artifact.name);
  await mkdir(dirname(copiedApplication), { recursive: true });
  await cp(appPath, copiedApplication, {
    recursive: true,
    dereference: false,
    preserveTimestamps: true,
  });
  await cp(dmgPath, copiedDmg);
  for (const [source, destination] of [
    ['LICENSE', 'LICENSE'],
    ['NOTICE', 'NOTICE'],
    ['packaging/macos/THIRD_PARTY_NOTICES.txt', 'THIRD_PARTY_NOTICES.txt'],
  ])
    await cp(join(repositoryRoot, source), join(outputRoot, destination));

  const executablePath = join(
    copiedApplication,
    ...contract.bundle.executable.split('/'),
  );
  const { stdout: lipoOutput } = await command('lipo', [
    '-archs',
    executablePath,
  ]);
  const architectures = normalizeArchitectures(lipoOutput);
  await command('codesign', [
    '--verify',
    '--deep',
    '--strict',
    '--verbose=4',
    copiedApplication,
  ]);
  const { stderr: signatureDetails } = await command('codesign', [
    '--display',
    '--verbose=4',
    copiedApplication,
  ]);
  if (
    !/^Signature=adhoc$/mu.test(signatureDetails) ||
    /^Authority=/mu.test(signatureDetails)
  )
    throw new Error('candidate_application_is_not_ad_hoc_signed');
  const { stdout: plistJson } = await command('plutil', [
    '-convert',
    'json',
    '-o',
    '-',
    join(copiedApplication, 'Contents', 'Info.plist'),
  ]);
  const plist = JSON.parse(plistJson);
  const documentExtensions = [
    ...new Set(
      (plist.CFBundleDocumentTypes ?? []).flatMap(
        (entry) => entry.CFBundleTypeExtensions ?? [],
      ),
    ),
  ].sort();
  const expectedExtensions = capabilities.families
    .flatMap(({ extensions }) => extensions)
    .sort();
  if (JSON.stringify(documentExtensions) !== JSON.stringify(expectedExtensions))
    throw new Error('generated_document_declarations_drift');
  if (
    plist.CFBundleIdentifier !== contract.bundle.identifier ||
    plist.CFBundleShortVersionString !== contract.candidate_version ||
    plist.LSMinimumSystemVersion !== contract.bundle.minimum_system_version
  )
    throw new Error('generated_bundle_identity_drift');

  const [dmgBytes, executableBytes, applicationInventory] = await Promise.all([
    readFile(copiedDmg),
    readFile(executablePath),
    collectApplicationInventory(copiedApplication),
  ]);
  const artifactDigest = sha256(dmgBytes);
  const applicationDigest = digestApplicationInventory(applicationInventory);
  const manifest = {
    schema_version: 1,
    version: contract.candidate_version,
    platform: 'macos',
    architecture: 'universal',
    source_commit: options.sourceCommit,
    workflow_identity: options.workflowIdentity,
    official: false,
    gate_status: 'candidate_valid',
    artifact: {
      ...contract.artifact,
      bytes: dmgBytes.length,
      sha256: artifactDigest,
      size_classification: classifyPackageSize(
        dmgBytes.length,
        contract.size_budget,
      ),
      signature_status: contract.candidate_trust.dmg_signature_status,
      notarization_status: contract.candidate_trust.notarization_status,
      staple_status: contract.candidate_trust.staple_status,
    },
    application: {
      bundle_name: contract.bundle.name,
      identifier: plist.CFBundleIdentifier,
      version: plist.CFBundleShortVersionString,
      minimum_system_version: plist.LSMinimumSystemVersion,
      executable_path: contract.bundle.executable,
      executable_sha256: sha256(executableBytes),
      bundle_sha256: applicationDigest,
      architectures,
      signature_status: contract.candidate_trust.application_signature_status,
      hardened_runtime_status: 'not_applicable_candidate',
      timestamp_status: 'not_applicable_candidate',
    },
    application_inventory: applicationInventory,
    document_extensions: documentExtensions,
  };
  if (manifest.artifact.size_classification === 'failure')
    throw new Error('dmg_size_hard_limit');
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const provenance = {
    schema_version: 1,
    predicate_type: 'https://slsa.dev/provenance/v1',
    candidate_only: true,
    repository: 'shruggietech/glitchpad',
    source_commit: options.sourceCommit,
    workflow_identity: options.workflowIdentity,
    runner_image: options.runnerImage,
    tool_versions: {
      rust: '1.96.0',
      node: '24.11.0',
      pnpm: '10.28.2',
    },
    subjects: [
      { name: contract.artifact.name, sha256: artifactDigest },
      {
        name: `application/${contract.bundle.name}`,
        sha256: applicationDigest,
      },
    ],
  };
  await Promise.all([
    writeFile(
      join(outputRoot, 'macos-package-manifest.json'),
      manifestText,
      'utf8',
    ),
    writeFile(
      join(outputRoot, 'SHA256SUMS'),
      `${artifactDigest}  ${contract.artifact.name}\n`,
      'utf8',
    ),
    writeFile(
      join(outputRoot, 'provenance.json'),
      `${JSON.stringify(provenance, null, 2)}\n`,
      'utf8',
    ),
  ]);
  console.log(
    `Assembled ${contract.artifact.name} (${architectures.join(', ')}).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    const message =
      error instanceof Error && /^[A-Za-z0-9_:-]{1,200}$/u.test(error.message)
        ? error.message
        : 'macos_package_assembly_failed';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
