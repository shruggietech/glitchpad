import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import type { CommandId } from '../domain/commands';
import type {
  LanguageDecision,
  MarkdownDocumentState,
  ShellSession,
  TextDocumentState,
} from '../domain/contracts';
import {
  findRenderedMatches,
  markdownEligibility,
  type LinkCandidate,
  type MarkdownRenderResult,
  type ResourceCandidate,
  type SafeRenderedNode,
  type SourceRange,
} from '../domain/markdown-contract';
import {
  unavailableMarkdownExternalLinkGateway,
  unavailableMarkdownLocalAssetGateway,
  type MarkdownExternalLinkGateway,
  type MarkdownLocalAssetGateway,
} from '../domain/markdown-gateway';
import { MarkdownRendererClient } from '../domain/markdown-renderer';
import { EmbeddedMermaidSurface } from './EmbeddedMermaidSurface';
import {
  TextEditorSurface,
  type TextEditorHandle,
} from './TextEditorSurface';

interface MarkdownSurfaceProps {
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
  onMarkdownChange: (
    id: string,
    expectedRevision: number,
    markdown: MarkdownDocumentState,
  ) => void;
  rendererClient?: MarkdownRendererClient;
  externalLinkGateway?: MarkdownExternalLinkGateway;
  localAssetGateway?: MarkdownLocalAssetGateway;
}

interface SafeTreeProps {
  node: SafeRenderedNode;
  session: ShellSession;
  activeNodeId: string | null;
  onLink: (candidate: LinkCandidate, trigger: HTMLElement) => void;
  onLocalLink: (candidate: LinkCandidate) => void;
  localAssetGateway: MarkdownLocalAssetGateway;
  onMermaidSource: (range: SourceRange | null) => void;
}

const safeClassName = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return undefined;
  const accepted = value.filter(
    (item): item is string =>
      typeof item === 'string' &&
      /^(?:language-[a-z0-9_-]+|contains-task-list|task-list-item|footnotes)$/iu.test(
        item,
      ),
  );
  return accepted.length > 0 ? accepted.join(' ') : undefined;
};

function LocalMarkdownResource({
  resource,
  session,
  gateway,
}: {
  resource: ResourceCandidate;
  session: ShellSession;
  gateway: MarkdownLocalAssetGateway;
}) {
  const [asset, setAsset] = useState<{
    target: string;
    value: string | null;
  } | null>(null);
  useEffect(() => {
    if (resource.kind !== 'local' || !resource.normalized_target) return;
    const abort = new AbortController();
    const target = resource.normalized_target;
    void gateway
      .resolve(session.source, target, abort.signal)
      .then((resolved) => {
        if (!abort.signal.aborted) setAsset({ target, value: resolved });
      })
      .catch(() => undefined);
    return () => abort.abort();
  }, [gateway, resource.kind, resource.normalized_target, session.source]);
  const currentAsset =
    resource.kind === 'local' && asset?.target === resource.normalized_target
      ? asset.value
      : null;
  const trustedAsset =
    currentAsset &&
    /^(?:blob:|asset:|https?:\/\/asset\.localhost\/)/u.test(currentAsset);
  if (trustedAsset) {
    return <img src={currentAsset} alt={resource.alt} className="markdown-local-image" />;
  }
  return (
    <span className="markdown-resource-unavailable" role="note">
      Image unavailable{resource.alt ? `: ${resource.alt}` : ''}
    </span>
  );
}

const activateOnKeyboard = (
  event: KeyboardEvent<HTMLElement>,
  action: () => void,
) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  action();
};

