import { AppFrame } from '../../../../brand/web/react/server';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { createRef, type Ref } from 'react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../App';
import type { ShellSession } from '../domain/contracts';
import type {
  MarkdownRenderRequest,
  MarkdownRenderResult,
} from '../domain/markdown-contract';
import { renderMarkdown } from '../domain/markdown-pipeline';
import {
  MarkdownRendererClient,
  type MarkdownExecutor,
} from '../domain/markdown-renderer';
import { markdownCorpus } from '../test/markdown-corpus';
import { initialSessions } from '../test/fixtures';
import { MarkdownSurface } from './MarkdownSurface';
import type { TextEditorHandle } from './TextEditorSurface';

const invokeMenu = (name: string | RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: 'Document tools' }));
  const matcher = typeof name === 'string' ? new RegExp(`^${name}`, 'u') : name;
  fireEvent.click(
    within(screen.getByRole('menu')).getByRole('menuitem', { name: matcher }),
  );
};

vi.mock('../domain/mermaid-adapter', async () => {
  const { DeterministicMermaidRendererClient } =
    await import('../test/mermaid-renderer-double');
  return { MermaidRendererClient: DeterministicMermaidRendererClient };
});

const markdownSession = (content: string) => ({
  ...initialSessions[3],
  id: 'markdown-test',
  lifecycle: 'active' as const,
  content,
  source: {
    ...initialSessions[3].source,
    display_name: 'test.md',
    byte_length: content.length,
  },
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
    execute: (request) =>
      new Promise((resolve, reject) =>
        renders.push({ request, resolve, reject }),
      ),
  };
  return { client: new MarkdownRendererClient(executor, 0, 5_000), renders };
};

const renderDirectSurface = (
  session: ShellSession,
  rendererClient: MarkdownRendererClient,
  handle?: Ref<TextEditorHandle>,
) =>
  render(
    <AppFrame>
      <MarkdownSurface
        ref={handle}
        session={session}
        rendererClient={rendererClient}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
        onMarkdownChange={vi.fn()}
      />
    </AppFrame>,
  );

