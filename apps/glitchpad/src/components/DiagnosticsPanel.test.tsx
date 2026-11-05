import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { DiagnosticBundle } from '../domain/persistence';
import { DiagnosticsPanel } from './DiagnosticsPanel';

const bundle: DiagnosticBundle = {
  schema_version: 1,
  generated_unix_ms: 42,
  environment: {
    product_version: '0.0.0',
    specification_version: '0.0.0',
    platform: 'unknown',
    architecture: 'unknown',
    webview_version: null,
    core_version: '0.0.0',
    build_commit: null,
  },
  events: [],
};

describe('DiagnosticsPanel', () => {
  it('exports only after displaying the exact redacted preview', async () => {
    const exporter = { export: vi.fn().mockResolvedValue(undefined) };
    render(
      <DiagnosticsPanel
        load={() => Promise.resolve(bundle)}
        exporter={exporter}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      await screen.findByText(/"generated_unix_ms": 42/u),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Export previewed bundle' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Download requested',
      ),
    );
    expect(exporter.export).toHaveBeenCalledWith(bundle);
  });

  it('clears retained events only through explicit reset', async () => {
    const onReset = vi.fn().mockResolvedValue(undefined);
    render(
      <DiagnosticsPanel
        load={() => Promise.resolve(bundle)}
        exporter={{ export: vi.fn() }}
        onReset={onReset}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText(/preview ready/iu);
    fireEvent.click(screen.getByRole('button', { name: 'Clear diagnostics' }));
    await waitFor(() => expect(onReset).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toHaveTextContent(
      'Stored diagnostics cleared',
    );
  });
});

it('retains immutable preview and truthful outcome after cancellation or failed Clear', async () => {
  const exporter = {
    export: vi.fn().mockResolvedValue({ status: 'cancelled' }),
    share: vi.fn().mockResolvedValue({ status: 'handed_off' }),
  };
  render(
    <DiagnosticsPanel
      load={() => Promise.resolve(bundle)}
      exporter={exporter}
      onReset={() => Promise.reject(new Error('private'))}
      onClose={vi.fn()}
    />,
  );
  await screen.findByText(/preview ready/iu);
  fireEvent.click(
    screen.getByRole('button', { name: 'Save previewed bundle' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Cancelled. The preview is retained.',
    ),
  );
  expect(Object.isFrozen(exporter.export.mock.calls[0][0])).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Clear diagnostics' }));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Clear failed. Existing events and preview are retained.',
    ),
  );
  expect(screen.getByText(/"generated_unix_ms": 42/u)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Share previewed bundle' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'Recipient delivery is unconfirmed.',
    ),
  );
});

it('keeps the frozen export payload identical while live native viewport observations refresh', async () => {
  const viewport = vi.fn().mockResolvedValue(null);
  const exporter = {
    export: vi.fn().mockResolvedValue({ status: 'saved' }),
    viewport,
  };
  render(
    <DiagnosticsPanel
      load={() => Promise.resolve(bundle)}
      exporter={exporter}
      onReset={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  const preview = await screen.findByText(/"generated_unix_ms": 42/u);
  const exact = preview.textContent;
  await waitFor(() => expect(viewport).toHaveBeenCalledOnce());
  fireEvent(window, new Event('resize'));
  await waitFor(() => expect(viewport).toHaveBeenCalledTimes(2));
  expect(preview.textContent).toBe(exact);
  fireEvent.click(
    screen.getByRole('button', { name: 'Export previewed bundle' }),
  );
  await waitFor(() => expect(exporter.export).toHaveBeenCalledWith(bundle));
  expect(JSON.stringify(exporter.export.mock.calls[0])).not.toContain(
    'viewport',
  );
});