function SafeTree({
  node,
  session,
  activeNodeId,
  onLink,
  onLocalLink,
  localAssetGateway,
  onMermaidSource,
}: SafeTreeProps): ReactNode {
  if (node.type === 'text') return node.value;
  if (node.type === 'root') {
    return node.children.map((child) => (
      <SafeTree
        key={child.id}
        node={child}
        session={session}
        activeNodeId={activeNodeId}
        onLink={onLink}
        onLocalLink={onLocalLink}
        localAssetGateway={localAssetGateway}
        onMermaidSource={onMermaidSource}
      />
    ));
  }
  if (node.resource) {
    return (
      <LocalMarkdownResource
        resource={node.resource}
        session={session}
        gateway={localAssetGateway}
      />
    );
  }
  if (node.type === 'element' && node.mermaid) {
    return (
      <EmbeddedMermaidSurface
        block={node.mermaid}
        documentName={session.source.display_name}
        onViewSource={() => onMermaidSource(node.source_range)}
      />
    );
  }
  const children = node.children.map((child) => (
    <SafeTree
      key={child.id}
      node={child}
      session={session}
      activeNodeId={activeNodeId}
      onLink={onLink}
      onLocalLink={onLocalLink}
      localAssetGateway={localAssetGateway}
      onMermaidSource={onMermaidSource}
    />
  ));
  if (node.link) {
    const candidate = node.link;
    if (candidate.kind === 'external' || candidate.kind === 'email') {
      return (
        <button
          type="button"
          className="markdown-link"
          title={candidate.display_target}
          onClick={(event) => onLink(candidate, event.currentTarget)}
        >
          {children}
          <span className="visually-hidden markdown-link-destination-disclosure">
            {` External destination ${candidate.display_target}`}
          </span>
        </button>
      );
    }
    if (candidate.kind === 'fragment' && candidate.normalized_target) {
      const activate = () => {
        const target = document.getElementById(
          candidate.normalized_target!.slice(1),
        );
        target?.scrollIntoView({ block: 'start' });
        target?.focus();
      };
      return (
        <span
          id={
            typeof node.properties.id === 'string' &&
            /^user-content-[a-z0-9_-]+$/iu.test(node.properties.id)
              ? node.properties.id
              : undefined
          }
          className="markdown-link"
          role="link"
          tabIndex={0}
          title={candidate.display_target}
          aria-describedby={
            typeof node.properties.ariaDescribedBy === 'string'
              ? node.properties.ariaDescribedBy
              : undefined
          }
          data-footnote-ref={
            Object.hasOwn(node.properties, 'dataFootnoteRef') ? '' : undefined
          }
          data-footnote-backref={
            Object.hasOwn(node.properties, 'dataFootnoteBackref') ? '' : undefined
          }
          onClick={activate}
          onKeyDown={(event) => activateOnKeyboard(event, activate)}
        >
          {children}
        </span>
      );
    }
    if (
      candidate.kind === 'local' &&
      candidate.normalized_target &&
      localAssetGateway.openDocument
    ) {
      return (
        <button
          type="button"
          className="markdown-link"
          title={candidate.display_target}
          onClick={() => onLocalLink(candidate)}
        >
          {children}
        </button>
      );
    }
    return (
      <span
        className="markdown-link-blocked"
        title={
          candidate.kind === 'local'
            ? 'Local destination unavailable'
            : 'Blocked destination'
        }
      >
        {children}
      </span>
    );
  }
  const common = {
    'data-markdown-node': node.id,
    className:
      [safeClassName(node.properties.className),
        activeNodeId === node.id ? 'markdown-search-match' : undefined]
        .filter(Boolean)
        .join(' ') || undefined,
  };
  const heading = /^h[1-6]$/u.test(node.tag_name);
  const properties: Record<string, unknown> = { ...common };
  if (
    typeof node.properties.id === 'string' &&
    /^user-content-[a-z0-9_-]+$/iu.test(node.properties.id)
  )
    properties.id = node.properties.id;
  if (typeof node.properties.ariaDescribedBy === 'string')
    properties['aria-describedby'] = node.properties.ariaDescribedBy;
  if (node.tag_name === 'section' && node.properties.dataFootnotes)
    properties['aria-label'] = 'Footnotes';
  if (heading) {
    properties.id =
      typeof node.properties.id === 'string' ? node.properties.id : undefined;
    properties.tabIndex = -1;
  }
  if (node.tag_name === 'ol' && typeof node.properties.start === 'number')
    properties.start = node.properties.start;
  if ((node.tag_name === 'td' || node.tag_name === 'th') && typeof node.properties.align === 'string')
    properties.align = node.properties.align;
  if (node.tag_name === 'input') {
    return (
      <input
        type="checkbox"
        checked={Boolean(node.properties.checked)}
        disabled
        readOnly
        aria-label={node.properties.checked ? 'Completed task' : 'Incomplete task'}
      />
    );
  }
  return createElement(node.tag_name, properties, children);
}

