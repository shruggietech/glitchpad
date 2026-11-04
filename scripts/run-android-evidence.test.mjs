import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, chmod, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const repository = resolve(import.meta.dirname, '..');
const posix = { skip: process.platform === 'win32' ? 'Android hosted execution uses POSIX runners; interactive Windows uses Linux containers.' : false };
const source = 'a'.repeat(40);

async function executable(path, content) { await writeFile(path, content, 'utf8'); await chmod(path, 0o755); }

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'glitchpad-android-evidence-'));
  const binary = join(directory, 'bin');
  const evidence = join(directory, 'evidence');
  const gradle = join(directory, 'crates/glitchpad-host/gen/android');
  const application = join(gradle, 'app/build/outputs/apk/universal/debug/app-universal-debug.apk');
  const instrumentation = join(gradle, 'app/build/outputs/apk/androidTest/universal/debug/app-universal-debug-androidTest.apk');
  await Promise.all([mkdir(binary, { recursive: true }), mkdir(evidence), mkdir(join(application, '..'), { recursive: true }), mkdir(join(instrumentation, '..'), { recursive: true }), mkdir(join(directory, 'apps/glitchpad'), { recursive: true })]);
  await writeFile(application, 'synthetic application bytes');
  await writeFile(instrumentation, 'synthetic instrumentation bytes');
  await writeFile(join(directory, 'wrong.apk'), 'different installed bytes');
  await writeFile(join(directory, 'apps/glitchpad/package.json'), JSON.stringify({ version: '0.2.0' }));
  await executable(join(binary, 'sleep'), '#!/usr/bin/env bash\nexit 0\n');
  await executable(join(gradle, 'gradlew'), "#!/usr/bin/env bash\nset -eu\ncount=0; if [[ -f \"$RUNNER_TEMP/gradle-count\" ]]; then count=$(cat \"$RUNNER_TEMP/gradle-count\"); fi\ncount=$((count+1)); echo \"$count\" > \"$RUNNER_TEMP/gradle-count\"\necho \"gradle attempt $count\"\nif [[ \"${MOCK_RETRY:-0}\" = 1 && \"$count\" = 1 ]]; then exit 1; fi\nrm -f \"$RUNNER_TEMP/application-installed\" \"$RUNNER_TEMP/instrumentation-installed\"\necho gradle-cleanup >> \"$RUNNER_TEMP/adb-events.txt\"\nexit 0\n");
  await executable(join(binary, 'adb'), `#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "$RUNNER_TEMP/adb-events.txt"
if [[ "$1" = install ]]; then
  if [[ "\${MOCK_INSTALL_FAILURE:-0}" = 1 ]]; then exit 1; fi
  built="\${@: -1}"
  if [[ "$built" = *app-universal-debug.apk ]]; then touch "$RUNNER_TEMP/application-installed"; elif [[ "$built" = *app-universal-debug-androidTest.apk ]]; then touch "$RUNNER_TEMP/instrumentation-installed"; else exit 1; fi
elif [[ "$1" = shell && "$2" = pm && "$3" = path ]]; then
  if [[ "$4" = com.shruggietech.glitchpad ]]; then [[ -f "$RUNNER_TEMP/application-installed" ]]; echo "package:$FIXTURE_APPLICATION"; else [[ -f "$RUNNER_TEMP/instrumentation-installed" ]]; echo "package:$FIXTURE_INSTRUMENTATION"; fi
  if [[ "\${MOCK_SPLIT:-0}" = 1 ]]; then echo 'package:split.apk'; fi
elif [[ "$1" = pull ]]; then
  original="$2"
  if [[ "\${MOCK_MISMATCH:-0}" = 1 && "$2" = "$FIXTURE_APPLICATION" ]]; then original="$FIXTURE_WRONG"; fi
  cp "$original" "$3"
elif [[ "$1" = shell && "$2" = getprop ]]; then
  if [[ "$3" = ro.build.version.sdk ]]; then echo 36; else echo 16; fi
elif [[ "$1" = shell && "$2" = am && "$3" = instrument ]]; then
  count=0; if [[ -f "$RUNNER_TEMP/instrument-count" ]]; then count=$(cat "$RUNNER_TEMP/instrument-count"); fi
  count=$((count+1)); echo "$count" > "$RUNNER_TEMP/instrument-count"
  echo "instrumentation attempt $count"
  if [[ "\${MOCK_NEVER_PASSES:-0}" != 1 && "$count" = 2 ]]; then echo 'journey_marker=pass'; else echo 'INSTRUMENTATION_FAILED: synthetic failure'; fi
elif [[ "$1" = logcat && "\${2:-}" != -c ]]; then echo 'synthetic bounded logcat'
elif [[ "$1" = exec-out ]]; then exit 1
fi
`);
  const environment = { ...process.env, PATH: binary + ':' + process.env.PATH, RUNNER_TEMP: evidence, GITHUB_SHA: source, GLITCHPAD_BUILD_COMMIT: source, GLITCHPAD_RECOVERY_PROBE_VARIANT: 'none', FIXTURE_APPLICATION: application, FIXTURE_INSTRUMENTATION: instrumentation, FIXTURE_WRONG: join(directory, 'wrong.apk') };
  return { directory, evidence, application, instrumentation, environment, async dispose() { await rm(directory, { recursive: true, force: true }); } };
}

