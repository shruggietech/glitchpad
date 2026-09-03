import type { SourceId } from './contracts';
import {
  LARGE_TEXT_READ_BYTES,
  type LargeTextGateway,
} from './large-text-gateway';

export const LARGE_TEXT_WINDOW_BYTES = 512 * 1024;
export const LARGE_TEXT_COPY_BYTES = 1024 * 1024;
export const LARGE_TEXT_MATCH_LIMIT = 10_000;

export interface LargeTextWindow {
  offset: number;
  text: string;
  byte_count: number;
  end_of_source: boolean;
}

export class LargeTextReader {
  private operation = 0;

  constructor(
    private readonly gateway: LargeTextGateway,
    private readonly sourceId: SourceId,
  ) {}

  cancel(): void {
    this.operation += 1;
  }

  async window(
    offset: number,
    requested = LARGE_TEXT_WINDOW_BYTES,
  ): Promise<LargeTextWindow> {
    const operation = ++this.operation;
    const budget = Math.min(Math.max(0, requested), LARGE_TEXT_WINDOW_BYTES);
    const chunks: Uint8Array[] = [];
    let cursor = offset;
    let remaining = budget;
    let end = false;
    while (remaining > 0 && !end) {
      const length = Math.min(remaining, LARGE_TEXT_READ_BYTES);
      const result = await this.gateway.read(this.sourceId, cursor, length);
      if (operation !== this.operation)
        throw new DOMException('Operation cancelled', 'AbortError');
      chunks.push(result.bytes);
      cursor += result.bytes.byteLength;
      remaining -= result.bytes.byteLength;
      end = result.end_of_source || result.bytes.byteLength === 0;
    }
    const bytes = concatenate(chunks);
    const decoded = decodeCompletePrefix(bytes, end);
    return {
      offset,
      text: decoded.text,
      byte_count: decoded.bytes,
      end_of_source: end,
    };
  }

  async search(query: string, byteLength: number): Promise<number[]> {
    if (!query) return [];
    const operation = ++this.operation;
    const needle = new TextEncoder().encode(query);
    const matches: number[] = [];
    let offset = 0;
    let carry = new Uint8Array();
    while (offset < byteLength && matches.length < LARGE_TEXT_MATCH_LIMIT) {
      const result = await this.gateway.read(
        this.sourceId,
        offset,
        Math.min(LARGE_TEXT_READ_BYTES, byteLength - offset),
      );
      if (operation !== this.operation)
        throw new DOMException('Operation cancelled', 'AbortError');
      const haystack = concatenate([carry, result.bytes]);
      const base = offset - carry.byteLength;
      for (
        let index = 0;
        index <= haystack.byteLength - needle.byteLength;
        index += 1
      ) {
        if (
          needle.every(
            (byte, needleIndex) => haystack[index + needleIndex] === byte,
          )
        )
          matches.push(base + index);
        if (matches.length === LARGE_TEXT_MATCH_LIMIT) break;
      }
      carry = haystack.slice(
        Math.max(0, haystack.byteLength - Math.max(0, needle.byteLength - 1)),
      );
      offset += result.bytes.byteLength;
      if (result.end_of_source || result.bytes.byteLength === 0) break;
      await Promise.resolve();
    }
    return [...new Set(matches)];
  }

  async lineOffset(
    targetLine: number,
    byteLength: number,
  ): Promise<number | null> {
    if (!Number.isSafeInteger(targetLine) || targetLine < 1) return null;
    if (targetLine === 1) return 0;
    const operation = ++this.operation;
    let line = 1;
    let offset = 0;
    let pendingCr = false;
    while (offset < byteLength) {
      const result = await this.gateway.read(
        this.sourceId,
        offset,
        Math.min(LARGE_TEXT_READ_BYTES, byteLength - offset),
      );
      if (operation !== this.operation)
        throw new DOMException('Operation cancelled', 'AbortError');
      for (let index = 0; index < result.bytes.byteLength; index += 1) {
        const byte = result.bytes[index];
        const absolute = offset + index;
        if (pendingCr) {
          line += 1;
          if (line === targetLine)
            return byte === 0x0a ? absolute + 1 : absolute;
          pendingCr = false;
          if (byte === 0x0a) continue;
        }
        if (byte === 0x0d) pendingCr = true;
        else if (byte === 0x0a) {
          line += 1;
          if (line === targetLine) return absolute + 1;
        }
      }
      offset += result.bytes.byteLength;
      if (result.end_of_source || result.bytes.byteLength === 0) break;
      await Promise.resolve();
    }
    if (pendingCr && line + 1 === targetLine) return offset;
    return null;
  }
}

const concatenate = (chunks: readonly Uint8Array[]): Uint8Array => {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
};

const decodeCompletePrefix = (
  bytes: Uint8Array,
  endOfSource: boolean,
): { text: string; bytes: number } => {
  for (let trailing = 0; trailing <= (endOfSource ? 0 : 3); trailing += 1) {
    try {
      const length = bytes.byteLength - trailing;
      const decoder = new TextDecoder('utf-8', { fatal: true });
      return { text: decoder.decode(bytes.slice(0, length)), bytes: length };
    } catch {
      continue;
    }
  }
  throw new TypeError(
    'Large-text window is not valid UTF-8 at its current boundary',
  );
};
