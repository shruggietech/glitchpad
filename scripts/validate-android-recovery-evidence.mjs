import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ordinary = {
  1: [
    'choices',
    'close',
    'outside',
    'button_back',
    'shell_keyboard',
    'tab_activation_close_reorder',
  ],
  2: [
    'cold_view',
    'warm_view',
    'warm_send',
    'in_app',
    'corpus',
    'empty',
    'malformed',
  ],
  3: ['provider_denial'],
  4: [
    'new_markdown',
    'new_text',
    'exact_utf8',
    'reopen',
    'cancel',
    'failed_write',
    'dirty_receipt',
  ],
  5: ['edit_copy', 'original_unchanged', 'in_place_unavailable'],
  6: [
    'svg_supported',
    'svg_unsupported',
    'svg_malformed',
    'svg_external',
    'svg_cycle',
    'svg_missing',
    'svg_resource',
    'source_read',
    'local_zoom_fit',
    'menu_zoom_fit',
    'keyboard_zoom_fit',
    'gesture_pan',
    'reset_state',
    'animation',
    'icon_selection',
    'png_export',
    'frame_buttons',
    'background_all',
    'embedded_metadata',
  ],
  7: [
    'frozen_redacted',
    'save_readback',
    'cancel',
    'failed_write',
    'share_cancel',
    'share_receiver',
    'runtime_facts',
    'diagnostic_clear',
  ],
  8: [
    'portrait',
    'landscape',
    'short',
    'ime',
    'default_font',
    'font_max',
    'targets',
    'semantics',
    'focus',
    'keyboard',
    'contrast',
    'editor_search_history',
    'markdown_mermaid',
    'large_text',
    'large_pending_cancel',
    'metadata_copy',
    'preferences_validation',
    'editor_aliases',
    'details_language',
    'metadata_sha',
    'preferences_wrap',
    'diagram_controls',
    'external_intent',
  ],
  9: [
    'button_back',
    'modal_background',
    'rotation_resume',
    'picker_cancel',
    'dirty_close',
  ],
  10: [
    'installed_facts',
    'explicit_destinations',
    'offline_notices',
    'after_failure',
  ],
};
const fault = {
  3: [
    'worker',
    'parser',
    'projection',
    'root',
    'bootstrap_import',
    'host_transport',
    'source_retained',
    'draft_recovered',
    'recovery_decisions',
  ],
  7: [
    'injected_failure_record',
    'frozen_redacted',
    'runtime_facts',
    'diagnostic_clear',
  ],
};
export function requiredVariants(role, api, journey) {
  assert(['ordinary', 'fault_probe'].includes(role), 'invalid role');
  assert([24, 36].includes(api), 'invalid API');
  const list = [...((role === 'ordinary' ? ordinary : fault)[journey] ?? [])];
  if (role === 'ordinary' && api === 36) {
    if (journey === 8) list.push('font_200');
    if (journey === 9) list.push('predictive_cancel', 'predictive_commit');
  }
  return list;
}
const digest = /^[0-9a-f]{64}$/u,
  sourcePattern = /^[0-9a-f]{40}$/u;
async function evidenceFile(directory, path, png = false) {
  assert(
    typeof path === 'string' && path && !isAbsolute(path),
    'evidence path must be relative',
  );
  const absolute = resolve(directory, path);
  assert(
    !relative(resolve(directory), absolute).startsWith('..'),
    'evidence path escapes directory',
  );
  const bytes = await readFile(absolute).catch(() => null);
  assert(bytes?.length, 'evidence file missing: ' + path);
  if (png)
    assert(
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'screenshot is not PNG',
    );
}
function clean(completion) {
  assert(
    completion?.adb_exit_status === 0 &&
      completion.marker_present === 1 &&
      completion.junit_success === 1 &&
      completion.instrumentation_failure === 0 &&
      completion.logcat_exit_status === 0,
    'clean instrumentation completion required',
  );
}
function identityMatches(actual, expected) {
  for (const key of [
    'source_commit',
    'native_source_commit',
    'frontend_source_commit',
    'application_sha256',
    'instrumentation_sha256',
    'package_identifier',
    'instrumentation_package',
    'version',
    'channel',
    'build_variant',
    'api_level',
    'android_version',
    'webview_package',
    'webview_version',
  ])
    assert.equal(actual?.[key], expected[key], 'identity mismatch: ' + key);
  assert.deepEqual(
    actual?.clipboard_provider,
    expected.clipboard_provider,
    'identity mismatch: clipboard provider',
  );
}

