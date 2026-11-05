import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RecoveryInventoryEntry, ShellSession } from './contracts';
import type { RecoveryGateway } from './recovery-gateway';
import { createTextDocument } from './text-document';
import { useRecovery } from './use-recovery';

const inventoryEntry = (
  status: RecoveryInventoryEntry['status'],
): RecoveryInventoryEntry => ({
  record_id: '37d21d4b-674d-41fa-b792-29b7c2012ed3',
  display_hint: 'draft.txt',
  updated_unix_ms: 10,
  expires_unix_ms: 20,
  committed_bytes: 100,
  status,
});

const dirtySession = (): ShellSession => ({
  id: 'draft',
  source: {
    identity: {
      authority: 'synthetic',
      scope: 'test',
      token: 'draft',
      strength: 'strong',
    },
    display_name: 'draft.txt',
    claimed_media_type: 'text/plain',
    byte_length: 5,
    modified_unix_ms: null,
    kind: 'memory',
    capabilities: {
      read: true,
      seek: false,
      stream: false,
      metadata: false,
      observe_revision: true,
      revalidate: true,
      watch: false,
      write: true,
      replace_atomically: true,
      persistent_permission: false,
      rename: false,
      observe_deletion: true,
      reopen: false,
      reveal_location: false,
    },
  },
  renderer: {
    id: 'text',
    label: 'Text',
    capabilities: {
      view: true,
      edit: true,
      navigate: false,
      search: false,
      zoom: false,
      copy: true,
      save: true,
      inspect_metadata: false,
    },
  },
  lifecycle: 'active',
  focus: 'active',
  integrity: 'dirty',
  source_state: 'available',
  dirty: true,
  revision: 1,
  saved_revision: 0,
  recovery_coverage: 'stale',
  content: 'draft',
  text_document: createTextDocument({
    rawText: 'draft',
    displayName: 'draft.txt',
  }),
});

const gateway = (
  overrides: Partial<RecoveryGateway> = {},
): RecoveryGateway => ({
  inventory: vi.fn().mockResolvedValue([]),
  persist: vi.fn().mockResolvedValue(inventoryEntry('available')),
  load: vi.fn(),
  remove: vi.fn().mockResolvedValue(true),
  ...overrides,
});

afterEach(() => vi.useRealTimers());

describe('useRecovery', () => {
  it('publishes an accepted committed recovery binding without another edit', async () => {
    const entry = inventoryEntry('available');
    const recoveryGateway = gateway({
      inventory: vi.fn().mockResolvedValue([entry]),
      load: vi.fn().mockResolvedValue({
        schema_version: 1,
        record_id: entry.record_id,
        display_hint: entry.display_hint,
        source_identity_hash: 'a'.repeat(64),
        base_revision_hash: 'b'.repeat(64),
        saved_session_revision: 1,
        snapshot_session_revision: 2,
        text_profile: {
          encoding: 'utf8',
          bom: 'absent',
          newlines: 'none',
          terminal_newline: 'absent',
          undecodable_bytes: 'none',
        },
        created_unix_ms: 5,
        updated_unix_ms: 10,
        expires_unix_ms: 20,
        content: 'draft',
        content_sha256: 'c'.repeat(64),
        eviction_eligible: false,
      }),
    });
    const { result } = renderHook(() => useRecovery([], recoveryGateway));
    await waitFor(() => expect(result.current.candidates).toEqual([entry]));

    await act(async () => {
      await result.current.accept(entry);
    });

    expect(result.current.recordIds.get(`recovery-${entry.record_id}`)).toBe(
      entry.record_id,
    );
  });

  it('surfaces safe notices for non-available startup inventory', async () => {
    const recoveryGateway = gateway({
      inventory: vi
        .fn()
        .mockResolvedValue([
          inventoryEntry('corrupted'),
          inventoryEntry('coverage_at_risk'),
        ]),
    });
    const { result } = renderHook(() => useRecovery([], recoveryGateway));

    await waitFor(() =>
      expect(result.current.warning).toMatch(/corrupted.*coverage at risk/i),
    );
    expect(result.current.candidates).toEqual([]);
  });

  it('retains failed resolved-record cleanup and retries it safely', async () => {
    vi.useFakeTimers();
    const remove = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue(true);
    const recoveryGateway = gateway({ remove });
    const { result, rerender } = renderHook(
      ({ sessions }) => useRecovery(sessions, recoveryGateway),
      { initialProps: { sessions: [dirtySession()] } },
    );

    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    rerender({ sessions: [] });
    await act(async () => Promise.resolve());
    expect(remove).toHaveBeenCalledOnce();
    expect(result.current.warning).toMatch(/will be retried safely/i);

    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(remove).toHaveBeenCalledTimes(2);
    expect(result.current.warning).toBeNull();
  });

  it('keeps inventory notices after an unrelated snapshot succeeds', async () => {
    vi.useFakeTimers();
    const recoveryGateway = gateway({
      inventory: vi.fn().mockResolvedValue([inventoryEntry('corrupted')]),
    });
    const { result } = renderHook(() =>
      useRecovery([dirtySession()], recoveryGateway),
    );
    await act(async () => Promise.resolve());
    expect(result.current.warning).toMatch(/corrupted recovery record/i);

    await act(async () => vi.advanceTimersByTimeAsync(2_000));

    expect(result.current.warning).toMatch(/corrupted recovery record/i);
  });

  it('persists raw text and its lossless profile', async () => {
    vi.useFakeTimers();
    const persist = vi.fn().mockResolvedValue(inventoryEntry('available'));
    const recoveryGateway = gateway({ persist });
    const session = dirtySession();
    session.content = 'first\nsecond\n';
    session.text_document = createTextDocument({
      rawText: 'first\r\nsecond\n',
      displayName: 'draft.txt',
      encoding: 'utf16_be_bom',
    });
    const { result } = renderHook(() =>
      useRecovery([session], recoveryGateway),
    );

    await act(async () => vi.advanceTimersByTimeAsync(2_000));

    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'first\r\nsecond\n',
        text_profile: {
          encoding: 'utf16_be_bom',
          bom: 'present',
          newlines: 'mixed',
          terminal_newline: 'present',
          undecodable_bytes: 'none',
        },
      }),
    );
    expect(result.current.recordIds.get(session.id)).toMatch(
      /^[0-9a-f-]{36}$/u,
    );
  });
});

