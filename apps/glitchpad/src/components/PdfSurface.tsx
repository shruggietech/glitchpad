import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  Field,
  Select,
  TextInput,
} from '../../../../brand/web/react/server';
import type { ShellSession } from '../domain/contracts';
import { PdfController } from '../domain/pdf-controller';
import { createPdfSourceLease } from '../domain/pdf-source-gateway';
import {
  classifyPdfFailure,
  pdfFailureMessage,
  type PdfErrorCode,
  type PdfDocumentState,
} from '../domain/pdf-contract';
import {
  continuousFits,
  measurePdfScrollCeiling,
  pageAtOffset,
  pageOffsets,
} from '../domain/pdf-viewport';
import type { TextEditorHandle } from './TextEditorSurface';
import {
  PdfPageCanvas,
  pdfViewKey,
  type PdfPageMetrics,
} from './PdfPageCanvas';
import { TaskSurface } from './TaskSurface';
import {
  PdfNavigationTools,
  type PdfNavigationHandle,
} from './PdfNavigationTools';
import { PdfPrintTools, type PdfPrintHandle } from './PdfPrintTools';
import type { PdfSearchMatch } from '../domain/pdf-contract';
import {
  rendererContribution,
  type MetadataContribution,
} from '../domain/metadata';
import type { MarkdownExternalLinkGateway } from '../domain/markdown-gateway';
import { writeClipboardText } from '../domain/clipboard-gateway';
import './PdfSurface.css';

