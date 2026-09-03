import { forwardRef } from 'react';

import type { LanguageDecision, ShellSession, TextDocumentState } from '../domain/contracts';
import { TextEditorSurface, type TextEditorHandle } from './TextEditorSurface';
import { LargeTextSurface } from './LargeTextSurface';

interface DocumentSurfaceProps {
  session: ShellSession | null;
  onDocumentChange: (
    id: string,
    expectedRevision: number,
    document: TextDocumentState,
    revision: number,
  ) => void;
  onLanguageChange: (id: string, expectedRevision: number, language: LanguageDecision) => void;
}

export const DocumentSurface = forwardRef<TextEditorHandle, DocumentSurfaceProps>(function DocumentSurface(
  { session, onDocumentChange, onLanguageChange },
  ref,
) {
  if (!session) {
    return (
      <section
        className="document-surface empty-surface"
        aria-label="Document surface"
      >
        <p>No document is open</p>
      </section>
    );
  }

  return (
    <section
      className="document-surface"
      id={`panel-${session.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${session.id}`}
      tabIndex={0}
    >
      <header className="document-heading">
        <span>
          {session.renderer.label}
          {session.text_document &&
            ` · ${session.text_document.language.language.replaceAll('_', ' ')} · ${session.text_document.profile.encoding.replaceAll('_', ' ')} · ${session.text_document.profile.newline_pattern}`}
        </span>
        {session.dirty && <span className="dirty-label">Unsaved changes</span>}
      </header>
      {session.text_document ? (
        session.text_document.mode === 'refused' ? (
          <p className="document-limit" role="alert">This text source exceeds the 256 MiB viewing limit. Use a streaming log viewer or command-line pager for this file.</p>
        ) : session.text_document.mode === 'large_read_only' ? (
          <LargeTextSurface session={session} />
        ) : (
          <TextEditorSurface ref={ref} session={session} onDocumentChange={onDocumentChange} onLanguageChange={onLanguageChange} />
        )
      ) : (
        <pre className="document-content">{session.content}</pre>
      )}
    </section>
  );
});
