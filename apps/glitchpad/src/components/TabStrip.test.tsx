import { fireEvent, render, screen } from '@testing-library/react';
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
});
