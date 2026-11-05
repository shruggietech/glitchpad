package com.shruggietech.glitchpad.source

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent

class DiagnosticShareReceiver : BroadcastReceiver() {
  @Suppress("DEPRECATION")
  override fun onReceive(context: Context, intent: Intent) {
    val selected = intent.getParcelableExtra<ComponentName>(Intent.EXTRA_CHOSEN_COMPONENT)
    val token = intent.getStringExtra("token") ?: return
    if (selected != null) DiagnosticShareSelections.selected(token)
  }
}
