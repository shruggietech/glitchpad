import { describe, expect, it } from 'vitest';

import {
  EDITABLE_TEXT_MAX_BYTES,
  LARGE_TEXT_MAX_BYTES,
  applyTextTransaction,
  createTextDocument,
  decideTextMode,
  normalizeNewlines,
  rawOffsetAtNormalized,
  serializeTextDocument,
} from './text-document';

describe('text document round trips', () => {
  it('preserves mixed newlines and terminal newline when editing one span', () => {
    const document = createTextDocument({
      rawText: 'alpha\r\nbeta\ngamma\r',
      displayName: 'notes.txt',
      encoding: 'utf8',
    });

    const result = applyTextTransaction(document, 1, 1, [
      { from: 6, to: 10, insert: 'BETA' },
    ]);

    expect(result).toMatchObject({ ok: true, revision: 2 });
    if (!result.ok) return;
    expect(result.document.raw_text).toBe('alpha\r\nBETA\ngamma\r');
    expect(result.document.normalized_text).toBe('alpha\nBETA\ngamma\n');
    expect(result.document.profile.newline_counts).toEqual({
      crlf: 1,
      lf: 1,
      cr: 1,
    });
    expect(result.document.profile.terminal_newline).toBe(true);
  });

  it('uses the dominant existing newline for inserted line breaks', () => {
    const document = createTextDocument({
      rawText: 'a\r\nb\r\nc\n',
      displayName: 'notes.txt',
    });
    const result = applyTextTransaction(document, 8, 8, [
      { from: 1, to: 1, insert: '\ninserted' },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.document.raw_text).toBe('a\r\ninserted\r\nb\r\nc\n');
  });

  it('uses LF for a document with no existing line ending', () => {
    const document = createTextDocument({
      rawText: 'plain',
      displayName: 'notes.txt',
    });
    const result = applyTextTransaction(document, 1, 1, [
      { from: 5, to: 5, insert: '\nnext' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.raw_text).toBe('plain\nnext');
  });

  it('maps normalized offsets across CRLF boundaries', () => {
    expect(rawOffsetAtNormalized('a\r\nb\rc\n', 0)).toBe(0);
    expect(rawOffsetAtNormalized('a\r\nb\rc\n', 2)).toBe(3);
    expect(rawOffsetAtNormalized('a\r\nb\rc\n', 4)).toBe(5);
    expect(normalizeNewlines('a\r\nb\rc\n')).toBe('a\nb\nc\n');
  });

  it('applies multiple original-coordinate changes atomically', () => {
    const document = createTextDocument({
      rawText: 'one\r\ntwo\nthree',
      displayName: 'notes.txt',
    });
    const result = applyTextTransaction(document, 1, 1, [
      { from: 0, to: 3, insert: 'ONE' },
      { from: 8, to: 13, insert: 'THREE' },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.raw_text).toBe('ONE\r\ntwo\nTHREE');
  });

  it('reprofiles when an edit creates a CRLF across its boundaries', () => {
    const document = createTextDocument({
      rawText: 'a\rX\nb',
      displayName: 'notes.txt',
    });
    const result = applyTextTransaction(document, 1, 1, [
      { from: 2, to: 3, insert: '' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.raw_text).toBe('a\r\nb');
      expect(result.document.normalized_text).toBe('a\nb');
      expect(result.document.profile.newline_counts).toEqual({
        crlf: 1,
        lf: 0,
        cr: 0,
      });
    }
  });

  it('rejects stale, overlapping, invalid, and read-only changes', () => {
    const document = createTextDocument({
      rawText: 'abcdef',
      displayName: 'notes.txt',
    });
    expect(applyTextTransaction(document, 2, 1, [])).toEqual({
      ok: false,
      reason: 'stale_revision',
    });
    expect(
      applyTextTransaction(document, 2, 2, [
        { from: 0, to: 3, insert: '' },
        { from: 2, to: 4, insert: '' },
      ]),
    ).toEqual({ ok: false, reason: 'invalid_change' });
    expect(
      applyTextTransaction({ ...document, mode: 'large_read_only' }, 2, 2, [
        { from: 0, to: 0, insert: 'x' },
      ]),
    ).toEqual({ ok: false, reason: 'read_only' });
  });

  it.each([
    ['utf8', new Uint8Array([0x68, 0xc3, 0xa9])],
    ['utf8_bom', new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0xc3, 0xa9])],
    ['utf16_le_bom', new Uint8Array([0xff, 0xfe, 0x68, 0x00, 0xe9, 0x00])],
    ['utf16_be_bom', new Uint8Array([0xfe, 0xff, 0x00, 0x68, 0x00, 0xe9])],
  ] as const)(
    'serializes %s with the expected BOM and bytes',
    (encoding, prefix) => {
      const document = createTextDocument({
        rawText: 'hé',
        displayName: 'notes.txt',
        encoding,
      });
      const result = serializeTextDocument(document, 4, 4);
      expect(result.ok).toBe(true);
      if (result.ok)
        expect([...result.payload.bytes.slice(0, prefix.length)]).toEqual([
          ...prefix,
        ]);
    },
  );

  it('requires an exact current lossy authorization', () => {
    const document = createTextDocument({
      rawText: 'replacement \uFFFD',
      displayName: 'legacy.txt',
      encoding: 'unknown',
      undecodableBytes: 'requires_user_decision',
    });
    expect(serializeTextDocument(document, 7, 6)).toEqual({
      ok: false,
      reason: 'stale_revision',
    });
    expect(serializeTextDocument(document, 7, 7)).toEqual({
      ok: false,
      reason: 'lossy_decision_required',
    });
    expect(serializeTextDocument(document, 7, 7, true)).toEqual({
      ok: false,
      reason: 'unsupported_encoding',
    });
  });
});

describe('text mode boundaries', () => {
  it('selects modes at exact source thresholds', () => {
    expect(decideTextMode(EDITABLE_TEXT_MAX_BYTES)).toBe('editable');
    expect(decideTextMode(EDITABLE_TEXT_MAX_BYTES + 1)).toBe('large_read_only');
    expect(decideTextMode(LARGE_TEXT_MAX_BYTES)).toBe('large_read_only');
    expect(decideTextMode(LARGE_TEXT_MAX_BYTES + 1)).toBe('refused');
    expect(decideTextMode(Number.NaN)).toBe('refused');
  });
});

describe('generated transaction sequences', () => {
  it('keeps raw and normalized state coherent across 1,000 edits', () => {
    let document = createTextDocument({
      rawText: 'seed\r\n',
      displayName: 'state.txt',
    });
    let revision = 1;
    for (let index = 0; index < 1_000; index += 1) {
      const position = index % (document.normalized_text.length + 1);
      const result = applyTextTransaction(document, revision, revision, [
        { from: position, to: position, insert: index % 7 === 0 ? '\n' : 'x' },
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      document = result.document;
      revision = result.revision;
      expect(normalizeNewlines(document.raw_text)).toBe(
        document.normalized_text,
      );
    }
    expect(revision).toBe(1_001);
  });
});
