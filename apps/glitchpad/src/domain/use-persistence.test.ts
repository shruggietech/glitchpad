import { act, renderHook, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';

import { initialSessions } from '../test/fixtures';
import {
  defaultPreferences,
  diagnosticEnvironment,
  type DiagnosticEvent,
  type SessionState,
} from './persistence';
import type { PersistenceGateway } from './persistence-gateway';
import { usePersistence } from './use-persistence';
import { recordFailure } from './diagnostic-failures';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const emptySession: SessionState = {
  schema_version: 1,
  window: { active_session_index: null, inspector: 'closed' },
  sessions: [],
};

const gateway = (
  overrides: Partial<PersistenceGateway> = {},
): PersistenceGateway => ({
  loadPreferences: vi.fn().mockResolvedValue({
    status: 'loaded',
    value: defaultPreferences(),
    warning_code: null,
  }),
  persistPreferences: vi.fn().mockResolvedValue(undefined),
  loadSession: vi.fn().mockResolvedValue({
    status: 'defaulted',
    value: emptySession,
    warning_code: null,
  }),
  persistSession: vi.fn().mockResolvedValue(undefined),
  appendDiagnostic: vi.fn().mockResolvedValue(undefined),
  previewDiagnostics: vi.fn().mockResolvedValue({
    status: 'defaulted',
    value: {
      schema_version: 1,
      generated_unix_ms: 1,
      environment: {
        product_version: '0.0.0',
        specification_version: '0.0.0',
        platform: 'unknown',
        architecture: 'unknown',
        webview_version: null,
        core_version: '0.0.0',
        build_commit: null,
      },
      events: [],
    },
    warning_code: null,
  }),
  reset: vi.fn().mockResolvedValue(false),
  ...overrides,
});

describe('usePersistence', () => {
  it('includes a delayed successful failure append before freezing the native preview', async () => {
    const internals = Object.getOwnPropertyDescriptor(
      window,
      '__TAURI_INTERNALS__',
    );
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    });
    const nativeEvents: DiagnosticEvent[] = [];
    let finishAppend!: () => void;
    let capturedEvent!: DiagnosticEvent;
    vi.mocked(invoke).mockImplementationOnce(
      (_command, args) =>
        new Promise<void>((resolve) => {
          capturedEvent = (args as { event: DiagnosticEvent }).event;
          let finished = false;
          finishAppend = () => {
            if (finished) return;
            finished = true;
            nativeEvents.push(capturedEvent);
            resolve();
          };
        }),
    );
    const persistence = gateway({
      previewDiagnostics: vi.fn<PersistenceGateway['previewDiagnostics']>(
        (now) =>
          Promise.resolve({
            status: 'loaded',
            warning_code: null,
            value: {
              schema_version: 1,
              generated_unix_ms: now,
              environment: diagnosticEnvironment(),
              events: [...nativeEvents],
            },
          }),
      ),
    });
    const { result } = renderHook(() =>
      usePersistence([], null, 'closed', persistence),
    );
    let preview:
      ReturnType<typeof result.current.previewDiagnostics> | undefined;
    try {
      await act(async () => {
        await Promise.resolve();
      });
      recordFailure('source', 'delivery', 'source_delivery_failed');
      expect(invoke).toHaveBeenCalledWith(
        'append_diagnostic',
        expect.objectContaining({ event: capturedEvent }),
      );
      preview = result.current.previewDiagnostics();
      await Promise.resolve();
      finishAppend();
      const frozen = await preview;
      expect(frozen.events).toContainEqual(capturedEvent);
      expect(persistence.previewDiagnostics).toHaveBeenCalledOnce();

      vi.mocked(invoke).mockImplementationOnce((_command, args) => {
        nativeEvents.push((args as { event: DiagnosticEvent }).event);
        return Promise.resolve();
      });
      recordFailure('image', 'render', 'image_render_failed');
      expect(frozen.events).not.toContainEqual(nativeEvents[1]);
      expect((await result.current.previewDiagnostics()).events).toContainEqual(
        nativeEvents[1],
      );
    } finally {
      finishAppend?.();
      await preview;
      if (internals)
        Object.defineProperty(window, '__TAURI_INTERNALS__', internals);
      else Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
      vi.mocked(invoke).mockReset();
    }
  });

  it('clears captured fallback diagnostics after native reset while retaining newer failures', async () => {
    recordFailure('markdown', 'projection', 'markdown_projection_failed');
    let finishReset!: (value: boolean) => void;
    const persistence = gateway({
      reset: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            finishReset = resolve;
          }),
      ),
    });
    const { result } = renderHook(() =>
      usePersistence([], null, 'closed', persistence),
    );
    await act(async () => {
      await Promise.resolve();
    });
    const before = await result.current.previewDiagnostics();
    expect(
      before.events.some(
        (event) => event.error_code === 'markdown_projection_failed',
      ),
    ).toBe(true);
    let clearing: Promise<void> | undefined;
    act(() => {
      clearing = result.current.reset('diagnostics');
    });
    await waitFor(() =>
      expect(persistence.reset).toHaveBeenCalledWith('diagnostics'),
    );
    recordFailure('source', 'delivery', 'source_delivery_failed');
    await act(async () => {
      finishReset(true);
      await clearing;
    });
    const after = await result.current.previewDiagnostics();
    expect(
      after.events.some(
        (event) => event.error_code === 'markdown_projection_failed',
      ),
    ).toBe(false);
    expect(
      after.events.some(
        (event) => event.error_code === 'source_delivery_failed',
      ),
    ).toBe(true);
  });

  it('retains fallback diagnostic evidence after rejected native Clear', async () => {
    recordFailure('image', 'render', 'image_render_failed');
    const persistence = gateway({
      reset: vi.fn().mockRejectedValue(new Error('clear refused')),
    });
    const { result } = renderHook(() =>
      usePersistence([], null, 'closed', persistence),
    );
    await act(async () => {
      await Promise.resolve();
    });
    const before = await result.current.previewDiagnostics();
    await act(async () => {
      await expect(result.current.reset('diagnostics')).rejects.toThrow(
        'clear refused',
      );
    });
    expect((await result.current.previewDiagnostics()).events).toEqual(
      before.events,
    );
  });
  it('loads preferences and coalesces persistence away from startup', async () => {
    vi.useFakeTimers();
    try {
      const persistence = gateway({
        loadPreferences: vi.fn().mockResolvedValue({
          status: 'loaded',
          value: { ...defaultPreferences(), theme: 'dark' },
          warning_code: null,
        }),
      });
      const { result } = renderHook(() =>
        usePersistence(initialSessions, 'welcome', 'closed', persistence),
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.preferences.theme).toBe('dark');
      expect(result.current.restoredSession).toEqual(emptySession);
      act(() =>
        result.current.updatePreferences({
          ...result.current.preferences,
          tab_width: 2,
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
      expect(persistence.persistPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ tab_width: 2 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('loads a bounded session projection for native startup restoration', async () => {
    const restored: SessionState = {
      schema_version: 1,
      window: { active_session_index: 0, inspector: 'metadata' },
      sessions: [
        {
          session_key: 'session',
          display_hint: 'notes.md',
          renderer_id: 'markdown',
          presentation_mode: 'rendered',
          source_reference: '70cbf05c-53f5-4442-9ace-9d576529714c',
          recovery_record_id: null,
        },
      ],
    };
    const persistence = gateway({
      loadSession: vi.fn().mockResolvedValue({
        status: 'loaded',
        value: restored,
        warning_code: null,
      }),
    });
    const { result } = renderHook(() =>
      usePersistence([], null, 'closed', persistence),
    );
    await waitFor(() =>
      expect(result.current.restoredSession).toEqual(restored),
    );
  });

  it('records a session-load warning as a diagnostic failure', async () => {
    const persistence = gateway({
      loadSession: vi.fn().mockResolvedValue({
        status: 'corrupt',
        value: emptySession,
        warning_code: 'session_corrupt',
      }),
    });
    renderHook(() => usePersistence([], null, 'closed', persistence));

    await waitFor(() =>
      expect(persistence.appendDiagnostic).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warning',
          event_id: 'state_load_failed',
          error_code: 'session_corrupt',
        }),
        expect.any(Number),
      ),
    );
  });

  it('cancels a pending preference write before category reset', async () => {
    vi.useFakeTimers();
    try {
      const persistence = gateway();
      const { result } = renderHook(() =>
        usePersistence([], null, 'closed', persistence),
      );
      await act(async () => {
        await Promise.resolve();
      });
      act(() =>
        result.current.updatePreferences({
          ...result.current.preferences,
          theme: 'dark',
        }),
      );
      await act(async () => result.current.reset('preferences'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
      expect(persistence.reset).toHaveBeenCalledWith('preferences');
      expect(persistence.persistPreferences).not.toHaveBeenCalled();
      expect(result.current.preferences).toEqual(defaultPreferences());
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes a pending preference write when the application unmounts', async () => {
    vi.useFakeTimers();
    try {
      const persistence = gateway();
      const { result, unmount } = renderHook(() =>
        usePersistence([], null, 'closed', persistence),
      );
      await act(async () => {
        await Promise.resolve();
      });
      act(() =>
        result.current.updatePreferences({
          ...result.current.preferences,
          theme: 'dark',
        }),
      );
      unmount();
      expect(persistence.persistPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'dark' }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes the latest pending session projection when the application unmounts', async () => {
    vi.useFakeTimers();
    try {
      const snapshots: SessionState[] = [];
      const persistSession: PersistenceGateway['persistSession'] = (
        session,
      ) => {
        snapshots.push(session);
        return Promise.resolve();
      };
      const persistence = gateway({ persistSession });
      const { unmount, rerender } = renderHook<
        unknown,
        {
          inspector: SessionState['window']['inspector'];
        }
      >(({ inspector }) => usePersistence([], null, inspector, persistence), {
        initialProps: { inspector: 'closed' },
      });
      await act(async () => {
        await Promise.resolve();
      });
      rerender({ inspector: 'diagnostics' });
      unmount();

      expect(snapshots.at(-1)?.window.inspector).toBe('diagnostics');
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back without blocking when storage is unavailable', async () => {
    const persistence = gateway({
      loadPreferences: vi.fn().mockRejectedValue(new Error('private path')),
    });
    const { result } = renderHook(() =>
      usePersistence([], null, 'closed', persistence),
    );
    await waitFor(() =>
      expect(result.current.warning).toMatch(/unavailable/iu),
    );
    expect(result.current.preferences).toEqual(defaultPreferences());
    expect(result.current.warning).not.toContain('private path');
  });
});
