import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
beforeEach(() => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
});
afterEach(() => document.getElementById('bb-overlay-root')?.remove());
const props = () => ({
  commands: [command],
  canOpen: true,
  onOpen: vi.fn(),
  onInvoke: vi.fn(),
  onPreferences: vi.fn(),
  onDiagnostics: vi.fn(),
  onHelp: vi.fn(),
  onAbout: vi.fn(),
});
describe('ApplicationMenu', () => {
  it('separates application destinations from current document tools', async () => {
    const p = props();
    render(<ApplicationMenu {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = await screen.findByRole('menu', { name: 'Glitchpad menu' });
    expect(
      within(menu).queryByRole('menuitem', { name: /Search/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(menu).getByRole('menuitem', { name: 'About Glitchpad' }),
    );
    expect(p.onAbout).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
    fireEvent.click(screen.getByRole('button', { name: 'Document tools' }));
    fireEvent.click(
      within(
        await screen.findByRole('menu', { name: 'Document tools' }),
      ).getByRole('menuitem', { name: /Search/ }),
    );
    expect(p.onInvoke).toHaveBeenCalledWith(
      command,
      expect.any(HTMLButtonElement),
    );
  });
  it('dismisses Escape and restores its actual invoking control', async () => {
    render(<ApplicationMenu {...props()} />);
    const trigger = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(trigger);
    fireEvent.keyDown(await screen.findByRole('menu'), { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it('focuses the first enabled document item and supports menu keyboard traversal', async () => {
    render(
      <ApplicationMenu
        {...props()}
        canOpen={false}
        commands={[
          { ...command, id: 'save', label: 'Save', enabled: false },
          command,
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Document tools' }));
    const search = await screen.findByRole('menuitem', { name: /Search/ });
    expect(search).toHaveFocus();
    fireEvent.keyDown(search, { key: 'Home' });
    expect(search).toHaveFocus();
  });
  it('keeps an inactive trigger connected without exposing interaction', () => {
    render(<ApplicationMenu {...props()} active={false} />);
    const trigger = document.querySelector('.application-menu-trigger');
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('aria-hidden', 'true');
  });
  it('uses the AppFrame portal instead of clipping its menu inside the chrome', async () => {
    const { container } = render(<ApplicationMenu {...props()} />);
    const shell = container.querySelector('.application-menu-shell');
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = await screen.findByRole('menu');
    expect(shell).toHaveAttribute('data-menu-open', 'true');
    expect(document.getElementById('bb-overlay-root')).toContainElement(menu);
    expect(shell).not.toContainElement(menu);
    fireEvent.click(
      screen.getByRole('button', { name: 'Close Application menu' }),
    );
    await waitFor(() =>
      expect(shell).toHaveAttribute('data-menu-open', 'false'),
    );
  });
  it('has no serious accessibility violations while disclosed', async () => {
    render(<ApplicationMenu {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await screen.findByRole('menu');
    const results = await axe.run(document.getElementById('bb-overlay-root')!);
    expect(
      results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      ),
    ).toEqual([]);
  });
});
