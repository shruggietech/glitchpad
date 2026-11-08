import 'core-js/stable';
import { getDocument, PDFWorker, PDFDataRangeTransport, TextLayer, type PDFDocumentLoadingTask, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PdfBinaryDataFactory } from './pdf-resources';
import { assertPdfPages, assertPdfSource, classifyPdfFailure, initialPdfState, pdfCapabilities, pdfSurfaceBytes, PDF_ENGINE_VERSION, PDF_LIMITS, PdfFailure, type PdfDocumentState, type PdfSourceLease } from './pdf-contract';

export interface PdfPageSurface { width:number; height:number; bytes:number; dispose():void; }
type Listener = (state: PdfDocumentState) => void;

class SourceRangeTransport extends PDFDataRangeTransport {
  private inFlight = 0;
  private queue: Array<{begin:number;end:number}> = [];
  private stopped = false;
  constructor(private readonly lease: PdfSourceLease, initial: Uint8Array, private readonly signal: AbortSignal, private readonly fail: (error:unknown)=>void) {
    super(lease.length, initial, true);
  }
  override requestDataRange(begin:number,end:number):void {
    if (this.stopped || this.signal.aborted) return;
    if (!Number.isSafeInteger(begin) || !Number.isSafeInteger(end) || begin < 0 || end <= begin || end > this.lease.length || this.queue.length >= 64) { this.fail(new PdfFailure('malformed')); return; }
    this.queue.push({begin,end}); this.pump();
  }
  private pump():void {
    while (!this.stopped && this.inFlight < PDF_LIMITS.rangeConcurrency && this.queue.length) {
      const range = this.queue.shift()!; this.inFlight += 1;
      void this.read(range.begin,range.end).catch(this.fail).finally(()=>{this.inFlight -= 1;this.pump();});
    }
  }
  private async read(begin:number,end:number):Promise<void> {
    for (let offset=begin;offset<end;offset+=PDF_LIMITS.rangeBytes) {
      if (this.stopped || this.signal.aborted) return;
      const bytes = await this.lease.read(offset,Math.min(PDF_LIMITS.rangeBytes,end-offset),this.signal);
      if (this.stopped || this.signal.aborted) return;
      this.onDataRange(offset,bytes);
    }
  }
  override abort():void { this.stopped=true;this.queue=[]; }
}

/** Owns one actual worker/source revision. The UI never releases accounting ahead of these resources. */
export class PdfController {
  state:PdfDocumentState;
  document:PDFDocumentProxy|null=null;
  workerReady = false;
  private nativeWorker:Worker|null=null;
  private parserWorker:PDFWorker|null=null;
  private loading:PDFDocumentLoadingTask|null=null;
  private source:PdfSourceLease|null=null;
  private aborter=new AbortController();
  private generation=0;
  private listeners=new Set<Listener>();
  private surfaces=new Set<()=>void>();
  private surfaceBytes=0;
  private passwordContinuation:((password:string)=>void)|null=null;

  constructor(ownerId:string) { this.state=initialPdfState(ownerId); }
  subscribe(listener:Listener):()=>void {this.listeners.add(listener);listener(this.state);return()=>this.listeners.delete(listener);}
  private publish(patch:Partial<PdfDocumentState>):void {this.state={...this.state,...patch};this.state.capabilities=pdfCapabilities(this.state.state,this.state.reduced_cache);for(const listener of this.listeners)listener(this.state);}
  private current(generation:number):void {if(generation!==this.generation || this.aborter.signal.aborted)throw new PdfFailure('cancelled');}
  private fail(error:unknown):void {if(this.aborter.signal.aborted)return;const code=classifyPdfFailure(error);this.release();this.publish({state:code==='cancelled'?'cancelled':'failed',error:code});}

