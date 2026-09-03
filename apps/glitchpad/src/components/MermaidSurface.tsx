import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import { MermaidRendererClient } from '../domain/mermaid-adapter';
import { MERMAID_STANDALONE_MAX_BYTES, initialMermaidViewport, type MermaidRenderResult } from '../domain/mermaid-contract';
import type { LanguageDecision, MermaidDocumentState, ShellSession, TextDocumentState } from '../domain/contracts';
import { DiagramViewport, type DiagramViewportHandle } from './DiagramViewport';
import { TextEditorSurface, type TextEditorHandle } from './TextEditorSurface';
import { useMermaidTheme } from './useMermaidTheme';
import { rendererContribution, type MetadataContribution, type MetadataObservation } from '../domain/metadata';

interface MermaidSurfaceProps {
  session: ShellSession;
  onDocumentChange: (id: string, expectedRevision: number, document: TextDocumentState, revision: number) => void;
  onLanguageChange: (id: string, expectedRevision: number, language: LanguageDecision) => void;
  onMermaidChange: (id: string, expectedRevision: number, mermaid: MermaidDocumentState) => void;
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

export const MermaidSurface = forwardRef<TextEditorHandle, MermaidSurfaceProps>(function MermaidSurface(
  { session, onDocumentChange, onLanguageChange, onMermaidChange, rendererClient, onOpenMetadata, onMetadataContribution },
  handleRef,
) {
  const ownedClient = useRef<MermaidRendererClient | null>(null);
  if (!ownedClient.current) ownedClient.current = rendererClient ?? new MermaidRendererClient();
  const client = ownedClient.current;
  const editorRef = useRef<TextEditorHandle>(null);
  const viewportRef = useRef<DiagramViewportHandle>(null);
  const state = session.mermaid_document ?? initialState(session);
  const [mode, setMode] = useState(state.mode);
  const [result, setResult] = useState<MermaidRenderResult | null>(null);
  const [lastValid, setLastValid] = useState<MermaidRenderResult | null>(null);
  const [status, setStatus] = useState<MermaidDocumentState['render_status']>(state.render_status);
  const [stale, setStale] = useState(state.preview_stale);
  const [viewport, setViewport] = useState(state.viewport);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const theme = useMermaidTheme();
  const textDocument = session.text_document!;
  const eligible = textDocument.source_bytes <= MERMAID_STANDALONE_MAX_BYTES;
  const visibleResult = result?.status === 'ready' ? result : lastValid;
  const projectionRef = useRef({ mode, result, lastValid, status, stale, viewport });
  projectionRef.current = { mode, result, lastValid, status, stale, viewport };

  const publish = (next: Partial<MermaidDocumentState>) => {
    const current = projectionRef.current;
    onMermaidChange(session.id, session.revision, {
      mode: current.mode,
      render_revision: current.result?.source_revision ?? current.lastValid?.source_revision ?? null,
      render_status: current.status,
      preview_stale: current.stale,
      viewport: current.viewport,
      ...next,
    });
  };

  useEffect(() => {
    setMode(session.mermaid_document?.mode ?? initialState(session).mode);
    setViewport(session.mermaid_document?.viewport ?? initialMermaidViewport());
  }, [session.id, session.mermaid_document?.mode, session.mermaid_document?.viewport]);

  useEffect(() => {
    if (!eligible || session.lifecycle === 'background') {
      client.suspend();
      if (!eligible) {
        const previous = projectionRef.current.lastValid;
        const hasPrevious = previous !== null;
        setStatus('limited');
        setMode('source');
        setStale(hasPrevious);
        projectionRef.current = { ...projectionRef.current, mode: 'source', status: 'limited', stale: hasPrevious };
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
    void client.render({
      owner_id: session.id,
      source_revision: session.revision,
      source_text: textDocument.normalized_text,
      fallback_label: `${session.source.display_name} Mermaid diagram`,
      theme,
    }).then((next) => {
      if (!next) return;
      setResult(next);
      setStatus(next.status);
      projectionRef.current = { ...projectionRef.current, result: next, status: next.status };
      if (next.status === 'ready') {
        setLastValid(next);
        setStale(false);
        projectionRef.current = { ...projectionRef.current, lastValid: next, stale: false };
        publish({ render_revision: next.source_revision, render_status: 'ready', preview_stale: false });
      } else {
        const previous = projectionRef.current.lastValid;
        const hasPrevious = previous !== null;
        setStale(hasPrevious);
        if (!hasPrevious) setMode('source');
        projectionRef.current = { ...projectionRef.current, mode: hasPrevious ? projectionRef.current.mode : 'source', stale: hasPrevious };
        publish({ render_revision: previous?.source_revision ?? null });
      }
      onMetadataContribution?.(
        rendererContribution(session, mermaidMetadataFacts(next, projectionRef.current.stale), next.source_revision),
      );
    });
    return () => client.cancel();
  }, [client, eligible, session.id, session.lifecycle, session.revision, textDocument.normalized_text, theme]);

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? (visibleResult?.search_text.filter((text) => text.toLocaleLowerCase().includes(needle)) ?? []) : [];
  }, [query, visibleResult?.search_text]);

  const changeMode = (nextMode: 'rendered' | 'source') => {
    if (nextMode === 'rendered' && !visibleResult) return;
    setMode(nextMode);
    publish({ mode: nextMode });
  };

  useImperativeHandle(handleRef, () => ({
    invoke(command) {
      if (command === 'edit') {
        changeMode(mode === 'source' ? 'rendered' : 'source');
        return true;
      }
      if (mode === 'source' && (command === 'search' || command === 'close_search' || command === 'go_to_line')) {
        return editorRef.current?.invoke(command) ?? false;
      }
      if (command === 'search') {
        setSearchOpen(true);
        return true;
      }
      if (command === 'close_search') {
        setSearchOpen(false);
        return true;
      }
      if (command === 'zoom_in') {
        viewportRef.current?.zoomIn();
        return true;
      }
      if (command === 'zoom_out') {
        viewportRef.current?.zoomOut();
        return true;
      }
      if (command === 'metadata') {
        return false;
      }
      if (command === 'go_to_line') {
        changeMode('source');
        return true;
      }
      if (mode === 'source') return editorRef.current?.invoke(command) ?? false;
      if (command === 'copy') {
        void navigator.clipboard?.writeText(visibleResult?.search_text.join('\n') ?? textDocument.normalized_text);
        return true;
      }
      return false;
    },
    selectRange(from, to) {
      changeMode('source');
      return editorRef.current?.selectRange(from, to) ?? true;
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
    <div className={`mermaid-surface mermaid-${mode}-mode`}>
      <div className="mermaid-controls" aria-label="Mermaid controls">
        <button type="button" onClick={() => changeMode(mode === 'source' ? 'rendered' : 'source')} disabled={mode === 'source' && !visibleResult}>
          {mode === 'source' ? 'Preview' : session.renderer.capabilities.edit ? 'Edit source' : 'View source'}
        </button>
        <button type="button" onClick={() => setSearchOpen((open) => !open)}>Search</button>
        {session.renderer.capabilities.inspect_metadata && session.source.capabilities.metadata && (
          <button type="button" onClick={(event) => onOpenMetadata?.(event.currentTarget)}>File information</button>
        )}
        <span role="status" aria-live="polite">
          {status === 'scheduled' ? 'Rendering diagram' : stale ? 'Preview is from an earlier source revision' : status === 'ready' ? 'Preview current' : status === 'idle' ? 'Preparing preview' : result?.diagnostic?.message ?? status}
        </span>
      </div>
      {searchOpen && (
        <div className="mermaid-search" role="search">
          <label>Find diagram text <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <span aria-live="polite">{query ? `${matches.length} matches` : 'Enter search text'}</span>
          <button type="button" onClick={() => setSearchOpen(false)}>Close search</button>
        </div>
      )}
      {mode === 'source' ? (
        <div className="mermaid-source-layout">
          <div className="mermaid-source-editor"><TextEditorSurface ref={editorRef} session={session} onDocumentChange={onDocumentChange} onLanguageChange={onLanguageChange} /></div>
          {preview && <div className="mermaid-stale-preview" aria-label={stale ? 'Earlier valid preview' : 'Current preview'}>{preview}</div>}
        </div>
      ) : preview ? preview : (
        <div className="mermaid-fallback" role="alert">
          <p>{eligible ? result?.diagnostic?.message ?? 'Rendering diagram' : 'Diagram preview is unavailable above 1 MiB. Source remains available.'}</p>
          <button type="button" onClick={() => changeMode('source')}>View source</button>
        </div>
      )}
    </div>
  );
});

const mermaidMetadataFacts = (result: MermaidRenderResult, stale: boolean): MetadataObservation[] => [
  result.diagram_type ? { key: 'diagram.type', availability: 'available', value: { kind: 'text', value: result.diagram_type } } : { key: 'diagram.type', availability: 'not_provided' },
  { key: 'diagram.parser_version', availability: 'available', value: { kind: 'text', value: result.parser_version } },
  { key: 'diagram.sanitizer_version', availability: 'available', value: { kind: 'integer', value: String(result.sanitizer_version) } },
  { key: 'diagram.preview_revision', availability: 'available', value: { kind: 'integer', value: String(result.source_revision) } },
  { key: 'diagram.preview_stale', availability: 'available', value: { kind: 'boolean', value: stale } },
  { key: 'diagram.source_bytes', availability: 'available', value: { kind: 'integer', value: String(result.measurements.source_bytes) }, unit: 'bytes' },
  { key: 'diagram.edge_count', availability: 'available', value: { kind: 'integer', value: String(result.measurements.edge_count) } },
  { key: 'diagram.output_bytes', availability: 'available', value: { kind: 'integer', value: String(result.measurements.output_bytes) }, unit: 'bytes' },
  { key: 'diagram.parse_duration', availability: 'available', value: { kind: 'decimal', value: String(result.measurements.parse_duration_ms) }, unit: 'ms' },
  { key: 'diagram.render_duration', availability: 'available', value: { kind: 'decimal', value: String(result.measurements.render_duration_ms) }, unit: 'ms' },
  { key: 'diagram.total_duration', availability: 'available', value: { kind: 'decimal', value: String(result.measurements.total_duration_ms) }, unit: 'ms' },
  result.limit ? { key: 'diagram.active_limit', availability: 'available', value: { kind: 'text', value: result.limit.replaceAll('_', ' ') } } : { key: 'diagram.active_limit', availability: 'not_provided' },
  { key: 'diagram.accessible_title', availability: 'available', value: { kind: 'text', value: result.accessibility.authored_title ? 'Authored' : 'Fallback' } },
  { key: 'diagram.accessible_description', availability: 'available', value: { kind: 'text', value: result.accessibility.authored_description ? 'Authored' : 'Absent' } },
];
