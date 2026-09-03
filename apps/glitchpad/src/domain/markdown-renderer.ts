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
    if (signal.aborted) throw new DOMException('Operation cancelled', 'AbortError');
    const result = await renderMarkdown(request);
    if (signal.aborted) throw new DOMException('Operation cancelled', 'AbortError');
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
      const worker = new Worker(new URL('./markdown-worker.ts', import.meta.url), {
        type: 'module',
        name: `markdown-${request.session_id}`,
      });
      const releaseWorker = this.resources?.acquire('worker') ?? (() => undefined);
      const finish = () => {
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
      worker.postMessage(request);
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
    private readonly onMeasurement?: (measurement: RendererPerformanceMeasurement) => void,
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
        resolve,
        releaseResources,
      };
      active.timer = setTimeout(() => {
        active.timer = null;
        let timedOut = false;
        const timeout = setTimeout(() => {
          timedOut = true;
          abort.abort();
        }, this.timeoutMs);
        releases.push(this.resources?.acquire('timer') ?? (() => undefined));
        void this.executor
          .execute(request, abort.signal)
          .then((result) => {
            clearTimeout(timeout);
            if (!this.isCurrentGeneration(active)) return;
            this.active = null;
            releaseResources();
            if (timedOut) {
              resolve(this.timeoutResult(request));
              return;
            }
            const matches =
              result.request_id === request.request_id &&
              result.session_id === request.session_id &&
              result.source_revision === request.source_revision &&
              result.sanitizer_version === request.sanitizer_version;
            const current = matches ? result : null;
            if (current) this.publishMeasurement(current);
            resolve(current);
          })
          .catch(() => {
            clearTimeout(timeout);
            if (!this.isCurrentGeneration(active)) return;
            this.active = null;
            releaseResources();
            const failure = this.failureResult(
                request,
                timedOut
                  ? 'Markdown preview timed out safely. Source remains available.'
                  : 'Markdown preview failed safely. Source remains available.',
                timedOut ? this.timeoutMs : 0,
              );
            this.publishMeasurement(failure);
            resolve(failure);
          });
      }, this.debounceMs);
      this.active = active;
    });
  }

  cancel(): void {
    const active = this.active;
    if (!active) return;
    if (active.timer) clearTimeout(active.timer);
    active.abort.abort();
    this.active = null;
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

  private isCurrent(active: ActiveRender): boolean {
    return (
      !this.disposed &&
      this.active === active &&
      this.generation === active.generation &&
      !active.abort.signal.aborted
    );
  }

  private isCurrentGeneration(active: ActiveRender): boolean {
    return !this.disposed && this.active === active && this.generation === active.generation;
  }

  private timeoutResult(request: MarkdownRenderRequest): MarkdownRenderResult {
    return this.failureResult(
      request,
      'Markdown preview timed out safely. Source remains available.',
      this.timeoutMs,
    );
  }

  private failureResult(
    request: MarkdownRenderRequest,
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
      diagnostics: [{ code: 'markdown_parse_failed', message }],
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

  private publishMeasurement(result: MarkdownRenderResult): void {
    this.onMeasurement?.({
      renderer: 'markdown',
      owner_id: result.session_id,
      source_revision: result.source_revision,
      source_bytes: result.measurements.source_bytes,
      duration_ms: result.measurements.parse_duration_ms,
      status: result.status,
    });
  }
}