function validateObservedDetails(row, role, api) {
  if (role === 'ordinary' && [6, 8].includes(row.journey)) {
    const kinds =
      row.journey === 6
        ? ['image']
        : ['diagram_standalone', 'diagram_embedded'];
    const observed = row.observations?.more_viewport_actions;
    assert(
      Array.isArray(observed) && observed.length === kinds.length,
      'actual scoped More viewport actions required',
    );
    for (const kind of kinds) {
      const matches = observed.filter((value) => value.kind === kind);
      assert(
        matches.length === 1,
        'exactly one More task action sequence required per viewport kind',
      );
      const value = matches[0];
      assert(
        ['expected_fit', 'fit', 'zoom_in', 'zoom_out'].every(
          (key) => Number.isFinite(value[key]) && value[key] > 0,
        ),
        'actual More Fit/Zoom numeric facts required',
      );
      assert(
        Math.abs(value.fit - value.expected_fit) < 0.0001 &&
          Math.abs(value.zoom_in - value.fit * 1.25) < 0.0001 &&
          Math.abs(value.zoom_out - value.zoom_in * 0.8) < 0.0001,
        'More Fit and Zoom must use the same effective viewport scale',
      );
      assert(
        value.same_document === true &&
          value.same_source === true &&
          value.scope_preserved === true,
        'More actions must preserve selected document and source scope',
      );
    }
  }
  if (role === 'ordinary' && row.journey === 6) {
    const d = row.variants.find((v) => v.id === 'animation')?.details;
    assert(
      d &&
        typeof d.reduced_motion === 'boolean' &&
        typeof d.play_enabled === 'boolean',
      'actual animation branch required',
    );
    if (d.play_enabled)
      assert(
        d.branch === 'played_and_paused' &&
          d.advanced === true &&
          d.paused === true &&
          Array.isArray(d.unexecuted_actions) &&
          d.unexecuted_actions.length === 0,
        'actual Play/Pause execution required',
      );
    else
      assert(
        d.branch === 'reduced_motion_disabled' &&
          d.reduced_motion === true &&
          d.advanced === false &&
          d.paused === false &&
          d.policy_explanation === true &&
          JSON.stringify(d.unexecuted_actions) ===
            JSON.stringify(['Play', 'Pause']),
        'reduced-motion animation must identify unexecuted actions',
      );
  }
  if (role === 'ordinary' && row.journey === 10) {
    const d = row.variants.find((v) => v.id === 'offline_notices')?.details;
    assert(
      d?.default_network_none === true &&
        d.shell_exit_status === 0 &&
        d.native_local_notices === true,
      'offline notices require actual network-none and successful hosted shell observations',
    );
  }
  if (role === 'ordinary' && row.journey === 9) {
    const edit = row.observations?.native_edit_back;
    for (const key of [
      'native_mode_observed',
      'popup_observed',
      'task_retained',
      'fields_unchanged',
      'close_completed',
    ])
      assert.equal(
        edit?.[key],
        true,
        'native text edit Back must retain the task and complete its later Close action',
      );
    assert(
      ['source_owner', 'platform'].includes(edit?.route),
      'native text edit Back must identify its actual native owner',
    );
    const nativeCommit = edit.route === 'source_owner' ? 1 : 0;
    for (const [key, expected] of Object.entries({
      committed: nativeCommit,
      requested: 0,
      completed: 0,
      delegated: 0,
      native_edit_dismissed: nativeCommit,
    }))
      assert.equal(
        edit?.callback_delta?.[key],
        expected,
        'native text edit Back must consume one native layer without another JS request',
      );
  }
  if (role === 'ordinary' && row.journey === 9 && api === 36) {
    for (const [id, cancel] of [
      ['predictive_cancel', true],
      ['predictive_commit', false],
    ]) {
      const d = row.variants.find((v) => v.id === id)?.details;
      assert(
        d && d.started === 1 && d.progressed > 0,
        'predictive gesture must positively traverse actual callbacks',
      );
      assert.equal(
        d.cancelled,
        cancel ? 1 : 0,
        'predictive cancel callback count mismatch',
      );
      for (const key of ['committed', 'requested', 'completed'])
        assert.equal(
          d[key],
          cancel ? 0 : 1,
          'predictive callback must commit/request/complete exactly once',
        );
      assert.equal(
        d.delegated,
        0,
        'predictive handled modal must not delegate another event',
      );
      if (cancel)
        assert.equal(
          d.state_unchanged,
          true,
          'predictive cancellation must retain actual state',
        );
    }
  }
  if (role === 'ordinary' && row.journey === 8) {
    const profiles = row.observations?.profiles;
    for (const scale of [1, api === 36 ? 2 : 1.3])
      for (const name of ['portrait', 'landscape', 'short', 'ime']) {
        const actual = profiles?.[name + '-' + scale.toFixed(1)];
        assert(
          actual?.control_count > 0 &&
            actual.css?.width > 0 &&
            actual.css?.height > 0,
          'actual required native profile missing',
        );
        assert(
          Math.abs(actual.font_scale - scale) < 0.011,
          'maximum font requires actual Android configuration',
        );
      }
    const pastes = row.observations?.clipboard_paste_readbacks;
    assert(
      Array.isArray(pastes) && pastes.length === 2,
      'clipboard requires both independent paste readbacks',
    );
    for (const transport of ['inline', 'uri']) {
      const matches = pastes.filter((paste) => paste.transport === transport);
      assert.equal(
        matches.length,
        1,
        'clipboard paste transports must be unique',
      );
      const paste = matches[0];
      const receiver = paste.receiver;
      assert(
        receiver && !Object.hasOwn(receiver, 'error'),
        'clipboard recipient must complete without an error',
      );
      assert(
        typeof paste.request_nonce === 'string' &&
          paste.request_nonce.length > 0 &&
          receiver.nonce === paste.request_nonce,
        'clipboard paste requires the current request nonce',
      );
      assert(
        Number.isInteger(paste.app_uid) &&
          paste.app_uid > 0 &&
          Number.isInteger(receiver.receiver_uid) &&
          receiver.receiver_uid > 0 &&
          receiver.receiver_uid !== paste.app_uid,
        'clipboard paste must execute in an independent application UID',
      );
      assert.equal(
        receiver.receiver_package,
        row.identity.instrumentation_package,
        'clipboard recipient package must match the installed instrumentation',
      );
      assert(
        receiver.plain_text_mime === true &&
          receiver.paste_accepted === true &&
          paste.returned_to_document === true,
        'clipboard paste must preserve plain text and return to its document',
      );
      assert.equal(
        receiver.has_uri,
        transport === 'uri',
        'clipboard transport must match the actual pasted item',
      );
      assert.equal(
        receiver.intent_uri_grant,
        false,
        'clipboard recipient must obtain access without an Intent URI grant',
      );
      if (transport === 'uri') {
        assert.equal(
          receiver.uri_authority,
          row.identity.package_identifier +
            (api < 28 ? '.clipboard' : '.fileprovider'),
          'clipboard recipient must read the platform-specific copied-text provider',
        );
        if (api >= 28)
          assert.equal(
            receiver.uri_read_granted,
            true,
            'clipboard service must grant modern recipient read access',
          );
        assert.equal(
          receiver.uri_write_granted,
          false,
          'clipboard recipient must not receive write authority',
        );
        for (const key of [
          'uri_write_denied',
          'uri_directory_denied',
          'uri_unknown_denied',
          'uri_traversal_denied',
        ])
          assert.equal(
            receiver[key],
            true,
            'clipboard recipient access boundary missing: ' + key,
          );
        assert.equal(
          receiver.text_stream_advertised,
          true,
          'platform styled paste must discover the actual text stream',
        );
        assert(
          !Object.hasOwn(receiver, 'uri_stream_error'),
          'clipboard URI stream must be readable by the recipient',
        );
        assert.equal(
          receiver.uri_stream_utf8_bytes,
          paste.expected_utf8_bytes,
          'clipboard URI stream must preserve every source byte',
        );
        assert.equal(
          receiver.uri_stream_sha256,
          paste.expected_sha256,
          'clipboard URI stream must preserve the exact source digest',
        );
        assert(
          paste.expected_code_units >= 512 * 1024,
          'clipboard URI paste must cover the oversized Binder regression',
        );
      }
      assert(
        Number.isSafeInteger(paste.expected_utf8_bytes) &&
          paste.expected_utf8_bytes > 0 &&
          Number.isSafeInteger(paste.expected_code_units) &&
          paste.expected_code_units > 0,
        'clipboard expected paste sizes must be observed',
      );
      assert.equal(
        receiver.utf8_bytes,
        paste.expected_utf8_bytes,
        'clipboard paste must preserve every UTF-8 byte',
      );
      assert.equal(
        receiver.code_units,
        paste.expected_code_units,
        'clipboard paste must preserve every code unit',
      );
      assert(
        digest.test(paste.expected_sha256) &&
          receiver.sha256 === paste.expected_sha256,
        'clipboard paste digest must match the actual copied source',
      );
    }
    assert.notEqual(
      pastes[0].request_nonce,
      pastes[1].request_nonce,
      'clipboard readbacks must have distinct fresh nonces',
    );

    const measurements = row.observations?.control_measurements;
    assert(
      Array.isArray(measurements) && measurements.length > 0,
      'actual native control observations required',
    );

    const imeTasks = [
      'editor_search',
      'markdown_search',
      'mermaid_search',
      'image_tools',
      'large_tools',
      'preferences',
    ];
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
        ]) {
          const observed = measurements.find(
            (m) => m.profile === context + '-' + scale.toFixed(1) + ':' + task,
          );
          assert(
            observed?.controls?.length > 0 &&
              Math.abs(observed.font_scale - scale) < 0.011,
            'actual task profile controls missing',
          );
          if (context === 'ime') {
            assert.equal(
              observed.ime_applicable,
              imeTasks.includes(task),
              'task IME applicability must be explicit',
            );
            if (imeTasks.includes(task))
              assert.equal(
                observed.ime_visible,
                true,
                'applicable task must observe actual native IME',
              );
          }
        }
    for (const operation of ['Find next', 'Go to line']) {
      const record = measurements.find(
        (m) => m.pending_read?.operation === operation,
      )?.pending_read;
      assert(
        record &&
          record.held?.entered_count > 0 &&
          record.held.provider_process_id > 0 &&
          record.held.provider_process_id === record.held.control_process_id &&
          record.held.entered_process_id === record.held.provider_process_id &&
          record.held.entered_on_main_thread === false,
        'pending native read requires actual provider entry/PID',
      );
      assert(
        record.held.released === false &&
          record.cancelled_before_release === true &&
          record.held_after?.released === true &&
          record.held_after.finished === true &&
          record.held_after.timed_out === false,
        'pending read cancellation must precede release and finish cleanly',
      );
      assert(
        record.position_unchanged === true &&
          digest.test(record.source_before) &&
          record.source_before === record.source_after,
        'cancelled read must preserve position and original source',
      );
    }
    for (const measurement of measurements) {
      if (measurement.pending_read) continue;
      assert(measurement.controls?.length > 0, 'native control group empty');
      for (const control of measurement.controls) {
        assert(
          control.label?.trim() &&
            control.width >= 47.5 &&
            control.height >= 47.5 &&
            control.hit === true &&
            control.native?.whole_control_visible === true,
          'native control name/target/hit/visibility failed',
        );
        const large =
          control.text_size >= 24 ||
          (control.text_size >= 18.66 && Number(control.font_weight) >= 700);
        if (!control.disabled)
          assert(
            control.contrast >= (large ? 2.99 : 4.49),
            'actual computed control contrast failed',
          );
      }
    }
  }
  const kinds = {
    4: ['utf8'],
    5: ['utf8'],
    6: ['png_pixels'],
    7: ['json_save', 'json_receiver'],
  }[row.journey];
  if (kinds)
    for (const kind of kinds)
      assert(
        row.readbacks?.some((r) => r.kind === kind && r.verified === true),
        'required actual ' + kind + ' readback missing',
      );
}

