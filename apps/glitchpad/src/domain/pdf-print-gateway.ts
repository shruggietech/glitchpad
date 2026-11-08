import { readPdfBlob } from './pdf-compatibility';
import { invoke } from '@tauri-apps/api/core';
import type { ShellSession } from './contracts';
import { createRequestId } from './request-id';
export type PdfPrintStatus =
  | 'preparing'
  | 'ready'
  | 'handed_off'
  | 'layout'
  | 'writing'
  | 'written'
  | 'cancelled'
  | 'failed'
  | 'finished';
export interface PdfPrintReceipt {
  request_id: string;
  status: PdfPrintStatus;
  pages_written: number;
}
export interface PdfPrintPage {
  blob: Blob;
  width: number;
  height: number;
  pixelBytes: number;
}
export interface PdfPrintGateway {
  available(): Promise<boolean>;
  begin(pages: number): Promise<void>;
  append(index: number, page: PdfPrintPage, signal: AbortSignal): Promise<void>;
  handoff(): Promise<PdfPrintReceipt>;
  inspect(): Promise<PdfPrintReceipt>;
  cancel(): Promise<void>;
  dispose(): void;
}
export function parsePdfPrintRange(value: string, count: number): number[] {
  if (!Number.isInteger(count) || count < 1 || count > 10000)
    throw new Error('invalid_page_count');
  if (value.trim().toLowerCase() === 'all')
    return Array.from({ length: count }, (_, index) => index);
  if (value.length > 4096) throw new Error('invalid_page_range');
  const pages = new Set<number>();
  for (const piece of value.split(',')) {
    const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(piece);
    if (!match) throw new Error('invalid_page_range');
    const start = Number(match[1]),
      end = Number(match[2] ?? match[1]);
    if (start < 1 || end > count || start > end)
      throw new Error('invalid_page_range');
    for (let page = start; page <= end; page++) pages.add(page - 1);
  }
  return [...pages].sort((left, right) => left - right);
}
let desktopPrintOwner: string | null = null;
export function nativePdfPrintGateway(session: ShellSession): PdfPrintGateway {
  const id = createRequestId();
  const android = session.source.kind === 'document_uri';
  const source = {
    sourceId: session.source_id,
    expectedRevision: session.external_revision,
  };
  let owner: HTMLDivElement | null = null;
  const urls: string[] = [];
  let decoded = 0;
  let encoded = 0;
  let expected = 0;
  let appended = 0;
  let handedOff = false;
  let afterPrint = false;
  const operation = async (
    operation: string,
    fields: Record<string, unknown> = {},
  ): Promise<PdfPrintReceipt> => {
    const reply = await invoke<PdfPrintReceipt>('pdf_print_operation', {
      ...source,
      request: { operation, requestId: id, owner: session.id, ...fields },
    });
    if (
      reply.request_id !== id ||
      ![
        'preparing',
        'ready',
        'handed_off',
        'layout',
        'writing',
        'written',
        'cancelled',
        'failed',
        'finished',
      ].includes(reply.status) ||
      !Number.isInteger(reply.pages_written) ||
      reply.pages_written < 0
    )
      throw new Error('invalid_print_receipt');
    return reply;
  };
  const release = () => {
    window.removeEventListener('afterprint', finishDesktop);
    if (desktopPrintOwner === id) {
      desktopPrintOwner = null;
      document.body.classList.remove('pdf-print-active');
    }
    owner?.remove();
    owner = null;
    for (const url of urls) URL.revokeObjectURL(url);
    urls.length = 0;
  };
  const finishDesktop = () => {
    afterPrint = true;
    release();
  };
  const dispose = () => {
    if (!android && handedOff && !afterPrint) return;
    release();
  };
  return {
    async available() {
      return (
        session.source_id !== null &&
        session.external_revision !== null &&
        (await invoke<boolean>('pdf_print_available')) === true
      );
    },
    async begin(pages) {
      expected = pages;
      if (android) {
        await operation('begin', { pageCount: pages });
        return;
      }
      if (desktopPrintOwner !== null) throw new Error('print_pending');
      desktopPrintOwner = id;
      owner = document.createElement('div');
      owner.className = 'pdf-print-document';
      owner.setAttribute('aria-hidden', 'true');
      document.body.append(owner);
    },
    async append(index, page, signal) {
      if (signal.aborted) throw new Error('print_cancelled');
      if (index !== appended || index >= expected)
        throw new Error('invalid_print_page');
      if (page.blob.size > 16777216 || encoded + page.blob.size > 134217728)
        throw new Error('print_cache_limit');
      encoded += page.blob.size;
      if (android) {
        const bytes = await readPdfBlob(page.blob, signal);
        for (let offset = 0; offset < bytes.length; offset += 262144) {
          if (signal.aborted) throw new Error('print_cancelled');
          await operation('append', {
            pageIndex: index,
            bytes: Array.from(bytes.subarray(offset, offset + 262144)),
          });
        }
        await operation('seal', {
          pageIndex: index,
          width: page.width,
          height: page.height,
          sha256: '',
        });
      } else {
        decoded += page.pixelBytes;
        if (decoded > 200 * 1048576) throw new Error('print_surface_limit');
        const url = URL.createObjectURL(page.blob);
        urls.push(url);
        const image = document.createElement('img');
        image.alt = 'PDF page ' + String(index + 1);
        image.src = url;
        image.style.width = String(page.width) + 'pt';
        image.style.height = String(page.height) + 'pt';
        const loaded = new Promise<void>((resolve, reject) => {
          const abort = () => {
            cleanup();
            reject(new Error('print_cancelled'));
          };
          const cleanup = () => signal.removeEventListener('abort', abort);
          image.onload = () => {
            cleanup();
            resolve();
          };
          image.onerror = () => {
            cleanup();
            reject(new Error('print_page_unavailable'));
          };
          signal.addEventListener('abort', abort, { once: true });
          if (signal.aborted) abort();
        });
        owner!.append(image);
        await loaded;
        if (signal.aborted) throw new Error('print_cancelled');
      }
      appended++;
    },
    async handoff() {
      if (appended !== expected) throw new Error('print_not_ready');
      if (android) {
        const receipt = await operation('handoff');
        handedOff = true;
        return receipt;
      }
      handedOff = true;
      document.body.classList.add('pdf-print-active');
      window.addEventListener('afterprint', finishDesktop, { once: true });
      try {
        await invoke<void>('request_pdf_desktop_print', source);
      } catch (error) {
        handedOff = false;
        release();
        throw error;
      }
      return { request_id: id, status: 'handed_off', pages_written: 0 };
    },
    async inspect() {
      return android
        ? operation('inspect')
        : { request_id: id, status: 'handed_off', pages_written: 0 };
    },
    async cancel() {
      if (android && !handedOff) await operation('cancel');
      dispose();
    },
    dispose,
  };
}
