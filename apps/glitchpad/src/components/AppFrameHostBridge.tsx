import { useEffect } from 'react';
/** Existing product compatibility alias; canonical AppFrame inputs remain authoritative. */
export function AppFrameHostBridge() {
  useEffect(() => {
    const host = document.getElementById('bb-overlay-root');
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
  }, []);
  return null;
}
