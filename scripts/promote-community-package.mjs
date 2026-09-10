import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const manifests = {
  windows: 'windows-package-manifest.json',
  macos: 'macos-package-manifest.json',
  linux: 'linux-package-manifest.json',
};

export async function promoteCommunityPackage({
  platform,
  directory,
  sourceCommit,
  contractPath = join(
    repositoryRoot,
    'packaging',
    platform,
    'package-contract.json',
  ),
}) {
  if (!manifests[platform])
    throw new Error('platform must be windows, macos, or linux');
  if (!/^[a-f0-9]{40}$/u.test(sourceCommit))
    throw new Error('source commit is invalid');
  const root = resolve(directory);
  const manifestPath = join(root, manifests[platform]);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const provenancePath = join(root, 'provenance.json');
  const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
  if (
    manifest.source_commit !== sourceCommit ||
    provenance.source_commit !== sourceCommit ||
    manifest.official !== false ||
    manifest.gate_status !== 'candidate_valid'
  )
    throw new Error('candidate evidence is not eligible for promotion');
  manifest.official = true;
  manifest.gate_status = 'official_valid';
  manifest.event = 'push_tag';
  manifest.tag = 'v0.1.2';
  const packageContract = JSON.parse(await readFile(contractPath, 'utf8'));
  manifest.evidence_files = packageContract.official.required_evidence;
  provenance.candidate_only = false;
  const trust = { schema_version: 1, source_commit: sourceCommit };
  if (platform === 'windows') {
    trust.trust_state = 'unsigned_community';
    trust.artifacts = manifest.artifacts.map(({ name }) => ({
      name,
      signature_status: 'not_signed',
    }));
    for (const artifact of manifest.artifacts)
      artifact.signature_status = 'not_signed';
  } else if (platform === 'macos') {
    trust.trust_state = 'adhoc_non_notarized_community';
    trust.application_signature_status = 'ad_hoc';
    trust.notarization_status = 'not_submitted';
    Object.assign(manifest.artifact, {
      signature_status: 'not_signed',
      notarization_status: 'not_submitted',
      staple_status: 'not_applicable',
    });
    Object.assign(manifest.application, {
      signature_status: 'ad_hoc',
      hardened_runtime_status: 'not_applicable',
      timestamp_status: 'not_applicable',
    });
  } else {
    trust.trust_state = 'repository_attested';
    trust.attestation_provider = 'github_actions';
    manifest.repository_attestation_status = 'generated_by_tag_workflow';
  }
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    provenancePath,
    `${JSON.stringify(provenance, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(root, 'community-trust-evidence.json'),
    `${JSON.stringify(trust, null, 2)}\n`,
    'utf8',
  );
  return trust;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const value = (name) => process.argv[process.argv.indexOf(name) + 1] ?? '';
  await promoteCommunityPackage({
    platform: value('--platform'),
    directory: value('--directory'),
    sourceCommit: value('--source-commit'),
  });
}
