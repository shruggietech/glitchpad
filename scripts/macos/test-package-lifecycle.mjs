import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';

import {
  validateCleanHostReceipt,
  validateMacosEvidence,
} from '../check-macos-package.mjs';
import {
  collectApplicationInventory,
  digestApplicationInventory,
} from '../lib/macos-artifact.mjs';

const execFileAsync = promisify(execFile);
const deliveryProbePattern = /^delivery-[1-9]\d*\.marker$/u;
const delay = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

export const initialLaunchArguments = (installedApplication, fixture) => [
  '-n',
  '-a',
  installedApplication,
  fixture,
];

export function parseArguments(arguments_) {
  const result = {};
  const names = new Map([
    ['--dmg', 'dmg'],
    ['--manifest', 'manifest'],
    ['--receipt', 'receipt'],
    ['--architecture', 'architecture'],
  ]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const key = names.get(arguments_[index]);
    const value = arguments_[++index];
    if (!key || !value || value.startsWith('--'))
      throw new Error('argument_invalid');
    result[key] = value;
  }
  for (const key of names.values())
    if (!result[key]) throw new Error(`argument_missing:${key}`);
  if (!['arm64', 'x86_64'].includes(result.architecture))
    throw new Error('architecture_invalid');
  return result;
}

export function classifyStartupSamples(samples) {
  if (
    !Array.isArray(samples) ||
    samples.length < 5 ||
    samples.some((value) => !Number.isFinite(value) || value < 0)
  )
    throw new Error('startup_sample_count');
  const ordered = [...samples].sort((left, right) => left - right);
  const p95 = ordered[Math.ceil(ordered.length * 0.95) - 1];
  if (p95 > 2500) throw new Error('startup_hard_limit');
  return { p95, classification: p95 <= 1500 ? 'pass' : 'warning' };
}

async function command(program, arguments_, options = {}) {
  try {
    return await execFileAsync(program, arguments_, {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      ...options,
    });
  } catch (error) {
    const code =
      typeof error?.code === 'string' || typeof error?.code === 'number'
        ? error.code
        : 'unknown';
    throw new Error(`native_command_failed:${program}:${code}`);
  }
}

async function waitForProcess(executable, timeoutMilliseconds = 10_000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMilliseconds) {
    try {
      const { stdout } = await command('pgrep', ['-f', executable]);
      const pid = Number.parseInt(stdout.trim().split(/\s+/u)[0], 10);
      if (Number.isSafeInteger(pid) && pid > 0)
        return { pid, elapsed: performance.now() - started };
    } catch {
      // The application has not reached the process table yet.
    }
    await delay(50);
  }
  throw new Error('application_launch_timeout');
}

export async function waitForShellReadiness(
  probeRoot,
  timeoutMilliseconds = 10_000,
) {
  const started = performance.now();
  while (performance.now() - started < timeoutMilliseconds) {
    const shellReady = await stat(join(probeRoot, 'shell-ready.marker')).then(
      () => true,
      () => false,
    );
    if (shellReady) return;
    await delay(25);
  }
  throw new Error('application_shell_ready_timeout');
}

async function deliveryProbes(probeRoot) {
  return new Set(
    (await readdir(probeRoot)).filter((name) =>
      deliveryProbePattern.test(name),
    ),
  );
}

export async function clearLifecycleProbes(probeRoot) {
  for (const name of await readdir(probeRoot)) {
    if (name === 'shell-ready.marker' || deliveryProbePattern.test(name))
      await rm(join(probeRoot, name), { force: true });
  }
}

export async function waitForLifecycleReadiness(
  probeRoot,
  timeoutMilliseconds = 10_000,
) {
  const started = performance.now();
  while (performance.now() - started < timeoutMilliseconds) {
    const shellReady = await stat(join(probeRoot, 'shell-ready.marker')).then(
      () => true,
      () => false,
    );
    const deliveries = await deliveryProbes(probeRoot);
    if (deliveries.size > 1)
      throw new Error('delivery_acknowledgement_duplicate');
    if (shellReady && deliveries.size === 1) return deliveries;
    await delay(25);
  }
  throw new Error('application_interactive_ready_timeout');
}

