import { useEffect, useRef, useState } from 'react';

import type { CommandDescriptor } from '../domain/commands';

interface ApplicationMenuProps {
  active?: boolean;
  commands: CommandDescriptor[];
  canOpen: boolean;
  onOpen: () => void;
  onInvoke: (command: CommandDescriptor, opener: HTMLButtonElement) => void;
  onPreferences: (opener: HTMLButtonElement) => void;
  onDiagnostics: (opener: HTMLButtonElement) => void;
}

export function ApplicationMenu({ active = true, commands, canOpen, onOpen, onInvoke, onPreferences, onDiagnostics }: ApplicationMenuProps) {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [open]);

  useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) {
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const invoke = (action: (opener: HTMLButtonElement) => void) => {
    setOpen(false);
    if (triggerRef.current) action(triggerRef.current);
  };

  return (
    <div
      className="application-menu-shell application-toolbar"
      ref={shellRef}
      data-menu-active={active ? 'true' : 'false'}
      data-menu-open={open ? 'true' : 'false'}
      onBlur={(event) => {
        if (!open || shellRef.current?.contains(event.relatedTarget)) return;
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }}
    >
      <button
        className="application-menu-trigger"
        type="button"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-hidden={!active}
        disabled={!active}
        tabIndex={active ? 0 : -1}
        ref={triggerRef}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="application-menu-glyph" aria-hidden="true">☰</span>
      </button>
      {open && (
        <div
          className="application-menu"
          role="menu"
          aria-label="Glitchpad menu"
          ref={menuRef}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
          }}
        >
          {canOpen && (
            <button type="button" role="menuitem" onClick={() => invoke(() => onOpen())}>
              Open…
            </button>
          )}
          {commands.length > 0 && <div className="application-menu-separator" role="separator" />}
          {commands.map((command) => (
            <button
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