interface Props {
  externalLinkGateway?: MarkdownExternalLinkGateway;
  onMetadataContribution?: (value: MetadataContribution) => void;
  session: ShellSession;
  onPdfChange?: (
    id: string,
    expectedRevision: number,
    state: PdfDocumentState,
  ) => void;
  onOpenMetadata?: (opener: HTMLElement) => void;
}
export const PdfSurface = forwardRef<TextEditorHandle, Props>(
  function PdfSurface(
    {
      session,
      onPdfChange,
      onOpenMetadata,
      externalLinkGateway,
      onMetadataContribution,
    },
    handleRef,
  ) {
    const resume = useRef(session.pdf_document?.navigation);
    resume.current = session.pdf_document?.navigation;
    const navigationTools = useRef<PdfNavigationHandle>(null);
    const printTools = useRef<PdfPrintHandle>(null);
    const [labels, setLabels] = useState<string[]>([]);
    const [selectedMatch, setSelectedMatch] = useState<PdfSearchMatch | null>(
      null,
    );
    const controller = useMemo(
      () => new PdfController(session.id, resume.current),
      [session.id, session.revision],
    );
    const [state, setState] = useState(controller.state);
    const [visible, setVisible] = useState(
      document.visibilityState !== 'hidden',
    );
    const [failure, setFailure] = useState<PdfErrorCode | null>(null);
    const [pageFailures,setPageFailures]=useState(new Map<number,{key:string;error:PdfErrorCode}>());
    const [preparation, setPreparation] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [retry, setRetry] = useState(0);
    const [task, setTask] = useState<'view' | 'page' | null>(null);
    const opener = useRef<HTMLElement | null>(null);
    const [pageDraft, setPageDraft] = useState('1');
    const [pageError, setPageError] = useState<string | null>(null);
    const [zoomDraft, setZoomDraft] = useState('100');
    const pane = useRef<HTMLDivElement>(null);
    const preparationAbort = useRef<AbortController | null>(null);
    const [viewport, setViewport] = useState({ width: 640, height: 480 });
    const [scrollTop, setScrollTop] = useState(0);
    const scrollFrame = useRef<number | null>(null);
    const scrollIntent = useRef(false);
    const [maximumScroll, setMaximumScroll] = useState(8_000_000);
    const [metrics, setMetrics] = useState(
      new Map<number, { key: string; value: PdfPageMetrics }>(),
    );
    const [ready, setReady] = useState(new Map<number, string>());
    const callbacks = useRef({
      onPdfChange,
      onOpenMetadata,
      onMetadataContribution,
    });
    callbacks.current = { onPdfChange, onOpenMetadata, onMetadataContribution };
    const view = state.navigation;
    const key = pdfViewKey(
      view,
      viewport.width,
      viewport.height,
      state.reduced_cache,
    );
    const platform =
      session.source.kind === 'document_uri' ? 'android' : 'desktop';
    const count = state.page_count ?? 0;
    const currentMetrics = metrics.get(view.page);
    const effectiveScale =
      currentMetrics?.key === key ? currentMetrics.value.scale : null;
    const currentReady =
      state.capabilities.view && ready.get(view.page) === key;
    const heights = useMemo(
      () =>
        new Map(
          [...metrics]
            .filter(([, entry]) => entry.key === key)
            .map(([page, entry]) => [page, entry.value.height]),
        ),
      [metrics, key],
    );
    const widths = [...metrics.values()]
      .filter((entry) => entry.key === key)
      .map((entry) => entry.value.width);
    const estimate = heights.get(view.page) ?? viewport.height;
    const offsets = useMemo(
      () => pageOffsets(count, estimate, heights),
      [count, estimate, heights],
    );
    const fits = continuousFits(offsets, maximumScroll);
    const continuous = view.layout === 'continuous' && fits;
    const first = continuous ? pageAtOffset(offsets, scrollTop) : view.page;
    const last = continuous
      ? pageAtOffset(offsets, scrollTop + viewport.height)
      : view.page;
    const tooMany = last - first + 1 > 16;
    const single = !continuous || tooMany;
    const lookAhead = state.reduced_cache ? 0 : 1;
    const start = single ? view.page : Math.max(0, first - lookAhead);
    const end = single ? view.page : Math.min(count - 1, last + lookAhead);
    const rendered = state.capabilities.view
      ? Array.from(
          { length: Math.max(0, end - start + 1) },
          (_, index) => index + start,
        )
      : [];
    const contentHeight = single
      ? (heights.get(view.page) ?? estimate)
      : offsets[count];
    const openTask = (next: 'view' | 'page', target?: HTMLElement) => {
      opener.current = target ?? (document.activeElement as HTMLElement);
      setPageDraft(String(view.page + 1));
      setPageError(null);
      setTask(next);
    };
    const onMetrics = useCallback(
      (page: number, renderKey: string, value: PdfPageMetrics) =>
        setMetrics((previous) => {
          const known = previous.get(page);
          if (
            known?.key === renderKey &&
            known.value.width === value.width &&
            known.value.height === value.height &&
            known.value.scale === value.scale
          )
            return previous;
          const next = new Map(previous);
          next.set(page, { key: renderKey, value });
          return next;
        }),
      [],
    );
    const onReady = useCallback(
      (page: number, renderKey: string, value: boolean, error?:PdfErrorCode) => {
        setPageFailures(previous=>{const known=previous.get(page);if(error){if(known?.key===renderKey&&known.error===error)return previous;const next=new Map(previous);next.set(page,{key:renderKey,error});return next;}if(known?.key!==renderKey)return previous;const next=new Map(previous);next.delete(page);return next;});
        setReady((previous) => {
          if (
            (value && previous.get(page) === renderKey) ||
            (!value && previous.get(page) !== renderKey)
          )
            return previous;
          const next = new Map(previous);
          if (value) next.set(page, renderKey);
          else next.delete(page);
          return next;
        });
      },
      [],
    );
    useEffect(
      () =>
        controller.subscribe((next) => {
          setState(next);
          callbacks.current.onPdfChange?.(session.id, session.revision, next);
        }),
      [controller, session.id, session.revision],
    );
    useEffect(() => () => controller.dispose(), [controller]);
    useEffect(() => {
      const update = () => setVisible(document.visibilityState !== 'hidden');
      document.addEventListener('visibilitychange', update);
      return () => document.removeEventListener('visibilitychange', update);
    }, []);
    useEffect(() => {
      if (!visible) {
        controller.cancel();
        return;
      }
      let active = true;
      const abort = new AbortController();
      preparationAbort.current = abort;
      setPreparation(null);
      setFailure(null);
      void createPdfSourceLease(session, undefined, undefined, {
        signal: abort.signal,
        onProgress(processed, total) {
          if (active)
            setPreparation(
              'Preparing PDF: ' +
                (processed / 1048576).toFixed(1) +
                ' MiB' +
                (total === null
                  ? ''
                  : ' of ' + (total / 1048576).toFixed(1) + ' MiB'),
            );
        },
      })
        .then((lease) => {
          if (!active) {
            void lease.close();
            return;
          }
          setPreparation(null);
          return controller.open(lease);
        })
        .catch((error) => {
          if (active) {
            setPreparation(null);
            setFailure(classifyPdfFailure(error));
            controller.sourceFailed(error);
          }
        });
      return () => {
        active = false;
        abort.abort();
        if (preparationAbort.current === abort) preparationAbort.current = null;
        controller.cancel();
      };
    }, [controller, session.source_state, retry, visible]);
    useEffect(() => {
      const element = pane.current;
      if (!element) return;
      const measure = () =>
        setViewport({
          width: Math.max(48, element.clientWidth - 16),
          height: Math.max(48, element.clientHeight - 16),
        });
      measure();
      setMaximumScroll(measurePdfScrollCeiling(document));
      const observer =
        typeof ResizeObserver === 'undefined'
          ? null
          : new ResizeObserver(measure);
      observer?.observe(element);
      return () => {
        observer?.disconnect();
        if (scrollFrame.current !== null)
          cancelAnimationFrame(scrollFrame.current);
      };
    }, []);
    useEffect(() => {
      if (
        !state.capabilities.view ||
        (!fits && view.layout === 'continuous') ||
        tooMany
      ) {
        if (state.capabilities.view && (!fits || tooMany))
          controller.reduceCache();
      }
    }, [controller, state.capabilities.view, fits, tooMany, view.layout]);
    useEffect(() => {
      if (!pane.current || !state.capabilities.view) return;
      scrollIntent.current = false;
      const target = single ? 0 : offsets[view.page];
      pane.current.scrollTop = target;
      setScrollTop(pane.current.scrollTop);
    }, [
      controller,
      view.request,
      view.layout,
      view.fit,
      view.zoom,
      view.rotation,
      single,
      state.capabilities.view,
    ]);
    useEffect(() => {
      if (!currentReady || !pane.current) return;
      let active = true;
      if (view.target && effectiveScale !== null)
        void controller
          .targetOffset(view.page, effectiveScale, view.rotation, view.target)
          .then((point) => {
            if (active && pane.current) {
              pane.current.scrollTop =
                (single ? 0 : offsets[view.page]) + point.y;
              pane.current.scrollLeft = point.x;
            }
          })
          .catch(() => undefined);
      if (selectedMatch?.page === view.page) {
        const layer = pane.current.querySelector<HTMLElement>(
          '.pdf-page[data-current=true] .pdf-text-layer',
        );
        if (layer) {
          const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
          const nodes: Text[] = [];
          let node = walker.nextNode();
          while (node) {
            nodes.push(node as Text);
            node = walker.nextNode();
          }
          const text = nodes.map((value) => value.data).join('');
          const offset = text
            .toLowerCase()
            .indexOf(selectedMatch.text.toLowerCase());
          if (offset >= 0) {
            let from = offset,
              to = offset + selectedMatch.text.length;
            const range = document.createRange();
            let started = false;
            for (const value of nodes) {
              if (!started) {
                if (from < value.length) {
                  range.setStart(value, from);
                  started = true;
                } else from -= value.length;
              }
              if (to <= value.length) {
                range.setEnd(value, to);
                break;
              }
              to -= value.length;
            }
            if (started) {
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          }
        }
      }
      return () => {
        active = false;
      };
    }, [
      controller,
      currentReady,
      view.page,
      view.request,
      view.rotation,
      view.target,
      effectiveScale,
      selectedMatch,
      single,
    ]);
    const zoom = (factor: number) => {
      if (!state.capabilities.zoom) return false;
      controller.setView({
        fit: 'custom',
        zoom: Math.min(
          8,
          Math.max(0.1, (effectiveScale ?? view.zoom) * factor),
        ),
      });
      return true;
    };
    const go = (page: number) => {
      try {
        controller.navigate(page);
        return true;
      } catch {
        return false;
      }
    };
    const cancel = () => {
      preparationAbort.current?.abort();
      setPreparation(null);
      controller.cancel();
    };
    useImperativeHandle(handleRef, () => ({
      invoke(command, target) {
        if (command === 'print' && target)
          return printTools.current?.open(target) ?? false;
        if (navigationTools.current?.invoke(command, target)) return true;
        if (command === 'copy') {
          const selection = window.getSelection()?.toString();
          if (!selection) return false;
          return writeClipboardText(selection)
            .then(() => true)
            .catch(() => false);
        }
        if (command === 'metadata' && target) {
          callbacks.current.onOpenMetadata?.(target);
          return true;
        }
        if (!state.capabilities.view) return false;
        if (command === 'zoom_in') return zoom(1.25);
        if (command === 'zoom_out') return zoom(0.8);
        if (command === 'fit') {
          controller.setView({ fit: 'page' });
          return true;
        }
        if (command === 'previous_page') return go(view.page - 1);
        if (command === 'next_page') return go(view.page + 1);
        if (command === 'go_to_line') {
          openTask('page', target);
          return true;
        }
        return false;
      },
      selectRange() {
        return false;
      },
      dismissModal() {
        if (task) {
          setTask(null);
          return true;
        }
        if (state.state === 'password_required') {
          setPassword('');
          cancel();
          return true;
        }
        return false;
      },
    }));
    useEffect(() => {
      if (!state.capabilities.inspect_metadata) return;
      let active = true;
      void controller
        .metadata(view.page)
        .then((facts) => {
          if (active)
            callbacks.current.onMetadataContribution?.(
              rendererContribution(session, facts, session.revision),
            );
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [
      controller,
      state.capabilities.inspect_metadata,
      view.page,
      session.id,
      session.revision,
    ]);
    const pageFailure=pageFailures.get(view.page);const renderError=pageFailure?.key===key?pageFailure.error:null;
    const errorCode=failure??state.error??renderError;
    const status=errorCode?pdfFailureMessage(errorCode,platform):preparation??(state.state==='loading'?'Loading PDF…':state.state==='cancelled'?'PDF viewing paused.':state.capabilities.view&&!currentReady?'Rendering PDF page…':'Waiting for PDF…');
    return (
      <div
        className="pdf-layout"
        data-pdf-owner={state.owner_id}
        data-pdf-state={state.state}
        data-pdf-error={errorCode??undefined}
        data-pdf-ready={currentReady}
        data-pdf-worker={controller.workerReady}
        data-pdf-engine="6.5.438"
        data-pdf-layout={single ? 'single' : 'continuous'}
        data-pdf-surfaces={rendered.length}
      >
        <div className="pdf-controls" role="group" aria-label="PDF controls">
          <Button
            variant="ghost"
            disabled={!state.capabilities.navigate || view.page === 0}
            onClick={() => go(view.page - 1)}
            aria-label="Previous page"
          >
            ‹
          </Button>
          <Button
            variant="ghost"
            disabled={!state.capabilities.navigate}
            onClick={(event) => openTask('page', event.currentTarget)}
            aria-label="Go to page"
            aria-describedby="pdf-current-page"
          >
            <span className="pdf-page-counter">{count ? String(view.page + 1) + ' / ' + String(count)+(labels[view.page]?' ('+labels[view.page]+')':'') : 'PDF'}</span>
          </Button>
          <span id="pdf-current-page" className="visually-hidden" aria-live="polite">{count?'Page '+String(view.page+1)+' of '+String(count)+(labels[view.page]?', label '+labels[view.page]:''):'PDF loading'}</span>
          <Button
            variant="ghost"
            disabled={!state.capabilities.navigate || view.page + 1 >= count}
            onClick={() => go(view.page + 1)}
            aria-label="Next page"
          >
            ›
          </Button>
          <Button
            variant="ghost"
            disabled={!state.capabilities.zoom}
            onClick={() => controller.setView({ fit: 'page' })}
          >
            Fit
          </Button>
          <Button
            variant="ghost"
            disabled={!state.capabilities.view}
            onClick={(event) => openTask('view', event.currentTarget)}
            aria-label="More PDF tools"
          >
            ⋯
          </Button>
        </div>
        <div
          className="pdf-pane"
          ref={pane}
          tabIndex={0}
          role="region"
          aria-label="PDF pages"
          onWheel={()=>{scrollIntent.current=true;}}
          onTouchStart={()=>{scrollIntent.current=true;}}
          onPointerDown={()=>{scrollIntent.current=true;}}
          onScroll={() => {
            if (scrollFrame.current !== null) return;
            scrollFrame.current = requestAnimationFrame(() => {
              scrollFrame.current = null;
              const top = pane.current?.scrollTop ?? 0;
              setScrollTop(top);
              if (scrollIntent.current && !single && state.capabilities.navigate) {
                const page = pageAtOffset(offsets, top);
                if (page !== view.page) controller.navigate(page, 'scroll');
              }
            });
          }}
          onKeyDown={(event) => {
            if (
              event.target !== event.currentTarget ||
              !state.capabilities.navigate
            )
              return;
            if (['ArrowDown','ArrowUp',' '].includes(event.key))scrollIntent.current=true;
            if (event.key === 'PageDown') {
              event.preventDefault();
              go(Math.min(count - 1, view.page + 1));
            }
            if (event.key === 'PageUp') {
              event.preventDefault();
              go(Math.max(0, view.page - 1));
            }
            if (event.key === 'Home') {
              event.preventDefault();
              go(0);
            }
            if (event.key === 'End') {
              event.preventDefault();
              go(count - 1);
            }
          }}
        >
          <div
            className="pdf-virtual-pages"
            style={{
              height: Math.max(0, contentHeight ?? 0),
              width: Math.max(viewport.width, ...widths),
            }}
          >
            {rendered.map((index) => (
              <PdfPageCanvas
                key={index}
                controller={controller}
                index={index}
                current={index === view.page}
                label={labels[index] ?? ''}
                top={single ? 0 : offsets[index]}
                view={view}
                width={viewport.width}
                height={viewport.height}
                reduced={state.reduced_cache}
                platform={platform}
                onMetrics={onMetrics}
                onReady={onReady}
              />
            ))}
          </div>
        </div>
        {(!currentReady || failure || state.error || state.reduced_cache) && (
          <div className="pdf-status" role="status">
            {!currentReady || failure || state.error ? status : ''}
            {state.reduced_cache && ' Reduced cache; thumbnails paused.'}
            {state.reduced_cache && (!fits || tooMany) && ' Showing one page to stay within this WebView’s scroll and page-work limits.'}
            {(state.state === 'loading' || preparation) && <Button variant="secondary" onClick={cancel}>Cancel PDF</Button>}
            {(state.state === 'failed' || state.state === 'cancelled') && <Button variant="secondary" onClick={()=>setRetry(value=>value+1)}>Retry PDF</Button>}
          </div>
        )}
        <TaskSurface
          open={task === 'view'}
          onOpenChange={(open) => {
            if (!open) setTask(null);
          }}
          title="PDF tools"
          opener={opener.current}
          className="pdf-tools"
        >
          <p>
            Current zoom:{' '}
            {effectiveScale === null
              ? 'Loading'
              : String(Number((effectiveScale * 100).toFixed(2))) + '%'}
          </p>
          <div className="pdf-tool-actions">
            <Button
              variant="secondary"
              onClick={() => zoom(0.8)}
              disabled={
                !state.capabilities.zoom ||
                (effectiveScale !== null && effectiveScale <= 0.1)
              }
            >
              Zoom out
            </Button>
            <Button
              variant="secondary"
              onClick={() => zoom(1.25)}
              disabled={
                !state.capabilities.zoom ||
                (effectiveScale !== null && effectiveScale >= 8)
              }
            >
              Zoom in
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                controller.setView({
                  rotation: ((view.rotation + 90) % 360) as 0 | 90 | 180 | 270,
                })
              }
            >
              Rotate
            </Button>
          </div>
          <Field
            id="pdf-fit"
            label="Fit"
            control={
              <Select
                value={view.fit}
                onChange={(event) =>
                  controller.setView({
                    fit: event.target.value as typeof view.fit,
                  })
                }
              >
                <option value="page">Fit page</option>
                <option value="width">Fit width</option>
                <option value="custom">Custom zoom</option>
              </Select>
            }
          />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const value = Number(zoomDraft) / 100;
              if (value >= 0.1 && value <= 8)
                controller.setView({ fit: 'custom', zoom: value });
            }}
          >
            <Field
              id="pdf-zoom"
              label="Custom zoom percent (10–800)"
              control={
                <TextInput
                  type="number"
                  min="10"
                  max="800"
                  value={zoomDraft}
                  onChange={(event) => setZoomDraft(event.target.value)}
                />
              }
            />
            <Button type="submit">Apply zoom</Button>
          </form>
          <Field
            id="pdf-layout"
            label="Page layout"
            control={
              <Select
                value={view.layout}
                onChange={(event) =>
                  controller.setView({
                    layout: event.target.value as typeof view.layout,
                  })
                }
              >
                <option value="continuous">Continuous</option>
                <option value="single">Single page</option>
              </Select>
            }
          />
          <div className="pdf-tool-actions">
            <Button
              variant="secondary"
              onClick={(event) =>
                navigationTools.current?.open('search', event.currentTarget)
              }
            >
              Search
            </Button>
            <Button
              variant="secondary"
              onClick={(event) =>
                navigationTools.current?.open('outline', event.currentTarget)
              }
            >
              Outline
            </Button>
            <Button
              variant="secondary"
              onClick={(event) =>
                navigationTools.current?.open('thumbnails', event.currentTarget)
              }
              disabled={!state.capabilities.thumbnails}
            >
              Thumbnails
            </Button>
            <Button
              variant="secondary"
              onClick={(event) =>
                navigationTools.current?.open('links', event.currentTarget)
              }
            >
              Page links
            </Button>
          </div>
          <Button
            variant="secondary"
            disabled={state.capabilities.print !== 'available'}
            onClick={(event) => printTools.current?.open(event.currentTarget)}
          >
            Print
          </Button>
          <Button
            variant="secondary"
            onClick={(event) =>
              callbacks.current.onOpenMetadata?.(event.currentTarget)
            }
          >
            File information
          </Button>
        </TaskSurface>
        <TaskSurface
          open={task === 'page'}
          onOpenChange={(open) => {
            if (!open) setTask(null);
          }}
          title="Go to PDF page"
          opener={opener.current}
          className="pdf-tools"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const page = Number(pageDraft);
              if (!/^\d+$/.test(pageDraft.trim()) || !go(page - 1)) {
                setPageError(
                  'Enter a page number from 1 to ' + String(count) + '.',
                );
                return;
              }
              setTask(null);
            }}
          >
            <Field
              id="pdf-page-number"
              label="Page number"
              error={pageError ?? undefined}
              control={
                <TextInput
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={count}
                  value={pageDraft}
                  onChange={(event) => setPageDraft(event.target.value)}
                />
              }
            />
            <Button type="submit">Go to page</Button>
          </form>
        </TaskSurface>
        <PdfPrintTools
          ref={printTools}
          controller={controller}
          session={session}
        />
        <PdfNavigationTools
          ref={navigationTools}
          controller={controller}
          state={state}
          externalLinkGateway={externalLinkGateway}
          onLabels={setLabels}
          onMatch={(match) => {
            setSelectedMatch(match);
            controller.navigate(match.page);
          }}
        />
        <TaskSurface
          open={state.state === 'password_required'}
          onOpenChange={(open) => {
            if (!open) {
              setPassword('');
              cancel();
            }
          }}
          title="PDF password"
          className="pdf-tools"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              controller.password(password);
              setPassword('');
            }}
          >
            <Field
              id="pdf-password"
              label="Password"
              error={
                state.error === 'incorrect_password'
                  ? 'The password was not accepted.'
                  : undefined
              }
              control={
                <TextInput
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              }
            />
            <Button type="submit">Open PDF</Button>
          </form>
        </TaskSurface>
      </div>
    );
  },
);
