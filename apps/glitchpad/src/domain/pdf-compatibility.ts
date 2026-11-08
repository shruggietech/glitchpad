export interface PdfMessagePort {
  postMessage(message:unknown,transfer?:Transferable[]|StructuredSerializeOptions|null):void;
}

/** Chrome69 rejects PDF.js's explicit null transfer list. Keep the real native port. */
export function normalizePdfPostMessage(port:unknown):void {
  const target=port as PdfMessagePort;
  if(!target||typeof target.postMessage!=='function')throw new TypeError('A native PDF message port is required');
  const nativePost=target.postMessage.bind(target);
  target.postMessage=(message,transfer)=>nativePost(message,transfer??[]);
}
