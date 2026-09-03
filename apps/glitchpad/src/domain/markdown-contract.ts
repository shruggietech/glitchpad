export const MARKDOWN_SANITIZER_VERSION = 1 as const;
export const MARKDOWN_RENDER_MAX_BYTES = 16 * 1024 * 1024;
export const MARKDOWN_SEARCH_MAX_MATCHES = 1_000;
export const MARKDOWN_OUTLINE_MAX_ENTRIES = 10_000;
export const MARKDOWN_DIAGNOSTIC_MAX_ENTRIES = 32;
export const MARKDOWN_NODE_MAX_DEPTH = 256;
export const MARKDOWN_NODE_MAX_COUNT = 250_000;
export const MARKDOWN_PREVIEW_DEBOUNCE_MS = 100;
export const MARKDOWN_RENDER_TIMEOUT_MS = 5_000;

export type MarkdownRenderStatus =
  | 'ready'
  | 'empty'
  | 'limited'
  | 'cancelled'
  | 'failed';

export interface SourceRange {
  start_offset: number;
  end_offset: number;
  start_line: number;
  end_line: number;
}

export type LinkCandidateKind =
  | 'external'
  | 'email'
  | 'fragment'
  | 'local'
  | 'blocked'
  | 'malformed';

export interface LinkCandidate {
  kind: LinkCandidateKind;
  authored_target: string;
  normalized_target: string | null;
  display_target: string;
  reason_code: string | null;
}

export interface ResourceCandidate {
  kind: 'local' | 'blocked' | 'malformed';
  authored_target: string;
  normalized_target: string | null;
  alt: string;
  reason_code: string | null;
}

export interface SafeRootNode {
  type: 'root';
  id: string;
  children: SafeRenderedNode[];
  source_range: SourceRange | null;
}

export interface SafeElementNode {
  type: 'element';
  id: string;
  tag_name: string;
  properties: Record<string, string | number | boolean | string[]>;
  children: SafeRenderedNode[];
  source_range: SourceRange | null;
  link: LinkCandidate | null;
  resource: ResourceCandidate | null;
}

export interface SafeTextNode {
  type: 'text';
  id: string;
  value: string;
  source_range: SourceRange | null;
}

export type SafeRenderedNode = SafeRootNode | SafeElementNode | SafeTextNode;

export interface HeadingEntry {
  id: string;
  level: number;
  label: string;
  node_id: string;
  source_range: SourceRange | null;
}

export interface SearchTextEntry {
  node_id: string;
  text: string;
  source_range: SourceRange | null;
}

export interface SafeDiagnostic {
  code:
    | 'markdown_empty'
    | 'markdown_preview_limited'
    | 'markdown_cancelled'
    | 'markdown_parse_failed'
    | 'markdown_policy_mismatch'
    | 'markdown_output_limited';
  message: string;
}

export interface MarkdownMeasurements {
  source_bytes: number;
  parse_duration_ms: number;
  node_count: number;
  heading_count: number;
  search_entry_count: number;
}

export interface MarkdownRenderRequest {
  request_id: string;
  session_id: string;
  source_revision: number;
  source_text: string;
  sanitizer_version: number;
}

export interface MarkdownRenderResult {
  request_id: string;
  session_id: string;
  source_revision: number;
  status: MarkdownRenderStatus;
  tree: SafeRootNode | null;
  outline: HeadingEntry[];
  search_text: SearchTextEntry[];
  diagnostics: SafeDiagnostic[];
  measurements: MarkdownMeasurements;
  sanitizer_version: number;
}

export interface RenderedSearchMatch {
  node_id: string;
  entry_index: number;
  start: number;
  end: number;
  source_range: SourceRange | null;
}

export const markdownEligibility = (
  sourceBytes: number,
): 'full' | 'source_only' | 'large_read_only' | 'refused' => {
  if (sourceBytes <= MARKDOWN_RENDER_MAX_BYTES) return 'full';
  if (sourceBytes <= 32 * 1024 * 1024) return 'source_only';
  if (sourceBytes <= 256 * 1024 * 1024) return 'large_read_only';
  return 'refused';
};

export const findRenderedMatches = (
  entries: SearchTextEntry[],
  query: string,
): RenderedSearchMatch[] => {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const matches: RenderedSearchMatch[] = [];
  for (const [entryIndex, entry] of entries.entries()) {
    const haystack = entry.text.toLocaleLowerCase();
    let offset = 0;
    while (matches.length < MARKDOWN_SEARCH_MAX_MATCHES) {
      const start = haystack.indexOf(needle, offset);
      if (start < 0) break;
      matches.push({
        node_id: entry.node_id,
        entry_index: entryIndex,
        start,
        end: start + needle.length,
        source_range: entry.source_range,
      });
      offset = start + Math.max(1, needle.length);
    }
    if (matches.length >= MARKDOWN_SEARCH_MAX_MATCHES) break;
  }
  return matches;
};
