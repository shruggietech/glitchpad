export interface DiagnosticScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface DiagnosticViewport {
  webview_screen: DiagnosticScreenRect;
  visible_screen: DiagnosticScreenRect;
  view_width: number;
  view_height: number;
  density: number;
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const rect = (value: unknown): value is DiagnosticScreenRect =>
  record(value) &&
  ['left', 'top', 'right', 'bottom'].every(
    (key) => typeof value[key] === 'number' && Number.isFinite(value[key]),
  ) &&
  Number(value.right) > Number(value.left) &&
  Number(value.bottom) > Number(value.top);

export function diagnosticViewport(value: unknown): DiagnosticViewport | null {
  if (
    !record(value) ||
    !rect(value.webview_screen) ||
    !rect(value.visible_screen) ||
    !positive(value.view_width) ||
    !positive(value.view_height) ||
    !positive(value.density)
  )
    return null;
  const webview = value.webview_screen;
  const visible = value.visible_screen;
  if (
    webview.right - webview.left !== value.view_width ||
    webview.bottom - webview.top !== value.view_height ||
    visible.left < webview.left ||
    visible.top < webview.top ||
    visible.right > webview.right ||
    visible.bottom > webview.bottom
  )
    return null;
  return {
    webview_screen: {
      left: webview.left,
      top: webview.top,
      right: webview.right,
      bottom: webview.bottom,
    },
    visible_screen: {
      left: visible.left,
      top: visible.top,
      right: visible.right,
      bottom: visible.bottom,
    },
    view_width: value.view_width,
    view_height: value.view_height,
    density: value.density,
  };
}

export function diagnosticSheetBounds(
  viewport: DiagnosticViewport,
  parent: DiagnosticScreenRect,
  cssViewportWidth: number,
) {
  if (!positive(cssViewportWidth) || !rect(parent)) return null;
  // Native width, not density or available height, maps all four physical-screen coordinates.
  const scale = cssViewportWidth / viewport.view_width;
  const native = viewport.visible_screen;
  const webview = viewport.webview_screen;
  const left = Math.max(parent.left, (native.left - webview.left) * scale);
  const top = Math.max(parent.top, (native.top - webview.top) * scale);
  const right = Math.min(parent.right, (native.right - webview.left) * scale);
  const bottom = Math.min(parent.bottom, (native.bottom - webview.top) * scale);
  if (right <= left || bottom <= top) return null;
  return {
    left: left - parent.left,
    top: top - parent.top,
    right: parent.right - right,
    bottom: parent.bottom - bottom,
    width: right - left,
    height: bottom - top,
  };
}
