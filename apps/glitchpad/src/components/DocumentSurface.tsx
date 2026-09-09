import { forwardRef } from 'react';

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

  const presentation = session.text_document ? (
    session.text_document.mode === 'refused' ? (
      <p className="document-limit" role="alert">This text source exceeds the 256 MiB viewing limit. Use a streaming log viewer or command-line pager for this file.</p>
    ) : session.text_document.mode === 'large_read_only' ? (
      <LargeTextSurface session={session} />
    ) : session.renderer.id === 'markdown' ? (
      <MarkdownSurface key={session.id} ref={ref} session={session} onDocumentChange={onDocumentChange} onLanguageChange={onLanguageChange} onMarkdownChange={onMarkdownChange} externalLinkGateway={externalLinkGateway} localAssetGateway={localAssetGateway} onOpenMetadata={onOpenMetadata} onMetadataContribution={onMetadataContribution} />
    ) : session.renderer.id === 'mermaid' ? (
      <MermaidSurface key={session.id} ref={ref} session={session} onDocumentChange={onDocumentChange} onLanguageChange={onLanguageChange} onMermaidChange={onMermaidChange ?? (() => undefined)} onOpenMetadata={onOpenMetadata} onMetadataContribution={onMetadataContribution} />
    ) : (
      <TextEditorSurface ref={ref} session={session} onDocumentChange={onDocumentChange} onLanguageChange={onLanguageChange} />
    )
  ) : (
    <pre className="document-content">{session.content}</pre>
  );
  const resetKey = `${session.id}:${session.revision}:${session.renderer.id}:${session.markdown_document?.mode ?? ''}`;

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
                  onMarkdownChange(session.id, session.revision, {
                    mode: 'source',
                    eligibility: session.markdown_document?.eligibility ?? 'full',
                    render_revision: session.markdown_document?.render_revision ?? null,
                    render_status: 'failed',
                    printable: false,
                    outline_count: 0,
                    source_selection: session.markdown_document?.source_selection ?? null,
                  });
                  reset();
                }}
              >
                View source
              </button>
            )}
          </div>
        )}
      >
        {presentation}
      </DocumentErrorBoundary>
    </section>
  );
});
