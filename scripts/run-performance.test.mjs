import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { collectPerformance, isAllowedRequest, parseArguments } from './run-performance.mjs';

test('collector arguments are explicit and bounded', () => {
  assert.deepEqual(parseArguments(['--profile', 'hosted_windows_smoke_v1', '--build-id', 'abc', '--skip-build']), {
    profile: 'hosted_windows_smoke_v1', buildId: 'abc', output: null, metric: null, artifact: null, skipBuild: true,
  });
  assert.throws(() => parseArguments(['--profile', 'p', '--build-id', '../secret']), /build_id_invalid/u);
  assert.throws(() => parseArguments(['--profile', 'p', '--build-id', 'b', '--artifact', 'x']), /artifact_metric_pair_required/u);
  assert.equal(parseArguments(['--profile', 'p', '--build-id', 'b', '--metric', 'editor_input_paint']).metric, 'editor_input_paint');
  assert.throws(() => parseArguments(['--unknown']), /argument_unknown/u);
});

test('collector request policy remains loopback-origin and inert-resource only', () => {
  const origin = 'http://127.0.0.1:1234';
  assert.equal(isAllowedRequest('/assets/app.js', origin), true);
  assert.equal(isAllowedRequest('blob:https://opaque.invalid/id', origin), true);
  assert.equal(isAllowedRequest('data:image/svg+xml,x', origin), true);
  assert.equal(isAllowedRequest('https://example.com', origin), false);
  assert.equal(isAllowedRequest('file:///private', origin), false);
});

test('artifact collection measures an actual file and rejects absence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'glitchpad-performance-'));
  const artifact = join(directory, 'fixture.exe');
  try {
    await writeFile(artifact, Buffer.alloc(4_096));
    const [evidence] = await collectPerformance({
      profile: 'desktop_reference_v1', buildId: 'artifact-test', output: null,
      metric: 'desktop_installer_size', artifact, skipBuild: true,
    });
    assert.equal(evidence.maximum, 4_096);
    assert.equal(evidence.method, 'artifact-stat-v1');
    await assert.rejects(
      collectPerformance({
        profile: 'desktop_reference_v1', buildId: 'artifact-test', output: null,
        metric: 'desktop_installer_size', artifact: join(directory, 'absent.exe'), skipBuild: true,
      }),
      /artifact_unavailable/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
