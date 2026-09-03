import { fireEvent, render, screen } from '@testing-library/react';
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
  it('mounts an accessible editable CodeMirror instance and exposes commands', () => {
    const ref = createRef<TextEditorHandle>();
    const { unmount } = render(
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
