import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { CommandBar } from './components/CommandBar';
import { DocumentSurface } from './components/DocumentSurface';
import { MetadataInspector } from './components/MetadataInspector';
import type { TextEditorHandle } from './components/TextEditorSurface';
import {
  RecoveryCandidateResolution,
  RecoveryResolution,
  type RecoveryCandidateDecision,
} from './components/RecoveryResolution';
import { TabStrip } from './components/TabStrip';
import {
  executeCommand,
  commandSetFor,
  type CommandDescriptor,
} from './domain/commands';
import {
  noRendererCapabilities,
  noSourceCapabilities,
  type ShellSession,
} from './domain/contracts';
import {
  canSaveInPlace,
  integrityOf,
  projectRecoveredSession,
} from './domain/recovery';
import {
  nativeRecoveryAvailable,
  nativeRecoveryGateway,
  type RecoveryGateway,
} from './domain/recovery-gateway';
import { createTabState, tabReducer } from './domain/tabs';
import { createTextDocument } from './domain/text-document';
import { detectLanguage } from './domain/language';
import { markdownEligibility } from './domain/markdown-contract';
import { initialMermaidViewport } from './domain/mermaid-contract';
import {
  nativeExternalLinkAvailable,
  nativeMarkdownExternalLinkGateway,
  type MarkdownExternalLinkGateway,
  type MarkdownLocalAssetGateway,
} from './domain/markdown-gateway';
import { useRecovery } from './domain/use-recovery';
import {
  browserClipboardGateway,
  createIntegrityRequestId,
  createNativeMetadataGateway,
  nativeMetadataAvailable,
  runIntegrityRequest,
  type ClipboardGateway,
  type MetadataGateway,
} from './domain/metadata-gateway';
import { projectSessionMetadata, type MetadataContribution } from './domain/metadata';

const makeSession = (
  id: string,
  name: string,
  renderer: string,
  content: string,
  capabilities: Partial<ShellSession['renderer']['capabilities']>,
  options: { dirty?: boolean; writable?: boolean; metadata?: boolean } = {},
): ShellSession => {
  const isText = renderer !== 'Image';
  const textDocument = isText
    ? createTextDocument({
        rawText: content,
        displayName: name,
        language: detectLanguage(name, content),
      })
    : null;
  const eligibility = markdownEligibility(textDocument?.source_bytes ?? 0);
  return {
    id,
    source: {
      identity: {
        authority: 'synthetic',
        scope: 'foundation-fixtures',
        token: id,
        strength: 'strong',
      },
      display_name: name,
      claimed_media_type: name.endsWith('.md')
        ? 'text/markdown'
        : /\.(?:mmd|mermaid)$/iu.test(name)
          ? 'text/vnd.mermaid'
          : 'text/plain',
      byte_length: textDocument?.source_bytes ?? content.length,
      modified_unix_ms: 1_788_044_400_000,
      kind: 'memory',
      capabilities: {
        ...noSourceCapabilities(),
        read: true,
        metadata: options.metadata ?? true,
        write: options.writable ?? false,
        observe_revision: options.writable ?? false,
        revalidate: options.writable ?? false,
        replace_atomically: options.writable ?? false,
      },
    },
    renderer: {
      id: renderer.toLowerCase(),
      label: renderer,
      capabilities: {
        ...noRendererCapabilities(),
        view: true,
        copy: true,
        inspect_metadata: true,
        ...capabilities,
      },
    },
    lifecycle: id === 'welcome' ? 'active' : 'background',
    dirty: options.dirty ?? false,
    revision: 1,
    content,
    text_document: textDocument,
    markdown_document: renderer === 'Markdown'
      ? {
          mode: eligibility === 'full' ? 'rendered' : 'source',
          eligibility,
          render_revision: null,
          render_status: eligibility === 'full' ? 'idle' : 'limited',
          source_selection: null,
        }
      : null,
    mermaid_document: renderer === 'Mermaid'
      ? {
          mode: content.trim() ? 'rendered' : 'source',
          render_revision: null,
          render_status: 'idle',
          preview_stale: false,
          viewport: initialMermaidViewport(),
        }
      : null,
  };
};

