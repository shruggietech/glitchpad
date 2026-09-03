import type {
  LanguageDecision,
  NewlineToken,
  TextDocumentState,
  TextEditorMode,
  TextEncoding,
  TextProfileState,
} from './contracts';

export const EDITABLE_TEXT_MAX_BYTES = 32 * 1024 * 1024;
export const LARGE_TEXT_MAX_BYTES = 256 * 1024 * 1024;
export const SYNTAX_LINE_MAX_BYTES = 2 * 1024 * 1024;

export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

export interface SerializedText {
  bytes: Uint8Array;
  revision: number;
  encoding: TextEncoding;
  byte_count: number;
}

export type TextTransactionResult =
  | { ok: true; document: TextDocumentState; revision: number }
  | { ok: false; reason: 'stale_revision' | 'read_only' | 'invalid_change' };

export type TextSerializationResult =
  | { ok: true; payload: SerializedText }
  | {
      ok: false;
      reason:
        'stale_revision' | 'lossy_decision_required' | 'unsupported_encoding';
    };

const encoder = new TextEncoder();

export const decideTextMode = (sourceBytes: number): TextEditorMode => {
  if (!Number.isSafeInteger(sourceBytes) || sourceBytes < 0) return 'refused';
  if (sourceBytes > LARGE_TEXT_MAX_BYTES) return 'refused';
  if (sourceBytes > EDITABLE_TEXT_MAX_BYTES) return 'large_read_only';
  return 'editable';
};

export const createTextDocument = (options: {
  rawText: string;
  displayName: string;
  encoding?: TextEncoding;
  sourceBytes?: number;
  undecodableBytes?: TextProfileState['undecodable_bytes'];
  language?: LanguageDecision;
}): TextDocumentState => {
  const encoding = options.encoding ?? 'utf8';
  const sourceBytes =
    options.sourceBytes ?? encodedLength(options.rawText, encoding);
  const profile = profileFor(
    options.rawText,
    encoding,
    options.undecodableBytes ?? 'none',
  );
  return {
    mode: decideTextMode(sourceBytes),
    normalized_text: normalizeNewlines(options.rawText),
    raw_text: options.rawText,
    profile,
    language: options.language ?? plainLanguageDecision(),
    source_bytes: sourceBytes,
    longest_line_bytes: longestLineBytes(options.rawText),
  };
};

export const applyTextTransaction = (
  document: TextDocumentState,
  currentRevision: number,
  expectedRevision: number,
  changes: readonly TextChange[],
): TextTransactionResult => {
  if (expectedRevision !== currentRevision)
    return { ok: false, reason: 'stale_revision' };
  if (document.mode !== 'editable') return { ok: false, reason: 'read_only' };
  if (!validChanges(changes, document.normalized_text.length))
    return { ok: false, reason: 'invalid_change' };
  if (changes.length === 0)
    return { ok: true, document, revision: currentRevision };

  let rawText = document.raw_text;
  let normalizedText = document.normalized_text;
  let sourceBytes = document.source_bytes;
  let longestLine = document.longest_line_bytes;
  let requiresFullProfile = false;
  const newlineCounts = { ...document.profile.newline_counts };
  for (const change of [...changes].sort(
    (left, right) => right.from - left.from,
  )) {
    const from = rawPositionAtNormalized(rawText, change.from);
    const to = rawPositionAtNormalized(rawText, change.to);
    const insertedNormalized = normalizeNewlines(change.insert);
    const inserted = useNewline(
      insertedNormalized,
      document.profile.insertion_newline,
    );
    const removed = rawText.slice(from, to);
    const prefixLast = rawText[from - 1];
    const suffixFirst = rawText[to];
    if (
      (prefixLast === '\r' && (inserted[0] ?? suffixFirst) === '\n') ||
      (inserted.endsWith('\r') && suffixFirst === '\n')
    )
      requiresFullProfile = true;
    adjustNewlineCounts(newlineCounts, collectNewlineCounts(removed), -1);
    adjustNewlineCounts(newlineCounts, collectNewlineCounts(inserted), 1);
    sourceBytes +=
      encodedContentLength(inserted, document.profile.encoding) -
      encodedContentLength(removed, document.profile.encoding);
    rawText = `${rawText.slice(0, from)}${inserted}${rawText.slice(to)}`;
    normalizedText = `${normalizedText.slice(0, change.from)}${insertedNormalized}${normalizedText.slice(change.to)}`;
    longestLine = Math.max(
      longestLine,
      affectedLineBytes(
        normalizedText,
        change.from,
        change.from + insertedNormalized.length,
      ),
    );
  }
  if (requiresFullProfile) {
    normalizedText = normalizeNewlines(rawText);
    sourceBytes = encodedLength(rawText, document.profile.encoding);
    longestLine = longestLineBytes(rawText);
  }
  const profile = requiresFullProfile
    ? profileFor(
        rawText,
        document.profile.encoding,
        document.profile.undecodable_bytes,
        document.profile.insertion_newline,
      )
    : profileFromCounts(
        newlineCounts,
        normalizedText.endsWith('\n'),
        document.profile,
      );
  const nextDocument: TextDocumentState = {
    ...document,
    normalized_text: normalizedText,
    raw_text: rawText,
    profile,
    source_bytes: sourceBytes,
    longest_line_bytes: longestLine,
  };
  return {
    ok: true,
    document: nextDocument,
    revision: currentRevision + 1,
  };
};

