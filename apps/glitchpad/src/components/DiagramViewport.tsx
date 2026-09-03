import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { clampMermaidPan, clampMermaidZoom, initialMermaidViewport, type MermaidViewportState } from '../domain/mermaid-contract';

export interface DiagramViewportHandle {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  actual(): void;
}

interface DiagramViewportProps {
  svg: string;
  label: string;
  description: string | null;
  initialState?: MermaidViewportState;
  onChange?: (state: MermaidViewportState) => void;
}

export const DiagramViewport = forwardRef<DiagramViewportHandle, DiagramViewportProps>(function DiagramViewport(
  { svg, label, description, initialState = initialMermaidViewport(), onChange },
  ref,
) {
  const [state, setState] = useState(initialState);
  const [objectUrl, setObjectUrl] = useState('');
  const [extents, setExtents] = useState({ content_width: 0, content_height: 0, viewport_width: 0, viewport_height: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const descriptionId = useId();
  const source = useMemo(() => svg, [svg]);

  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') {
      setObjectUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`);
      return;
    }
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  const measureExtents = useCallback(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
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
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [measureExtents, objectUrl]);

  const publish = (next: MermaidViewportState) => {
    setState(next);
    onChange?.(next);
  };
  const zoom = (factor: number) => {
    const nextZoom = clampMermaidZoom(state.zoom * factor);
    publish({
      ...state,
      mode: 'custom',
      zoom: nextZoom,
      pan_x: clampMermaidPan(state.pan_x, extents.content_width * nextZoom, extents.viewport_width),
      pan_y: clampMermaidPan(state.pan_y, extents.content_height * nextZoom, extents.viewport_height),
    });
  };
  const fit = () => publish(initialMermaidViewport());
  const actual = () => publish({ mode: 'actual', zoom: 1, pan_x: 0, pan_y: 0 });
  const pan = (x: number, y: number) => publish({
    ...state,
    mode: 'custom',
    pan_x: clampMermaidPan(state.pan_x + x, extents.content_width * state.zoom, extents.viewport_width),
    pan_y: clampMermaidPan(state.pan_y + y, extents.content_height * state.zoom, extents.viewport_height),
  });

  useImperativeHandle(ref, () => ({ zoomIn: () => zoom(1.25), zoomOut: () => zoom(0.8), fit, actual }));

  return (
    <div className="diagram-viewer">
      <div className="diagram-controls" aria-label="Diagram navigation">
        <button type="button" onClick={fit}>Fit</button>
        <button type="button" onClick={actual}>Actual size</button>
        <button type="button" onClick={() => zoom(0.8)} aria-label="Zoom out">−</button>
        <output aria-live="polite">{Math.round(state.zoom * 100)}%</output>
        <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => pan(-80, 0)} aria-label="Pan left">←</button>
        <button type="button" onClick={() => pan(80, 0)} aria-label="Pan right">→</button>
        <button type="button" onClick={() => pan(0, -80)} aria-label="Pan up">↑</button>
        <button type="button" onClick={() => pan(0, 80)} aria-label="Pan down">↓</button>
      </div>
      <div
        ref={canvasRef}
        className="diagram-canvas"
        tabIndex={0}
        role="group"
        aria-label={`${label} navigation area`}
        onKeyDown={(event) => {
          const movement = event.shiftKey ? 160 : 48;
          if (event.key === 'ArrowLeft') pan(-movement, 0);
          else if (event.key === 'ArrowRight') pan(movement, 0);
          else if (event.key === 'ArrowUp') pan(0, -movement);
          else if (event.key === 'ArrowDown') pan(0, movement);
          else if (event.key === '+' || event.key === '=') zoom(1.25);
          else if (event.key === '-') zoom(0.8);
          else if (event.key === '0') fit();
          else return;
          event.preventDefault();
        }}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const previous = drag.current;
          if (!previous) return;
          pan(event.clientX - previous.x, event.clientY - previous.y);
          drag.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          drag.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        onPointerCancel={() => { drag.current = null; }}
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
            style={{ transform: `translate(${state.pan_x}px, ${state.pan_y}px) scale(${state.zoom})` }}
          />
        )}
        {description && <span className="visually-hidden" id={descriptionId}>{description}</span>}
      </div>
    </div>
  );
});
