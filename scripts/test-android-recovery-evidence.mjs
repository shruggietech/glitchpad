import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  validateRecoveryEvidence,
  requiredVariants,
  collectRecoveryEvidence,
} from './validate-android-recovery-evidence.mjs';

const source = 'a'.repeat(40),
  app = 'b'.repeat(64),
  instrument = 'c'.repeat(64);
function fixture(role = 'ordinary', api = 36) {
  const identity = {
    source_commit: source,
    native_source_commit: source,
    frontend_source_commit: source,
    application_sha256: app,
    instrumentation_sha256: instrument,
    package_identifier: 'com.shruggietech.glitchpad',
    instrumentation_package: 'com.shruggietech.glitchpad.test',
    version: '0.2.0',
    channel: 'debug',
    build_variant: role,
    api_level: api,
    android_version: api === 24 ? '7.0' : '16',
    webview_package: 'com.android.webview',
    webview_version: '139.0.0.0',
  };
  const evidence = {
    schema_version: 1,
    role,
    api_level: api,
    identity,
    journeys: Array.from({ length: 10 }, (_, i) => ({
      journey: i + 1,
      status: requiredVariants(role, api, i + 1).length
        ? 'pass'
        : 'not_applicable',
      reason: requiredVariants(role, api, i + 1).length
        ? null
        : 'ordinary_tasks_qualified_separately',
      variants: requiredVariants(role, api, i + 1).map((id) => ({
        id,
        status: 'pass',
        observed: true,
        details:
          id === 'predictive_cancel'
            ? {
                started: 1,
                progressed: 2,
                cancelled: 1,
                committed: 0,
                requested: 0,
                completed: 0,
                delegated: 0,
                state_unchanged: true,
              }
            : id === 'animation'
              ? {
                  branch: 'played_and_paused',
                  reduced_motion: false,
                  play_enabled: true,
                  advanced: true,
                  paused: true,
                  unexecuted_actions: [],
                }
              : id === 'offline_notices'
                ? {
                    default_network_none: true,
                    shell_exit_status: 0,
                    native_local_notices: true,
                  }
                : id === 'predictive_commit'
                  ? {
                      started: 1,
                      progressed: 2,
                      cancelled: 0,
                      committed: 1,
                      requested: 1,
                      completed: 1,
                      delegated: 0,
                    }
                  : {},
      })),
      observations:
        i === 7
          ? {
              profiles: Object.fromEntries(
                [1, api === 36 ? 2 : 1.3].flatMap((font) =>
                  ['portrait', 'landscape', 'short', 'ime'].map((profile) => [
                    profile + '-' + font.toFixed(1),
                    {
                      font_scale: font,
                      control_count: 2,
                      css: { width: 320, height: 640 },
                    },
                  ]),
                ),
              ),
              control_measurements: ['Find next', 'Go to line']
                .map((operation) => ({
                  pending_read: {
                    operation,
                    held: {
                      provider_process_id: 42,
                      control_process_id: 42,
                      entered_process_id: 42,
                      entered_count: 1,
                      entered_on_main_thread: false,
                      released: false,
                    },
                    held_after: {
                      released: true,
                      finished: true,
                      timed_out: false,
                    },
                    cancelled_before_release: true,
                    position_unchanged: true,
                    source_before: app,
                    source_after: app,
                  },
                }))
                .concat([
                  {
                    controls: [
                      {
                        label: 'Control',
                        width: 48,
                        height: 48,
                        hit: true,
                        contrast: 7,
                        disabled: false,
                        text_size: 16,
                        font_weight: '400',
                        native: { whole_control_visible: true },
                      },
                    ],
                  },
                ]),
            }
          : {},
      identity: { ...identity },
      profile: {
        css_width: 320,
        css_height: 640,
        native_visible: { left: 0, top: 24, right: 320, bottom: 592 },
        font_scale: 1,
        navigation_mode: 'three_button',
      },
      log: 'row.log',
      screenshot: 'row.png',
      attempt: 1,
      completion: {
        adb_exit_status: 0,
        marker_present: 1,
        junit_success: 1,
        instrumentation_failure: 0,
      },
      readbacks:
        i === 6
          ? [
              {
                kind: 'json_save',
                expected_sha256: app,
                actual_sha256: app,
                verified: true,
              },
              {
                kind: 'json_receiver',
                expected_sha256: app,
                actual_sha256: app,
                verified: true,
              },
            ]
          : [4, 5, 6, 7].includes(i + 1)
            ? [
                {
                  kind:
                    i + 1 === 6
                      ? 'png_pixels'
                      : i + 1 === 7
                        ? 'json_receiver'
                        : 'utf8',
                  expected_sha256: app,
                  actual_sha256: app,
                  verified: true,
                },
              ]
            : [],
    })),
  };
  const measurement =
    evidence.journeys[7].observations.control_measurements?.find(
      (m) => m.controls,
    )?.controls;
  if (role === 'ordinary')
    for (const scale of [1, api === 36 ? 2 : 1.3])
      for (const context of ['portrait', 'landscape', 'short', 'ime'])
        for (const task of [
          'editor_search',
          'document_details',
          'markdown_search',
          'outline',
          'metadata',
          'mermaid_search',
          'diagram_tools',
          'image_tools',
          'icon_tools',
          'large_tools',
          'preferences',
        ])
          evidence.journeys[7].observations.control_measurements.push({
            profile: context + '-' + scale.toFixed(1) + ':' + task,
            font_scale: scale,
            ime_visible:
              context === 'ime' &&
              [
                'editor_search',
                'markdown_search',
                'mermaid_search',
                'image_tools',
                'large_tools',
                'preferences',
              ].includes(task),
            ime_applicable: [
              'editor_search',
              'markdown_search',
              'mermaid_search',
              'image_tools',
              'large_tools',
              'preferences',
            ].includes(task),
            controls: structuredClone(measurement),
          });
  if (role === 'ordinary')
    for (const [row, kinds] of [
      [5, ['image']],
      [7, ['diagram_standalone', 'diagram_embedded']],
    ])
      evidence.journeys[row].observations.more_viewport_actions = kinds.map(
        (kind) => ({
          kind,
          expected_fit: 0.4,
          fit: 0.4,
          zoom_in: 0.5,
          zoom_out: 0.4,
          same_document: true,
          same_source: true,
          scope_preserved: true,
        }),
      );
  return evidence;
}

