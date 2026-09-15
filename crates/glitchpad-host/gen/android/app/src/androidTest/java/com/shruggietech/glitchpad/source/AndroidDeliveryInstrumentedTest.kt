package com.shruggietech.glitchpad.source

import android.app.Activity
import android.app.Instrumentation.ActivityResult
import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.graphics.BitmapFactory
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
import java.util.UUID
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
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
      instrumentation.context.revokeUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
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
    for (extension in listOf("png", "jpg", "webp", "bmp", "tiff")) {
      val uri = grant(documentUri("original.$extension"))
      val before = resolver.openInputStream(uri)!!.use { it.readBytes() }
      // Explicit internal delivery exercises the already granted provider path;
      // image associations and public ACTION_VIEW intent filters stay deferred.
      clientContext.startActivity(viewIntent(uri, "image/*").setComponent(component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      waitForBodyText(scenario, "original.$extension", "Actual size", "Background")
      waitForImagePixels(scenario, "original.$extension")
      val after = resolver.openInputStream(uri)!!.use { it.readBytes() }
      assertTrue("raster preview changed original provider bytes", before.contentEquals(after))
    }
    for (name in listOf("original.gif", "animated.webp", "original.svg", "entries.ico")) {
      val uri = grant(documentUri(name))
      val before = resolver.openInputStream(uri)!!.use { it.readBytes() }
      clientContext.startActivity(viewIntent(uri, "image/*").setComponent(component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      waitForImagePixels(scenario, name)
      if (name.endsWith("gif") || name == "animated.webp") {
        waitForBodyText(scenario, "Play", "Next frame")
        evaluate(scenario, "(()=>{window.__s040PreviousPreview=document.querySelector('.image-preview').src;const next=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Next frame');next.click();return true;})()")
        waitForImagePixels(scenario, name, true)
        waitForBodyText(scenario, "of " + if (name.endsWith("gif")) "4" else "2")
      }
      if (name.endsWith("ico")) {
        waitForBodyText(scenario, "Export selected entry as PNG", "dib", "duplicate")
        evaluate(scenario, "(()=>{window.__s040PreviousPreview=document.querySelector('.image-preview').src;const entries=document.querySelector('select[aria-label=\"Icon entry\"]');entries.value='1';entries.dispatchEvent(new Event('change',{bubbles:true}));return true;})()")
        waitForImagePixels(scenario, name, true)
        verifySelectedIconExport(scenario, uri, before)
      }
      assertTrue("image-family preview changed original provider bytes", before.contentEquals(resolver.openInputStream(uri)!!.use { it.readBytes() }))
    }
    val hostile = grant(documentUri("hostile.svg"))
    clientContext.startActivity(viewIntent(hostile, "image/*").setComponent(component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    waitForBodyText(scenario, "hostile.svg", "Image preview unavailable")
    println("image_family_evidence=gif:pass,animated_webp:pass,svg:pass,ico_png_dib:pass,hostile_svg:refused,source_unchanged:pass,api:${android.os.Build.VERSION.SDK_INT}")
    println("image_evidence=png:pass,jpeg:pass,webp:pass,bmp:pass,tiff:pass,source_unchanged:pass,api:${android.os.Build.VERSION.SDK_INT}")
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

  private fun exportChoice(scenario: ActivityScenario<MainActivity>, result: ActivityResult, expected: String) {
    val filter = IntentFilter(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      addDataType("image/png")
    }
    val monitor = instrumentation.addMonitor(filter, result, true)
    try {
      evaluate(scenario, "(()=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Export selected entry as PNG');button.click();return true;})()")
      waitForBodyText(scenario, expected)
      assertEquals("explicit native PNG chooser must be invoked exactly once", 1, monitor.hits)
    } finally { instrumentation.removeMonitor(monitor) }
  }

  private fun verifySelectedIconExport(scenario: ActivityScenario<MainActivity>, original: Uri, before: ByteArray) {
    val root = grant(documentUri("fixture-root"))
    val created = requireNotNull(DocumentsContract.createDocument(resolver, root, "image/png", "s040-export-${UUID.randomUUID()}.png"))
    val destination = grant(created)
    val misreported = grant(requireNotNull(DocumentsContract.createDocument(resolver, root, "image/png", "s040-misreported-${UUID.randomUUID()}.png")))
    val concurrent = "existing provider bytes".toByteArray(Charsets.UTF_8)
    resolver.openOutputStream(misreported, "w")!!.use { it.write(concurrent) }
    fun chosen(uri: Uri) = ActivityResult(Activity.RESULT_OK, Intent().setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION))
    try {
      exportChoice(scenario, ActivityResult(Activity.RESULT_CANCELED, Intent()), "Export cancelled.")
      assertTrue("cancelled chooser must leave destination empty", resolver.openInputStream(destination)!!.use { it.readBytes() }.isEmpty())
      exportChoice(scenario, chosen(original), "Export could not complete safely.")
      assertTrue("original chooser destination must remain unchanged", before.contentEquals(resolver.openInputStream(original)!!.use { it.readBytes() }))
      exportChoice(scenario, chosen(destination), "Selected entry exported as PNG.")
      val bytes = resolver.openInputStream(destination)!!.use { it.readBytes() }
      assertTrue("selected export must be a PNG", bytes.copyOfRange(0, 8).contentEquals(byteArrayOf(137.toByte(),80,78,71,13,10,26,10)))
      val bitmap = requireNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size))
      val expected = resolver.openInputStream(grant(documentUri("original.png")))!!.use { requireNotNull(BitmapFactory.decodeStream(it)) }
      assertEquals(4, bitmap.width)
      assertEquals(3, bitmap.height)
      for (y in 0 until 3) for (x in 0 until 4) assertEquals("selected DIB pixels must match independent PNG fixture", expected.getPixel(x,y), bitmap.getPixel(x,y))
      bitmap.recycle(); expected.recycle()
      exportChoice(scenario, chosen(misreported), "Export could not complete safely.")
      assertTrue("misreported-size destination must survive without truncation", concurrent.contentEquals(resolver.openInputStream(misreported)!!.use { it.readBytes() }))
      exportChoice(scenario, ActivityResult(Activity.RESULT_CANCELED, Intent()), "Export cancelled.")
      exportChoice(scenario, chosen(destination), "Export could not complete safely.")
      assertTrue("existing destination conflict must preserve complete bytes", bytes.contentEquals(resolver.openInputStream(destination)!!.use { it.readBytes() }))
      assertTrue("generated export must preserve original source", before.contentEquals(resolver.openInputStream(original)!!.use { it.readBytes() }))
      println("image_export_evidence=cancel:pass,original_denied:pass,selected_dib_png:pass,existing_conflict:pass,misreported_size:pass,source_unchanged:pass,api:${android.os.Build.VERSION.SDK_INT}")
    } finally { DocumentsContract.deleteDocument(resolver, destination); DocumentsContract.deleteDocument(resolver, misreported) }
  }

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

  private fun evaluate(scenario: ActivityScenario<MainActivity>, script: String) {
    val view = AtomicReference<WebView?>()
    scenario.onActivity { view.set(findWebView(it.window.decorView)) }
    val latch = CountDownLatch(1)
    instrumentation.runOnMainSync { requireNotNull(view.get()).evaluateJavascript(script) { latch.countDown() } }
    assertTrue("WebView image control did not complete", latch.await(2, TimeUnit.SECONDS))
  }

  private fun waitForImagePixels(scenario: ActivityScenario<MainActivity>, expectedName: String, changed: Boolean = false) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    val expectedLiteral = JSONObject.quote(expectedName)
    var latest = "no WebView evidence"
    while (SystemClock.elapsedRealtime() < deadline) {
      val view = AtomicReference<WebView?>()
      scenario.onActivity { view.set(findWebView(it.window.decorView)) }
      val result = AtomicReference("")
      val latch = CountDownLatch(1)
      view.get()?.let { webView ->
        instrumentation.runOnMainSync {
          webView.evaluateJavascript("(()=>{const image=document.querySelector('.image-preview');const background=document.querySelector('select[aria-label=\"Image background\"]');const status=document.querySelector('.image-status');const matches=!!image && image.alt===$expectedLiteral;const blob=!!image && image.src.startsWith('blob:');const changed=!$changed || (!!image && image.src!==window.__s040PreviousPreview);return {pass:changed && !!background && matches && image.complete && image.naturalWidth===4 && image.naturalHeight===3 && blob,matches:matches,complete:!!image && image.complete,width:image ? image.naturalWidth : 0,height:image ? image.naturalHeight : 0,blob:blob,background:!!background,status:status ? status.textContent.slice(0,256) : ''};})()") {
            result.set(it ?: "")
            latch.countDown()
          }
        }
        if (latch.await(2, TimeUnit.SECONDS)) {
          latest = result.get()
          if (latest.startsWith("{") && JSONObject(latest).optBoolean("pass")) return
        }
      }
      SystemClock.sleep(100L)
    }
    throw AssertionError("bounded raster did not produce the expected inert image pixels for $expectedName; $latest")
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
