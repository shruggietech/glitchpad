import { startPdfPrintDialogProbe } from './lib/pdf-print-dialog-probe.mjs';
import os from 'node:os';
import { nativePdfConformanceRecord } from './lib/pdf-native-record.mjs';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  mkdtemp,
  mkdir,
  copyFile,
  readFile,
  writeFile,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
let binary = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Native binary path required');
let packageProof = null;
let packageArtifactPath = null;
const option = name => {const index=process.argv.indexOf(name);if(index<0)return null;if(!process.argv[index+1]||process.argv[index+1].startsWith('--'))throw Error('Missing '+name);return process.argv[index+1];};
const stagedArtifact=option('--artifact'), stagedManifest=option('--manifest'), stagedProfile=option('--profile');
let expectedSource=process.env.SOURCE_REF;
if (stagedArtifact) {
  assert.ok(stagedManifest && stagedProfile,'Staged PDF proof needs manifest and profile');
  const bytes=await readFile(stagedArtifact), manifestBytes=await readFile(stagedManifest), manifest=JSON.parse(manifestBytes);
  const entry=(manifest.artifacts || [manifest.artifact]).find(row=>row && row.name===stagedArtifact.split(/[\\/]/u).at(-1));
  assert.ok(entry && entry.sha256===sha256(bytes),'Selected staged artifact must match its actual manifest');
  const delivered=await readFile(option('--installed-executable') || binary);
  expectedSource=manifest.source_commit;
  packageArtifactPath=stagedArtifact;
  packageProof={form:stagedProfile,package_sha256:sha256(bytes),package_bytes:bytes.length,manifest_sha256:sha256(manifestBytes),executable_sha256:sha256(delivered),executable_bytes:delivered.length,source_commit:expectedSource};
}
if (process.argv.includes('--packaged')) {
  const originalBinary = binary;
  const staging = await mkdtemp(join(tmpdir(), 'glitchpad-pdf-package-'));
  const execute = promisify(execFile);
  let artifact;
  if (process.platform === 'win32') {
    const directory = resolve('target/debug/bundle/nsis');
    const names = (await readdir(directory)).filter((name) =>
      name.endsWith('.exe'),
    );
    assert.equal(names.length, 1);
    artifact = join(directory, names[0]);
    await execute(artifact, ['/S', '/D=' + staging], {
      windowsHide: true,
      timeout: 120000,
    });
    binary = join(staging, 'glitchpad-host.exe');
  } else if (process.platform === 'darwin') {
    binary = resolve(
      'target/debug/bundle/macos/Glitchpad.app/Contents/MacOS/glitchpad-host',
    );
    artifact = join(staging, 'Glitchpad.app.tar');
    await execute(
      'tar',
      [
        '-cf',
        artifact,
        '-C',
        resolve('target/debug/bundle/macos'),
        'Glitchpad.app',
      ],
      { windowsHide: true, timeout: 60000 },
    );
  } else {
    const directory = resolve('target/debug/bundle/deb');
    const names = (await readdir(directory)).filter((name) =>
      name.endsWith('.deb'),
    );
    assert.equal(names.length, 1);
    artifact = join(directory, names[0]);
    await execute('dpkg-deb', ['--extract', artifact, staging], {
      windowsHide: true,
      timeout: 60000,
    });
    binary = join(staging, 'usr/bin/glitchpad-host');
  }
  const sourceBytes = await readFile(originalBinary),
    deliveredBytes = await readFile(binary);
  let comparison =
    sha256(deliveredBytes) === sha256(sourceBytes)
      ? 'exact_bytes'
      : 'packaged_bytes_differ';
  let matchedBuiltCode = comparison === 'exact_bytes';
  if (process.platform === 'darwin') {
    const unsignedBuilt = join(staging, 'unsigned-built'),
      unsignedDelivered = join(staging, 'unsigned-delivered');
    await copyFile(originalBinary, unsignedBuilt);
    await copyFile(binary, unsignedDelivered);
    for (const path of [unsignedBuilt, unsignedDelivered]) {
      try {
        await execute('codesign', ['--remove-signature', path], {
          windowsHide: true,
          timeout: 30000,
        });
      } catch (error) {
        if (!String(error.stderr).includes('not signed at all')) throw error;
      }
    }
    matchedBuiltCode =
      sha256(await readFile(unsignedBuilt)) ===
      sha256(await readFile(unsignedDelivered));
    comparison = matchedBuiltCode
      ? 'signing_normalized_macho'
      : 'packaged_bytes_differ';
  }
  packageArtifactPath = artifact;
  const packageBytes = await readFile(artifact);
  packageProof = {
    form:
      process.platform === 'win32'
        ? 'installed_nsis'
        : process.platform === 'darwin'
          ? 'app_bundle'
          : 'extracted_deb',
    package_sha256: createHash('sha256').update(packageBytes).digest('hex'),
    executable_sha256: createHash('sha256')
      .update(deliveredBytes)
      .digest('hex'),
    executable_bytes: deliveredBytes.length,
    matched_built_code: matchedBuiltCode,
    comparison: comparison,
    built_executable_sha256: createHash('sha256')
      .update(sourceBytes)
      .digest('hex'),
  };
}
const output = resolve(option('--output') || 'artifacts/pdf-native');
await mkdir(output, { recursive: true });
if (packageArtifactPath && !stagedArtifact)
  await copyFile(
    packageArtifactPath,
    join(
      output,
      process.platform === 'win32'
        ? 'candidate.exe'
        : process.platform === 'darwin'
          ? 'candidate.app.tar'
          : 'candidate.deb',
    ),
  );
