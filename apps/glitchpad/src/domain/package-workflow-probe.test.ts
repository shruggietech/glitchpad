import { invoke } from '@tauri-apps/api/core';
import type { RecoveryRecordDraft } from './recovery-gateway';
interface BridgeArguments {
  offset: number;
  length: number;
  recordId: string;
  expected: unknown;
  record: RecoveryRecordDraft;
  request: {
    bytes: number[];
    operation_id: string;
    expected_session_revision: number;
  };
}
import contract from '../../../../packaging/desktop/document-workflow-probe.json';
import { runPackageWorkflowProbe } from './package-workflow-probe';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
const call = vi.mocked(invoke);
const encoder = new TextEncoder();

const bridge = (failAt = '', disabled = false, invalidResponse = '') => {
  let readCount = 0;
  let bytes = encoder.encode(contract.initial_text);
  let closed = false;
  let failed = false;
  const records = new Map<string, RecoveryRecordDraft>();
  const identity = {
    authority: 'filesystem',
    scope: 'test-volume',
    token: 'opaque',
    strength: 'strong',
  };
  let revision = {
    identity,
    byte_length: bytes.length,
    modified_unix_nanos: '1',
    change_token: null,
  };
  const source = {
    source_id: 'probe-source',
    descriptor: {
      identity,
      display_name: contract.filename,
      claimed_media_type: 'text/markdown',
      byte_length: bytes.length,
      modified_unix_ms: 1,
      kind: 'file',
      capabilities: {
        read: true,
        seek: true,
        stream: true,
        metadata: true,
        observe_revision: true,
        revalidate: true,
        watch: true,
        write: true,
        replace_atomically: true,
        persistent_permission: false,
        rename: true,
        observe_deletion: true,
        reopen: true,
        reveal_location: false,
      },
    },
    external_revision: revision,
  };
  call.mockImplementation((command, raw) =>
    Promise.resolve().then(() => {
      const args = raw as BridgeArguments | undefined;
      if (command === failAt && !failed) {
        failed = true;
        throw new Error('injected_bridge_failure');
      }
      if (command === 'begin_desktop_document_workflow_probe')
        return disabled
          ? null
          : {
              sequence: 1,
              kind: 'command_line',
              status: 'opened',
              source,
              error: null,
            };
      if (command === 'identify_image_source') return null;
      if (command === 'read_source_range') {
        readCount += 1;
        const responseBytes =
          invalidResponse === 'reread' && readCount > 1
            ? encoder.encode('incorrect saved bytes')
            : bytes;
        return {
          source_id: source.source_id,
          offset: args!.offset,
          bytes: [
            ...responseBytes.slice(args!.offset, args!.offset + args!.length),
          ],
          end_of_source: true,
        };
      }
      if (command === 'query_source_metadata')
        return {
          source_id: source.source_id,
          external_revision: {
            ...revision,
            identity: {
              ...identity,
              scope: 'desktop_source',
              token: source.source_id,
            },
            change_token:
              'sha256:' +
              (revision.modified_unix_nanos === '1' ? 'a' : 'b').repeat(64),
          },
          display_name: contract.filename,
          source_kind: 'file',
          byte_length: bytes.length,
          modified_unix_nanos: null,
          created_unix_nanos: null,
          accessed_unix_nanos: null,
          write_state: 'writable',
          identity_confidence: 'strong',
        };
      if (command === 'revalidate_source')
        return {
          source_id: source.source_id,
          current:
            invalidResponse === 'revalidation_revision'
              ? { ...revision, modified_unix_nanos: 'unexpected' }
              : revision,
          expected: args!.expected,
          status:
            invalidResponse === 'revalidation_changed' ? 'changed' : 'match',
        };
      if (command === 'note_source_session_revision') return true;
      if (command === 'save_source') {
        const previous = revision;
        bytes = Uint8Array.from(args!.request.bytes);
        revision = {
          ...revision,
          byte_length: bytes.length,
          modified_unix_nanos: '2',
        };
        return {
          operation_id: args!.request.operation_id,
          source_id: source.source_id,
          accepted_session_revision: args!.request.expected_session_revision,
          previous_external_revision: previous,
          new_external_revision: revision,
          byte_count: bytes.length,
          durability: 'atomic_file_and_directory',
        };
      }
      if (command === 'persist_recovery') {
        const r = args!.record;
        records.set(r.record_id, r);
        return {
          record_id: r.record_id,
          status: 'available',
          display_hint: contract.filename,
        };
      }
      if (command === 'load_recovery') return records.get(args!.recordId);
      if (command === 'inventory_recovery')
        return [
          [...records.values()].map((r) => ({
            record_id: r.record_id,
            status: 'available',
            display_hint: contract.filename,
          })),
          0,
          0,
        ];
      if (command === 'remove_recovery') return records.delete(args!.recordId);
      if (command === 'close_desktop_source') {
        closed = true;
        return;
      }
      if (command === 'complete_desktop_document_workflow_probe') {
        expect(closed).toBe(true);
        expect(records.size).toBe(0);
        expect(new TextDecoder().decode(bytes)).toBe(contract.saved_text);
        return true;
      }
      if (command === 'record_desktop_lifecycle_probe') return true;
      throw new Error('unexpected_bridge_command:' + command);
    }),
  );
  return { records, isClosed: () => closed };
};

