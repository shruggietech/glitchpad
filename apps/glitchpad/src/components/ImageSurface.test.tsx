import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef, useState } from 'react';
import {
  collectFailureEvents,
  recordFailure,
} from '../domain/diagnostic-failures';
import { ImageSurface } from './ImageSurface';
import { ImagePreviewError } from '../domain/image-gateway';
import type { TextEditorHandle } from './TextEditorSurface';
import {
  createImageSession,
  type ImageRenderResult,
} from '../domain/image-contract';
import { makeSession } from '../test/fixtures';
import type { ShellSession } from '../domain/contracts';
import type { ImageDocumentState } from '../domain/image-contract';
import axe from 'axe-core';

const imageSession = () => {
  const source = makeSession('image', 'photo.png', 'Text', '', {}).source;
  return createImageSession(
    source,
    'opaque',
    {
      identity: source.identity,
      byte_length: 24,
      modified_unix_nanos: null,
      change_token: null,
    },
    'png',
    'desktop',
  );
};
const result = (): ImageRenderResult => ({
  source_id: 'opaque',
  request_id: 'test',
  external_revision: imageSession().external_revision!,
  failure: null,
  preview: {
    kind: 'full',
    png_bytes: [137, 80, 78, 71, 13, 10, 26, 10],
    descriptor: {
      contract_version: 1,
      codec: 'png',
      family: 'raster',
      width: 1200,
      height: 800,
      display_width: 1200,
      display_height: 800,
      pixels: 960000,
      decoded_bytes: 3840000,
      orientation: 1,
      color_policy: 'rgba8_srgb_assumed',
      profile_status: 'not_provided',
      alpha: true,
      bits_per_pixel: 32,
      capabilities: {
        view: true,
        inspect_metadata: true,
        zoom: true,
        animate: false,
        select_frame: false,
        select_entry: false,
        export_entry: false,
        edit: false,
        save: false,
      },
      limitations: [],
    },
  },
  metadata: {
    observations: [],
    statuses: [],
    unknown_fields: 0,
    profile_present: false,
  },
});

const createUrl = vi.fn(() => 'blob:owned-image');
const revokeUrl = vi.fn();

const imageControl = (name: string) => {
  let target = screen.queryByRole('button', { name });
  if (target) return target;
  const close = screen.queryByRole('button', { name: 'Close Image tools' });
  if (close) {
    fireEvent.click(close);
    target = screen.queryByRole('button', { name });
    if (target) return target;
  }
  fireEvent.click(screen.getByRole('button', { name: 'More image tools' }));
  return screen.getByRole('button', { name });
};
const imageField = (name: string) => {
  const target = screen.queryByLabelText(name);
  if (target) return target;
  imageControl('Actual size');
  return screen.getByLabelText(name);
};

