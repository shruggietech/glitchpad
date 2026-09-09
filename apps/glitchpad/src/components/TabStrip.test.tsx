import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { initialSessions } from '../test/fixtures';
import { createTabState } from '../domain/tabs';
import { TabStrip } from './TabStrip';

describe('TabStrip', () => {
  it('renders no tab chrome for zero or one document', () => {
    const { rerender } = render(<TabStrip state={createTabState([])} dispatch={vi.fn()} />);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    rerender(<TabStrip state={createTabState(initialSessions.slice(0, 1))} dispatch={vi.fn()} />);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('renders one close button per visible tab and closes the selected document directly', () => {
    const dispatch = vi.fn();
    render(<TabStrip state={createTabState(initialSessions.slice(0, 2))} dispatch={dispatch} />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Close diagram.mmd' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'close', id: 'diagram' });
  });

  it('moves focus to the remaining document when closing hides the tab strip', async () => {
    const dispatch = vi.fn();
    const first = createTabState(initialSessions.slice(0, 2));
    const { rerender } = render(
      <>
        <TabStrip state={first} dispatch={dispatch} />
        <section id="panel-welcome" tabIndex={0}>
          Remaining document
        </section>
      </>,
    );
    screen.getByRole('button', { name: 'Close diagram.mmd' }).focus();
    rerender(
      <>
        <TabStrip state={createTabState(initialSessions.slice(0, 1))} dispatch={dispatch} />
        <section id="panel-welcome" tabIndex={0}>
          Remaining document
        </section>
      </>,
    );
    await waitFor(() => expect(screen.getByText('Remaining document')).toHaveFocus());
  });

  it('returns focus to the active tab after a focused inactive close control disappears', async () => {
    const dispatch = vi.fn();
    const { rerender } = render(<TabStrip state={createTabState(initialSessions.slice(0, 3))} dispatch={dispatch} />);
    screen.getByRole('button', { name: 'Close diagram.mmd' }).focus();
    rerender(<TabStrip state={createTabState([initialSessions[0], initialSessions[2]])} dispatch={dispatch} />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /welcome\.md/iu })).toHaveFocus());
  });

  it('returns focus to the active tab after a focused overflow close control disappears', async () => {
    const dispatch = vi.fn();
    const state = { ...createTabState(initialSessions.slice(0, 6)), overflowOpen: true };
    const { rerender } = render(<TabStrip state={state} dispatch={dispatch} />);
    const overflow = screen.getByRole('menu', { name: 'Overflow documents' });
    within(overflow).getByRole('menuitem', { name: /Close/iu }).focus();
    rerender(<TabStrip state={createTabState(initialSessions.slice(0, 5))} dispatch={dispatch} />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /welcome\.md/iu })).toHaveFocus());
  });
});
