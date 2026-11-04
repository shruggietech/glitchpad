import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './AddDocumentMenu.css';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNew: (kind: 'markdown' | 'text') => void;
  onChoose: () => void;
  canChoose: boolean;
  disabled?: boolean;
}
export function AddDocumentMenu({
  open,
  onOpenChange,
  onNew,
  onChoose,
  canChoose,
  disabled = false,
}: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    setHost(document.getElementById('bb-overlay-root'));
  }, []);
  useEffect(() => {
    if (open)
      menu.current
        ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
        ?.focus();
    else if (wasOpen.current) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);
  useEffect(() => {
    const rotate = () => onOpenChange(false);
    window.addEventListener('orientationchange', rotate);
    return () => window.removeEventListener('orientationchange', rotate);
  }, [onOpenChange]);
  useEffect(() => {
    if (!host || !trigger.current) return;
    const frame = host.closest<HTMLElement>('[data-bb-app-frame]');
    if (!frame) return;
    const previous = frame.style.getPropertyValue(
      '--gl-add-document-block-size',
    );
    const measure = () => {
      const height = trigger.current?.getBoundingClientRect().height ?? 0;
      if (height > 0)
        frame.style.setProperty('--gl-add-document-block-size', height + 'px');
    };
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(trigger.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      if (previous)
        frame.style.setProperty('--gl-add-document-block-size', previous);
      else frame.style.removeProperty('--gl-add-document-block-size');
    };
  }, [host]);
  if (!host) return null;
  const dismiss = () => onOpenChange(false);
  return createPortal(
    <>
      {open && (
        <div
          className="add-document-scrim"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            dismiss();
          }}
          aria-hidden="true"
        />
      )}
      <div className="add-document" data-add-document>
        {open && (
          <div
            className="add-document-menu"
            ref={menu}
            role="menu"
            aria-label="Add document choices"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                dismiss();
                return;
              }
              if (
                !['Tab', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(
                  event.key,
                )
              )
                return;
              const items = [
                ...menu.current!.querySelectorAll<HTMLButtonElement>(
                  'button:not(:disabled)',
                ),
              ];
              const current = items.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? items.length - 1
                    : (current +
                        (event.key === 'ArrowUp' || event.shiftKey ? -1 : 1) +
                        items.length) %
                      items.length;
              event.preventDefault();
              items[next]?.focus();
            }}
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                dismiss();
                onNew('markdown');
              }}
            >
              New Markdown
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                dismiss();
                onNew('text');
              }}
            >
              New text file
            </button>
            <button
              role="menuitem"
              type="button"
              disabled={!canChoose}
              onClick={() => {
                dismiss();
                onChoose();
              }}
            >
              Open file
            </button>
            <button role="menuitem" type="button" onClick={dismiss}>
              Close Add document
            </button>
          </div>
        )}
        <button
          ref={trigger}
          type="button"
          className="add-document-trigger"
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        >
          Add document
        </button>
      </div>
    </>,
    host,
  );
}
