import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  noRendererCapabilities,
  noSourceCapabilities,
  type ShellSession,
} from '../domain/contracts';
import { MemoryLargeTextGateway } from '../domain/large-text-gateway';
import { LARGE_TEXT_WINDOW_BYTES } from '../domain/large-text';
import { createTextDocument } from '../domain/text-document';
import { LargeTextSurface } from './LargeTextSurface';

const bytes = new TextEncoder().encode(
  `${'first line\n'.repeat(30_000)}target\n${'tail\n'.repeat(50_000)}`,
);
const session: ShellSession = {
  id: 'large',
  source: {
    identity: {
      authority: 'synthetic',
      scope: 'tests',
      token: 'large',
      strength: 'strong',
    },
    display_name: 'large.log',
    claimed_media_type: 'text/plain',
    byte_length: bytes.byteLength,
    modified_unix_ms: null,
    kind: 'memory',
    capabilities: { ...noSourceCapabilities(), read: true, seek: true },
  },
  renderer: {
    id: 'text',
    label: 'Text',
    capabilities: {
      ...noRendererCapabilities(),
      view: true,
      search: true,
      copy: true,
      navigate: true,
    },
  },
  lifecycle: 'active',
  dirty: false,
  revision: 1,
  content: '',
  source_id: 'large-source',
  text_document: createTextDocument({
    rawText: '',
    displayName: 'large.log',
    sourceBytes: 33 * 1024 * 1024,
  }),
};

describe('LargeTextSurface', () => {
  it('loads bounded source-backed content and offers read-only search and navigation', async () => {
    const gateway = new MemoryLargeTextGateway('large-source', bytes);
    render(<LargeTextSurface session={session} gateway={gateway} />);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        /read-only|end of source/i,
      ),
    );
    expect(screen.getByText(/first line/)).toBeInTheDocument();
    expect(gateway.requests.every(({ length }) => length <= 256 * 1024)).toBe(
      true,
    );
    fireEvent.change(screen.getByLabelText('Find'), {
      target: { value: 'target' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Find next' }));
    await waitFor(() => expect(screen.getByText(/target/)).toBeInTheDocument());
    expect(
      screen.queryByRole('textbox', { name: /text editor/i }),
    ).not.toBeInTheDocument();
  });

  it('returns from a partial final window to the actual preceding window', async () => {
    const gateway = new MemoryLargeTextGateway('large-source', bytes);
    const { container } = render(
      <LargeTextSurface session={session} gateway={gateway} />,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next window' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/end of source/i),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous window' }));
    await waitFor(() =>
      expect(
        container.querySelector('.large-text-content')?.textContent,
      ).toMatch(/^first line/),
    );
  });

  it('advances across large-source matches and wraps after the final match', async () => {
    const repeatedBytes = new TextEncoder().encode(
      `target${'x'.repeat(LARGE_TEXT_WINDOW_BYTES)}target`,
    );
    const repeatedSession: ShellSession = {
      ...session,
      source: { ...session.source, byte_length: repeatedBytes.byteLength },
    };
    render(
      <LargeTextSurface
        session={repeatedSession}
        gateway={new MemoryLargeTextGateway('large-source', repeatedBytes)}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/read-only/i),
    );
    fireEvent.change(screen.getByLabelText('Find'), {
      target: { value: 'target' },
    });
    const find = screen.getByRole('button', { name: 'Find next' });
    fireEvent.click(find);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Match 1 of 2'),
    );
    fireEvent.click(find);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Match 2 of 2'),
    );
    fireEvent.click(find);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Match 1 of 2'),
    );
  });
});
