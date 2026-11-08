import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Button, Field, TextInput } from '../../../../brand/web/react/server';
import type { PdfController, PdfPageSurface } from '../domain/pdf-controller';
import {
  classifyPdfFailure,
  type PdfDocumentState,
  type PdfSearchMatch,
} from '../domain/pdf-contract';
import type { PdfOutlineRow } from '../domain/pdf-navigation';
import type { MarkdownExternalLinkGateway } from '../domain/markdown-gateway';
import { unavailableMarkdownExternalLinkGateway } from '../domain/markdown-gateway';
import { classifyMarkdownTarget } from '../domain/markdown-url';
import type { CommandId } from '../domain/commands';
import { TaskSurface } from './TaskSurface';
export interface PdfNavigationHandle {
  invoke: (command: CommandId, opener?: HTMLElement) => boolean;
  open: (
    task: 'search' | 'outline' | 'thumbnails' | 'links',
    opener: HTMLElement,
  ) => void;
}
interface Props {
  controller: PdfController;
  state: PdfDocumentState;
  externalLinkGateway?: MarkdownExternalLinkGateway;
  onLabels: (labels: string[]) => void;
  onMatch: (match: PdfSearchMatch) => void;
}
function Thumbnail({
  controller,
  index,
  activate,
  current,
}: {
  controller: PdfController;
  index: number;
  activate: () => void;
  current: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    let surface: PdfPageSurface | null = null;
    const work = async () => {
      const size = await controller.pageSize(index, 0);
      if (abort.signal.aborted) return;
      const result = await controller.renderPage(
        index,
        canvas.current!,
        document.createElement('div'),
        Math.min(96 / size.width, 128 / size.height),
        0,
        abort.signal,
        false,
      );
      if (abort.signal.aborted) result.dispose();
      else surface = result;
    };
    void work().catch(() => {
      if (!abort.signal.aborted) setError(true);
    });
    return () => {
      abort.abort();
      surface?.dispose();
    };
  }, [controller, index]);
  return (
    <div className="pdf-thumbnail">
      <Button
        variant={current ? 'secondary' : 'ghost'}
        aria-current={current ? 'page' : undefined}
        onClick={activate}
        aria-label={'Go to page ' + String(index + 1)}
      >
        <canvas ref={canvas} aria-hidden="true" />
        <span>
          {String(index + 1)}
          {error ? ' (preview unavailable)' : ''}
        </span>
      </Button>
    </div>
  );
}
export const PdfNavigationTools = forwardRef<PdfNavigationHandle, Props>(
  function PdfNavigationTools(
    {
      controller,
      state,
      externalLinkGateway = unavailableMarkdownExternalLinkGateway,
      onLabels,
      onMatch,
    },
    ref,
  ) {
    const [task, setTask] = useState<
      'search' | 'outline' | 'thumbnails' | 'links' | null
    >(null);
    const opener = useRef<HTMLElement | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<PdfOutlineRow[]>([]);
    const [outlineLimited, setOutlineLimited] = useState(false);
    const [outlineFailed, setOutlineFailed] = useState(false);
    const [outlineStart, setOutlineStart] = useState(0);
    const [query, setQuery] = useState('');
    const [matches, setMatches] = useState<PdfSearchMatch[]>([]);
    const [matchIndex, setMatchIndex] = useState(-1);
    const [progress, setProgress] = useState(0);
    const [searching, setSearching] = useState(false);
    const [limited, setLimited] = useState(false);
    const searchAbort = useRef<AbortController | null>(null);
    const [thumbStart, setThumbStart] = useState(0);
    const [links, setLinks] = useState<
      Awaited<ReturnType<PdfController['pageLinks']>>
    >([]);
    const [external, setExternal] = useState<string | null>(null);
    const externalOpener = useRef<HTMLElement | null>(null);
    const callbacks = useRef({ onLabels, onMatch });
    callbacks.current = { onLabels, onMatch };
    const open = (next: NonNullable<typeof task>, target: HTMLElement) => {
      opener.current = target;
      setError(null);
      if (next === 'thumbnails')
        setThumbStart(Math.floor(state.navigation.page / 8) * 8);
      setTask(next);
    };
    const choose = (index: number) => {
      const match = matches[index];
      if (!match) return false;
      setMatchIndex(index);
      callbacks.current.onMatch(match);
      return true;
    };
    useImperativeHandle(ref, () => ({
      open,
      invoke(command, target) {
        if (command === 'search' && target) {
          open('search', target);
          return true;
        }
        if (command === 'outline' && target) {
          open('outline', target);
          return true;
        }
        if (command === 'close_search') {
          setTask(null);
          searchAbort.current?.abort();
          return true;
        }
        if (command === 'find_next')
          return choose((matchIndex + 1) % matches.length);
        if (command === 'find_previous')
          return choose((matchIndex - 1 + matches.length) % matches.length);
        return false;
      },
    }));
    useEffect(() => {
      if (!state.capabilities.view) return;
      let active = true;
      void controller
        .navigationIndex()
        .then((index) => {
          if (active) {
            setRows(index.rows);
            setOutlineLimited(index.limited);
            setOutlineFailed(index.outlineError);
            callbacks.current.onLabels(index.labels);
          }
        })
        .catch(() => {
          if (active) setError('Document navigation is unavailable.');
        });
      return () => {
        active = false;
      };
    }, [controller, state.capabilities.view]);
    useEffect(() => {
      if (task !== 'links' || !state.capabilities.view) return;
      let active = true;
      setLinks([]);
      void controller
        .pageLinks(state.navigation.page)
        .then((value) => {
          if (active) setLinks(value);
        })
        .catch(() => {
          if (active) setError('Page links are unavailable.');
        });
      return () => {
        active = false;
      };
    }, [controller, task, state.navigation.page, state.capabilities.view]);
    useEffect(() => {
      if (task !== 'search') {
        searchAbort.current?.abort();
        setSearching(false);
      }
      return () => searchAbort.current?.abort();
    }, [task]);
    useEffect(() => {
      if (!state.capabilities.view) {
        searchAbort.current?.abort();
        setTask(null);
        setExternal(null);
        setMatches([]);
        setRows([]);
        callbacks.current.onLabels([]);
      }
      return () => searchAbort.current?.abort();
    }, [state.capabilities.view]);
    const startSearch = () => {
      searchAbort.current?.abort();
      const abort = new AbortController();
      searchAbort.current = abort;
      setMatches([]);
      setMatchIndex(-1);
      setProgress(0);
      setLimited(false);
      setError(null);
      setSearching(true);
      void controller
        .search(query, abort.signal, (pages, results) => {
          if (!abort.signal.aborted) {
            setProgress(pages);
            setMatches(results);
          }
        })
        .then((result) => {
          if (!abort.signal.aborted) {
            setMatches(result.matches);
            setLimited(result.limited);
            setSearching(false);
          }
        })
        .catch((reason) => {
          if (!abort.signal.aborted) {
            setError('Search unavailable: ' + classifyPdfFailure(reason));
            setSearching(false);
          }
        });
    };
    const follow = async (destination: unknown) => {
      try {
        controller.follow(await controller.destination(destination));
        setTask(null);
      } catch {
        setError('This destination is unavailable in this document.');
      }
    };
    const link = (value: (typeof links)[number], target: HTMLElement) => {
      if (value.destination !== undefined) {
        void follow(value.destination);
        return;
      }
      if (value.url !== undefined) {
        const candidate = classifyMarkdownTarget(value.url);
        if (
          (candidate.kind === 'external' || candidate.kind === 'email') &&
          candidate.normalized_target
        ) {
          externalOpener.current = target;
          setExternal(candidate.normalized_target);
        } else setError('This link cannot be opened.');
        return;
      }
      const count = state.page_count ?? 0;
      const pages: Record<string, number> = {
        NextPage: state.navigation.page + 1,
        PrevPage: state.navigation.page - 1,
        FirstPage: 0,
        LastPage: count - 1,
      };
      const page = value.action ? pages[value.action] : undefined;
      if (page !== undefined && page >= 0 && page < count) {
        controller.navigate(page);
        setTask(null);
      } else setError('This document action is unavailable.');
    };
    return (
      <>
        <TaskSurface
          open={task !== null}
          onOpenChange={(open) => {
            if (!open) setTask(null);
          }}
          title={
            task === 'search'
              ? 'Search PDF'
              : task === 'outline'
                ? 'PDF outline'
                : task === 'links'
                  ? 'Page links'
                  : 'PDF thumbnails'
          }
          opener={opener.current}
          className="pdf-tools"
        >
          <p role="status">
            Page {String(state.navigation.page + 1)} of{' '}
            {String(state.page_count ?? 0)}
          </p>
          {task === 'search' && (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  startSearch();
                }}
              >
                <Field
                  id="pdf-search"
                  label="Find text"
                  control={
                    <TextInput
                      value={query}
                      maxLength={256}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  }
                />
                <Button type="submit" disabled={!query.trim() || searching}>
                  Search PDF
                </Button>
              </form>
              <p role="status">
                {searching
                  ? 'Searching ' +
                    String(progress) +
                    ' / ' +
                    String(state.page_count) +
                    ' pages. '
                  : ''}
                {String(matches.length)} matches
                {limited ? ' (search limit reached)' : ''}.
              </p>
              {searching && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    searchAbort.current?.abort();
                    setSearching(false);
                  }}
                >
                  Cancel search
                </Button>
              )}
              <div className="pdf-tool-actions">
                <Button
                  variant="secondary"
                  disabled={!matches.length}
                  onClick={() =>
                    choose((matchIndex - 1 + matches.length) % matches.length)
                  }
                >
                  Previous match
                </Button>
                <Button
                  variant="secondary"
                  disabled={!matches.length}
                  onClick={() => choose((matchIndex + 1) % matches.length)}
                >
                  Next match
                </Button>
              </div>
              <ol className="pdf-task-list">
                {matches
                  .slice(
                    Math.max(0, matchIndex - 10),
                    Math.max(0, matchIndex - 10) + 40,
                  )
                  .map((match, index) => (
                    <li key={String(match.page) + ':' + String(match.offset)}>
                      <Button
                        variant="ghost"
                        aria-current={
                          matches.indexOf(match) === matchIndex
                            ? 'true'
                            : undefined
                        }
                        onClick={() => {
                          choose(Math.max(0, matchIndex - 10) + index);
                          setTask(null);
                        }}
                      >
                        Page {String(match.page + 1)}: {match.context}
                      </Button>
                    </li>
                  ))}
              </ol>
            </>
          )}
          {task === 'outline' && (
            <>
              {!rows.length && (
                <p>
                  {outlineFailed
                    ? 'The outline could not be inspected within its limits.'
                    : 'No outline provided.'}
                </p>
              )}
              {outlineLimited && (
                <p role="status">
                  Outline limit reached; invalid or excessive entries were
                  omitted.
                </p>
              )}
              <div className="pdf-tool-actions">
                <Button
                  variant="secondary"
                  disabled={outlineStart === 0}
                  onClick={() =>
                    setOutlineStart((value) => Math.max(0, value - 100))
                  }
                >
                  Previous entries
                </Button>
                <Button
                  variant="secondary"
                  disabled={outlineStart + 100 >= rows.length}
                  onClick={() => setOutlineStart((value) => value + 100)}
                >
                  More entries
                </Button>
              </div>
              <ol className="pdf-task-list">
                {rows
                  .slice(outlineStart, outlineStart + 100)
                  .map((row, index) => (
                    <li key={outlineStart + index}>
                      <Button
                        variant="ghost"
                        onClick={() => void follow(row.destination)}
                      >
                        {'› '.repeat(Math.min(row.depth, 8))}
                        {row.title}
                      </Button>
                    </li>
                  ))}
              </ol>
            </>
          )}
          {task === 'thumbnails' && (
            <>
              {!state.capabilities.thumbnails ? (
                <p>
                  Thumbnails are paused while the document uses reduced cache.
                </p>
              ) : (
                <>
                  <div className="pdf-tool-actions">
                    <Button
                      variant="secondary"
                      disabled={thumbStart === 0}
                      onClick={() =>
                        setThumbStart((value) => Math.max(0, value - 8))
                      }
                    >
                      Previous thumbnails
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={thumbStart + 8 >= (state.page_count ?? 0)}
                      onClick={() => setThumbStart((value) => value + 8)}
                    >
                      More thumbnails
                    </Button>
                  </div>
                  <div className="pdf-thumbnails">
                    {Array.from(
                      {
                        length: Math.min(
                          8,
                          (state.page_count ?? 0) - thumbStart,
                        ),
                      },
                      (_, index) => (
                        <Thumbnail
                          key={thumbStart + index}
                          controller={controller}
                          index={thumbStart + index}
                          current={thumbStart + index === state.navigation.page}
                          activate={() => {
                            controller.navigate(thumbStart + index);
                            setTask(null);
                          }}
                        />
                      ),
                    )}
                  </div>
                </>
              )}
            </>
          )}
          {task === 'links' && (
            <>
              {!links.length && <p>No supported links on this page.</p>}
              <ol className="pdf-task-list">
                {links.map((value, index) => (
                  <li key={index}>
                    <Button
                      variant="ghost"
                      onClick={(event) => link(value, event.currentTarget)}
                    >
                      {value.label}
                      {value.url ? ': ' + value.url : ''}
                    </Button>
                  </li>
                ))}
              </ol>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </TaskSurface>
        <TaskSurface
          open={external !== null}
          onOpenChange={(open) => {
            if (!open) setExternal(null);
          }}
          title="Open external link"
          opener={externalOpener.current}
          className="pdf-tools"
        >
          <p>This opens in another application.</p>
          <p className="pdf-link-target">{external}</p>
          <Button
            onClick={() => {
              if (!external) return;
              const candidate = classifyMarkdownTarget(external);
              if (
                !candidate.normalized_target ||
                (candidate.kind !== 'external' && candidate.kind !== 'email')
              ) {
                setError('Link unavailable.');
                setExternal(null);
                return;
              }
              void externalLinkGateway
                .open(candidate.normalized_target)
                .then(() => setExternal(null))
                .catch(() =>
                  setError('The external application could not be opened.'),
                );
            }}
          >
            Open link
          </Button>
          <Button variant="secondary" onClick={() => setExternal(null)}>
            Cancel
          </Button>
          {error && <p role="alert">{error}</p>}
        </TaskSurface>
      </>
    );
  },
);
