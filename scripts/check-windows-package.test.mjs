import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  checkWindowsConfiguration,
  classifyPackageSize,
  validateWindowsEvidence,
} from './check-windows-package.mjs';

const repositoryRoot = new URL('../', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1));
const contract = JSON.parse(await readFile(join(repositoryRoot, 'packaging', 'windows', 'package-contract.json'), 'utf8'));
const digest = 'a'.repeat(64);

function candidate() {
  return {
    schema_version: 1,
    version: '0.1.0',
    platform: 'windows',
    architecture: 'x86_64',
    source_commit: digest,
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
  assert.throws(() => validateWindowsEvidence(candidate(), contract, { official: true }), /official evidence is not explicitly authorized/u);
});

test('official mode requires final-byte signatures and every evidence file', () => {
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
  assert.equal(validateWindowsEvidence(evidence, contract, { official: true }), true);
  evidence.artifacts[0].signature_sha256 = 'b'.repeat(64);
  assert.throws(() => validateWindowsEvidence(evidence, contract, { official: true }), /does not bind nsis/u);
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
