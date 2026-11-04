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
    if (
      !host ||
      typeof CSS === 'undefined' ||
      typeof CSS.supports !== 'function' ||
      CSS.supports('inset-block', '0px')
    )
      return;
    const frame = host.closest<HTMLElement>('[data-bb-app-frame]');
    const scroll = frame?.querySelector<HTMLElement>('.bb-app-frame__scroll');
    if (!frame || !scroll) return;
    // Chromium69 ignores the generated logical offsets and max() expressions.
    // Read the same canonical inset inputs and apply their physical equivalents.
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px)';
    frame.append(probe);
    const previous = new Map<HTMLElement, Map<string, string>>();
    const set = (element: HTMLElement, property: string, value: string) => {
      let saved = previous.get(element);
      if (!saved) {
        saved = new Map();
        previous.set(element, saved);
      }
      if (!saved.has(property))
        saved.set(property, element.style.getPropertyValue(property));
      if (element.style.getPropertyValue(property) !== value)
        element.style.setProperty(property, value);
    };
    const pixels = (value: string) => Number.parseFloat(value) || 0;
    const update = () => {
      const safe = getComputedStyle(probe);
      const canonical = getComputedStyle(frame);
      const top =
        Math.max(
          pixels(safe.paddingTop),
          pixels(canonical.getPropertyValue('--bb-host-titlebar-block-end')),
        ) + 'px';
      const bottom =
        Math.max(
          pixels(safe.paddingBottom),
          pixels(canonical.getPropertyValue('--bb-ime-block-end')),
        ) + 'px';
      set(host, 'top', top);
      set(host, 'right', safe.paddingRight);
      set(host, 'bottom', bottom);
      set(host, 'left', safe.paddingLeft);
      set(frame, 'padding-top', top);
      set(frame, 'padding-right', safe.paddingRight);
      set(frame, 'padding-left', safe.paddingLeft);
      set(scroll, 'padding-bottom', bottom);
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    });
    observer.observe(frame, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      probe.remove();
      for (const [element, properties] of previous)
        for (const [property, value] of properties) {
          if (value) element.style.setProperty(property, value);
          else element.style.removeProperty(property);
        }
    };
  }, [host]);
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
      <div className="add-document" data-add-document data-disabled={disabled}>
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
