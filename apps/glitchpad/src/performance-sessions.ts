import {
  noRendererCapabilities,
  noSourceCapabilities,
  type ShellSession,
} from './domain/contracts';
import { detectLanguage } from './domain/language';
import { markdownEligibility } from './domain/markdown-contract';
import { initialMermaidViewport } from './domain/mermaid-contract';
import { createTextDocument } from './domain/text-document';

const makePerformanceSession = (
  id: string,
  name: string,
  renderer: 'Text' | 'Markdown' | 'Mermaid',
  content: string,
): ShellSession => {
  const textDocument = createTextDocument({
    rawText: content,
    displayName: name,
    language: detectLanguage(name, content),
  });
  const eligibility = markdownEligibility(textDocument.source_bytes);
  return {
    id,
    source: {
      identity: { authority: 'synthetic', scope: 'performance', token: id, strength: 'strong' },
      display_name: name,
      claimed_media_type: renderer === 'Markdown' ? 'text/markdown' : renderer === 'Mermaid' ? 'text/vnd.mermaid' : 'text/plain',
      byte_length: textDocument.source_bytes,
      modified_unix_ms: null,
      kind: 'memory',
      capabilities: { ...noSourceCapabilities(), read: true, write: true, metadata: true },
    },
    renderer: {
      id: renderer.toLowerCase(),
      label: renderer,
      capabilities: { ...noRendererCapabilities(), view: true, copy: true, search: true, edit: true, zoom: renderer === 'Mermaid' },
    },
    lifecycle: id === 'performance-text' ? 'active' : 'background',
    dirty: false,
    revision: 1,
    content,
    text_document: textDocument,
    markdown_document: renderer === 'Markdown' ? { mode: 'rendered', eligibility, render_revision: null, render_status: 'idle', source_selection: null } : null,
    mermaid_document: renderer === 'Mermaid' ? { mode: 'rendered', render_revision: null, render_status: 'idle', preview_stale: false, viewport: initialMermaidViewport() } : null,
  };
};

export const createPerformanceSessions = (): ShellSession[] => {
  const bytes = 1024 * 1024;
  const text = 'x'.repeat(bytes);
  const markdownPrefix = '# Performance fixture\n\n';
  const markdown = `${markdownPrefix}${'x'.repeat(bytes - new TextEncoder().encode(markdownPrefix).byteLength)}`;
  const mermaidPrefix = 'flowchart TB\n  A --> B\n%%';
  const mermaid = `${mermaidPrefix}${'x'.repeat(bytes - new TextEncoder().encode(mermaidPrefix).byteLength)}`;
  return [
    makePerformanceSession('performance-text', 'performance.txt', 'Text', text),
    makePerformanceSession('performance-markdown', 'performance.md', 'Markdown', markdown),
    makePerformanceSession('performance-mermaid', 'performance.mmd', 'Mermaid', mermaid),
    makePerformanceSession('performance-mermaid-edit', 'performance-edit.mmd', 'Mermaid', 'flowchart TB\n  A --> B\n'),
  ];
};