describe('Markdown surface', () => {
  it.each(['Control', 'Meta'])(
    'copies only a rendered range through %s+C',
    async (modifier) => {
      const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
      const selection = window.getSelection()!;
      try {
        render(
          <App
            sessions={[
              markdownSession(
                '# Heading\n\nBefore **selected** after.\n\nTail.',
              ),
            ]}
          />,
        );
        const strong = await screen.findByText('selected');
        const paragraph = strong.closest('p')!;
        const range = document.createRange();
        range.setStart(paragraph.firstChild!, 3);
        range.setEnd(strong.firstChild!, 4);
        selection.removeAllRanges();
        selection.addRange(range);
        expect(selection.toString()).toBe('ore sele');
        fireEvent.keyDown(paragraph, {
          key: 'c',
          ctrlKey: modifier === 'Control',
          metaKey: modifier === 'Meta',
        });
        await waitFor(() =>
          expect(writeText).toHaveBeenCalledExactlyOnceWith('ore sele'),
        );
      } finally {
        selection.removeAllRanges();
        if (original) Object.defineProperty(navigator, 'clipboard', original);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    },
  );

  it.each(['foreign', 'cross-boundary', 'collapsed', 'inactive'])(
    'uses whole rendered text for a %s selection',
    async (kind) => {
      const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });
      const selection = window.getSelection()!;
      const foreign = document.createElement('p');
      foreign.textContent = 'Foreign selection';
      const handle = createRef<TextEditorHandle>();
      try {
        renderDirectSurface(
          {
            ...markdownSession('# Heading\n\nWhole document.'),
            lifecycle: kind === 'inactive' ? 'background' : 'active',
          },
          new MarkdownRendererClient({ execute: renderMarkdown }, 0),
          handle,
        );
        const heading = await screen.findByRole('heading', { name: 'Heading' });
        document.body.append(foreign);
        const range = document.createRange();
        if (kind === 'foreign') range.selectNodeContents(foreign);
        else if (kind === 'cross-boundary') {
          range.setStart(heading.firstChild!, 0);
          range.setEnd(foreign.firstChild!, 7);
        } else if (kind === 'inactive') {
          range.setStart(heading.firstChild!, 0);
          range.setEnd(heading.firstChild!, 4);
        } else {
          range.setStart(heading.firstChild!, 2);
          range.collapse(true);
        }
        selection.removeAllRanges();
        selection.addRange(range);
        if (kind === 'inactive') {
          expect(handle.current!.invoke('copy')).toBe(false);
          expect(writeText).not.toHaveBeenCalled();
        } else {
          await expect(handle.current!.invoke('copy')).resolves.toBe(true);
          expect(writeText).toHaveBeenCalledExactlyOnceWith(
            'Heading\nWhole document.',
          );
        }
      } finally {
        foreign.remove();
        selection.removeAllRanges();
        if (original) Object.defineProperty(navigator, 'clipboard', original);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    },
  );

  it('awaits selected-text clipboard completion and propagates denial', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    let complete!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const selection = window.getSelection()!;
    const handle = createRef<TextEditorHandle>();
    try {
      renderDirectSurface(
        markdownSession('# Heading\n\nWhole document.'),
        new MarkdownRendererClient({ execute: renderMarkdown }, 0),
        handle,
      );
      const paragraph = await screen.findByText('Whole document.');
      const range = document.createRange();
      range.setStart(paragraph.firstChild!, 0);
      range.setEnd(paragraph.firstChild!, 5);
      selection.removeAllRanges();
      selection.addRange(range);
      const pending = handle.current!.invoke('copy');
      let settled = false;
      void Promise.resolve(pending).then(() => {
        settled = true;
      });
      expect(writeText).toHaveBeenCalledExactlyOnceWith('Whole');
      await Promise.resolve();
      expect(settled).toBe(false);
      complete();
      await expect(pending).resolves.toBe(true);
      writeText.mockImplementationOnce(() =>
        Promise.reject(new Error('clipboard denied')),
      );
      await expect(handle.current!.invoke('copy')).rejects.toThrow(
        'clipboard denied',
      );
    } finally {
      complete?.();
      selection.removeAllRanges();
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('dismisses its pending link modal synchronously and restores the trigger focus', async () => {
    const handle = createRef<TextEditorHandle>();
    renderDirectSurface(
      markdownSession('[destination](https://example.com/path)'),
      new MarkdownRendererClient({ execute: renderMarkdown }, 0),
      handle,
    );
    const link = await screen.findByRole('button', { name: /destination/i });
    expect(handle.current?.dismissModal?.()).toBe(false);
    fireEvent.click(link);
    expect(
      screen.getByRole('dialog', { name: 'Open external destination?' }),
    ).toBeInTheDocument();
    act(() => {
      expect(handle.current?.dismissModal?.()).toBe(true);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(link).toHaveFocus());
    expect(handle.current?.dismissModal?.()).toBe(false);
  });

  it('never exposes source content while a rendered preview is pending and makes failure recovery explicit', async () => {
    const { client, renders } = deferredRenderer();
    const session = markdownSession('# Heading\n\nSOURCE_ONLY_SENTINEL_6F2A');
    const { container } = renderDirectSurface(session, client);
    await waitFor(() => expect(renders).toHaveLength(1));

    expect(document.body).not.toHaveTextContent('SOURCE_ONLY_SENTINEL_6F2A');
    expect(screen.getAllByText('Rendering preview').length).toBeGreaterThan(0);
    let accessibility = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      },
    });
    expect(
      accessibility.violations.filter(
        ({ impact }) => impact === 'critical' || impact === 'serious',
      ),
    ).toEqual([]);

    await act(async () => {
      renders[0].reject(new Error('renderer details'));
      await Promise.resolve();
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Markdown preview worker failed',
    );
    expect(document.body).not.toHaveTextContent('renderer details');
    accessibility = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      },
    });
    expect(
      accessibility.violations.filter(
        ({ impact }) => impact === 'critical' || impact === 'serious',
      ),
    ).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    const editor = screen.getByRole('textbox', { name: 'test.md text editor' });
    expect(EditorView.findFromDOM(editor)?.state.doc.toString()).toContain(
      'SOURCE_ONLY_SENTINEL_6F2A',
    );
  });

  it.each(['light', 'dark'])(
    'keeps the pending state content-free in the %s theme',
    async (theme) => {
      document.documentElement.dataset.theme = theme;
      const { client, renders } = deferredRenderer();
      renderDirectSurface(
        markdownSession('# PRIVATE_THEME_SENTINEL_9C3D'),
        client,
      );
      await waitFor(() => expect(renders).toHaveLength(1));
      expect(screen.getAllByText('Rendering preview').length).toBeGreaterThan(
        0,
      );
      expect(document.body).not.toHaveTextContent(
        'PRIVATE_THEME_SENTINEL_9C3D',
      );
      document.documentElement.removeAttribute('data-theme');
    },
  );

  it('keeps an unused reference definition source-only after rendering settles', async () => {
    render(
      <App
        sessions={[
          markdownSession(
            '# Safe heading\n\n[SOURCE_ONLY_REFERENCE_8A2C]: https://example.invalid/reference',
          ),
        ]}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Safe heading' }),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('SOURCE_ONLY_REFERENCE_8A2C');
  });

  it('turns a render timeout into an actionable contained failure', async () => {
    const executor: MarkdownExecutor = {
      execute: (_request, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Timed out', 'AbortError')),
            { once: true },
          );
        }),
    };
    const client = new MarkdownRendererClient(executor, 0, 5);
    renderDirectSurface(markdownSession('# Timeout source'), client);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Markdown preview timed out safely',
    );
    expect(
      screen.getByRole('button', { name: 'View source' }),
    ).toBeInTheDocument();
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
      <MarkdownSurface
        session={second}
        rendererClient={client}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
        onMarkdownChange={vi.fn()}
      />,
    );
    await waitFor(() => expect(renders).toHaveLength(2));

    await act(async () =>
      renders[1].resolve(await renderMarkdown(renders[1].request)),
    );
    expect(
      await screen.findByRole('heading', { name: 'Second revision' }),
    ).toBeInTheDocument();
    await act(async () =>
      renders[0].resolve(await renderMarkdown(renders[0].request)),
    );
    expect(
      screen.getByRole('heading', { name: 'Second revision' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'First revision' }),
    ).not.toBeInTheDocument();
  });

  it('withdraws a ready projection synchronously when its source revision changes', async () => {
    const { client, renders } = deferredRenderer();
    const first = markdownSession('# Ready first revision');
    const { rerender } = renderDirectSurface(first, client);
    await waitFor(() => expect(renders).toHaveLength(1));
    await act(async () =>
      renders[0].resolve(await renderMarkdown(renders[0].request)),
    );
    expect(
      await screen.findByRole('heading', { name: 'Ready first revision' }),
    ).toBeInTheDocument();

    const second = {
      ...markdownSession('# Private next revision'),
      revision: first.revision + 1,
    };
    rerender(
      <MarkdownSurface
        session={second}
        rendererClient={client}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
        onMarkdownChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('heading', { name: 'Ready first revision' }),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Private next revision');
    expect(screen.getAllByText('Rendering preview').length).toBeGreaterThan(0);
  });

  it('honors an incoming rendered mode before an earlier local source mode can paint', async () => {
    const { client, renders } = deferredRenderer();
    const sourceSession = {
      ...markdownSession('# Heading\n\nPRIVATE_MODE_SENTINEL_4D7B'),
      markdown_document: {
        ...markdownSession('').markdown_document,
        mode: 'source' as const,
      },
    };
    const { rerender } = renderDirectSurface(sourceSession, client);
    await waitFor(() => expect(renders).toHaveLength(1));
    expect(
      screen.getByRole('textbox', { name: 'test.md text editor' }),
    ).toBeInTheDocument();

    const renderedSession = {
      ...sourceSession,
      markdown_document: {
        ...sourceSession.markdown_document,
        mode: 'rendered' as const,
      },
    };
    rerender(
      <MarkdownSurface
        session={renderedSession}
        rendererClient={client}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
        onMarkdownChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('textbox', { name: 'test.md text editor' }),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('PRIVATE_MODE_SENTINEL_4D7B');
    expect(screen.getAllByText('Rendering preview').length).toBeGreaterThan(0);
  });

  it('renders the governed complex corpus without blanking the document surface', async () => {
    for (const fixture of markdownCorpus) {
      const { unmount } = render(
        <App
          sessions={[
            {
              ...markdownSession(fixture.content),
              id: fixture.id,
              source: {
                ...markdownSession('').source,
                display_name: fixture.name,
              },
            },
          ]}
        />,
      );
      expect(
        await screen.findByText(fixture.marker, {}, { timeout: 10_000 }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
      unmount();
    }
  }, 30_000);

  it.each([
    ['alpha then beta', 'alpha.md', 'Alpha body', 'beta.md', 'Beta body'],
    ['beta then alpha', 'beta.md', 'Beta body', 'alpha.md', 'Alpha body'],
    [
      'same bytes with different names',
      'left.md',
      'Identical body',
      'right.md',
      'Identical body',
    ],
  ])(
    'keeps the active identity and usable content for %s',
    async (_label, firstName, firstBody, secondName, secondBody) => {
      const first = {
        ...markdownSession(`# ${firstBody}`),
        id: `first-${firstName}`,
        source: { ...markdownSession('').source, display_name: firstName },
      };
      const second = {
        ...markdownSession(`# ${secondBody}`),
        id: `second-${secondName}`,
        lifecycle: 'background' as const,
        source: { ...markdownSession('').source, display_name: secondName },
      };
      render(<App sessions={[first, second]} />);
      expect(
        await screen.findByRole('heading', { name: firstBody }),
      ).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('tab', {
          name: new RegExp(secondName.replace('.', '\\.'), 'iu'),
        }),
      );
      expect(
        await screen.findByRole('heading', { name: secondBody }),
      ).toBeInTheDocument();
      expect(screen.getByRole('tabpanel')).toHaveAccessibleName(
        new RegExp(secondName.replace('.', '\\.'), 'iu'),
      );
    },
  );

  it('publishes renderer measurements to the shared inspector', async () => {
    render(<App sessions={[markdownSession('# Metadata heading')]} />);
    await screen.findByRole('heading', { name: 'Metadata heading' });
    invokeMenu('File information');
    const inspector = screen.getByRole('complementary', {
      name: 'File information',
    });
    expect(inspector).toHaveTextContent('Sanitizer version2');
    expect(inspector).toHaveTextContent('Headings1');
    expect(inspector).toHaveTextContent('Parse duration');
  });

  it('renders Mermaid fences independently and routes each fallback to parent source', async () => {
    const content =
      '# Diagrams\n\n```mermaid\nflowchart TB\nAlphaNode-->BetaNode\n```\n\nBetween\n\n```mermaid\nflowchart TB\nBroken-->\n```\n\nAfter';
    render(<App sessions={[markdownSession(content)]} />);
    expect(
      await screen.findByRole(
        'img',
        { name: /test\.md diagram 1/iu },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Between')).toBeInTheDocument();
    expect(screen.getByText('After')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'The Mermaid source is malformed. Source remains available.',
        {},
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    invokeMenu('Search');
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Find rendered text' }),
      { target: { value: 'AlphaNode' } },
    );
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));
    const sourceButtons = screen.getAllByRole('button', {
      name: 'View source',
    });
    fireEvent.click(sourceButtons[1]);
    expect(
      screen.getByRole('textbox', { name: 'test.md text editor' }),
    ).toBeInTheDocument();
  }, 15_000);

  it('renders safe structure, searches rendered text, exposes outline, and switches to exact source', async () => {
    const content =
      '# Heading\n\nA searchable **phrase**.\n\n<script>alert(1)</script>';
    render(<App sessions={[markdownSession(content)]} />);
    expect(
      await screen.findByRole('heading', { name: 'Heading' }),
    ).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();

    invokeMenu('Outline');
    expect(
      within(
        screen.getByRole('navigation', { name: 'Document outline' }),
      ).getByRole('button', { name: 'Heading' }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(
        screen.getByRole('navigation', { name: 'Document outline' }),
      ).getByRole('button', { name: 'Heading' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Heading' })).toHaveFocus(),
    );
    invokeMenu('Search');
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Find rendered text' }),
      { target: { value: 'phrase' } },
    );
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));

    invokeMenu('Edit');
    const textbox = screen.getByRole('textbox', {
      name: 'test.md text editor',
    });
    expect(EditorView.findFromDOM(textbox)?.state.doc.toString()).toBe(content);
  });

  it('requires confirmation before invoking the external navigation gateway', async () => {
    const open = vi.fn(() => Promise.resolve());
    render(
      <App
        sessions={[markdownSession('[destination](https://example.com/path)')]}
        externalLinkGateway={{ open }}
      />,
    );
    const link = await screen.findByRole('button', { name: /destination/i });
    fireEvent.click(link);
    expect(open).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', {
      name: 'Open external destination?',
    });
    expect(dialog).toHaveTextContent('https://example.com/path');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(link).toHaveFocus());
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(link);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Open destination',
      }),
    );
    await waitFor(() => expect(open).toHaveBeenCalledOnce());
    expect(open).toHaveBeenCalledWith('https://example.com/path');
  });

  it('latches an external open while the gateway request is pending', async () => {
    let settle!: () => void;
    const open = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );
    render(
      <App
        sessions={[markdownSession('[destination](https://example.com/path)')]}
        externalLinkGateway={{ open }}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /destination/i }),
    );
    const confirm = screen.getByRole('button', { name: 'Open destination' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(open).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: 'Opening destination' }),
    ).toBeDisabled();
    settle();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('includes disclosed external destinations in the printable tree', async () => {
    render(
      <App
        sessions={[markdownSession('[destination](https://example.com/path)')]}
      />,
    );
    const disclosure = await screen.findByText(
      /External destination https:\/\/example\.com\/path/u,
    );
    expect(disclosure).toHaveClass('markdown-link-destination-disclosure');
  });

  it('clears a cached local image when the same node becomes blocked', async () => {
    const resolve = vi.fn(() =>
      Promise.resolve('https://asset.localhost/image'),
    );
    render(
      <App
        sessions={[markdownSession('![local](./image.png)')]}
        localAssetGateway={{ resolve }}
      />,
    );
    expect(
      await screen.findByRole('img', { name: 'local' }),
    ).toBeInTheDocument();
    invokeMenu('Edit');
    const textbox = screen.getByRole('textbox', {
      name: 'test.md text editor',
    });
    const view = EditorView.findFromDOM(textbox)!;
    act(() =>
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: '![remote](https://example.com/image.png)',
        },
      }),
    );
    invokeMenu('Read');
    await waitFor(() =>
      expect(screen.getByRole('note')).toHaveTextContent(
        'Image unavailable: remote',
      ),
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('preserves generated footnote reference relationships', async () => {
    const { container } = render(
      <App sessions={[markdownSession('Note[^1].\n\n[^1]: Detail')]} />,
    );
    await screen.findByText('Detail');
    const reference = container.querySelector<HTMLElement>(
      '[data-footnote-ref]',
    );
    const backReference = container.querySelector<HTMLElement>(
      '[data-footnote-backref]',
    );
    expect(reference?.id).toMatch(/^user-content-fnref-/u);
    expect(backReference).toHaveAttribute('title', `#${reference!.id}`);
  });

  it('selects the active rendered match when entering source mode', async () => {
    render(
      <App
        sessions={[markdownSession('# Heading\n\nFind the needle here.')]}
      />,
    );
    await screen.findByRole('heading', { name: 'Heading' });
    invokeMenu('Search');
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Find rendered text' }),
      { target: { value: 'needle' } },
    );
    await screen.findByText('1 of 1');
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));
    invokeMenu('Edit');
    const textbox = screen.getByRole('textbox', {
      name: 'test.md text editor',
    });
    const view = EditorView.findFromDOM(textbox)!;
    await waitFor(() => {
      const selection = view.state.selection.main;
      expect(view.state.sliceDoc(selection.from, selection.to)).toContain(
        'needle',
      );
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
    expect(
      screen.queryByRole('tab', { name: /second\.md/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('tab', { name: /second\.md/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Second document' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /first/i }),
    ).not.toBeInTheDocument();
  });

  it('uses only an explicitly supplied local-document authority', async () => {
    const openDocument = vi.fn(() => Promise.resolve());
    render(
      <App
        sessions={[markdownSession('[guide](./guide.md)')]}
        localAssetGateway={{
          resolve: () => Promise.resolve(null),
          openDocument,
        }}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'guide' }));
    expect(openDocument).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: 'test.md' }),
      './guide.md',
    );
  });

  it('keeps read-only source inert and invokes print only from its explicit control', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const session = {
      ...markdownSession('# Read only'),
      renderer: {
        ...markdownSession('').renderer,
        capabilities: {
          ...markdownSession('').renderer.capabilities,
          edit: false,
        },
      },
      source: {
        ...markdownSession('').source,
        capabilities: {
          ...markdownSession('').source.capabilities,
          write: false,
        },
      },
    };
    render(<App sessions={[session]} />);
    await screen.findByRole('heading', { name: 'Read only' });
    invokeMenu(/Print/);
    expect(print).toHaveBeenCalledOnce();
    invokeMenu('View source');
    expect(
      screen.getByRole('textbox', { name: 'test.md text editor' }),
    ).toHaveAttribute('aria-readonly', 'true');
    invokeMenu(/Print/);
    expect(print).toHaveBeenCalledTimes(2);
    expect(
      document.querySelector('.markdown-print-document'),
    ).toHaveTextContent('Read only');
    print.mockRestore();
  });

  it('reports a bounded gateway failure without leaving the document', async () => {
    render(
      <App
        sessions={[markdownSession('[destination](https://example.com)')]}
        externalLinkGateway={{
          open: () => Promise.reject(new Error('native details')),
        }}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /destination/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open destination' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The destination could not be opened',
    );
    expect(screen.getByRole('dialog')).not.toHaveTextContent('native details');
  });

  it('never asks the local resource gateway to resolve a remote image', async () => {
    const resolve = vi.fn(() =>
      Promise.resolve('https://asset.localhost/image'),
    );
    render(
      <App
        sessions={[
          markdownSession('![tracking](https://tracker.example/pixel)'),
        ]}
        localAssetGateway={{ resolve }}
      />,
    );
    expect(await screen.findByRole('note')).toHaveTextContent(
      'Image unavailable: tracking',
    );
    expect(resolve).not.toHaveBeenCalled();
  });

  it('shows a visible empty-document outcome rather than an empty article', async () => {
    renderDirectSurface(
      markdownSession(''),
      new MarkdownRendererClient(undefined, 0, 1000),
    );
    expect(await screen.findByText('This document is empty.')).toBeVisible();
  });

  it('shows output-limit refusal with source access rather than remaining pending', async () => {
    const client = new MarkdownRendererClient(
      {
        execute: (request) =>
          Promise.resolve<MarkdownRenderResult>({
            request_id: request.request_id,
            session_id: request.session_id,
            source_revision: request.source_revision,
            sanitizer_version: request.sanitizer_version,
            status: 'limited',
            tree: null,
            outline: [],
            search_text: [],
            diagnostics: [
              {
                code: 'markdown_output_limited',
                message:
                  'The rendered structure exceeds the safe preview limit. Source remains available.',
              },
            ],
            measurements: {
              source_bytes: 1,
              parse_duration_ms: 0,
              node_count: 0,
              heading_count: 0,
              search_entry_count: 0,
            },
          }),
      },
      0,
      1000,
    );
    renderDirectSurface(markdownSession('limited'), client);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'rendered structure exceeds',
    );
    expect(screen.getByRole('button', { name: 'View source' })).toBeEnabled();
  });

  it('contains asynchronous projection callback failure and exposes source without leaking the exception', async () => {
    const onFailure = vi.fn();
    render(
      <MarkdownSurface
        session={markdownSession('# Available source')}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
        onMarkdownChange={vi.fn()}
        onFailure={onFailure}
        onMetadataContribution={() => {
          throw new Error('private path and document contents');
        }}
      />,
    );
    expect(
      await screen.findByText(
        'Markdown projection failed. Source remains available.',
      ),
    ).toBeInTheDocument();
    expect(onFailure).toHaveBeenCalledWith(
      'markdown',
      'projection',
      'markdown_projection_failed',
    );
    expect(document.body).not.toHaveTextContent('private path');
    fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    expect(
      screen.getByRole('textbox', { name: 'test.md text editor' }),
    ).toBeInTheDocument();
  });

  it('has no critical or serious accessibility findings after semantic rendering', async () => {
    const { container } = render(
      <App
        sessions={[
          markdownSession(
            '# Heading\n\n- [x] Task\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nFootnote[^1].\n\n[^1]: Note',
          ),
        ]}
      />,
    );
    await screen.findByRole('heading', { name: 'Heading' });
    const results = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      },
    });
    expect(
      results.violations.filter(
        ({ impact }) => impact === 'critical' || impact === 'serious',
      ),
    ).toEqual([]);
  });
});

