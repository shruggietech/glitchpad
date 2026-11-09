import { expect, it, vi } from 'vitest';
import { createPdfDocumentResources } from './pdf-document-resources';

it('releases only PDF-owned document fonts/nodes/listeners and refuses late attachment', () => {
  const original = Object.getOwnPropertyDescriptor(document, 'fonts');
  const nativeFonts = new Set<FontFace>();
  const unrelated = {} as FontFace;
  const owned = {} as FontFace;
  nativeFonts.add(unrelated);
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: nativeFonts,
  });
  try {
    const resources = createPdfDocumentResources(document);
    const event = vi.fn();
    resources.document.addEventListener('s049-test', event);
    resources.document.fonts.add(owned);
    expect(nativeFonts.has(owned)).toBe(true);
    const style = resources.document.createElement('style');
    resources.document.head.append(style);
    const svg = resources.document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    resources.document.body.append(svg);
    expect(resources.counts()).toMatchObject({ fonts: 1, nodes: 2 });
    resources.dispose();
    resources.dispose();
    expect(nativeFonts.has(owned)).toBe(false);
    expect(nativeFonts.has(unrelated)).toBe(true);
    expect(style.isConnected).toBe(false);
    expect(svg.isConnected).toBe(false);
    expect(resources.counts()).toEqual({ fonts: 0, nodes: 0, stylesheets: 0 });
    document.dispatchEvent(new Event('s049-test'));
    expect(event).not.toHaveBeenCalled();
    resources.document.fonts.add(owned);
    expect(nativeFonts.has(owned)).toBe(false);
    const late = resources.document.createElement('style');
    resources.document.head.append(late);
    expect(document.head.contains(late)).toBe(false);
  } finally {
    if (original) Object.defineProperty(document, 'fonts', original);
    else Reflect.deleteProperty(document, 'fonts');
  }
});
