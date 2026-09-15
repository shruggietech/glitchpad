package com.shruggietech.glitchpad.source

import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

/** Registration and early cancellation share one bounded owner/request authority. */
internal class ImageExportCancellations {
  private val active = mutableMapOf<String, AtomicBoolean>()
  private val pending = linkedSetOf<String>()

  private fun validate(request: String) {
    if (request.length != 36 || runCatching { UUID.fromString(request) }.isFailure) throw IllegalStateException("invalid_request")
  }

  @Synchronized fun register(request: String): AtomicBoolean {
    validate(request)
    if (pending.remove(request)) throw IllegalStateException("export_cancelled")
    if (active.isNotEmpty()) throw IllegalStateException("export_busy")
    return AtomicBoolean(false).also { active[request] = it }
  }

  @Synchronized fun cancel(request: String) {
    validate(request)
    active[request]?.let { it.set(true); return }
    if (pending.size == 64 && !pending.contains(request)) pending.remove(pending.first())
    pending.add(request)
  }

  @Synchronized fun flag(request: String): AtomicBoolean? = active[request]
  @Synchronized fun finish(request: String) { active.remove(request) }
}
