import {
  MARKDOWN_PREVIEW_DEBOUNCE_MS,
  MARKDOWN_RENDER_TIMEOUT_MS,
  MARKDOWN_SANITIZER_VERSION,
  type MarkdownRenderRequest,
  type MarkdownRenderResult,
} from './markdown-contract';
import { renderMarkdown } from './markdown-pipeline';

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
  execute(
    request: MarkdownRenderRequest,
    signal: AbortSignal,
  ): Promise<MarkdownRenderResult> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./markdown-worker.ts', import.meta.url), {
        type: 'module',
        name: `markdown-${request.session_id}`,
      });
      const finish = () => {
        signal.removeEventListener('abort', cancel);
        worker.terminate();
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

const defaultExecutor = (): MarkdownExecutor =>
  typeof Worker === 'undefined'
    ? directMarkdownExecutor
    : new WorkerMarkdownExecutor();

interface ActiveRender {
  generation: number;
  abort: AbortController;
  timer: ReturnType<typeof setTimeout> | null;
  resolve: (result: MarkdownRenderResult | null) => void;
}

export class MarkdownRendererClient {
  private generation = 0;
  private active: ActiveRender | null = null;
  private disposed = false;

  constructor(
    private readonly executor: MarkdownExecutor = defaultExecutor(),
    private readonly debounceMs = MARKDOWN_PREVIEW_DEBOUNCE_MS,
    private readonly timeoutMs = MARKDOWN_RENDER_TIMEOUT_MS,
  ) {}

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
      const active: ActiveRender = {
        generation,
        abort,
        timer: null,
        resolve,
      };
      active.timer = setTimeout(() => {
        active.timer = null;
        let timedOut = false;
        const timeout = setTimeout(() => {
          timedOut = true;
          abort.abort();
        }, this.timeoutMs);
        void this.executor
          .execute(request, abort.signal)
          .then((result) => {
            clearTimeout(timeout);
            if (!this.isCurrentGeneration(active)) return;
            this.active = null;
            if (timedOut) {
              resolve(this.timeoutResult(request));
              return;
            }
            const matches =
              result.request_id === request.request_id &&
              result.session_id === request.session_id &&
              result.source_revision === request.source_revision &&
              result.sanitizer_version === request.sanitizer_version;
            resolve(matches ? result : null);
          })
          .catch(() => {
            clearTimeout(timeout);
            if (!this.isCurrentGeneration(active)) return;
            this.active = null;
            resolve(
              this.failureResult(
                request,
                timedOut
                  ? 'Markdown preview timed out safely. Source remains available.'
                  : 'Markdown preview failed safely. Source remains available.',
                timedOut ? this.timeoutMs : 0,
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
    if (active.timer) clearTimeout(active.timer);
    active.abort.abort();
    this.active = null;
    active.resolve(null);
  }

  suspend(): void {
    this.cancel();
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel();
    this.disposed = true;
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
}
