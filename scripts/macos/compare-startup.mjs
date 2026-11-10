import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { validateMacosLifecycleEvidence } from '../check-macos-package.mjs';
import {
  collectApplicationInventory,
  digestApplicationInventory,
} from '../lib/macos-artifact.mjs';
import { command, measureStartup } from './test-package-lifecycle.mjs';
import {
  createStartupJournal,
  pairedOrder,
  summarizeAttempts,
} from './startup-sampler.mjs';

export const baselineIdentity = Object.freeze({
  version: '0.1.4',
  source_commit: '1d7dcd46689fb0ea68e4cee5c3d43a06d94bc94b',
  dmg_sha256:
    '0d116cf8f8d0528e2d84f54adc934a3368f9d221b07935bb8324d2213a8bfcff',
  evidence_sha256:
    '9fe15e6a216789eae5e595e8aa6a4ef41cd4bace286f23b6b84b799e9c3e681a',
});
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function validateBaselineIdentity(manifest) {
  if (
    manifest.version !== baselineIdentity.version ||
    manifest.source_commit !== baselineIdentity.source_commit ||
    manifest.artifact?.sha256 !== baselineIdentity.dmg_sha256
  )
    throw new Error('baseline_identity_mismatch');
}

export async function compareCampaign({
  order,
  packages,
  journal,
  measure = measureStartup,
}) {
  for (const row of order) {
    try {
      await measure({
        ...packages[row.identity],
        ...row,
        persist: journal.persist,
      });
    } catch {
      const last = journal.attempts.find(
        (attempt) => attempt.sequence === row.sequence,
      );
      // Cleanup failure contaminates subsequent launches. Retain the incomplete
      // campaign and stop instead of manufacturing comparable later samples.
      if (!last || last.cleanup !== 'pass') break;
    }
  }
  return Object.fromEntries(
    ['baseline', 'candidate'].map((identity) => {
      const summary = summarizeAttempts(
        journal.attempts.filter((r) => r.identity === identity),
        // The historical control can cold-start slowly on hosted runners.
        // Keep the current candidate's budget and reference classifications.
        identity === 'baseline' ? 30_000 : 10_000,
      );
      summary.planned = order.filter((r) => r.identity === identity).length;
      if (summary.attempted !== summary.planned) {
        summary.campaign = 'failure';
        summary.hosted_smoke = 'failure';
        summary.reference_classification = 'unavailable';
      }
      return [identity, summary];
    }),
  );
}

