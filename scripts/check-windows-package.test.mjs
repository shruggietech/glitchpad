import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  checkWindowsConfiguration,
  classifyPackageSize,
  validateOfficialWindowsEvidence,
  validateWindowsEvidence,
} from './check-windows-package.mjs';
import { generateWindowsSbom } from './generate-windows-sbom.mjs';

const repositoryRoot = new URL('../', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1));
const contract = JSON.parse(await readFile(join(repositoryRoot, 'packaging', 'windows', 'package-contract.json'), 'utf8'));
const digest = 'a'.repeat(64);
const sourceCommit = 'b'.repeat(40);

function candidate() {
  return {
    schema_version: 1,
    version: '0.1.0',
    platform: 'windows',
    architecture: 'x86_64',
    source_commit: sourceCommit,
    workflow_identity: 'shruggietech/glitchpad/.github/workflows/windows-package.yml@refs/tags/v0.1.0',
    official: false,
    gate_status: 'candidate_valid',
    artifacts: contract.artifacts.map((artifact) => ({
      ...artifact,
      sha256: digest,
      bytes: 1024,
      size_classification: 'pass',
      signature_status: 'not_applicable_unsigned_candidate',
    })),
    portable_inventory: contract.portable_required_files.map((relative_path) => ({
      relative_path,
      sha256: digest,
      bytes: 1,
    })),
  };
}

test('repository Windows package configuration is internally consistent', async () => {
  assert.deepEqual(await checkWindowsConfiguration(repositoryRoot), {
    capabilityCount: 21,
    artifactCount: 2,
  });
});

test('size classification preserves exact S018 boundaries', () => {
  assert.equal(classifyPackageSize(contract.size_budget.target_bytes, contract.size_budget), 'pass');
  assert.equal(classifyPackageSize(contract.size_budget.target_bytes + 1, contract.size_budget), 'warning');
  assert.equal(classifyPackageSize(contract.size_budget.hard_limit_bytes, contract.size_budget), 'warning');
  assert.equal(classifyPackageSize(contract.size_budget.hard_limit_bytes + 1, contract.size_budget), 'failure');
});

test('a complete unsigned candidate passes candidate mode', () => {
  assert.equal(validateWindowsEvidence(candidate(), contract), true);
});

test('an unsigned candidate can never pass official mode', () => {
  assert.throws(() => validateWindowsEvidence(candidate(), contract, { official: true }), /live final-byte and Authenticode verification/u);
});

test('a self-asserted official manifest cannot bypass live verification', () => {
  const evidence = candidate();
  evidence.official = true;
  evidence.gate_status = 'official_valid';
  evidence.event = 'push_tag';
  evidence.tag = 'v0.1.0';
  evidence.evidence_files = [...contract.official.required_evidence];
  evidence.artifacts = evidence.artifacts.map((artifact) => ({
    ...artifact,
    signature_status: 'valid',
    timestamp_status: 'valid',
    signature_sha256: artifact.sha256,
  }));
  assert.throws(
    () => validateWindowsEvidence(evidence, contract, { official: true }),
    /live final-byte and Authenticode verification/u,
  );
});

