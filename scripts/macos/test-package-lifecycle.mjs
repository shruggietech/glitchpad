import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
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
  validateMacosLifecycleEvidence,
} from '../check-macos-package.mjs';
import { createStartupJournal, sampleStartup } from './startup-sampler.mjs';
import { runPackagedDocumentWorkflow } from '../lib/package-document-workflow.mjs';

import {
  collectApplicationInventory,
  digestApplicationInventory,
} from '../lib/macos-artifact.mjs';

const execFileAsync = promisify(execFile);
const processPattern = (value) =>
  [...value]
    .map((c) =>
      '.^$*+?()[]{}|'.includes(c) || c.charCodeAt(0) === 92
        ? String.fromCharCode(92) + c
        : c,
    )
    .join('');
const deliveryProbePattern = /^delivery-[1-9]\d*\.marker$/u;
const delay = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

export const lifecycleProbeArgument = (probeRoot) =>
  `--glitchpad-lifecycle-probe=${probeRoot}`;

export const initialLaunchArguments = (
  installedApplication,
  fixture,
  probeRoot,
) => [
  '-n',
  installedApplication,
  '--args',
  lifecycleProbeArgument(probeRoot),
  fixture,
];

export function parseArguments(arguments_) {
  const result = { official: false };
  const names = new Map([
    ['--dmg', 'dmg'],
    ['--manifest', 'manifest'],
    ['--receipt', 'receipt'],
    ['--architecture', 'architecture'],
  ]);
  for (let index = 0; index < arguments_.length; index += 1) {
    if (arguments_[index] === '--official') {
      result.official = true;
      continue;
    }
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

export function classifyStartupSamples(
  samples,
  hostedSmokeHardLimitMilliseconds = 10_000,
) {
  if (
    !Array.isArray(samples) ||
    samples.length < 5 ||
    samples.some((value) => !Number.isFinite(value) || value < 0)
  )
    throw new Error('startup_sample_count');
  const ordered = [...samples].sort((left, right) => left - right);
  const p95 = ordered[Math.ceil(ordered.length * 0.95) - 1];
  if (p95 > hostedSmokeHardLimitMilliseconds)
    throw new Error('startup_smoke_hard_limit');
  const classification =
    p95 <= 1500 ? 'pass' : p95 <= 2500 ? 'warning' : 'failure';
  return { p95, classification };
}

export async function command(program, arguments_, options = {}) {
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

export async function waitForProcess(executable, timeoutMilliseconds = 30_000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMilliseconds) {
    try {
      const { stdout } = await command('pgrep', [
        '-f',
        processPattern(executable),
      ]);
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

export async function stopProcess(pid) {
  const alive = () => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      if (error.code === 'ESRCH') return false;
      throw error;
    }
  };
  if (!alive()) return;
  try {
    process.kill(pid, 'SIGTERM');
  } catch (error) {
    if (error.code === 'ESRCH') return;
    throw error;
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!alive()) return;
    await delay(50);
  }
  if (alive()) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (error) {
      if (error.code === 'ESRCH') return;
      throw error;
    }
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!alive()) return;
    await delay(50);
  }
  throw new Error('application_cleanup_failed');
}

async function cleanupApplication(executable, ownedPid) {
  if (ownedPid) await stopProcess(ownedPid);
  // The random private application root identifies only this harness instance.
  let stdout;
  try {
    ({ stdout } = await command('pgrep', ['-f', processPattern(executable)]));
  } catch (error) {
    if (error.message === 'native_command_failed:pgrep:1') return;
    throw error;
  }
  for (const value of stdout.trim().split(/\s+/u)) {
    const pid = Number(value);
    if (Number.isSafeInteger(pid) && pid > 0) await stopProcess(pid);
  }
}

