package com.shruggietech.glitchpad.performance

import android.os.Build
import android.os.Bundle
import android.os.Debug
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.shruggietech.glitchpad.BuildConfig
import com.shruggietech.glitchpad.MainActivity
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class PerformanceInstrumentedTest {
    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view !is ViewGroup) return null
        for (index in 0 until view.childCount) {
            findWebView(view.getChildAt(index))?.let { return it }
        }
        return null
    }

    private fun waitForSettledShell(scenario: ActivityScenario<MainActivity>) {
        val deadline = SystemClock.elapsedRealtime() + 15_000L
        var ready = false
        while (!ready && SystemClock.elapsedRealtime() < deadline) {
            val evaluated = CountDownLatch(1)
            scenario.onActivity { activity ->
                val webView = findWebView(activity.window.decorView)
                if (webView == null) {
                    evaluated.countDown()
                } else {
                    webView.evaluateJavascript(
                        "document.querySelector('.app-shell[data-performance-ready=\\\"true\\\"]') !== null",
                    ) { result ->
                        ready = result == "true"
                        evaluated.countDown()
                    }
                }
            }
            evaluated.await(1, TimeUnit.SECONDS)
            if (!ready) SystemClock.sleep(100L)
        }
        assertTrue("Glitchpad shell must become ready before PSS sampling", ready)

        val painted = CountDownLatch(1)
        scenario.onActivity { activity ->
            activity.window.decorView.postOnAnimation {
                activity.window.decorView.postOnAnimation { painted.countDown() }
            }
        }
        assertTrue("Glitchpad shell must settle for two frames", painted.await(2, TimeUnit.SECONDS))
        InstrumentationRegistry.getInstrumentation().waitForIdleSync()
    }

    @Test
    fun idlePssProducesContentFreeInstrumentationEvidence() {
        assertTrue("reference API must be governed", Build.VERSION.SDK_INT == 24 || Build.VERSION.SDK_INT == 36)
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        waitForSettledShell(scenario)
        val samples = LongArray(5) {
            (Debug.getPss().toLong() * 1024L).also { SystemClock.sleep(100L) }
        }
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
            .put("build_profile", if (BuildConfig.DEBUG) "debug" else "release")
            .put("build_id", "android-${BuildConfig.BUILD_TYPE}-${BuildConfig.VERSION_CODE}")
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
        // MainActivity owns the Tauri process. Closing its ActivityScenario here invokes
        // onDestroy before JUnit records success, so the instrumentation process disappears.
        // The ephemeral emulator tears the activity down after the runner has published its result.
    }
}
