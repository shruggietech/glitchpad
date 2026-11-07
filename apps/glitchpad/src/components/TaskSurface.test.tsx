import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useRef, useState } from 'react';
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
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Nested task' }), {
    key: 'Escape',
  });
  expect(child).not.toHaveBeenCalled();
  expect(parent).not.toHaveBeenCalled();
  view.rerender(renderLayers(false));
  expect(dismissTopTaskSurface()).toBe(true);
  expect(parent).toHaveBeenCalledExactlyOnceWith(false);
});

it.each(['native Back', 'Escape', 'header Close', 'completion'] as const)(
  'returns focus to the nested opener in the remaining parent after %s',
  async (route) => {
    const host = document.createElement('div');
    host.id = 'bb-overlay-root';
    document.body.append(host);
    const parentChange = vi.fn();
    const childChange = vi.fn();
    function NestedTasks() {
      const [nested, setNested] = useState(false);
      const opener = useRef<HTMLButtonElement>(null);
      const close = (open: boolean) => {
        childChange(open);
        setNested(open);
      };
      return (
        <TaskSurface open title="Preferences" onOpenChange={parentChange}>
          <button ref={opener} onClick={() => setNested(true)}>
            Reset preferences
          </button>
          <TaskSurface
            open={nested}
            title="Reset decision"
            onOpenChange={close}
            opener={opener.current}
          >
            <button data-task-initial-focus onClick={() => close(false)}>
              Complete reset
            </button>
          </TaskSurface>
        </TaskSurface>
      );
    }
    render(<NestedTasks />);
    const opener = await screen.findByRole('button', {
      name: 'Reset preferences',
    });
    fireEvent.click(opener);
    const nested = await screen.findByRole('dialog', {
      name: 'Reset decision',
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Complete reset' }),
      ).toHaveFocus(),
    );
    if (route === 'native Back')
      act(() => {
        expect(dismissTopTaskSurface()).toBe(true);
      });
    else if (route === 'Escape') fireEvent.keyDown(nested, { key: 'Escape' });
    else
      fireEvent.click(
        screen.getByRole('button', {
          name:
            route === 'header Close'
              ? 'Close Reset decision'
              : 'Complete reset',
        }),
      );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Reset decision' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('dialog', { name: 'Preferences' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
    expect(childChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(parentChange).not.toHaveBeenCalled();
  },
);

it('keeps focus inside the remaining decision instead of restoring an outside opener', async () => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
  const outside = document.createElement('button');
  outside.textContent = 'Outside opener';
  document.body.append(outside);
  const restoreFocus = vi.fn((target: HTMLElement) => target.focus());
  const layers = (normalOpen: boolean, decisionOpen: boolean) => (
    <>
      <TaskSurface
        open={normalOpen}
        title="Normal task"
        opener={outside}
        restoreFocus={restoreFocus}
        onOpenChange={() => undefined}
      >
        <button>Normal action</button>
      </TaskSurface>
      <TaskSurface
        open={decisionOpen}
        priority="decision"
        title="Pending decision"
        onOpenChange={() => undefined}
      >
        <button data-task-initial-focus>Decision action</button>
      </TaskSurface>
    </>
  );
  const view = render(layers(true, false));
  await screen.findByRole('dialog', { name: 'Normal task' });
  view.rerender(layers(true, true));
  const action = await screen.findByRole('button', { name: 'Decision action' });
  await waitFor(() => expect(action).toHaveFocus());
  view.rerender(layers(false, true));
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Normal task', hidden: true }),
    ).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole('dialog', { name: 'Pending decision' }),
  ).toBeInTheDocument();
  expect(outside).not.toHaveFocus();
  expect(action).toHaveFocus();
  expect(restoreFocus).not.toHaveBeenCalled();
  outside.remove();
});

