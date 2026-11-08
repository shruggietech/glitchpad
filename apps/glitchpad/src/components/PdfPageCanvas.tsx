import { useEffect, useRef, useState } from 'react';
import { PdfController, type PdfPageSurface } from '../domain/pdf-controller';
import {
  classifyPdfFailure,
  pdfFailureMessage,
  pdfSurfaceBytes,
  type PdfErrorCode,
  type PdfNavigation,
  type PdfPlatform,
} from '../domain/pdf-contract';
export interface PdfPageMetrics {
  width: number;
  height: number;
  scale: number;
  baseWidth: number;
  baseHeight: number;
}
export const pdfViewKey = (
  view: PdfNavigation,
  width: number,
  height: number,
  reduced: boolean,
) => [view.fit, view.zoom, view.rotation, width, view.fit === 'page' ? height : 0, reduced].join(':');
interface Props {
  controller: PdfController;
  index: number;
  current: boolean;
  label: string;
  top: number;
  view: PdfNavigation;
  width: number;
  height: number;
  reduced: boolean;
  platform: PdfPlatform;
  onMetrics: (page: number, key: string, metrics: PdfPageMetrics) => void;
  onReady: (page: number, key: string, ready: boolean, error?:PdfErrorCode) => void;
}
export function PdfPageCanvas({
  controller,
  index,
  current,
  label,
  top,
  view,
  width,
  height,
  reduced,
  platform,
  onMetrics,
  onReady,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<PdfErrorCode | null>(null);
  const key = pdfViewKey(view, width, height, reduced);
  useEffect(() => {
    const abort = new AbortController();
    let surface: PdfPageSurface | null = null;
    onReady(index, key, false);
    setError(null);
    const render = async () => {
      const base = await controller.pageSize(index, view.rotation);
      if (abort.signal.aborted) return;
      const scale =
        view.fit === 'width'
          ? width / base.width
          : view.fit === 'page'
            ? Math.min(width / base.width, height / base.height)
            : view.zoom;
      const pageWidth = Math.ceil(base.width * scale),
        pageHeight = Math.ceil(base.height * scale);
      pdfSurfaceBytes(pageWidth, pageHeight, platform);
      onMetrics(index, key, {
        width: pageWidth,
        height: pageHeight,
        scale,
        baseWidth: base.width,
        baseHeight: base.height,
      });
      text.current!.style.setProperty('--total-scale-factor', String(scale));
      const result = await controller.renderPage(
        index,
        canvas.current!,
        text.current!,
        scale,
        view.rotation,
        abort.signal,
      );
      if (abort.signal.aborted) {
        result.dispose();
        return;
      }
      surface = result;
      onReady(index, key, true);
    };
    void render().catch((reason) => {
      if (!abort.signal.aborted) {
        setError(classifyPdfFailure(reason));
        onReady(index, key, false,classifyPdfFailure(reason));
      }
    });
    return () => {
      abort.abort();
      surface?.dispose();
      onReady(index, key, false);
    };
  }, [
    controller,
    index,
    key,
    view.fit,
    view.zoom,
    view.rotation,
    width,
    height,
    platform,
    onMetrics,
    onReady,
  ]);
  return (
    <div
      className="pdf-page"
      data-pdf-page={index}
      data-current={current}
      style={{ top }}
      role="group"
      aria-label={
        'Page ' + String(index + 1) + (label ? ' (' + label + ')' : '')
      }
    >
      <canvas ref={canvas} aria-hidden="true" />
      <div ref={text} className="pdf-text-layer" />
      {error && (
        <p className="pdf-page-error" role="status">
          {pdfFailureMessage(error,platform)}
        </p>
      )}
    </div>
  );
}
