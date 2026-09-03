import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import {
  history,
  historyKeymap,
  indentLess,
  indentMore,
  indentWithTab,
  redo,
  undo,
} from '@codemirror/commands';
import {
  bracketMatching,
  defaultHighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  gotoLine,
  openSearchPanel,
  searchKeymap,
} from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import type { CommandId } from '../domain/commands';
import type {
  LanguageDecision,
  LanguageId,
  ShellSession,
  TextDocumentState,
} from '../domain/contracts';
import { detectLanguage, LanguageLoader } from '../domain/language';
import { usePreferences } from '../domain/preference-context';
import {
  applyTextTransaction,
  textChangesFitEditableLimit,
} from '../domain/text-document';

export interface TextEditorHandle {
  invoke(command: CommandId): boolean;
  selectRange(from: number, to: number): boolean;
}

interface TextEditorSurfaceProps {
  session: ShellSession;
  onDocumentChange: (
    id: string,
    expectedRevision: number,
    document: TextDocumentState,
    revision: number,
  ) => void;
  onLanguageChange: (
    id: string,
    expectedRevision: number,
    language: LanguageDecision,
  ) => void;
}

export const TextEditorSurface = forwardRef<
  TextEditorHandle,
  TextEditorSurfaceProps
>(function TextEditorSurface(
  { session, onDocumentChange, onLanguageChange },
  handleRef,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const documentRef = useRef(session.text_document!);
  const revisionRef = useRef(session.revision);
  const callbackRef = useRef(onDocumentChange);
  const languageCompartment = useRef(new Compartment());
  const wrappingCompartment = useRef(new Compartment());
  const editableCompartment = useRef(new Compartment());
  const settingsCompartment = useRef(new Compartment());
  const preferences = usePreferences();
  const wrappedRef = useRef(preferences.line_wrap);
  const [languageStatus, setLanguageStatus] = useState(
    session.text_document?.language.status ?? 'plain',
  );
  const loaderRef = useRef(new LanguageLoader());

  callbackRef.current = onDocumentChange;

  useImperativeHandle(handleRef, () => ({
    invoke(command) {
      const view = viewRef.current;
      if (!view) return false;
      if (command === 'search') return openSearchPanel(view);
      if (command === 'find_next') return findNext(view);
      if (command === 'find_previous') return findPrevious(view);
      if (command === 'close_search') return closeSearchPanel(view);
      if (command === 'go_to_line') return gotoLine(view);
      if (command === 'undo') return undo(view);
      if (command === 'redo') return redo(view);
      if (command === 'indent') return indentMore(view);
      if (command === 'outdent') return indentLess(view);
      if (command === 'toggle_wrap') {
        wrappedRef.current = !wrappedRef.current;
        view.dispatch({
          effects: wrappingCompartment.current.reconfigure(
            wrappedRef.current ? EditorView.lineWrapping : [],
          ),
        });
        return true;
      }
      if (command === 'copy') {
        const ranges = view.state.selection.ranges.filter(
          ({ empty }) => !empty,
        );
        const content =
          ranges.length > 0
            ? ranges
                .map(({ from, to }) => view.state.sliceDoc(from, to))
                .join('\n')
            : view.state.doc.toString();
        void navigator.clipboard?.writeText(content);
        return true;
      }
      return false;
    },
    selectRange(from, to) {
      const view = viewRef.current;
      if (!view) return false;
      const boundedFrom = Math.max(0, Math.min(from, view.state.doc.length));
      const boundedTo = Math.max(
        boundedFrom,
        Math.min(to, view.state.doc.length),
      );
      view.dispatch({
        selection: { anchor: boundedFrom, head: boundedTo },
        scrollIntoView: true,
      });
      view.focus();
      return true;
    },
  }));

  useEffect(() => {
    const host = hostRef.current;
    const textDocument = session.text_document;
    if (!host || !textDocument) return;
    const canEdit =
      textDocument.mode === 'editable' &&
      session.renderer.capabilities.edit &&
      (session.source.capabilities.write ||
        session.integrity === 'recovery_only');
    documentRef.current = textDocument;
    revisionRef.current = session.revision;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: textDocument.normalized_text,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          bracketMatching(),
          closeBrackets(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([
            indentWithTab,
            ...closeBracketsKeymap,
            ...historyKeymap,
            ...searchKeymap,
          ]),
          settingsCompartment.current.of([
            indentUnit.of(' '.repeat(preferences.tab_width)),
            EditorState.tabSize.of(preferences.tab_width),
            EditorView.theme({
              '.cm-scroller': {
                fontFamily: 'var(--editor-font-family)',
                fontSize: 'var(--editor-font-size)',
              },
            }),
          ]),
          EditorState.allowMultipleSelections.of(true),
          languageCompartment.current.of([]),
          wrappingCompartment.current.of(preferences.line_wrap ? EditorView.lineWrapping : []),
          editableCompartment.current.of(EditorView.editable.of(canEdit)),
          EditorState.readOnly.of(!canEdit),
          EditorState.changeFilter.of((transaction) => {
            if (!transaction.docChanged) return true;
            const changes: Array<{
              from: number;
              to: number;
              insert: string;
            }> = [];
            transaction.changes.iterChanges(
              (from, to, _fromNew, _toNew, inserted) => {
                changes.push({ from, to, insert: inserted.toString() });
              },
            );
            return textChangesFitEditableLimit(documentRef.current, changes);
          }),
          EditorView.contentAttributes.of({
            'aria-label': `${session.source.display_name} text editor`,
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const changes: Array<{ from: number; to: number; insert: string }> =
              [];
            update.changes.iterChanges(
              (from, to, _fromNew, _toNew, inserted) => {
                changes.push({ from, to, insert: inserted.toString() });
              },
            );
            const expectedRevision = revisionRef.current;
            const result = applyTextTransaction(
              documentRef.current,
              expectedRevision,
              expectedRevision,
              changes,
            );
            if (!result.ok) return;
            const nextDocument =
              result.document.language.origin === 'automatic'
                ? {
                    ...result.document,
                    language: {
                      ...detectLanguage(
                        session.source.display_name,
                        result.document.normalized_text,
                      ),
                      load_revision: result.document.language.load_revision + 1,
                    },
                  }
                : result.document;
            documentRef.current = nextDocument;
            revisionRef.current = result.revision;
            callbackRef.current(
              session.id,
              expectedRevision,
              nextDocument,
              result.revision,
            );
          }),
          EditorView.theme({
            '&': { height: '100%', backgroundColor: 'transparent' },
            '.cm-content': { caretColor: 'var(--focus-color)' },
            '.cm-gutters': {
              backgroundColor: 'transparent',
              borderRightColor: '#343842',
            },
          }),
        ],
      }),
    });
    viewRef.current = view;

    return () => {
      loaderRef.current.cancel();
      viewRef.current = null;
      view.destroy();
    };
  }, [session.id]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    wrappedRef.current = preferences.line_wrap;
    view.dispatch({
      effects: [
        wrappingCompartment.current.reconfigure(preferences.line_wrap ? EditorView.lineWrapping : []),
        settingsCompartment.current.reconfigure([
          indentUnit.of(' '.repeat(preferences.tab_width)),
          EditorState.tabSize.of(preferences.tab_width),
          EditorView.theme({
            '.cm-scroller': {
              fontFamily: 'var(--editor-font-family)',
              fontSize: 'var(--editor-font-size)',
            },
          }),
        ]),
      ],
    });
  }, [preferences.editor_font_family, preferences.editor_font_size, preferences.line_wrap, preferences.tab_width]);

  useEffect(() => {
    const view = viewRef.current;
    const textDocument = session.text_document;
    if (!view || !textDocument) return;
    loaderRef.current.cancel();
    if (textDocument.longest_line_bytes > 2 * 1024 * 1024) {
      setLanguageStatus('unavailable');
      view.dispatch({ effects: languageCompartment.current.reconfigure([]) });
      return;
    }
    if (textDocument.language.language === 'plain_text') {
      setLanguageStatus('plain');
      view.dispatch({ effects: languageCompartment.current.reconfigure([]) });
      return;
    }
    setLanguageStatus('loading');
    void loaderRef.current
      .load(textDocument.language.language, textDocument.language.load_revision)
      .then((result) => {
        if (viewRef.current !== view) return;
        setLanguageStatus(result.status);
        view.dispatch({
          effects: languageCompartment.current.reconfigure(
            result.support ?? [],
          ),
        });
      });
  }, [
    session.id,
    session.text_document?.language.language,
    session.text_document?.language.load_revision,
    session.text_document?.longest_line_bytes,
  ]);

  useEffect(() => {
    if (session.revision >= revisionRef.current) {
      revisionRef.current = session.revision;
      if (session.text_document) documentRef.current = session.text_document;
    }
  }, [session.revision, session.text_document]);

  const profile = session.text_document?.profile;
  return (
    <div className="text-editor-shell">
      <div className="editor-status" aria-label="Text document status">
        <span>
          {session.text_document?.mode === 'editable' &&
          session.renderer.capabilities.edit &&
          (session.source.capabilities.write ||
            session.integrity === 'recovery_only')
            ? 'Editable'
            : 'Read only'}
        </span>
        <span>{profile?.encoding.replaceAll('_', ' ')}</span>
        <span>{profile?.bom === 'present' ? 'BOM' : 'No BOM'}</span>
        <span>{profile?.newline_pattern}</span>
        <span>
          {profile?.terminal_newline
            ? 'Terminal newline'
            : 'No terminal newline'}
        </span>
        <span>
          {profile?.round_trip_safe
            ? 'Round-trip safe'
            : 'Save decision required'}
        </span>
        <span>{languageStatus}</span>
        <label>
          Language
          <select
            aria-label="Language mode"
            value={
              session.text_document?.language.origin === 'session_override'
                ? session.text_document.language.language
                : 'automatic'
            }
            onChange={(event) => {
              const value = event.target.value;
              const current = session.text_document;
              if (!current) return;
              const language =
                value === 'automatic'
                  ? detectLanguage(
                      session.source.display_name,
                      current.normalized_text,
                    )
                  : {
                      ...current.language,
                      language: value as LanguageId,
                      origin: 'session_override' as const,
                      status:
                        value === 'plain_text'
                          ? ('plain' as const)
                          : ('loading' as const),
                      load_revision: current.language.load_revision + 1,
                    };
              onLanguageChange(session.id, session.revision, language);
            }}
          >
            <option value="automatic">Automatic</option>
            {[
              'plain_text',
              'rust',
              'typescript',
              'javascript',
              'python',
              'json',
              'toml',
              'yaml',
              'css',
              'html',
            ].map((language) => (
              <option key={language} value={language}>
                {language.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <span>
          {session.text_document?.source_bytes.toLocaleString()} bytes
        </span>
      </div>
      <div className="text-editor" data-performance-ready="true" ref={hostRef} />
    </div>
  );
});
