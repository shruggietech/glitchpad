import { fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { initialSessions } from '../test/fixtures';
import { DocumentSurface } from './DocumentSurface';

vi.mock('./MarkdownSurface', () => ({
  MarkdownSurface: forwardRef<unknown, { projectionSuppressed?: boolean }>(
    function ThrowingMarkdownSurface({ projectionSuppressed }, ref) {
      void ref;
      if (!projectionSuppressed)
        throw new Error('deterministic projection failure');
      return <div>Recovered source without projection</div>;
    },
  ),
}));

describe('Document surface recovery', () => {
  it('keeps a failed Markdown projection suppressed until the document revision changes', () => {
    const onMarkdownChange = vi.fn();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      render(
        <DocumentSurface
          session={{ ...initialSessions[3], lifecycle: 'active' }}
          onDocumentChange={vi.fn()}
          onLanguageChange={vi.fn()}
          onMarkdownChange={onMarkdownChange}
        />,
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'This document could not be displayed',
      );
      fireEvent.click(screen.getByRole('button', { name: 'View source' }));

      expect(
        screen.getByText('Recovered source without projection'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(onMarkdownChange).toHaveBeenCalledWith(
        initialSessions[3].id,
        initialSessions[3].revision,
        expect.objectContaining({ mode: 'source', printable: false }),
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
