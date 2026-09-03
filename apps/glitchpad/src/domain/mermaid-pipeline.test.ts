import { describe, expect, it } from 'vitest';

import { MERMAID_SANITIZER_VERSION, type MermaidRenderRequest } from './mermaid-contract';
import { renderMermaid } from './mermaid-pipeline';

const request = (source: string): MermaidRenderRequest => ({
  request_id: 'pipeline-test',
  owner_id: 'owner',
  source_revision: 1,
  source_text: source,
  fallback_label: 'Test diagram',
  theme: 'light',
  sanitizer_version: MERMAID_SANITIZER_VERSION,
});

describe('Mermaid pipeline', () => {
  it('renders a valid diagram into sanitized inert SVG', async () => {
    const result = await renderMermaid(request('flowchart TB\n  A --> B'));
    expect(result.status).toBe('ready');
    expect(result.svg).toMatch(/^<svg/iu);
    expect(result.svg).not.toMatch(/<script|<foreignObject|\son[a-z]+=/iu);
  });

  it('classifies empty, unsupported, malformed, and policy mismatch results', async () => {
    expect((await renderMermaid(request(''))).status).toBe('empty');
    expect((await renderMermaid(request('not a diagram'))).status).toBe('unsupported');
    expect((await renderMermaid(request('flowchart TB\n A -->'))).status).toBe('malformed');
    expect((await renderMermaid({ ...request('flowchart TB\nA-->B'), sanitizer_version: 999 })).diagnostic?.code).toBe('mermaid_policy_mismatch');
  });

  it('blocks authored configuration without mutating source', async () => {
    const source = '%%{init: {"securityLevel":"loose"}}%%\nflowchart LR\nA-->B';
    const result = await renderMermaid(request(source));
    expect(result.status).toBe('unsupported');
    expect(result.diagnostic?.code).toBe('mermaid_configuration_blocked');
  });
});
