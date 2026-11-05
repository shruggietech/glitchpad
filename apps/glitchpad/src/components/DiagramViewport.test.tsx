import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramViewport, type DiagramViewportHandle } from './DiagramViewport';
import { rendererResourceLedger } from '../domain/resource-ledger';

const setViewportDimensions = (
  width = 4096,
  height = 4096,
  viewportWidth = 1024,
  viewportHeight = 1024,
) => {
  const image = screen.getByRole('img');
  const canvas = screen.getByRole('group');
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  });
  Object.defineProperties(canvas, {
    clientWidth: { configurable: true, value: viewportWidth },
    clientHeight: { configurable: true, value: viewportHeight },
  });
  fireEvent.load(image);
};
beforeEach(() => {
  document.body.insertAdjacentHTML(
    'beforeend',
    '<div id="bb-overlay-root"></div>',
  );
});
afterEach(() => document.getElementById('bb-overlay-root')?.remove());
describe('DiagramViewport', () => {
  it('preserves and then disposes its resource owner through StrictMode replay', async () => {
    const view = render(
      <StrictMode>
        <DiagramViewport
          svg='<svg xmlns="http://www.w3.org/2000/svg"/>'
          label="Strict viewport"
          description={null}
        />
      </StrictMode>,
    );
    expect(
      rendererResourceLedger
        .snapshots()
        .some(({ owner_id }) => owner_id.startsWith('viewport:')),
    ).toBe(true);
    view.unmount();
    await waitFor(() => {
      expect(
        rendererResourceLedger
          .snapshots()
          .some(({ owner_id }) => owner_id.startsWith('viewport:')),
      ).toBe(false);
    });
  });

  it('recomputes live Fit while preserving a manually chosen effective scale across resize', () => {
    let notifyResize: () => void = () => {
      throw new Error('Diagram canvas was not observed');
    };
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(element: Element) {
          if (element.classList.contains('diagram-canvas'))
            notifyResize = () => this.callback([], this);
        }
        disconnect() {}
        unobserve() {}
      },
    );
    const ref = createRef<DiagramViewportHandle>();
    const view = render(
      <DiagramViewport
        ref={ref}
        svg='<svg xmlns="http://www.w3.org/2000/svg"/>'
        label="Resize"
        description={null}
      />,
    );
    try {
      const image = screen.getByRole('img');
      const canvas = screen.getByRole('group');
      let width = 300;
      Object.defineProperties(image, {
        naturalWidth: { configurable: true, value: 3000 },
        naturalHeight: { configurable: true, value: 1000 },
      });
      Object.defineProperties(canvas, {
        clientWidth: { configurable: true, get: () => width },
        clientHeight: { configurable: true, value: 300 },
      });
      fireEvent.load(image);
      expect(image).toHaveStyle({ width: '300px' });
      width = 600;
      act(() => notifyResize());
      expect(image).toHaveStyle({ width: '600px' });
      act(() => {
        expect(ref.current!.zoomIn()).toBe(true);
      });
      expect(image).toHaveStyle({ width: '750px' });
      expect(canvas).toHaveAttribute('data-viewport-mode', 'custom');
      fireEvent.keyDown(canvas, { key: 'ArrowRight' });
      const pan = canvas.getAttribute('data-viewport-pan-x');
      expect(Number(pan)).toBeGreaterThan(0);
      width = 450;
      act(() => notifyResize());
      expect(image).toHaveStyle({ width: '750px' });
      expect(canvas).toHaveAttribute('data-viewport-pan-x', pan);
      act(() => {
        expect(ref.current!.fit()).toBe(true);
      });
      expect(image).toHaveStyle({ width: '450px' });
      expect(canvas).toHaveAttribute('data-viewport-mode', 'fit');
      expect(canvas).toHaveAttribute('data-viewport-pan-x', '0');
    } finally {
      view.unmount();
      vi.unstubAllGlobals();
    }
  });

  it('starts custom zoom and pan from measured Fit instead of intrinsic scale', () => {
    const changes = vi.fn();
    render(
      <DiagramViewport
        svg='<svg xmlns="http://www.w3.org/2000/svg"/>'
        label="Huge"
        description={null}
        onChange={changes}
      />,
    );
    setViewportDimensions(3000, 1000, 300, 300);
    expect(screen.getByRole('img')).toHaveStyle({
      width: '300px',
      height: '100px',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(changes).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'custom', zoom: 0.125 }),
    );
    expect(screen.getByRole('img')).toHaveStyle({
      width: '375px',
      height: '125px',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    fireEvent.keyDown(screen.getByRole('group'), { key: 'ArrowRight' });
    expect(changes).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'custom', zoom: 0.1, pan_x: 0 }),
    );
    expect(screen.getByRole('img')).toHaveStyle({ width: '300px' });
  });
  it('refuses actions until decoded and after display failure', () => {
    const ref = createRef<DiagramViewportHandle>();
    render(
      <DiagramViewport
        ref={ref}
        svg='<svg xmlns="http://www.w3.org/2000/svg"/>'
        label="Ready"
        description={null}
      />,
    );
    expect(ref.current!.fit()).toBe(false);
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    setViewportDimensions();
    act(() => expect(ref.current!.fit()).toBe(true));
    fireEvent.error(screen.getByRole('img'));
    expect(ref.current!.zoomIn()).toBe(false);
    expect(
      screen.getByText(/The diagram preview could not be displayed/u),
    ).toBeInTheDocument();
  });
  it('bounds zoom and pan, preserves scale, and ignores a second pointer owner', () => {
    const ref = createRef<DiagramViewportHandle>();
    render(
      <DiagramViewport
        ref={ref}
        svg='<svg xmlns="http://www.w3.org/2000/svg"/>'
        label="Pan"
        description={null}
      />,
    );
    setViewportDimensions(10000, 2000, 1024, 768);
    act(() => {
      ref.current!.actual();
    });
    const canvas = screen.getByRole('group');
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 400, clientY: 400 });
    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      clientX: 8000,
      clientY: 8000,
    });
    expect(canvas).toHaveAttribute('data-viewport-pan-x', '0');
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      clientX: 8000,
      clientY: 8000,
    });
    expect(canvas).toHaveAttribute('data-viewport-pan-x', '4488');
    expect(canvas).toHaveAttribute('data-viewport-pan-y', '616');
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    for (let i = 0; i < 30; i++)
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(canvas).toHaveAttribute('data-viewport-scale', '8');
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(canvas).toHaveAttribute('data-viewport-pan-x', '0');
    expect(canvas).toHaveAttribute('data-viewport-scale', '0.1024');
  });
  it('discloses actual/reset/pan with a real modal and handles Back dismissal before viewport actions', () => {
    const ref = createRef<DiagramViewportHandle>();
    render(
      <DiagramViewport
        ref={ref}
        svg='<svg xmlns="http://www.w3.org/2000/svg"/>'
        label="Tools"
        description={null}
      />,
    );
    setViewportDimensions();
    fireEvent.click(screen.getByRole('button', { name: 'More diagram tools' }));
    expect(
      screen.getByRole('dialog', { name: 'Diagram tools' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actual size' }));
    expect(document.querySelector('.diagram-canvas')).toHaveAttribute(
      'data-viewport-scale',
      '1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pan right' }));
    expect(document.querySelector('.diagram-canvas')).toHaveAttribute(
      'data-viewport-pan-x',
      '80',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(document.querySelector('.diagram-canvas')).toHaveAttribute(
      'data-viewport-scale',
      '0.25',
    );
    act(() => expect(ref.current!.dismissModal()).toBe(true));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(ref.current!.dismissModal()).toBe(false);
  });
});

