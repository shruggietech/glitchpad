import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../App';
import type { MarkdownRenderRequest, MarkdownRenderResult } from '../domain/markdown-contract';
import { renderMarkdown } from '../domain/markdown-pipeline';
import { MarkdownRendererClient, type MarkdownExecutor } from '../domain/markdown-renderer';
import { markdownCorpus } from '../test/markdown-corpus';
import { initialSessions } from '../test/fixtures';
import { MarkdownSurface } from './MarkdownSurface';

const invokeMenu = (name: string | RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
  const matcher = typeof name === 'string' ? new RegExp(`^${name}`, 'u') : name;
  fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: matcher }));
};

vi.mock('../domain/mermaid-adapter', async () => {
  const { DeterministicMermaidRendererClient } = await import('../test/mermaid-renderer-double');
  return { MermaidRendererClient: DeterministicMermaidRendererClient };
});

const markdownSession = (content: string) => ({
  ...initialSessions[3],
  id: 'markdown-test',
  lifecycle: 'active' as const,
  content,
  source: { ...initialSessions[3].source, display_name: 'test.md', byte_length: content.length },
  text_document: {
    ...initialSessions[3].text_document!,
    raw_text: content,
    normalized_text: content,
    source_bytes: new TextEncoder().encode(content).byteLength,
  },
  markdown_document: {
    mode: 'rendered' as const,
    eligibility: 'full' as const,
    render_revision: null,
    render_status: 'idle' as const,
    printable: false,
    outline_count: 0,
    source_selection: null,
  },
});

interface DeferredRender {
  request: MarkdownRenderRequest;
  resolve: (result: MarkdownRenderResult) => void;
  reject: (error: Error) => void;
}

const deferredRenderer = () => {
  const renders: DeferredRender[] = [];
  const executor: MarkdownExecutor = {
    execute: (request) => new Promise((resolve, reject) => renders.push({ request, resolve, reject })),
  };
  return { client: new MarkdownRendererClient(executor, 0, 5_000), renders };
};

const renderDirectSurface = (session: ReturnType<typeof markdownSession>, rendererClient: MarkdownRendererClient) => render(
  <MarkdownSurface
    session={session}
    rendererClient={rendererClient}
    onDocumentChange={vi.fn()}
    onLanguageChange={vi.fn()}
    onMarkdownChange={vi.fn()}
  />,
);

