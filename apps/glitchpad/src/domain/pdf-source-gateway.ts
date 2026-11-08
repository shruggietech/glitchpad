import { invoke } from '@tauri-apps/api/core';
import { createRequestId } from './request-id';
import {
  createNativeLargeTextGateway,
  decodeNativeRangeFrame,
  type LargeTextGateway,
} from './large-text-gateway';
import {
  externalRevisionMatches,
  noRendererCapabilities,
  type ExternalRevision,
  type RevalidationResult,
  type ShellSession,
  type SourceDescriptor,
} from './contracts';
import {
  assertPdfRange,
  assertPdfSource,
  initialPdfState,
  PdfFailure,
  PDF_LIMITS,
  type PdfSourceLease,
} from './pdf-contract';

type NativeInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;
export async function identifyPdfSource(
  call: NativeInvoke,
  sourceId: string,
  revision: ExternalRevision,
): Promise<boolean> {
  const result = await call('identify_pdf_source', {
    sourceId,
    expectedRevision: revision,
  });
  if (typeof result !== 'boolean') throw new PdfFailure('unavailable');
  return result;
}
export function createPdfSession(
  source: SourceDescriptor,
  sourceId: string,
  revision: ExternalRevision,
  prefix: string,
): ShellSession {
  const id = prefix + '-' + sourceId;
  return {
    id,
    source,
    source_id: sourceId,
    external_revision: revision,
    renderer: {
      id: 'pdf',
      label: 'PDF',
      capabilities: { ...noRendererCapabilities(), inspect_metadata: true },
    },
    lifecycle: 'background',
    source_state: 'available',
    saved_revision: 1,
    dirty: false,
    revision: 1,
    content: '',
    text_document: null,
    pdf_document: initialPdfState(id),
  };
}
export async function createPdfSourceLease(
  session: ShellSession,
  call: NativeInvoke = invoke,
  rangeGateway?: LargeTextGateway,
  options: PdfSourcePreparation = {},
): Promise<PdfSourceLease> {
  const sourceId = session.source_id;
  const revision = session.external_revision;
  if (!sourceId || !revision) throw new PdfFailure('unavailable');
  const android = session.source.kind === 'document_uri';
  const platform = android ? 'android' : 'desktop';
  const length = session.source.byte_length;
  if (length === null || !session.source.capabilities.seek) {
    if (!android) throw new PdfFailure('unavailable');
    if (length !== null) assertPdfSource(length, platform);
    return createCachedPdfSourceLease(session, call, options);
  }
  assertPdfSource(length, platform);
  const gateway = rangeGateway ?? createNativeLargeTextGateway(android);
  let closed = false;
  return {
    length,
    platform,
    revision,
    async read(offset, count, signal) {
      if (closed || signal.aborted) throw new PdfFailure('cancelled');
      assertPdfRange(offset, count, length);
      const result = (await call(
        android ? 'revalidate_android_source' : 'revalidate_source',
        { sourceId, expected: revision },
      )) as RevalidationResult;
      if (
        result.source_id !== sourceId ||
        result.status !== 'match' ||
        !result.current ||
        !externalRevisionMatches(result.current, revision)
      )
        throw new PdfFailure(
          result.status === 'permission_revoked'
            ? 'permission_revoked'
            : 'source_changed',
        );
      if (closed || signal.aborted) throw new PdfFailure('cancelled');
      const range = await gateway.read(sourceId, offset, count, signal);
      if (closed || signal.aborted) throw new PdfFailure('cancelled');
      if (range.bytes.byteLength !== count)
        throw new PdfFailure('source_changed');
      return range.bytes;
    },
    close() {
      closed = true;
    },
  };
}

interface PdfCacheSnapshot {
  request_id: string;
  source_id: string;
  state: 'spooling' | 'ready';
  processed_bytes: number;
  sha256: string | null;
}
export interface PdfSourcePreparation {
  signal?: AbortSignal;
  onProgress?: (processed: number, total: number | null) => void;
}
async function createCachedPdfSourceLease(
  session: ShellSession,
  call: NativeInvoke,
  options: PdfSourcePreparation,
): Promise<PdfSourceLease> {
  const sourceId = session.source_id!;
  const revision = session.external_revision!;
  const requestId = createRequestId();
  let closed = false;
  let closing: Promise<void> | null = null;
  const close = (): Promise<void> => {
    closed = true;
    closing ??= call('cancel_pdf_cache', { requestId }).then(() => undefined);
    return closing;
  };
  const abort = () => {
    void close().catch(() => undefined);
  };
  if (options.signal?.aborted) throw new PdfFailure('cancelled');
  options.signal?.addEventListener('abort', abort, { once: true });
  const validate = (reply: unknown): PdfCacheSnapshot => {
    const value = reply as Partial<PdfCacheSnapshot> | null;
    if (
      !value ||
      value.request_id !== requestId ||
      value.source_id !== sourceId ||
      !['spooling', 'ready'].includes(String(value.state)) ||
      !Number.isSafeInteger(value.processed_bytes) ||
      value.processed_bytes! < 0 ||
      value.processed_bytes! > PDF_LIMITS.android.sourceBytes ||
      (value.state === 'ready' &&
        (!/^[0-9a-f]{64}$/.test(value.sha256 ?? '') ||
          value.processed_bytes === 0))
    )
      throw new PdfFailure('unavailable');
    return value as PdfCacheSnapshot;
  };
  try {
    let status = validate(
      await call('begin_pdf_cache', {
        sourceId,
        expectedRevision: revision,
        requestId,
      }),
    );
    while (status.state === 'spooling') {
      if (closed || options.signal?.aborted) throw new PdfFailure('cancelled');
      options.onProgress?.(status.processed_bytes, session.source.byte_length);
      status = validate(
        await call('advance_pdf_cache', {
          sourceId,
          expectedRevision: revision,
          requestId,
        }),
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (closed || options.signal?.aborted) throw new PdfFailure('cancelled');
    const length = status.processed_bytes;
    assertPdfSource(length, 'android');
    options.onProgress?.(length, length);
    return {
      length,
      platform: 'android',
      revision,
      async read(offset, count, signal) {
        if (closed || signal.aborted) throw new PdfFailure('cancelled');
        assertPdfRange(offset, count, length);
        const reply = await call('read_pdf_cache', {
          sourceId,
          expectedRevision: revision,
          requestId,
          offset,
          length: count,
        });
        if (closed || signal.aborted) throw new PdfFailure('cancelled');
        const range = decodeNativeRangeFrame(reply, sourceId, offset, count);
        if (range.bytes.byteLength !== count)
          throw new PdfFailure('source_changed');
        return range.bytes;
      },
      async close() {
        options.signal?.removeEventListener('abort', abort);
        await close();
      },
    };
  } catch (error) {
    options.signal?.removeEventListener('abort', abort);
    await close().catch(() => undefined);
    throw error;
  }
}
