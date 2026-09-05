import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import {
  checkMacosConfiguration,
  classifyPackageSize,
  validateCandidateMacosArtifactSet,
  validateCleanHostReceipt,
  validateMacosEvidence,
  validateOfficialMacosEvidence,
} from './check-macos-package.mjs';
import { generateMacosSbom } from './generate-macos-sbom.mjs';
import {
  collectApplicationInventory,
  digestApplicationInventory,
} from './lib/macos-artifact.mjs';

const repositoryRoot = new URL('../', import.meta.url).pathname.replace(
  /^\/(?:[A-Za-z]:)/u,
  (value) => value.slice(1),
);
const contract = JSON.parse(
  await readFile(
    join(repositoryRoot, 'packaging', 'macos', 'package-contract.json'),
    'utf8',
  ),
);
const capabilities = JSON.parse(
  await readFile(
    join(repositoryRoot, 'packaging', 'desktop', 'capabilities.json'),
    'utf8',
  ),
);
const digest = 'a'.repeat(64);
const sourceCommit = 'b'.repeat(40);
const extensions = capabilities.families
  .flatMap(({ extensions: values }) => values)
  .sort();

function candidate() {
  const applicationInventory = contract.bundle.required_files.map(
    (relative_path) => ({
      relative_path,
      kind: 'file',
      role:
        relative_path === contract.bundle.executable
          ? 'executable'
          : 'resource',
      bytes: 1,
      sha256: digest,
      executable: relative_path === contract.bundle.executable,
    }),
  );
  return {
    schema_version: 1,
    version: contract.candidate_version,
    platform: 'macos',
    architecture: 'universal',
    source_commit: sourceCommit,
    workflow_identity:
      'shruggietech/glitchpad/.github/workflows/macos-package.yml@refs/heads/codex/020-macos-packaging',
    official: false,
    gate_status: 'candidate_valid',
    artifact: {
      ...contract.artifact,
      bytes: 1024,
      sha256: digest,
      size_classification: 'pass',
      signature_status: contract.candidate_trust.dmg_signature_status,
      notarization_status: contract.candidate_trust.notarization_status,
      staple_status: contract.candidate_trust.staple_status,
    },
    application: {
      bundle_name: contract.bundle.name,
      identifier: contract.bundle.identifier,
      version: contract.candidate_version,
      minimum_system_version: contract.bundle.minimum_system_version,
      executable_path: contract.bundle.executable,
      executable_sha256: digest,
      bundle_sha256: digestApplicationInventory(applicationInventory),
      architectures: [...contract.bundle.required_architectures],
      signature_status: contract.candidate_trust.application_signature_status,
      hardened_runtime_status: 'not_applicable_candidate',
      timestamp_status: 'not_applicable_candidate',
    },
    application_inventory: applicationInventory,
    document_extensions: [...extensions],
  };
}

function receipt(manifestBytes, architecture, manual = 'not_run_candidate') {
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const automatedKeys = [
    'mount',
    'applications_link',
    'copy',
    'launch',
    'finder_delivery',
    'running_instance_delivery',
    'read',
    'edit',
    'save',
    'metadata',
    'recovery',
    'remove',
    'cleanup',
    'universal_architecture',
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
    'voiceover',
    'markdown_wkwebview',
    'mermaid_wkwebview',
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
    macos: {
      product_version: '15.7.7',
      build_version: '24G720',
      hardware_architecture: architecture,
      application_architectures: ['arm64', 'x86_64'],
      wkwebview_version: '619.4.7',
    },
    automated: Object.fromEntries(automatedKeys.map((key) => [key, 'pass'])),
    manual: Object.fromEntries(manualKeys.map((key) => [key, manual])),
    performance: {
      cold_startup_samples_ms: [600, 620, 640, 660, 680],
      cold_startup_p95_ms: 680,
      cold_startup_classification: 'pass',
      dmg_size_classification: 'pass',
    },
    content_free: true,
    completed_utc: new Date().toISOString(),
  };
}

