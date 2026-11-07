import {
  noRendererCapabilities,
  noSourceCapabilities,
  type ShellSession,
} from './contracts';
import { createTextDocument } from './text-document';
import { initialMermaidViewport } from './mermaid-contract';
import { createRecoveryRecordId } from './use-recovery';

export const createDraftSession = (
  kind: 'markdown' | 'text',
  original?: ShellSession,
): ShellSession => {
  const id = 'draft-' + createRecoveryRecordId();
  const mermaidCopy =
    original?.renderer.id === 'mermaid' || Boolean(original?.mermaid_document);
  const displayName = original
    ? 'Copy of ' + original.source.display_name
    : kind === 'markdown'
      ? 'Untitled.md'
      : 'Untitled.txt';
  const document = createTextDocument({
    rawText: original?.text_document?.raw_text ?? original?.content ?? '',
    displayName,
    encoding: 'utf8',
  });
  return {
    id,
    edit_origin: original ? 'copy' : 'draft',
    copy_source:
      original?.source_id && original.external_revision
        ? {
            source_id: original.source_id,
            external_revision: original.external_revision,
          }
        : original?.copy_source,
    source: {
      identity: {
        authority: 'synthetic',
        scope: 'draft',
        token: id,
        strength: 'unavailable',
      },
      display_name: displayName,
      claimed_media_type: mermaidCopy
        ? 'text/vnd.mermaid'
        : kind === 'markdown'
          ? 'text/markdown'
          : 'text/plain',
      byte_length: document.source_bytes,
      modified_unix_ms: null,
      kind: 'memory',
      capabilities: { ...noSourceCapabilities(), read: true },
    },
    renderer: {
      id: mermaidCopy ? 'mermaid' : kind,
      label: mermaidCopy
        ? 'Mermaid'
        : kind === 'markdown'
          ? 'Markdown'
          : 'Text',
      capabilities: {
        ...noRendererCapabilities(),
        ...(mermaidCopy ? original?.renderer.capabilities : {}),
        view: true,
        edit: true,
        copy: true,
        search: true,
        save: true,
      },
    },
    lifecycle: 'active',
    focus: 'active',
    integrity: 'dirty',
    source_state: 'available',
    source_id: null,
    external_revision: null,
    dirty: true,
    revision: 1,
    saved_revision: 0,
    content: document.normalized_text,
    text_document: document,
    mermaid_document: mermaidCopy
      ? {
          mode: 'source',
          render_revision: null,
          render_status: 'idle',
          preview_stale: false,
          viewport: {
            ...(original?.mermaid_document?.viewport ??
              initialMermaidViewport()),
          },
        }
      : null,
    markdown_document:
      !mermaidCopy && kind === 'markdown'
        ? {
            mode: 'source',
            eligibility: 'full',
            render_revision: null,
            render_status: 'idle',
            printable: false,
            outline_count: 0,
            source_selection: null,
          }
        : null,
  };
};
