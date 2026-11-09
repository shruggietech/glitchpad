import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PDF_RELEASE_PROFILES = Object.freeze([
  'windows_installed',
  'windows_portable',
  'macos_arm64',
  'macos_x86_64',
  'ubuntu_22_04_deb',
  'ubuntu_22_04_appimage',
  'ubuntu_24_04_deb',
  'ubuntu_24_04_appimage',
  'android_api24',
  'android_api36',
]);
const sha = (value) => /^[a-f0-9]{64}$/u.test(value ?? '');
const requireValue = (condition, message) => {
  if (!condition) throw Error('PDF conformance: ' + message);
};
function summarize(measurement, name) {
  requireValue(
    typeof measurement?.method === 'string' && measurement.method.length > 0,
    name + ' measurement method missing',
  );
  const raw = measurement.samples_ms ?? measurement.samples_bytes;
  requireValue(
    Array.isArray(raw) &&
      raw.length > 0 &&
      raw.every((n) => Number.isFinite(n) && n >= 0),
    name + ' raw samples missing',
  );
  const sorted = [...raw].sort((a, b) => a - b);
  return {
    ...measurement,
    count: raw.length,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    maximum: sorted.at(-1),
  };
}
function validateRow(row, expected) {
  const profile = row.profile,
    android = profile.startsWith('android');
  const selected = expected.packages?.[profile];
  requireValue(
    row.schema_version === 1 && row.case_id === 'native_pdf_reading_print',
    'case/schema mismatch',
  );
  requireValue(
    row.source_commit === expected.source &&
      /^[a-f0-9]{40}$/u.test(row.source_commit ?? ''),
    'source identity mismatch',
  );
  requireValue(
    sha(expected.fixtureSha) && row.fixture_sha256 === expected.fixtureSha,
    'fixture identity mismatch',
  );
  requireValue(
    sha(selected?.artifactSha) &&
      row.artifact_sha256 === selected.artifactSha &&
      sha(selected.manifestSha) &&
      row.manifest_sha256 === selected.manifestSha,
    'package/manifest identity mismatch',
  );
  requireValue(
    sha(row.installed_sha256),
    'actual installed byte identity missing',
  );
  requireValue(
    row.execution?.completion === 'clean' &&
      Number.isSafeInteger(row.execution.run_id) &&
      row.execution.run_id > 0 &&
      Number.isSafeInteger(row.execution.run_attempt) &&
      row.execution.run_attempt > 0 &&
      typeof row.execution.job === 'string' &&
      row.execution.job.length > 0,
    'actual clean execution identity missing',
  );
  const runtime = row.runtime ?? {};
  for (const key of ['os', 'architecture', 'webview'])
    requireValue(
      typeof runtime[key] === 'string' && runtime[key].length > 0,
      'actual runtime ' + key + ' missing',
    );
  requireValue(runtime.engine === '6.5.438', 'PDF engine mismatch');
  const architecture = profile === 'macos_arm64' ? 'aarch64' : 'x86_64';
  const osPrefix = android
    ? 'Android/API'
    : profile.startsWith('windows')
      ? 'win32/'
      : profile.startsWith('macos')
        ? 'darwin/'
        : 'linux/';
  requireValue(
    runtime.architecture === architecture && runtime.os.startsWith(osPrefix),
    'actual native OS/architecture profile mismatch',
  );
  requireValue(
    runtime.debuggable === false,
    'debuggable evidence cannot qualify staged release profiles',
  );
  if (profile.startsWith('ubuntu_'))
    requireValue(
      runtime.distribution?.id === 'ubuntu' &&
        runtime.distribution.version_id ===
          (profile.startsWith('ubuntu_22_04') ? '22.04' : '24.04'),
      'actual Ubuntu distribution profile mismatch',
    );
  if (android) {
    requireValue(
      runtime.api === (profile === 'android_api24' ? 24 : 36),
      'actual Android API mismatch',
    );
    requireValue(
      runtime.minified === true && runtime.debuggable === false,
      'minified nondebuggable Android evidence required',
    );
    if (runtime.api === 24)
      requireValue(
        /69[.]/u.test(runtime.webview),
        'actual API24 Chrome69 runtime missing',
      );
  }
  for (const key of [
    'worker',
    'selectable_text',
    'reading',
    'native_print',
    'source_unchanged',
    'cache_disposal',
  ])
    requireValue(
      row.checks?.[key] === true,
      'actual native check missing: ' + key,
    );
  const measurements = {};
  for (const name of [
    'first_page',
    'navigation',
    'search',
    'thumbnail',
    'disposal',
    'interaction',
    'memory',
  ])
    measurements[name] = summarize(row.measurements?.[name], name);
  requireValue(
    measurements.disposal.maximum <= 250,
    'cancellation exceeds250ms',
  );
  requireValue(
    typeof measurements.interaction.scope === 'string',
    'synchronous interaction observation scope missing',
  );
  requireValue(
    typeof measurements.memory.process_name === 'string' &&
      measurements.memory.process_name.length > 0 &&
      typeof measurements.memory.scope === 'string' &&
      measurements.memory.scope.length > 0,
    'named process memory measurement missing',
  );
  requireValue(
    row.measurements.worker_heap?.status === 'not_measured' &&
      typeof row.measurements.worker_heap.reason === 'string' &&
      row.measurements.worker_heap.reason.length > 0,
    'unmeasured worker heap must stay explicit',
  );
  const longTasks = row.measurements.long_tasks;
  requireValue(
    typeof longTasks?.supported === 'boolean' &&
      typeof longTasks.method === 'string' &&
      typeof longTasks.scope === 'string',
    'long-task observer scope missing',
  );
  if (longTasks.supported)
    requireValue(
      Array.isArray(longTasks.samples_ms) &&
        longTasks.samples_ms.every((n) => Number.isFinite(n) && n >= 0),
      'observed main-realm reading task samples invalid',
    );
  else
    requireValue(
      longTasks.samples_ms === null,
      'unsupported long-task API must remain explicitly unmeasured',
    );
  const resource = row.measurements.resources;
  requireValue(
    resource &&
      [
        resource.peak_surface_bytes,
        resource.max_range_bytes,
        resource.peak_range_concurrency,
        resource.cache_before_bytes,
        resource.cache_after_bytes,
      ].every((n) => Number.isFinite(n) && n >= 0),
    'actual resource observations missing',
  );
  requireValue(
    resource.surface_limit_bytes === (android ? 96 : 200) * 1024 * 1024 &&
      resource.peak_surface_bytes <= resource.surface_limit_bytes,
    'owned surface budget mismatch',
  );
  requireValue(
    resource.range_limit_bytes === 262144 &&
      resource.max_range_bytes <= 262144 &&
      resource.range_concurrency_limit === 2 &&
      resource.peak_range_concurrency <= 2,
    'bounded source-range budget mismatch',
  );
  requireValue(
    resource.cache_after_bytes === 0,
    'private cache disposal missing',
  );
  return {
    ...row,
    measurements: { ...row.measurements, ...measurements },
    reference_performance: {
      metric: 'repeated_interaction_task',
      reference_limit_ms: 50,
      status: 'not_run_existing_owner_reference_waiver',
      scope:
        'These are hosted observations; no reference-profile budget pass is claimed.',
    },
  };
}
export function validatePdfConformance(records, expected) {
  requireValue(Array.isArray(records), 'record array missing');
  const groups = new Map(PDF_RELEASE_PROFILES.map((p) => [p, []]));
  for (const row of records) {
    requireValue(groups.has(row.profile), 'unexpected profile');
    requireValue(
      Number.isInteger(row.attempt) && row.attempt >= 1 && row.attempt <= 2,
      'unbounded attempt',
    );
    groups.get(row.profile).push(row);
  }
  const selected = [];
  for (const [profile, rows] of groups) {
    rows.sort((a, b) => a.attempt - b.attempt);
    requireValue(rows.length > 0, 'missing required profile ' + profile);
    requireValue(
      new Set(rows.map((r) => r.attempt)).size === rows.length,
      'duplicate profile attempt ' + profile,
    );
    requireValue(
      rows[0].attempt === 1 && rows.every((r, i) => r.attempt === i + 1),
      'noncontiguous bounded attempts ' + profile,
    );
    const latest = rows.at(-1);
    requireValue(
      latest.status === 'pass',
      'latest required attempt failed ' + profile,
    );
    const checked = validateRow(latest, expected);
    selected.push({ ...checked, prior_attempts: rows.slice(0, -1) });
  }
  return {
    schema_version: 1,
    status: 'pass',
    source_commit: expected.source,
    selected,
    scope:
      'Ten actual staged native PDF profiles; synthetic browser corpus and waived physical/manual/reference checks are separate evidence classes.',
  };
}
async function main() {
  const [input, output] = process.argv.slice(2);
  requireValue(
    input && output,
    'usage: pdf-conformance.mjs INPUT_JSON OUTPUT_JSON',
  );
  const { records, expected } = JSON.parse(await readFile(input, 'utf8'));
  const result = validatePdfConformance(records, expected);
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
