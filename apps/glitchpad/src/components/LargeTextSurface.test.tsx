import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { noRendererCapabilities, noSourceCapabilities, type ShellSession } from '../domain/contracts';
import { MemoryLargeTextGateway } from '../domain/large-text-gateway';
import { createTextDocument } from '../domain/text-document';
import { LargeTextSurface } from './LargeTextSurface';

const bytes = new TextEncoder().encode(`${'first line\n'.repeat(30_000)}target\n${'tail\n'.repeat(50_000)}`);
const session: ShellSession = {
  id: 'large',
  source: { identity: { authority: 'synthetic', scope: 'tests', token: 'large', strength: 'strong' }, display_name: 'large.log', claimed_media_type: 'text/plain', byte_length: bytes.byteLength, modified_unix_ms: null, kind: 'memory', capabilities: { ...noSourceCapabilities(), read: true, seek: true } },
  renderer: { id: 'text', label: 'Text', capabilities: { ...noRendererCapabilities(), view: true, search: true, copy: true, navigate: true } },
  lifecycle: 'active', dirty: false, revision: 1, content: '', source_id: 'large-source',
  text_document: createTextDocument({ rawText: '', displayName: 'large.log', sourceBytes: 33 * 1024 * 1024 }),
};

describe('LargeTextSurface', () => {
  it('loads bounded source-backed content and offers read-only search and navigation', async () => {
    const gateway = new MemoryLargeTextGateway('large-source', bytes);
    render(<LargeTextSurface session={session} gateway={gateway} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/read-only|end of source/i));
    expect(screen.getByText(/first line/)).toBeInTheDocument();
    expect(gateway.requests.every(({ length }) => length <= 256 * 1024)).toBe(true);
    fireEvent.change(screen.getByLabelText('Find'), { target: { value: 'target' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find next' }));
    await waitFor(() => expect(screen.getByText(/target/)).toBeInTheDocument());
    expect(screen.queryByRole('textbox', { name: /text editor/i })).not.toBeInTheDocument();
  });
});
