import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createNativeLargeTextGateway, LARGE_TEXT_READ_BYTES, MemoryLargeTextGateway } from './large-text-gateway';
import {
  LARGE_TEXT_MATCH_LIMIT,
  LARGE_TEXT_WINDOW_BYTES,
  LargeTextReader,
} from './large-text';

const { rangeInvoke } = vi.hoisted(() => ({ rangeInvoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: rangeInvoke }));
beforeEach(() => rangeInvoke.mockReset());

describe('bounded large-text reads', () => {
  it('caps a visible window and preserves multibyte decoding across chunks', async () => {
    const bytes = new TextEncoder().encode(
      `${'a'.repeat(256 * 1024 - 1)}é${'b'.repeat(300 * 1024)}`,
    );
    const gateway = new MemoryLargeTextGateway('source', bytes);
    const window = await new LargeTextReader(gateway, 'source').window(
      0,
      Number.MAX_SAFE_INTEGER,
    );
    expect(window.byte_count).toBe(LARGE_TEXT_WINDOW_BYTES);
    expect(window.text).toContain('é');
    expect(gateway.requests.every(({ length }) => length <= 256 * 1024)).toBe(
      true,
    );
  });

  it('finds a match spanning a range boundary without duplicates', async () => {
    const bytes = new TextEncoder().encode(
      `${'x'.repeat(256 * 1024 - 2)}needle`,
    );
    const reader = new LargeTextReader(
      new MemoryLargeTextGateway('source', bytes),
      'source',
    );
    await expect(reader.search('needle', bytes.byteLength)).resolves.toEqual([
      256 * 1024 - 2,
    ]);
  });

  it('bounds retained search results', async () => {
    const bytes = new TextEncoder().encode(
      'x'.repeat(LARGE_TEXT_MATCH_LIMIT + 50),
    );
    const matches = await new LargeTextReader(
      new MemoryLargeTextGateway('source', bytes),
      'source',
    ).search('x', bytes.byteLength);
    expect(matches).toHaveLength(LARGE_TEXT_MATCH_LIMIT);
  });

  it('navigates LF, CRLF, and CR line boundaries', async () => {
    const bytes = new TextEncoder().encode('one\r\ntwo\nthree\rfour');
    const reader = new LargeTextReader(
      new MemoryLargeTextGateway('source', bytes),
      'source',
    );
    await expect(reader.lineOffset(1, bytes.byteLength)).resolves.toBe(0);
    await expect(reader.lineOffset(2, bytes.byteLength)).resolves.toBe(5);
    await expect(reader.lineOffset(3, bytes.byteLength)).resolves.toBe(9);
    await expect(reader.lineOffset(4, bytes.byteLength)).resolves.toBe(15);
    await expect(reader.lineOffset(5, bytes.byteLength)).resolves.toBeNull();
  });

  it.each([
    ['utf16_le_bom', true],
    ['utf16_be_bom', false],
  ] as const)(
    'decodes, searches, and navigates %s sources with aligned offsets',
    async (encoding, littleEndian) => {
      const text = 'alpha\r\nbéta\ngamma';
      const bytes = encodeUtf16(text, littleEndian);
      const reader = new LargeTextReader(
        new MemoryLargeTextGateway('source', bytes),
        'source',
        encoding,
      );

      await expect(reader.window(1)).resolves.toMatchObject({
        offset: 0,
        text,
      });
      await expect(reader.search('béta', bytes.byteLength)).resolves.toEqual([
        16,
      ]);
      await expect(reader.lineOffset(2, bytes.byteLength)).resolves.toBe(16);
      await expect(reader.lineOffset(3, bytes.byteLength)).resolves.toBe(26);
    },
  );
});

const encodeUtf16 = (text: string, littleEndian: boolean): Uint8Array => {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes.set(littleEndian ? [0xff, 0xfe] : [0xfe, 0xff]);
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    bytes[2 + index * 2] = littleEndian ? unit & 0xff : unit >> 8;
    bytes[3 + index * 2] = littleEndian ? unit >> 8 : unit & 0xff;
  }
  return bytes;
};

