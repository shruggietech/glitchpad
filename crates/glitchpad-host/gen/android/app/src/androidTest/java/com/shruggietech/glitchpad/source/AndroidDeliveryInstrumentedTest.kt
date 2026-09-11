package com.shruggietech.glitchpad.source

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.provider.DocumentsContract
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.shruggietech.glitchpad.MainActivity
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidDeliveryInstrumentedTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val clientContext = instrumentation.targetContext
  private val resolver = clientContext.contentResolver
  private val grantedUris = mutableSetOf<Uri>()

  @After
  fun revokeFixtureGrants() {
    grantedUris.forEach { uri ->
      instrumentation.context.revokeUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    grantedUris.clear()
  }

  @Test
  fun resolvedIntentDisplaysColdAndWarmProviderDocuments() {
    val cold = grant(documentUri("resolver-cold"))
    val warm = grant(documentUri("resolver-warm"))
    val coldIntent = viewIntent(cold, "text/markdown")
    val component = requireNotNull(glitchpadComponent(coldIntent)) {
      "installed Glitchpad package did not resolve the cold fixture"
    }

    val scenario = ActivityScenario.launch<MainActivity>(coldIntent.setComponent(component))
    waitForBodyText(scenario, "resolver-cold.md", "S031_COLD_MARKER_4F2A")
    val warmIntent = viewIntent(warm, "text/plain")
    assertTrue("installed Glitchpad package did not resolve the warm fixture", glitchpadComponent(warmIntent) != null)
    clientContext.startActivity(warmIntent.setComponent(component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    waitForBodyText(scenario, "resolver-warm.txt", "S031_WARM_MARKER_7C9D")
    println("delivery_evidence=cold:pass,warm:pass,api:${android.os.Build.VERSION.SDK_INT}")
    System.out.flush()
    // This test runs alone because MainActivity owns the Tauri process. Closing
    // it after the flushed evidence marker lets the dedicated runner terminate.
    scenario.close()
  }

  private fun viewIntent(uri: Uri, mediaType: String): Intent =
    Intent(Intent.ACTION_VIEW)
      .addCategory(Intent.CATEGORY_DEFAULT)
      .setDataAndType(uri, mediaType)
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

  @Suppress("DEPRECATION")
  private fun glitchpadComponent(intent: Intent): ComponentName? =
    clientContext.packageManager
      .queryIntentActivities(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
      .firstOrNull { result -> result.activityInfo.packageName == TARGET_PACKAGE }
      ?.activityInfo
      ?.let { activity -> ComponentName(activity.packageName, activity.name) }

  private fun grant(uri: Uri): Uri {
    resolver.call(FixtureGrantProvider.COMMAND_URI, FixtureGrantProvider.METHOD_GRANT, uri.toString(), null)
    resolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID), null, null, null).use { cursor ->
      assertTrue("fixture provider must expose the granted document", cursor != null && cursor.moveToFirst())
    }
    grantedUris.add(uri)
    return uri
  }

  private fun waitForBodyText(scenario: ActivityScenario<MainActivity>, vararg expected: String) {
    // API 36 hosted emulators can remain CPU-bound while Google services settle.
    // Preserve the strict marker assertion while allowing WebView startup to finish.
    val deadline = SystemClock.elapsedRealtime() + 60_000L
    var latest = ""
    while (SystemClock.elapsedRealtime() < deadline) {
      val webView = AtomicReference<WebView?>()
      scenario.onActivity { activity -> webView.set(findWebView(activity.window.decorView)) }
      webView.get()?.let { view -> bodyText(view)?.let { text -> latest = text } }
      if (expected.all(latest::contains)) return
      SystemClock.sleep(100L)
    }
    throw AssertionError("document surface did not expose expected synthetic evidence; observed length=${latest.length}")
  }

  private fun bodyText(webView: WebView): String? {
    val result = AtomicReference("")
    val latch = CountDownLatch(1)
    instrumentation.runOnMainSync {
      webView.evaluateJavascript("document.body ? document.body.innerText : ''") { value ->
        result.set(value ?: "")
        latch.countDown()
      }
    }
    return if (latch.await(2, TimeUnit.SECONDS)) result.get() else null
  }

  private fun findWebView(view: View): WebView? {
    if (view is WebView) return view
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) {
        findWebView(view.getChildAt(index))?.let { return it }
      }
    }
    return null
  }

  private fun documentUri(id: String): Uri = DocumentsContract.buildDocumentUri(FIXTURE_AUTHORITY, id)

  companion object {
    private const val TARGET_PACKAGE = "com.shruggietech.glitchpad"
    private const val FIXTURE_AUTHORITY = "com.shruggietech.glitchpad.fixture.documents"
  }
}
