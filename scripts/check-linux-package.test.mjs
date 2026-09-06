import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  checkLinuxConfiguration,
  classifyPackageSize,
  validateBuildBaseline,
  validateCleanEnvironmentReceipt,
  validateLinuxEvidence,
} from './check-linux-package.mjs';
import { generateLinuxSbom } from './generate-linux-sbom.mjs';

const repositoryRoot = new URL('../', import.meta.url).pathname.replace(
  /^\/(?:[A-Za-z]:)/u,
  (value) => value.slice(1),
);
const contract = JSON.parse(
  await readFile(
    join(repositoryRoot, 'packaging', 'linux', 'package-contract.json'),
    'utf8',
  ),
);
const digest = 'a'.repeat(64);
const sourceCommit = 'b'.repeat(40);
const execFileAsync = promisify(execFile);
const candidateUnexercisedKeys = new Set(['read', 'edit', 'save', 'metadata', 'recovery']);

function candidate() {
  return {
    schema_version: 1,
    version: contract.candidate_version,
    platform: 'linux',
    architecture: 'x86_64',
    source_commit: sourceCommit,
    workflow_identity:
      'shruggietech/glitchpad/.github/workflows/linux-package.yml@refs/heads/codex/021-linux-packaging',
    official: false,
    gate_status: 'candidate_valid',
    build_baseline: {
      distribution: 'ubuntu',
      release: '22.04',
      architecture: 'x86_64',
      container_target: 'linux-package',
      glibc_version: '2.35',
      maximum_imported_glibc: '2.34',
      webkitgtk_api: '4.1',
    },
    artifacts: contract.artifacts.map((artifact) => ({
      ...artifact,
      bytes: 1024,
      sha256: digest,
      inventory_sha256: 'c'.repeat(64),
      size_classification: 'pass',
    })),
    desktop_entry: { ...contract.desktop_entry },
    repository_attestation_status:
      contract.candidate_trust.repository_attestation_status,
  };
}

function receipt(manifestBytes, release, packageForm, manual = 'not_run_candidate') {
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const automatedKeys = [
    'artifact_integrity',
    'install_or_extract',
    'desktop_registration',
    'mime_registration',
    'launch',
    'startup_delivery',
    'running_instance_delivery',
    'read',
    'edit',
    'save',
    'metadata',
    'recovery',
    'remove',
    'registration_cleanup',
    'document_preservation',
    'performance',
  ];
  const manualKeys = [
    'dialog',
    'drag_drop',
    'save_as',
    'print',
    'keyboard',
    'focus',
    'text_scale',
    'increased_contrast',
    'reduced_motion',
    'assistive_technology',
    'markdown_webkitgtk',
    'mermaid_webkitgtk',
  ];
  return {
    schema_version: 1,
    candidate_manifest_sha256: createHash('sha256')
      .update(manifestBytes)
      .digest('hex'),
    evidence_authority: {
      kind: 'github_actions_workflow',
      workflow_identity: manifest.workflow_identity,
      source_commit: manifest.source_commit,
      native_test_suites: [
        'app_document_workflow',
        'desktop_delivery_conformance',
        'desktop_source_conformance',
        'recovery_conformance',
      ],
    },
    linux: {
      distribution: 'ubuntu',
      release,
      architecture: 'x86_64',
      package_form: packageForm,
      product_version: contract.candidate_version,
      webkitgtk_version: '2.52.0',
    },
    automated: Object.fromEntries(
      automatedKeys.map((key) => [
        key,
        key === 'performance'
          ? 'measured_hosted_smoke'
          : candidateUnexercisedKeys.has(key)
            ? 'not_run_candidate'
            : 'pass',
      ]),
    ),
    manual: Object.fromEntries(manualKeys.map((key) => [key, manual])),
    performance: {
      startup_evidence_class: 'hosted_smoke',
      startup_samples_ms: [600, 620, 640, 660, 680],
      startup_p95_ms: 680,
      startup_classification: 'pass',
      artifact_size_classification: 'pass',
    },
    content_free: true,
    completed_utc: new Date().toISOString(),
  };
}

test('repository Linux package configuration is internally consistent', async () => {
  assert.deepEqual(await checkLinuxConfiguration(repositoryRoot), {
    artifactCount: 2,
    capabilityCount: 21,
    mimeTypeCount: 12,
  });
});

test('shared MIME XML defines only package-owned media types', async () => {
  const source = await readFile(join(repositoryRoot, 'packaging', 'linux', 'glitchpad.xml'), 'utf8');
  const types = [...source.matchAll(/<mime-type type="([^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(types.sort(), [...contract.desktop_entry.mime_types].filter((type) =>
    ['application/x-typescript', 'text/vnd.mermaid'].includes(type),
  ).sort());
});

