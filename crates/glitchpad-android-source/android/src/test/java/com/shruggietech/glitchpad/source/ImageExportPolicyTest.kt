package com.shruggietech.glitchpad.source

import org.junit.Assert.assertEquals
import org.junit.Test

class ImageExportPolicyTest {
  @Test fun readbackChecksActualBytesRatherThanInitialBufferCapacity() {
    assertEquals(3, ImageExportPolicy.readGenerated(byteArrayOf(1,2,3).inputStream(), 3).size)
    refuses("budget_exceeded") { ImageExportPolicy.readGenerated(byteArrayOf(1,2,3,4).inputStream(), 3) }
  }

  private fun refuses(code: String, operation: () -> Unit) {
    try { operation(); throw AssertionError("unsafe export was accepted") }
    catch (error: IllegalStateException) { assertEquals(code, error.message) }
  }

  @Test fun rejectsOriginalAliasesWeakAndExistingDestinationsBeforeWrite() {
    refuses("original_destination_denied") { ImageExportPolicy.destination("provider", "original", "provider", "original", 0) }
    refuses("independent_destination_required") { ImageExportPolicy.destination("provider", null, "provider", "new", 0) }
    refuses("destination_conflict") { ImageExportPolicy.destination("provider", "original", "provider", "new", 4) }
    refuses("destination_conflict") { ImageExportPolicy.destination("provider", "original", "provider", "new", null) }
    ImageExportPolicy.destination("provider", "original", "provider", "new", 0)
  }

  @Test fun stopsStaleRevokedAndCancelledSourceIntents() {
    refuses("source_changed") { ImageExportPolicy.source("before", "after", false, true) }
    refuses("source_changed") { ImageExportPolicy.source("same", "same", true, true) }
    refuses("source_changed") { ImageExportPolicy.source("same", "same", false, false) }
    ImageExportPolicy.source("same", "same", false, true)
  }

  @Test fun rejectsPartialAndCancelledWritesAndVerifiesCompleteBytes() {
    val pixels = byteArrayOf(1,2,3)
    refuses("write_verification_failed") { ImageExportPolicy.verified(pixels, byteArrayOf(1,2), false) }
    refuses("write_verification_failed") { ImageExportPolicy.verified(pixels, pixels, true) }
    ImageExportPolicy.verified(pixels, pixels.copyOf(), false)
  }
}
