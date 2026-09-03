import { describe, expect, it } from 'vitest';

import { sanitizeMermaidSvg } from './mermaid-sanitizer';

describe('Mermaid SVG sanitizer', () => {
  it('removes executable and remote content and rewrites local identifiers', () => {
    const result = sanitizeMermaidSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><image href="https://example.test/x"/><defs><marker id="arrow"><path d="M0 0"/></marker></defs><path id="edge" marker-end="url(#arrow)" style="fill:red;cursor:pointer"/><text>Hello</text></svg>',
      'request:1',
      'Fallback',
    );
    expect(result.svg).not.toMatch(/script|onload|https:|<image|cursor/iu);
    expect(result.svg).toContain('gp-request1-arrow');
    expect(result.svg).toContain('url(#gp-request1-arrow)');
    expect(result.searchText).toContain('Hello');
  });

  it('preserves bounded accessibility text and supplies a fallback', () => {
    const authored = sanitizeMermaidSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><title>Architecture</title><desc>Data flow</desc><text>Node</text></svg>',
      'a11y',
      'Fallback',
    );
    expect(authored.accessibility).toMatchObject({
      title: 'Architecture',
      description: 'Data flow',
      label: 'Architecture',
      authored_title: true,
      authored_description: true,
    });
    const fallback = sanitizeMermaidSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>', 'fallback', 'Diagram one');
    expect(fallback.accessibility.label).toBe('Diagram one');
  });

  it('rejects non-SVG output', () => {
    expect(() => sanitizeMermaidSvg('<div>no</div>', 'bad', 'Fallback')).toThrow('mermaid_invalid_svg');
  });
});
