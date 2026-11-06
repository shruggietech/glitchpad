import {
  clipboardTextAvailable,
  writeClipboardText,
} from '../domain/clipboard-gateway';
import { TaskSurface } from './TaskSurface';
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { MermaidRendererClient } from '../domain/mermaid-adapter';
import {
  MERMAID_STANDALONE_MAX_BYTES,
  initialMermaidViewport,
  type MermaidRenderResult,
} from '../domain/mermaid-contract';
import type {
  LanguageDecision,
  MermaidDocumentState,
  ShellSession,
  TextDocumentState,
} from '../domain/contracts';
import { DiagramViewport, type DiagramViewportHandle } from './DiagramViewport';
import {
  TextEditorSurface,
  type EditorCommandState,
  type TextEditorHandle,
} from './TextEditorSurface';
import './DocumentTools.css';
import { useMermaidTheme } from './useMermaidTheme';
import {
  rendererContribution,
  type MetadataContribution,
  type MetadataObservation,
} from '../domain/metadata';
import { rendererResourceLedger } from '../domain/resource-ledger';

interface MermaidSurfaceProps {
  onCommandStateChange?: (state: EditorCommandState) => void;
  session: ShellSession;
  onDocumentChange: (
    id: string,
    expectedRevision: number,
    document: TextDocumentState,
    revision: number,
  ) => void;
  onLanguageChange: (
    id: string,
    expectedRevision: number,
    language: LanguageDecision,
  ) => void;
  onMermaidChange: (
    id: string,
    expectedRevision: number,
    mermaid: MermaidDocumentState,
  ) => void;
  rendererClient?: MermaidRendererClient;
  onOpenMetadata?: (opener: HTMLElement) => void;
  onMetadataContribution?: (contribution: MetadataContribution) => void;
}

const initialState = (session: ShellSession): MermaidDocumentState => ({
  mode: session.text_document?.normalized_text.trim() ? 'rendered' : 'source',
  render_revision: null,
  render_status: 'idle',
  preview_stale: false,
  viewport: initialMermaidViewport(),
});

