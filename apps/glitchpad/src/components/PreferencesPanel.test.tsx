import axe from 'axe-core';
import { fireEvent, render, screen } from '@testing-library/react';

import { defaultPreferences } from '../domain/persistence';
import { PreferencesPanel } from './PreferencesPanel';

describe('PreferencesPanel', () => {
  it('edits the bounded preference fields and supports explicit reset', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(<PreferencesPanel value={defaultPreferences()} onChange={onChange} onReset={onReset} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset preferences' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('closes on Escape and has no serious accessibility findings', async () => {
    const onClose = vi.fn();
    const { container } = render(<PreferencesPanel value={defaultPreferences()} onChange={vi.fn()} onReset={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('complementary', { name: 'Preferences' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    const results = await axe.run(container);
    expect(results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([]);
  });
});