describe('Markdown surface', () => {
  it('never exposes source content while a rendered preview is pending and makes failure recovery explicit', async () => {
    const { client, renders } = deferredRenderer();
    const session = markdownSession('# Heading\n\nSOURCE_ONLY_SENTINEL_6F2A');
    const { container } = renderDirectSurface(session, client);
    await waitFor(() => expect(renders).toHaveLength(1));

    expect(document.body).not.toHaveTextContent('SOURCE_ONLY_SENTINEL_6F2A');
    expect(screen.getAllByText('Rendering preview').length).toBeGreaterThan(0);
    let accessibility = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    });
    expect(accessibility.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([]);

    await act(async () => {
      renders[0].reject(new Error('renderer details'));
      await Promise.resolve();
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Markdown preview failed safely');
    expect(document.body).not.toHaveTextContent('renderer details');
    accessibility = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    });
    expect(accessibility.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    const editor = screen.getByRole('textbox', { name: 'test.md text editor' });
    expect(EditorView.findFromDOM(editor)?.state.doc.toString()).toContain('SOURCE_ONLY_SENTINEL_6F2A');
  });

  it.each(['light', 'dark'])('keeps the pending state content-free in the %s theme', async (theme) => {
    document.documentElement.dataset.theme = theme;
    const { client, renders } = deferredRenderer();
    renderDirectSurface(markdownSession('# PRIVATE_THEME_SENTINEL_9C3D'), client);
    await waitFor(() => expect(renders).toHaveLength(1));
    expect(screen.getAllByText('Rendering preview').length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent('PRIVATE_THEME_SENTINEL_9C3D');
    document.documentElement.removeAttribute('data-theme');
  });

  it('turns a render timeout into an actionable contained failure', async () => {
    const executor: MarkdownExecutor = {
      execute: (_request, signal) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
      }),
    };
    const client = new MarkdownRendererClient(executor, 0, 5);
    renderDirectSurface(markdownSession('# Timeout source'), client);
    expect(await screen.findByRole('alert')).toHaveTextContent('Markdown preview failed safely');
    expect(screen.getByRole('button', { name: 'View source' })).toBeInTheDocument();
  });

  it('publishes only the current session revision when renders settle out of order', async () => {
    const { client, renders } = deferredRenderer();
    const first = markdownSession('# First revision');
    const { rerender } = renderDirectSurface(first, client);
    await waitFor(() => expect(renders).toHaveLength(1));
    const second = {
      ...markdownSession('# Second revision'),
      revision: first.revision + 1,
    };
    rerender(
      <MarkdownSurface session={second} rendererClient={client} onDocumentChange={vi.fn()} onLanguageChange={vi.fn()} onMarkdownChange={vi.fn()} />,
    );
    await waitFor(() => expect(renders).toHaveLength(2));

    await act(async () => renders[1].resolve(await renderMarkdown(renders[1].request)));
    expect(await screen.findByRole('heading', { name: 'Second revision' })).toBeInTheDocument();
    await act(async () => renders[0].resolve(await renderMarkdown(renders[0].request)));
    expect(screen.getByRole('heading', { name: 'Second revision' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First revision' })).not.toBeInTheDocument();
  });

  it('withdraws a ready projection synchronously when its source revision changes', async () => {
    const { client, renders } = deferredRenderer();
    const first = markdownSession('# Ready first revision');
    const { rerender } = renderDirectSurface(first, client);
    await waitFor(() => expect(renders).toHaveLength(1));
    await act(async () => renders[0].resolve(await renderMarkdown(renders[0].request)));
    expect(await screen.findByRole('heading', { name: 'Ready first revision' })).toBeInTheDocument();

    const second = { ...markdownSession('# Private next revision'), revision: first.revision + 1 };
    rerender(<MarkdownSurface session={second} rendererClient={client} onDocumentChange={vi.fn()} onLanguageChange={vi.fn()} onMarkdownChange={vi.fn()} />);
    expect(screen.queryByRole('heading', { name: 'Ready first revision' })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Private next revision');
    expect(screen.getAllByText('Rendering preview').length).toBeGreaterThan(0);
  });

  it('renders the governed complex corpus without blanking the document surface', async () => {
    for (const fixture of markdownCorpus) {
      const { unmount } = render(<App sessions={[{
        ...markdownSession(fixture.content),
        id: fixture.id,
        source: { ...markdownSession('').source, display_name: fixture.name },
      }]} />);
      expect(await screen.findByText(fixture.marker, {}, { timeout: 10_000 })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
      unmount();
    }
  }, 30_000);

  it.each([
    ['alpha then beta', 'alpha.md', 'Alpha body', 'beta.md', 'Beta body'],
    ['beta then alpha', 'beta.md', 'Beta body', 'alpha.md', 'Alpha body'],
    ['same bytes with different names', 'left.md', 'Identical body', 'right.md', 'Identical body'],
  ])('keeps the active identity and usable content for %s', async (_label, firstName, firstBody, secondName, secondBody) => {
    const first = { ...markdownSession(`# ${firstBody}`), id: `first-${firstName}`, source: { ...markdownSession('').source, display_name: firstName } };
    const second = { ...markdownSession(`# ${secondBody}`), id: `second-${secondName}`, lifecycle: 'background' as const, source: { ...markdownSession('').source, display_name: secondName } };
    render(<App sessions={[first, second]} />);
    expect(await screen.findByRole('heading', { name: firstBody })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(secondName.replace('.', '\\.'), 'iu') }));
    expect(await screen.findByRole('heading', { name: secondBody })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(new RegExp(secondName.replace('.', '\\.'), 'iu'));
  });

  it('publishes renderer measurements to the shared inspector', async () => {
    render(<App sessions={[markdownSession('# Metadata heading')]} />);
    await screen.findByRole('heading', { name: 'Metadata heading' });
    invokeMenu('File information');
    const inspector = screen.getByRole('complementary', { name: 'File information' });
    expect(inspector).toHaveTextContent('Sanitizer version2');
    expect(inspector).toHaveTextContent('Headings1');
    expect(inspector).toHaveTextContent('Parse duration');
  });

  it('renders Mermaid fences independently and routes each fallback to parent source', async () => {
    const content = '# Diagrams\n\n```mermaid\nflowchart TB\nAlphaNode-->BetaNode\n```\n\nBetween\n\n```mermaid\nflowchart TB\nBroken-->\n```\n\nAfter';
    render(<App sessions={[markdownSession(content)]} />);
    expect(await screen.findByRole('img', { name: /test\.md diagram 1/iu }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getByText('Between')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
    expect(await screen.findByText('The Mermaid source is malformed. Source remains available.', {}, { timeout: 10_000 })).toBeInTheDocument();
    invokeMenu('Search');
    fireEvent.change(screen.getByRole('textbox', { name: 'Find rendered text' }), { target: { value: 'AlphaNode' } });
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
    const sourceButtons = screen.getAllByRole('button', { name: 'View source' });
    fireEvent.click(sourceButtons[1]);
    expect(screen.getByRole('textbox', { name: 'test.md text editor' })).toBeInTheDocument();
  }, 15_000);

  it('renders safe structure, searches rendered text, exposes outline, and switches to exact source', async () => {
    const content = '# Heading\n\nA searchable **phrase**.\n\n<script>alert(1)</script>';
    render(<App sessions={[markdownSession(content)]} />);
    expect(await screen.findByRole('heading', { name: 'Heading' })).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();

    invokeMenu('Outline');
    expect(within(screen.getByRole('navigation', { name: 'Document outline' })).getByRole('button', { name: 'Heading' })).toBeInTheDocument();
    invokeMenu('Search');
    fireEvent.change(screen.getByRole('textbox', { name: 'Find rendered text' }), { target: { value: 'phrase' } });
    expect(screen.getByText('1 of 1')).toBeInTheDocument();

    invokeMenu('Edit source');
    const textbox = screen.getByRole('textbox', { name: 'test.md text editor' });
    expect(EditorView.findFromDOM(textbox)?.state.doc.toString()).toBe(content);
  });

  it('requires confirmation before invoking the external navigation gateway', async () => {
    const open = vi.fn(() => Promise.resolve());
    render(<App sessions={[markdownSession('[destination](https://example.com/path)')]} externalLinkGateway={{ open }} />);
    const link = await screen.findByRole('button', { name: /destination/i });
    fireEvent.click(link);
    expect(open).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Open external destination?' });
    expect(dialog).toHaveTextContent('https://example.com/path');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(link).toHaveFocus());
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(link);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Open destination' }));
    await waitFor(() => expect(open).toHaveBeenCalledOnce());
    expect(open).toHaveBeenCalledWith('https://example.com/path');
  });

  it('latches an external open while the gateway request is pending', async () => {
    let settle!: () => void;
    const open = vi.fn(() => new Promise<void>((resolve) => { settle = resolve; }));
    render(<App sessions={[markdownSession('[destination](https://example.com/path)')]} externalLinkGateway={{ open }} />);
    fireEvent.click(await screen.findByRole('button', { name: /destination/i }));
    const confirm = screen.getByRole('button', { name: 'Open destination' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(open).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Opening destination' })).toBeDisabled();
    settle();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('includes disclosed external destinations in the printable tree', async () => {
    render(<App sessions={[markdownSession('[destination](https://example.com/path)')]} />);
    const disclosure = await screen.findByText(/External destination https:\/\/example\.com\/path/u);
    expect(disclosure).toHaveClass('markdown-link-destination-disclosure');
  });

  it('clears a cached local image when the same node becomes blocked', async () => {
    const resolve = vi.fn(() => Promise.resolve('https://asset.localhost/image'));
    render(<App sessions={[markdownSession('![local](./image.png)')]} localAssetGateway={{ resolve }} />);
    expect(await screen.findByRole('img', { name: 'local' })).toBeInTheDocument();
    invokeMenu('Edit source');
    const textbox = screen.getByRole('textbox', { name: 'test.md text editor' });
    const view = EditorView.findFromDOM(textbox)!;
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '![remote](https://example.com/image.png)' } }));
    invokeMenu('Preview');
    await waitFor(() => expect(screen.getByRole('note')).toHaveTextContent('Image unavailable: remote'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('preserves generated footnote reference relationships', async () => {
    const { container } = render(<App sessions={[markdownSession('Note[^1].\n\n[^1]: Detail')]} />);
    await screen.findByText('Detail');
    const reference = container.querySelector<HTMLElement>('[data-footnote-ref]');
    const backReference = container.querySelector<HTMLElement>('[data-footnote-backref]');
    expect(reference?.id).toMatch(/^user-content-fnref-/u);
    expect(backReference).toHaveAttribute('title', `#${reference!.id}`);
  });

  it('selects the active rendered match when entering source mode', async () => {
    render(<App sessions={[markdownSession('# Heading\n\nFind the needle here.')]} />);
    await screen.findByRole('heading', { name: 'Heading' });
    invokeMenu('Search');
    fireEvent.change(screen.getByRole('textbox', { name: 'Find rendered text' }), { target: { value: 'needle' } });
    await screen.findByText('1 of 1');
    invokeMenu('Edit source');
    const textbox = screen.getByRole('textbox', { name: 'test.md text editor' });
    const view = EditorView.findFromDOM(textbox)!;
    await waitFor(() => {
      const selection = view.state.selection.main;
      expect(view.state.sliceDoc(selection.from, selection.to)).toContain('needle');
    });
  });

  it('resets rendered UI and pending authorization when switching Markdown tabs', async () => {
    const first = markdownSession('[first](https://first.example)');
    const second = {
      ...markdownSession('# Second document'),
      id: 'markdown-second',
      lifecycle: 'background' as const,
      source: { ...markdownSession('').source, display_name: 'second.md' },
    };
    render(<App sessions={[first, second]} />);
    fireEvent.click(await screen.findByRole('button', { name: /first/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /second\.md/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Second document' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /first/i })).not.toBeInTheDocument();
  });

  it('uses only an explicitly supplied local-document authority', async () => {
    const openDocument = vi.fn(() => Promise.resolve());
    render(<App sessions={[markdownSession('[guide](./guide.md)')]} localAssetGateway={{ resolve: () => Promise.resolve(null), openDocument }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'guide' }));
    expect(openDocument).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'test.md' }), './guide.md');
  });

  it('keeps read-only source inert and invokes print only from its explicit control', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const session = { ...markdownSession('# Read only'), renderer: { ...markdownSession('').renderer, capabilities: { ...markdownSession('').renderer.capabilities, edit: false } }, source: { ...markdownSession('').source, capabilities: { ...markdownSession('').source.capabilities, write: false } } };
    render(<App sessions={[session]} />);
    await screen.findByRole('heading', { name: 'Read only' });
    invokeMenu(/Print/);
    expect(print).toHaveBeenCalledOnce();
    invokeMenu('View source');
    expect(screen.getByRole('textbox', { name: 'test.md text editor' })).toHaveAttribute('aria-readonly', 'true');
    invokeMenu(/Print/);
    expect(print).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.markdown-print-document')).toHaveTextContent('Read only');
    print.mockRestore();
  });

  it('reports a bounded gateway failure without leaving the document', async () => {
    render(<App sessions={[markdownSession('[destination](https://example.com)')]} externalLinkGateway={{ open: () => Promise.reject(new Error('native details')) }} />);
    fireEvent.click(await screen.findByRole('button', { name: /destination/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Open destination' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The destination could not be opened');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('native details');
  });

  it('never asks the local resource gateway to resolve a remote image', async () => {
    const resolve = vi.fn(() => Promise.resolve('https://asset.localhost/image'));
    render(<App sessions={[markdownSession('![tracking](https://tracker.example/pixel)')]} localAssetGateway={{ resolve }} />);
    expect(await screen.findByRole('note')).toHaveTextContent('Image unavailable: tracking');
    expect(resolve).not.toHaveBeenCalled();
  });

  it('has no critical or serious accessibility findings after semantic rendering', async () => {
    const { container } = render(<App sessions={[markdownSession('# Heading\n\n- [x] Task\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nFootnote[^1].\n\n[^1]: Note')]} />);
    await screen.findByRole('heading', { name: 'Heading' });
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    });
    expect(results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')).toEqual([]);
  });
});
