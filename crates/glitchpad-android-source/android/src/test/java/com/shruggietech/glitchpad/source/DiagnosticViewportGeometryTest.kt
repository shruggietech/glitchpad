package com.shruggietech.glitchpad.source

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DiagnosticViewportGeometryTest {
  @Test fun intersectsScreenDecorationsWithoutGuessingInsets() {
    val observed = requireNotNull(DiagnosticViewportGeometry.snapshot(0, 0, 320, 640, 0, 0,
      DiagnosticPixelRect(0, 0, 320, 640), DiagnosticPixelRect(0, 48, 320, 592), 1f))
    assertEquals(DiagnosticPixelRect(0, 0, 320, 640), observed.webviewScreen)
    assertEquals(DiagnosticPixelRect(0, 48, 320, 592), observed.visibleScreen)
    assertEquals(320, observed.viewWidth)
    assertEquals(640, observed.viewHeight)
    assertEquals(1f, observed.density)
  }

  @Test fun translatesScrolledAncestorClippingIntoScreenCoordinates() {
    val observed = requireNotNull(DiagnosticViewportGeometry.snapshot(120, 80, 300, 500, 7, 11,
      DiagnosticPixelRect(27, 41, 287, 481), DiagnosticPixelRect(130, 90, 390, 520), 2.5f))
    assertEquals(DiagnosticPixelRect(120, 80, 420, 580), observed.webviewScreen)
    assertEquals(DiagnosticPixelRect(140, 110, 390, 520), observed.visibleScreen)
    assertEquals(2.5f, observed.density)
  }

  @Test fun neverExpandsTheViewOrAddsAnInsetAlreadyAppliedByNativeResize() {
    val resized = requireNotNull(DiagnosticViewportGeometry.snapshot(-40, 24, 320, 370, 0, 0,
      DiagnosticPixelRect(0, 0, 320, 370), DiagnosticPixelRect(-100, -100, 1000, 1000), 1f))
    assertEquals(resized.webviewScreen, resized.visibleScreen)
    assertEquals(DiagnosticPixelRect(-40, 24, 280, 394), resized.visibleScreen)
  }

  @Test fun missingEmptyClippedAndInvalidObservationsStayUnavailable() {
    val full = DiagnosticPixelRect(0, 0, 320, 640)
    fun read(width: Int = 320, height: Int = 640, local: DiagnosticPixelRect? = full,
      window: DiagnosticPixelRect = full, density: Float = 1f, left: Int = 0) =
      DiagnosticViewportGeometry.snapshot(left, 0, width, height, 0, 0, local, window, density)
    assertNull(read(local = null))
    assertNull(read(width = 0))
    assertNull(read(height = -1))
    assertNull(read(local = DiagnosticPixelRect(320, 0, 400, 640)))
    assertNull(read(window = DiagnosticPixelRect(0, 640, 320, 700)))
    assertNull(read(density = Float.NaN))
    assertNull(read(density = 0f))
    assertNull(read(left = Int.MAX_VALUE))
  }
}
