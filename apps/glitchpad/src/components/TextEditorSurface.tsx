import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import {
  history,
  defaultKeymap,
  historyKeymap,
  indentLess,
  indentMore,
  indentWithTab,
  redo,
  undo,
  undoDepth,
  redoDepth,
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
  getSearchQuery,
  search,
  searchPanelOpen,
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
  panels,
} from '@codemirror/view';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import type { CommandId, EditorCommandState } from '../domain/commands';
export type { EditorCommandState } from '../domain/commands';
import { TaskSurface } from './TaskSurface';
import './DocumentTools.css';
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
  invoke(command: CommandId, opener?: HTMLElement): boolean | Promise<boolean>;
  selectRange(from: number, to: number): boolean;
  dismissModal?(): boolean;
  commandState?(): EditorCommandState;
}

interface TextEditorSurfaceProps {
  onCommandStateChange?: (state: EditorCommandState) => void;
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
  { session, onDocumentChange, onLanguageChange, onCommandStateChange },
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
  const attributesCompartment = useRef(new Compartment());
  const sourceNameRef = useRef(session.source.display_name);
  sourceNameRef.current = session.source.display_name;
  const canEdit =
    session.text_document?.mode === 'editable' &&
    session.renderer.capabilities.edit &&
    (session.source.capabilities.write ||
      session.integrity === 'recovery_only' ||
      Boolean(session.edit_origin));
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;
  const commandCallback = useRef(onCommandStateChange);
  commandCallback.current = onCommandStateChange;
  const previousCommandState = useRef<EditorCommandState | null>(null);
  const [wrapState, setWrapState] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchContainer] = useState(() => document.createElement('div'));
  const [lineOpen, setLineOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsOpener = useRef<HTMLElement>(null);
  const detailsOpenRef = useRef(false);
  detailsOpenRef.current = detailsOpen;
  const [lineDraft, setLineDraft] = useState('1');
  const [lineError, setLineError] = useState('');
  const lineOpenRef = useRef(false);
  lineOpenRef.current = lineOpen;
  const searchAction = useRef('');
  const replacementCount = useRef(0);
  const previousSearchHead = useRef(0);
  const preferences = usePreferences();
  const wrappedRef = useRef(preferences.line_wrap);
  const wrapOverride = useRef<boolean | null>(null);
  const [languageStatus, setLanguageStatus] = useState(
    session.text_document?.language.status ?? 'plain',
  );
  const [performanceReady, setPerformanceReady] = useState(false);
  const loaderRef = useRef(new LanguageLoader());

  callbackRef.current = onDocumentChange;
  const commandState = (view = viewRef.current): EditorCommandState => ({
    undo: Boolean(view && canEditRef.current && undoDepth(view.state)),
    redo: Boolean(view && canEditRef.current && redoDepth(view.state)),
    wrapped: wrappedRef.current,
  });
  const publishCommands = (view: EditorView) => {
    view.dom.dataset.editorSelectionCount = String(
      view.state.selection.ranges.length,
    );
    view.dom.dataset.editorSelectionFrom = String(
      view.state.selection.main.from,
    );
    view.dom.dataset.editorSelectionTo = String(view.state.selection.main.to);
    view.dom.dataset.editorUndoDepth = String(undoDepth(view.state));
    view.dom.dataset.editorRedoDepth = String(redoDepth(view.state));
    view.dom.dataset.editorWrap = String(wrappedRef.current);
    const next = commandState(view);
    const previous = previousCommandState.current;
    if (
      !previous ||
      previous.undo !== next.undo ||
      previous.redo !== next.redo ||
      previous.wrapped !== next.wrapped
    ) {
      previousCommandState.current = next;
      commandCallback.current?.(next);
    }
  };
  const reflectSearchState = (view: EditorView) => {
    const field = searchContainer.querySelector<HTMLInputElement>(
      '.cm-search input[name="search"]',
    );
    if (!field) return;
    const query = getSearchQuery(view.state);
    field.setAttribute(
      'aria-invalid',
      String(Boolean(query.search && !query.valid)),
    );
    field.setAttribute('aria-describedby', 'editor-search-results');
    const hasMatch = query.valid && !query.getCursor(view.state).next().done;
    searchContainer
      .querySelectorAll<HTMLButtonElement>(
        '.cm-search button[name="next"],.cm-search button[name="prev"],.cm-search button[name="select"],.cm-search button[name="replace"],.cm-search button[name="replaceAll"]',
      )
      .forEach((button) => {
        button.disabled = !hasMatch;
      });
  };
  const updateSearchStatus = (view: EditorView, changed = false) => {
    const open = searchPanelOpen(view.state);
    setSearchOpen(open);
    if (!open) {
      setSearchStatus('');
      return;
    }
    const query = getSearchQuery(view.state);
    if (!query.search) {
      setSearchStatus('Enter search text.');
      return;
    }
    if (!query.valid) {
      setSearchStatus('Invalid regular expression. Check the pattern.');
      return;
    }
    const cursor = query.getCursor(view.state);
    let count = 0;
    let selected = 0;
    for (
      let next = cursor.next();
      !next.done && count < 10000;
      next = cursor.next()
    ) {
      count += 1;
      if (
        next.value.from === view.state.selection.main.from &&
        next.value.to === view.state.selection.main.to
      )
        selected = count;
    }
    const countLabel =
      count === 10000
        ? 'At least 10000 matches'
        : count === 0
          ? 'No matches'
          : count + (count === 1 ? ' match' : ' matches');
    const action = searchAction.current;
    const wrapped =
      action === 'next'
        ? view.state.selection.main.from < previousSearchHead.current
        : action === 'prev'
          ? view.state.selection.main.from > previousSearchHead.current
          : false;
    setSearchStatus(
      (changed && (action === 'replace' || action === 'replaceAll')
        ? 'Replaced ' +
          (action === 'replaceAll' ? replacementCount.current : 1) +
          ' matches. '
        : action === 'select'
          ? view.state.selection.ranges.length + ' matches selected. '
          : '') +
        countLabel +
        (selected ? '. Match ' + selected + ' of ' + count + '.' : '.') +
        (wrapped ? ' Search wrapped.' : ''),
    );
    searchAction.current = '';
  };
  const closeFind = () => {
    const view = viewRef.current;
    if (view) closeSearchPanel(view);
    setSearchOpen(false);
    requestAnimationFrame(() => viewRef.current?.focus());
  };
  const openLine = () => {
    const view = viewRef.current;
    if (!view) return false;
    setLineDraft(
      String(view.state.doc.lineAt(view.state.selection.main.head).number),
    );
    setLineError('');
    setLineOpen(true);
    return true;
  };
  const closeLine = () => {
    setLineOpen(false);
    requestAnimationFrame(() => viewRef.current?.focus());
  };
  const goToLine = () => {
    const view = viewRef.current;
    if (!view) return;
    const line = /^\d+$/u.test(lineDraft) ? Number(lineDraft) : NaN;
    if (
      !Number.isSafeInteger(line) ||
      line < 1 ||
      line > view.state.doc.lines
    ) {
      setLineError(
        'Enter a whole line number from 1 to ' + view.state.doc.lines + '.',
      );
      return;
    }
    view.dispatch({
      selection: { anchor: view.state.doc.line(line).from },
      scrollIntoView: true,
    });
    closeLine();
  };

  useImperativeHandle(handleRef, () => ({
    invoke(command, opener) {
      const view = viewRef.current;
      if (!view) return false;
      if (command === 'document_details') {
        if (session.lifecycle !== 'active') return false;
        detailsOpener.current = opener ?? view.contentDOM;
        setDetailsOpen(true);
        return true;
      }
      if (command === 'search') {
        const opened = openSearchPanel(view);
        reflectSearchState(view);
        return opened;
      }
      if (command === 'find_next' || command === 'find_previous') {
        searchAction.current = command === 'find_next' ? 'next' : 'prev';
        previousSearchHead.current = view.state.selection.main.from;
        return command === 'find_next' ? findNext(view) : findPrevious(view);
      }
      if (command === 'close_search') return closeSearchPanel(view);
      if (command === 'go_to_line') return openLine();
      if (
        ['undo', 'redo', 'indent', 'outdent'].includes(command) &&
        !canEditRef.current
      )
        return false;
      if (command === 'undo') return undo(view);
      if (command === 'redo') return redo(view);
      if (command === 'indent') return indentMore(view);
      if (command === 'outdent') return indentLess(view);
      if (command === 'toggle_wrap') {
        wrappedRef.current = !wrappedRef.current;
        wrapOverride.current = wrappedRef.current;
        setWrapState(wrappedRef.current);
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
        if (!navigator.clipboard?.writeText) return false;
        return navigator.clipboard.writeText(content).then(() => true);
      }
      return false;
    },
    commandState,
    dismissModal() {
      if (lineOpenRef.current) {
        closeLine();
        return true;
      }
      if (detailsOpenRef.current) {
        setDetailsOpen(false);
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
    documentRef.current = textDocument;
    revisionRef.current = session.revision;
    setPerformanceReady(false);
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: textDocument.normalized_text,
        extensions: [
          search({ top: true }),
          panels({ topContainer: searchContainer }),
          EditorState.phrases.of({
            next: 'Next',
            previous: 'Previous',
            all: 'Select all matches',
            'match case': 'Match case',
            regexp: 'Regular expression',
            'by word': 'Whole word',
            replace: 'Replace next',
            'replace all': 'Replace all',
            close: 'Close search',
          }),
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
            ...defaultKeymap,
            ...closeBracketsKeymap,
            ...historyKeymap.map((binding) => ({
              ...binding,
              run: (view: EditorView) =>
                canEditRef.current ? (binding.run?.(view) ?? false) : false,
            })),
            ...searchKeymap.filter(
              ({ key }) => key !== 'Mod-Alt-g' && key !== 'Mod-g',
            ),
            { key: 'Mod-Alt-g', run: openLine },
            { key: 'Mod-g', run: openLine, shift: findPrevious },
          ]),
          settingsCompartment.current.of([
            indentUnit.of(' '.repeat(preferences.tab_width)),
            EditorState.tabSize.of(preferences.tab_width),
            EditorView.theme({
              '.cm-scroller': {
                fontFamily:
                  'var(--editor-font-family), ui-monospace, monospace',
                fontSize: 'var(--editor-font-size)',
              },
            }),
          ]),
          EditorState.allowMultipleSelections.of(true),
          languageCompartment.current.of([]),
          wrappingCompartment.current.of(
            preferences.line_wrap ? EditorView.lineWrapping : [],
          ),
          editableCompartment.current.of([
            EditorView.editable.of(canEdit),
            EditorState.readOnly.of(!canEdit),
          ]),
          EditorState.changeFilter.of((transaction) => {
            if (!transaction.docChanged) return true;
            if (transaction.startState.readOnly) return false;
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
          attributesCompartment.current.of(
            EditorView.contentAttributes.of({
              'aria-label': `${session.source.display_name} text editor`,
            }),
          ),
          EditorView.updateListener.of((update) => {
            publishCommands(update.view);
            updateSearchStatus(update.view, update.docChanged);
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
                        sourceNameRef.current,
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
              borderRightColor: 'var(--gl-border)',
            },
          }),
        ],
      }),
    });
    viewRef.current = view;
    wrapOverride.current = null;
    wrappedRef.current = preferences.line_wrap;
    setWrapState(preferences.line_wrap);
    previousCommandState.current = null;
    publishCommands(view);
    const searchClick = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>('.cm-search button')
          : null;
      if (target) {
        searchAction.current = target.name;
        previousSearchHead.current = view.state.selection.main.from;
        if (target.name === 'replaceAll') {
          const query = getSearchQuery(view.state);
          replacementCount.current = 0;
          if (query.valid) {
            const cursor = query.getCursor(view.state);
            for (let next = cursor.next(); !next.done; next = cursor.next())
              replacementCount.current += 1;
          }
        }
      }
    };
    const searchKey = (event: KeyboardEvent) => {
      const field =
        event.target instanceof HTMLInputElement ? event.target.name : '';
      if (
        event.key === 'F3' ||
        (event.key === 'Enter' && field === 'search') ||
        (event.key.toLowerCase() === 'g' &&
          (event.ctrlKey || event.metaKey) &&
          event.shiftKey)
      ) {
        searchAction.current = event.shiftKey ? 'prev' : 'next';
        previousSearchHead.current = view.state.selection.main.from;
      } else if (event.key === 'Enter' && field === 'replace') {
        searchAction.current = 'replace';
      }
    };
    view.dom.addEventListener('keydown', searchKey, true);
    view.dom.addEventListener('click', searchClick, true);
    searchContainer.addEventListener('keydown', searchKey, true);
    searchContainer.addEventListener('click', searchClick, true);
    let secondPaint = 0;
    const firstPaint = requestAnimationFrame(() => {
      secondPaint = requestAnimationFrame(() => {
        if (viewRef.current === view) setPerformanceReady(true);
      });
    });

    return () => {
      cancelAnimationFrame(firstPaint);
      if (secondPaint !== 0) cancelAnimationFrame(secondPaint);
      loaderRef.current.cancel();
      viewRef.current = null;
      view.dom.removeEventListener('click', searchClick, true);
      searchContainer.removeEventListener('keydown', searchKey, true);
      searchContainer.removeEventListener('click', searchClick, true);
      view.dom.removeEventListener('keydown', searchKey, true);
      view.destroy();
    };
  }, [session.id]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: attributesCompartment.current.reconfigure(
        EditorView.contentAttributes.of({
          'aria-label': session.source.display_name + ' text editor',
        }),
      ),
    });
  }, [session.id, session.source.display_name]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const searching = searchPanelOpen(view.state);
    if (searching) closeSearchPanel(view);
    view.dispatch({
      effects: editableCompartment.current.reconfigure([
        EditorView.editable.of(canEdit),
        EditorState.readOnly.of(!canEdit),
      ]),
    });
    publishCommands(view);
    if (searching) {
      openSearchPanel(view);
      reflectSearchState(view);
    }
  }, [session.id, canEdit]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    wrappedRef.current = wrapOverride.current ?? preferences.line_wrap;
    setWrapState(wrappedRef.current);
    view.dispatch({
      effects: [
        wrappingCompartment.current.reconfigure(
          wrappedRef.current ? EditorView.lineWrapping : [],
        ),
        settingsCompartment.current.reconfigure([
          indentUnit.of(' '.repeat(preferences.tab_width)),
          EditorState.tabSize.of(preferences.tab_width),
          EditorView.theme({
            '.cm-scroller': {
              fontFamily: 'var(--editor-font-family), ui-monospace, monospace',
              fontSize: 'var(--editor-font-size)',
            },
          }),
        ]),
      ],
    });
  }, [
    preferences.editor_font_family,
    preferences.editor_font_size,
    preferences.line_wrap,
    preferences.tab_width,
  ]);

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

  useEffect(() => {
    const view = viewRef.current;
    if (view) reflectSearchState(view);
  }, [searchStatus]);

  const profile = session.text_document?.profile;
  return (
    <div className="text-editor-shell document-tools-editor">
      <TaskSurface
        open={searchOpen}
        onOpenChange={(open) => {
          if (!open) closeFind();
        }}
        title="Find and replace"
        opener={viewRef.current?.contentDOM}
        className="editor-search-task document-tools"
      >
        <div
          className="editor-search-panel-host"
          ref={(node) => {
            if (node && searchContainer.parentNode !== node)
              node.append(searchContainer);
            searchContainer
              .querySelector<HTMLInputElement>('input[name="search"]')
              ?.setAttribute('data-task-initial-focus', 'true');
          }}
        />
        <p
          id="editor-search-results"
          className="editor-search-status"
          role="status"
          aria-label="Find results"
          aria-live="polite"
          hidden={!searchStatus}
        >
          {searchStatus}
        </p>
      </TaskSurface>
      <span className="visually-hidden" aria-label="Document wrapping">
        {wrapState
          ? 'Wrap lines on for this document'
          : 'Wrap lines off for this document'}
      </span>
      <TaskSurface
        open={lineOpen}
        onOpenChange={(open) => {
          if (!open) closeLine();
        }}
        title="Go to line"
        opener={viewRef.current?.contentDOM}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            goToLine();
          }}
        >
          <label>
            Line number
            <input
              inputMode="numeric"
              data-task-initial-focus
              autoFocus
              value={lineDraft}
              aria-invalid={Boolean(lineError)}
              aria-describedby="editor-line-error"
              onChange={(event) => setLineDraft(event.target.value)}
            />
          </label>
          <p id="editor-line-error" role="alert">
            {lineError}
          </p>
          <button type="submit">Go</button>
          <button type="button" onClick={closeLine}>
            Cancel
          </button>
        </form>
      </TaskSurface>
      <TaskSurface
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title="Document details"
        opener={detailsOpener.current}
        className="editor-details-task"
      >
        <div className="editor-status" aria-label="Text document status">
          <span>{canEdit ? 'Editable' : 'Read only'}</span>
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
          <span>Language override applies only to this document.</span>
          <label>
            Language
            <select
              aria-label="Language mode"
              data-task-initial-focus
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
      </TaskSurface>
      <div
        className="text-editor"
        data-performance-ready={performanceReady ? 'true' : 'pending'}
        ref={hostRef}
      />
    </div>
  );
});
