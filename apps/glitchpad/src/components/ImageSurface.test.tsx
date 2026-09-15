import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageSurface } from './ImageSurface';
import { createImageSession, type ImageRenderResult } from '../domain/image-contract';
import { makeSession } from '../test/fixtures';
import type { ShellSession } from '../domain/contracts';
import type { ImageDocumentState } from '../domain/image-contract';
import axe from 'axe-core';

const imageSession = () => {
  const source = makeSession('image', 'photo.png', 'Text', '', {}).source;
  return createImageSession(source, 'opaque', { identity: source.identity, byte_length: 24, modified_unix_nanos: null, change_token: null }, 'png', 'desktop');
};
const result = (): ImageRenderResult => ({
  source_id: 'opaque', request_id: 'test', external_revision: imageSession().external_revision!, failure: null,
  preview: { kind: 'full', png_bytes: [137,80,78,71,13,10,26,10], descriptor: { contract_version: 1, codec: 'png', family: 'raster', width: 1200, height: 800, display_width: 1200, display_height: 800, pixels: 960000, decoded_bytes: 3840000, orientation: 1, color_policy: 'rgba8_srgb_assumed', profile_status: 'not_provided', alpha: true, bits_per_pixel: 32, capabilities: { view: true, inspect_metadata: true, zoom: true, animate: false, select_frame: false, select_entry: false, export_entry: false, edit: false, save: false }, limitations: [] } },
  metadata: { observations: [], statuses: [], unknown_fields: 0, profile_present: false },
});

const createUrl = vi.fn(() => 'blob:owned-image');
const revokeUrl = vi.fn();

