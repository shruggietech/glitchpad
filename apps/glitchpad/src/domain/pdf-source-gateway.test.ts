import { describe, expect, it, vi } from 'vitest';
import { noSourceCapabilities, type ExternalRevision } from './contracts';
import { createPdfSession, createPdfSourceLease, identifyPdfSource } from './pdf-source-gateway';
import { MemoryLargeTextGateway } from './large-text-gateway';

const identity={authority:'synthetic' as const,scope:'pdf-test',token:'opaque',strength:'strong' as const};
const revision:ExternalRevision={identity,byte_length:16,modified_unix_nanos:null,change_token:'revision-1'};
const session=()=>createPdfSession({identity,display_name:'original.pdf',claimed_media_type:'application/pdf',byte_length:16,modified_unix_ms:null,kind:'file',capabilities:{...noSourceCapabilities(),read:true,seek:true,stream:true,revalidate:true}},'source',revision,'desktop');
const valid=()=>({source_id:'source',expected:revision,current:revision,status:'match'});

describe('PDF source authority and ownership',()=>{
  it('requires content identification and rejects malformed native replies',async()=>{
    await expect(identifyPdfSource(vi.fn().mockResolvedValue(true),'source',revision)).resolves.toBe(true);
    await expect(identifyPdfSource(vi.fn().mockResolvedValue('pdf'),'source',revision)).rejects.toThrow('unavailable');
  });
  it('keeps writable source authority out of the read-only PDF renderer',()=>{
    const pdf=session();pdf.source.capabilities.write=true;
    expect(pdf.renderer.capabilities).toMatchObject({edit:false,save:false,view:false,search:false,zoom:false});expect(pdf.content).toBe('');expect(pdf.text_document).toBeNull();
  });
  it('revalidates exact source/revision before each bounded read',async()=>{
    const call=vi.fn().mockResolvedValue(valid());const ranges=new MemoryLargeTextGateway('source',new Uint8Array(16));
    const lease=await createPdfSourceLease(session(),call,ranges);await lease.read(8,8,new AbortController().signal);
    expect(call).toHaveBeenCalledWith('revalidate_source',{sourceId:'source',expected:revision});expect(ranges.requests).toEqual([{offset:8,length:8}]);
    await expect(lease.read(15,2,new AbortController().signal)).rejects.toThrow();expect(ranges.requests).toHaveLength(1);
  });
  it.each(['changed','permission_revoked'])('never reads after %s revalidation',async(status)=>{
    const ranges=new MemoryLargeTextGateway('source',new Uint8Array(16));const call=vi.fn().mockResolvedValue({...valid(),status});
    const lease=await createPdfSourceLease(session(),call,ranges);await expect(lease.read(0,8,new AbortController().signal)).rejects.toThrow(status==='changed'?'source_changed':'permission_revoked');expect(ranges.requests).toEqual([]);
  });
  it('rejects a lying match receipt from another source/revision',async()=>{
    const ranges=new MemoryLargeTextGateway('source',new Uint8Array(16));const call=vi.fn().mockResolvedValue({...valid(),current:{...revision,change_token:'other'}});
    const lease=await createPdfSourceLease(session(),call,ranges);await expect(lease.read(0,8,new AbortController().signal)).rejects.toThrow('source_changed');expect(ranges.requests).toEqual([]);
  });
  it('cancels a queued revalidation and prevents late range work',async()=>{
    let resolve!:(value:unknown)=>void;const call=vi.fn(()=>new Promise<unknown>(done=>{resolve=done;}));const ranges=new MemoryLargeTextGateway('source',new Uint8Array(16));
    const lease=await createPdfSourceLease(session(),call,ranges);const abort=new AbortController();const pending=lease.read(0,8,abort.signal);abort.abort();resolve(valid());await expect(pending).rejects.toThrow('cancelled');expect(ranges.requests).toEqual([]);
  });
  it('closing the lease prevents future reads without closing the tab source',async()=>{
    const call=vi.fn().mockResolvedValue(valid());const ranges=new MemoryLargeTextGateway('source',new Uint8Array(16));const lease=await createPdfSourceLease(session(),call,ranges);await lease.close();await expect(lease.read(0,8,new AbortController().signal)).rejects.toThrow('cancelled');expect(call).not.toHaveBeenCalled();
  });
});

describe('stream-only PDF source preparation',()=>{
  it('spools unknown-length input privately with progress and no source locator or bytes in the renderer',async()=>{
    const pdf=session();pdf.source.kind='document_uri';pdf.source.byte_length=null;pdf.source.capabilities.seek=false;pdf.external_revision={...revision,byte_length:null};
    let requestId='';let step=0;const progress:number[]=[];
    const call=vi.fn((command:string,args?:Record<string,unknown>)=>{
      if(command==='begin_pdf_cache'){requestId=String(args?.requestId);return Promise.resolve({request_id:requestId,source_id:'source',state:'spooling',processed_bytes:0,sha256:null});}
      if(command==='advance_pdf_cache'){step++;return Promise.resolve({request_id:requestId,source_id:'source',state:step===2?'ready':'spooling',processed_bytes:step*8,sha256:step===2?'a'.repeat(64):null});}
      if(command==='read_pdf_cache')return Promise.resolve([0,1,2,3,4]);
      if(command==='cancel_pdf_cache')return Promise.resolve();
      throw new Error('Unexpected native route '+command);
    });
    const lease=await createPdfSourceLease(pdf,call,undefined,{onProgress(value){progress.push(value);}});
    expect(lease.length).toBe(16);expect(progress).toEqual([0,8,16]);expect(await lease.read(0,4,new AbortController().signal)).toEqual(Uint8Array.from([1,2,3,4]));await lease.close();
    expect(call.mock.calls.some(([name])=>name==='read_android_range')).toBe(false);expect(call.mock.calls.filter(([name])=>name==='cancel_pdf_cache')).toHaveLength(1);
    expect(JSON.stringify(call.mock.calls)).not.toContain('content://');expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('cancels an in-flight spool before a late completion can become a readable lease',async()=>{
    const pdf=session();pdf.source.kind='document_uri';pdf.source.capabilities.seek=false;
    const abort=new AbortController();let complete!:(value:unknown)=>void;let id='';
    const call=vi.fn((command:string,args?:Record<string,unknown>)=>{
      if(command==='begin_pdf_cache'){id=String(args?.requestId);return Promise.resolve({request_id:id,source_id:'source',state:'spooling',processed_bytes:0,sha256:null});}
      if(command==='advance_pdf_cache')return new Promise<unknown>(resolve=>{complete=resolve;});
      if(command==='cancel_pdf_cache')return Promise.resolve();throw new Error('Unexpected source operation');
    });
    const pending=createPdfSourceLease(pdf,call,undefined,{signal:abort.signal});await vi.waitFor(()=>expect(complete).toBeTypeOf('function'));abort.abort();complete({request_id:id,source_id:'source',state:'ready',processed_bytes:16,sha256:'a'.repeat(64)});
    await expect(pending).rejects.toThrow('cancelled');expect(call.mock.calls.filter(([name])=>name==='cancel_pdf_cache')).toHaveLength(1);
  });
});