it('flushes a draft before restart and retains newer edits in ordered snapshots', async () => {
  const persisted: string[] = [];
  const g = gateway({
    persist: vi.fn(
      (record: import('./recovery-gateway').RecoveryRecordDraft) => {
        persisted.push(record.content);
        return Promise.resolve(inventoryEntry('available'));
      },
    ),
  });
  const first = dirtySession();
  const { result, rerender } = renderHook(
    ({ sessions }) => useRecovery(sessions, g),
    { initialProps: { sessions: [first] } },
  );
  await act(async () => {
    await result.current.flush();
  });
  expect(persisted).toEqual(['draft']);
  rerender({
    sessions: [
      {
        ...first,
        revision: 2,
        content: 'new',
        text_document: createTextDocument({
          rawText: 'new',
          displayName: 'draft.txt',
        }),
      },
    ],
  });
  const waits: Promise<unknown>[] = [];
  act(() => {
    window.dispatchEvent(
      new CustomEvent('glitchpad:before-restart', {
        detail: {
          waitUntil: (promise: Promise<unknown>) => {
            waits.push(promise);
          },
        },
      }),
    );
  });
  await act(async () => {
    await Promise.all(waits);
  });
  expect(persisted).toEqual(['draft', 'new']);
});

it('retries a failed snapshot for the same unchanged revision', async () => {
  const persist = vi
    .fn()
    .mockRejectedValueOnce(new Error('temporary storage failure'))
    .mockResolvedValue(inventoryEntry('available'));
  const recoveryGateway = gateway({ persist });
  const { result } = renderHook(() =>
    useRecovery([dirtySession()], recoveryGateway),
  );
  await act(async () => {
    await expect(result.current.flush()).rejects.toThrow(
      'recovery_write_failed',
    );
  });
  await act(async () => {
    await expect(result.current.flush()).resolves.toBeUndefined();
  });
  expect(persist).toHaveBeenCalledTimes(2);
});

it('keeps restart flush retryable after application unmount', async () => {
  const persist = vi
    .fn()
    .mockRejectedValueOnce(new Error('temporary'))
    .mockResolvedValue(inventoryEntry('available'));
  const recoveryGateway = gateway({ persist });
  const { unmount } = renderHook(() =>
    useRecovery([dirtySession()], recoveryGateway),
  );
  unmount();
  await act(async () => {
    await Promise.resolve();
  });
  const waits: Promise<unknown>[] = [];
  const restart = () => {
    window.dispatchEvent(
      new CustomEvent('glitchpad:before-restart', {
        detail: {
          waitUntil: (pending: Promise<unknown>) => waits.push(pending),
        },
      }),
    );
  };
  act(restart);
  await Promise.allSettled(waits);
  waits.length = 0;
  act(restart);
  expect(waits).toHaveLength(1);
  await expect(Promise.all(waits)).resolves.toEqual([undefined]);
  expect(persist).toHaveBeenCalledTimes(2);
});
