import { AppFrame } from '../../../../brand/web/react/server';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  defaultPreferences,
  type PreferenceState,
} from '../domain/persistence';
import { PreferencesPanel } from './PreferencesPanel';

describe('validated preferences', () => {
  it('retains empty numeric drafts and commits only supported integer values', () => {
    const changed = vi.fn();
    function Harness() {
      const [value, setValue] = useState(defaultPreferences());
      return (
        <PreferencesPanel
          value={value}
          onChange={(next) => {
            changed(next);
            setValue(next);
          }}
          onReset={() => Promise.resolve(true)}
          onClose={vi.fn()}
        />
      );
    }
    render(<Harness />);
    const size = screen.getByLabelText('Editor font size');
    fireEvent.change(size, { target: { value: '' } });
    expect(size).toHaveValue(null);
    expect(changed).not.toHaveBeenCalled();
    fireEvent.blur(size);
    expect(size).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('Enter a whole number from 8 to 72.'),
    ).toBeInTheDocument();
    fireEvent.change(size, { target: { value: '20' } });
    fireEvent.blur(size);
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({ editor_font_size: 20 }),
    );
    const width = screen.getByLabelText('Tab width');
    fireEvent.change(width, { target: { value: '1.5' } });
    fireEvent.blur(width);
    expect(width).toHaveAttribute('aria-invalid', 'true');
    expect(changed).toHaveBeenCalledTimes(1);
    fireEvent.change(width, { target: { value: '16' } });
    fireEvent.keyDown(width, { key: 'Enter' });
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({ tab_width: 16 }),
    );
  });
  it('awaits scoped reset and exposes cancellation, pending and failure without closing', async () => {
    let complete!: (ok: boolean) => void;
    const reset = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          complete = resolve;
        }),
    );
    const close = vi.fn();
    render(
      <AppFrame>
        <PreferencesPanel
          value={defaultPreferences()}
          onChange={vi.fn()}
          onReset={reset}
          onClose={close}
        />
      </AppFrame>,
    );
    const closeButton = screen.getByRole('button', {
      name: 'Close preferences',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset preferences' }));
    expect(
      screen.getByRole('group', { name: 'Reset preferences?' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel reset' }));
    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset preferences' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset settings' }));
    expect(reset).toHaveBeenCalledOnce();
    expect(closeButton).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Resetting preferences',
    );
    fireEvent.keyDown(
      screen.getByRole('group', { name: 'Reset preferences?' }),
      { key: 'Escape' },
    );
    expect(close).not.toHaveBeenCalled();
    await act(async () => {
      complete(false);
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Preferences could not be reset. Your files are unchanged.',
    );
    expect(closeButton).toBeEnabled();
  });
  it('labels default scope and explains unavailable custom fonts without saving invalid family text', () => {
    const changed = vi.fn<(value: PreferenceState) => void>();
    render(
      <PreferencesPanel
        value={defaultPreferences()}
        onChange={changed}
        onReset={() => Promise.resolve(true)}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Default Markdown view')).toBeInTheDocument();
    expect(screen.getByText(/Newly opened Markdown/)).toBeInTheDocument();
    const font = screen.getByLabelText('Editor font family');
    fireEvent.change(font, { target: { value: '' } });
    fireEvent.blur(font);
    expect(font).toHaveAttribute('aria-invalid', 'true');
    expect(changed).not.toHaveBeenCalled();
    expect(
      screen.getByText(/unavailable.*monospace fallback/i),
    ).toBeInTheDocument();
  });
});

describe('all preference choices and reset result', () => {
  it('applies all theme and Markdown defaults without changing document bytes and previews valid font drafts', () => {
    const changed = vi.fn();
    function Harness() {
      const [value, setValue] = useState(defaultPreferences());
      return (
        <PreferencesPanel
          value={value}
          onChange={(next) => {
            changed(next);
            setValue(next);
          }}
          onReset={() => Promise.resolve()}
          onClose={vi.fn()}
        />
      );
    }
    render(<Harness />);
    for (const theme of ['light', 'dark', 'system']) {
      fireEvent.change(screen.getByLabelText('Theme'), {
        target: { value: theme },
      });
      expect(changed).toHaveBeenLastCalledWith(
        expect.objectContaining({ theme }),
      );
    }
    for (const mode of ['source', 'rendered']) {
      fireEvent.change(screen.getByLabelText('Default Markdown view'), {
        target: { value: mode },
      });
      expect(changed).toHaveBeenLastCalledWith(
        expect.objectContaining({ markdown_default_mode: mode }),
      );
    }
    fireEvent.click(screen.getByRole('checkbox', { name: 'Wrap long lines' }));
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({ line_wrap: false }),
    );
    fireEvent.change(screen.getByLabelText('Editor font size'), {
      target: { value: '24' },
    });
    expect(screen.getByLabelText('Editor font preview')).toHaveStyle({
      fontSize: '24px',
    });
    expect(changed).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ editor_font_size: 24 }),
    );
    fireEvent.blur(screen.getByLabelText('Editor font size'));
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({ editor_font_size: 24 }),
    );
  });
  it('shows actual successful reset and catches a rejected reset without exposing the exception', async () => {
    const reset = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('private path'))
      .mockResolvedValueOnce(undefined);
    render(
      <AppFrame>
        <PreferencesPanel
          value={defaultPreferences()}
          onChange={vi.fn()}
          onReset={reset}
          onClose={vi.fn()}
        />
      </AppFrame>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset preferences' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset settings' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Preferences could not be reset',
      ),
    );
    expect(screen.getByRole('status')).not.toHaveTextContent('private');
    fireEvent.click(screen.getByRole('button', { name: 'Reset settings' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Preferences reset. Your files are unchanged.',
      ),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

it('rejects invalid font sizes and retains an empty tab-width draft without changing preferences', () => {
  const changed = vi.fn();
  render(
    <PreferencesPanel
      value={defaultPreferences()}
      onChange={changed}
      onReset={() => Promise.resolve(true)}
      onClose={vi.fn()}
    />,
  );
  const size = screen.getByLabelText('Editor font size');
  for (const value of ['7', '73', '12.5']) {
    fireEvent.change(size, { target: { value } });
    fireEvent.blur(size);
    expect(size).toHaveAttribute('aria-invalid', 'true');
    expect(size).toHaveValue(Number(value));
    expect(changed).not.toHaveBeenCalled();
  }
  const width = screen.getByLabelText('Tab width');
  fireEvent.change(width, { target: { value: '' } });
  fireEvent.blur(width);
  expect(width).toHaveValue(null);
  expect(width).toHaveAttribute('aria-invalid', 'true');
  expect(changed).not.toHaveBeenCalled();
});