const initialMarkdownState = (session: ShellSession): MarkdownDocumentState => {
  const eligibility = markdownEligibility(session.text_document?.source_bytes ?? 0);
  return {
    mode: eligibility === 'full' ? 'rendered' : 'source',
    eligibility,
    render_revision: null,
    render_status: eligibility === 'full' ? 'idle' : 'limited',
    source_selection: null,
  };
};

export const MarkdownSurface = forwardRef<
  TextEditorHandle,
  MarkdownSurfaceProps
>(function MarkdownSurface(
  {
    session,
    onDocumentChange,
    onLanguageChange,
    onMarkdownChange,
    rendererClient,
    externalLinkGateway = unavailableMarkdownExternalLinkGateway,
    localAssetGateway = unavailableMarkdownLocalAssetGateway,
  },
  handleRef,
) {
  const ownedClient = useRef<MarkdownRendererClient | null>(null);
  if (!ownedClient.current)
    ownedClient.current = rendererClient ?? new MarkdownRendererClient();
  const client = ownedClient.current;
  const editorRef = useRef<TextEditorHandle>(null);
  const linkTriggerRef = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState(
    session.markdown_document?.mode ?? initialMarkdownState(session).mode,
  );
  const [result, setResult] = useState<MarkdownRenderResult | null>(null);
  const [status, setStatus] = useState<MarkdownDocumentState['render_status']>(
    session.markdown_document?.render_status ?? 'idle',
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState<number | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [sourceSelection, setSourceSelection] = useState<SourceRange | null>(
    null,
  );
  const [pendingLink, setPendingLink] = useState<LinkCandidate | null>(null);
  const [linkOpening, setLinkOpening] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [localLinkError, setLocalLinkError] = useState('');
  const modeRef = useRef(mode);
  const sourceSelectionRef = useRef(sourceSelection);
  const onMarkdownChangeRef = useRef(onMarkdownChange);
  const textDocument = session.text_document!;
  const eligibility = markdownEligibility(textDocument.source_bytes);
  const canModify =
    session.renderer.capabilities.edit &&
    (session.source.capabilities.write || session.integrity === 'recovery_only');

  modeRef.current = mode;
  sourceSelectionRef.current = sourceSelection;
  onMarkdownChangeRef.current = onMarkdownChange;

  useEffect(() => {
    setMode(
      session.markdown_document?.mode ??
        (eligibility === 'full' ? 'rendered' : 'source'),
    );
  }, [eligibility, session.id, session.markdown_document?.mode]);

  useEffect(() => {
    if (eligibility !== 'full') {
      client.suspend();
      setStatus('limited');
      setResult(null);
      onMarkdownChangeRef.current(session.id, session.revision, {
        mode: 'source',
        eligibility,
        render_revision: null,
        render_status: 'limited',
        source_selection: null,
      });
      return;
    }
    setStatus('scheduled');
    void client
      .render({
        session_id: session.id,
        source_revision: session.revision,
        source_text: textDocument.normalized_text,
      })
      .then((next) => {
        if (!next) return;
        setResult(next);
        const nextStatus = next.status;
        setStatus(nextStatus);
        const selection = sourceSelectionRef.current;
        onMarkdownChangeRef.current(session.id, session.revision, {
          mode: modeRef.current,
          eligibility,
          render_revision: next.source_revision,
          render_status: nextStatus,
          source_selection: selection
            ? { from: selection.start_offset, to: selection.end_offset }
            : null,
        });
      });
    return () => client.cancel();
  }, [
    client,
    eligibility,
    session.id,
    session.revision,
    textDocument.normalized_text,
  ]);

  useEffect(
    () => () => {
      ownedClient.current?.dispose();
      ownedClient.current = null;
    },
    [],
  );

  useEffect(() => {
    if (mode !== 'source' || !sourceSelection) return;
    const timer = setTimeout(() => {
      editorRef.current?.selectRange(
        sourceSelection.start_offset,
        sourceSelection.end_offset,
      );
    });
    return () => clearTimeout(timer);
  }, [mode, sourceSelection]);

  const matches = useMemo(
    () => findRenderedMatches(result?.search_text ?? [], query),
    [query, result?.search_text],
  );
  const activeNodeId =
    activeMatch === null ? null : (matches[activeMatch]?.node_id ?? null);

  useEffect(() => {
    setActiveMatch(matches.length > 0 ? 0 : null);
  }, [matches]);

  useEffect(() => {
    if (!activeNodeId) return;
    const target = document.querySelector<HTMLElement>(
      `[data-markdown-node="${activeNodeId}"]`,
    );
    target?.scrollIntoView?.({ block: 'center' });
  }, [activeNodeId]);

  const publishMode = (
    nextMode: 'rendered' | 'source',
    nextSelection = sourceSelection,
  ) => {
    if (nextMode === 'rendered' && eligibility !== 'full') return;
    setMode(nextMode);
    onMarkdownChange(session.id, session.revision, {
      mode: nextMode,
      eligibility,
      render_revision: result?.source_revision ?? null,
      render_status: status,
      source_selection: nextSelection
        ? { from: nextSelection.start_offset, to: nextSelection.end_offset }
        : null,
    });
  };

  const enterSourceMode = () => {
    const nextSelection =
      activeMatch === null
        ? sourceSelection
        : (matches[activeMatch]?.source_range ?? sourceSelection);
    setSourceSelection(nextSelection);
    publishMode('source', nextSelection);
  };

  const enterMermaidSource = (range: SourceRange | null) => {
    setSourceSelection(range);
    publishMode('source', range);
  };

  const moveMatch = (offset: -1 | 1): boolean => {
    if (matches.length === 0) return false;
    setActiveMatch((current) => {
      const index = current ?? (offset > 0 ? -1 : 0);
      return (index + offset + matches.length) % matches.length;
    });
    return true;
  };

  useImperativeHandle(handleRef, () => ({
    invoke(command: CommandId) {
      if (mode === 'source') {
        if (command === 'edit' && eligibility === 'full') {
          publishMode('rendered');
          return true;
        }
        return editorRef.current?.invoke(command) ?? false;
      }
      if (command === 'edit') {
        enterSourceMode();
        return true;
      }
      if (command === 'search') {
        setSearchOpen(true);
        return true;
      }
      if (command === 'find_next') return moveMatch(1);
      if (command === 'find_previous') return moveMatch(-1);
      if (command === 'close_search') {
        setSearchOpen(false);
        return true;
      }
      if (command === 'go_to_line') {
        publishMode('source');
        return true;
      }
      if (command === 'copy') {
        void navigator.clipboard?.writeText(
          result?.search_text.map(({ text }) => text).join('\n') ?? '',
        );
        return true;
      }
      return false;
    },
    selectRange(from, to) {
      setSourceSelection({
        start_offset: from,
        end_offset: to,
        start_line: 1,
        end_line: 1,
      });
      publishMode('source');
      return true;
    },
  }));

  const selectHeading = (range: SourceRange | null, nodeId: string) => {
    setSourceSelection(range);
    const target = document.querySelector<HTMLElement>(
      `[data-markdown-node="${nodeId}"]`,
    );
    target?.scrollIntoView?.({ block: 'start' });
    target?.focus();
    setOutlineOpen(false);
  };

  const beginLink = (candidate: LinkCandidate, trigger: HTMLElement) => {
    linkTriggerRef.current = trigger;
    setLinkError('');
    setLinkOpening(false);
    setPendingLink(candidate);
  };

  const closeLink = () => {
    setPendingLink(null);
    setLinkError('');
    setLinkOpening(false);
    requestAnimationFrame(() => linkTriggerRef.current?.focus());
  };

  const openLocalLink = (candidate: LinkCandidate) => {
    if (!candidate.normalized_target || !localAssetGateway.openDocument) return;
    setLocalLinkError('');
    void localAssetGateway
      .openDocument(session.source, candidate.normalized_target)
      .catch(() =>
        setLocalLinkError('The local document could not be opened.'),
      );
  };

  if (mode === 'source' || eligibility !== 'full') {
    return (
      <div className="markdown-surface markdown-source-mode">
        <div className="markdown-controls" aria-label="Markdown controls">
          <button
            type="button"
            onClick={() => publishMode('rendered')}
            disabled={eligibility !== 'full'}
          >
            Preview
          </button>
          <button type="button" onClick={() => window.print()} disabled={!result?.tree}>
            Print
          </button>
          {eligibility !== 'full' && (
            <span role="status">Live preview is unavailable above 16 MiB.</span>
          )}
        </div>
        <div className="markdown-source-editor">
          <TextEditorSurface
            ref={editorRef}
            session={session}
            onDocumentChange={onDocumentChange}
            onLanguageChange={onLanguageChange}
          />
        </div>
        {result?.tree && (
          <article className="markdown-document markdown-print-document">
            <SafeTree node={result.tree} session={session} activeNodeId={null} onLink={beginLink} onLocalLink={openLocalLink} localAssetGateway={localAssetGateway} onMermaidSource={enterMermaidSource} />
          </article>
        )}
      </div>
    );
  }

  return (
    <div className="markdown-surface">
      <div className="markdown-controls" aria-label="Markdown controls">
        <button type="button" onClick={enterSourceMode}>
          {canModify ? 'Edit' : 'View source'}
        </button>
        <button
          type="button"
          aria-expanded={outlineOpen}
          onClick={() => setOutlineOpen((open) => !open)}
          disabled={!result?.outline.length}
        >
          Outline
        </button>
        <button type="button" onClick={() => setSearchOpen((open) => !open)}>
          Search
        </button>
        <button type="button" onClick={() => window.print()} disabled={!result?.tree}>
          Print
        </button>
        <span className="markdown-render-status" aria-live="polite">
          {status === 'scheduled' || status === 'rendering'
            ? 'Rendering preview'
            : status === 'ready'
              ? 'Preview current'
              : status === 'empty'
                ? 'Empty document'
                : status === 'failed'
                  ? 'Preview failed safely'
                  : status}
        </span>
      </div>
      {outlineOpen && result && (
        <nav className="markdown-outline" aria-label="Document outline">
          <ol>
            {result.outline.map((heading) => (
              <li key={heading.id} data-level={heading.level}>
                <button
                  type="button"
                  onClick={() => selectHeading(heading.source_range, heading.node_id)}
                >
                  {heading.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {searchOpen && (
        <div className="markdown-search" role="search">
          <label>
            Find rendered text
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <span aria-live="polite">
            {matches.length === 0
              ? 'No matches'
              : `${(activeMatch ?? 0) + 1} of ${matches.length}`}
          </span>
          <button type="button" onClick={() => moveMatch(-1)} disabled={!matches.length}>
            Previous
          </button>
          <button type="button" onClick={() => moveMatch(1)} disabled={!matches.length}>
            Next
          </button>
          <button type="button" onClick={() => setSearchOpen(false)}>
            Close search
          </button>
        </div>
      )}
      <article className="markdown-document" aria-busy={status === 'scheduled'}>
        {result?.tree ? (
          <SafeTree
            node={result.tree}
            session={session}
            activeNodeId={activeNodeId}
            onLink={beginLink}
            onLocalLink={openLocalLink}
            localAssetGateway={localAssetGateway}
            onMermaidSource={enterMermaidSource}
          />
        ) : status === 'failed' ? (
          <p role="alert">Markdown preview failed safely. Source remains available.</p>
        ) : status === 'empty' ? (
          <p>This document is empty.</p>
        ) : (
          <pre className="markdown-pending-source" aria-label="Markdown source while preview renders">{textDocument.normalized_text}</pre>
        )}
      </article>
      {localLinkError && <p role="alert">{localLinkError}</p>}
      {pendingLink?.normalized_target && (
        <div className="resolution-backdrop" role="presentation">
          <section
            className="resolution-dialog markdown-link-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="markdown-link-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeLink();
            }}
          >
            <h2 id="markdown-link-title">Open external destination?</h2>
            <p className="markdown-link-destination">
              {pendingLink.display_target}
            </p>
            <p>The destination will open in your system application.</p>
            {linkError && <p role="alert">{linkError}</p>}
            <div className="resolution-actions">
              <button
                type="button"
                disabled={linkOpening}
                onClick={() => {
                  if (linkOpening) return;
                  const target = pendingLink.normalized_target!;
                  setLinkOpening(true);
                  void externalLinkGateway
                    .open(target)
                    .then(closeLink)
                    .catch(() => {
                      setLinkOpening(false);
                      setLinkError(
                        'The destination could not be opened. The document remains available.',
                      );
                    });
                }}
              >
                {linkOpening ? 'Opening destination' : 'Open destination'}
              </button>
              <button type="button" onClick={closeLink} autoFocus>
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
});
