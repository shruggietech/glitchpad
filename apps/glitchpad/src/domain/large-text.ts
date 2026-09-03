import type { SourceId, TextEncoding } from './contracts';
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
    private readonly encoding: TextEncoding = 'utf8',
  ) {}

  cancel(): void {
    this.operation += 1;
  }

  async window(
    offset: number,
    requested = LARGE_TEXT_WINDOW_BYTES,
  ): Promise<LargeTextWindow> {
    const operation = ++this.operation;
    const alignedOffset = alignOffset(offset, this.encoding);
    const budget = Math.min(Math.max(0, requested), LARGE_TEXT_WINDOW_BYTES);
    const chunks: Uint8Array[] = [];
    let cursor = alignedOffset;
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
    const decoded = decodeCompletePrefix(bytes, end, this.encoding);
    return {
      offset: alignedOffset,
      text: decoded.text,
      byte_count: decoded.bytes,
      end_of_source: end,
    };
  }

  async search(query: string, byteLength: number): Promise<number[]> {
    if (!query) return [];
    const operation = ++this.operation;
    const needle = encodeQuery(query, this.encoding);
    const step = isUtf16(this.encoding) ? 2 : 1;
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
        index += step
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
        Math.max(
          0,
          haystack.byteLength - Math.max(0, needle.byteLength - step),
        ),
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
    if (isUtf16(this.encoding))
      return this.utf16LineOffset(targetLine, byteLength);
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

  private async utf16LineOffset(
    targetLine: number,
    byteLength: number,
  ): Promise<number | null> {
    const operation = ++this.operation;
    const littleEndian = this.encoding === 'utf16_le_bom';
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
      for (let index = 0; index + 1 < result.bytes.byteLength; index += 2) {
        const absolute = offset + index;
        if (absolute === 0) continue;
        const unit = littleEndian
          ? result.bytes[index] | (result.bytes[index + 1] << 8)
          : (result.bytes[index] << 8) | result.bytes[index + 1];
        if (pendingCr) {
          line += 1;
          if (line === targetLine)
            return unit === 0x0a ? absolute + 2 : absolute;
          pendingCr = false;
          if (unit === 0x0a) continue;
        }
        if (unit === 0x0d) pendingCr = true;
        else if (unit === 0x0a) {
          line += 1;
          if (line === targetLine) return absolute + 2;
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
  encoding: TextEncoding,
): { text: string; bytes: number } => {
  for (let trailing = 0; trailing <= (endOfSource ? 0 : 3); trailing += 1) {
    try {
      const length = bytes.byteLength - trailing;
      if (length < 0 || (isUtf16(encoding) && length % 2 !== 0)) continue;
      const decoder = new TextDecoder(decoderLabel(encoding), { fatal: true });
      return { text: decoder.decode(bytes.slice(0, length)), bytes: length };
    } catch {
      continue;
    }
  }
  throw new TypeError(
    'Large-text window cannot be decoded safely at its current boundary',
  );
};

const isUtf16 = (encoding: TextEncoding): boolean =>
  encoding === 'utf16_le_bom' || encoding === 'utf16_be_bom';

const alignOffset = (offset: number, encoding: TextEncoding): number => {
  const safeOffset = Math.max(0, offset);
  return isUtf16(encoding) ? safeOffset - (safeOffset % 2) : safeOffset;
};

const decoderLabel = (encoding: TextEncoding): string =>
  encoding === 'utf16_le_bom'
    ? 'utf-16le'
    : encoding === 'utf16_be_bom'
      ? 'utf-16be'
      : 'utf-8';

const encodeQuery = (query: string, encoding: TextEncoding): Uint8Array => {
  if (!isUtf16(encoding)) return new TextEncoder().encode(query);
  const littleEndian = encoding === 'utf16_le_bom';
  const bytes = new Uint8Array(query.length * 2);
  for (let index = 0; index < query.length; index += 1) {
    const unit = query.charCodeAt(index);
    bytes[index * 2] = littleEndian ? unit & 0xff : unit >> 8;
    bytes[index * 2 + 1] = littleEndian ? unit >> 8 : unit & 0xff;
  }
  return bytes;
};
