import {
  MERMAID_BLOCK_MAX_BYTES,
  MERMAID_DOCUMENT_MAX_BLOCKS,
  MERMAID_DOCUMENT_MAX_BYTES,
  mermaidSourceBytes,
  type EmbeddedMermaidBlock,
} from './mermaid-contract';

const lineAt = (source: string, offset: number): number =>
  source.slice(0, offset).split(/\r\n|\r|\n/u).length;

export const extractMermaidBlocks = (
  source: string,
  parentId: string,
  parentRevision: number,
): EmbeddedMermaidBlock[] => {
  const opener = /^( {0,3})(`{3,}|~{3,})[\t ]*mermaid(?:[\t ]+[^\r\n]*)?[\t ]*(?:\r\n|\r|\n)/gimu;
  const blocks: EmbeddedMermaidBlock[] = [];
  let aggregateBytes = 0;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    const fence = match[2] ?? '```';
    const close = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[\\t ]*(?:\\r\\n|\\r|\\n|$)`, 'gmu');
    close.lastIndex = opener.lastIndex;
    const closing = close.exec(source);
    if (!closing) continue;
    const contentStart = opener.lastIndex;
    const contentEnd = closing.index;
    const blockSource = source.slice(contentStart, contentEnd).replace(/(?:\r\n|\r|\n)$/u, '');
    const sourceBytes = mermaidSourceBytes(blockSource);
    aggregateBytes += sourceBytes;
    const ordinal = blocks.length + 1;
    const limit = ordinal > MERMAID_DOCUMENT_MAX_BLOCKS
      ? 'block_count'
      : sourceBytes > MERMAID_BLOCK_MAX_BYTES
        ? 'source_bytes'
        : aggregateBytes > MERMAID_DOCUMENT_MAX_BYTES
          ? 'document_bytes'
          : null;
    blocks.push({
      owner_id: `${parentId}:mermaid:${ordinal}`,
      ordinal,
      parent_revision: parentRevision,
      source: blockSource,
      source_bytes: sourceBytes,
      source_range: {
        start_offset: match.index,
        end_offset: closing.index + closing[0].length,
        start_line: lineAt(source, match.index),
        end_line: lineAt(source, closing.index),
      },
      limit,
    });
    opener.lastIndex = closing.index + closing[0].length;
  }
  return blocks;
};
