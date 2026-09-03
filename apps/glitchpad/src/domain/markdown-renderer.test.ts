import { describe, expect, it, vi } from 'vitest';

import { MARKDOWN_SANITIZER_VERSION, type MarkdownRenderRequest, type MarkdownRenderResult } from './markdown-contract';
import { MarkdownRendererClient, type MarkdownExecutor } from './markdown-renderer';

const resultFor = (request: MarkdownRenderRequest): MarkdownRenderResult => ({
  ...request,
  status: 'ready',
  tree: { type: 'root', id: 'root', children: [], source_range: null },
  outline: [],
  search_text: [],
  diagnostics: [],
  measurements: { source_bytes: 0, parse_duration_ms: 0, node_count: 1, heading_count: 0, search_entry_count: 0 },
});

describe('Markdown renderer scheduling', () => {
  it('collapses one hundred rapid revisions into only the newest execution', async () => {
    vi.useFakeTimers();
    const execute = vi.fn((request: MarkdownRenderRequest) => Promise.resolve(resultFor(request)));
    const client = new MarkdownRendererClient({ execute }, 100, 1_000);
    const revisions = Array.from({ length: 100 }, (_, index) =>
      client.render({ session_id: 'rapid', source_revision: index + 1, source_text: `${index + 1}` }),
    );
    await vi.advanceTimersByTimeAsync(100);
    const settled = await Promise.all(revisions);
    expect(execute).toHaveBeenCalledOnce();
    expect(settled.slice(0, -1).every((value) => value === null)).toBe(true);
    expect(settled.at(-1)).toMatchObject({ source_revision: 100 });
    client.dispose();
    vi.useRealTimers();
  });

  it('cancels superseded work and cannot commit a stale result', async () => {
    vi.useFakeTimers();
    const pending: Array<(result: MarkdownRenderResult) => void> = [];
    const executor: MarkdownExecutor = { execute: (request) => new Promise((resolve) => pending.push(() => resolve(resultFor(request)))) };
    const client = new MarkdownRendererClient(executor, 10, 100);
    const first = client.render({ session_id: 's', source_revision: 1, source_text: 'one' });
    await vi.advanceTimersByTimeAsync(10);
    const second = client.render({ session_id: 's', source_revision: 2, source_text: 'two' });
    expect(await first).toBeNull();
    await vi.advanceTimersByTimeAsync(10);
    pending[0]?.(resultFor({ request_id: 'stale', session_id: 's', source_revision: 1, source_text: 'one', sanitizer_version: MARKDOWN_SANITIZER_VERSION }));
    pending[1]?.(resultFor({ request_id: 's:2:2', session_id: 's', source_revision: 2, source_text: 'two', sanitizer_version: MARKDOWN_SANITIZER_VERSION }));
    await expect(second).resolves.toMatchObject({ source_revision: 2 });
    client.dispose();
    vi.useRealTimers();
  });

  it('returns a safe terminal result when execution times out', async () => {
    vi.useFakeTimers();
    const executor: MarkdownExecutor = { execute: (_request, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')))) };
    const client = new MarkdownRendererClient(executor, 0, 20);
    const rendered = client.render({ session_id: 's', source_revision: 1, source_text: 'text' });
    await vi.advanceTimersByTimeAsync(21);
    await expect(rendered).resolves.toMatchObject({ status: 'failed', diagnostics: [{ code: 'markdown_parse_failed' }] });
    client.dispose();
    vi.useRealTimers();
  });

  it('disposes scheduled work idempotently without executing it', async () => {
    vi.useFakeTimers();
    const execute = vi.fn((request: MarkdownRenderRequest) => Promise.resolve(resultFor(request)));
    const client = new MarkdownRendererClient({ execute }, 100, 1_000);
    const rendered = client.render({ session_id: 's', source_revision: 1, source_text: 'text' });
    client.dispose();
    client.dispose();
    await vi.runAllTimersAsync();
    expect(await rendered).toBeNull();
    expect(execute).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('rejects mismatched results and redacts executor failures', async () => {
    vi.useFakeTimers();
    const mismatch = new MarkdownRendererClient({
      execute: (request) => Promise.resolve({ ...resultFor(request), source_revision: 999 }),
    }, 0, 1_000);
    const mismatched = mismatch.render({ session_id: 's', source_revision: 1, source_text: 'secret source' });
    await vi.runAllTimersAsync();
    expect(await mismatched).toBeNull();
    mismatch.dispose();

    const failure = new MarkdownRendererClient({
      execute: () => Promise.reject(new Error('secret source and native path')),
    }, 0, 1_000);
    const failed = failure.render({ session_id: 's', source_revision: 1, source_text: 'secret source' });
    await vi.runAllTimersAsync();
    await expect(failed).resolves.toMatchObject({
      status: 'failed',
      diagnostics: [{
        code: 'markdown_parse_failed',
        message: 'Markdown preview failed safely. Source remains available.',
      }],
    });
    expect(JSON.stringify(await failed)).not.toContain('secret');
    failure.dispose();
    vi.useRealTimers();
  });

  it('publishes content-free measurements for current results only', async () => {
    const measurements = vi.fn();
    const client = new MarkdownRendererClient({ execute: (request) => Promise.resolve(resultFor(request)) }, 0, 1_000, undefined, measurements);
    await client.render({ session_id: 'measured', source_revision: 2, source_text: 'private source' });
    expect(measurements).toHaveBeenCalledWith({
      renderer: 'markdown', owner_id: 'measured', source_revision: 2,
      source_bytes: 0, duration_ms: 0, status: 'ready',
    });
    expect(JSON.stringify(measurements.mock.calls)).not.toContain('private source');
    client.dispose();
  });
});
