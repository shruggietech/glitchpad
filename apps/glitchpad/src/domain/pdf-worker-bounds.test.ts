import { it, expect, vi } from 'vitest';
import { boundPdfReply, boundPdfTextSink } from './pdf-worker-bounds';
it('refuses oversized and cyclic inspected replies before the native postMessage boundary', () => {
  const valid = { Title: 'Title', Author: 'Author' };
  expect(boundPdfReply('metadata', [valid, null, false])).toEqual([
    valid,
    null,
    false,
  ]);
  expect(() =>
    boundPdfReply('metadata', [{ Title: 'x'.repeat(32769) }, null, false]),
  ).toThrow('PDF inspection limit');
  const shared = { name: 'XYZ' };
  expect(
    boundPdfReply('outline', [
      {
        title: 'A',
        dest: [0, shared],
        color: new Uint8ClampedArray([0, 0, 0]),
        items: [],
      },
      { title: 'B', dest: [1, shared], items: [] },
    ]),
  ).toHaveLength(2);
  const cycle: unknown[] = [];
  const parent = { title: 'Cycle', items: cycle };
  cycle.push(parent);
  expect(() => boundPdfReply('outline', cycle)).toThrow();
  expect(() => boundPdfReply('labels', ['x'.repeat(129)])).toThrow();
  expect(() =>
    boundPdfReply('annotations', [{ content: new Uint8Array(1048577) }]),
  ).toThrow();
});
it('keeps text streams cancellable and bounds the entire page across chunks', () => {
  const target = {
    value: 2,
    enqueue: vi.fn(),
    cancel() {
      this.value = 0;
    },
    get ready(): number {
      return this.value;
    },
  };
  const sink = boundPdfTextSink(target);
  expect(sink.ready).toBe(2);
  sink.enqueue({ items: [{ str: 'x'.repeat(500000) }], styles: {} });
  sink.enqueue({ items: [{ str: 'y'.repeat(500000) }], styles: {} });
  expect(() => {
    sink.enqueue({ items: [{ str: 'z' }], styles: {} });
  }).toThrow('PDF text limit');
  expect(target.enqueue).toHaveBeenCalledTimes(2);
  sink.cancel();
  expect(target.value).toBe(0);
});
