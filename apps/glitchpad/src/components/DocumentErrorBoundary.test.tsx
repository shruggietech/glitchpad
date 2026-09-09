import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DocumentErrorBoundary } from './DocumentErrorBoundary';

function BrokenDocument({ broken }: { broken: boolean }) {
  if (broken) throw new Error('private document detail');
  return <p>Recovered document</p>;
}

function RecoveryHarness() {
  const [broken, setBroken] = useState(true);
  return (
    <main>
      <button type="button">Menu</button>
      <DocumentErrorBoundary
        resetKey="first:1:markdown:rendered"
        fallback={({ reset }) => (
          <button type="button" onClick={() => { setBroken(false); reset(); }}>Retry</button>
        )}
      >
        <BrokenDocument broken={broken} />
      </DocumentErrorBoundary>
    </main>
  );
}

describe('DocumentErrorBoundary', () => {
  it('contains a document render failure and exposes bounded recovery', () => {
    const onError = vi.fn();
    render(
      <DocumentErrorBoundary
        resetKey="first:1:markdown:rendered"
        onError={onError}
        fallback={({ reset }) => (
          <div>
            <p role="alert">This document could not be displayed.</p>
            <button type="button" onClick={reset}>View source</button>
          </div>
        )}
      >
        <BrokenDocument broken />
      </DocumentErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('could not be displayed');
    expect(screen.getByRole('button', { name: 'View source' })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('private document detail');
    expect(onError).toHaveBeenCalledOnce();
  });

  it('resets containment when the document presentation identity changes', () => {
    const { rerender } = render(
      <DocumentErrorBoundary resetKey="first:1:markdown:rendered" fallback={() => <p role="alert">Contained failure</p>}>
        <BrokenDocument broken />
      </DocumentErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(
      <DocumentErrorBoundary resetKey="second:1:markdown:rendered" fallback={() => <p role="alert">Contained failure</p>}>
        <BrokenDocument broken={false} />
      </DocumentErrorBoundary>,
    );

    expect(screen.getByText('Recovered document')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('allows an explicit retry without replacing the surrounding shell', () => {
    render(<RecoveryHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getByText('Recovered document')).toBeInTheDocument();
  });
});
