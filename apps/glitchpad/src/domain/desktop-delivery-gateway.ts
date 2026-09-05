import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import {
  noRendererCapabilities,
  type DesktopSourceSummary,
  type ShellSession,
  type TextEncoding,
} from './contracts';
import { detectLanguage } from './language';
import { markdownEligibility } from './markdown-contract';
import { initialMermaidViewport } from './mermaid-contract';
import {
  createTextDocument,
  EDITABLE_TEXT_MAX_BYTES,
  LARGE_TEXT_MAX_BYTES,
  serializeTextDocument,
} from './text-document';

const SOURCE_CHUNK_BYTES = 1024 * 1024;

interface RangeReadResult {
  source_id: string;
  offset: number;
  bytes: number[];
  end_of_source: boolean;
}

export interface DesktopDeliveryResult {
  sequence: number;
  kind: 'dialog' | 'drop' | 'command_line' | 'association';
  status: 'opened' | 'duplicate' | 'rejected';
  source: DesktopSourceSummary | null;
  error: { summary: string; retryable: boolean } | null;
}

type NativeInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

export interface DesktopDeliveryGateway {
  choose(): Promise<DesktopDeliveryResult[]>;
  drain(): Promise<DesktopDeliveryResult[]>;
  materialize(result: DesktopDeliveryResult): Promise<ShellSession | null>;
  saveAs(session: ShellSession): Promise<boolean>;
  subscribe(handler: () => void): Promise<UnlistenFn>;
}

export const nativeDesktopDeliveryAvailable = (): boolean => {
  if (typeof window === 'undefined' || /android/iu.test(navigator.userAgent)) return false;
  const internals = (window as unknown as {
    __TAURI_INTERNALS__?: { invoke?: unknown; transformCallback?: unknown };
  }).__TAURI_INTERNALS__;
  return typeof internals?.invoke === 'function' && typeof internals.transformCallback === 'function';
};

const decode = (bytes: Uint8Array): { text: string; encoding: TextEncoding } => {
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
  return { text: decoder.decode(bytes), encoding };
};

const readSource = async (
  call: NativeInvoke,
  source: DesktopSourceSummary,
): Promise<{ text: string; sourceBytes: number; encoding: TextEncoding }> => {
  const declared = source.descriptor.byte_length;
  if (declared === null || !Number.isSafeInteger(declared) || declared < 0)
    throw new RangeError('Desktop source length is unavailable or invalid');
  if (declared > LARGE_TEXT_MAX_BYTES)
    throw new RangeError('Desktop source exceeds the supported viewing limit');
  if (declared > EDITABLE_TEXT_MAX_BYTES)
    return { text: '', sourceBytes: declared, encoding: 'utf8' };
  const bytes = new Uint8Array(declared);
  let offset = 0;
  while (offset < declared) {
    const length = Math.min(SOURCE_CHUNK_BYTES, declared - offset);
    const result = await call('read_source_range', {
      sourceId: source.source_id,
      offset,
      length,
      operationBudget: length,
    }) as RangeReadResult;
    if (result.source_id !== source.source_id || result.offset !== offset || result.bytes.length > length)
      throw new Error('Desktop delivery returned an invalid bounded range');
    if (result.bytes.length === 0 && !result.end_of_source)
      throw new Error('Desktop delivery read made no progress');
    bytes.set(result.bytes, offset);
    offset += result.bytes.length;
    if (result.end_of_source && offset !== declared)
      throw new Error('Desktop source changed while it was opening');
  }
  const decoded = decode(bytes);
  return { ...decoded, sourceBytes: declared };
};

const rendererFor = (displayName: string): 'markdown' | 'mermaid' | 'text' | 'source' => {
  const extension = displayName.toLowerCase().split('.').at(-1);
  if (extension === 'md' || extension === 'markdown') return 'markdown';
  if (extension === 'mmd' || extension === 'mermaid') return 'mermaid';
  if (extension === 'txt') return 'text';
  return 'source';
};

export const createDesktopDeliveryGateway = (
  call: NativeInvoke = invoke,
  subscribeEvent: (handler: () => void) => Promise<UnlistenFn> = (handler) =>
    listen('desktop-deliveries-ready', handler),
): DesktopDeliveryGateway => ({
  choose: () => call('choose_desktop_sources') as Promise<DesktopDeliveryResult[]>,
  drain: () => call('drain_desktop_deliveries', { maximum: 64 }) as Promise<DesktopDeliveryResult[]>,
  subscribe: subscribeEvent,
  async saveAs(session) {
    if (!session.text_document) throw new Error('Desktop Save As requires a text document');
    const serialized = serializeTextDocument(session.text_document, session.revision, session.revision);
    if (!serialized.ok) throw new Error(`Desktop Save As serialization failed: ${serialized.reason}`);
    return call('save_desktop_source_as', {
      suggestedName: session.source.display_name,
      bytes: [...serialized.payload.bytes],
    }) as Promise<boolean>;
  },
  async materialize(result) {
    if (result.status !== 'opened' || !result.source) return null;
    const source = result.source;
    const { text, sourceBytes, encoding } = await readSource(call, source);
    const renderer = rendererFor(source.descriptor.display_name);
    const textDocument = createTextDocument({
      rawText: text,
      sourceBytes,
      displayName: source.descriptor.display_name,
      encoding,
      language: detectLanguage(source.descriptor.display_name, text),
    });
    const markdown = markdownEligibility(sourceBytes);
    const editable = textDocument.mode === 'editable' && source.descriptor.capabilities.write;
    return {
      id: `desktop-${source.source_id}`,
      source: source.descriptor,
      renderer: {
        id: renderer,
        label: renderer === 'markdown' ? 'Markdown' : renderer === 'mermaid' ? 'Mermaid' : renderer === 'source' ? 'Source' : 'Text',
        capabilities: {
          ...noRendererCapabilities(),
          view: true,
          search: true,
          copy: true,
          edit: editable,
          save: editable,
          inspect_metadata: true,
          zoom: renderer === 'mermaid',
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
      markdown_document: renderer === 'markdown'
        ? { mode: markdown === 'full' ? 'rendered' : 'source', eligibility: markdown, render_revision: null, render_status: markdown === 'full' ? 'idle' : 'limited', source_selection: null }
        : null,
      mermaid_document: renderer === 'mermaid'
        ? { mode: text.trim() ? 'rendered' : 'source', render_revision: null, render_status: 'idle', preview_stale: false, viewport: initialMermaidViewport() }
        : null,
    };
  },
});

export const nativeDesktopDeliveryGateway = createDesktopDeliveryGateway();
