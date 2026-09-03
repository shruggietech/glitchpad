import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { App, initialSessions } from '../App';

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
    source_selection: null,
  },
});

describe('Markdown surface', () => {
  it('renders safe structure, searches rendered text, exposes outline, and switches to exact source', async () => {
    const content = '# Heading\n\nA searchable **phrase**.\n\n<script>alert(1)</script>';
    render(<App sessions={[markdownSession(content)]} />);
    expect(await screen.findByRole('heading', { name: 'Heading' })).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Outline' }).at(-1)!);
    expect(within(screen.getByRole('navigation', { name: 'Document outline' })).getByRole('button', { name: 'Heading' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Search' }).at(-1)!);
    fireEvent.change(screen.getByRole('textbox', { name: 'Find rendered text' }), { target: { value: 'phrase' } });
    expect(screen.getByText('1 of 1')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' }).at(-1)!);
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
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    expect(screen.getByRole('textbox', { name: 'test.md text editor' })).toHaveAttribute('aria-readonly', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
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