it('restores an outside opener while a remaining nonmodal inspector stays open', async () => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
  const opener = document.createElement('button');
  opener.textContent = 'Application menu opener';
  document.body.append(opener);
  const tasks = (temporary: boolean) => (
    <>
      <TaskSurface
        open
        modal={false}
        title="Wide inspector"
        onOpenChange={() => undefined}
      >
        <button>Inspector action</button>
      </TaskSurface>
      <TaskSurface
        open={temporary}
        title="Temporary task"
        opener={opener}
        onOpenChange={() => undefined}
      >
        <button>Temporary action</button>
      </TaskSurface>
    </>
  );
  const view = render(tasks(false));
  await screen.findByRole('dialog', { name: 'Wide inspector' });
  view.rerender(tasks(true));
  await screen.findByRole('dialog', { name: 'Temporary task' });
  view.rerender(tasks(false));
  await waitFor(() => expect(opener).toHaveFocus());
  expect(
    screen.getByRole('dialog', { name: 'Wide inspector' }),
  ).toHaveAttribute('data-task-modal', 'false');
  opener.remove();
});

it('keeps explicitly transferred new-document focus after the old task closes', async () => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
  const opener = document.createElement('button');
  opener.textContent = 'Add document';
  const editor = document.createElement('textarea');
  editor.setAttribute('aria-label', 'New document editor');
  const documentSurface = document.createElement('section');
  documentSurface.className = 'document-surface';
  documentSurface.append(editor);
  document.body.append(opener, documentSurface);
  const task = (open: boolean) => (
    <TaskSurface
      open={open}
      title="New document"
      opener={opener}
      onOpenChange={() => undefined}
    >
      <button data-task-initial-focus>New Markdown</button>
    </TaskSurface>
  );
  const view = render(task(true));
  await screen.findByRole('dialog', { name: 'New document' });
  view.rerender(task(false));
  editor.focus();
  expect(editor).toHaveFocus();
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  expect(editor).toHaveFocus();
  opener.remove();
  documentSurface.remove();
});

it('keeps a completed Add document trigger handoff when an older task closes late', async () => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
  const opener = document.createElement('button');
  opener.textContent = 'Menu';
  const add = document.createElement('button');
  add.className = 'add-document-trigger';
  add.setAttribute('aria-label', 'Add document');
  add.setAttribute('aria-expanded', 'false');
  document.body.append(opener, add);
  const task = (open: boolean) => (
    <TaskSurface
      open={open}
      title="Preferences"
      opener={opener}
      onOpenChange={() => undefined}
    >
      <button data-task-initial-focus>Preference action</button>
    </TaskSurface>
  );
  const view = render(task(true));
  await screen.findByRole('dialog', { name: 'Preferences' });
  view.rerender(task(false));
  add.focus();
  expect(add).toHaveFocus();
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  expect(add).toHaveFocus();
  opener.remove();
  add.remove();
});

it('falls back to enabled dialog focus while the preferred field is disabled', async () => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
  const task = (pending: boolean) => (
    <TaskSurface open title="Loading tools" onOpenChange={() => undefined}>
      <label>
        Find
        <input data-task-initial-focus disabled={pending} />
      </label>
    </TaskSurface>
  );
  const view = render(task(true));
  await screen.findByRole('dialog', { name: 'Loading tools' });
  const close = screen.getByRole('button', { name: 'Close Loading tools' });
  await waitFor(() => expect(close).toHaveFocus());
  expect(screen.getByRole('textbox', { name: 'Find' })).toBeDisabled();
  view.rerender(task(false));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Find' })).toBeEnabled(),
  );
  expect(close).toHaveFocus();
});

it('keeps focus inside an open Add document menu when an older task closes late', async () => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
  const opener = document.createElement('button');
  opener.textContent = 'Menu';
  const menu = document.createElement('div');
  menu.className = 'add-document-menu';
  menu.setAttribute('role', 'menu');
  const choice = document.createElement('button');
  choice.setAttribute('role', 'menuitem');
  choice.textContent = 'New text file';
  menu.append(choice);
  document.body.append(opener, menu);
  const task = (open: boolean) => (
    <TaskSurface
      open={open}
      title="About"
      opener={opener}
      onOpenChange={() => undefined}
    >
      <button data-task-initial-focus>About action</button>
    </TaskSurface>
  );
  const view = render(task(true));
  await screen.findByRole('dialog', { name: 'About' });
  view.rerender(task(false));
  choice.focus();
  expect(choice).toHaveFocus();
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
  expect(choice).toHaveFocus();
  opener.remove();
  menu.remove();
});

