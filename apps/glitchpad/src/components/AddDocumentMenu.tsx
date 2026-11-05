import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DiagnosticExportGateway } from '../domain/persistence-gateway';
import { useNativeViewport } from './use-native-viewport';
import './AddDocumentMenu.css';

interface Props {
  triggerHost?: HTMLElement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNew: (kind: 'markdown' | 'text') => void;
  onChoose: () => void;
  canChoose: boolean;
  disabled?: boolean;
  viewport?: DiagnosticExportGateway['viewport'];
}
export function AddDocumentMenu({
  triggerHost,
  open,
  onOpenChange,
  onNew,
  onChoose,
  canChoose,
  disabled = false,
  viewport,
}: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);
  useNativeViewport(container, host ? viewport : undefined, '--gl-add-native');
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
    const properties = [
      '--gl-add-document-block-size',
      '--gl-add-document-clearance',
    ];
    const previous = properties.map((property) =>
      frame.style.getPropertyValue(property),
    );
    const measure = () => {
      const target = trigger.current?.getBoundingClientRect();
      if (!target || target.height <= 0) return;
      const surface = frame.querySelector<HTMLElement>('.document-surface');
      const gap = container.current
        ? Number.parseFloat(getComputedStyle(container.current).gap) || 0
        : 0;
      const clearance = triggerHost
        ? 0
        : surface
          ? Math.max(
              target.height,
              surface.getBoundingClientRect().bottom - target.top + gap,
            )
          : target.height + gap * 2;
      for (const [index, value] of [target.height, clearance].entries()) {
        const next = value + 'px';
        if (frame.style.getPropertyValue(properties[index]) !== next)
          frame.style.setProperty(properties[index], next);
      }
    };
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(trigger.current);
    const positionObserver = new MutationObserver(measure);
    if (container.current)
      positionObserver.observe(container.current, {
        attributes: true,
        attributeFilter: ['style', 'data-native-viewport'],
      });
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      positionObserver.disconnect();
      window.removeEventListener('resize', measure);
      properties.forEach((property, index) => {
        if (previous[index]) frame.style.setProperty(property, previous[index]);
        else frame.style.removeProperty(property);
      });
    };
  }, [host, triggerHost]);
  if (!host) return null;
  const dismiss = () => onOpenChange(false);
  const addTrigger = (
    <button
      ref={trigger}
      type="button"
      className={
        'add-document-trigger' +
        (triggerHost ? ' add-document-inline-trigger' : '')
      }
      aria-label="Add document"
      title="Add document"
      disabled={disabled}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => onOpenChange(!open)}
    >
      {triggerHost ? (
        <>
          <span aria-hidden="true">+</span>
          <span className="visually-hidden">Add document</span>
        </>
      ) : (
        'Add document'
      )}
    </button>
  );
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
      <div
        ref={container}
        className="add-document"
        data-add-document
        data-disabled={disabled}
      >
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
        {triggerHost ? createPortal(addTrigger, triggerHost) : addTrigger}
      </div>
    </>,
    host,
  );
}