describe('native range transport', () => {
  it('requests bounded binary Android ranges and preserves exact Unicode bytes', async () => {
    const bytes = new TextEncoder().encode('S047 Ω🙂\n');
    const frame = new Uint8Array(bytes.length + 1);
    frame[0] = 1;
    frame.set(bytes, 1);
    rangeInvoke.mockResolvedValue(frame.buffer);
    const result = await createNativeLargeTextGateway(true).read('source', 17, LARGE_TEXT_READ_BYTES);
    expect(result).toEqual({ source_id: 'source', offset: 17, bytes, end_of_source: true });
    expect(rangeInvoke).toHaveBeenCalledExactlyOnceWith('read_android_range', { sourceId: 'source', offset: 17, length: LARGE_TEXT_READ_BYTES, operationBudget: LARGE_TEXT_READ_BYTES, binary: true });
  });

  it('preserves every byte in full ranges, empty EOF, and the framework response fallback', async () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const frame = new Uint8Array(257);
    frame.set(bytes, 1);
    rangeInvoke.mockResolvedValueOnce(frame.buffer).mockResolvedValueOnce([1]).mockResolvedValueOnce([1, 0, 128, 255]);
    const gateway = createNativeLargeTextGateway(true);
    expect(await gateway.read('source', 0, 256)).toEqual({ source_id: 'source', offset: 0, bytes, end_of_source: false });
    expect(await gateway.read('source', 256, 256)).toEqual({ source_id: 'source', offset: 256, bytes: new Uint8Array(), end_of_source: true });
    expect((await gateway.read('source', 7, 3)).bytes).toEqual(new Uint8Array([0, 128, 255]));
  });

  it.each([
    new Uint8Array().buffer,
    new Uint8Array([2]).buffer,
    new Uint8Array([0, 1]).buffer,
    new Uint8Array([1, 0, 0, 0, 0]).buffer,
    [1, -1], [1, 256], [1, 1.5], [1, Number.NaN],
    { bytes: [0, 1, 2] }, null,
  ])('rejects a malformed or oversized raw range without retrying: %j', async (reply) => {
    rangeInvoke.mockResolvedValue(reply);
    await expect(createNativeLargeTextGateway(true).read('source', 0, 3)).rejects.toBeInstanceOf(RangeError);
    expect(rangeInvoke).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing request budget and ignores late replies after cancellation', async () => {
    const gateway = createNativeLargeTextGateway(true);
    await expect(gateway.read('source', 0, LARGE_TEXT_READ_BYTES + 1)).rejects.toBeInstanceOf(RangeError);
    expect(rangeInvoke).not.toHaveBeenCalled();
    const aborted = new AbortController();
    aborted.abort();
    await expect(gateway.read('source', 0, 3, aborted.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(rangeInvoke).not.toHaveBeenCalled();
    let complete!: (value: ArrayBuffer) => void;
    rangeInvoke.mockReturnValue(new Promise<ArrayBuffer>((resolve) => { complete = resolve; }));
    const controller = new AbortController();
    const read = gateway.read('source', 0, 3, controller.signal);
    controller.abort();
    complete(new Uint8Array([1, 1, 2, 3]).buffer);
    await expect(read).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('preserves desktop JSON and rejects mismatched source, offset or byte bounds', async () => {
    const gateway = createNativeLargeTextGateway(false);
    const valid = { source_id: 'source', offset: 17, bytes: [0, 128, 255], end_of_source: true };
    rangeInvoke.mockResolvedValue(valid);
    expect(await gateway.read('source', 17, 3)).toEqual({ ...valid, bytes: new Uint8Array(valid.bytes) });
    expect(rangeInvoke).toHaveBeenLastCalledWith('read_source_range', { sourceId: 'source', offset: 17, length: 3, operationBudget: 3 });
    for (const reply of [{ ...valid, source_id: 'other' }, { ...valid, offset: 0 }, { ...valid, bytes: [0, 1, 2, 3] }, { ...valid, bytes: [256] }]) {
      rangeInvoke.mockResolvedValue(reply);
      await expect(gateway.read('source', 17, 3)).rejects.toBeInstanceOf(RangeError);
    }
  });
});
