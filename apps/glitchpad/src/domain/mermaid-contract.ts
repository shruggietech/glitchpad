import type { SourceRange } from './markdown-contract';

export const MERMAID_VERSION = '11.17.2' as const;
export const MERMAID_SANITIZER_VERSION = 1 as const;
export const MERMAID_STANDALONE_MAX_BYTES = 1024 * 1024;
export const MERMAID_BLOCK_MAX_BYTES = 256 * 1024;
export const MERMAID_DOCUMENT_MAX_BYTES = 1024 * 1024;
export const MERMAID_DOCUMENT_MAX_BLOCKS = 64;
export const MERMAID_MAX_EDGES = 2_000;
export const MERMAID_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
export const MERMAID_RENDER_TIMEOUT_MS = 5_000;
export const MERMAID_PREVIEW_DEBOUNCE_MS = 300;
export const MERMAID_MAX_ACTIVE_REQUESTS = 2;
export const MERMAID_MIN_ZOOM = 0.1;
export const MERMAID_MAX_ZOOM = 8;

export type MermaidRenderStatus =
  | 'ready'
  | 'empty'
  | 'malformed'
  | 'unsupported'
  | 'limited'
  | 'cancelled'
  | 'failed';

export type MermaidLimitKind =
  | 'source_bytes'
  | 'document_bytes'
  | 'block_count'
  | 'edge_count'
  | 'output_bytes'
  | 'time';

export interface MermaidDiagnostic {
  category: Exclude<MermaidRenderStatus, 'ready' | 'empty'>;
  code: string;
  message: string;
  line: number | null;
  column: number | null;
}

export interface MermaidAccessibility {
  title: string | null;
  description: string | null;
  label: string;
  authored_title: boolean;
  authored_description: boolean;
}

export interface MermaidMeasurements {
  source_bytes: number;
  edge_count: number;
  output_bytes: number;
  parse_duration_ms: number;
  render_duration_ms: number;
  total_duration_ms: number;
}

export interface MermaidRenderRequest {
  request_id: string;
  owner_id: string;
  source_revision: number;
  source_text: string;
  fallback_label: string;
  theme: 'light' | 'dark';
  sanitizer_version: number;
}

export interface MermaidRenderResult {
  request_id: string;
  owner_id: string;
  source_revision: number;
  status: MermaidRenderStatus;
  diagram_type: string | null;
  svg: string | null;
  search_text: string[];
  diagnostic: MermaidDiagnostic | null;
  accessibility: MermaidAccessibility;
  measurements: MermaidMeasurements;
  limit: MermaidLimitKind | null;
  sanitizer_version: number;
  parser_version: typeof MERMAID_VERSION;
}

export interface EmbeddedMermaidBlock {
  owner_id: string;
  ordinal: number;
  parent_revision: number;
  source: string;
  source_bytes: number;
  source_range: SourceRange | null;
  limit: MermaidLimitKind | null;
}

export interface MermaidViewportState {
  mode: 'fit' | 'actual' | 'custom';
  zoom: number;
  pan_x: number;
  pan_y: number;
}

export const initialMermaidViewport = (): MermaidViewportState => ({
  mode: 'fit',
  zoom: 1,
  pan_x: 0,
  pan_y: 0,
});

export const clampMermaidZoom = (
  zoom: number,
  minimum = MERMAID_MIN_ZOOM,
): number => Math.min(MERMAID_MAX_ZOOM, Math.max(minimum, zoom));

export interface MermaidViewportExtents {
  content_width: number;
  content_height: number;
  viewport_width: number;
  viewport_height: number;
}
export const mermaidFitScale = (e: MermaidViewportExtents): number =>
  e.content_width > 0 &&
  e.content_height > 0 &&
  e.viewport_width > 0 &&
  e.viewport_height > 0
    ? Math.min(
        1,
        e.viewport_width / e.content_width,
        e.viewport_height / e.content_height,
      )
    : 1;
export const mermaidEffectiveScale = (
  state: MermaidViewportState,
  e: MermaidViewportExtents,
): number =>
  state.mode === 'fit'
    ? mermaidFitScale(e)
    : state.mode === 'actual'
      ? 1
      : state.zoom;

export const clampMermaidPan = (
  offset: number,
  contentExtent: number,
  viewportExtent: number,
): number => {
  const maximum = Math.max(0, (contentExtent - viewportExtent) / 2);
  return Math.min(maximum, Math.max(-maximum, offset));
};

const mermaidEdgeTokens = [
  '-.->',
  '<==',
  '<--',
  '-->',
  '---',
  '==>',
  '~~>',
  '--x',
  '--o',
] as const;

export const countMermaidEdges = (source: string): number => {
  let count = 0;
  for (let index = 0; index < source.length;) {
    const token = mermaidEdgeTokens.find((candidate) =>
      source.startsWith(candidate, index),
    );
    if (!token) {
      index += 1;
      continue;
    }
    count += 1;
    index += token.length;
  }
  return count;
};

export const detectMermaidType = (source: string): string | null => {
  const body = source
    .replace(/^---[\s\S]*?---\s*/u, '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('%%'));
  if (!body) return null;
  const match =
    /^(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|zenuml|sankey-beta|xychart-beta|block-beta|packet-beta|kanban|architecture-beta|radar-beta|treemap-beta)\b/iu.exec(
      body,
    );
  return match?.[0] ?? null;
};

export const mermaidSourceBytes = (source: string): number =>
  new TextEncoder().encode(source).byteLength;
