import { PDF_LIMITS } from './pdf-contract';
interface Budget {nodes:number;characters:number;string:number;depth:number;binary:number;}
/** Reject oversized replies in the worker before structured cloning them to the WebView. */
function assertBounded(value:unknown,budget:Budget):void {
  const pending:Array<{value:unknown;depth:number;exit?:boolean}>=[{value,depth:0}];const seen=new Set<object>();const active=new Set<object>();let nodes=0,characters=0,binary=0;
  while(pending.length){const entry=pending.pop()!;const item=entry.value;if(entry.exit){active.delete(item as object);continue;}if(++nodes>budget.nodes||entry.depth>budget.depth)throw new Error('PDF inspection limit');
    if(typeof item==='string'){characters+=item.length;if(item.length>budget.string||characters>budget.characters)throw new Error('PDF inspection limit');continue;}
    if(item===null||typeof item!=='object')continue;if(active.has(item))throw new Error('PDF cyclic reply');if(seen.has(item))continue;seen.add(item);active.add(item);pending.push({value:item,depth:entry.depth,exit:true});
    if(ArrayBuffer.isView(item)||item instanceof ArrayBuffer){binary+=item.byteLength;if(binary>budget.binary)throw new Error('PDF inspection limit');continue;}
    if(Array.isArray(item)){if(item.length>budget.nodes-nodes)throw new Error('PDF inspection limit');for(const child of item)pending.push({value:child,depth:entry.depth+1});}
    else if(item instanceof Map){if(item.size>256)throw new Error('PDF inspection limit');for(const [key,child]of item){pending.push({value:key,depth:entry.depth+1},{value:child,depth:entry.depth+1});}}
    else{for(const key of Object.keys(item)){if(pending.length+nodes>budget.nodes)throw new Error('PDF inspection limit');pending.push({value:key,depth:entry.depth+1},{value:(item as Record<string,unknown>)[key],depth:entry.depth+1});}}
  }
}
export function boundPdfReply(kind:'outline'|'metadata'|'labels'|'destination'|'annotations',value:unknown):unknown {
  if(kind==='outline'&&value!==null){if(!Array.isArray(value))throw new Error('PDF invalid outline');const pending=[{items:value as unknown[],depth:0}];let count=0;while(pending.length){const frame=pending.pop()!;if(frame.depth>=PDF_LIMITS.outlineDepth||frame.items.length>PDF_LIMITS.outlineNodes-count)throw new Error('PDF outline limit');for(const node of frame.items){if(++count>PDF_LIMITS.outlineNodes||!node||typeof node!=='object')throw new Error('PDF invalid outline');const children=(node as {items?:unknown}).items;if(Array.isArray(children)&&children.length)pending.push({items:children,depth:frame.depth+1});}}}
  const budgets:Record<typeof kind,Budget>={outline:{nodes:400000,characters:16*1024*1024,string:2048,depth:128,binary:65536},metadata:{nodes:4096,characters:65536,string:32768,depth:16,binary:0},labels:{nodes:10001,characters:1280000,string:128,depth:2,binary:0},destination:{nodes:64,characters:2048,string:2048,depth:4,binary:0},annotations:{nodes:65536,characters:1024*1024,string:16384,depth:32,binary:1048576}};
  assertBounded(value,budgets[kind]);return value;
}
interface TextSink {enqueue:(chunk:unknown,...args:unknown[])=>unknown;}
export function boundPdfTextSink<T extends TextSink>(sink:T):T {
  let characters=0,items=0;
  const enqueue=(chunk:unknown,...args:unknown[])=>{
    assertBounded(chunk,{nodes:100000,characters:PDF_LIMITS.textPageCharacters+65536,string:PDF_LIMITS.textPageCharacters,depth:16,binary:0});
    if(!chunk||typeof chunk!=='object'||!Array.isArray((chunk as {items?:unknown}).items))throw new Error('PDF invalid text chunk');
    for(const item of (chunk as {items:unknown[]}).items){items++;if(item&&typeof item==='object'&&typeof(item as {str?:unknown}).str==='string')characters+=((item as {str:string}).str).length;}
    if(characters>PDF_LIMITS.textPageCharacters||items>100000)throw new Error('PDF text limit');
    return sink.enqueue(chunk,...args);
  };
  return new Proxy(sink,{get(target,key){if(key==='enqueue')return enqueue;const value:unknown=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
}
