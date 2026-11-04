import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { useDiagnosticViewport } from './use-diagnostic-viewport';
import type { DiagnosticViewport } from '../domain/diagnostic-viewport';

const viewport: DiagnosticViewport = {
  webview_screen: { left: 0, top: 0, right: 320, bottom: 640 },
  visible_screen: { left: 0, top: 48, right: 320, bottom: 592 },
  view_width: 320,
  view_height: 640,
  density: 1,
};
const deferred = () => {
  let resolve!: (value: DiagnosticViewport | null) => void;
  const promise = new Promise<DiagnosticViewport | null>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function Fixture({ read }: { read: () => Promise<DiagnosticViewport | null> }) {
  const ref = useRef<HTMLElement>(null);
  useDiagnosticViewport(ref, read);
  return (
    <div data-testid="parent">
      <aside data-testid="sheet" ref={ref} />
    </div>
  );
}

describe('live diagnostic sheet viewport ownership', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  beforeEach(() => {
    frames = new Map();
    nextFrame = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id);
    });
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(320);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 48, 320, 592),
    );
  });
  afterEach(() => vi.restoreAllMocks());
  const frame = async () => {
    await act(async () => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
      await Promise.resolve();
    });
  };

  it('applies only measured remaining crop and clears unavailable observations', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(viewport)
      .mockResolvedValueOnce(null);
    const view = render(<Fixture read={read} />);
    await frame();
    const sheet = view.getByTestId('sheet');
    expect(sheet).toHaveAttribute('data-native-viewport', 'true');
    expect(sheet.style.getPropertyValue('--gl-diagnostic-block-end')).toBe(
      '48px',
    );
    expect(sheet.style.getPropertyValue('--gl-diagnostic-block-size')).toBe(
      '544px',
    );
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(sheet).toHaveAttribute('data-native-viewport', 'true');
    await frame();
    expect(sheet).not.toHaveAttribute('data-native-viewport');
    expect(sheet.style.getPropertyValue('--gl-diagnostic-block-end')).toBe('');
  });

  it('coalesces resize signals, rejects an old response, and releases pending work on unmount', async () => {
    const first = deferred();
    const second = deferred();
    const third = deferred();
    const read = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise);
    const view = render(<Fixture read={read} />);
    await frame();
    act(() => {
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('orientationchange'));
      window.dispatchEvent(new Event('resize'));
    });
    expect(read).toHaveBeenCalledTimes(1);
    await act(async () => {
      first.resolve(viewport);
      await first.promise;
    });
    expect(view.getByTestId('sheet')).not.toHaveAttribute(
      'data-native-viewport',
    );
    await frame();
    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => {
      second.resolve(viewport);
      await second.promise;
    });
    const sheet = view.getByTestId('sheet');
    expect(sheet).toHaveAttribute('data-native-viewport', 'true');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await frame();
    view.unmount();
    await act(async () => {
      third.resolve(viewport);
      await third.promise;
    });
    expect(sheet).not.toHaveAttribute('data-native-viewport');
    expect(frames.size).toBe(0);
  });
});
