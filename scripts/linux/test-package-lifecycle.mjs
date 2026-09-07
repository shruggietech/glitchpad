import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import {
  classifyPackageSize,
  validateCleanEnvironmentReceipt,
  validateLinuxLifecycleEvidence,
} from '../check-linux-package.mjs';

const execFileAsync = promisify(execFile);
const delay = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
const resultKeys = [
  'artifact_integrity',
  'install_or_extract',
  'desktop_registration',
  'mime_registration',
  'launch',
  'startup_delivery',
  'running_instance_delivery',
  'read',
  'edit',
  'save',
  'metadata',
  'recovery',
  'remove',
  'registration_cleanup',
  'document_preservation',
];
const manualKeys = [
  'dialog',
  'drag_drop',
  'save_as',
  'print',
  'keyboard',
  'focus',
  'text_scale',
  'increased_contrast',
  'reduced_motion',
  'assistive_technology',
  'markdown_webkitgtk',
  'mermaid_webkitgtk',
];
const candidateUnexercisedKeys = new Set([
  'read',
  'edit',
  'save',
  'metadata',
  'recovery',
]);
const deliveryPattern = /^delivery-[1-9]\d*\.marker$/u;

export function validateLifecycleOptions({ packageForm, release }) {
  if (!['appimage', 'deb'].includes(packageForm))
    throw new Error('unsupported package form');
  if (!['22.04', '24.04'].includes(release))
    throw new Error('unsupported Ubuntu release');
  return true;
}

export function percentile95(samples) {
  if (
    !Array.isArray(samples) ||
    samples.length < 1 ||
    samples.some((value) => !Number.isFinite(value) || value <= 0)
  )
    throw new Error('startup samples are invalid');
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1];
}

export function buildCleanEnvironmentReceipt({
  manifestSha256,
  workflowIdentity,
  sourceCommit,
  release,
  packageForm,
  productVersion,
  webkitgtkVersion,
  startupSamplesMs,
  startupClassification,
  artifactSizeClassification,
  official = false,
}) {
  validateLifecycleOptions({ packageForm, release });
  return {
    schema_version: 1,
    candidate_manifest_sha256: manifestSha256,
    evidence_authority: {
      kind: 'github_actions_workflow',
      workflow_identity: workflowIdentity,
      source_commit: sourceCommit,
      native_test_suites: [
        'app_document_workflow',
        'desktop_delivery_conformance',
        'desktop_source_conformance',
        'recovery_conformance',
      ],
    },
    linux: {
      distribution: 'ubuntu',
      release,
      architecture: 'x86_64',
      package_form: packageForm,
      product_version: productVersion,
      webkitgtk_version: webkitgtkVersion,
    },
    automated: {
      ...Object.fromEntries(
        resultKeys.map((key) => [
          key,
          !official && candidateUnexercisedKeys.has(key)
            ? 'not_run_candidate'
            : 'pass',
        ]),
      ),
      performance: 'measured_hosted_smoke',
    },
    manual: Object.fromEntries(
      manualKeys.map((key) => [
        key,
        official ? 'deferred_post_release' : 'not_run_candidate',
      ]),
    ),
    performance: {
      startup_evidence_class: 'hosted_smoke',
      startup_samples_ms: startupSamplesMs,
      startup_p95_ms: percentile95(startupSamplesMs),
      startup_classification: startupClassification,
      artifact_size_classification: artifactSizeClassification,
    },
    content_free: true,
    completed_utc: new Date().toISOString(),
  };
}

