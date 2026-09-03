import { invoke } from '@tauri-apps/api/core';

import {
  noRendererCapabilities,
  type AndroidRestorationResult,
  type AndroidSourceSummary,
  type ShellSession,
  type TextEncoding,
} from './contracts';
import { detectLanguage } from './language';
import { markdownEligibility } from './markdown-contract';
import { initialMermaidViewport } from './mermaid-contract';
import type { SessionProjection } from './persistence';
import {
  createTextDocument,
  EDITABLE_TEXT_MAX_BYTES,
  LARGE_TEXT_MAX_BYTES,
} from './text-document';

const SOURCE_CHUNK_BYTES = 1024 * 1024;
const TEXT_RENDERERS = new Set(['markdown', 'mermaid', 'source', 'text']);

interface RangeReadResult {
  source_id: string;
  offset: number;
  bytes: number[];
  end_of_source: boolean;
}

type NativeInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

export interface AndroidRestorationGateway {
  restore(projections: readonly SessionProjection[]): Promise<ShellSession[]>;
}

export const nativeAndroidRestorationAvailable = (): boolean =>
  typeof window !== 'undefined'
  && '__TAURI_INTERNALS__' in window
  && /android/iu.test(navigator.userAgent);

const readBoundedText = async (
  call: NativeInvoke,
  source: AndroidSourceSummary,
): Promise<{ text: string; sourceBytes: number; encoding: TextEncoding }> => {
  const declaredBytes = source.descriptor.byte_length;
  if (declaredBytes !== null
      && (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0))
    throw new RangeError('Restored source length is invalid');
  if (declaredBytes !== null && declaredBytes > LARGE_TEXT_MAX_BYTES)
    throw new RangeError('Restored source exceeds the supported viewing limit');
  if (declaredBytes !== null && declaredBytes > EDITABLE_TEXT_MAX_BYTES)
    return { text: '', sourceBytes: declaredBytes, encoding: 'utf8' };

  const chunks: Uint8Array[] = [];
  let offset = 0;
  let endOfSource = declaredBytes === 0;
  while (!endOfSource && offset < EDITABLE_TEXT_MAX_BYTES) {
    const declaredRemaining = declaredBytes === null
      ? SOURCE_CHUNK_BYTES
      : declaredBytes - offset;
    const length = Math.min(
      SOURCE_CHUNK_BYTES,
      declaredRemaining,
      EDITABLE_TEXT_MAX_BYTES - offset,
    );
    if (length <= 0) break;
    const result = await call('read_android_range', {
      sourceId: source.source_id,
      offset,
      length,
      operationBudget: length,
    }) as RangeReadResult;
    if (result.source_id !== source.source_id
        || result.offset !== offset
        || result.bytes.length > length)
      throw new Error('Android restoration returned an invalid bounded range');
    const bytes = Uint8Array.from(result.bytes);
    chunks.push(bytes);
    offset += bytes.byteLength;
    endOfSource = result.end_of_source;
    if (bytes.byteLength === 0 && !endOfSource)
      throw new Error('Android restoration read made no progress');
  }
  if (!endOfSource)
    return {
      text: '',
      sourceBytes: Math.max(offset + 1, EDITABLE_TEXT_MAX_BYTES + 1),
      encoding: 'utf8',
    };
  const bytes = new Uint8Array(offset);
  let cursor = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  const encoding: TextEncoding = bytes[0] === 0xff && bytes[1] === 0xfe
    ? 'utf16_le_bom'
    : bytes[0] === 0xfe && bytes[1] === 0xff
      ? 'utf16_be_bom'
      : bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
        ? 'utf8_bom'
        : 'utf8';
  const decoder = encoding === 'utf16_le_bom'
    ? new TextDecoder('utf-16le', { fatal: true })
    : encoding === 'utf16_be_bom'
      ? new TextDecoder('utf-16be', { fatal: true })
      : new TextDecoder('utf-8', { fatal: true });
  return { text: decoder.decode(bytes), sourceBytes: offset, encoding };
};

const restoredSession = async (
  call: NativeInvoke,
  source: AndroidSourceSummary,
  projection: SessionProjection,
): Promise<ShellSession> => {
  const { text, sourceBytes, encoding } = await readBoundedText(call, source);
  const rendererId = projection.renderer_id.toLowerCase();
  const textDocument = createTextDocument({
    rawText: text,
    displayName: source.descriptor.display_name,
    sourceBytes,
    encoding,
    language: detectLanguage(source.descriptor.display_name, text),
  });
  const eligibility = markdownEligibility(sourceBytes);
  const editable = textDocument.mode === 'editable' && source.descriptor.capabilities.write;
  return {
    id: `restored-${source.source_id}`,
    source: source.descriptor,
    renderer: {
      id: rendererId,
      label: rendererId === 'markdown'
        ? 'Markdown'
        : rendererId === 'mermaid'
          ? 'Mermaid'
          : 'Text',
      capabilities: {
        ...noRendererCapabilities(),
        view: true,
        search: true,
        copy: true,
        edit: editable,
        save: editable,
        inspect_metadata: true,
      },
    },
    lifecycle: 'background',
    source_state: 'available',
    external_revision: source.external_revision,
    saved_revision: 1,
    dirty: false,
    revision: 1,
    content: text,
    source_id: source.source_id,
    text_document: textDocument,
    markdown_document: rendererId === 'markdown'
      ? {
          mode: eligibility === 'full' ? 'rendered' : 'source',
          eligibility,
          render_revision: null,
          render_status: eligibility === 'full' ? 'idle' : 'limited',
          source_selection: null,
        }
      : null,
    mermaid_document: rendererId === 'mermaid'
      ? {
          mode: text.trim() ? 'rendered' : 'source',
          render_revision: null,
          render_status: 'idle',
          preview_stale: false,
          viewport: initialMermaidViewport(),
        }
      : null,
  };
};

export const createNativeAndroidRestorationGateway = (
  call: NativeInvoke = invoke,
): AndroidRestorationGateway => ({
  async restore(projections) {
    const byReference = new Map(
      projections
        .filter((projection) => projection.source_reference)
        .map((projection) => [projection.source_reference!, projection]),
    );
    const results = await call('restore_android_sources') as AndroidRestorationResult[];
    const sessions = await Promise.all(results.map(async (result) => {
      const source = result.status === 'restored' ? result.source : null;
      if (!source?.descriptor.restoration_reference) return null;
      const projection = byReference.get(source.descriptor.restoration_reference);
      if (!projection || !TEXT_RENDERERS.has(projection.renderer_id.toLowerCase())) return null;
      try {
        return await restoredSession(call, source, projection);
      } catch {
        return null;
      }
    }));
    return sessions.filter((session): session is ShellSession => session !== null);
  },
});

export const nativeAndroidRestorationGateway = createNativeAndroidRestorationGateway();