describe('read-only raster viewport', () => {
  beforeEach(() => { createUrl.mockClear(); revokeUrl.mockClear(); vi.stubGlobal('URL', class extends URL { static createObjectURL = createUrl; static revokeObjectURL = revokeUrl; }); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('pauses active animation when reduced motion changes and schedules no subsequent frames', async () => {
    let change!: () => void;
    const motion = { matches: false, addEventListener: vi.fn((_event: string, listener: () => void) => { change = listener; }), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', () => motion);
    const renderFrame = vi.fn(() => {
      const preview = result();
      Object.assign(preview.preview!.descriptor, { codec: 'gif', family: 'animation' });
      preview.family_state = { family: 'animation', paused: true, selected_frame: 0, frame_count: 3, loop_count: 0, frame_duration_ms: 40, max_composited_frames: 2 };
      return Promise.resolve(preview);
    });
    const view = render(<ImageSurface session={imageSession()} gateway={{ render: renderFrame }} />);
    await screen.findByRole('img');
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Play' }));
      expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');
      motion.matches = true;
      act(() => change());
      expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-pressed', 'false');
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(renderFrame).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); view.unmount(); }
    expect(motion.removeEventListener).toHaveBeenCalledWith('change', change);
  });
  it('starts animation paused, steps frames, and releases native retention only on suspension', async () => {
    const suspend = vi.fn(() => Promise.resolve());
    const renderFrame = vi.fn((session: ShellSession) => {
      const frame = session.image_document?.selection ?? 0;
      const preview = result();
      preview.request_id = `frame-${frame}`;
      Object.assign(preview.preview!.descriptor, { codec: 'gif', family: 'animation' });
      preview.family_state = { family: 'animation', paused: true, selected_frame: frame, frame_count: 3, loop_count: null, frame_duration_ms: 40, max_composited_frames: 2 };
      return Promise.resolve(preview);
    });
    const view = render(<ImageSurface session={imageSession()} gateway={{ render: renderFrame, suspend }} />);
    await screen.findByRole('button', { name: 'Play' });
    expect(renderFrame).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next frame' }));
    await waitFor(() => expect(screen.getByLabelText('Animation frame')).toHaveValue(2));
    expect(suspend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-pressed', 'false');
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await act(() => vi.advanceTimersByTimeAsync(40));
    expect(screen.getByLabelText('Animation frame')).toHaveValue(3);
    await act(() => vi.advanceTimersByTimeAsync(40));
    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-pressed', 'false');
    vi.useRealTimers();
    view.unmount();
    expect(suspend).toHaveBeenCalledWith('opaque', 'frame-2');
  });
  it('lists corrupt icon entries and aborts an export when selection changes', async () => {
    const entries = [0,1].map(index => ({ index, width: 1, height: 1, bits_per_pixel: 32, encoded_bytes: 64, preview: 'full' as const, encoding: 'png' as const, alpha: true, failure: null, duplicate_of: null }));
    let signal: AbortSignal | null = null;
    let finish!: (value: { status: 'exported'; durability: string }) => void;
    const exportEntry = vi.fn((_session: ShellSession, abort: AbortSignal) => { signal = abort; return new Promise<{ status: 'exported'; durability: string }>(resolve => { finish = resolve; }); });
    const renderEntry = (session: ShellSession) => {
      const preview = result();
      Object.assign(preview.preview!.descriptor, { codec: 'ico', family: 'ico' });
      preview.family_state = { family: 'ico', entries, selected_entry: session.image_document?.selection ?? 0, selected_entry_export: true };
      return Promise.resolve(preview);
    };
    render(<ImageSurface session={imageSession()} gateway={{ render: renderEntry, exportEntry }} />);
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: 'Export selected entry as PNG' }));
    expect(exportEntry).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Icon entry'), { target: { value: '1' } });
    await waitFor(() => expect(screen.getByLabelText('Icon entry')).toHaveValue('1'));
    expect((signal as unknown as AbortSignal).aborted).toBe(true);
    await act(() => Promise.resolve(finish({ status: 'exported', durability: 'atomic_file' })));
    expect(screen.queryByText('Selected entry exported as PNG.')).not.toBeInTheDocument();
  });
  it('renders inert image and supports keyboard zoom, pan recovery, fit, and background', async () => {
    render(<ImageSurface session={imageSession()} gateway={{ render: vi.fn(() => Promise.resolve(result())) }} />);
    await screen.findByRole('img', { name: 'photo.png' });
    fireEvent.click(screen.getByRole('button', { name: 'Actual size' }));
    const pane = screen.getByRole('group', { name: /Image viewport/u });
    fireEvent.keyDown(pane, { key: '+' });
    expect(screen.getByLabelText('Image zoom')).toHaveTextContent('125%');
    for (let n = 0; n < 100; n++) fireEvent.keyDown(pane, { key: 'ArrowRight' });
    expect(screen.getByRole('img').style.transform).toContain('-430px');
    fireEvent.keyDown(pane, { key: '0' });
    expect(screen.getByLabelText('Image zoom')).toHaveTextContent('100%');
    expect(screen.getByRole('img').style.transform).toContain('0px');
    fireEvent.change(screen.getByLabelText('Image background'), { target: { value: 'dark' } });
    expect(pane).toHaveClass('image-background-dark');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
  it('revokes object URL and cancels work on close', async () => {
    let signal!: AbortSignal;
    const view = render(<ImageSurface session={imageSession()} gateway={{ render: vi.fn((_s: ShellSession, abort: AbortSignal) => { signal = abort; return Promise.resolve(result()); }) }} />);
    await screen.findByRole('img');
    view.unmount();
    expect(signal.aborted).toBe(true);
    expect(revokeUrl).toHaveBeenCalledWith('blob:owned-image');
  });
  it('releases a rejected browser preview exactly once', async () => {
    const view = render(<ImageSurface session={imageSession()} gateway={{ render: () => Promise.resolve(result()) }} />);
    fireEvent.error(await screen.findByRole('img'));
    await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument());
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledTimes(1);
  });
  it('cannot publish late output after suspension', async () => {
    let resolve!: (value: ImageRenderResult) => void;
    const view = render(<ImageSurface session={imageSession()} gateway={{ render: () => new Promise(r => { resolve = r; }) }} />);
    view.unmount();
    await act(() => Promise.resolve(resolve(result())));
    expect(createUrl).not.toHaveBeenCalled();
  });
  it('publishes independent metadata when preview is refused', async () => {
    const onImageChange = vi.fn<(id: string, revision: number, image: ImageDocumentState) => void>();
    render(<ImageSurface session={imageSession()} onImageChange={onImageChange} gateway={{ render: () => Promise.resolve({ ...result(), preview: null, failure: 'oversized' }) }} />);
    await waitFor(() => expect(screen.getByText(/Image preview unavailable: oversized/u)).toBeInTheDocument());
    expect(onImageChange.mock.calls[0]?.[2].status).toBe('failed');
    expect(onImageChange.mock.calls[0]?.[2].metadata).not.toBeNull();
  });
  it('supports two touch pointers without losing reset or pan recovery', async () => {
    vi.stubGlobal('PointerEvent', class extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; }
    });
    render(<ImageSurface session={imageSession()} gateway={{ render: () => Promise.resolve(result()) }} />);
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: 'Actual size' }));
    const pane = screen.getByRole('group', { name: /Image viewport/u });
    fireEvent.pointerDown(pane, { pointerId: 1, clientX: 100, clientY: 200 });
    fireEvent.pointerDown(pane, { pointerId: 2, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(pane, { pointerId: 2, clientX: 300, clientY: 200 });
    expect(screen.getByLabelText('Image zoom')).toHaveTextContent('200%');
    fireEvent.pointerCancel(pane, { pointerId: 1 }); fireEvent.pointerUp(pane, { pointerId: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(screen.getByLabelText('Image zoom')).toHaveTextContent('100%');
  });
  it('releases the preview on application suspension and regenerates on resume', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const gateway = { render: vi.fn(() => Promise.resolve(result())) };
    render(<ImageSurface session={imageSession()} gateway={gateway} />);
    await screen.findByRole('img');
    visibility.mockReturnValue('hidden'); fireEvent(document, new Event('visibilitychange'));
    await screen.findByText('Image preview suspended.');
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    visibility.mockReturnValue('visible'); fireEvent(document, new Event('visibilitychange'));
    await screen.findByRole('img');
    expect(gateway.render).toHaveBeenCalledTimes(2);
  });
  it('has no serious or critical accessible-control findings', async () => {
    const { container } = render(<ImageSurface session={imageSession()} gateway={{ render: () => Promise.resolve(result()) }} />);
    await screen.findByRole('img');
    const results = await axe.run(container, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    expect(results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
});
