import { invoke } from '@tauri-apps/api/core';
import { createNativeLargeTextGateway } from './large-text-gateway';
import { externalRevisionMatches, noRendererCapabilities, type ExternalRevision, type RevalidationResult, type ShellSession, type SourceDescriptor } from './contracts';
import { assertPdfRange, assertPdfSource, initialPdfState, PdfFailure, type PdfSourceLease } from './pdf-contract';

type NativeInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
export async function identifyPdfSource(call: NativeInvoke, sourceId: string, revision: ExternalRevision): Promise<boolean> {
  const result = await call('identify_pdf_source', { sourceId, expectedRevision: revision });
  if (typeof result !== 'boolean') throw new PdfFailure('unavailable');
  return result;
}
export function createPdfSession(source: SourceDescriptor, sourceId: string, revision: ExternalRevision, prefix: string): ShellSession {
  const id = prefix + '-' + sourceId;
  return { id, source, source_id: sourceId, external_revision: revision, renderer: { id:'pdf',label:'PDF',capabilities:{...noRendererCapabilities(),view:true,navigate:true,search:true,zoom:true,copy:true,inspect_metadata:true} }, lifecycle:'background',source_state:'available',saved_revision:1,dirty:false,revision:1,content:'',text_document:null,pdf_document:initialPdfState(id) };
}
export async function createPdfSourceLease(session: ShellSession, call: NativeInvoke = invoke): Promise<PdfSourceLease> {
  const sourceId = session.source_id;
  const revision = session.external_revision;
  if (!sourceId || !revision) throw new PdfFailure('unavailable');
  const android = session.source.kind === 'document_uri';
  const platform = android ? 'android' : 'desktop';
  const length = session.source.byte_length;
  if (length === null || !session.source.capabilities.seek) throw new PdfFailure('unavailable'); // Replaced by the private spool adapter before candidate qualification.
  assertPdfSource(length, platform);
  const gateway = createNativeLargeTextGateway(android);
  let closed = false;
  return {
    length, platform, revision,
    async read(offset, count, signal) {
      if (closed || signal.aborted) throw new PdfFailure('cancelled');
      assertPdfRange(offset, count, length);
      const result = await call(android ? 'revalidate_android_source' : 'revalidate_source', { sourceId, expected: revision }) as RevalidationResult;
      if (result.source_id !== sourceId || result.status !== 'match' || !result.current || !externalRevisionMatches(result.current, revision)) throw new PdfFailure(result.status === 'permission_revoked' ? 'permission_revoked' : 'source_changed');
      if (closed || signal.aborted) throw new PdfFailure('cancelled');
      const range = await gateway.read(sourceId, offset, count, signal);
      if (closed || signal.aborted) throw new PdfFailure('cancelled');
      if (range.bytes.byteLength !== count) throw new PdfFailure('source_changed');
      return range.bytes;
    },
    close() { closed = true; },
  };
}
