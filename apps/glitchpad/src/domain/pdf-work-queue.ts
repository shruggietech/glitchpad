import { PdfFailure } from './pdf-contract';
interface Pending {
  signals: readonly AbortSignal[];
  resolve: (release: () => void) => void;
  reject: (error: PdfFailure) => void;
  abort: () => void;
}
/** Bookkeeping is cancelled only after the controller stops the actual worker/canvases. */
export class PdfWorkQueue {
  private active = new Set<() => void>();
  private pending: Pending[] = [];
  constructor(
    private readonly concurrency = 2,
    private readonly maximumPending = 32,
  ) {}
  acquire(signals: readonly AbortSignal[]): Promise<() => void> {
    if (signals.some((signal) => signal.aborted))
      return Promise.reject(new PdfFailure('cancelled'));
    if (this.pending.length >= this.maximumPending)
      return Promise.reject(new PdfFailure('surface_limit'));
    return new Promise((resolve, reject) => {
      const entry: Pending = {
        signals,
        resolve,
        reject,
        abort: () => {
          this.pending = this.pending.filter((item) => item !== entry);
          this.remove(entry);
          reject(new PdfFailure('cancelled'));
        },
      };
      for (const signal of signals)
        signal.addEventListener('abort', entry.abort, { once: true });
      this.pending.push(entry);
      this.pump();
    });
  }
  private remove(entry: Pending): void {
    for (const signal of entry.signals)
      signal.removeEventListener('abort', entry.abort);
  }
  private pump(): void {
    while (this.active.size < this.concurrency && this.pending.length) {
      const entry = this.pending.shift()!;
      this.remove(entry);
      if (entry.signals.some((signal) => signal.aborted)) {
        entry.reject(new PdfFailure('cancelled'));
        continue;
      }
      const release = () => {
        if (this.active.delete(release)) this.pump();
      };
      this.active.add(release);
      entry.resolve(release);
    }
  }
  /** Call after real runtime cancellation; idempotent releases cannot affect another job. */
  cancelledRuntime(): void {
    const pending = this.pending;
    this.pending = [];
    for (const entry of pending) {
      this.remove(entry);
      entry.reject(new PdfFailure('cancelled'));
    }
    for (const release of [...this.active]) release();
  }
  counts(): { active: number; queued: number } {
    return { active: this.active.size, queued: this.pending.length };
  }
}
