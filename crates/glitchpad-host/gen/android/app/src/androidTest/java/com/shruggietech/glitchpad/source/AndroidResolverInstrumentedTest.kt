package com.shruggietech.glitchpad.source

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidResolverInstrumentedTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val clientContext = instrumentation.targetContext

  @Test
  fun installedPackageResolvesEveryGovernedExactTypeForOpaqueContentUris() {
    EXACT_MEDIA_TYPES.forEachIndexed { index, mediaType ->
      val uri = Uri.parse("content://com.shruggietech.synthetic/document/opaque-$index")
      assertTrue("Glitchpad must resolve $mediaType", resolvesGlitchpad(viewIntent(uri, mediaType)))
    }
    BROAD_REQUEST_MEDIA_TYPES.forEachIndexed { index, mediaType ->
      val uri = Uri.parse("content://com.shruggietech.synthetic/document/broad-$index")
      assertTrue("Android wildcard request must match a governed exact type for $mediaType", resolvesGlitchpad(viewIntent(uri, mediaType)))
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
    println("resolver_evidence=exact:${EXACT_MEDIA_TYPES.size},broad:${BROAD_REQUEST_MEDIA_TYPES.size},negative:${negativeCases.size},api:${android.os.Build.VERSION.SDK_INT}")
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

  companion object {
    private const val TARGET_PACKAGE = "com.shruggietech.glitchpad"
    private val BROAD_REQUEST_MEDIA_TYPES = listOf("*/*", "application/*", "text/*")
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
