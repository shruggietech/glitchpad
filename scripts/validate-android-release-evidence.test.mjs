import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { releaseIdentity } from './lib/release-identity.mjs';
const androidContract = JSON.parse(
  await readFile(
    new URL('../packaging/android/package-contract.json', import.meta.url),
    'utf8',
  ),
);
import test from 'node:test';
import {
  validateReleaseRow,
  validateReleaseAttempt,
  validateReleaseDirectory,
  releaseCaseGroups,
} from './validate-android-release-evidence.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const application = Buffer.from('independent canonical release bytes');
const instrumentation = Buffer.from(
  'independent matching instrumentation bytes',
);
const source = 'a'.repeat(40);
const expected = {
  source,
  api: 24,
  applicationSha: sha(application),
  instrumentationSha: sha(instrumentation),
};
const readback = (kind) => ({
  kind,
  verified: true,
  expected_sha256: sha('expected document'),
  actual_sha256: sha('expected document'),
});
const pdfFixtureSha = sha(
  await readFile(
    new URL('../fixtures/pdf/s049-compatibility.pdf', import.meta.url),
  ),
);
const printedPdf = Buffer.from(
  '%PDF-1.7\n' + 'fixture '.repeat(30) + '\n%%EOF\n',
);
function row(caseId) {
  const result = {
    schema: 1,
    status: 'pass',
    case_id: caseId,
    evidence_class: 'hosted_minified_release_instrumentation',
    identity: {
      source_commit: source,
      native_source_commit: source,
      frontend_source_commit: source,
      application_sha256: expected.applicationSha,
      instrumentation_sha256: expected.instrumentationSha,
      version: releaseIdentity.version,
      version_code: androidContract.version_code,
      api_level: 24,
      build_variant: 'ordinary',
      channel: 'release',
      application_debuggable: false,
      instrumentation_debuggable: true,
      test_kotlin_runtime:
        'com.shruggietech.glitchpad.testisolated.kotlin.jvm.internal.Intrinsics',
      test_tracing_runtime:
        'com.shruggietech.glitchpad.testisolated.androidx.tracing.Trace',
      package_identifier: 'com.shruggietech.glitchpad',
      instrumentation_package: 'com.shruggietech.glitchpad.test',
      signing_certificate_sha256: 'b'.repeat(64),
      instrumentation_certificate_sha256: 'b'.repeat(64),
      webview_package: 'com.android.chrome',
      webview_version: '69.0.3497.100',
    },
    readbacks: [
      readback('utf8'),
      readback('utf8'),
      readback('utf8'),
      readback('json_save'),
      readback('json_receiver'),
      readback('png_pixels'),
      readback('back_retained_utf8'),
    ],
    observations: {
      exact_text_verified: true,
      recovery_phase: 'verify',
      back_retained: true,
      about: { Build: source, Channel: 'release' },
      offline_notices: {
        default_network_none: true,
        native_local_notices: true,
      },
    },
  };
  if (caseId === 'pdf') {
    const print = (pages) => ({
      output_pages: pages,
      output_ink: Array(pages).fill(700),
      output_sha256: sha(printedPdf),
      output_bytes: printedPdf.length,
      private_spool_cleaned: true,
      physical_output_confirmed: false,
    });
    result.observations = {
      fixture_sha256: pdfFixtureSha,
      cold_resolved_view: true,
      warm_resolved_send: true,
      facts: {
        worker: 'true',
        engine: '6.5.438',
        ink: 800,
        executed: false,
        selected: 'Glitchpad PDF compatibility page 1',
      },
      reading_journey: {
        checks: Object.fromEntries(
          [
            'outline_named_destination',
            'search',
            'thumbnail',
            'internal_link',
            'external_link_disclosure',
            'rotation',
            'go_to_page',
            'keyboard',
            'metadata',
          ].map((k) => [k, true]),
        ),
        native_touch_outline: true,
        native_keyboard_home: true,
      },
      source_unchanged: true,
      stream_rendered: true,
      stream_cache_removed: true,
      stream_cache_files: [1000],
      disposal: {
        worker_terminated: true,
        workers: 0,
        surfaces: 0,
        surfaceBytes: 0,
        elapsed_ms: 20,
      },
      print: { selected: print(2), all: print(4) },
    };
  }
  return result;
}
test('release rows require independent installed bytes, source, role and actual API', () => {
  validateReleaseRow(row('delivery'), { ...expected, caseId: 'delivery' });
  for (const [field, value] of Object.entries({
    source_commit: 'c'.repeat(40),
    native_source_commit: 'c'.repeat(40),
    frontend_source_commit: 'c'.repeat(40),
    application_sha256: 'c'.repeat(64),
    instrumentation_sha256: 'c'.repeat(64),
    api_level: 36,
    version_code: 2001,
    application_debuggable: true,
    build_variant: 'fault_probe',
    channel: 'debug',
    signing_certificate_sha256: 'c'.repeat(64),
  })) {
    const changed = row('delivery');
    changed.identity[field] = value;
    assert.throws(
      () => validateReleaseRow(changed, { ...expected, caseId: 'delivery' }),
      undefined,
      field,
    );
  }
});
test('a marker or claimed pass cannot hide runner failure or wrong readback bytes', () => {
  const clean = {
    pass: true,
    command_exit: 0,
    logcat_exit: 0,
    capture_exit: 0,
  };
  const marker = {
    case_id: 'delivery',
    file: 's048-delivery.json',
    sha256: 'd'.repeat(64),
  };
  const output = 'OK (1 test)\nINSTRUMENTATION_CODE: -1\n';
  validateReleaseAttempt(clean, output, marker, 'delivery', marker.sha256);
  assert.throws(
    () =>
      validateReleaseAttempt(
        clean,
        'OK (1 test)\n',
        marker,
        'delivery',
        marker.sha256,
      ),
    /instrumentation completion/u,
  );
  assert.throws(() =>
    validateReleaseAttempt(
      { ...clean, command_exit: 137 },
      output,
      marker,
      'delivery',
      marker.sha256,
    ),
  );
  assert.throws(() =>
    validateReleaseAttempt(
      clean,
      output + 'INSTRUMENTATION_FAILED: process died\n',
      marker,
      'delivery',
      marker.sha256,
    ),
  );
  assert.throws(() =>
    validateReleaseAttempt(
      clean,
      output + 'INSTRUMENTATION_CODE: 0\n',
      marker,
      'delivery',
      marker.sha256,
    ),
  );
  assert.throws(() =>
    validateReleaseAttempt(
      clean,
      output,
      { ...marker, sha256: 'e'.repeat(64) },
      'delivery',
      marker.sha256,
    ),
  );
  const changed = row('authoring');
  changed.readbacks[0].actual_sha256 = 'f'.repeat(64);
  assert.throws(
    () => validateReleaseRow(changed, { ...expected, caseId: 'authoring' }),
    /readback mismatch/u,
  );
});
async function fixture(mode = 'full') {
  const directory = await mkdtemp(join(tmpdir(), 's048-release-'));
  const app = join(directory, 'application.apk'),
    testApk = join(directory, 'instrumentation.apk');
  await writeFile(app, application);
  await writeFile(testApk, instrumentation);
  for (const [group, cases] of Object.entries(
    mode === 'startup'
      ? { startup: ['startup'] }
      : mode === 'pdf'
        ? { pdf: ['pdf'] }
        : releaseCaseGroups,
  )) {
    const path = join(directory, group + '-attempt-1');
    await mkdir(path);
    for (const caseId of cases) {
      const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
      const receipt = row(caseId);
      receipt.screenshot = {
        file: 's048-' + caseId + '.png',
        sha256: sha(png),
      };
      const bytes = Buffer.from(JSON.stringify(receipt));
      await writeFile(join(path, 's048-' + caseId + '.json'), bytes);
      await writeFile(join(path, 's048-' + caseId + '.png'), png);
      if (caseId === 'pdf')
        for (const range of ['selected', 'all'])
          await writeFile(
            join(path, 's049-print-output-' + range + '.pdf'),
            printedPdf,
          );
      await writeFile(
        join(path, caseId + '-status.json'),
        JSON.stringify({
          pass: true,
          command_exit: 0,
          logcat_exit: 0,
          capture_exit: 0,
        }),
      );
      await writeFile(
        join(path, caseId + '-instrumentation.txt'),
        's048_release_evidence=' +
          JSON.stringify({
            case_id: caseId,
            file: 's048-' + caseId + '.json',
            sha256: sha(bytes),
          }) +
          '\nOK (1 test)\nINSTRUMENTATION_CODE: -1\n',
      );
    }
    if (['delivery', 'startup', 'pdf'].includes(group)) {
      await writeFile(
        join(path, 's048-installed-application.apk'),
        application,
      );
      await writeFile(
        join(path, 's048-installed-instrumentation.apk'),
        instrumentation,
      );
    }
  }
  return {
    directory,
    application: app,
    instrumentation: testApk,
    source,
    api: 24,
  };
}
test('complete campaign selects all six cases and reads installed APK captures', async () => {
  const input = await fixture();
  try {
    const result = await validateReleaseDirectory(input);
    assert.equal(result.selected.flatMap((entry) => entry.cases).length, 6);
    await writeFile(
      join(
        input.directory,
        'delivery-attempt-1',
        's048-installed-application.apk',
      ),
      'different installed bytes',
    );
    await assert.rejects(
      validateReleaseDirectory(input),
      /captured installed application/u,
    );
  } finally {
    await rm(input.directory, { recursive: true, force: true });
  }
});
test('newer failed, missing and unbounded attempts cannot fall back to historical success', async () => {
  const input = await fixture();
  try {
    const next = join(input.directory, 'authoring-attempt-2');
    await cp(join(input.directory, 'authoring-attempt-1'), next, {
      recursive: true,
    });
    await writeFile(
      join(next, 'authoring-status.json'),
      JSON.stringify({
        pass: false,
        command_exit: 1,
        logcat_exit: 0,
        capture_exit: 0,
      }),
    );
    await assert.rejects(validateReleaseDirectory(input), /complete cleanly/u);
    await rm(next, { recursive: true });
    await rm(
      join(input.directory, 'recovery-attempt-1', 's048-recovery_verify.json'),
    );
    await assert.rejects(validateReleaseDirectory(input), /ENOENT/u);
    await mkdir(join(input.directory, 'delivery-attempt-3'));
    await assert.rejects(validateReleaseDirectory(input), /unbounded/u);
  } finally {
    await rm(input.directory, { recursive: true, force: true });
  }
});
test('required recovery, Diagnostics, export and offline About observations cannot be omitted', () => {
  for (const caseId of [
    'delivery',
    'authoring',
    'recovery_verify',
    'back_about',
    'startup',
  ]) {
    const changed = row(caseId);
    if (caseId === 'recovery_verify')
      changed.observations.exact_text_verified = false;
    else if (['back_about', 'startup'].includes(caseId))
      changed.observations.offline_notices.default_network_none = false;
    else changed.readbacks = [];
    assert.throws(() => validateReleaseRow(changed, { ...expected, caseId }));
  }
});

