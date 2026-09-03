import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { MermaidRendererClient } from '../domain/mermaid-adapter';
import { MERMAID_SANITIZER_VERSION, MERMAID_VERSION, type EmbeddedMermaidBlock, type MermaidRenderResult } from '../domain/mermaid-contract';
import { EmbeddedMermaidSurface } from './EmbeddedMermaidSurface';

const block = (limit: EmbeddedMermaidBlock['limit'] = null): EmbeddedMermaidBlock => ({
  owner_id: 'document:mermaid:1',
  ordinal: 1,
  parent_revision: 1,
  source: 'flowchart TB\nA --> B',
  source_bytes: 20,
  source_range: null,
  limit,
});

const readyResult: MermaidRenderResult = {
  request_id: 'request',
  owner_id: 'document:mermaid:1',
  source_revision: 1,
  status: 'ready',
  diagram_type: 'flowchart',
  svg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
  search_text: ['A', 'B'],
  diagnostic: null,
  accessibility: { title: null, description: null, label: 'Diagram', authored_title: false, authored_description: false },
  measurements: { source_bytes: 20, edge_count: 1, output_bytes: 46, parse_duration_ms: 1, render_duration_ms: 1, total_duration_ms: 2 },
  limit: null,
  sanitizer_version: MERMAID_SANITIZER_VERSION,
  parser_version: MERMAID_VERSION,
};

describe('EmbeddedMermaidSurface', () => {
  it('cancels and clears a ready result when the block becomes limited', async () => {
    const cancel = vi.fn();
    const client = {
      render: vi.fn(() => Promise.resolve(readyResult)),
      cancel,
    } as unknown as MermaidRendererClient;
    const { rerender } = render(<EmbeddedMermaidSurface block={block()} documentName="document.md" onViewSource={() => undefined} rendererClient={client} />);
    expect(await screen.findByRole('img', { name: 'Diagram' })).toBeInTheDocument();
    rerender(<EmbeddedMermaidSurface block={block('source_bytes')} documentName="document.md" onViewSource={() => undefined} rendererClient={client} />);
    await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('source bytes limit');
    expect(cancel).toHaveBeenCalled();
  });
});