it.each([
  {
    pointerType: 'touch',
    eventType: 'pointerdown',
    touch: false,
    preventsFocus: true,
  },
  {
    pointerType: 'mouse',
    eventType: 'pointerdown',
    touch: false,
    preventsFocus: false,
  },
  { pointerType: '', eventType: 'mousedown', touch: true, preventsFocus: true },
  {
    pointerType: '',
    eventType: 'mousedown',
    touch: false,
    preventsFocus: false,
  },
])(
  'defers touch focus until button activation ($eventType, $pointerType, $touch)',
  async ({ pointerType, eventType, touch, preventsFocus }) => {
    const host = document.createElement('div');
    host.id = 'bb-overlay-root';
    document.body.append(host);
    const activate = vi.fn();
    render(
      <TaskSurface open title="Search" onOpenChange={() => undefined}>
        <label>
          Find
          <input />
        </label>
        <button onClick={activate}>
          <span>Next match</span>
        </button>
      </TaskSurface>,
    );
    await screen.findByRole('dialog', { name: 'Search' });
    const input = screen.getByRole('textbox', { name: 'Find' });
    input.focus();
    const pointer = new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    Object.defineProperty(pointer, 'pointerType', { value: pointerType });
    Object.defineProperty(pointer, 'sourceCapabilities', {
      value: { firesTouchEvents: touch },
    });
    fireEvent(screen.getByText('Next match'), pointer);
    expect(pointer.defaultPrevented).toBe(preventsFocus);
    expect(input).toHaveFocus();
    expect(activate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Next match' }));
    expect(activate).toHaveBeenCalledExactlyOnceWith(expect.anything());
  },
);

it('settles rounded CSSOM measurements and still updates real geometry changes', () => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
  const observed: {
    target: Node;
    callback: MutationCallback;
    observer: MutationObserver;
  }[] = [];
  class ControlledMutationObserver {
    constructor(private callback: MutationCallback) {}
    observe(target: Node, options?: MutationObserverInit) {
      if (options?.attributeFilter?.includes('style'))
        observed.push({ target, callback: this.callback, observer: this });
    }
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('MutationObserver', ControlledMutationObserver);
  const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
  let height = 55.96875;
  rect.mockImplementation(function (this: HTMLElement) {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 320,
      height: this.classList.contains('task-surface-heading') ? height : 640,
      right: 320,
      bottom: height,
      toJSON: () => ({}),
    };
  });
  // The original method is called with its original receiver below.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const read = CSSStyleDeclaration.prototype.getPropertyValue;
  const cssom = vi
    .spyOn(CSSStyleDeclaration.prototype, 'getPropertyValue')
    .mockImplementation(function (this: CSSStyleDeclaration, name: string) {
      const value = read.call(this, name);
      return name === '--gl-task-heading-block-size' && value
        ? Number.parseFloat(value).toFixed(4) + 'px'
        : value;
    });
  const write = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');
  try {
    render(
      <TaskSurface
        open
        title="Rounded measurement"
        onOpenChange={() => undefined}
      >
        <button>Continue</button>
      </TaskSurface>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Rounded measurement' });
    const subscription = observed.find(({ target }) => target === dialog);
    expect(subscription).toBeDefined();
    const writes = () =>
      write.mock.calls.filter(
        ([name]) => name === '--gl-task-heading-block-size',
      ).length;
    expect(writes()).toBe(1);
    act(() => {
      for (let count = 0; count < 5; count++)
        subscription!.callback([], subscription!.observer);
    });
    expect(writes()).toBe(1);
    height = 71.5625;
    act(() => subscription!.callback([], subscription!.observer));
    expect(writes()).toBe(2);
    expect(dialog.style.getPropertyValue('--gl-task-heading-block-size')).toBe(
      '71.5625px',
    );
  } finally {
    write.mockRestore();
    cssom.mockRestore();
    rect.mockRestore();
    vi.unstubAllGlobals();
  }
});

it('keeps normal touch-button focus when no editable field owns focus', async () => {
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  document.body.append(host);
  render(
    <TaskSurface open title="Actions" onOpenChange={() => undefined}>
      <button>First action</button>
      <button>Second action</button>
    </TaskSurface>,
  );
  const first = await screen.findByRole('button', { name: 'First action' });
  first.focus();
  const pointer = new MouseEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  Object.defineProperty(pointer, 'pointerType', { value: 'touch' });
  fireEvent(screen.getByRole('button', { name: 'Second action' }), pointer);
  expect(pointer.defaultPrevented).toBe(false);
});
