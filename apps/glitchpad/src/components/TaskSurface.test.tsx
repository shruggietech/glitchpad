import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TaskSurface, dismissTopTaskSurface } from './TaskSurface';
afterEach(() => {
  document.getElementById('bb-overlay-root')?.remove();
});
it('uses the existing overlay root, labels the modal and reports controlled dismissal', async () => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
  const dismiss = vi.fn();
  render(
    <TaskSurface open title="Document options" onOpenChange={dismiss}>
      <button>Fit document</button>
    </TaskSurface>,
  );
  const dialog = await screen.findByRole('dialog', {
    name: 'Document options',
  });
  expect(host.contains(dialog)).toBe(true);
  expect(dialog).toHaveAttribute('data-task-modal', 'true');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  fireEvent.click(
    screen.getByRole('button', { name: 'Close Document options' }),
  );
  expect(dismiss).toHaveBeenCalledExactlyOnceWith(false);
});
it('restores focus to its actual invoking control after controlled closure', async () => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
  const opener = document.createElement('button');
  opener.textContent = 'Open options';
  document.body.append(opener);
  opener.focus();
  const view = render(
    <TaskSurface
      open
      title="Options"
      onOpenChange={() => undefined}
      opener={opener}
    >
      <button>First action</button>
    </TaskSurface>,
  );
  await screen.findByRole('dialog');
  view.rerender(
    <TaskSurface
      open={false}
      title="Options"
      onOpenChange={() => undefined}
      opener={opener}
    >
      <button>First action</button>
    </TaskSurface>,
  );
  await waitFor(() => expect(opener).toHaveFocus());
  opener.remove();
});

it('observes the canonical native frame after delayed portal content mounts', async () => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
  host.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const viewport = vi.fn().mockResolvedValue({
    webview_screen: {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    },
    visible_screen: {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight - 80,
    },
    view_width: window.innerWidth,
    view_height: window.innerHeight,
    density: 1,
  });
  const view = render(
    <TaskSurface
      open={false}
      title="Native task"
      viewport={viewport}
      onOpenChange={() => undefined}
    >
      <button>Action</button>
    </TaskSurface>,
  );
  view.rerender(
    <TaskSurface
      open
      title="Native task"
      viewport={viewport}
      onOpenChange={() => undefined}
    >
      <button>Action</button>
    </TaskSurface>,
  );
  const dialog = await screen.findByRole('dialog', { name: 'Native task' });
  await waitFor(() =>
    expect(dialog).toHaveAttribute('data-native-viewport', 'true'),
  );
  expect(dialog.style.getPropertyValue('--gl-task-native-block-end')).toBe(
    '80px',
  );
  expect(viewport).toHaveBeenCalled();
});

it('routes one native Back request to the nested controlled layer and honors a busy veto', async () => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
  const parent = vi.fn(),
    child = vi.fn();
  const renderLayers = (nested: boolean, busy = false) => (
    <TaskSurface open title="Parent task" onOpenChange={parent}>
      <TaskSurface
        open={nested}
        title="Nested task"
        onOpenChange={child}
        canClose={!busy}
      >
        <button>Nested action</button>
      </TaskSurface>
    </TaskSurface>
  );
  const view = render(renderLayers(true));
  await screen.findByRole('dialog', { name: 'Nested task' });
  expect(dismissTopTaskSurface()).toBe(true);
  expect(child).toHaveBeenCalledExactlyOnceWith(false);
  expect(parent).not.toHaveBeenCalled();
  child.mockClear();
  view.rerender(renderLayers(true, true));
  expect(dismissTopTaskSurface()).toBe(true);
  expect(child).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Close Nested task' }),
  ).toBeDisabled();
  view.rerender(renderLayers(false));
  expect(dismissTopTaskSurface()).toBe(true);
  expect(parent).toHaveBeenCalledExactlyOnceWith(false);
});
