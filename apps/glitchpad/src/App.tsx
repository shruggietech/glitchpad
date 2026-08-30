import { useEffect, useReducer, useState } from 'react';

import { CommandBar } from './components/CommandBar';
import { DocumentSurface } from './components/DocumentSurface';
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
import { createTabState, tabReducer } from './domain/tabs';

const makeSession = (
  id: string,
  name: string,
  renderer: string,
  content: string,
  capabilities: Partial<ShellSession['renderer']['capabilities']>,
  options: { dirty?: boolean; writable?: boolean; metadata?: boolean } = {},
): ShellSession => ({
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
});

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
}

export function App({ sessions = initialSessions }: AppProps) {
  const [state, dispatch] = useReducer(tabReducer, sessions, createTabState);
  const [commandStatus, setCommandStatus] = useState('');
  const activeSession =
    state.sessions.find(({ id }) => id === state.activeId) ?? null;
  const commands = commandSetFor(activeSession);

  useEffect(() => setCommandStatus(''), [state.activeId]);

  const invoke = (command: CommandDescriptor) => {
    const result = executeCommand(command, activeSession);
    setCommandStatus(
      result.ok
        ? result.message
        : 'Command cancelled because the active document changed',
    );
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
      <DocumentSurface session={activeSession} />
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
