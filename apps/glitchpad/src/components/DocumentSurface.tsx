import type { ShellSession } from '../domain/contracts';

interface DocumentSurfaceProps {
  session: ShellSession | null;
}

export function DocumentSurface({ session }: DocumentSurfaceProps) {
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
        <span>{session.renderer.label}</span>
        {session.dirty && <span className="dirty-label">Unsaved changes</span>}
      </header>
      <pre className="document-content">{session.content}</pre>
    </section>
  );
}
