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
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.os.Build
import androidx.webkit.WebViewCompat
import java.io.File
import java.security.MessageDigest
import org.json.JSONArray
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
    try {
      waitForBodyText(scenario, "resolver-cold.md", "S031_COLD_MARKER_4F2A")
    } catch (failure: AssertionError) {
      captureMarkdownDeliveryFailure(scenario, "resolver-cold.md")
      throw failure
    }
    val warmIntent = viewIntent(warm, "text/plain")
    assertTrue("installed Glitchpad package did not resolve the warm fixture", glitchpadComponent(warmIntent) != null)
    clientContext.startActivity(warmIntent.setComponent(component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    try {
      waitForBodyText(scenario, "resolver-warm.txt", "S031_WARM_MARKER_7C9D")
    } catch (failure: AssertionError) {
      captureMarkdownDeliveryFailure(scenario, "resolver-warm.txt")
      throw failure
    }
    for (extension in listOf("png", "jpg", "webp", "bmp", "tiff")) {
      val uri = grant(documentUri("original.$extension"))
      val before = resolver.openInputStream(uri)!!.use { it.readBytes() }
      // Exercise the granted provider path; AndroidResolverInstrumentedTest
      // separately checks every activated exact image MIME type.
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
        waitForBodyText(scenario, "Export selected entry as PNG")
        val inventory = JSONObject(evaluate(scenario, "(()=>{const entries=document.querySelector('select[aria-label=\"Icon entry\"]');const options=Array.from(entries.options).map(option=>option.textContent);return {count:options.length,dib:options.some(text=>text.includes('dib')),duplicate:options.some(text=>text.includes('duplicate'))};})()"))
        assertEquals("every bounded ICO directory row must be exposed", 4, inventory.getInt("count"))
        assertTrue("DIB entry facts must be available in native entry selection", inventory.getBoolean("dib"))
        assertTrue("duplicate entry facts must be available in native entry selection", inventory.getBoolean("duplicate"))
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

  @Test
  fun governedMarkdownDeliveryRoutes() {
    val route = InstrumentationRegistry.getArguments().getString("deliveryAction") ?: throw AssertionError("cold delivery action required")
    assertTrue("only the governed view/send routes may be selected", route == "view" || route == "send")
    val cold = grant(documentUri("recovery-corpus.md"))
    val coldBefore = readBytes(cold)
    val launch = markdownDeliveryIntent(cold, route)
    val component = requireNotNull(glitchpadComponent(launch)) { "installed Glitchpad package must resolve the governed cold Markdown route" }
    val scenario = ActivityScenario.launch<MainActivity>(launch.setComponent(component))
    verifyDeliveredMarkdownOutcome(scenario, "recovery-corpus.md", "positive")
    verifyMarkdownLinkBack(scenario, "recovery-corpus.md")
    assertTrue("cold delivery must preserve original corpus bytes", coldBefore.contentEquals(readBytes(cold)))
    for (warmRoute in listOf("view", "send")) {
      for ((name, outcome) in listOf("recovery-warm-corpus.md" to "positive", "recovery-empty.md" to "empty", "recovery-malformed.md" to "malformed")) {
        val uri = grant(documentUri(name))
        val before = readBytes(uri)
        val intent = markdownDeliveryIntent(uri, warmRoute)
        assertTrue("installed Glitchpad package must resolve each warm Markdown route", glitchpadComponent(intent) != null)
        clientContext.startActivity(intent.setComponent(component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        verifyDeliveredMarkdownOutcome(scenario, name, outcome)
        assertTrue("warm delivery must preserve original " + outcome + " corpus bytes", before.contentEquals(readBytes(uri)))
      }
    }
    val expectedSource = InstrumentationRegistry.getArguments().getString("expectedSource")
    assertTrue("full expected source identity must be supplied", expectedSource != null && expectedSource.matches(Regex("[0-9a-f]{40}")))
    println("markdown_delivery_evidence=" + JSONObject().put("cold_route", if (route == "view") "ACTION_VIEW" else "ACTION_SEND").put("cold_governed_corpus", "pass").put("external_link_back_modal", "pass").put("warm_action_view", "positive_empty_malformed_pass").put("warm_action_send", "positive_empty_malformed_pass").put("source_bytes_unchanged", true).put("original_incident_input_replayed", false).put("source_commit", expectedSource).put("apk_sha256", apkSha256()).put("api_level", Build.VERSION.SDK_INT).toString())
    System.out.flush()
    scenario.close()
  }

  private fun verifyMarkdownLinkBack(scenario: ActivityScenario<MainActivity>, name: String) {
    val documentId = stringValue(evaluate(scenario, "document.querySelector('.document-surface').id"))
    val linkSelector = ".document-surface .markdown-document button.markdown-link[title='https://example.invalid/s046']"
    val selector = JSONObject.quote(linkSelector)
    assertEquals("governed external link must open its confirmation", "true", evaluate(scenario, "(()=>{const link=document.querySelector(" + selector + ");if(!link)return false;link.click();return true;})()"))
    waitForBodyText(scenario, "Open external destination?", "https://example.invalid/s046", "Cancel")
    focusNativeWebView(scenario)
    instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
    waitForCondition(scenario, "(()=>{const surface=document.querySelector('.document-surface');return !document.querySelector('.markdown-link-dialog') && !!surface && surface.id===" + JSONObject.quote(documentId) + " && document.activeElement===document.querySelector(" + selector + ");})()", "native Back must dismiss the link confirmation, retain its document, and restore trigger focus")
    waitForDocumentIdentity(scenario, name)
    waitForBodyText(scenario, "S046 Markdown corpus", "S046_CORPUS_MARKER")
    clickControl(scenario, "Add document")
    waitForBodyText(scenario, "New Markdown", "Open file", "Close Add document")
    clickControl(scenario, "Close Add document")
    waitForDocumentIdentity(scenario, name)
  }

  private fun captureMarkdownDeliveryFailure(scenario: ActivityScenario<MainActivity>, name: String) {
    val snapshot = runCatching {
      evaluate(scenario, """
        (()=>{
          const surface=document.querySelector('.document-surface');
          const articles=Array.from(document.querySelectorAll('.markdown-document')).slice(0,3).map(node=>({
            class_name:node.className,
            ready:node.getAttribute('data-performance-ready'),
            status:node.getAttribute('data-performance-status'),
            diagnostic:node.getAttribute('data-performance-diagnostic'),
            text:node.textContent.slice(0,512)
          }));
          return {
            document_ready:document.readyState,
            user_agent:navigator.userAgent.slice(0,512),
            viewport:{width:window.innerWidth,height:window.innerHeight},
            active_surface_id:surface?surface.id:null,
            active_surface_label:surface?surface.getAttribute('aria-label'):null,
            active_surface_labelledby:surface?surface.getAttribute('aria-labelledby'):null,
            semantic_counts:{
              headings:document.querySelectorAll('.markdown-document h1').length,
              lists:document.querySelectorAll('.markdown-document ul').length,
              code:document.querySelectorAll('.markdown-document code').length,
              tables:document.querySelectorAll('.markdown-document table').length
            },
            source_editors:Array.from(document.querySelectorAll('.cm-content')).slice(0,2).map(node=>({editable:node.getAttribute('contenteditable'),text:node.textContent.slice(0,1024)})),
            articles:articles,
            alerts:Array.from(document.querySelectorAll('[role=alert]')).slice(0,4).map(node=>node.textContent.slice(0,512)),
            body_text:document.body?document.body.innerText.slice(0,4096):'',
            active_surface_html:surface?surface.outerHTML.slice(0,8192):null
          };
        })()
      """.trimIndent())
    }.getOrElse { JSONObject().put("capture_error", it.javaClass.simpleName).toString() }
    val screenshotName = "s046-markdown-delivery-failure.png"
    val screenshotSaved = runCatching { saveScreenshot(screenshotName); File(clientContext.filesDir, screenshotName).isFile }.getOrDefault(false)
    println("markdown_delivery_failure=" + JSONObject().put("native_route", nativeDeliveryRouteSnapshot(scenario)).put("fixture", name).put("route", InstrumentationRegistry.getArguments().getString("deliveryAction")).put("api_level", Build.VERSION.SDK_INT).put("screenshot_saved", screenshotSaved).put("state_json", snapshot.take(24576)).toString())
    System.out.flush()
  }

  private fun nativeDeliveryRouteSnapshot(scenario: ActivityScenario<MainActivity>): JSONObject {
    var result = JSONObject().put("reflection_completed", false)
    runCatching {
      scenario.onActivity {
        val field = app.tauri.plugin.PluginManager::class.java.getDeclaredField("plugins").apply { isAccessible = true }
        val handles = (field.get(app.tauri.plugin.PluginManager) as Map<*, *>).values.filterIsInstance<app.tauri.plugin.PluginHandle>()
        val matches = handles.filter { it.instance.javaClass.name == AndroidSourcePlugin::class.java.name }
        result = JSONObject().put("reflection_completed", false).put("plugin_handle_count", handles.size).put("source_instance_count", matches.size)
        val plugin = matches.singleOrNull()?.instance
        if (plugin != null) {
          val method = plugin.javaClass.getDeclaredMethod("deliveryRouteSnapshot").apply { isAccessible = true }
          result.put("route", JSONObject(requireNotNull(method.invoke(plugin)).toString())).put("reflection_completed", true)
        }
      }
    }
    return result
  }

  private fun markdownDeliveryIntent(uri: Uri, route: String): Intent = if (route == "view") viewIntent(uri, "text/markdown") else Intent(Intent.ACTION_SEND)
    .addCategory(Intent.CATEGORY_DEFAULT)
    .setType("text/markdown")
    .putExtra(Intent.EXTRA_STREAM, uri)
    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    .apply { clipData = android.content.ClipData.newRawUri("Governed Markdown fixture", uri) }

  private fun verifyDeliveredMarkdownOutcome(scenario: ActivityScenario<MainActivity>, name: String, outcome: String) {
    waitForDocumentIdentity(scenario, name)
    waitForBodyText(scenario, name, "Add document")
    if (outcome == "positive") {
      waitForBodyText(scenario, "S046 Markdown corpus", "S046_CORPUS_MARKER", "list item", "code block", "Unicode Ω")
      try {
        waitForCondition(scenario, "!!document.querySelector('.markdown-document h1') && !!document.querySelector('.markdown-document ul') && !!document.querySelector('.markdown-document code') && !!document.querySelector('.markdown-document table')", "governed OS-delivered Markdown must expose actual rendered heading/list/code/table content")
      } catch (failure: AssertionError) {
        captureMarkdownDeliveryFailure(scenario, name)
        throw failure
      }
    } else {
      waitForCondition(scenario, "!!document.querySelector('.app-shell') && (!!document.querySelector('.cm-content') || Array.from(document.querySelectorAll('.markdown-document')).some(n=>['ready','empty','failed','limited'].includes(n.getAttribute('data-performance-status'))))", "OS-delivered empty/malformed Markdown must terminate in content or actionable source recovery")
      if (outcome == "empty") waitForBodyText(scenario, "This document is empty.")
      else {
        val visibleSource = evaluate(scenario, "document.body.innerText.includes('S046_MALFORMED_MARKER')") == "true"
        if (!visibleSource) clickControl(scenario, "View source")
        waitForBodyText(scenario, "S046_MALFORMED_MARKER")
      }
    }
    assertTrue("OS delivery must retain visible Add document recovery/navigation access", JSONObject(evaluate(scenario, "(()=>{const control=document.querySelector('.add-document-trigger');const rect=control.getBoundingClientRect();return {visible:rect.width>=48&&rect.height>=48&&!control.disabled};})()")).getBoolean("visible"))
  }

  @Test
  fun standaloneAuthoringAndDiagnosticJourneys() {
    val scenario = ActivityScenario.launch<MainActivity>(Intent(clientContext, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER))
    waitForBodyText(scenario, "Add document")
    verifyAddDocumentChoices(scenario)
    val root = grant(documentUri("fixture-root"))
    val created = mutableListOf<Uri>()
    fun destination(type: String, stem: String): Uri {
      val uri = grant(requireNotNull(DocumentsContract.createDocument(resolver, root, type, stem + "-" + UUID.randomUUID() + if (type == "application/json") ".json" else if (type == "text/markdown") ".md" else ".txt")))
      created.add(uri)
      return uri
    }
    for ((choice, type, name, text) in listOf(
      listOf("New Markdown", "text/markdown", "Untitled.md", "# S046 draft\n\nS046_MARKDOWN_BYTES_Ω\n"),
      listOf("New text file", "text/plain", "Untitled.txt", "S046_TEXT_BYTES_Ω\nsecond line\n")
    )) {
      createNewDraftForInput(scenario, choice, name)
      replaceEditorText(scenario, text)
      chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, ActivityResult(Activity.RESULT_CANCELED, Intent()), { menuAction(scenario, "Save") }, "Cancelled. Your document and edits remain available.")
      waitForCondition(scenario, "!!document.querySelector('.cm-content[contenteditable=true]')", "cancelled draft must remain editable")
      val refused = destination(type, "s046-write-refused")
      chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, chosen(refused), { menuAction(scenario, "Save") }, "Save did not complete. Try again or choose another destination. Your edits remain open.")
      assertEquals("failed native write must not change its empty destination", 0, readBytes(refused).size)
      assertEquals("write refusal must retain every edited source character", text, browserEditorInputSnapshot(scenario).getString("semantic_text"))
      val saved = destination(type, "s046-draft")
      chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, chosen(saved), { if (choice == "New text file") keyboardSave(scenario) else menuAction(scenario, "Save") }, "Saved after native verification.")
      assertTrue("saved draft must match exact expected UTF-8 bytes", text.toByteArray(Charsets.UTF_8).contentEquals(readBytes(saved)))
      closeCurrentDocument(scenario)
      openFromAddDocument(scenario, saved)
      waitForBodyText(scenario, text.substringAfterLast("S046_", text).lineSequence().first().trim())
    }
    val corpus = grant(documentUri("recovery-corpus.md"))
    openFromAddDocument(scenario, corpus)
    waitForBodyText(scenario, "S046 Markdown corpus", "S046_CORPUS_MARKER", "list item", "code block", "Unicode")
    waitForCondition(scenario, "!!document.querySelector('.markdown-document h1') && !!document.querySelector('.markdown-document table')", "native Open must produce actual Markdown heading and table")
    verifyMarkdownFailures(scenario, corpus)
    for (name in listOf("recovery-empty.md", "recovery-malformed.md")) {
      openFromAddDocument(scenario, grant(documentUri(name)))
      waitForBodyText(scenario, name, "Add document")
      waitForCondition(scenario, "!!document.querySelector('.app-shell') && (!!document.querySelector('.cm-content') || Array.from(document.querySelectorAll('.markdown-document')).some(n=>['ready','empty','failed','limited'].includes(n.getAttribute('data-performance-status'))))", "empty/malformed Markdown must reach content or actionable terminal fallback")
    }
    val original = grant(documentUri("recovery-readonly.md"))
    val before = readBytes(original)
    openFromAddDocument(scenario, original)
    waitForBodyText(scenario, "S046_ORIGINAL_UNCHANGED")
    menuAction(scenario, "Edit a copy")
    waitForBodyText(scenario, "Copy of recovery-readonly.md")
    val copyText = "# S046 edited copy\n\nS046_COPY_BYTES\n"
    replaceEditorText(scenario, copyText)
    val copy = destination("text/markdown", "s046-copy")
    chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, chosen(copy), { menuAction(scenario, "Save") }, "Saved after native verification.")
    assertTrue("read-only original must survive copy editing and save", before.contentEquals(readBytes(original)))
    assertTrue("copy destination must contain the exact edited bytes", copyText.toByteArray(Charsets.UTF_8).contentEquals(readBytes(copy)))
    verifyDirtyCloseAndPendingRace(scenario, destination("text/plain", "s046-dirty-close"))
    verifySharedImageActions(scenario)
    verifyDiagnosticTasks(scenario, destination("application/json", "s046-diagnostic"), destination("application/json", "s046-write-refused-diagnostic"))
    println("recovery_evidence=launcher:pass,new_markdown:pass,new_text:pass,native_open:pass,exact_save_reopen:pass,keyboard_ctrl_s_receipt_reopen:pass,cancel:pass,failed_write:pass,readonly_copy:pass,dirty_close_pending:pass,diagnostic_save_share:pass,menu_local_zoom:pass,api:" + Build.VERSION.SDK_INT)
    System.out.flush()
    saveScreenshot("s046-authoring.png")
    created.forEach { runCatching { DocumentsContract.deleteDocument(resolver, it) } }
    scenario.close()
  }

  @Test
  fun rootFailureRetainsDraft() {
    val scenario = ActivityScenario.launch<MainActivity>(Intent(clientContext, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER))
    waitForBodyText(scenario, "Add document")
    createNewDraftForInput(scenario, "New Markdown", "Untitled.md")
    replaceEditorText(scenario, "# S046 root recovery\n\nS046_ROOT_DRAFT_RETAINED_Ω\n")
    injectRecoveryFailure(scenario, "root")
    waitForBodyText(scenario, "Glitchpad could not continue", "application_render_failed", "Restart Glitchpad")
    clickControl(scenario, "Restart Glitchpad")
    waitForBodyText(scenario, "Recover Untitled.md?")
    clickControl(scenario, "Recover")
    waitForBodyText(scenario, "S046_ROOT_DRAFT_RETAINED_Ω", "Add document")
    waitForCondition(scenario, "!!document.querySelector('.cm-content[contenteditable=true]')", "root restart must retain the editable source without fabricated provider authority")
    menuAction(scenario, "Diagnostics")
    waitForBodyText(scenario, "Redacted diagnostic preview ready")
    val preview = stringValue(evaluate(scenario, "document.querySelector('.diagnostic-preview').textContent"))
    assertTrue("root failure must survive restart in bounded diagnostic evidence", preview.contains("application_render_failed"))
    val expectedSource = InstrumentationRegistry.getArguments().getString("expectedSource")
    assertEquals(expectedSource, JSONObject(preview).getJSONObject("environment").getString("build_commit"))
    saveScreenshot("s046-root-recovery.png")
    println("root_recovery_evidence=" + JSONObject().put("root_fallback", "pass").put("draft_retained", "pass").put("diagnostic_event_retained", "pass").put("source_commit", expectedSource).put("apk_sha256", apkSha256()).put("recovery_probe_variant", "compiled_test_only").put("api_level", Build.VERSION.SDK_INT).toString())
    System.out.flush()
    scenario.close()
  }

  @Test
  fun addDocumentAtMaximumFontScale() {
    assertTrue("maximum-font row requires Android14+", Build.VERSION.SDK_INT >= 34)
    assertTrue("system font scale must actually be 200%", clientContext.resources.configuration.fontScale >= 1.99f)
    val scenario = ActivityScenario.launch<MainActivity>(Intent(clientContext, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER))
    waitForBodyText(scenario, "Add document")
    verifyAddDocumentChoices(scenario)
    scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
    waitForCondition(scenario, "window.innerWidth>window.innerHeight", "actual landscape viewport must be observed")
    waitForBodyText(scenario, "Add document")
    verifyAddDocumentChoices(scenario)
    saveScreenshot("s046-font-scale.png")
    println("recovery_font_evidence=font_scale:2.0,portrait:pass,landscape:pass,all_choices_reachable:pass,targets_48dp:pass,api:" + Build.VERSION.SDK_INT)
    System.out.flush()
    scenario.close()
  }

  @Test
  fun draftRecoveryAcrossProcessBoundary() {
    val phase = InstrumentationRegistry.getArguments().getString("recoveryPhase") ?: throw AssertionError("recovery phase required")
    val text = "# S046 retained draft\n\nS046_PROCESS_RECOVERY_Ω\n"
    val scenario = ActivityScenario.launch<MainActivity>(Intent(clientContext, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER))
    if (phase == "seed") {
      waitForBodyText(scenario, "Add document")
      createNewDraftForInput(scenario, "New Markdown", "Untitled.md")
      replaceEditorText(scenario, text)
      // The existing bounded store snapshots after two seconds idle. Native
      // lifecycle flush is exercised again when the activity closes below.
      SystemClock.sleep(3000L)
      println("draft_recovery_seed=pass,api:" + Build.VERSION.SDK_INT)
    } else {
      assertEquals("verify", phase)
      waitForBodyText(scenario, "Recover Untitled.md?")
      clickControl(scenario, "Recover")
      waitForBodyText(scenario, "S046_PROCESS_RECOVERY_Ω")
      waitForCondition(scenario, "!!document.querySelector('.cm-content[contenteditable=true]')", "recovered Markdown draft must remain editable without provider authority")
      println("draft_recovery_verify=pass,api:" + Build.VERSION.SDK_INT)
    }
    System.out.flush()
    scenario.close()
  }

  private fun verifyAddDocumentChoices(scenario: ActivityScenario<MainActivity>) {
    assertAddDocumentReachability(scenario, null)
    clickControl(scenario, "Add document")
    waitForBodyText(scenario, "New Markdown", "New text file", "Open file", "Close Add document")
    val initial = JSONObject(evaluate(scenario, "(()=>{const menu=document.querySelector('[aria-label=\"Add document choices\"]');return {count:menu.querySelectorAll('button').length,expanded:document.querySelector('.add-document-trigger').getAttribute('aria-expanded')==='true'};})()"))
    assertEquals("all four Add document menu items must be exposed", 4, initial.getInt("count"))
    assertTrue("expanded state must be exposed", initial.getBoolean("expanded"))
    // A bounded popup may scroll vertically on short or maximum-font viewports.
    // Each real control must retain its whole target and receive input after
    // local scrolling; the persistent trigger must remain reachable throughout.
    for (index in 1..4) assertAddDocumentReachability(scenario, ".add-document-menu button:nth-of-type(" + index + ")")
    clickControl(scenario, "Close Add document")
    waitForCondition(scenario, "!document.querySelector('[aria-label=\"Add document choices\"]') && document.activeElement===document.querySelector('.add-document-trigger')", "Close must restore Add document focus")
    assertAddDocumentReachability(scenario, null)
    clickControl(scenario, "Add document")
    waitForCondition(scenario, "!!document.querySelector('[aria-label=\"Add document choices\"]')", "Add document must be open before native Back")
    focusNativeWebView(scenario)
    instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
    waitForCondition(scenario, "!document.querySelector('[aria-label=\"Add document choices\"]') && !!document.querySelector('.app-shell')", "Android Back must dismiss exactly the Add document layer")
    clickControl(scenario, "Add document")
    assertEquals("true", evaluate(scenario, "(()=>{const scrim=document.querySelector('.add-document-scrim');if(!scrim)return false;const event=document.createEvent('Event');event.initEvent('pointerdown',true,true);scrim.dispatchEvent(event);return true;})()"))
    waitForCondition(scenario, "!document.querySelector('[aria-label=\"Add document choices\"]')", "outside tap must dismiss Add document")
    assertAddDocumentReachability(scenario, null)
  }

  private fun assertAddDocumentReachability(scenario: ActivityScenario<MainActivity>, choiceSelector: String?) {
    val selector = JSONObject.quote(choiceSelector ?: ".add-document-trigger")
    val script = """
      (()=>{
        const element=document.querySelector(SELECTOR);
        element.scrollIntoView({block:'nearest',inline:'nearest'});
        const viewport=window.visualViewport;
        const visible={left:viewport?viewport.offsetLeft:0,top:viewport?viewport.offsetTop:0,width:viewport?viewport.width:window.innerWidth,height:viewport?viewport.height:window.innerHeight};
        const measure=(control)=>{
          const rect=control.getBoundingClientRect();
          const menu=control.closest('.add-document-menu');
          const panel=menu?menu.getBoundingClientRect():null;
          const clip={left:Math.max(rect.left,panel?panel.left:-Infinity,visible.left),right:Math.min(rect.right,panel?panel.right:Infinity,visible.left+visible.width),top:Math.max(rect.top,panel?panel.top:-Infinity,visible.top),bottom:Math.min(rect.bottom,panel?panel.bottom:Infinity,visible.top+visible.height)};
          const hit=document.elementFromPoint((clip.left+clip.right)/2,(clip.top+clip.bottom)/2);
          return {label:control.textContent.trim(),width:rect.width,height:rect.height,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,visibleWidth:clip.right-clip.left,visibleHeight:clip.bottom-clip.top,hit:hit===control||control.contains(hit),disabled:control.disabled};
        };
        const surface=document.querySelector('.document-surface');
        const rect=surface.getBoundingClientRect();
        return {viewport:visible,action:measure(element),trigger:measure(document.querySelector('.add-document-trigger')),document:{width:rect.width,height:rect.height,bottom:rect.bottom},paddingBottom:Number.parseFloat(getComputedStyle(surface).paddingBottom)};
      })()
    """.trimIndent().replace("SELECTOR", selector)
    val measured = JSONObject(evaluate(scenario, script))
    val viewport = measured.getJSONObject("viewport")
    for (kind in listOf("action", "trigger")) {
      val control = measured.getJSONObject(kind)
      val label = control.getString("label")
      assertTrue(label + " must retain a 48dp-equivalent target", control.getDouble("width") >= 48.0 && control.getDouble("height") >= 48.0)
      assertTrue(label + " must be fully inside the visible viewport after local menu scrolling", control.getDouble("left") >= viewport.getDouble("left") - 0.6 && control.getDouble("right") <= viewport.getDouble("left") + viewport.getDouble("width") + 0.6 && control.getDouble("top") >= viewport.getDouble("top") - 0.6 && control.getDouble("bottom") <= viewport.getDouble("top") + viewport.getDouble("height") + 0.6)
      assertTrue(label + " must retain a whole unclipped target", control.getDouble("visibleWidth") >= 48.0 && control.getDouble("visibleHeight") >= 48.0)
      assertTrue(label + " must receive input at its visible center", control.getBoolean("hit"))
      assertTrue(label + " must be enabled", !control.getBoolean("disabled"))
    }
    val surface = measured.getJSONObject("document")
    assertTrue("real document surface must keep positive area", surface.getDouble("width") > 0 && surface.getDouble("height") > 0)
    if (choiceSelector == null) assertTrue("closed-state document clearance must reserve the real floating target", measured.getDouble("paddingBottom") + 0.6 >= surface.getDouble("bottom") - measured.getJSONObject("trigger").getDouble("top"))
    println("add_document_geometry=" + measured.put("stage", if (choiceSelector == null) "closed" else "scrolled_choice").toString())
  }

  private fun verifyMarkdownFailures(scenario: ActivityScenario<MainActivity>, corpus: Uri) {
    for (stage in listOf("worker", "parser", "projection")) {
      injectRecoveryFailure(scenario, stage)
      waitForBodyText(scenario, "View source")
      clickControl(scenario, "View source")
      waitForCondition(scenario, "!!document.querySelector('.cm-content')", "injected " + stage + " failure must retain source access")
      waitForBodyText(scenario, "S046_CORPUS_MARKER", "Retry preview")
      clickControl(scenario, "Retry preview")
      waitForCondition(scenario, "!!document.querySelector('.markdown-document h1') && !!document.querySelector('.markdown-document table')", "explicit retry must recover after one injected " + stage + " failure")
      openFromAddDocument(scenario, grant(documentUri("resolver-warm")))
      waitForBodyText(scenario, "S031_WARM_MARKER_7C9D", "Add document")
      openFromAddDocument(scenario, corpus)
      waitForCondition(scenario, "!!document.querySelector('.markdown-document h1')", "another document and return navigation must remain usable")
    }
  }

  private fun injectRecoveryFailure(scenario: ActivityScenario<MainActivity>, stage: String) {
    assertEquals("true", evaluate(scenario, "(()=>{window.dispatchEvent(new CustomEvent('glitchpad:test-recovery',{detail:{stage:" + JSONObject.quote(stage) + "}}));return true;})()"))
  }

  private fun verifyDirtyCloseAndPendingRace(scenario: ActivityScenario<MainActivity>, destination: Uri) {
    createNewDraftForInput(scenario, "New text file", "Untitled.txt")
    replaceEditorText(scenario, "S046_DIRTY_CLOSE_BYTES\n")
    assertEquals("true", evaluate(scenario, "(()=>{document.querySelector('.app-shell').dispatchEvent(new KeyboardEvent('keydown',{key:'w',ctrlKey:true,bubbles:true}));return true;})()"))
    waitForBodyText(scenario, "Unsaved changes in Untitled.txt", "No content has been discarded.")
    clickControl(scenario, "Cancel")
    waitForCondition(scenario, "!document.querySelector('.resolution-dialog') && !!document.querySelector('.cm-content[contenteditable=true]')", "dirty close cancellation must retain the draft")
    assertEquals("true", evaluate(scenario, "(()=>{document.querySelector('.app-shell').dispatchEvent(new KeyboardEvent('keydown',{key:'w',ctrlKey:true,bubbles:true}));return true;})()"))
    waitForBodyText(scenario, "Unsaved changes in Untitled.txt")
    val pickerPackage = createDocumentPickerPackage()
    val monitor = instrumentation.addMonitor(IntentFilter(Intent.ACTION_CREATE_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); addDataType("*/*") }, null, false)
    try {
      tapUnblockedNativeControl(scenario, "Save As")
      waitForNativePickerWindow(scenario, "Save As", pickerPackage)
      assertTrue("one real native create chooser must own the cancelled save", monitor.hits == 1)
      instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
      waitForAppNativeWindow(scenario, "Save As", pickerPackage)
      waitForBodyText(scenario, "Save cancelled. Edits remain open.")
      assertTrue("native Back must not launch another create chooser", monitor.hits == 1)
    } finally { instrumentation.removeMonitor(monitor) }
    waitForCondition(scenario, """
      (()=>{
        const identity=document.querySelector('[data-draft-identity]');
        const rect=identity?identity.getBoundingClientRect():null;
        return !document.querySelector('.resolution-dialog')&&!!document.querySelector('.cm-content[contenteditable=true]')&&
          !!identity&&identity.textContent.includes('Untitled.txt')&&identity.textContent.includes('Unsaved changes')&&rect.width>0&&rect.height>0;
      })()
    """.trimIndent(), "cancelled native Save must dismiss the close decision and retain the visible editable unsaved draft")
    assertEquals("cancelled native Save must retain every draft character", "S046_DIRTY_CLOSE_BYTES\n", browserEditorInputSnapshot(scenario).getString("semantic_text"))
    assertEquals("the controlled destination must remain empty before the held native write", 0, readBytes(destination).size)

    // Observe pending choices while real native I/O is held in the fixture provider.
    // The separate real picker above owns native Back/cancellation coverage.
    val heldMonitor = instrumentation.addMonitor(IntentFilter(Intent.ACTION_CREATE_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); addDataType("*/*") }, chosen(destination), true)
    val pendingObservations = JSONObject()
    var armRequested = false
    var originalFailure: Throwable? = null
    try {
      armRequested = true
      val armed = heldFixtureWriteState("arm_held_write", destination)
      val providerProcess = armed.getInt("provider_process_id")
      assertTrue("the fixture document provider must report its actual process", providerProcess > 0)
      assertEquals("fixture control and document providers must actually share the barrier process", providerProcess, armed.getInt("control_process_id"))
      assertEquals("true", evaluate(scenario, "(()=>{document.querySelector('.app-shell').dispatchEvent(new KeyboardEvent('keydown',{key:'w',ctrlKey:true,bubbles:true}));return true;})()"))
      waitForBodyText(scenario, "Unsaved changes in Untitled.txt")
      clickControl(scenario, "Save As")
      waitForCondition(scenario, "Array.from(document.querySelectorAll('.resolution-dialog button')).every(b=>b.disabled)", "pending native Save must disable Discard/Close decisions", pendingObservations) {
        val held = heldFixtureWriteState("held_write_status", destination)
        val window = nativeHandoffState(scenario, "Save As")
        pendingObservations.put("held_provider", held).put("foreground_window", window)
        held.getInt("entered_count") == 1 && held.getInt("entered_process_id") == providerProcess &&
          held.getInt("control_process_id") == providerProcess && !held.getBoolean("entered_on_main_thread") &&
          !held.getBoolean("released") && !held.getBoolean("finished") && !held.getBoolean("timed_out") &&
          window.getString("scenario_state") == androidx.lifecycle.Lifecycle.State.RESUMED.name &&
          window.optBoolean("activity_window_focus") && window.optBoolean("webview_window_focus") && window.optBoolean("webview_shown")
      }
      assertEquals("one native create result must own the held write", 1, heldMonitor.hits)
      assertEquals("true", evaluate(scenario, "(()=>{const discard=Array.from(document.querySelectorAll('.resolution-dialog button')).find(b=>b.textContent.trim()==='Discard');if(!discard||!discard.disabled)return false;discard.click();return !!document.querySelector('.cm-content');})()"))
      assertEquals("blocked Discard during real native I/O must retain every draft character", "S046_DIRTY_CLOSE_BYTES\n", browserEditorInputSnapshot(scenario).getString("semantic_text"))
    } catch (failure: Throwable) {
      originalFailure = failure
      runCatching { capturePendingResolutionFailure(scenario, pickerPackage, heldMonitor.hits, pendingObservations) }
        .onFailure { println("native_pending_resolution_capture_failed=" + it.javaClass.simpleName); System.out.flush() }
      throw failure
    } finally {
      val release = if (armRequested) runCatching { heldFixtureWriteState("release_held_write", destination) } else null
      instrumentation.removeMonitor(heldMonitor)
      if (release?.isFailure == true) {
        if (originalFailure == null) throw AssertionError("the controlled native write barrier must be released", release.exceptionOrNull())
        println("native_held_write_release_failed=" + release.exceptionOrNull()?.javaClass?.simpleName)
        System.out.flush()
      }
    }
    waitForBodyText(scenario, "Save did not complete. Try again or choose another destination. Your edits remain open.")
    waitForCondition(scenario, "!document.querySelector('.resolution-dialog') && !!document.querySelector('.cm-content[contenteditable=true]')", "refused held native Save must dismiss the close decision and retain the editable draft")
    val refused = heldFixtureWriteState("held_write_status", destination)
    assertTrue("the controlled write must finish only after explicit barrier release", refused.getBoolean("released") && refused.getBoolean("finished") && !refused.getBoolean("timed_out"))
    assertEquals("the held writer must enter exactly once", 1, refused.getInt("entered_count"))
    assertEquals("refusal before descriptor open must preserve the empty destination", 0, readBytes(destination).size)
    assertEquals("refused held Save and blocked Discard must retain every draft character", "S046_DIRTY_CLOSE_BYTES\n", browserEditorInputSnapshot(scenario).getString("semantic_text"))
    println("native_held_write_evidence=" + refused.put("pending_choices_disabled", true).put("disabled_discard_retained_source", true).put("empty_destination_preserved", true))
    System.out.flush()
    chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, chosen(destination), { menuAction(scenario, "Save") }, "Saved after native verification.")
    assertTrue("pending Discard attempt must not lose draft bytes", "S046_DIRTY_CLOSE_BYTES\n".toByteArray(Charsets.UTF_8).contentEquals(readBytes(destination)))
  }

  private fun heldFixtureWriteState(method: String, destination: Uri): JSONObject {
    val status = requireNotNull(resolver.call(FixtureGrantProvider.COMMAND_URI, method, destination.toString(), null)) {
      "the controlled provider must return explicit write barrier state"
    }
    return JSONObject().put("control_process_id", status.getInt("control_process_id"))
      .put("provider_process_id", status.getInt("provider_process_id")).put("entered_process_id", status.getInt("entered_process_id"))
      .put("entered_count", status.getInt("entered_count")).put("entered_on_main_thread", status.getBoolean("entered_on_main_thread"))
      .put("released", status.getBoolean("released")).put("finished", status.getBoolean("finished")).put("timed_out", status.getBoolean("timed_out"))
  }

  private fun capturePendingResolutionFailure(
    scenario: ActivityScenario<MainActivity>, pickerPackage: String, monitorHits: Int, observations: JSONObject
  ) {
    val browser = runCatching { JSONObject(evaluate(scenario, """
      (()=>{
        const dialogs=Array.from(document.querySelectorAll('.resolution-dialog'));
        const editor=document.querySelector('.cm-content[contenteditable=true]');
        const identity=document.querySelector('[data-draft-identity]');
        const surface=document.querySelector('.document-surface');
        return {
          resolution_count:dialogs.length,
          surface_revision:surface?Number(surface.getAttribute('data-performance-revision')):null,
          dialog_count:document.querySelectorAll('[role=dialog]').length,
          buttons:dialogs.slice(0,2).map(dialog=>Array.from(dialog.querySelectorAll('button')).slice(0,8).map(button=>({label:(button.getAttribute('aria-label')||button.textContent).trim().slice(0,96),disabled:button.disabled}))),
          statuses:Array.from(document.querySelectorAll('[role=status],[role=alert]')).slice(0,8).map(node=>node.textContent.slice(0,256)),
          draft_identity:identity?identity.textContent.slice(0,256):null,
          editable_surface_present:!!editor,
          semantic_length:editor?Array.from(editor.querySelectorAll(':scope > .cm-line')).map(line=>line.textContent).join('\n').length:null
        };
      })()
    """.trimIndent())) }.getOrElse { failure ->
      JSONObject().put("capture_failed", true).put("failure_type", failure.javaClass.simpleName)
        .put("callback_timeout", failure.message == "WebView image control did not complete")
    }
    val native = runCatching { nativeHandoffState(scenario, "Save As", pickerPackage) }
      .getOrElse { JSONObject().put("capture_failed", true).put("failure_type", it.javaClass.simpleName) }
    println("native_pending_resolution_failure=" + JSONObject().put("phase", "pending_native_save").put("api_level", Build.VERSION.SDK_INT)
      .put("monitor_hits", monitorHits).put("pending_observations", observations).put("browser", browser).put("native_window", native))
    System.out.flush()
  }

  private fun verifySharedImageActions(scenario: ActivityScenario<MainActivity>) {
    openFromAddDocument(scenario, grant(documentUri("original.png")))
    waitForImagePixels(scenario, "original.png")
    menuAction(scenario, "Zoom in")
    waitForCondition(scenario, "document.querySelector('output[aria-label=\"Image zoom\"]').textContent==='125%'", "menu Zoom must change the actual image viewport")
    clickControl(scenario, "Zoom in")
    waitForCondition(scenario, "document.querySelector('output[aria-label=\"Image zoom\"]').textContent==='156%'", "local Zoom must continue the same viewport state")
    menuAction(scenario, "Fit")
    waitForCondition(scenario, "document.querySelector('output[aria-label=\"Image zoom\"]').textContent==='100%'", "menu Fit must reset the same viewport")
  }

  private fun verifyDiagnosticTasks(scenario: ActivityScenario<MainActivity>, destination: Uri, refused: Uri) {
    menuAction(scenario, "Diagnostics")
    waitForBodyText(scenario, "Redacted diagnostic preview ready", "Save previewed bundle", "Share previewed bundle")
    val frozen = stringValue(evaluate(scenario, "document.querySelector('.diagnostic-preview').textContent"))
    val bundle = JSONObject(frozen)
    val environment = bundle.getJSONObject("environment")
    val native = bundle.getJSONObject("native_environment")
    val packageInfo = clientContext.packageManager.getPackageInfo(TARGET_PACKAGE, 0)
    assertEquals("preview version must match installed APK", packageInfo.versionName, environment.getString("product_version"))
    val expectedSource = InstrumentationRegistry.getArguments().getString("expectedSource")
    assertTrue("full expected source identity must be supplied", expectedSource != null && expectedSource.matches(Regex("[0-9a-f]{40}")))
    assertEquals("preview source must match built candidate", expectedSource, environment.getString("build_commit"))
    assertEquals(Build.VERSION.SDK_INT, native.getInt("api_level"))
    val webview = WebViewCompat.getCurrentWebViewPackage(clientContext)
    if (webview == null) assertTrue("unavailable WebView identity must be explicit", native.isNull("webview_version"))
    else { assertEquals(webview.packageName, native.getString("webview_package")); assertEquals(webview.versionName, native.getString("webview_version")) }
    for (reason in listOf("markdown_worker_failed", "markdown_parse_failed", "markdown_projection_failed")) assertTrue("actual injected failure must be in the frozen bundle: " + reason, frozen.contains(reason))
    assertTrue("default diagnostic preview must omit document bytes/names/provider URIs", !frozen.contains("S046_") && !frozen.contains("content://") && !frozen.contains("recovery-corpus.md"))
    chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, ActivityResult(Activity.RESULT_CANCELED, Intent()), { clickControl(scenario, "Save previewed bundle") }, "Cancelled. The preview is retained.")
    chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, chosen(refused), { clickControl(scenario, "Save previewed bundle") }, "Export failed. The exact preview is retained")
    assertEquals("cancel/failure must preserve frozen preview", frozen, stringValue(evaluate(scenario, "document.querySelector('.diagnostic-preview').textContent")))
    chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, chosen(destination), { clickControl(scenario, "Save previewed bundle") }, "Diagnostic bundle saved and verified.")
    assertTrue("saved diagnostic JSON bytes must equal exact frozen preview", frozen.toByteArray(Charsets.UTF_8).contentEquals(readBytes(destination)))
    resolver.call(FixtureGrantProvider.COMMAND_URI, "clear_share_result", null, null)
    tapUnblockedNativeControl(scenario, "Share previewed bundle")
    clickNativeText("Glitchpad diagnostic fixture", false)
    instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
    waitForAppNativeWindow(scenario, "Share previewed bundle")
    waitForBodyText(scenario, "Cancelled. The preview is retained.")
    assertEquals("Share cancellation must retain the exact preview", frozen, stringValue(evaluate(scenario, "document.querySelector('.diagnostic-preview').textContent")))
    tapUnblockedNativeControl(scenario, "Share previewed bundle")
    clickNativeText("Glitchpad diagnostic fixture")
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    var received = resolver.call(FixtureGrantProvider.COMMAND_URI, "share_result", null, null)
    while (SystemClock.elapsedRealtime() < deadline && received?.getString("json") == null) { SystemClock.sleep(100L); received = resolver.call(FixtureGrantProvider.COMMAND_URI, "share_result", null, null) }
    assertEquals("actual receiving activity must read the frozen JSON", frozen, received?.getString("json"))
    assertTrue("receiver must have a temporary read grant", received?.getBoolean("read_granted") == true)
    waitForAppNativeWindow(scenario, "Share previewed bundle")
    waitForBodyText(scenario, "Shared with the system. Recipient delivery is unconfirmed.")
    println("recovery_runtime_evidence=" + JSONObject().put("apk_sha256", apkSha256()).put("source_commit", expectedSource).put("package", TARGET_PACKAGE).put("product_version", packageInfo.versionName).put("evidence_class", "hosted_debug_instrumentation").put("signed_release_bytes_tested", false).put("recovery_probe_variant", "compiled_test_only").put("native_environment", native).put("font_scale", clientContext.resources.configuration.fontScale).toString())
    clickControl(scenario, "Close diagnostics")
  }

  private fun chooseNative(scenario: ActivityScenario<MainActivity>, action: String, result: ActivityResult, trigger: () -> Unit, vararg expected: String) {
    val filter = IntentFilter(action).apply { addCategory(Intent.CATEGORY_OPENABLE); addDataType("*/*") }
    val monitor = instrumentation.addMonitor(filter, result, true)
    try { trigger(); waitForBodyText(scenario, *expected); assertEquals("native chooser must be invoked exactly once", 1, monitor.hits) }
    catch (failure: AssertionError) {
      val observed = runCatching { evaluate(scenario, """
        (()=>({
          body_text:document.body?document.body.innerText.slice(0,4096):'',
          statuses:Array.from(document.querySelectorAll('[role=status],[role=alert]')).slice(0,8).map(node=>node.textContent.slice(0,512)),
          draft_identity:document.querySelector('[data-draft-identity]')?document.querySelector('[data-draft-identity]').textContent.slice(0,256):null,
          editable_surface_present:!!document.querySelector('.cm-content[contenteditable=true]')
        }))()
      """.trimIndent()) }.getOrDefault("null")
      val screenshotSaved = runCatching { saveScreenshot("s046-authoring.png"); File(clientContext.filesDir, "s046-authoring.png").isFile }.getOrDefault(false)
      println("native_chooser_failure=" + JSONObject().put("action", action).put("injected_result_code", result.resultCode)
        .put("monitor_hits", monitor.hits).put("expected", JSONArray(expected.toList()))
        .put("state_json", observed.take(8192)).put("screenshot_saved", screenshotSaved))
      System.out.flush()
      throw failure
    }
    finally { instrumentation.removeMonitor(monitor) }
  }

  private fun openFromAddDocument(scenario: ActivityScenario<MainActivity>, uri: Uri) {
    val expectedName = resolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null).use { cursor ->
      assertTrue("controlled Open fixture must expose its display name", cursor != null && cursor.moveToFirst())
      requireNotNull(cursor).getString(0)
    }
    val monitor = instrumentation.addMonitor(IntentFilter(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); addDataType("*/*") }, chosen(uri), true)
    try {
      clickControl(scenario, "Add document"); clickControl(scenario, "Open file")
      waitForCondition(scenario, "!document.querySelector('[aria-label=\"Add document choices\"]')", "Open selection must dismiss Add document")
      val deadline = SystemClock.elapsedRealtime() + 15_000L
      while (monitor.hits == 0 && SystemClock.elapsedRealtime() < deadline) SystemClock.sleep(50L)
      assertEquals("Open must invoke the native document picker once", 1, monitor.hits)
      waitForDocumentIdentity(scenario, expectedName)
    } finally { instrumentation.removeMonitor(monitor) }
  }

  private fun waitForDocumentIdentity(scenario: ActivityScenario<MainActivity>, expectedName: String) {
    val expected = JSONObject.quote(expectedName)
    val script = """
      (()=>{
        const surface=document.querySelector('.document-surface');
        if(!surface)return false;
        let name=surface.getAttribute('aria-label');
        if(!name){
          const labelledBy=surface.getAttribute('aria-labelledby');
          const tab=labelledBy?document.getElementById(labelledBy):null;
          const label=tab?tab.querySelector('.tab-name'):null;
          name=label?label.textContent:null;
        }
        return name===EXPECTED;
      })()
    """.trimIndent().replace("EXPECTED", expected)
    try {
      waitForCondition(scenario, script, "the active document surface must own the expected delivery identity")
    } catch (failure: AssertionError) {
      captureMarkdownDeliveryFailure(scenario, expectedName)
      throw failure
    }
  }

  private fun closeCurrentDocument(scenario: ActivityScenario<MainActivity>) {
    val current = stringValue(evaluate(scenario, "document.querySelector('.document-surface').id"))
    assertEquals("true", evaluate(scenario, "(()=>{document.querySelector('.app-shell').dispatchEvent(new KeyboardEvent('keydown',{key:'w',ctrlKey:true,bubbles:true}));return true;})()"))
    waitForCondition(scenario, "!document.querySelector('.resolution-dialog') && document.querySelector('.document-surface').id!==" + JSONObject.quote(current), "saved document must close before native reopen")
  }

  private fun menuAction(scenario: ActivityScenario<MainActivity>, name: String) { clickControl(scenario, "Menu"); clickControl(scenario, name, "[role=menuitem]") }

  private fun clickControl(scenario: ActivityScenario<MainActivity>, name: String, selector: String = "button") {
    val nameLiteral = JSONObject.quote(name)
    val selectorLiteral = JSONObject.quote(selector)
    waitForCondition(scenario, "Array.from(document.querySelectorAll(" + selectorLiteral + ")).some(b=>!b.disabled&&(b.getAttribute('aria-label')||(b.querySelector('span')?b.querySelector('span').textContent:b.textContent)).trim()===" + nameLiteral + ")", "named actual-app control must be enabled: " + name)
    assertEquals("actual-app control must be clicked once", "true", evaluate(scenario, "(()=>{const button=Array.from(document.querySelectorAll(" + selectorLiteral + ")).find(b=>!b.disabled&&(b.getAttribute('aria-label')||(b.querySelector('span')?b.querySelector('span').textContent:b.textContent)).trim()===" + nameLiteral + ");if(!button)return false;button.click();return true;})()"))
  }

  // A real external activity can outlive evaluateJavascript's result callback. Measure the
  // public control first, then launch it with one native tap without a post-launch JS ack.
  private fun tapUnblockedNativeControl(scenario: ActivityScenario<MainActivity>, name: String) {
    val nameLiteral = JSONObject.quote(name)
    waitForCondition(scenario, "Array.from(document.querySelectorAll('button')).some(b=>!b.disabled&&(b.getAttribute('aria-label')||(b.querySelector('span')?b.querySelector('span').textContent:b.textContent)).trim()===" + nameLiteral + ")", "native launch control must be enabled: " + name)
    val target = JSONObject(evaluate(scenario, """
      (()=>{
        const button=Array.from(document.querySelectorAll('button')).find(b=>!b.disabled&&(b.getAttribute('aria-label')||(b.querySelector('span')?b.querySelector('span').textContent:b.textContent)).trim()===NAME);
        if(!button)return {found:false};
        button.scrollIntoView({block:'nearest',inline:'nearest'});
        const rect=button.getBoundingClientRect();
        const viewport=window.visualViewport;
        const left=viewport?viewport.offsetLeft:0;
        const top=viewport?viewport.offsetTop:0;
        const width=viewport?viewport.width:window.innerWidth;
        const height=viewport?viewport.height:window.innerHeight;
        const clientX=(rect.left+rect.right)/2;
        const clientY=(rect.top+rect.bottom)/2;
        const hit=document.elementFromPoint(clientX,clientY);
        return {found:true,x:clientX-left,y:clientY-top,viewport_width:width,width:rect.width,height:rect.height,
          fully_visible:rect.left>=left-0.6&&rect.right<=left+width+0.6&&rect.top>=top-0.6&&rect.bottom<=top+height+0.6,
          hit:hit===button||button.contains(hit),disabled:button.disabled};
      })()
    """.trimIndent().replace("NAME", nameLiteral)))
    assertTrue("the native launch tap must hit a whole enabled visible control: " + name + " " + target,
      target.getBoolean("found") && target.getDouble("width") > 0 && target.getDouble("height") > 0 &&
        target.getBoolean("fully_visible") && target.getBoolean("hit") && !target.getBoolean("disabled"))
    val point = FloatArray(2)
    scenario.onActivity { activity ->
      val view = requireNotNull(findWebView(activity.window.decorView))
      val location = IntArray(2)
      view.getLocationOnScreen(location)
      val scale = view.width / target.getDouble("viewport_width")
      point[0] = (location[0] + target.getDouble("x") * scale).toFloat()
      point[1] = (location[1] + target.getDouble("y") * scale).toFloat()
    }
    val downTime = SystemClock.uptimeMillis()
    val down = MotionEvent.obtain(downTime, downTime, MotionEvent.ACTION_DOWN, point[0], point[1], 0)
    val up = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, point[0], point[1], 0)
    try {
      down.source = InputDevice.SOURCE_TOUCHSCREEN
      up.source = InputDevice.SOURCE_TOUCHSCREEN
      instrumentation.sendPointerSync(down)
      instrumentation.sendPointerSync(up)
    } finally { down.recycle(); up.recycle() }
  }

  private fun createDocumentPickerPackage(): String {
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("text/plain")
    return requireNotNull(clientContext.packageManager.resolveActivity(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)) {
      "the real text document picker must resolve before its control is tapped"
    }.activityInfo.packageName
  }

  private fun nativeHandoffState(scenario: ActivityScenario<MainActivity>, control: String, pickerPackage: String? = null): JSONObject {
    val state = scenario.state
    val root = instrumentation.uiAutomation.rootInActiveWindow
    val bounds = android.graphics.Rect()
    root?.getBoundsInScreen(bounds)
    val observed = JSONObject().put("control", control).put("requested_picker_package", pickerPackage ?: JSONObject.NULL)
      .put("scenario_state", state.name).put("active_root_package", root?.packageName?.toString() ?: JSONObject.NULL)
      .put("active_root_visible", root?.isVisibleToUser == true).put("active_root_width", bounds.width()).put("active_root_height", bounds.height())
    if (state == androidx.lifecycle.Lifecycle.State.RESUMED) scenario.onActivity { activity ->
      val view = findWebView(activity.window.decorView)
      observed.put("activity_window_focus", activity.hasWindowFocus()).put("webview_window_focus", view?.hasWindowFocus() == true)
        .put("webview_shown", view?.isShown == true).put("webview_width", view?.width ?: 0).put("webview_height", view?.height ?: 0)
    }
    return observed
  }

  private fun waitForNativePickerWindow(scenario: ActivityScenario<MainActivity>, control: String, pickerPackage: String) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    var observed = JSONObject()
    while (SystemClock.elapsedRealtime() < deadline) {
      observed = nativeHandoffState(scenario, control, pickerPackage)
      if (observed.optString("active_root_package") == pickerPackage && observed.getBoolean("active_root_visible") &&
        observed.getInt("active_root_width") > 0 && observed.getInt("active_root_height") > 0) return
      SystemClock.sleep(100L)
    }
    throw AssertionError("the launched native picker must own a visible accessible window before pending DOM inspection: " + observed)
  }

  private fun waitForAppNativeWindow(scenario: ActivityScenario<MainActivity>, control: String, pickerPackage: String? = null) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    var observed = JSONObject()
    while (SystemClock.elapsedRealtime() < deadline) {
      observed = nativeHandoffState(scenario, control, pickerPackage)
      if (observed.getString("scenario_state") == androidx.lifecycle.Lifecycle.State.RESUMED.name &&
        observed.optBoolean("activity_window_focus") && observed.optBoolean("webview_window_focus") && observed.optBoolean("webview_shown") &&
        observed.optInt("webview_width") > 0 && observed.optInt("webview_height") > 0) return
      SystemClock.sleep(100L)
    }
    throw AssertionError("the actual app must resume with a visible focused WebView window before returned-handoff DOM inspection: " + observed)
  }

  private fun createNewDraftForInput(scenario: ActivityScenario<MainActivity>, choice: String, expectedName: String) {
    val previous = stringValue(evaluate(scenario, "(()=>{const surface=document.querySelector('.document-surface');return surface?surface.id:'';})()"))
    clickControl(scenario, "Add document")
    clickControl(scenario, choice)
    val ready = """
      (()=>{
        const surface=document.querySelector('.document-surface');
        const identity=document.querySelector('[data-draft-identity]');
        const editor=document.querySelector('.cm-content[contenteditable=true]');
        const trigger=document.querySelector('.add-document-trigger');
        const rect=identity?identity.getBoundingClientRect():null;
        return !!surface&&surface.id!==PREVIOUS&&!!identity&&rect.width>0&&rect.height>0&&
          identity.textContent.includes(EXPECTED)&&identity.textContent.includes('Unsaved changes')&&
          !!editor&&editor.getAttribute('aria-label')===EXPECTED+' text editor'&&
          Array.from(editor.querySelectorAll(':scope > .cm-line')).map(line=>line.textContent).join('\n')===''&&
          !document.querySelector('.add-document-menu')&&document.activeElement===trigger&&trigger.getAttribute('aria-expanded')==='false';
      })()
    """.trimIndent().replace("PREVIOUS", JSONObject.quote(previous)).replace("EXPECTED", JSONObject.quote(expectedName))
    try {
      waitForCondition(scenario, ready, "the newly selected draft must replace the previous surface and complete Add document focus restoration before native input")
    } catch (failure: AssertionError) {
      captureEditorFocusFailure(scenario, "new_draft_readiness", JSONObject().put("expected_name", expectedName).put("previous_surface_id", previous))
      throw failure
    }
  }

  private fun keyboardSave(scenario: ActivityScenario<MainActivity>) {
    focusNativeWebView(scenario)
    assertEquals("actual editor must hold DOM focus before keyboard Save", "true", evaluate(scenario, "(()=>{const editor=document.querySelector('.cm-content[contenteditable=true]');if(!editor)return false;editor.focus();return document.activeElement===editor;})()"))
    instrumentation.waitForIdleSync()
    val downTime = SystemClock.uptimeMillis()
    instrumentation.sendKeySync(KeyEvent(downTime, downTime, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_S, 0, KeyEvent.META_CTRL_ON))
    instrumentation.sendKeySync(KeyEvent(downTime, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, KeyEvent.KEYCODE_S, 0, KeyEvent.META_CTRL_ON))
  }

  private fun focusNativeWebView(scenario: ActivityScenario<MainActivity>): JSONObject {
    scenario.onActivity { activity -> requireNotNull(findWebView(activity.window.decorView)).requestFocus() }
    instrumentation.waitForIdleSync()
    val deadline = SystemClock.elapsedRealtime() + 10_000L
    var latest = JSONObject()
    while (SystemClock.elapsedRealtime() < deadline) {
      scenario.onActivity { activity ->
        val view = requireNotNull(findWebView(activity.window.decorView))
        latest = JSONObject().put("activity_window_focus", activity.hasWindowFocus()).put("webview_focus", view.hasFocus()).put("webview_window_focus", view.hasWindowFocus()).put("webview_shown", view.isShown)
      }
      if (latest.getBoolean("activity_window_focus") && latest.getBoolean("webview_focus") && latest.getBoolean("webview_window_focus") && latest.getBoolean("webview_shown")) return latest
      SystemClock.sleep(100L)
    }
    throw AssertionError("the actual app WebView must own native input focus before input: " + latest)
  }

  private fun replaceEditorText(scenario: ActivityScenario<MainActivity>, text: String) {
    waitForCondition(scenario, "!!document.querySelector('.cm-content[contenteditable=true]')", "draft must expose the actual editable surface")
    val nativeFocus = focusNativeWebView(scenario)
    val target = JSONObject(evaluate(scenario, """
      (()=>{
        const editor=document.querySelector('.cm-content[contenteditable=true]');
        editor.scrollIntoView({block:'nearest',inline:'nearest'});
        const rect=editor.getBoundingClientRect();
        const viewport=window.visualViewport;
        const left=viewport?viewport.offsetLeft:0;
        const top=viewport?viewport.offsetTop:0;
        const width=viewport?viewport.width:window.innerWidth;
        const height=viewport?viewport.height:window.innerHeight;
        const visible={left:Math.max(rect.left,left),right:Math.min(rect.right,left+width),top:Math.max(rect.top,top),bottom:Math.min(rect.bottom,top+height)};
        const clientX=visible.left+Math.min(16,(visible.right-visible.left)/2);
        const clientY=visible.top+Math.min(16,(visible.bottom-visible.top)/2);
        const hit=document.elementFromPoint(clientX,clientY);
        return {x:clientX-left,y:clientY-top,client_x:clientX,client_y:clientY,viewport_width:width,visible_width:visible.right-visible.left,visible_height:visible.bottom-visible.top,
          editor_rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height},
          viewport:{left:left,top:top,width:width,height:height,scale:viewport?viewport.scale:1},
          hit_is_editor:hit===editor||editor.contains(hit),hit_tag:hit?hit.nodeName:null,hit_class:hit?String(hit.className).slice(0,128):null,
          surface_id:document.querySelector('.document-surface').id,editor_label:editor.getAttribute('aria-label')};
      })()
    """.trimIndent()))
    assertTrue("the native edit tap must target visible editor content: " + target, target.getDouble("visible_width") > 0 && target.getDouble("visible_height") > 0)
    val point = FloatArray(2)
    val nativeMapping = JSONObject().put("focus_before", nativeFocus)
    scenario.onActivity { activity ->
      val view = requireNotNull(findWebView(activity.window.decorView))
      val location = IntArray(2)
      view.getLocationOnScreen(location)
      val scale = view.width / target.getDouble("viewport_width")
      point[0] = (location[0] + target.getDouble("x") * scale).toFloat()
      point[1] = (location[1] + target.getDouble("y") * scale).toFloat()
      nativeMapping.put("view_left", location[0]).put("view_top", location[1]).put("view_width", view.width).put("view_height", view.height)
        .put("css_to_native_scale", scale).put("screen_x", point[0]).put("screen_y", point[1]).put("density", view.resources.displayMetrics.density)
    }
    val downTime = SystemClock.uptimeMillis()
    val down = MotionEvent.obtain(downTime, downTime, MotionEvent.ACTION_DOWN, point[0], point[1], 0)
    val up = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), MotionEvent.ACTION_UP, point[0], point[1], 0)
    try {
      down.source = InputDevice.SOURCE_TOUCHSCREEN
      up.source = InputDevice.SOURCE_TOUCHSCREEN
      instrumentation.sendPointerSync(down)
      instrumentation.sendPointerSync(up)
    } finally { down.recycle(); up.recycle() }
    instrumentation.waitForIdleSync()
    try {
      waitForCondition(scenario, "document.hasFocus() && document.activeElement===document.querySelector('.cm-content[contenteditable=true]')", "the actual editor must own browser focus after a native touch before editing")
    } catch (failure: AssertionError) {
      captureEditorFocusFailure(scenario, "after_native_touch", target, nativeMapping)
      throw failure
    }
    val browserBefore = browserEditorInputSnapshot(scenario)
    val beforeInputText = browserBefore.getString("editing_text")
    val beforeSemanticText = browserBefore.getString("semantic_text")
    browserBefore.remove("editing_text")
    browserBefore.remove("semantic_text")
    if (browserBefore.getBoolean("edit_context_attached"))
      assertEquals("the controlled EditContext must expose the complete semantic source", beforeSemanticText, beforeInputText)
    assertTrue("the complete semantic source must be the prefix of its public editing representation", beforeInputText.startsWith(beforeSemanticText))
    val semanticSelectionEnd = beforeSemanticText.length
    browserBefore.put("requested_semantic_selection_start", 0).put("requested_semantic_selection_end", semanticSelectionEnd)
    assertTrue("the controlled native input fixture must fit a bounded complete input buffer", beforeInputText.length <= 16_384 && text.length <= 16_384)
    val connectionReference = AtomicReference<android.view.inputmethod.InputConnection?>()
    val handlerReference = AtomicReference<android.os.Handler?>()
    val inputInfo = JSONObject()
    scenario.onActivity { activity ->
      val view = requireNotNull(findWebView(activity.window.decorView))
      val info = android.view.inputmethod.EditorInfo()
      val connection = view.onCreateInputConnection(info)
      connectionReference.set(connection)
      handlerReference.set(connection?.handler ?: view.handler)
      inputInfo.put("connection_created", connection != null).put("input_type", info.inputType).put("ime_options", info.imeOptions)
        .put("initial_selection_start", info.initialSelStart).put("initial_selection_end", info.initialSelEnd)
        .put("connection_class", connection?.javaClass?.simpleName)
    }
    println("native_editor_input=" + JSONObject().put("phase", "before_native_commit").put("api_level", Build.VERSION.SDK_INT)
      .put("native_focus", nativeFocus).put("browser_edit", browserBefore).put("input_connection", inputInfo))
    System.out.flush()
    val connection = requireNotNull(connectionReference.get()) { "focused WebView must expose its public native InputConnection" }
    val handler = requireNotNull(handlerReference.get()) { "native InputConnection must expose its input dispatch handler" }
    waitForNativeEditorState(connection, handler, beforeInputText, "before_native_selection")
    assertTrue("native IME must finish any active composition", onEditorInputThread(connection, handler) { it.finishComposingText() })
    assertTrue("native IME must select the complete semantic source, excluding rendered paragraph markers", onEditorInputThread(connection, handler) { it.setSelection(0, semanticSelectionEnd) })
    val selectedState = waitForNativeEditorState(connection, handler, beforeInputText, "selected_before_commit", 0, semanticSelectionEnd)
    if (browserBefore.getBoolean("edit_context_attached")) {
      waitForCondition(scenario, "(()=>{const editor=document.querySelector('.cm-content[contenteditable=true]');const context=editor&&editor.editContext;return !!context&&context.selectionStart===0&&context.selectionEnd===" + semanticSelectionEnd + ";})()", "native IME selection must reach the actual EditContext before replacement")
    }
    assertTrue("native IME must accept the exact Unicode and multiline text", onEditorInputThread(connection, handler) { it.commitText(text, 1) })
    val browserAfter = try {
      waitForBrowserEditorCommit(scenario, text, target.getString("surface_id"), target.getString("editor_label"))
    } catch (failure: AssertionError) {
      captureEditorFocusFailure(scenario, "postcommit_browser_coherence", target, nativeMapping)
      throw failure
    }
    val afterInputText = browserAfter.getString("editing_text")
    assertEquals("the actual CodeMirror semantic source must preserve all requested text", text, browserAfter.getString("semantic_text"))
    if (browserAfter.getBoolean("edit_context_attached"))
      assertEquals("the actual EditContext must expose the complete committed semantic source", text, afterInputText)
    browserAfter.remove("editing_text")
    browserAfter.remove("semantic_text")
    // The public editing buffer includes legacy rendered paragraph markers. The
    // committed cursor still belongs after the exact supplied text, before any
    // trailing contenteditable paragraph marker.
    println("native_editor_input=" + JSONObject().put("phase", "before_committed_wait").put("api_level", Build.VERSION.SDK_INT)
      .put("expected_native_length", afterInputText.length).put("expected_selection_start", text.length).put("expected_selection_end", text.length)
      .put("browser_edit_after", browserAfter))
    System.out.flush()
    val committedState = try {
      waitForNativeEditorState(connection, handler, afterInputText, "committed", text.length, text.length)
    } catch (failure: AssertionError) {
      captureEditorFocusFailure(scenario, "native_committed_state", target, nativeMapping)
      throw failure
    }
    println("native_editor_input=" + JSONObject().put("phase", "native_commit_verified").put("api_level", Build.VERSION.SDK_INT)
      .put("input_path", "WebView.InputConnection.setSelection+commitText").put("selected_state", selectedState)
      .put("committed_state", committedState).put("browser_edit_after", browserAfter).put("visible_exact_text", true).put("committed_utf8_bytes", text.toByteArray(Charsets.UTF_8).size))
    System.out.flush()
    waitForBodyText(scenario, text.lineSequence().first())
  }

  private fun waitForBrowserEditorCommit(
    scenario: ActivityScenario<MainActivity>, expected: String, surfaceId: String, editorLabel: String
  ): JSONObject {
    // Observe raw DOM and public editing text together before freezing the native
    // expectation from one coherent, focused current-editor snapshot.
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    var latest = JSONObject()
    while (SystemClock.elapsedRealtime() < deadline) {
      val observed = runCatching { browserEditorInputSnapshot(scenario) }.getOrElse { JSONObject().put("capture_failed", true) }
      val semantic = observed.optString("semantic_text")
      val editing = observed.optString("editing_text")
      val context = observed.optBoolean("edit_context_attached")
      if (observed.optBoolean("document_focus") && observed.optBoolean("editor_focus") &&
        observed.optString("surface_id") == surfaceId && observed.optJSONObject("editor_element")?.optString("label") == editorLabel &&
        semantic == expected && (if (context) editing == expected else editing.startsWith(expected))) return observed
      observed.remove("semantic_text")
      observed.remove("editing_text")
      latest = observed
      SystemClock.sleep(100L)
    }
    throw AssertionError("postcommit browser editing state must coherently expose the complete exact source before native readback: " +
      JSONObject().put("phase", "postcommit_browser_coherence").put("expected_semantic_length", expected.length)
        .put("expected_selection_start", expected.length).put("expected_selection_end", expected.length)
        .put("expected_surface_id", surfaceId).put("expected_editor_label", editorLabel).put("browser_edit", latest))
  }

  private fun browserEditorInputSnapshot(scenario: ActivityScenario<MainActivity>): JSONObject = JSONObject(evaluate(scenario, """
    (()=>{
      const editor=document.querySelector('.cm-content[contenteditable=true]');
      const context=editor&&editor.editContext;
      const selection=window.getSelection();
      const active=document.activeElement;
      const surface=document.querySelector('.document-surface');
      const identity=document.querySelector('[data-draft-identity]');
      const scroller=editor&&editor.closest('.cm-scroller');
      const viewport=window.visualViewport;
      const rect=node=>{if(!node)return null;const value=node.getBoundingClientRect();return {left:value.left,top:value.top,right:value.right,bottom:value.bottom,width:value.width,height:value.height};};
      const element=node=>node?{tag:node.nodeName,id:node.id||null,class_name:String(node.className).slice(0,128),role:node.getAttribute('role'),label:node.getAttribute('aria-label'),contenteditable:node.getAttribute('contenteditable')}:null;
      const lines=editor?Array.from(editor.querySelectorAll(':scope > .cm-line')):[];
      const semantic=lines.map(line=>line.textContent).join('\n');
      const editing=context?context.text:editor?editor.innerText:'';
      const shortCodeUnits=value=>value.length<=4?value.split('').map(character=>character.charCodeAt(0)):[];
      return {
        document_focus:document.hasFocus(),editor_focus:!!editor&&document.activeElement===editor,editor_present:!!editor,
        active_element:element(active),active_rect:rect(active),editor_element:element(editor),editor_rect:rect(editor),surface_id:surface?surface.id:null,
        draft_identity:identity?identity.textContent.slice(0,256):null,
        viewport:{left:viewport?viewport.offsetLeft:0,top:viewport?viewport.offsetTop:0,width:viewport?viewport.width:window.innerWidth,height:viewport?viewport.height:window.innerHeight,scale:viewport?viewport.scale:1},
        inner_width:window.innerWidth,inner_height:window.innerHeight,device_pixel_ratio:window.devicePixelRatio,window_scroll_x:window.scrollX,window_scroll_y:window.scrollY,
        scroller:scroller?{rect:rect(scroller),scroll_top:scroller.scrollTop,scroll_left:scroller.scrollLeft,scroll_height:scroller.scrollHeight,client_height:scroller.clientHeight}:null,
        add_menu_present:!!document.querySelector('.add-document-menu'),scrim_present:!!document.querySelector('.add-document-scrim'),dialog_count:document.querySelectorAll('[role=dialog]').length,
        insert_supported:document.queryCommandSupported('insertText'),insert_enabled:document.queryCommandEnabled('insertText'),
        user_activation:navigator.userActivation?navigator.userActivation.isActive:null,
        edit_context_attached:!!context,editing_representation:context?'edit_context_text':'contenteditable_inner_text',
        edit_context_length:context?context.text.length:null,
        edit_context_selection_start:context?context.selectionStart:null,edit_context_selection_end:context?context.selectionEnd:null,
        dom_selection_ranges:selection?selection.rangeCount:0,
        dom_selection_in_editor:!!editor&&!!selection&&!!selection.anchorNode&&editor.contains(selection.anchorNode),
        dom_selection_anchor_node:selection&&selection.anchorNode?selection.anchorNode.nodeName:null,
        dom_selection_anchor_offset:selection?selection.anchorOffset:null,
        dom_selection_focus_node:selection&&selection.focusNode?selection.focusNode.nodeName:null,
        dom_selection_focus_offset:selection?selection.focusOffset:null,
        semantic_length:semantic.length,editing_length:editing.length,editing_short_code_units:shortCodeUnits(editing),
        inner_text_length:editor?editor.innerText.length:0,line_count:lines.length,br_count:editor?editor.querySelectorAll('br').length:0,
        bounded_line_layout:lines.slice(0,8).map(line=>{const style=getComputedStyle(line);return {text_length:line.textContent.length,rect:rect(line),display:style.display,visibility:style.visibility,white_space:style.whiteSpace};}),
        trailing_line_empty:lines.length>0&&lines[lines.length-1].textContent.length===0,
        semantic_text:semantic,editing_text:editing
      };
    })()
  """.trimIndent()))

  private fun captureEditorFocusFailure(
    scenario: ActivityScenario<MainActivity>, stage: String, target: JSONObject, mapping: JSONObject = JSONObject()
  ) {
    val browser = runCatching {
      browserEditorInputSnapshot(scenario).apply { remove("semantic_text"); remove("editing_text") }
    }.getOrElse { JSONObject().put("capture_failed", true) }
    val native = JSONObject().put("capture_completed", false)
    runCatching { scenario.onActivity { activity ->
      val view = findWebView(activity.window.decorView)
      if (view != null) {
        val location = IntArray(2); view.getLocationOnScreen(location)
        native.put("capture_completed", true).put("activity_window_focus", activity.hasWindowFocus())
          .put("webview_focus", view.hasFocus()).put("webview_window_focus", view.hasWindowFocus()).put("shown", view.isShown)
          .put("view_left", location[0]).put("view_top", location[1]).put("view_width", view.width).put("view_height", view.height)
      }
    } }
    val hit = if (target.has("client_x") && target.has("client_y")) runCatching {
      JSONObject(evaluate(scenario, "(()=>{const node=document.elementFromPoint(" + target.getDouble("client_x") + "," + target.getDouble("client_y") + ");const editor=document.querySelector('.cm-content[contenteditable=true]');return {present:!!node,tag:node?node.nodeName:null,class_name:node?String(node.className).slice(0,128):null,label:node?node.getAttribute('aria-label'):null,in_editor:!!node&&!!editor&&(node===editor||editor.contains(node))};})()"))
    }.getOrElse { JSONObject().put("capture_failed", true) } else JSONObject().put("target_available", false)
    println("native_editor_focus_failure=" + JSONObject().put("stage", stage).put("api_level", Build.VERSION.SDK_INT)
      .put("before_target", target).put("native_mapping", mapping).put("browser_after", browser)
      .put("native_after", native).put("hit_at_original_client_point", hit))
    System.out.flush()
  }

  private fun <T> onEditorInputThread(
    connection: android.view.inputmethod.InputConnection,
    handler: android.os.Handler,
    action: (android.view.inputmethod.InputConnection) -> T
  ): T {
    val result = AtomicReference<T>()
    val failure = AtomicReference<Throwable?>()
    val done = CountDownLatch(1)
    assertTrue("native input action must be posted to the connection handler", handler.post {
      try { result.set(action(connection)) } catch (error: Throwable) { failure.set(error) } finally { done.countDown() }
    })
    assertTrue("native input action must finish without blocking the app UI", done.await(10, TimeUnit.SECONDS))
    failure.get()?.let { throw AssertionError("native InputConnection action failed", it) }
    return result.get()
  }

  private fun waitForNativeEditorState(
    connection: android.view.inputmethod.InputConnection,
    handler: android.os.Handler,
    expected: String,
    phase: String,
    selectionStart: Int? = null,
    selectionEnd: Int? = null
  ): JSONObject {
    val deadline = SystemClock.elapsedRealtime() + 10_000L
    var latest = JSONObject()
    while (SystemClock.elapsedRealtime() < deadline) {
      val extracted = onEditorInputThread(connection, handler) {
        it.getExtractedText(android.view.inputmethod.ExtractedTextRequest().apply { hintMaxChars = 16_384; hintMaxLines = 1_024 }, 0)
      }
      latest = JSONObject().put("phase", phase).put("available", extracted != null).put("expected_length", expected.length)
        .put("expected_selection_start", selectionStart ?: JSONObject.NULL).put("expected_selection_end", selectionEnd ?: JSONObject.NULL)
      if (extracted != null) {
        val actual = extracted.text?.toString()
        latest.put("start_offset", extracted.startOffset).put("text_length", actual?.length)
          .put("selection_start", extracted.selectionStart).put("selection_end", extracted.selectionEnd)
          .put("exact_text", actual == expected)
          .put("short_code_units", JSONArray(if (actual != null && actual.length <= 4) actual.map { it.code } else emptyList<Int>()))
        if (extracted.startOffset == 0 && actual == expected &&
          (selectionStart == null || extracted.selectionStart == selectionStart) &&
          (selectionEnd == null || extracted.selectionEnd == selectionEnd)) return latest
      }
      SystemClock.sleep(50L)
    }
    throw AssertionError("native IME must expose the complete exact editor buffer and selection: " + latest)
  }

  private fun waitForCondition(
    scenario: ActivityScenario<MainActivity>, script: String, reason: String, observations: JSONObject? = null,
    prerequisite: (() -> Boolean)? = null
  ) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    while (SystemClock.elapsedRealtime() < deadline) {
      if (prerequisite != null) {
        val ready = runCatching { prerequisite() }
        observations?.let { it.put("prerequisite_count", it.optInt("prerequisite_count") + 1) }
        if (ready.isFailure) observations?.put("prerequisite_failure_type", ready.exceptionOrNull()?.javaClass?.simpleName)
        if (!ready.getOrDefault(false)) { SystemClock.sleep(100L); continue }
      }
      val result = runCatching { evaluate(scenario, script) }
      if (observations != null) {
        observations.put("attempt_count", observations.optInt("attempt_count") + 1)
        val value = result.getOrNull()
        if (result.isSuccess) {
          val kind = if (value == "true") "true" else if (value == "false") "false" else "non_boolean"
          observations.put(kind + "_result_count", observations.optInt(kind + "_result_count") + 1).put("last_result", kind)
        } else {
          val failure = result.exceptionOrNull()
          observations.put("evaluation_failure_count", observations.optInt("evaluation_failure_count") + 1)
            .put("last_result", "evaluation_failed").put("last_failure_type", failure?.javaClass?.simpleName)
            .put("last_callback_timeout", failure?.message == "WebView image control did not complete")
        }
      }
      if (result.getOrDefault("false") == "true") return
      SystemClock.sleep(100L)
    }
    throw AssertionError(reason)
  }

  private fun clickNativeText(expected: String, click: Boolean = true) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    while (SystemClock.elapsedRealtime() < deadline) {
      fun visit(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        if (node.text?.toString()?.contains(expected) == true || node.contentDescription?.toString()?.contains(expected) == true) {
          if (!click) return true
          var target: AccessibilityNodeInfo? = node
          while (target != null) { if (target.isClickable && target.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true; target = target.parent }
        }
        for (index in 0 until node.childCount) if (visit(node.getChild(index))) return true
        return false
      }
      if (visit(instrumentation.uiAutomation.rootInActiveWindow)) return
      SystemClock.sleep(100L)
    }
    throw AssertionError("native chooser must expose the controlled receiving app")
  }

  private fun chosen(uri: Uri) = ActivityResult(Activity.RESULT_OK, Intent().setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION))
  private fun readBytes(uri: Uri) = resolver.openInputStream(uri)!!.use { it.readBytes() }
  private fun stringValue(json: String) = JSONArray("[" + json + "]").getString(0)
  private fun apkSha256(): String {
    val digest = MessageDigest.getInstance("SHA-256")
    File(clientContext.applicationInfo.sourceDir).inputStream().use { input -> val bytes = ByteArray(65536); var count = input.read(bytes); while (count != -1) { digest.update(bytes, 0, count); count = input.read(bytes) } }
    return digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
  }
  private fun saveScreenshot(name: String) {
    val bitmap = instrumentation.uiAutomation.takeScreenshot() ?: return
    try { clientContext.openFileOutput(name, 0).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) } } finally { bitmap.recycle() }
  }

  private fun viewIntent(uri: Uri, mediaType: String): Intent =
    Intent(Intent.ACTION_VIEW)
      .addCategory(Intent.CATEGORY_DEFAULT)
      .setDataAndType(uri, mediaType)
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

  private fun exportChoice(scenario: ActivityScenario<MainActivity>, result: ActivityResult, expected: String) {
    waitForImagePixels(scenario, "entries.ico")
    val filter = IntentFilter(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      addDataType("image/png")
    }
    val monitor = instrumentation.addMonitor(filter, result, true)
    try {
      val action = JSONObject(evaluate(scenario, "(()=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Export selected entry as PNG');const requested=!!button&&!button.disabled;if(requested)button.click();return {requested};})()"))
      assertTrue("selected-entry export must be enabled before opening the chooser", action.getBoolean("requested"))
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
    return if (latch.await(2, TimeUnit.SECONDS)) runCatching { stringValue(result.get()) }.getOrNull() else null
  }

  private fun evaluate(scenario: ActivityScenario<MainActivity>, script: String): String {
    val view = AtomicReference<WebView?>()
    scenario.onActivity { view.set(findWebView(it.window.decorView)) }
    val latch = CountDownLatch(1)
    val result = AtomicReference("null")
    instrumentation.runOnMainSync { requireNotNull(view.get()).evaluateJavascript(script) { value -> result.set(value ?: "null"); latch.countDown() } }
    assertTrue("WebView image control did not complete", latch.await(2, TimeUnit.SECONDS))
    return result.get()
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
