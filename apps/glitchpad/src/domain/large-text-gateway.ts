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
  read(
    sourceId: SourceId,
    offset: number,
    length: number,
    signal?: AbortSignal,
  ): Promise<RangeReadResult>;
}

export const createNativeLargeTextGateway = (
  android = /android/i.test(navigator.userAgent),
): LargeTextGateway => ({
  async read(sourceId, offset, length, signal) {
    if (signal?.aborted)
      throw new DOMException('Operation cancelled', 'AbortError');
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > LARGE_TEXT_READ_BYTES
    )
      throw new RangeError(
        'Large-text range is outside the bounded read contract',
      );
    const request = { sourceId, offset, length, operationBudget: length };
    if (android) {
      const reply = await invoke<ArrayBuffer | number[]>('read_android_range', {
        ...request,
        binary: true,
      });
      if (signal?.aborted)
        throw new DOMException('Operation cancelled', 'AbortError');
      let frame: Uint8Array;
      if (reply instanceof ArrayBuffer && reply.byteLength <= length + 1)
        frame = new Uint8Array(reply);
      else if (
        Array.isArray(reply) &&
        reply.length <= length + 1 &&
        reply.every(
          (byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255,
        )
      )
        frame = Uint8Array.from(reply);
      else
        throw new RangeError(
          'Android range reply is outside the bounded transport',
        );
      if (
        !frame.length ||
        frame[0] > 1 ||
        (frame[0] === 0 && frame.length - 1 !== length)
      )
        throw new RangeError(
          'Android range reply has an invalid terminal header',
        );
      return {
        source_id: sourceId,
        offset,
        bytes: frame.subarray(1),
        end_of_source: frame[0] === 1,
      };
    }
    const result = await invoke<
      Omit<RangeReadResult, 'bytes'> & { bytes: number[] }
    >('read_source_range', request);
    if (signal?.aborted)
      throw new DOMException('Operation cancelled', 'AbortError');
    if (
      result.source_id !== sourceId ||
      result.offset !== offset ||
      !Array.isArray(result.bytes) ||
      result.bytes.length > length ||
      !result.bytes.every(
        (byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255,
      )
    )
      throw new RangeError('Source range reply does not match its request');
    return { ...result, bytes: Uint8Array.from(result.bytes) };
  },
});

export class MemoryLargeTextGateway implements LargeTextGateway {
  readonly requests: Array<{ offset: number; length: number }> = [];

  constructor(
    private readonly sourceId: SourceId,
    private readonly bytes: Uint8Array,
  ) {}

  read(
    sourceId: SourceId,
    offset: number,
    length: number,
    signal?: AbortSignal,
  ): Promise<RangeReadResult> {
    if (signal?.aborted)
      throw new DOMException('Operation cancelled', 'AbortError');
    if (sourceId !== this.sourceId) throw new Error('Unknown source');
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > LARGE_TEXT_READ_BYTES
    )
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
