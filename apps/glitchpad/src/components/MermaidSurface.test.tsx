import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import axe from 'axe-core';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { App, initialSessions } from '../App';
import { MERMAID_STANDALONE_MAX_BYTES } from '../domain/mermaid-contract';

vi.mock('../domain/mermaid-adapter', async () => {
  const { DeterministicMermaidRendererClient } = await import('../test/mermaid-renderer-double');
  return { MermaidRendererClient: DeterministicMermaidRendererClient };
});

const mermaidSession = (content: string) => ({
  ...initialSessions[1],
  id: 'mermaid-test',
  lifecycle: 'active' as const,
  content,
  source: {
    ...initialSessions[1].source,
    display_name: 'architecture.mmd',
    byte_length: new TextEncoder().encode(content).byteLength,
    capabilities: { ...initialSessions[1].source.capabilities, write: true, replace_atomically: true },
  },
  renderer: {
    ...initialSessions[1].renderer,
    capabilities: { ...initialSessions[1].renderer.capabilities, edit: true, save: true, inspect_metadata: true },
  },
  text_document: {
    ...initialSessions[1].text_document!,
    raw_text: content,
    normalized_text: content,
    source_bytes: new TextEncoder().encode(content).byteLength,
  },
  mermaid_document: {
    ...initialSessions[1].mermaid_document!,
    mode: content.trim() ? 'rendered' as const : 'source' as const,
  },
});

describe('Mermaid surface', () => {
  it('renders standalone source locally and exposes navigation and metadata', async () => {
    render(<App sessions={[mermaidSession('flowchart LR\n  Alpha --> Beta')]} />);
    expect(await screen.findByRole('img', { name: /architecture\.mmd Mermaid diagram/iu }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fit' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'File information' }).at(-1)!);
    expect(screen.getByText('flowchart')).toBeInTheDocument();
    expect(screen.getByText('11.17.2')).toBeInTheDocument();
    const inspector = screen.getByRole('complementary', { name: 'File information' });
    expect(inspector).toHaveTextContent('File namearchitecture.mmd');
    expect(inspector).toHaveTextContent('Media typetext/vnd.mermaid');
    expect(inspector).toHaveTextContent('Encodingutf8');
    expect(inspector).toHaveTextContent('Output bytes');
    expect(inspector).toHaveTextContent('Parse duration');
    expect(inspector).toHaveTextContent('Render duration');
    expect(inspector).toHaveTextContent('Accessible descriptionAbsent');
  }, 15_000);

  it('composes the exact source editor and labels the last valid preview stale', async () => {
    render(<App sessions={[mermaidSession('flowchart TB\n  A --> B')]} />);
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: 'Edit source' }));
    const textbox = screen.getByRole('textbox', { name: 'architecture.mmd text editor' });
    const view = EditorView.findFromDOM(textbox)!;
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'flowchart TB\n  A -->' } }));
    await waitFor(() => expect(screen.getByText('Preview is from an earlier source revision')).toBeInTheDocument(), { timeout: 2_000 });
    expect(screen.getByLabelText('Earlier valid preview')).toBeInTheDocument();
  });

  it('opens an empty Mermaid source directly in editable source mode', () => {
    render(<App sessions={[mermaidSession('')]} />);
    expect(screen.getByRole('textbox', { name: 'architecture.mmd text editor' })).toBeInTheDocument();
  });

  it('marks a retained preview stale and publishes the limited state above 1 MiB', async () => {
    render(<App sessions={[mermaidSession('flowchart TB\n  A --> B')]} />);
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: 'Edit source' }));
    const textbox = screen.getByRole('textbox', { name: 'architecture.mmd text editor' });
    const view = EditorView.findFromDOM(textbox)!;
    const oversized = `flowchart TB\nA --> B\n%%${'x'.repeat(MERMAID_STANDALONE_MAX_BYTES)}`;
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: oversized } }));
    await waitFor(() => expect(screen.getByText('Preview is from an earlier source revision')).toBeInTheDocument());
    expect(screen.getByLabelText('Earlier valid preview')).toBeInTheDocument();
  });

  it('renders after StrictMode replays effect setup and cleanup', async () => {
    render(<StrictMode><App sessions={[mermaidSession('flowchart TB\n  A --> B')]} /></StrictMode>);
    expect(await screen.findByRole('img', {}, { timeout: 2_000 })).toBeInTheDocument();
  });

  it('routes the command-bar search to CodeMirror while source mode is active', async () => {
    const { container } = render(<App sessions={[mermaidSession('flowchart TB\n  SearchableNode --> B')]} />);
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: 'Edit source' }));
    const commandSearch = screen.getAllByRole('button', { name: 'Search' }).find((button) => button.classList.contains('command-button'))!;
    fireEvent.click(commandSearch);
    await waitFor(() => expect(container.querySelector('.cm-search')).toBeInTheDocument());
    expect(screen.queryByRole('textbox', { name: 'Find diagram text' })).not.toBeInTheDocument();
  });

  it('has no critical or serious accessibility violations', async () => {
    const { container } = render(<App sessions={[mermaidSession('flowchart TB\n  accTitle: Architecture\n  A --> B')]} />);
    await screen.findByRole('img');
    const results = await axe.run(container, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    expect(results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([]);
  });
});