test('size classification preserves exact S018 boundaries', () => {
  assert.equal(classifyPackageSize(contract.size_budget.target_bytes, contract.size_budget), 'pass');
  assert.equal(classifyPackageSize(contract.size_budget.target_bytes + 1, contract.size_budget), 'warning');
  assert.equal(classifyPackageSize(contract.size_budget.hard_limit_bytes, contract.size_budget), 'warning');
  assert.equal(classifyPackageSize(contract.size_budget.hard_limit_bytes + 1, contract.size_budget), 'failure');
});

test('candidate pair passes candidate mode but cannot imply official authority', () => {
  assert.equal(validateLinuxEvidence(candidate(), contract), true);
  assert.throws(
    () => validateLinuxEvidence(candidate(), contract, { official: true }),
    /live repository attestation/u,
  );
  const inflated = candidate();
  inflated.repository_attestation_status = 'verified';
  assert.throws(() => validateLinuxEvidence(inflated, contract), /candidate attestation/u);
});

test('candidate identity requires both canonical final artifacts', () => {
  const missing = candidate();
  missing.artifacts.pop();
  assert.throws(() => validateLinuxEvidence(missing, contract), /artifact pair/u);
  const renamed = candidate();
  renamed.artifacts[0].name = 'Glitchpad.AppImage';
  assert.throws(() => validateLinuxEvidence(renamed, contract), /artifact pair/u);
});

test('build baseline rejects newer distribution and glibc imports', () => {
  assert.equal(validateBuildBaseline(candidate().build_baseline, contract), true);
  assert.throws(
    () => validateBuildBaseline({ ...candidate().build_baseline, release: '24.04' }, contract),
    /Ubuntu 22.04/u,
  );
  assert.throws(
    () => validateBuildBaseline({ ...candidate().build_baseline, maximum_imported_glibc: '2.36' }, contract),
    /GLIBC_2.35/u,
  );
});

test('closed candidate receipts bind the manifest and reject private fields', () => {
  const manifestBytes = Buffer.from(`${JSON.stringify(candidate(), null, 2)}\n`);
  const valid = receipt(manifestBytes, '22.04', 'appimage');
  assert.equal(validateCleanEnvironmentReceipt(valid, manifestBytes, contract), true);
  valid.linux.native_path = '/home/alice/private.md';
  assert.throws(
    () => validateCleanEnvironmentReceipt(valid, manifestBytes, contract),
    /missing or undeclared fields/u,
  );
});

test('official receipts require reference evidence and all manual results', () => {
  const manifestBytes = Buffer.from(`${JSON.stringify(candidate(), null, 2)}\n`);
  const invalid = receipt(manifestBytes, '24.04', 'deb');
  assert.throws(
    () => validateCleanEnvironmentReceipt(invalid, manifestBytes, contract, { official: true }),
    /reference startup evidence/u,
  );
  const valid = receipt(manifestBytes, '24.04', 'deb', 'pass');
  valid.performance.startup_evidence_class = 'reference';
  for (const key of Object.keys(valid.automated)) valid.automated[key] = 'pass';
  assert.equal(
    validateCleanEnvironmentReceipt(valid, manifestBytes, contract, { official: true }),
    true,
  );
});

test('official CLI rejects an attested pair when required evidence files are absent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-linux-official-'));
  try {
    const evidence = candidate();
    const artifactBytes = Buffer.from('candidate artifact');
    const artifactDigest = createHash('sha256').update(artifactBytes).digest('hex');
    for (const artifact of evidence.artifacts) {
      artifact.bytes = artifactBytes.length;
      artifact.sha256 = artifactDigest;
      await writeFile(join(root, artifact.name), artifactBytes);
    }
    const manifestPath = join(root, 'linux-package-manifest.json');
    const attestationPath = join(root, 'repository-attestation.json');
    await writeFile(manifestPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    await writeFile(
      attestationPath,
      `${JSON.stringify({
        status: contract.official.required_attestation_status,
        repository: contract.official.repository,
        source_commit: evidence.source_commit,
        version: evidence.version,
        artifacts: evidence.artifacts.map(({ name, sha256 }) => ({ name, sha256 })),
      }, null, 2)}\n`,
      'utf8',
    );
    await assert.rejects(
      execFileAsync(process.execPath, [
        join(repositoryRoot, 'scripts', 'check-linux-package.mjs'),
        '--repository-root',
        repositoryRoot,
        '--evidence',
        manifestPath,
        '--artifact-root',
        root,
        '--official',
        '--attestation',
        attestationPath,
      ]),
      /required official evidence/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Linux SBOM uses the shared deterministic desktop component model', () => {
  const bom = generateLinuxSbom(
    { packages: [{ name: 'glitchpad-host', version: '0.1.0', license: 'Apache-2.0' }] },
    [{ dependencies: { react: { version: '19.0.0', license: 'MIT' } } }],
    sourceCommit,
  );
  assert.equal(bom.metadata.component.name, 'Glitchpad for Linux');
  assert.deepEqual(
    bom.components.map(({ 'bom-ref': reference }) => reference),
    [...bom.components.map(({ 'bom-ref': reference }) => reference)].sort(),
  );
});
