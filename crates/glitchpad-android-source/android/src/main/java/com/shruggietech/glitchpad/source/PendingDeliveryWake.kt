package com.shruggietech.glitchpad.source

/** One lifecycle-owned readiness notification after the WebView can run again. */
internal class PendingDeliveryWake(
  private val hasPending: () -> Boolean,
  private val post: (Runnable) -> Unit,
  private val remove: (Runnable) -> Unit,
  private val notifyReady: () -> Unit,
) {
  private var scheduled: Runnable? = null

  fun schedule() {
    if (scheduled != null || !hasPending()) return
    val task = object : Runnable {
      override fun run() {
        if (scheduled !== this) return
        scheduled = null
        if (hasPending()) notifyReady()
      }
    }
    scheduled = task
    post(task)
  }

  fun cancel() {
    val task = scheduled ?: return
    scheduled = null
    remove(task)
  }
}
