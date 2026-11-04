import { useEffect, type RefObject } from 'react';
import type { DiagnosticExportGateway } from '../domain/persistence-gateway';
import { diagnosticSheetBounds } from '../domain/diagnostic-viewport';

export function useDiagnosticViewport(
  ref: RefObject<HTMLElement | null>,
  read: DiagnosticExportGateway['viewport'],
) {
  useEffect(() => {
    const sheet = ref.current;
    const parent = sheet?.offsetParent ?? sheet?.parentElement;
    if (!sheet || !(parent instanceof HTMLElement) || !read) return;
    const properties = [
      '--gl-diagnostic-inline-end',
      '--gl-diagnostic-block-end',
      '--gl-diagnostic-inline-size',
      '--gl-diagnostic-block-size',
    ];
    const prior = properties.map((name) => sheet.style.getPropertyValue(name));
    const priorAttribute = sheet.getAttribute('data-native-viewport');
    let active = true;
    let generation = 0;
    let pending = false;
    let queued = false;
    let frame: number | null = null;
    let appliedLayout: number[] | null = null;
    const layout = () => {
      const bounds = parent.getBoundingClientRect();
      const visual = window.visualViewport;
      return [
        window.innerWidth,
        window.innerHeight,
        visual?.width ?? window.innerWidth,
        visual?.height ?? window.innerHeight,
        visual?.offsetLeft ?? 0,
        visual?.offsetTop ?? 0,
        bounds.left,
        bounds.top,
        bounds.right,
        bounds.bottom,
      ];
    };
    const clear = () => {
      appliedLayout = null;
      sheet.removeAttribute('data-native-viewport');
      properties.forEach((name) => sheet.style.removeProperty(name));
    };
    const run = () => {
      frame = null;
      if (!active || !queued) return;
      queued = false;
      pending = true;
      const requested = generation;
      const requestedWidth = window.innerWidth;
      const requestedHeight = window.innerHeight;
      void Promise.resolve()
        .then(read)
        .then((viewport) => {
          if (!active || requested !== generation) return;
          if (
            window.innerWidth !== requestedWidth ||
            window.innerHeight !== requestedHeight
          ) {
            refresh();
            return;
          }
          const bounds = viewport
            ? diagnosticSheetBounds(
                viewport,
                parent.getBoundingClientRect(),
                window.innerWidth,
              )
            : null;
          if (!bounds) {
            clear();
            return;
          }
          const values = [
            bounds.right,
            bounds.bottom,
            bounds.width,
            bounds.height,
          ];
          properties.forEach((name, index) =>
            sheet.style.setProperty(name, values[index] + 'px'),
          );
          appliedLayout = layout();
          sheet.setAttribute('data-native-viewport', 'true');
        })
        .catch(() => {
          if (active && requested === generation) clear();
        })
        .finally(() => {
          pending = false;
          if (active && queued && frame === null)
            frame = requestAnimationFrame(run);
        });
    };
    const refresh = () => {
      generation += 1;
      queued = true;
      const current = layout();
      if (
        appliedLayout &&
        current.some((value, index) => value !== appliedLayout?.[index])
      )
        clear();
      if (!pending && frame === null) frame = requestAnimationFrame(run);
    };
    const visible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const viewport = window.visualViewport;
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    window.addEventListener('focus', refresh);
    viewport?.addEventListener('resize', refresh);
    viewport?.addEventListener('scroll', refresh);
    document.addEventListener('visibilitychange', visible);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(refresh);
    observer?.observe(parent);
    refresh();
    return () => {
      active = false;
      if (frame !== null) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', refresh);
      window.removeEventListener('orientationchange', refresh);
      window.removeEventListener('focus', refresh);
      viewport?.removeEventListener('resize', refresh);
      viewport?.removeEventListener('scroll', refresh);
      document.removeEventListener('visibilitychange', visible);
      properties.forEach((name, index) => {
        if (prior[index]) sheet.style.setProperty(name, prior[index]);
        else sheet.style.removeProperty(name);
      });
      if (priorAttribute === null)
        sheet.removeAttribute('data-native-viewport');
      else sheet.setAttribute('data-native-viewport', priorAttribute);
    };
  }, [ref, read]);
}
