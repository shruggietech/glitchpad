import { useEffect, useRef, useState } from 'react';

import type { DiagnosticBundle } from '../domain/persistence';
import type { DiagnosticExportGateway } from '../domain/persistence-gateway';

interface DiagnosticsPanelProps {
  load: () => Promise<DiagnosticBundle>;
  exporter: DiagnosticExportGateway;
  onReset: () => Promise<void>;
  onClose: () => void;
}

export function DiagnosticsPanel({ load, exporter, onReset, onClose }: DiagnosticsPanelProps) {
  const [bundle, setBundle] = useState<DiagnosticBundle | null>(null);
  const [status, setStatus] = useState('Loading redacted diagnostics');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    let active = true;
    void load().then((value) => {
      if (active) { setBundle(value); setStatus('Redacted diagnostic preview ready'); }
    }).catch(() => { if (active) setStatus('Diagnostic preview is unavailable'); });
    return () => { active = false; };
  }, [load]);
  return (
    <aside className="application-sheet" aria-label="Diagnostics" onKeyDown={(event) => {
      if (event.key === 'Escape') onClose();
    }}>
      <header className="application-sheet-header">
        <div><h2>Diagnostics</h2><p>Preview the exact redacted bundle before export.</p></div>
        <button ref={closeRef} type="button" onClick={onClose}>Close diagnostics</button>
      </header>
      <p role="status">{status}</p>
      {bundle && <pre className="diagnostic-preview">{JSON.stringify(bundle, null, 2)}</pre>}
      <div className="application-sheet-actions">
        <button type="button" disabled={!bundle} onClick={() => bundle && void exporter.export(bundle)}>Export previewed bundle</button>
        <button type="button" onClick={() => void onReset().then(() => { setBundle((current) => current ? { ...current, events: [] } : current); setStatus('Stored diagnostics cleared'); })}>Clear diagnostics</button>
      </div>
    </aside>
  );
}
