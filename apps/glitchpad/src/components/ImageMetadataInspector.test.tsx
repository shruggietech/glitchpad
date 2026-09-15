import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { makeSession } from '../test/fixtures';
import { createImageSession } from '../domain/image-contract';
import { MemoryClipboardGateway } from '../domain/metadata-gateway';
import { projectSessionMetadata } from '../domain/metadata';
import { MetadataInspector } from './MetadataInspector';

describe('image metadata inspector', () => {
  it('exposes safe original provenance, withholds location, and keeps copy accessible', async () => {
    const source = makeSession('one', 'photo.jpg', 'Text', '', {}).source;
    const session = createImageSession(source, 'opaque', { identity: source.identity, byte_length: 10, modified_unix_nanos: null, change_token: null }, 'jpeg', 'desktop');
    session.image_document!.metadata = { observations: [
      { key: 'image.camera_make', family: 'exif', tag: 'Make', block: 1, availability: 'available', value: { kind: 'text', value: 'Example camera' }, original: { kind: 'text', value: 'Example camera' }, duplicate: false },
      { key: 'image.location', family: 'xmp', tag: 'GPS', block: 2, availability: 'redacted', value: null, original: null, duplicate: false },
    ], statuses: ['exif_partial'], unknown_fields: 3, profile_present: false };
    const clipboard = new MemoryClipboardGateway();
    const { container } = render(<MetadataInspector session={session} snapshot={projectSessionMetadata(session)} onClose={vi.fn()} clipboardGateway={clipboard} />);
    expect(screen.getByText('3 unknown fields (values withheld).')).toBeInTheDocument();
    expect(screen.getByText(/Camera make: EXIF \/ Make/u)).toBeInTheDocument();
    expect(screen.getByText(/Original typed value/u)).toHaveTextContent('Example camera');
    expect(screen.queryByRole('button', { name: 'Copy Location' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy available information' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('copied'));
    expect(clipboard.value).not.toContain('Location');
    const result = await axe.run(container, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    expect(result.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
});
