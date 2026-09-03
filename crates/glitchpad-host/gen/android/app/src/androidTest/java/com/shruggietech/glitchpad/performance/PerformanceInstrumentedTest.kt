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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@RunWith(AndroidJUnit4::class)
class PerformanceInstrumentedTest {
    @Test
    fun idlePssProducesContentFreeInstrumentationEvidence() {
        assertTrue("reference API must be governed", Build.VERSION.SDK_INT == 24 || Build.VERSION.SDK_INT == 36)
        val samples = LongArray(5) { Debug.getPss().toLong() * 1024L }
        assertTrue("PSS samples must be positive", samples.all { it > 0L })
        val sorted = samples.sorted()
        val maximum = sorted.last()
        val classification = when {
            maximum <= 188743680L -> "pass"
            maximum <= 268435456L -> "warning"
            else -> "failure"
        }
        val measuredAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
        val evidence = JSONObject()
            .put("schema_version", 1)
            .put("catalog_version", "v0.1.0-performance-1")
            .put("metric_id", "idle_android_pss")
            .put("scenario_id", "idle_application")
            .put("profile_id", "android_api${Build.VERSION.SDK_INT}_reference_v1")
            .put("evidence_class", "reference")
            .put("build_profile", "release")
            .put("build_id", "android-api${Build.VERSION.SDK_INT}-instrumented")
            .put("runtime_version", "android-api${Build.VERSION.SDK_INT}")
            .put("cold_state", false)
            .put("method", "android-debug-get-pss-v1")
            .put("samples", JSONArray(samples.toList()))
            .put("median", sorted[2])
            .put("p95", maximum)
            .put("maximum", maximum)
            .put("peak_memory_bytes", maximum)
            .put("invariants", JSONObject())
            .put("classification", classification)
            .put("cleanup_complete", true)
            .put("measured_at", measuredAt)
        InstrumentationRegistry.getInstrumentation().sendStatus(
            0,
            Bundle().apply { putString("performance_evidence", evidence.toString()) },
        )
    }
}