export const serializeTextDocument = (
  document: TextDocumentState,
  currentRevision: number,
  expectedRevision: number,
  allowLossy = false,
): TextSerializationResult => {
  if (expectedRevision !== currentRevision)
    return { ok: false, reason: 'stale_revision' };
  if (!document.profile.round_trip_safe && !allowLossy)
    return { ok: false, reason: 'lossy_decision_required' };
  const bytes = encode(document.raw_text, document.profile.encoding);
  if (!bytes) return { ok: false, reason: 'unsupported_encoding' };
  return {
    ok: true,
    payload: {
      bytes,
      revision: currentRevision,
      encoding: document.profile.encoding,
      byte_count: bytes.byteLength,
    },
  };
};

export const normalizeNewlines = (text: string): string =>
  text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');

export const rawOffsetAtNormalized = (
  rawText: string,
  normalizedOffset: number,
): number => rawPositionAtNormalized(rawText, normalizedOffset);

const rawPositionAtNormalized = (
  rawText: string,
  normalizedOffset: number,
): number => {
  if (normalizedOffset < 0) return 0;
  let raw = 0;
  let normalized = 0;
  while (raw < rawText.length && normalized < normalizedOffset) {
    if (rawText[raw] === '\r' && rawText[raw + 1] === '\n') {
      raw += 2;
    } else {
      raw += 1;
    }
    normalized += 1;
  }
  return raw;
};

const validChanges = (
  changes: readonly TextChange[],
  documentLength: number,
): boolean => {
  let previousTo = -1;
  for (const change of [...changes].sort(
    (left, right) => left.from - right.from,
  )) {
    if (
      !Number.isSafeInteger(change.from) ||
      !Number.isSafeInteger(change.to) ||
      change.from < 0 ||
      change.to < change.from ||
      change.to > documentLength ||
      change.from < previousTo
    )
      return false;
    previousTo = change.to;
  }
  return true;
};

const profileFor = (
  rawText: string,
  encoding: TextEncoding,
  undecodableBytes: TextProfileState['undecodable_bytes'],
  insertionNewline?: NewlineToken,
): TextProfileState => {
  const newlineCounts = collectNewlineCounts(rawText);
  const kinds = Object.values(newlineCounts).filter(
    (count) => count > 0,
  ).length;
  const fallback = firstNewline(rawText) ?? 'lf';
  const newlinePattern =
    kinds === 0 ? 'none' : kinds === 1 ? fallback : 'mixed';
  return {
    encoding,
    bom: encoding.endsWith('_bom')
      ? 'present'
      : encoding === 'unknown'
        ? 'unknown'
        : 'absent',
    newline_counts: newlineCounts,
    insertion_newline:
      insertionNewline ?? preferredNewline(newlineCounts, fallback),
    newline_pattern: newlinePattern,
    terminal_newline: /(?:\r\n|\r|\n)$/.test(rawText),
    undecodable_bytes: undecodableBytes,
    round_trip_safe: encoding !== 'unknown' && undecodableBytes === 'none',
  };
};

