import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
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
    expect(screen.getByLabelText('Text document status')).toHaveTextContent(
      'Round-trip safe',
    );
    expect(ref.current?.invoke('toggle_wrap')).toBe(true);
    unmount();
    expect(ref.current).toBeNull();
  });

  it('denies content editing without source write authority', () => {
    render(
      <TextEditorSurface
        session={makeSession(false)}
        onDocumentChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('textbox', { name: 'editor.ts text editor' }),
    ).toHaveAttribute('contenteditable', 'false');
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
    const onLanguageChange = vi.fn();
    render(
      <TextEditorSurface
        session={makeSession()}
        onDocumentChange={vi.fn()}
        onLanguageChange={onLanguageChange}
      />,
    );
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
    const session = makeSession();
    const props = { onDocumentChange: vi.fn(), onLanguageChange: vi.fn() };
    const { rerender } = render(<TextEditorSurface session={session} {...props} />);
    const original = screen.getByRole('textbox', { name: 'editor.ts text editor' });
    await waitFor(() => expect(original.closest('.text-editor')).toHaveAttribute('data-performance-ready', 'true'));
    const view = EditorView.findFromDOM(original)!;
    const readonly = { ...session, source: { ...session.source, capabilities: { ...session.source.capabilities, write: false } } };
    rerender(<TextEditorSurface session={readonly} {...props} />);
    expect(original).toHaveAttribute('contenteditable', 'false');
    expect(view.state.readOnly).toBe(true);
    rerender(<TextEditorSurface session={{ ...readonly, edit_origin: 'copy' }} {...props} />);
    expect(original).toHaveAttribute('contenteditable', 'true');
    expect(view.state.readOnly).toBe(false);
    expect(screen.getByLabelText('Text document status')).toHaveTextContent('Editable');
    expect(readonly.source.capabilities.write).toBe(false);
  });
  it('updates the accessible saved name without replacing the editor or losing undo history', async () => {
    const ref = createRef<TextEditorHandle>();
    const session = makeSession();
    const props = { onDocumentChange: vi.fn(), onLanguageChange: vi.fn() };
    const { rerender } = render(<TextEditorSurface ref={ref} session={session} {...props} />);
    const original = screen.getByRole('textbox', { name: 'editor.ts text editor' });
    await waitFor(() => expect(original.closest('.text-editor')).toHaveAttribute('data-performance-ready', 'true'));
    const view = EditorView.findFromDOM(original)!;
    act(() => view.dispatch({ changes: { from: 0, insert: '// edit\n' } }));
    rerender(<TextEditorSurface ref={ref} session={{ ...session, source: { ...session.source, display_name: 'Saved.ts' } }} {...props} />);
    expect(screen.getByRole('textbox', { name: 'Saved.ts text editor' })).toBe(original);
    act(() => { expect(ref.current!.invoke('undo')).toBe(true); });
    expect(view.state.doc.toString()).toBe('const value = 1;\n');
  });
  it('awaits clipboard completion and propagates denied writes', async () => {
    let complete!: () => void;
    const writeText = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      const ref = createRef<TextEditorHandle>();
      render(<TextEditorSurface ref={ref} session={makeSession()} onDocumentChange={vi.fn()} onLanguageChange={vi.fn()} />);
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'editor.ts text editor' }).closest('.text-editor')).toHaveAttribute('data-performance-ready', 'true'));
      const pending = ref.current!.invoke('copy');
      expect(pending).toBeInstanceOf(Promise);
      expect(writeText).toHaveBeenCalledWith('const value = 1;\n');
      complete();
      await expect(pending).resolves.toBe(true);
      writeText.mockImplementationOnce(() => Promise.reject(new Error('clipboard denied')));
      await expect(ref.current!.invoke('copy')).rejects.toThrow('clipboard denied');
      expect(ref.current!.invoke('undo')).toBe(false);
      expect(ref.current!.invoke('redo')).toBe(false);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('reports unavailable copy without a clipboard implementation', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    try {
      const ref = createRef<TextEditorHandle>();
      render(<TextEditorSurface ref={ref} session={makeSession()} onDocumentChange={vi.fn()} onLanguageChange={vi.fn()} />);
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'editor.ts text editor' }).closest('.text-editor')).toHaveAttribute('data-performance-ready', 'true'));
      expect(ref.current!.invoke('copy')).toBe(false);
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});
