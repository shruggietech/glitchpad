import { describe, expect, it, vi } from 'vitest';

import { MERMAID_SANITIZER_VERSION, MERMAID_VERSION, type MermaidRenderRequest, type MermaidRenderResult } from './mermaid-contract';
import { MermaidRendererClient, MermaidScheduler, type MermaidExecutor } from './mermaid-adapter';

const ready = (request: MermaidRenderRequest): MermaidRenderResult => ({
  request_id: request.request_id,
  owner_id: request.owner_id,
  source_revision: request.source_revision,
  status: 'ready',
  diagram_type: 'flowchart',
  svg: '<svg/>',
  search_text: [],
  diagnostic: null,
  accessibility: { title: null, description: null, label: request.fallback_label, authored_title: false, authored_description: false },
  measurements: { source_bytes: 1, edge_count: 0, output_bytes: 6, parse_duration_ms: 0, render_duration_ms: 0, total_duration_ms: 0 },
  limit: null,
  sanitizer_version: MERMAID_SANITIZER_VERSION,
  parser_version: MERMAID_VERSION,
});

const input = (revision: number) => ({ owner_id: 'owner', source_revision: revision, source_text: 'flowchart TB\nA-->B', fallback_label: 'Diagram', theme: 'light' as const });

describe('Mermaid renderer client', () => {
  it('commits only the newest of one hundred rapid revisions', async () => {
    vi.useFakeTimers();
    const executor: MermaidExecutor = { execute: (request) => Promise.resolve(ready(request)) };
    const client = new MermaidRendererClient(executor, 300, 5_000, new MermaidScheduler(2));
    const pending = Array.from({ length: 100 }, (_, index) => client.render(input(index + 1)));
    await vi.advanceTimersByTimeAsync(300);
    const results = await Promise.all(pending);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.at(-1)?.source_revision).toBe(100);
    vi.useRealTimers();
  });

  it('rejects mismatched result identities', async () => {
    const executor: MermaidExecutor = { execute: (request) => Promise.resolve({ ...ready(request), owner_id: 'other' }) };
    const client = new MermaidRendererClient(executor, 0, 5_000, new MermaidScheduler(2));
    await expect(client.render(input(1))).resolves.toBeNull();
  });

  it('bounds active scheduler work', async () => {
    const scheduler = new MermaidScheduler(2);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const first = scheduler.schedule(new AbortController().signal, () => gate);
    const second = scheduler.schedule(new AbortController().signal, () => gate);
    const third = scheduler.schedule(new AbortController().signal, () => Promise.resolve());
    expect(scheduler.activeCount).toBe(2);
    release();
    await Promise.all([first, second, third]);
    expect(scheduler.activeCount).toBe(0);
  });

  it('removes cancelled work before it reaches the executor', async () => {
    const scheduler = new MermaidScheduler(1);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const first = scheduler.schedule(new AbortController().signal, () => gate);
    const queuedAbort = new AbortController();
    const queuedRun = vi.fn(() => Promise.resolve());
    const queued = scheduler.schedule(queuedAbort.signal, queuedRun);
    queuedAbort.abort();
    await expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    release();
    await first;
    expect(queuedRun).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(scheduler.activeCount).toBe(0));
  });

  it('publishes content-free measurements for current results only', async () => {
    const measurements = vi.fn();
    const executor: MermaidExecutor = { execute: (request) => Promise.resolve(ready(request)) };
    const client = new MermaidRendererClient(executor, 0, 5_000, new MermaidScheduler(1), undefined, measurements);
    await client.render(input(3));
    expect(measurements).toHaveBeenCalledWith({
      renderer: 'mermaid', owner_id: 'owner', source_revision: 3,
      source_bytes: 1, duration_ms: 0, status: 'ready',
    });
    expect(JSON.stringify(measurements.mock.calls)).not.toContain('flowchart');
    client.dispose();
  });
});
