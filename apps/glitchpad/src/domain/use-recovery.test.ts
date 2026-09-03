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
    const { result } = renderHook(() => useRecovery([session], recoveryGateway));

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
