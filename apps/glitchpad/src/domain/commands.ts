import type { ShellSession } from './contracts';

export type CommandId =
  | 'document_details'
  | 'large_text_tools'
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
  | 'fit'
  | 'save_as'
  | 'edit_copy'
  | 'edit'
  | 'save'
  | 'metadata'
  | 'outline'
  | 'print'
  | 'previous_page'
  | 'next_page';

export interface EditorCommandState {
  undo: boolean;
  redo: boolean;
  wrapped: boolean;
}

export interface CommandDescriptor {
  id: CommandId;
  label: string;
  shortcut?: string;
  enabled: boolean;
  targetSessionId: string;
  targetRevision: number;
  role?: 'primary' | 'secondary';
  group?: 'document' | 'view';
  rank?: number;
  reason?: string;
}

export type CommandResult =
  | { ok: true; message: string }
  | { ok: false; reason: 'stale_session' | 'unsupported' };

export const commandSetFor = (
  session: ShellSession | null,
  editorState?: EditorCommandState,
): CommandDescriptor[] => {
  if (!session) return [];
  const renderer = session.renderer.capabilities;
  const source = session.source.capabilities;
  const canEditSource =
    renderer.edit &&
    (source.write ||
      Boolean(session.edit_origin) ||
      session.integrity === 'recovery_only');
  const documentMode =
    session.markdown_document?.mode ?? session.mermaid_document?.mode;
  const canToggleSource = Boolean(
    (session.markdown_document &&
      (documentMode === 'rendered' ||
        session.markdown_document.eligibility !== 'source_only')) ||
    (session.mermaid_document &&
      (documentMode === 'rendered' ||
        session.mermaid_document.render_revision !== null)),
  );
  const hasTextEditor = Boolean(
    session.text_document &&
    session.text_document.mode !== 'large_read_only' &&
    session.text_document.mode !== 'refused' &&
    (session.renderer.id === 'text' || documentMode === 'source'),
  );
  const definitions: Array<[boolean, CommandId, string, string?]> = [
    [hasTextEditor, 'document_details', 'Document details'],
    [
      Boolean(
        session.text_document?.mode === 'large_read_only' && session.source_id,
      ),
      'large_text_tools',
      'Large text tools',
    ],
    [renderer.copy, 'copy', 'Copy', 'Ctrl+C'],
    [renderer.search, 'search', 'Search', 'Ctrl+F'],
    [renderer.search, 'find_next', 'Find next', 'F3'],
    [renderer.search, 'find_previous', 'Find previous', 'Shift+F3'],
    [renderer.search, 'go_to_line', session.pdf_document ? 'Go to page' : 'Go to line', 'Ctrl+G'],
    [canEditSource, 'undo', 'Undo', 'Ctrl+Z'],
    [canEditSource, 'redo', 'Redo', 'Ctrl+Shift+Z'],
    [canEditSource, 'indent', 'Indent', 'Tab'],
    [canEditSource, 'outdent', 'Outdent', 'Shift+Tab'],
    [
      Boolean(
        session.text_document && session.text_document.mode === 'editable',
      ),
      'toggle_wrap',
      editorState?.wrapped === false
        ? 'Wrap lines'
        : editorState?.wrapped === true
          ? 'Unwrap lines'
          : 'Toggle wrap',
    ],
    [renderer.zoom, 'zoom_out', 'Zoom out', 'Ctrl+-'],
    [renderer.zoom, 'zoom_in', 'Zoom in', 'Ctrl++'],
    [renderer.zoom, 'fit', 'Fit'],
    [
      Boolean(session.text_document?.mode === 'editable' && !canEditSource),
      'edit_copy',
      'Edit a copy',
    ],
    [
      canToggleSource,
      'edit',
      documentMode === 'source'
        ? 'Read'
        : canEditSource
          ? 'Edit'
          : 'View source',
    ],
    [
      renderer.save &&
        (source.write ||
          Boolean(session.edit_origin) ||
          session.integrity === 'recovery_only'),
      'save',
      'Save',
      'Ctrl+S',
    ],
    [
      renderer.save && session.text_document?.mode === 'editable',
      'save_as',
      'Save As…',
    ],
    [
      renderer.inspect_metadata && source.metadata,
      'metadata',
      'File information',
    ],
    [
      Boolean(
        session.pdf_document?.capabilities.outline || (session.markdown_document &&
        documentMode === 'rendered' &&
        session.markdown_document.outline_count > 0),
      ),
      'outline',
      'Outline',
    ],
    [Boolean(session.markdown_document?.printable || session.pdf_document?.capabilities.print==='available'), 'print', 'Print', 'Ctrl+P'],
    [Boolean(session.pdf_document?.capabilities.navigate), 'previous_page', 'Previous page'],
    [Boolean(session.pdf_document?.capabilities.navigate), 'next_page', 'Next page'],
  ];

  return definitions
    .filter(([supported]) => supported)
    .map(([, id, label, shortcut]) => ({
      id,
      label,
      shortcut,
      enabled:
        session.lifecycle === 'active' &&
        session.destination_save_revision == null &&
        (id !== 'previous_page' || (session.pdf_document?.navigation.page ?? 0) > 0) &&
        (id !== 'next_page' || (session.pdf_document?.navigation.page ?? 0) + 1 < (session.pdf_document?.page_count ?? 0)) &&
        (id !== 'undo' || editorState?.undo !== false) &&
        (id !== 'redo' || editorState?.redo !== false),
      role: id === 'save' ? 'primary' : 'secondary',
      group:
        id === 'zoom_in' || id === 'zoom_out' || id === 'fit'
          ? 'view'
          : 'document',
      rank: definitions.findIndex(([, candidate]) => candidate === id),
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
  if (
    !commandSetFor(currentSession).some(
      ({ id, enabled }) => id === command.id && enabled,
    )
  ) {
    return { ok: false, reason: 'unsupported' };
  }
  return {
    ok: true,
    message: `${command.label} is available`,
  };
};

export type ActionResult =
  | { status: 'performed' }
  | { status: 'failed' | 'cancelled' | 'unavailable'; reason: string };

export const performCommand = async (
  command: CommandDescriptor,
  current: () => ShellSession | null,
  handler: () => boolean | ActionResult | Promise<boolean | ActionResult>,
): Promise<ActionResult> => {
  const validation = executeCommand(command, current());
  if (!validation.ok)
    return {
      status:
        validation.reason === 'stale_session' ? 'cancelled' : 'unavailable',
      reason: validation.reason,
    };
  try {
    const result = await handler();
    return typeof result === 'boolean'
      ? result
        ? { status: 'performed' }
        : { status: 'unavailable', reason: 'operation_unavailable' }
      : result;
  } catch {
    return { status: 'failed', reason: 'operation_failed' };
  }
};
