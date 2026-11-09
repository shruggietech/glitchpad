import {
  PDF_LIMITS,
  PdfFailure,
  type PdfInternalTarget,
  type PdfSearchMatch,
} from './pdf-contract';
export interface PdfOutlineRow {
  title: string;
  destination: unknown;
  depth: number;
}
export function boundedOutline(input: unknown): {
  rows: PdfOutlineRow[];
  limited: boolean;
} {
  if (input === null) return { rows: [], limited: false };
  if (!Array.isArray(input)) throw new PdfFailure('invalid_destination');
  const rows: PdfOutlineRow[] = [];
  const seen = new Set<unknown>();
  const pending: Array<{ items: unknown[]; index: number; depth: number }> = [
    { items: input, index: 0, depth: 0 },
  ];
  seen.add(input);
  let limited = false;
  while (pending.length) {
    const frame = pending[pending.length - 1];
    if (frame.index >= frame.items.length) {
      pending.pop();
      continue;
    }
    const item: unknown = frame.items[frame.index++];
    if (!item || typeof item !== 'object' || seen.has(item)) {
      limited = true;
      continue;
    }
    seen.add(item);
    const node = item as { title?: unknown; dest?: unknown; items?: unknown };
    if (rows.length >= PDF_LIMITS.outlineNodes) {
      limited = true;
      break;
    }
    rows.push({
      title:
        typeof node.title === 'string'
          ? node.title.slice(0, 1024)
          : 'Untitled section',
      destination: node.dest,
      depth: frame.depth,
    });
    if (Array.isArray(node.items) && node.items.length) {
      if (frame.depth + 1 >= PDF_LIMITS.outlineDepth || seen.has(node.items)) {
        limited = true;
        continue;
      }
      seen.add(node.items);
      pending.push({ items: node.items, index: 0, depth: frame.depth + 1 });
    }
  }
  return { rows, limited };
}
export function destinationShape(input: unknown): {
  page: unknown;
  mode: string;
  values: Array<number | null>;
} {
  if (
    !Array.isArray(input) ||
    input.length < 2 ||
    input.length > 6 ||
    !input[1] ||
    typeof input[1] !== 'object'
  )
    throw new PdfFailure('invalid_destination');
  const mode = (input[1] as { name?: unknown }).name;
  if (
    typeof mode !== 'string' ||
    !['XYZ', 'Fit', 'FitB', 'FitH', 'FitBH', 'FitV', 'FitBV', 'FitR'].includes(
      mode,
    )
  )
    throw new PdfFailure('invalid_destination');
  const lengths: Record<string, number> = {
    XYZ: 5,
    Fit: 2,
    FitB: 2,
    FitH: 3,
    FitBH: 3,
    FitV: 3,
    FitBV: 3,
    FitR: 6,
  };
  if (input.length !== lengths[mode])
    throw new PdfFailure('invalid_destination');
  const values = input.slice(2) as unknown[];
  if (
    values.some(
      (value) =>
        value !== null &&
        (typeof value !== 'number' ||
          !Number.isFinite(value) ||
          Math.abs(value) > 1e9),
    )
  )
    throw new PdfFailure('invalid_destination');
  return { page: input[0], mode, values: values as Array<number | null> };
}
export function destinationPoint(
  mode: string,
  values: Array<number | null>,
  page: number,
): PdfInternalTarget {
  return {
    page,
    x:
      mode === 'XYZ' || mode === 'FitR' || mode === 'FitV' || mode === 'FitBV'
        ? (values[0] ?? null)
        : null,
    y:
      mode === 'XYZ'
        ? (values[1] ?? null)
        : mode === 'FitH' || mode === 'FitBH'
          ? (values[0] ?? null)
          : mode === 'FitR'
            ? (values[3] ?? null)
            : null,
  };
}
export function pageMatches(
  text: string,
  query: string,
  page: number,
  limit: number,
): PdfSearchMatch[] {
  const output: PdfSearchMatch[] = [];
  if (!query) return output;
  // Match original UTF-16 text; lowercasing can expand characters before a hit.
  const literal = query.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const expression = new RegExp(literal, 'giu');
  while (output.length < limit) {
    const match = expression.exec(text);
    if (!match) break;
    const offset = match.index;
    output.push({
      page,
      offset,
      text: match[0],
      context: text
        .slice(
          Math.max(0, offset - 48),
          Math.min(text.length, offset + match[0].length + 80),
        )
        .replace(/\s+/gu, ' '),
    });
  }
  return output;
}

/** Select the extracted occurrence, preserving its item-separator offsets. */
export function selectPdfMatch(
  layer: HTMLElement,
  match: PdfSearchMatch,
  pane?: HTMLElement,
): boolean {
  const fragments: Array<{ node: Node; start: number; end: number }> = [];
  for (const span of layer.querySelectorAll<HTMLElement>(
    '[data-pdf-text-offset]',
  )) {
    const offset = Number(span.dataset.pdfTextOffset);
    const node = span.firstChild;
    if (
      !Number.isSafeInteger(offset) ||
      !node ||
      node.nodeType !== Node.TEXT_NODE
    )
      continue;
    const length = node.textContent?.length ?? 0;
    const start = Math.max(0, match.offset - offset),
      end = Math.min(length, match.offset + match.text.length - offset);
    if (start < end) fragments.push({ node, start, end });
  }
  if (!fragments.length) return false;
  const range = layer.ownerDocument.createRange();
  range.setStart(fragments[0].node, fragments[0].start);
  const last = fragments[fragments.length - 1];
  range.setEnd(last.node, last.end);
  const selection = layer.ownerDocument.defaultView?.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  selection.addRange(range);
  if (pane) {
    const bounds = range.getBoundingClientRect();
    const viewport = pane.getBoundingClientRect();
    const gap = 8;
    // Scroll only the PDF pane, preserving the surrounding shell and task focus.
    if (bounds.top < viewport.top + gap)
      pane.scrollTop += bounds.top - viewport.top - gap;
    else if (bounds.bottom > viewport.bottom - gap)
      pane.scrollTop += bounds.bottom - viewport.bottom + gap;
    if (bounds.left < viewport.left + gap)
      pane.scrollLeft += bounds.left - viewport.left - gap;
    else if (bounds.right > viewport.right - gap)
      pane.scrollLeft += bounds.right - viewport.right + gap;
  }
  return true;
}
