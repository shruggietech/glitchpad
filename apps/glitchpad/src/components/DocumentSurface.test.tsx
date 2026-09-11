import { fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { initialSessions } from '../test/fixtures';
import { DocumentSurface } from './DocumentSurface';

vi.mock('./MarkdownSurface', () => ({
  MarkdownSurface: forwardRef<unknown, { projectionSuppressed?: boolean; recoveryAttempt?: number; session: { id: string } }>(
    function ThrowingMarkdownSurface({ projectionSuppressed, recoveryAttempt = 0, session }, ref) {
      void ref;
      if (!projectionSuppressed && (recoveryAttempt === 0 || session.id === 'repeat-failure'))
        throw new Error('deterministic projection failure');
      return <div>{projectionSuppressed ? 'Recovered source without projection' : 'Fresh rendered preview'}</div>;
    },
  ),
}));

describe('Document surface recovery', () => {
  it('keeps projection suppressed in source recovery and starts a fresh explicit retry', () => {
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
      fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }));

      expect(screen.getByText('Fresh rendered preview')).toBeInTheDocument();
      expect(screen.queryByText('Recovered source without projection')).not.toBeInTheDocument();
      expect(onMarkdownChange).toHaveBeenLastCalledWith(
        initialSessions[3].id,
        initialSessions[3].revision,
        expect.objectContaining({ mode: 'rendered', render_status: 'scheduled' }),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('retains source recovery independently for multiple document revisions', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onMarkdownChange = vi.fn();
    const commonProps = {
      onDocumentChange: vi.fn(),
      onLanguageChange: vi.fn(),
      onMarkdownChange,
    };
    const first = { ...initialSessions[3], id: 'recovery-a', lifecycle: 'active' as const };
    const second = { ...initialSessions[3], id: 'recovery-b', lifecycle: 'active' as const };
    try {
      const view = render(<DocumentSurface session={first} {...commonProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'View source' }));
      expect(screen.getByText('Recovered source without projection')).toBeInTheDocument();

      view.rerender(<DocumentSurface session={second} {...commonProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'View source' }));
      expect(screen.getByText('Recovered source without projection')).toBeInTheDocument();

      view.rerender(<DocumentSurface session={first} {...commonProps} />);
      expect(screen.getByText('Recovered source without projection')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry preview' })).toBeEnabled();

      view.rerender(<DocumentSurface session={second} {...commonProps} />);
      expect(screen.getByText('Recovered source without projection')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry preview' })).toBeEnabled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('returns repeated retry failures to contained feedback with source still available', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      render(
        <DocumentSurface
          session={{ ...initialSessions[3], id: 'repeat-failure', lifecycle: 'active' }}
          onDocumentChange={vi.fn()}
          onLanguageChange={vi.fn()}
          onMarkdownChange={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'View source' }));
      fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }));

      expect(screen.getByRole('alert')).toHaveTextContent('This document could not be displayed');
      expect(screen.getByRole('button', { name: 'View source' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Retry preview' })).toBeEnabled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
