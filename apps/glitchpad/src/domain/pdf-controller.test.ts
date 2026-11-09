import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PdfSourceLease } from './pdf-contract';
import { PdfController } from './pdf-controller';

const engine = vi.hoisted(() => ({
  getDocument: vi.fn(),
  transports: [] as Array<{
    requestDataRange(begin: number, end: number): void;
  }>,
}));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: engine.getDocument,
  PDFWorker: {
    create: ({ port }: { port: Worker }) => ({
      port,
      promise: Promise.resolve(),
      destroy: vi.fn(),
    }),
  },
  PDFDataRangeTransport: class {
    onDataRange = vi.fn();
    constructor() {
      engine.transports.push(this);
    }
    requestDataRange() {
      throw new Error('Subclass must own range reads');
    }
    abort() {
      /* Overridden by source transport. */
    }
  },
  TextLayer: { cleanup: vi.fn() },
}));
vi.mock('./pdf-document-resources', () => ({
  createPdfDocumentResources: () => ({ document, dispose: vi.fn() }),
}));
class ParserWorker extends EventTarget {
  static instances: ParserWorker[] = [];
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    super();
    ParserWorker.instances.push(this);
    queueMicrotask(() =>
      this.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'glitchpad-pdf-worker-ready',
            version: '6.5.438',
            native_bridge: false,
            code_evaluation_allowed: false,
          },
        }),
      ),
    );
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function lease(
  read: PdfSourceLease['read'] = vi.fn((_offset: number, length: number) =>
    Promise.resolve(new Uint8Array(length)),
  ),
) {
  return {
    length: 8192,
    platform: 'desktop' as const,
    revision: null,
    read,
    close: vi.fn(),
  };
}
function doc() {
  return {
    numPages: 4,
    getMetadata: vi.fn().mockResolvedValue({
      info: { Title: 'Current document' },
      metadata: null,
    }),
    getPermissions: vi.fn().mockResolvedValue(null),
    getOutline: vi.fn().mockResolvedValue([]),
    getPageLabels: vi.fn().mockResolvedValue(['i', 'ii', 'iii', 'iv']),
    getPage: vi.fn().mockResolvedValue({
      rotate: 0,
      getViewport: () => ({ width: 612, height: 792 }),
    }),
  };
}
function load(document: unknown) {
  return {
    promise: Promise.resolve(document),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPassword: null,
  };
}
const controllers: PdfController[] = [];
function controller() {
  const value = new PdfController('owner');
  controllers.push(value);
  return value;
}
beforeEach(() => {
  engine.getDocument.mockReset();
  engine.transports.length = 0;
  ParserWorker.instances.length = 0;
  vi.stubGlobal('Worker', ParserWorker);
});
afterEach(() => {
  for (const value of controllers.splice(0)) value.dispose();
  vi.unstubAllGlobals();
});

