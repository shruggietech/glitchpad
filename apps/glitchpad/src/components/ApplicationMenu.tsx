import { useEffect, useRef, useState } from 'react';

import type { CommandDescriptor } from '../domain/commands';

interface ApplicationMenuProps {
  commands: CommandDescriptor[];
  canOpen: boolean;
  onOpen: () => void;
  onInvoke: (command: CommandDescriptor, opener: HTMLButtonElement) => void;
  onPreferences: (opener: HTMLButtonElement) => void;
  onDiagnostics: (opener: HTMLButtonElement) => void;
}

export function ApplicationMenu({ commands, canOpen, onOpen, onInvoke, onPreferences, onDiagnostics }: ApplicationMenuProps) {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const invoke = (action: (opener: HTMLButtonElement) => void) => {
    setOpen(false);
    if (triggerRef.current) action(triggerRef.current);
  };

  return (
    <div className="application-menu-shell" ref={shellRef}>
      <button
        className="application-menu-trigger"
        type="button"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        ref={triggerRef}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">☰</span>
      </button>
      {open && (
        <div
          className="application-menu"
          role="menu"
          aria-label="Glitchpad menu"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
          }}
        >
          {canOpen && (
            <button ref={firstItemRef} type="button" role="menuitem" onClick={() => invoke(() => onOpen())}>
              Open…
            </button>
          )}
          {commands.length > 0 && <div className="application-menu-separator" role="separator" />}
          {commands.map((command, index) => (
            <button
              ref={!canOpen && index === 0 ? firstItemRef : undefined}
              type="button"
              role="menuitem"
              key={command.id}
              disabled={!command.enabled}
              onClick={() => invoke((opener) => onInvoke(command, opener))}
            >
              <span>{command.label}</span>
              {command.shortcut && <kbd>{command.shortcut}</kbd>}
            </button>
          ))}
          <div className="application-menu-separator" role="separator" />
          <button type="button" role="menuitem" onClick={() => invoke(onPreferences)}>Preferences</button>
          <button type="button" role="menuitem" onClick={() => invoke(onDiagnostics)}>Diagnostics</button>
        </div>
      )}
    </div>
  );
}
