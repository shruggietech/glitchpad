import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { TextEditorHandle } from './TextEditorSurface';
import type { ShellSession } from '../domain/contracts';
import {
  imageDecodeFailure,
  imageFailureMessage,
  type ImagePreviewFailure,
  initialImageViewport,
  type ImageDocumentState,
  type ImageViewport,
  type ImageFamilyState,
} from '../domain/image-contract';
import {
  classifyImageFailure,
  nativeImageGateway,
  type ImageGateway,
} from '../domain/image-gateway';
import { TaskSurface } from './TaskSurface';
import './ImageSurface.css';

interface Props {
  session: ShellSession;
  gateway?: ImageGateway;
  recoveryProbeGeneration?: number;
  onImageChange?: (
    id: string,
    expectedRevision: number,
    image: ImageDocumentState,
  ) => void;
  onOpenMetadata?: (opener: HTMLElement) => void;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export const ImageSurface = forwardRef<TextEditorHandle, Props>(
  function ImageSurface(
    {
      session,
      gateway = nativeImageGateway,
      recoveryProbeGeneration = 0,
      onImageChange,
      onOpenMetadata,
    },
    handleRef,
  ) {
    const pane = useRef<HTMLDivElement>(null);
    const callbacks = useRef({ onImageChange, onOpenMetadata });
    callbacks.current = { onImageChange, onOpenMetadata };
    const [url, setUrl] = useState<string | null>(null);
    const ownedPreview = useRef<string | null>(null);
    const [ready, setReady] = useState(false);
    const [failure, setFailure] = useState<ImagePreviewFailure | null>(null);
    const [toolsOpen, setToolsOpen] = useState(false);
    const toolsOpener = useRef<HTMLElement | null>(null);
    const preparedState = useRef<ImageDocumentState | null>(null);
    const [frameDraft, setFrameDraft] = useState('1');
    const [frameError, setFrameError] = useState<string | null>(null);
    const [status, setStatus] = useState('Loading image…');
    const [exportStatus, setExportStatus] = useState<string | null>(null);
    const [descriptor, setDescriptor] = useState(
      session.image_document?.descriptor ?? null,
    );
    const [viewport, setViewport] = useState(
      session.image_document?.viewport ?? initialImageViewport(),
    );
    const [size, setSize] = useState({ width: 640, height: 480 });
    const [retry, setRetry] = useState(0);
    const [visible, setVisible] = useState(
      document.visibilityState !== 'hidden',
    );
    const [family, setFamily] = useState<ImageFamilyState | null>(
      session.image_document?.family_state ?? null,
    );
    const [selection, setSelection] = useState<number | null>(
      session.image_document?.selection ?? null,
    );
    const [playing, setPlaying] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(
      () =>
        typeof matchMedia === 'function' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    const completedLoops = useRef(0);
    const playbackCompleted = useRef(false);
    const exportAbort = useRef<AbortController | null>(null);
    const lastRequest = useRef<string | null>(null);
    const points = useRef(new Map<number, { x: number; y: number }>());
    const gesture = useRef<{ x: number; y: number; distance: number } | null>(
      null,
    );
    const imageState = useRef(session.image_document!);
    imageState.current = session.image_document!;

    useEffect(() => {
      setViewport(session.image_document!.viewport);
      setSelection(session.image_document!.selection ?? null);
    }, [session.image_document?.viewport, session.image_document?.selection]);

    useEffect(() => {
      if (family?.family === 'animation') {
        setFrameDraft(String(family.selected_frame + 1));
        setFrameError(null);
      }
    }, [family]);
    useEffect(() => {
      setFamily(session.image_document?.family_state ?? null);
    }, [session.image_document?.family_state]);

    useEffect(() => {
      if (typeof matchMedia !== 'function') return;
      const motion = matchMedia('(prefers-reduced-motion: reduce)');
      const change = () => {
        setReducedMotion(motion.matches);
        if (motion.matches) setPlaying(false);
      };
      change();
      if (motion.addEventListener) {
        motion.addEventListener('change', change);
        return () => motion.removeEventListener('change', change);
      }
      motion.addListener(change);
      return () => motion.removeListener(change);
    }, []);

    useEffect(() => {
      completedLoops.current = 0;
      playbackCompleted.current = false;
    }, [session.id, session.revision]);

    useEffect(() => {
      const update = () => setVisible(document.visibilityState !== 'hidden');
      document.addEventListener('visibilitychange', update);
      return () => document.removeEventListener('visibilitychange', update);
    }, []);

    useEffect(() => {
      setExportStatus(null);
      return () => {
        exportAbort.current?.abort();
      };
    }, [
      session.id,
      session.revision,
      session.source_id,
      gateway,
      selection,
      session.source_state,
    ]);

    useEffect(() => {
      const abort = new AbortController();
      let ownedUrl: string | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      setUrl(null);
      setReady(false);
      setFailure(null);
      preparedState.current = null;
      setDescriptor(null);
      if (!visible) {
        setPlaying(false);
        setStatus('Image preview suspended.');
        return;
      }
      if (
        session.source_state === 'unavailable' ||
        session.source_state === 'permission_revoked'
      ) {
        const outcome: ImagePreviewFailure = {
          kind:
            session.source_state === 'permission_revoked'
              ? 'source_revoked'
              : 'source_unavailable',
          retryable: false,
        };
        setFailure(outcome);
        setStatus(imageFailureMessage(outcome));
        return;
      }
      setStatus('Loading image…');
      const run = async () => {
        try {
          const result = await gateway.render(
            {
              ...session,
              image_document: { ...imageState.current, selection },
            },
            abort.signal,
          );
          if (abort.signal.aborted) return;
          lastRequest.current = result.request_id;
          setFamily(result.family_state ?? null);
          const selected =
            result.family_state?.family === 'animation'
              ? result.family_state.selected_frame
              : result.family_state?.family === 'ico'
                ? result.family_state.selected_entry
                : selection;
          if (selection !== null && selected !== selection)
            setSelection(selected ?? null);
          const next: ImageDocumentState = {
            ...imageState.current,
            selection: selected,
            family_state: result.family_state ?? null,
            descriptor: result.preview?.descriptor ?? null,
            metadata: result.metadata,
            status: result.preview ? 'loading' : 'failed',
            failure: result.failure ? imageDecodeFailure(result.failure) : null,
          };
          preparedState.current = next;
          callbacks.current.onImageChange?.(session.id, session.revision, next);
          if (!result.preview) {
            const outcome = imageDecodeFailure(
              result.failure ?? 'unsupported_codec',
            );
            setFailure(outcome);
            setStatus(imageFailureMessage(outcome));
            return;
          }
          ownedUrl = URL.createObjectURL(
            new Blob([Uint8Array.from(result.preview.png_bytes)], {
              type: 'image/png',
            }),
          );
          ownedPreview.current = ownedUrl;
          setUrl(ownedUrl);
          setDescriptor(result.preview.descriptor);
          setStatus(
            result.preview.kind === 'thumbnail'
              ? 'Showing a bounded thumbnail.'
              : 'Loading generated preview…',
          );
        } catch (error) {
          if (abort.signal.aborted) return;
          const outcome = classifyImageFailure(error);
          const busy = outcome.kind === 'busy';
          if (busy) {
            setStatus('Waiting for another image decode to finish…');
            retryTimer = setTimeout(() => {
              if (!abort.signal.aborted) void run();
            }, 250);
          } else {
            setFailure(outcome);
            setStatus(imageFailureMessage(outcome));
            callbacks.current.onImageChange?.(session.id, session.revision, {
              ...imageState.current,
              descriptor: null,
              status: 'failed',
              failure: outcome,
            });
          }
        }
      };
      void run();
      return () => {
        abort.abort();
        if (retryTimer !== null) clearTimeout(retryTimer);
        if (ownedUrl && ownedPreview.current === ownedUrl) {
          URL.revokeObjectURL(ownedUrl);
          ownedPreview.current = null;
        }
        points.current.clear();
        gesture.current = null;
      };
    }, [
      session.id,
      session.revision,
      gateway,
      retry,
      visible,
      selection,
      session.source_state,
      recoveryProbeGeneration,
    ]);

    useEffect(
      () => () => {
        setPlaying(false);
        if (lastRequest.current && session.source_id)
          void gateway
            .suspend?.(session.source_id, lastRequest.current)
            .catch(() => undefined);
        lastRequest.current = null;
      },
      [session.id, session.revision, session.source_state, visible, gateway],
    );

    useEffect(() => {
      if (
        !playing ||
        reducedMotion ||
        !visible ||
        !url ||
        family?.family !== 'animation' ||
        family.frame_count === null
      )
        return;
      const timer = setTimeout(
        () => {
          const next = family.selected_frame + 1;
          if (next >= family.frame_count!) {
            completedLoops.current += 1;
            const loops =
              family.loop_count === null
                ? 1
                : descriptor?.codec === 'gif' && family.loop_count > 0
                  ? family.loop_count + 1
                  : family.loop_count;
            if (loops !== 0 && completedLoops.current >= loops) {
              playbackCompleted.current = true;
              setPlaying(false);
              return;
            }
          }
          setSelection(next % family.frame_count!);
        },
        family.frame_duration_ms === 0
          ? 100
          : Math.max(20, family.frame_duration_ms ?? 100),
      );
      return () => clearTimeout(timer);
    }, [playing, reducedMotion, visible, url, family, descriptor]);

    useEffect(() => {
      const element = pane.current;
      if (!element) return;
      const measure = () => {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0)
          setSize({ width: rect.width, height: rect.height });
      };
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }, []);

    useLayoutEffect(() => {
      const element = pane.current;
      if (!url || !element) return;
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0)
        setSize((previous) =>
          previous.width === rect.width && previous.height === rect.height
            ? previous
            : { width: rect.width, height: rect.height },
        );
    }, [url, status]);

    const selectedIcon =
      family?.family === 'ico'
        ? family.entries[family.selected_entry ?? 0]
        : null;
    const baseScale =
      descriptor && viewport.mode === 'fit'
        ? Math.min(
            1,
            size.width / descriptor.display_width,
            size.height / descriptor.display_height,
          )
        : 1;
    const renderedWidth =
      (descriptor?.display_width ?? 1) * baseScale * viewport.zoom;
    const renderedHeight =
      (descriptor?.display_height ?? 1) * baseScale * viewport.zoom;
    const apply = (next: ImageViewport) => {
      const scale =
        descriptor && next.mode === 'fit'
          ? Math.min(
              1,
              size.width / descriptor.display_width,
              size.height / descriptor.display_height,
            )
          : 1;
      const x = Math.max(
        0,
        ((descriptor?.display_width ?? 1) * scale * next.zoom - size.width) / 2,
      );
      const y = Math.max(
        0,
        ((descriptor?.display_height ?? 1) * scale * next.zoom - size.height) /
          2,
      );
      const bounded = {
        ...next,
        zoom: clamp(next.zoom, 0.1, 16),
        pan_x: clamp(next.pan_x, -x, x),
        pan_y: clamp(next.pan_y, -y, y),
      };
      setViewport(bounded);
      callbacks.current.onImageChange?.(session.id, session.revision, {
        ...imageState.current,
        viewport: bounded,
      });
    };
    const usable = ready && Boolean(url && descriptor);
    const zoomInValue = clamp(viewport.zoom * 1.25, 0.1, 16);
    const zoomOutValue = clamp(viewport.zoom * 0.8, 0.1, 16);
    const canZoomIn = usable && zoomInValue !== viewport.zoom;
    const canZoomOut = usable && zoomOutValue !== viewport.zoom;
    const zoom = (nextZoom: number) => {
      if (!usable || nextZoom === viewport.zoom) return false;
      apply({ ...viewport, zoom: nextZoom });
      return true;
    };
    const fit = () =>
      apply({ ...viewport, mode: 'fit', zoom: 1, pan_x: 0, pan_y: 0 });
    useImperativeHandle(handleRef, () => ({
      invoke(command) {
        if (!ready || !url || !descriptor || session.lifecycle !== 'active')
          return false;
        if (command === 'zoom_in') return zoom(zoomInValue);
        if (command === 'zoom_out') return zoom(zoomOutValue);
        if (command === 'fit') {
          fit();
          return true;
        }
        return false;
      },
      dismissModal() {
        if (!toolsOpen) return false;
        setToolsOpen(false);
        return true;
      },
      selectRange() {
        return false;
      },
    }));
    const pointerGesture = () => {
      const values = [...points.current.values()];
      if (values.length === 0) return null;
      if (values.length === 1) return { ...values[0], distance: 0 };
      return {
        x: (values[0].x + values[1].x) / 2,
        y: (values[0].y + values[1].y) / 2,
        distance: Math.hypot(
          values[0].x - values[1].x,
          values[0].y - values[1].y,
        ),
      };
    };

    return (
      <div className="image-layout">
        <div
          className="image-actions"
          role="toolbar"
          aria-label="Image controls"
        >
          <button type="button" disabled={!usable} onClick={fit}>
            Fit
          </button>
          <button
            type="button"
            disabled={!canZoomOut}
            title={usable && !canZoomOut ? 'Minimum zoom reached.' : undefined}
            aria-label="Zoom out"
            onClick={() => zoom(zoomOutValue)}
          >
            −
          </button>
          <output aria-label="Image zoom">
            {Number((baseScale * viewport.zoom * 100).toFixed(1))}%
          </output>
          <button
            type="button"
            disabled={!canZoomIn}
            title={usable && !canZoomIn ? 'Maximum zoom reached.' : undefined}
            aria-label="Zoom in"
            onClick={() => zoom(zoomInValue)}
          >
            +
          </button>
          <button
            type="button"
            aria-label="More image tools"
            title="More image tools"
            onClick={(e) => {
              toolsOpener.current = e.currentTarget;
              setToolsOpen(true);
            }}
          >
            ⋯
          </button>
        </div>
        <TaskSurface
          open={toolsOpen}
          onOpenChange={setToolsOpen}
          title="Image tools"
          opener={toolsOpener.current}
          className="image-tools"
        >
          <button type="button" disabled={!usable} onClick={fit}>
            Fit
          </button>
          <button
            type="button"
            disabled={!canZoomOut}
            title={usable && !canZoomOut ? 'Minimum zoom reached.' : undefined}
            onClick={() => zoom(zoomOutValue)}
          >
            Zoom out
          </button>
          <button
            type="button"
            disabled={!canZoomIn}
            title={usable && !canZoomIn ? 'Maximum zoom reached.' : undefined}
            onClick={() => zoom(zoomInValue)}
          >
            Zoom in
          </button>
          <button
            type="button"
            disabled={!usable}
            onClick={() =>
              apply({
                ...viewport,
                mode: 'actual',
                zoom: 1,
                pan_x: 0,
                pan_y: 0,
              })
            }
          >
            Actual size
          </button>
          <button type="button" disabled={!usable} onClick={fit}>
            Reset view
          </button>
          <label>
            Background{' '}
            <select
              aria-label="Image background"
              value={viewport.background}
              onChange={(e) =>
                apply({
                  ...viewport,
                  background: e.target.value as ImageViewport['background'],
                })
              }
            >
              <option value="checker">Checkerboard</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          {onOpenMetadata && (
            <button
              type="button"
              onClick={(e) => {
                setToolsOpen(false);
                onOpenMetadata(toolsOpener.current ?? e.currentTarget);
              }}
            >
              File information
            </button>
          )}
          <p>
            Drag or use arrow keys to pan. Pinch or use plus and minus to zoom.
            Zero fits. Reset view retains the background and selected frame or
            icon.
          </p>
          {family?.family === 'animation' && (
            <span
              className="image-family-actions"
              role="group"
              aria-label="Animation controls"
            >
              <button
                type="button"
                disabled={!usable || reducedMotion}
                title={
                  reducedMotion
                    ? 'Playback disabled by reduced-motion preference.'
                    : undefined
                }
                aria-pressed={playing}
                onClick={() => {
                  if (reducedMotion) return;
                  if (!playing && playbackCompleted.current) {
                    completedLoops.current = 0;
                    playbackCompleted.current = false;
                    setSelection(0);
                  }
                  setPlaying((p) => !p);
                }}
              >
                {playing ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                disabled={!url || family.selected_frame === 0}
                onClick={() => {
                  setPlaying(false);
                  setSelection(family.selected_frame - 1);
                }}
              >
                Previous frame
              </button>
              <button
                type="button"
                disabled={
                  !url || family.selected_frame + 1 >= (family.frame_count ?? 1)
                }
                onClick={() => {
                  setPlaying(false);
                  setSelection(family.selected_frame + 1);
                }}
              >
                Next frame
              </button>
              <label>
                Frame{' '}
                <input
                  aria-label="Animation frame"
                  type="number"
                  min={1}
                  max={family.frame_count ?? 1}
                  value={frameDraft}
                  aria-invalid={Boolean(frameError)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setFrameDraft(raw);
                    const frame = Number(raw);
                    if (
                      raw.trim() &&
                      Number.isInteger(frame) &&
                      frame >= 1 &&
                      frame <= (family.frame_count ?? 1)
                    ) {
                      setFrameError(null);
                      setPlaying(false);
                      setSelection(frame - 1);
                    } else
                      setFrameError(
                        'Enter a whole frame number from 1 to ' +
                          (family.frame_count ?? 1) +
                          '.',
                      );
                  }}
                />
              </label>
              {frameError && <span role="alert">{frameError}</span>}
              {reducedMotion && (
                <p>
                  Playback is paused by your reduced-motion preference. Frame
                  controls remain available.
                </p>
              )}
              <output>
                of {family.frame_count}; {family.frame_duration_ms} ms;{' '}
                {family.loop_count === null
                  ? 'one play'
                  : family.loop_count === 0
                    ? 'unlimited loops'
                    : `${family.loop_count} ${descriptor?.codec === 'gif' ? 'repeat(s)' : 'loop(s)'}`}
              </output>
            </span>
          )}
          {family?.family === 'ico' && (
            <span
              className="image-family-actions"
              role="group"
              aria-label="Icon controls"
            >
              <label>
                Entry{' '}
                <select
                  aria-label="Icon entry"
                  value={family.selected_entry ?? 0}
                  onChange={(e) => setSelection(Number(e.target.value))}
                >
                  {family.entries.map((entry) => (
                    <option key={entry.index} value={entry.index}>
                      {entry.index + 1}: {entry.width} × {entry.height},{' '}
                      {entry.encoding}
                      {entry.failure ? ` (${entry.failure})` : ''}
                      {entry.duplicate_of !== null
                        ? ` (duplicate of ${entry.duplicate_of + 1})`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={
                  !url || !family.selected_entry_export || !gateway.exportEntry
                }
                onClick={() => {
                  void (async () => {
                    exportAbort.current?.abort();
                    const controller = new AbortController();
                    exportAbort.current = controller;
                    setExportStatus(
                      'Choose a destination for the selected PNG entry.',
                    );
                    try {
                      const receipt = await gateway.exportEntry!(
                        {
                          ...session,
                          image_document: {
                            ...imageState.current,
                            family_state: family,
                          },
                        },
                        controller.signal,
                      );
                      if (!controller.signal.aborted)
                        setExportStatus(
                          receipt.status === 'exported'
                            ? 'Selected entry exported as PNG.'
                            : 'Export cancelled.',
                        );
                    } catch {
                      if (!controller.signal.aborted)
                        setExportStatus(
                          'Export could not complete safely. The original icon remains unchanged.',
                        );
                    }
                  })();
                }}
              >
                Export selected entry as PNG
              </button>
              {selectedIcon && (
                <output aria-label="Selected icon details">
                  {selectedIcon.bits_per_pixel} bit;{' '}
                  {selectedIcon.encoded_bytes} bytes; alpha{' '}
                  {selectedIcon.alpha === null
                    ? 'unknown'
                    : selectedIcon.alpha
                      ? 'yes'
                      : 'no'}
                  {selectedIcon.failure
                    ? '; preview unavailable: ' +
                      selectedIcon.failure.replaceAll('_', ' ')
                    : ''}
                  {selectedIcon.duplicate_of !== null
                    ? '; duplicate of entry ' + (selectedIcon.duplicate_of + 1)
                    : ''}
                  .
                </output>
              )}
            </span>
          )}
          {descriptor?.limitations.some(
            (l) => l !== 'unreleased_image_capability',
          ) && (
            <p
              className="image-limitation"
              title={descriptor.limitations
                .filter((l) => l !== 'unreleased_image_capability')
                .join('; ')
                .replaceAll('_', ' ')}
            >
              {descriptor.limitations
                .filter((l) => l !== 'unreleased_image_capability')
                .join('; ')
                .replaceAll('_', ' ')}
              .
            </p>
          )}
        </TaskSurface>
        {(status || exportStatus) && (
          <div
            className="image-status"
            role="status"
            data-preview-failure={failure?.kind}
          >
            {exportStatus}
            {exportStatus && status ? ' ' : ''}
            {status}
            {failure?.retryable && (
              <button type="button" onClick={() => setRetry((n) => n + 1)}>
                Retry preview
              </button>
            )}
            {failure && onOpenMetadata && (
              <button
                type="button"
                onClick={(e) => onOpenMetadata(e.currentTarget)}
              >
                File information
              </button>
            )}
          </div>
        )}
        <div
          ref={pane}
          className={`image-pane image-background-${viewport.background}`}
          role="group"
          aria-label="Image viewport. Arrow keys pan; plus and minus zoom; zero fits."
          tabIndex={0}
          data-preview-ready={usable}
          data-viewport-mode={viewport.mode}
          data-viewport-scale={baseScale * viewport.zoom}
          data-viewport-pan-x={viewport.pan_x}
          data-viewport-pan-y={viewport.pan_y}
          data-viewport-background={viewport.background}
          data-image-selection={selection ?? 0}
          onKeyDown={(e) => {
            if (!usable) return;
            if (e.key === '+' || e.key === '=') zoom(zoomInValue);
            else if (e.key === '-') zoom(zoomOutValue);
            else if (e.key === '0') fit();
            else if (e.key.startsWith('Arrow'))
              apply({
                ...viewport,
                pan_x:
                  viewport.pan_x +
                  (e.key === 'ArrowLeft'
                    ? 40
                    : e.key === 'ArrowRight'
                      ? -40
                      : 0),
                pan_y:
                  viewport.pan_y +
                  (e.key === 'ArrowUp' ? 40 : e.key === 'ArrowDown' ? -40 : 0),
              });
            else return;
            e.preventDefault();
          }}
          onPointerDown={(e) => {
            if (!usable || points.current.size >= 2) return;
            points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            gesture.current = pointerGesture();
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!points.current.has(e.pointerId)) return;
            points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const next = pointerGesture();
            const previous = gesture.current;
            if (next && previous)
              apply({
                ...viewport,
                zoom:
                  previous.distance > 0 && next.distance > 0
                    ? clamp(
                        (viewport.zoom * next.distance) / previous.distance,
                        0.1,
                        16,
                      )
                    : viewport.zoom,
                pan_x: viewport.pan_x + next.x - previous.x,
                pan_y: viewport.pan_y + next.y - previous.y,
              });
            gesture.current = next;
          }}
          onPointerUp={(e) => {
            points.current.delete(e.pointerId);
            gesture.current = pointerGesture();
          }}
          onPointerCancel={(e) => {
            points.current.delete(e.pointerId);
            gesture.current = pointerGesture();
          }}
        >
          {url && descriptor && (
            <img
              src={url}
              alt={session.source.display_name}
              draggable={false}
              className="image-preview"
              onLoad={(e) => {
                if (
                  ownedPreview.current !== url ||
                  e.currentTarget.naturalWidth === 0
                )
                  return;
                setReady(true);
                setStatus('');
                if (preparedState.current)
                  callbacks.current.onImageChange?.(
                    session.id,
                    session.revision,
                    { ...preparedState.current, viewport, status: 'ready' },
                  );
              }}
              onError={() => {
                if (ownedPreview.current !== url) return;
                URL.revokeObjectURL(url);
                ownedPreview.current = null;
                setUrl(null);
                const outcome: ImagePreviewFailure = {
                  kind: 'display_failed',
                  retryable: true,
                };
                setReady(false);
                setFailure(outcome);
                setStatus(imageFailureMessage(outcome));
                callbacks.current.onImageChange?.(
                  session.id,
                  session.revision,
                  { ...imageState.current, status: 'failed', failure: outcome },
                );
              }}
              style={{
                width: renderedWidth,
                height: renderedHeight,
                transform: `translate(calc(-50% + ${clamp(viewport.pan_x, -Math.max(0, (renderedWidth - size.width) / 2), Math.max(0, (renderedWidth - size.width) / 2))}px), calc(-50% + ${clamp(viewport.pan_y, -Math.max(0, (renderedHeight - size.height) / 2), Math.max(0, (renderedHeight - size.height) / 2))}px))`,
              }}
            />
          )}
        </div>
      </div>
    );
  },
);