describe('read-only raster viewport', () => {
  it('publishes one failed image state for a native render rejection without leaking exception text or restarting render', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'SyntheticWebViewNoPlatform/1',
    );
    const original = { ...imageSession(), lifecycle: 'active' as const };
    const ref = createRef<TextEditorHandle>();
    const renderImage = vi.fn(() =>
      Promise.reject(
        new Error('private document bytes content://private/provider'),
      ),
    );
    const published = vi.fn();
    const before = (await collectFailureEvents()).length;
    function ParentContract() {
      const [session, setSession] = useState(original);
      return (
        <ImageSurface
          ref={ref}
          session={session}
          gateway={gateway}
          onImageChange={(id, revision, image) => {
            published(id, revision, image);
            setSession((previous) => ({ ...previous, image_document: image }));
            if (image.status === 'failed')
              recordFailure('image', 'render', 'image_render_failed');
          }}
        />
      );
    }
    const gateway = { render: renderImage };
    {
      render(<ParentContract />);
      await waitFor(() =>
        expect(
          screen.getByText(/This image could not be previewed safely/u),
        ).toBeInTheDocument(),
      );
      expect(published).toHaveBeenCalledTimes(1);
      expect(published).toHaveBeenCalledWith(
        original.id,
        original.revision,
        expect.objectContaining({ status: 'failed' }),
      );
      expect(renderImage).toHaveBeenCalledTimes(1);
      expect(ref.current!.invoke('zoom_in')).toBe(false);
      expect(ref.current!.invoke('fit')).toBe(false);
      const failures = (await collectFailureEvents()).slice(before);
      expect(failures).toHaveLength(1);
      const { occurred_unix_ms, platform, failure, ...fields } = failures[0];
      expect(Number.isSafeInteger(occurred_unix_ms)).toBe(true);
      expect(platform).toBe('unknown');
      expect(fields).toEqual({
        level: 'error',
        event_id: 'task_failed',
        component: 'renderer',
        duration_ms: null,
        byte_count: null,
        error_code: 'image_render_failed',
      });
      expect(failure).toBeDefined();
      const { correlation_id, ...failureFields } = failure!;
      expect(correlation_id).toMatch(/^[0-9a-f]{32}$/u);
      expect(failureFields).toEqual({
        component: 'image',
        stage: 'render',
        reason: 'image_render_failed',
      });
      expect(JSON.stringify(published.mock.calls)).not.toContain(
        'content://private',
      );
      expect(JSON.stringify(failures)).not.toContain('private document bytes');
      expect(original.source_id).toBe('opaque');
    }
  });

  it('routes shared Zoom and Fit to the same local viewport and refuses without preview', async () => {
    const ref = createRef<TextEditorHandle>();
    let resolve!: (value: ImageRenderResult) => void;
    const renderImage = vi.fn(
      () =>
        new Promise<ImageRenderResult>((done) => {
          resolve = done;
        }),
    );
    render(
      <ImageSurface
        ref={ref}
        session={{ ...imageSession(), lifecycle: 'active' }}
        gateway={{ render: renderImage }}
      />,
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current!.invoke('zoom_in')).toBe(false);
    expect(ref.current!.invoke('fit')).toBe(false);
    await act(async () => {
      resolve(result());
      await Promise.resolve();
    });
    await screen.findByRole('img', { hidden: true });
    act(() => {
      expect(ref.current!.invoke('zoom_in')).toBe(true);
    });
    expect(screen.getByLabelText('Image zoom')).toHaveTextContent('66.7%');
    fireEvent.click(imageControl('Zoom in'));
    expect(screen.getByLabelText('Image zoom')).toHaveTextContent('83.3%');
    act(() => {
      expect(ref.current!.invoke('fit')).toBe(true);
    });
    expect(screen.getByLabelText('Image zoom')).toHaveTextContent('53.3%');
  });
  let decoder: MutationObserver;
  beforeEach(() => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="bb-overlay-root"></div>',
    );
    Object.defineProperties(HTMLImageElement.prototype, {
      naturalWidth: { configurable: true, get: () => 1200 },
      naturalHeight: { configurable: true, get: () => 800 },
    });
    decoder = new MutationObserver((records) => {
      for (const r of records) {
        const images = [...r.addedNodes].flatMap((n) =>
          n instanceof HTMLImageElement
            ? [n]
            : n instanceof Element
              ? [...n.querySelectorAll('img')]
              : [],
        );
        if (r.type === 'attributes' && r.target instanceof HTMLImageElement)
          images.push(r.target);
        for (const image of images) fireEvent.load(image);
      }
    });
    decoder.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
    createUrl.mockClear();
    revokeUrl.mockClear();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = createUrl;
        static revokeObjectURL = revokeUrl;
      },
    );
  });
  afterEach(() => {
    decoder.disconnect();
    document.getElementById('bb-overlay-root')?.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('rerenders the settled current image for a recovery generation and retries the native failure once', async () => {
    const current = { ...imageSession(), lifecycle: 'active' as const };
    const originalSource = JSON.stringify(current.source);
    const ref = createRef<TextEditorHandle>();
    const nativeFailure = new ImagePreviewError({
      kind: 'host_transport',
      retryable: true,
    });
    const renderImage = vi
      .fn<
        (
          session: ShellSession,
          signal: AbortSignal,
        ) => Promise<ImageRenderResult>
      >()
      .mockResolvedValueOnce(result())
      .mockRejectedValueOnce(nativeFailure)
      .mockResolvedValueOnce(result());
    const gateway = { render: renderImage };
    const { rerender } = render(
      <ImageSurface
        ref={ref}
        session={current}
        gateway={gateway}
        recoveryProbeGeneration={0}
      />,
    );
    await waitFor(() =>
      expect(
        document.querySelector('[data-preview-ready=true]'),
      ).not.toBeNull(),
    );
    expect(renderImage).toHaveBeenCalledTimes(1);
    rerender(
      <ImageSurface
        ref={ref}
        session={current}
        gateway={gateway}
        recoveryProbeGeneration={1}
      />,
    );
    await waitFor(() =>
      expect(
        document.querySelector('[data-preview-failure=host_transport]'),
      ).not.toBeNull(),
    );
    expect(renderImage).toHaveBeenCalledTimes(2);
    expect(ref.current!.invoke('fit')).toBe(false);
    expect(ref.current!.invoke('zoom_in')).toBe(false);
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
    await waitFor(() =>
      expect(
        document.querySelector('[data-preview-ready=true]'),
      ).not.toBeNull(),
    );
    expect(renderImage).toHaveBeenCalledTimes(3);
    expect(
      renderImage.mock.calls.every(
        ([session]) =>
          session.id === current.id && session.source_id === current.source_id,
      ),
    ).toBe(true);
    expect(JSON.stringify(current.source)).toBe(originalSource);
    expect(
      document.querySelector('[data-preview-failure=host_transport]'),
    ).toBeNull();
  });

  it('pauses active animation when reduced motion changes and schedules no subsequent frames', async () => {
    let change!: () => void;
    const motion = {
      matches: false,
      addEventListener: vi.fn((_event: string, listener: () => void) => {
        change = listener;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', () => motion);
    const renderFrame = vi.fn(() => {
      const preview = result();
      Object.assign(preview.preview!.descriptor, {
        codec: 'gif',
        family: 'animation',
      });
      preview.family_state = {
        family: 'animation',
        paused: true,
        selected_frame: 0,
        frame_count: 3,
        loop_count: 0,
        frame_duration_ms: 40,
        max_composited_frames: 2,
      };
      return Promise.resolve(preview);
    });
    const view = render(
      <ImageSurface
        session={imageSession()}
        gateway={{ render: renderFrame }}
      />,
    );
    await screen.findByRole('img', { hidden: true });
    vi.useFakeTimers();
    try {
      fireEvent.click(imageControl('Play'));
      expect(imageControl('Pause')).toHaveAttribute('aria-pressed', 'true');
      motion.matches = true;
      act(() => change());
      expect(imageControl('Play')).toHaveAttribute('aria-pressed', 'false');
      expect(imageControl('Play')).toBeDisabled();
      fireEvent.click(imageControl('Play'));
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(renderFrame).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      view.unmount();
    }
    expect(motion.removeEventListener).toHaveBeenCalledWith('change', change);
  });
  it('prevents playback when reduced motion already matches while retaining manual frame controls', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const renderFrame = vi.fn((session: ShellSession) => {
      const preview = result();
      Object.assign(preview.preview!.descriptor, {
        codec: 'gif',
        family: 'animation',
      });
      preview.family_state = {
        family: 'animation',
        paused: true,
        selected_frame: session.image_document?.selection ?? 0,
        frame_count: 3,
        loop_count: 0,
        frame_duration_ms: 40,
        max_composited_frames: 2,
      };
      return Promise.resolve(preview);
    });
    const view = render(
      <ImageSurface
        session={imageSession()}
        gateway={{ render: renderFrame }}
      />,
    );
    await screen.findByRole('img', { hidden: true });
    expect(imageControl('Play')).toBeDisabled();
    fireEvent.click(imageControl('Next frame'));
    await waitFor(() => expect(imageField('Animation frame')).toHaveValue(2));
    vi.useFakeTimers();
    try {
      fireEvent.click(imageControl('Play'));
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(renderFrame).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      view.unmount();
    }
  });
  it.each([
    { codec: 'gif', loops: 1 },
    { codec: 'webp', loops: 2 },
  ])(
    'preserves the encoded finite-loop allowance across pause and resume for $codec',
    async ({ codec, loops }) => {
      const renderFrame = vi.fn((session: ShellSession) => {
        const preview = result();
        Object.assign(preview.preview!.descriptor, {
          codec,
          family: 'animation',
        });
        preview.family_state = {
          family: 'animation',
          paused: true,
          selected_frame: session.image_document?.selection ?? 0,
          frame_count: 3,
          loop_count: loops,
          frame_duration_ms: 40,
          max_composited_frames: 2,
        };
        return Promise.resolve(preview);
      });
      const view = render(
        <ImageSurface
          session={imageSession()}
          gateway={{ render: renderFrame }}
        />,
      );
      await screen.findByRole('img', { hidden: true });
      vi.useFakeTimers();
      try {
        fireEvent.click(imageControl('Play'));
        for (let frame = 0; frame < 4; frame++)
          await act(() => vi.advanceTimersByTimeAsync(40));
        expect(imageField('Animation frame')).toHaveValue(2);
        fireEvent.click(imageControl('Pause'));
        fireEvent.click(imageControl('Play'));
        await act(() => vi.advanceTimersByTimeAsync(40));
        fireEvent.click(imageControl('Pause'));
        fireEvent.click(imageControl('Play'));
        await act(() => vi.advanceTimersByTimeAsync(0));
        expect(imageField('Animation frame')).toHaveValue(3);
        await act(() => vi.advanceTimersByTimeAsync(40));
        expect(imageControl('Play')).toHaveAttribute('aria-pressed', 'false');
        expect(renderFrame).toHaveBeenCalledTimes(6);
      } finally {
        vi.useRealTimers();
        view.unmount();
      }
    },
  );
  it('starts animation paused, steps frames, and releases native retention only on suspension', async () => {
    const suspend = vi.fn(() => Promise.resolve());
    const renderFrame = vi.fn((session: ShellSession) => {
      const frame = session.image_document?.selection ?? 0;
      const preview = result();
      preview.request_id = `frame-${frame}`;
      Object.assign(preview.preview!.descriptor, {
        codec: 'gif',
        family: 'animation',
      });
      preview.family_state = {
        family: 'animation',
        paused: true,
        selected_frame: frame,
        frame_count: 3,
        loop_count: null,
        frame_duration_ms: 40,
        max_composited_frames: 2,
      };
      return Promise.resolve(preview);
    });
    const view = render(
      <ImageSurface
        session={imageSession()}
        gateway={{ render: renderFrame, suspend }}
      />,
    );
    await screen.findByRole('img', { hidden: true });
    imageControl('Play');
    expect(renderFrame).toHaveBeenCalledTimes(1);
    fireEvent.click(imageControl('Next frame'));
    await waitFor(() => expect(imageField('Animation frame')).toHaveValue(2));
    expect(suspend).not.toHaveBeenCalled();
    expect(imageControl('Play')).toHaveAttribute('aria-pressed', 'false');
    vi.useFakeTimers();
    fireEvent.click(imageControl('Play'));
    await act(() => vi.advanceTimersByTimeAsync(40));
    expect(imageField('Animation frame')).toHaveValue(3);
    await act(() => vi.advanceTimersByTimeAsync(40));
    expect(imageControl('Play')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(imageControl('Play'));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(imageField('Animation frame')).toHaveValue(1);
    expect(imageControl('Pause')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(imageControl('Pause'));
    vi.useRealTimers();
    view.unmount();
    expect(suspend).toHaveBeenCalledWith('opaque', 'frame-0');
  });
  it('reports a selected PNG export write-error rejection and retains entry, viewport, and source identity', async () => {
    const original = imageSession();
    original.source.display_name = 'icons.ico';
    original.image_document!.codec = 'ico';
    original.image_document!.selection = 1;
    original.image_document!.viewport = {
      mode: 'actual',
      zoom: 1.25,
      pan_x: 20,
      pan_y: -10,
      background: 'dark',
    };
    const originalSnapshot = structuredClone(original);
    const entries = [0, 1].map((index) => ({
      index,
      width: 4,
      height: 3,
      bits_per_pixel: 32,
      encoded_bytes: 64,
      preview: 'full' as const,
      encoding: index === 1 ? ('dib' as const) : ('png' as const),
      alpha: true,
      failure: null,
      duplicate_of: null,
    }));
    const renderEntry = vi.fn(() => {
      const preview = result();
      Object.assign(preview.preview!.descriptor, {
        codec: 'ico',
        family: 'ico',
      });
      preview.family_state = {
        family: 'ico',
        entries,
        selected_entry: 1,
        selected_entry_export: true,
      };
      return Promise.resolve(preview);
    });
    let rejectWrite!: (error: Error) => void;
    const exportEntry = vi.fn<
      (
        session: ShellSession,
        signal: AbortSignal,
      ) => Promise<{ status: 'exported'; durability: string }>
    >(
      () =>
        new Promise((_resolve, reject) => {
          rejectWrite = reject;
        }),
    );
    render(
      <ImageSurface
        session={original}
        gateway={{ render: renderEntry, exportEntry }}
      />,
    );
    const image = await screen.findByRole('img', { name: 'icons.ico' });
    const pane = document.querySelector('.image-pane')!;
    const attributes = [
      'data-image-selection',
      'data-viewport-mode',
      'data-viewport-scale',
      'data-viewport-pan-x',
      'data-viewport-pan-y',
      'data-viewport-background',
    ];
    const viewportBefore = attributes.map((name) => pane.getAttribute(name));
    const bitmapBefore = image.getAttribute('src');
    fireEvent.click(imageControl('Export selected entry as PNG'));
    expect(exportEntry).toHaveBeenCalledOnce();
    const [request, signal] = exportEntry.mock.calls[0];
    expect(request.source).toEqual(originalSnapshot.source);
    expect(request.source_id).toBe(originalSnapshot.source_id);
    expect(request.external_revision).toEqual(
      originalSnapshot.external_revision,
    );
    expect(request.image_document!.family_state).toEqual(
      expect.objectContaining({ family: 'ico', selected_entry: 1 }),
    );
    expect(signal.aborted).toBe(false);
    expect(
      screen.getByText('Choose a destination for the selected PNG entry.'),
    ).toBeInTheDocument();
    await act(async () => {
      rejectWrite(
        Object.assign(new Error('private provider write failure'), {
          category: 'partial_write_prevented',
          context: { operation: 'image_export_stage_write' },
        }),
      );
      await Promise.resolve();
    });
    expect(
      screen.getByText(
        'Export could not complete safely. The original icon remains unchanged.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Selected entry exported as PNG.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('private provider write failure'),
    ).not.toBeInTheDocument();
    expect(attributes.map((name) => pane.getAttribute(name))).toEqual(
      viewportBefore,
    );
    expect(image.getAttribute('src')).toBe(bitmapBefore);
    expect(screen.getByRole('combobox', { name: 'Icon entry' })).toHaveValue(
      '1',
    );
    expect(
      screen.getByRole('button', { name: 'Export selected entry as PNG' }),
    ).toBeEnabled();
    expect(renderEntry).toHaveBeenCalledOnce();
    expect(original).toEqual(originalSnapshot);
  });

  it('preserves native chooser export and its receipt across visibility suspension and preview regeneration', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible');
    let signal!: AbortSignal;
    let finish!: (value: { status: 'cancelled'; durability: null }) => void;
    const exportEntry = vi.fn((_session: ShellSession, abort: AbortSignal) => {
      signal = abort;
      return new Promise<{ status: 'cancelled'; durability: null }>(
        (resolve) => {
          finish = resolve;
        },
      );
    });
    const renderEntry = vi.fn(() => {
      const preview = result();
      Object.assign(preview.preview!.descriptor, {
        codec: 'ico',
        family: 'ico',
      });
      preview.family_state = {
        family: 'ico',
        entries: [
          {
            index: 0,
            width: 1,
            height: 1,
            bits_per_pixel: 32,
            encoded_bytes: 64,
            preview: 'full',
            encoding: 'png',
            alpha: true,
            failure: null,
            duplicate_of: null,
          },
        ],
        selected_entry: 0,
        selected_entry_export: true,
      };
      return Promise.resolve(preview);
    });
    const view = render(
      <ImageSurface
        session={imageSession()}
        gateway={{ render: renderEntry, exportEntry }}
      />,
    );
    await screen.findByRole('img', { hidden: true });
    fireEvent.click(imageControl('Export selected entry as PNG'));
    visibility.mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    expect(signal.aborted).toBe(false);
    await act(() =>
      Promise.resolve(finish({ status: 'cancelled', durability: null })),
    );
    visibility.mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    await screen.findByRole('img', { hidden: true });
    expect(renderEntry).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Export cancelled.')).toBeInTheDocument();
    view.unmount();
  });
  it('lists corrupt icon entries and aborts an export when selection changes', async () => {
    const entries = [0, 1].map((index) => ({
      index,
      width: 1,
      height: 1,
      bits_per_pixel: 32,
      encoded_bytes: 64,
      preview: 'full' as const,
      encoding: 'png' as const,
      alpha: true,
      failure: null,
      duplicate_of: null,
    }));
    let signal: AbortSignal | null = null;
    let finish!: (value: { status: 'exported'; durability: string }) => void;
    const exportEntry = vi.fn((_session: ShellSession, abort: AbortSignal) => {
      signal = abort;
      return new Promise<{ status: 'exported'; durability: string }>(
        (resolve) => {
          finish = resolve;
        },
      );
    });
    const renderEntry = (session: ShellSession) => {
      const preview = result();
      Object.assign(preview.preview!.descriptor, {
        codec: 'ico',
        family: 'ico',
      });
      preview.family_state = {
        family: 'ico',
        entries,
        selected_entry: session.image_document?.selection ?? 0,
        selected_entry_export: true,
      };
      return Promise.resolve(preview);
    };
    render(
      <ImageSurface
        session={imageSession()}
        gateway={{ render: renderEntry, exportEntry }}
      />,
    );
    await screen.findByRole('img', { hidden: true });
    fireEvent.click(imageControl('Export selected entry as PNG'));
    expect(screen.getByLabelText('Selected icon details')).toHaveTextContent(
      '32 bit; 64 bytes; alpha yes',
    );
    expect(exportEntry).toHaveBeenCalledTimes(1);
    fireEvent.change(imageField('Icon entry'), { target: { value: '1' } });
    await waitFor(() => expect(imageField('Icon entry')).toHaveValue('1'));
    expect((signal as unknown as AbortSignal).aborted).toBe(true);
    await act(() =>
      Promise.resolve(
        finish({ status: 'exported', durability: 'atomic_file' }),
      ),
    );
    expect(
      screen.queryByText('Selected entry exported as PNG.'),
    ).not.toBeInTheDocument();
  });
  it('renders inert image and supports keyboard zoom, pan recovery, fit, and background', async () => {
    render(
      <ImageSurface
        session={imageSession()}
        gateway={{ render: vi.fn(() => Promise.resolve(result())) }}
      />,
    );
    await screen.findByRole('img', { name: 'photo.png' });
    fireEvent.click(imageControl('Actual size'));
    fireEvent.click(screen.getByRole('button', { name: 'Close Image tools' }));
    const pane = screen.getByRole('group', { name: /Image viewport/u });
    fireEvent.keyDown(pane, { key: '+' });
    expect(screen.getByLabelText('Image zoom')).toHaveTextContent('125%');
    for (let n = 0; n < 100; n++)
      fireEvent.keyDown(pane, { key: 'ArrowRight' });
    expect(screen.getByRole('img', { hidden: true }).style.transform).toContain(
      '-430px',
    );
    fireEvent.keyDown(pane, { key: '0' });
    expect(screen.getByLabelText('Image zoom')).toHaveTextContent('53.3%');
    expect(screen.getByRole('img', { hidden: true }).style.transform).toContain(
      '0px',
    );
    for (const background of ['dark', 'light', 'checker']) {
      fireEvent.change(imageField('Image background'), {
        target: { value: background },
      });
      expect(pane).toHaveClass('image-background-' + background);
      expect(pane).toHaveAttribute('data-viewport-background', background);
    }
    expect(
      screen.queryByRole('button', { name: 'Save' }),
    ).not.toBeInTheDocument();
  });
  it('revokes object URL and cancels work on close', async () => {
    let signal!: AbortSignal;
    const view = render(
      <ImageSurface
        session={imageSession()}
        gateway={{
          render: vi.fn((_s: ShellSession, abort: AbortSignal) => {
            signal = abort;
            return Promise.resolve(result());
          }),
        }}
      />,
    );
    await screen.findByRole('img', { hidden: true });
    view.unmount();
    expect(signal.aborted).toBe(true);
    expect(revokeUrl).toHaveBeenCalledWith('blob:owned-image');
  });
  it('releases a rejected browser preview exactly once', async () => {
    const onImageChange = vi.fn();
    const session = imageSession();
    const view = render(
      <ImageSurface
        session={session}
        onImageChange={onImageChange}
        gateway={{ render: () => Promise.resolve(result()) }}
      />,
    );
    const image = await screen.findByRole('img', { hidden: true });
    onImageChange.mockClear();
    fireEvent.error(image);
    fireEvent.error(image);
    await waitFor(() =>
      expect(screen.queryByRole('img')).not.toBeInTheDocument(),
    );
    expect(onImageChange).toHaveBeenCalledTimes(1);
    expect(onImageChange).toHaveBeenCalledWith(
      session.id,
      session.revision,
      expect.objectContaining({ status: 'failed' }),
    );
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledTimes(1);
  });
  it('cannot publish late output after suspension', async () => {
    let resolve!: (value: ImageRenderResult) => void;
    const view = render(
      <ImageSurface
        session={imageSession()}
        gateway={{
          render: () =>
            new Promise((r) => {
              resolve = r;
            }),
        }}
      />,
    );
    view.unmount();
    await act(() => Promise.resolve(resolve(result())));
    expect(createUrl).not.toHaveBeenCalled();
  });
  it('publishes independent metadata when preview is refused', async () => {
    const onImageChange =
      vi.fn<
        (id: string, revision: number, image: ImageDocumentState) => void
      >();
    render(
      <ImageSurface
        session={imageSession()}
        onImageChange={onImageChange}
        gateway={{
          render: () =>
            Promise.resolve({
              ...result(),
              preview: null,
              failure: 'oversized',
            }),
        }}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/image exceeds preview resource limits/u),
      ).toBeInTheDocument(),
    );
    expect(onImageChange.mock.calls[0]?.[2].status).toBe('failed');
    expect(onImageChange.mock.calls[0]?.[2].metadata).not.toBeNull();
  });
  it('supports two touch pointers without losing reset or pan recovery', async () => {
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        readonly pointerId: number;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 0;
        }
      },
    );
    render(
      <ImageSurface
        session={imageSession()}
        gateway={{ render: () => Promise.resolve(result()) }}
      />,
    );
    await screen.findByRole('img', { hidden: true });
    fireEvent.click(imageControl('Actual size'));
    fireEvent.click(screen.getByRole('button', { name: 'Close Image tools' }));
    const pane = screen.getByRole('group', { name: /Image viewport/u });
    fireEvent.pointerDown(pane, { pointerId: 1, clientX: 100, clientY: 200 });
    fireEvent.pointerDown(pane, { pointerId: 2, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(pane, { pointerId: 2, clientX: 300, clientY: 200 });
    expect(screen.getByLabelText('Image zoom')).toHaveTextContent('200%');
    fireEvent.pointerCancel(pane, { pointerId: 1 });
    fireEvent.pointerUp(pane, { pointerId: 2 });
    fireEvent.click(imageControl('Reset view'));
    expect(screen.getByLabelText('Image zoom')).toHaveTextContent('53.3%');
  });
  it('pauses active playback when stepping frames and enforces first and last frame bounds', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const renderFrame = vi.fn((session: ShellSession) => {
      const preview = result();
      Object.assign(preview.preview!.descriptor, {
        codec: 'gif',
        family: 'animation',
      });
      preview.family_state = {
        family: 'animation',
        paused: true,
        selected_frame: session.image_document?.selection ?? 0,
        frame_count: 3,
        loop_count: 0,
        frame_duration_ms: 40,
        max_composited_frames: 2,
      };
      return Promise.resolve(preview);
    });
    const view = render(
      <ImageSurface
        session={imageSession()}
        gateway={{ render: renderFrame }}
      />,
    );
    await screen.findByRole('img');
    vi.useFakeTimers();
    try {
      expect(imageControl('Previous frame')).toBeDisabled();
      fireEvent.click(imageControl('Play'));
      await act(() => vi.advanceTimersByTimeAsync(40));
      expect(imageField('Animation frame')).toHaveValue(2);
      fireEvent.click(imageControl('Previous frame'));
      await act(() => Promise.resolve());
      expect(imageField('Animation frame')).toHaveValue(1);
      expect(imageControl('Play')).toHaveAttribute('aria-pressed', 'false');
      expect(imageControl('Previous frame')).toBeDisabled();
      const stoppedAfterPrevious = renderFrame.mock.calls.length;
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(renderFrame).toHaveBeenCalledTimes(stoppedAfterPrevious);
      fireEvent.click(imageControl('Play'));
      await act(() => vi.advanceTimersByTimeAsync(40));
      expect(imageField('Animation frame')).toHaveValue(2);
      fireEvent.click(imageControl('Next frame'));
      await act(() => Promise.resolve());
      expect(imageField('Animation frame')).toHaveValue(3);
      expect(imageControl('Play')).toHaveAttribute('aria-pressed', 'false');
      expect(imageControl('Next frame')).toBeDisabled();
      const stoppedAfterNext = renderFrame.mock.calls.length;
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(renderFrame).toHaveBeenCalledTimes(stoppedAfterNext);
    } finally {
      vi.useRealTimers();
      view.unmount();
    }
  });

  it('stops active animated playback in the background and remains paused after returning', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible');
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const renderFrame = vi.fn((session: ShellSession) => {
      const preview = result();
      Object.assign(preview.preview!.descriptor, {
        codec: 'gif',
        family: 'animation',
      });
      preview.family_state = {
        family: 'animation',
        paused: true,
        selected_frame: session.image_document?.selection ?? 0,
        frame_count: 3,
        loop_count: 0,
        frame_duration_ms: 40,
        max_composited_frames: 2,
      };
      return Promise.resolve(preview);
    });
    const view = render(
      <ImageSurface
        session={imageSession()}
        gateway={{ render: renderFrame }}
      />,
    );
    await screen.findByRole('img');
    vi.useFakeTimers();
    try {
      fireEvent.click(imageControl('Play'));
      await act(() => vi.advanceTimersByTimeAsync(40));
      expect(imageField('Animation frame')).toHaveValue(2);
      expect(imageControl('Pause')).toHaveAttribute('aria-pressed', 'true');
      expect(renderFrame).toHaveBeenCalledTimes(2);
      visibility.mockReturnValue('hidden');
      fireEvent(document, new Event('visibilitychange'));
      expect(screen.getByText('Image preview suspended.')).toBeInTheDocument();
      expect(document.querySelector('.image-preview')).toBeNull();
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(renderFrame).toHaveBeenCalledTimes(2);
      visibility.mockReturnValue('visible');
      await act(async () => {
        fireEvent(document, new Event('visibilitychange'));
        await Promise.resolve();
      });
      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
      expect(imageField('Animation frame')).toHaveValue(2);
      expect(imageControl('Play')).toHaveAttribute('aria-pressed', 'false');
      expect(renderFrame).toHaveBeenCalledTimes(3);
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(renderFrame).toHaveBeenCalledTimes(3);
      expect(imageField('Animation frame')).toHaveValue(2);
      fireEvent.click(imageControl('Play'));
      await act(() => vi.advanceTimersByTimeAsync(40));
      expect(imageField('Animation frame')).toHaveValue(3);
      expect(renderFrame).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
      view.unmount();
    }
  });
  it('releases the preview on application suspension and regenerates on resume', async () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible');
    const gateway = { render: vi.fn(() => Promise.resolve(result())) };
    render(<ImageSurface session={imageSession()} gateway={gateway} />);
    await screen.findByRole('img', { hidden: true });
    visibility.mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    await screen.findByText('Image preview suspended.');
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(createUrl.mock.calls.length - revokeUrl.mock.calls.length).toBe(0);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(gateway.render).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    await screen.findByRole('img', { hidden: true });
    expect(gateway.render).toHaveBeenCalledTimes(2);
  });
  it.each(['gif', 'svg', 'ico'] as const)(
    'has no serious or critical automated accessibility findings for %s controls',
    async (codec) => {
      const preview = result();
      preview.preview!.descriptor.codec = codec;
      if (codec === 'gif') {
        preview.preview!.descriptor.family = 'animation';
        preview.family_state = {
          family: 'animation',
          paused: true,
          selected_frame: 0,
          frame_count: 3,
          loop_count: 0,
          frame_duration_ms: 40,
          max_composited_frames: 2,
        };
      } else if (codec === 'svg') {
        preview.preview!.descriptor.family = 'svg';
        preview.family_state = {
          family: 'svg',
          output: 'rasterized_png',
          external_resources: false,
          scripts: false,
          max_nodes: 50000,
          max_depth: 128,
        };
      } else {
        preview.preview!.descriptor.family = 'ico';
        preview.family_state = {
          family: 'ico',
          entries: [
            {
              index: 0,
              width: 16,
              height: 16,
              bits_per_pixel: 32,
              encoded_bytes: 8,
              preview: 'full',
              encoding: 'png',
              alpha: true,
              failure: null,
              duplicate_of: null,
            },
          ],
          selected_entry: 0,
          selected_entry_export: true,
        };
      }
      const { container } = render(
        <ImageSurface
          session={imageSession()}
          gateway={{
            render: () => Promise.resolve(preview),
            exportEntry: () =>
              Promise.resolve({ status: 'cancelled', durability: null }),
          }}
        />,
      );
      await screen.findByRole('img', { hidden: true });
      const results = await axe.run(container, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
        },
      });
      expect(
        results.violations.filter(
          (v) => v.impact === 'critical' || v.impact === 'serious',
        ),
      ).toEqual([]);
    },
  );
  it('has no serious or critical accessible-control findings', async () => {
    const { container } = render(
      <ImageSurface
        session={imageSession()}
        gateway={{ render: () => Promise.resolve(result()) }}
      />,
    );
    await screen.findByRole('img', { hidden: true });
    const results = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      },
    });
    expect(
      results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      ),
    ).toEqual([]);
  });
  it('does not offer identical retry for a deterministic SVG reference refusal and retains file details', async () => {
    const preview = result();
    preview.preview = null;
    preview.failure = 'svg_external_reference';
    const details = vi.fn();
    const ref = createRef<TextEditorHandle>();
    render(
      <ImageSurface
        ref={ref}
        session={{ ...imageSession(), lifecycle: 'active' }}
        gateway={{ render: () => Promise.resolve(preview) }}
        onOpenMetadata={details}
      />,
    );
    await waitFor(() =>
      expect(
        document.querySelector(
          '[data-preview-failure="svg_external_reference"]',
        ),
      ).not.toBeNull(),
    );
    expect(
      screen.queryByRole('button', { name: 'Retry preview' }),
    ).not.toBeInTheDocument();
    expect(imageControl('Fit')).toBeDisabled();
    expect(ref.current!.invoke('fit')).toBe(false);
    fireEvent.click(imageControl('File information'));
    expect(details).toHaveBeenCalledOnce();
  });

  it('retries a transient native failure once and preserves selected icon/background through Reset', async () => {
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = () => 'blob:reset';
        static revokeObjectURL = vi.fn();
      },
    );
    const entries = [0, 1].map((index) => ({
      index,
      width: 4,
      height: 3,
      bits_per_pixel: 32,
      encoded_bytes: 64,
      preview: 'full' as const,
      encoding: 'png' as const,
      alpha: true,
      failure: null,
      duplicate_of: null,
    }));
    const renderImage = vi.fn((session: ShellSession) => {
      const preview = result();
      Object.assign(preview.preview!.descriptor, {
        family: 'ico',
        codec: 'ico',
      });
      preview.family_state = {
        family: 'ico',
        entries,
        selected_entry: session.image_document?.selection ?? 1,
        selected_entry_export: true,
      };
      return renderImage.mock.calls.length === 1
        ? Promise.reject(new Error('transport'))
        : Promise.resolve(preview);
    });
    const original = imageSession();
    original.lifecycle = 'active';
    original.image_document!.selection = 1;
    original.image_document!.viewport.background = 'dark';
    render(
      <ImageSurface session={original} gateway={{ render: renderImage }} />,
    );
    await screen.findByRole('button', { name: 'Retry preview' });
    fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
    const image = await screen.findByRole('img');
    Object.defineProperty(image, 'naturalWidth', { value: 1200 });
    fireEvent.load(image);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'More image tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    const pane = document.querySelector('.image-pane');
    expect(pane).toHaveAttribute('data-viewport-mode', 'fit');
    expect(pane).toHaveAttribute('data-viewport-background', 'dark');
    expect(pane).toHaveAttribute('data-image-selection', '1');
    expect(renderImage).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
    document.getElementById('bb-overlay-root')?.remove();
  });
  it('keeps invalid animation frame drafts visible without changing selection or scheduling another decode', async () => {
    const renderFrame = vi.fn((session: ShellSession) => {
      const preview = result();
      Object.assign(preview.preview!.descriptor, {
        family: 'animation',
        codec: 'gif',
      });
      preview.family_state = {
        family: 'animation',
        paused: true,
        selected_frame: session.image_document?.selection ?? 0,
        frame_count: 3,
        loop_count: 0,
        frame_duration_ms: 200,
        max_composited_frames: 2,
      };
      return Promise.resolve(preview);
    });
    render(
      <ImageSurface
        session={imageSession()}
        gateway={{ render: renderFrame }}
      />,
    );
    await screen.findByRole('img');
    const field = imageField('Animation frame');
    for (const value of ['', '4', '1.5']) {
      fireEvent.change(field, { target: { value } });
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Enter a whole frame number from 1 to 3',
      );
      expect(document.querySelector('.image-pane')).toHaveAttribute(
        'data-image-selection',
        '0',
      );
      expect(renderFrame).toHaveBeenCalledTimes(1);
    }
    fireEvent.change(field, { target: { value: '2' } });
    await waitFor(() => expect(renderFrame).toHaveBeenCalledTimes(2));
    expect(field).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelector('.image-pane')).toHaveAttribute(
      'data-image-selection',
      '1',
    );
  });
  it('recomputes live Fit and preserves explicit actual-size zoom and pan across resize', async () => {
    let notifyResize: () => void = () => {
      throw new Error('Image pane was not observed');
    };
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(element: Element) {
          if (element.classList.contains('image-pane'))
            notifyResize = () => this.callback([], this);
        }
        disconnect() {}
        unobserve() {}
      },
    );
    const ref = createRef<TextEditorHandle>();
    render(
      <ImageSurface
        ref={ref}
        session={{ ...imageSession(), lifecycle: 'active' }}
        gateway={{ render: () => Promise.resolve(result()) }}
      />,
    );
    const pane = document.querySelector('.image-pane')!;
    let width = 600,
      height = 400;
    Object.defineProperty(pane, 'getBoundingClientRect', {
      value: () => new DOMRect(0, 0, width, height),
    });
    act(() => notifyResize());
    const image = await screen.findByRole('img');
    expect(image).toHaveStyle({ width: '600px' });
    width = 300;
    height = 200;
    act(() => notifyResize());
    expect(image).toHaveStyle({ width: '300px' });
    expect(pane).toHaveAttribute('data-viewport-mode', 'fit');
    fireEvent.click(imageControl('Actual size'));
    fireEvent.click(screen.getByRole('button', { name: 'Close Image tools' }));
    fireEvent.keyDown(pane, { key: 'ArrowRight' });
    const pan = pane.getAttribute('data-viewport-pan-x');
    expect(Math.abs(Number(pan))).toBeGreaterThan(0);
    fireEvent.keyDown(pane, { key: '+' });
    expect(image).toHaveStyle({ width: '1500px' });
    width = 800;
    height = 600;
    act(() => notifyResize());
    expect(image).toHaveStyle({ width: '1500px' });
    expect(pane).toHaveAttribute('data-viewport-mode', 'actual');
    expect(pane).toHaveAttribute('data-viewport-pan-x', pan);
    fireEvent.click(imageControl('Reset view'));
    expect(image).toHaveStyle({ width: '800px' });
    expect(pane).toHaveAttribute('data-viewport-pan-x', '0');
  });

  it('selects duplicate and corrupt ICO rows truthfully and retains selection after closing and reopening tools', async () => {
    const entries = [0, 1, 2, 3].map((index) => ({
      index,
      width: 4,
      height: 3,
      bits_per_pixel: 32,
      encoded_bytes: 64,
      preview: index === 3 ? ('unavailable' as const) : ('full' as const),
      encoding: index === 1 ? ('dib' as const) : ('png' as const),
      alpha: true,
      failure: index === 3 ? 'malformed' : null,
      duplicate_of: index === 2 ? 0 : null,
    }));
    const renderEntry = vi.fn((session: ShellSession) => {
      const selected = session.image_document?.selection ?? 0;
      const preview = result();
      Object.assign(preview.preview!.descriptor, {
        codec: 'ico',
        family: 'ico',
      });
      preview.family_state = {
        family: 'ico',
        entries,
        selected_entry: selected,
        selected_entry_export: selected !== 3,
      };
      if (selected === 3) {
        preview.preview = null;
        preview.failure = 'malformed';
      }
      return Promise.resolve(preview);
    });
    const exportEntry = vi.fn(() =>
      Promise.resolve({ status: 'cancelled' as const, durability: null }),
    );
    render(
      <ImageSurface
        session={imageSession()}
        gateway={{ render: renderEntry, exportEntry }}
      />,
    );
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: 'More image tools' }));
    const selector = screen.getByRole('combobox', { name: 'Icon entry' });
    expect(within(selector).getAllByRole('option')).toHaveLength(4);
    expect(selector).toHaveValue('0');
    fireEvent.change(selector, { target: { value: '2' } });
    await waitFor(() =>
      expect(document.querySelector('.image-pane')).toHaveAttribute(
        'data-image-selection',
        '2',
      ),
    );
    expect(screen.getByLabelText('Selected icon details')).toHaveTextContent(
      'duplicate of entry 1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close Image tools' }));
    fireEvent.click(screen.getByRole('button', { name: 'More image tools' }));
    expect(screen.getByRole('combobox', { name: 'Icon entry' })).toHaveValue(
      '2',
    );
    expect(renderEntry).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByRole('combobox', { name: 'Icon entry' }), {
      target: { value: '3' },
    });
    await waitFor(() =>
      expect(
        document.querySelector('[data-preview-failure="malformed"]'),
      ).not.toBeNull(),
    );
    expect(document.querySelector('.image-preview')).toBeNull();
    expect(screen.getByLabelText('Selected icon details')).toHaveTextContent(
      'preview unavailable: malformed',
    );
    expect(
      screen.getByRole('button', { name: 'Export selected entry as PNG' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Fit' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Retry preview' }),
    ).not.toBeInTheDocument();
    expect(exportEntry).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Icon entry' }), {
      target: { value: '1' },
    });
    await waitFor(() =>
      expect(document.querySelector('.image-pane')).toHaveAttribute(
        'data-preview-ready',
        'true',
      ),
    );
    expect(screen.getByRole('combobox', { name: 'Icon entry' })).toHaveValue(
      '1',
    );
    expect(
      screen.getByRole('button', { name: 'Export selected entry as PNG' }),
    ).toBeEnabled();
    expect(
      renderEntry.mock.calls.map(
        ([session]) => session.image_document!.selection ?? 0,
      ),
    ).toEqual([0, 2, 3, 1]);
  });

  it.each([
    {
      limit: 'maximum',
      zoom: 16,
      blocked: 'zoom_in' as const,
      blockedLabel: 'Zoom in',
      opposite: 'zoom_out' as const,
      oppositeLabel: 'Zoom out',
      recoveryFactor: 0.8,
      key: '+',
    },
    {
      limit: 'minimum',
      zoom: 0.1,
      blocked: 'zoom_out' as const,
      blockedLabel: 'Zoom out',
      opposite: 'zoom_in' as const,
      oppositeLabel: 'Zoom in',
      recoveryFactor: 1.25,
      key: '-',
    },
  ])(
    'refuses unchanged relative Zoom at the image $limit and disables only that direction',
    async ({
      zoom,
      blocked,
      blockedLabel,
      oppositeLabel,
      recoveryFactor,
      key,
    }) => {
      const ref = createRef<TextEditorHandle>();
      const changes = vi.fn();
      const session = imageSession();
      session.lifecycle = 'active';
      session.image_document!.selection = 1;
      session.image_document!.viewport = {
        mode: 'actual',
        zoom,
        pan_x: 0,
        pan_y: 0,
        background: 'dark',
      };
      render(
        <ImageSurface
          ref={ref}
          session={session}
          gateway={{ render: () => Promise.resolve(result()) }}
          onImageChange={changes}
        />,
      );
      await screen.findByRole('img');
      const pane = document.querySelector('.image-pane')!;
      await waitFor(() =>
        expect(pane).toHaveAttribute('data-preview-ready', 'true'),
      );
      changes.mockClear();
      act(() => {
        expect(ref.current!.invoke(blocked)).toBe(false);
      });
      fireEvent.keyDown(pane, { key });
      expect(changes).not.toHaveBeenCalled();
      expect(Number(pane.getAttribute('data-viewport-scale'))).toBe(zoom);
      const localBlocked = screen.getByRole('button', { name: blockedLabel });
      const localOpposite = screen.getByRole('button', { name: oppositeLabel });
      expect(localBlocked).toBeDisabled();
      expect(localOpposite).toBeEnabled();
      fireEvent.click(screen.getByRole('button', { name: 'More image tools' }));
      const tools = within(screen.getByRole('dialog', { name: 'Image tools' }));
      expect(tools.getByRole('button', { name: blockedLabel })).toBeDisabled();
      expect(tools.getByRole('button', { name: oppositeLabel })).toBeEnabled();
      fireEvent.click(tools.getByRole('button', { name: oppositeLabel }));
      expect(Number(pane.getAttribute('data-viewport-scale'))).toBeCloseTo(
        zoom * recoveryFactor,
      );
      expect(changes).toHaveBeenCalledOnce();
      expect(localBlocked).toBeEnabled();
      expect(tools.getByRole('button', { name: blockedLabel })).toBeEnabled();
      expect(pane).toHaveAttribute('data-viewport-background', 'dark');
      expect(pane).toHaveAttribute('data-image-selection', '1');
      act(() => {
        expect(ref.current!.invoke(blocked)).toBe(true);
      });
      act(() => {
        expect(ref.current!.invoke('fit')).toBe(true);
      });
      act(() => {
        expect(ref.current!.invoke('fit')).toBe(true);
      });
      expect(pane).toHaveAttribute('data-viewport-mode', 'fit');
    },
  );

  it('keeps More Fit and multiplicative Zoom on the same provider viewport and refuses after display failure', async () => {
    const ref = createRef<TextEditorHandle>();
    render(
      <ImageSurface
        ref={ref}
        session={{ ...imageSession(), lifecycle: 'active' }}
        gateway={{ render: () => Promise.resolve(result()) }}
      />,
    );
    const image = await screen.findByRole('img');
    const pane = document.querySelector('.image-pane')!;
    const fit = Number(pane.getAttribute('data-viewport-scale'));
    fireEvent.click(screen.getByRole('button', { name: 'More image tools' }));
    const tools = within(screen.getByRole('dialog', { name: 'Image tools' }));
    fireEvent.click(tools.getByRole('button', { name: 'Zoom in' }));
    expect(Number(pane.getAttribute('data-viewport-scale')) / fit).toBeCloseTo(
      1.25,
    );
    act(() => {
      expect(ref.current!.invoke('zoom_out')).toBe(true);
    });
    expect(Number(pane.getAttribute('data-viewport-scale'))).toBeCloseTo(fit);
    fireEvent.click(tools.getByRole('button', { name: 'Zoom out' }));
    expect(Number(pane.getAttribute('data-viewport-scale')) / fit).toBeCloseTo(
      0.8,
    );
    fireEvent.click(tools.getByRole('button', { name: 'Fit' }));
    expect(Number(pane.getAttribute('data-viewport-scale'))).toBeCloseTo(fit);
    fireEvent.error(image);
    for (const name of ['Fit', 'Zoom in', 'Zoom out'])
      expect(tools.getByRole('button', { name })).toBeDisabled();
    expect(ref.current!.invoke('zoom_in')).toBe(false);
  });
});
