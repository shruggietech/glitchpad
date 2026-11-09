import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';

test(
  'supporting ADB failure cannot enter instrumentation or qualify a release attempt',
  {
    skip: process.platform !== 'linux',
  },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 's048-runner-'));
    try {
      const bin = join(root, 'bin');
      await mkdir(bin);
      const log = join(root, 'commands.txt');
      await writeFile(
        join(bin, 'adb'),
        [
          '#!/usr/bin/env bash',
          'printf "%s\\n" "$*" >> "$S048_COMMAND_LOG"',
          'if [[ "$1" = install ]]; then echo Success; exit 0; fi',
          'case "$1 ${2:-} ${3:-}" in',
          '  "wait-for-device  ") exit 0 ;;',
          '  "shell getprop sys.boot_completed") echo 1; exit 0 ;;',
          '  "shell pm path") echo package:/data/app/fixture/base.apk; exit 0 ;;',
          '  "shell pm clear") echo Success; exit 0 ;;',
          '  "shell am force-stop") echo fixture-process-reset-refused >&2; exit 7 ;;',
          '  "shell am instrument") echo INSTRUMENTATION_WAS_REACHED >&2; exit 8 ;;',
          'esac',
          'echo "unexpected fixture command" >&2',
          'exit 9',
          '',
        ].join('\n'),
        { mode: 0o755 },
      );
      const app = join(root, 'application.apk');
      const instrumentation = join(root, 'instrumentation.apk');
      await writeFile(app, 'application fixture bytes');
      await writeFile(instrumentation, 'instrumentation fixture bytes');
      const evidence = join(root, 'evidence');
      const result = spawnSync(
        'bash',
        [
          fileURLToPath(
            new URL('./run-android-release-tests.sh', import.meta.url),
          ),
          '24',
          'a'.repeat(40),
          app,
          instrumentation,
          evidence,
        ],
        {
          env: {
            ...process.env,
            PATH: bin + delimiter + process.env.PATH,
            RUNNER_TEMP: root,
            S048_COMMAND_LOG: log,
          },
          encoding: 'utf8',
          windowsHide: true,
          timeout: 15_000,
        },
      );
      assert.equal(result.error, undefined, result.stderr);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      const calls = await readFile(log, 'utf8');
      assert.equal(
        calls
          .split('\n')
          .filter(
            (line) => line === 'shell am force-stop com.shruggietech.glitchpad',
          ).length,
        2,
      );
      assert.doesNotMatch(calls, /shell am instrument/u);
      for (const attempt of [1, 2]) {
        const status = JSON.parse(
          await readFile(
            join(
              evidence,
              'delivery-attempt-' + attempt,
              'delivery-status.json',
            ),
            'utf8',
          ),
        );
        assert.equal(status.command_exit, 7);
        assert.equal(status.pass, false);
        assert.equal(status.phase, 'supporting_setup');
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

test(
  'emulator action script lines are complete independent shell commands',
  { skip: process.platform !== 'linux' },
  async () => {
    const workflow = parseYaml(
      await readFile(
        new URL('../.github/workflows/android-package.yml', import.meta.url),
        'utf8',
      ),
    );
    const steps = Object.values(workflow.jobs)
      .flatMap((job) => job.steps ?? [])
      .filter((step) =>
        step.uses?.startsWith('ReactiveCircus/android-emulator-runner@'),
      );
    assert.ok(
      steps.length > 0,
      'the actual emulator invocation must be exercised',
    );
    for (const step of steps) {
      for (const [index, raw] of step.with.script.split('\n').entries()) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const command = line.replace(/\$\{\{[\s\S]*?\}\}/gu, 'fixture');
        const result = spawnSync('sh', ['-n', '-c', command], {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 5000,
        });
        assert.equal(result.error, undefined);
        assert.equal(
          result.status,
          0,
          'emulator script line ' + (index + 1) + ': ' + result.stderr,
        );
      }
    }
  },
);

test('release PDF diagnostics retain outputs and cannot replace the full campaign', async () => {
  const source = await readFile(
    new URL('./run-android-release-tests.sh', import.meta.url),
    'utf8',
  );
  assert.match(
    source,
    /groups=\(delivery authoring recovery back_about pdf\)/u,
  );
  assert.match(source, /groups=\(pdf\)/u);
  assert.match(source, /pdfCompatibility/u);
  assert.match(source, /s049-print-output-/u);
  const workflow = parseYaml(
    await readFile(
      new URL('../.github/workflows/android-package.yml', import.meta.url),
      'utf8',
    ),
  );
  assert.ok(
    workflow.on.workflow_dispatch.inputs.runtime_scope.options.includes('pdf'),
  );
});

test(
  'failed installation markers cannot enter instrumentation and both bounded attempts are retained',
  { skip: process.platform !== 'linux' },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 's050-install-'));
    try {
      const bin = join(root, 'bin');
      await mkdir(bin);
      await writeFile(
        join(bin, 'adb'),
        '#!/usr/bin/env bash\necho "Failure [INSTALL_FAILED_FIXTURE]"\nexit 0\n',
        { mode: 0o755 },
      );
      const app = join(root, 'app.apk'),
        tests = join(root, 'test.apk'),
        evidence = join(root, 'evidence');
      await writeFile(app, 'app');
      await writeFile(tests, 'test');
      const result = spawnSync(
        'bash',
        [
          fileURLToPath(
            new URL('./run-android-release-tests.sh', import.meta.url),
          ),
          '24',
          'a'.repeat(40),
          app,
          tests,
          evidence,
          'pdf',
        ],
        {
          env: { ...process.env, PATH: bin + delimiter + process.env.PATH },
          encoding: 'utf8',
          windowsHide: true,
          timeout: 15000,
        },
      );
      assert.equal(result.status, 1, result.stdout + result.stderr);
      for (const attempt of [1, 2]) {
        const status = JSON.parse(
          await readFile(
            join(
              evidence,
              'setup',
              'install-application-attempt-' + attempt + '.status.json',
            ),
            'utf8',
          ),
        );
        assert.equal(status.command_exit, 0);
        assert.equal(status.attempt, attempt);
      }
      assert.match(result.stderr, /two bounded attempts/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

test('full runner preserves separate offline restoration ownership for About and PDF', {skip:process.platform!=='linux'}, async()=>{
 const root=await mkdtemp(join(tmpdir(),'s050-offline-groups-'));
 try {
  const bin=join(root,'bin'), scripts=join(root,'scripts');await mkdir(bin);await mkdir(scripts);
  const commandLog=join(root,'offline-commands.txt');
  await writeFile(join(scripts,'run.sh'),await readFile(new URL('./run-android-release-tests.sh',import.meta.url),'utf8'));
  await writeFile(join(scripts,'android-offline-mode.sh'),[
   '#!/usr/bin/env bash','set -euo pipefail',
   'printf "%s:%s\\n" "$1" "$2" >> "$S050_OFFLINE_LOG"',
   'if [[ "$1" == setup ]]; then [[ ! -e "$2-before-state.txt" ]]; echo baseline > "$2-before-state.txt"; else [[ -e "$2-before-state.txt" ]]; echo restored > "$2-restore-status.txt"; fi',''
  ].join('\n'));
  await writeFile(join(bin,'node'),'#!/usr/bin/env bash\nexit 0\n',{mode:0o755});
  await writeFile(join(bin,'adb'),[
   '#!/usr/bin/env bash',
   'if [[ "$1" == install ]]; then echo Success; exit 0; fi',
   'if [[ "$1 $2 $3" == "shell am instrument" ]]; then echo s048_release_evidence={}; echo "OK (1 test)"; echo "INSTRUMENTATION_CODE: -1"; exit 0; fi',
   'if [[ "$1" == exec-out ]]; then echo fixture; fi', 'exit 0',''
  ].join('\n'),{mode:0o755});
  const application=join(root,'app.apk'),instrumentation=join(root,'test.apk'),evidence=join(root,'evidence');
  await writeFile(application,'app');await writeFile(instrumentation,'test');
  const result=spawnSync('bash',[join(scripts,'run.sh'),'24','a'.repeat(40),application,instrumentation,evidence,'full'],{env:{...process.env,PATH:bin+delimiter+process.env.PATH,S050_OFFLINE_LOG:commandLog},encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr+result.stdout);
  const lines=(await readFile(commandLog,'utf8')).trim().split('\n');
  assert.deepEqual(lines,['setup:'+join(evidence,'offline-back_about'),'restore:'+join(evidence,'offline-back_about'),'setup:'+join(evidence,'offline-pdf'),'restore:'+join(evidence,'offline-pdf')]);
  for(const group of ['back_about','pdf'])assert.equal((await readFile(join(evidence,'offline-'+group+'-restore-status.txt'),'utf8')).trim(),'restored');
  // Validators are stubbed: this covers process ownership, never product qualification.
  await assert.rejects(readFile(join(evidence,'release-runtime.json')));
 } finally {await rm(root,{recursive:true,force:true});}
});
