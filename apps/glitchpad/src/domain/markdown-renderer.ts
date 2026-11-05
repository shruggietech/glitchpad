import MarkdownWorker from './markdown-worker?worker';
import { consumeRecoveryProbe } from './recovery-probes';
import {
  MARKDOWN_PREVIEW_DEBOUNCE_MS,
  MARKDOWN_RENDER_TIMEOUT_MS,
  MARKDOWN_SANITIZER_VERSION,
  type MarkdownRenderRequest,
  type MarkdownRenderResult,
} from './markdown-contract';
import { renderMarkdown } from './markdown-pipeline';
import type { ResourceOwner } from './resource-ledger';
import type { RendererPerformanceMeasurement } from './performance';

export interface MarkdownExecutor {
  execute(
    request: MarkdownRenderRequest,
    signal: AbortSignal,
  ): Promise<MarkdownRenderResult>;
}

export const directMarkdownExecutor: MarkdownExecutor = {
  async execute(request, signal) {
    if (signal.aborted)
      throw new DOMException('Operation cancelled', 'AbortError');
    const result = await renderMarkdown(request);
    if (signal.aborted)
      throw new DOMException('Operation cancelled', 'AbortError');
    return result;
  },
};

export class WorkerMarkdownExecutor implements MarkdownExecutor {
  constructor(private readonly resources?: ResourceOwner) {}

  execute(
    request: MarkdownRenderRequest,
    signal: AbortSignal,
  ): Promise<MarkdownRenderResult> {
    return new Promise((resolve, reject) => {
      const worker = new MarkdownWorker({
        name: `markdown-${request.session_id}`,
      });
      const releaseWorker =
        this.resources?.acquire('worker') ?? (() => undefined);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        signal.removeEventListener('abort', cancel);
        worker.terminate();
        releaseWorker();
      };
      const cancel = () => {
        finish();
        reject(new DOMException('Operation cancelled', 'AbortError'));
      };
      signal.addEventListener('abort', cancel, { once: true });
      worker.onmessage = (event: MessageEvent<MarkdownRenderResult>) => {
        finish();
        resolve(event.data);
      };
      worker.onerror = () => {
        finish();
        reject(new Error('Markdown worker failed'));
      };
      worker.onmessageerror = () => {
        finish();
        reject(new Error('Markdown worker message failed'));
      };
      try {
        worker.postMessage(request);
      } catch {
        finish();
        reject(new Error('Markdown worker request failed'));
      }
    });
  }
}

const defaultExecutor = (resources?: ResourceOwner): MarkdownExecutor =>
  typeof Worker === 'undefined'
    ? directMarkdownExecutor
    : new WorkerMarkdownExecutor(resources);

interface ActiveRender {
  generation: number;
  abort: AbortController;
  timer: ReturnType<typeof setTimeout> | null;
  deadline: ReturnType<typeof setTimeout> | null;
  resolve: (result: MarkdownRenderResult | null) => void;
  releaseResources: () => void;
}

export class MarkdownRendererClient {
  private generation = 0;
  private active: ActiveRender | null = null;
  private disposed = false;

  private readonly executor: MarkdownExecutor;

  constructor(
    executor?: MarkdownExecutor,
    private readonly debounceMs = MARKDOWN_PREVIEW_DEBOUNCE_MS,
    private readonly timeoutMs = MARKDOWN_RENDER_TIMEOUT_MS,
    private readonly resources?: ResourceOwner,
    private readonly onMeasurement?: (
      measurement: RendererPerformanceMeasurement,
    ) => void,
  ) {
    this.executor = executor ?? defaultExecutor(resources);
  }