export async function measureStartup({
  installedApplication,
  fixture,
  probeRoot,
  executable,
  identity = 'candidate',
  index,
  sequence = index,
  persist,
  onReady = async () => {},
}) {
  await clearLifecycleProbes(probeRoot);
  let pid = null;
  let deliveries;
  return sampleStartup({
    identity,
    index,
    sequence,
    persist,
    hooks: {
      launch: () =>
        command(
          'open',
          initialLaunchArguments(installedApplication, fixture, probeRoot),
          { timeout: 30000 },
        ),
      discover: async () => {
        pid = (await waitForProcess(executable)).pid;
        return pid;
      },
      shell: () => waitForShellReadiness(probeRoot),
      document: async () => {
        deliveries = await waitForLifecycleReadiness(probeRoot);
      },
      verify: async () => {
        await delay(500);
        const settled = await deliveryProbes(probeRoot);
        if (settled.size !== 1 || [...settled][0] !== [...deliveries][0])
          throw new Error('delivery_acknowledgement_duplicate');
        await onReady({ pid, deliveries });
      },
      cleanup: (ownedPid) => cleanupApplication(executable, ownedPid),
    },
  });
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
  validateMacosLifecycleEvidence(manifest, contract, {
    official: options.official,
  });
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
    const journal = await createStartupJournal(receiptPath + '.startup.json', {
      evidence_class: 'hosted_smoke',
      endpoint: 'launch_request_to_shell_ready',
      architecture: options.architecture,
      source_commit: manifest.source_commit,
      candidate_manifest_sha256: createHash('sha256')
        .update(manifestBytes)
        .digest('hex'),
    });
    for (let sample = 0; sample < 5; sample += 1) {
      const attempt = await measureStartup({
        installedApplication,
        fixture,
        probeRoot,
        executable,
        index: sample,
        persist: journal.persist,
        onReady: async ({ pid, deliveries: acknowledgedDeliveries }) => {
          if (sample !== 0) return;
          await command('open', ['-a', installedApplication, fixture]);
          const delivered = await waitForSingleNewDelivery(
            probeRoot,
            acknowledgedDeliveries,
          );
          await delay(500);
          const settled = await deliveryProbes(probeRoot);
          const added = [...settled].filter(
            (name) => !acknowledgedDeliveries.has(name),
          );
          if (added.length !== 1 || settled.size !== delivered.size)
            throw new Error('delivery_acknowledgement_duplicate');
          process.kill(pid, 0);
        },
      });
      startupSamples.push(attempt.shell_ready_ms);
      await delay(250);
    }
    const roundedStartupSamples = startupSamples.map((value) =>
      Math.round(value),
    );
    const startup = classifyStartupSamples(
      roundedStartupSamples,
      contract.performance.hosted_smoke_startup_hard_limit_ms,
    );
    if (
      createHash('sha256')
        .update(await readFile(fixture))
        .digest('hex') !==
      createHash('sha256').update(fixtureBytes).digest('hex')
    )
      throw new Error('fixture_document_modified');
    const documentWorkflow = await runPackagedDocumentWorkflow({
      root,
      originalFixture: fixture,
      originalBytes: fixtureBytes,
      launch: async (workflowRoot) => {
        await command(
          'open',
          [
            '-n',
            installedApplication,
            '--args',
            lifecycleProbeArgument(workflowRoot),
          ],
          { timeout: 30000 },
        );
        return (await waitForProcess(executable)).pid;
      },
      stop: (pid) => cleanupApplication(executable, pid),
    });
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
    const pdfProfile = 'macos_' + options.architecture;
    const pdfOutput = join(receiptPath, '..', 'pdf-native-' + pdfProfile);
    const pdfResult = await command(
      process.execPath,
      [
        'scripts/run-pdf-native-journey.mjs',
        executable,
        '--artifact',
        dmgPath,
        '--manifest',
        manifestPath,
        '--profile',
        pdfProfile,
        '--output',
        pdfOutput,
      ],
      { timeout: 300000 },
    );
    await writeFile(
      pdfOutput + '-runner.log',
      pdfResult.stdout + pdfResult.stderr,
      'utf8',
    );
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
      document_workflow: documentWorkflow,
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
        ].map((key) => [
          key,
          key === 'performance' ? 'measured_hosted_smoke' : 'pass',
        ]),
      ),
      manual,
      performance: {
        cold_startup_evidence_class: 'hosted_smoke',
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
    if (mounted)
      await command('hdiutil', ['detach', mountPoint, '-force']).catch(
        () => undefined,
      );
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
