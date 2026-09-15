import { invoke } from '@tauri-apps/api/core';
import type { ExternalRevision, ShellSession } from './contracts';
import { IMAGE_CODECS, validateImageResult, type ImageRenderResult, type RasterCodec } from './image-contract';

type NativeInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

export const identifyImageSource = async (call: NativeInvoke, sourceId: string, revision: ExternalRevision): Promise<RasterCodec | null> => {
  const result = await call('identify_image_source', { sourceId, expectedRevision: revision });
  if (result === null) return null;
  if (!IMAGE_CODECS.includes(result as RasterCodec)) throw new Error('Image identification returned an invalid codec');
  return result as RasterCodec;
};

export interface ImageGateway { render(session: ShellSession, signal: AbortSignal): Promise<ImageRenderResult> }

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
      const result = await call('render_image_source', { sourceId, requestId: id, expectedRevision: revision });
      if (signal.aborted) throw new DOMException('Image preview cancelled', 'AbortError');
      if (!validateImageResult(result, sourceId, id, revision)) throw new Error('Image preview returned an invalid bounded result');
      if (session.source.kind === 'document_uri' && result.preview && result.preview.descriptor.decoded_bytes > 128 * 1024 * 1024) throw new Error('Image preview exceeded the Android surface limit');
      return result;
    } finally { signal.removeEventListener('abort', cancel); }
  },
});

export const nativeImageGateway = createImageGateway();
