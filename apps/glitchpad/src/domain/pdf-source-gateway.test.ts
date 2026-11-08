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
    expect(pdf.renderer.capabilities).toMatchObject({edit:false,save:false,view:true});expect(pdf.content).toBe('');expect(pdf.text_document).toBeNull();
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
