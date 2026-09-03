import type { Element, Root as HastRoot, Text as HastText } from 'hast';
import type { Html, Parent as MdastParent, Root as MdastRoot, Text as MdastText } from 'mdast';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified, type Plugin } from 'unified';
import { visit } from 'unist-util-visit';

import {
  MARKDOWN_DIAGNOSTIC_MAX_ENTRIES,
  MARKDOWN_NODE_MAX_COUNT,
  MARKDOWN_NODE_MAX_DEPTH,
  MARKDOWN_OUTLINE_MAX_ENTRIES,
  MARKDOWN_RENDER_MAX_BYTES,
  MARKDOWN_SANITIZER_VERSION,
  type HeadingEntry,
  type MarkdownRenderRequest,
  type MarkdownRenderResult,
  type SafeDiagnostic,
  type SafeElementNode,
  type SafeRenderedNode,
  type SearchTextEntry,
  type SourceRange,
} from './markdown-contract';
import { classifyMarkdownResource, classifyMarkdownTarget } from './markdown-url';
import { extractMermaidBlocks } from './mermaid-markdown';
import type { EmbeddedMermaidBlock } from './mermaid-contract';

const allowedTags = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'input',
  'li',
  'ol',
  'p',
  'pre',
  'section',
  'strong',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
] as const;

const sanitationSchema = {
  // Raw HTML is already inert, so only remark-rehype can author IDs here. Its
  // footnote IDs already carry the user-content prefix and must remain aligned
  // with their generated back-reference fragments.
  clobberPrefix: '',
  tagNames: [...allowedTags],
  attributes: {
    '*': ['className', 'id'],
    a: ['ariaDescribedBy', 'dataFootnoteRef', 'dataFootnoteBackref', 'dataMarkdownTarget'],
    img: ['alt', 'title', 'dataMarkdownTarget'],
    input: ['type', 'checked', 'disabled'],
    li: ['className'],
    ol: ['start'],
    section: ['dataFootnotes', 'className'],
    td: ['align'],
    th: ['align'],
  },
};

const inertRawHtml: Plugin<[], MdastRoot> = () => (tree) => {
  visit(tree, 'html', (node: Html, index, parent: MdastParent | undefined) => {
    if (parent === undefined || index === undefined) return;
    const replacement: MdastText = {
      type: 'text',
      value: node.value,
      position: node.position,
    };
    parent.children[index] = replacement;
  });
};

const stripActiveTargets: Plugin<[], HastRoot> = () => (tree) => {
  visit(tree, 'element', (node: Element) => {
    const property = node.tagName === 'a' ? 'href' : node.tagName === 'img' ? 'src' : null;
    if (!property) return;
    const target = node.properties[property];
    if (typeof target === 'string') node.properties.dataMarkdownTarget = target;
    delete node.properties[property];
  });
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(inertRawHtml)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(stripActiveTargets)
  .use(rehypeSanitize, sanitationSchema);

class MarkdownOutputLimitError extends Error {}

interface ProjectionContext {
  nodes: number;
  nextId: number;
  slugCounts: Map<string, number>;
  outline: HeadingEntry[];
  mermaidBlocks: EmbeddedMermaidBlock[];
}

const toSourceRange = (
  position: { start: { line: number; offset?: number }; end: { line: number; offset?: number } } | undefined,
): SourceRange | null => {
  if (
    position?.start.offset === undefined ||
    position.end.offset === undefined ||
    position.start.offset > position.end.offset
  )
    return null;
  return {
    start_offset: position.start.offset,
    end_offset: position.end.offset,
    start_line: position.start.line,
    end_line: position.end.line,
  };
};

const safeProperties = (
  properties: Element['properties'],
): Record<string, string | number | boolean | string[]> => {
  const accepted = new Set([
    'align',
    'ariaDescribedBy',
    'checked',
    'className',
    'dataFootnoteBackref',
    'dataFootnoteRef',
    'dataFootnotes',
    'disabled',
    'id',
    'start',
    'type',
  ]);
  const result: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!accepted.has(key)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      result[key] = value;
    else if (Array.isArray(value))
      result[key] = value.filter((item): item is string => typeof item === 'string');
  }
  return result;
};

const textOf = (node: SafeRenderedNode): string => {
  if (node.type === 'text') return node.value;
  if (node.type === 'element' && node.resource)
    return node.resource.alt ? `Image unavailable: ${node.resource.alt}` : 'Image unavailable';
  return node.children.map(textOf).join('');
};

const slugify = (label: string): string =>
  label
    .normalize('NFKC')
    .toLocaleLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'section';