export async function validateRecoveryEvidence(
  evidence,
  { directory, expectedSource, installedReceipt },
) {
  assert(evidence.schema_version === 1, 'invalid evidence schema');
  assert(
    sourcePattern.test(expectedSource),
    'expected full source commit required',
  );
  const { role, api_level: api, identity, journeys } = evidence;
  requiredVariants(role, api, 1);
  assert(
    identity?.source_commit === expectedSource &&
      identity.native_source_commit === expectedSource &&
      identity.frontend_source_commit === expectedSource,
    'compiled source identity mismatch',
  );
  assert(
    identity.build_variant === role && identity.api_level === api,
    'runtime role/API identity mismatch',
  );
  assert(
    installedReceipt?.source_commit === expectedSource,
    'installed receipt source mismatch',
  );
  assert.equal(
    installedReceipt.recovery_probe_variant,
    role === 'ordinary' ? 'none' : 'compiled_test_only',
    'installed role mismatch',
  );
  for (const [kind, key, pkg] of [
    ['application', 'application_sha256', 'package_identifier'],
    ['instrumentation', 'instrumentation_sha256', 'instrumentation_package'],
  ]) {
    const entries = installedReceipt.artifacts.filter((a) => a.kind === kind);
    assert.equal(entries.length, 1, 'exact installed package receipt required');
    assert(
      digest.test(identity[key]) &&
        identity[key] === entries[0].sha256 &&
        identity[pkg] === entries[0].package,
      'installed package hash/identity mismatch',
    );
  }
  const clipboard = identity.clipboard_provider;
  assert(
    clipboard &&
      clipboard.legacy_authority ===
        identity.package_identifier + '.clipboard' &&
      clipboard.legacy_declared_exported === true &&
      clipboard.legacy_grant_uri_permissions === false &&
      clipboard.legacy_enabled === api < 28 &&
      clipboard.legacy_resolvable === api < 28 &&
      clipboard.file_provider_private === true,
    'installed clipboard provider must match its legacy SDK range and retain the private FileProvider',
  );
  for (const key of [
    'version',
    'channel',
    'android_version',
    'webview_package',
    'webview_version',
  ])
    assert(
      typeof identity[key] === 'string' && identity[key].length > 0,
      'missing runtime identity: ' + key,
    );
  assert(
    Array.isArray(journeys) &&
      journeys.length === 10 &&
      new Set(journeys.map((j) => j.journey)).size === 10 &&
      journeys.every(
        (j) => Number.isInteger(j.journey) && j.journey >= 1 && j.journey <= 10,
      ),
    'ten unique report journeys required',
  );
  for (const row of journeys) {
    identityMatches(row.identity, identity);
    const required = requiredVariants(role, api, row.journey);
    assert.equal(
      row.status,
      required.length ? 'pass' : 'not_applicable',
      'journey status incomplete',
    );
    if (!required.length) {
      assert.equal(
        row.reason,
        'ordinary_tasks_qualified_separately',
        'not-applicable role reason required',
      );
      continue;
    }
    clean(row.completion);
    assert(row.attempt === 1 || row.attempt === 2, 'attempt cap exceeded');
    if (row.attempt === 2) {
      assert(
        row.previous_attempts?.length === 1 &&
          row.previous_attempts[0].attempt === 1 &&
          row.previous_attempts[0].status === 'fail',
        'previous failed attempt must be retained',
      );
      for (const attempt of row.previous_attempts) {
        await evidenceFile(directory, attempt.log);
        if (attempt.screenshot)
          await evidenceFile(directory, attempt.screenshot, true);
      }
    }
    await evidenceFile(directory, row.log);
    await evidenceFile(directory, row.screenshot, true);
    const profile = row.profile;
    assert(
      profile &&
        profile.css_width > 0 &&
        profile.css_height > 0 &&
        profile.font_scale > 0 &&
        ['gestural', 'three_button'].includes(profile.navigation_mode),
      'actual profile required',
    );
    assert(
      profile.native_visible?.right > profile.native_visible?.left &&
        profile.native_visible?.bottom > profile.native_visible?.top,
      'native visible frame required',
    );
    assert(
      Array.isArray(row.variants) &&
        new Set(row.variants.map((v) => v.id)).size === row.variants.length,
      'duplicate variant',
    );
    for (const id of required) {
      const variant = row.variants.find((v) => v.id === id);
      assert(
        variant?.status === 'pass' && variant.observed === true,
        'required variant not observed/pass: ' + id,
      );
    }
    validateObservedDetails(row, role, api);
    if ([4, 5, 6, 7].includes(row.journey)) {
      assert(
        row.readbacks?.length,
        'actual destination/receiver readback required',
      );
      for (const result of row.readbacks)
        assert(
          result.verified === true &&
            digest.test(result.expected_sha256) &&
            result.expected_sha256 === result.actual_sha256,
          'exact readback mismatch',
        );
    }
  }
  return {
    qualified: true,
    source_commit: expectedSource,
    role,
    api_level: api,
    journeys: 10,
  };
}