export const initialSessions: ShellSession[] = [
  makeSession(
    'welcome',
    'welcome.md',
    'Markdown',
    '# Glitchpad document foundation\n\nThe file owns the viewport.',
    { search: true },
  ),
  makeSession(
    'diagram',
    'diagram.mmd',
    'Mermaid',
    'flowchart TB\n    Source --> Session\n    Session --> Renderer',
    { search: true, zoom: true },
  ),
  makeSession(
    'notes',
    'notes.txt',
    'Text',
    'A small text fixture for tab interaction.',
    { search: true, edit: true, save: true },
    { writable: true },
  ),
  makeSession(
    'draft',
    'draft.md',
    'Markdown',
    '# Draft\n\nUnsaved fixture content.',
    { search: true, edit: true, save: true },
    { dirty: true, writable: true },
  ),
  makeSession(
    'guide',
    'guide.md',
    'Markdown',
    '# Guide\n\nCapability-driven commands.',
    { search: true },
  ),
  makeSession(
    'architecture',
    'architecture.rs',
    'Source',
    'pub struct DocumentSession;',
    { search: true },
  ),
  makeSession('image', 'preview.webp', 'Image', 'WebP preview fixture', {
    zoom: true,
    inspect_metadata: true,
  }),
];

interface AppProps {
  sessions?: ShellSession[];
  recoveryGateway?: RecoveryGateway | null;
  externalLinkGateway?: MarkdownExternalLinkGateway;
  localAssetGateway?: MarkdownLocalAssetGateway;
  metadataGateway?: MetadataGateway | null;
  clipboardGateway?: ClipboardGateway;
}