const projectNode = (
  node: HastRoot | Element | HastText,
  context: ProjectionContext,
  depth = 0,
): SafeRenderedNode | null => {
  if (depth > MARKDOWN_NODE_MAX_DEPTH || context.nodes >= MARKDOWN_NODE_MAX_COUNT)
    throw new MarkdownOutputLimitError();
  context.nodes += 1;
  const id = `md-${context.nextId++}`;
  const sourceRange = toSourceRange(node.position);
  if (node.type === 'text')
    return { type: 'text', id, value: node.value, source_range: sourceRange };
  if (node.type === 'root') {
    const children = node.children
      .map((child) =>
        child.type === 'element' || child.type === 'text'
          ? projectNode(child, context, depth + 1)
          : null,
      )
      .filter((child): child is SafeRenderedNode => child !== null);
    return { type: 'root', id, children, source_range: sourceRange };
  }
  const mermaid = node.tagName === 'pre'
    ? context.mermaidBlocks.find((block) => block.source_range?.start_offset === sourceRange?.start_offset) ?? null
    : null;
  if (mermaid) {
    return {
      type: 'element',
      id,
      tag_name: 'div',
      properties: { className: ['markdown-mermaid-block'] },
      children: [],
      source_range: sourceRange,
      link: null,
      resource: null,
      mermaid,
    };
  }
  if (!allowedTags.includes(node.tagName as (typeof allowedTags)[number])) return null;
  const target = typeof node.properties.dataMarkdownTarget === 'string' ? node.properties.dataMarkdownTarget : '';
  const alt = typeof node.properties.alt === 'string' ? node.properties.alt : '';
  const children = node.children
    .map((child) =>
      child.type === 'element' || child.type === 'text'
        ? projectNode(child, context, depth + 1)
        : null,
    )
    .filter((child): child is SafeRenderedNode => child !== null);
  const projected: SafeElementNode = {
    type: 'element',
    id,
    tag_name: node.tagName,
    properties: safeProperties(node.properties),
    children,
    source_range: sourceRange,
    link: node.tagName === 'a' ? classifyMarkdownTarget(target) : null,
    resource:
      node.tagName === 'img'
        ? classifyMarkdownResource(target, alt.slice(0, 512))
        : null,
  };
  const heading = /^h([1-6])$/u.exec(node.tagName);
  if (heading && context.outline.length < MARKDOWN_OUTLINE_MAX_ENTRIES) {
    const label = textOf(projected).replace(/\s+/gu, ' ').trim().slice(0, 512);
    const base = slugify(label);
    const occurrence = (context.slugCounts.get(base) ?? 0) + 1;
    context.slugCounts.set(base, occurrence);
    const headingId = occurrence === 1 ? base : `${base}-${occurrence}`;
    projected.properties.id = headingId;
    context.outline.push({
      id: headingId,
      level: Number(heading[1]),
      label: label || 'Untitled section',
      node_id: projected.id,
      source_range: sourceRange,
    });
  }
  return projected;
};

const searchableTags = new Set([
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'p',
  'pre',
  'td',
  'th',
]);

const collectSearchText = (
  node: SafeRenderedNode,
  entries: SearchTextEntry[],
): void => {
  if (node.type === 'text') return;
  if (node.type === 'element' && searchableTags.has(node.tag_name)) {
    const text = textOf(node).replace(/\s+/gu, ' ').trim();
    if (text) entries.push({ node_id: node.id, text, source_range: node.source_range });
    return;
  }
  for (const child of node.children) collectSearchText(child, entries);
};

const baseResult = (
  request: MarkdownRenderRequest,
  started: number,
  sourceBytes: number,
): Omit<MarkdownRenderResult, 'status'> => ({
  request_id: request.request_id,
  session_id: request.session_id,
  source_revision: request.source_revision,
  tree: null,
  outline: [],
  search_text: [],
  diagnostics: [],
  measurements: {
    source_bytes: sourceBytes,
    parse_duration_ms: performance.now() - started,
    node_count: 0,
    heading_count: 0,
    search_entry_count: 0,
  },
  sanitizer_version: MARKDOWN_SANITIZER_VERSION,
});

export const renderMarkdown = async (
  request: MarkdownRenderRequest,
): Promise<MarkdownRenderResult> => {
  const started = performance.now();
  const sourceBytes = new TextEncoder().encode(request.source_text).byteLength;
  const base = baseResult(request, started, sourceBytes);
  if (request.sanitizer_version !== MARKDOWN_SANITIZER_VERSION) {
    return {
      ...base,
      status: 'failed',
      diagnostics: [{ code: 'markdown_policy_mismatch', message: 'The Markdown safety policy changed. Reopen the document and try again.' }],
    };
  }
  if (sourceBytes > MARKDOWN_RENDER_MAX_BYTES) {
    return {
      ...base,
      status: 'limited',
      diagnostics: [{ code: 'markdown_preview_limited', message: 'Live preview is unavailable above 16 MiB. Source editing remains available.' }],
    };
  }
  try {
    const parsed = processor.parse(request.source_text);
    const transformed = await processor.run(parsed);
    const context: ProjectionContext = {
      nodes: 0,
      nextId: 1,
      slugCounts: new Map(),
      outline: [],
      mermaidBlocks: extractMermaidBlocks(request.source_text, request.session_id, request.source_revision),
    };
    const tree = projectNode(transformed, context);
    if (!tree || tree.type !== 'root') throw new Error('invalid root');
    const searchText: SearchTextEntry[] = [];
    collectSearchText(tree, searchText);
    const empty = tree.children.length === 0;
    return {
      ...base,
      status: empty ? 'empty' : 'ready',
      tree,
      outline: context.outline,
      search_text: searchText,
      diagnostics: empty
        ? [{ code: 'markdown_empty', message: 'This Markdown document has no rendered content.' }]
        : [],
      measurements: {
        source_bytes: sourceBytes,
        parse_duration_ms: performance.now() - started,
        node_count: context.nodes,
        heading_count: context.outline.length,
        search_entry_count: searchText.length,
      },
      sanitizer_version: MARKDOWN_SANITIZER_VERSION,
    };
  } catch (error) {
    const outputLimited = error instanceof MarkdownOutputLimitError;
    const diagnostic: SafeDiagnostic = outputLimited
      ? { code: 'markdown_output_limited', message: 'The rendered structure exceeds the safe preview limit. Source remains available.' }
      : { code: 'markdown_parse_failed', message: 'Markdown preview failed safely. Source remains available.' };
    return {
      ...base,
      status: outputLimited ? 'limited' : 'failed',
      diagnostics: [diagnostic].slice(0, MARKDOWN_DIAGNOSTIC_MAX_ENTRIES),
    };
  }
};