describe('Markdown task continuity', () => {
  it('keeps the same source editor, selection and undo history across Read and Edit', async () => {
    const ref = createRef<TextEditorHandle>();
    const session = {
      ...markdownSession('# Title\n\nBody'),
      edit_origin: 'copy' as const,
    };
    const client = new MarkdownRendererClient({ execute: renderMarkdown }, 0);
    render(
      <AppFrame>
        <MarkdownSurface
          ref={ref}
          session={session}
          rendererClient={client}
          onDocumentChange={vi.fn()}
          onLanguageChange={vi.fn()}
          onMarkdownChange={vi.fn()}
        />
      </AppFrame>,
    );
    await screen.findByRole('heading', { name: 'Title' });
    act(() => {
      void ref.current!.invoke('edit');
    });
    const editor = screen.getByRole('textbox', { name: 'test.md text editor' });
    const view = EditorView.findFromDOM(editor)!;
    act(() => {
      ref.current!.selectRange(0, 3);
    });
    act(() =>
      view.dispatch({
        changes: { from: 0, insert: 'edit' },
        selection: { anchor: 4 },
      }),
    );
    act(() => {
      void ref.current!.invoke('edit');
    });
    expect(
      screen.queryByRole('textbox', { name: 'test.md text editor' }),
    ).not.toBeInTheDocument();
    act(() => {
      void ref.current!.invoke('edit');
    });
    expect(screen.getByRole('textbox', { name: 'test.md text editor' })).toBe(
      editor,
    );
    await act(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    });
    expect(view.state.selection.main.head).toBe(4);
    act(() => {
      expect(ref.current!.invoke('undo')).toBe(true);
    });
    expect(view.state.doc.toString()).toBe('# Title\n\nBody');
  });
  it('returns rendered Find focus to the document without discarding the query', async () => {
    const ref = createRef<TextEditorHandle>();
    const client = new MarkdownRendererClient({ execute: renderMarkdown }, 0);
    const { container } = render(
      <AppFrame>
        <MarkdownSurface
          ref={ref}
          session={markdownSession('# Title\n\nBody body')}
          rendererClient={client}
          onDocumentChange={vi.fn()}
          onLanguageChange={vi.fn()}
          onMarkdownChange={vi.fn()}
        />
      </AppFrame>,
    );
    await screen.findByRole('heading', { name: 'Title' });
    act(() => {
      void ref.current!.invoke('search');
    });
    expect(
      screen.getByRole('dialog', { name: 'Find in Markdown' }),
    ).toHaveAttribute('aria-modal', 'true');
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Find rendered text' }),
      { target: { value: 'body' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));
    await waitFor(() =>
      expect(
        container.querySelector(
          '.markdown-document:not(.markdown-print-document)',
        ),
      ).toHaveFocus(),
    );
    act(() => {
      void ref.current!.invoke('search');
    });
    expect(
      screen.getByRole('textbox', { name: 'Find rendered text' }),
    ).toHaveValue('body');
  });
});