export const MermaidSurface = forwardRef<TextEditorHandle, MermaidSurfaceProps>(
  function MermaidSurface(
    {
      session,
      onDocumentChange,
      onLanguageChange,
      onMermaidChange,
      rendererClient,
      onMetadataContribution,
      onCommandStateChange,
    },
    handleRef,
  ) {
    const performanceInstanceId = useId();
    const ownedClient = useRef<MermaidRendererClient | null>(null);
    const ownsClient = useRef(rendererClient === undefined);
    const lifecycleGeneration = useRef(0);
    if (!ownedClient.current)
      ownedClient.current =
        rendererClient ??
        new MermaidRendererClient(
          undefined,
          undefined,
          undefined,
          undefined,
          rendererResourceLedger.register(
            `mermaid:${session.id}:${performanceInstanceId}`,
            session.text_document?.source_bytes ?? 0,
          ),
        );
    const client = ownedClient.current;
    const editorRef = useRef<TextEditorHandle>(null);
    const pendingSelection = useRef<{ from: number; to: number } | null>(null);
    const actionContext = useRef({
      id: session.id,
      revision: session.revision,
      lifecycle: session.lifecycle,
    });
    actionContext.current = {
      id: session.id,
      revision: session.revision,
      lifecycle: session.lifecycle,
    };
    const viewportRef = useRef<DiagramViewportHandle>(null);
    const state = session.mermaid_document ?? initialState(session);
    const [mode, setMode] = useState(state.mode);
    const [result, setResult] = useState<MermaidRenderResult | null>(null);
    const [lastValid, setLastValid] = useState<MermaidRenderResult | null>(
      null,
    );
    const [status, setStatus] = useState<MermaidDocumentState['render_status']>(
      state.render_status,
    );
    const [stale, setStale] = useState(state.preview_stale);
    const [viewport, setViewport] = useState(state.viewport);
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [matchIndex, setMatchIndex] = useState(0);
    const [sourceVisited, setSourceVisited] = useState(mode === 'source');
    const searchResultRef = useRef<HTMLElement>(null);
    const previewHostRef = useRef<HTMLDivElement>(null);
    const commandCallback = useRef(onCommandStateChange);
    commandCallback.current = onCommandStateChange;
    useEffect(() => {
      if (mode === 'source') {
        setSourceVisited(true);
        commandCallback.current?.(
          editorRef.current?.commandState?.() ?? {
            undo: false,
            redo: false,
            wrapped: false,
          },
        );
      } else
        commandCallback.current?.({ undo: false, redo: false, wrapped: false });
    }, [mode]);
    const theme = useMermaidTheme();
    const textDocument = session.text_document!;
    const eligible = textDocument.source_bytes <= MERMAID_STANDALONE_MAX_BYTES;
    const visibleResult = result?.status === 'ready' ? result : lastValid;
    const projectionRef = useRef({
      mode,
      result,
      lastValid,
      status,
      stale,
      viewport,
    });
    projectionRef.current = {
      mode,
      result,
      lastValid,
      status,
      stale,
      viewport,
    };

    const publish = (next: Partial<MermaidDocumentState>) => {
      const current = projectionRef.current;
      onMermaidChange(session.id, session.revision, {
        mode: current.mode,
        render_revision:
          current.result?.source_revision ??
          current.lastValid?.source_revision ??
          null,
        render_status: current.status,
        preview_stale: current.stale,
        viewport: current.viewport,
        ...next,
      });
    };

    useEffect(() => {
      setMode(session.mermaid_document?.mode ?? initialState(session).mode);
      setViewport(
        session.mermaid_document?.viewport ?? initialMermaidViewport(),
      );
    }, [
      session.id,
      session.mermaid_document?.mode,
      session.mermaid_document?.viewport,
    ]);

    useEffect(() => {
      if (!eligible || session.lifecycle === 'background') {
        client.suspend();
        if (!eligible) {
          const previous = projectionRef.current.lastValid;
          const hasPrevious = previous !== null;
          setStatus('limited');
          setMode('source');
          setStale(hasPrevious);
          projectionRef.current = {
            ...projectionRef.current,
            mode: 'source',
            status: 'limited',
            stale: hasPrevious,
          };
          publish({
            mode: 'source',
            render_revision: previous?.source_revision ?? null,
            render_status: 'limited',
            preview_stale: hasPrevious,
          });
        }
        return;
      }
      setStatus('scheduled');
      void client
        .render({
          owner_id: session.id,
          source_revision: session.revision,
          source_text: textDocument.normalized_text,
          fallback_label: `${session.source.display_name} Mermaid diagram`,
          theme,
        })
        .then((next) => {
          if (!next) return;
          setResult(next);
          setStatus(next.status);
          projectionRef.current = {
            ...projectionRef.current,
            result: next,
            status: next.status,
          };
          if (next.status === 'ready') {
            setLastValid(next);
            setStale(false);
            projectionRef.current = {
              ...projectionRef.current,
              lastValid: next,
              stale: false,
            };
            publish({
              render_revision: next.source_revision,
              render_status: 'ready',
              preview_stale: false,
            });
          } else {
            const previous = projectionRef.current.lastValid;
            const hasPrevious = previous !== null;
            setStale(hasPrevious);
            if (!hasPrevious) setMode('source');
            projectionRef.current = {
              ...projectionRef.current,
              mode: hasPrevious ? projectionRef.current.mode : 'source',
              stale: hasPrevious,
            };
            publish({ render_revision: previous?.source_revision ?? null });
          }
          onMetadataContribution?.(
            rendererContribution(
              session,
              mermaidMetadataFacts(next, projectionRef.current.stale),
              next.source_revision,
            ),
          );
        });
      return () => client.cancel();
    }, [
      client,
      eligible,
      session.id,
      session.lifecycle,
      session.revision,
      textDocument.normalized_text,
      theme,
    ]);

    useEffect(() => {
      const generation = ++lifecycleGeneration.current;
      return () =>
        queueMicrotask(() => {
          if (
            ownsClient.current &&
            lifecycleGeneration.current === generation
          ) {
            ownedClient.current?.dispose();
            ownedClient.current = null;
          }
        });
    }, []);

    const matches = useMemo(() => {
      const needle = query.trim().toLocaleLowerCase();
      return needle
        ? (visibleResult?.search_text.filter((text) =>
            text.toLocaleLowerCase().includes(needle),
          ) ?? [])
        : [];
    }, [query, visibleResult?.search_text]);

    useEffect(() => {
      setMatchIndex(0);
    }, [query, visibleResult]);
    useEffect(() => {
      searchResultRef.current?.scrollIntoView?.({ block: 'nearest' });
    }, [matchIndex]);
    const closeSearch = () => {
      setSearchOpen(false);
      requestAnimationFrame(() =>
        previewHostRef.current
          ?.querySelector<HTMLElement>('.diagram-canvas')
          ?.focus(),
      );
    };
    const moveMatch = (direction: -1 | 1) => {
      if (!matches.length) return false;
      setMatchIndex(
        (value) => (value + direction + matches.length) % matches.length,
      );
      return true;
    };

    useEffect(() => {
      const range = pendingSelection.current;
      if (mode !== 'source' || !range || session.lifecycle !== 'active') return;
      if (editorRef.current?.selectRange(range.from, range.to))
        pendingSelection.current = null;
    }, [mode, sourceVisited, session.id, session.lifecycle]);

    const changeMode = (nextMode: 'rendered' | 'source') => {
      if (nextMode === 'rendered' && !visibleResult) return false;
      setMode(nextMode);
      publish({ mode: nextMode });
      return true;
    };

    useImperativeHandle(handleRef, () => ({
      invoke(command, opener) {
        if (session.lifecycle !== 'active') return false;
        if (command === 'edit') {
          return changeMode(mode === 'source' ? 'rendered' : 'source');
        }
        if (
          mode === 'source' &&
          (command === 'search' ||
            command === 'find_next' ||
            command === 'find_previous' ||
            command === 'close_search' ||
            command === 'go_to_line')
        ) {
          return editorRef.current?.invoke(command, opener) ?? false;
        }
        if (command === 'search') {
          setSearchOpen(true);
          return true;
        }
        if (command === 'find_next') return moveMatch(1);
        if (command === 'find_previous') return moveMatch(-1);
        if (command === 'close_search') {
          closeSearch();
          return true;
        }
        if (command === 'zoom_in') {
          if (!viewportRef.current) return false;
          return viewportRef.current.zoomIn();
        }
        if (command === 'zoom_out') {
          if (!viewportRef.current) return false;
          return viewportRef.current.zoomOut();
        }
        if (command === 'fit') {
          if (!viewportRef.current) return false;
          return viewportRef.current.fit();
        }
        if (command === 'metadata') {
          return false;
        }
        if (command === 'go_to_line') {
          changeMode('source');
          const expected = lifecycleGeneration.current;
          const context = actionContext.current;
          return new Promise<boolean>((resolve) =>
            requestAnimationFrame(() => {
              if (
                lifecycleGeneration.current !== expected ||
                actionContext.current.id !== context.id ||
                actionContext.current.revision !== context.revision ||
                actionContext.current.lifecycle !== 'active'
              ) {
                resolve(false);
                return;
              }
              resolve(editorRef.current?.invoke('go_to_line') ?? false);
            }),
          );
        }
        if (mode === 'source')
          return editorRef.current?.invoke(command, opener) ?? false;
        if (command === 'copy') {
          if (!clipboardTextAvailable()) return false;
          return writeClipboardText(
            visibleResult?.search_text.join('\n') ??
              textDocument.normalized_text,
          ).then(() => true);
        }
        return false;
      },
      commandState() {
        return mode === 'source'
          ? (editorRef.current?.commandState?.() ?? {
              undo: false,
              redo: false,
              wrapped: false,
            })
          : { undo: false, redo: false, wrapped: false };
      },
      dismissModal() {
        return (
          (mode === 'source' && editorRef.current?.dismissModal?.()) ||
          viewportRef.current?.dismissModal?.() ||
          false
        );
      },
      selectRange(from, to) {
        if (session.lifecycle !== 'active') return false;
        if (mode === 'source')
          return editorRef.current?.selectRange(from, to) ?? false;
        pendingSelection.current = { from, to };
        return changeMode('source');
      },
    }));

    const preview = visibleResult?.svg ? (
      <DiagramViewport
        ref={viewportRef}
        svg={visibleResult.svg}
        label={visibleResult.accessibility.label}
        description={visibleResult.accessibility.description}
        initialState={viewport}
        onChange={(next) => {
          setViewport(next);
          publish({ viewport: next });
        }}
      />
    ) : null;

    return (
      <div
        className={`mermaid-surface mermaid-${mode}-mode`}
        ref={previewHostRef}
        data-performance-ready={
          visibleResult?.status === 'ready' ? 'true' : 'pending'
        }
        data-performance-revision={visibleResult?.source_revision ?? ''}
        data-performance-duration={
          visibleResult?.measurements.total_duration_ms ?? ''
        }
      >
        <span className="visually-hidden" role="status" aria-live="polite">
          {status === 'scheduled'
            ? 'Rendering diagram'
            : stale
              ? 'Preview is from an earlier source revision'
              : status === 'ready'
                ? 'Preview current'
                : status === 'idle'
                  ? 'Preparing preview'
                  : (result?.diagnostic?.message ?? status)}
        </span>
        <TaskSurface
          open={searchOpen && mode === 'rendered'}
          onOpenChange={(open) => {
            if (!open) closeSearch();
          }}
          title="Find in diagram"
          opener={previewHostRef.current?.querySelector<HTMLElement>(
            '.diagram-canvas',
          )}
          className="mermaid-search-task document-tools"
        >
          <div className="mermaid-search" role="search">
            <label>
              Find diagram text{' '}
              <input
                data-task-initial-focus
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <span
              role="status"
              aria-label="Diagram search results"
              aria-live="polite"
            >
              {query
                ? matches.length
                  ? matchIndex +
                    1 +
                    ' of ' +
                    matches.length +
                    ' matching labels'
                  : 'No matches'
                : 'Enter search text'}
            </span>
            {matches.length > 0 && (
              <p>
                Matching diagram label:{' '}
                <mark ref={searchResultRef}>{matches[matchIndex]}</mark>
              </p>
            )}
            <button
              type="button"
              disabled={!matches.length}
              onClick={() => moveMatch(-1)}
            >
              Previous match
            </button>
            <button
              type="button"
              disabled={!matches.length}
              onClick={() => moveMatch(1)}
            >
              Next match
            </button>
            <button type="button" onClick={closeSearch}>
              Close search
            </button>
          </div>
        </TaskSurface>
        {(mode === 'source' || sourceVisited) && (
          <div className="mermaid-source-layout" hidden={mode !== 'source'}>
            <div className="mermaid-source-editor">
              <TextEditorSurface
                ref={editorRef}
                session={session}
                onDocumentChange={onDocumentChange}
                onLanguageChange={onLanguageChange}
                onCommandStateChange={(next) => {
                  if (mode === 'source') commandCallback.current?.(next);
                }}
              />
            </div>
            {mode === 'source' && preview && (
              <div
                className="mermaid-stale-preview"
                aria-label={stale ? 'Earlier valid preview' : 'Current preview'}
              >
                {preview}
              </div>
            )}
          </div>
        )}
        {mode !== 'source' && preview ? (
          preview
        ) : mode !== 'source' ? (
          <div className="mermaid-fallback" role="alert">
            <p>
              {eligible
                ? (result?.diagnostic?.message ?? 'Rendering diagram')
                : 'Diagram preview is unavailable above 1 MiB. Source remains available.'}
            </p>
            <button type="button" onClick={() => changeMode('source')}>
              View source
            </button>
          </div>
        ) : null}
      </div>
    );
  },
);

