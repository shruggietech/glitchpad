import axe from 'axe-core';
import { EditorView } from '@codemirror/view';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { App, initialSessions } from './App';
import { RecoveryCandidateResolution } from './components/RecoveryResolution';
import type { RecoveryGateway } from './domain/recovery-gateway';
import type { MetadataGateway } from './domain/metadata-gateway';
import type { IntegrityProgress, IntegrityStartRequest } from './domain/contracts';
import { DESKTOP_CHROME_MAX_PX, REFERENCE_HEIGHT_PX } from './domain/tabs';
import { defaultPreferences } from './domain/persistence';
import type { PersistenceGateway } from './domain/persistence-gateway';
import type { AndroidRestorationGateway } from './domain/android-restoration-gateway';
import type { DesktopDeliveryGateway } from './domain/desktop-delivery-gateway';

const revision = {
  identity: initialSessions[2].source.identity,
  byte_length: 3,
  modified_unix_nanos: '1',
  change_token: null,
};

describe('document foundation shell', () => {
  const persistenceGateway = (overrides: Partial<PersistenceGateway> = {}): PersistenceGateway => ({
    loadPreferences: vi.fn().mockResolvedValue({ status: 'loaded', value: defaultPreferences(), warning_code: null }),
    persistPreferences: vi.fn().mockResolvedValue(undefined),
    loadSession: vi.fn().mockResolvedValue({ status: 'defaulted', value: { schema_version: 1, window: { active_session_index: null, inspector: 'closed' }, sessions: [] }, warning_code: null }),
    persistSession: vi.fn().mockResolvedValue(undefined),
    appendDiagnostic: vi.fn().mockResolvedValue(undefined),
    previewDiagnostics: vi.fn().mockResolvedValue({ status: 'loaded', value: { schema_version: 1, generated_unix_ms: 42, environment: { product_version: '0.0.0', specification_version: '0.0.0', platform: 'unknown', architecture: 'unknown', webview_version: null, core_version: '0.0.0', build_commit: null }, events: [] }, warning_code: null }),
    reset: vi.fn().mockResolvedValue(false),
    ...overrides,
  });

  it('opens native desktop deliveries through the compact application commands', async () => {
    const delivered = { ...initialSessions[2], id: 'desktop-source', source_id: 'source' };
    const choose = vi.fn().mockResolvedValue([{ sequence: 1, kind: 'dialog', status: 'opened', source: { source_id: 'source', descriptor: delivered.source, external_revision: revision }, error: null }]);
    const materialize = vi.fn().mockResolvedValue(delivered);
    const close = vi.fn().mockResolvedValue(undefined);
    const gateway: DesktopDeliveryGateway = {
      choose,
      drain: vi.fn().mockResolvedValue([]),
      close,
      materialize,
      saveAs: vi.fn().mockResolvedValue(true),
      subscribe: vi.fn().mockResolvedValue(() => undefined),
    };
    render(<App sessions={[]} desktopDeliveryGateway={gateway} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('tab', { name: /notes\.txt/i });
    expect(choose).toHaveBeenCalledOnce();
    expect(materialize).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /close notes\.txt/i }));
    await waitFor(() => expect(close).toHaveBeenCalledWith('source'));
  });

  it('projects editor changes into dirty shell state before save is available', () => {
    render(<App sessions={[initialSessions[2]]} />);
    const textbox = screen.getByRole('textbox', { name: 'notes.txt text editor' });
    const view = EditorView.findFromDOM(textbox);
    expect(view).not.toBeNull();
    act(() => view?.dispatch({ changes: { from: 0, to: 1, insert: 'a' } }));
    expect(screen.getByRole('tab', { name: /unsaved changes/i })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('a small text fixture');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('renders semantic compact tabs and an active document surface', () => {
    render(<App />);

    expect(
      screen.getByRole('tablist', { name: 'Open documents' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: /welcome\.md/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('tabpanel', { name: /welcome\.md/i }),
    ).toHaveTextContent('Glitchpad document foundation');
    expect(
      screen.getByRole('button', { name: /more open documents/i }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('supports automatic keyboard activation, reorder, cycling, close focus, and overflow', () => {
    render(<App />);
    const first = screen.getByRole('tab', { name: /welcome\.md/i });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /diagram\.mmd/i })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('tab', { name: /diagram\.mmd/i }), {
      key: 'ArrowRight',
      altKey: true,
      shiftKey: true,
    });
    expect(screen.getByRole('tab', { name: /diagram\.mmd/i })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('main'), { key: 'Tab', ctrlKey: true });
    expect(screen.getByRole('tab', { name: /draft\.md/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.keyDown(screen.getByRole('main'), { key: 'w', ctrlKey: true });
    expect(screen.getByRole('dialog')).toHaveTextContent(/unsaved changes/i);
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(
      screen.queryByRole('tab', { name: /draft\.md/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /more open documents/i }),
    );
    const menu = screen.getByRole('menu', { name: 'Overflow documents' });
    fireEvent.click(
      within(menu).getByRole('menuitem', { name: /welcome\.md/i }),
    );
    expect(
      screen.getByRole('tab', { name: /welcome\.md/i }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('cancels dirty close without changing content and returns keyboard focus', () => {
    render(<App sessions={[initialSessions[3]]} />);
    const draft = screen.getByRole('tab', { name: /draft\.md/i });
    draft.focus();
    fireEvent.keyDown(screen.getByRole('main'), { key: 'w', ctrlKey: true });
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }),
    ).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(draft).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Unsaved fixture content.',
    );
    expect(screen.getByRole('status')).toHaveTextContent(/remains open/i);
  });

  it('keeps dirty content open while Save As waits for a durable receipt', () => {
    render(<App sessions={[initialSessions[3]]} />);
    fireEvent.click(screen.getByRole('button', { name: /close draft\.md/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save As' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(
      /until a durable receipt arrives/i,
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Unsaved fixture content.',
    );
    expect(screen.getByRole('tab', { name: /unsaved changes/i })).toBeVisible();
  });

  it('completes a destructive transition only after native Save As succeeds', async () => {
    const saveAs = vi.fn().mockResolvedValue(true);
    const gateway: DesktopDeliveryGateway = {
      choose: vi.fn().mockResolvedValue([]),
      drain: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
      materialize: vi.fn().mockResolvedValue(null),
      saveAs,
      subscribe: vi.fn().mockResolvedValue(() => undefined),
    };
    render(<App sessions={[initialSessions[3]]} desktopDeliveryGateway={gateway} />);
    fireEvent.click(screen.getByRole('button', { name: /close draft\.md/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save As' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/until a durable receipt arrives/i);
    await waitFor(() => expect(screen.queryByRole('tab', { name: /draft\.md/i })).not.toBeInTheDocument());
    expect(saveAs).toHaveBeenCalledWith(expect.objectContaining({ id: 'draft' }));
  });

  it('projects conflict messaging and removes unsafe in-place save', () => {
    const conflicted = {
      ...initialSessions[3],
      integrity: 'conflicted' as const,
      source_state: 'changed' as const,
    };
    render(<App sessions={[conflicted]} />);
    expect(screen.getByText(/source changed outside/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close draft\.md/i }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Save As' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('requires an explicit recover or refusal decision for crash inventory', () => {
    const onDecision = vi.fn();
    render(
      <RecoveryCandidateResolution
        entry={{
          record_id: '37d21d4b-674d-41fa-b792-29b7c2012ed3',
          display_hint: 'recovered.txt',
          updated_unix_ms: 10,
          expires_unix_ms: 20,
          committed_bytes: 100,
          status: 'available',
        }}
        onDecision={onDecision}
      />,
    );
    expect(screen.getByRole('button', { name: 'Recover' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Decline recovery' }));
    expect(onDecision).toHaveBeenCalledWith('refuse');
  });

  it('loads native recovery inventory and opens an accepted record as dirty recovery-only', async () => {
    const entry = {
      record_id: '37d21d4b-674d-41fa-b792-29b7c2012ed3',
      display_hint: 'recovered.txt',
      updated_unix_ms: 10,
      expires_unix_ms: 20,
      committed_bytes: 100,
      status: 'available' as const,
    };
    const remove = vi.fn();
    const gateway: RecoveryGateway = {
      inventory: vi.fn().mockResolvedValue([entry]),
      persist: vi.fn(),
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
          newlines: 'lf',
          terminal_newline: 'absent',
          undecodable_bytes: 'none',
        },
        created_unix_ms: 5,
        updated_unix_ms: 10,
        expires_unix_ms: 20,
        content: 'Recovered exact content',
        content_sha256: 'c'.repeat(64),
        eviction_eligible: false,
      }),
      remove,
    };

    render(<App sessions={[]} recoveryGateway={gateway} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Recover' }),
    );

    expect(await screen.findByRole('tab', { name: /recovered\.txt/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await waitFor(() => expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Recovered exact content',
    ));
    expect(remove).not.toHaveBeenCalled();
  });

  it('snapshots dirty content after the idle interval without exposing it to errors', async () => {
    vi.useFakeTimers();
    try {
      const persist = vi.fn().mockResolvedValue({
        record_id: '37d21d4b-674d-41fa-b792-29b7c2012ed3',
        display_hint: 'draft.md',
        updated_unix_ms: 10,
        expires_unix_ms: 20,
        committed_bytes: 100,
        status: 'available',
      });
      const gateway: RecoveryGateway = {
        inventory: vi.fn().mockResolvedValue([]),
        persist,
        load: vi.fn(),
        remove: vi.fn(),
      };

      render(<App sessions={[initialSessions[3]]} recoveryGateway={gateway} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });

      expect(persist).toHaveBeenCalledOnce();
      expect(persist).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '# Draft\n\nUnsaved fixture content.',
          eviction_eligible: false,
          snapshot_session_revision: 1,
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('derives commands from the active capabilities and reports interaction changes', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /save/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /draft\.md/i }));
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/save.*draft\.md/i);
  });

  it('opens one shell-owned inspector, retargets it with the active tab, and restores opener focus', async () => {
    render(<App />);
    const opener = within(screen.getByRole('navigation', { name: 'Document commands' })).getByRole('button', { name: 'File information' });
    fireEvent.click(opener);
    expect(screen.getByRole('complementary', { name: 'File information' })).toHaveTextContent('welcome.md');
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /diagram\.mmd/iu }));
    expect(screen.getByRole('complementary', { name: 'File information' })).toHaveTextContent('diagram.mmd');
    fireEvent.click(screen.getByRole('button', { name: 'Close file information' }));
    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('refreshes metadata and publishes only a revision-bound checksum', async () => {
    const observedRevision = { ...revision, byte_length: 4, modified_unix_nanos: '2', change_token: 'observed' };
    const source = {
      ...initialSessions[2],
      lifecycle: 'active' as const,
      source_id: 'source',
      external_revision: revision,
      renderer: { ...initialSessions[2].renderer, capabilities: { ...initialSessions[2].renderer.capabilities, inspect_metadata: true } },
    };
    const advanceIntegrity = vi.fn((requestId: string) => Promise.resolve({ request_id: requestId, source_id: 'source', external_revision: observedRevision, processed_bytes: '4', total_bytes: '4', state: 'ready' as const, sha256: 'a'.repeat(64) }));
    const startIntegrity = vi.fn((request: IntegrityStartRequest) => Promise.resolve({ request_id: request.request_id, source_id: 'source', external_revision: request.expected_external_revision, processed_bytes: '0', total_bytes: '4', state: 'pending' as const, sha256: null }));
    const gateway: MetadataGateway = {
      query: vi.fn(() => Promise.resolve({
        source_id: 'source', external_revision: observedRevision, display_name: 'refreshed.txt', source_kind: 'file' as const,
        byte_length: '4', modified_unix_nanos: '2', created_unix_nanos: null, accessed_unix_nanos: null,
        write_state: 'writable' as const, identity_confidence: 'strong' as const,
      })),
      startIntegrity,
      advanceIntegrity,
      cancelIntegrity: vi.fn(() => Promise.resolve()),
    };
    render(<App sessions={[source]} metadataGateway={gateway} />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Document commands' })).getByRole('button', { name: 'File information' }));
    await waitFor(() => expect(screen.getByRole('complementary')).toHaveTextContent('refreshed.txt'));
    fireEvent.click(screen.getByRole('button', { name: 'Calculate SHA-256' }));
    expect(await screen.findByText('a'.repeat(64))).toBeInTheDocument();
    expect(advanceIntegrity).toHaveBeenCalled();
    expect(startIntegrity).toHaveBeenCalledWith(expect.objectContaining({ expected_external_revision: observedRevision }), expect.any(AbortSignal));
  });

  it('withdraws cached source facts and checksum actions when metadata polling fails', async () => {
    const source = {
      ...initialSessions[2],
      lifecycle: 'active' as const,
      source_id: 'source',
      external_revision: revision,
    };
    const query = vi.fn()
      .mockResolvedValueOnce({
        source_id: 'source', external_revision: revision, display_name: 'observed.txt', source_kind: 'file' as const,
        byte_length: '3', modified_unix_nanos: '1', created_unix_nanos: null, accessed_unix_nanos: null,
        write_state: 'writable' as const, identity_confidence: 'strong' as const,
      })
      .mockRejectedValue(new Error('source unavailable'));
    const gateway: MetadataGateway = {
      query,
      startIntegrity: vi.fn(),
      advanceIntegrity: vi.fn(),
      cancelIntegrity: vi.fn(() => Promise.resolve()),
    };
    render(<App sessions={[source]} metadataGateway={gateway} />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Document commands' })).getByRole('button', { name: 'File information' }));
    expect(await screen.findByRole('button', { name: 'Calculate SHA-256' })).toBeInTheDocument();
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2), { timeout: 2_000 });
    await waitFor(() => expect(screen.getAllByRole('status').some((status) => status.textContent?.includes('Source facts are unavailable'))).toBe(true));
    expect(screen.queryByRole('button', { name: 'Calculate SHA-256' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Unavailable (metadata_unavailable)').length).toBeGreaterThan(0);
  });

  it('cancels native checksum work immediately when the inspector closes', async () => {
    const source = { ...initialSessions[2], lifecycle: 'active' as const, source_id: 'source', external_revision: revision };
    const cancelIntegrity = vi.fn(() => Promise.resolve());
    const advanceIntegrity = vi.fn(() => new Promise<IntegrityProgress>(() => undefined));
    const gateway: MetadataGateway = {
      query: vi.fn(() => Promise.resolve({ source_id: 'source', external_revision: revision, display_name: 'notes.txt', source_kind: 'file' as const, byte_length: '3', modified_unix_nanos: '1', created_unix_nanos: null, accessed_unix_nanos: null, write_state: 'writable' as const, identity_confidence: 'strong' as const })),
      startIntegrity: vi.fn((request: IntegrityStartRequest) => Promise.resolve({ request_id: request.request_id, source_id: 'source', external_revision: revision, processed_bytes: '0', total_bytes: '3', state: 'pending' as const, sha256: null })),
      advanceIntegrity,
      cancelIntegrity,
    };
    render(<App sessions={[source]} metadataGateway={gateway} />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Document commands' })).getByRole('button', { name: 'File information' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Calculate SHA-256' }));
    await waitFor(() => expect(advanceIntegrity).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Close file information' }));
    await waitFor(() => expect(cancelIntegrity).toHaveBeenCalledOnce());
  });

  it('keeps the reference document area at or above 90 percent', () => {
    expect(DESKTOP_CHROME_MAX_PX).toBeLessThanOrEqual(
      REFERENCE_HEIGHT_PX * 0.1,
    );
  });

  it('has no critical or serious automated accessibility findings', async () => {
    const { container } = render(<App />);
    const results = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === 'critical' || impact === 'serious',
      ),
    ).toEqual([]);
  });

  it('loads, edits, persists, and resets bounded preferences without replacing the document', async () => {
    const gateway = persistenceGateway();
    render(<App persistenceGateway={gateway} />);
    fireEvent.click(screen.getByRole('button', { name: 'Preferences' }));
    expect(screen.getByRole('complementary', { name: 'Preferences' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } });
    await waitFor(() => expect(gateway.persistPreferences).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' })), { timeout: 1_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Reset preferences' }));
    await waitFor(() => expect(gateway.reset).toHaveBeenCalledWith('preferences'));
  });

  it('previews the exact redacted diagnostic bundle before explicit export', async () => {
    const gateway = persistenceGateway();
    const exporter = { export: vi.fn().mockResolvedValue(undefined) };
    render(<App persistenceGateway={gateway} diagnosticExportGateway={exporter} />);
    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }));
    expect(await screen.findByText(/"generated_unix_ms": 42/u)).toBeInTheDocument();
    expect(exporter.export).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Export previewed bundle' }));
    expect(exporter.export).toHaveBeenCalledWith(expect.objectContaining({ generated_unix_ms: 42 }));
  });

  it('applies loaded window, active-session, native-reference, and presentation projections', async () => {
    const restorable = initialSessions.slice(0, 2).map((session, index) => ({
      ...session,
      source: {
        ...session.source,
        restoration_reference: `00000000-0000-4000-8000-00000000000${index}`,
      },
    }));
    const gateway = persistenceGateway({
      loadPreferences: vi.fn().mockResolvedValue({
        status: 'loaded',
        value: { ...defaultPreferences(), markdown_default_mode: 'source' },
        warning_code: null,
      }),
      loadSession: vi.fn().mockResolvedValue({
        status: 'loaded',
        value: {
          schema_version: 1,
          window: { active_session_index: 1, inspector: 'preferences' },
          sessions: restorable.map((session, index) => ({
            session_key: `previous-${index}`,
            display_hint: session.source.display_name,
            renderer_id: session.renderer.id,
            presentation_mode: 'source',
            source_reference: session.source.restoration_reference,
            recovery_record_id: null,
          })),
        },
        warning_code: null,
      }),
    });
    render(<App sessions={restorable} persistenceGateway={gateway} />);

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /diagram\.mmd/iu }))
        .toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('complementary', { name: 'Preferences' }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
  });

  it('invokes Android restoration before matching a loaded native projection', async () => {
    const sourceReference = '70cbf05c-53f5-5442-9ace-9d576529714c';
    const restoredSession = {
      ...initialSessions[0],
      id: 'restored-native-source',
      lifecycle: 'background' as const,
      source_id: 'native-source',
      source: {
        ...initialSessions[0].source,
        restoration_reference: sourceReference,
      },
    };
    const restore = vi.fn<AndroidRestorationGateway['restore']>()
      .mockResolvedValue([restoredSession]);
    const androidGateway: AndroidRestorationGateway = { restore };
    const gateway = persistenceGateway({
      loadSession: vi.fn().mockResolvedValue({
        status: 'loaded',
        value: {
          schema_version: 1,
          window: { active_session_index: 0, inspector: 'closed' },
          sessions: [{
            session_key: 'old-process-session-1',
            display_hint: 'welcome.md',
            renderer_id: 'markdown',
            presentation_mode: 'rendered',
            source_reference: sourceReference,
            recovery_record_id: null,
          }],
        },
        warning_code: null,
      }),
    });

    render(<App
      sessions={[]}
      persistenceGateway={gateway}
      androidRestorationGateway={androidGateway}
    />);

    expect(await screen.findByRole('tab', { name: /welcome\.md/iu }))
      .toHaveAttribute('aria-selected', 'true');
    expect(restore).toHaveBeenCalledWith([
      expect.objectContaining({ source_reference: sourceReference }),
    ]);
  });

  it('uses a minimal empty surface after all fixture sessions close', () => {
    render(<App sessions={initialSessions.slice(0, 1)} />);
    fireEvent.click(screen.getByRole('button', { name: /close welcome\.md/i }));
    expect(screen.getByRole('status')).toHaveTextContent('No document is open');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
