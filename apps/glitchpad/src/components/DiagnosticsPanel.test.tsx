import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { DiagnosticBundle } from '../domain/persistence';
import { DiagnosticsPanel } from './DiagnosticsPanel';

const bundle: DiagnosticBundle = {
  schema_version: 1,
  generated_unix_ms: 42,
  environment: {
    product_version: '0.0.0', specification_version: '0.0.0', platform: 'unknown',
    architecture: 'unknown', webview_version: null, core_version: '0.0.0', build_commit: null,
  },
  events: [],
};

describe('DiagnosticsPanel', () => {
  it('exports only after displaying the exact redacted preview', async () => {
    const exporter = { export: vi.fn().mockResolvedValue(undefined) };
    render(<DiagnosticsPanel load={() => Promise.resolve(bundle)} exporter={exporter} onReset={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByText(/"generated_unix_ms": 42/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Export previewed bundle' }));
    expect(exporter.export).toHaveBeenCalledWith(bundle);
  });

  it('clears retained events only through explicit reset', async () => {
    const onReset = vi.fn().mockResolvedValue(undefined);
    render(<DiagnosticsPanel load={() => Promise.resolve(bundle)} exporter={{ export: vi.fn() }} onReset={onReset} onClose={vi.fn()} />);
    await screen.findByText(/preview ready/iu);
    fireEvent.click(screen.getByRole('button', { name: 'Clear diagnostics' }));
    await waitFor(() => expect(onReset).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toHaveTextContent('Stored diagnostics cleared');
  });
});
