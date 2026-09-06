import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  checkLinuxConfiguration,
  classifyPackageSize,
  validateBuildBaseline,
  validateCleanEnvironmentReceipt,
  validateDebianControl,
  validateLinuxEvidence,
  validateOfficialLinuxArtifactSet,
  verifyRepositoryAttestations,
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
const candidateUnexercisedKeys = new Set([
  'read',
  'edit',
  'save',
  'metadata',
  'recovery',
]);

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
      elf_machine: 'Advanced Micro Devices X86-64',
      container_target: 'linux-package',
      glibc_version: '2.35',
      maximum_imported_glibc: '2.34',
      webkitgtk_api: '4.1',
      webkitgtk_version: '2.50.4',
      compiler: 'cc (Ubuntu 11.4.0-1ubuntu1~22.04.3) 11.4.0',
      linker: 'GNU ld (GNU Binutils for Ubuntu) 2.38',
      rust: 'rustc 1.96.0 (ac68faa20 2026-05-25)',
      node: 'v24.11.0',
      pnpm: '10.28.2',
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

function verifiedAttestation(evidence) {
  return {
    status: contract.official.required_attestation_status,
    repository: contract.official.repository,
    authorized_event: contract.official.authorized_event,
    build_trigger: contract.official.attestation_build_trigger,
    source_ref: `refs/tags/${contract.official.tag_pattern}`,
    signer_workflow: `${contract.official.repository}/.github/workflows/linux-package.yml`,
    source_commit: evidence.source_commit,
    version: evidence.version,
    artifacts: evidence.artifacts.map(({ name, sha256 }) => ({ name, sha256 })),
  };
}

function receipt(
  manifestBytes,
  release,
  packageForm,
  manual = 'not_run_candidate',
) {
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
  const source = await readFile(
    join(repositoryRoot, 'packaging', 'linux', 'glitchpad.xml'),
    'utf8',
  );
  const types = [...source.matchAll(/<mime-type type="([^"]+)"/gu)].map(
    (match) => match[1],
  );
  assert.deepEqual(
    types.sort(),
    [...contract.desktop_entry.mime_types]
      .filter((type) =>
        ['application/x-typescript', 'text/vnd.mermaid'].includes(type),
      )
      .sort(),
  );
});

test('size classification preserves exact S018 boundaries', () => {
  assert.equal(
    classifyPackageSize(
      contract.size_budget.target_bytes,
      contract.size_budget,
    ),
    'pass',
  );
  assert.equal(
    classifyPackageSize(
      contract.size_budget.target_bytes + 1,
      contract.size_budget,
    ),
    'warning',
  );
  assert.equal(
    classifyPackageSize(
      contract.size_budget.hard_limit_bytes,
      contract.size_budget,
    ),
    'warning',
  );
  assert.equal(
    classifyPackageSize(
      contract.size_budget.hard_limit_bytes + 1,
      contract.size_budget,
    ),
    'failure',
  );
});

test('candidate pair passes candidate mode but cannot imply official authority', () => {
  assert.equal(validateLinuxEvidence(candidate(), contract), true);
  assert.throws(
    () => validateLinuxEvidence(candidate(), contract, { official: true }),
    /live repository attestation/u,
  );
  const inflated = candidate();
  inflated.repository_attestation_status = 'verified';
  assert.throws(
    () => validateLinuxEvidence(inflated, contract),
    /candidate attestation/u,
  );
});

test('candidate identity requires both canonical final artifacts', () => {
  const missing = candidate();
  missing.artifacts.pop();
  assert.throws(
    () => validateLinuxEvidence(missing, contract),
    /artifact pair/u,
  );
  const renamed = candidate();
  renamed.artifacts[0].name = 'Glitchpad.AppImage';
  assert.throws(
    () => validateLinuxEvidence(renamed, contract),
    /artifact pair/u,
  );
});

test('build baseline rejects newer distribution and glibc imports', () => {
  assert.equal(
    validateBuildBaseline(candidate().build_baseline, contract),
    true,
  );
  assert.throws(
    () =>
      validateBuildBaseline(
        { ...candidate().build_baseline, release: '24.04' },
        contract,
      ),
    /identity or toolchain drifted/u,
  );
  assert.throws(
    () =>
      validateBuildBaseline(
        { ...candidate().build_baseline, maximum_imported_glibc: '2.36' },
        contract,
      ),
    /GLIBC_2.35/u,
  );
  assert.throws(
    () =>
      validateBuildBaseline(
        { ...candidate().build_baseline, node: 'v25.0.0' },
        contract,
      ),
    /toolchain drifted/u,
  );
  const incomplete = { ...candidate().build_baseline };
  delete incomplete.compiler;
  assert.throws(
    () => validateBuildBaseline(incomplete, contract),
    /missing or undeclared/u,
  );
});

test('closed candidate receipts bind the manifest and reject private fields', () => {
  const manifestBytes = Buffer.from(
    `${JSON.stringify(candidate(), null, 2)}\n`,
  );
  const valid = receipt(manifestBytes, '22.04', 'appimage');
  assert.equal(
    validateCleanEnvironmentReceipt(valid, manifestBytes, contract),
    true,
  );
  valid.linux.native_path = '/home/alice/private.md';
  assert.throws(
    () => validateCleanEnvironmentReceipt(valid, manifestBytes, contract),
    /missing or undeclared fields/u,
  );
});

