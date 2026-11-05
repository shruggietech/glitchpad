package com.shruggietech.glitchpad.source

internal data class DiagnosticPixelRect(val left: Int, val top: Int, val right: Int, val bottom: Int) {
  fun intersect(other: DiagnosticPixelRect): DiagnosticPixelRect? {
    val clipped = DiagnosticPixelRect(maxOf(left, other.left), maxOf(top, other.top), minOf(right, other.right), minOf(bottom, other.bottom))
    return clipped.takeIf { it.left < it.right && it.top < it.bottom }
  }

  fun translate(x: Long, y: Long): DiagnosticPixelRect? {
    val edges = listOf(left.toLong() + x, top.toLong() + y, right.toLong() + x, bottom.toLong() + y)
    if (edges.any { it < Int.MIN_VALUE.toLong() || it > Int.MAX_VALUE.toLong() }) return null
    return DiagnosticPixelRect(edges[0].toInt(), edges[1].toInt(), edges[2].toInt(), edges[3].toInt())
  }
}

internal data class DiagnosticViewport(
  val webviewScreen: DiagnosticPixelRect,
  val visibleScreen: DiagnosticPixelRect,
  val viewWidth: Int,
  val viewHeight: Int,
  val density: Float,
)

internal object DiagnosticViewportGeometry {
  fun snapshot(
    screenLeft: Int, screenTop: Int, width: Int, height: Int,
    scrollX: Int, scrollY: Int, localVisible: DiagnosticPixelRect?,
    windowVisible: DiagnosticPixelRect, density: Float,
  ): DiagnosticViewport? {
    if (width <= 0 || height <= 0 || localVisible == null || !density.isFinite() || density <= 0f) return null
    val view = DiagnosticPixelRect(0, 0, width, height).translate(screenLeft.toLong(), screenTop.toLong()) ?: return null
    // Android's local visible rectangle includes the view's own scroll coordinates.
    val ancestorVisible = localVisible.translate(screenLeft.toLong() - scrollX, screenTop.toLong() - scrollY) ?: return null
    val visible = view.intersect(ancestorVisible)?.intersect(windowVisible) ?: return null
    return DiagnosticViewport(view, visible, width, height, density)
  }
}
