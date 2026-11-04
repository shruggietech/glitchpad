import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { AppFrame } from '../../../../brand/web/react/server';
import { AddDocumentMenu } from './AddDocumentMenu';

it('exposes distinct choices, traps focus and consumes outside dismissal', async () => {
  const created = vi.fn();
  const choose = vi.fn();
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <AppFrame>
        <AddDocumentMenu
          open={open}
          onOpenChange={setOpen}
          onNew={created}
          onChoose={choose}
          canChoose
        />
      </AppFrame>
    );
  }
  render(<Harness />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add document' }));
  expect(screen.getByRole('menuitem', { name: 'New Markdown' })).toHaveFocus();
  fireEvent.click(screen.getByRole('menuitem', { name: 'New text file' }));
  expect(created).toHaveBeenCalledWith('text');
  expect(screen.getByRole('button', { name: 'Add document' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Add document' }));
  fireEvent.pointerDown(document.querySelector('.add-document-scrim')!);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(choose).not.toHaveBeenCalled();
});

it('maps legacy overlay insets from canonical inputs and restores owned styles on unmount', async () => {
  vi.stubGlobal('CSS', { supports: () => false });
  const frame = document.createElement('div');
  frame.setAttribute('data-bb-app-frame', 'true');
  frame.style.setProperty('--bb-host-titlebar-block-end', '24px');
  frame.style.setProperty('--bb-ime-block-end', '80px');
  frame.style.paddingTop = '9px';
  const scroll = document.createElement('div');
  scroll.className = 'bb-app-frame__scroll';
  scroll.style.paddingBottom = '6px';
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  host.style.left = '7px';
  frame.append(scroll, host);
  document.body.append(frame);
  const originalComputed = window.getComputedStyle.bind(window);
  const computed = vi
    .spyOn(window, 'getComputedStyle')
    .mockImplementation((element, pseudo) => {
      const result = originalComputed(element, pseudo);
      if (
        element.tagName !== 'SPAN' ||
        (element as HTMLElement).style.visibility !== 'hidden'
      )
        return result;
      return new Proxy(result, {
        get(target, property) {
          const safe: Record<string, string> = {
            paddingTop: '40px',
            paddingRight: '3px',
            paddingBottom: '12px',
            paddingLeft: '5px',
          };
          return typeof property === 'string' && property in safe
            ? safe[property]
            : (Reflect.get(target, property, target) as unknown);
        },
      });
    });
  const app = render(
    <AddDocumentMenu
      open={false}
      onOpenChange={vi.fn()}
      onNew={vi.fn()}
      onChoose={vi.fn()}
      canChoose
    />,
  );
  try {
    await screen.findByRole('button', { name: 'Add document' });
    expect(host.style.top).toBe('40px');
    expect(host.style.right).toBe('3px');
    expect(host.style.bottom).toBe('80px');
    expect(host.style.left).toBe('5px');
    expect(frame.style.paddingTop).toBe('40px');
    expect(scroll.style.paddingBottom).toBe('80px');
    act(() => {
      frame.style.setProperty('--bb-host-titlebar-block-end', '60px');
      frame.style.setProperty('--bb-ime-block-end', '0px');
    });
    await waitFor(() => expect(host.style.top).toBe('60px'));
    expect(host.style.bottom).toBe('12px');
    expect(scroll.style.paddingBottom).toBe('12px');
    app.unmount();
    expect(host.style.top).toBe('');
    expect(host.style.left).toBe('7px');
    expect(frame.style.paddingTop).toBe('9px');
    expect(scroll.style.paddingBottom).toBe('6px');
  } finally {
    app.unmount();
    frame.remove();
    computed.mockRestore();
    vi.unstubAllGlobals();
  }
});

it('starts native observation after portal mount and ignores a pending receipt once Add is disabled', async () => {
  vi.stubGlobal('CSS', { supports: () => true });
  const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  const height = Object.getOwnPropertyDescriptor(window, 'innerHeight');
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 640,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 320,
  });
  const frame = document.createElement('div');
  frame.setAttribute('data-bb-app-frame', 'true');
  const host = document.createElement('div');
  host.id = 'bb-overlay-root';
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(48, 0, 592, 320),
  );
  frame.append(host);
  document.body.append(frame);
  const observed = {
    webview_screen: { left: 0, top: 0, right: 640, bottom: 320 },
    visible_screen: { left: 48, top: 24, right: 592, bottom: 320 },
    view_width: 640,
    view_height: 320,
    density: 1,
  };
  let finish: (() => void) | undefined;
  const read = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<typeof observed>((resolve) => {
          finish = () => resolve(observed);
        }),
    )
    .mockResolvedValue(observed);
  const props = {
    open: false,
    onOpenChange: vi.fn(),
    onNew: vi.fn(),
    onChoose: vi.fn(),
    canChoose: true,
    viewport: read,
  };
  const app = render(<AddDocumentMenu {...props} />);
  try {
    const trigger = await screen.findByRole('button', { name: 'Add document' });
    const add = trigger.parentElement!;
    await waitFor(() => expect(read).toHaveBeenCalledOnce());
    app.rerender(<AddDocumentMenu {...props} disabled />);
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
    expect(trigger).toBeDisabled();
    expect(add).not.toHaveAttribute('data-native-viewport');
    app.rerender(<AddDocumentMenu {...props} />);
    await waitFor(() =>
      expect(add).toHaveAttribute('data-native-viewport', 'true'),
    );
    expect(add).toHaveAttribute('data-native-viewport-width', '640');
    expect(add).toHaveAttribute('data-native-viewport-height', '320');
    expect(add.style.getPropertyValue('--gl-add-native-inline-end')).toBe(
      '48px',
    );
    expect(add.style.getPropertyValue('--gl-add-native-inline-size')).toBe(
      '544px',
    );
    app.unmount();
    expect(add).not.toHaveAttribute('data-native-viewport');
  } finally {
    app.unmount();
    frame.remove();
    if (width) Object.defineProperty(window, 'innerWidth', width);
    if (height) Object.defineProperty(window, 'innerHeight', height);
    vi.unstubAllGlobals();
  }
});
