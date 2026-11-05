import { AppFrame } from '../../../../brand/web/react/server';
import {
  act,
  fireEvent,
  render as renderView,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createRef, type ReactElement } from 'react';
import { PreferenceContext } from '../domain/preference-context';
import { defaultPreferences } from '../domain/persistence';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';

import {
  noRendererCapabilities,
  noSourceCapabilities,
  type ShellSession,
} from '../domain/contracts';
import { detectLanguage } from '../domain/language';
import {
  EDITABLE_TEXT_MAX_BYTES,
  createTextDocument,
} from '../domain/text-document';
import { TextEditorSurface, type TextEditorHandle } from './TextEditorSurface';

const render = (ui: ReactElement) =>
  renderView(ui, ui.type === AppFrame ? undefined : { wrapper: AppFrame });

const makeSession = (editable = true): ShellSession => {
  const content = 'const value = 1;\n';
  return {
    id: 'editor',
    source: {
      identity: {
        authority: 'synthetic',
        scope: 'tests',
        token: 'editor',
        strength: 'strong',
      },
      display_name: 'editor.ts',
      claimed_media_type: 'text/plain',
      byte_length: content.length,
      modified_unix_ms: null,
      kind: 'memory',
      capabilities: { ...noSourceCapabilities(), read: true, write: editable },
    },
    renderer: {
      id: 'text',
      label: 'Text',
      capabilities: {
        ...noRendererCapabilities(),
        view: true,
        copy: true,
        search: true,
        edit: editable,
        save: editable,
      },
    },
    lifecycle: 'active',
    dirty: false,
    revision: 1,
    content,
    text_document: createTextDocument({
      rawText: content,
      displayName: 'editor.ts',
      language: detectLanguage('editor.ts', content),
    }),
  };
};

const openDetails = (ref: { readonly current: TextEditorHandle | null }) => {
  if (!screen.queryByRole('dialog', { name: 'Document details' })) {
    act(() => {
      expect(ref.current!.invoke('document_details')).toBe(true);
    });
  }
};