  async open(source:PdfSourceLease):Promise<void> {
    this.release();this.source=source;this.aborter=new AbortController();const generation=++this.generation;
    this.publish({state:'loading',error:null});
    try {
      assertPdfSource(source.length,source.platform);
      const worker=new Worker(new URL('./pdf-worker.ts',import.meta.url),{name:'glitchpad-pdf'});this.nativeWorker=worker;
      await new Promise<void>((resolve,reject)=>{
        const timeout=setTimeout(()=>{worker.removeEventListener('message',ready);reject(new PdfFailure('worker_failure'));},10000);
        const ready=(event:MessageEvent<unknown>)=>{
          const data=event.data as {type?:unknown;version?:unknown;native_bridge?:unknown};
          if(data?.type!=='glitchpad-pdf-worker-ready')return;
          clearTimeout(timeout);worker.removeEventListener('message',ready);
          if(data.version!==PDF_ENGINE_VERSION || data.native_bridge!==false)reject(new PdfFailure('worker_failure'));else resolve();
        };
        worker.addEventListener('message',ready);worker.addEventListener('error',()=>{clearTimeout(timeout);reject(new PdfFailure('worker_failure'));},{once:true});
        this.aborter.signal.addEventListener('abort',()=>{clearTimeout(timeout);reject(new PdfFailure('cancelled'));},{once:true});
      });
      this.current(generation);this.workerReady=true;
      const parserWorker=PDFWorker.create({port:worker});this.parserWorker=parserWorker;
      await parserWorker.promise;this.current(generation);
      if(parserWorker.port!==worker)throw new PdfFailure('worker_failure');
      const initial=await source.read(0,Math.min(source.length,4096),this.aborter.signal);this.current(generation);
      const range=new SourceRangeTransport(source,initial,this.aborter.signal,(error)=>this.fail(error));
      const loading=getDocument({range,worker:parserWorker,rangeChunkSize:65536,disableAutoFetch:true,disableStream:true,disableWorkerRendering:true,enableXfa:false,useWorkerFetch:false,useWasm:false,useSystemFonts:true,disableFontFace:false,isOffscreenCanvasSupported:false,isImageDecoderSupported:false,BinaryDataFactory:PdfBinaryDataFactory,maxImageSize:source.platform==='android'?24_000_000:50_000_000,stopAtErrors:false});
      this.loading=loading;
      loading.onPassword=(update:(password:string)=>void,reason:number)=>{if(generation!==this.generation)return;this.passwordContinuation=update;this.publish({state:'password_required',error:reason===2?'incorrect_password':null});};
      const document=await loading.promise;this.current(generation);assertPdfPages(document.numPages);this.document=document;
      this.publish({state:'ready',page_count:document.numPages,error:null});
    } catch(error) {if(generation!==this.generation)return;this.fail(error);}
  }
  password(value:string):void {const continuation=this.passwordContinuation;this.passwordContinuation=null;if(continuation){this.publish({state:'loading',error:null});continuation(value);}}
  navigate(page:number):void {if(!this.document || !Number.isSafeInteger(page) || page<0 || page>=this.document.numPages)throw new PdfFailure('invalid_destination');this.publish({navigation:{...this.state.navigation,page}});}

  async renderPage(index:number,canvas:HTMLCanvasElement,textContainer:HTMLElement,scale:number,rotation:number,signal?:AbortSignal):Promise<PdfPageSurface> {
    const generation=this.generation;this.current(generation);const document=this.document;if(!document || !this.source)throw new PdfFailure('unavailable');
    if(!Number.isInteger(index)||index<0||index>=document.numPages)throw new PdfFailure('invalid_destination');
    if(signal?.aborted)throw new PdfFailure('cancelled');
    const page=await document.getPage(index+1);this.current(generation);if(signal?.aborted)throw new PdfFailure('cancelled');
    const viewport=page.getViewport({scale,rotation});const width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);
    const bytes=pdfSurfaceBytes(width,height,this.source.platform);
    if(this.surfaceBytes+bytes>PDF_LIMITS[this.source.platform].surfaceBytes){this.publish({state:'limited',reduced_cache:true});throw new PdfFailure('surface_limit');}
    this.surfaceBytes+=bytes;canvas.width=width;canvas.height=height;
    let render:RenderTask|null=null;let text:TextLayer|null=null;let disposed=false;
    const dispose=()=>{if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);render?.cancel();text?.cancel();canvas.width=0;canvas.height=0;textContainer.replaceChildren();this.surfaceBytes-=bytes;this.surfaces.delete(dispose);page.cleanup();};this.surfaces.add(dispose);signal?.addEventListener('abort',dispose,{once:true});
    try {
      const context=canvas.getContext('2d');if(!context)throw new PdfFailure('unavailable');
      render=page.render({canvas,canvasContext:context,viewport});await render.promise;this.current(generation);if(disposed)throw new PdfFailure('cancelled');
      text=new TextLayer({textContentSource:page.streamTextContent(),container:textContainer,viewport});await text.render();this.current(generation);if(disposed)throw new PdfFailure('cancelled');
      return {width,height,bytes,dispose};
    } catch(error){dispose();throw error;}
  }
  get resourceCounts():{workers:number;surfaces:number;surfaceBytes:number}{return{workers:this.nativeWorker?1:0,surfaces:this.surfaces.size,surfaceBytes:this.surfaceBytes};}
  cancel():void {this.release();this.publish({state:'cancelled',error:null});}
  dispose():void {this.release();this.publish({state:'disposed',error:null});this.listeners.clear();}
  private release():void {
    const started=performance.now();const terminated=this.nativeWorker!==null;
    ++this.generation;this.aborter.abort();this.passwordContinuation=null;
    for(const dispose of [...this.surfaces])dispose();
    this.nativeWorker?.terminate();this.nativeWorker=null;this.workerReady=false;
    const loading=this.loading;this.loading=null;if(loading)void loading.destroy().catch(()=>undefined);
    this.parserWorker?.destroy();this.parserWorker=null;this.document=null;
    const source=this.source;this.source=null;if(source)void Promise.resolve(source.close()).catch(()=>undefined);
    if(terminated && typeof window!=='undefined')window.dispatchEvent(new CustomEvent('glitchpad-pdf-disposed',{detail:{owner_id:this.state.owner_id,worker_terminated:true,...this.resourceCounts,elapsed_ms:performance.now()-started}}));
  }
}