test('startup diagnostics cannot qualify the full release campaign', async () => {
  const input = await fixture('startup');
  try {
    const result = await validateReleaseDirectory({
      ...input,
      mode: 'startup',
    });
    assert.equal(result.diagnostic_only, true);
    assert.equal(result.candidate_qualified, false);
    await assert.rejects(
      validateReleaseDirectory(input),
      /unexpected|missing/u,
    );
  } finally {
    await rm(input.directory, { recursive: true, force: true });
  }
});

test('PDF is mandatory in full release campaigns', () => {
  assert.deepEqual(releaseCaseGroups.pdf, ['pdf']);
  const missing = row('pdf');
  missing.observations = {};
  assert.throws(
    () => validateReleaseRow(missing, { ...expected, caseId: 'pdf' }),
    /PDF/u,
  );
});

test('PDF release rows reject false worker, fixture, input, cache, print and disposal facts', () => {
  validateReleaseRow(row('pdf'), { ...expected, caseId: 'pdf' });
  for (const mutate of [
    (p) => (p.facts.worker = 'false'),
    (p) => (p.fixture_sha256 = 'c'.repeat(64)),
    (p) => (p.cold_resolved_view = false),
    (p) => (p.warm_resolved_send = false),
    (p) => (p.stream_cache_removed = false),
    (p) => (p.disposal.elapsed_ms = 251),
    (p) => (p.reading_journey.checks.search = false),
    (p) => (p.print.all.output_ink = [0, 0, 0, 0]),
    (p) => (p.print.selected.output_pages = 4),
    (p) => (p.source_unchanged = false),
  ]) {
    const changed = row('pdf');
    mutate(changed.observations);
    assert.throws(
      () => validateReleaseRow(changed, { ...expected, caseId: 'pdf' }),
      /PDF/u,
    );
  }
});
test('PDF diagnostics capture raw prints and installed bytes without qualifying the whole release', async () => {
  const input = await fixture('pdf');
  try {
    const result = await validateReleaseDirectory({ ...input, mode: 'pdf' });
    assert.equal(result.diagnostic_only, true);
    assert.equal(result.candidate_qualified, false);
    await assert.rejects(
      validateReleaseDirectory(input),
      /unexpected|missing/u,
    );
    await writeFile(
      join(input.directory, 'pdf-attempt-1', 's049-print-output-all.pdf'),
      'wrong output',
    );
    await assert.rejects(
      validateReleaseDirectory({ ...input, mode: 'pdf' }),
      /printed bytes/u,
    );
    await writeFile(
      join(input.directory, 'pdf-attempt-1', 's049-print-output-all.pdf'),
      printedPdf,
    );
    await writeFile(
      join(input.directory, 'pdf-attempt-1', 's048-installed-application.apk'),
      'wrong installed app',
    );
    await assert.rejects(
      validateReleaseDirectory({ ...input, mode: 'pdf' }),
      /installed application/u,
    );
  } finally {
    await rm(input.directory, { recursive: true, force: true });
  }
});