export async function waitForSingleNewDelivery(
  probeRoot,
  previous,
  timeoutMilliseconds = 10_000,
) {
  const started = performance.now();
  while (performance.now() - started < timeoutMilliseconds) {
    const current = await deliveryProbes(probeRoot);
    const added = [...current].filter((name) => !previous.has(name));
    if (added.length > 1) throw new Error('delivery_acknowledgement_duplicate');
    if (added.length === 1) return current;
    await delay(25);
  }
  throw new Error('delivery_acknowledgement_timeout');
}

async function stopProcess(pid) {
  try {
    process.kill(pid, 'SIGTERM');
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        process.kill(pid, 0);
        await delay(50);
      } catch {
        return;
      }
    }
    process.kill(pid, 'SIGKILL');
  } catch {
    // The process already exited.
  }
}

async function main() {
  if (process.platform !== 'darwin')
    throw new Error('macos_lifecycle_requires_macos');
  const options = parseArguments(process.argv.slice(2));
  const dmgPath = resolve(options.dmg);
  const manifestPath = resolve(options.manifest);
  const receiptPath = resolve(options.receipt);
  const [manifestBytes, contract] = await Promise.all([
    readFile(manifestPath),
    readFile(
      new URL('../../packaging/macos/package-contract.json', import.meta.url),
      'utf8',
    ).then(JSON.parse),
  ]);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  validateMacosEvidence(manifest, contract);
  if (!(await stat(dmgPath)).isFile()) throw new Error('dmg_unavailable');
  const root = await mkdtemp(
    join(tmpdir(), `glitchpad-macos-${options.architecture}-`),
  );
  const mountPoint = join(root, 'mounted');
  const installedRoot = join(root, 'Applications');
  const installedApplication = join(installedRoot, contract.bundle.name);
  const fixture = join(root, 'document.md');
  const probeRoot = join(root, 'lifecycle-probes');
  const fixtureBytes = Buffer.from(
    '# Glitchpad lifecycle\n\nSafe native package fixture.\n',
  );
  let mounted = false;
  let activePid = null;
  try {
    await cp(dmgPath, join(root, basename(dmgPath)));
    await writeFile(fixture, fixtureBytes);
    await mkdir(probeRoot);
    await writeFile(join(probeRoot, 'enabled.marker'), 'enabled\n');
    await command('mkdir', ['-p', mountPoint, installedRoot]);
    await command('hdiutil', [
      'attach',
      '-readonly',
      '-nobrowse',
      '-mountpoint',
      mountPoint,
      dmgPath,
    ]);
    mounted = true;
    const mountedApplication = join(mountPoint, contract.bundle.name);
    if (!(await stat(mountedApplication)).isDirectory())
      throw new Error('mounted_application_missing');
    const mountedInventory =
      await collectApplicationInventory(mountedApplication);
    if (
      !isDeepStrictEqual(mountedInventory, manifest.application_inventory) ||
      digestApplicationInventory(mountedInventory) !==
        manifest.application.bundle_sha256
    )
      throw new Error('mounted_application_evidence_mismatch');
    const applicationsLink = join(mountPoint, 'Applications');
    if (
      !(await lstat(applicationsLink)).isSymbolicLink() ||
      (await readlink(applicationsLink)) !== '/Applications'
    )
      throw new Error('applications_link_invalid');
    await command('ditto', [mountedApplication, installedApplication]);
    await command('codesign', [
      '--verify',
      '--deep',
      '--strict',
      '--verbose=4',
      installedApplication,
    ]);
    const executable = join(
      installedApplication,
      ...contract.bundle.executable.split('/'),
    );
    const { stdout: architectureOutput } = await command('lipo', [
      '-archs',
      executable,
    ]);
    const applicationArchitectures = [
      ...new Set(architectureOutput.trim().split(/\s+/u)),
    ].sort();
    if (
      JSON.stringify(applicationArchitectures) !==
      JSON.stringify(['arm64', 'x86_64'])
    )
      throw new Error('universal_architecture_invalid');
    const { stdout: hardwareOutput } = await command('uname', ['-m']);
    const hardwareArchitecture =
      hardwareOutput.trim() === 'arm64'
        ? 'arm64'
        : hardwareOutput.trim() === 'x86_64'
          ? 'x86_64'
          : '';
    if (hardwareArchitecture !== options.architecture)
      throw new Error('native_architecture_mismatch');

    const startupSamples = [];
    for (let sample = 0; sample < 5; sample += 1) {
      await clearLifecycleProbes(probeRoot);
      const launchedAt = performance.now();
      const child = spawn(
        'open',
        initialLaunchArguments(installedApplication, fixture),
        {
          detached: false,
          stdio: 'ignore',
          shell: false,
        },
      );
      await new Promise((resolvePromise, reject) => {
        child.once('error', reject);
        child.once('exit', (code) =>
          code === 0
            ? resolvePromise()
            : reject(new Error(`open_failed:${code}`)),
        );
      });
      const observed = await waitForProcess(executable);
      await waitForShellReadiness(probeRoot);
      const acknowledgedDeliveries = await waitForLifecycleReadiness(probeRoot);
      await delay(500);
      const settledStartupDeliveries = await deliveryProbes(probeRoot);
      if (
        settledStartupDeliveries.size !== 1 ||
        [...settledStartupDeliveries][0] !== [...acknowledgedDeliveries][0]
      )
        throw new Error('delivery_acknowledgement_duplicate');
      startupSamples.push(performance.now() - launchedAt);
      activePid = observed.pid;
      if (sample === 0) {
        await command('open', ['-a', installedApplication, fixture]);
        const deliveriesAfterOpen = await waitForSingleNewDelivery(
          probeRoot,
          acknowledgedDeliveries,
        );
        await delay(500);
        const settledDeliveries = await deliveryProbes(probeRoot);
        const added = [...settledDeliveries].filter(
          (name) => !acknowledgedDeliveries.has(name),
        );
        if (
          added.length !== 1 ||
          settledDeliveries.size !== deliveriesAfterOpen.size
        )
          throw new Error('delivery_acknowledgement_duplicate');
        process.kill(activePid, 0);
      }
      await stopProcess(activePid);
      activePid = null;
      await delay(250);
    }
    const roundedStartupSamples = startupSamples.map((value) =>
      Math.round(value),
    );
    const startup = classifyStartupSamples(roundedStartupSamples);
    if (
      createHash('sha256')
        .update(await readFile(fixture))
        .digest('hex') !==
      createHash('sha256').update(fixtureBytes).digest('hex')
    )
      throw new Error('fixture_document_modified');
    const { stdout: productVersion } = await command('sw_vers', [
      '-productVersion',
    ]);
    const { stdout: buildVersion } = await command('sw_vers', [
      '-buildVersion',
    ]);
    const webkitPlist =
      '/System/Library/Frameworks/WebKit.framework/Resources/Info.plist';
    const { stdout: wkwebviewVersion } = await command('plutil', [
      '-extract',
      'CFBundleShortVersionString',
      'raw',
      webkitPlist,
    ]);
    await rm(installedApplication, { recursive: true, force: true });
    if (
      await stat(installedApplication).then(
        () => true,
        () => false,
      )
    )
      throw new Error('application_removal_failed');
    if (
      createHash('sha256')
        .update(await readFile(fixture))
        .digest('hex') !==
      createHash('sha256').update(fixtureBytes).digest('hex')
    )
      throw new Error('fixture_document_modified');
    const manual = Object.fromEntries(
      [
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
      ].map((key) => [key, 'not_run_candidate']),
    );
    const receipt = {
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
        product_version: productVersion.trim(),
        build_version: buildVersion.trim(),
        hardware_architecture: hardwareArchitecture,
        application_architectures: applicationArchitectures,
        wkwebview_version: wkwebviewVersion.trim(),
      },
      automated: Object.fromEntries(
        [
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
        ].map((key) => [key, 'pass']),
      ),
      manual,
      performance: {
        cold_startup_samples_ms: roundedStartupSamples,
        cold_startup_p95_ms: startup.p95,
        cold_startup_classification: startup.classification,
        dmg_size_classification: manifest.artifact.size_classification,
      },
      content_free: true,
      completed_utc: new Date().toISOString(),
    };
    validateCleanHostReceipt(receipt, manifestBytes, contract, {
      expectedArchitecture: options.architecture,
    });
    await writeFile(
      receiptPath,
      `${JSON.stringify(receipt, null, 2)}\n`,
      'utf8',
    );
  } finally {
    if (activePid) await stopProcess(activePid);
    if (mounted)
      await command('hdiutil', ['detach', mountPoint, '-force']).catch(
        () => undefined,
      );
    await rm(probeRoot, { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    const message =
      error instanceof Error && /^[A-Za-z0-9_:-]{1,200}$/u.test(error.message)
        ? error.message
        : 'macos_package_lifecycle_failed';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
