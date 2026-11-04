import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import type { TextEditorHandle } from './TextEditorSurface';

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
  it('drops old content when a replacement document has no source authority', async () => {
    const { rerender } = render(<LargeTextSurface session={session} gateway={new MemoryLargeTextGateway('large-source', bytes)} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/read-only/i));
    expect(screen.getByText(/first line/)).toBeInTheDocument();
    rerender(<LargeTextSurface session={{ ...session, id: 'unavailable', source_id: null }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Large text source authority is unavailable');
    expect(screen.queryByText(/first line/)).not.toBeInTheDocument();
  });
  it('preserves the current window when a shared navigation read fails', async () => {
    const ref = createRef<TextEditorHandle>();
    const source = new MemoryLargeTextGateway('large-source', bytes);
    let denied = false;
    const gateway = { read: vi.fn((sourceId: string, offset: number, length: number) => denied ? Promise.reject(new Error('read denied')) : source.read(sourceId, offset, length)) };
    render(<LargeTextSurface ref={ref} session={session} gateway={gateway} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/read-only/i));
    denied = true;
    await act(async () => { await expect(ref.current!.invoke('next_page')).rejects.toThrow('read denied'); });
    expect(screen.getByRole('status')).toHaveTextContent('Large text window could not be decoded safely');
    expect(screen.getByText(/first line/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous window' })).toBeDisabled();
  });
  it('executes shared window navigation and exposes read/clipboard failures', async () => {
    const ref = createRef<TextEditorHandle>();
    render(<LargeTextSurface ref={ref} session={session} gateway={new MemoryLargeTextGateway('large-source', bytes)} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/read-only/i));
    expect(ref.current).not.toBeNull();
    await act(async () => { expect(await ref.current!.invoke('next_page')).toBe(true); });
    expect(screen.getByRole('status')).toHaveTextContent(/end of source/i);
    await act(async () => { expect(await ref.current!.invoke('next_page')).toBe(false); });
    await act(async () => { expect(await ref.current!.invoke('previous_page')).toBe(true); });
    expect(screen.getByText(/first line/)).toBeInTheDocument();
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(() => Promise.reject(new Error('clipboard denied'))) } });
    try { await act(async () => { await expect(ref.current!.invoke('copy')).rejects.toThrow('clipboard denied'); }); }
    finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
  });
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
