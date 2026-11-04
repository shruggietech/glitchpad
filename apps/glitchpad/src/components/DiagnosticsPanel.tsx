import { useEffect, useRef, useState } from 'react';
import type { DiagnosticBundle } from '../domain/persistence';
import type { DiagnosticExportGateway } from '../domain/persistence-gateway';
interface DiagnosticsPanelProps {
  load: () => Promise<DiagnosticBundle>;
  exporter: DiagnosticExportGateway;
  onReset: () => Promise<void>;
  onClose: () => void;
}
const freeze = (value: DiagnosticBundle): DiagnosticBundle => {
  const copy = JSON.parse(JSON.stringify(value)) as DiagnosticBundle;
  const deep = (item: unknown): void => {
    if (item && typeof item === 'object') {
      Object.values(item).forEach(deep);
      Object.freeze(item);
    }
  };
  deep(copy);
  return copy;
};
export function DiagnosticsPanel({
  load,
  exporter,
  onReset,
  onClose,
}: DiagnosticsPanelProps) {
  const [bundle, setBundle] = useState<DiagnosticBundle | null>(null);
  const [status, setStatus] = useState('Loading redacted diagnostics');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    let active = true;
    void load()
      .then((value) => {
        if (active) {
          setBundle(freeze(value));
          setStatus('Redacted diagnostic preview ready');
        }
      })
      .catch(() => {
        if (active) setStatus('Diagnostic preview is unavailable');
      });
    return () => {
      active = false;
    };
  }, [load]);
  const run = async (kind: 'save' | 'share' | 'clear') => {
    if (busy.current || !bundle) return;
    busy.current = true;
    setPending(true);
    setStatus(
      kind === 'clear'
        ? 'Clearing stored diagnostics…'
        : kind === 'share'
          ? 'Opening system Share…'
          : 'Saving the previewed bundle…',
    );
    try {
      if (kind === 'clear') {
        await onReset();
        setBundle(freeze({ ...bundle, events: [] }));
        setStatus('Stored diagnostics cleared');
      } else {
        const result = await (kind === 'share'
          ? exporter.share!(bundle)
          : exporter.export(bundle));
        setStatus(
          result?.status === 'saved'
            ? 'Diagnostic bundle saved and verified.'
            : result?.status === 'cancelled'
              ? 'Cancelled. The preview is retained.'
              : result?.status === 'handed_off'
                ? 'Shared with the system. Recipient delivery is unconfirmed.'
                : 'Download requested. A saved file has not been verified.',
        );
      }
    } catch {
      setStatus(
        kind === 'clear'
          ? 'Clear failed. Existing events and preview are retained.'
          : 'Export failed. The exact preview is retained; choose a destination and try again.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <aside
      className="application-sheet"
      aria-label="Diagnostics"
      aria-busy={pending}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pending) onClose();
      }}
    >
      <header className="application-sheet-header">
        <div>
          <h2>Diagnostics</h2>
          <p>Preview the exact redacted bundle before export.</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          disabled={pending}
          onClick={onClose}
        >
          Close diagnostics
        </button>
      </header>
      <p role="status">{status}</p>
      {bundle && (
        <pre className="diagnostic-preview">
          {JSON.stringify(bundle, null, 2)}
        </pre>
      )}
      <div className="application-sheet-actions">
        <button
          type="button"
          disabled={!bundle || pending}
          onClick={() => void run('save')}
        >
          {exporter.share ? 'Save previewed bundle' : 'Export previewed bundle'}
        </button>
        {exporter.share && (
          <button
            type="button"
            disabled={!bundle || pending}
            onClick={() => void run('share')}
          >
            Share previewed bundle
          </button>
        )}
        <button
          type="button"
          disabled={!bundle || pending}
          onClick={() => void run('clear')}
        >
          Clear diagnostics
        </button>
      </div>
    </aside>
  );
}
