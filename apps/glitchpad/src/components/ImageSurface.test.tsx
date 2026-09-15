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