describe('fragment task focus', () => {
  it('focuses the correct visible heading and footnote destinations across mode changes', async () => {
    const ref = createRef<TextEditorHandle>();
    const session = {
      ...markdownSession(
        '# Heading\n\n[fragment](#heading) Note[^one].\n\n[^one]: Detail.',
      ),
      edit_origin: 'copy' as const,
    };
    const client = new MarkdownRendererClient({ execute: renderMarkdown }, 0);
    const { container } = render(
      <AppFrame>
        <MarkdownSurface
          ref={ref}
          session={session}
          rendererClient={client}
          onDocumentChange={vi.fn()}
          onLanguageChange={vi.fn()}
          onMarkdownChange={vi.fn()}
        />
      </AppFrame>,
    );
    await screen.findByText('Detail.');
    const reference = container.querySelector<HTMLElement>(
      '[data-footnote-ref]',
    )!;
    const destination = document.getElementById(
      reference.getAttribute('title')!.slice(1),
    )!;
    Object.defineProperty(destination, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(reference, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    fireEvent.click(reference);
    expect(destination).toHaveFocus();
    fireEvent.click(
      container.querySelector<HTMLElement>('[data-footnote-backref]')!,
    );
    expect(reference).toHaveFocus();
    act(() => {
      void ref.current!.invoke('edit');
    });
    act(() => {
      void ref.current!.invoke('edit');
    });
    fireEvent.click(screen.getByRole('link', { name: 'fragment' }));
    expect(screen.getByRole('heading', { name: 'Heading' })).toHaveFocus();
    expect(container.querySelectorAll('[id="heading"]')).toHaveLength(1);
  });
});

describe('scoped rendered navigation', () => {
  it('scrolls only the current article and focuses a fragment without scrolling outer chrome', async () => {
    const client = new MarkdownRendererClient({ execute: renderMarkdown }, 0);
    const { container } = renderDirectSurface(
      markdownSession('# Heading\n\n[fragment](#heading)'),
      client,
    );
    const heading = await screen.findByRole('heading', { name: 'Heading' });
    const article = container.querySelector<HTMLElement>('.markdown-document')!;
    vi.spyOn(article, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 100, 300, 200),
    );
    vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 250, 300, 24),
    );
    article.scrollTop = 10;
    const focus = vi.spyOn(heading, 'focus');
    fireEvent.click(screen.getByRole('link', { name: 'fragment' }));
    expect(article.scrollTop).toBe(160);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(heading).toHaveFocus();
  });
});

