import { describe, expect, it } from 'vitest';

import { MERMAID_BLOCK_MAX_BYTES, MERMAID_DOCUMENT_MAX_BLOCKS, MERMAID_DOCUMENT_MAX_BYTES } from './mermaid-contract';
import { extractMermaidBlocks } from './mermaid-markdown';

describe('embedded Mermaid extraction', () => {
  it('records exact ranges and stable owner identities', () => {
    const source = '# Before\n\n```mermaid\nflowchart TB\nA-->B\n```\n\nAfter';
    const [block] = extractMermaidBlocks(source, 'doc', 7);
    expect(block).toMatchObject({ owner_id: 'doc:mermaid:1', ordinal: 1, parent_revision: 7, source: 'flowchart TB\nA-->B', limit: null });
    expect(source.slice(block.source_range!.start_offset, block.source_range!.end_offset)).toContain('```mermaid');
  });

  it('recognizes tilde fences and ignores other languages', () => {
    const source = '~~~ Mermaid\nflowchart LR\nA-->B\n~~~\n```ts\nconst x=1\n```';
    expect(extractMermaidBlocks(source, 'doc', 1)).toHaveLength(1);
  });

  it('marks per-block and document block-count boundaries independently', () => {
    const huge = `\`\`\`mermaid\nflowchart TB\n${'x'.repeat(MERMAID_BLOCK_MAX_BYTES)}\n\`\`\``;
    expect(extractMermaidBlocks(huge, 'doc', 1)[0]?.limit).toBe('source_bytes');
    const many = Array.from({ length: MERMAID_DOCUMENT_MAX_BLOCKS + 1 }, () => '```mermaid\nflowchart TB\nA-->B\n```').join('\n');
    const blocks = extractMermaidBlocks(many, 'doc', 1);
    expect(blocks).toHaveLength(65);
    expect(blocks[63]?.limit).toBeNull();
    expect(blocks[64]?.limit).toBe('block_count');
  });

  it('enforces the aggregate byte boundary without invalidating earlier blocks', () => {
    const block = (size: number) => `\`\`\`mermaid\n${'x'.repeat(size)}\n\`\`\``;
    const atLimitSource = Array.from({ length: MERMAID_DOCUMENT_MAX_BYTES / MERMAID_BLOCK_MAX_BYTES }, () => block(MERMAID_BLOCK_MAX_BYTES)).join('\n');
    const atLimit = extractMermaidBlocks(atLimitSource, 'doc', 1);
    expect(atLimit.every(({ limit }) => limit === null)).toBe(true);
    const overLimit = extractMermaidBlocks(`${atLimitSource}\n${block(1)}`, 'doc', 1);
    expect(overLimit.at(-1)?.limit).toBe('document_bytes');
  });
});
