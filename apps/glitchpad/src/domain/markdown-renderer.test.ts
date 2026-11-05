import { describe, expect, it, vi } from 'vitest';

import {
  MARKDOWN_SANITIZER_VERSION,
  type MarkdownRenderRequest,
  type MarkdownRenderResult,
} from './markdown-contract';
import {
  MarkdownRendererClient,
  WorkerMarkdownExecutor,
  type MarkdownExecutor,
} from './markdown-renderer';
import { ResourceOwner } from './resource-ledger';

const { workerFactory } = vi.hoisted(() => ({ workerFactory: vi.fn() }));
vi.mock('./markdown-worker?worker', () => ({ default: workerFactory }));

const resultFor = (request: MarkdownRenderRequest): MarkdownRenderResult => ({
  ...request,
  status: 'ready',
  tree: { type: 'root', id: 'root', children: [], source_range: null },
  outline: [],
  search_text: [],
  diagnostics: [],
  measurements: {
    source_bytes: 0,
    parse_duration_ms: 0,
    node_count: 1,
    heading_count: 0,
    search_entry_count: 0,
  },
});

describe('Vite worker factory lifecycle', () => {
  const request: MarkdownRenderRequest = {
    request_id: 'factory',
    session_id: 'factory',
    source_revision: 1,
    source_text: '# Heading',
    sanitizer_version: MARKDOWN_SANITIZER_VERSION,
  };
  const createWorker = () => {
    const worker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null as
        ((event: MessageEvent<MarkdownRenderResult>) => void) | null,
      onerror: null as (() => void) | null,
      onmessageerror: null as (() => void) | null,
    };
    workerFactory.mockReset();
    workerFactory.mockImplementation(function () {
      return worker;
    });
    return worker;
  };
  it('uses the Vite worker factory and releases worker resources after a valid reply', async () => {
    const worker = createWorker();
    const owner = new ResourceOwner('worker-factory');
    const signal = new AbortController();
    const pending = new WorkerMarkdownExecutor(owner).execute(
      request,
      signal.signal,
    );
    worker.onmessage?.({
      data: resultFor(request),
    } as MessageEvent<MarkdownRenderResult>);
    await expect(pending).resolves.toEqual(resultFor(request));
    expect(workerFactory).toHaveBeenCalledExactlyOnceWith({
      name: 'markdown-factory',
    });
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith(request);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(owner.snapshot()?.counts.worker).toBe(0);
    signal.abort();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it.each(['abort', 'error', 'messageerror'])(
    'releases off-thread worker resources after %s',
    async (reason) => {
      const worker = createWorker();
      const owner = new ResourceOwner('worker-error');
      const signal = new AbortController();
      const pending = new WorkerMarkdownExecutor(owner).execute(
        request,
        signal.signal,
      );
      if (reason === 'abort') signal.abort();
      else if (reason === 'error') worker.onerror?.();
      else worker.onmessageerror?.();
      await expect(pending).rejects.toThrow(
        reason === 'abort'
          ? 'Operation cancelled'
          : reason === 'error'
            ? 'Markdown worker failed'
            : 'Markdown worker message failed',
      );
      expect(worker.terminate).toHaveBeenCalledOnce();
      expect(owner.snapshot()?.counts.worker).toBe(0);
    },
  );
});

describe('Markdown renderer scheduling', () => {
  it('collapses one hundred rapid revisions into only the newest execution', async () => {
    vi.useFakeTimers();
    const execute = vi.fn((request: MarkdownRenderRequest) =>
      Promise.resolve(resultFor(request)),
    );
    const client = new MarkdownRendererClient({ execute }, 100, 1_000);
    const revisions = Array.from({ length: 100 }, (_, index) =>
      client.render({
        session_id: 'rapid',
        source_revision: index + 1,
        source_text: `${index + 1}`,
      }),
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
    const executor: MarkdownExecutor = {
      execute: (request) =>
        new Promise((resolve) =>
          pending.push(() => resolve(resultFor(request))),
        ),
    };
    const client = new MarkdownRendererClient(executor, 10, 100);
    const first = client.render({
      session_id: 's',
      source_revision: 1,
      source_text: 'one',
    });
    await vi.advanceTimersByTimeAsync(10);
    const second = client.render({
      session_id: 's',
      source_revision: 2,
      source_text: 'two',
    });
    expect(await first).toBeNull();
    await vi.advanceTimersByTimeAsync(10);
    pending[0]?.(
      resultFor({
        request_id: 'stale',
        session_id: 's',
        source_revision: 1,
        source_text: 'one',
        sanitizer_version: MARKDOWN_SANITIZER_VERSION,
      }),
    );
    pending[1]?.(
      resultFor({
        request_id: 's:2:2',
        session_id: 's',
        source_revision: 2,
        source_text: 'two',
        sanitizer_version: MARKDOWN_SANITIZER_VERSION,
      }),
    );
    await expect(second).resolves.toMatchObject({ source_revision: 2 });
    client.dispose();
    vi.useRealTimers();
  });

  it('returns a safe terminal result when execution times out', async () => {
    vi.useFakeTimers();
    const executor: MarkdownExecutor = {
      execute: (_request, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () =>
            reject(new DOMException('cancelled', 'AbortError')),
          ),
        ),
    };
    const client = new MarkdownRendererClient(executor, 0, 20);
    const rendered = client.render({
      session_id: 's',
      source_revision: 1,
      source_text: 'text',
    });
    await vi.advanceTimersByTimeAsync(21);
    await expect(rendered).resolves.toMatchObject({
      status: 'failed',
      diagnostics: [{ code: 'markdown_render_timeout' }],
    });
    client.dispose();
    vi.useRealTimers();
  });

  it('disposes scheduled work idempotently without executing it', async () => {
    vi.useFakeTimers();
    const execute = vi.fn((request: MarkdownRenderRequest) =>
      Promise.resolve(resultFor(request)),
    );
    const client = new MarkdownRendererClient({ execute }, 100, 1_000);
    const rendered = client.render({
      session_id: 's',
      source_revision: 1,
      source_text: 'text',
    });
    client.dispose();
    client.dispose();
    await vi.runAllTimersAsync();
    expect(await rendered).toBeNull();
    expect(execute).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('rejects mismatched results and redacts executor failures', async () => {
    vi.useFakeTimers();
    const mismatch = new MarkdownRendererClient(
      {
        execute: (request) =>
          Promise.resolve({ ...resultFor(request), source_revision: 999 }),
      },
      0,
      1_000,
    );
    const mismatched = mismatch.render({
      session_id: 's',
      source_revision: 1,
      source_text: 'secret source',
    });
    await vi.runAllTimersAsync();
    expect(await mismatched).toMatchObject({
      status: 'failed',
      diagnostics: [{ code: 'markdown_projection_invalid' }],
    });
    mismatch.dispose();

    const failure = new MarkdownRendererClient(
      {
        execute: () =>
          Promise.reject(new Error('secret source and native path')),
      },
      0,
      1_000,
    );
    const failed = failure.render({
      session_id: 's',
      source_revision: 1,
      source_text: 'secret source',
    });
    await vi.runAllTimersAsync();
    await expect(failed).resolves.toMatchObject({
      status: 'failed',
      diagnostics: [
        {
          code: 'markdown_worker_failed',
          message: 'Markdown preview worker failed. Source remains available.',
        },
      ],
    });
    expect(JSON.stringify(await failed)).not.toContain('secret');
    failure.dispose();
    vi.useRealTimers();
  });

  it('terminates an uncooperative executor at the deadline without leaking a late result', async () => {
    vi.useFakeTimers();
    const settled = vi.fn();
    let complete: ((result: MarkdownRenderResult) => void) | undefined;
    let request: MarkdownRenderRequest | undefined;
    const client = new MarkdownRendererClient(
      {
        execute: (input) => {
          request = input;
          return new Promise((resolve) => {
            complete = resolve;
          });
        },
      },
      0,
      20,
    );
    const rendered = client.render({
      session_id: 'deadline',
      source_revision: 1,
      source_text: 'private',
    });
    void rendered.then(settled);
    await vi.advanceTimersByTimeAsync(21);
    expect(settled).toHaveBeenCalledOnce();
    expect(settled).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failed',
        diagnostics: [
          {
            code: 'markdown_render_timeout',
            message:
              'Markdown preview timed out safely. Source remains available.',
          },
        ],
      }),
    );
    complete?.(resultFor(request!));
    await Promise.resolve();
    expect(settled).toHaveBeenCalledOnce();
    client.dispose();
    vi.useRealTimers();
  });

  it('contains synchronous executor throws and malformed current replies as terminal failures', async () => {
    vi.useFakeTimers();
    for (const execute of [
      () => {
        throw new Error('private document path');
      },
      () => Promise.resolve(null as unknown as MarkdownRenderResult),
    ]) {
      const client = new MarkdownRendererClient({ execute }, 0, 20);
      const result = client.render({
        session_id: 'invalid',
        source_revision: 1,
        source_text: 'private',
      });
      await vi.advanceTimersByTimeAsync(1);
      expect(await result).toMatchObject({ status: 'failed' });
      expect(JSON.stringify(await result)).not.toContain('private');
      client.dispose();
    }
    vi.useRealTimers();
  });

  it('publishes content-free measurements for current results only', async () => {
    const measurements = vi.fn();
    const client = new MarkdownRendererClient(
      { execute: (request) => Promise.resolve(resultFor(request)) },
      0,
      1_000,
      undefined,
      measurements,
    );
    await client.render({
      session_id: 'measured',
      source_revision: 2,
      source_text: 'private source',
    });
    expect(measurements).toHaveBeenCalledWith({
      renderer: 'markdown',
      owner_id: 'measured',
      source_revision: 2,
      source_bytes: 0,
      duration_ms: 0,
      status: 'ready',
    });
    expect(JSON.stringify(measurements.mock.calls)).not.toContain(
      'private source',
    );
    client.dispose();
  });
});
