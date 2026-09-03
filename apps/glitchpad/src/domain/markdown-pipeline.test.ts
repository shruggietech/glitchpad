import { describe, expect, it } from 'vitest';

import { MARKDOWN_RENDER_MAX_BYTES, MARKDOWN_SANITIZER_VERSION, findRenderedMatches } from './markdown-contract';
import { renderMarkdown } from './markdown-pipeline';

const request = (source_text: string, sanitizer_version: number = MARKDOWN_SANITIZER_VERSION) => ({
  request_id: 'request-1',
  session_id: 'session-1',
  source_revision: 7,
  source_text,
  sanitizer_version,
});

describe('safe Markdown projection', () => {
  it('projects CommonMark, GFM, footnotes, headings, and exact source positions', async () => {
    const result = await renderMarkdown(request('# Title\n\n- [x] task\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nNote[^1].\n\n[^1]: detail'));
    expect(result.status).toBe('ready');
    expect(result.outline[0]).toMatchObject({ label: 'Title', level: 1, source_range: { start_line: 1 } });
    expect(JSON.stringify(result.tree)).toContain('task-list-item');
    expect(JSON.stringify(result.tree)).toContain('footnote');
    expect(result.search_text.some(({ text }) => text.includes('detail'))).toBe(true);
  });

  it('renders authored HTML as inert text and classifies destinations', async () => {
    const source = '<script>alert(1)</script>\n\n[go](javascript:alert(1)) ![remote](https://tracker.example/pixel)';
    const result = await renderMarkdown(request(source));
    const projected = JSON.stringify(result.tree);
    expect(projected).toContain('<script>alert(1)</script>');
    expect(projected).not.toContain('"tag_name":"script"');
    expect(projected).toContain('target_scheme');
    expect(projected).toContain('remote_resource_blocked');
  });

  it('creates stable unique slugs for duplicate headings', async () => {
    const first = await renderMarkdown(request('# Same\n\n# Same'));
    const second = await renderMarkdown(request('# Same\n\n# Same'));
    expect(first.outline.map(({ id }) => id)).toEqual(['same', 'same-2']);
    expect(second.outline).toEqual(first.outline);
  });

  it('rejects policy mismatch and oversized previews without parsing', async () => {
    await expect(renderMarkdown(request('ok', 99))).resolves.toMatchObject({ status: 'failed' });
    await expect(renderMarkdown(request('x'.repeat(MARKDOWN_RENDER_MAX_BYTES + 1)))).resolves.toMatchObject({ status: 'limited' });
  });

  it('caps rendered search results deterministically', () => {
    const matches = findRenderedMatches([{ node_id: 'n1', text: 'x'.repeat(2_000), source_range: null }], 'x');
    expect(matches).toHaveLength(1_000);
    expect(matches.at(-1)?.start).toBe(999);
    expect(findRenderedMatches([{ node_id: 'unicode', text: 'CAFÉ', source_range: null }], 'café')).toHaveLength(1);
  });

  it('returns an intentional empty state', async () => {
    await expect(renderMarkdown(request(''))).resolves.toMatchObject({
      status: 'empty',
      diagnostics: [{ code: 'markdown_empty' }],
    });
  });

  it('fails closed when the projected tree exceeds its depth budget', async () => {
    const deeplyNested = `${'> '.repeat(300)}bounded`;
    const result = await renderMarkdown(request(deeplyNested));
    expect(result).toMatchObject({
      status: 'limited',
      diagnostics: [{ code: 'markdown_output_limited' }],
      tree: null,
    });
    expect(JSON.stringify(result.diagnostics)).not.toContain(deeplyNested);
  });
});