const collectNewlineCounts = (
  rawText: string,
): Record<NewlineToken, number> => {
  const counts: Record<NewlineToken, number> = { crlf: 0, lf: 0, cr: 0 };
  for (let index = 0; index < rawText.length; index += 1) {
    if (rawText[index] === '\r' && rawText[index + 1] === '\n') {
      counts.crlf += 1;
      index += 1;
    } else if (rawText[index] === '\r') counts.cr += 1;
    else if (rawText[index] === '\n') counts.lf += 1;
  }
  return counts;
};

const preferredNewline = (
  counts: Record<NewlineToken, number>,
  fallback: NewlineToken,
): NewlineToken => {
  const maximum = Math.max(...Object.values(counts));
  if (maximum === 0 || counts[fallback] === maximum) return fallback;
  return (
    (Object.entries(counts) as Array<[NewlineToken, number]>).find(
      ([, count]) => count === maximum,
    )?.[0] ?? 'lf'
  );
};

const firstNewline = (rawText: string): NewlineToken | null => {
  const match = /\r\n|\r|\n/.exec(rawText)?.[0];
  return match === '\r\n'
    ? 'crlf'
    : match === '\r'
      ? 'cr'
      : match === '\n'
        ? 'lf'
        : null;
};

const adjustNewlineCounts = (
  target: Record<NewlineToken, number>,
  delta: Record<NewlineToken, number>,
  direction: -1 | 1,
): void => {
  for (const token of ['crlf', 'lf', 'cr'] as const)
    target[token] += delta[token] * direction;
};

const profileFromCounts = (
  counts: Record<NewlineToken, number>,
  terminalNewline: boolean,
  previous: TextProfileState,
): TextProfileState => {
  const present = (
    Object.entries(counts) as Array<[NewlineToken, number]>
  ).filter(([, count]) => count > 0);
  return {
    ...previous,
    newline_counts: counts,
    newline_pattern:
      present.length === 0
        ? 'none'
        : present.length === 1
          ? present[0][0]
          : 'mixed',
    terminal_newline: terminalNewline,
  };
};

const affectedLineBytes = (text: string, from: number, to: number): number => {
  const start = text.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
  const nextNewline = text.indexOf('\n', to);
  const end = nextNewline < 0 ? text.length : nextNewline;
  return encoder.encode(text.slice(start, end)).byteLength;
};

const useNewline = (text: string, newline: NewlineToken): string =>
  text.replaceAll(
    '\n',
    newline === 'crlf' ? '\r\n' : newline === 'cr' ? '\r' : '\n',
  );

const longestLineBytes = (rawText: string): number =>
  Math.max(
    0,
    ...normalizeNewlines(rawText)
      .split('\n')
      .map((line) => encoder.encode(line).byteLength),
  );

const encodedLength = (rawText: string, encoding: TextEncoding): number => {
  if (encoding === 'utf16_le_bom' || encoding === 'utf16_be_bom')
    return rawText.length * 2 + 2;
  return encoder.encode(rawText).byteLength + (encoding === 'utf8_bom' ? 3 : 0);
};

const encodedContentLength = (
  rawText: string,
  encoding: TextEncoding,
): number =>
  encoding === 'utf16_le_bom' || encoding === 'utf16_be_bom'
    ? rawText.length * 2
    : encoder.encode(rawText).byteLength;

const encode = (rawText: string, encoding: TextEncoding): Uint8Array | null => {
  if (encoding === 'unknown') return null;
  if (encoding === 'utf8') return encoder.encode(rawText);
  if (encoding === 'utf8_bom') {
    const content = encoder.encode(rawText);
    const bytes = new Uint8Array(content.length + 3);
    bytes.set([0xef, 0xbb, 0xbf]);
    bytes.set(content, 3);
    return bytes;
  }
  const littleEndian = encoding === 'utf16_le_bom';
  const bytes = new Uint8Array(rawText.length * 2 + 2);
  bytes.set(littleEndian ? [0xff, 0xfe] : [0xfe, 0xff]);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < rawText.length; index += 1)
    view.setUint16(2 + index * 2, rawText.charCodeAt(index), littleEndian);
  return bytes;
};

const plainLanguageDecision = (): LanguageDecision => ({
  language: 'plain_text',
  confidence: 'low',
  evidence: [],
  conflicts: [],
  origin: 'automatic',
  status: 'plain',
  load_revision: 0,
  fallback_code: null,
});