describe('TextEditorSurface', () => {
  it('mounts an accessible editable CodeMirror instance and exposes commands', async () => {
    const ref = createRef<TextEditorHandle>();
    const { container, unmount } = render(
      <TextEditorSurface
        ref={ref}
        session={makeSession()}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('textbox', { name: 'editor.ts text editor' }),
    ).toHaveAttribute('contenteditable', 'true');
    const host = container.querySelector('.text-editor');
    expect(host).toHaveAttribute('data-performance-ready', 'pending');
    await waitFor(() =>
      expect(host).toHaveAttribute('data-performance-ready', 'true'),
    );
    openDetails(ref);
    expect(screen.getByLabelText('Text document status')).toHaveTextContent(
      'Round-trip safe',
    );
    expect(ref.current?.invoke('toggle_wrap')).toBe(true);
    unmount();
    expect(ref.current).toBeNull();
  });

  it('denies content editing without source write authority', () => {
    const ref = createRef<TextEditorHandle>();
    render(
      <TextEditorSurface
        ref={ref}
        session={makeSession(false)}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('textbox', { name: 'editor.ts text editor' }),
    ).toHaveAttribute('contenteditable', 'false');
    openDetails(ref);
    expect(screen.getByLabelText('Text document status')).toHaveTextContent(
      'Read only',
    );
  });

  it('keeps recovery-only buffers editable without original source authority', () => {
    const onDocumentChange = vi.fn();
    const session = makeSession(false);
    session.integrity = 'recovery_only';
    session.renderer.capabilities.edit = true;
    render(
      <TextEditorSurface
        session={session}
        onDocumentChange={onDocumentChange}
        onLanguageChange={vi.fn()}
      />,
    );
    const textbox = screen.getByRole('textbox', {
      name: 'editor.ts text editor',
    });
    expect(textbox).toHaveAttribute('contenteditable', 'true');
    EditorView.findFromDOM(textbox)?.dispatch({
      changes: { from: 0, to: 5, insert: 'let' },
    });
    expect(onDocumentChange).toHaveBeenCalledWith(
      'editor',
      1,
      expect.objectContaining({ normalized_text: 'let value = 1;\n' }),
      2,
    );
  });

  it('projects CodeMirror changes through the revision-bound text model', () => {
    const onDocumentChange = vi.fn();
    render(
      <TextEditorSurface
        session={makeSession()}
        onDocumentChange={onDocumentChange}
        onLanguageChange={vi.fn()}
      />,
    );
    const textbox = screen.getByRole('textbox', {
      name: 'editor.ts text editor',
    });
    const view = EditorView.findFromDOM(textbox);
    expect(view).not.toBeNull();
    view?.dispatch({ changes: { from: 6, to: 11, insert: 'answer' } });
    expect(onDocumentChange).toHaveBeenCalledWith(
      'editor',
      1,
      expect.objectContaining({
        normalized_text: 'const answer = 1;\n',
        raw_text: 'const answer = 1;\n',
      }),
      2,
    );
  });

  it('rejects a CodeMirror change that would exceed the editable byte ceiling', () => {
    const onDocumentChange = vi.fn();
    const session = makeSession();
    session.content = 'x';
    session.text_document = createTextDocument({
      rawText: 'x',
      displayName: 'editor.ts',
      sourceBytes: EDITABLE_TEXT_MAX_BYTES,
    });
    render(
      <TextEditorSurface
        session={session}
        onDocumentChange={onDocumentChange}
        onLanguageChange={vi.fn()}
      />,
    );
    const textbox = screen.getByRole('textbox', {
      name: 'editor.ts text editor',
    });
    const view = EditorView.findFromDOM(textbox);
    view?.dispatch({ changes: { from: 1, insert: 'y' } });

    expect(view?.state.doc.toString()).toBe('x');
    expect(onDocumentChange).not.toHaveBeenCalled();
  });

  it('publishes an explicit session language override', () => {
    const ref = createRef<TextEditorHandle>();
    const onLanguageChange = vi.fn();
    render(
      <TextEditorSurface
        ref={ref}
        session={makeSession()}
        onDocumentChange={vi.fn()}
        onLanguageChange={onLanguageChange}
      />,
    );
    openDetails(ref);
    fireEvent.change(screen.getByRole('combobox', { name: 'Language mode' }), {
      target: { value: 'rust' },
    });
    expect(onLanguageChange).toHaveBeenCalledWith(
      'editor',
      1,
      expect.objectContaining({ language: 'rust', origin: 'session_override' }),
    );
  });
});