beforeEach(() => {
  call.mockReset();
});

test('disabled probe performs no document or recovery operation', async () => {
  bridge('', true);
  await expect(runPackageWorkflowProbe()).resolves.toBe(false);
  expect(call.mock.calls.map(([c]) => c)).toEqual([
    'begin_desktop_document_workflow_probe',
  ]);
});

test('uses actual production read/edit/save/metadata/recovery bridges before completion', async () => {
  const host = bridge();
  await expect(runPackageWorkflowProbe()).resolves.toBe(true);
  for (const command of [
    'read_source_range',
    'note_source_session_revision',
    'save_source',
    'query_source_metadata',
    'persist_recovery',
    'load_recovery',
    'inventory_recovery',
    'remove_recovery',
    'close_desktop_source',
  ])
    expect(call.mock.calls.some(([c]) => c === command)).toBe(true);
  expect(host.records.size).toBe(0);
  expect(host.isClosed()).toBe(true);
  expect(call.mock.calls.at(-1)).toEqual([
    'record_desktop_lifecycle_probe',
    { event: 'document-workflow-ready', sequence: null },
  ]);
});

for (const command of [
  'identify_image_source',
  'read_source_range',
  'query_source_metadata',
  'persist_recovery',
  'load_recovery',
  'save_source',
  'revalidate_source',
  'remove_recovery',
  'close_desktop_source',
]) {
  test(
    'failure in ' +
      command +
      ' cannot create completion and cleans owned resources',
    async () => {
      const host = bridge(command);
      await expect(runPackageWorkflowProbe()).rejects.toThrow();
      expect(
        call.mock.calls.some(
          ([c]) => c === 'complete_desktop_document_workflow_probe',
        ),
      ).toBe(false);
      expect(
        call.mock.calls.some(
          ([c, a]) =>
            c === 'record_desktop_lifecycle_probe' &&
            (a as { event?: string } | undefined)?.event ===
              'document-workflow-ready',
        ),
      ).toBe(false);
      expect(host.records.size).toBe(0);
      expect(host.isClosed()).toBe(true);
    },
  );
}

for (const response of [
  'revalidation_changed',
  'revalidation_revision',
  'reread',
]) {
  test(
    'incorrect successful ' + response + ' response prevents completion',
    async () => {
      const host = bridge('', false, response);
      await expect(runPackageWorkflowProbe()).rejects.toThrow();
      expect(
        call.mock.calls.some(
          ([command]) => command === 'complete_desktop_document_workflow_probe',
        ),
      ).toBe(false);
      expect(host.records.size).toBe(0);
      expect(host.isClosed()).toBe(true);
    },
  );
}
