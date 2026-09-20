package com.shruggietech.glitchpad.shell

import android.graphics.Color
import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout

/** A deterministic, test-only IME used to exercise real WebView resize geometry. */
class FixtureInputMethodService : InputMethodService() {
    override fun onEvaluateFullscreenMode(): Boolean = false

    override fun onCreateInputView(): View {
        val height = (240 * resources.displayMetrics.density).toInt()
        return FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(24, 24, 24))
            minimumHeight = height
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, height)
        }
    }
}