const probe = await mkdtemp(join(tmpdir(), 'glitchpad-pdf-'));
const fixture = resolve('fixtures/pdf/s049-compatibility.pdf');
const original = await readFile(fixture);
await copyFile(fixture, join(probe, 's049-compatibility.pdf'));
await writeFile(join(probe, 'enabled.marker'), 'enabled\n');
await writeFile(join(probe, 'pdf-journey-request.marker'), 'requested\n');
const launchEpoch = Date.now();
const child = spawn(binary, [join(probe, 's049-compatibility.pdf')], {
  env: { ...process.env, GLITCHPAD_LIFECYCLE_PROBE_DIR: probe },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const printProbe = startPdfPrintDialogProbe(child.pid);
let printDialogLog = '';
printProbe.stdout.on('data', (bytes) => {
  printDialogLog = (printDialogLog + bytes).slice(-65536);
});
printProbe.stderr.on('data', (bytes) => {
  printDialogLog = (printDialogLog + bytes).slice(-65536);
});
printProbe.on('error', (error) => {
  printDialogLog += String(error);
});
let stdout = '',
  stderr = '';
child.stdout.on('data', (bytes) => {
  stdout = (stdout + bytes).slice(-131072);
});
child.stderr.on('data', (bytes) => {
  stderr = (stderr + bytes).slice(-131072);
});
child.on('error', (error) => {
  stderr += String(error);
});
try {
  let result;
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    let data = await readFile(
      join(probe, 'pdf-journey-result.json'),
      'utf8',
    ).catch(() => null);
    if (data) {
      result = JSON.parse(data);
      break;
    }
    if (child.exitCode !== null)
      throw new Error('Native PDF process exited ' + child.exitCode);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(result, 'Native PDF journey did not return evidence');
  const observedMemory=result.native_memory;
  assert.ok(observedMemory && observedMemory.samples_bytes.length>=3 && observedMemory.samples_bytes.every(n=>Number.isFinite(n)&&n>0));
  result.process_memory=observedMemory;
  result.execution={run_id:Number(process.env.GITHUB_RUN_ID),run_attempt:Number(process.env.GITHUB_RUN_ATTEMPT),job:process.env.GITHUB_JOB,completion:'pending_validation'};
  result.runtime={os:os.platform()+'/'+os.release(),architecture:os.arch(),webview:result.journey.runtime,engine:result.journey.engine,api:null,minified:false,debuggable:!stagedArtifact};
  result.native_first_page={method:'native_process_launch_to_visible_canvas_and_text_50ms_poll',samples_ms:[result.journey.first_visible_epoch_ms-launchEpoch]};
  assert.ok(Number.isFinite(result.native_first_page.samples_ms[0])&&result.native_first_page.samples_ms[0]>=0);
  result.status="incomplete";
  result.package = packageProof;
  if (packageProof) result.evidence_class = stagedArtifact ? 'staged_release_native_webview' : 'actual_packaged_webview';
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
  assert.equal(result.source_commit, expectedSource);
  assert.equal(result.source_unchanged, true);
  assert.equal(
    result.source_sha256,
    createHash('sha256').update(original).digest('hex'),
  );
  assert.ok(!result.journey.error, result.journey.error);
  assert.equal(result.journey.worker, 'true');
  assert.equal(result.journey.source_identity.native, expectedSource);
  assert.equal(result.journey.source_identity.frontend, expectedSource);
  assert.ok(result.journey.runtime.length > 0);
  for (const key of [
    'outline_named_destination',
    'search',
    'thumbnail',
    'internal_link',
    'external_link_disclosure',
    'rotation',
    'go_to_page',
    'keyboard',
    'metadata',
    'embedded_font_text',
  ])
    assert.equal(result.journey.checks[key], true, key);
  assert.ok(result.journey.checks.canvas_ink > 500);
  assert.equal(result.journey.prints.length, 2);
  assert.deepEqual(
    result.journey.prints.map((item) => item.snapshot.pages),
    [2, 4],
  );
  assert.ok(
    result.journey.prints.every(
      (item) => item.completed && item.cleaned && !item.paper_completion,
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, 200));
  const observedDialogs =
    process.platform === 'darwin'
      ? (printDialogLog.match(/NATIVE_PRINT_CANCEL/g) || []).length
      : (printDialogLog.match(/"observed_native_dialog"\s*:\s*true/g) || [])
          .length;
  assert.equal(
    observedDialogs,
    2,
    'Both actual native print dialogs must be observed and cancelled',
  );
  assert.deepEqual(
    await readFile(join(probe, 's049-compatibility.pdf')),
    original,
  );
  result.status='pass';
  result.execution.completion='clean';
  await writeFile(join(output,'result.json'),JSON.stringify(result,null,2)+'\n','utf8');
  if(stagedProfile)await writeFile(join(output,'conformance-record.json'),JSON.stringify(nativePdfConformanceRecord(result,stagedProfile),null,2)+'\n','utf8');
  console.log(
    'Actual native PDF reading journey passed on ' + process.platform,
  );
} finally {
  if (printProbe.exitCode === null) printProbe.kill();
  await writeFile(join(output, 'native-print-dialogs.log'), printDialogLog);
  if (child.exitCode === null) child.kill();
  await writeFile(join(output, 'stdout.log'), stdout);
  await writeFile(join(output, 'stderr.log'), stderr);
}
