import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import type { TextEditorHandle } from './TextEditorSurface';

import type { ShellSession } from '../domain/contracts';
import {
  createNativeLargeTextGateway,
  type LargeTextGateway,
} from '../domain/large-text-gateway';
import { LargeTextReader, type LargeTextWindow } from '../domain/large-text';

interface LargeTextSurfaceProps {
  session: ShellSession;
  gateway?: LargeTextGateway;
}

interface SearchCursor {
  query: string;
  matches: number[];
  index: number;
}

export const LargeTextSurface = forwardRef<TextEditorHandle, LargeTextSurfaceProps>(function LargeTextSurface({ session, gateway }, handleRef) {
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
  const [window, setWindow] = useState<LargeTextWindow | null>(null);
  const [status, setStatus] = useState('Loading bounded text window');
  const [query, setQuery] = useState('');
  const [searchCursor, setSearchCursor] = useState<SearchCursor | null>(null);
  const [line, setLine] = useState('1');
  const previousOffsets = useRef<number[]>([]);
  const findInput = useRef<HTMLInputElement>(null);
  const lineInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const byteLength =
    session.source.byte_length ?? session.text_document?.source_bytes ?? 0;

  useEffect(() => {
    generation.current += 1;
    previousOffsets.current = [];
    setWindow(null);
    setSearchCursor(null);
    if (!reader) {
      setStatus('Large text source authority is unavailable');
      return;
    }
    let live = true;
    void reader
      .window(0)
      .then((value) => {
        if (!live) return;
        setWindow(value);
        setStatus(
          value.end_of_source ? 'End of source' : 'Read-only bounded window',
        );
      })
      .catch(() => {
        if (live) setStatus('Large text window could not be decoded safely');
      });
    return () => {
      live = false;
      generation.current += 1;
      reader.cancel();
    };
  }, [reader]);

  const move = async (
    offset: number,
    rememberCurrent = true,
    loadedStatus?: string,
  ): Promise<boolean> => {
    if (!reader) return false;
    const expectedGeneration = generation.current;
    const previousOffset = window?.offset;
    setStatus('Loading bounded text window');
    try {
      const value = await reader.window(Math.max(0, offset));
      if (generation.current !== expectedGeneration) return false;
      if (rememberCurrent && previousOffset !== undefined) previousOffsets.current.push(previousOffset);
      setWindow(value);
      setStatus(loadedStatus ?? (value.end_of_source ? 'End of source' : 'Read-only bounded window'));
      return true;
    } catch (error: unknown) {
      if (generation.current !== expectedGeneration) return false;
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('Text operation cancelled');
        return false;
      }
      setStatus('Large text window could not be decoded safely');
      throw error;
    }
  };

  const previousWindow = async () => {
    if (!window || window.offset === 0) return false;
    const moved = await move(previousOffsets.current.at(-1) ?? 0, false);
    if (moved) previousOffsets.current.pop();
    return moved;
  };

  const nextWindow = () => !window || window.end_of_source
    ? false
    : move(window.offset + window.byte_count);

  const findMatch = async (direction: 1 | -1 = 1): Promise<boolean> => {
    if (!reader || !query) return false;
    const expectedGeneration = generation.current;
    try {
      const matches = searchCursor?.query === query
        ? searchCursor.matches
        : await reader.search(query, byteLength);
      if (generation.current !== expectedGeneration) return false;
      if (matches.length === 0) {
        setSearchCursor({ query, matches, index: -1 });
        setStatus('No match');
        return true;
      }
      const index = searchCursor?.query === query
        ? (searchCursor.index + direction + matches.length) % matches.length
        : direction === 1 ? 0 : matches.length - 1;
      const moved = await move(matches[index], true, 'Match ' + (index + 1) + ' of ' + matches.length);
      if (moved) setSearchCursor({ query, matches, index });
      return moved;
    } catch (error: unknown) {
      if (generation.current !== expectedGeneration) return false;
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('Text search cancelled');
        return false;
      }
      setStatus('Text search could not complete');
      throw error;
    }
  };

  const goToLine = async (): Promise<boolean> => {
    if (!reader) return false;
    const expectedGeneration = generation.current;
    try {
      const offset = await reader.lineOffset(Number(line), byteLength);
      if (generation.current !== expectedGeneration) return false;
      if (offset === null) { setStatus('Line is outside the source'); return false; }
      return await move(offset);
    } catch (error: unknown) {
      if (generation.current !== expectedGeneration) return false;
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('Line navigation cancelled');
        return false;
      }
      setStatus('Line navigation could not complete');
      throw error;
    }
  };

  const copyWindow = () => {
    if (!window || !navigator.clipboard?.writeText) return false;
    const expectedGeneration = generation.current;
    return navigator.clipboard.writeText(window.text).then(() => {
      if (generation.current !== expectedGeneration) return false;
      setStatus('Text window copied');
      return true;
    }).catch((error: unknown) => {
      if (generation.current === expectedGeneration) setStatus('Clipboard copy could not complete');
      throw error;
    });
  };

  const local = (operation: () => boolean | Promise<boolean>) => {
    void Promise.resolve().then(operation).catch(() => undefined);
  };

  useImperativeHandle(handleRef, () => ({
    invoke(command) {
      if (session.lifecycle !== 'active') return false;
      if (command === 'copy') return copyWindow();
      if (command === 'previous_page') return previousWindow();
      if (command === 'next_page') return nextWindow();
      if (command === 'find_next') return findMatch();
      if (command === 'find_previous') return findMatch(-1);
      if (command === 'search' && reader && findInput.current) {
        findInput.current.focus();
        findInput.current.select();
        return true;
      }
      if (command === 'go_to_line' && reader && lineInput.current) {
        lineInput.current.focus();
        lineInput.current.select();
        return true;
      }
      return false;
    },
    selectRange() { return false; },
  }));

  return (
    <div
      className="large-text"
      aria-label={`${session.source.display_name} large text viewer`}
    >
      <div className="large-text-controls">
        <button
          type="button"
          disabled={!window || window.offset === 0}
          onClick={() => local(previousWindow)}
        >
          Previous window
        </button>
        <button
          type="button"
          disabled={!window || window.end_of_source}
          onClick={() => local(nextWindow)}
        >
          Next window
        </button>
        <label>
          Find{' '}
          <input
            ref={findInput}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchCursor(null);
            }}
          />
        </label>
        <button
          type="button"
          disabled={!query || !reader}
          onClick={() => local(() => findMatch())}
        >
          Find next
        </button>
        <label>
          Line{' '}
          <input
            ref={lineInput}
            inputMode="numeric"
            value={line}
            onChange={(event) => setLine(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!reader}
          onClick={() => local(goToLine)}
        >
          Go to line
        </button>
        <button
          type="button"
          disabled={!window}
          onClick={() => local(copyWindow)}
        >
          Copy window
        </button>
        <span role="status">{status}</span>
      </div>
      <pre className="document-content large-text-content">
        {window?.text ?? ''}
      </pre>
    </div>
  );
});
