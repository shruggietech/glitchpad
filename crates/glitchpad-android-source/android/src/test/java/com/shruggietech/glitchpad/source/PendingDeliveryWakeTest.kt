package com.shruggietech.glitchpad.source

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PendingDeliveryWakeTest {
  @Test
  fun oneResumeFrameReannouncesPendingWorkWithoutPolling() {
    var pending = false
    val posted = mutableListOf<Runnable>()
    var notifications = 0
    val wake = PendingDeliveryWake({ pending }, { posted.add(it) }, {}, { notifications++ })
    wake.schedule()
    assertTrue(posted.isEmpty())
    pending = true
    wake.schedule()
    wake.schedule()
    assertEquals(1, posted.size)
    posted.single().run()
    assertEquals(1, notifications)
    assertEquals(1, posted.size)
  }

  @Test
  fun anImmediateDrainBeforeActivationMakesTheWakeUnnecessary() {
    var pending = true
    val posted = mutableListOf<Runnable>()
    var notifications = 0
    val wake = PendingDeliveryWake({ pending }, { posted.add(it) }, {}, { notifications++ })
    wake.schedule()
    pending = false
    posted.single().run()
    assertEquals(0, notifications)
    assertEquals(1, posted.size)
  }

  @Test
  fun pauseCancelsTheOwnedFrameAndAStaleCallbackCannotConsumeANewerResume() {
    val posted = mutableListOf<Runnable>()
    val removed = mutableListOf<Runnable>()
    var notifications = 0
    val wake = PendingDeliveryWake({ true }, { posted.add(it) }, { removed.add(it) }, { notifications++ })
    wake.schedule()
    val stale = posted.single()
    wake.cancel()
    wake.cancel()
    assertEquals(listOf(stale), removed)
    wake.schedule()
    stale.run()
    assertEquals(0, notifications)
    posted.last().run()
    assertEquals(1, notifications)
  }
}
