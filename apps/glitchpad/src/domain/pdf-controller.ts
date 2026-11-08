import 'core-js/stable';
import {
  getDocument,
  PDFWorker,
  PDFDataRangeTransport,
  TextLayer,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PdfBinaryDataFactory } from './pdf-resources';
import { normalizePdfPostMessage } from './pdf-compatibility';
import { createPdfDocumentResources } from './pdf-document-resources';
import { PdfWorkQueue } from './pdf-work-queue';
import { pdfMetadataFacts } from './pdf-metadata';
import {
  boundedOutline,
  destinationShape,
  destinationPoint,
  pageMatches,
} from './pdf-navigation';
import type { PdfInternalTarget, PdfSearchMatch } from './pdf-contract';
import {
  assertPdfPages,
  assertPdfSource,
  classifyPdfFailure,
  initialPdfState,
  pdfCapabilities,
  pdfSurfaceBytes,
  PDF_ENGINE_VERSION,
  PDF_LIMITS,
  PdfFailure,
  type PdfDocumentState,
  type PdfNavigation,
  type PdfSourceLease,
} from './pdf-contract';

export interface PdfPageSurface {
  width: number;
  height: number;
  bytes: number;
  dispose(): void;
}
type Listener = (state: PdfDocumentState) => void;

class SourceRangeTransport extends PDFDataRangeTransport {
  private inFlight = 0;
  private queue: Array<{ begin: number; end: number }> = [];
  private stopped = false;
  constructor(
    private readonly lease: PdfSourceLease,
    initial: Uint8Array,
    private readonly signal: AbortSignal,
    private readonly fail: (error: unknown) => void,
  ) {
    super(lease.length, initial, true);
  }
  override requestDataRange(begin: number, end: number): void {
    if (this.stopped || this.signal.aborted) return;
    if (
      !Number.isSafeInteger(begin) ||
      !Number.isSafeInteger(end) ||
      begin < 0 ||
      end <= begin ||
      end > this.lease.length ||
      this.queue.length >= 64
    ) {
      this.fail(new PdfFailure('malformed'));
      return;
    }
    this.queue.push({ begin, end });
    this.pump();
  }
  private pump(): void {
    while (
      !this.stopped &&
      this.inFlight < PDF_LIMITS.rangeConcurrency &&
      this.queue.length
    ) {
      const range = this.queue.shift()!;
      this.inFlight += 1;
      void this.read(range.begin, range.end)
        .catch(this.fail)
        .finally(() => {
          this.inFlight -= 1;
          this.pump();
        });
    }
  }
  private async read(begin: number, end: number): Promise<void> {
    for (let offset = begin; offset < end; offset += PDF_LIMITS.rangeBytes) {
      if (this.stopped || this.signal.aborted) return;
      const bytes = await this.lease.read(
        offset,
        Math.min(PDF_LIMITS.rangeBytes, end - offset),
        this.signal,
      );
      if (this.stopped || this.signal.aborted) return;
      this.onDataRange(offset, bytes);
    }
  }
  override abort(): void {
    this.stopped = true;
    this.queue = [];
  }
}

/** Owns one actual worker/source revision. The UI never releases accounting ahead of these resources. */
export class PdfController {
  state: PdfDocumentState;
  document: PDFDocumentProxy | null = null;
  workerReady = false;
  private printAvailable = false;
  private navigationCache: Promise<{rows:import('./pdf-navigation').PdfOutlineRow[];limited:boolean;labels:string[]}> | null = null;
  private nativeWorker: Worker | null = null;
  private parserWorker: PDFWorker | null = null;
  private loading: PDFDocumentLoadingTask | null = null;
  private source: PdfSourceLease | null = null;
  private documentResources: ReturnType<
    typeof createPdfDocumentResources
  > | null = null;
  private aborter = new AbortController();
  private generation = 0;
  private listeners = new Set<Listener>();
  private surfaces = new Set<() => void>();
  private surfaceBytes = 0;
  private readonly renders = new PdfWorkQueue();
  private passwordContinuation: ((password: string) => void) | null = null;

  constructor(ownerId: string, navigation?: PdfNavigation) {
    this.state = initialPdfState(ownerId);
    if (navigation) this.state.navigation = { ...navigation };
  }
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
  private publish(patch: Partial<PdfDocumentState>): void {
    this.state = { ...this.state, ...patch };
    this.state.capabilities = pdfCapabilities(
      this.state.state,
      this.state.reduced_cache,
      this.printAvailable,
    );
    for (const listener of this.listeners) listener(this.state);
  }
  private current(generation: number): void {
    if (generation !== this.generation || this.aborter.signal.aborted)
      throw new PdfFailure('cancelled');
  }
  private fail(error: unknown): void {
    if (this.aborter.signal.aborted) return;
    const code = classifyPdfFailure(error);
    this.release();
    this.publish({
      state: code === 'cancelled' ? 'cancelled' : 'failed',
      error: code,
    });
  }