describe('unavailable fragment feedback', () => {
  it('announces an unknown fragment without moving focus or changing source', async () => {
    const session = markdownSession(
      '# Current section\n\n[missing section](#absent-private-target)',
    );
    const changed = vi.fn();
    const handle = createRef<TextEditorHandle>();
    const { container } = render(
      <MarkdownSurface
        ref={handle}
        session={session}
        onDocumentChange={changed}
        onLanguageChange={vi.fn()}
        onMarkdownChange={vi.fn()}
      />,
    );
    const trigger = await screen.findByRole('link', {
      name: 'missing section',
    });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The linked section is not available in this document.',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      'absent-private-target',
    );
    expect(trigger).toHaveFocus();
    expect(
      screen.getByRole('heading', { name: 'Current section' }),
    ).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
    act(() => {
      void handle.current!.invoke('edit');
    });
    expect(container.querySelector('.markdown-print-document')).not.toBeNull();
    expect(
      container.querySelector('.markdown-print-document [role=alert]'),
    ).toBeNull();
  });
});

it('announces a rendered query with no matches and disables navigation without changing source', async () => {
  const changed = vi.fn();
  const ref = createRef<TextEditorHandle>();
  render(
    <AppFrame>
      <MarkdownSurface
        ref={ref}
        session={markdownSession('# Present heading')}
        onDocumentChange={changed}
        onLanguageChange={vi.fn()}
        onMarkdownChange={vi.fn()}
      />
    </AppFrame>,
  );
  await screen.findByRole('heading', { name: 'Present heading' });
  act(() => {
    void ref.current!.invoke('search');
  });
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Find rendered text' }),
    { target: { value: 'absent-query' } },
  );
  expect(
    screen.getByRole('status', { name: 'Rendered search results' }),
  ).toHaveTextContent('No matches');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  expect(changed).not.toHaveBeenCalled();
});

