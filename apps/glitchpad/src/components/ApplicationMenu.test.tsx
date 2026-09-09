import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import type { CommandDescriptor } from '../domain/commands';
import { ApplicationMenu } from './ApplicationMenu';

const command: CommandDescriptor = {
  id: 'search',
  label: 'Search',
  shortcut: 'Ctrl+F',
  enabled: true,
  targetSessionId: 'notes',
  targetRevision: 1,
};

describe('ApplicationMenu', () => {
  it('keeps commands hidden until requested and routes the chosen action', () => {
    const onInvoke = vi.fn();
    render(<ApplicationMenu commands={[command]} canOpen onOpen={vi.fn()} onInvoke={onInvoke} onPreferences={vi.fn()} onDiagnostics={vi.fn()} />);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = screen.getByRole('menu', { name: 'Glitchpad menu' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: /^Search/u }));

    expect(onInvoke).toHaveBeenCalledWith(command, expect.any(HTMLButtonElement));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('dismisses with Escape and restores focus to the trigger', () => {
    render(<ApplicationMenu commands={[command]} canOpen={false} onOpen={vi.fn()} onInvoke={vi.fn()} onPreferences={vi.fn()} onDiagnostics={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps a fixed trigger wrapper while the popup is disclosed', async () => {
    const { container } = render(<ApplicationMenu commands={[command]} canOpen onOpen={vi.fn()} onInvoke={vi.fn()} onPreferences={vi.fn()} onDiagnostics={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Menu' });
    const shell = container.querySelector('.application-menu-shell');
    expect(shell).toHaveAttribute('data-menu-open', 'false');
    expect(trigger.parentElement).toBe(shell);

    fireEvent.click(trigger);
    expect(shell).toHaveAttribute('data-menu-open', 'true');
    expect(screen.getByRole('menu').parentElement).toBe(shell);
    expect(trigger.parentElement).toBe(shell);

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(shell).toHaveAttribute('data-menu-open', 'false');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('has no serious accessibility violations while disclosed', async () => {
    const { container } = render(<ApplicationMenu commands={[command]} canOpen onOpen={vi.fn()} onInvoke={vi.fn()} onPreferences={vi.fn()} onDiagnostics={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const results = await axe.run(container);
    expect(results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([]);
  });
});
