import { useEffect, useMemo, useState } from 'react';

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

export function LargeTextSurface({ session, gateway }: LargeTextSurfaceProps) {
  const selectedGateway = useMemo(
    () => gateway ?? createNativeLargeTextGateway(),
    [gateway],
  );
  const reader = useMemo(
    () =>
      session.source_id
        ? new LargeTextReader(selectedGateway, session.source_id)
        : null,
    [selectedGateway, session.source_id],
  );
  const [window, setWindow] = useState<LargeTextWindow | null>(null);
  const [status, setStatus] = useState('Loading bounded text window');
  const [query, setQuery] = useState('');
  const [line, setLine] = useState('1');
  const byteLength =
    session.source.byte_length ?? session.text_document?.source_bytes ?? 0;

  useEffect(() => {
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
      reader.cancel();
    };
  }, [reader]);

  const move = (offset: number) => {
    if (!reader) return;
    setStatus('Loading bounded text window');
    void reader
      .window(Math.max(0, offset))
      .then((value) => {
        setWindow(value);
        setStatus(
          value.end_of_source ? 'End of source' : 'Read-only bounded window',
        );
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setStatus('Large text window could not be decoded safely');
      });
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
          onClick={() =>
            move(Math.max(0, (window?.offset ?? 0) - (window?.byte_count ?? 0)))
          }
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
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!query || !reader}
          onClick={() =>
            void reader
              ?.search(query, byteLength)
              .then((matches) =>
                matches[0] === undefined
                  ? setStatus('No match')
                  : move(matches[0]),
              )
          }
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