describe('PDF controller actual asynchronous ownership', () => {
  it('ignores a late rejected range from a replaced source', async () => {
    const late = deferred<Uint8Array>();
    const first = lease(
      vi.fn((offset: number, length: number) =>
        offset === 0 ? Promise.resolve(new Uint8Array(length)) : late.promise,
      ),
    );
    const next = lease();
    const current = doc();
    engine.getDocument
      .mockReturnValueOnce(load(doc()))
      .mockReturnValueOnce(load(current));
    const value = controller();
    await value.open(first);
    engine.transports[0].requestDataRange(4096, 8192);
    await value.open(next);
    late.reject(new Error('permission_revoked'));
    await vi.waitFor(() => expect(first.close).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(value.state.state).toBe('ready');
    expect(value.document).toBe(current);
    expect(next.close).not.toHaveBeenCalled();
  });
  it('rejects a late load and old worker failure without overwriting the replacement', async () => {
    const oldLoad = deferred<unknown>();
    const current = doc();
    engine.getDocument
      .mockReturnValueOnce({
        promise: oldLoad.promise,
        destroy: vi.fn().mockResolvedValue(undefined),
      })
      .mockReturnValueOnce(load(current));
    const value = controller();
    const pending = value.open(lease());
    await vi.waitFor(() => expect(engine.getDocument).toHaveBeenCalledOnce());
    const oldWorker = ParserWorker.instances[0];
    await value.open(lease());
    oldLoad.resolve(doc());
    oldWorker.dispatchEvent(new Event('error', { cancelable: true }));
    await pending;
    expect(oldWorker.terminate).toHaveBeenCalledOnce();
    expect(value.state.state).toBe('ready');
    expect(value.document).toBe(current);
    expect(value.resourceCounts.workers).toBe(1);
  });
  it('turns a current post-ready worker failure into a disposed failure state', async () => {
    const source = lease();
    engine.getDocument.mockReturnValue(load(doc()));
    const value = controller();
    await value.open(source);
    ParserWorker.instances[0].dispatchEvent(
      new Event('error', { cancelable: true }),
    );
    expect(value.state).toMatchObject({
      state: 'failed',
      error: 'worker_failure',
    });
    expect(value.resourceCounts).toEqual({
      workers: 0,
      surfaces: 0,
      surfaceBytes: 0,
    });
    expect(source.close).toHaveBeenCalledOnce();
  });
  it('cancels a pending search reader on replacement without publishing stale matches', async () => {
    const cancelled = vi.fn();
    const stream = new ReadableStream({ cancel: cancelled });
    const first = doc();
    first.getPage.mockResolvedValue({ streamTextContent: () => stream });
    engine.getDocument
      .mockReturnValueOnce(load(first))
      .mockReturnValueOnce(load(doc()));
    const value = controller();
    await value.open(lease());
    const progress = vi.fn();
    const pending = value.search('old', new AbortController().signal, progress);
    const rejected = expect(pending).rejects.toThrow('cancelled');
    await vi.waitFor(() => expect(first.getPage).toHaveBeenCalledOnce());
    await value.open(lease());
    await rejected;
    expect(cancelled).toHaveBeenCalledOnce();
    expect(progress).not.toHaveBeenCalled();
    expect(value.state.state).toBe('ready');
  });
  it('keeps independent valid metadata when one inspection group fails', async () => {
    const current = doc();
    current.getMetadata.mockRejectedValue(
      new Error('Unreadable document information'),
    );
    engine.getDocument.mockReturnValue(load(current));
    const value = controller();
    await value.open(lease());
    const facts = await value.metadata(0);
    expect(facts.find((fact) => fact.key === 'pdf.title')?.availability).toBe(
      'errored',
    );
    expect(facts.find((fact) => fact.key === 'pdf.pages')?.availability).toBe(
      'available',
    );
    expect(
      facts.find((fact) => fact.key === 'pdf.current_page_label')?.value,
    ).toEqual({ kind: 'text', value: 'i' });
    expect(value.state.state).toBe('ready');
  });
  it('measures actual range reads and keeps late old-source counters out of a replacement', async () => {
    const pending = deferred<Uint8Array>();
    const first = lease(
      vi.fn((offset: number, length: number) =>
        offset === 0
          ? Promise.resolve(new Uint8Array(length))
          : pending.promise,
      ),
    );
    engine.getDocument.mockReturnValue(load(doc()));
    const value = controller();
    await value.open(first);
    engine.transports[0].requestDataRange(4096, 8192);
    engine.transports[0].requestDataRange(4096, 8192);
    expect(value.resourceObservations.range).toMatchObject({
      calls: 3,
      inFlight: 2,
      peakConcurrency: 2,
      maximumRequestBytes: 4096,
      completedBytes: 4096,
    });
    await value.open(lease());
    pending.resolve(new Uint8Array(4096));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(value.resourceObservations.range).toMatchObject({
      calls: 1,
      inFlight: 0,
      peakConcurrency: 1,
      maximumRequestBytes: 4096,
      completedBytes: 4096,
    });
  });
});

it('reports actual decoder image failure and ignores an obsolete worker decode event',async()=>{
 const first=lease(), current=lease();
 engine.getDocument.mockReturnValue(load(doc()));
 const value=controller();
 await value.open(first);
 const old=ParserWorker.instances[0];
 await value.open(current);
 const event=()=>new MessageEvent('message',{data:{type:'glitchpad-pdf-decode-failure'}});
 old.dispatchEvent(event());
 expect(value.state.state).toBe('ready');
 expect(current.close).not.toHaveBeenCalled();
 ParserWorker.instances[1].dispatchEvent(event());
 expect(value.state).toMatchObject({state:'failed',error:'malformed'});
 expect(value.resourceCounts).toEqual({workers:0,surfaces:0,surfaceBytes:0});
 expect(current.close).toHaveBeenCalledOnce();
});
