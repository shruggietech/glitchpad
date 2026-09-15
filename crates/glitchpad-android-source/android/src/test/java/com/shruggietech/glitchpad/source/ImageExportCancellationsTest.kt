package com.shruggietech.glitchpad.source

import java.util.UUID
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Test

class ImageExportCancellationsTest {
  private fun refuses(code: String, operation: () -> Unit) {
    try { operation(); throw AssertionError("unsafe export was registered") }
    catch (error: IllegalStateException) { assertEquals(code, error.message) }
  }

  @Test fun cancellationBeforeRegistrationPreventsPickerAuthority() {
    val requests = ImageExportCancellations()
    val id = UUID.randomUUID().toString()
    requests.cancel(id)
    refuses("export_cancelled") { requests.register(id) }
    assertNull(requests.flag(id))
    assertFalse(requests.register(UUID.randomUUID().toString()).get())
  }

  @Test fun activeAndLateCancellationCannotCancelAnotherOwner() {
    val requests = ImageExportCancellations()
    val old = UUID.randomUUID().toString()
    val flag = requests.register(old)
    requests.cancel(old)
    assertTrue(flag.get())
    requests.finish(old)
    val next = requests.register(UUID.randomUUID().toString())
    requests.cancel(old)
    assertFalse(next.get())
  }

  @Test fun earlyCancellationMarkersAreBoundedAndIdentifiersValidated() {
    val requests = ImageExportCancellations()
    val ids = List(65) { UUID.randomUUID().toString() }
    ids.forEach(requests::cancel)
    assertFalse(requests.register(ids.first()).get())
    requests.finish(ids.first())
    refuses("export_cancelled") { requests.register(ids.last()) }
    refuses("invalid_request") { requests.cancel("bad") }
  }
}
