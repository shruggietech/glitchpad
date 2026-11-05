import {
  diagnosticSheetBounds,
  diagnosticViewport,
  type DiagnosticViewport,
} from './diagnostic-viewport';

export const nativeViewport: DiagnosticViewport = {
  webview_screen: { left: 20, top: 40, right: 660, bottom: 1320 },
  visible_screen: { left: 20, top: 136, right: 660, bottom: 1224 },
  view_width: 640,
  view_height: 1280,
  density: 2,
};

describe('diagnostic sheet remaining native crop', () => {
  it('maps every edge with native width and intersects already positioned AppFrame bounds', () => {
    expect(
      diagnosticSheetBounds(
        nativeViewport,
        { left: 0, top: 48, right: 320, bottom: 640 },
        320,
      ),
    ).toEqual({
      left: 0,
      top: 0,
      right: 0,
      bottom: 48,
      width: 320,
      height: 544,
    });
    expect(
      diagnosticSheetBounds(
        { ...nativeViewport, density: 3 },
        { left: 0, top: 48, right: 320, bottom: 640 },
        320,
      ),
    ).toEqual({
      left: 0,
      top: 0,
      right: 0,
      bottom: 48,
      width: 320,
      height: 544,
    });
  });
  it('does not duplicate already applied safe or native physical insets', () => {
    expect(
      diagnosticSheetBounds(
        nativeViewport,
        { left: 0, top: 48, right: 320, bottom: 592 },
        320,
      ),
    ).toEqual({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 320,
      height: 544,
    });
    const resized = {
      ...nativeViewport,
      webview_screen: { left: 20, top: 136, right: 660, bottom: 1224 },
      view_height: 1088,
    };
    expect(
      diagnosticSheetBounds(
        resized,
        { left: 0, top: 0, right: 320, bottom: 544 },
        320,
      ),
    ).toEqual({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 320,
      height: 544,
    });
  });
  it('keeps horizontal and top intersections proportional and refuses an empty intersection', () => {
    const clipped = {
      ...nativeViewport,
      visible_screen: { left: 60, top: 176, right: 620, bottom: 1224 },
    };
    expect(
      diagnosticSheetBounds(
        clipped,
        { left: 0, top: 48, right: 320, bottom: 640 },
        320,
      ),
    ).toEqual({
      left: 20,
      top: 20,
      right: 20,
      bottom: 48,
      width: 280,
      height: 524,
    });
    expect(
      diagnosticSheetBounds(
        nativeViewport,
        { left: 0, top: 610, right: 320, bottom: 640 },
        320,
      ),
    ).toBeNull();
  });
  it.each([
    null,
    {},
    { ...nativeViewport, view_width: 0 },
    { ...nativeViewport, density: NaN },
    {
      ...nativeViewport,
      visible_screen: { left: 0, top: 0, right: 320, bottom: 640 },
    },
    { ...nativeViewport, view_height: 1 },
  ])('refuses unavailable or inconsistent native geometry', (value) => {
    expect(diagnosticViewport(value)).toBeNull();
  });
});
