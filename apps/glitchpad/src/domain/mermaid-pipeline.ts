import mermaid from 'mermaid';

import {
  MERMAID_MAX_EDGES,
  MERMAID_RENDER_TIMEOUT_MS,
  MERMAID_SANITIZER_VERSION,
  MERMAID_STANDALONE_MAX_BYTES,
  MERMAID_VERSION,
  countMermaidEdges,
  detectMermaidType,
  mermaidSourceBytes,
  type MermaidDiagnostic,
  type MermaidRenderRequest,
  type MermaidRenderResult,
  type MermaidRenderStatus,
} from './mermaid-contract';
import { sanitizeMermaidSvg } from './mermaid-sanitizer';

const forbiddenConfiguration = /(?:%%\{\s*(?:init|config)|^---\s*[\s\S]*?\bconfig\s*:)/imu;
let renderTail: Promise<void> = Promise.resolve();

const accessibilityFromSource = (source: string, fallback: string) => {
  const title = /^\s*accTitle\s*:\s*(.+)$/imu.exec(source)?.[1]?.trim().slice(0, 512) ?? null;
  const description = /^\s*accDescr(?:\s*:\s*|\s*\{)([\s\S]*?)(?:\}|$)/imu.exec(source)?.[1]?.trim().replace(/\s+/gu, ' ').slice(0, 2_048) ?? null;
  return {
    title,
    description,
    label: title || fallback.slice(0, 512) || 'Mermaid diagram',
    authored_title: title !== null,
    authored_description: description !== null,
  };
};

const diagnostic = (
  category: MermaidDiagnostic['category'],
  code: string,
  message: string,
  error?: unknown,
): MermaidDiagnostic => {
  const raw = error instanceof Error ? error.message : '';
  const location = /(?:line\s+|:)(\d+)(?::(\d+))?/iu.exec(raw);
  return {
    category,
    code,
    message,
    line: location?.[1] ? Number(location[1]) : null,
    column: location?.[2] ? Number(location[2]) : null,
  };
};

const resultBase = (
  request: MermaidRenderRequest,
  started: number,
  sourceBytes: number,
  edges: number,
  diagramType: string | null,
): Omit<MermaidRenderResult, 'status'> => ({
  request_id: request.request_id,
  owner_id: request.owner_id,
  source_revision: request.source_revision,
  diagram_type: diagramType,
  svg: null,
  search_text: [],
  diagnostic: null,
  accessibility: accessibilityFromSource(request.source_text, request.fallback_label),
  measurements: {
    source_bytes: sourceBytes,
    edge_count: edges,
    output_bytes: 0,
    parse_duration_ms: 0,
    render_duration_ms: 0,
    total_duration_ms: performance.now() - started,
  },
  limit: null,
  sanitizer_version: MERMAID_SANITIZER_VERSION,
  parser_version: MERMAID_VERSION,
});

const failed = (
  base: Omit<MermaidRenderResult, 'status'>,
  status: MermaidRenderStatus,
  nextDiagnostic: MermaidDiagnostic,
  limit: MermaidRenderResult['limit'] = null,
): MermaidRenderResult => ({ ...base, status, diagnostic: nextDiagnostic, limit });

const renderLocked = async (request: MermaidRenderRequest): Promise<MermaidRenderResult> => {
  const started = performance.now();
  const sourceBytes = mermaidSourceBytes(request.source_text);
  const edges = countMermaidEdges(request.source_text);
  const diagramType = detectMermaidType(request.source_text);
  const base = resultBase(request, started, sourceBytes, edges, diagramType);
  if (request.sanitizer_version !== MERMAID_SANITIZER_VERSION)
    return failed(base, 'failed', diagnostic('failed', 'mermaid_policy_mismatch', 'The Mermaid safety policy changed. Reopen the document and try again.'));
  if (!request.source_text.trim()) return { ...base, status: 'empty' };
  if (sourceBytes > MERMAID_STANDALONE_MAX_BYTES)
    return failed(base, 'limited', diagnostic('limited', 'mermaid_source_limited', 'Diagram preview is unavailable above 1 MiB. Source remains available.'), 'source_bytes');
  if (edges > MERMAID_MAX_EDGES)
    return failed(base, 'limited', diagnostic('limited', 'mermaid_edges_limited', 'Diagram preview exceeds the 2,000-edge limit. Source remains available.'), 'edge_count');
  if (!diagramType)
    return failed(base, 'unsupported', diagnostic('unsupported', 'mermaid_unsupported', 'The diagram declaration is not supported by this Mermaid version.'));
  if (forbiddenConfiguration.test(request.source_text))
    return failed(base, 'unsupported', diagnostic('unsupported', 'mermaid_configuration_blocked', 'Document configuration directives are not rendered because they can alter application security. Source remains unchanged.'));

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    suppressErrorRendering: true,
    deterministicIds: true,
    deterministicIDSeed: request.request_id,
    maxTextSize: MERMAID_STANDALONE_MAX_BYTES,
    maxEdges: MERMAID_MAX_EDGES,
    theme: request.theme === 'dark' ? 'dark' : 'default',
    secure: [
      'securityLevel', 'secure', 'startOnLoad', 'maxTextSize', 'maxEdges',
      'htmlLabels', 'dompurifyConfig', 'theme', 'themeCSS', 'themeVariables',
      'fontFamily', 'altFontFamily', 'look', 'layout',
    ],
  });
  const parseStarted = performance.now();
  try {
    await mermaid.parse(request.source_text, { suppressErrors: false });
  } catch (error) {
    base.measurements.parse_duration_ms = performance.now() - parseStarted;
    base.measurements.total_duration_ms = performance.now() - started;
    return failed(base, 'malformed', diagnostic('malformed', 'mermaid_malformed', 'The Mermaid source is malformed. Source remains available.', error));
  }
  base.measurements.parse_duration_ms = performance.now() - parseStarted;
  const renderStarted = performance.now();
  try {
    const id = `gp-${request.request_id.replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 48) || 'diagram'}`;
    const rendered = await mermaid.render(id, request.source_text);
    const renderDuration = performance.now() - renderStarted;
    const sanitized = sanitizeMermaidSvg(rendered.svg, request.request_id, request.fallback_label);
    const totalDuration = performance.now() - started;
    base.measurements.render_duration_ms = renderDuration;
    base.measurements.total_duration_ms = totalDuration;
    base.measurements.output_bytes = sanitized.outputBytes;
    if (totalDuration > MERMAID_RENDER_TIMEOUT_MS)
      return failed(base, 'limited', diagnostic('limited', 'mermaid_time_limited', 'Diagram rendering exceeded five seconds. Source remains available.'), 'time');
    return {
      ...base,
      status: 'ready',
      svg: sanitized.svg,
      search_text: sanitized.searchText,
      accessibility: sanitized.accessibility,
    };
  } catch (error) {
    base.measurements.render_duration_ms = performance.now() - renderStarted;
    base.measurements.total_duration_ms = performance.now() - started;
    if (error instanceof Error && error.message === 'mermaid_output_limited')
      return failed(base, 'limited', diagnostic('limited', 'mermaid_output_limited', 'Diagram output exceeds 8 MiB. Source remains available.'), 'output_bytes');
    return failed(base, 'failed', diagnostic('failed', 'mermaid_internal_failure', 'Diagram preview failed safely. Source remains available.'));
  }
};

export const renderMermaid = (request: MermaidRenderRequest): Promise<MermaidRenderResult> => {
  const execution = renderTail.then(() => renderLocked(request), () => renderLocked(request));
  renderTail = execution.then(() => undefined, () => undefined);
  return execution;
};
