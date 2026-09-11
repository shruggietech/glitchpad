import { forwardRef, useState } from 'react';

import type { LanguageDecision, MarkdownDocumentState, MermaidDocumentState, ShellSession, TextDocumentState } from '../domain/contracts';
import type { MarkdownExternalLinkGateway, MarkdownLocalAssetGateway } from '../domain/markdown-gateway';
import { MarkdownSurface } from './MarkdownSurface';
import { TextEditorSurface, type TextEditorHandle } from './TextEditorSurface';
import { LargeTextSurface } from './LargeTextSurface';
import { MermaidSurface } from './MermaidSurface';
import type { MetadataContribution } from '../domain/metadata';
import { DocumentErrorBoundary } from './DocumentErrorBoundary';

interface DocumentSurfaceProps {
  session: ShellSession | null;
  canOpen?: boolean;
  onOpen?: () => void;
  labelledByTab?: boolean;
  onDocumentChange: (
    id: string,
    expectedRevision: number,
    document: TextDocumentState,
    revision: number,
  ) => void;
  onLanguageChange: (id: string, expectedRevision: number, language: LanguageDecision) => void;
  onMarkdownChange: (id: string, expectedRevision: number, markdown: MarkdownDocumentState) => void;
  onMermaidChange?: (id: string, expectedRevision: number, mermaid: MermaidDocumentState) => void;
  externalLinkGateway?: MarkdownExternalLinkGateway;
  localAssetGateway?: MarkdownLocalAssetGateway;
  onOpenMetadata?: (opener: HTMLElement) => void;
  onMetadataContribution?: (contribution: MetadataContribution) => void;
}

export const DocumentSurface = forwardRef<TextEditorHandle, DocumentSurfaceProps>(function DocumentSurface(
  { session, canOpen = false, onOpen, labelledByTab = false, onDocumentChange, onLanguageChange, onMarkdownChange, onMermaidChange, externalLinkGateway, localAssetGateway, onOpenMetadata, onMetadataContribution },
  ref,
) {
  const [markdownRecoveries, setMarkdownRecoveries] = useState(() => new Map<string, {
    documentKey: string;
    attempt: number;
    sourceMode: boolean;
  }>());

  if (!session) {
    return (
      <section
        className="document-surface empty-surface"
        aria-label="Document surface"
      >
        <div className="empty-state">
          <p>No document is open</p>
          {canOpen && <button type="button" onClick={onOpen}>Open file…</button>}
        </div>
      </section>
    );
  }

  const currentDocumentKey = `${session.id}:${session.revision}`;
  const markdownRecovery = markdownRecoveries.get(session.id);
  const recoveryAttempt = markdownRecovery?.documentKey === currentDocumentKey
    ? markdownRecovery.attempt
    : 0;
  const projectionSuppressed = markdownRecovery?.documentKey === currentDocumentKey
    && markdownRecovery.sourceMode;
  const publishRecoveryMode = (mode: 'rendered' | 'source') => {
    onMarkdownChange(session.id, session.revision, {
      mode,
      eligibility: session.markdown_document?.eligibility ?? 'full',
      render_revision: mode === 'source'
        ? (session.markdown_document?.render_revision ?? null)
        : null,
      render_status: mode === 'source' ? 'failed' : 'scheduled',
      printable: false,
      outline_count: 0,
      source_selection: session.markdown_document?.source_selection ?? null,
    });
  };
  const enterRecoverySource = (reset?: () => void) => {
    setMarkdownRecoveries((current) => {
      const next = new Map(current);
      next.set(session.id, { documentKey: currentDocumentKey, attempt: recoveryAttempt, sourceMode: true });
      return next;
    });
    publishRecoveryMode('source');
    reset?.();
  };
  const retryMarkdownPreview = (reset?: () => void) => {
    setMarkdownRecoveries((current) => {
      const next = new Map(current);
      next.set(session.id, { documentKey: currentDocumentKey, attempt: recoveryAttempt + 1, sourceMode: false });
      return next;
    });
    publishRecoveryMode('rendered');
    reset?.();
  };

  const presentation = session.text_document ? (
    session.text_document.mode === 'refused' ? (
      <p className="document-limit" role="alert">This text source exceeds the 256 MiB viewing limit. Use a streaming log viewer or command-line pager for this file.</p>
    ) : session.text_document.mode === 'large_read_only' ? (
      <LargeTextSurface session={session} />
    ) : session.renderer.id === 'markdown' ? (
      <div className="markdown-recovery-layout">
        {projectionSuppressed && (
          <div className="markdown-recovery-banner" role="status">
            <p>Rendered preview is paused after a contained failure. Source remains available.</p>
            <button type="button" onClick={() => retryMarkdownPreview()}>Retry preview</button>
          </div>
        )}
        <MarkdownSurface key={`${session.id}:${recoveryAttempt}`} ref={ref} session={session} projectionSuppressed={projectionSuppressed} recoveryAttempt={recoveryAttempt} onEnterRecoverySource={() => enterRecoverySource()} onDocumentChange={onDocumentChange} onLanguageChange={onLanguageChange} onMarkdownChange={onMarkdownChange} externalLinkGateway={externalLinkGateway} localAssetGateway={localAssetGateway} onOpenMetadata={onOpenMetadata} onMetadataContribution={onMetadataContribution} />
      </div>
    ) : session.renderer.id === 'mermaid' ? (
      <MermaidSurface key={session.id} ref={ref} session={session} onDocumentChange={onDocumentChange} onLanguageChange={onLanguageChange} onMermaidChange={onMermaidChange ?? (() => undefined)} onOpenMetadata={onOpenMetadata} onMetadataContribution={onMetadataContribution} />
    ) : (
      <TextEditorSurface ref={ref} session={session} onDocumentChange={onDocumentChange} onLanguageChange={onLanguageChange} />
    )
  ) : (
    <pre className="document-content">{session.content}</pre>
  );
  const resetKey = `${session.id}:${session.revision}:${session.renderer.id}:${session.markdown_document?.mode ?? ''}:${recoveryAttempt}`;

  return (
    <section
      className="document-surface"
      data-performance-renderer={session.renderer.id}
      data-performance-revision={session.revision}
      id={`panel-${session.id}`}
      role={labelledByTab ? 'tabpanel' : 'region'}
      aria-labelledby={labelledByTab ? `tab-${session.id}` : undefined}
      aria-label={labelledByTab ? undefined : session.source.display_name}
      tabIndex={0}
    >
      <DocumentErrorBoundary
        resetKey={resetKey}
        fallback={({ reset }) => (
          <div className="document-render-failure">
            <p role="alert">This document could not be displayed. The application remains available.</p>
            {session.renderer.id === 'markdown' && session.text_document && (
              <button
                type="button"
                onClick={() => {
                  enterRecoverySource(reset);
                }}
              >
                View source
              </button>
            )}
            {session.renderer.id === 'markdown' && session.text_document && (
              <button type="button" onClick={() => retryMarkdownPreview(reset)}>Retry preview</button>
            )}
          </div>
        )}
      >
        {presentation}
      </DocumentErrorBoundary>
    </section>
  );
});