test('official mode binds final bytes to live Authenticode and recorded evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-signature-'));
  try {
    await mkdir(join(root, 'portable'));
    const evidence = candidate();
    evidence.official = true;
    evidence.gate_status = 'official_valid';
    evidence.event = 'push_tag';
    evidence.tag = 'v0.1.0';
    evidence.evidence_files = [...contract.official.required_evidence];
    for (const artifact of evidence.artifacts) {
      const bytes = Buffer.from(artifact.kind);
      await writeFile(join(root, artifact.name), bytes);
      artifact.sha256 = createHash('sha256').update(bytes).digest('hex');
      artifact.bytes = bytes.length;
      artifact.signature_status = 'valid';
      artifact.timestamp_status = 'valid';
    }
    for (const entry of evidence.portable_inventory) {
      const bytes = Buffer.from(entry.relative_path);
      await writeFile(join(root, 'portable', entry.relative_path), bytes);
      entry.sha256 = createHash('sha256').update(bytes).digest('hex');
      entry.bytes = bytes.length;
    }
    const observed = {
      status: 'Valid',
      signer_subject: contract.official.publisher_subject,
      signer_thumbprint: 'a'.repeat(40),
      timestamp_subject: 'CN=Timestamp Authority',
      timestamp_thumbprint: 'b'.repeat(40),
    };
    const installer = evidence.artifacts.find(({ kind }) => kind === 'nsis');
    const portable = evidence.artifacts.find(({ kind }) => kind === 'portable_zip');
    const portableExecutable = evidence.portable_inventory.find(({ relative_path }) => relative_path === 'Glitchpad.exe');
    installer.signature_sha256 = installer.sha256;
    portable.signature_sha256 = portableExecutable.sha256;
    const signatures = {
      schema_version: 1,
      artifacts: [
        { kind: 'nsis', sha256: installer.sha256, ...observed },
        { kind: 'portable_executable', sha256: portableExecutable.sha256, ...observed },
      ],
    };
    const manifestBytes = Buffer.from(JSON.stringify(evidence));
    await writeFile(join(root, 'windows-package-manifest.json'), manifestBytes);
    await writeFile(
      join(root, 'SHA256SUMS'),
      `${evidence.artifacts.map(({ sha256, name }) => `${sha256}  ${name}`).join('\n')}\n`,
    );
    await writeFile(join(root, 'glitchpad-windows.cdx.json'), JSON.stringify({
      bomFormat: 'CycloneDX',
      specVersion: '1.6',
      metadata: {
        component: { name: 'Glitchpad for Windows', version: evidence.version },
        properties: [{ name: 'glitchpad:source_commit', value: evidence.source_commit }],
      },
      components: [
        { 'bom-ref': 'pkg:cargo/glitchpad-core@0.1.0' },
        { 'bom-ref': 'pkg:npm/react@19.2.8' },
      ],
    }));
    await writeFile(join(root, 'provenance.json'), JSON.stringify({
      schema_version: 1,
      predicate_type: 'https://slsa.dev/provenance/v1',
      candidate_only: false,
      repository: 'shruggietech/glitchpad',
      source_commit: evidence.source_commit,
      workflow_identity: evidence.workflow_identity,
      subjects: evidence.artifacts.map(({ name, sha256 }) => ({ name, sha256 })),
    }));
    const passed = Object.fromEntries([
      'install', 'launch', 'command_line', 'association', 'read', 'edit', 'save', 'metadata', 'recovery', 'uninstall', 'portable', 'cleanup', 'performance',
    ].map((key) => [key, 'pass']));
    const manualPassed = Object.fromEntries([
      'dialog', 'drag_drop', 'save_as', 'print', 'keyboard', 'focus', 'text_scale', 'forced_colors', 'screen_reader',
    ].map((key) => [key, 'pass']));
    await writeFile(join(root, 'clean-machine-receipt.json'), JSON.stringify({
      schema_version: 1,
      candidate_manifest_sha256: createHash('sha256').update(manifestBytes).digest('hex'),
      windows: { edition: 'Windows 11 Pro', build: '26100', architecture: 'x86_64', webview2_version: '1.0.0' },
      automated: passed,
      manual: manualPassed,
      content_free: true,
      completed_utc: new Date().toISOString(),
    }));
    await writeFile(join(root, 'signature-evidence.json'), JSON.stringify(signatures));
    assert.equal(await validateOfficialWindowsEvidence(evidence, contract, {
      artifactRoot: root,
      authenticodeInspector: async () => observed,
    }), true);
    await writeFile(join(root, installer.name), 'tampered');
    await assert.rejects(
      validateOfficialWindowsEvidence(evidence, contract, {
        artifactRoot: root,
        authenticodeInspector: async () => observed,
      }),
      /final bytes do not match nsis/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('portable inventory rejects traversal, case collisions, and extra executables', () => {
  for (const relative_path of ['../Glitchpad.exe', 'C:/Glitchpad.exe', 'bin\\Glitchpad.exe', 'evil.exe']) {
    const evidence = candidate();
    evidence.portable_inventory.push({ relative_path, sha256: digest, bytes: 1 });
    assert.throws(() => validateWindowsEvidence(evidence, contract), /unsafe|unexpected executable/u);
  }
  const collision = candidate();
  collision.portable_inventory.push({ relative_path: 'glitchpad.EXE', sha256: digest, bytes: 1 });
  assert.throws(() => validateWindowsEvidence(collision, contract), /case-colliding/u);
});

test('missing notices, bad size results, and secret-shaped evidence fail closed', () => {
  const badCommit = candidate();
  badCommit.source_commit = 'c'.repeat(39);
  assert.throws(() => validateWindowsEvidence(badCommit, contract), /source commit is invalid/u);
  const missing = candidate();
  missing.portable_inventory.pop();
  assert.throws(() => validateWindowsEvidence(missing, contract), /portable inventory omits/u);
  const oversized = candidate();
  oversized.artifacts[0].bytes = contract.size_budget.hard_limit_bytes + 1;
  oversized.artifacts[0].size_classification = 'failure';
  assert.throws(() => validateWindowsEvidence(oversized, contract), /invalid size result/u);
  const secret = candidate();
  secret.note = 'client_secret';
  assert.throws(() => validateWindowsEvidence(secret, contract), /secret-shaped/u);
});

test('Windows SBOM combines Cargo and transitive production JavaScript dependencies', () => {
  const bom = generateWindowsSbom(
    { packages: [{ name: 'glitchpad-core', version: '0.1.0', source: null, license: 'Apache-2.0' }] },
    [{ dependencies: { react: { version: '19.2.4', dependencies: { scheduler: { version: '0.27.0' } } } } }],
    sourceCommit,
  );
  assert.deepEqual(
    bom.components.map(({ name }) => name).sort(),
    ['glitchpad-core', 'react', 'scheduler'],
  );
  assert.ok(bom.components.find(({ name }) => name === 'react')?.purl.startsWith('pkg:npm/'));
  assert.deepEqual(bom.metadata.properties, [{ name: 'glitchpad:source_commit', value: sourceCommit }]);
});
