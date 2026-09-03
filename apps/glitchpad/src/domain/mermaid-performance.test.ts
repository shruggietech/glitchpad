import { describe, expect, it } from 'vitest';

import { MERMAID_SANITIZER_VERSION, MERMAID_STANDALONE_MAX_BYTES, mermaidSourceBytes } from './mermaid-contract';
import { renderMermaid } from './mermaid-pipeline';

describe('Mermaid performance and boundaries', () => {
  it('renders a representative diagram inside the cooperative budget', async () => {
    const started = performance.now();
    const result = await renderMermaid({
      request_id: 'performance',
      owner_id: 'performance',
      source_revision: 1,
      source_text: `flowchart TB\n${Array.from({ length: 100 }, (_, index) => `N${index} --> N${index + 1}`).join('\n')}`,
      fallback_label: 'Performance diagram',
      theme: 'light',
      sanitizer_version: MERMAID_SANITIZER_VERSION,
    });
    expect(result.status).toBe('ready');
    expect(performance.now() - started).toBeLessThan(5_000);
  });

  it('defines the 1 MiB boundary in UTF-8 bytes', () => {
    expect(mermaidSourceBytes('x'.repeat(MERMAID_STANDALONE_MAX_BYTES))).toBe(MERMAID_STANDALONE_MAX_BYTES);
    expect(mermaidSourceBytes('x'.repeat(MERMAID_STANDALONE_MAX_BYTES + 1))).toBe(MERMAID_STANDALONE_MAX_BYTES + 1);
  });
});