function run(script, state, args = [], environment = {}) {
  return spawnSync('bash', [join(repository, 'scripts', script), ...args], { cwd: state.directory, env: { ...state.environment, ...environment }, encoding: 'utf8', windowsHide: true });
}

for (const [name, environment, expected] of [
  ['retains exact installed application and test APKs with source identity', {}, 0],
  ['labels the compiled-test fault variant separately from ordinary APKs', { GLITCHPAD_RECOVERY_PROBE_VARIANT: 'compiled_test_only' }, 0],
  ['rejects failed candidate installation before capture', { MOCK_INSTALL_FAILURE: '1' }, 1],
  ['rejects installed bytes differing from the built APK', { MOCK_MISMATCH: '1' }, 1],
  ['rejects split-package evidence in a universal APK campaign', { MOCK_SPLIT: '1' }, 1],
  ['rejects missing full source identity', { GITHUB_SHA: '', GLITCHPAD_BUILD_COMMIT: '' }, 1],
]) {
  test(name, posix, async () => {
    const state = await fixture();
    try {
      const result = run('run-android-connected-tests.sh', state, [], environment);
      assert.equal(result.status, expected, result.stdout + result.stderr);
      const receiptPath = join(state.evidence, 'android-tested-candidate/tested-apk-receipt.json');
      if (expected === 0) {
        const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
        assert.equal(receipt.source_commit, source);
        assert.equal(receipt.product_version, '0.2.0');
        assert.equal(receipt.evidence_class, 'hosted_debug_instrumentation');
        assert.equal(receipt.signed_release_bytes_tested, false);
        assert.equal(receipt.recovery_probe_variant, environment.GLITCHPAD_RECOVERY_PROBE_VARIANT || 'none');
        assert.equal(receipt.api_level, 36);
        for (const artifact of receipt.artifacts) {
          const bytes = await readFile(join(state.evidence, 'android-tested-candidate', artifact.filename));
          assert.equal(artifact.sha256, createHash('sha256').update(bytes).digest('hex'));
          assert.equal(artifact.byte_count, bytes.length);
        }
      } else await assert.rejects(access(receiptPath));
    } finally { await state.dispose(); }
  });
}

test('installs both built APKs after Gradle cleanup before installed-byte capture', posix, async () => {
  const state = await fixture();
  try {
    const result = run('run-android-connected-tests.sh', state);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const events = (await readFile(join(state.evidence, 'adb-events.txt'), 'utf8')).trim().split('\n');
    const cleanup = events.indexOf('gradle-cleanup');
    const application = events.findIndex(event => event.startsWith('install -r -t ') && event.endsWith('/app-universal-debug.apk'));
    const instrumentation = events.findIndex(event => event.startsWith('install -r -t ') && event.endsWith('/app-universal-debug-androidTest.apk'));
    const capture = events.findIndex(event => event.startsWith('shell pm path '));
    assert.ok(cleanup >= 0 && application > cleanup && instrumentation > cleanup, events.join('\n'));
    assert.ok(capture > application && capture > instrumentation, events.join('\n'));
    const receipt = JSON.parse(await readFile(join(state.evidence, 'android-tested-candidate/tested-apk-receipt.json'), 'utf8'));
    assert.equal(receipt.capture_boundary, 'post_connected_suite_reinstall');
  } finally { await state.dispose(); }
});

test('connected retry retains both failed and successful attempt outputs', posix, async () => {
  const state = await fixture();
  try {
    const result = run('run-android-connected-tests.sh', state, [], { MOCK_RETRY: '1' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(await readFile(join(state.evidence, 'connected-suite-attempt-1.txt'), 'utf8'), /gradle attempt 1/u);
    assert.match(await readFile(join(state.evidence, 'connected-suite-attempt-2.txt'), 'utf8'), /gradle attempt 2/u);
    assert.match(await readFile(join(state.evidence, 'connected-suite-attempt-1-logcat.txt'), 'utf8'), /synthetic bounded logcat/u);
  } finally { await state.dispose(); }
});

for (const neverPasses of [false, true]) {
  test('instrumentation preserves every attempt when ' + (neverPasses ? 'both fail' : 'the bounded retry passes'), posix, async () => {
    const state = await fixture();
    try {
      const output = join(state.evidence, 'journey.txt');
      const result = run('run-android-instrumentation.sh', state, [output, 'journey_marker=', '-e', 'class', 'Synthetic'], { MOCK_NEVER_PASSES: neverPasses ? '1' : '0' });
      assert.equal(result.status, neverPasses ? 1 : 0, result.stdout + result.stderr);
      assert.match(await readFile(join(state.evidence, 'journey-attempt-1.txt'), 'utf8'), /INSTRUMENTATION_FAILED/u);
      assert.match(await readFile(join(state.evidence, 'journey-attempt-2.txt'), 'utf8'), neverPasses ? /INSTRUMENTATION_FAILED/u : /journey_marker=pass/u);
      assert.match(await readFile(output, 'utf8'), /instrumentation attempt 2/u);
      await assert.rejects(access(join(state.evidence, 'journey-attempt-1-s046-authoring.png')));
    } finally { await state.dispose(); }
  });
}
