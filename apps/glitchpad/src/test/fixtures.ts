import {
  noRendererCapabilities,
  noSourceCapabilities,
  type ShellSession,
} from '../domain/contracts';
import { detectLanguage } from '../domain/language';
import { markdownEligibility } from '../domain/markdown-contract';
import { initialMermaidViewport } from '../domain/mermaid-contract';
import { createTextDocument } from '../domain/text-document';

export const makeSession = (
  id: string,
  name: string,
  renderer: string,
  content: string,
  capabilities: Partial<ShellSession['renderer']['capabilities']>,
  options: { dirty?: boolean; writable?: boolean; metadata?: boolean } = {},
): ShellSession => {
  const isText = renderer !== 'Image';
  const textDocument = isText
    ? createTextDocument({
        rawText: content,
        displayName: name,
        language: detectLanguage(name, content),
      })
    : null;
  const eligibility = markdownEligibility(textDocument?.source_bytes ?? 0);
  return {
    id,
    source: {
      identity: {
        authority: 'synthetic',
        scope: 'test-fixtures',
        token: id,
        strength: 'strong',
      },
      display_name: name,
      claimed_media_type: name.endsWith('.md')
        ? 'text/markdown'
        : /\.(?:mmd|mermaid)$/iu.test(name)
          ? 'text/vnd.mermaid'
          : 'text/plain',
      byte_length: textDocument?.source_bytes ?? content.length,
      modified_unix_ms: 1_788_044_400_000,
      kind: 'memory',
      capabilities: {
        ...noSourceCapabilities(),
        read: true,
        metadata: options.metadata ?? true,
        write: options.writable ?? false,
        observe_revision: options.writable ?? false,
        revalidate: options.writable ?? false,
        replace_atomically: options.writable ?? false,
      },
    },
    renderer: {
      id: renderer.toLowerCase(),
      label: renderer,
      capabilities: {
        ...noRendererCapabilities(),
        view: true,
        copy: true,
        inspect_metadata: true,
        ...capabilities,
      },
    },
    lifecycle: id === 'welcome' ? 'active' : 'background',
    dirty: options.dirty ?? false,
    revision: 1,
    content,
    text_document: textDocument,
    markdown_document:
      renderer === 'Markdown'
        ? {
            mode: eligibility === 'full' ? 'rendered' : 'source',
            eligibility,
            render_revision: null,
            render_status: eligibility === 'full' ? 'idle' : 'limited',
            source_selection: null,
          }
        : null,
    mermaid_document:
      renderer === 'Mermaid'
        ? {
            mode: content.trim() ? 'rendered' : 'source',
            render_revision: null,
            render_status: 'idle',
            preview_stale: false,
            viewport: initialMermaidViewport(),
          }
        : null,
  };
};

export const initialSessions: ShellSession[] = [
  makeSession('welcome', 'welcome.md', 'Markdown', '# Glitchpad document foundation\n\nThe file owns the viewport.', { search: true }),
  makeSession('diagram', 'diagram.mmd', 'Mermaid', 'flowchart TB\n    Source --> Session\n    Session --> Renderer', { search: true, zoom: true }),
  makeSession('notes', 'notes.txt', 'Text', 'A small text fixture for tab interaction.', { search: true, edit: true, save: true }, { writable: true }),
  makeSession('draft', 'draft.md', 'Markdown', '# Draft\n\nUnsaved fixture content.', { search: true, edit: true, save: true }, { dirty: true, writable: true }),
  makeSession('guide', 'guide.md', 'Markdown', '# Guide\n\nCapability-driven commands.', { search: true }),
  makeSession('architecture', 'architecture.rs', 'Source', 'pub struct DocumentSession;', { search: true }),
  makeSession('image', 'preview.webp', 'Image', 'WebP preview fixture', { zoom: true, inspect_metadata: true }),
];