const mermaidMetadataFacts = (
  result: MermaidRenderResult,
  stale: boolean,
): MetadataObservation[] => [
  result.diagram_type
    ? {
        key: 'diagram.type',
        availability: 'available',
        value: { kind: 'text', value: result.diagram_type },
      }
    : { key: 'diagram.type', availability: 'not_provided' },
  {
    key: 'diagram.parser_version',
    availability: 'available',
    value: { kind: 'text', value: result.parser_version },
  },
  {
    key: 'diagram.sanitizer_version',
    availability: 'available',
    value: { kind: 'integer', value: String(result.sanitizer_version) },
  },
  {
    key: 'diagram.preview_revision',
    availability: 'available',
    value: { kind: 'integer', value: String(result.source_revision) },
  },
  {
    key: 'diagram.preview_stale',
    availability: 'available',
    value: { kind: 'boolean', value: stale },
  },
  {
    key: 'diagram.source_bytes',
    availability: 'available',
    value: { kind: 'integer', value: String(result.measurements.source_bytes) },
    unit: 'bytes',
  },
  {
    key: 'diagram.edge_count',
    availability: 'available',
    value: { kind: 'integer', value: String(result.measurements.edge_count) },
  },
  {
    key: 'diagram.output_bytes',
    availability: 'available',
    value: { kind: 'integer', value: String(result.measurements.output_bytes) },
    unit: 'bytes',
  },
  {
    key: 'diagram.parse_duration',
    availability: 'available',
    value: {
      kind: 'decimal',
      value: String(result.measurements.parse_duration_ms),
    },
    unit: 'ms',
  },
  {
    key: 'diagram.render_duration',
    availability: 'available',
    value: {
      kind: 'decimal',
      value: String(result.measurements.render_duration_ms),
    },
    unit: 'ms',
  },
  {
    key: 'diagram.total_duration',
    availability: 'available',
    value: {
      kind: 'decimal',
      value: String(result.measurements.total_duration_ms),
    },
    unit: 'ms',
  },
  result.limit
    ? {
        key: 'diagram.active_limit',
        availability: 'available',
        value: { kind: 'text', value: result.limit.replaceAll('_', ' ') },
      }
    : { key: 'diagram.active_limit', availability: 'not_provided' },
  {
    key: 'diagram.accessible_title',
    availability: 'available',
    value: {
      kind: 'text',
      value: result.accessibility.authored_title ? 'Authored' : 'Fallback',
    },
  },
  {
    key: 'diagram.accessible_description',
    availability: 'available',
    value: {
      kind: 'text',
      value: result.accessibility.authored_description ? 'Authored' : 'Absent',
    },
  },
];