async function check(evidence, change = () => {}) {
  const dir = await mkdtemp(join(tmpdir(), 's047-evidence-'));
  try {
    await writeFile(join(dir, 'row.log'), 'row marker\nOK (1 test)\n');
    await writeFile(
      join(dir, 'row.png'),
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]),
    );
    change(evidence);
    return await validateRecoveryEvidence(evidence, {
      directory: dir,
      expectedSource: source,
      installedReceipt: {
        source_commit: source,
        recovery_probe_variant:
          evidence.role === 'ordinary' ? 'none' : 'compiled_test_only',
        artifacts: [
          {
            kind: 'application',
            package: 'com.shruggietech.glitchpad',
            sha256: app,
          },
          {
            kind: 'instrumentation',
            package: 'com.shruggietech.glitchpad.test',
            sha256: instrument,
          },
        ],
      },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('requires complete ordinary and separately identified fault roles on both supported APIs', async () => {
  for (const role of ['ordinary', 'fault_probe'])
    for (const api of [24, 36])
      assert.equal((await check(fixture(role, api))).qualified, true);
});
test('rejects missing or duplicate report journey instead of counting method invocations', async () => {
  for (const mutate of [
    (e) => e.journeys.pop(),
    (e) => (e.journeys[9] = { ...e.journeys[0] }),
  ])
    await assert.rejects(check(fixture(), mutate), /journey/i);
});
test('rejects probe substitution, stale source, and either installed package hash mismatch', async () => {
  for (const [key, value] of [
    ['build_variant', 'fault_probe'],
    ['native_source_commit', 'd'.repeat(40)],
    ['frontend_source_commit', 'd'.repeat(40)],
    ['application_sha256', 'd'.repeat(64)],
    ['instrumentation_sha256', 'd'.repeat(64)],
  ])
    await assert.rejects(
      check(fixture(), (e) => {
        e.journeys[0].identity[key] = value;
      }),
      /identity|source|role|hash/i,
    );
});
test('rejects each failed or missing required task variant', async () => {
  for (const mutate of [
    (e) => e.journeys[0].variants.pop(),
    (e) => (e.journeys[0].variants[0].status = 'not_run'),
    (e) => (e.journeys[0].variants[0].observed = false),
    (e) => (e.journeys[0].status = 'not_applicable'),
  ])
    await assert.rejects(check(fixture(), mutate), /variant|status|observ/i);
});
test('positive predictive cancellation and actual 200 percent coverage are required only on API36', async () => {
  assert(requiredVariants('ordinary', 36, 9).includes('predictive_cancel'));
  assert(!requiredVariants('ordinary', 24, 9).includes('predictive_cancel'));
  assert(requiredVariants('ordinary', 36, 8).includes('font_200'));
});
test('marker or callback never replaces clean JUnit, adb completion, or exact destination readback', async () => {
  for (const mutate of [
    (e) => (e.journeys[0].completion.junit_success = 0),
    (e) => (e.journeys[0].completion.adb_exit_status = 1),
    (e) => (e.journeys[0].completion.instrumentation_failure = 1),
    (e) => (e.journeys[3].readbacks[0].actual_sha256 = 'd'.repeat(64)),
  ])
    await assert.rejects(check(fixture(), mutate), /completion|readback/i);
});
test('requires actual screenshot and log evidence, with relative contained paths', async () => {
  for (const mutate of [
    (e) => (e.journeys[0].screenshot = 'missing.png'),
    (e) => (e.journeys[0].log = '../outside.log'),
    (e) => (e.journeys[0].screenshot = 'row.log'),
  ])
    await assert.rejects(
      check(fixture(), mutate),
      /screenshot|evidence|path|PNG/i,
    );
});
test('retains failure attempts and refuses a final pass with erased attempt history', async () => {
  const e = fixture();
  e.journeys[0].attempt = 2;
  await assert.rejects(check(e), /attempt/i);
  e.journeys[0].previous_attempts = [
    {
      attempt: 1,
      status: 'fail',
      log: 'row.log',
      screenshot: 'row.png',
      completion: {
        adb_exit_status: 1,
        marker_present: 0,
        junit_success: 0,
        instrumentation_failure: 1,
      },
    },
  ];
  assert.equal((await check(e)).qualified, true);
});

test('rejects gesture non-callback inference and an extra destructive delegation', async () => {
  for (const mutate of [
    (e) =>
      (e.journeys[8].variants.find(
        (v) => v.id === 'predictive_cancel',
      ).details.cancelled = 0),
    (e) =>
      (e.journeys[8].variants.find(
        (v) => v.id === 'predictive_cancel',
      ).details.delegated = 1),
    (e) =>
      (e.journeys[8].variants.find(
        (v) => v.id === 'predictive_commit',
      ).details.requested = 2),
  ])
    await assert.rejects(
      check(fixture(), mutate),
      /predictive|gesture|callback/i,
    );
});
test('rejects labelled-only maximum font, missing native profile and clipped or low-contrast controls', async () => {
  for (const mutate of [
    (e) => delete e.journeys[7].observations.profiles['ime-2.0'],
    (e) => (e.journeys[7].observations.profiles['portrait-2.0'].font_scale = 1),
    (e) =>
      (e.journeys[7].observations.control_measurements.find(
        (m) => m.controls,
      ).controls[0].native.whole_control_visible = false),
    (e) =>
      (e.journeys[7].observations.control_measurements.find(
        (m) => m.controls,
      ).controls[0].contrast = 1),
  ])
    await assert.rejects(
      check(fixture(), mutate),
      /profile|font|control|contrast/i,
    );
});
test('rejects missing actual PNG pixel or JSON receiver readback despite other successful reads', async () => {
  for (const mutate of [
    (e) => (e.journeys[5].readbacks[0].kind = 'callback'),
    (e) =>
      (e.journeys[6].readbacks = e.journeys[6].readbacks.filter(
        (r) => r.kind !== 'json_receiver',
      )),
  ])
    await assert.rejects(check(fixture(), mutate), /readback/i);
});
test('collector verifies complete native JSON bytes instead of trusting a small log marker', async () => {
  const directory = await mkdtemp(join(tmpdir(), 's047-collector-'));
  try {
    const e = fixture('fault_probe');
    const markers = [];
    for (const row of e.journeys.filter((r) => r.status === 'pass')) {
      const bytes = Buffer.from(JSON.stringify(row));
      await writeFile(
        join(directory, 'task-attempt-1-s047-row-' + row.journey + '.json'),
        bytes,
      );
      markers.push(
        's047_journey_evidence=' +
          JSON.stringify({
            journey: row.journey,
            file: 's047-row-' + row.journey + '.json',
            sha256: createHash('sha256').update(bytes).digest('hex'),
          }),
      );
    }
    await writeFile(
      join(directory, 'task-attempt-1.txt'),
      markers.join('\n') + '\nOK (1 test)\n',
    );
    await writeFile(
      join(directory, 'task-attempt-1-status.txt'),
      'adb_exit_status=0\nmarker_present=1\njunit_success=1\ninstrumentation_failure=0\n',
    );
    const collected = await collectRecoveryEvidence(
      directory,
      'fault_probe',
      36,
      source,
      {},
    );
    assert.equal(collected.journeys.length, 10);
    assert.equal(collected.journeys[2].identity.application_sha256, app);
    await writeFile(join(directory, 'task-attempt-1-s047-row-3.json'), '{}');
    await assert.rejects(
      collectRecoveryEvidence(directory, 'fault_probe', 36, source, {}),
      /hash/i,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('pending/cancel qualification requires actual provider entry and cancellation before release', async () => {
  for (const mutate of [
    (e) => e.journeys[7].observations.control_measurements.shift(),
    (e) =>
      (e.journeys[7].observations.control_measurements[0].pending_read.held.entered_count = 0),
    (e) =>
      (e.journeys[7].observations.control_measurements[0].pending_read.cancelled_before_release = false),
  ])
    await assert.rejects(
      check(fixture(), mutate),
      /pending|read|cancel|entry/i,
    );
});

test('collector retains all ten missing or failed report rows without inventing runtime identity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 's047-incomplete-'));
  try {
    const absent = await collectRecoveryEvidence(
      directory,
      'ordinary',
      24,
      source,
      {},
    );
    assert.equal(absent.journeys.length, 10);
    assert(
      absent.journeys.every(
        (r) => r.status === 'not_run' && r.identity === null,
      ),
    );
    await writeFile(
      join(directory, 's047-cold-attempt-1.txt'),
      'actual failed output',
    );
    await writeFile(
      join(directory, 's047-cold-attempt-1-status.txt'),
      'adb_exit_status=1\nmarker_present=0\njunit_success=0\ninstrumentation_failure=1\n',
    );
    const failed = await collectRecoveryEvidence(
      directory,
      'ordinary',
      24,
      source,
      {},
    );
    assert.equal(failed.journeys[0].status, 'fail');
    assert.equal(failed.journeys[0].attempts[0].completion.adb_exit_status, 1);
    assert.equal(failed.journeys[1].status, 'not_run');
    await assert.rejects(
      validateRecoveryEvidence(failed, {
        directory,
        expectedSource: source,
        installedReceipt: {},
      }),
      /identity|source/i,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('offline notices require actual network-none and successful hosted shell observations', async () => {
  for (const mutate of [
    (e) =>
      (e.journeys[9].variants.find((v) => v.id === 'offline_notices').details =
        {}),
    (e) =>
      (e.journeys[9].variants.find(
        (v) => v.id === 'offline_notices',
      ).details.shell_exit_status = 1),
  ])
    await assert.rejects(check(fixture(), mutate), /offline|network|notices/i);
});

test('animation receipt distinguishes actual Play/Pause from reduced-motion disabled policy', async () => {
  for (const mutate of [
    (e) =>
      (e.journeys[5].variants.find((v) => v.id === 'animation').details = {}),
    (e) =>
      (e.journeys[5].variants.find((v) => v.id === 'animation').details = {
        branch: 'reduced_motion_disabled',
        reduced_motion: true,
        play_enabled: false,
        advanced: true,
        paused: true,
        policy_explanation: true,
        unexecuted_actions: [],
      }),
  ])
    await assert.rejects(check(fixture(), mutate), /animation|motion|Play/i);
  const e = fixture();
  e.journeys[5].variants.find((v) => v.id === 'animation').details = {
    branch: 'reduced_motion_disabled',
    reduced_motion: true,
    play_enabled: false,
    advanced: false,
    paused: false,
    policy_explanation: true,
    unexecuted_actions: ['Play', 'Pause'],
  };
  assert.equal((await check(e)).qualified, true);
});

test('actual task controls must be measured in every required native profile, including applicable IME', async () => {
  for (const mutate of [
    (e) =>
      (e.journeys[7].observations.control_measurements =
        e.journeys[7].observations.control_measurements.filter(
          (m) => m.profile !== 'short-2.0:editor_search',
        )),
    (e) =>
      (e.journeys[7].observations.control_measurements.find(
        (m) => m.profile === 'ime-2.0:markdown_search',
      ).ime_visible = false),
  ])
    await assert.rejects(check(fixture(), mutate), /task|profile|IME/i);
});

test('More alias receipts require actual live Fit, multiplicative Zoom and unchanged document/source scope', async () => {
  for (const mutate of [
    (e) => (e.journeys[5].observations.more_viewport_actions = []),
    (e) => e.journeys[7].observations.more_viewport_actions.pop(),
    (e) => (e.journeys[5].observations.more_viewport_actions[0].zoom_in = 1),
    (e) =>
      (e.journeys[7].observations.more_viewport_actions[0].same_document = false),
  ])
    await assert.rejects(
      check(fixture(), mutate),
      /More|viewport|scope|Fit|Zoom/i,
    );
});

test('durable instrumentation stream retains early authoring rows after logcat rotation and still requires clean completion', async () => {
  const directory = await mkdtemp(join(tmpdir(), 's047-durable-stream-'));
  try {
    const evidence = fixture('ordinary');
    const markers = [];
    for (const id of [4, 5, 7]) {
      const row = evidence.journeys.find(
        (candidate) => candidate.journey === id,
      );
      const bytes = Buffer.from(JSON.stringify(row));
      await writeFile(
        join(directory, 's047-authoring-attempt-1-s047-row-' + id + '.json'),
        bytes,
      );
      markers.push(
        's047_journey_evidence=' +
          JSON.stringify({
            journey: id,
            file: 's047-row-' + id + '.json',
            sha256: createHash('sha256').update(bytes).digest('hex'),
          }),
      );
    }
    const stdout = join(directory, 's047-authoring-attempt-1.txt');
    const status = join(directory, 's047-authoring-attempt-1-status.txt');
    await writeFile(stdout, 'OK (1 test)\n');
    await writeFile(
      join(directory, 's047-authoring-attempt-1-logcat.txt'),
      markers[2] + '\n',
    );
    await writeFile(
      status,
      'adb_exit_status=0\nmarker_present=1\njunit_success=1\ninstrumentation_failure=0\n',
    );
    const lost = await collectRecoveryEvidence(
      directory,
      'ordinary',
      36,
      source,
      {},
    );
    assert.equal(lost.journeys[3].status, 'fail');
    assert.equal(lost.journeys[4].status, 'fail');
    assert.equal(lost.journeys[6].status, 'pass');
    await writeFile(
      stdout,
      markers
        .map(
          (marker) =>
            'INSTRUMENTATION_STATUS: stream=' +
            marker +
            '\nINSTRUMENTATION_STATUS_CODE: 2',
        )
        .join('\n') + '\nOK (1 test)\n',
    );
    const durable = await collectRecoveryEvidence(
      directory,
      'ordinary',
      36,
      source,
      {},
    );
    for (const id of [4, 5, 7]) {
      const row = durable.journeys[id - 1];
      assert.equal(row.status, 'pass');
      assert.equal(row.identity.application_sha256, app);
    }
    assert.equal(durable.journeys[0].status, 'not_run');
    await writeFile(
      status,
      'adb_exit_status=0\nmarker_present=1\njunit_success=1\ninstrumentation_failure=1\n',
    );
    const failed = await collectRecoveryEvidence(
      directory,
      'ordinary',
      36,
      source,
      {},
    );
    for (const id of [4, 5, 7])
      assert.equal(failed.journeys[id - 1].status, 'fail');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