it('moves and wraps exact rendered matches through Next, Previous and current provider routes', async () => {
  const handle = createRef<TextEditorHandle>();
  const { container } = renderDirectSurface(
    markdownSession('# Current document\n\nmatch one.\n\nmatch two.'),
    new MarkdownRendererClient({ execute: renderMarkdown }, 0),
    handle,
  );
  await screen.findByRole('heading', { name: 'Current document' });
  act(() => {
    expect(handle.current!.invoke('search')).toBe(true);
  });
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Find rendered text' }),
    { target: { value: 'match' } },
  );
  const activeText = () =>
    container.querySelector('.markdown-document .markdown-search-match')
      ?.textContent;
  await waitFor(() => expect(activeText()).toBe('match one.'));
  for (const [button, count, expected] of [
    ['Next', '2 of 2', 'match two.'],
    ['Next', '1 of 2', 'match one.'],
    ['Previous', '2 of 2', 'match two.'],
    ['Previous', '1 of 2', 'match one.'],
  ] as const) {
    fireEvent.click(screen.getByRole('button', { name: button }));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Rendered search results' }),
      ).toHaveTextContent(count),
    );
    expect(activeText()).toBe(expected);
  }
  act(() => {
    expect(handle.current!.invoke('close_search')).toBe(true);
  });
  await waitFor(() =>
    expect(container.querySelector('.markdown-document')).toHaveFocus(),
  );
  act(() => {
    expect(handle.current!.invoke('find_next')).toBe(true);
  });
  await waitFor(() => expect(activeText()).toBe('match two.'));
  act(() => {
    expect(handle.current!.invoke('find_previous')).toBe(true);
  });
  await waitFor(() => expect(activeText()).toBe('match one.'));
  act(() => {
    expect(handle.current!.invoke('search')).toBe(true);
  });
  expect(
    screen.getByRole('textbox', { name: 'Find rendered text' }),
  ).toHaveValue('match');
  expect(
    screen.getByRole('status', { name: 'Rendered search results' }),
  ).toHaveTextContent('1 of 2');
});