it('keeps embedded More Fit/Zoom scoped and shares the same measured state with a provider', () => {
  const shared = createRef<DiagramViewportHandle>();
  render(
    <>
      <figure>
        <DiagramViewport
          svg='<svg xmlns="http://www.w3.org/2000/svg"/>'
          label="Embedded first"
          description={null}
        />
      </figure>
      <DiagramViewport
        ref={shared}
        svg='<svg xmlns="http://www.w3.org/2000/svg"/>'
        label="Shared second"
        description={null}
      />
    </>,
  );
  const images = screen.getAllByRole('img');
  const canvases = screen.getAllByRole('group');
  for (let i = 0; i < 2; i++) {
    Object.defineProperties(images[i], {
      naturalWidth: { configurable: true, value: 3000 },
      naturalHeight: { configurable: true, value: 1000 },
    });
    Object.defineProperties(canvases[i], {
      clientWidth: { configurable: true, value: 300 },
      clientHeight: { configurable: true, value: 300 },
    });
    fireEvent.load(images[i]);
  }
  fireEvent.click(
    screen.getAllByRole('button', { name: 'More diagram tools' })[0],
  );
  const tools = within(screen.getByRole('dialog', { name: 'Diagram tools' }));
  fireEvent.click(tools.getByRole('button', { name: 'Zoom in' }));
  expect(images[0]).toHaveStyle({ width: '375px' });
  expect(images[1]).toHaveStyle({ width: '300px' });
  fireEvent.click(tools.getByRole('button', { name: 'Zoom out' }));
  expect(images[0]).toHaveStyle({ width: '300px' });
  act(() => {
    expect(shared.current!.zoomIn()).toBe(true);
  });
  expect(images[1]).toHaveStyle({ width: '375px' });
  fireEvent.click(tools.getByRole('button', { name: 'Fit' }));
  expect(images[0]).toHaveStyle({ width: '300px' });
  expect(images[1]).toHaveStyle({ width: '375px' });
  fireEvent.error(images[0]);
  for (const name of ['Fit', 'Zoom in', 'Zoom out'])
    expect(tools.getByRole('button', { name })).toBeDisabled();
});