export function App({ sessions = initialSessions, recoveryGateway, externalLinkGateway, localAssetGateway, metadataGateway, clipboardGateway = browserClipboardGateway }: AppProps) {
  const [state, dispatch] = useReducer(tabReducer, sessions, createTabState);
  const [commandStatus, setCommandStatus] = useState('');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [metadataReadySessionId, setMetadataReadySessionId] = useState<string | null>(null);
  const editorRef = useRef<TextEditorHandle>(null);
  const metadataOpenerRef = useRef<HTMLElement | null>(null);
  const integrityAbortRef = useRef<AbortController | null>(null);
  const integrityRequestIdRef = useRef<string | null>(null);
  const selectedRecoveryGateway =
    recoveryGateway === undefined
      ? nativeRecoveryAvailable()
        ? nativeRecoveryGateway
        : null
      : recoveryGateway;
  const recovery = useRecovery(state.sessions, selectedRecoveryGateway);
  const recoveryCandidate = recovery.candidates[0] ?? null;
  const activeSession =
    state.sessions.find(({ id }) => id === state.activeId) ?? null;
  const selectedMetadataGateway = useMemo(
    () => metadataGateway === undefined
      ? nativeMetadataAvailable()
        ? createNativeMetadataGateway()
        : null
      : metadataGateway,
    [metadataGateway],
  );
  const commands = commandSetFor(activeSession).filter(
    ({ id }) =>
      id !== 'save' || (activeSession && canSaveInPlace(activeSession)),
  );
  const resolutionSession = state.pendingTransition
    ? (state.sessions.find(
        ({ id }) => id === state.pendingTransition?.target_session_id,
      ) ?? null)
    : null;

  useEffect(() => setCommandStatus(''), [state.activeId]);

  useEffect(() => {
    if (!inspectorOpen || !activeSession?.source_id || !selectedMetadataGateway) {
      setMetadataReadySessionId(null);
      return;
    }
    setMetadataReadySessionId(null);
    const abort = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      void selectedMetadataGateway
        .query(activeSession.source_id!, abort.signal)
        .then((source) => {
          if (!abort.signal.aborted) {
            dispatch({
              type: 'refresh_metadata',
              id: activeSession.id,
              expectedRevision: activeSession.revision,
              expectedExternalRevision: activeSession.external_revision ?? null,
              source,
            });
            setMetadataReadySessionId(activeSession.id);
          }
        })
        .catch(() => {
          if (!abort.signal.aborted) {
            setMetadataReadySessionId(null);
            integrityAbortRef.current?.abort();
            dispatch({
              type: 'metadata_unavailable',
              id: activeSession.id,
              expectedRevision: activeSession.revision,
              sourceId: activeSession.source_id!,
            });
            setCommandStatus('File information could not be refreshed. Source facts are unavailable.');
          }
        })
        .finally(() => {
          if (!abort.signal.aborted) refreshTimer = setTimeout(refresh, 750);
        });
    };
    refresh();
    return () => {
      abort.abort();
      if (refreshTimer !== null) clearTimeout(refreshTimer);
    };
  }, [activeSession?.id, activeSession?.revision, activeSession?.source_id, inspectorOpen, selectedMetadataGateway]);

  useEffect(() => () => {
    integrityAbortRef.current?.abort();
    if (integrityRequestIdRef.current && selectedMetadataGateway)
      void selectedMetadataGateway.cancelIntegrity(integrityRequestIdRef.current).catch(() => undefined);
    integrityAbortRef.current = null;
    integrityRequestIdRef.current = null;
  }, [activeSession?.id, inspectorOpen, selectedMetadataGateway]);

  const openMetadata = (opener: HTMLElement) => {
    metadataOpenerRef.current = opener;
    setInspectorOpen(true);
  };

  const closeMetadata = () => {
    integrityAbortRef.current?.abort();
    if (integrityRequestIdRef.current && selectedMetadataGateway)
      void selectedMetadataGateway.cancelIntegrity(integrityRequestIdRef.current).catch(() => undefined);
    integrityAbortRef.current = null;
    integrityRequestIdRef.current = null;
    setInspectorOpen(false);
    const opener = metadataOpenerRef.current;
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus();
      else if (state.activeId) document.getElementById(`tab-${state.activeId}`)?.focus();
    });
  };

  const invoke = (command: CommandDescriptor, opener: HTMLButtonElement) => {
    const result = executeCommand(command, activeSession);
    const applied =
      result.ok && (command.id === 'metadata'
        ? (openMetadata(opener), true)
        : (editorRef.current?.invoke(command.id) ?? false));
    setCommandStatus(
      result.ok
        ? command.id === 'save' && activeSession
          ? `Save requested for ${activeSession.source.display_name}. Waiting for a durable save receipt.`
          : applied
            ? `${command.label} applied to ${activeSession?.source.display_name ?? 'document'}`
            : result.message
        : 'Command cancelled because the active document changed',
    );
  };

  const publishMetadata = (contribution: MetadataContribution) =>
    dispatch({ type: 'update_metadata', contribution });

  const requestChecksum = () => {
    const inspectedRevision = activeSession?.metadata?.external_revision;
    if (!activeSession?.source_id || !inspectedRevision || metadataReadySessionId !== activeSession.id || !selectedMetadataGateway) return;
    integrityAbortRef.current?.abort();
    const abort = new AbortController();
    integrityAbortRef.current = abort;
    const requestId = createIntegrityRequestId();
    if (!requestId) {
      setCommandStatus('SHA-256 is unavailable because secure request identifiers are not supported.');
      return;
    }
    integrityRequestIdRef.current = requestId;
    const base = {
      session_id: activeSession.id,
      expected_session_revision: activeSession.revision,
      expected_external_revision: inspectedRevision,
      producer: 'integrity' as const,
    };
    publishMetadata({ ...base, facts: [
      { key: 'derived.sha256', availability: 'pending' },
      { key: 'derived.sha256_progress', availability: 'available', value: { kind: 'integer', value: '0' }, unit: 'bytes' },
    ] });
    void runIntegrityRequest(
      selectedMetadataGateway,
      activeSession.source_id,
      inspectedRevision,
      requestId,
      abort.signal,
      (progress) => publishMetadata({
        ...base,
        facts: [
          { key: 'derived.sha256', availability: 'pending' },
          { key: 'derived.sha256_progress', availability: 'available', value: { kind: 'integer', value: String(progress.processed_bytes) }, unit: 'bytes' },
        ],
      }),
    )
      .then((progress) => {
        if (abort.signal.aborted) return;
        integrityRequestIdRef.current = null;
        publishMetadata({
          ...base,
          facts: progress.state === 'ready' && progress.sha256
            ? [
                { key: 'derived.sha256', availability: 'available', value: { kind: 'text', value: progress.sha256 } },
                { key: 'derived.sha256_progress', availability: 'not_provided' },
              ]
            : progress.state === 'limited'
              ? [
                  { key: 'derived.sha256', availability: 'unsupported' },
                  { key: 'derived.sha256_progress', availability: 'not_provided' },
                ]
              : [
                  { key: 'derived.sha256', availability: 'errored', error_code: `integrity_${progress.state}` },
                  { key: 'derived.sha256_progress', availability: 'not_provided' },
                ],
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        integrityRequestIdRef.current = null;
        publishMetadata({ ...base, facts: [
          { key: 'derived.sha256', availability: 'errored', error_code: 'integrity_failed' },
          { key: 'derived.sha256_progress', availability: 'not_provided' },
        ] });
      });
  };

  const resolveRecoveryCandidate = (decision: RecoveryCandidateDecision) => {
    if (!recoveryCandidate) return;
    if (decision === 'cancel') {
      recovery.defer(recoveryCandidate);
      return;
    }
    if (decision === 'refuse') {
      void recovery.refuse(recoveryCandidate).catch(() => {
        setCommandStatus(
          'Recovery refusal could not be confirmed. The record was preserved.',
        );
      });
      return;
    }
    void recovery
      .accept(recoveryCandidate)
      .then((record) => {
        dispatch({
          type: 'open',
          session: projectRecoveredSession({
            inventory: recoveryCandidate,
            content: record.content,
            snapshot_session_revision: record.snapshot_session_revision,
            text_profile: record.text_profile,
          }),
        });
      })
      .catch(() => {
        setCommandStatus(
          'Recovery could not be opened. The record was preserved.',
        );
      });
  };

  const handleShellKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!event.ctrlKey) return;
    if (event.key === 'Tab') {
      event.preventDefault();
      dispatch({ type: event.shiftKey ? 'previous' : 'next' });
    } else if (event.key.toLowerCase() === 'w' && state.activeId) {
      event.preventDefault();
      dispatch({ type: 'close', id: state.activeId });
    }
  };

  return (
    <main className="app-shell" onKeyDown={handleShellKey}>
      <TabStrip state={state} dispatch={dispatch} />
      <CommandBar commands={commands} onInvoke={invoke} />
      {activeSession &&
        (integrityOf(activeSession) === 'conflicted' ||
          integrityOf(activeSession) === 'recovery_only') && (
          <aside className="integrity-banner" role="status" aria-live="polite">
            {integrityOf(activeSession) === 'recovery_only'
              ? 'Recovered local edits have no confirmed source authority. Save As is available.'
              : 'The source changed outside Glitchpad. Local edits remain available; in-place save is blocked.'}
          </aside>
        )}
      {recovery.warning && (
        <aside className="integrity-banner" role="status" aria-live="assertive">
          {recovery.warning}
        </aside>
      )}
      <DocumentSurface
        ref={editorRef}
        session={activeSession}
        onDocumentChange={(id, expectedRevision, document, revision) =>
          dispatch({
            type: 'update_text',
            id,
            expectedRevision,
            document,
            revision,
          })
        }
        onLanguageChange={(id, expectedRevision, language) =>
          dispatch({ type: 'update_language', id, expectedRevision, language })
        }
        onMarkdownChange={(id, expectedRevision, markdown) =>
          dispatch({ type: 'update_markdown', id, expectedRevision, markdown })
        }
        onMermaidChange={(id, expectedRevision, mermaid) =>
          dispatch({ type: 'update_mermaid', id, expectedRevision, mermaid })
        }
        externalLinkGateway={externalLinkGateway ?? (nativeExternalLinkAvailable() ? nativeMarkdownExternalLinkGateway : undefined)}
        localAssetGateway={localAssetGateway}
        onOpenMetadata={openMetadata}
        onMetadataContribution={publishMetadata}
      />
      {inspectorOpen && activeSession && (
        <MetadataInspector
          key={activeSession.id}
          session={activeSession}
          snapshot={projectSessionMetadata(activeSession)}
          onClose={closeMetadata}
          onRequestChecksum={activeSession.source_id && activeSession.metadata?.external_revision && metadataReadySessionId === activeSession.id && selectedMetadataGateway ? requestChecksum : undefined}
          clipboardGateway={clipboardGateway}
        />
      )}
      {!recoveryCandidate && state.pendingTransition && resolutionSession && (
        <RecoveryResolution
          session={resolutionSession}
          transition={state.pendingTransition}
          onDecision={(decision) =>
            dispatch({ type: 'resolve_transition', decision })
          }
        />
      )}
      {recoveryCandidate && (
        <RecoveryCandidateResolution
          entry={recoveryCandidate}
          onDecision={resolveRecoveryCandidate}
        />
      )}
      <p
        className="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {commandStatus || state.announcement}
      </p>
    </main>
  );
}