test('repository macOS package configuration is internally consistent', async () => {
  assert.deepEqual(await checkMacosConfiguration(repositoryRoot), {
    capabilityCount: 21,
    artifactCount: 1,
  });
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

test('a complete ad-hoc candidate passes candidate mode but never official mode', () => {
  assert.equal(validateMacosEvidence(candidate(), contract), true);
  assert.throws(
    () => validateMacosEvidence(candidate(), contract, { official: true }),
    /live Apple trust verification/u,
  );
});

test('candidate mode binds staged application, DMG, supply chain, and notices', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-macos-candidate-'));
  try {
    const evidence = candidate();
    const applicationRoot = join(root, 'application', contract.bundle.name);
    for (const relativePath of contract.bundle.required_files) {
      const path = join(applicationRoot, ...relativePath.split('/'));
      await mkdir(dirname(path), { recursive: true });
      const governedSource = {
        'Contents/Resources/LICENSE': join(repositoryRoot, 'LICENSE'),
        'Contents/Resources/NOTICE': join(repositoryRoot, 'NOTICE'),
        'Contents/Resources/THIRD_PARTY_NOTICES.txt': join(
          repositoryRoot,
          'packaging',
          'macos',
          'THIRD_PARTY_NOTICES.txt',
        ),
      }[relativePath];
      if (governedSource) await cp(governedSource, path);
      else await writeFile(path, Buffer.from(`fixture:${relativePath}`));
      await chmod(
        path,
        relativePath === contract.bundle.executable ? 0o755 : 0o644,
      );
    }
    evidence.application_inventory =
      await collectApplicationInventory(applicationRoot);
    const executableBytes = await readFile(
      join(applicationRoot, ...contract.bundle.executable.split('/')),
    );
    evidence.application.executable_sha256 = createHash('sha256')
      .update(executableBytes)
      .digest('hex');
    evidence.application.bundle_sha256 = digestApplicationInventory(
      evidence.application_inventory,
    );
    const dmgBytes = Buffer.from('candidate-universal-dmg');
    evidence.artifact.bytes = dmgBytes.length;
    evidence.artifact.sha256 = createHash('sha256')
      .update(dmgBytes)
      .digest('hex');
    const manifestText = JSON.stringify(evidence);
    await Promise.all([
      writeFile(join(root, contract.artifact.name), dmgBytes),
      writeFile(join(root, 'macos-package-manifest.json'), manifestText),
      writeFile(
        join(root, 'SHA256SUMS'),
        `${evidence.artifact.sha256}  ${contract.artifact.name}\n`,
      ),
      writeFile(
        join(root, 'glitchpad-macos.cdx.json'),
        JSON.stringify({
          bomFormat: 'CycloneDX',
          specVersion: '1.6',
          metadata: {
            component: {
              name: 'Glitchpad for macOS',
              version: evidence.version,
            },
            properties: [
              {
                name: 'glitchpad:source_commit',
                value: evidence.source_commit,
              },
            ],
          },
          components: [
            { 'bom-ref': 'pkg:cargo/glitchpad-core@0.1.0' },
            { 'bom-ref': 'pkg:npm/react@19.2.8' },
          ],
        }),
      ),
      writeFile(
        join(root, 'provenance.json'),
        JSON.stringify({
          schema_version: 1,
          predicate_type: 'https://slsa.dev/provenance/v1',
          candidate_only: true,
          repository: 'shruggietech/glitchpad',
          source_commit: evidence.source_commit,
          workflow_identity: evidence.workflow_identity,
          runner_image: 'macos-15',
          tool_versions: { rust: '1.96.0', node: '24.11.0', pnpm: '10.28.2' },
          subjects: [
            { name: evidence.artifact.name, sha256: evidence.artifact.sha256 },
            {
              name: `application/${evidence.application.bundle_name}`,
              sha256: evidence.application.bundle_sha256,
            },
          ],
        }),
      ),
      cp(join(repositoryRoot, 'LICENSE'), join(root, 'LICENSE')),
      cp(join(repositoryRoot, 'NOTICE'), join(root, 'NOTICE')),
      cp(
        join(repositoryRoot, 'packaging', 'macos', 'THIRD_PARTY_NOTICES.txt'),
        join(root, 'THIRD_PARTY_NOTICES.txt'),
      ),
    ]);
    assert.equal(
      await validateCandidateMacosArtifactSet(evidence, contract, {
        artifactRoot: root,
      }),
      true,
    );
    await writeFile(join(root, contract.artifact.name), 'tampered');
    await assert.rejects(
      validateCandidateMacosArtifactSet(evidence, contract, {
        artifactRoot: root,
      }),
      /final DMG bytes do not match/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('candidate inventory and public claims fail closed', () => {
  for (const relative_path of [
    '../Info.plist',
    '/Contents/Info.plist',
    'Contents\\Info.plist',
    'C:/Info.plist',
  ]) {
    const evidence = candidate();
    evidence.application_inventory.push({
      relative_path,
      kind: 'file',
      role: 'resource',
      bytes: 1,
      sha256: digest,
      executable: false,
    });
    assert.throws(
      () => validateMacosEvidence(evidence, contract),
      /unsafe application inventory path/u,
    );
  }
  const collision = candidate();
  collision.application_inventory.push({
    ...collision.application_inventory[0],
    relative_path:
      collision.application_inventory[0].relative_path.toLowerCase(),
  });
  assert.throws(
    () => validateMacosEvidence(collision, contract),
    /case-colliding/u,
  );
  const executable = candidate();
  executable.application_inventory.push({
    relative_path: 'Contents/Resources/zz-evil',
    kind: 'file',
    role: 'executable',
    bytes: 1,
    sha256: digest,
    executable: true,
  });
  assert.throws(
    () => validateMacosEvidence(executable, contract),
    /unexpected executable/u,
  );
  const planned = candidate();
  planned.document_extensions.push('pdf');
  assert.throws(
    () => validateMacosEvidence(planned, contract),
    /document declarations drift/u,
  );
  const undeclared = candidate();
  undeclared.document_path = '/Users/alice/private.md';
  assert.throws(
    () => validateMacosEvidence(undeclared, contract),
    /missing or undeclared fields/u,
  );
});

test('candidate receipts require exact binding, native architecture, truthful manual state, and S018 performance', () => {
  const manifestBytes = Buffer.from(JSON.stringify(candidate()));
  assert.equal(
    validateCleanHostReceipt(
      receipt(manifestBytes, 'arm64'),
      manifestBytes,
      contract,
      { expectedArchitecture: 'arm64' },
    ),
    true,
  );
  const falseManual = receipt(manifestBytes, 'arm64', 'pass');
  assert.throws(
    () =>
      validateCleanHostReceipt(falseManual, manifestBytes, contract, {
        expectedArchitecture: 'arm64',
      }),
    /candidate manual evidence must remain not_run_candidate/u,
  );
  const wrongHost = receipt(manifestBytes, 'arm64');
  assert.throws(
    () =>
      validateCleanHostReceipt(wrongHost, manifestBytes, contract, {
        expectedArchitecture: 'x86_64',
      }),
    /hardware architecture/u,
  );
  const privacyLeak = receipt(manifestBytes, 'arm64');
  privacyLeak.document_path = '/Users/alice/private.md';
  assert.throws(
    () =>
      validateCleanHostReceipt(privacyLeak, manifestBytes, contract, {
        expectedArchitecture: 'arm64',
      }),
    /missing or undeclared fields/u,
  );
  const slow = receipt(manifestBytes, 'arm64');
  slow.performance.cold_startup_samples_ms = [2600, 2600, 2600, 2600, 2600];
  slow.performance.cold_startup_p95_ms = 2600;
  slow.performance.cold_startup_classification = 'failure';
  assert.throws(
    () =>
      validateCleanHostReceipt(slow, manifestBytes, contract, {
        expectedArchitecture: 'arm64',
      }),
    /cold startup evidence/u,
  );
});

test('official mode binds final bytes, receipts, supply chain, and live Apple trust', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-macos-official-'));
  try {
    const evidence = candidate();
    evidence.official = true;
    evidence.gate_status = 'official_valid';
    evidence.event = 'push_tag';
    evidence.tag = 'v0.1.0';
    evidence.evidence_files = [...contract.official.required_evidence];
    evidence.artifact.signature_status = 'valid_developer_id';
    evidence.artifact.notarization_status = 'accepted';
    evidence.artifact.staple_status = 'valid';
    evidence.application.signature_status = 'valid_developer_id';
    evidence.application.hardened_runtime_status = 'enabled';
    evidence.application.timestamp_status = 'valid';
    const applicationRoot = join(root, 'application', contract.bundle.name);
    for (const relativePath of contract.bundle.required_files) {
      const path = join(applicationRoot, ...relativePath.split('/'));
      await mkdir(dirname(path), { recursive: true });
      const governedSource = {
        'Contents/Resources/LICENSE': join(repositoryRoot, 'LICENSE'),
        'Contents/Resources/NOTICE': join(repositoryRoot, 'NOTICE'),
        'Contents/Resources/THIRD_PARTY_NOTICES.txt': join(
          repositoryRoot,
          'packaging',
          'macos',
          'THIRD_PARTY_NOTICES.txt',
        ),
      }[relativePath];
      if (governedSource) await cp(governedSource, path);
      else await writeFile(path, Buffer.from(`official:${relativePath}`));
      await chmod(
        path,
        relativePath === contract.bundle.executable ? 0o755 : 0o644,
      );
    }
    evidence.application_inventory =
      await collectApplicationInventory(applicationRoot);
    const executableBytes = await readFile(
      join(applicationRoot, ...contract.bundle.executable.split('/')),
    );
    evidence.application.executable_sha256 = createHash('sha256')
      .update(executableBytes)
      .digest('hex');
    evidence.application.bundle_sha256 = digestApplicationInventory(
      evidence.application_inventory,
    );
    const dmgBytes = Buffer.from('notarized-and-stapled-dmg');
    evidence.artifact.bytes = dmgBytes.length;
    evidence.artifact.sha256 = createHash('sha256')
      .update(dmgBytes)
      .digest('hex');
    const manifestBytes = Buffer.from(JSON.stringify(evidence));
    await writeFile(join(root, contract.artifact.name), dmgBytes);
    await writeFile(join(root, 'macos-package-manifest.json'), manifestBytes);
    await writeFile(
      join(root, 'SHA256SUMS'),
      `${evidence.artifact.sha256}  ${contract.artifact.name}\n`,
    );
    await writeFile(
      join(root, 'glitchpad-macos.cdx.json'),
      JSON.stringify({
        bomFormat: 'CycloneDX',
        specVersion: '1.6',
        metadata: {
          component: { name: 'Glitchpad for macOS', version: evidence.version },
          properties: [
            { name: 'glitchpad:source_commit', value: evidence.source_commit },
          ],
        },
        components: [
          { 'bom-ref': 'pkg:cargo/glitchpad-core@0.1.0' },
          { 'bom-ref': 'pkg:npm/react@19.2.8' },
        ],
      }),
    );
    await writeFile(
      join(root, 'provenance.json'),
      JSON.stringify({
        schema_version: 1,
        predicate_type: 'https://slsa.dev/provenance/v1',
        candidate_only: false,
        repository: 'shruggietech/glitchpad',
        source_commit: evidence.source_commit,
        workflow_identity: evidence.workflow_identity,
        subjects: [
          { name: contract.artifact.name, sha256: evidence.artifact.sha256 },
          {
            name: `application/${evidence.application.bundle_name}`,
            sha256: evidence.application.bundle_sha256,
          },
        ],
      }),
    );
    await writeFile(
      join(root, 'clean-host-arm64.json'),
      JSON.stringify(receipt(manifestBytes, 'arm64', 'pass')),
    );
    await writeFile(
      join(root, 'clean-host-x86_64.json'),
      JSON.stringify(receipt(manifestBytes, 'x86_64', 'pass')),
    );
    const expectedSigningIdentity = 'Developer ID Application: ShruggieTech';
    const notaryLog = {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'Accepted',
      issues: [],
      artifact_sha256: evidence.artifact.sha256,
    };
    const notaryLogBytes = Buffer.from(JSON.stringify(notaryLog));
    const observedTrust = {
      schema_version: 1,
      application: {
        status: 'valid_developer_id',
        authority: expectedSigningIdentity,
        hardened_runtime_status: 'enabled',
        timestamp_status: 'valid',
        executable_sha256: evidence.application.executable_sha256,
      },
      dmg: { status: 'valid_developer_id', sha256: evidence.artifact.sha256 },
      notarization: {
        status: 'accepted',
        submission_id: notaryLog.id,
        artifact_sha256: evidence.artifact.sha256,
        log_sha256: createHash('sha256').update(notaryLogBytes).digest('hex'),
        warning_count: 0,
      },
      stapling: { status: 'valid' },
      gatekeeper: { status: 'accepted' },
      completed_utc: new Date().toISOString(),
    };
    await writeFile(
      join(root, 'apple-trust-evidence.json'),
      JSON.stringify(observedTrust),
    );
    await writeFile(join(root, 'notarization-log.json'), notaryLogBytes);
    assert.equal(
      await validateOfficialMacosEvidence(evidence, contract, {
        artifactRoot: root,
        expectedSigningIdentity,
        trustInspector: async () => observedTrust,
      }),
      true,
    );
    await assert.rejects(
      validateOfficialMacosEvidence(evidence, contract, {
        artifactRoot: root,
        expectedSigningIdentity:
          'Developer ID Application: Unexpected Publisher',
        trustInspector: async () => observedTrust,
      }),
      /live Apple trust evidence/u,
    );
    await writeFile(
      join(root, 'notarization-log.json'),
      JSON.stringify({ ...notaryLog, artifact_sha256: digest }),
    );
    await assert.rejects(
      validateOfficialMacosEvidence(evidence, contract, {
        artifactRoot: root,
        expectedSigningIdentity,
        trustInspector: async () => observedTrust,
      }),
      /live Apple trust evidence/u,
    );
    await writeFile(join(root, 'notarization-log.json'), notaryLogBytes);
    await writeFile(join(root, contract.artifact.name), 'tampered');
    await assert.rejects(
      validateOfficialMacosEvidence(evidence, contract, {
        artifactRoot: root,
        expectedSigningIdentity,
        trustInspector: async () => observedTrust,
      }),
      /final DMG bytes do not match/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('secret-shaped, stale, malformed, or incomplete evidence fails closed', () => {
  const secret = candidate();
  secret.apple_api_key = 'secret';
  assert.throws(
    () => validateMacosEvidence(secret, contract),
    /secret-shaped/u,
  );
  const missing = candidate();
  missing.application_inventory.pop();
  assert.throws(
    () => validateMacosEvidence(missing, contract),
    /application inventory omits/u,
  );
  const oversized = candidate();
  oversized.artifact.bytes = contract.size_budget.hard_limit_bytes + 1;
  oversized.artifact.size_classification = 'failure';
  assert.throws(
    () => validateMacosEvidence(oversized, contract),
    /invalid DMG size result/u,
  );
  const wrongArchitectures = candidate();
  wrongArchitectures.application.architectures = ['arm64'];
  assert.throws(
    () => validateMacosEvidence(wrongArchitectures, contract),
    /architecture set/u,
  );
});

test('macOS SBOM combines Cargo and transitive production JavaScript dependencies', () => {
  const bom = generateMacosSbom(
    {
      packages: [
        {
          name: 'glitchpad-core',
          version: '0.1.0',
          source: null,
          license: 'Apache-2.0',
        },
      ],
    },
    [
      {
        dependencies: {
          react: {
            version: '19.2.8',
            dependencies: { scheduler: { version: '0.27.0' } },
          },
        },
      },
    ],
    sourceCommit,
  );
  assert.deepEqual(bom.components.map(({ name }) => name).sort(), [
    'glitchpad-core',
    'react',
    'scheduler',
  ]);
  assert.equal(bom.metadata.component.name, 'Glitchpad for macOS');
});
