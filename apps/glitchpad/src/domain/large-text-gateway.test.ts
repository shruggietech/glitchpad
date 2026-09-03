import { describe, expect, it } from 'vitest';

import { MemoryLargeTextGateway } from './large-text-gateway';
import { LARGE_TEXT_MATCH_LIMIT, LARGE_TEXT_WINDOW_BYTES, LargeTextReader } from './large-text';

describe('bounded large-text reads', () => {
  it('caps a visible window and preserves multibyte decoding across chunks', async () => {
    const bytes = new TextEncoder().encode(`${'a'.repeat(256 * 1024 - 1)}é${'b'.repeat(300 * 1024)}`);
    const gateway = new MemoryLargeTextGateway('source', bytes);
    const window = await new LargeTextReader(gateway, 'source').window(0, Number.MAX_SAFE_INTEGER);
    expect(window.byte_count).toBe(LARGE_TEXT_WINDOW_BYTES);
    expect(window.text).toContain('é');
    expect(gateway.requests.every(({ length }) => length <= 256 * 1024)).toBe(true);
  });

  it('finds a match spanning a range boundary without duplicates', async () => {
    const bytes = new TextEncoder().encode(`${'x'.repeat(256 * 1024 - 2)}needle`);
    const reader = new LargeTextReader(new MemoryLargeTextGateway('source', bytes), 'source');
    await expect(reader.search('needle', bytes.byteLength)).resolves.toEqual([256 * 1024 - 2]);
  });

  it('bounds retained search results', async () => {
    const bytes = new TextEncoder().encode('x'.repeat(LARGE_TEXT_MATCH_LIMIT + 50));
    const matches = await new LargeTextReader(new MemoryLargeTextGateway('source', bytes), 'source').search('x', bytes.byteLength);
    expect(matches).toHaveLength(LARGE_TEXT_MATCH_LIMIT);
  });

  it('navigates LF, CRLF, and CR line boundaries', async () => {
    const bytes = new TextEncoder().encode('one\r\ntwo\nthree\rfour');
    const reader = new LargeTextReader(new MemoryLargeTextGateway('source', bytes), 'source');
    await expect(reader.lineOffset(1, bytes.byteLength)).resolves.toBe(0);
    await expect(reader.lineOffset(2, bytes.byteLength)).resolves.toBe(5);
    await expect(reader.lineOffset(3, bytes.byteLength)).resolves.toBe(9);
    await expect(reader.lineOffset(4, bytes.byteLength)).resolves.toBe(15);
    await expect(reader.lineOffset(5, bytes.byteLength)).resolves.toBeNull();
  });
});