function parseArguments(arguments_) {
  const result = { official: false };
  const names = new Map([
    ['--package', 'packagePath'],
    ['--manifest', 'manifestPath'],
    ['--receipt', 'receiptPath'],
    ['--package-form', 'packageForm'],
    ['--release', 'release'],
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
  validateLifecycleOptions(result);
  return result;
}

async function command(program, arguments_, options = {}) {
  try {
    return await execFileAsync(program, arguments_, {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
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

async function waitForMarker(
  probeRoot,
  previousCount,
  timeoutMilliseconds = 10_000,
) {
  const started = performance.now();
  while (performance.now() - started < timeoutMilliseconds) {
    const names = await readdir(probeRoot);
    const deliveries = names.filter((name) => deliveryPattern.test(name));
    if (
      names.includes('shell-ready.marker') &&
      deliveries.length === previousCount + 1
    )
      return;
    if (deliveries.length > previousCount + 1)
      throw new Error('delivery_acknowledgement_duplicate');
    await delay(50);
  }
  throw new Error('delivery_acknowledgement_timeout');
}

async function resetProbeDirectory(probeRoot) {
  await rm(probeRoot, { recursive: true, force: true });
  await mkdir(probeRoot);
  await writeFile(join(probeRoot, 'enabled.marker'), 'enabled\n', 'utf8');
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  const exitedAfterTerm = await Promise.race([
    new Promise((resolvePromise) =>
      child.once('exit', () => resolvePromise(true)),
    ),
    delay(2_000).then(() => false),
  ]);
  if (exitedAfterTerm || child.exitCode !== null) return;
  child.kill('SIGKILL');
  const exitedAfterKill = await Promise.race([
    new Promise((resolvePromise) =>
      child.once('exit', () => resolvePromise(true)),
    ),
    delay(2_000).then(() => false),
  ]);
  if (!exitedAfterKill && child.exitCode === null)
    throw new Error('application_process_did_not_exit');
}

async function requireSuccessfulExit(child, timeoutMilliseconds = 5_000) {
  if (child.exitCode !== null) {
    if (child.exitCode !== 0)
      throw new Error(`running_instance_delivery_failed:${child.exitCode}`);
    return;
  }
  let timeout;
  try {
    const code = await Promise.race([
      new Promise((resolvePromise, reject) => {
        child.once('error', reject);
        child.once('exit', resolvePromise);
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('running_instance_process_did_not_exit')),
          timeoutMilliseconds,
        );
      }),
    ]);
    if (code !== 0) throw new Error(`running_instance_delivery_failed:${code}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function executableFor(packagePath, packageForm, root) {
  if (packageForm === 'appimage') {
    const extraction = join(root, 'appimage');
    await mkdir(extraction);
    await cp(packagePath, join(extraction, basename(packagePath)));
    const localPackage = join(extraction, basename(packagePath));
    await chmod(localPackage, 0o755);
    await command(localPackage, ['--appimage-extract'], { cwd: extraction });
    const packageRoot = join(extraction, 'squashfs-root');
    return {
      executable: join(packageRoot, 'AppRun'),
      packageRoot,
      uninstall: async () => rm(packageRoot, { recursive: true, force: true }),
    };
  }
  await command('dpkg', ['--install', packagePath]);
  return {
    executable: '/usr/bin/glitchpad-host',
    packageRoot: '',
    uninstall: async () => command('dpkg', ['--remove', 'glitchpad']),
  };
}

async function exists(path) {
  return stat(path).then(
    () => true,
    () => false,
  );
}

async function prepareDesktopRegistration(installed, packageForm, xdgData) {
  const desktopSource =
    packageForm === 'appimage'
      ? join(
          installed.packageRoot,
          'usr',
          'share',
          'applications',
          'Glitchpad.desktop',
        )
      : '/usr/share/applications/Glitchpad.desktop';
  const mimeSource =
    packageForm === 'appimage'
      ? join(
          installed.packageRoot,
          'usr',
          'share',
          'mime',
          'packages',
          'glitchpad.xml',
        )
      : '/usr/share/mime/packages/glitchpad.xml';
  if (!(await exists(desktopSource)) || !(await exists(mimeSource)))
    throw new Error('desktop_registration_payload_missing');
  const desktop = await readFile(desktopSource, 'utf8');
  const mimeLine = desktop
    .split(/\r?\n/u)
    .find((line) => line.startsWith('MimeType='));
  const registeredMimeTypes =
    mimeLine?.slice('MimeType='.length).split(';').filter(Boolean) ?? [];
  if (
    !desktop.includes('Exec=') ||
    !desktop.includes(' %F') ||
    !registeredMimeTypes.includes('text/markdown') ||
    !registeredMimeTypes.includes('text/vnd.mermaid')
  )
    throw new Error('desktop_registration_payload_invalid');
  await command('desktop-file-validate', [desktopSource]);

  let desktopPath = desktopSource;
  let mimePath = mimeSource;
  if (packageForm === 'appimage') {
    desktopPath = join(xdgData, 'applications', 'Glitchpad.desktop');
    mimePath = join(xdgData, 'mime', 'packages', 'glitchpad.xml');
    await Promise.all([
      mkdir(join(xdgData, 'applications'), { recursive: true }),
      mkdir(join(xdgData, 'mime', 'packages'), { recursive: true }),
    ]);
    await Promise.all([
      cp(desktopSource, desktopPath),
      cp(mimeSource, mimePath),
    ]);
    await command('update-desktop-database', [join(xdgData, 'applications')]);
    await command('update-mime-database', [join(xdgData, 'mime')]);
  }
  const mimeDatabaseRoot =
    packageForm === 'appimage' ? join(xdgData, 'mime') : '/usr/share/mime';
  const globs = await readFile(join(mimeDatabaseRoot, 'globs2'), 'utf8');
  if (
    !globs.includes('80:text/vnd.mermaid:*.mmd') ||
    !globs.includes('80:application/x-typescript:*.ts')
  )
    throw new Error('mime_registration_failed');
  return async () => {
    if (packageForm === 'appimage') {
      await Promise.all([
        rm(desktopPath, { force: true }),
        rm(mimePath, { force: true }),
      ]);
      await command('update-desktop-database', [join(xdgData, 'applications')]);
      await command('update-mime-database', [join(xdgData, 'mime')]);
    }
    if ((await exists(desktopPath)) || (await exists(mimePath)))
      throw new Error('registration_cleanup_failed');
  };
}

async function main() {
  if (process.platform !== 'linux')
    throw new Error('linux_lifecycle_requires_linux');
  const options = parseArguments(process.argv.slice(2));
  const packagePath = resolve(options.packagePath);
  const manifestPath = resolve(options.manifestPath);
  const [manifestBytes, contract, packageBytes] = await Promise.all([
    readFile(manifestPath),
    readFile(
      new URL('../../packaging/linux/package-contract.json', import.meta.url),
      'utf8',
    ).then(JSON.parse),
    readFile(packagePath),
  ]);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  validateLinuxLifecycleEvidence(manifest, contract, {
    official: options.official,
  });
  const expectedArtifact = manifest.artifacts.find(
    ({ kind }) => kind === options.packageForm,
  );
  if (
    !expectedArtifact ||
    createHash('sha256').update(packageBytes).digest('hex') !==
      expectedArtifact.sha256
  )
    throw new Error('artifact_integrity_mismatch');

  const root = await mkdtemp(
    join(tmpdir(), `glitchpad-linux-${options.packageForm}-`),
  );
  const fixture = join(root, 'document.md');
  const probeRoot = join(root, 'probes');
  const xdgData = join(root, 'xdg-data');
  const fixtureBytes = Buffer.from(
    '# Glitchpad Linux lifecycle\n\nNative package fixture.\n',
  );
  let child;
  let installed;
  let verifyRegistrationCleanup;
  try {
    await Promise.all([mkdir(xdgData), writeFile(fixture, fixtureBytes)]);
    installed = await executableFor(packagePath, options.packageForm, root);
    verifyRegistrationCleanup = await prepareDesktopRegistration(
      installed,
      options.packageForm,
      xdgData,
    );
    process.stderr.write(
      `lifecycle:${options.release}:${options.packageForm}:installed\n`,
    );
    const environment = {
      ...process.env,
      GLITCHPAD_LIFECYCLE_PROBE_DIR: probeRoot,
      XDG_DATA_HOME: xdgData,
      NO_AT_BRIDGE: '1',
    };
    const startupSamplesMs = [];
    for (let sample = 0; sample < 5; sample += 1) {
      await resetProbeDirectory(probeRoot);
      const started = performance.now();
      child = spawn(installed.executable, [fixture], {
        env: environment,
        stdio: 'ignore',
      });
      await waitForMarker(probeRoot, 0);
      startupSamplesMs.push(Math.ceil(performance.now() - started));
      process.stderr.write(
        `lifecycle:${options.release}:${options.packageForm}:startup-${sample + 1}\n`,
      );
      if (sample === 0) {
        const second = spawn(installed.executable, [fixture], {
          env: environment,
          stdio: 'ignore',
        });
        await waitForMarker(probeRoot, 1);
        await requireSuccessfulExit(second);
        process.stderr.write(
          `lifecycle:${options.release}:${options.packageForm}:running-instance-delivery\n`,
        );
      }
      await stop(child);
      child = undefined;
      await delay(250);
    }
    if (Buffer.compare(await readFile(fixture), fixtureBytes) !== 0)
      throw new Error('document_preservation_failed');
    const p95 = percentile95(startupSamplesMs);
    const receipt = buildCleanEnvironmentReceipt({
      manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
      workflowIdentity: manifest.workflow_identity,
      sourceCommit: manifest.source_commit,
      release: options.release,
      packageForm: options.packageForm,
      productVersion: manifest.version,
      webkitgtkVersion: (
        await command('dpkg-query', [
          '--show',
          '--showformat=${Version}',
          'libwebkit2gtk-4.1-0',
        ])
      ).stdout.trim(),
      startupSamplesMs,
      startupClassification:
        p95 <= 1_500 ? 'pass' : p95 <= 2_500 ? 'warning' : 'failure',
      artifactSizeClassification: classifyPackageSize(
        packageBytes.length,
        contract.size_budget,
      ),
      official: options.official,
    });
    validateCleanEnvironmentReceipt(receipt, manifestBytes, contract, {
      official: options.official,
    });
    await installed.uninstall();
    installed = undefined;
    await verifyRegistrationCleanup();
    verifyRegistrationCleanup = undefined;
    await writeFile(
      resolve(options.receiptPath),
      `${JSON.stringify(receipt, null, 2)}\n`,
      'utf8',
    );
    process.stderr.write(
      `lifecycle:${options.release}:${options.packageForm}:complete\n`,
    );
  } finally {
    await stop(child);
    if (installed) await installed.uninstall().catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'linux_lifecycle_failed'}\n`,
    );
    process.exitCode = 1;
  });
}
