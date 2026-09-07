import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promoteCommunityPackage } from './promote-community-package.mjs';

test('promotes eligible unsigned Windows evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-promote-'));
  const sourceCommit = 'a'.repeat(40);
  const manifest = {
    source_commit: sourceCommit,
    official: false,
    gate_status: 'candidate_valid',
    artifacts: [
      {
        name: 'glitchpad.exe',
        signature_status: 'not_applicable_unsigned_candidate',
      },
    ],
  };
  await writeFile(
    join(root, 'windows-package-manifest.json'),
    JSON.stringify(manifest),
  );
  await writeFile(
    join(root, 'provenance.json'),
    JSON.stringify({ source_commit: sourceCommit, candidate_only: true }),
  );
  const contractPath = join(root, 'contract.json');
  await writeFile(
    contractPath,
    JSON.stringify({
      official: { required_evidence: ['community-trust-evidence.json'] },
    }),
  );
  const trust = await promoteCommunityPackage({
    platform: 'windows',
    directory: root,
    sourceCommit,
    contractPath,
  });
  const promoted = JSON.parse(
    await readFile(join(root, 'windows-package-manifest.json'), 'utf8'),
  );
  assert.equal(trust.trust_state, 'unsigned_community');
  assert.equal(promoted.official, true);
  assert.equal(promoted.artifacts[0].signature_status, 'not_signed');
});
