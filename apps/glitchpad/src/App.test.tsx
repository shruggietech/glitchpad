import axe from 'axe-core';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { App, initialSessions } from './App';
import { RecoveryCandidateResolution } from './components/RecoveryResolution';
import type { RecoveryGateway } from './domain/recovery-gateway';
import { DESKTOP_CHROME_MAX_PX, REFERENCE_HEIGHT_PX } from './domain/tabs';

describe('document foundation shell', () => {
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
    expect(screen.getByRole('tabpanel')).toHaveTextContent(
      'Recovered exact content',
    );
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

  it('uses a minimal empty surface after all fixture sessions close', () => {
    render(<App sessions={initialSessions.slice(0, 1)} />);
    fireEvent.click(screen.getByRole('button', { name: /close welcome\.md/i }));
    expect(screen.getByRole('status')).toHaveTextContent('No document is open');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
