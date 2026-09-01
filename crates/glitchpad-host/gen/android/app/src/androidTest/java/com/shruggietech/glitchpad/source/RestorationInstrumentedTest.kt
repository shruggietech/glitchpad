package com.shruggietech.glitchpad.source

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RestorationInstrumentedTest {
  @Test
  fun privateRestorationRecordSurvivesProcessBoundary() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val preferences = instrumentation.targetContext.getSharedPreferences("s011-restoration-fixture", 0)
    when (instrumentation.arguments.getString("restorationPhase")) {
      "seed" -> preferences.edit().putString("identity", "fixture:seekable.txt").commit()
      "verify" -> assertEquals("fixture:seekable.txt", preferences.getString("identity", null))
      else -> {
        preferences.edit().putString("identity", "fixture:seekable.txt").commit()
        assertEquals("fixture:seekable.txt", preferences.getString("identity", null))
      }
    }
  }
}
