package com.shruggietech.glitchpad.performance

import android.os.Build
import android.os.Bundle
import android.os.Debug
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PerformanceInstrumentedTest {
    @Test
    fun idlePssProducesContentFreeInstrumentationEvidence() {
        assertTrue("reference API must be governed", Build.VERSION.SDK_INT == 24 || Build.VERSION.SDK_INT == 36)
        val samples = LongArray(5) { Debug.getPss().toLong() * 1024L }
        assertTrue("PSS samples must be positive", samples.all { it > 0L })
        val evidence = JSONObject()
            .put("schema_version", 1)
            .put("metric_id", "idle_android_pss")
            .put("profile_id", "android_api${Build.VERSION.SDK_INT}_reference_v1")
            .put("method", "android-debug-get-pss-v1")
            .put("samples", JSONArray(samples.toList()))
            .put("peak_memory_bytes", samples.maxOrNull())
            .put("cleanup_complete", true)
        InstrumentationRegistry.getInstrumentation().sendStatus(
            0,
            Bundle().apply { putString("performance_evidence", evidence.toString()) },
        )
    }
}
