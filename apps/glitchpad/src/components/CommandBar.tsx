import type { CommandDescriptor } from '../domain/commands';

interface CommandBarProps {
  commands: CommandDescriptor[];
  onInvoke: (command: CommandDescriptor) => void;
}

export function CommandBar({ commands, onInvoke }: CommandBarProps) {
  if (commands.length === 0) return null;

  return (
    <nav className="command-bar" aria-label="Document commands">
      {commands.map((command) => (
        <button
          className="command-button"
          type="button"
          key={command.id}
          disabled={!command.enabled}
          aria-keyshortcuts={command.shortcut?.replace('Ctrl', 'Control')}
          title={
            command.shortcut
              ? `${command.label} (${command.shortcut})`
              : command.label
          }
          onClick={() => onInvoke(command)}
        >
          {command.label}
        </button>
      ))}
    </nav>
  );
}
