export interface PdfMessagePort {
  postMessage(
    message: unknown,
    transfer?: Transferable[] | StructuredSerializeOptions | null,
  ): void;
}

/** Chrome69 rejects PDF.js's explicit null transfer list. Keep the real native port. */
export function normalizePdfPostMessage(port: unknown): void {
  const target = port as PdfMessagePort;
  if (!target || typeof target.postMessage !== 'function')
    throw new TypeError('A native PDF message port is required');
  const nativePost = target.postMessage.bind(target);
  target.postMessage = (message, transfer) =>
    nativePost(message, transfer ?? []);
}

/** FileReader is available on the minimum WebView, including before Blob.arrayBuffer. */
export function readPdfBlob(
  blob: Blob,
  signal: AbortSignal,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('print_cancelled'));
      return;
    }
    const reader = new FileReader();
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => {
      reader.abort();
      cleanup();
      reject(new Error('print_cancelled'));
    };
    reader.onload = () => {
      cleanup();
      if (reader.result instanceof ArrayBuffer)
        resolve(new Uint8Array(reader.result));
      else reject(new Error('print_page_unavailable'));
    };
    reader.onerror = () => {
      cleanup();
      reject(new Error('print_page_unavailable'));
    };
    reader.onabort = () => {
      cleanup();
      reject(new Error('print_cancelled'));
    };
    signal.addEventListener('abort', abort, { once: true });
    reader.readAsArrayBuffer(blob);
  });
}
