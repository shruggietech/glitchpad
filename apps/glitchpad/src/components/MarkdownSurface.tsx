import { consumeRecoveryProbe } from '../domain/recovery-probes';
import {
  createElement,
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import {
  reportRecoveryFailure,
  type RecoveryFailureReporter,
} from '../bootstrap-recovery';
import type { CommandId, EditorCommandState } from '../domain/commands';
import type {
  LanguageDecision,
  MarkdownDocumentState,
  ShellSession,
  TextDocumentState,
} from '../domain/contracts';
import {
  MARKDOWN_SANITIZER_VERSION,
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
import { rendererResourceLedger } from '../domain/resource-ledger';
import { EmbeddedMermaidSurface } from './EmbeddedMermaidSurface';
import {
  rendererContribution,
  type MetadataContribution,
  type MetadataObservation,
} from '../domain/metadata';
import { TextEditorSurface, type TextEditorHandle } from './TextEditorSurface';
import { TaskSurface } from './TaskSurface';
import './DocumentTools.css';

interface MarkdownSurfaceProps {
  onCommandStateChange?: (state: EditorCommandState) => void;
  session: ShellSession;
  onFailure?: RecoveryFailureReporter;
  projectionSuppressed?: boolean;
  recoveryAttempt?: number;
  lifecycleFailureProbe?: boolean;
  onEnterRecoverySource?: () => void;
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
  onOpenMetadata?: (opener: HTMLElement) => void;
  onMetadataContribution?: (contribution: MetadataContribution) => void;
}

const scrollWithinArticle = (
  content: HTMLElement | null,
  target: HTMLElement | null | undefined,
  center = false,
) => {
  if (!content || !target || !content.contains(target)) return;
  const box = content.getBoundingClientRect();
  const destination = target.getBoundingClientRect();
  content.scrollTop = Math.max(
    0,
    content.scrollTop +
      destination.top -
      box.top -
      (center ? (content.clientHeight - destination.height) / 2 : 0),
  );
};
interface SafeTreeProps {
  node: SafeRenderedNode;
  session: ShellSession;
  activeNodeId: string | null;
  onLink: (candidate: LinkCandidate, trigger: HTMLElement) => void;
  onLocalLink: (candidate: LinkCandidate) => void;
  localAssetGateway: MarkdownLocalAssetGateway;
  onMermaidSource: (range: SourceRange | null) => void;
  onFragmentNavigation?: (nodeId: string, found: boolean) => void;
  unavailableFragmentId?: string | null;
}

function LifecycleMarkdownFailure(): null {
  throw new Error('Lifecycle Markdown preview failure probe');
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
    return (
      <img
        src={currentAsset}
        alt={resource.alt}
        className="markdown-local-image"
      />
    );
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
  onFragmentNavigation,
  unavailableFragmentId,
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
        onFragmentNavigation={onFragmentNavigation}
        unavailableFragmentId={unavailableFragmentId}
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
  const forbidsWhitespaceChildren = [
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
  ].includes(node.tag_name);
  const children = node.children
    .filter(
      (child) =>
        !(
          forbidsWhitespaceChildren &&
          child.type === 'text' &&
          child.value.trim() === ''
        ),
    )
    .map((child) => (
      <SafeTree
        key={child.id}
        node={child}
        session={session}
        activeNodeId={activeNodeId}
        onLink={onLink}
        onLocalLink={onLocalLink}
        localAssetGateway={localAssetGateway}
        onMermaidSource={onMermaidSource}
        onFragmentNavigation={onFragmentNavigation}
        unavailableFragmentId={unavailableFragmentId}
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
      const activate = (trigger: HTMLElement) => {
        const content = trigger.closest<HTMLElement>('.markdown-document');
        const target = Array.from(
          content?.querySelectorAll<HTMLElement>('[id]') ?? [],
        ).find(
          (element) => element.id === candidate.normalized_target!.slice(1),
        );
        onFragmentNavigation?.(node.id, Boolean(target));
        if (!target) return;
        if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
        scrollWithinArticle(content, target);
        target.focus({ preventScroll: true });
      };
      return (
        <>
          <span
            id={
              typeof node.properties.id === 'string' &&
              /^user-content-[a-z0-9_-]+$/iu.test(node.properties.id)
                ? node.properties.id
                : undefined
            }
            className="markdown-link"
            role="link"
            aria-label={
              typeof node.properties.ariaLabel === 'string'
                ? node.properties.ariaLabel
                : node.properties.dataFootnoteBackref
                  ? 'Return to footnote reference'
                  : node.properties.dataFootnoteRef
                    ? 'Footnote reference'
                    : undefined
            }
            tabIndex={0}
            title={candidate.display_target}
            aria-describedby={
              typeof node.properties.ariaDescribedBy === 'string'
                ? node.properties.ariaDescribedBy
                : undefined
            }
            data-footnote-ref={
              Object.prototype.hasOwnProperty.call(
                node.properties,
                'dataFootnoteRef',
              )
                ? ''
                : undefined
            }
            data-footnote-backref={
              Object.prototype.hasOwnProperty.call(
                node.properties,
                'dataFootnoteBackref',
              )
                ? ''
                : undefined
            }
            onClick={(event) => activate(event.currentTarget)}
            onKeyDown={(event) =>
              activateOnKeyboard(event, () => activate(event.currentTarget))
            }
          >
            {children}
          </span>
          {unavailableFragmentId === node.id && (
            <span className="markdown-fragment-feedback" role="alert">
              The linked section is not available in this document.
            </span>
          )}
        </>
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
      [
        safeClassName(node.properties.className),
        activeNodeId === node.id ? 'markdown-search-match' : undefined,
      ]
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
  if (
    (node.tag_name === 'td' || node.tag_name === 'th') &&
    typeof node.properties.align === 'string'
  )
    properties.align = node.properties.align;
  if (node.tag_name === 'input') {
    return (
      <input
        type="checkbox"
        checked={Boolean(node.properties.checked)}
        disabled
        readOnly
        aria-label={
          node.properties.checked ? 'Completed task' : 'Incomplete task'
        }
      />
    );
  }
  return createElement(node.tag_name, properties, children);
}

const initialMarkdownState = (session: ShellSession): MarkdownDocumentState => {
  const eligibility = markdownEligibility(
    session.text_document?.source_bytes ?? 0,
  );
  return {
    mode: eligibility === 'full' ? 'rendered' : 'source',
    eligibility,
    render_revision: null,
    render_status: eligibility === 'full' ? 'idle' : 'limited',
    printable: false,
    outline_count: 0,
    source_selection: null,
  };
};

export const MarkdownSurface = forwardRef<
  TextEditorHandle,
  MarkdownSurfaceProps
>(function MarkdownSurface(
  {
    session,
    onFailure,
    projectionSuppressed = false,
    recoveryAttempt = 0,
    lifecycleFailureProbe = false,
    onEnterRecoverySource,
    onDocumentChange,
    onLanguageChange,
    onMarkdownChange,
    rendererClient,
    externalLinkGateway = unavailableMarkdownExternalLinkGateway,
    localAssetGateway = unavailableMarkdownLocalAssetGateway,
    onMetadataContribution,
    onCommandStateChange,
  },
  handleRef,
) {
  const performanceInstanceId = useId();
  const ownedClient = useRef<MarkdownRendererClient | null>(null);
  const ownsClient = useRef(rendererClient === undefined);
  const lifecycleGeneration = useRef(0);
  const renderGeneration = useRef(0);
  if (!ownedClient.current)
    ownedClient.current =
      rendererClient ??
      new MarkdownRendererClient(
        undefined,
        undefined,
        undefined,
        rendererResourceLedger.register(
          `markdown:${session.id}:${performanceInstanceId}`,
          textDocumentBytes(session),
        ),
      );
  const client = ownedClient.current;
  const editorRef = useRef<TextEditorHandle>(null);
  const renderedContentRef = useRef<HTMLElement>(null);
  const linkTriggerRef = useRef<HTMLElement | null>(null);
  const outlineTargetRef = useRef<HTMLElement | null>(null);
  const projectedMode =
    session.markdown_document?.mode ?? initialMarkdownState(session).mode;
  const [modeState, setModeState] = useState(() => ({
    sessionId: session.id,
    projectedMode,
    localMode: projectedMode,
  }));
  const [result, setResult] = useState<MarkdownRenderResult | null>(null);
  const [status, setStatus] = useState<MarkdownDocumentState['render_status']>(
    session.markdown_document?.render_status ?? 'idle',
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [sourceVisited, setSourceVisited] = useState(
    projectedMode === 'source',
  );
  const commandCallback = useRef(onCommandStateChange);
  commandCallback.current = onCommandStateChange;
  const sourceActionGeneration = useRef(0);
  const linkOperation = useRef(0);
  const linkPending = useRef(false);
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
  const [fragmentNotice, setFragmentNotice] = useState<{
    sessionId: string;
    revision: number;
    nodeId: string;
  } | null>(null);
  const unavailableFragmentId =
    fragmentNotice?.sessionId === session.id &&
    fragmentNotice.revision === session.revision
      ? fragmentNotice.nodeId
      : null;
  const fragmentNavigation = (nodeId: string, found: boolean) =>
    setFragmentNotice(
      found
        ? null
        : { sessionId: session.id, revision: session.revision, nodeId },
    );
  const modeRef = useRef(projectedMode);
  const sourceSelectionRef = useRef(sourceSelection);
  const selectionPending = useRef(false);
  const onMarkdownChangeRef = useRef(onMarkdownChange);
  const onFailureRef = useRef(onFailure);
  onFailureRef.current = onFailure;
  const textDocument = session.text_document!;
  const eligibility = markdownEligibility(textDocument.source_bytes);
  const currentResult =
    result?.session_id === session.id &&
    result.source_revision === session.revision
      ? result
      : null;
  const synchronizedMode =
    modeState.sessionId === session.id &&
    modeState.projectedMode === projectedMode
      ? modeState.localMode
      : projectedMode;
  const mode = projectionSuppressed ? 'source' : synchronizedMode;
  modeRef.current = mode;
  useEffect(() => {
    if (mode === 'source') {
      setSourceVisited(true);
      commandCallback.current?.(
        editorRef.current?.commandState?.() ?? {
          undo: false,
          redo: false,
          wrapped: false,
        },
      );
    } else
      commandCallback.current?.({ undo: false, redo: false, wrapped: false });
  }, [mode]);
  useEffect(
    () => () => {
      sourceActionGeneration.current += 1;
      linkOperation.current += 1;
    },
    [session.id, session.lifecycle],
  );
  const closeSearch = () => {
    setSearchOpen(false);
    requestAnimationFrame(() =>
      renderedContentRef.current?.focus({ preventScroll: true }),
    );
  };
  sourceSelectionRef.current = sourceSelection;
  onMarkdownChangeRef.current = onMarkdownChange;

  useEffect(() => {
    setModeState({
      sessionId: session.id,
      projectedMode,
      localMode: projectedMode,
    });
  }, [projectedMode, session.id]);

  useEffect(() => {
    const generation = ++renderGeneration.current;
    if (eligibility !== 'full') {
      client.suspend();
      setStatus('limited');
      setResult(null);
      onMarkdownChangeRef.current(session.id, session.revision, {
        mode: 'source',
        eligibility,
        render_revision: null,
        render_status: 'limited',
        printable: false,
        outline_count: 0,
        source_selection: null,
      });
      return;
    }
    setResult(null);
    setStatus('scheduled');
    void Promise.resolve()
      .then(() =>
        client.render({
          session_id: session.id,
          source_revision: session.revision,
          source_text: textDocument.normalized_text,
        }),
      )
      .then((next) => {
        if (
          !next ||
          renderGeneration.current !== generation ||
          next.session_id !== session.id ||
          next.source_revision !== session.revision
        )
          return;
        if (consumeRecoveryProbe('projection'))
          throw new Error('injected_projection_failure');
        setResult(next);
        const nextStatus = next.status;
        if (nextStatus === 'failed') {
          const reason = next.diagnostics[0]?.code ?? 'markdown_parse_failed';
          const stage =
            reason === 'markdown_worker_failed' ||
            reason === 'markdown_render_timeout'
              ? 'worker'
              : reason === 'markdown_projection_invalid'
                ? 'projection'
                : 'parse';
          reportRecoveryFailure(
            onFailureRef.current,
            'markdown',
            stage,
            reason,
          );
        }
        setStatus(nextStatus);
        const selection = sourceSelectionRef.current;
        onMarkdownChangeRef.current(session.id, session.revision, {
          mode: modeRef.current,
          eligibility,
          render_revision: next.source_revision,
          render_status: nextStatus,
          printable: Boolean(next.tree),
          outline_count: next.outline.length,
          source_selection: selection
            ? { from: selection.start_offset, to: selection.end_offset }
            : null,
        });
        onMetadataContribution?.(
          rendererContribution(
            session,
            markdownMetadataFacts(next),
            next.source_revision,
          ),
        );
      })
      .catch(() => {
        if (renderGeneration.current !== generation) return;
        const failure: MarkdownRenderResult = {
          request_id: 'projection-failure',
          session_id: session.id,
          source_revision: session.revision,
          sanitizer_version: MARKDOWN_SANITIZER_VERSION,
          status: 'failed',
          tree: null,
          outline: [],
          search_text: [],
          diagnostics: [
            {
              code: 'markdown_projection_failed',
              message: 'Markdown projection failed. Source remains available.',
            },
          ],
          measurements: {
            source_bytes: textDocument.source_bytes,
            parse_duration_ms: 0,
            node_count: 0,
            heading_count: 0,
            search_entry_count: 0,
          },
        };
        setResult(failure);
        setStatus('failed');
        reportRecoveryFailure(
          onFailureRef.current,
          'markdown',
          'projection',
          'markdown_projection_failed',
        );
        try {
          onMarkdownChangeRef.current(session.id, session.revision, {
            mode: modeRef.current,
            eligibility,
            render_revision: null,
            render_status: 'failed',
            printable: false,
            outline_count: 0,
            source_selection: null,
          });
        } catch {
          /* Keep the local source fallback available even if shell projection fails. */
        }
      });
    return () => {
      client.cancel();
      if (renderGeneration.current === generation)
        renderGeneration.current += 1;
    };
  }, [
    client,
    eligibility,
    recoveryAttempt,
    session.id,
    session.revision,
    textDocument.normalized_text,
  ]);

  useEffect(() => {
    const generation = ++lifecycleGeneration.current;
    return () => {
      void Promise.resolve().then(() => {
        if (ownsClient.current && lifecycleGeneration.current === generation) {
          ownedClient.current?.dispose();
          ownedClient.current = null;
        }
      });
    };
  }, []);

  useEffect(() => {
    if (mode !== 'source' || !sourceSelection || !selectionPending.current)
      return;
    const timer = setTimeout(() => {
      if (modeRef.current !== 'source' || !selectionPending.current) return;
      selectionPending.current = false;
      editorRef.current?.selectRange(
        sourceSelection.start_offset,
        sourceSelection.end_offset,
      );
    });
    return () => clearTimeout(timer);
  }, [mode, sourceSelection]);

  const matches = useMemo(
    () => findRenderedMatches(currentResult?.search_text ?? [], query),
    [query, currentResult?.search_text],
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
    scrollWithinArticle(renderedContentRef.current, target, true);
  }, [activeNodeId]);

  const publishMode = (
    nextMode: 'rendered' | 'source',
    nextSelection = sourceSelection,
  ) => {
    if (nextMode === 'rendered' && eligibility !== 'full') return;
    if (nextMode === 'rendered') selectionPending.current = false;
    setModeState({
      sessionId: session.id,
      projectedMode,
      localMode: nextMode,
    });
    onMarkdownChange(session.id, session.revision, {
      mode: nextMode,
      eligibility,
      render_revision: currentResult?.source_revision ?? null,
      render_status: status,
      printable: Boolean(currentResult?.tree),
      outline_count: currentResult?.outline.length ?? 0,
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
    selectionPending.current = activeMatch !== null;
    setSourceSelection(nextSelection);
    publishMode('source', nextSelection);
  };

  const enterMermaidSource = (range: SourceRange | null) => {
    selectionPending.current = mode !== 'source';
    if (mode === 'source' && range)
      editorRef.current?.selectRange(range.start_offset, range.end_offset);
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
    invoke(command: CommandId, opener?: HTMLElement) {
      if (session.lifecycle !== 'active') return false;
      if (command === 'outline') {
        outlineTargetRef.current = renderedContentRef.current;
        setOutlineOpen((open) => !open);
        return true;
      }
      if (command === 'print') {
        window.print();
        return true;
      }
      if (mode === 'source') {
        if (command === 'edit' && eligibility === 'full') {
          publishMode('rendered');
          return true;
        }
        return editorRef.current?.invoke(command, opener) ?? false;
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
        closeSearch();
        return true;
      }
      if (command === 'go_to_line') {
        publishMode('source');
        const expected = sourceActionGeneration.current;
        return new Promise<boolean>((resolve) =>
          requestAnimationFrame(() => {
            if (
              sourceActionGeneration.current !== expected ||
              modeRef.current !== 'source'
            ) {
              resolve(false);
              return;
            }
            resolve(editorRef.current?.invoke('go_to_line') ?? false);
          }),
        );
      }
      if (command === 'copy') {
        if (!navigator.clipboard) return false;
        const selection = window.getSelection();
        const content = renderedContentRef.current;
        const selectedText =
          session.lifecycle === 'active' &&
          currentResult?.tree &&
          content &&
          selection &&
          selection.rangeCount > 0 &&
          Array.from({ length: selection.rangeCount }, (_, index) =>
            selection.getRangeAt(index),
          ).every(
            (range) =>
              content.contains(range.startContainer) &&
              content.contains(range.endContainer),
          )
            ? selection.toString()
            : '';
        return navigator.clipboard
          .writeText(
            selectedText ||
              currentResult?.search_text.map(({ text }) => text).join('\n') ||
              '',
          )
          .then(() => true);
      }
      return false;
    },
    commandState() {
      return mode === 'source'
        ? (editorRef.current?.commandState?.() ?? {
            undo: false,
            redo: false,
            wrapped: false,
          })
        : { undo: false, redo: false, wrapped: false };
    },
    dismissModal() {
      if (session.lifecycle !== 'active') return false;
      if (mode === 'source')
        return editorRef.current?.dismissModal?.() ?? false;
      if (pendingLink?.normalized_target) {
        closeLink();
        return true;
      }
      if (outlineOpen) {
        setOutlineOpen(false);
        requestAnimationFrame(() =>
          renderedContentRef.current?.focus({ preventScroll: true }),
        );
        return true;
      }
      return false;
    },
    selectRange(from, to) {
      selectionPending.current = mode !== 'source';
      if (mode === 'source') editorRef.current?.selectRange(from, to);
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
    const target =
      renderedContentRef.current?.querySelector<HTMLElement>(
        `[data-markdown-node="${nodeId}"]`,
      ) ?? null;
    scrollWithinArticle(renderedContentRef.current, target);
    outlineTargetRef.current = target;
    target?.focus({ preventScroll: true });
    setOutlineOpen(false);
  };

  const beginLink = (candidate: LinkCandidate, trigger: HTMLElement) => {
    linkTriggerRef.current = trigger;
    setLinkError('');
    setLinkOpening(false);
    linkOperation.current += 1;
    linkPending.current = false;
    setPendingLink(candidate);
  };

  const closeLink = () => {
    linkOperation.current += 1;
    linkPending.current = false;
    setPendingLink(null);
    setLinkError('');
    setLinkOpening(false);
    requestAnimationFrame(() =>
      linkTriggerRef.current?.focus({ preventScroll: true }),
    );
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

  const sourceView = (
    <div
      className="markdown-surface markdown-source-mode"
      hidden={mode !== 'source' && eligibility === 'full'}
    >
      {eligibility !== 'full' && (
        <span className="visually-hidden" role="status">
          Live preview is unavailable above 16 MiB.
        </span>
      )}
      <div className="markdown-source-editor">
        <TextEditorSurface
          ref={editorRef}
          session={session}
          onDocumentChange={onDocumentChange}
          onLanguageChange={onLanguageChange}
          onCommandStateChange={(next) => {
            if (mode === 'source') commandCallback.current?.(next);
          }}
        />
      </div>
      {mode === 'source' && !projectionSuppressed && currentResult?.tree && (
        <article className="markdown-document markdown-print-document">
          <SafeTree
            node={currentResult.tree}
            session={session}
            activeNodeId={null}
            onLink={beginLink}
            onLocalLink={openLocalLink}
            localAssetGateway={localAssetGateway}
            onMermaidSource={enterMermaidSource}
          />
        </article>
      )}
    </div>
  );

  return (
    <>
      {(mode === 'source' || sourceVisited || eligibility !== 'full') &&
        sourceView}
      {!projectionSuppressed && (
        <div
          className="markdown-surface markdown-rendered-mode"
          hidden={mode === 'source' || eligibility !== 'full'}
        >
          {lifecycleFailureProbe && recoveryAttempt === 0 && (
            <LifecycleMarkdownFailure />
          )}
          <span className="visually-hidden" aria-live="polite">
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
          <TaskSurface
            open={mode === 'rendered' && outlineOpen && Boolean(currentResult)}
            onOpenChange={setOutlineOpen}
            title="Document outline"
            className="markdown-outline-task document-tools"
            opener={outlineTargetRef.current ?? renderedContentRef.current}
          >
            <nav className="markdown-outline" aria-label="Document outline">
              <ol>
                {currentResult?.outline.map((heading) => (
                  <li key={heading.id} data-level={heading.level}>
                    <button
                      type="button"
                      onClick={() =>
                        selectHeading(heading.source_range, heading.node_id)
                      }
                    >
                      {heading.label}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </TaskSurface>
          <TaskSurface
            open={searchOpen && mode === 'rendered'}
            onOpenChange={(open) => {
              if (!open) closeSearch();
            }}
            title="Find in Markdown"
            opener={renderedContentRef.current}
            className="markdown-search-task document-tools"
          >
            <div className="markdown-search" role="search">
              <label>
                Find rendered text
                <input
                  data-task-initial-focus
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <span
                role="status"
                aria-label="Rendered search results"
                aria-live="polite"
              >
                {!query
                  ? 'Enter search text'
                  : matches.length === 0
                    ? 'No matches'
                    : `${(activeMatch ?? 0) + 1} of ${matches.length}`}
              </span>
              <button
                type="button"
                onClick={() => moveMatch(-1)}
                disabled={!matches.length}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => moveMatch(1)}
                disabled={!matches.length}
              >
                Next
              </button>
              <button type="button" onClick={closeSearch}>
                Close search
              </button>
            </div>
          </TaskSurface>
          <article
            ref={renderedContentRef}
            tabIndex={-1}
            className="markdown-document"
            aria-busy={status === 'scheduled'}
            data-performance-ready={currentResult?.tree ? 'true' : 'pending'}
            data-performance-status={currentResult?.status ?? status}
            data-performance-duration={
              currentResult?.measurements.parse_duration_ms ?? ''
            }
            data-performance-diagnostic={
              currentResult?.diagnostics[0]?.code ?? ''
            }
          >
            {currentResult?.tree && status !== 'empty' ? (
              <SafeTree
                node={currentResult.tree}
                session={session}
                activeNodeId={activeNodeId}
                onLink={beginLink}
                onLocalLink={openLocalLink}
                localAssetGateway={localAssetGateway}
                onMermaidSource={enterMermaidSource}
                onFragmentNavigation={fragmentNavigation}
                unavailableFragmentId={unavailableFragmentId}
              />
            ) : status === 'failed' || status === 'limited' ? (
              <div className="markdown-failure">
                <p role="alert">
                  {currentResult?.diagnostics[0]?.message ??
                    'Markdown preview failed safely. Source remains available.'}
                </p>
                <button
                  type="button"
                  onClick={onEnterRecoverySource ?? enterSourceMode}
                >
                  View source
                </button>
              </div>
            ) : status === 'empty' ? (
              <p>This document is empty.</p>
            ) : (
              <p className="markdown-pending" aria-hidden="true">
                Rendering preview
              </p>
            )}
          </article>
          {localLinkError && <p role="alert">{localLinkError}</p>}
          <TaskSurface
            open={
              mode === 'rendered' && Boolean(pendingLink?.normalized_target)
            }
            onOpenChange={(open) => {
              if (!open) closeLink();
            }}
            title="Open external destination?"
            className="markdown-link-task document-tools"
            opener={linkTriggerRef.current}
          >
            <p className="markdown-link-destination">
              {pendingLink?.display_target}
            </p>
            <p>The destination will open in your system application.</p>
            {linkError && <p role="alert">{linkError}</p>}
            <div className="resolution-actions">
              <button
                type="button"
                disabled={linkOpening}
                onClick={() => {
                  const target = pendingLink?.normalized_target;
                  if (!target || linkPending.current) return;
                  linkPending.current = true;
                  const operation = ++linkOperation.current;
                  setLinkOpening(true);
                  void externalLinkGateway
                    .open(target)
                    .then(() => {
                      if (operation === linkOperation.current) closeLink();
                    })
                    .catch(() => {
                      if (operation !== linkOperation.current) return;
                      linkPending.current = false;
                      setLinkOpening(false);
                      setLinkError(
                        'The destination could not be opened. The document remains available.',
                      );
                    });
                }}
              >
                {linkOpening ? 'Opening destination' : 'Open destination'}
              </button>
              <button type="button" onClick={closeLink} data-task-initial-focus>
                Cancel
              </button>
            </div>
          </TaskSurface>
        </div>
      )}
    </>
  );
});

const markdownMetadataFacts = (
  result: MarkdownRenderResult,
): MetadataObservation[] => [
  {
    key: 'renderer.status',
    availability: 'available',
    value: { kind: 'text', value: result.status },
  },
  {
    key: 'markdown.sanitizer_version',
    availability: 'available',
    value: { kind: 'integer', value: String(result.sanitizer_version) },
  },
  {
    key: 'markdown.source_bytes',
    availability: 'available',
    value: { kind: 'integer', value: String(result.measurements.source_bytes) },
    unit: 'bytes',
  },
  {
    key: 'markdown.node_count',
    availability: 'available',
    value: { kind: 'integer', value: String(result.measurements.node_count) },
  },
  {
    key: 'markdown.heading_count',
    availability: 'available',
    value: {
      kind: 'integer',
      value: String(result.measurements.heading_count),
    },
  },
  {
    key: 'markdown.search_entry_count',
    availability: 'available',
    value: {
      kind: 'integer',
      value: String(result.measurements.search_entry_count),
    },
  },
  {
    key: 'markdown.parse_duration',
    availability: 'available',
    value: {
      kind: 'decimal',
      value: String(result.measurements.parse_duration_ms),
    },
    unit: 'ms',
  },
];

const textDocumentBytes = (session: ShellSession): number =>
  session.text_document?.source_bytes ?? 0;
