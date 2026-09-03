import DOMPurify from 'dompurify';

import {
  MERMAID_MAX_OUTPUT_BYTES,
  type MermaidAccessibility,
} from './mermaid-contract';

const allowedTags = new Set([
  'circle',
  'clippath',
  'defs',
  'desc',
  'ellipse',
  'filter',
  'g',
  'line',
  'lineargradient',
  'marker',
  'mask',
  'path',
  'polygon',
  'polyline',
  'radialgradient',
  'rect',
  'stop',
  'style',
  'svg',
  'text',
  'title',
  'tspan',
]);

const allowedAttributes = new Set([
  'aria-describedby',
  'aria-labelledby',
  'class',
  'clip-path',
  'cx',
  'cy',
  'd',
  'dominant-baseline',
  'fill',
  'fill-opacity',
  'filter',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'id',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'offset',
  'opacity',
  'orient',
  'points',
  'preserveaspectratio',
  'r',
  'refx',
  'refy',
  'role',
  'rx',
  'ry',
  'spreadmethod',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'style',
  'text-anchor',
  'transform',
  'viewbox',
  'width',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
  'xmlns',
]);

const forbiddenCss = /(?:@import|@font-face|expression\s*\(|javascript:|data:|https?:|file:|\\|url\s*\(\s*[^#])/iu;
const localReference = /^url\(\s*#([A-Za-z][\w:.-]*)\s*\)$/u;

export interface SanitizedMermaidSvg {
  svg: string;
  searchText: string[];
  accessibility: MermaidAccessibility;
  outputBytes: number;
}

const safeText = (value: string | null, maximum = 512): string | null => {
  const normalized = value?.replace(/\s+/gu, ' ').trim().slice(0, maximum) ?? '';
  return normalized || null;
};

const rewriteReference = (
  value: string,
  idMap: Map<string, string>,
): string | null => {
  if (value.startsWith('#')) return idMap.get(value.slice(1)) ? `#${idMap.get(value.slice(1))}` : null;
  const match = localReference.exec(value);
  if (!match) return value.includes('url(') ? null : value;
  const mapped = idMap.get(match[1] ?? '');
  return mapped ? `url(#${mapped})` : null;
};

const scrubStyle = (value: string): string | null => {
  if (forbiddenCss.test(value)) return null;
  return value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .filter((declaration) => !/^(?:cursor|pointer-events|behavior)\s*:/iu.test(declaration))
    .join('; ')
    .slice(0, 64 * 1024);
};

export const sanitizeMermaidSvg = (
  unsafeSvg: string,
  requestId: string,
  fallbackLabel: string,
): SanitizedMermaidSvg => {
  const purified = DOMPurify.sanitize(unsafeSvg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['a', 'animate', 'embed', 'foreignObject', 'iframe', 'image', 'object', 'script', 'set', 'use'],
    FORBID_ATTR: ['href', 'xlink:href'],
    RETURN_TRUSTED_TYPE: false,
  });
  const parsed = new DOMParser().parseFromString(purified, 'image/svg+xml');
  const root = parsed.documentElement;
  if (root.localName.toLocaleLowerCase() !== 'svg' || parsed.querySelector('parsererror'))
    throw new Error('mermaid_invalid_svg');

  const all = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of all) {
    if (!allowedTags.has(element.localName.toLocaleLowerCase())) element.remove();
  }

  const idMap = new Map<string, string>();
  const prefix = `gp-${requestId.replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 48) || 'render'}-`;
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const id = element.getAttribute('id');
    if (!id) continue;
    const mapped = `${prefix}${id.replace(/[^A-Za-z0-9_.:-]/gu, '-').slice(0, 128)}`;
    idMap.set(id, mapped);
    element.setAttribute('id', mapped);
  }

  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLocaleLowerCase();
      if (name.startsWith('on') || !allowedAttributes.has(name)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === 'style') {
        const style = scrubStyle(attribute.value);
        if (style) element.setAttribute(attribute.name, style);
        else element.removeAttribute(attribute.name);
        continue;
      }
      if (['fill', 'stroke', 'filter', 'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end'].includes(name)) {
        const rewritten = rewriteReference(attribute.value, idMap);
        if (rewritten === null) element.removeAttribute(attribute.name);
        else element.setAttribute(attribute.name, rewritten);
      } else if (name === 'aria-labelledby' || name === 'aria-describedby') {
        const ids = attribute.value.split(/\s+/u).map((id) => idMap.get(id)).filter(Boolean);
        if (ids.length) element.setAttribute(attribute.name, ids.join(' '));
        else element.removeAttribute(attribute.name);
      }
    }
    if (element.localName.toLocaleLowerCase() === 'style') {
      const css = scrubStyle(element.textContent ?? '');
      if (css) element.textContent = css;
      else element.remove();
    }
  }

  const title = safeText(root.querySelector('title')?.textContent ?? null);
  const description = safeText(root.querySelector('desc')?.textContent ?? null, 2_048);
  const label = title ?? safeText(fallbackLabel) ?? 'Mermaid diagram';
  root.setAttribute('role', 'img');
  root.removeAttribute('tabindex');
  root.removeAttribute('aria-roledescription');
  root.setAttribute('aria-label', label);
  const searchText = Array.from(root.querySelectorAll('text, title, desc'))
    .map((node) => safeText(node.textContent))
    .filter((value): value is string => value !== null)
    .slice(0, 1_000);
  const svg = new XMLSerializer().serializeToString(root);
  const outputBytes = new TextEncoder().encode(svg).byteLength;
  if (outputBytes > MERMAID_MAX_OUTPUT_BYTES) throw new Error('mermaid_output_limited');
  return {
    svg,
    searchText,
    accessibility: {
      title,
      description,
      label,
      authored_title: title !== null,
      authored_description: description !== null,
    },
    outputBytes,
  };
};
