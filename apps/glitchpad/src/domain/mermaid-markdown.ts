import {
  MERMAID_BLOCK_MAX_BYTES,
  MERMAID_DOCUMENT_MAX_BLOCKS,
  MERMAID_DOCUMENT_MAX_BYTES,
  mermaidSourceBytes,
  type EmbeddedMermaidBlock,
} from './mermaid-contract';

export const extractMermaidBlocks = (
  source: string,
  parentId: string,
  parentRevision: number,
): EmbeddedMermaidBlock[] => {
  const opener = /^( {0,3})(`{3,}|~{3,})[\t ]*mermaid(?:[\t ]+[^\r\n]*)?[\t ]*(?:\r\n|\r|\n)/gimu;
  const blocks: EmbeddedMermaidBlock[] = [];
  let aggregateBytes = 0;
  let lineCursor = 0;
  let currentLine = 1;
  const lineAt = (offset: number): number => {
    while (lineCursor < offset) {
      const character = source.charCodeAt(lineCursor);
      lineCursor += 1;
      if (character === 13 && source.charCodeAt(lineCursor) === 10 && lineCursor < offset) lineCursor += 1;
      if (character === 10 || character === 13) currentLine += 1;
    }
    return currentLine;
  };
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
        start_line: lineAt(match.index),
        end_line: lineAt(closing.index),
      },
      limit,
    });
    opener.lastIndex = closing.index + closing[0].length;
  }
  return blocks;
};
