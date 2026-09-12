import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assembleCommunityRelease } from './assemble-community-release.mjs';

const sourceCommit = 'a'.repeat(40);
const practicalUseEvidence = {
  windows: [
    'installed-markdown-lifecycle-receipt.json',
    'portable-lifecycle-receipt.json',
  ],
  macos: ['clean-host-arm64.json', 'clean-host-x86_64.json'],
  linux: [
    'clean-ubuntu-22.04-appimage.json',
    'clean-ubuntu-22.04-deb.json',
    'clean-ubuntu-24.04-appimage.json',
    'clean-ubuntu-24.04-deb.json',
  ],
};
const practicalUseRequiredPasses = {
  windows: [
    'clean_launch',
    'text_delivery',
    'markdown_delivery',
    'markdown_minimal',
    'markdown_edit_save_preview',
    'document_scoped_recovery_contract',
    'markdown_alpha_beta',
    'markdown_beta_alpha',
    'menu_geometry',
    'toolbar_reserved_region',
    'document_preservation',
  ],
  macos: [
    'automated.mount',
    'automated.copy',
    'automated.launch',
    'automated.finder_delivery',
    'automated.running_instance_delivery',
    'automated.read',
    'automated.edit',
    'automated.save',
    'automated.recovery',
    'automated.remove',
    'automated.cleanup',
    'automated.universal_architecture',
  ],
  linux: [
    'automated.artifact_integrity',
    'automated.install_or_extract',
    'automated.desktop_registration',
    'automated.mime_registration',
    'automated.launch',
    'automated.startup_delivery',
    'automated.running_instance_delivery',
    'automated.read',
    'automated.edit',
    'automated.save',
    'automated.metadata',
    'automated.recovery',
    'automated.remove',
    'automated.registration_cleanup',
    'automated.document_preservation',
  ],
};

function passingReceipt(platform) {
  const receipt = {};
  for (const path of practicalUseRequiredPasses[platform]) {
    const parts = path.split('.');
    let target = receipt;
    for (const part of parts.slice(0, -1)) target = target[part] ??= {};
    target[parts.at(-1)] = 'pass';
  }
  return receipt;
}

async function releaseFixture() {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-release-'));
  const input = join(root, 'input');
  const output = join(root, 'output');
  await mkdir(input);
  const artifacts = Array.from(
    { length: 8 },
    (_, index) => `glitchpad-0.1.3-${index}.bin`,
  );
  for (const name of artifacts) await writeFile(join(input, name), name);
  const trustStates = {
    windows: 'unsigned_community',
    macos: 'adhoc_non_notarized_community',
    linux: 'repository_attested',
    android: 'stable_project_key',
  };
  const manifestNames = {
    windows: 'windows-package-manifest.json',
    macos: 'macos-package-manifest.json',
    linux: 'linux-package-manifest.json',
    android: 'android-package-manifest.json',
  };
  const receipts = new Map();
  for (const platform of Object.keys(manifestNames)) {
    const directory = join(input, platform);
    await mkdir(directory);
    const identity =
      platform === 'android'
        ? { authority: 'official', publication_status: 'eligible_official' }
        : { official: true, gate_status: 'official_valid' };
    const manifestBytes = JSON.stringify({
      source_commit: sourceCommit,
      ...identity,
    });
    await writeFile(join(directory, manifestNames[platform]), manifestBytes);
    if (platform !== 'android') {
      await writeFile(
        join(directory, 'community-trust-evidence.json'),
        JSON.stringify({
          source_commit: sourceCommit,
          trust_state: trustStates[platform],
        }),
      );
      for (const name of practicalUseEvidence[platform]) {
        const receipt = {
          ...passingReceipt(platform),
          schema_version: platform === 'windows' ? 5 : 1,
          candidate_manifest_sha256: createHash('sha256')
            .update(manifestBytes)
            .digest('hex'),
          evidence_authority: { source_commit: sourceCommit },
          content_free: true,
        };
        const receiptPath = join(directory, name);
        await writeFile(receiptPath, JSON.stringify(receipt));
        receipts.set(`${platform}/${name}`, { path: receiptPath, receipt });
      }
    }
  }
  const contractPath = join(root, 'contract.json');
  await writeFile(
    contractPath,
    JSON.stringify({
      version: '0.1.3',
      tag: 'v0.1.3',
      repository: 'shruggietech/glitchpad',
      artifacts,
      trust_states: trustStates,
      practical_use_evidence: practicalUseEvidence,
      practical_use_required_passes: practicalUseRequiredPasses,
    }),
  );
  return { input, output, contractPath, artifacts, receipts };
}

