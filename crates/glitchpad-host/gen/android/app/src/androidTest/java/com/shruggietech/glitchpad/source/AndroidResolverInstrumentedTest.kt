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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidResolverInstrumentedTest {
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
  fun installedPackageResolvesEveryGovernedExactTypeForOpaqueContentUris() {
    EXACT_MEDIA_TYPES.forEachIndexed { index, mediaType ->
      val uri = Uri.parse("content://com.shruggietech.synthetic/document/opaque-$index")
      assertTrue("Glitchpad must resolve $mediaType", resolvesGlitchpad(viewIntent(uri, mediaType)))
    }

    val negativeCases = listOf(
      viewIntent(Uri.parse("file:///tmp/private.md"), "text/markdown"),
      viewIntent(Uri.parse("content://com.shruggietech.synthetic/document/image"), "image/png"),
      viewIntent(Uri.parse("content://com.shruggietech.synthetic/document/pdf"), "application/pdf"),
      viewIntent(Uri.parse("content://com.shruggietech.synthetic/document/docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      viewIntent(Uri.parse("content://com.shruggietech.synthetic/document/odt"), "application/vnd.oasis.opendocument.text"),
      viewIntent(Uri.parse("content://com.shruggietech.synthetic/document/opaque.md"), "application/octet-stream"),
      viewIntent(Uri.parse("content://com.shruggietech.synthetic/document/opaque"), "application/octet-stream"),
      Intent(Intent.ACTION_SEND_MULTIPLE).setType("text/plain").addCategory(Intent.CATEGORY_DEFAULT),
    )
    negativeCases.forEach { intent ->
      assertFalse("Glitchpad must reject ${intent.action} ${intent.type}", resolvesGlitchpad(intent))
    }
    println("resolver_evidence=exact:${EXACT_MEDIA_TYPES.size},negative:${negativeCases.size},api:${android.os.Build.VERSION.SDK_INT}")
  }

  @Test
  fun resolvedIntentDisplaysColdAndWarmProviderDocuments() {
    val cold = grant(documentUri("resolver-cold"))
    val warm = grant(documentUri("resolver-warm"))
    val coldIntent = viewIntent(cold, "text/markdown")
    val component = requireNotNull(glitchpadComponent(coldIntent)) {
      "installed Glitchpad package did not resolve the cold fixture"
    }

    ActivityScenario.launch<MainActivity>(coldIntent.setComponent(component)).use { scenario ->
      waitForBodyText(scenario, "resolver-cold.md", "S031_COLD_MARKER_4F2A")
      val warmIntent = viewIntent(warm, "text/plain")
      assertTrue("installed Glitchpad package did not resolve the warm fixture", resolvesGlitchpad(warmIntent))
      clientContext.startActivity(warmIntent.setComponent(component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      waitForBodyText(scenario, "resolver-warm.txt", "S031_WARM_MARKER_7C9D")
    }
    println("delivery_evidence=cold:pass,warm:pass,api:${android.os.Build.VERSION.SDK_INT}")
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

  private fun resolvesGlitchpad(intent: Intent): Boolean = glitchpadComponent(intent) != null

  private fun grant(uri: Uri): Uri {
    resolver.call(FixtureGrantProvider.COMMAND_URI, FixtureGrantProvider.METHOD_GRANT, uri.toString(), null)
    resolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID), null, null, null).use { cursor ->
      assertTrue("fixture provider must expose the granted document", cursor != null && cursor.moveToFirst())
    }
    grantedUris.add(uri)
    return uri
  }

  private fun waitForBodyText(scenario: ActivityScenario<MainActivity>, vararg expected: String) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    var latest = ""
    while (SystemClock.elapsedRealtime() < deadline) {
      val webView = AtomicReference<WebView?>()
      scenario.onActivity { activity -> webView.set(findWebView(activity.window.decorView)) }
      webView.get()?.let { latest = bodyText(it) }
      if (expected.all(latest::contains)) return
      SystemClock.sleep(100L)
    }
    throw AssertionError("document surface did not expose expected synthetic evidence; observed length=${latest.length}")
  }

  private fun bodyText(webView: WebView): String {
    val result = AtomicReference("")
    val latch = CountDownLatch(1)
    instrumentation.runOnMainSync {
      webView.evaluateJavascript("document.body ? document.body.innerText : ''") { value ->
        result.set(value ?: "")
        latch.countDown()
      }
    }
    assertTrue("WebView body text callback timed out", latch.await(2, TimeUnit.SECONDS))
    return result.get()
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
    private val EXACT_MEDIA_TYPES = listOf(
      "application/json",
      "application/toml",
      "application/x-typescript",
      "application/x-yaml",
      "text/css",
      "text/html",
      "text/javascript",
      "text/markdown",
      "text/plain",
      "text/rust",
      "text/vnd.mermaid",
      "text/x-python",
    )
  }
}
