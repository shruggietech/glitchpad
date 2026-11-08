import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  clampMermaidPan,
  clampMermaidZoom,
  mermaidEffectiveScale,
  mermaidFitScale,
  initialMermaidViewport,
  type MermaidViewportState,
} from '../domain/mermaid-contract';
import { TaskSurface } from './TaskSurface';
import './DiagramViewport.css';
import {
  rendererResourceLedger,
  type ResourceOwner,
} from '../domain/resource-ledger';

export interface DiagramViewportHandle {
  zoomIn(): boolean;
  zoomOut(): boolean;
  fit(): boolean;
  actual(): boolean;
  dismissModal(): boolean;
}

interface DiagramViewportProps {
  svg: string;
  label: string;
  description: string | null;
  initialState?: MermaidViewportState;
  onChange?: (state: MermaidViewportState) => void;
}

export const DiagramViewport = forwardRef<
  DiagramViewportHandle,
  DiagramViewportProps
>(function DiagramViewport(
  {
    svg,
    label,
    description,
    initialState = initialMermaidViewport(),
    onChange,
  },
  ref,
) {
  const [state, setState] = useState(initialState);
  const [objectUrl, setObjectUrl] = useState('');
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsOpener = useRef<HTMLElement | null>(null);
  const [extents, setExtents] = useState({
    content_width: 0,
    content_height: 0,
    viewport_width: 0,
    viewport_height: 0,
  });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const descriptionId = useId();
  const resourceOwner = useRef<ResourceOwner | null>(null);
  const lifecycleGeneration = useRef(0);
  if (!resourceOwner.current)
    resourceOwner.current = rendererResourceLedger.register(
      `viewport:${descriptionId}`,
    );
  const source = useMemo(() => svg, [svg]);

  useEffect(() => {
    setReady(false);
    setFailed(false);
    drag.current = null;
    if (typeof URL.createObjectURL !== 'function') {
      setObjectUrl(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`,
      );
      return;
    }
    const url = URL.createObjectURL(
      new Blob([source], { type: 'image/svg+xml' }),
    );
    const releaseUrl =
      resourceOwner.current?.acquire(
        'object_url',
        new TextEncoder().encode(source).byteLength,
      ) ?? (() => undefined);
    const releaseSurface =
      resourceOwner.current?.acquire(
        'surface',
        new TextEncoder().encode(source).byteLength,
      ) ?? (() => undefined);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      releaseUrl();
      releaseSurface();
    };
  }, [source]);

  const measureExtents = useCallback(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    setReady(image.naturalWidth > 0 && image.naturalHeight > 0);
    setExtents({
      content_width: image.naturalWidth || image.clientWidth,
      content_height: image.naturalHeight || image.clientHeight,
      viewport_width: canvas.clientWidth,
      viewport_height: canvas.clientHeight,
    });
  }, []);

  useEffect(() => {
    measureExtents();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureExtents);
    const releaseObserver =
      resourceOwner.current?.acquire('observer') ?? (() => undefined);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      releaseObserver();
    };
  }, [measureExtents, objectUrl]);

  useEffect(() => {
    const generation = ++lifecycleGeneration.current;
    return () =>
      queueMicrotask(() => {
        if (lifecycleGeneration.current === generation) {
          resourceOwner.current?.dispose();
          resourceOwner.current = null;
        }
      });
  }, []);

  const publish = (next: MermaidViewportState) => {
    setState(next);
    onChange?.(next);
  };
  const scale = mermaidEffectiveScale(state, extents);
  const usable =
    ready &&
    !failed &&
    extents.viewport_width > 0 &&
    extents.viewport_height > 0;
  const bounded = (next: MermaidViewportState) => {
    const rendered = mermaidEffectiveScale(next, extents);
    return {
      ...next,
      pan_x: clampMermaidPan(
        next.pan_x,
        extents.content_width * rendered,
        extents.viewport_width,
      ),
      pan_y: clampMermaidPan(
        next.pan_y,
        extents.content_height * rendered,
        extents.viewport_height,
      ),
    };
  };
  const minimumZoom = Math.min(0.1, mermaidFitScale(extents) / 10);
  const zoomInValue = clampMermaidZoom(scale * 1.25, minimumZoom);
  const zoomOutValue = clampMermaidZoom(scale * 0.8, minimumZoom);
  const canZoomIn = usable && zoomInValue !== scale;
  const canZoomOut = usable && zoomOutValue !== scale;
  const zoom = (nextZoom: number) => {
    if (!usable || nextZoom === scale) return false;
    publish(bounded({ ...state, mode: 'custom', zoom: nextZoom }));
    return true;
  };
  const fit = () => {
    if (!usable) return false;
    publish(initialMermaidViewport());
    return true;
  };
  const actual = () => {
    if (!usable) return false;
    publish({ mode: 'actual', zoom: 1, pan_x: 0, pan_y: 0 });
    return true;
  };
  const pan = (x: number, y: number) => {
    if (!usable) return false;
    publish(
      bounded({
        ...state,
        mode: 'custom',
        zoom: scale,
        pan_x: state.pan_x + x,
        pan_y: state.pan_y + y,
      }),
    );
    return true;
  };
  const dismissModal = () => {
    if (!toolsOpen) return false;
    setToolsOpen(false);
    return true;
  };
  useImperativeHandle(ref, () => ({
    zoomIn: () => zoom(zoomInValue),
    zoomOut: () => zoom(zoomOutValue),
    fit,
    actual,
    dismissModal,
  }));

  return (
    <div className="diagram-viewer">
      <div className="diagram-controls" aria-label="Diagram navigation">
        <button type="button" disabled={!usable} onClick={fit}>
          Fit
        </button>
        <button
          type="button"
          disabled={!canZoomOut}
          title={usable && !canZoomOut ? 'Minimum zoom reached.' : undefined}
          onClick={() => zoom(zoomOutValue)}
          aria-label="Zoom out"
        >
          −
        </button>
        <output aria-label="Diagram zoom">
          {Number((scale * 100).toFixed(1))}%
        </output>
        <button
          type="button"
          disabled={!canZoomIn}
          title={usable && !canZoomIn ? 'Maximum zoom reached.' : undefined}
          onClick={() => zoom(zoomInValue)}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          aria-label="More diagram tools"
          title="More diagram tools"
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
        title="Diagram tools"
        opener={toolsOpener.current}
        className="diagram-tools"
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
        <button type="button" disabled={!usable} onClick={actual}>
          Actual size
        </button>
        <button type="button" disabled={!usable} onClick={fit}>
          Reset view
        </button>
        <div role="group" aria-label="Pan diagram">
          <button
            type="button"
            disabled={!usable}
            onClick={() => pan(-80, 0)}
            aria-label="Pan left"
          >
            ←
          </button>
          <button
            type="button"
            disabled={!usable}
            onClick={() => pan(80, 0)}
            aria-label="Pan right"
          >
            →
          </button>
          <button
            type="button"
            disabled={!usable}
            onClick={() => pan(0, -80)}
            aria-label="Pan up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={!usable}
            onClick={() => pan(0, 80)}
            aria-label="Pan down"
          >
            ↓
          </button>
        </div>
        <p>
          Arrow keys or drag pan this diagram. Plus and minus zoom. Zero fits.
          Tab leaves the diagram.
        </p>
      </TaskSurface>
      <div
        ref={canvasRef}
        className="diagram-canvas"
        data-viewport-mode={state.mode}
        data-viewport-scale={scale}
        data-viewport-pan-x={bounded(state).pan_x}
        data-viewport-pan-y={bounded(state).pan_y}
        data-preview-ready={usable}
        tabIndex={0}
        role="group"
        aria-label={`${label} navigation area`}
        onKeyDown={(event) => {
          if (!usable) return;
          const movement = event.shiftKey ? 160 : 48;
          if (event.key === 'ArrowLeft') pan(-movement, 0);
          else if (event.key === 'ArrowRight') pan(movement, 0);
          else if (event.key === 'ArrowUp') pan(0, -movement);
          else if (event.key === 'ArrowDown') pan(0, movement);
          else if (event.key === '+' || event.key === '=') zoom(zoomInValue);
          else if (event.key === '-') zoom(zoomOutValue);
          else if (event.key === '0') fit();
          else return;
          event.preventDefault();
        }}
        onPointerDown={(event) => {
          if (!usable || drag.current) return;
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const previous = drag.current;
          if (!previous || previous.id !== event.pointerId) return;
          pan(event.clientX - previous.x, event.clientY - previous.y);
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };
        }}
        onPointerUp={(event) => {
          if (drag.current?.id !== event.pointerId) return;
          drag.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        onPointerCancel={(event) => {
          if (drag.current?.id === event.pointerId) drag.current = null;
        }}
      >
        {objectUrl && (
          <img
            ref={imageRef}
            className={`diagram-image diagram-image-${state.mode}`}
            src={objectUrl}
            alt={label}
            aria-describedby={description ? descriptionId : undefined}
            draggable={false}
            onLoad={measureExtents}
            onError={() => {
              setFailed(true);
              setReady(false);
              drag.current = null;
            }}
            style={{
              width: extents.content_width * scale || undefined,
              height: extents.content_height * scale || undefined,
              transform: `translate(calc(-50% + ${bounded(state).pan_x}px), calc(-50% + ${bounded(state).pan_y}px))`,
            }}
          />
        )}
        {failed && (
          <p role="status">
            The diagram preview could not be displayed. View the source or retry
            the diagram preview.
          </p>
        )}
        {description && (
          <span className="visually-hidden" id={descriptionId}>
            {description}
          </span>
        )}
      </div>
    </div>
  );
});
