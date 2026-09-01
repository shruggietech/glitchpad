import axe from 'axe-core';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { App, initialSessions } from './App';
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
