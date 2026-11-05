package com.shruggietech.glitchpad.source

import java.util.concurrent.ConcurrentHashMap

/** A one-shot chooser selection is a handoff, never proof of recipient delivery. */
internal object DiagnosticShareSelections {
  private val pending = ConcurrentHashMap<String, () -> Unit>()
  fun register(token: String, selected: () -> Unit) {
    if (pending.size >= 16) throw IllegalStateException("share_capacity_exceeded")
    pending[token] = selected
  }
  fun selected(token: String) { pending.remove(token)?.invoke() }
  fun remove(token: String) { pending.remove(token) }
}