  render(
    input: Omit<MarkdownRenderRequest, 'request_id' | 'sanitizer_version'>,
  ): Promise<MarkdownRenderResult | null> {
    if (this.disposed) return Promise.resolve(null);
    this.cancel();
    const generation = ++this.generation;
    const request: MarkdownRenderRequest = {
      ...input,
      request_id: `${input.session_id}:${input.source_revision}:${generation}`,
      sanitizer_version: MARKDOWN_SANITIZER_VERSION,
    };
    return new Promise((resolve) => {
      const abort = new AbortController();
      const releases = [
        this.resources?.acquire('callback') ?? (() => undefined),
        this.resources?.acquire('timer') ?? (() => undefined),
      ];
      let released = false;
      const releaseResources = () => {
        if (released) return;
        released = true;
        releases.forEach((release) => release());
      };
      const active: ActiveRender = {
        generation,
        abort,
        timer: null,
        deadline: null,
        resolve,
        releaseResources,
      };
      const settle = (result: MarkdownRenderResult) => {
        if (!this.isCurrentGeneration(active)) return;
        if (active.deadline !== null) clearTimeout(active.deadline);
        this.active = null;
        releaseResources();
        this.publishMeasurement(result);
        resolve(result);
      };
      active.timer = setTimeout(() => {
        active.timer = null;
        active.deadline = setTimeout(() => {
          // Settle independently of executor cancellation. A wedged executor must
          // not leave the document pending forever or commit a late result.
          settle(this.timeoutResult(request));
          abort.abort();
        }, this.timeoutMs);
        releases.push(this.resources?.acquire('timer') ?? (() => undefined));
        void Promise.resolve()
          .then(() => {
            if (consumeRecoveryProbe('worker'))
              throw new Error('injected_worker_failure');
            if (consumeRecoveryProbe('parser'))
              request.failure_probe = 'parser';
            return this.executor.execute(request, abort.signal);
          })
          .then((result) => {
            if (!this.isCurrentGeneration(active)) return;
            const matches = this.validResult(result, request);
            settle(
              matches
                ? result
                : this.failureResult(
                    request,
                    'markdown_projection_invalid',
                    'Markdown preview returned an invalid projection. Source remains available.',
                    0,
                  ),
            );
          })
          .catch(() => {
            settle(
              this.failureResult(
                request,
                'markdown_worker_failed',
                'Markdown preview worker failed. Source remains available.',
                0,
              ),
            );
          });
      }, this.debounceMs);
      this.active = active;
    });
  }

  cancel(): void {
    const active = this.active;
    if (!active) return;
    if (active.timer !== null) clearTimeout(active.timer);
    if (active.deadline !== null) clearTimeout(active.deadline);
    this.active = null;
    active.abort.abort();
    active.releaseResources();
    active.resolve(null);
  }

  suspend(): void {
    this.cancel();
    this.resources?.suspend();
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel();
    this.disposed = true;
    this.resources?.dispose();
  }

  private isCurrentGeneration(active: ActiveRender): boolean {
    return (
      !this.disposed &&
      this.active === active &&
      this.generation === active.generation
    );
  }

  private timeoutResult(request: MarkdownRenderRequest): MarkdownRenderResult {
    return this.failureResult(
      request,
      'markdown_render_timeout',
      'Markdown preview timed out safely. Source remains available.',
      this.timeoutMs,
    );
  }

  private failureResult(
    request: MarkdownRenderRequest,
    code: MarkdownRenderResult['diagnostics'][number]['code'],
    message: string,
    durationMs: number,
  ): MarkdownRenderResult {
    return {
      request_id: request.request_id,
      session_id: request.session_id,
      source_revision: request.source_revision,
      status: 'failed',
      tree: null,
      outline: [],
      search_text: [],
      diagnostics: [{ code, message }],
      measurements: {
        source_bytes: new TextEncoder().encode(request.source_text).byteLength,
        parse_duration_ms: durationMs,
        node_count: 0,
        heading_count: 0,
        search_entry_count: 0,
      },
      sanitizer_version: MARKDOWN_SANITIZER_VERSION,
    };
  }

  private validResult(
    result: MarkdownRenderResult,
    request: MarkdownRenderRequest,
  ): boolean {
    return Boolean(
      result &&
      result.request_id === request.request_id &&
      result.session_id === request.session_id &&
      result.source_revision === request.source_revision &&
      result.sanitizer_version === request.sanitizer_version &&
      ['ready', 'empty', 'limited', 'cancelled', 'failed'].includes(
        result.status,
      ) &&
      Array.isArray(result.outline) &&
      Array.isArray(result.search_text) &&
      Array.isArray(result.diagnostics) &&
      result.measurements &&
      Object.values(result.measurements).every(
        (value) =>
          typeof value === 'number' && Number.isFinite(value) && value >= 0,
      ) &&
      (result.tree === null ||
        (result.tree.type === 'root' && Array.isArray(result.tree.children))) &&
      (!['ready', 'empty'].includes(result.status) || result.tree !== null),
    );
  }

  private publishMeasurement(result: MarkdownRenderResult): void {
    try {
      this.onMeasurement?.({
        renderer: 'markdown',
        owner_id: result.session_id,
        source_revision: result.source_revision,
        source_bytes: result.measurements.source_bytes,
        duration_ms: result.measurements.parse_duration_ms,
        status: result.status,
      });
    } catch {
      /* Observability must not interrupt the terminal render result. */
    }
  }
}