  async open(source: PdfSourceLease): Promise<void> {
    this.release();
    this.source = source;
    this.aborter = new AbortController();
    const generation = ++this.generation;
    this.publish({ state: 'loading', error: null });
    try {
      assertPdfSource(source.length, source.platform);
      const worker = new Worker(new URL('./pdf-worker.ts', import.meta.url), {
        name: 'glitchpad-pdf',
      });
      normalizePdfPostMessage(worker);
      this.nativeWorker = worker;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.removeEventListener('message', ready);
          reject(new PdfFailure('worker_failure'));
        }, 10000);
        const ready = (event: MessageEvent<unknown>) => {
          const data = event.data as {
            type?: unknown;
            version?: unknown;
            native_bridge?: unknown;
            code_evaluation_allowed?: unknown;
          };
          if (data?.type !== 'glitchpad-pdf-worker-ready') return;
          clearTimeout(timeout);
          worker.removeEventListener('message', ready);
          if (
            data.version !== PDF_ENGINE_VERSION ||
            data.native_bridge !== false || data.code_evaluation_allowed !== false
          )
            reject(new PdfFailure('worker_failure'));
          else resolve();
        };
        worker.addEventListener('message', ready);
        worker.addEventListener(
          'error',
          () => {
            clearTimeout(timeout);
            reject(new PdfFailure('worker_failure'));
          },
          { once: true },
        );
        this.aborter.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timeout);
            reject(new PdfFailure('cancelled'));
          },
          { once: true },
        );
      });
      this.current(generation);
      this.workerReady = true;
      const parserWorker = PDFWorker.create({ port: worker });
      this.parserWorker = parserWorker;
      await parserWorker.promise;
      this.current(generation);
      if (parserWorker.port !== worker) throw new PdfFailure('worker_failure');
      const initial = await source.read(
        0,
        Math.min(source.length, 4096),
        this.aborter.signal,
      );
      this.current(generation);
      const range = new SourceRangeTransport(
        source,
        initial,
        this.aborter.signal,
        (error) => this.fail(error),
      );
      this.documentResources = createPdfDocumentResources(globalThis.document);
      const loading = getDocument({
        ownerDocument: this.documentResources.document,
        range,
        worker: parserWorker,
        rangeChunkSize: 65536,
        disableAutoFetch: true,
        disableStream: true,
        disableWorkerRendering: true,
        enableXfa: false,
        useWorkerFetch: false,
        useWasm: false,
        useSystemFonts: true,
        disableFontFace: false,
        isOffscreenCanvasSupported: false,
        isImageDecoderSupported: false,
        BinaryDataFactory: PdfBinaryDataFactory,
        maxImageSize: source.platform === 'android' ? 24_000_000 : 50_000_000,
        stopAtErrors: false,
      });
      this.loading = loading;
      loading.onPassword = (
        update: (password: string) => void,
        reason: number,
      ) => {
        if (generation !== this.generation) return;
        this.passwordContinuation = update;
        this.publish({
          state: 'password_required',
          error: reason === 2 ? 'incorrect_password' : null,
        });
      };
      const document = await loading.promise;
      this.current(generation);
      assertPdfPages(document.numPages);
      this.document = document;
      this.publish({
        state: 'ready',
        page_count: document.numPages,
        error: null,
        navigation: {
          ...this.state.navigation,
          page: Math.min(this.state.navigation.page, document.numPages - 1),
        },
      });
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(error);
    }
  }
  sourceFailed(error: unknown): void {
    this.release();
    this.publish({ state: 'failed', error: classifyPdfFailure(error) });
  }
  password(value: string): void {
    const continuation = this.passwordContinuation;
    this.passwordContinuation = null;
    if (continuation) {
      this.publish({ state: 'loading', error: null });
      continuation(value);
    }
  }
  navigate(page: number, origin: 'command' | 'scroll' = 'command'): void {
    if (
      !this.document ||
      !Number.isSafeInteger(page) ||
      page < 0 ||
      page >= this.document.numPages
    )
      throw new PdfFailure('invalid_destination');
    this.publish({
      navigation: {
        ...this.state.navigation,
        page,
        target: null,
        request:
          origin === 'command'
            ? (this.state.navigation.request ?? 0) + 1
            : this.state.navigation.request,
      },
    });
  }
  setView(
    view: Partial<Pick<PdfNavigation, 'zoom' | 'fit' | 'rotation' | 'layout'>>,
  ): void {
    if (!this.state.capabilities.view) throw new PdfFailure('unavailable');
    if (
      view.zoom !== undefined &&
      (!Number.isFinite(view.zoom) || view.zoom < 0.1 || view.zoom > 8)
    )
      throw new PdfFailure('surface_limit');
    if (
      view.rotation !== undefined &&
      ![0, 90, 180, 270].includes(view.rotation)
    )
      throw new PdfFailure('invalid_destination');
    this.publish({ navigation: { ...this.state.navigation, ...view } });
  }
  setPrintAvailable(value: boolean): void {
    if (this.printAvailable !== value) {
      this.printAvailable = value;
      this.publish({});
    }
  }
  reduceCache(): void {
    if (!this.state.reduced_cache)
      this.publish({ state: 'limited', reduced_cache: true });
  }
  async pageSize(
    index: number,
    rotation: number,
  ): Promise<{ width: number; height: number }> {
    const generation = this.generation;
    const document = this.document;
    if (!document) throw new PdfFailure('unavailable');
    const page = await document.getPage(index + 1);
    this.current(generation);
    const viewport = page.getViewport({
      scale: 1,
      rotation: (page.rotate + rotation) % 360,
    });
    if (
      !Number.isFinite(viewport.width) ||
      !Number.isFinite(viewport.height) ||
      viewport.width <= 0 ||
      viewport.height <= 0
    )
      throw new PdfFailure('surface_limit');
    return { width: viewport.width, height: viewport.height };
  }

  async renderPage(
    index: number,
    canvas: HTMLCanvasElement,
    textContainer: HTMLElement,
    scale: number,
    rotation: number,
    signal?: AbortSignal,
    includeText = true,
  ): Promise<PdfPageSurface> {
    const generation = this.generation;
    this.current(generation);
    const document = this.document;
    if (!document || !this.source) throw new PdfFailure('unavailable');
    const releaseSlot = await this.renders.acquire(
      signal ? [this.aborter.signal, signal] : [this.aborter.signal],
    );
    try {
      this.current(generation);
      if (!Number.isInteger(index) || index < 0 || index >= document.numPages)
        throw new PdfFailure('invalid_destination');
      if (signal?.aborted) throw new PdfFailure('cancelled');
      const page = await document.getPage(index + 1);
      this.current(generation);
      if (signal?.aborted) throw new PdfFailure('cancelled');
      const viewport = page.getViewport({
        scale,
        rotation: (page.rotate + rotation) % 360,
      });
      const width = Math.ceil(viewport.width),
        height = Math.ceil(viewport.height);
      const bytes = pdfSurfaceBytes(width, height, this.source.platform);
      if (
        this.surfaceBytes + bytes >
        PDF_LIMITS[this.source.platform].surfaceBytes
      ) {
        this.publish({ state: 'limited', reduced_cache: true });
        throw new PdfFailure('surface_limit');
      }
      this.surfaceBytes += bytes;
      canvas.width = width;
      canvas.height = height;
      let render: RenderTask | null = null;
      let text: TextLayer | null = null;
      let disposed = false;
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        signal?.removeEventListener('abort', dispose);
        render?.cancel();
        text?.cancel();
        canvas.width = 0;
        canvas.height = 0;
        textContainer.textContent = '';
        this.surfaceBytes -= bytes;
        this.surfaces.delete(dispose);
        page.cleanup();
      };
      this.surfaces.add(dispose);
      signal?.addEventListener('abort', dispose, { once: true });
      try {
        const context = canvas.getContext('2d');
        if (!context) throw new PdfFailure('unavailable');
        render = page.render({ canvas, canvasContext: context, viewport });
        await render.promise;
        this.current(generation);
        if (disposed) throw new PdfFailure('cancelled');
        if (includeText) {
          text = new TextLayer({
            textContentSource: page.streamTextContent(),
            container: textContainer,
            viewport,
          });
          await text.render();
          this.current(generation);
          if (disposed) throw new PdfFailure('cancelled');
        }
        return { width, height, bytes, dispose };
      } catch (error) {
        dispose();
        throw error;
      }
    } finally {
      releaseSlot();
    }
  }
  async metadata(index: number) {
    const generation = this.generation;
    const doc = this.document;
    if (!doc) throw new PdfFailure('unavailable');
    const [metadata, permissions, dimensions, navigation] = await Promise.all([
      doc.getMetadata(),
      doc.getPermissions(),
      this.pageSize(index, 0),
      this.navigationIndex(),
    ]);
    this.current(generation);
    return [
      ...pdfMetadataFacts(
        metadata.info as Record<string, unknown>,
        doc.numPages,
        permissions ? [...permissions] : null,
        dimensions,
        { count: navigation.rows.length, limited: navigation.limited },
      ),
      {
        key: 'pdf.current_page_label',
        availability: navigation.labels[index] ? 'available' : 'not_provided',
        ...(navigation.labels[index]
          ? { value: { kind: 'text', value: navigation.labels[index] } }
          : {}),
      },
    ] as import('./metadata').MetadataObservation[];
  }
  navigationIndex() { return this.navigationCache ??= this.loadNavigationIndex(); }
  private async loadNavigationIndex() {
    const generation = this.generation;
    const doc = this.document;
    if (!doc) throw new PdfFailure('unavailable');
    const [outline, labels] = await Promise.all([
      doc.getOutline(),
      doc.getPageLabels(),
    ]);
    this.current(generation);
    return {
      ...boundedOutline(outline),
      labels: Array.isArray(labels)
        ? labels
            .slice(0, doc.numPages)
            .map((label) => String(label).slice(0, 128))
        : [],
    };
  }
  async destination(value: unknown): Promise<PdfInternalTarget> {
    const generation = this.generation;
    const doc = this.document;
    if (!doc) throw new PdfFailure('unavailable');
    if (typeof value === 'string') {
      if (value.length > 2048) throw new PdfFailure('invalid_destination');
      value = await doc.getDestination(value);
      this.current(generation);
    }
    const { page, mode, values } = destinationShape(value);
    let index: number;
    if (typeof page === 'number') index = page;
    else if (
      page &&
      typeof page === 'object' &&
      Number.isSafeInteger((page as { num?: unknown }).num) &&
      Number.isSafeInteger((page as { gen?: unknown }).gen)
    ) {
      const ref = page as { num: number; gen: number };
      if (ref.num < 0 || ref.gen < 0)
        throw new PdfFailure('invalid_destination');
      index = await doc.getPageIndex(ref);
      this.current(generation);
    } else throw new PdfFailure('invalid_destination');
    if (!Number.isInteger(index) || index < 0 || index >= doc.numPages)
      throw new PdfFailure('invalid_destination');
    return destinationPoint(mode, values, index);
  }
  follow(target: PdfInternalTarget): void {
    this.navigate(target.page);
    this.publish({
      navigation: {
        ...this.state.navigation,
        target: { x: target.x, y: target.y },
      },
    });
  }
  async targetOffset(
    index: number,
    scale: number,
    rotation: number,
    target: { x: number | null; y: number | null },
  ): Promise<{ x: number; y: number }> {
    const generation = this.generation;
    const doc = this.document;
    if (!doc) throw new PdfFailure('unavailable');
    const page = await doc.getPage(index + 1);
    this.current(generation);
    const viewport = page.getViewport({
      scale,
      rotation: (page.rotate + rotation) % 360,
    });
    const bounds = page.view as number[];
    const point = viewport.convertToViewportPoint(
      target.x ?? bounds[0],
      target.y ?? bounds[3],
    ) as [number,number];
    if(!point.every(Number.isFinite))throw new PdfFailure('invalid_destination');
    return {
      x: Math.max(0, Math.min(viewport.width, point[0])),
      y: Math.max(0, Math.min(viewport.height, point[1])),
    };
  }
  async pageLinks(
    index: number,
  ): Promise<
    Array<{
      label: string;
      destination?: unknown;
      url?: string;
      action?: string;
    }>
  > {
    const generation = this.generation;
    const doc = this.document;
    if (!doc) throw new PdfFailure('unavailable');
    const page = await doc.getPage(index + 1);
    this.current(generation);
    const annotations: unknown[] = await page.getAnnotations({
      intent: 'display',
    });
    this.current(generation);
    const links: Array<{
      label: string;
      destination?: unknown;
      url?: string;
      action?: string;
    }> = [];
    for (const item of annotations) {
      if (links.length >= 256) break;
      if (!item || typeof item !== 'object') continue;
      const annotation = item as {
        subtype?: unknown;
        dest?: unknown;
        url?: unknown;
        unsafeUrl?: unknown;
        action?: unknown;
        contentsObj?: { str?: unknown };
      };
      if (annotation.subtype !== 'Link') continue;
      const label =
        typeof annotation.contentsObj?.str === 'string' && annotation.contentsObj.str.trim().length > 0
          ? annotation.contentsObj.str.slice(0, 256)
          : 'Link ' + String(links.length + 1);
      if (annotation.dest !== undefined)
        links.push({ label, destination: annotation.dest });
      else if (
        typeof annotation.url === 'string' ||
        typeof annotation.unsafeUrl === 'string'
      )
        links.push({
          label,
          url: String(annotation.url ?? annotation.unsafeUrl).slice(0, 2049),
        });
      else if (typeof annotation.action === 'string')
        links.push({ label, action: annotation.action });
    }
    return links;
  }
  async search(
    query: string,
    signal: AbortSignal,
    onProgress: (pages: number, matches: PdfSearchMatch[]) => void,
  ): Promise<{ matches: PdfSearchMatch[]; limited: boolean }> {
    const generation = this.generation;
    const doc = this.document;
    if (!doc) throw new PdfFailure('unavailable');
    if (!query.trim() || query.length > 256)
      throw new PdfFailure('unavailable');
    const matches: PdfSearchMatch[] = [];
    let limited = false;
    for (let index = 0; index < doc.numPages; index++) {
      this.current(generation);
      if (signal.aborted) throw new PdfFailure('cancelled');
      const page = await doc.getPage(index + 1);
      this.current(generation);
      const reader = page.streamTextContent().getReader();
      let text = '';
      let pageLimited = false;
      const abort = () => {
        void reader.cancel().catch(() => undefined);
      };
      signal.addEventListener('abort', abort, { once: true });
      this.aborter.signal.addEventListener('abort', abort, { once: true });
      try {
        while (true) {
          const chunk = await reader.read();
          this.current(generation);
          if (signal.aborted) throw new PdfFailure('cancelled');
          if (chunk.done) break;
          for (const item of (chunk.value as {items:Array<{str?:string;hasEOL?:boolean}>}).items) {
            if (typeof item.str !== 'string') continue;
            const value = item.str + (item.hasEOL ? '\n' : ' ');
            if (text.length + value.length > PDF_LIMITS.textPageCharacters) {
              limited = true;
              pageLimited = true;
              await reader.cancel();
              break;
            }
            text += value;
          }
          if (pageLimited) break;
        }
      } finally {
        signal.removeEventListener('abort', abort);
        this.aborter.signal.removeEventListener('abort', abort);
        reader.releaseLock();
      }
      matches.push(
        ...pageMatches(
          text,
          query,
          index,
          PDF_LIMITS.searchResults - matches.length,
        ),
      );
      onProgress(index + 1, [...matches]);
      if (matches.length >= PDF_LIMITS.searchResults) {
        limited = true;
        break;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    return { matches, limited };
  }
  get resourceCounts(): {
    workers: number;
    surfaces: number;
    surfaceBytes: number;
  } {
    return {
      workers: this.nativeWorker ? 1 : 0,
      surfaces: this.surfaces.size,
      surfaceBytes: this.surfaceBytes,
    };
  }
  cancel(): void {
    this.release();
    this.publish({ state: 'cancelled', error: null });
  }
  dispose(): void {
    this.release();
    this.publish({ state: 'disposed', error: null });
    this.listeners.clear();
  }
  private release(): void {
    const started = performance.now();
    const terminated = this.nativeWorker !== null;
    ++this.generation;
    this.aborter.abort();
    this.passwordContinuation = null;
    for (const dispose of [...this.surfaces]) dispose();
    this.nativeWorker?.terminate();
    this.nativeWorker = null;
    this.workerReady = false;
    this.documentResources?.dispose();
    this.documentResources = null;
    this.renders.cancelledRuntime();
    const loading = this.loading;
    this.loading = null;
    if (loading) void loading.destroy().catch(() => undefined);
    this.parserWorker?.destroy();
    this.parserWorker = null;
    this.document = null;
    this.navigationCache = null;
    const source = this.source;
    this.source = null;
    if (source) void Promise.resolve(source.close()).catch(() => undefined);
    const releasedCounts = this.resourceCounts;
    if (terminated)
      queueMicrotask(() => {
        TextLayer.cleanup();
        if (typeof window !== 'undefined')
          window.dispatchEvent(
            new CustomEvent('glitchpad-pdf-disposed', {
              detail: {
                owner_id: this.state.owner_id,
                worker_terminated: true,
                ...releasedCounts,
                elapsed_ms: performance.now() - started,
              },
            }),
          );
      });
  }
}
