import { invoke } from '@tauri-apps/api/core';
import { consumeRecoveryProbe } from './recovery-probes';
import type { ExternalRevision, ShellSession } from './contracts';
import {
  IMAGE_CODECS,
  validateImageResult,
  type ImageRenderResult,
  type ImageCodec,
  type ImagePreviewFailure,
} from './image-contract';

type NativeInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

export const identifyImageSource = async (
  call: NativeInvoke,
  sourceId: string,
  revision: ExternalRevision,
): Promise<ImageCodec | null> => {
  const result = await call('identify_image_source', {
    sourceId,
    expectedRevision: revision,
  });
  if (result === null) return null;
  if (!IMAGE_CODECS.includes(result as ImageCodec))
    throw new Error('Image identification returned an invalid codec');
  return result as ImageCodec;
};

export class ImagePreviewError extends Error {
  constructor(
    readonly outcome: ImagePreviewFailure,
    message = 'Image preview failed',
  ) {
    super(message);
    this.name = 'ImagePreviewError';
  }
}
export const classifyImageFailure = (error: unknown): ImagePreviewFailure => {
  if (error instanceof ImagePreviewError) return error.outcome;
  if (error && typeof error === 'object') {
    const e = error as {
      category?: string;
      retryable?: boolean;
      context?: { image_failure?: string; image_stage?: string };
    };
    if (e.context?.image_failure === 'busy')
      return { kind: 'busy', retryable: true };
    if (e.category === 'permission_revoked')
      return { kind: 'source_revoked', retryable: false };
    if (e.category === 'conflict')
      return { kind: 'source_revised', retryable: e.retryable === true };
    if (e.category === 'resource_limit' || e.category === 'budget_exceeded')
      return { kind: 'oversized', retryable: false };
    if (e.context?.image_stage === 'source_read')
      return { kind: 'source_read', retryable: e.retryable === true };
    if (
      [
        'not_found',
        'capability_denied',
        'budget_exceeded',
        'resource_limit',
        'unsupported_input',
        'invalid_input',
      ].includes(e.category ?? '')
    )
      return { kind: 'source_read', retryable: e.retryable === true };
  }
  return { kind: 'host_transport', retryable: true };
};

export interface ImageGateway {
  render(
    session: ShellSession,
    signal: AbortSignal,
  ): Promise<ImageRenderResult>;
  suspend?(sourceId: string, requestId: string): Promise<void>;
  exportEntry?(
    session: ShellSession,
    signal: AbortSignal,
  ): Promise<{ status: 'exported' | 'cancelled'; durability: string | null }>;
}

const requestId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((n) => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const createImageGateway = (
  call: NativeInvoke = invoke,
): ImageGateway => ({
  async render(session, signal) {
    if (
      !session.source_id ||
      !session.external_revision ||
      !session.image_document
    )
      throw new Error('Image preview requires a registered current source');
    if (signal.aborted)
      throw new DOMException('Image preview cancelled', 'AbortError');
    const id = requestId();
    const sourceId = session.source_id;
    const revision = session.external_revision;
    const cancel = () => {
      void call('cancel_image_render', { sourceId, requestId: id }).catch(
        () => undefined,
      );
    };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      if (
        import.meta.env.VITE_GLITCHPAD_RECOVERY_PROBES === '1' &&
        consumeRecoveryProbe('host')
      )
        await call('glitchpad_s047_absent_image_preview_probe');
      const result = await call('render_image_source', {
        sourceId,
        requestId: id,
        expectedRevision: revision,
        selection: session.image_document.selection ?? null,
      });
      if (signal.aborted)
        throw new DOMException('Image preview cancelled', 'AbortError');
      if (!validateImageResult(result, sourceId, id, revision))
        throw new ImagePreviewError(
          { kind: 'invalid_result', retryable: false },
          'Image preview returned an invalid bounded result',
        );
      const selected = session.image_document.selection;
      const family = result.family_state;
      if (
        selected != null &&
        family?.family === 'animation' &&
        (selected < (family.frame_count ?? 0)
          ? family.selected_frame !== selected
          : family.selected_frame !== 0)
      )
        throw new ImagePreviewError({
          kind: 'invalid_result',
          retryable: false,
        });
      if (
        selected != null &&
        family?.family === 'ico' &&
        selected < family.entries.length &&
        family.selected_entry !== selected
      )
        throw new ImagePreviewError({
          kind: 'invalid_result',
          retryable: false,
        });
      if (
        session.source.kind === 'document_uri' &&
        result.preview &&
        result.preview.descriptor.decoded_bytes > 128 * 1024 * 1024
      )
        throw new ImagePreviewError({
          kind: 'invalid_result',
          retryable: false,
        });
      return result;
    } catch (error) {
      if (signal.aborted)
        throw new DOMException('Image preview cancelled', 'AbortError');
      throw error instanceof ImagePreviewError
        ? error
        : new ImagePreviewError(classifyImageFailure(error));
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  },
  async suspend(sourceId, requestId) {
    await call('cancel_image_render', { sourceId, requestId });
  },
  async exportEntry(session, signal) {
    const state = session.image_document?.family_state;
    if (
      !session.source_id ||
      !session.external_revision ||
      state?.family !== 'ico' ||
      state.selected_entry === null ||
      !state.selected_entry_export ||
      signal.aborted
    )
      throw new Error('A current decoded icon entry is required');
    const id = requestId();
    const cancel = () => {
      void call('cancel_image_render', {
        sourceId: session.source_id,
        requestId: id,
      }).catch(() => undefined);
    };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const result = await call('export_image_entry', {
        sourceId: session.source_id,
        expectedRevision: session.external_revision,
        requestId: id,
        entry: state.selected_entry,
      });
      if (signal.aborted)
        throw new DOMException('Export cancelled', 'AbortError');
      if (
        !result ||
        typeof result !== 'object' ||
        !('status' in result) ||
        !['exported', 'cancelled'].includes(String(result.status)) ||
        !('durability' in result) ||
        !(result.durability === null || typeof result.durability === 'string')
      )
        throw new Error('Invalid export receipt');
      return result as {
        status: 'exported' | 'cancelled';
        durability: string | null;
      };
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  },
});

export const nativeImageGateway = createImageGateway();
