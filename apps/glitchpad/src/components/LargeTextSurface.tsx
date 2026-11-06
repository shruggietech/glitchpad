import {
  clipboardTextAvailable,
  writeClipboardText,
} from '../domain/clipboard-gateway';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { TextEditorHandle } from './TextEditorSurface';
import type { ShellSession } from '../domain/contracts';
import {
  createNativeLargeTextGateway,
  type LargeTextGateway,
} from '../domain/large-text-gateway';
import {
  LARGE_TEXT_MATCH_LIMIT,
  LargeTextReader,
  type LargeTextWindow,
} from '../domain/large-text';
import { TaskSurface } from './TaskSurface';
import './DocumentTools.css';

interface LargeTextSurfaceProps {
  session: ShellSession;
  gateway?: LargeTextGateway;
}
interface SearchCursor {
  query: string;
  matches: number[];
  index: number;
}

export const LargeTextSurface = forwardRef<
  TextEditorHandle,
  LargeTextSurfaceProps
>(function LargeTextSurface({ session, gateway }, handleRef) {
  const selectedGateway = useMemo(
    () => gateway ?? createNativeLargeTextGateway(),
    [gateway],
  );
  const reader = useMemo(
    () =>
      session.source_id
        ? new LargeTextReader(
            selectedGateway,
            session.source_id,
            session.text_document?.profile.encoding,
          )
        : null,
    [
      selectedGateway,
      session.source_id,
      session.text_document?.profile.encoding,
    ],
  );
  const [section, setSection] = useState<LargeTextWindow | null>(null);
  const [status, setStatus] = useState('Loading bounded text window');
  const [query, setQuery] = useState('');
  const [searchCursor, setSearchCursor] = useState<SearchCursor | null>(null);
  const [line, setLine] = useState('1');
  const [invalidLine, setInvalidLine] = useState(false);
  const [pending, setPending] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [focusTool, setFocusTool] = useState<'find' | 'line'>('find');
  const toolsOpener = useRef<HTMLElement | null>(null);
  const toolsOpenRef = useRef(false);
  toolsOpenRef.current = toolsOpen;
  const owner = useRef(session);
  owner.current = session;
  const busy = useRef(false);
  const previousOffsets = useRef<number[]>([]);
  const findInput = useRef<HTMLInputElement>(null);
  const lineInput = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLPreElement>(null);
  const generation = useRef(0);
  const byteLength =
    session.source.byte_length ?? session.text_document?.source_bytes ?? 0;

  useEffect(() => {
    const expected = ++generation.current;
    previousOffsets.current = [];
    setSection(null);
    setSearchCursor(null);
    setQuery('');
    setLine('1');
    setInvalidLine(false);
    setToolsOpen(false);
    if (!reader) {
      busy.current = false;
      setPending(false);
      setStatus('Large text source authority is unavailable');
      return;
    }
    busy.current = true;
    setPending(true);
    setStatus('Loading bounded text window');
    void reader
      .window(0)
      .then((value) => {
        if (generation.current !== expected) return;
        setSection(value);
        setStatus(
          value.end_of_source ? 'End of source' : 'Read-only bounded section',
        );
      })
      .catch(() => {
        if (generation.current === expected)
          setStatus('Large text window could not be decoded safely');
      })
      .finally(() => {
        if (generation.current === expected) {
          busy.current = false;
          setPending(false);
        }
      });
    return () => {
      generation.current += 1;
      reader.cancel();
    };
  }, [reader, session.id]);

  const run = async (
    loading: string,
    failed: string,
    action: (current: () => boolean) => Promise<boolean>,
  ): Promise<boolean> => {
    if (!reader || busy.current) return false;
    const expected = ++generation.current;
    busy.current = true;
    setPending(true);
    setStatus(loading);
    const current = () => expected === generation.current;
    try {
      return await action(current);
    } catch (error: unknown) {
      if (!current()) return false;
      setStatus(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Text operation cancelled'
          : failed,
      );
      throw error;
    } finally {
      if (current()) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  const load = async (
    offset: number,
    current: () => boolean,
    remember = true,
  ): Promise<boolean> => {
    const value = await reader!.window(offset);
    if (!current()) return false;
    if (remember && section) previousOffsets.current.push(section.offset);
    setSection(value);
    setStatus(
      value.end_of_source ? 'End of source' : 'Read-only bounded section',
    );
    return true;
  };
  const previousSection = () =>
    !section || section.offset === 0
      ? false
      : run(
          'Loading previous section',
          'Large text window could not be decoded safely',
          async (current) => {
            const moved = await load(
              previousOffsets.current.at(-1) ?? 0,
              current,
              false,
            );
            if (moved) previousOffsets.current.pop();
            return moved;
          },
        );
  const nextSection = () =>
    !section || section.end_of_source
      ? false
      : run(
          'Loading next section',
          'Large text window could not be decoded safely',
          (current) => load(section.offset + section.byte_count, current),
        );
  const findMatch = (direction: 1 | -1 = 1) => {
    if (!query) {
      setStatus('Enter search text.');
      return false;
    }
    return run(
      'Searching source. Cancel leaves the current section open.',
      'Text search could not complete',
      async (current) => {
        const matches =
          searchCursor?.query === query
            ? searchCursor.matches
            : await reader!.search(query, byteLength);
        if (!current()) return false;
        if (!matches.length) {
          setSearchCursor({ query, matches, index: -1 });
          setStatus('No match');
          return true;
        }
        const index =
          searchCursor?.query === query
            ? (searchCursor.index + direction + matches.length) % matches.length
            : direction === 1
              ? 0
              : matches.length - 1;
        const moved = await load(matches[index], current);
        if (moved) {
          setSearchCursor({ query, matches, index });
          const wrapped =
            searchCursor?.query === query &&
            ((direction === 1 && index === 0) ||
              (direction === -1 && index === matches.length - 1));
          setStatus(
            'Match ' +
              (index + 1) +
              ' of ' +
              (matches.length === LARGE_TEXT_MATCH_LIMIT ? 'first ' : '') +
              matches.length +
              (wrapped ? '. Search wrapped.' : ''),
          );
        }
        return moved;
      },
    );
  };
  const goToLine = () => {
    if (
      !/^\d+$/u.test(line) ||
      !Number.isSafeInteger(Number(line)) ||
      Number(line) < 1
    ) {
      setInvalidLine(true);
      setStatus('Enter a positive whole line number.');
      return false;
    }
    setInvalidLine(false);
    return run(
      'Finding line ' + line + '. Cancel leaves the current section open.',
      'Line navigation could not complete',
      async (current) => {
        const offset = await reader!.lineOffset(Number(line), byteLength);
        if (!current()) return false;
        if (offset === null) {
          setInvalidLine(true);
          setStatus('Line is outside the source');
          return false;
        }
        const moved = await load(offset, current);
        if (moved) {
          setStatus(
            'Line ' + line + ' is at the start of the visible section.',
          );
          contentRef.current?.focus();
        }
        return moved;
      },
    );
  };
  const copySection = () => {
    if (!section) return false;
    if (!clipboardTextAvailable()) {
      setStatus('Clipboard is unavailable. The visible section remains open.');
      return false;
    }
    return run(
      'Copying visible section',
      'Clipboard copy could not complete',
      async (current) => {
        await writeClipboardText(section.text);
        if (!current()) return false;
        setStatus('Visible section copied');
        return true;
      },
    );
  };
  const cancel = () => {
    generation.current += 1;
    reader?.cancel();
    busy.current = false;
    setPending(false);
    setStatus('Text operation cancelled. The current section remains open.');
  };
  const closeTools = () => {
    if (busy.current) cancel();
    setToolsOpen(false);
  };
  const local = (operation: () => boolean | Promise<boolean>) => {
    void Promise.resolve()
      .then(operation)
      .catch(() => undefined);
  };
  useImperativeHandle(handleRef, () => ({
    invoke(command, opener) {
      if (session.lifecycle !== 'active') return false;
      if (command === 'large_text_tools' && reader) {
        toolsOpener.current = opener ?? contentRef.current;
        setToolsOpen(true);
        return true;
      }
      if (command === 'copy') return copySection();
      if (command === 'previous_page') return previousSection();
      if (command === 'next_page') return nextSection();
      if (command === 'find_next') return findMatch();
      if (command === 'find_previous') return findMatch(-1);
      if ((command === 'search' || command === 'go_to_line') && reader) {
        const expected = owner.current;
        toolsOpener.current = opener ?? contentRef.current;
        const tool = command === 'search' ? 'find' : 'line';
        setFocusTool(tool);
        setToolsOpen(true);
        return new Promise<boolean>((resolve) => {
          requestAnimationFrame(() => {
            if (
              owner.current.id !== expected.id ||
              owner.current.revision !== expected.revision ||
              owner.current.source_id !== expected.source_id ||
              owner.current.lifecycle !== 'active' ||
              !toolsOpenRef.current
            ) {
              resolve(false);
              return;
            }
            const field =
              tool === 'find' ? findInput.current : lineInput.current;
            field?.focus();
            field?.select();
            resolve(Boolean(field && document.activeElement === field));
          });
        });
      }
      return false;
    },
    selectRange() {
      return false;
    },
    dismissModal() {
      if (toolsOpenRef.current) {
        closeTools();
        return true;
      }
      if (!busy.current) return false;
      cancel();
      return true;
    },
  }));
  const highlighted =
    searchCursor?.query === query &&
    searchCursor.index >= 0 &&
    section?.offset === searchCursor.matches[searchCursor.index] &&
    section.text.startsWith(query);
  return (
    <div
      className="large-text document-tools"
      aria-label={session.source.display_name + ' large text viewer'}
    >
      {!toolsOpen && (
        <p
          id="large-text-status"
          role="status"
          aria-live="polite"
          className={section ? 'visually-hidden' : undefined}
        >
          {status}
        </p>
      )}
      {!toolsOpen && pending && !section && (
        <button type="button" onClick={cancel}>
          Cancel text operation
        </button>
      )}
      <TaskSurface
        open={toolsOpen}
        onOpenChange={(open) => {
          if (!open) closeTools();
        }}
        title="Large text tools"
        opener={toolsOpener.current}
        className="large-text-task document-tools"
      >
        <div className="large-text-controls" aria-busy={pending}>
          <button
            type="button"
            disabled={pending || !section || section.offset === 0}
            onClick={() => local(previousSection)}
          >
            Previous section
          </button>
          <button
            type="button"
            disabled={pending || !section || section.end_of_source}
            onClick={() => local(nextSection)}
          >
            Next section
          </button>
          <label>
            Find{' '}
            <input
              ref={findInput}
              data-task-initial-focus={focusTool === 'find' || undefined}
              value={query}
              disabled={pending}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchCursor(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') local(() => findMatch());
              }}
            />
          </label>
          <button
            type="button"
            disabled={pending || !query || !reader}
            onClick={() => local(() => findMatch())}
          >
            Find next
          </button>
          <label>
            Line{' '}
            <input
              ref={lineInput}
              data-task-initial-focus={focusTool === 'line' || undefined}
              inputMode="numeric"
              value={line}
              disabled={pending}
              aria-invalid={invalidLine}
              aria-describedby="large-text-status"
              onChange={(event) => {
                setLine(event.target.value);
                setInvalidLine(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') local(goToLine);
              }}
            />
          </label>
          <button
            type="button"
            disabled={pending || !reader}
            onClick={() => local(goToLine)}
          >
            Go to line
          </button>
          <button
            type="button"
            disabled={pending || !section}
            onClick={() => local(copySection)}
          >
            Copy visible section
          </button>
          {pending && (
            <button type="button" onClick={cancel}>
              Cancel text operation
            </button>
          )}
          <span id="large-text-status" role="status" aria-live="polite">
            {status}
          </span>
          {section && (
            <span>
              Source bytes {section.offset + 1}–
              {section.offset + section.byte_count} of {byteLength}. Copy
              includes exactly this visible section.
            </span>
          )}
        </div>
      </TaskSurface>
      <pre
        ref={contentRef}
        tabIndex={-1}
        className="document-content large-text-content"
      >
        {highlighted ? (
          <>
            <mark>{query}</mark>
            {section.text.slice(query.length)}
          </>
        ) : (
          (section?.text ?? '')
        )}
      </pre>
    </div>
  );
});