test('assembles exactly the declared artifact and practical-use evidence set', async () => {
  const fixture = await releaseFixture();
  const manifest = await assembleCommunityRelease({
    input: fixture.input,
    output: fixture.output,
    sourceCommit,
    contractPath: fixture.contractPath,
  });
  assert.equal(manifest.artifacts.length, 8);
  assert.deepEqual(manifest.practical_use_evidence, practicalUseEvidence);
  assert.match(
    await readFile(join(fixture.output, 'SHA256SUMS'), 'utf8'),
    /glitchpad-0\.1\.3-7\.bin/u,
  );
});

test('rejects a missing practical-use receipt', async () => {
  const fixture = await releaseFixture();
  await writeFile(
    fixture.contractPath,
    JSON.stringify({
      version: '0.1.3',
      tag: 'v0.1.3',
      repository: 'shruggietech/glitchpad',
      artifacts: fixture.artifacts,
      trust_states: {
        windows: 'unsigned_community',
        macos: 'adhoc_non_notarized_community',
        linux: 'repository_attested',
        android: 'stable_project_key',
      },
      practical_use_evidence: {
        ...practicalUseEvidence,
        windows: [...practicalUseEvidence.windows, 'missing-receipt.json'],
      },
      practical_use_required_passes: practicalUseRequiredPasses,
    }),
  );
  await assert.rejects(
    assembleCommunityRelease({
      input: fixture.input,
      output: fixture.output,
      sourceCommit,
      contractPath: fixture.contractPath,
    }),
    /practical-use evidence.*missing/u,
  );
});

for (const [name, mutate, expected] of [
  [
    'missing required practical result',
    (receipt) => {
      delete receipt.markdown_edit_save_preview;
    },
    /required pass markdown_edit_save_preview/u,
  ],
  [
    'stale source revision',
    (receipt) => {
      receipt.evidence_authority.source_commit = 'b'.repeat(40);
    },
    /source commit/u,
  ],
  [
    'wrong package manifest digest',
    (receipt) => {
      receipt.candidate_manifest_sha256 = 'b'.repeat(64);
    },
    /manifest digest/u,
  ],
  [
    'failed practical result',
    (receipt) => {
      receipt.markdown_delivery = 'failed';
    },
    /failed practical-use result/u,
  ],
  [
    'privacy-bearing field',
    (receipt) => {
      receipt.document_content = '# private document';
    },
    /prohibited field/u,
  ],
  [
    'case-shifted privacy-bearing field',
    (receipt) => {
      receipt.Document_Content = '# private document';
    },
    /prohibited field/u,
  ],
  [
    'failed practical result nested in an array',
    (receipt) => {
      receipt.additional_results = ['pass', 'hard_failure'];
    },
    /failed practical-use result/u,
  ],
]) {
  test(`rejects ${name}`, async () => {
    const fixture = await releaseFixture();
    const target = fixture.receipts.get(
      'windows/installed-markdown-lifecycle-receipt.json',
    );
    mutate(target.receipt);
    await writeFile(target.path, JSON.stringify(target.receipt));
    await assert.rejects(
      assembleCommunityRelease({
        input: fixture.input,
        output: fixture.output,
        sourceCommit,
        contractPath: fixture.contractPath,
      }),
      expected,
    );
  });
}
