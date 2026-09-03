import { useEffect, useMemo, useRef, useState } from 'react';

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

export function LargeTextSurface({ session, gateway }: LargeTextSurfaceProps) {
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
  const byteLength =
    session.source.byte_length ?? session.text_document?.source_bytes ?? 0;

  useEffect(() => {
    if (!reader) {
      setStatus('Large text source authority is unavailable');
      return;
    }
    let live = true;
    previousOffsets.current = [];
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
      reader.cancel();
    };
  }, [reader]);

  const move = (
    offset: number,
    rememberCurrent = true,
    loadedStatus?: string,
  ) => {
    if (!reader) return;
    if (rememberCurrent && window) previousOffsets.current.push(window.offset);
    setStatus('Loading bounded text window');
    void reader
      .window(Math.max(0, offset))
      .then((value) => {
        setWindow(value);
        setStatus(
          loadedStatus ??
            (value.end_of_source
              ? 'End of source'
              : 'Read-only bounded window'),
        );
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setStatus('Large text window could not be decoded safely');
      });
  };

  const findNextMatch = async () => {
    if (!reader || !query) return;
    const matches =
      searchCursor?.query === query
        ? searchCursor.matches
        : await reader.search(query, byteLength);
    if (matches.length === 0) {
      setSearchCursor({ query, matches, index: -1 });
      setStatus('No match');
      return;
    }
    const index =
      searchCursor?.query === query
        ? (searchCursor.index + 1) % matches.length
        : 0;
    setSearchCursor({ query, matches, index });
    move(matches[index], true, `Match ${index + 1} of ${matches.length}`);
  };

  return (
    <div
      className="large-text"
      aria-label={`${session.source.display_name} large text viewer`}
    >
      <div className="large-text-controls">
        <button
          type="button"
          disabled={!window || window.offset === 0}
          onClick={() => move(previousOffsets.current.pop() ?? 0, false)}
        >
          Previous window
        </button>
        <button
          type="button"
          disabled={!window || window.end_of_source}
          onClick={() =>
            move((window?.offset ?? 0) + (window?.byte_count ?? 0))
          }
        >
          Next window
        </button>
        <label>
          Find{' '}
          <input
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
          onClick={() => void findNextMatch()}
        >
          Find next
        </button>
        <label>
          Line{' '}
          <input
            inputMode="numeric"
            value={line}
            onChange={(event) => setLine(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!reader}
          onClick={() =>
            void reader
              ?.lineOffset(Number(line), byteLength)
              .then((offset) =>
                offset === null
                  ? setStatus('Line is outside the source')
                  : move(offset),
              )
          }
        >
          Go to line
        </button>
        <button
          type="button"
          disabled={!window}
          onClick={() =>
            void navigator.clipboard?.writeText(window?.text ?? '')
          }
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
}
