import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationRecoveryBoundary } from './components/ApplicationRecoveryBoundary';
import {
  bootstrapApplication,
  requestApplicationRestart,
  type BeforeRestartDetail,
} from './bootstrap-recovery';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('application bootstrap recovery', () => {
  it('keeps a native-independent recovery surface when application import fails', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const onFailure = vi.fn();
    const restart = vi.fn(() => Promise.resolve());
    await bootstrapApplication(
      root,
      () => Promise.reject(new Error('private filename and source')),
      { onFailure, restart },
    );
    expect(root).toHaveTextContent('Glitchpad could not start');
    expect(root).toHaveTextContent(
      'Edits since the last recovery snapshot may be unavailable',
    );
    expect(root).not.toHaveTextContent('private filename');
    expect(onFailure).toHaveBeenCalledWith(
      'bootstrap',
      'bootstrap',
      'module_load_failed',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restart Glitchpad' }));
    await waitFor(() => expect(restart).toHaveBeenCalledOnce());
    root.remove();
  });

  it('handles a missing root and mount failure without printing private error details', async () => {
    const onFailure = vi.fn();
    await bootstrapApplication(
      null,
      () => Promise.resolve({ mount: vi.fn() }),
      { onFailure },
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Recovery code: root_missing',
    );
    expect(onFailure).toHaveBeenCalledWith(
      'bootstrap',
      'bootstrap',
      'root_missing',
    );
    document.getElementById('root')?.remove();
    const root = document.createElement('div');
    document.body.append(root);
    await bootstrapApplication(
      root,
      () =>
        Promise.resolve({
          mount: () => {
            throw new Error('private source');
          },
        }),
      { onFailure },
    );
    expect(root).toHaveTextContent('Recovery code: application_mount_failed');
    expect(root).not.toHaveTextContent('private source');
    root.remove();
  });

  it('waits for registered recovery flush before restarting and does not restart on failure', async () => {
    const reload = vi.fn();
    let finish: (() => void) | undefined;
    const listener = (event: Event) =>
      (event as CustomEvent<BeforeRestartDetail>).detail.waitUntil(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
    window.addEventListener('glitchpad:before-restart', listener);
    try {
      const restarting = requestApplicationRestart(reload);
      expect(reload).not.toHaveBeenCalled();
      finish?.();
      await restarting;
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('glitchpad:before-restart', listener);
    }
    const failure = (event: Event) =>
      (event as CustomEvent<BeforeRestartDetail>).detail.waitUntil(
        Promise.reject(new Error('private failure')),
      );
    window.addEventListener('glitchpad:before-restart', failure);
    try {
      await expect(requestApplicationRestart(reload)).rejects.toThrow();
      expect(reload).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('glitchpad:before-restart', failure);
    }
  });

  it('flushes recovery before the compiled-only root fault enters its real React boundary', async () => {
    vi.stubEnv('VITE_GLITCHPAD_RECOVERY_PROBES', '1');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let finish: (() => void) | undefined;
    const before = (event: Event) =>
      (event as CustomEvent<BeforeRestartDetail>).detail.waitUntil(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
    window.addEventListener('glitchpad:before-restart', before);
    try {
      render(
        <ApplicationRecoveryBoundary>
          <p>Current document remains mounted</p>
        </ApplicationRecoveryBoundary>,
      );
      fireEvent(
        window,
        new CustomEvent('glitchpad:test-recovery', {
          detail: { stage: 'root' },
        }),
      );
      expect(
        screen.getByText('Current document remains mounted'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      finish?.();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'application_render_failed',
      );
    } finally {
      window.removeEventListener('glitchpad:before-restart', before);
    }
  });

  it('contains an application render failure and reports a bounded recovery code', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onFailure = vi.fn();
    const restart = vi.fn(() =>
      Promise.reject(new Error('private failed snapshot')),
    );
    function BrokenApplication(): never {
      throw new Error('private document content');
    }
    render(
      <ApplicationRecoveryBoundary onFailure={onFailure} restart={restart}>
        <BrokenApplication />
      </ApplicationRecoveryBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Glitchpad could not continue',
    );
    expect(onFailure).toHaveBeenCalledWith(
      'application',
      'render',
      'application_render_failed',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restart Glitchpad' }));
    expect(
      await screen.findByText(
        'Latest recovery could not be saved. Keep this screen open or restart with that limitation.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Restart without latest recovery' }),
    ).toBeEnabled();
    expect(document.body).not.toHaveTextContent('private');
  });
});

it('recovers a failed main import without replaceChildren before application code loads', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'replaceChildren',
  );
  Object.defineProperty(Element.prototype, 'replaceChildren', {
    configurable: true,
    writable: true,
    value: undefined,
  });
  const root = document.createElement('div');
  const stale = document.createElement('p');
  stale.textContent = 'Startup placeholder';
  root.appendChild(stale);
  document.body.appendChild(root);
  const load = vi.fn(() =>
    Promise.reject(new Error('private absent module path')),
  );
  const restart = vi.fn(() => Promise.resolve());
  const onFailure = vi.fn();
  try {
    expect(typeof root.replaceChildren).toBe('undefined');
    await expect(
      bootstrapApplication(root, load, { restart, onFailure }),
    ).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledOnce();
    expect(root).toHaveTextContent('Glitchpad could not start');
    expect(root).toHaveTextContent('Recovery code: module_load_failed');
    expect(root).not.toHaveTextContent('Startup placeholder');
    expect(root).not.toHaveTextContent('private absent module path');
    expect(root.childElementCount).toBe(1);
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(
      'bootstrap',
      'bootstrap',
      'module_load_failed',
    );
    const help = screen.getByRole('button', { name: 'Help and About' });
    fireEvent.click(help);
    expect(help).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('button', { name: 'Offline licenses and notices' }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Restart Glitchpad' }));
    await waitFor(() => expect(restart).toHaveBeenCalledOnce());
  } finally {
    if (descriptor)
      Object.defineProperty(Element.prototype, 'replaceChildren', descriptor);
    else delete (Element.prototype as Partial<Element>).replaceChildren;
    root.remove();
  }
});