export async function collectRecoveryEvidence(
  directory,
  role,
  api,
  expectedSource,
  installedReceipt,
) {
  const files = (await readdir(directory)).filter((name) =>
    /-attempt-[12](?:-logcat)?\.txt$/u.test(name),
  );
  const observations = new Map();
  for (const name of files) {
    const text = await readFile(join(directory, name), 'utf8');
    for (const line of text.split(/\r?\n/u)) {
      const at = line.indexOf('s047_journey_evidence=');
      if (at < 0) continue;
      let row;
      try {
        row = JSON.parse(line.slice(at + 's047_journey_evidence='.length));
      } catch {
        throw new Error('malformed journey evidence in ' + name);
      }
      const match = name.match(/^(.*)-attempt-([12])(?:-logcat)?\.txt$/u);
      const stem = match[1],
        attempt = Number(match[2]);
      const marker = row;
      assert(
        Number.isInteger(marker.journey) &&
          marker.journey >= 1 &&
          marker.journey <= 10,
        'invalid row marker',
      );
      assert.equal(
        marker.file,
        's047-row-' + marker.journey + '.json',
        'unexpected receipt filename',
      );
      const receiptBytes = await readFile(
        join(
          directory,
          stem +
            '-attempt-' +
            attempt +
            '-s047-row-' +
            marker.journey +
            '.json',
        ),
      );
      assert(
        receiptBytes.length > 0 && receiptBytes.length <= 2 * 1024 * 1024,
        'bounded actual row receipt required',
      );
      assert.equal(
        createHash('sha256').update(receiptBytes).digest('hex'),
        marker.sha256,
        'captured row hash mismatch',
      );
      row = JSON.parse(receiptBytes.toString('utf8'));
      assert.equal(row.journey, marker.journey, 'row marker identity mismatch');
      const key = stem + ':' + attempt + ':' + row.journey;
      const encoded = JSON.stringify(row);
      if (observations.has(key)) {
        assert.equal(
          observations.get(key).encoded,
          encoded,
          'conflicting duplicate journey marker',
        );
        continue;
      }
      const status = Object.fromEntries(
        (
          await readFile(
            join(directory, stem + '-attempt-' + attempt + '-status.txt'),
            'utf8',
          )
        )
          .trim()
          .split('\n')
          .map((s) => {
            const [k, v] = s.split('=');
            return [k, Number(v)];
          }),
      );
      observations.set(key, { encoded, row, stem, attempt, status });
    }
  }
  const rows = [];
  for (let id = 1; id <= 10; id++) {
    const required = requiredVariants(role, api, id);
    if (!required.length) {
      rows.push({
        journey: id,
        status: 'not_applicable',
        reason: 'ordinary_tasks_qualified_separately',
        identity: null,
      });
      continue;
    }
    const candidates = [...observations.values()].filter(
      (o) => o.row.journey === id,
    );
    const passing = candidates.filter(
      (o) =>
        o.status.adb_exit_status === 0 &&
        o.status.marker_present === 1 &&
        o.status.junit_success === 1 &&
        o.status.instrumentation_failure === 0 &&
        o.status.logcat_exit_status === 0,
    );
    assert(passing.length <= 1, 'conflicting clean attempts for journey ' + id);
    if (!passing.length) {
      const stem =
        role === 'fault_probe'
          ? 's047-faults'
          : [
              's047-cold',
              's047-markdown',
              's047-source-failure',
              's047-authoring',
              's047-authoring',
              's047-images',
              's047-authoring',
              's047-layout',
              's047-back',
              's047-about',
            ][id - 1];
      const attempts = [];
      for (const attempt of [1, 2]) {
        const log = stem + '-attempt-' + attempt + '.txt';
        if (!files.includes(log)) continue;
        const statusText = await readFile(
          join(directory, stem + '-attempt-' + attempt + '-status.txt'),
          'utf8',
        ).catch(() => null);
        const completion =
          statusText === null
            ? null
            : Object.fromEntries(
                statusText
                  .trim()
                  .split('\n')
                  .map((s) => {
                    const [k, v] = s.split('=');
                    return [k, Number(v)];
                  }),
              );
        const screenshot =
          stem + '-attempt-' + attempt + '-s047-row-' + id + '.png';
        const png = await readFile(join(directory, screenshot)).catch(
          () => null,
        );
        attempts.push({
          attempt,
          status: 'fail',
          log,
          completion,
          screenshot: png?.length ? screenshot : null,
          screenshot_unavailable: !png?.length,
        });
      }
      rows.push({
        journey: id,
        status: attempts.length ? 'fail' : 'not_run',
        reason: attempts.length
          ? 'no_clean_complete_observation'
          : 'task_not_observed',
        identity: null,
        variants: required.map((id) => ({
          id,
          status: 'not_run',
          observed: false,
        })),
        attempts,
      });
      continue;
    }
    const selected = passing[0],
      row = {
        ...selected.row,
        attempt: selected.attempt,
        completion: selected.status,
        log: selected.stem + '-attempt-' + selected.attempt + '.txt',
        screenshot:
          selected.stem +
          '-attempt-' +
          selected.attempt +
          '-s047-row-' +
          id +
          '.png',
      };
    if (selected.attempt === 2) {
      const log = selected.stem + '-attempt-1.txt';
      await evidenceFile(directory, log);
      row.previous_attempts = [
        {
          attempt: 1,
          status: 'fail',
          log,
          completion: Object.fromEntries(
            (
              await readFile(
                join(directory, selected.stem + '-attempt-1-status.txt'),
                'utf8',
              )
            )
              .trim()
              .split('\n')
              .map((s) => {
                const [k, v] = s.split('=');
                return [k, Number(v)];
              }),
          ),
          screenshot: (
            await readFile(
              join(
                directory,
                selected.stem + '-attempt-1-s047-row-' + id + '.png',
              ),
            ).catch(() => null)
          )?.length
            ? selected.stem + '-attempt-1-s047-row-' + id + '.png'
            : null,
        },
      ];
    }
    rows.push(row);
  }
  const identity = rows.find((r) => r.status === 'pass')?.identity ?? null;
  for (const row of rows)
    if (row.status === 'not_applicable') row.identity = identity;
  return { schema_version: 1, role, api_level: api, identity, journeys: rows };
}