async function main() {
  if (process.platform !== 'darwin')
    throw new Error('macos_comparison_requires_macos');
  const options = {};
  const allowed = new Set([
    'baseline-root',
    'candidate-root',
    'receipt',
    'architecture',
  ]);
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace(/^--/u, '');
    if (!allowed.has(key) || !process.argv[i + 1])
      throw new Error('argument_invalid');
    options[key] = process.argv[i + 1];
  }
  if (
    [...allowed].some((k) => !options[k]) ||
    !['arm64', 'x86_64'].includes(options.architecture)
  )
    throw new Error('argument_missing');
  const receiptPath = resolve(options.receipt);
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-paired-startup-'));
  const mounted = [];
  try {
    const { stdout: hardware } = await command('uname', ['-m']);
    if (hardware.trim() !== options.architecture)
      throw new Error('native_architecture_mismatch');
    const environment = {};
    for (const [key, program, args] of [
      ['product_version', 'sw_vers', ['-productVersion']],
      ['build_version', 'sw_vers', ['-buildVersion']],
      [
        'webkit_version',
        'plutil',
        [
          '-extract',
          'CFBundleShortVersionString',
          'raw',
          '/System/Library/Frameworks/WebKit.framework/Resources/Info.plist',
        ],
      ],
    ])
      environment[key] = (await command(program, args)).stdout.trim();
    environment.architecture = options.architecture;
    const packages = {};
    const provenance = {};
    for (const identity of ['baseline', 'candidate']) {
      const packageRoot = resolve(options[identity + '-root']);
      const manifestBytes = await readFile(
        join(packageRoot, 'macos-package-manifest.json'),
      );
      const manifest = JSON.parse(manifestBytes);
      const contract = JSON.parse(
        await readFile(
          new URL(
            identity === 'baseline'
              ? '../../fixtures/macos-startup/v0.1.4-package-contract.json'
              : '../../packaging/macos/package-contract.json',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      validateMacosLifecycleEvidence(manifest, contract, {
        official: manifest.official,
      });
      if (identity === 'baseline') validateBaselineIdentity(manifest);
      else if (manifest.source_commit !== process.env.GITHUB_SHA)
        throw new Error('candidate_source_mismatch');
      const dmg = join(packageRoot, contract.artifact.name);
      const bytes = await readFile(dmg);
      if (
        bytes.length !== manifest.artifact.bytes ||
        digest(bytes) !== manifest.artifact.sha256
      )
        throw new Error('package_bytes_mismatch');
      const installRoot = join(root, identity);
      const mountPoint = join(installRoot, 'mounted');
      const installedApplication = join(
        installRoot,
        'Applications',
        contract.bundle.name,
      );
      const fixture = join(installRoot, 'document.md');
      const probeRoot = join(installRoot, 'probes');
      await mkdir(mountPoint, { recursive: true });
      await mkdir(join(installRoot, 'Applications'));
      await mkdir(probeRoot);
      await writeFile(join(probeRoot, 'enabled.marker'), 'enabled\n');
      await writeFile(
        fixture,
        '# Glitchpad lifecycle\n\nSafe native package fixture.\n',
      );
      await command('hdiutil', [
        'attach',
        '-readonly',
        '-nobrowse',
        '-mountpoint',
        mountPoint,
        dmg,
      ]);
      mounted.push(mountPoint);
      await command('ditto', [
        join(mountPoint, contract.bundle.name),
        installedApplication,
      ]);
      await command('codesign', [
        '--verify',
        '--deep',
        '--strict',
        installedApplication,
      ]);
      const inventory = await collectApplicationInventory(installedApplication);
      if (
        !isDeepStrictEqual(inventory, manifest.application_inventory) ||
        digestApplicationInventory(inventory) !==
          manifest.application.bundle_sha256
      )
        throw new Error('application_inventory_mismatch');
      packages[identity] = {
        installedApplication,
        fixture,
        probeRoot,
        executable: join(
          installedApplication,
          ...contract.bundle.executable.split('/'),
        ),
      };
      provenance[identity] = {
        version: manifest.version,
        source_commit: manifest.source_commit,
        dmg_sha256: manifest.artifact.sha256,
        manifest_sha256: digest(manifestBytes),
        application_sha256: manifest.application.bundle_sha256,
      };
    }
    const context = {
      evidence_class: 'hosted_smoke',
      endpoint: 'launch_request_to_shell_ready',
      profile: 'same_runner_shared_profile_no_cache_reset',
      environment,
      packages: provenance,
      sampler_source_commit: process.env.GITHUB_SHA,
      sampler_sha256: digest(
        Buffer.concat(
          await Promise.all(
            [
              'startup-sampler.mjs',
              'test-package-lifecycle.mjs',
              'compare-startup.mjs',
            ].map((f) => readFile(new URL(f, import.meta.url))),
          ),
        ),
      ),
      order: pairedOrder(6),
      content_free: true,
    };
    const journal = await createStartupJournal(receiptPath, context);
    const summaries = await compareCampaign({
      order: context.order,
      packages,
      journal,
    });
    for (const identity of ['baseline', 'candidate']) {
      if (
        digest(await readFile(packages[identity].fixture)) !==
        digest(
          Buffer.from(
            '# Glitchpad lifecycle\n\nSafe native package fixture.\n',
          ),
        )
      )
        throw new Error('fixture_document_modified');
    }
    await writeFile(
      receiptPath,
      JSON.stringify(
        {
          schema_version: 1,
          ...context,
          attempts: journal.attempts,
          summaries,
          completed_utc: new Date().toISOString(),
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    if (Object.values(summaries).some((r) => r.campaign !== 'pass'))
      throw new Error('startup_comparison_failed');
  } finally {
    for (const mount of mounted.reverse())
      await command('hdiutil', ['detach', mount, '-force']).catch(
        () => undefined,
      );
    await rm(root, { recursive: true, force: true });
  }
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  main().catch((error) => {
    process.stderr.write(
      (/^[a-z_]{1,80}$/u.test(error?.message)
        ? error.message
        : 'startup_comparison_failed') + '\n',
    );
    process.exitCode = 1;
  });
