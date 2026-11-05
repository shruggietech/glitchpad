import { useRef, useState, type KeyboardEvent } from 'react';
import type { CommandDescriptor } from '../domain/commands';
import type { DiagnosticExportGateway } from '../domain/persistence-gateway';
import { TaskSurface } from './TaskSurface';
interface ApplicationMenuProps {
  active?: boolean;
  commands: CommandDescriptor[];
  canOpen: boolean;
  onOpen: () => void;
  onInvoke: (command: CommandDescriptor, opener: HTMLButtonElement) => void;
  onPreferences: (opener: HTMLButtonElement) => void;
  onDiagnostics: (opener: HTMLButtonElement) => void;
  onHelp?: (opener: HTMLButtonElement) => void;
  onAbout?: (opener: HTMLButtonElement) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  toolsOpen?: boolean;
  onToolsOpenChange?: (open: boolean) => void;
  viewport?: DiagnosticExportGateway['viewport'];
  condensed?: boolean;
}
export function ApplicationMenu({
  active = true,
  commands,
  canOpen,
  onOpen,
  onInvoke,
  onPreferences,
  onDiagnostics,
  onHelp,
  onAbout,
  open: controlled,
  onOpenChange,
  toolsOpen: controlledTools,
  onToolsOpenChange,
  viewport,
  condensed = false,
}: ApplicationMenuProps) {
  const [local, setLocal] = useState(false),
    [localTools, setLocalTools] = useState(false);
  const open = controlled ?? local,
    toolsOpen = controlledTools ?? localTools;
  const trigger = useRef<HTMLButtonElement>(null),
    tools = useRef<HTMLButtonElement>(null);
  const setOpen = (value: boolean) => {
    setLocal(value);
    onOpenChange?.(value);
  };
  const setTools = (value: boolean) => {
    setLocalTools(value);
    onToolsOpenChange?.(value);
  };
  const invoke = (action: (opener: HTMLButtonElement) => void) => {
    setOpen(false);
    if (trigger.current) action(trigger.current);
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        'button:not(:disabled)',
      ),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) %
            items.length;
    event.preventDefault();
    items[next]?.focus();
  };
  const primary =
    commands.find((c) => c.role === 'primary') ??
    commands.find((c) => c.id === 'search');
  const toolButtons = (
    <>
      {primary && !condensed && (
        <button
          type="button"
          className="document-primary-action"
          disabled={!active || !primary.enabled}
          title={primary.reason}
          onClick={(event) => onInvoke(primary, event.currentTarget)}
        >
          {primary.label}
        </button>
      )}
      <button
        ref={tools}
        className="document-tools-trigger"
        type="button"
        aria-label="Document tools"
        aria-haspopup="menu"
        aria-expanded={toolsOpen}
        disabled={!active || !commands.length}
        onClick={() => setTools(!toolsOpen)}
      >
        Tools
      </button>
    </>
  );
  return (
    <div
      className="application-menu-shell application-toolbar"
      data-menu-active={active ? 'true' : 'false'}
      data-menu-open={open ? 'true' : 'false'}
    >
      <button
        ref={trigger}
        className="application-menu-trigger"
        type="button"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-hidden={!active}
        disabled={!active}
        tabIndex={active ? 0 : -1}
        onClick={() => setOpen(!open)}
      >
        <span className="application-menu-glyph" aria-hidden="true">
          ☰
        </span>
      </button>
      {toolButtons}
      <TaskSurface
        open={open && active}
        onOpenChange={setOpen}
        title="Application menu"
        opener={trigger.current}
        viewport={viewport}
      >
        <div
          className="application-menu"
          role="menu"
          aria-label="Glitchpad menu"
          onKeyDown={keys}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => invoke(onPreferences)}
          >
            Preferences
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => invoke(onDiagnostics)}
          >
            Diagnostics
          </button>
          {onHelp && (
            <button
              type="button"
              role="menuitem"
              onClick={() => invoke(onHelp)}
            >
              Help and support
            </button>
          )}
          {onAbout && (
            <button
              type="button"
              role="menuitem"
              onClick={() => invoke(onAbout)}
            >
              About Glitchpad
            </button>
          )}
        </div>
      </TaskSurface>
      <TaskSurface
        open={toolsOpen && active}
        onOpenChange={setTools}
        title="Document tools"
        opener={tools.current}
        viewport={viewport}
      >
        <div
          className="application-menu document-tools-menu"
          role="menu"
          aria-label="Document tools"
          onKeyDown={keys}
        >
          {canOpen && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setTools(false);
                onOpen();
              }}
            >
              Open file
            </button>
          )}
          {commands.map((command) => (
            <button
              type="button"
              role="menuitem"
              key={command.id}
              disabled={!command.enabled}
              title={command.reason}
              aria-keyshortcuts={command.shortcut?.replaceAll(
                'Ctrl',
                'Control',
              )}
              onClick={() => {
                setTools(false);
                if (tools.current) onInvoke(command, tools.current);
              }}
            >
              <span>{command.label}</span>
              {command.shortcut && (
                <kbd aria-hidden="true">{command.shortcut}</kbd>
              )}
            </button>
          ))}
        </div>
      </TaskSurface>
    </div>
  );
}
