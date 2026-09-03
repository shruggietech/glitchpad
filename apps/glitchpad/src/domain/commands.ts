import type { ShellSession } from './contracts';

export type CommandId =
  | 'copy'
  | 'search'
  | 'find_next'
  | 'find_previous'
  | 'close_search'
  | 'go_to_line'
  | 'undo'
  | 'redo'
  | 'indent'
  | 'outdent'
  | 'toggle_wrap'
  | 'zoom_out'
  | 'zoom_in'
  | 'edit'
  | 'save'
  | 'metadata'
  | 'previous_page'
  | 'next_page';

export interface CommandDescriptor {
  id: CommandId;
  label: string;
  shortcut?: string;
  enabled: boolean;
  targetSessionId: string;
  targetRevision: number;
}

export type CommandResult =
  | { ok: true; message: string }
  | { ok: false; reason: 'stale_session' | 'unsupported' };

export const commandSetFor = (
  session: ShellSession | null,
): CommandDescriptor[] => {
  if (!session) return [];
  const renderer = session.renderer.capabilities;
  const source = session.source.capabilities;
  const definitions: Array<[boolean, CommandId, string, string?]> = [
    [renderer.copy, 'copy', 'Copy', 'Ctrl+C'],
    [renderer.search, 'search', 'Search', 'Ctrl+F'],
    [renderer.search, 'find_next', 'Find next', 'F3'],
    [renderer.search, 'find_previous', 'Find previous', 'Shift+F3'],
    [renderer.search, 'go_to_line', 'Go to line', 'Ctrl+G'],
    [renderer.edit && source.write, 'undo', 'Undo', 'Ctrl+Z'],
    [renderer.edit && source.write, 'redo', 'Redo', 'Ctrl+Shift+Z'],
    [renderer.edit && source.write, 'indent', 'Indent', 'Tab'],
    [renderer.edit && source.write, 'outdent', 'Outdent', 'Shift+Tab'],
    [Boolean(session.text_document && session.text_document.mode === 'editable'), 'toggle_wrap', 'Toggle wrap'],
    [renderer.zoom, 'zoom_out', 'Zoom out', 'Ctrl+-'],
    [renderer.zoom, 'zoom_in', 'Zoom in', 'Ctrl++'],
    [renderer.edit && source.write, 'edit', 'Edit'],
    [renderer.save && source.write, 'save', 'Save', 'Ctrl+S'],
    [
      renderer.inspect_metadata && source.metadata,
      'metadata',
      'File information',
    ],
    [renderer.navigate, 'previous_page', 'Previous page', 'PageUp'],
    [renderer.navigate, 'next_page', 'Next page', 'PageDown'],
  ];

  return definitions
    .filter(([supported]) => supported)
    .map(([, id, label, shortcut]) => ({
      id,
      label,
      shortcut,
      enabled: session.lifecycle === 'active',
      targetSessionId: session.id,
      targetRevision: session.revision,
    }));
};

export const executeCommand = (
  command: CommandDescriptor,
  currentSession: ShellSession | null,
): CommandResult => {
  if (
    !currentSession ||
    command.targetSessionId !== currentSession.id ||
    command.targetRevision !== currentSession.revision
  ) {
    return { ok: false, reason: 'stale_session' };
  }
  if (!commandSetFor(currentSession).some(({ id }) => id === command.id)) {
    return { ok: false, reason: 'unsupported' };
  }
  return {
    ok: true,
    message: `${command.label} applied to ${currentSession.source.display_name}`,
  };
};
