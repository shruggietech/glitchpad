package com.shruggietech.glitchpad

import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowInsets
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    installLegacyImeResizeBridge()
    installPre139WebViewImeResizeBridge()
  }

  private fun installLegacyImeResizeBridge() {
    if (Build.VERSION.SDK_INT >= 30) return

    val content = findViewById<ViewGroup>(android.R.id.content)
    val visibleFrame = Rect()
    content.viewTreeObserver.addOnGlobalLayoutListener {
      val child = content.getChildAt(0) ?: return@addOnGlobalLayoutListener
      content.getWindowVisibleDisplayFrame(visibleFrame)
      val fullHeight = content.rootView.height
      val visibleHeight = visibleFrame.bottom - visibleFrame.top
      if (fullHeight <= 0 || visibleHeight <= 0) return@addOnGlobalLayoutListener

      val imeObstruction = fullHeight - visibleHeight
      val targetHeight = if (imeObstruction > fullHeight / 4) visibleHeight else ViewGroup.LayoutParams.MATCH_PARENT
      if (child.layoutParams.height != targetHeight) {
        child.layoutParams = child.layoutParams.apply { height = targetHeight }
      }
    }
  }

  private fun installPre139WebViewImeResizeBridge() {
    if (Build.VERSION.SDK_INT < 30) return

    val webViewMilestone = WebView.getCurrentWebViewPackage()
      ?.versionName
      ?.substringBefore('.')
      ?.toIntOrNull()
    if (webViewMilestone != null && webViewMilestone >= 139) return

    val content = findViewById<ViewGroup>(android.R.id.content)
    content.setOnApplyWindowInsetsListener { _, insets ->
      val child = content.getChildAt(0) ?: return@setOnApplyWindowInsetsListener insets
      val imeBottom = insets.getInsets(WindowInsets.Type.ime()).bottom
      val availableHeight = content.height - imeBottom
      val targetHeight = if (imeBottom > 0 && availableHeight > 0) {
        availableHeight
      } else {
        ViewGroup.LayoutParams.MATCH_PARENT
      }
      if (child.layoutParams.height != targetHeight) {
        child.layoutParams = child.layoutParams.apply { height = targetHeight }
      }
      insets
    }
    content.requestApplyInsets()
  }
}
