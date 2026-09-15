import { invoke } from '@tauri-apps/api/core';
import type { ExternalRevision, ShellSession } from './contracts';
import { IMAGE_CODECS, validateImageResult, type ImageRenderResult, type ImageCodec } from './image-contract';

type NativeInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

export const identifyImageSource = async (call: NativeInvoke, sourceId: string, revision: ExternalRevision): Promise<ImageCodec | null> => {
  const result = await call('identify_image_source', { sourceId, expectedRevision: revision });
  if (result === null) return null;
  if (!IMAGE_CODECS.includes(result as ImageCodec)) throw new Error('Image identification returned an invalid codec');
  return result as ImageCodec;
};

export interface ImageGateway { render(session: ShellSession, signal: AbortSignal): Promise<ImageRenderResult>; suspend?(sourceId: string, requestId: string): Promise<void>; exportEntry?(session: ShellSession, signal: AbortSignal): Promise<{ status: 'exported' | 'cancelled'; durability: string | null }> }

const requestId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};

export const createImageGateway = (call: NativeInvoke = invoke): ImageGateway => ({
  async render(session, signal) {
    if (!session.source_id || !session.external_revision || !session.image_document) throw new Error('Image preview requires a registered current source');
    if (signal.aborted) throw new DOMException('Image preview cancelled', 'AbortError');
    const id = requestId();
    const sourceId = session.source_id;
    const revision = session.external_revision;
    const cancel = () => { void call('cancel_image_render', { sourceId, requestId: id }).catch(() => undefined); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const result = await call('render_image_source', { sourceId, requestId: id, expectedRevision: revision, selection: session.image_document.selection ?? null });
      if (signal.aborted) throw new DOMException('Image preview cancelled', 'AbortError');
      if (!validateImageResult(result, sourceId, id, revision)) throw new Error('Image preview returned an invalid bounded result');
      const selected = session.image_document.selection;
      const family = result.family_state;
      if (selected != null && family?.family === 'animation' && (selected < (family.frame_count ?? 0) ? family.selected_frame !== selected : family.selected_frame !== 0)) throw new Error('The returned animation frame does not match its request');
      if (selected != null && family?.family === 'ico' && selected < family.entries.length && family.selected_entry !== selected) throw new Error('The returned icon entry does not match its request');
      if (session.source.kind === 'document_uri' && result.preview && result.preview.descriptor.decoded_bytes > 128 * 1024 * 1024) throw new Error('Image preview exceeded the Android surface limit');
      return result;
    } finally { signal.removeEventListener('abort', cancel); }
  },
  async suspend(sourceId, requestId) { await call('cancel_image_render', { sourceId, requestId }); },
  async exportEntry(session, signal) {
    const state = session.image_document?.family_state;
    if (!session.source_id || !session.external_revision || state?.family !== 'ico' || state.selected_entry === null || !state.selected_entry_export || signal.aborted) throw new Error('A current decoded icon entry is required');
    const id = requestId();
    const cancel = () => { void call('cancel_image_render', { sourceId: session.source_id, requestId: id }).catch(() => undefined); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const result = await call('export_image_entry', { sourceId: session.source_id, expectedRevision: session.external_revision, requestId: id, entry: state.selected_entry });
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      if (!result || typeof result !== 'object' || !('status' in result) || !['exported', 'cancelled'].includes(String(result.status)) || !('durability' in result) || !(result.durability === null || typeof result.durability === 'string')) throw new Error('Invalid export receipt');
      return result as { status: 'exported' | 'cancelled'; durability: string | null };
    } finally { signal.removeEventListener('abort', cancel); }
  },
});

export const nativeImageGateway = createImageGateway();