async function main() {
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .reduce(
        (out, arg, i, all) =>
          i % 2 === 0 ? [...out, [arg.replace(/^--/u, ''), all[i + 1]]] : out,
        [],
      ),
  );
  assert(
    args.directory && args.source && args.role && args.api,
    '--directory --source --role --api required',
  );
  const installed = JSON.parse(
    await readFile(
      join(args.directory, 'android-tested-candidate/tested-apk-receipt.json'),
      'utf8',
    ),
  );
  let evidence;
  try {
    evidence = args.input
      ? JSON.parse(await readFile(args.input, 'utf8'))
      : await collectRecoveryEvidence(
          args.directory,
          args.role,
          Number(args.api),
          args.source,
          installed,
        );
  } catch (error) {
    evidence = {
      schema_version: 1,
      role: args.role,
      api_level: Number(args.api),
      identity: null,
      collection_error: error.message,
      journeys: Array.from({ length: 10 }, (_, index) => {
        const journey = index + 1,
          required = requiredVariants(args.role, Number(args.api), journey);
        return {
          journey,
          status: required.length ? 'fail' : 'not_applicable',
          reason: required.length
            ? 'collection_failed'
            : 'ordinary_tasks_qualified_separately',
          identity: null,
        };
      }),
    };
  }
  const output =
    args.output ?? join(args.directory, 's047-recovery-evidence.json');
  await writeFile(
    output,
    JSON.stringify(
      { ...evidence, qualification: { qualified: false } },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  if (evidence.collection_error) throw new Error(evidence.collection_error);
  const result = await validateRecoveryEvidence(evidence, {
    directory: args.directory,
    expectedSource: args.source,
    installedReceipt: installed,
  });
  await writeFile(
    output,
    JSON.stringify({ ...evidence, qualification: result }, null, 2) + '\n',
    'utf8',
  );
  console.log('s047_qualification=' + JSON.stringify(result));
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
