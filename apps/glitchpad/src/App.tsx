import { useEffect, useReducer, useRef, useState } from 'react';

import { CommandBar } from './components/CommandBar';
import { DocumentSurface } from './components/DocumentSurface';
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
import { useRecovery } from './domain/use-recovery';

const makeSession = (
  id: string,
  name: string,
  renderer: string,
  content: string,
  capabilities: Partial<ShellSession['renderer']['capabilities']>,
  options: { dirty?: boolean; writable?: boolean; metadata?: boolean } = {},
): ShellSession => {
  const isText = renderer !== 'Image';
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
      claimed_media_type: name.endsWith('.md') ? 'text/markdown' : 'text/plain',
      byte_length: content.length,
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
        ...capabilities,
      },
    },
    lifecycle: id === 'welcome' ? 'active' : 'background',
    dirty: options.dirty ?? false,
    revision: 1,
    content,
    text_document: isText
      ? createTextDocument({
          rawText: content,
          displayName: name,
          language: detectLanguage(name, content),
        })
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
}

export function App({ sessions = initialSessions, recoveryGateway }: AppProps) {
  const [state, dispatch] = useReducer(tabReducer, sessions, createTabState);
  const [commandStatus, setCommandStatus] = useState('');
  const editorRef = useRef<TextEditorHandle>(null);
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

  const invoke = (command: CommandDescriptor) => {
    const result = executeCommand(command, activeSession);
    const applied =
      result.ok && (editorRef.current?.invoke(command.id) ?? false);
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
      />
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