test('official receipts require reference evidence and all manual results', () => {
  const manifestBytes = Buffer.from(
    `${JSON.stringify(candidate(), null, 2)}\n`,
  );
  const invalid = receipt(manifestBytes, '24.04', 'deb');
  assert.throws(
    () =>
      validateCleanEnvironmentReceipt(invalid, manifestBytes, contract, {
        official: true,
      }),
    /reference startup evidence/u,
  );
  const valid = receipt(manifestBytes, '24.04', 'deb', 'pass');
  valid.performance.startup_evidence_class = 'reference';
  for (const key of Object.keys(valid.automated)) valid.automated[key] = 'pass';
  assert.equal(
    validateCleanEnvironmentReceipt(valid, manifestBytes, contract, {
      official: true,
    }),
    true,
  );
  const falseP95 = structuredClone(valid);
  falseP95.performance.startup_samples_ms = [600, 620, 640, 660, 2_600];
  falseP95.performance.startup_p95_ms = 680;
  assert.throws(
    () =>
      validateCleanEnvironmentReceipt(falseP95, manifestBytes, contract, {
        official: true,
      }),
    /S018 budget/u,
  );
  const failedReference = structuredClone(valid);
  failedReference.performance.startup_samples_ms = [
    2_600, 2_600, 2_600, 2_600, 2_600,
  ];
  failedReference.performance.startup_p95_ms = 2_600;
  failedReference.performance.startup_classification = 'failure';
  assert.throws(
    () =>
      validateCleanEnvironmentReceipt(
        failedReference,
        manifestBytes,
        contract,
        { official: true },
      ),
    /S018 budget/u,
  );
});

test('official validation rejects an attested pair when required evidence files are absent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-linux-official-'));
  try {
    const evidence = candidate();
    const artifactBytes = Buffer.from('candidate artifact');
    const artifactDigest = createHash('sha256')
      .update(artifactBytes)
      .digest('hex');
    for (const artifact of evidence.artifacts) {
      artifact.bytes = artifactBytes.length;
      artifact.sha256 = artifactDigest;
      await writeFile(join(root, artifact.name), artifactBytes);
    }
    await assert.rejects(
      validateOfficialLinuxArtifactSet(evidence, contract, {
        artifactRoot: root,
        attestation: verifiedAttestation(evidence),
      }),
      /required official evidence/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('official receipt filenames bind each Ubuntu and package-form matrix slot', () => {
  const manifestBytes = Buffer.from(
    `${JSON.stringify(candidate(), null, 2)}\n`,
  );
  const copied = receipt(manifestBytes, '22.04', 'appimage', 'pass');
  copied.performance.startup_evidence_class = 'reference';
  for (const key of Object.keys(copied.automated))
    copied.automated[key] = 'pass';
  assert.throws(
    () =>
      validateCleanEnvironmentReceipt(copied, manifestBytes, contract, {
        official: true,
        expectedRelease: '24.04',
        expectedPackageForm: 'deb',
      }),
    /identity/u,
  );
});

test('Debian control metadata requires canonical runtime dependency families', () => {
  const valid = [
    'Package: glitchpad',
    'Version: 0.1.0',
    'Architecture: amd64',
    'Depends: libwebkit2gtk-4.1-0 (>= 2.40), libgtk-3-0 | libgtk-3-0t64',
  ].join('\n');
  assert.equal(validateDebianControl(valid, contract), true);
  assert.throws(
    () =>
      validateDebianControl(
        valid.replace(', libgtk-3-0 | libgtk-3-0t64', ''),
        contract,
      ),
    /libgtk-3-0/u,
  );
});

test('live attestation verification pins repository, workflow, tag, and source digest', async () => {
  const evidence = candidate();
  const calls = [];
  const result = await verifyRepositoryAttestations(
    evidence,
    contract,
    '/artifacts',
    {
      runner: async (file, args) => {
        calls.push({ file, args });
        const name = args[2].split(/[/\\]/u).at(-1);
        const artifact = evidence.artifacts.find(
          (value) => value.name === name,
        );
        return {
          stdout: JSON.stringify([
            {
              verificationResult: {
                statement: {
                  predicateType: 'https://slsa.dev/provenance/v1',
                  subject: [{ digest: { sha256: artifact.sha256 } }],
                },
                signature: {
                  certificate: {
                    buildTrigger: contract.official.attestation_build_trigger,
                    runnerEnvironment: 'github-hosted',
                    sourceRepositoryRef: `refs/tags/${contract.official.tag_pattern}`,
                    sourceRepositoryDigest: evidence.source_commit,
                    githubWorkflowRepository: contract.official.repository,
                  },
                },
              },
            },
          ]),
        };
      },
    },
  );
  assert.deepEqual(result, verifiedAttestation(evidence));
  assert.equal(calls.length, 2);
  for (const { file, args } of calls) {
    assert.equal(file, 'gh');
    assert.ok(args.includes(contract.official.repository));
    assert.ok(args.includes(`refs/tags/${contract.official.tag_pattern}`));
    assert.ok(args.includes(evidence.source_commit));
    assert.ok(args.includes('--deny-self-hosted-runners'));
  }
});

test('Linux SBOM uses the shared deterministic desktop component model', () => {
  const bom = generateLinuxSbom(
    {
      packages: [
        { name: 'glitchpad-host', version: '0.1.0', license: 'Apache-2.0' },
      ],
    },
    [{ dependencies: { react: { version: '19.0.0', license: 'MIT' } } }],
    sourceCommit,
  );
  assert.equal(bom.metadata.component.name, 'Glitchpad for Linux');
  assert.deepEqual(
    bom.components.map(({ 'bom-ref': reference }) => reference),
    [...bom.components.map(({ 'bom-ref': reference }) => reference)].sort(),
  );
});
