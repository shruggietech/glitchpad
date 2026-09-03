import {
  MERMAID_MAX_ACTIVE_REQUESTS,
  MERMAID_PREVIEW_DEBOUNCE_MS,
  MERMAID_RENDER_TIMEOUT_MS,
  MERMAID_SANITIZER_VERSION,
  MERMAID_VERSION,
  detectMermaidType,
  mermaidSourceBytes,
  type MermaidRenderRequest,
  type MermaidRenderResult,
} from './mermaid-contract';
import type { ResourceOwner } from './resource-ledger';
import type { RendererPerformanceMeasurement } from './performance';

export interface MermaidExecutor {
  execute(request: MermaidRenderRequest, signal: AbortSignal): Promise<MermaidRenderResult>;
}

export const directMermaidExecutor: MermaidExecutor = {
  async execute(request, signal) {
    if (signal.aborted) throw new DOMException('Operation cancelled', 'AbortError');
    const { renderMermaid } = await import('./mermaid-pipeline');
    if (signal.aborted) throw new DOMException('Operation cancelled', 'AbortError');
    const result = await renderMermaid(request);
    if (signal.aborted) throw new DOMException('Operation cancelled', 'AbortError');
    return result;
  },
};

interface ScheduledWork<T> {
  signal: AbortSignal;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  removeAbortListener: () => void;
}

export class MermaidScheduler {
  private active = 0;
  private readonly queue: ScheduledWork<unknown>[] = [];

  constructor(private readonly maximum = MERMAID_MAX_ACTIVE_REQUESTS) {}

  schedule<T>(signal: AbortSignal, run: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Operation cancelled', 'AbortError'));
        return;
      }
      const work: ScheduledWork<unknown> = {
        signal,
        run,
        resolve: resolve as (value: unknown) => void,
        reject,
        removeAbortListener: () => undefined,
      };
      const onAbort = () => {
        const index = this.queue.indexOf(work);
        if (index < 0) return;
        this.queue.splice(index, 1);
        work.removeAbortListener();
        reject(new DOMException('Operation cancelled', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      work.removeAbortListener = () => signal.removeEventListener('abort', onAbort);
      this.queue.push(work);
      this.drain();
    });
  }

  get activeCount(): number {
    return this.active;
  }

  private drain(): void {
    while (this.active < this.maximum && this.queue.length > 0) {
      const work = this.queue.shift();
      if (!work) return;
      work.removeAbortListener();
      if (work.signal.aborted) {
        work.reject(new DOMException('Operation cancelled', 'AbortError'));
        continue;
      }
      this.active += 1;
      void work.run().then(work.resolve, work.reject).finally(() => {
        this.active -= 1;
        this.drain();
      });
    }
  }
}

const sharedScheduler = new MermaidScheduler();

interface ActiveRender {
  generation: number;
  abort: AbortController;
  debounce: ReturnType<typeof setTimeout> | null;
  resolve: (result: MermaidRenderResult | null) => void;
  releaseResources: () => void;
}

export class MermaidRendererClient {
  private generation = 0;
  private active: ActiveRender | null = null;
  private disposed = false;

  constructor(
    private readonly executor: MermaidExecutor = directMermaidExecutor,
    private readonly debounceMs = MERMAID_PREVIEW_DEBOUNCE_MS,
    private readonly timeoutMs = MERMAID_RENDER_TIMEOUT_MS,
    private readonly scheduler = sharedScheduler,
    private readonly resources?: ResourceOwner,
    private readonly onMeasurement?: (measurement: RendererPerformanceMeasurement) => void,
  ) {}

  render(input: Omit<MermaidRenderRequest, 'request_id' | 'sanitizer_version'>): Promise<MermaidRenderResult | null> {
    if (this.disposed) return Promise.resolve(null);
    this.cancel();
    const generation = ++this.generation;
    const request: MermaidRenderRequest = {
      ...input,
      request_id: `${input.owner_id}:${input.source_revision}:${generation}`,
      sanitizer_version: MERMAID_SANITIZER_VERSION,
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
      const active: ActiveRender = { generation, abort, debounce: null, resolve, releaseResources };
      active.debounce = setTimeout(() => {
        active.debounce = null;
        let timedOut = false;
        const timeout = setTimeout(() => {
          timedOut = true;
          abort.abort();
        }, this.timeoutMs);
        releases.push(this.resources?.acquire('timer') ?? (() => undefined));
        void this.scheduler.schedule(abort.signal, () => this.executor.execute(request, abort.signal)).then((result) => {
          clearTimeout(timeout);
          if (!this.isCurrentGeneration(active)) return;
          this.active = null;
          releaseResources();
          if (timedOut) {
            const timeoutResult = this.timeoutResult(request);
            this.publishMeasurement(timeoutResult);
            return resolve(timeoutResult);
          }
          const matches = result.request_id === request.request_id && result.owner_id === request.owner_id && result.source_revision === request.source_revision && result.sanitizer_version === request.sanitizer_version;
          const current = matches ? result : null;
          if (current) this.publishMeasurement(current);
          resolve(current);
        }).catch(() => {
          clearTimeout(timeout);
          if (!this.isCurrentGeneration(active)) return;
          this.active = null;
          releaseResources();
          const failure = timedOut ? this.timeoutResult(request) : this.failureResult(request);
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
    if (active.debounce) clearTimeout(active.debounce);
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

  private isCurrentGeneration(active: ActiveRender): boolean {
    return !this.disposed && this.active === active && this.generation === active.generation;
  }

  private timeoutResult(request: MermaidRenderRequest): MermaidRenderResult {
    return this.failureResult(request, 'limited', 'mermaid_time_limited', 'Diagram rendering exceeded five seconds. Source remains available.', 'time');
  }

  private failureResult(
    request: MermaidRenderRequest,
    status: 'limited' | 'failed' = 'failed',
    code = 'mermaid_internal_failure',
    message = 'Diagram preview failed safely. Source remains available.',
    limit: MermaidRenderResult['limit'] = null,
  ): MermaidRenderResult {
    return {
      request_id: request.request_id,
      owner_id: request.owner_id,
      source_revision: request.source_revision,
      status,
      diagram_type: detectMermaidType(request.source_text),
      svg: null,
      search_text: [],
      diagnostic: { category: status, code, message, line: null, column: null },
      accessibility: { title: null, description: null, label: request.fallback_label, authored_title: false, authored_description: false },
      measurements: { source_bytes: mermaidSourceBytes(request.source_text), edge_count: 0, output_bytes: 0, parse_duration_ms: 0, render_duration_ms: 0, total_duration_ms: status === 'limited' ? this.timeoutMs : 0 },
      limit,
      sanitizer_version: MERMAID_SANITIZER_VERSION,
      parser_version: MERMAID_VERSION,
    };
  }

  private publishMeasurement(result: MermaidRenderResult): void {
    this.onMeasurement?.({
      renderer: 'mermaid',
      owner_id: result.owner_id,
      source_revision: result.source_revision,
      source_bytes: result.measurements.source_bytes,
      duration_ms: result.measurements.total_duration_ms,
      status: result.status,
    });
  }
}