describe('truthful editor command outcomes', () => {
  it('updates editable presentation and editor policy when local-copy authority changes', async () => {
    const ref = createRef<TextEditorHandle>();
    const session = makeSession();
    const props = { onDocumentChange: vi.fn(), onLanguageChange: vi.fn() };
    const { rerender } = render(
      <TextEditorSurface ref={ref} session={session} {...props} />,
    );
    const original = screen.getByRole('textbox', {
      name: 'editor.ts text editor',
    });
    await waitFor(() =>
      expect(original.closest('.text-editor')).toHaveAttribute(
        'data-performance-ready',
        'true',
      ),
    );
    const view = EditorView.findFromDOM(original)!;
    const readonly = {
      ...session,
      source: {
        ...session.source,
        capabilities: { ...session.source.capabilities, write: false },
      },
    };
    rerender(<TextEditorSurface ref={ref} session={readonly} {...props} />);
    expect(original).toHaveAttribute('contenteditable', 'false');
    expect(view.state.readOnly).toBe(true);
    rerender(
      <TextEditorSurface
        ref={ref}
        session={{ ...readonly, edit_origin: 'copy' }}
        {...props}
      />,
    );
    expect(original).toHaveAttribute('contenteditable', 'true');
    expect(view.state.readOnly).toBe(false);
    openDetails(ref);
    expect(screen.getByLabelText('Text document status')).toHaveTextContent(
      'Editable',
    );
    expect(readonly.source.capabilities.write).toBe(false);
  });
  it('updates the accessible saved name without replacing the editor or losing undo history', async () => {
    const ref = createRef<TextEditorHandle>();
    const session = makeSession();
    const props = { onDocumentChange: vi.fn(), onLanguageChange: vi.fn() };
    const { rerender } = render(
      <TextEditorSurface ref={ref} session={session} {...props} />,
    );
    const original = screen.getByRole('textbox', {
      name: 'editor.ts text editor',
    });
    await waitFor(() =>
      expect(original.closest('.text-editor')).toHaveAttribute(
        'data-performance-ready',
        'true',
      ),
    );
    const view = EditorView.findFromDOM(original)!;
    act(() => view.dispatch({ changes: { from: 0, insert: '// edit\n' } }));
    rerender(
      <TextEditorSurface
        ref={ref}
        session={{
          ...session,
          source: { ...session.source, display_name: 'Saved.ts' },
        }}
        {...props}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Saved.ts text editor' })).toBe(
      original,
    );
    act(() => {
      expect(ref.current!.invoke('undo')).toBe(true);
    });
    expect(view.state.doc.toString()).toBe('const value = 1;\n');
  });
  it('awaits clipboard completion and propagates denied writes', async () => {
    let complete!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    try {
      const ref = createRef<TextEditorHandle>();
      render(
        <TextEditorSurface
          ref={ref}
          session={makeSession()}
          onDocumentChange={vi.fn()}
          onLanguageChange={vi.fn()}
        />,
      );
      await waitFor(() =>
        expect(
          screen
            .getByRole('textbox', { name: 'editor.ts text editor' })
            .closest('.text-editor'),
        ).toHaveAttribute('data-performance-ready', 'true'),
      );
      const pending = ref.current!.invoke('copy');
      expect(pending).toBeInstanceOf(Promise);
      expect(writeText).toHaveBeenCalledWith('const value = 1;\n');
      complete();
      await expect(pending).resolves.toBe(true);
      writeText.mockImplementationOnce(() =>
        Promise.reject(new Error('clipboard denied')),
      );
      await expect(ref.current!.invoke('copy')).rejects.toThrow(
        'clipboard denied',
      );
      expect(ref.current!.invoke('undo')).toBe(false);
      expect(ref.current!.invoke('redo')).toBe(false);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('reports unavailable copy without a clipboard implementation', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    try {
      const ref = createRef<TextEditorHandle>();
      render(
        <TextEditorSurface
          ref={ref}
          session={makeSession()}
          onDocumentChange={vi.fn()}
          onLanguageChange={vi.fn()}
        />,
      );
      await waitFor(() =>
        expect(
          screen
            .getByRole('textbox', { name: 'editor.ts text editor' })
            .closest('.text-editor'),
        ).toHaveAttribute('data-performance-ready', 'true'),
      );
      expect(ref.current!.invoke('copy')).toBe(false);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});

describe('editor task controls', () => {
  it('announces real Find counts, invalid regular expressions and case/word options using the actual CodeMirror panel', async () => {
    const ref = createRef<TextEditorHandle>();
    const session = makeSession();
    session.text_document = createTextDocument({
      rawText: 'cat Cat scatter cat',
      displayName: 'editor.ts',
    });
    const { container } = render(
      <TextEditorSurface
        ref={ref}
        session={session}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );
    const view = EditorView.findFromDOM(
      screen.getByRole('textbox', { name: 'editor.ts text editor' }),
    )!;
    act(() => {
      void ref.current!.invoke('search');
    });
    const query = screen.getByRole('textbox', { name: 'Find' });
    fireEvent.change(query, { target: { value: 'cat' } });
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Find results' }),
      ).toHaveTextContent('4 matches'),
    );
    fireEvent.click(screen.getByLabelText('Match case'));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Find results' }),
      ).toHaveTextContent('3 matches'),
    );
    fireEvent.click(screen.getByLabelText('Whole word'));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Find results' }),
      ).toHaveTextContent('2 matches'),
    );
    fireEvent.click(screen.getByLabelText('Regular expression'));
    fireEvent.change(query, { target: { value: '[' } });
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Find results' }),
      ).toHaveTextContent('Invalid regular expression'),
    );
    expect(query).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Replace all' })).toBeDisabled();
    expect(container.querySelector('.cm-search')).toBeInTheDocument();
    expect(view.state.doc.toString()).toBe('cat Cat scatter cat');
  });
  it('replaces exact matches once, exposes actual undo/redo depth, and closes search to editor focus', async () => {
    const ref = createRef<TextEditorHandle>();
    const history = vi.fn();
    const session = makeSession();
    session.text_document = createTextDocument({
      rawText: 'cat cat',
      displayName: 'editor.ts',
    });
    render(
      <TextEditorSurface
        ref={ref}
        session={session}
        onCommandStateChange={history}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );
    expect(history).toHaveBeenLastCalledWith(
      expect.objectContaining({ undo: false, redo: false }),
    );
    const view = EditorView.findFromDOM(
      screen.getByRole('textbox', { name: 'editor.ts text editor' }),
    )!;
    act(() => {
      void ref.current!.invoke('search');
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Find' }), {
      target: { value: 'cat' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Replace' }), {
      target: { value: 'dog' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
    expect(view.state.doc.toString()).toBe('dog dog');
    expect(history).toHaveBeenLastCalledWith(
      expect.objectContaining({ undo: true, redo: false }),
    );
    act(() => {
      void ref.current!.invoke('undo');
    });
    expect(view.state.doc.toString()).toBe('cat cat');
    expect(history).toHaveBeenLastCalledWith(
      expect.objectContaining({ undo: false, redo: true }),
    );
    act(() => {
      void ref.current!.invoke('redo');
    });
    expect(view.state.doc.toString()).toBe('dog dog');
    const closeSearch = screen.getByRole('button', { name: 'Close search' });
    closeSearch.focus();
    fireEvent.click(closeSearch);
    await waitFor(() => expect(view.hasFocus).toBe(true));
    expect(
      screen.queryByRole('textbox', { name: 'Find' }),
    ).not.toBeInTheDocument();
  });
  it('hides Replace after authority is withdrawn and denies mutation commands even with retained history', () => {
    const session = makeSession();
    const ref = createRef<TextEditorHandle>();
    const props = { onDocumentChange: vi.fn(), onLanguageChange: vi.fn() };
    const { rerender } = render(
      <TextEditorSurface ref={ref} session={session} {...props} />,
    );
    const view = EditorView.findFromDOM(
      screen.getByRole('textbox', { name: 'editor.ts text editor' }),
    )!;
    act(() => view.dispatch({ changes: { from: 0, insert: 'edit' } }));
    act(() => {
      void ref.current!.invoke('search');
    });
    expect(
      screen.getByRole('textbox', { name: 'Replace' }),
    ).toBeInTheDocument();
    rerender(
      <TextEditorSurface
        ref={ref}
        session={{
          ...session,
          source: {
            ...session.source,
            capabilities: { ...session.source.capabilities, write: false },
          },
        }}
        {...props}
      />,
    );
    expect(
      screen.queryByRole('textbox', { name: 'Replace' }),
    ).not.toBeInTheDocument();
    act(() => {
      for (const command of ['undo', 'redo', 'indent', 'outdent'] as const)
        expect(ref.current!.invoke(command)).toBe(false);
    });
    expect(view.state.doc.toString()).toBe('editconst value = 1;\n');
  });
});

describe('all editor options and line validation', () => {
  it('offers all eleven language choices with document-only highlighting authority', () => {
    const ref = createRef<TextEditorHandle>();
    const changed = vi.fn();
    render(
      <TextEditorSurface
        ref={ref}
        session={makeSession()}
        onDocumentChange={vi.fn()}
        onLanguageChange={changed}
      />,
    );
    openDetails(ref);
    const language = screen.getByRole('combobox', { name: 'Language mode' });
    const options = Array.from(language.querySelectorAll('option'));
    expect(options).toHaveLength(11);
    for (const option of options) {
      fireEvent.change(language, { target: { value: option.value } });
      expect(changed).toHaveBeenLastCalledWith(
        'editor',
        1,
        expect.objectContaining({
          origin:
            option.value === 'automatic' ? 'automatic' : 'session_override',
        }),
      );
    }
    fireEvent.click(
      screen.getByRole('button', { name: 'Close Document details' }),
    );
    expect(
      EditorView.findFromDOM(
        screen.getByRole('textbox', { name: 'editor.ts text editor' }),
      )!.state.doc.toString(),
    ).toBe('const value = 1;\n');
  });
  it('selects all matches without changing bytes, replaces next once, and invalidates redo after a new edit', () => {
    const ref = createRef<TextEditorHandle>();
    const session = makeSession();
    session.text_document = createTextDocument({
      rawText: 'cat cat',
      displayName: 'editor.ts',
    });
    render(
      <TextEditorSurface
        ref={ref}
        session={session}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );
    const view = EditorView.findFromDOM(
      screen.getByRole('textbox', { name: 'editor.ts text editor' }),
    )!;
    act(() => {
      void ref.current!.invoke('search');
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Find' }), {
      target: { value: 'cat' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select all matches' }));
    expect(view.state.selection.ranges).toHaveLength(2);
    expect(view.state.doc.toString()).toBe('cat cat');
    fireEvent.change(screen.getByRole('textbox', { name: 'Replace' }), {
      target: { value: 'dog' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace next' }));
    expect(view.state.doc.toString().match(/dog/gu)).toHaveLength(1);
    act(() => {
      void ref.current!.invoke('undo');
    });
    expect(ref.current!.commandState?.().redo).toBe(true);
    act(() => view.dispatch({ changes: { from: 0, insert: 'new ' } }));
    expect(ref.current!.commandState?.().redo).toBe(false);
    const before = view.state.doc.toString();
    const caret = view.state.selection.main.head;
    act(() => {
      void ref.current!.invoke('toggle_wrap');
    });
    expect(view.state.doc.toString()).toBe(before);
    expect(view.state.selection.main.head).toBe(caret);
  });
});

describe('line task', () => {
  it('rejects outside lines, commits a valid caret and cancels without moving selection', async () => {
    const ref = createRef<TextEditorHandle>();
    const { container } = render(
      <AppFrame>
        <TextEditorSurface
          ref={ref}
          session={makeSession()}
          onDocumentChange={vi.fn()}
          onLanguageChange={vi.fn()}
        />
      </AppFrame>,
    );
    const view = EditorView.findFromDOM(
      screen.getByRole('textbox', { name: 'editor.ts text editor' }),
    )!;
    act(() => {
      void ref.current!.invoke('go_to_line');
    });
    const field = screen.getByRole('textbox', { name: 'Line number' });
    fireEvent.change(field, { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a whole line number from 1 to 2.',
    );
    expect(view.state.selection.main.head).toBe(0);
    fireEvent.change(field, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(view.state.selection.main.head).toBe(view.state.doc.line(2).from);
    const position = view.state.selection.main.head;
    act(() => {
      void ref.current!.invoke('go_to_line');
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Line number' }), {
      target: { value: '1' },
    });
    act(() => {
      expect(ref.current!.dismissModal?.()).toBe(true);
    });
    await waitFor(() =>
      expect(container.querySelector('.cm-content')).toHaveFocus(),
    );
    expect(view.state.selection.main.head).toBe(position);
  });
});

describe('real editor keyboard routes', () => {
  it('routes Control+G to the validated line task', async () => {
    render(
      <AppFrame>
        <TextEditorSurface
          session={makeSession()}
          onDocumentChange={vi.fn()}
          onLanguageChange={vi.fn()}
        />
      </AppFrame>,
    );
    const editor = screen.getByRole('textbox', {
      name: 'editor.ts text editor',
    });
    editor.focus();
    fireEvent.keyDown(editor, {
      key: 'g',
      code: 'KeyG',
      keyCode: 71,
      which: 71,
      ctrlKey: true,
    });
    expect(
      await screen.findByRole('dialog', { name: 'Go to line' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Find' }),
    ).not.toBeInTheDocument();
  });
  it('announces wrap when actual F3 moves past the final editor match', async () => {
    const session = makeSession();
    session.text_document = createTextDocument({
      rawText: 'cat cat',
      displayName: 'editor.ts',
    });
    const ref = createRef<TextEditorHandle>();
    render(
      <TextEditorSurface
        ref={ref}
        session={session}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );
    const editor = screen.getByRole('textbox', {
      name: 'editor.ts text editor',
    });
    const view = EditorView.findFromDOM(editor)!;
    act(() => {
      void ref.current!.invoke('search');
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Find' }), {
      target: { value: 'cat' },
    });
    act(() => view.dispatch({ selection: { anchor: 4, head: 7 } }));
    const findInput = screen.getByRole('textbox', { name: 'Find' });
    findInput.focus();
    fireEvent.keyDown(findInput, {
      key: 'F3',
      code: 'F3',
      keyCode: 114,
      which: 114,
    });
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Find results' }),
      ).toHaveTextContent('Search wrapped.'),
    );
    expect(view.state.selection.main.from).toBe(0);
  });
});

describe('bounded editor details and document defaults', () => {
  it('opens current language and details in one managed task without replacing the editor', async () => {
    const ref = createRef<TextEditorHandle>();
    const { container } = render(
      <TextEditorSurface
        ref={ref}
        session={makeSession()}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );
    const editor = screen.getByRole('textbox', {
      name: 'editor.ts text editor',
    });
    openDetails(ref);
    const dialog = await screen.findByRole('dialog', {
      name: 'Document details',
    });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      screen.getByRole('combobox', { name: 'Language mode' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Close Document details' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(container.querySelector('.cm-content')).toBe(editor);
  });
  it('retains an explicit document wrap override through default and unrelated preference changes', () => {
    const first = createRef<TextEditorHandle>();
    const second = createRef<TextEditorHandle>();
    const defaults = defaultPreferences();
    const renderEditors = (preferences: typeof defaults) => (
      <PreferenceContext.Provider value={preferences}>
        <TextEditorSurface
          ref={first}
          session={makeSession()}
          onDocumentChange={vi.fn()}
          onLanguageChange={vi.fn()}
        />
        <TextEditorSurface
          ref={second}
          session={{ ...makeSession(), id: 'other-editor' }}
          onDocumentChange={vi.fn()}
          onLanguageChange={vi.fn()}
        />
      </PreferenceContext.Provider>
    );
    const { rerender } = render(renderEditors(defaults));
    act(() => {
      void first.current!.invoke('toggle_wrap');
    });
    expect(first.current!.commandState?.().wrapped).toBe(false);
    rerender(renderEditors({ ...defaults, editor_font_size: 20 }));
    expect(first.current!.commandState?.().wrapped).toBe(false);
    rerender(renderEditors({ ...defaults, line_wrap: false }));
    expect(second.current!.commandState?.().wrapped).toBe(false);
    act(() => {
      void first.current!.invoke('toggle_wrap');
    });
    rerender(renderEditors({ ...defaults, line_wrap: true }));
    rerender(renderEditors({ ...defaults, line_wrap: false }));
    expect(first.current!.commandState?.().wrapped).toBe(true);
    expect(second.current!.commandState?.().wrapped).toBe(false);
  });
});

describe('bounded actual Find panel', () => {
  it('contains the installed CodeMirror controls in one managed task and retains editor history', async () => {
    const ref = createRef<TextEditorHandle>();
    const { container } = render(
      <TextEditorSurface
        ref={ref}
        session={makeSession(true)}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );
    const editor = container.querySelector('.cm-editor');
    act(() => {
      void ref.current!.invoke('search');
    });
    const task = screen.getByRole('dialog', { name: 'Find and replace' });
    expect(task).toHaveAttribute('aria-modal', 'true');
    expect(within(task).getByRole('textbox', { name: 'Find' })).toHaveClass(
      'cm-textfield',
    );
    await waitFor(() =>
      expect(within(task).getByRole('textbox', { name: 'Find' })).toHaveFocus(),
    );
    fireEvent.change(within(task).getByRole('textbox', { name: 'Find' }), {
      target: { value: 'cat' },
    });
    fireEvent.click(
      within(task).getByRole('button', { name: 'Close Find and replace' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container.querySelector('.cm-editor')).toBe(editor);
  });
});

describe('basic editor keyboard commands', () => {
  it('inserts a real newline for hardware Enter while preserving the current editor', () => {
    const session = makeSession();
    session.text_document = createTextDocument({
      rawText: 'first',
      displayName: 'editor.ts',
    });
    render(
      <TextEditorSurface
        session={session}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );
    const input = screen.getByRole('textbox', {
      name: 'editor.ts text editor',
    });
    const editor = EditorView.findFromDOM(input)!;
    act(() => editor.dispatch({ selection: { anchor: 5 } }));
    input.focus();
    fireEvent.keyDown(input, {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
    });
    expect(editor.state.doc.toString()).toBe('first\n');
  });
});

describe('remaining search and line drafts', () => {
  it('restores case and whole-word defaults and announces an empty query without moving source', async () => {
    const ref = createRef<TextEditorHandle>();
    const value = makeSession();
    value.text_document = createTextDocument({
      rawText: 'cat Cat scatter cat',
      displayName: 'editor.ts',
    });
    render(
      <TextEditorSurface
        ref={ref}
        session={value}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );
    const currentView = EditorView.findFromDOM(
      screen.getByRole('textbox', { name: 'editor.ts text editor' }),
    )!;
    act(() => {
      void ref.current!.invoke('search');
    });
    const query = screen.getByRole('textbox', { name: 'Find' });
    fireEvent.change(query, { target: { value: 'cat' } });
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Find results' }),
      ).toHaveTextContent('4 matches'),
    );
    fireEvent.click(screen.getByLabelText('Match case'));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Find results' }),
      ).toHaveTextContent('3 matches'),
    );
    fireEvent.click(screen.getByLabelText('Match case'));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Find results' }),
      ).toHaveTextContent('4 matches'),
    );
    fireEvent.click(screen.getByLabelText('Whole word'));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Find results' }),
      ).toHaveTextContent('3 matches'),
    );
    fireEvent.click(screen.getByLabelText('Whole word'));
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Find results' }),
      ).toHaveTextContent('4 matches'),
    );
    fireEvent.change(query, { target: { value: '' } });
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Find results' }),
      ).toHaveTextContent('Enter search text.'),
    );
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(currentView.state.doc.toString()).toBe('cat Cat scatter cat');
  });
  it('retains empty and noninteger line drafts with the current selection unchanged', () => {
    const ref = createRef<TextEditorHandle>();
    render(
      <TextEditorSurface
        ref={ref}
        session={makeSession()}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );
    const view = EditorView.findFromDOM(
      screen.getByRole('textbox', { name: 'editor.ts text editor' }),
    )!;
    act(() => {
      void ref.current!.invoke('go_to_line');
    });
    const field = screen.getByRole('textbox', { name: 'Line number' });
    for (const value of ['', '1.5', 'not-a-line']) {
      fireEvent.change(field, { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));
      expect(field).toHaveValue(value);
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(view.state.selection.main.head).toBe(0);
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Enter a whole line number',
      );
    }
  });
});

describe('EditContext hardware Enter ownership', () => {
  it('inserts one undoable newline with an attached EditContext and keeps the current editor', () => {
    const ref = createRef<TextEditorHandle>();
    const session = makeSession();
    session.text_document = createTextDocument({
      rawText: 'first',
      displayName: 'editor.ts',
    });
    const changed = vi.fn();
    render(
      <TextEditorSurface
        ref={ref}
        session={session}
        onDocumentChange={changed}
        onLanguageChange={vi.fn()}
      />,
    );
    const input = screen.getByRole('textbox', {
      name: 'editor.ts text editor',
    });
    const view = EditorView.findFromDOM(input)!;
    Object.defineProperty(input, 'editContext', {
      configurable: true,
      value: {},
    });
    act(() => view.dispatch({ selection: { anchor: 5 } }));
    input.focus();
    fireEvent.keyDown(input, {
      key: 'Enter',
      code: 'NumpadEnter',
      keyCode: 13,
    });
    expect(view.state.doc.toString()).toBe('first\n');
    expect(changed).toHaveBeenCalledTimes(1);
    act(() => {
      expect(ref.current?.invoke('undo')).toBe(true);
    });
    expect(view.state.doc.toString()).toBe('first');
    act(() => {
      expect(ref.current?.invoke('redo')).toBe(true);
    });
    expect(view.state.doc.toString()).toBe('first\n');
    expect(EditorView.findFromDOM(input)).toBe(view);
  });

  it.each([
    { label: 'composition key', detail: { keyCode: 229 }, composing: false },
    {
      label: 'composing event',
      detail: { keyCode: 13, isComposing: true },
      composing: false,
    },
    {
      label: 'modified Enter',
      detail: { keyCode: 13, shiftKey: true },
      composing: false,
    },
    { label: 'composing view', detail: { keyCode: 13 }, composing: true },
  ])(
    'leaves $label on the existing editor input route',
    ({ detail, composing }) => {
      const session = makeSession();
      render(
        <TextEditorSurface
          session={session}
          onDocumentChange={vi.fn()}
          onLanguageChange={vi.fn()}
        />,
      );
      const input = screen.getByRole('textbox', {
        name: 'editor.ts text editor',
      });
      Object.defineProperty(input, 'editContext', {
        configurable: true,
        value: {},
      });
      if (composing)
        vi.spyOn(
          EditorView.findFromDOM(input)!,
          'composing',
          'get',
        ).mockReturnValue(true);
      const existingInputRoute = vi.fn();
      input.addEventListener('keydown', existingInputRoute);
      input.focus();
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', ...detail });
      expect(existingInputRoute).toHaveBeenCalledTimes(1);
    },
  );

  it('does not consume hardware Enter after current source authority is withdrawn', () => {
    const session = makeSession();
    const changed = vi.fn();
    const { rerender } = render(
      <TextEditorSurface
        session={session}
        onDocumentChange={changed}
        onLanguageChange={vi.fn()}
      />,
    );
    const input = screen.getByRole('textbox', {
      name: 'editor.ts text editor',
    });
    const view = EditorView.findFromDOM(input)!;
    Object.defineProperty(input, 'editContext', {
      configurable: true,
      value: {},
    });
    const readonly = {
      ...session,
      source: {
        ...session.source,
        capabilities: { ...session.source.capabilities, write: false },
      },
    };
    rerender(
      <TextEditorSurface
        session={readonly}
        onDocumentChange={changed}
        onLanguageChange={vi.fn()}
      />,
    );
    const before = view.state.doc.toString();
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    expect(view.state.doc.toString()).toBe(before);
    expect(changed).not.toHaveBeenCalled();
    expect(EditorView.findFromDOM(input)).toBe(view);
  });
});
