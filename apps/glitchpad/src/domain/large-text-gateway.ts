import { invoke } from '@tauri-apps/api/core';

import type { SourceId } from './contracts';

export const LARGE_TEXT_READ_BYTES = 256 * 1024;

export interface RangeReadResult {
  source_id: SourceId;
  offset: number;
  bytes: Uint8Array;
  end_of_source: boolean;
}

export interface LargeTextGateway {
  read(sourceId: SourceId, offset: number, length: number, signal?: AbortSignal): Promise<RangeReadResult>;
}

export const createNativeLargeTextGateway = (android = /android/i.test(navigator.userAgent)): LargeTextGateway => ({
  async read(sourceId, offset, length, signal) {
    if (signal?.aborted) throw new DOMException('Operation cancelled', 'AbortError');
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 0 || length > LARGE_TEXT_READ_BYTES)
      throw new RangeError('Large-text range is outside the bounded read contract');
    const result = await invoke<Omit<RangeReadResult, 'bytes'> & { bytes: number[] }>(
      android ? 'read_android_range' : 'read_source_range',
      { sourceId, offset, length, operationBudget: length },
    );
    if (signal?.aborted) throw new DOMException('Operation cancelled', 'AbortError');
    return { ...result, bytes: Uint8Array.from(result.bytes) };
  },
});

export class MemoryLargeTextGateway implements LargeTextGateway {
  readonly requests: Array<{ offset: number; length: number }> = [];

  constructor(private readonly sourceId: SourceId, private readonly bytes: Uint8Array) {}

  read(sourceId: SourceId, offset: number, length: number, signal?: AbortSignal): Promise<RangeReadResult> {
    if (signal?.aborted) throw new DOMException('Operation cancelled', 'AbortError');
    if (sourceId !== this.sourceId) throw new Error('Unknown source');
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length < 0 || length > LARGE_TEXT_READ_BYTES)
      throw new RangeError('Oversized range');
    this.requests.push({ offset, length });
    const end = Math.min(offset + length, this.bytes.byteLength);
    return Promise.resolve({
      source_id: sourceId,
      offset,
      bytes: this.bytes.slice(offset, end),
      end_of_source: end >= this.bytes.byteLength,
    });
  }
}
