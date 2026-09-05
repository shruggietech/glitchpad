import {
  MERMAID_SANITIZER_VERSION,
  MERMAID_VERSION,
  detectMermaidType,
  mermaidSourceBytes,
  type MermaidRenderRequest,
  type MermaidRenderResult,
} from '../domain/mermaid-contract';

type MermaidRenderInput = Omit<MermaidRenderRequest, 'request_id' | 'sanitizer_version'>;

const tokens = (source: string): string[] => [...new Set(source.match(/[A-Za-z][A-Za-z0-9_]*/gu) ?? [])];

/** A fast component-test double. The real parser, sanitizer, scheduler, and limits retain dedicated domain tests. */
export class DeterministicMermaidRendererClient {
  private generation = 0;

  render(input: MermaidRenderInput): Promise<MermaidRenderResult> {
    const sourceBytes = mermaidSourceBytes(input.source_text);
    const malformed = input.source_text.trimEnd().endsWith('-->');
    const result: MermaidRenderResult = {
      request_id: `${input.owner_id}:${input.source_revision}:${++this.generation}`,
      owner_id: input.owner_id,
      source_revision: input.source_revision,
      status: malformed ? 'malformed' : 'ready',
      diagram_type: detectMermaidType(input.source_text),
      svg: malformed ? null : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 24"><text>A B</text></svg>',
      search_text: malformed ? [] : tokens(input.source_text),
      diagnostic: malformed ? {
        category: 'malformed',
        code: 'mermaid_malformed',
        message: 'The Mermaid source is malformed. Source remains available.',
        line: null,
        column: null,
      } : null,
      accessibility: {
        title: null,
        description: null,
        label: input.fallback_label,
        authored_title: false,
        authored_description: false,
      },
      measurements: {
        source_bytes: sourceBytes,
        edge_count: input.source_text.includes('-->') ? 1 : 0,
        output_bytes: malformed ? 0 : 87,
        parse_duration_ms: 1,
        render_duration_ms: malformed ? 0 : 1,
        total_duration_ms: malformed ? 1 : 2,
      },
      limit: null,
      sanitizer_version: MERMAID_SANITIZER_VERSION,
      parser_version: MERMAID_VERSION,
    };
    return Promise.resolve(result);
  }

  cancel(): void {}

  suspend(): void {}

  dispose(): void {}
}
