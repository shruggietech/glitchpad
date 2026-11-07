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
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.runner.intent.IntentCallback
import androidx.test.runner.intent.IntentMonitorRegistry
import androidx.test.runner.intent.IntentStubber
import androidx.test.runner.intent.IntentStubberRegistry
import com.shruggietech.glitchpad.MainActivity
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import java.util.UUID
import org.json.JSONObject
import org.junit.After
import org.junit.Before
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidDeliveryInstrumentedTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val clientContext = instrumentation.targetContext
  private val resolver = clientContext.contentResolver
  private val grantedUris = mutableSetOf<Uri>()
  private var ownedScenario: ActivityScenario<MainActivity>? = null

  @Before
  fun requireRunnerOwnedCompletion() {
    assertEquals("Dedicated Tauri UI instrumentation must own terminal completion", "false", InstrumentationRegistry.getArguments().getString("waitForActivitiesToComplete"))
    val power = clientContext.getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager
    val keyguard = clientContext.getSystemService(android.content.Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
    if (!power.isInteractive) shellOutput("input keyevent 224")
    if (keyguard.isKeyguardLocked) shellOutput("input keyevent 82")
    val inputDeadline = SystemClock.elapsedRealtime() + 10_000L
    while ((!power.isInteractive || keyguard.isKeyguardLocked) && SystemClock.elapsedRealtime() < inputDeadline) SystemClock.sleep(100L)
    assertTrue("hosted UI fixture must be interactive and unlocked before app actions", power.isInteractive && !keyguard.isKeyguardLocked)
  }

  @After
  fun stopActivityAndRevokeFixtureGrants() {
    try {
      ownedScenario?.let { scenario ->
        // Keep onPause/onStop real; let framework instrumentation own terminal process completion.
        scenario.moveToState(Lifecycle.State.CREATED)
        assertEquals("Tauri activity must be stopped before instrumentation completes", Lifecycle.State.CREATED, scenario.state)
      }
    } finally {
      ownedScenario = null
      grantedUris.forEach { uri ->
        instrumentation.context.revokeUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      }
      grantedUris.clear()
    }
  }

  @Test fun shellCommandTransportPreservesFixtureBytesAndExitStatus() {
    assertEquals("fixture Ω two words", checkedShell("printf '%s' 'fixture Ω two words'"))
    assertEquals("line one\nline two", checkedShell("printf 'line one\\nline two'"))
    assertEquals("", checkedShell(":"))
    val failed = runCatching { checkedShell("exit 7") }.exceptionOrNull()
    assertTrue("a nonzero native command must expose its actual exit status rather than a missing marker", failed is AssertionError && failed.message?.contains("expected:<0> but was:<7>") == true)
  }

  @Test
  fun resolvedIntentDisplaysColdAndWarmProviderDocuments() {
    val cold = grant(documentUri("resolver-cold"))
    val warm = grant(documentUri("resolver-warm"))
    val coldIntent = viewIntent(cold, "text/markdown")
    val component = requireNotNull(glitchpadComponent(coldIntent)) {
      "installed Glitchpad package did not resolve the cold fixture"
    }

    val scenario = ActivityScenario.launch<MainActivity>(coldIntent.setComponent(component)).also { ownedScenario = it }
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
      waitForBodyText(scenario, "original.$extension")
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
        clickControl(scenario, "More image tools")
        waitForBodyText(scenario, "Play", "Next frame")
        evaluate(scenario, "(()=>{window.__s040PreviousPreview=document.querySelector('.image-preview').src;const next=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Next frame');next.click();return true;})()")
        waitForImagePixels(scenario, name, true)
        waitForBodyText(scenario, "of " + if (name.endsWith("gif")) "4" else "2")
      }
      if (name.endsWith("ico")) {
        clickControl(scenario, "More image tools")
        waitForBodyText(scenario, "Export selected entry as PNG")
        val inventory = JSONObject(evaluate(scenario, "(()=>{const entries=document.querySelector('select[aria-label=\"Icon entry\"]');const options=Array.from(entries.options).map(option=>option.textContent);return {count:options.length,dib:options.some(text=>text.includes('dib')),duplicate:options.some(text=>text.includes('duplicate'))};})()"))
        assertEquals("every bounded ICO directory row must be exposed", 4, inventory.getInt("count"))
        assertTrue("DIB entry facts must be available in native entry selection", inventory.getBoolean("dib"))
        assertTrue("duplicate entry facts must be available in native entry selection", inventory.getBoolean("duplicate"))
        evaluate(scenario, "window.__s040PreviousPreview=document.querySelector('.image-preview').src;true")
        chooseTaskOption(scenario,"Icon entry",1,"1")
        waitForImagePixels(scenario, name, true)
        verifySelectedIconExport(scenario, uri, before)
      }
      if (name.endsWith("gif") || name == "animated.webp" || name.endsWith("ico")) clickControl(scenario, "Close Image tools")
      assertTrue("image-family preview changed original provider bytes", before.contentEquals(resolver.openInputStream(uri)!!.use { it.readBytes() }))
    }
    val hostile = grant(documentUri("hostile.svg"))
    val hostileBefore = readBytes(hostile)
    clientContext.startActivity(viewIntent(hostile, "image/*").setComponent(component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    waitForDocumentIdentity(scenario, "hostile.svg")
    waitForCondition(scenario, "!!document.querySelector('[data-preview-failure=svg_unsupported]')", "SCRIPT-first hostile SVG must expose its exact finite unsupported category")
    assertEquals("true", evaluate(scenario, "!document.querySelector('.image-preview')&&!Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Retry preview')"))
    menuAction(scenario, "File information")
    waitForBodyText(scenario, "File information", "hostile.svg")
    clickControl(scenario, "Close File information")
    assertTrue("unsupported SVG preview must preserve every original source byte", hostileBefore.contentEquals(readBytes(hostile)))
    println("image_family_evidence=gif:pass,animated_webp:pass,svg:pass,ico_png_dib:pass,hostile_svg:refused,source_unchanged:pass,api:${android.os.Build.VERSION.SDK_INT}")
    println("image_evidence=png:pass,jpeg:pass,webp:pass,bmp:pass,tiff:pass,source_unchanged:pass,api:${android.os.Build.VERSION.SDK_INT}")
    println("delivery_evidence=cold:pass,warm:pass,api:${android.os.Build.VERSION.SDK_INT}")
    System.out.flush()

  }

  @Test
  fun governedMarkdownDeliveryRoutes() {
    val route = InstrumentationRegistry.getArguments().getString("deliveryAction") ?: throw AssertionError("cold delivery action required")
    assertTrue("only the governed view/send routes may be selected", route == "view" || route == "send")
    val cold = grant(documentUri("recovery-corpus.md"))
    val coldBefore = readBytes(cold)
    val launch = markdownDeliveryIntent(cold, route)
    val component = requireNotNull(glitchpadComponent(launch)) { "installed Glitchpad package must resolve the governed cold Markdown route" }
    val scenario = ActivityScenario.launch<MainActivity>(launch.setComponent(component)).also { ownedScenario = it }
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
    val scenario = ActivityScenario.launch<MainActivity>(Intent(clientContext, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)).also { ownedScenario = it }
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
      assertEquals("write refusal must retain every edited source character", text, editableSourceText(scenario))
      val saved = destination(type, "s046-draft")
      chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, chosen(saved), { if (choice == "New text file") keyboardSave(scenario) else menuAction(scenario, "Save") }, "Saved after native verification.")
      waitForCondition(scenario, "(()=>{const n=document.querySelector('[data-draft-identity]');return !!n&&n.textContent.includes('Saved')&&!n.textContent.includes('Unsaved changes');})()", "dirty state must clear after actual native save receipt")
      assertTrue("saved draft must match exact expected UTF-8 bytes", text.toByteArray(Charsets.UTF_8).contentEquals(readBytes(saved)))
      recordJourneyReadback(4, "utf8", text.toByteArray(Charsets.UTF_8), readBytes(saved))
      closeCurrentDocument(scenario)
      openFromAddDocument(scenario, saved)
      waitForBodyText(scenario, text.substringAfterLast("S046_", text).lineSequence().first().trim())
    }
    if (isS047Evidence() && expectedBuildVariant() == "ordinary") assertEquals("ordinary APK must not install the fault save getter", "true", evaluate(scenario, "!Object.getOwnPropertyDescriptor(window,'__GLITCHPAD_SAVE_OBSERVATION__')"))
    if (isS047Evidence()) emitS047Journey(scenario, 4, listOf("new_markdown", "new_text", "exact_utf8", "reopen", "cancel", "failed_write", "dirty_receipt"))
    val corpus = grant(documentUri("recovery-corpus.md"))
    openFromAddDocument(scenario, corpus)
    waitForBodyText(scenario, "S046 Markdown corpus", "S046_CORPUS_MARKER", "list item", "code block", "Unicode")
    waitForCondition(scenario, "!!document.querySelector('.markdown-document h1') && !!document.querySelector('.markdown-document table')", "native Open must produce actual Markdown heading and table")
    if (expectedBuildVariant() == "fault_probe") verifyMarkdownFailures(scenario, corpus)
    for (name in listOf("recovery-empty.md", "recovery-malformed.md")) {
      openFromAddDocument(scenario, grant(documentUri(name)))
      waitForBodyText(scenario, name, "Add document")
      waitForCondition(scenario, "!!document.querySelector('.app-shell') && (!!document.querySelector('.cm-content') || Array.from(document.querySelectorAll('.markdown-document')).some(n=>['ready','empty','failed','limited'].includes(n.getAttribute('data-performance-status'))))", "empty/malformed Markdown must reach content or actionable terminal fallback")
    }
    val original = grant(documentUri("recovery-readonly.md"))
    val before = readBytes(original)
    openFromAddDocument(scenario, original)
    waitForBodyText(scenario, "S046_ORIGINAL_UNCHANGED")
    if (isS047Evidence()) {
      clickControl(scenario, "Document tools")
      assertEquals("true", evaluate(scenario, "(()=>{const items=Array.from(document.querySelectorAll('[aria-label=\"Document tools\"] [role=menuitem]'));return items.filter(n=>((n.querySelector('span')&&n.querySelector('span').textContent)||n.textContent).trim()==='Save').every(n=>n.disabled);})()"))
      clickControl(scenario, "Close Document tools")
    }
    menuAction(scenario, "Edit a copy")
    waitForBodyText(scenario, "Copy of recovery-readonly.md")
    val copyText = "# S046 edited copy\n\nS046_COPY_BYTES\n"
    replaceEditorText(scenario, copyText)
    val copy = destination("text/markdown", "s046-copy")
    chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, chosen(copy), { menuAction(scenario, "Save") }, "Saved after native verification.")
    assertTrue("read-only original must survive copy editing and save", before.contentEquals(readBytes(original)))
    assertTrue("copy destination must contain the exact edited bytes", copyText.toByteArray(Charsets.UTF_8).contentEquals(readBytes(copy)))
    recordJourneyReadback(5, "utf8", copyText.toByteArray(Charsets.UTF_8), readBytes(copy))
    if (isS047Evidence()) emitS047Journey(scenario, 5, listOf("edit_copy", "original_unchanged", "in_place_unavailable"))
    verifyDirtyCloseAndPendingRace(scenario, destination("text/plain", "s046-dirty-close"))
    verifySharedImageActions(scenario)
    verifyDiagnosticTasks(scenario, destination("application/json", "s046-diagnostic"), destination("application/json", "s046-write-refused-diagnostic"))
    if (isS047Evidence()) emitS047Journey(scenario, 7, listOf("frozen_redacted", "save_readback", "cancel", "failed_write", "share_cancel", "share_receiver", "runtime_facts", "diagnostic_clear"))
    println("recovery_evidence=launcher:pass,new_markdown:pass,new_text:pass,native_open:pass,exact_save_reopen:pass,keyboard_ctrl_s_receipt_reopen:pass,cancel:pass,failed_write:pass,readonly_copy:pass,dirty_close_pending:pass,diagnostic_save_share:pass,menu_local_zoom:pass,api:" + Build.VERSION.SDK_INT)
    System.out.flush()
    saveScreenshot("s046-authoring.png")
    created.forEach { runCatching { DocumentsContract.deleteDocument(resolver, it) } }

  }

  @Test
  fun rootFailureRetainsDraft() {
    val scenario = ActivityScenario.launch<MainActivity>(Intent(clientContext, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)).also { ownedScenario = it }
    verifyRootFailureRetainsDraft(scenario)
  }

  private fun verifyRootFailureRetainsDraft(scenario: ActivityScenario<MainActivity>) {
    assertTrue("root recovery must reuse the active owned activity scenario", ownedScenario === scenario)
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
    println("root_recovery_evidence=" + JSONObject().put("root_fallback", "pass").put("draft_retained", "pass").put("diagnostic_event_retained", "pass").put("source_commit", expectedSource).put("apk_sha256", apkSha256()).put("recovery_probe_variant", if (expectedBuildVariant() == "fault_probe") "compiled_test_only" else "none").put("api_level", Build.VERSION.SDK_INT).toString())
    System.out.flush()

  }

  @Test
  fun addDocumentAtMaximumFontScale() {
    assertTrue("maximum-font row requires Android14+", Build.VERSION.SDK_INT >= 34)
    assertTrue("system font scale must actually be 200%", clientContext.resources.configuration.fontScale >= 1.99f)
    val scenario = ActivityScenario.launch<MainActivity>(Intent(clientContext, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)).also { ownedScenario = it }
    waitForBodyText(scenario, "Add document")
    verifyAddDocumentChoices(scenario)
    scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
    waitForCondition(scenario, "window.innerWidth>window.innerHeight", "actual landscape viewport must be observed")
    waitForBodyText(scenario, "Add document")
    verifyAddDocumentChoices(scenario)
    saveScreenshot("s046-font-scale.png")
    println("recovery_font_evidence=font_scale:2.0,portrait:pass,landscape:pass,all_choices_reachable:pass,targets_48dp:pass,api:" + Build.VERSION.SDK_INT)
    System.out.flush()

  }

  @Test
  fun draftRecoveryAcrossProcessBoundary() {
    val phase = InstrumentationRegistry.getArguments().getString("recoveryPhase") ?: throw AssertionError("recovery phase required")
    val text = "# S046 retained draft\n\nS046_PROCESS_RECOVERY_Ω\n"
    val scenario = ActivityScenario.launch<MainActivity>(Intent(clientContext, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)).also { ownedScenario = it }
    if (phase == "seed") {
      waitForBodyText(scenario, "Add document")
      createNewDraftForInput(scenario, "New Markdown", "Untitled.md")
      replaceEditorText(scenario, text)
      // The existing bounded store snapshots after two seconds idle. Native
      // lifecycle flush is exercised again by the @After stopped transition.
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
    waitForCondition(scenario, "(()=>{const add=document.querySelector('[data-add-document]');return !!add&&add.getAttribute('data-native-viewport')==='true'&&Number(add.getAttribute('data-native-viewport-width'))===window.innerWidth&&Number(add.getAttribute('data-native-viewport-height'))===window.innerHeight;})()", "Add document requires a current native viewport observation before reachability qualification")
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
          return {label:control.textContent.trim(),width:rect.width,height:rect.height,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,visibleWidth:clip.right-clip.left,visibleHeight:clip.bottom-clip.top,hit:hit===control||control.contains(hit),disabled:control.disabled,backgroundInert:!!control.closest('[inert],[aria-hidden=true]'),inlineTrigger:control.classList.contains('add-document-inline-trigger')};
        };
        const surface=document.querySelector('.document-surface');
        const rect=surface.getBoundingClientRect();
        const rendered=node=>{
          if(!node||node.closest('[hidden],.markdown-print-document,.visually-hidden'))return false;
          for(let ancestor=node;ancestor;ancestor=ancestor.parentElement){const style=getComputedStyle(ancestor);if(style.display==='none'||style.visibility==='hidden')return false;}
          const box=node.getBoundingClientRect();return box.width>0&&box.height>0;
        };
        const currentSelector=surface.querySelector('.markdown-surface')
          ?(surface.querySelector('.markdown-source-mode:not([hidden])')?'.markdown-source-mode .cm-scroller':'.markdown-rendered-mode .markdown-document:not(.markdown-print-document)')
          :surface.querySelector('.mermaid-surface')
            ?(surface.querySelector('.mermaid-source-mode')?'.mermaid-source-mode .cm-scroller':'.mermaid-rendered-mode .diagram-canvas')
            :surface.querySelector('.image-pane')?'.image-pane':surface.querySelector('.large-text')?'.large-text-content':surface.querySelector('.cm-content')?'.cm-scroller':null;
        const current=currentSelector?Array.from(surface.querySelectorAll(currentSelector)).find(rendered):null;
        const currentRect=current?current.getBoundingClientRect():null;
        return {viewport:visible,action:measure(element),trigger:measure(document.querySelector('.add-document-trigger')),document:{width:rect.width,height:rect.height,top:rect.top,bottom:rect.bottom},currentViewport:currentSelector?{selector:currentSelector,visible:!!currentRect,width:currentRect?currentRect.width:0,height:currentRect?currentRect.height:0,clientHeight:current?current.clientHeight:0,ratio:currentRect?currentRect.height/rect.height:0}:null,paddingBottom:Number.parseFloat(getComputedStyle(surface).paddingBottom)};
      })()
    """.trimIndent().replace("SELECTOR", selector)
    val measured = JSONObject(evaluate(scenario, script))
    val viewport = measured.getJSONObject("viewport")
    for (kind in listOf("action", "trigger")) {
      val control = measured.getJSONObject(kind)
      val left = control.getDouble("left") - viewport.getDouble("left")
      val top = control.getDouble("top") - viewport.getDouble("top")
      val right = control.getDouble("right") - viewport.getDouble("left")
      val bottom = control.getDouble("bottom") - viewport.getDouble("top")
      val target = JSONObject().put("found", true).put("left", left).put("top", top).put("right", right).put("bottom", bottom)
        .put("x", (left + right) / 2).put("y", (top + bottom) / 2).put("viewport_width", viewport.getDouble("width"))
      measured.put(kind + "_native", nativeControlGeometry(scenario, target))
    }
    println("add_document_geometry=" + measured.put("stage", if (choiceSelector == null) "closed" else "scrolled_choice").toString())
    System.out.flush()
    for (kind in listOf("action", "trigger")) {
      val control = measured.getJSONObject(kind)
      val label = control.getString("label")
      assertTrue(label + " must retain a 48dp-equivalent target", control.getDouble("width") >= 48.0 && control.getDouble("height") >= 48.0)
      assertTrue(label + " must be fully inside the visible viewport after local menu scrolling", control.getDouble("left") >= viewport.getDouble("left") - 0.6 && control.getDouble("right") <= viewport.getDouble("left") + viewport.getDouble("width") + 0.6 && control.getDouble("top") >= viewport.getDouble("top") - 0.6 && control.getDouble("bottom") <= viewport.getDouble("top") + viewport.getDouble("height") + 0.6)
      assertTrue(label + " must fit the actual native WebView/window intersection", measured.getJSONObject(kind + "_native").optBoolean("whole_control_visible"))
      assertTrue(label + " must retain a whole unclipped target", control.getDouble("visibleWidth") >= 48.0 && control.getDouble("visibleHeight") >= 48.0)
      val backgroundTrigger=choiceSelector!=null&&kind=="trigger"&&control.getBoolean("backgroundInert")
      if(choiceSelector!=null&&kind=="trigger"&&control.getBoolean("inlineTrigger"))assertTrue("open compact Add trigger must be an inert background control",backgroundTrigger)
      if(!backgroundTrigger){
        assertTrue(label + " must remain outside inert background content",!control.getBoolean("backgroundInert"))
        assertTrue(label + " must receive input at its visible center", control.getBoolean("hit"))
        assertTrue(label + " must be enabled", !control.getBoolean("disabled"))
      }
    }
    val surface = measured.getJSONObject("document")
    assertTrue("real document surface must keep positive area", surface.getDouble("width") > 0 && surface.getDouble("height") > 0)
    if (choiceSelector == null) {
      val trigger=measured.getJSONObject("trigger")
      if(trigger.getDouble("bottom")<=surface.getDouble("top")+0.6) measured.put("trigger_placement","chrome_above_document")
      else {
        measured.put("trigger_placement","floating")
        assertTrue("closed-state document clearance must reserve an overlapping floating target", measured.getDouble("paddingBottom") + 0.6 >= surface.getDouble("bottom") - trigger.getDouble("top"))
      }
      if(!measured.isNull("currentViewport")){
        val current=measured.getJSONObject("currentViewport")
        assertTrue("the actual current reading/editing viewport must be visible and retain positive client area",current.getBoolean("visible")&&current.getDouble("width")>0&&current.getDouble("height")>0&&current.getInt("clientHeight")>0)
        assertTrue("current viewport must own at least70% of the actual document area",current.getDouble("ratio")>=0.7)
      }
    }
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
    taskKey(KeyEvent.KEYCODE_W, KeyEvent.META_CTRL_ON)
    waitForBodyText(scenario, "Unsaved changes in Untitled.txt", "No content has been discarded.")
    clickControl(scenario, "Cancel")
    waitForCondition(scenario, "!document.querySelector('.resolution-dialog') && !!document.querySelector('.cm-content[contenteditable=true]')", "dirty close cancellation must retain the draft")
    assertEquals("true", evaluate(scenario, "(()=>{document.querySelector('.app-shell').dispatchEvent(new KeyboardEvent('keydown',{key:'w',ctrlKey:true,bubbles:true}));return true;})()"))
    waitForBodyText(scenario, "Unsaved changes in Untitled.txt")
    val pickerPackage = createDocumentPickerPackage()
    val monitor = instrumentation.addMonitor(IntentFilter(Intent.ACTION_CREATE_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); addDataType("*/*") }, null, false)
    val beforePickerSurfaceId = runCatching {
      stringValue(evaluate(scenario, "(()=>{const surface=document.querySelector('.document-surface');return surface?surface.id:'';})()"))
    }.getOrNull()
    try {
      tapNativeControlOnce(scenario, "Save As")
      waitForNativePickerWindow(scenario, "Save As", pickerPackage)
      assertTrue("one real native create chooser must own the cancelled save", monitor.hits == 1)
      cancelExternalNativeWindow(scenario, "document picker", pickerPackage)
      try {
        waitForBodyText(scenario, "Save cancelled. Edits remain open.")
      } catch (failure: Throwable) {
        runCatching { captureCancelledSaveFailure(scenario, beforePickerSurfaceId, monitor.hits) }
          .onFailure { println("native_cancelled_save_capture_failed=true"); System.out.flush() }
        throw failure
      }
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
    assertEquals("cancelled native Save must retain every draft character", "S046_DIRTY_CLOSE_BYTES\n", editableSourceText(scenario))
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
      tapNativeControlOnce(scenario, "Save As")
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
      assertEquals("blocked Discard during real native I/O must retain every draft character", "S046_DIRTY_CLOSE_BYTES\n", editableSourceText(scenario))
    } catch (failure: Throwable) {
      originalFailure = failure
      pendingObservations.put("held_provider_at_failure", runCatching { heldFixtureWriteState("held_write_status", destination) }
        .getOrElse { JSONObject().put("capture_failed", true).put("failure_type", it.javaClass.simpleName) })
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
    assertEquals("refused held Save and blocked Discard must retain every draft character", "S046_DIRTY_CLOSE_BYTES\n", editableSourceText(scenario))
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

  private fun cancelledSaveBrowserScript(beforePickerSurfaceId: String?): String = """
    (()=>{
      const expectedSurface=EXPECTED_SURFACE;
      const surface=document.querySelector('.document-surface');
      const editor=surface&&surface.querySelector('.cm-content[contenteditable=true]');
      const context=editor&&editor.editContext;
      const dialogs=Array.from(document.querySelectorAll('.resolution-dialog'));
      const dialog=dialogs[0];
      const buttons=dialog?Array.from(dialog.querySelectorAll('button')):[];
      const statusNodes=Array.from(document.querySelectorAll('[role=status],[role=alert]'));
      const statuses=statusNodes.slice(0,12).map(node=>node.textContent||'');
      const command=document.querySelector('.command-result');
      const commandText=command?command.textContent||'':'';
      const bodyText=document.body?document.body.innerText:'';
      const knownFeedback=[
        ['save_cancelled','Save cancelled. Edits remain open.'],
        ['save_pending','Saving. Waiting for a verified native write receipt.'],
        ['save_verified','Saved after native verification.'],
        ['save_failed','Save did not complete. Try again or choose another destination. Your edits remain open.'],
        ['destination_conflict','That destination already contains a document. Choose a new name or another destination. Your edits remain open.'],
        ['source_unavailable','Source access is unavailable. Select the source again, then save a copy to a new destination. Your edits remain open.'],
        ['source_changed','The source changed. Open it again to review the changes, then save a copy to a new destination. Your edits remain open.'],
        ['original_destination_denied','Choose a different destination to keep the original unchanged. Your edits remain open.'],
        ['write_unverified','The destination write could not be verified. Choose another destination or try again. Your edits remain open.'],
        ['save_budget_exceeded','This document exceeds the native save limit. Keep it open and copy smaller sections to another document.']
      ];
      const classify=text=>knownFeedback.filter(entry=>text.includes(entry[1])).map(entry=>entry[0]);
      const staleSuffix=' changed while the decision was open. Review the current unsaved changes.';
      const lines=editor?Array.from(editor.querySelectorAll(':scope > .cm-line')):[];
      const semantic=lines.map(line=>line.textContent||'').join('\n');
      const identity=document.querySelector('[data-draft-identity]');
      const identityState=identity&&identity.lastElementChild?identity.lastElementChild.textContent:'';
      const activeTab=document.querySelector('[role=tab][aria-selected=true]');
      const revision=surface?Number(surface.getAttribute('data-performance-revision')):NaN;
      const add=document.querySelector('[data-add-document]');
      let saveObservation={available:false};
      try {
        const probe=window.__GLITCHPAD_SAVE_OBSERVATION__;
        if(probe&&typeof probe==='object'){
          const flag=key=>probe[key]===true?true:probe[key]===false?false:null;
          saveObservation={
            available:true,
            generation:Number.isSafeInteger(probe.generation)&&probe.generation>=0?probe.generation:null,
            create_invoke_started:flag('create_invoke_started'),
            create_invoke_resolved:flag('create_invoke_resolved'),
            create_gateway_catch:flag('create_gateway_catch'),
            picker_cancelled_classified:flag('picker_cancelled_classified'),
            save_session_catch:flag('save_session_catch'),
            save_session_finally:flag('save_session_finally'),
            sdk_registry_available:flag('sdk_registry_available'),
            sdk_pair_available:flag('sdk_pair_available'),
            sdk_same_registry:flag('sdk_same_registry'),
            success_entry_still_registered:flag('success_entry_still_registered'),
            error_entry_still_registered:flag('error_entry_still_registered'),
            sdk_callback_entry_observed:false
          };
        }
      } catch { saveObservation={available:false,capture_failed:true}; }
      return {
        save_observation:saveObservation,
        app_shell_present:!!document.querySelector('.app-shell'),
        application_recovery_present:!!document.querySelector('.application-recovery'),
        bootstrap_recovery_present:!!Array.from(document.querySelectorAll('.application-recovery h1')).find(node=>node.textContent==='Glitchpad could not start'),
        root_recovery_present:!!Array.from(document.querySelectorAll('.application-recovery h1')).find(node=>node.textContent==='Glitchpad could not continue'),
        document_recovery_present:!!document.querySelector('.document-render-failure,.markdown-failure,.markdown-recovery-banner'),
        expected_feedback_in_body:bodyText.includes('Save cancelled. Edits remain open.'),
        body_length:bodyText.length,
        command_feedback:classify(commandText),
        command_status_present:!!command,
        command_feedback_unclassified:!!commandText&&classify(commandText).length===0,
        status_count:statusNodes.length,
        status_feedback:statuses.map(classify),
        stale_decision_feedback:statuses.some(text=>text.endsWith(staleSuffix)),
        resolution_count:dialogs.length,
        dialog_count:document.querySelectorAll('[role=dialog]').length,
        dialog_aria_busy:!!dialog&&dialog.getAttribute('aria-busy')==='true',
        dialog_waiting_for_receipt:!!dialog&&!!Array.from(dialog.querySelectorAll('[role=status]')).find(node=>node.textContent==='Save As requested. The document remains open until a durable receipt arrives.'||node.textContent==='Save requested. The document remains open until a durable receipt arrives.'),
        decision_buttons:buttons.slice(0,8).map(button=>({kind:({'Save':'save','Save As':'save_as','Discard':'discard','Cancel':'cancel'})[button.textContent.trim()]||'unclassified',disabled:button.disabled})),
        surface_count:document.querySelectorAll('.document-surface').length,
        surface_present:!!surface,
        before_picker_surface_available:!!expectedSurface,
        same_surface_as_before_picker:!!expectedSurface&&!!surface&&surface.id===expectedSurface,
        active_tab_present:!!activeTab,
        active_tab_matches_surface:!!activeTab&&!!surface&&activeTab.getAttribute('aria-controls')===surface.id,
        surface_revision:Number.isFinite(revision)?revision:null,
        editable_surface_present:!!editor,
        editor_focused:!!editor&&document.activeElement===editor,
        semantic_length:editor?semantic.length:null,
        semantic_utf8_bytes:editor&&typeof TextEncoder==='function'?new TextEncoder().encode(semantic).length:null,
        editing_length:editor?(context?context.text:editor.innerText).length:null,
        draft_identity_present:!!identity,
        draft_saving:identityState==='Saving…',
        draft_unsaved:identityState==='Unsaved changes',
        draft_saved:identityState==='Saved',
        add_disabled:!!add&&add.getAttribute('data-disabled')==='true',
        add_hidden:!!add&&getComputedStyle(add).visibility==='hidden',
        document_focused:document.hasFocus()
      };
    })()
  """.trimIndent().replace("EXPECTED_SURFACE", JSONObject.quote(beforePickerSurfaceId ?: ""))

  private fun captureCancelledSaveFailure(
    scenario: ActivityScenario<MainActivity>, beforePickerSurfaceId: String?, monitorHits: Int
  ) {
    val browser = runCatching { JSONObject(evaluate(scenario, cancelledSaveBrowserScript(beforePickerSurfaceId))) }
      .getOrElse { failure -> JSONObject().put("capture_failed", true)
        .put("capture_failure", if (failure is AssertionError && failure.message == "WebView image control did not complete") "callback_timeout" else "snapshot_unavailable") }
    val screenshotSaved = runCatching {
      val screenshot = File(clientContext.filesDir, "s046-authoring.png")
      screenshot.delete()
      saveScreenshot("s046-authoring.png")
      screenshot.isFile
    }.getOrDefault(false)
    println("native_cancelled_save_failure=" + JSONObject().put("phase", "cancelled_native_save_feedback")
      .put("api_level", Build.VERSION.SDK_INT).put("monitor_hits", monitorHits).put("browser", browser)
      .put("screenshot_saved", screenshotSaved))
    System.out.flush()
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
    val imageOwner = stringValue(evaluate(scenario, "document.querySelector('.document-surface').id"))
    fun imageScaleIs(scale: Double, label: String): String = "(()=>{const owner=document.querySelector('.document-surface');const pane=owner&&owner.querySelector('.image-pane');const output=owner&&owner.querySelector('output[aria-label=\"Image zoom\"]');return !!pane&&!!output&&owner.id===" + JSONObject.quote(imageOwner) + "&&Math.abs(Number(pane.getAttribute('data-viewport-scale'))-" + scale + ")<0.0001&&output.textContent===" + JSONObject.quote(label) + ";})()"
    waitForCondition(scenario, imageScaleIs(1.25, "125%"), "menu Zoom must change the actual current image viewport")
    clickControl(scenario, "Zoom in")
    waitForCondition(scenario, imageScaleIs(1.5625, "156.3%"), "local Zoom must multiply the same current viewport scale and display its truthful rounded percentage")
    menuAction(scenario, "Fit")
    waitForCondition(scenario, imageScaleIs(1.0, "100%"), "menu Fit must reset the same current viewport")
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
    if (expectedBuildVariant() == "fault_probe") for (reason in listOf("markdown_worker_failed", "markdown_parse_failed", "markdown_projection_failed")) assertTrue("actual injected failure must be in the frozen bundle: " + reason, frozen.contains(reason))
    assertTrue("default diagnostic preview must omit document bytes/names/provider URIs", !frozen.contains("S046_") && !frozen.contains("S047_") && !frozen.contains("s047-controls") && !frozen.contains("content://") && !frozen.contains("recovery-corpus.md"))
    chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, ActivityResult(Activity.RESULT_CANCELED, Intent()), { clickControl(scenario, "Save previewed bundle") }, "Cancelled. The preview is retained.")
    chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, chosen(refused), { clickControl(scenario, "Save previewed bundle") }, "Export failed. The exact preview is retained")
    assertEquals("cancel/failure must preserve frozen preview", frozen, stringValue(evaluate(scenario, "document.querySelector('.diagnostic-preview').textContent")))
    chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, chosen(destination), { clickControl(scenario, "Save previewed bundle") }, "Diagnostic bundle saved and verified.")
    assertTrue("saved diagnostic JSON bytes must equal exact frozen preview", frozen.toByteArray(Charsets.UTF_8).contentEquals(readBytes(destination)))
    recordJourneyReadback(7, "json_save", frozen.toByteArray(Charsets.UTF_8), readBytes(destination))
    resolver.call(FixtureGrantProvider.COMMAND_URI, "clear_share_result", null, null)
    tapNativeControlOnce(scenario, "Share previewed bundle")
    val sharePackage = clickNativeText("Glitchpad diagnostic fixture", false)
    cancelExternalNativeWindow(scenario, "system Share chooser", sharePackage)
    waitForBodyText(scenario, "Cancelled. The preview is retained.")
    assertEquals("Share cancellation must retain the exact preview", frozen, stringValue(evaluate(scenario, "document.querySelector('.diagnostic-preview').textContent")))
    tapNativeControlOnce(scenario, "Share previewed bundle")
    clickNativeText("Glitchpad diagnostic fixture")
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    var received = resolver.call(FixtureGrantProvider.COMMAND_URI, "share_result", null, null)
    while (SystemClock.elapsedRealtime() < deadline && received?.getString("json") == null) { SystemClock.sleep(100L); received = resolver.call(FixtureGrantProvider.COMMAND_URI, "share_result", null, null) }
    assertEquals("actual receiving activity must read the frozen JSON", frozen, received?.getString("json"))
    assertTrue("receiver must have a temporary read grant", received?.getBoolean("read_granted") == true)
    recordJourneyReadback(7, "json_receiver", frozen.toByteArray(Charsets.UTF_8), requireNotNull(received?.getString("json")).toByteArray(Charsets.UTF_8))
    waitForAppNativeWindow(scenario, "Share previewed bundle")
    waitForBodyText(scenario, "Shared with the system. Recipient delivery is unconfirmed.")
    println("recovery_runtime_evidence=" + JSONObject().put("apk_sha256", apkSha256()).put("source_commit", expectedSource).put("package", TARGET_PACKAGE).put("product_version", packageInfo.versionName).put("evidence_class", "hosted_debug_instrumentation").put("signed_release_bytes_tested", false).put("recovery_probe_variant", if (expectedBuildVariant() == "fault_probe") "compiled_test_only" else "none").put("native_environment", native).put("font_scale", clientContext.resources.configuration.fontScale).toString())

    if (isS047Evidence()) {
      val surface = stringValue(evaluate(scenario,"document.querySelector('.document-surface').id"))
      val clearRequestedAt = System.currentTimeMillis()
      clickControl(scenario,"Clear diagnostics")
      waitForBodyText(scenario,"Stored diagnostics cleared")
      assertEquals(0,JSONObject(stringValue(evaluate(scenario,"document.querySelector('.diagnostic-preview').textContent"))).getJSONArray("events").length())
      clickControl(scenario,"Close Diagnostics")
      menuAction(scenario,"Diagnostics")
      waitForBodyText(scenario,"Redacted diagnostic preview ready")
      val afterClear = JSONObject(stringValue(evaluate(scenario,"document.querySelector('.diagnostic-preview').textContent"))).getJSONArray("events")
      for (index in 0 until afterClear.length()) assertTrue("recreated diagnostics must contain no event predating Clear: " + afterClear.getJSONObject(index), afterClear.getJSONObject(index).getLong("occurred_unix_ms") >= clearRequestedAt)
      println("s047_diagnostics_after_clear=" + afterClear); System.out.flush()
      assertEquals("clearing diagnostics must preserve current document",surface,stringValue(evaluate(scenario,"document.querySelector('.document-surface').id")))
    }
    clickControl(scenario, "Close Diagnostics")
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

  private fun menuAction(scenario: ActivityScenario<MainActivity>, name: String) {
    val application = name in listOf("Preferences", "Diagnostics", "Help and support", "About Glitchpad")
    val owner = if (application) "[role=menu][aria-label=\"Glitchpad menu\"]" else "[role=menu][aria-label=\"Document tools\"]"
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    waitForCondition(scenario, "!document.querySelector(" + JSONObject.quote(owner) + ")", "the preceding owned menu must finish dismissal before its next opener is toggled", deadlineOverride = deadline)
    clickControl(scenario, if (application) "Menu" else "Document tools", deadlineOverride = deadline)
    if (name == "Copy") tapNativeControlOnce(scenario, name, "[role=menuitem]", deadlineOverride = deadline)
    else clickControl(scenario, name, "[role=menuitem]", deadlineOverride = deadline)
    waitForCondition(scenario, "!document.querySelector(" + JSONObject.quote(owner) + ")", "the owned menu must finish dismissal before subsequent task sampling", deadlineOverride = deadline)
    if (name in listOf("Undo", "Redo")) waitForCondition(scenario, "document.activeElement===document.querySelector('.document-tools-trigger')", "history menu completion must restore its real opener before subsequent native input setup", deadlineOverride = deadline)
  }

  private fun clickControl(scenario: ActivityScenario<MainActivity>, name: String, selector: String = "button", deadlineOverride: Long? = null) {
    val nameLiteral = JSONObject.quote(name)
    val selectorLiteral = JSONObject.quote(selector)
    val actionDeadline = deadlineOverride ?: (SystemClock.elapsedRealtime() + 30_000L)
    waitForCondition(scenario, "Array.from(document.querySelectorAll(" + selectorLiteral + ")).some(b=>!b.disabled&&(b.getAttribute('aria-label')||(b.getAttribute('role')==='menuitem'&&b.querySelector('span')?b.querySelector('span').textContent:b.textContent)).trim()===" + nameLiteral + ")", "named actual-app control must be enabled: " + name, deadlineOverride = actionDeadline)
    assertEquals("actual-app control must be clicked once", "true", evaluate(scenario, "(()=>{const button=Array.from(document.querySelectorAll(" + selectorLiteral + ")).find(b=>!b.disabled&&(b.getAttribute('aria-label')||(b.getAttribute('role')==='menuitem'&&b.querySelector('span')?b.querySelector('span').textContent:b.textContent)).trim()===" + nameLiteral + ");if(!button)return false;button.click();return true;})()", deadlineOverride = actionDeadline, actionCallback = true))
    if (name == "Close Preferences") waitForCondition(scenario, "!Array.from(document.querySelectorAll('[role=dialog]')).some(n=>n.querySelector('h2')&&n.querySelector('h2').textContent==='Preferences')&&document.activeElement===document.querySelector('.application-menu-trigger')", "Preferences dismissal must restore its real opener before the following task starts", deadlineOverride = actionDeadline)
  }

  // Read native visible bounds and IME windows before mapping a CSS control to screen input.
  private fun enableNativeWindowObservation() {
    val service = requireNotNull(instrumentation.uiAutomation.serviceInfo)
    if (service.flags and android.accessibilityservice.AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS == 0) {
      service.flags = service.flags or android.accessibilityservice.AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
      instrumentation.uiAutomation.serviceInfo = service
    }
  }






  private fun verifyExternalViewDispatch(scenario: ActivityScenario<MainActivity>, expectedUrl: String, trigger: (Long) -> Unit) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    val requests = java.util.concurrent.CopyOnWriteArrayList<Intent>()
    val callback = IntentCallback { intent -> if (intent.action == Intent.ACTION_VIEW) requests.add(Intent(intent)) }
    val monitor = IntentMonitorRegistry.getInstance()
    assertTrue("the scoped native intent observation must not replace another stub owner", !IntentStubberRegistry.isLoaded())
    monitor.addIntentCallback(callback)
    var stubOwned = false
    try {
      IntentStubberRegistry.load(object : IntentStubber {
        override fun getActivityResultForIntent(intent: Intent): ActivityResult? =
          if (intent.action == Intent.ACTION_VIEW) ActivityResult(Activity.RESULT_CANCELED, Intent()) else null
      })
      stubOwned = true
      trigger(deadline)
      while (requests.isEmpty() && SystemClock.elapsedRealtime() < deadline) SystemClock.sleep(100L)
      assertTrue("the actual application context must dispatch an external intent within the action deadline", SystemClock.elapsedRealtime() < deadline && requests.isNotEmpty())
      assertEquals("one explicit destination action must dispatch exactly one native intent", 1, requests.size)
      val request = requests.single()
      assertEquals(Intent.ACTION_VIEW, request.action)
      assertEquals(expectedUrl, request.dataString)
      assertTrue("external handoff must not attach document or diagnostic content", !request.hasExtra(Intent.EXTRA_STREAM) && !request.hasExtra(Intent.EXTRA_TEXT) && request.clipData == null)
    } finally {
      if (stubOwned) IntentStubberRegistry.reset()
      monitor.removeIntentCallback(callback)
    }
  }

  private fun waitForFocusedInputConnection(
    scenario: ActivityScenario<MainActivity>, focusScript: String, deadline: Long, expectedText: String
  ): Pair<android.view.inputmethod.InputConnection, android.os.Handler> {
    var latest = JSONObject()
    while (SystemClock.elapsedRealtime() < deadline) {
      val focused = runCatching { evaluate(scenario, focusScript, deadlineOverride = deadline) == "true" }.getOrDefault(false)
      var connection: android.view.inputmethod.InputConnection? = null
      var handler: android.os.Handler? = null
      latest = JSONObject().put("document_target_focused", focused).put("scenario_state", scenario.state.name)
      if (focused && scenario.state == Lifecycle.State.RESUMED) scenario.onActivity { activity ->
        val view = findWebView(activity.window.decorView)
        val nativeFocused = activity.hasWindowFocus() && view?.hasWindowFocus() == true && view.hasFocus() && view.isShown
        latest.put("native_input_focused", nativeFocused)
        if (nativeFocused) {
          val info = android.view.inputmethod.EditorInfo()
          connection = view.onCreateInputConnection(info)
          handler = connection?.handler ?: view.handler
          latest.put("connection_available", connection != null).put("input_type", info.inputType).put("ime_options", info.imeOptions)
        }
      }
      if (connection != null && handler != null && SystemClock.elapsedRealtime() < deadline) {
        val current = requireNotNull(connection)
        val dispatch = requireNotNull(handler)
        val extracted = onEditorInputThread(current, dispatch, deadlineOverride = deadline) {
          it.getExtractedText(android.view.inputmethod.ExtractedTextRequest().apply { hintMaxChars = 16_384; hintMaxLines = 1_024 }, 0)
        }
        val actual = extracted?.text?.toString()
        latest.put("native_buffer_available", extracted != null).put("native_buffer_length", actual?.length ?: JSONObject.NULL)
          .put("native_buffer_exact", actual == expectedText).put("native_buffer_start_offset", extracted?.startOffset ?: JSONObject.NULL)
          .put("expected_buffer_length", expectedText.length)
        if (extracted?.startOffset == 0 && actual == expectedText &&
          evaluate(scenario, focusScript, deadlineOverride = deadline) == "true" && SystemClock.elapsedRealtime() < deadline) {
          println("native_input_ready=" + latest); System.out.flush()
          return Pair(current, dispatch)
        }
      }
      SystemClock.sleep(100L)
    }
    throw AssertionError("the exact actual field and native WebView must own focus and expose a public InputConnection within the original action deadline: " + latest)
  }

  private fun taskInputExpression(label: String, selector: String = "input,textarea"): String =
    "Array.from(document.querySelectorAll(" + JSONObject.quote(selector) + ")).find(n=>!n.disabled&&n.getBoundingClientRect().width>0&&!n.closest('[aria-hidden=true],[inert]')&&(n.getAttribute('aria-label')||(n.labels?Array.from(n.labels).map(l=>l.textContent).join(' '):'')).trim().startsWith(" + JSONObject.quote(label) + "))"

  private fun setSearchOption(scenario: ActivityScenario<MainActivity>, label: String, checked: Boolean) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    val field = taskInputExpression(label, "input[type=checkbox]")
    fun observation(): JSONObject = JSONObject(evaluate(scenario,
      "(()=>{const n=" + field + ";const results=document.querySelector('[aria-label=\"Find results\"]');return {found:!!n,checked:!!n&&n.checked,results:results?results.textContent:null};})()", deadlineOverride = deadline))
    val before = observation()
    assertTrue("the actual named search checkbox must exist: " + label, before.getBoolean("found"))
    if (before.getBoolean("checked") != checked) tapNativeControlOnce(scenario, label, "input[type=checkbox]", deadlineOverride = deadline)
    waitForCondition(scenario, "(()=>{const n=" + field + ";return !!n&&n.checked===" + checked + ";})()", "the one native activation must set the actual requested search flag: " + label + ",before=" + before, deadlineOverride = deadline)
    println("s047_search_option=" + JSONObject().put("label", label).put("requested", checked).put("before", before).put("after", observation())); System.out.flush()
  }

  private fun setTaskInput(scenario: ActivityScenario<MainActivity>, label: String, text: String, deadlineOverride: Long? = null) {
    val deadline = deadlineOverride ?: (SystemClock.elapsedRealtime() + 30_000L)
    try {
      focusNativeWebView(scenario, deadlineOverride = deadline)
      val focusScript = "(()=>{const field=" + taskInputExpression(label) + ";return document.hasFocus()&&!!field&&document.activeElement===field;})()"
      val ownerReady = "(()=>{const field=" + taskInputExpression(label) + ";if(!field||field.disabled||!document.hasFocus())return false;const owner=field.closest('.task-surface[role=dialog]');return owner?owner.getAttribute('data-state')==='open'&&owner.contains(document.activeElement):!field.closest('.cm-search')&&!document.querySelector('.task-surface[role=dialog][data-state=open]');})()"
      waitForCondition(scenario, ownerReady, "the real task must complete its own focus handoff before one native field tap", deadlineOverride = deadline)
      tapNativeControlOnce(scenario, label, "input,textarea", deadlineOverride = deadline)
      waitForCondition(scenario, focusScript, "the exact requested task input must own actual browser focus after the one native tap", deadlineOverride = deadline)
      val before = stringValue(evaluate(scenario, "document.activeElement.value", deadlineOverride = deadline))
      val (current, dispatch) = waitForFocusedInputConnection(scenario, focusScript, deadline, before)
      waitForNativeEditorState(current, dispatch, before, "task_input_before", deadlineOverride = deadline)
      assertTrue(onEditorInputThread(current, dispatch, deadlineOverride = deadline) { it.finishComposingText() })
      assertTrue(onEditorInputThread(current, dispatch, deadlineOverride = deadline) { it.setSelection(0, before.length) })
      waitForNativeEditorState(current, dispatch, before, "task_input_selected", 0, before.length, deadlineOverride = deadline)
      assertTrue(onEditorInputThread(current, dispatch, deadlineOverride = deadline) { it.commitText(text, 1) })
      waitForCondition(scenario, focusScript + "&&document.activeElement.value===" + JSONObject.quote(text), "native public input must update only the focused real task field", deadlineOverride = deadline)
      waitForNativeEditorState(current, dispatch, text, "task_input_committed", text.length, text.length, deadlineOverride = deadline)
    } catch (failure: Throwable) {
      val observed = runCatching { evaluate(scenario, "(()=>{const field=" + taskInputExpression(label) + ";const active=document.activeElement;const r=field&&field.getBoundingClientRect();return {document_focus:document.hasFocus(),target_present:!!field,target_focused:!!field&&active===field,target_enabled:!!field&&!field.disabled,target_value_length:field?field.value.length:null,active_tag:active?active.nodeName:null,active_role:active?active.getAttribute('role'):null,active_label:active?active.getAttribute('aria-label'):null,active_class:active?String(active.className).slice(0,96):null,dialog_count:document.querySelectorAll('[role=dialog]').length,target_top:r?r.top:null,target_bottom:r?r.bottom:null,viewport_height:innerHeight};})()") }.getOrElse { "observation_failed:" + it.javaClass.simpleName }
      println("s047_task_input_failure=" + JSONObject().put("control", label).put("observation", observed)); System.out.flush()
      throw failure
    }
  }
  private fun chooseTaskOption(scenario: ActivityScenario<MainActivity>, label: String, index: Int, expected: String) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    val field = "Array.from(document.querySelectorAll('select')).find(n=>!n.disabled&&!n.closest('[aria-hidden=true],[inert]')&&(n.getAttribute('aria-label')===" + JSONObject.quote(label) + "||(n.labels&&Array.from(n.labels).some(l=>l.textContent.trim().startsWith(" + JSONObject.quote(label) + ")))))"
    val option = JSONObject(evaluate(scenario, "(()=>{const n=" + field + ";const o=n&&n.options[" + index + "];return {found:!!o,value:o?o.value:null,label:o?o.textContent.trim():null,disabled:!o||o.disabled};})()", deadlineOverride = deadline))
    assertTrue("the intended actual option must exist and be enabled", option.optBoolean("found") && !option.optBoolean("disabled"))
    assertEquals("option index and expected value must identify the same setting", expected, option.getString("value"))
    val wanted = option.getString("label").replace(Regex("\\s+"), " ")
    enableNativeWindowObservation()
    val priorWindow = instrumentation.uiAutomation.rootInActiveWindow?.windowId
    val initialIndex = evaluate(scenario, "(" + field + ").selectedIndex", deadlineOverride = deadline).toInt()
    tapNativeControlOnce(scenario, label, "select", deadlineOverride = deadline)
    var target: AccessibilityNodeInfo? = null
    var seenWindow = -1
    var observedCount = 0
    var positionRequested = false
    var lastScroll = 0L
    var previousBounds: android.graphics.Rect? = null
    var previousOptionWindow: Int? = null
    var previousSeenAt = 0L
    var targetBounds: android.graphics.Rect? = null
    val inventory = JSONArray()
    while (SystemClock.elapsedRealtime() < deadline) {
      val root = instrumentation.uiAutomation.rootInActiveWindow
      if (root != null && root.windowId != priorWindow && root.packageName?.toString() == TARGET_PACKAGE) {
        seenWindow = root.windowId
        val candidates = mutableListOf<AccessibilityNodeInfo>()
        for (node in root.findAccessibilityNodeInfosByText(wanted)) {
          if (node.text?.toString()?.trim()?.replace(Regex("\\s+"), " ") != wanted || node.windowId != root.windowId) continue
          val selected = node // Touch the exact labelled option, not a potentially broad clickable ancestor.
          if (selected.windowId != root.windowId || selected.packageName?.toString() != TARGET_PACKAGE || !selected.isVisibleToUser || !selected.isEnabled) continue
          val bounds = android.graphics.Rect().also { selected.getBoundsInScreen(it) }
          val visible = android.graphics.Rect(bounds)
          var parent = selected.parent
          var ancestors = 0
          while (parent != null && parent.windowId == root.windowId && ancestors++ < 12) {
            val parentBounds = android.graphics.Rect().also { parent.getBoundsInScreen(it) }
            if (!parentBounds.isEmpty && !visible.intersect(parentBounds)) { visible.setEmpty(); break }
            parent = parent.parent
          }
          if (!bounds.isEmpty && visible == bounds) candidates.add(selected)
        }
        val unique = candidates.distinctBy { it.hashCode() }
        observedCount = unique.size
        if (unique.size == 1) {
          val candidate = unique.single()
          val bounds = android.graphics.Rect().also { candidate.getBoundsInScreen(it) }
          val now = SystemClock.elapsedRealtime()
          if (previousOptionWindow == root.windowId && previousBounds == bounds && now - previousSeenAt >= 100L && now - lastScroll >= 400L) {
            target = candidate
            targetBounds = bounds
            break
          }
          if (previousOptionWindow != root.windowId || previousBounds != bounds) { previousOptionWindow = root.windowId; previousBounds = bounds; previousSeenAt = now }
          SystemClock.sleep(100L)
          continue
        } else { previousBounds = null; previousOptionWindow = null }
        var visited = 0
        fun scrollable(node: AccessibilityNodeInfo, depth: Int): AccessibilityNodeInfo? {
          if (++visited > 128 || depth > 12) return null
          if (node.isScrollable && node.windowId == root.windowId && node.packageName?.toString() == TARGET_PACKAGE) return node
          for (childIndex in 0 until minOf(node.childCount, 64)) {
            val child = node.getChild(childIndex) ?: continue
            scrollable(child, depth + 1)?.let { return it }
          }
          return null
        }
        val list = scrollable(root, 0)
        if (list != null && SystemClock.elapsedRealtime() - lastScroll >= 400L) {
          val positioned = if (!positionRequested) {
            positionRequested = true
            list.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_TO_POSITION.id, android.os.Bundle().apply { putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_ROW_INT, index) })
          } else false
          if (!positioned) list.performAction(if (index < initialIndex) AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD else AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
          lastScroll = SystemClock.elapsedRealtime()
        }
        if (inventory.length() == 0) for (childIndex in 0 until minOf(root.childCount, 24)) {
          root.getChild(childIndex)?.let { child -> inventory.put(JSONObject().put("class", child.className?.toString()).put("text", child.text?.toString()?.take(128)).put("description", child.contentDescription?.toString()?.take(128))) }
        }
      }
      SystemClock.sleep(100L)
    }
    if (target == null) {
      val failure = JSONObject().put("control", label).put("wanted", wanted).put("index", index).put("window", seenWindow).put("matches", observedCount).put("visible_children", inventory)
      println("s047_native_option_failure=" + failure)
      captureEditorFocusFailure(scenario, "native_option_popup_timeout", failure)
      System.out.flush()
    }
    assertTrue("one actual native option popup must own the exact enabled setting within the original action deadline: window=" + seenWindow + ",matches=" + observedCount, target != null && SystemClock.elapsedRealtime() < deadline)
    val selected = requireNotNull(target)
    val bounds = requireNotNull(targetBounds)
    val currentRoot = instrumentation.uiAutomation.rootInActiveWindow
    assertTrue("the single option touch must retain the same active popup owner", currentRoot?.refresh() == true && currentRoot.windowId == seenWindow && currentRoot.packageName?.toString() == TARGET_PACKAGE)
    assertTrue("the observed option must remain fresh, enabled and visible before its single touch", selected.refresh() && selected.isEnabled && selected.isVisibleToUser)
    assertEquals("the refreshed native row must retain the exact intended option label", wanted, selected.text?.toString()?.trim()?.replace(Regex("\\s+"), " "))
    val freshBounds = android.graphics.Rect().also { selected.getBoundsInScreen(it) }
    assertEquals("the native option must retain its observed stable screen bounds", bounds, freshBounds)
    dispatchNativeTapOnce(bounds.exactCenterX(), bounds.exactCenterY(), deadline) { event -> instrumentation.uiAutomation.injectInputEvent(event, true) }
    try {
      waitForCondition(scenario, "(()=>{const n=" + field + ";return !!n&&n.value===" + JSONObject.quote(expected) + ";})()", "actual native option selection must update the intended setting", deadlineOverride = deadline)
    } catch (failure: Throwable) {
      val actual = runCatching { evaluate(scenario, "(()=>{const n=" + field + ";return {found:!!n,value:n?n.value:null,index:n?n.selectedIndex:null};})()") }.getOrElse { "observation_failed:" + it.javaClass.simpleName }
      val nativeRoot = instrumentation.uiAutomation.rootInActiveWindow
      println("s047_native_option_selection_failure=" + JSONObject().put("control", label).put("wanted", wanted).put("index", index)
        .put("expected", expected).put("actual", actual).put("option_class", selected.className?.toString()).put("bounds", nativeRectBounds(bounds))
        .put("popup_window", seenWindow).put("active_window", nativeRoot?.windowId).put("active_package", nativeRoot?.packageName?.toString()))
      System.out.flush()
      throw failure
    }
  }
  private fun clipboardText(): String? {
    val observed = AtomicReference<String?>(null)
    instrumentation.runOnMainSync {
      val clipboard = clientContext.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
      observed.set(clipboard.primaryClip?.let { if (it.itemCount > 0) it.getItemAt(0).coerceToText(clientContext).toString() else null })
    }
    return observed.get()
  }

  private fun verifyClipboardPasteReceiver(scenario: ActivityScenario<MainActivity>, expected: String, uriBacked: Boolean) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    val nonce = UUID.randomUUID().toString()
    val documentId = stringValue(evaluate(scenario, "document.querySelector('.document-surface').id", deadlineOverride = deadline))
    resolver.call(FixtureGrantProvider.COMMAND_URI, "clear_clipboard_result", null, null)
    // Only a nonce is supplied. The recipient must independently read the real clipboard and paste its bytes.
    scenario.onActivity { activity -> activity.startActivity(Intent().setClassName(instrumentation.context.packageName, "com.shruggietech.glitchpad.source.ClipboardPasteReceiverActivity").putExtra("nonce", nonce)) }
    var actual: JSONObject? = null
    while (SystemClock.elapsedRealtime() < deadline) {
      val json = resolver.call(FixtureGrantProvider.COMMAND_URI, "clipboard_result", null, null)?.getString("json")
      if (json != null) {
        val candidate = JSONObject(json)
        if (candidate.optString("nonce") == nonce) { actual = candidate; break }
      }
      SystemClock.sleep(100L)
    }
    val observed = requireNotNull(actual) { "the independent foreground recipient must report its own clipboard paste inside the original deadline" }
    val bytes = expected.toByteArray(Charsets.UTF_8)
    println("s047_clipboard_recipient_observation=" + JSONObject().put("expected_sha256", sha256(bytes)).put("expected_utf8_bytes", bytes.size).put("expected_code_units", expected.length).put("expected_uri", uriBacked).put("receiver", observed)); System.out.flush()
    assertFalse("independent clipboard recipient must complete without a transport error: " + observed, observed.has("error"))
    assertEquals(instrumentation.context.packageName, observed.getString("receiver_package"))
    assertTrue("clipboard paste must execute in a different application UID", observed.getInt("receiver_uid") != clientContext.applicationInfo.uid)
    assertTrue("the platform paste must accept plain text", observed.getBoolean("plain_text_mime") && observed.getBoolean("paste_accepted"))
    assertEquals("the actual clipboard transport must match the payload size", uriBacked, observed.getBoolean("has_uri"))
    assertFalse("the recipient must not receive an explicit Intent URI grant", observed.getBoolean("intent_uri_grant"))
    if (uriBacked) {
      val legacy = Build.VERSION.SDK_INT < 28
      assertEquals("the recipient must read the actual platform-specific clipboard provider", clientContext.packageName + if (legacy) ".clipboard" else ".fileprovider", observed.getString("uri_authority"))
      if (!legacy) assertTrue("the clipboard service must grant independent recipient read access", observed.getBoolean("uri_read_granted"))
      assertFalse("clipboard paste must not gain write authority over the payload", observed.getBoolean("uri_write_granted"))
      assertTrue("the actual recipient must be unable to write, enumerate, guess, or traverse clipboard payloads", listOf("uri_write_denied", "uri_directory_denied", "uri_unknown_denied", "uri_traversal_denied").all { observed.getBoolean(it) })
      assertFalse("the actual recipient must read the URI stream without an error", observed.has("uri_stream_error"))
      assertEquals("the recipient URI stream must contain every copied byte", bytes.size, observed.getInt("uri_stream_utf8_bytes"))
      assertEquals("the recipient URI stream digest must match the source", sha256(bytes), observed.getString("uri_stream_sha256"))
    }
    assertEquals("independent paste must preserve every UTF-8 byte", bytes.size, observed.getInt("utf8_bytes"))
    assertEquals("independent paste must preserve every code unit", expected.length, observed.getInt("code_units"))
    assertEquals("independent paste digest must match the actual source text", sha256(bytes), observed.getString("sha256"))
    waitForCondition(scenario, "document.hasFocus()&&document.querySelector('.document-surface').id===" + JSONObject.quote(documentId), "return from independent clipboard paste must retain the same actual document", deadlineOverride = deadline)
    clipboardPasteReadbacks.put(JSONObject().put("transport", if (uriBacked) "uri" else "inline").put("request_nonce", nonce).put("app_uid", clientContext.applicationInfo.uid)
      .put("expected_sha256", sha256(bytes)).put("expected_utf8_bytes", bytes.size).put("expected_code_units", expected.length)
      .put("returned_to_document", true).put("receiver", observed))
  }

  private fun taskKey(code: Int, meta: Int = 0) {
    val now = SystemClock.uptimeMillis()
    instrumentation.sendKeySync(KeyEvent(now, now, KeyEvent.ACTION_DOWN, code, 0, meta))
    instrumentation.sendKeySync(KeyEvent(now, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, code, 0, meta))
  }
  private fun focusTaskEditor(scenario: ActivityScenario<MainActivity>) {
    scenario.onActivity { activity -> requireNotNull(findWebView(activity.window.decorView)).requestFocus() }
    evaluate(scenario, "document.querySelector('.cm-content').focus();true")
    waitForCondition(scenario, "document.activeElement===document.querySelector('.cm-content')", "real editor keyboard input must have its actual focus")
  }
  private fun verifyS047EditorAliases(scenario: ActivityScenario<MainActivity>, original: String) {
    val ctrl = KeyEvent.META_CTRL_ON
    val shift = KeyEvent.META_SHIFT_ON
    focusTaskEditor(scenario)
    taskKey(KeyEvent.KEYCODE_A, ctrl)
    waitForCondition(scenario, "(()=>{const n=document.querySelector('.cm-editor');return Number(n.getAttribute('data-editor-selection-from'))===0&&Number(n.getAttribute('data-editor-selection-to'))===" + original.length + ";})()", "native Select all must select the entire actual source before Copy")
    val copySelectionDeadline = SystemClock.elapsedRealtime() + 30_000L
    val copySnapshot = browserEditorInputSnapshot(scenario, deadlineOverride = copySelectionDeadline)
    assertEquals("Copy preparation must retain the exact semantic source", original, copySnapshot.getString("semantic_text"))
    val copyEditingText = copySnapshot.getString("editing_text")
    assertTrue("Copy must exclude only the public editing representation's paragraph markers", copyEditingText.startsWith(original))
    val (copyConnection, copyHandler) = waitForFocusedInputConnection(scenario, "document.activeElement===document.querySelector('.cm-content')", copySelectionDeadline, copyEditingText)
    waitForNativeEditorState(copyConnection, copyHandler, copyEditingText, "copy_selection", 0, original.length, copySelectionDeadline)
    taskKey(KeyEvent.KEYCODE_C, ctrl)
    val clipboardDeadline = SystemClock.elapsedRealtime() + 30_000L
    while (clipboardText() != original && SystemClock.elapsedRealtime() < clipboardDeadline) SystemClock.sleep(100L)
    if (clipboardText() != original) { println("s047_copy_failure=" + runCatching { evaluate(scenario, "(()=>{const n=document.querySelector('.cm-editor');const statuses=Array.from(document.querySelectorAll('[role=status]')).map(s=>s.textContent||'');return {secure_context:window.isSecureContext===true,clipboard_api:!!navigator.clipboard,clipboard_write:!!navigator.clipboard&&typeof navigator.clipboard.writeText==='function',document_focus:document.hasFocus(),editor_focus:document.activeElement===document.querySelector('.cm-content'),from:n.getAttribute('data-editor-selection-from'),to:n.getAttribute('data-editor-selection-to'),completed:statuses.some(s=>s.includes('Completed Copy.')),failed:statuses.some(s=>s.includes('The action failed.')),unavailable:statuses.some(s=>s.includes('This action is unavailable'))};})()") }.getOrElse { "observation_failed:" + it.javaClass.simpleName }); System.out.flush() }; assertEquals("Copy keyboard alias must write actual selected source", original, clipboardText())
    instrumentation.runOnMainSync { (clientContext.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager).setPrimaryClip(android.content.ClipData.newPlainText("controlled fixture","S047_CLIPBOARD_BEFORE_COPY")) }
    menuAction(scenario,"Copy")
    val menuClipboardDeadline=SystemClock.elapsedRealtime()+30_000L
    while(clipboardText()!=original&&SystemClock.elapsedRealtime()<menuClipboardDeadline)SystemClock.sleep(100L)
    assertEquals("Copy menu must share the exact selected source",original,clipboardText())
    menuAction(scenario, "Indent")
    val indented = editableSourceText(scenario)
    assertTrue("Indent must insert actual leading whitespace on each selected line", indented != original && indented.lines().zip(original.lines()).all { (a,b) -> a.trimStart(' ', '\t') == b && a.length > b.length })
    menuAction(scenario, "Outdent")
    assertEquals(original, editableSourceText(scenario))
    fun keyWithExactSource(code: Int, meta: Int, expected: String) {
      val deadline = SystemClock.elapsedRealtime() + 10_000L
      taskKey(code, meta)
      val source = "Array.from(document.querySelector('.cm-content').querySelectorAll(':scope > .cm-line')).map(n=>n.textContent).join('\\n')"
      waitForCondition(scenario, source + "===" + JSONObject.quote(expected), "one native keyboard action must publish its exact source inside the original observation budget", deadlineOverride = deadline)
      assertEquals(expected, editableSourceText(scenario, deadlineOverride = deadline))
    }
    focusTaskEditor(scenario)
    val selectionDeadline = SystemClock.elapsedRealtime() + 10_000L
    taskKey(KeyEvent.KEYCODE_A, ctrl)
    waitForCondition(scenario, "(()=>{const n=document.querySelector('.cm-editor');return Number(n.getAttribute('data-editor-selection-from'))===0&&Number(n.getAttribute('data-editor-selection-to'))===" + original.length + ";})()", "one native Select all must publish the actual selection before indentation", deadlineOverride = selectionDeadline)
    keyWithExactSource(KeyEvent.KEYCODE_TAB, 0, indented)
    keyWithExactSource(KeyEvent.KEYCODE_TAB, shift, original)
    keyWithExactSource(KeyEvent.KEYCODE_Z, ctrl, indented)
    keyWithExactSource(KeyEvent.KEYCODE_Z, ctrl or shift, original)
    val beforeWrap = stringValue(evaluate(scenario, "document.querySelector('.cm-editor').getAttribute('data-editor-wrap')"))
    menuAction(scenario, if (beforeWrap == "true") "Unwrap lines" else "Wrap lines")
    waitForCondition(scenario, "document.querySelector('.cm-editor').getAttribute('data-editor-wrap')!==" + JSONObject.quote(beforeWrap), "document wrap must change actual editor configuration")
    menuAction(scenario, if (beforeWrap == "true") "Wrap lines" else "Unwrap lines")
    assertEquals(beforeWrap, stringValue(evaluate(scenario, "document.querySelector('.cm-editor').getAttribute('data-editor-wrap')")))
    focusTaskEditor(scenario); taskKey(KeyEvent.KEYCODE_F, ctrl)
    waitForCondition(scenario, "!!document.querySelector('.cm-search input[aria-label=Find]')", "Ctrl+F must open actual Find")
    setTaskInput(scenario, "Find", "cat")
    setSearchOption(scenario, "Match case", true)
    setSearchOption(scenario, "Whole word", true)
    setSearchOption(scenario, "Regular expression", false)
    waitForCondition(scenario, "document.querySelector('[aria-label=\"Find results\"]').textContent.includes('2')", "alias preparation must observe the exact two-match case-sensitive whole-word query")
    clickControl(scenario,"Close search")
    focusTaskEditor(scenario)
    val expectedMatches = listOf(0, original.lastIndexOf("cat"))
    assertTrue("controlled case-sensitive whole-word query must have two distinct expected matches", expectedMatches.distinct().size == 2 && expectedMatches.all { original.substring(it, it + 3) == "cat" })
    fun selectionAt(offset: Int): String = "(()=>{const n=document.querySelector('.cm-editor');return !!n&&Number(n.getAttribute('data-editor-selection-from'))===" + offset + "&&Number(n.getAttribute('data-editor-selection-to'))===" + (offset + 3) + ";})()"
    taskKey(KeyEvent.KEYCODE_F3)
    val next = stringValue(evaluate(scenario, "document.querySelector('.cm-editor').getAttribute('data-editor-selection-from')")).toInt()
    assertTrue("F3 must select one exact controlled whole-word match", next in expectedMatches)
    waitForCondition(scenario, selectionAt(next), "F3 must retain the exact current source match range")
    val previous = expectedMatches.single { it != next }
    taskKey(KeyEvent.KEYCODE_F3, shift)
    waitForCondition(scenario, selectionAt(previous), "Shift+F3 must select the exact previous actual occurrence")
    menuAction(scenario, "Find next")
    waitForCondition(scenario, selectionAt(next), "Find next menu must move to the exact next current source match")
    menuAction(scenario, "Find previous")
    waitForCondition(scenario, selectionAt(previous), "Find previous menu must move back to the exact current source match")
    menuAction(scenario, "Search")
    clickControl(scenario, "Next")
    waitForCondition(scenario, selectionAt(next), "CodeMirror Next must select the exact next current source match")
    clickControl(scenario, "Previous")
    waitForCondition(scenario, selectionAt(previous), "CodeMirror Previous must select the exact previous current source match")
    clickControl(scenario, "Close search")
    assertEquals("all Find aliases must preserve every source character", original, editableSourceText(scenario))
    focusTaskEditor(scenario); taskKey(KeyEvent.KEYCODE_G, ctrl)
    waitForCondition(scenario, "!!(" + taskInputExpression("Line number") + ")", "Ctrl+G must open the real validated line task")
    clickControl(scenario, "Cancel")
    menuAction(scenario,"Document details")
    waitForCondition(scenario, "!!document.querySelector('[role=dialog] [aria-label=\"Language mode\"]')", "Document details must disclose current source facts")
    for ((index, language) in listOf("automatic", "plain_text", "rust", "typescript", "javascript", "python", "json", "toml", "yaml", "css", "html").withIndex()) {
      chooseTaskOption(scenario, "Language mode", index, language)
      assertEquals("language override must preserve exact source", original, editableSourceText(scenario))
    }
    chooseTaskOption(scenario, "Language mode", 0, "automatic")
    observeVisibleTaskControls(scenario, "document_details")
    clickControl(scenario, "Close Document details")
    waitForCondition(scenario,"!document.querySelector('[role=dialog] [aria-label=\"Language mode\"]')","closing Document details must synchronize its disclosure")
    verifyClipboardPasteReceiver(scenario, original, false)
    assertEquals(original, editableSourceText(scenario))
  }

  private fun verifyS047EditorAndPreferences(scenario: ActivityScenario<MainActivity>) {
    createNewDraftForInput(scenario, "New text file", "Untitled.txt")
    val original = "cat Cat scatter cat\nsecond"
    replaceEditorText(scenario, original)
    menuAction(scenario, "Search")
    setTaskInput(scenario, "Find", "cat")
    waitForCondition(scenario, "document.querySelector('[aria-label=\"Find results\"]').textContent.includes('4')", "actual search must count four case-insensitive matches")
    clickControl(scenario, "Next"); clickControl(scenario, "Previous"); clickControl(scenario, "Select all matches")
    waitForCondition(scenario, "Number(document.querySelector('.cm-editor').getAttribute('data-editor-selection-count'))>1", "Select all matches must create actual multiple editor selections")
    assertEquals(original, editableSourceText(scenario))
    setTaskInput(scenario, "Find", "S047_NO_MATCH")
    waitForBodyText(scenario, "No matches")
    setTaskInput(scenario, "Find", "cat")
    for (label in listOf("Match case", "Whole word", "Regular expression")) setSearchOption(scenario, label, false)
    waitForCondition(scenario, "document.querySelector('[aria-label=\"Find results\"]').textContent.includes('4')", "the explicitly observed initial flags must restore four exact source matches")
    setSearchOption(scenario, "Match case", true)
    waitForCondition(scenario, "document.querySelector('[aria-label=\"Find results\"]').textContent.includes('3')", "case-sensitive search must change the actual match set")
    setSearchOption(scenario, "Whole word", true)
    waitForCondition(scenario, "document.querySelector('[aria-label=\"Find results\"]').textContent.includes('2')", "whole-word search must exclude scatter")
    setSearchOption(scenario, "Regular expression", true)
    setTaskInput(scenario, "Find", "[")
    waitForBodyText(scenario, "Invalid regular expression")
    assertEquals(original, editableSourceText(scenario))
    setTaskInput(scenario, "Find", "cat")
    setSearchOption(scenario, "Regular expression", false)
    setTaskInput(scenario, "Replace", "dog")
    clickControl(scenario, "Next")
    val selection = JSONObject(evaluate(scenario, "(()=>{const n=document.querySelector('.cm-editor');return {from:Number(n.getAttribute('data-editor-selection-from')),to:Number(n.getAttribute('data-editor-selection-to'))};})()"))
    assertEquals("cat", original.substring(selection.getInt("from"), selection.getInt("to")))
    clickControl(scenario, "Replace next")
    val once = original.substring(0, selection.getInt("from")) + "dog" + original.substring(selection.getInt("to"))
    waitForCondition(scenario, "Array.from(document.querySelectorAll('.cm-line')).map(n=>n.textContent).join('\\n')===" + JSONObject.quote(once), "Replace next must change exactly the selected source range once")
    clickControl(scenario,"Close search")
    menuAction(scenario, "Undo")
    assertEquals(original, editableSourceText(scenario))
    menuAction(scenario,"Search")
    setTaskInput(scenario, "Replace", "dog")
    clickControl(scenario, "Replace all")
    val replaced = "dog Cat scatter dog\nsecond"
    waitForCondition(scenario, "Array.from(document.querySelectorAll('.cm-line')).map(n=>n.textContent).join('\\n')===" + JSONObject.quote(replaced), "Replace all must change exactly whole-word case-sensitive source")
    clickControl(scenario, "Close search")
    menuAction(scenario, "Undo")
    assertEquals(original, editableSourceText(scenario))
    menuAction(scenario, "Redo")
    assertEquals(replaced, editableSourceText(scenario))
    replaceEditorText(scenario, original)
    clickControl(scenario, "Document tools")
    assertEquals("true", evaluate(scenario, "Array.from(document.querySelectorAll('[role=menuitem]')).filter(b=>b.querySelector('span')&&b.querySelector('span').textContent==='Redo').every(b=>b.disabled)"))
    clickControl(scenario, "Close Document tools")
    menuAction(scenario, "Go to line")
    setTaskInput(scenario, "Line number", "999")
    clickControl(scenario, "Go")
    waitForCondition(scenario, "(()=>{const n=" + taskInputExpression("Line number") + ";return !!n&&n.getAttribute('aria-invalid')==='true';})()", "out-of-range line must remain visibly invalid")
    setTaskInput(scenario, "Line number", "2")
    val goDeadline = SystemClock.elapsedRealtime() + 30_000L
    clickControl(scenario, "Go", deadlineOverride = goDeadline)
    val lineStart = original.indexOf('\n') + 1
    val goObservations = JSONObject()
    try {
      waitForCondition(scenario, "(()=>{const editor=document.querySelector('.cm-content[contenteditable=true]');const owner=editor&&editor.closest('.cm-editor');return !(" + taskInputExpression("Line number") + ")&&!!editor&&document.activeElement===editor&&owner.getAttribute('data-editor-selection-from')==='" + lineStart + "'&&owner.getAttribute('data-editor-selection-to')==='" + lineStart + "';})()", "one valid Go action must complete its task, editor focus handoff and exact caret selection", observations = goObservations, deadlineOverride = goDeadline)
    } catch (failure: Throwable) {
      val state = runCatching { JSONObject(evaluate(scenario, "(()=>{const node=document.querySelector('.cm-editor');return {from:node?node.getAttribute('data-editor-selection-from'):null,to:node?node.getAttribute('data-editor-selection-to'):null};})()")) }.getOrElse { JSONObject().put("capture_failed", true) }
      captureEditorFocusFailure(scenario, "go_to_line_completion", JSONObject().put("expected_selection", lineStart).put("selection_after", state).put("observations", goObservations))
      throw failure
    }
    val completedGo = JSONObject(evaluate(scenario, "(()=>{const editor=document.querySelector('.cm-content[contenteditable=true]');const owner=editor&&editor.closest('.cm-editor');return {text:editor?Array.from(editor.querySelectorAll(':scope > .cm-line')).map(n=>n.textContent).join('\\n'):null,from:owner?owner.getAttribute('data-editor-selection-from'):null,to:owner?owner.getAttribute('data-editor-selection-to'):null,focused:!!editor&&document.hasFocus()&&document.activeElement===editor,closed:!(" + taskInputExpression("Line number") + ")};})()", deadlineOverride = goDeadline))
    println("s047_go_result=" + completedGo); System.out.flush()
    assertEquals(original, completedGo.getString("text"))
    assertEquals(lineStart.toString(), completedGo.getString("from"))
    assertEquals(lineStart.toString(), completedGo.getString("to"))
    assertTrue("the completed Go must retain actual editor focus and close its task", completedGo.getBoolean("focused") && completedGo.getBoolean("closed"))
    verifyS047EditorAliases(scenario, original)
    val documentWrapBeforePreferences=stringValue(evaluate(scenario,"document.querySelector('.cm-editor').getAttribute('data-editor-wrap')"))
    menuAction(scenario, "Preferences")
    val wrapDefault = evaluate(scenario, "Array.from(document.querySelectorAll('input[type=checkbox]')).find(n=>n.parentElement.textContent.includes('Wrap long lines')).checked")
    tapNativeControlOnce(scenario, "Wrap long lines", "input[type=checkbox]")
    waitForCondition(scenario, "Array.from(document.querySelectorAll('input[type=checkbox]')).find(n=>n.parentElement.textContent.includes('Wrap long lines')).checked!==" + wrapDefault, "default wrap must actually persist its changed checkbox state")
    tapNativeControlOnce(scenario, "Wrap long lines", "input[type=checkbox]")
    for ((index, theme) in listOf("system", "light", "dark").withIndex()) chooseTaskOption(scenario, "Theme", index, theme)
    for ((index, mode) in listOf("rendered", "source").withIndex()) chooseTaskOption(scenario, "Default Markdown view", index, mode)
    setTaskInput(scenario, "Editor font size", "")
    instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
    waitForBodyText(scenario, "Enter a whole number from 8 to 72.")
    setTaskInput(scenario, "Editor font size", "8"); instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
    setTaskInput(scenario, "Editor font size", "72"); instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
    setTaskInput(scenario, "Tab width", "0"); instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
    waitForBodyText(scenario, "Enter a whole number from 1 to 16.")
    setTaskInput(scenario, "Tab width", "1"); instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
    setTaskInput(scenario, "Tab width", "16"); instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
    setTaskInput(scenario, "Editor font family", "S047 Unavailable Font, monospace"); instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
    observeVisibleTaskControls(scenario, "preferences")
    val resetFocus = "(()=>{const n=document.activeElement;const owner=n&&n.closest('[role=dialog]');return !!n&&n.tagName==='BUTTON'&&n.textContent.trim()==='Reset preferences'&&!!owner&&owner.querySelector('h2').textContent==='Preferences';})()"
    for (route in listOf("native Back", "Escape", "header Close")) {
      clickControl(scenario, "Reset preferences")
      waitForBodyText(scenario, "Restore document defaults and theme on this device?")
      if (route == "header Close") clickControl(scenario, "Close Reset preferences?")
      else { focusNativeWebView(scenario); instrumentation.sendKeyDownUpSync(if (route == "native Back") KeyEvent.KEYCODE_BACK else KeyEvent.KEYCODE_ESCAPE) }
      waitForCondition(scenario, resetFocus, route + " must restore the nested Reset opener in the still-open Preferences task")
    }
    clickControl(scenario, "Reset preferences"); clickControl(scenario, "Cancel reset")
    waitForCondition(scenario, resetFocus, "explicit Reset Cancel must restore the same Preferences opener")
    assertEquals("true", evaluate(scenario, "Array.from(document.querySelectorAll('input')).some(n=>n.labels&&Array.from(n.labels).some(l=>l.textContent.trim().startsWith('Editor font family'))&&n.value==='S047 Unavailable Font, monospace')"))
    clickControl(scenario, "Reset preferences"); clickControl(scenario, "Reset settings")
    waitForBodyText(scenario, "Preferences reset. Your files are unchanged.")
    waitForCondition(scenario, resetFocus, "completed Reset must restore its opener after the actual awaited reset")
    clickControl(scenario, "Close Preferences")
    assertEquals("preference actions must not change current file", original, editableSourceText(scenario))
    assertEquals("explicit document wrap must survive unrelated/default preference changes",documentWrapBeforePreferences,stringValue(evaluate(scenario,"document.querySelector('.cm-editor').getAttribute('data-editor-wrap')")))
  }
  private fun sourceEditorText(scenario: ActivityScenario<MainActivity>): String = stringValue(evaluate(scenario, "Array.from(document.querySelectorAll('.cm-content > .cm-line')).map(n=>n.textContent).join('\\n')"))
  private fun verifyS047MarkdownAndMetadata(scenario: ActivityScenario<MainActivity>) {
    createNewDraftForInput(scenario, "New Markdown", "Untitled.md")
    val draft = "# S047 mode draft\n\nEditable source retained.\n"
    replaceEditorText(scenario, draft)
    val sourceStateBefore=stringValue(evaluate(scenario,"(()=>{const n=document.querySelector('.cm-editor');return JSON.stringify({from:n.getAttribute('data-editor-selection-from'),to:n.getAttribute('data-editor-selection-to'),undo:n.getAttribute('data-editor-undo-depth'),redo:n.getAttribute('data-editor-redo-depth')});})()"))
    menuAction(scenario, "Read")
    waitForCondition(scenario, "!!document.querySelector('.markdown-document h1')", "Read must render the actual editable Markdown")
    menuAction(scenario, "Edit")
    waitForCondition(scenario, "!!document.querySelector('.cm-content[contenteditable=true]')", "Edit must restore the actual editable source")
    assertEquals(draft, editableSourceText(scenario))
    assertEquals("Markdown Read/Edit must retain actual selection and history",sourceStateBefore,stringValue(evaluate(scenario,"(()=>{const n=document.querySelector('.cm-editor');return JSON.stringify({from:n.getAttribute('data-editor-selection-from'),to:n.getAttribute('data-editor-selection-to'),undo:n.getAttribute('data-editor-undo-depth'),redo:n.getAttribute('data-editor-redo-depth')});})()")))
    val original = grant(documentUri("s047-controls.md")); val bytes = readBytes(original)
    openFromAddDocument(scenario, original)
    waitForCondition(scenario, "(()=>{const image=document.querySelector('.markdown-rendered-mode .embedded-mermaid .diagram-canvas[data-preview-ready=true] img');return !!document.querySelector('.markdown-rendered-mode .markdown-document h2')&&!!image&&image.complete&&image.naturalWidth>0&&image.naturalHeight>0;})()", "Markdown and embedded Mermaid must actually render")
    assertEquals("true",evaluate(scenario,"!!document.querySelector('.markdown-link-blocked[title=\"Local destination unavailable\"]')&&!Array.from(document.querySelectorAll('.markdown-document button')).some(n=>n.textContent.trim()==='sibling')"))
    clickControl(scenario,"Document tools")
    assertEquals("true",evaluate(scenario,"Array.from(document.querySelectorAll('[aria-label=\"Document tools\"] [role=menuitem]')).filter(n=>((n.querySelector('span')&&n.querySelector('span').textContent)||n.textContent).trim()==='Print').every(n=>n.disabled)"))
    clickControl(scenario,"Close Document tools")
    menuAction(scenario, "View source")
    waitForCondition(scenario, "!!document.querySelector('.cm-content[contenteditable=false]')", "read-only Markdown source must retain authority")
    menuAction(scenario, "Search")
    assertEquals("true", evaluate(scenario, "!Array.from(document.querySelectorAll('.cm-search input')).some(n=>n.getAttribute('aria-label')==='Replace')"))
    clickControl(scenario, "Close search")
    menuAction(scenario, "Read")
    menuAction(scenario, "Outline")
    clickControl(scenario, "Second heading")
    waitForCondition(scenario, "document.activeElement===Array.from(document.querySelectorAll('.markdown-document h2')).find(n=>n.textContent.trim()==='Second heading')", "outline must move real focus to its target")
    menuAction(scenario, "Search")
    setTaskInput(scenario, "Find rendered text", "cats")
    waitForCondition(scenario, "document.querySelector('[aria-label=\"Rendered search results\"]').textContent==='1 of 2'", "rendered search must announce actual matches")
    clickControl(scenario, "Next")
    waitForCondition(scenario, "document.querySelector('[aria-label=\"Rendered search results\"]').textContent==='2 of 2'", "Next must move to the embedded-diagram match")
    clickControl(scenario, "Previous")
    waitForCondition(scenario, "document.querySelector('[aria-label=\"Rendered search results\"]').textContent==='1 of 2'", "Previous must restore the paragraph match")
    clickControl(scenario, "Close search")

    tapNativeControlOnce(scenario, "local", ".markdown-document [role=link]")
    waitForCondition(scenario, "document.activeElement===Array.from(document.querySelectorAll('.markdown-document h2')).find(n=>n.textContent.trim()==='Second heading')", "fragment must focus the actual rendered heading")
    tapNativeControlOnce(scenario, "Footnote reference", ".markdown-document [data-footnote-ref]")
    waitForCondition(scenario, "(()=>{const ref=document.querySelector('.markdown-document [data-footnote-ref]');return !!ref&&Array.from(document.querySelectorAll('.markdown-document [id]')).some(n=>n.id===ref.getAttribute('title').slice(1)&&document.activeElement===n);})()", "footnote must focus its actual public destination")
    val backrefName = stringValue(evaluate(scenario, "document.querySelector('.markdown-document [data-footnote-backref]').getAttribute('aria-label')"))
    tapNativeControlOnce(scenario, backrefName, ".markdown-document [data-footnote-backref]")
    waitForCondition(scenario, "document.activeElement===document.querySelector('.markdown-document [data-footnote-ref]')", "footnote backlink must return to the originating reference")
    for (target in listOf("https://example.invalid/s047", "mailto:s047@example.invalid")) {
      val selector = ".markdown-document button[title=" + JSONObject.quote(target) + "]"
      val cancelDeadline = SystemClock.elapsedRealtime() + 30_000L
      waitForCondition(scenario, "!!document.querySelector(" + JSONObject.quote(selector) + ")", "the next external destination must remain in the actual rendered document", deadlineOverride = cancelDeadline)
      val name = stringValue(evaluate(scenario, "document.querySelector(" + JSONObject.quote(selector) + ").textContent.trim()", deadlineOverride = cancelDeadline))
      val documentId = stringValue(evaluate(scenario, "document.querySelector('.document-surface').id", deadlineOverride = cancelDeadline))
      val returned = "!document.querySelector('[role=dialog]')&&document.querySelector('.document-surface').id===" + JSONObject.quote(documentId) + "&&document.activeElement===document.querySelector(" + JSONObject.quote(selector) + ")"
      val opened = "(()=>{const task=document.querySelector('.markdown-link-task[data-state=open]');return !!task&&task.contains(document.activeElement)&&task.querySelector('.markdown-link-destination').textContent===" + JSONObject.quote(target) + ";})()"
      tapNativeControlOnce(scenario, name, selector, deadlineOverride = cancelDeadline)
      waitForCondition(scenario, opened, "the actual destination confirmation must own focus before Cancel", deadlineOverride = cancelDeadline)
      clickControl(scenario, "Cancel", deadlineOverride = cancelDeadline)
      waitForCondition(scenario, returned, "external destination Cancel must retain the actual document and restore its exact opener", deadlineOverride = cancelDeadline)
      val backDeadline = SystemClock.elapsedRealtime() + 30_000L
      tapNativeControlOnce(scenario, name, selector, deadlineOverride = backDeadline)
      waitForCondition(scenario, opened, "the actual destination confirmation must own focus before native Back", deadlineOverride = backDeadline)
      instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
      waitForCondition(scenario, returned, "one native Back must cancel the observed external confirmation and restore the same document/opener", deadlineOverride = backDeadline)
    }

    val target = "https://example.invalid/s047"
    val selector = ".markdown-document button[title=" + JSONObject.quote(target) + "]"
    val label = stringValue(evaluate(scenario, "document.querySelector(" + JSONObject.quote(selector) + ").textContent.trim()"))
    tapNativeControlOnce(scenario, label, selector)
    verifyExternalViewDispatch(scenario, target) { deadline -> clickControl(scenario, "Open destination", deadlineOverride = deadline) }
    waitForCondition(scenario,"!document.querySelector('[role=dialog]')","native external handoff must finish its confirmation")
    assertEquals("true",evaluate(scenario,"(()=>{const n=Array.from(document.querySelectorAll('.markdown-document input[type=checkbox]'));return n.length===2&&n.every(c=>c.disabled&&c.readOnly)&&n.some(c=>c.checked)&&n.some(c=>!c.checked);})()"))
    observeVisibleTaskControls(scenario,"markdown")
    verifyS047DiagramRoutes(scenario, ".embedded-mermaid .diagram-canvas", false)
    clickControl(scenario, "View source", ".embedded-mermaid button")
    waitForCondition(scenario, "!!document.querySelector('.cm-editor')", "embedded source action must open actual source")
    assertEquals(String(bytes, Charsets.UTF_8), sourceEditorText(scenario))
    val embeddedRange = JSONObject(evaluate(scenario, "(()=>{const n=document.querySelector('.cm-editor');return {from:Number(n.getAttribute('data-editor-selection-from')),to:Number(n.getAttribute('data-editor-selection-to'))};})()"))
    assertEquals("\u0060\u0060\u0060mermaid\nflowchart TB\nCats --> Dogs\n\u0060\u0060\u0060", String(bytes, Charsets.UTF_8).substring(embeddedRange.getInt("from"), embeddedRange.getInt("to")).trimEnd())
    menuAction(scenario, "Read")
    menuAction(scenario, "File information")
    tapNativeControlOnce(scenario, "Copy File name")
    waitForBodyText(scenario, "File name copied")
    assertEquals("s047-controls.md", clipboardText())
    tapNativeControlOnce(scenario, "Disclose External revision")
    clickControl(scenario, "Cancel")
    waitForCondition(scenario, "document.activeElement&&document.activeElement.getAttribute('aria-label')==='Disclose External revision'", "cancellation must restore the sensitive disclosure focus")
    val disclosureDeadline = SystemClock.elapsedRealtime() + 30_000L
    tapNativeControlOnce(scenario, "Disclose External revision", deadlineOverride = disclosureDeadline)
    waitForCondition(scenario, "(()=>{const confirmation=document.querySelector('.metadata-copy-confirmation');const fact=confirmation&&confirmation.closest('.metadata-fact');const value=fact&&fact.querySelector('.metadata-value');return !!fact&&fact.getAttribute('data-availability')==='available'&&fact.querySelector('dt').textContent==='External revision'&&!!value&&value.textContent.length>0;})()", "the single disclosure must render its actual available sensitive value before the clipboard baseline is read", deadlineOverride = disclosureDeadline)
    val expected = stringValue(evaluate(scenario, "document.querySelector('.metadata-copy-confirmation').closest('.metadata-fact').querySelector('.metadata-value').textContent", deadlineOverride = disclosureDeadline))
    tapNativeControlOnce(scenario, "Copy External revision")
    waitForBodyText(scenario, "External revision copied")
    assertEquals(expected, clipboardText())
    tapNativeControlOnce(scenario, "Copy available information")
    waitForBodyText(scenario, "Available information copied")
    val bulk = requireNotNull(clipboardText())
    assertTrue("bulk copy must include public controlled identity", bulk.contains("File name: s047-controls.md"))
    assertTrue("bulk copy must exclude sensitive original identity", !bulk.contains("External revision:"))
    tapNativeControlOnce(scenario, "Expand information")
    waitForCondition(scenario, "document.querySelector('[data-phone-expanded=true]')!==null", "Expand must change actual metadata disclosure")
    tapNativeControlOnce(scenario, "Collapse information")
    tapNativeControlOnce(scenario, "Calculate SHA-256")
    val expectedSha = sha256(bytes)
    waitForCondition(scenario, "Array.from(document.querySelectorAll('.metadata-fact')).some(n=>n.querySelector('dt').textContent==='SHA-256'&&n.querySelector('.metadata-value').textContent===" + JSONObject.quote(expectedSha) + ")", "native SHA-256 must equal independently read source bytes")
    tapNativeControlOnce(scenario, "Copy SHA-256")
    waitForBodyText(scenario, "SHA-256 copied")
    assertEquals(expectedSha, clipboardText())
    observeVisibleTaskControls(scenario, "metadata")
    clickControl(scenario, "Close File information")
    assertTrue("document tool actions must preserve original source bytes", bytes.contentEquals(readBytes(original)))
    openFromAddDocument(scenario, grant(documentUri("s047-controls.mmd")))
    waitForCondition(scenario, "(()=>{const image=document.querySelector('.mermaid-rendered-mode .diagram-canvas[data-preview-ready=true] img');return !!image&&image.complete&&image.naturalWidth>0&&image.naturalHeight>0;})()", "standalone Mermaid must render")
    menuAction(scenario, "Search")
    setTaskInput(scenario, "Find diagram text", "Cats")
    waitForCondition(scenario, "document.querySelector('[aria-label=\"Diagram search results\"]').textContent.includes('1')&&!!document.querySelector('mark')", "Mermaid search must mark the real matching label")
    clickControl(scenario, "Next match"); clickControl(scenario, "Previous match"); clickControl(scenario, "Close search")
    waitForCondition(scenario, "document.activeElement===document.querySelector('.diagram-canvas')", "closing diagram search must restore its navigation focus")
    verifyS047DiagramRoutes(scenario, ".mermaid-surface .diagram-canvas", true)
    val mermaidSource = String(readBytes(documentUri("s047-controls.mmd")), Charsets.UTF_8)
    menuAction(scenario, "View source")
    waitForCondition(scenario, "!!document.querySelector('.cm-content[contenteditable=false]')", "read-only Mermaid source must remain read-only")
    assertEquals(mermaidSource, sourceEditorText(scenario))
    menuAction(scenario, "Read")
    observeVisibleTaskControls(scenario, "mermaid")

    menuAction(scenario,"Edit a copy")
    waitForCondition(scenario,"!!document.querySelector('.cm-content[contenteditable=true]')","Mermaid Edit a copy must create an editable independent source")
    val mermaidEdit="flowchart TB\nCats --> Dogs\nDogs --> Birds\n"
    replaceEditorText(scenario,mermaidEdit)
    val mermaidHistory=stringValue(evaluate(scenario,"(()=>{const n=document.querySelector('.cm-editor');return JSON.stringify({from:n.getAttribute('data-editor-selection-from'),to:n.getAttribute('data-editor-selection-to'),undo:n.getAttribute('data-editor-undo-depth'),redo:n.getAttribute('data-editor-redo-depth')});})()"))
    menuAction(scenario,"Read")
    waitForCondition(scenario,"!!document.querySelector('.mermaid-surface [data-preview-ready=true]')","edited Mermaid must render a real current preview")
    menuAction(scenario,"Edit")
    waitForCondition(scenario,"!!document.querySelector('.cm-content[contenteditable=true]')","Mermaid Edit must restore the editable source")
    assertEquals(mermaidEdit,editableSourceText(scenario))
    assertEquals("Mermaid Read/Edit must retain actual selection and history",mermaidHistory,stringValue(evaluate(scenario,"(()=>{const n=document.querySelector('.cm-editor');return JSON.stringify({from:n.getAttribute('data-editor-selection-from'),to:n.getAttribute('data-editor-selection-to'),undo:n.getAttribute('data-editor-undo-depth'),redo:n.getAttribute('data-editor-redo-depth')});})()")))
    assertEquals("Mermaid copy editing must preserve original",mermaidSource,String(readBytes(documentUri("s047-controls.mmd")),Charsets.UTF_8))
    for(name in listOf("s047-invalid.mmd","s047-invalid-diagram.md")){
      val uri=grant(documentUri(name));val source=String(readBytes(uri),Charsets.UTF_8)
      openFromAddDocument(scenario,uri)
      waitForBodyText(scenario,"The Mermaid source is malformed. Source remains available.")
      if (!name.endsWith(".mmd")) clickControl(scenario,"View source",".embedded-mermaid button")
      waitForCondition(scenario,"!!document.querySelector('.cm-content[contenteditable=false]')","standalone automatic or embedded explicit malformed-diagram fallback must expose exact read-only source")
      assertEquals(source,sourceEditorText(scenario))
    }
  }

  private fun digestSource(uri: Uri): String {
    val digest = MessageDigest.getInstance("SHA-256")
    resolver.openInputStream(uri)!!.use { input -> val buffer = ByteArray(65536); var count = input.read(buffer); while (count != -1) { digest.update(buffer, 0, count); count = input.read(buffer) } }
    return digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
  }
  private fun heldReadState(method: String, uri: Uri): JSONObject {
    val bundle = requireNotNull(resolver.call(FixtureGrantProvider.COMMAND_URI, method, uri.toString(), null))
    return JSONObject().also { value ->
      for (key in listOf("provider_process_id", "control_process_id", "entered_process_id", "entered_count")) value.put(key, bundle.getInt(key))
      for (key in listOf("entered_on_main_thread", "released", "finished", "timed_out")) value.put(key, bundle.getBoolean(key))
    }
  }
  private fun verifyHeldLargeReadCancellation(scenario: ActivityScenario<MainActivity>, uri: Uri, action: String) {
    val beforeText = stringValue(evaluate(scenario, "document.querySelector('.large-text pre').textContent"))
    val beforeDigest = digestSource(uri)
    val observations = JSONObject().put("operation", action)
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    val armed = heldReadState("arm_held_read", uri)
    val pid = armed.getInt("provider_process_id")
    assertTrue(pid > 0); assertEquals(pid, armed.getInt("control_process_id"))
    var released = false
    var originalFailure: Throwable? = null
    try {
      tapNativeControlOnce(scenario, action, deadlineOverride = deadline)
      waitForCondition(scenario, "!!Array.from(document.querySelectorAll('.large-text-controls button')).find(b=>b.textContent.trim()==='Cancel text operation'&&!b.disabled)&&document.querySelector('.large-text-controls').getAttribute('aria-busy')==='true'", "actual native read must be held while a genuine cancellable foreground task is visible", observations, deadlineOverride = deadline) {
        val state = heldReadState("held_read_status", uri)
        observations.put("held", state).put("scenario_state", scenario.state.name)
        state.getInt("entered_count") > 0 && state.getInt("entered_process_id") == pid && state.getInt("control_process_id") == pid && !state.getBoolean("entered_on_main_thread") && !state.getBoolean("released") && scenario.state == Lifecycle.State.RESUMED
      }
      assertEquals("pending native read must retain the current section", beforeText, stringValue(evaluate(scenario, "document.querySelector('.large-text pre').textContent")))
      observeVisibleTaskControls(scenario, "large_pending_" + action, deadlineOverride = deadline)
      tapNativeControlOnce(scenario, "Cancel text operation", deadlineOverride = deadline)
      waitForCondition(scenario, "document.querySelector('#large-text-status').textContent==='Text operation cancelled. The current section remains open.'&&document.querySelector('.large-text-controls').getAttribute('aria-busy')==='false'", "Cancel must finish visibly before the held read is released", observations, deadlineOverride = deadline)
      assertEquals("Cancel must preserve exact displayed source and position", beforeText, stringValue(evaluate(scenario, "document.querySelector('.large-text pre').textContent")))
      observations.put("cancelled_before_release", true)
      heldReadState("release_held_read", uri); released = true
      waitForCondition(scenario, "document.querySelector('#large-text-status').textContent==='Text operation cancelled. The current section remains open.'", "late native completion must not replace cancelled task state", observations, deadlineOverride = deadline) { heldReadState("held_read_status", uri).getBoolean("finished") }
      assertEquals(beforeText, stringValue(evaluate(scenario, "document.querySelector('.large-text pre').textContent")))
      assertTrue("the complete held-read task must fit the original action budget", SystemClock.elapsedRealtime() < deadline)
    } catch (failure: Throwable) {
      originalFailure = failure
      observations.put("held_after", runCatching { heldReadState("held_read_status", uri) }.getOrNull() ?: JSONObject.NULL)
        .put("root_package", instrumentation.uiAutomation.rootInActiveWindow?.packageName?.toString() ?: JSONObject.NULL)
        .put("failure_type", failure.javaClass.simpleName)
      runCatching { saveScreenshot("s047-row-8.png") }
      println("s047_pending_read_failure=" + observations); System.out.flush(); throw failure
    } finally {
      if (!released) {
        val cleanup = runCatching { heldReadState("release_held_read", uri) }
        if (cleanup.isFailure && originalFailure == null) throw AssertionError("held native read release failed", cleanup.exceptionOrNull())
      }
    }
    val afterDigest = digestSource(uri)
    assertEquals("source bytes must survive cancelled native reads", beforeDigest, afterDigest)
    observations.put("held_after", heldReadState("held_read_status", uri)).put("source_before", beforeDigest).put("source_after", afterDigest).put("position_unchanged", true)
    taskControlMeasurements.put(JSONObject().put("pending_read", observations))
  }

  private fun verifyS047LargeText(scenario: ActivityScenario<MainActivity>) {
    openFromAddDocument(scenario, grant(documentUri("s047-large.txt")))
    waitForBodyText(scenario, "S047_LARGE_FIRST")
    menuAction(scenario,"Large text tools")
    waitForBodyText(scenario,"Next section")
    val first = stringValue(evaluate(scenario, "document.querySelector('.large-text pre').textContent"))
    assertEquals("true", evaluate(scenario, "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Previous section').disabled"))
    clickControl(scenario, "Next section")
    waitForCondition(scenario, "!document.querySelector('.large-text pre').textContent.startsWith('S047_LARGE_FIRST')", "Next section must move to independently loaded source bytes")
    clickControl(scenario, "Previous section")
    waitForCondition(scenario, "document.querySelector('.large-text pre').textContent.startsWith('S047_LARGE_FIRST')", "Previous section must restore source position")
    assertEquals(first, stringValue(evaluate(scenario, "document.querySelector('.large-text pre').textContent")))
    setTaskInput(scenario, "Line", "0"); clickControl(scenario, "Go to line")
    waitForCondition(scenario, "document.querySelector('.large-text-controls input[aria-invalid=true]')!==null", "zero line must remain invalid")
    setTaskInput(scenario, "Line", "2"); clickControl(scenario, "Go to line")
    waitForBodyText(scenario, "Line 2 is at the start of the visible section.")
    val visible = stringValue(evaluate(scenario, "document.querySelector('.large-text pre').textContent"))
    tapNativeControlOnce(scenario, "Copy visible section")
    waitForBodyText(scenario, "Visible section copied")
    assertEquals("clipboard must equal the actual visible bounded section", visible, clipboardText())
    verifyClipboardPasteReceiver(scenario, visible, true)
    observeVisibleTaskControls(scenario, "large_text")

    val beforeOutside=stringValue(evaluate(scenario,"document.querySelector('.large-text pre').textContent"))
    setTaskInput(scenario,"Line","999999999");clickControl(scenario,"Go to line")
    waitForBodyText(scenario,"Line is outside the source")
    assertEquals("outside-source navigation must retain current section",beforeOutside,stringValue(evaluate(scenario,"document.querySelector('.large-text pre').textContent")))
    setTaskInput(scenario,"Find","S047_LARGE_FIRST");clickControl(scenario,"Find next")
    waitForCondition(scenario,"document.querySelector('#large-text-status').textContent.startsWith('Match 1 of 1')","actual large-source search must find the unique controlled prefix")
    setTaskInput(scenario,"Find","S047_ABSENT_LARGE_QUERY");clickControl(scenario,"Find next")
    waitForBodyText(scenario,"No match")
    setTaskInput(scenario, "Find", "S047_LARGE_BODY")
    verifyHeldLargeReadCancellation(scenario, grant(documentUri("s047-large.txt")), "Find next")
    setTaskInput(scenario, "Line", "1500000")
    verifyHeldLargeReadCancellation(scenario, grant(documentUri("s047-large.txt")), "Go to line")
    clickControl(scenario,"Close Large text tools")
  }

  private fun observeVisibleTaskControls(scenario: ActivityScenario<MainActivity>, profile: String, deadlineOverride: Long? = null): JSONObject {
    if (deadlineOverride != null) assertTrue(SystemClock.elapsedRealtime() < deadlineOverride)
    val count = evaluate(scenario, "Array.from(document.querySelectorAll('button,input,select,textarea,summary,[role=button],[role=menuitem],[role=link]')).filter(n=>!n.closest('[aria-hidden=true],[inert]')&&!n.matches('.markdown-document input[type=checkbox][disabled]')&&n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0).length").toInt()
    assertTrue("the composed task must expose bounded real controls", count in 1..200)
    val controls = JSONArray()
    for (index in 0 until count) {
      if (deadlineOverride != null) assertTrue("native control observation must retain the original action deadline", SystemClock.elapsedRealtime() < deadlineOverride)
      val measurement = JSONObject(evaluate(scenario, """
        (()=>{
          const nodes=Array.from(document.querySelectorAll('button,input,select,textarea,summary,[role=button],[role=menuitem],[role=link]')).filter(n=>!n.closest('[aria-hidden=true],[inert]')&&!n.matches('.markdown-document input[type=checkbox][disabled]')&&n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0);
          const n=nodes[INDEX];if(!n)return {found:false};
          const touch=(n.type==='checkbox'||n.type==='radio')?(n.closest('label')||n):n;
          touch.scrollIntoView({block:'center',inline:'nearest'});
          const r=touch.getBoundingClientRect(),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2),s=getComputedStyle(n);
          let bg=n;while(bg&&getComputedStyle(bg).backgroundColor==='rgba(0, 0, 0, 0)')bg=bg.parentElement;
          const name=n.getAttribute('aria-label')||(n.labels&&n.labels.length?Array.from(n.labels).map(l=>l.textContent).join(' '):n.textContent)||n.getAttribute('title')||'';
          const rgb=v=>{const m=v.match(/^rgba?\(([^)]+)\)$/);if(!m)return null;const c=m[1].split(',').map(Number);return [c[0],c[1],c[2],c.length>3?c[3]:1];};
          const over=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])).concat(1);
          const layers=[];for(let e=n;e;e=e.parentElement){const c=rgb(getComputedStyle(e).backgroundColor);if(c)layers.push(c);}
          let back=[255,255,255,1];for(let i=layers.length-1;i>=0;i--)back=over(layers[i],back);
          const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
          const fg=rgb(s.color);const painted=fg?over(fg,back):null;
          const contrast=painted?(Math.max(lum(painted),lum(back))+.05)/(Math.min(lum(painted),lum(back))+.05):null;
          return {found:true,disabled:!!n.disabled,checked:n.checked===true,expanded:n.getAttribute('aria-expanded'),pressed:n.getAttribute('aria-pressed'),label:name.trim().slice(0,120),tag:n.tagName,role:n.getAttribute('role'),left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,viewport_width:innerWidth,hit:hit===touch||touch.contains(hit),contrast:contrast,text_size:parseFloat(s.fontSize),font_weight:s.fontWeight};
        })()
      """.trimIndent().replace("INDEX", index.toString())))
      assertTrue("each live control must remain measurable: " + profile, measurement.getBoolean("found"))
      assertTrue("each action needs a meaningful accessible name", measurement.getString("label").isNotBlank())
      assertTrue("every action target must retain 48 CSS-pixel dimensions: profile=" + profile + ",control=" + measurement, measurement.getDouble("width") >= 47.5 && measurement.getDouble("height") >= 47.5)
      assertTrue("the actual visible control must receive the center hit", measurement.getBoolean("hit"))
      val native = nativeControlGeometry(scenario, measurement)
      assertTrue("the whole action must fit the actual native visible intersection", native.getBoolean("whole_control_visible"))
      assertTrue("targets must also meet actual physical 48dp-equivalent bounds", native.getDouble("control_right") - native.getDouble("control_left") >= 47.5 * native.getDouble("density") && native.getDouble("control_bottom") - native.getDouble("control_top") >= 47.5 * native.getDouble("density"))
      val largeText = measurement.getDouble("text_size") >= 24 || (measurement.getDouble("text_size") >= 18.66 && (measurement.optString("font_weight").toIntOrNull() ?: 400) >= 700)
      if (!measurement.getBoolean("disabled")) assertTrue("computed actual WebView text contrast must meet its normal/large threshold", !measurement.isNull("contrast") && measurement.getDouble("contrast") >= if (largeText) 2.99 else 4.49)
      controls.put(measurement.put("native", native))
    }
    val css = JSONObject(evaluate(scenario, "({width:innerWidth,height:innerHeight})"))
    val result = JSONObject().put("profile", profile).put("controls", controls).put("css", css).put("font_scale", clientContext.resources.configuration.fontScale).put("ime_visible",visibleNativeImeBounds().isNotEmpty())
    taskControlMeasurements.put(result)
    for (index in 0 until controls.length()) println("s047_control_geometry=" + JSONObject().put("profile", profile).put("font_scale", clientContext.resources.configuration.fontScale).put("control", controls.getJSONObject(index)))
    System.out.flush()
    return JSONObject().put("profile", profile).put("control_count", count).put("css", css).put("font_scale", clientContext.resources.configuration.fontScale)
  }
  private fun shellOutput(command: String): String = instrumentation.uiAutomation.executeShellCommand(command).use { descriptor -> android.os.ParcelFileDescriptor.AutoCloseInputStream(descriptor).bufferedReader().use { it.readText() } }
  private fun awaitFontScale(value: Float) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    while (SystemClock.elapsedRealtime() < deadline && kotlin.math.abs(clientContext.resources.configuration.fontScale - value) > 0.01f) SystemClock.sleep(100L)
    assertEquals("actual Android font configuration must change", value.toDouble(), clientContext.resources.configuration.fontScale.toDouble(), 0.01)
  }

  private fun verifyS047TaskGeometry(scenario: ActivityScenario<MainActivity>, profile: String, ime: Boolean) {
    fun hideIme(deadline:Long) {
      if(visibleNativeImeBounds().isEmpty())return
      scenario.onActivity { activity->
        val view=requireNotNull(findWebView(activity.window.decorView))
        (activity.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager).hideSoftInputFromWindow(view.windowToken,0)
      }
      while(visibleNativeImeBounds().isNotEmpty()&&SystemClock.elapsedRealtime()<deadline)SystemClock.sleep(100L)
      assertTrue("one public keyboard-hide request must establish the actual non-IME profile",visibleNativeImeBounds().isEmpty())
    }
    fun observe(task: String, inputLabel: String? = null, value: String = "cats") {
      val deadline=SystemClock.elapsedRealtime()+30_000L
      if (ime && inputLabel != null) {
        setTaskInput(scenario,inputLabel,value,deadlineOverride=deadline)
        while(visibleNativeImeBounds().isEmpty()&&SystemClock.elapsedRealtime()<deadline)SystemClock.sleep(100L)
        assertTrue("editable task profile requires the actual native IME",visibleNativeImeBounds().isNotEmpty())
      } else hideIme(deadline)
      waitForCondition(scenario,"!!document.querySelector('[role=dialog]')","managed task must settle inside its actual native visible frame",deadlineOverride=deadline) {
        val rect=JSONObject(evaluate(scenario,"(()=>{const n=document.querySelector('[role=dialog]');if(!n)return {found:false};const r=n.getBoundingClientRect();return {found:true,left:r.left,top:r.top,right:r.right,bottom:r.bottom,x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,viewport_width:innerWidth};})()"))
        rect.getBoolean("found")&&nativeControlGeometry(scenario,rect).getBoolean("whole_control_visible")
      }
      observeVisibleTaskControls(scenario,profile+":"+task,deadlineOverride=deadline)
      taskControlMeasurements.getJSONObject(taskControlMeasurements.length()-1).put("ime_applicable",inputLabel!=null)
    }
    createNewDraftForInput(scenario,"New text file","Untitled.txt")
    menuAction(scenario,"Search")
    observe("editor_search","Find")
    clickControl(scenario,"Close search")
    menuAction(scenario,"Document details")
    observe("document_details")
    clickControl(scenario,"Close Document details")
    openFromAddDocument(scenario,grant(documentUri("s047-controls.md")))
    if(evaluate(scenario,"!!document.querySelector('.document-surface .markdown-source-mode:not([hidden])')")=="true")menuAction(scenario,"Read")
    waitForCondition(scenario,"!!document.querySelector('.document-surface .markdown-rendered-mode:not([hidden]) .markdown-document h2')","profile must use actual rendered Markdown")
    menuAction(scenario,"Search")
    observe("markdown_search","Find rendered text")
    clickControl(scenario,"Close search")
    menuAction(scenario,"Outline")
    observe("outline")
    clickControl(scenario,"Close Document outline")
    menuAction(scenario,"File information")
    observe("metadata")
    clickControl(scenario,"Close File information")
    openFromAddDocument(scenario,grant(documentUri("s047-controls.mmd")))
    if(evaluate(scenario,"!!document.querySelector('.document-surface .mermaid-source-mode')")=="true")menuAction(scenario,"Read")
    waitForCondition(scenario,"!!document.querySelector('.document-surface .mermaid-rendered-mode [data-preview-ready=true]')","profile must use an actual ready Mermaid viewport")
    menuAction(scenario,"Search")
    observe("mermaid_search","Find diagram text","Cats")
    clickControl(scenario,"Close search")
    clickControl(scenario,"More diagram tools")
    observe("diagram_tools")
    clickControl(scenario,"Close Diagram tools")
    openFromAddDocument(scenario,grant(documentUri("original.gif")))
    waitForImagePixels(scenario,"original.gif")
    clickControl(scenario,"More image tools")
    observe("image_tools","Animation frame","2")
    clickControl(scenario,"Close Image tools")
    openFromAddDocument(scenario,grant(documentUri("entries.ico")))
    waitForImagePixels(scenario,"entries.ico")
    clickControl(scenario,"More image tools")
    observe("icon_tools")
    clickControl(scenario,"Close Image tools")
    openFromAddDocument(scenario,grant(documentUri("s047-large.txt")))
    waitForCondition(scenario,"!!document.querySelector('.large-text pre')","profile must retain actual bounded large text")
    menuAction(scenario,"Large text tools")
    observe("large_tools","Find","S047_LARGE_FIRST")
    clickControl(scenario,"Close Large text tools")
    menuAction(scenario,"Preferences")
    val family=stringValue(evaluate(scenario,"Array.from(document.querySelectorAll('input')).find(n=>n.labels&&Array.from(n.labels).some(l=>l.textContent.trim().startsWith('Editor font family'))).value"))
    observe("preferences","Editor font family",family)
    clickControl(scenario,"Close Preferences")
    hideIme(SystemClock.elapsedRealtime()+30_000L)
  }

  @Test fun s047ClipboardDiagnostic() {
    val scenario = launchS047()
    clipboardProviderFacts()
    val text = "S047 clipboard Ω🙂\nsecond line\n"
    createNewDraftForInput(scenario, "New text file", "Untitled.txt")
    replaceEditorText(scenario, text)
    menuAction(scenario, "Copy")
    verifyClipboardPasteReceiver(scenario, text, false)
    verifyS047LargeText(scenario)
    val report = JSONObject().put("diagnostic_only", true).put("candidate_qualified", false)
      .put("identity", candidateIdentity(scenario)).put("clipboard_paste_readbacks", clipboardPasteReadbacks)
    File(clientContext.filesDir, "s047-clipboard-diagnostic.json").writeText(report.toString(), Charsets.UTF_8)
    println("s047_clipboard_diagnostic=" + JSONObject().put("readbacks", clipboardPasteReadbacks.length()).put("exact_copy", true))
    System.out.flush()
  }

  @Test fun s047LayoutJourney() {
    val scenario = launchS047()
    enableNativeWindowObservation()
    val observations = JSONObject()
    val originalFont=clientContext.resources.configuration.fontScale
    verifyS047EditorAndPreferences(scenario)
    verifyS047MarkdownAndMetadata(scenario)
    verifyS047LargeText(scenario)
    try {
      for (font in if (Build.VERSION.SDK_INT >= 34) listOf(1f, 2f) else listOf(1f, 1.3f)) {
        shellOutput("settings put system font_scale " + font)
        awaitFontScale(font)
        scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
        waitForCondition(scenario, "innerHeight>innerWidth", "actual portrait must be observed")
        observations.put("portrait-" + font, observeVisibleTaskControls(scenario, "portrait"))
        verifyS047TaskGeometry(scenario,"portrait-"+font,false)
        verifyAddDocumentChoices(scenario)
        for ((destination, close) in listOf("Preferences" to "Close Preferences", "Diagnostics" to "Close Diagnostics", "About Glitchpad" to "Close About Glitchpad")) {
          menuAction(scenario, destination)
          observeVisibleTaskControls(scenario, destination)
          clickControl(scenario, close)
        }
        createNewDraftForInput(scenario, "New text file", "Untitled.txt")
        replaceEditorText(scenario, "S047_GEOMETRY_TEXT\n")
        val imeDeadline = SystemClock.elapsedRealtime() + 30_000L
        while (visibleNativeImeBounds().isEmpty() && SystemClock.elapsedRealtime() < imeDeadline) SystemClock.sleep(100L)
        assertTrue("IME geometry requires the actual native keyboard window", visibleNativeImeBounds().isNotEmpty())
        observations.put("ime-" + font, observeVisibleTaskControls(scenario, "ime"))
        verifyS047TaskGeometry(scenario,"ime-"+font,true)
        dismissObservedAppIme(scenario)
        scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
        waitForCondition(scenario, "innerWidth>innerHeight", "actual landscape must be observed")
        observations.put("landscape-" + font, observeVisibleTaskControls(scenario, "landscape"))
        verifyS047TaskGeometry(scenario,"landscape-"+font,false)
        scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED }
        val density = clientContext.resources.displayMetrics.density
        shellOutput("wm size " + (480 * density).toInt() + "x" + (240 * density).toInt())
        waitForCondition(scenario, "innerHeight<=260&&innerWidth>innerHeight", "actual short window must be independently observed")
        observations.put("short-" + font, observeVisibleTaskControls(scenario, "short"))
        verifyS047TaskGeometry(scenario,"short-"+font,false)
        shellOutput("wm size reset")
        waitForCondition(scenario, "innerHeight>innerWidth", "native window must restore before later observations")
      }
      focusNativeWebView(scenario)
      instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_TAB)
      waitForCondition(scenario, "(()=>{const n=document.activeElement;if(!n||n===document.body)return false;const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&(parseFloat(s.outlineWidth)>0||s.boxShadow!=='none');})()", "real keyboard focus must be visible")
      val variants = mutableListOf("portrait", "landscape", "short", "ime", "default_font", "font_max", "targets", "semantics", "focus", "keyboard", "contrast", "editor_search_history", "markdown_mermaid", "large_text", "large_pending_cancel", "metadata_copy", "preferences_validation", "editor_aliases", "details_language", "metadata_sha", "preferences_wrap", "diagram_controls", "external_intent")
      if (Build.VERSION.SDK_INT >= 34) variants.add("font_200")
      val details = JSONObject().put("profiles", observations).put("control_measurements", taskControlMeasurements).put("clipboard_paste_readbacks", clipboardPasteReadbacks)
      emitS047Journey(scenario, 8, variants, details)
    } finally { checkedShell("settings put system font_scale "+originalFont); checkedShell("wm size reset"); scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT };awaitFontScale(originalFont) }
  }

  private fun imageViewState(scenario: ActivityScenario<MainActivity>): JSONObject = JSONObject(evaluate(scenario, "(()=>{const n=document.querySelector('.image-pane');return {ready:n&&n.getAttribute('data-preview-ready')==='true',mode:n&&n.getAttribute('data-viewport-mode'),scale:n?Number(n.getAttribute('data-viewport-scale')):0,x:n?Number(n.getAttribute('data-viewport-pan-x')):0,y:n?Number(n.getAttribute('data-viewport-pan-y')):0,background:n&&n.getAttribute('data-viewport-background'),selection:n&&n.getAttribute('data-image-selection')};})()"))
  private fun nativeImageGesture(scenario: ActivityScenario<MainActivity>, pinch: Boolean, selector: String = ".image-pane") {
    val target = JSONObject(evaluate(scenario, "(()=>{const n=document.querySelector(" + JSONObject.quote(selector) + ");n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return {found:true,left:r.left,top:r.top,right:r.right,bottom:r.bottom,x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,viewport_width:innerWidth};})()"))
    val geometry = nativeControlGeometry(scenario, target)
    assertTrue("image gesture must start wholly inside the actual visible native pane", geometry.getBoolean("whole_control_visible"))
    val x = geometry.getDouble("screen_x").toFloat(); val y = geometry.getDouble("screen_y").toFloat(); val scale = geometry.getDouble("css_to_native_scale").toFloat()
    val downTime = SystemClock.uptimeMillis()
    fun inject(action: Int, count: Int, spread: Float, dx: Float) {
      val props = Array(count) { index -> MotionEvent.PointerProperties().apply { id = index; toolType = MotionEvent.TOOL_TYPE_FINGER } }
      val coordinates = Array(count) { index -> MotionEvent.PointerCoords().apply { this.x = x + dx + if (count == 2) (if (index == 0) -spread else spread) else 0f; this.y = y; pressure = 1f; size = 1f } }
      val event = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), action, count, props, coordinates, 0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0)
      try { assertTrue("actual native image pointer input must be accepted", instrumentation.uiAutomation.injectInputEvent(event, true)) } finally { event.recycle() }
    }
    if (pinch) {
      inject(MotionEvent.ACTION_DOWN, 1, 0f, -20f * scale)
      inject(MotionEvent.ACTION_POINTER_DOWN or (1 shl MotionEvent.ACTION_POINTER_INDEX_SHIFT), 2, 20f * scale, 0f)
      inject(MotionEvent.ACTION_MOVE, 2, 35f * scale, 0f)
      inject(MotionEvent.ACTION_POINTER_UP or (1 shl MotionEvent.ACTION_POINTER_INDEX_SHIFT), 2, 35f * scale, 0f)
      inject(MotionEvent.ACTION_UP, 1, 0f, -35f * scale)
    } else {
      inject(MotionEvent.ACTION_DOWN, 1, 0f, 0f)
      inject(MotionEvent.ACTION_MOVE, 1, 0f, -32f * scale)
      inject(MotionEvent.ACTION_UP, 1, 0f, -32f * scale)
    }
  }



  private fun viewportStateScript(selector:String,image:Boolean):String {
    return """
      (()=>{
        const surface=document.querySelector('.document-surface'),pane=surface&&surface.querySelector(SELECTOR),image=pane&&pane.querySelector('img');
        if(!surface||!pane||!image)return {ready:false};
        const rect=pane.getBoundingClientRect(),style=getComputedStyle(pane);
        const ready=!pane.closest('[hidden],.markdown-print-document')&&style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0&&pane.getAttribute('data-preview-ready')==='true'&&image.complete&&image.naturalWidth>0&&image.naturalHeight>0;
        return {ready:ready,document:surface.id,source:image.src,scale:Number(pane.getAttribute('data-viewport-scale')),mode:pane.getAttribute('data-viewport-mode'),x:Number(pane.getAttribute('data-viewport-pan-x')),y:Number(pane.getAttribute('data-viewport-pan-y')),background:pane.getAttribute('data-viewport-background'),selection:pane.getAttribute('data-image-selection'),fit:Math.min(1,(IMAGE?rect.width:pane.clientWidth)/image.naturalWidth,(IMAGE?rect.height:pane.clientHeight)/image.naturalHeight)};
      })()
    """.trimIndent().replace("SELECTOR",JSONObject.quote(selector)).replace("IMAGE",image.toString())
  }

  private fun verifyS047MoreViewportActions(scenario:ActivityScenario<MainActivity>,selector:String,kind:String) {
    val image=kind=="image"
    val scope=if(image)".task-surface.image-tools[role=dialog][data-state=open] button" else ".task-surface.diagram-tools[role=dialog][data-state=open] button"
    val deadline=SystemClock.elapsedRealtime()+30_000L
    val script=viewportStateScript(selector,image)
    waitForCondition(scenario,"("+script+").ready","More actions must own a real ready current viewport",deadlineOverride=deadline)
    fun snapshot():JSONObject=JSONObject(evaluate(scenario,script))
    val before=snapshot()
    fun assertScope(current:JSONObject) {
      assertTrue("More actions must retain the actual current pane",current.getBoolean("ready"))
      assertEquals("More actions must retain the selected document",before.getString("document"),current.getString("document"))
      assertEquals("More actions must retain the same decoded source",before.getString("source"),current.getString("source"))
      if(image){assertEquals("More actions must preserve selected frame/entry",before.get("selection"),current.get("selection"));assertEquals("More actions must preserve background",before.get("background"),current.get("background"))}
    }
    clickControl(scenario,"Fit",scope)
    waitForCondition(scenario,"(()=>{const current="+script+";return current.ready&&current.mode==='fit'&&Math.abs(current.scale-current.fit)<0.0001;})()","More Fit must resolve the live intrinsic/pane effective scale",deadlineOverride=deadline)
    val fit=snapshot();assertScope(fit)
    assertEquals("More Fit must clear pan without resetting source scope",0.0,fit.getDouble("x"),0.0001);assertEquals(0.0,fit.getDouble("y"),0.0001)
    clickControl(scenario,"Zoom in",scope)
    waitForCondition(scenario,"Math.abs(("+script+").scale-"+(fit.getDouble("scale")*1.25)+")<0.0001","More Zoom in must multiply the same effective scale",deadlineOverride=deadline)
    val zoomIn=snapshot();assertScope(zoomIn)
    clickControl(scenario,"Zoom out",scope)
    waitForCondition(scenario,"Math.abs(("+script+").scale-"+(zoomIn.getDouble("scale")*0.8)+")<0.0001","More Zoom out must invert the same effective scale",deadlineOverride=deadline)
    val zoomOut=snapshot();assertScope(zoomOut)
    val record=JSONObject().put("kind",kind).put("expected_fit",fit.getDouble("fit")).put("fit",fit.getDouble("scale")).put("zoom_in",zoomIn.getDouble("scale")).put("zoom_out",zoomOut.getDouble("scale")).put("same_document",true).put("same_source",true).put("scope_preserved",true)
    moreViewportActions.put(record)
    println("s047_more_viewport_actions="+record);System.out.flush()
  }


  private fun prepareViewportToolbar(scenario:ActivityScenario<MainActivity>,selector:String,deadline:Long) {
    if(visibleNativeImeBounds().isNotEmpty()){
      scenario.onActivity { activity->val view=requireNotNull(findWebView(activity.window.decorView));(activity.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager).hideSoftInputFromWindow(view.windowToken,0) }
      while(visibleNativeImeBounds().isNotEmpty()&&SystemClock.elapsedRealtime()<deadline)SystemClock.sleep(100L)
      assertTrue("local viewport aliases require the actual restored non-IME context",visibleNativeImeBounds().isEmpty())
    }
    waitForCondition(scenario,"(()=>{const n=document.querySelector("+JSONObject.quote(selector)+");if(!n||n.disabled||n.closest('[hidden],[inert],[aria-hidden=true]'))return false;const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';})()","local viewport route must actually be exposed before native input",deadlineOverride=deadline)
  }

  private fun verifyS047DiagramRoutes(scenario: ActivityScenario<MainActivity>, selector: String, standalone: Boolean) {
    fun state(): JSONObject = JSONObject(evaluate(scenario, "(()=>{const n=document.querySelector(" + JSONObject.quote(selector) + ");return {scale:Number(n.getAttribute('data-viewport-scale')),x:Number(n.getAttribute('data-viewport-pan-x')),y:Number(n.getAttribute('data-viewport-pan-y')),mode:n.getAttribute('data-viewport-mode')};})()"))
    val aliasDeadline=SystemClock.elapsedRealtime()+30_000L
    val localControls=if(standalone)".diagram-controls button" else ".embedded-mermaid .diagram-controls button"
    prepareViewportToolbar(scenario,localControls+"[aria-label=\"Zoom out\"]",aliasDeadline)
    val restored=viewportStateScript(selector,false)
    waitForCondition(scenario,"(()=>{const current="+restored+";return current.ready&&(current.mode!=='fit'||Math.abs(current.scale-current.fit)<0.0001);})()","diagram aliases require coherent visible pane dimensions",deadlineOverride=aliasDeadline)
    val fit=state().getDouble("scale")
    tapNativeControlOnce(scenario,"Zoom in",localControls,deadlineOverride=aliasDeadline)
    waitForCondition(scenario,"Math.abs(Number(document.querySelector("+JSONObject.quote(selector)+").getAttribute('data-viewport-scale'))-"+(fit*1.25)+")<0.0001","local diagram Zoom must change the actual viewport",deadlineOverride=aliasDeadline)
    assertEquals(fit * 1.25, state().getDouble("scale"), 0.0001)
    tapNativeControlOnce(scenario,"Zoom out",localControls,deadlineOverride=aliasDeadline)
    waitForCondition(scenario,"Math.abs(Number(document.querySelector("+JSONObject.quote(selector)+").getAttribute('data-viewport-scale'))-"+fit+")<0.0001","local diagram Zoom out must invert the same effective scale",deadlineOverride=aliasDeadline)
    tapNativeControlOnce(scenario,"Zoom in",localControls,deadlineOverride=aliasDeadline)
    waitForCondition(scenario,"Math.abs(Number(document.querySelector("+JSONObject.quote(selector)+").getAttribute('data-viewport-scale'))-"+(fit*1.25)+")<0.0001","local diagram Zoom in must restore the same factor",deadlineOverride=aliasDeadline)
    if (standalone) {
      menuAction(scenario,"Zoom in")
      waitForCondition(scenario,"Math.abs(Number(document.querySelector("+JSONObject.quote(selector)+").getAttribute('data-viewport-scale'))-"+(fit*1.25*1.25)+")<0.0001","global diagram menu Zoom in must multiply the same pane",deadlineOverride=aliasDeadline)
      menuAction(scenario,"Zoom out")
      waitForCondition(scenario,"Math.abs(Number(document.querySelector("+JSONObject.quote(selector)+").getAttribute('data-viewport-scale'))-"+(fit*1.25)+")<0.0001","global diagram menu Zoom out must invert the same pane scale",deadlineOverride=aliasDeadline)
      menuAction(scenario,"Zoom in")
      waitForCondition(scenario,"Math.abs(Number(document.querySelector("+JSONObject.quote(selector)+").getAttribute('data-viewport-scale'))-"+(fit*1.25*1.25)+")<0.0001","global menu scale must settle before keyboard routes",deadlineOverride=aliasDeadline)
    }
    val beforeKeyboard = state().getDouble("scale")
    evaluate(scenario, "document.querySelector(" + JSONObject.quote(selector) + ").focus();true")
    instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_EQUALS)
    waitForCondition(scenario,"Math.abs(Number(document.querySelector("+JSONObject.quote(selector)+").getAttribute('data-viewport-scale'))-"+(beforeKeyboard*1.25)+")<0.0001","real diagram keyboard Zoom must multiply the same viewport",deadlineOverride=aliasDeadline)
    val beforeControlKeys=state().getDouble("scale")
    if(standalone){
      evaluate(scenario,"document.querySelector('button[aria-label=\"Document tools\"]').focus();true")
      waitForCondition(scenario,"document.activeElement===document.querySelector('button[aria-label=\"Document tools\"]')","global diagram keys must actually target header chrome",deadlineOverride=aliasDeadline)
    }
    taskKey(KeyEvent.KEYCODE_MINUS,KeyEvent.META_CTRL_ON)
    waitForCondition(scenario,"Math.abs(Number(document.querySelector("+JSONObject.quote(selector)+").getAttribute('data-viewport-scale'))-"+(beforeControlKeys*0.8)+")<0.0001",if(standalone)"header-focused CtrlMinus must use the global diagram provider" else "canvas CtrlMinus must invert embedded diagram scale",deadlineOverride=aliasDeadline)
    taskKey(KeyEvent.KEYCODE_EQUALS,KeyEvent.META_CTRL_ON)
    waitForCondition(scenario,"Math.abs(Number(document.querySelector("+JSONObject.quote(selector)+").getAttribute('data-viewport-scale'))-"+beforeControlKeys+")<0.0001","CtrlPlus must restore the exact effective scale",deadlineOverride=aliasDeadline)
    evaluate(scenario,"document.querySelector("+JSONObject.quote(selector)+").focus();true")
    for (step in 1..8) instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_EQUALS)
    val beforeArrow = state().getDouble("x")
    instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_LEFT)
    assertTrue("real diagram Arrow key must pan its overflowing content", state().getDouble("x") < beforeArrow)
    val beforeDrag = state()
    nativeImageGesture(scenario, false, selector)
    waitForCondition(scenario, "Number(document.querySelector(" + JSONObject.quote(selector) + ").getAttribute('data-viewport-pan-x'))!==" + beforeDrag.getDouble("x"), "real diagram drag must pan an overflowing viewport")
    assertEquals(beforeDrag.getDouble("scale"), state().getDouble("scale"), 0.0001)
    clickControl(scenario, "More diagram tools", if (standalone) ".diagram-controls button" else ".embedded-mermaid .diagram-controls button")
    for ((label, axis, sign) in listOf(Triple("Pan left", "x", -1), Triple("Pan right", "x", 1), Triple("Pan up", "y", -1), Triple("Pan down", "y", 1))) {
      val before = state().getDouble(axis)
      clickControl(scenario, label)
      val after = state().getDouble(axis)
      assertTrue("directional Pan must move the requested axis", (after - before) * sign > 0)
    }
    verifyS047MoreViewportActions(scenario,selector,if(standalone)"diagram_standalone" else "diagram_embedded")
    clickControl(scenario, "Actual size", ".task-surface.diagram-tools[role=dialog][data-state=open] button")
    assertEquals(1.0, state().getDouble("scale"), 0.0001)
    clickControl(scenario, "Reset view")
    assertEquals("fit", state().getString("mode"))
    observeVisibleTaskControls(scenario, if (standalone) "diagram_tools" else "embedded_diagram_tools")
    clickControl(scenario, "Close Diagram tools")
    clickControl(scenario, "Fit", if (standalone) ".diagram-controls button" else ".embedded-mermaid .diagram-controls button")
    assertEquals("fit", state().getString("mode"))
  }

  private fun verifyS047SecondaryImageTasks(scenario: ActivityScenario<MainActivity>): JSONObject {
    openFromAddDocument(scenario, grant(documentUri("original.gif")))
    waitForImagePixels(scenario, "original.gif")
    clickControl(scenario, "More image tools")
    for ((index, background) in listOf("checker", "light", "dark").withIndex()) {
      chooseTaskOption(scenario, "Image background", index, background)
      assertEquals(background, imageViewState(scenario).getString("background"))
    }
    val selected = imageViewState(scenario).getString("selection")
    for (invalid in listOf("", "999", "2.5")) {
      setTaskInput(scenario, "Animation frame", invalid)
      instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
      waitForCondition(scenario, "document.querySelector('input[aria-label=\"Animation frame\"]').getAttribute('aria-invalid')==='true'", "invalid frame draft must stay invalid without a native decode")
      assertEquals(selected, imageViewState(scenario).getString("selection"))
    }
    setTaskInput(scenario, "Animation frame", "3")
    instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
    waitForCondition(scenario, "document.querySelector('.image-pane').getAttribute('data-image-selection')==='2'", "valid frame must select actual frame3")
    clickControl(scenario, "Previous frame")
    waitForCondition(scenario, "document.querySelector('.image-pane').getAttribute('data-image-selection')==='1'", "Previous frame must decode the prior actual frame")
    clickControl(scenario, "Next frame")
    waitForCondition(scenario, "document.querySelector('.image-pane').getAttribute('data-image-selection')==='2'", "Next frame must decode the next actual frame")
    waitForCondition(scenario, "!!document.querySelector('.image-pane[data-preview-ready=true][data-image-selection=\"2\"]')", "Play readiness requires the actual selected decoded frame")
    val playback = JSONObject(evaluate(scenario, "(()=>{const b=Array.from(document.querySelectorAll('button')).find(n=>n.textContent.trim()==='Play');return {disabled:b.disabled,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};})()"))
    val animation=JSONObject().put("reduced_motion",playback.getBoolean("reduced")).put("play_enabled",!playback.getBoolean("disabled")).put("advanced",false).put("paused",false)
    if (playback.getBoolean("disabled")) {
      assertTrue("disabled Play must be explained by actual reduced-motion state", playback.getBoolean("reduced"))
      waitForBodyText(scenario, "Playback is paused by your reduced-motion preference")
      animation.put("branch","reduced_motion_disabled").put("policy_explanation",true).put("unexecuted_actions",JSONArray(listOf("Play","Pause")))
    } else {
      evaluate(scenario, "window.__s040PreviousPreview=document.querySelector('.image-preview').src;true")
      clickControl(scenario, "Play")
      waitForImagePixels(scenario, "original.gif", true)
      clickControl(scenario, "Pause")
      waitForCondition(scenario, "!!document.querySelector('.image-pane[data-preview-ready=true]')&&Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Play'&&b.getAttribute('aria-pressed')==='false')", "Pause must stop playback and retain an actually displayed decoded frame")
      animation.put("branch","played_and_paused").put("advanced",true).put("paused",true).put("unexecuted_actions",JSONArray())
    }
    setTaskInput(scenario, "Animation frame", "3"); instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_ENTER)
    waitForCondition(scenario, "document.querySelector('.image-pane').getAttribute('data-image-selection')==='2'", "selected frame must settle before Reset")
    verifyS047MoreViewportActions(scenario,".image-pane","image")
    clickControl(scenario, "Actual size"); clickControl(scenario, "Reset view")
    assertEquals("2", imageViewState(scenario).getString("selection")); assertEquals("dark", imageViewState(scenario).getString("background"))
    observeVisibleTaskControls(scenario, "animation_tools")
    clickControl(scenario, "Close Image tools")
    openFromAddDocument(scenario, grant(documentUri("entries.ico")))
    waitForImagePixels(scenario, "entries.ico")
    clickControl(scenario, "More image tools")
    chooseTaskOption(scenario, "Icon entry", 1, "1")
    waitForCondition(scenario, "document.querySelector('.image-pane').getAttribute('data-image-selection')==='1'", "native icon option must select the intended entry")
    chooseTaskOption(scenario, "Image background", 1, "light")
    clickControl(scenario, "Actual size"); clickControl(scenario, "Reset view")
    assertEquals("1", imageViewState(scenario).getString("selection")); assertEquals("light", imageViewState(scenario).getString("background"))
    observeVisibleTaskControls(scenario, "icon_tools")
    clickControl(scenario, "Close Image tools")
    return animation
  }


  private fun verifyS047EmbeddedMetadata(scenario: ActivityScenario<MainActivity>) {
    val uri=grant(documentUri("orientation-6.jpg"));val before=readBytes(uri)
    openFromAddDocument(scenario,uri)
    waitForCondition(scenario,"!!document.querySelector('.image-pane[data-preview-ready=true]')","metadata fixture must actually decode")
    clickControl(scenario,"More image tools");clickControl(scenario,"File information")
    waitForCondition(scenario,"document.querySelectorAll('[aria-label=\"Embedded image observations\"] details').length>0","actual Exif observations must have inspectable disclosures")
    val count=evaluate(scenario,"document.querySelectorAll('[aria-label=\"Embedded image observations\"] details').length").toInt()
    for(index in 1..count){
      val selector="[aria-label=\"Embedded image observations\"] details:nth-of-type("+index+") summary"
      val label=stringValue(evaluate(scenario,"document.querySelector("+JSONObject.quote(selector)+").textContent.trim()"))
      tapNativeControlOnce(scenario,label,selector)
      waitForCondition(scenario,"document.querySelector("+JSONObject.quote(selector)+").parentElement.open","metadata observation disclosure must open its actual observation")
      tapNativeControlOnce(scenario,label,selector)
      waitForCondition(scenario,"!document.querySelector("+JSONObject.quote(selector)+").parentElement.open","metadata observation disclosure must close")
    }
    observeVisibleTaskControls(scenario,"embedded_metadata")
    clickControl(scenario,"Close File information")
    assertTrue("embedded metadata operations must preserve exact original bytes",before.contentEquals(readBytes(uri)))
  }

  @Test fun s047ImageJourney() {
    resolvedIntentDisplaysColdAndWarmProviderDocuments()
    val scenario = requireNotNull(ownedScenario)
    assertS047Role(scenario)
    for (name in listOf("svg-presentation.svg", "svg-namespaced.svg", "svg-reuse.svg")) {
      val uri = grant(documentUri(name)); val before = readBytes(uri)
      openFromAddDocument(scenario, uri); waitForImagePixels(scenario, name)
      assertTrue("accepted SVG must preserve original provider bytes", before.contentEquals(readBytes(uri)))
    }
    for ((name, code) in listOf("svg-unsupported.svg" to "svg_unsupported", "svg-malformed.svg" to "malformed", "svg-external.svg" to "svg_external_reference", "svg-cycle.svg" to "svg_cyclic_reference", "svg-missing.svg" to "svg_missing_reference", "svg-resource.svg" to "oversized")) {
      val uri = grant(documentUri(name)); val before = readBytes(uri)
      openFromAddDocument(scenario, uri)
      waitForCondition(scenario, "!!document.querySelector('[data-preview-failure=" + code + "]')", "SVG must expose its exact finite failure category")
      assertEquals("true", evaluate(scenario, "!Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Retry preview')"))
      assertEquals("true", evaluate(scenario, "Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='File information')"))
      assertTrue("refused SVG must preserve source bytes", before.contentEquals(readBytes(uri)))
    }
    val denied = grant(documentUri("svg-read-denied.svg"))
    // Acquisition checks seekability once; image identification revalidates three times and reads its prefix once. Deny the subsequent preview read.
    resolver.call(FixtureGrantProvider.COMMAND_URI, "arm_read_failure", denied.toString(), android.os.Bundle().apply { putInt("successful_reads", 5) })
    try {
      openFromAddDocument(scenario, denied)
      waitForCondition(scenario, "!!document.querySelector('[data-preview-failure=source_read]')", "native provider denial after identification must remain distinct from transport or malformed content")
    } finally { resolver.call(FixtureGrantProvider.COMMAND_URI, "clear_read_failure", denied.toString(), null) }
    clickControl(scenario, "Retry preview")
    waitForCondition(scenario, "!!document.querySelector('[data-preview-ready=true]')", "read refusal retry must actually render after access recovers")
    val animation=verifyS047SecondaryImageTasks(scenario)
    verifyS047EmbeddedMetadata(scenario)
    openFromAddDocument(scenario, grant(documentUri("svg-viewport.svg")))
    waitForCondition(scenario, "!!document.querySelector('[data-preview-ready=true]')", "large inert SVG must produce a usable viewport")
    val imageAliasDeadline=SystemClock.elapsedRealtime()+30_000L
    prepareViewportToolbar(scenario,".image-actions button[aria-label=\"Zoom out\"]",imageAliasDeadline)
    val restoredImage=viewportStateScript(".image-pane",true)
    waitForCondition(scenario,"(()=>{const current="+restoredImage+";return current.ready&&(current.mode!=='fit'||Math.abs(current.scale-current.fit)<0.0001);})()","image aliases require coherent visible pane dimensions",deadlineOverride=imageAliasDeadline)
    val fit = imageViewState(scenario).getDouble("scale")
    tapNativeControlOnce(scenario,"Zoom in",".image-actions button",deadlineOverride=imageAliasDeadline)
    waitForCondition(scenario,"Math.abs(Number(document.querySelector('.image-pane').getAttribute('data-viewport-scale'))-"+(fit*1.25)+")<0.0001","local image Zoom must multiply the actual viewport",deadlineOverride=imageAliasDeadline)
    val local = imageViewState(scenario).getDouble("scale")
    assertEquals(fit * 1.25, local, 0.0001)
    menuAction(scenario, "Zoom in")
    waitForCondition(scenario,"Math.abs(Number(document.querySelector('.image-pane').getAttribute('data-viewport-scale'))-"+(local*1.25)+")<0.0001","menu image Zoom must multiply the same viewport",deadlineOverride=imageAliasDeadline)
    assertEquals(local * 1.25, imageViewState(scenario).getDouble("scale"), 0.0001)
    evaluate(scenario, "document.querySelector('.image-pane').focus();true")
    instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_EQUALS)
    waitForCondition(scenario,"Math.abs(Number(document.querySelector('.image-pane').getAttribute('data-viewport-scale'))-"+(local*1.25*1.25)+")<0.0001","canvas keyboard Zoom must multiply the same viewport",deadlineOverride=imageAliasDeadline)
    val beforeKeyboardOut=imageViewState(scenario).getDouble("scale")
    evaluate(scenario,"document.querySelector('button[aria-label=\"Document tools\"]').focus();true")
    waitForCondition(scenario,"document.activeElement===document.querySelector('button[aria-label=\"Document tools\"]')","global image keys must actually target header chrome",deadlineOverride=imageAliasDeadline)
    taskKey(KeyEvent.KEYCODE_MINUS,KeyEvent.META_CTRL_ON)
    waitForCondition(scenario,"Math.abs(Number(document.querySelector('.image-pane').getAttribute('data-viewport-scale'))-"+(beforeKeyboardOut*0.8)+")<0.0001","header-focused CtrlMinus must use the global image provider",deadlineOverride=imageAliasDeadline)
    taskKey(KeyEvent.KEYCODE_EQUALS,KeyEvent.META_CTRL_ON)
    waitForCondition(scenario,"Math.abs(Number(document.querySelector('.image-pane').getAttribute('data-viewport-scale'))-"+beforeKeyboardOut+")<0.0001","global image CtrlPlus must restore the exact factor",deadlineOverride=imageAliasDeadline)
    evaluate(scenario,"document.querySelector('.image-pane').focus();true")
    waitForCondition(scenario,"document.activeElement===document.querySelector('.image-pane')&&document.querySelector('.image-preview').getBoundingClientRect().width>document.querySelector('.image-pane').getBoundingClientRect().width+1","native Arrow requires focus and an actually overflowing image",deadlineOverride=imageAliasDeadline)
    val beforeArrow=imageViewState(scenario).getDouble("x")
    taskKey(KeyEvent.KEYCODE_DPAD_LEFT)
    waitForCondition(scenario,"Math.abs(Number(document.querySelector('.image-pane').getAttribute('data-viewport-pan-x'))-("+beforeArrow+"+40))<0.0001","native ArrowLeft must apply the existing camera-pan direction exactly once",deadlineOverride=imageAliasDeadline)
    tapNativeControlOnce(scenario,"Zoom out",".image-actions button",deadlineOverride=imageAliasDeadline)
    waitForCondition(scenario,"Math.abs(Number(document.querySelector('.image-pane').getAttribute('data-viewport-scale'))-"+(beforeKeyboardOut*0.8)+")<0.0001","local image Zoom out must invert the actual scale",deadlineOverride=imageAliasDeadline)
    menuAction(scenario,"Zoom out")
    waitForCondition(scenario,"Math.abs(Number(document.querySelector('.image-pane').getAttribute('data-viewport-scale'))-"+(beforeKeyboardOut*0.8*0.8)+")<0.0001","menu image Zoom out must invert the actual scale",deadlineOverride=imageAliasDeadline)
    menuAction(scenario,"Zoom in");menuAction(scenario,"Zoom in")
    val beforeDrag = imageViewState(scenario)
    nativeImageGesture(scenario, false)
    waitForCondition(scenario, "Number(document.querySelector('.image-pane').getAttribute('data-viewport-pan-x'))!==" + beforeDrag.getDouble("x"), "native drag must pan without changing effective scale")
    assertEquals(beforeDrag.getDouble("scale"), imageViewState(scenario).getDouble("scale"), 0.0001)
    val beforePinch = imageViewState(scenario).getDouble("scale")
    nativeImageGesture(scenario, true)
    waitForCondition(scenario, "Number(document.querySelector('.image-pane').getAttribute('data-viewport-scale'))>" + beforePinch, "actual native pinch must zoom the intended image")
    clickControl(scenario, "More image tools")
    clickControl(scenario, "Actual size")
    assertEquals(1.0, imageViewState(scenario).getDouble("scale"), 0.0001)
    val background = imageViewState(scenario).getString("background"); val selection = imageViewState(scenario).getString("selection")
    clickControl(scenario, "Reset view")
    assertEquals("fit", imageViewState(scenario).getString("mode"))
    assertEquals(background, imageViewState(scenario).getString("background")); assertEquals(selection, imageViewState(scenario).getString("selection"))
    clickControl(scenario, "Close Image tools")
    clickControl(scenario,"Fit")
    assertEquals("fit",imageViewState(scenario).getString("mode"))
    menuAction(scenario,"Fit")
    assertEquals("fit",imageViewState(scenario).getString("mode"))
    emitS047Journey(scenario, 6, listOf("svg_supported", "svg_unsupported", "svg_malformed", "svg_external", "svg_cycle", "svg_missing", "svg_resource", "source_read", "local_zoom_fit", "menu_zoom_fit", "keyboard_zoom_fit", "gesture_pan", "reset_state", "animation", "icon_selection", "png_export", "frame_buttons", "background_all", "embedded_metadata"),JSONObject().put("animation",animation))
  }


  private fun verifyS047ShellAliases(scenario: ActivityScenario<MainActivity>) {
    fun discardControlledEmptyDraft() {
      waitForCondition(scenario,"!!document.querySelector('.resolution-dialog')&&!!document.querySelector('.cm-content[contenteditable=true]')","closing a new empty draft must still require its explicit dirty decision")
      assertEquals("only the controlled empty draft may be discarded in this geometry/alias helper","",sourceEditorText(scenario))
      clickControl(scenario,"Discard")
      waitForCondition(scenario,"!document.querySelector('.resolution-dialog')","explicit Discard must complete the controlled empty draft close")
    }
    val skip = "Array.from(document.querySelectorAll('a[href]')).find(n=>n.textContent.trim().startsWith('Skip'))"
    evaluate(scenario, "(" + skip + ").focus();true")
    taskKey(KeyEvent.KEYCODE_ENTER)
    waitForCondition(scenario, "(()=>{const a=" + skip + ";return !!a&&document.activeElement===document.getElementById(a.getAttribute('href').slice(1));})()", "Skip must focus its actual main-content destination")
    clickControl(scenario, "Menu")
    taskKey(KeyEvent.KEYCODE_ESCAPE)
    waitForCondition(scenario, "!document.querySelector('[role=dialog]')&&(document.activeElement.getAttribute('aria-label')==='Menu'||document.activeElement.textContent.trim()==='Menu')", "Escape must close the application menu and restore its opener")
    clickControl(scenario, "Menu")
    val outsideDeadline = SystemClock.elapsedRealtime() + 30_000L
    val outsideScript = """
      (()=>{
        const dialog=document.querySelector('[role=dialog][data-state=open]'),scrim=document.querySelector('.task-surface-scrim[data-state=open]');
        if(!dialog||!scrim)return {found:false};
        const d=dialog.getBoundingClientRect(),s=scrim.getBoundingClientRect(),v=window.visualViewport;
        const x0=v?v.offsetLeft:0,y0=v?v.offsetTop:0,w=v?v.width:innerWidth,h=v?v.height:innerHeight;
        const l=Math.max(s.left,x0),t=Math.max(s.top,y0),r=Math.min(s.right,x0+w),b=Math.min(s.bottom,y0+h);
        const regions=[[l,t,r,Math.min(b,d.top)],[l,Math.max(t,d.bottom),r,b],[l,t,Math.min(r,d.left),b],[Math.max(l,d.right),t,r,b]].filter(a=>a[2]-a[0]>1&&a[3]-a[1]>1).sort((a,b)=>(b[2]-b[0])*(b[3]-b[1])-(a[2]-a[0])*(a[3]-a[1]));
        for(const a of regions){const x=(a[0]+a[2])/2,y=(a[1]+a[3])/2;if(document.elementFromPoint(x,y)!==scrim)continue;
          return {found:true,scrim_hit:true,left:x-x0-0.5,right:x-x0+0.5,top:y-y0-0.5,bottom:y-y0+0.5,x:x-x0,y:y-y0,viewport_width:w,viewport_height:h};}
        return {found:false};
      })()
    """.trimIndent()
    var outsideTarget = JSONObject(); var geometry = JSONObject(); var outsideReady = false
    while(SystemClock.elapsedRealtime() < outsideDeadline) {
      val target = JSONObject(evaluate(scenario,outsideScript,deadlineOverride=outsideDeadline))
      val mapping = nativeControlGeometry(scenario,target)
      if(target.optBoolean("scrim_hit") && mapping.optBoolean("whole_control_visible") && nativeTapForeground(mapping)) {
        SystemClock.sleep(100L)
        outsideTarget = JSONObject(evaluate(scenario,outsideScript,deadlineOverride=outsideDeadline)); geometry = nativeControlGeometry(scenario,outsideTarget)
        if(outsideTarget.optBoolean("scrim_hit") && geometry.optBoolean("whole_control_visible") && nativeTapForeground(geometry) && nativeTapObservationsAgree(target,mapping,outsideTarget,geometry)){ outsideReady=true; break }
      }
      SystemClock.sleep(100L)
    }
    assertTrue("the actual scrim must own one stable native-visible outside dismissal point: " + outsideTarget + ",native=" + geometry,outsideReady)
    dispatchNativeTapOnce(geometry.getDouble("screen_x").toFloat(), geometry.getDouble("screen_y").toFloat(), outsideDeadline)
    println("s047_outside_dismiss=" + JSONObject().put("target",outsideTarget).put("native",geometry)); System.out.flush()
    waitForCondition(scenario, "!document.querySelector('[role=dialog]')", "one actual outside tap must close the application menu",deadlineOverride=outsideDeadline)
    for (i in 1..6) createNewDraftForInput(scenario,"New text file","Untitled.txt")
    val countBefore = stringValue(evaluate(scenario,"document.querySelector('.document-count-trigger').textContent.trim()"))
    clickControl(scenario,countBefore)
    val closeName = stringValue(evaluate(scenario,"document.querySelector('.document-switcher > div:last-child button[aria-label]').getAttribute('aria-label')"))
    clickControl(scenario,closeName,".document-switcher > div:last-child button")
    discardControlledEmptyDraft()
    waitForCondition(scenario,"!document.querySelector('[role=dialog]')&&document.querySelector('.document-count-trigger').textContent.trim()!=="+JSONObject.quote(countBefore),"closing an overflow document must remove exactly that clean draft")
    val density = clientContext.resources.displayMetrics.density
    try {
      // API24 clamps each natural display dimension to twice its initial value.
      // Request a supported portrait override, then rotate the real window to landscape.
      if (Build.VERSION.SDK_INT >= 36) {
        scenario.onActivity { it.requestedOrientation=ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED }
        checkedShell("wm size "+(1024*density).toInt()+"x"+(640*density).toInt())
      } else {
        checkedShell("wm size "+(640*density).toInt()+"x"+(1024*density).toInt())
        scenario.onActivity { it.requestedOrientation=ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
      }
      waitForCondition(scenario,"innerWidth>=768&&innerHeight>=480&&document.querySelector('.tab-button')&&document.querySelector('.tab-button').getBoundingClientRect().width>0","wide actual window must expose the inline document tabs")
      fun selected():String=stringValue(evaluate(scenario,"document.querySelector('.tab-button[aria-selected=true]').id"))
      fun count():Int=evaluate(scenario,"document.querySelectorAll('.tab-button').length+(document.querySelector('.overflow-trigger')?parseInt(document.querySelector('.overflow-trigger').textContent.slice(1),10):0)").toInt()
      evaluate(scenario,"document.querySelector('.tab-button[aria-selected=true]').focus();true")
      taskKey(KeyEvent.KEYCODE_MOVE_HOME)
      waitForCondition(scenario,"document.querySelector('.tab-button[aria-selected=true]')===document.querySelector('.tab-list').firstElementChild","Home must select the actual first document")
      val first=selected()
      taskKey(KeyEvent.KEYCODE_MOVE_END)
      waitForCondition(scenario,"document.querySelector('.tab-button[aria-selected=true]')===document.querySelector('.tab-list').lastElementChild","End must select the actual last document")
      val last=selected();assertTrue(first!=last)
      taskKey(KeyEvent.KEYCODE_TAB,KeyEvent.META_CTRL_ON)
      waitForCondition(scenario,"document.querySelector('.tab-button[aria-selected=true]').id==="+JSONObject.quote(first),"Ctrl+Tab must wrap to the first document")
      taskKey(KeyEvent.KEYCODE_TAB,KeyEvent.META_CTRL_ON or KeyEvent.META_SHIFT_ON)
      waitForCondition(scenario,"document.querySelector('.tab-button[aria-selected=true]').id==="+JSONObject.quote(last),"Ctrl+Shift+Tab must wrap to the last document")
      taskKey(KeyEvent.KEYCODE_DPAD_LEFT);assertTrue(selected()!=last)
      taskKey(KeyEvent.KEYCODE_DPAD_RIGHT);assertEquals(last,selected())
      val previous=stringValue(evaluate(scenario,"document.querySelector('.tab-button[aria-selected=true]').previousElementSibling.id"))
      taskKey(KeyEvent.KEYCODE_DPAD_LEFT,KeyEvent.META_ALT_ON or KeyEvent.META_SHIFT_ON)
      waitForCondition(scenario,"document.querySelector('.tab-button[aria-selected=true]').nextElementSibling.id==="+JSONObject.quote(previous),"Alt+Shift+Left must reorder the actual selected document once")
      taskKey(KeyEvent.KEYCODE_DPAD_RIGHT,KeyEvent.META_ALT_ON or KeyEvent.META_SHIFT_ON)
      assertEquals(last,selected())
      val triggerName=stringValue(evaluate(scenario,"document.querySelector('.overflow-trigger').getAttribute('aria-label')"))
      clickControl(scenario,triggerName)
      val surface=stringValue(evaluate(scenario,"document.querySelector('.document-surface').id"))
      val overflowName=stringValue(evaluate(scenario,"document.querySelector('.overflow-item button:not([aria-label])').textContent.trim()"))
      clickControl(scenario,overflowName,".overflow-item button:not([aria-label])")
      waitForCondition(scenario,"document.querySelector('.document-surface').id!=="+JSONObject.quote(surface),"activating an overflow entry must activate its actual document")
      val closeOverflowTrigger=stringValue(evaluate(scenario,"document.querySelector('.overflow-trigger').getAttribute('aria-label')"))
      clickControl(scenario,closeOverflowTrigger)
      val overflowBefore=count()
      val closeOverflow=stringValue(evaluate(scenario,"document.querySelector('.overflow-item button[aria-label]').getAttribute('aria-label')"))
      clickControl(scenario,closeOverflow,".overflow-item button[aria-label]")
      discardControlledEmptyDraft()
      assertEquals("actual overflow Close must remove one clean document",overflowBefore-1,count())
      openFromAddDocument(scenario,grant(documentUri("recovery-corpus.md")))
      val before=count();val inlineClose=stringValue(evaluate(scenario,"document.querySelector('.tab-close-slot.active button').getAttribute('aria-label')"))
      clickControl(scenario,inlineClose,".tab-close-slot.active button");assertEquals(before-1,count())
      evaluate(scenario,"document.querySelector('.tab-button[aria-selected=true]').focus();true")
      taskKey(KeyEvent.KEYCODE_W,KeyEvent.META_CTRL_ON)
      discardControlledEmptyDraft()
      assertEquals(before-2,count())
    } finally {
      checkedShell("wm size reset")
      scenario.onActivity { it.requestedOrientation=ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
      waitForCondition(scenario,"innerHeight>innerWidth","document keyboard aliases must restore the actual phone window")
    }
  }

  @Test fun s047ColdAddJourney() {
    val scenario = launchS047()
    verifyAddDocumentChoices(scenario)
    createNewDraftForInput(scenario, "New Markdown", "Untitled.md")
    createNewDraftForInput(scenario, "New text file", "Untitled.txt")
    val switcher = stringValue(evaluate(scenario, "document.querySelector('.document-count-trigger').textContent.trim()"))
    clickControl(scenario, switcher)
    clickControl(scenario, "Untitled.md (unsaved)", ".document-switcher button")
    waitForDocumentIdentity(scenario, "Untitled.md")
    val monitor = instrumentation.addMonitor(IntentFilter(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); addDataType("*/*") }, ActivityResult(Activity.RESULT_CANCELED, Intent()), true)
    val retainedDraft = evaluate(scenario, "JSON.stringify({surface:document.querySelector('.document-surface').id,tabs:Array.from(document.querySelectorAll('.tab-button')).map(n=>({id:n.id,text:n.textContent})),source:Array.from(document.querySelectorAll('.cm-content > .cm-line')).map(n=>n.textContent).join('\\n')})")
    try {
      clickControl(scenario, "Add document"); clickControl(scenario, "Open file")
      val deadline = SystemClock.elapsedRealtime() + 15_000L
      while (monitor.hits == 0 && SystemClock.elapsedRealtime() < deadline) SystemClock.sleep(50L)
      assertEquals("cancelled Open must invoke its native chooser once", 1, monitor.hits)
      instrumentation.waitForIdleSync()
      waitForDocumentIdentity(scenario, "Untitled.md")
      waitForCondition(scenario, "!document.querySelector('[aria-label=\"Add document choices\"]')&&!document.querySelector('[role=alert]')", "neutral Open cancellation must return to the current document without a failure")
      assertEquals("neutral Open cancellation must preserve both drafts and the exact current source", retainedDraft, evaluate(scenario, "JSON.stringify({surface:document.querySelector('.document-surface').id,tabs:Array.from(document.querySelectorAll('.tab-button')).map(n=>({id:n.id,text:n.textContent})),source:Array.from(document.querySelectorAll('.cm-content > .cm-line')).map(n=>n.textContent).join('\\n')})"))
    } finally { instrumentation.removeMonitor(monitor) }
    verifyS047ShellAliases(scenario)
    emitS047Journey(scenario, 1, listOf("choices", "close", "outside", "button_back", "shell_keyboard", "tab_activation_close_reorder"))
  }

  @Test fun s047MarkdownJourney() {
    governedMarkdownDeliveryRoutes()
    val scenario = requireNotNull(ownedScenario)
    assertS047Role(scenario)
    openFromAddDocument(scenario, grant(documentUri("recovery-corpus.md")))
    waitForCondition(scenario, "!!document.querySelector('.markdown-document h1')&&!!document.querySelector('.markdown-document table')&&!!document.querySelector('.markdown-document ul')&&!!document.querySelector('.markdown-document code')", "native Open must render the real corpus structure")
    waitForBodyText(scenario, "list item", "code block", "Unicode", "Ω", "🧪")
    emitS047Journey(scenario, 2, listOf("cold_view", "warm_view", "warm_send", "in_app", "corpus", "empty", "malformed"))
  }

  private fun verifyS047ProviderDenial(scenario: ActivityScenario<MainActivity>) {
    createNewDraftForInput(scenario, "New text file", "Untitled.txt")
    val text = "S047_PROVIDER_FAILURE_RETAINED\n"
    replaceEditorText(scenario, text)
    val uri = grant(documentUri("svg-presentation.svg"))
    val before = readBytes(uri)
    resolver.call(FixtureGrantProvider.COMMAND_URI, "arm_read_failure", uri.toString(), android.os.Bundle().apply { putInt("successful_reads", 0) })
    try {
      chooseNative(scenario, Intent.ACTION_OPEN_DOCUMENT, chosen(uri), { clickControl(scenario, "Add document"); clickControl(scenario, "Open file") }, "This file could not be opened. Check access or choose it again.")
      assertEquals("native read failure must retain the existing editable draft", text, editableSourceText(scenario))
    } finally { resolver.call(FixtureGrantProvider.COMMAND_URI, "clear_read_failure", uri.toString(), null) }
    assertTrue("native read failure must not modify source", before.contentEquals(readBytes(uri)))
  }
  @Test fun s047SourceFailureJourney() {
    val scenario = launchS047()
    verifyS047ProviderDenial(scenario)
    emitS047Journey(scenario, 3, listOf("provider_denial"))
  }


  private fun observedAppImeLayer(scenario: ActivityScenario<MainActivity>): JSONObject {
    val windows = instrumentation.uiAutomation.windows
    val root = instrumentation.uiAutomation.rootInActiveWindow
    val activeOwner = windows.firstOrNull { it.id == root?.windowId && it.type == android.view.accessibility.AccessibilityWindowInfo.TYPE_APPLICATION }
    val focusedOwner = activeOwner?.takeIf { it.isFocused } ?: windows.firstOrNull { it.type == android.view.accessibility.AccessibilityWindowInfo.TYPE_APPLICATION && it.isFocused }
    val ownerRoot = if (focusedOwner?.id == root?.windowId) root else focusedOwner?.root
    val ownerBounds = android.graphics.Rect().also { focusedOwner?.getBoundsInScreen(it) }
    val fresh = ownerRoot?.refresh() == true
    val ime = visibleNativeImeBounds(windows).filter { android.graphics.Rect.intersects(it, ownerBounds) }
    val app = nativeHandoffState(scenario, "app_ime_back")
    return JSONObject().put("verified_app_owner", fresh && focusedOwner?.isFocused == true && ownerRoot?.packageName?.toString() == TARGET_PACKAGE &&
      ownerRoot?.isVisibleToUser == true && !ownerBounds.isEmpty && actualAppNativeWindowReady(app))
      .put("owner_package", ownerRoot?.packageName?.toString() ?: JSONObject.NULL).put("active_root_available", root != null)
      .put("owner_window_id", focusedOwner?.id ?: JSONObject.NULL).put("owner_bounds", nativeRectBounds(ownerBounds))
      .put("ime_window_bounds", JSONArray(ime.map { nativeRectBounds(it) })).put("app_window", app)
  }

  private fun dismissObservedAppIme(scenario: ActivityScenario<MainActivity>, deadlineOverride: Long? = null): Boolean {
    val deadline = deadlineOverride ?: (SystemClock.elapsedRealtime() + 30_000L)
    var phase = "native_owner_readiness"
    var observed = JSONObject()
    try {
      enableNativeWindowObservation()
      while (SystemClock.elapsedRealtime() < deadline) {
        observed = observedAppImeLayer(scenario)
        if (observed.optBoolean("verified_app_owner")) break
        SystemClock.sleep(100L)
      }
      assertTrue("an actual focused native app window must own keyboard dismissal within the original action deadline", observed.optBoolean("verified_app_owner") && SystemClock.elapsedRealtime() < deadline)
      if (observed.getJSONArray("ime_window_bounds").length() == 0) return false
      phase = "pre_dispatch"
      val confirmed = observedAppImeLayer(scenario)
      assertTrue("one keyboard Back must retain the same real focused app owner and observed IME immediately before input",
        confirmed.optBoolean("verified_app_owner") && confirmed.optInt("owner_window_id") == observed.optInt("owner_window_id") &&
          confirmed.getJSONArray("ime_window_bounds").length() > 0 && SystemClock.elapsedRealtime() < deadline)
      observed = confirmed
      println("app_ime_back=" + JSONObject().put("phase", phase).put("native_layer", observed)); System.out.flush()
      phase = "one_back"
      instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
      while (SystemClock.elapsedRealtime() < deadline) {
        observed = observedAppImeLayer(scenario)
        if (observed.optBoolean("verified_app_owner") && observed.getJSONArray("ime_window_bounds").length() == 0) return true
        SystemClock.sleep(100L)
      }
      throw AssertionError("one Back must dismiss the actually observed app IME and retain its focused resumed native window within the original action deadline")
    } catch (failure: Throwable) {
      println("app_ime_back_failure=" + JSONObject().put("phase", phase).put("native_layer", observed).put("failure_type", failure.javaClass.simpleName)); System.out.flush()
      throw failure
    }
  }

  @Test fun s047BackJourney() {
    val scenario = launchS047()
    createNewDraftForInput(scenario, "New text file", "Untitled.txt")
    val text = "S047_BACK_DRAFT_RETAINED\n"
    replaceEditorText(scenario, text)
    focusNativeWebView(scenario)
    assertTrue("native editing must expose a real IME layer", dismissObservedAppIme(scenario))
    waitForCondition(scenario, "!!document.querySelector('.cm-content[contenteditable=true]')", "IME Back must retain editor")
    clickControl(scenario, "Menu")
    waitForCondition(scenario, "!!document.querySelector('[role=dialog][data-task-modal=true]')", "phone application menu must be modal")
    val background = JSONObject(evaluate(scenario, "(()=>{const add=document.querySelector('.add-document-trigger');return {disabled:add.disabled,hidden:!!add.closest('[aria-hidden=true],[inert]'),modal:!!document.querySelector('[role=dialog][data-task-modal=true]')};})()"))
    assertTrue("the modal must block background Add", background.getBoolean("disabled") || background.getBoolean("hidden"))
    instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
    waitForCondition(scenario, "!document.querySelector('[role=dialog]')", "one button Back must dismiss one phone layer")
    assertEquals(text, editableSourceText(scenario))
    scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
    waitForCondition(scenario, "innerWidth>innerHeight", "actual landscape must be observed")
    assertEquals(text, editableSourceText(scenario))
    scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
    waitForCondition(scenario, "innerHeight>innerWidth", "actual portrait must be restored")
    val root = grant(documentUri("fixture-root"))
    val destination = grant(requireNotNull(DocumentsContract.createDocument(resolver, root, "text/plain", "s047-back-" + UUID.randomUUID() + ".txt")))
    verifyDirtyCloseAndPendingRace(scenario, destination)
    val variants = mutableListOf("button_back", "modal_background", "rotation_resume", "picker_cancel", "dirty_close")
    val details = JSONObject()
    if (Build.VERSION.SDK_INT >= 34) {
      dismissObservedAppIme(scenario)
      focusNativeWebView(scenario)
      tapNativeControlOnce(scenario, "Menu")
      waitForCondition(scenario, "!!document.querySelector('[role=dialog]')", "a real modal must own predictive Back")
      val before = stringValue(evaluate(scenario, "JSON.stringify({surface:document.querySelector('.document-surface').id,revision:document.querySelector('.document-surface').getAttribute('data-performance-revision'),identity:document.querySelector('[data-draft-identity]')?document.querySelector('[data-draft-identity]').textContent:null})"))
      details.put("predictive_cancel", nativeGestureBack(scenario, true).put("state_unchanged", true))
      val after = stringValue(evaluate(scenario, "JSON.stringify({surface:document.querySelector('.document-surface').id,revision:document.querySelector('.document-surface').getAttribute('data-performance-revision'),identity:document.querySelector('[data-draft-identity]')?document.querySelector('[data-draft-identity]').textContent:null})"))
      assertEquals("predictive cancellation must retain document/draft/layer", before, after)
      assertEquals("true", evaluate(scenario, "!!document.querySelector('[role=dialog]')"))
      details.put("predictive_commit", nativeGestureBack(scenario, false))
      waitForCondition(scenario, "!document.querySelector('[role=dialog]')", "one committed gesture must dismiss only the menu")
      variants.addAll(listOf("predictive_cancel", "predictive_commit"))
    }
    emitS047Journey(scenario, 9, variants, details)
  }


  private fun checkedShell(command: String): String {
    val script = "(" + command + ")\ncode=\$?\nprintf '\\nS047_SHELL_EXIT=%s\\n' \"\$code\"\n"
    // UiAutomation uses Runtime.exec(String), whose argv tokenization does not group shell quotes.
    // Encode only these fixed test-owned setup scripts into one whitespace-free -c argument.
    // Use three-digit octal in the printf FORMAT. API24 printf counts the leading zero in a four-digit %b escape.
    val encoded = script.toByteArray(Charsets.UTF_8).joinToString("") { "\\%03o".format(it.toInt() and 0xff) }
    val output = shellOutput("sh -c eval\${IFS}\"\$(printf\${IFS}'" + encoded + "')\"")
    val code = Regex("(?m)^S047_SHELL_EXIT=([0-9]+)\\s*$").findAll(output).lastOrNull()
    if (code == null || code.groupValues[1] != "0") {
      println("s047_shell_failure=" + JSONObject().put("status_marker_present", code != null).put("output_length", output.length).put("exit_code", code?.groupValues?.get(1)?.toIntOrNull() ?: JSONObject.NULL)); System.out.flush()
    }
    assertTrue("hosted setup must expose a real shell exit status", code != null)
    assertEquals("hosted shell operation must succeed", 0, code!!.groupValues[1].toInt())
    return output.substringBeforeLast("\nS047_SHELL_EXIT=").trim()
  }
  private fun verifyOfflineNotices(scenario: ActivityScenario<MainActivity>): JSONObject {
    assertEquals("offline setup must come from the isolated source-bound hosted controller", "hosted_controller", InstrumentationRegistry.getArguments().getString("offlineSetup"))
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    val settings = listOf("airplane_mode_on", "wifi_on", "mobile_data").associateWith { checkedShell("settings get global " + it) }
    assertTrue("network settings must have recognized reversible states", settings.values.all { it == "0" || it == "1" })
    assertEquals("the hosted controller must disable actual Wi-Fi", "0", settings["wifi_on"])
    assertEquals("the hosted controller must disable actual mobile data", "0", settings["mobile_data"])
    var offline = false
    while (SystemClock.elapsedRealtime() < deadline) {
      val remainingSeconds = maxOf(1L, (deadline - SystemClock.elapsedRealtime()) / 1_000L)
      val dump = checkedShell("dumpsys -t " + minOf(5L, remainingSeconds) + " connectivity")
      assertTrue("complete connectivity observation must retain the original phase deadline", SystemClock.elapsedRealtime() < deadline)
      if (Regex("(?m)^\\s*Active default network:\\s*none\\s*$").containsMatchIn(dump)) { offline = true; break }
      SystemClock.sleep(100L)
    }
    assertTrue("only recognized actual default-network-none state establishes offline", offline)
    clickControl(scenario, "Offline licenses and notices", deadlineOverride = deadline)
    waitForCondition(scenario, "(()=>{const n=document.querySelector('.application-notices');return !!n&&n.textContent.length>10000&&n.textContent.includes('Apache')&&n.textContent.includes('MIT');})()", "complete native notices must work with no actual default network", deadlineOverride = deadline)
    assertTrue("offline notices must complete within the original action budget", SystemClock.elapsedRealtime() < deadline)
    return JSONObject().put("default_network_none", true).put("shell_exit_status", 0).put("offline_setup_authority", "hosted_controller_fixture").put("native_local_notices", true)
  }

  @Test fun s047AboutJourney() {
    shellCommandTransportPreservesFixtureBytesAndExitStatus()
    val scenario = launchS047()
    verifyS047ProviderDenial(scenario)
    menuAction(scenario, "About Glitchpad")
    val source = requireNotNull(InstrumentationRegistry.getArguments().getString("expectedSource"))
    val info = clientContext.packageManager.getPackageInfo(TARGET_PACKAGE, 0)
    waitForBodyText(scenario, requireNotNull(info.versionName), TARGET_PACKAGE, source, "ShruggieTech")
    val displayed = JSONObject(evaluate(scenario, "(()=>{const d=document.querySelector('[data-application-info]');const r={};Array.from(d.querySelectorAll('dt')).forEach(n=>r[n.textContent]=n.nextElementSibling.textContent);return r;})()"))
    val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else { @Suppress("DEPRECATION") info.versionCode.toLong() }
    assertEquals(code.toString(), displayed.getString("Version code"))
    assertEquals(if ((clientContext.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) "debug" else "release", displayed.getString("Channel"))
    assertEquals("android", displayed.getString("Platform"))
    assertEquals(source, displayed.getString("Build"))
    val destinations = listOf("Official documentation" to "https://glitchpad.com/docs", "GitHub repository" to "https://github.com/ShruggieTech/glitchpad", "Report an issue" to "https://github.com/ShruggieTech/glitchpad/issues/new/choose", "ShruggieTech" to "https://shruggie.tech/")
    for ((label, target) in destinations) {
      verifyExternalViewDispatch(scenario, target) { deadline -> clickControl(scenario, label, deadlineOverride = deadline) }
    }
    val offline = verifyOfflineNotices(scenario)
    clickControl(scenario,"Close About Glitchpad")
    menuAction(scenario,"Help and support")
    waitForBodyText(scenario,"Help and support","Official documentation","Report an issue")
    emitS047Journey(scenario, 10, listOf("installed_facts", "explicit_destinations", "offline_notices", "after_failure"), JSONObject().put("offline_notices", offline))
  }


  private fun verifyS047RecoveryDecisions(scenario: ActivityScenario<MainActivity>) {
    val source=editableSourceText(scenario)
    assertTrue(source.contains("S046_ROOT_DRAFT_RETAINED"))
    injectRecoveryFailure(scenario,"root")
    waitForBodyText(scenario,"Glitchpad could not continue","Restart Glitchpad")
    clickControl(scenario,"Restart Glitchpad")
    waitForBodyText(scenario,"Recover Untitled.md?")
    clickControl(scenario,"Not now")
    waitForCondition(scenario,"!document.querySelector('.resolution-dialog')","Not now must dismiss the current recovery decision")
    scenario.onActivity { activity->requireNotNull(findWebView(activity.window.decorView)).reload() }
    waitForBodyText(scenario,"Recover Untitled.md?")
    clickControl(scenario,"Decline recovery")
    waitForCondition(scenario,"!document.querySelector('.resolution-dialog')","Decline must await removal of the controlled recovery candidate")
    scenario.onActivity { activity->requireNotNull(findWebView(activity.window.decorView)).reload() }
    waitForBodyText(scenario,"Add document")
    waitForCondition(scenario,"!!document.querySelector('.app-shell')&&!document.querySelector('.resolution-dialog')","explicitly declined recovery must not reappear on actual reload")
  }

  @Test fun s047FaultJourney() {
    shellCommandTransportPreservesFixtureBytesAndExitStatus()
    assertEquals("fault_probe", expectedBuildVariant())
    val scenario = launchS047()
    var originalUrl: String? = null
    scenario.onActivity { activity ->
      val view = requireNotNull(findWebView(activity.window.decorView))
      val uri = Uri.parse(requireNotNull(view.url)); originalUrl = uri.buildUpon().appendQueryParameter("glitchpad_probe", "module-load").build().toString()
      view.loadUrl(requireNotNull(originalUrl))
    }
    waitForBodyText(scenario, "Glitchpad could not start", "module_load_failed", "Restart Glitchpad")
    assertEquals("true", evaluate(scenario, "!new URL(location.href).searchParams.has('glitchpad_probe')"))
    clickControl(scenario, "Restart Glitchpad")
    waitForBodyText(scenario, "Add document")
    verifyRootFailureRetainsDraft(scenario)
    clickControl(scenario, "Close Diagnostics")
    verifyS047RecoveryDecisions(scenario)
    val corpus = grant(documentUri("recovery-corpus.md"))
    openFromAddDocument(scenario, corpus)
    verifyMarkdownFailures(scenario, corpus)
    val hostSource = grant(documentUri("svg-presentation.svg"))
    val hostSourceBefore = readBytes(hostSource)
    openFromAddDocument(scenario, hostSource)
    waitForDocumentIdentity(scenario, "svg-presentation.svg")
    waitForCondition(scenario, "!!document.querySelector('[data-preview-ready=true]')", "the current SVG must finish actual native delivery before arming its host probe")
    injectRecoveryFailure(scenario, "host")
    waitForCondition(scenario, "!!document.querySelector('[data-preview-failure=host_transport]')", "actual absent native command rejection must reach host fallback")
    clickControl(scenario, "Retry preview")
    waitForCondition(scenario, "!!document.querySelector('[data-preview-ready=true]')", "one-shot host failure must recover through actual native renderer")
    waitForDocumentIdentity(scenario, "svg-presentation.svg")
    assertTrue("host failure and Retry must preserve every original SVG byte", hostSourceBefore.contentEquals(readBytes(hostSource)))
    emitS047Journey(scenario, 3, listOf("worker", "parser", "projection", "root", "bootstrap_import", "host_transport", "source_retained", "draft_recovered", "recovery_decisions"))
    val root = grant(documentUri("fixture-root"))
    val saved = grant(requireNotNull(DocumentsContract.createDocument(resolver, root, "application/json", "s047-fault-diagnostic-" + UUID.randomUUID() + ".json")))
    val refused = grant(requireNotNull(DocumentsContract.createDocument(resolver, root, "application/json", "s046-write-refused-fault-" + UUID.randomUUID() + ".json")))
    verifyDiagnosticTasks(scenario, saved, refused)
    emitS047Journey(scenario, 7, listOf("injected_failure_record", "frozen_redacted", "runtime_facts", "diagnostic_clear"))
  }

  private val moreViewportActions=JSONArray()
  private val journeyReadbacks = mutableMapOf<Int, JSONArray>()
  private val taskControlMeasurements = JSONArray()
  private val clipboardPasteReadbacks = JSONArray()
  private fun isS047Evidence(): Boolean = InstrumentationRegistry.getArguments().getString("s047") == "true"
  private fun expectedBuildVariant(): String = InstrumentationRegistry.getArguments().getString("expectedRole") ?: "fault_probe"
  private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) }
  private fun recordJourneyReadback(journey: Int, kind: String, expected: ByteArray, actual: ByteArray) {
    assertTrue("destination/receiver must match independently expected bytes", expected.contentEquals(actual))
    journeyReadbacks.getOrPut(journey) { JSONArray() }.put(JSONObject().put("kind", kind).put("expected_sha256", sha256(expected)).put("actual_sha256", sha256(actual)).put("verified", true))
  }
  private fun launchS047(): ActivityScenario<MainActivity> = ActivityScenario.launch<MainActivity>(Intent(clientContext, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)).also { ownedScenario = it; waitForBodyText(it, "Add document"); assertS047Role(it) }
  private fun assertS047Role(scenario: ActivityScenario<MainActivity>) {
    val role = expectedBuildVariant()
    assertTrue("only qualified compile roles are accepted", role == "ordinary" || role == "fault_probe")
    waitForCondition(scenario, "document.querySelector('.app-shell')&&document.querySelector('.app-shell').getAttribute('data-build-variant')===" + JSONObject.quote(role), "actual compiled frontend role must match requested package role")
  }
  private fun actualNavigationMode(): String {
    if (Build.VERSION.SDK_INT < 29) return "three_button"
    val id = clientContext.resources.getIdentifier("config_navBarInteractionMode", "integer", "android")
    assertTrue("actual system navigation mode must be observable", id != 0)
    return when (clientContext.resources.getInteger(id)) { 2 -> "gestural"; 0 -> "three_button"; else -> throw AssertionError("unsupported actual navigation mode") }
  }
  private fun clipboardProviderFacts(): JSONObject {
    val manager = clientContext.packageManager
    val authority = clientContext.packageName + ".clipboard"
    val legacy = manager.getProviderInfo(android.content.ComponentName(clientContext.packageName, LegacyClipboardTextProvider::class.java.name), android.content.pm.PackageManager.MATCH_DISABLED_COMPONENTS)
    val fileProvider = manager.getProviderInfo(android.content.ComponentName(clientContext.packageName, "androidx.core.content.FileProvider"), 0)
    val expectedEnabled = Build.VERSION.SDK_INT < 28
    val resolvable = manager.resolveContentProvider(authority, 0) != null
    assertEquals("the installed clipboard provider must retain its exact authority", authority, legacy.authority)
    assertTrue("only the dedicated copied-text provider is declared public", legacy.exported)
    assertFalse("the legacy token provider does not issue URI grants", legacy.grantUriPermissions)
    assertEquals("the installed resource must disable the legacy provider on modern Android", expectedEnabled, legacy.enabled)
    assertEquals("the clipboard provider must be resolvable only on its legacy SDK range", expectedEnabled, resolvable)
    assertFalse("the general FileProvider must remain private", fileProvider.exported)
    assertTrue("modern FileProvider must retain explicit URI grants", fileProvider.grantUriPermissions)
    return JSONObject().put("legacy_authority", legacy.authority).put("legacy_declared_exported", legacy.exported)
      .put("legacy_enabled", legacy.enabled).put("legacy_resolvable", resolvable).put("legacy_grant_uri_permissions", legacy.grantUriPermissions)
      .put("file_provider_private", !fileProvider.exported && fileProvider.grantUriPermissions)
  }

  private fun candidateIdentity(scenario: ActivityScenario<MainActivity>): JSONObject {
    val source = requireNotNull(InstrumentationRegistry.getArguments().getString("expectedSource"))
    waitForCondition(scenario, "(()=>{const n=document.querySelector('.app-shell');return !!n&&n.getAttribute('data-native-source-commit')===" + JSONObject.quote(source) + "&&n.getAttribute('data-frontend-source-commit')===" + JSONObject.quote(source) + ";})()", "independent native/frontend compiled source facts must agree with actual selected checkout")
    val facts = JSONObject(evaluate(scenario, "(()=>{const n=document.querySelector('.app-shell');return {role:n.getAttribute('data-build-variant'),native:n.getAttribute('data-native-source-commit'),frontend:n.getAttribute('data-frontend-source-commit')};})()"))
    assertEquals(expectedBuildVariant(), facts.getString("role"))
    val app = clientContext.packageManager.getPackageInfo(TARGET_PACKAGE, 0)
    val test = instrumentation.context.packageManager.getApplicationInfo(instrumentation.context.packageName, 0)
    val webview = requireNotNull(WebViewCompat.getCurrentWebViewPackage(clientContext)) { "actual WebView package/version is required" }
    return JSONObject().put("source_commit", source).put("native_source_commit", facts.getString("native")).put("frontend_source_commit", facts.getString("frontend"))
      .put("application_sha256", apkSha256()).put("instrumentation_sha256", sha256(File(test.sourceDir).readBytes()))
      .put("package_identifier", TARGET_PACKAGE).put("instrumentation_package", instrumentation.context.packageName).put("clipboard_provider", clipboardProviderFacts())
      .put("version", app.versionName).put("version_code", if (Build.VERSION.SDK_INT >= 28) app.longVersionCode else { @Suppress("DEPRECATION") app.versionCode.toLong() }).put("channel", if ((clientContext.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) "debug" else "release")
      .put("build_variant", facts.getString("role")).put("api_level", Build.VERSION.SDK_INT).put("android_version", Build.VERSION.RELEASE)
      .put("webview_package", webview.packageName).put("webview_version", webview.versionName)
  }
  private fun emitS047Journey(scenario: ActivityScenario<MainActivity>, journey: Int, variants: List<String>, details: JSONObject = JSONObject()) {
    assertS047Role(scenario)
    val identity = candidateIdentity(scenario)
    enableNativeWindowObservation()
    val native = nativeControlGeometry(scenario, null)
    val css = JSONObject(evaluate(scenario, "({width:innerWidth,height:innerHeight})"))
    val profile = JSONObject().put("css_width", css.getInt("width")).put("css_height", css.getInt("height"))
      .put("native_visible", native.getJSONObject("effective_visible_screen")).put("font_scale", clientContext.resources.configuration.fontScale).put("navigation_mode", actualNavigationMode())
    assertTrue("each journey must capture its actual screenshot", saveScreenshot("s047-row-" + journey + ".png"))
    val items = JSONArray(variants.map { JSONObject().put("id", it).put("status", "pass").put("observed", true).put("details", details.optJSONObject(it) ?: JSONObject()) })
    if(journey==6||journey==8)details.put("more_viewport_actions",moreViewportActions)
    val receipt = JSONObject().put("journey", journey).put("status", "pass").put("identity", identity).put("profile", profile).put("variants", items).put("readbacks", journeyReadbacks[journey] ?: JSONArray()).put("observations", details).toString().toByteArray(Charsets.UTF_8)
    val name = "s047-row-" + journey + ".json"
    clientContext.openFileOutput(name, 0).use { it.write(receipt) }
    val marker = "s047_journey_evidence=" + JSONObject().put("journey", journey).put("file", name).put("sha256", sha256(receipt))
    println(marker); System.out.flush()
    // Send a progress record through the instrumentation stream; logcat may rotate before the method finishes.
    instrumentation.sendStatus(2, android.os.Bundle().apply { putString(android.app.Instrumentation.REPORT_KEY_STREAMRESULT, marker + "\n") })
  }
  private fun nativeBackObservation(scenario: ActivityScenario<MainActivity>): JSONObject {
    var result: JSONObject? = null
    scenario.onActivity {
      val field = app.tauri.plugin.PluginManager::class.java.getDeclaredField("plugins").apply { isAccessible = true }
      val plugins = (field.get(app.tauri.plugin.PluginManager) as Map<*, *>).values.filterIsInstance<app.tauri.plugin.PluginHandle>().map { it.instance }.filterIsInstance<AndroidSourcePlugin>()
      assertEquals("one actual source plugin must own Back", 1, plugins.size)
      val method = AndroidSourcePlugin::class.java.getDeclaredMethod("backRouteSnapshot").apply { isAccessible = true }
      result = JSONObject(requireNotNull(method.invoke(plugins.single())).toString())
    }
    return requireNotNull(result)
  }
  private fun deltaBack(before: JSONObject, after: JSONObject): JSONObject = JSONObject().also { result ->
    for (name in listOf("started", "progressed", "cancelled", "committed", "requested", "completed", "delegated")) result.put(name, after.getInt(name) - before.getInt(name))
  }
  private fun nativeBackBinding(scenario: ActivityScenario<MainActivity>): JSONObject {
    val result = JSONObject().put("diagnostic_only", true)
    scenario.onActivity { activity ->
      val dispatcher = activity.onBackPressedDispatcher
      result.put("dispatcher_class", dispatcher.javaClass.name)
      runCatching {
        val callbacks = dispatcher.javaClass.getDeclaredField("onBackPressedCallbacks").apply { isAccessible = true }.get(dispatcher) as Iterable<*>
        result.put("callbacks", JSONArray(callbacks.filterIsInstance<androidx.activity.OnBackPressedCallback>().map { JSONObject().put("class", it.javaClass.name).put("enabled", it.isEnabled) }))
      }.onFailure { result.put("callbacks_unavailable", it.javaClass.simpleName) }
      if (Build.VERSION.SDK_INT >= 34) runCatching {
        val platform = activity.onBackInvokedDispatcher
        val top = platform.javaClass.getDeclaredMethod("getTopCallback").apply { isAccessible = true }.invoke(platform)
        result.put("platform_dispatcher_class", platform.javaClass.name).put("platform_top_callback_class", top?.javaClass?.name ?: JSONObject.NULL)
      }.onFailure { result.put("platform_callback_unavailable", it.javaClass.simpleName) }
    }
    result.put("window", nativeControlGeometry(scenario, null))
    return result
  }
  private fun nativeGestureBack(scenario: ActivityScenario<MainActivity>, cancel: Boolean): JSONObject {
    assertTrue("actual predictive gestures require API34+", Build.VERSION.SDK_INT >= 34)
    assertEquals("gestural", actualNavigationMode())
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    enableNativeWindowObservation()
    assertTrue("predictive app callback test must begin without an IME owner", visibleNativeImeBounds().isEmpty())
    val before = nativeBackObservation(scenario)
    assertTrue(before.getBoolean("enabled") && !before.getBoolean("pending"))
    var startX = 0f; var y = 0f; var endX = 0f
    scenario.onActivity { activity ->
      val view = requireNotNull(findWebView(activity.window.decorView))
      val insets = requireNotNull(androidx.core.view.ViewCompat.getRootWindowInsets(view)).getInsets(androidx.core.view.WindowInsetsCompat.Type.systemGestures())
      val bounds = android.graphics.Rect(); view.getWindowVisibleDisplayFrame(bounds)
      assertTrue("the real system gesture edge must exist", insets.left > 0)
      startX = maxOf(1, insets.left / 2).toFloat(); y = bounds.exactCenterY(); endX = bounds.left + bounds.width() * 0.6f
      assertTrue("the actual app window must own the gesture", activity.hasWindowFocus() && view.hasWindowFocus() && bounds.width() > 0)
    }
    val owner = instrumentation.uiAutomation.rootInActiveWindow
    assertEquals("gesture input must begin with the actual app owner", TARGET_PACKAGE, owner?.packageName?.toString())
    println("s047_predictive_binding=" + nativeBackBinding(scenario)); System.out.flush()
    val inputTiming = JSONArray()
    val downTime = SystemClock.uptimeMillis()
    var terminalRequested = false
    var completedGesture = false
    fun gestureEvent(action: Int, x: Float): MotionEvent {
      val pointer = MotionEvent.PointerProperties().apply { id = 0; toolType = MotionEvent.TOOL_TYPE_FINGER }
      val coordinates = MotionEvent.PointerCoords()
      coordinates.x = x; coordinates.y = y
      coordinates.pressure = if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) 0f else 1f
      coordinates.size = 0.05f
      return MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), action, 1, arrayOf(pointer), arrayOf(coordinates), 0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0)
    }
    fun input(action: Int, x: Float) {
      assertTrue("one gesture must remain inside the original action deadline", SystemClock.elapsedRealtime() < deadline)
      if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) terminalRequested = true
      val event = gestureEvent(action, x)
      val eventElapsed = event.eventTime - downTime
      val injectedAt = SystemClock.uptimeMillis()
      try {
        // Accessibility snapshots and synchronous transaction waits distort an edge stream. Observe ownership before DOWN and real callback counters after MOVE.
        assertTrue("the actual system must accept each single gesture event", instrumentation.uiAutomation.injectInputEvent(event, false))
      } finally {
        inputTiming.put(JSONObject().put("action", action).put("elapsed_ms", eventElapsed).put("inject_ms", SystemClock.uptimeMillis() - injectedAt))
        event.recycle()
      }
    }
    try {
    input(MotionEvent.ACTION_DOWN, startX)
    for (step in 1..12) {
      SystemClock.sleep(32L)
      input(MotionEvent.ACTION_MOVE, startX + (endX - startX) * step / 12f)
    }
    var progressed = false
    var last = before
    while (SystemClock.elapsedRealtime() < deadline) {
      val state = nativeBackObservation(scenario)
      last = state
      if (state.getInt("started") > before.getInt("started") && state.getInt("progressed") > before.getInt("progressed")) { progressed = true; break }
      SystemClock.sleep(100L)
      if (SystemClock.elapsedRealtime() < deadline) input(MotionEvent.ACTION_MOVE, endX)
    }
    if (!progressed) {
      throw AssertionError("real system gesture never produced start/progress callbacks: " + JSONObject().put("before", before).put("after", last).put("delta", deltaBack(before, last)).put("start_x", startX).put("end_x", endX).put("y", y))
    }
    if (cancel) for (step in 1..6) {
      SystemClock.sleep(32L)
      input(MotionEvent.ACTION_MOVE, endX + (startX - endX) * step / 6f)
    }
    SystemClock.sleep(32L)
    input(MotionEvent.ACTION_UP, if (cancel) startX else endX)
    var after = nativeBackObservation(scenario)
    while (SystemClock.elapsedRealtime() < deadline) {
      after = nativeBackObservation(scenario)
      if (cancel && after.getInt("cancelled") > before.getInt("cancelled")) break
      if (!cancel && after.getInt("completed") > before.getInt("completed")) break
      SystemClock.sleep(100L)
    }
    val delta = deltaBack(before, after)
    assertEquals(1, delta.getInt("started")); assertTrue(delta.getInt("progressed") > 0)
    assertEquals(if (cancel) 1 else 0, delta.getInt("cancelled"))
    for (key in listOf("committed", "requested", "completed")) assertEquals("one commit must traverse one existing callback/request/reply", if (cancel) 0 else 1, delta.getInt(key))
    assertEquals("a handled modal must not delegate another Back", 0, delta.getInt("delegated"))
    println("s047_predictive_back=" + JSONObject().put("cancel", cancel).put("delta", delta)); System.out.flush()
    completedGesture = true
    return delta
    } finally {
      if (!terminalRequested) {
        val event = gestureEvent(MotionEvent.ACTION_CANCEL, startX)
        try { runCatching { instrumentation.uiAutomation.injectInputEvent(event, false) } } finally { event.recycle() }
      }
      val timingSummary = JSONObject().put("diagnostic_only", true).put("event_count", inputTiming.length())
        .put("max_inject_ms", (0 until inputTiming.length()).maxOfOrNull { inputTiming.getJSONObject(it).getLong("inject_ms") } ?: 0L)
        .put("first", JSONArray((0 until minOf(16, inputTiming.length())).map { inputTiming.getJSONObject(it) }))
        .put("last", JSONArray((maxOf(16, inputTiming.length() - 4) until inputTiming.length()).map { inputTiming.getJSONObject(it) }))
      println("s047_predictive_input_timing=" + timingSummary); System.out.flush()
      if (!completedGesture) {
        val systemUi = runCatching { checkedShell("dumpsys -t 3 activity service com.android.systemui/.SystemUIService TaskbarDelegate") }.getOrElse { "capture_unavailable:" + it.javaClass.simpleName }
        println("s047_predictive_system_ui=" + JSONObject().put("diagnostic_only", true).put("text", systemUi.take(65536))); System.out.flush()
      }
    }
  }

  private fun visibleNativeImeBounds(
    windows: List<android.view.accessibility.AccessibilityWindowInfo> = instrumentation.uiAutomation.windows
  ): List<android.graphics.Rect> = windows
    .filter { it.type == android.view.accessibility.AccessibilityWindowInfo.TYPE_INPUT_METHOD }.take(4)
    .map { android.graphics.Rect().also { bounds -> it.getBoundsInScreen(bounds) } }.filter { !it.isEmpty }

  private data class NativeTouchWindow(
    val id: Int, val layer: Int, val type: Int, val title: String?, val region: android.graphics.Region
  )

  private fun nativeTouchWindows(windows: List<android.view.accessibility.AccessibilityWindowInfo>): List<NativeTouchWindow> {
    if (Build.VERSION.SDK_INT < 30) return emptyList()
    return windows.map { window ->
      val region = android.graphics.Region()
      window.getRegionInScreen(region)
      NativeTouchWindow(window.id, window.layer, window.type, window.title?.toString()?.take(80), region)
    }
  }

  private fun nativeRectBounds(rect: android.graphics.Rect): JSONObject = JSONObject()
    .put("left", rect.left).put("top", rect.top).put("right", rect.right).put("bottom", rect.bottom)

  private fun nativeControlGeometry(scenario: ActivityScenario<MainActivity>, target: JSONObject?): JSONObject {
    enableNativeWindowObservation()
    val observed = JSONObject().put("scenario_state", scenario.state.name)
    val windows = instrumentation.uiAutomation.windows
    val imeWindows = visibleNativeImeBounds(windows)
    val touchWindows = nativeTouchWindows(windows)
    observed.put("native_touch_region_observed", Build.VERSION.SDK_INT >= 30)
    scenario.onActivity { activity ->
      val view = requireNotNull(findWebView(activity.window.decorView))
      val location = IntArray(2)
      view.getLocationOnScreen(location)
      val local = android.graphics.Rect()
      val locallyVisible = view.getLocalVisibleRect(local)
      val localOnScreen = android.graphics.Rect(local).apply { offset(location[0] - view.scrollX, location[1] - view.scrollY) }
      val window = android.graphics.Rect()
      view.getWindowVisibleDisplayFrame(window)
      val visible = android.graphics.Rect(location[0], location[1], location[0] + view.width, location[1] + view.height)
      if (!locallyVisible || !visible.intersect(localOnScreen) || !visible.intersect(window)) visible.setEmpty()
      val insets = androidx.core.view.ViewCompat.getRootWindowInsets(view)
      val imeBottom = insets?.getInsets(androidx.core.view.WindowInsetsCompat.Type.ime())?.bottom ?: 0
      val barsBottom = insets?.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemBars())?.bottom ?: 0
      val input = activity.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
      observed.put("activity_window_focus", activity.hasWindowFocus()).put("webview_window_focus", view.hasWindowFocus()).put("shown", view.isShown)
        .put("view_left", location[0]).put("view_top", location[1]).put("view_width", view.width).put("view_height", view.height).put("density", view.resources.displayMetrics.density)
        .put("view_scroll_x", view.scrollX).put("view_scroll_y", view.scrollY)
        .put("local_visible_screen", nativeRectBounds(localOnScreen)).put("window_visible_frame", nativeRectBounds(window)).put("effective_visible_screen", nativeRectBounds(visible))
        .put("ime_reported_visible", insets?.isVisible(androidx.core.view.WindowInsetsCompat.Type.ime()) == true)
        .put("ime_bottom", imeBottom).put("system_bars_bottom", barsBottom).put("input_method_active", input.isActive(view))
        .put("ime_window_bounds", JSONArray(imeWindows.map { nativeRectBounds(it) }))
        .put("tappable_element_bottom", insets?.getInsets(androidx.core.view.WindowInsetsCompat.Type.tappableElement())?.bottom ?: 0)
        .put("system_gesture_bottom", insets?.getInsets(androidx.core.view.WindowInsetsCompat.Type.systemGestures())?.bottom ?: 0)
        .put("mandatory_system_gesture_bottom", insets?.getInsets(androidx.core.view.WindowInsetsCompat.Type.mandatorySystemGestures())?.bottom ?: 0)
      if (target?.optBoolean("found") == true && target.optDouble("viewport_width") > 0) {
        // CSS coordinates use one physical scale, including when only height is occluded.
        val scale = view.width / target.getDouble("viewport_width")
        val left = location[0] + target.getDouble("left") * scale
        val top = location[1] + target.getDouble("top") * scale
        val right = location[0] + target.getDouble("right") * scale
        val bottom = location[1] + target.getDouble("bottom") * scale
        val screenX = location[0] + target.getDouble("x") * scale
        val screenY = location[1] + target.getDouble("y") * scale
        val tolerance = 0.6 * scale
        if (Build.VERSION.SDK_INT >= 30) {
          // setSource reads this attached native View's window identity without requesting a WebView accessibility tree.
          val appWindowId = android.view.accessibility.AccessibilityNodeInfo().apply { setSource(view) }.windowId
          val owner = touchWindows.filter { it.region.contains(screenX.toInt(), screenY.toInt()) }.maxByOrNull { it.layer }
          val owned = appWindowId != -1 && owner?.id == appWindowId
          observed.put("app_window_id", appWindowId).put("native_touch_owned_by_app", owned)
            .put("native_touch_owner", owner?.let { JSONObject().put("window_id", it.id).put("layer", it.layer).put("type", it.type).put("title", it.title).put("region_bounds", nativeRectBounds(it.region.bounds)).put("matches_app_window", owned) } ?: JSONObject.NULL)
        }
        val imeWindowCovers = imeWindows.any { it.left < right - tolerance && it.right > left + tolerance && it.top < bottom - tolerance && it.bottom > top + tolerance }
        val wholeVisible = !visible.isEmpty && !imeWindowCovers && left >= visible.left - tolerance && top >= visible.top - tolerance &&
          right <= visible.right + tolerance && bottom <= visible.bottom + tolerance &&
          screenX >= visible.left && screenX < visible.right && screenY >= visible.top && screenY < visible.bottom
        val bottomOccluded = bottom > window.bottom + tolerance
        val nonBarBottomGap = location[1] + view.height - window.bottom - barsBottom
        val imeOccludes = imeWindowCovers || (bottomOccluded && (imeBottom > 0 || observed.getBoolean("ime_reported_visible") ||
          (input.isActive(view) && nonBarBottomGap > tolerance)))
        observed.put("css_to_native_scale", scale).put("screen_x", screenX).put("screen_y", screenY)
          .put("control_left", left).put("control_top", top).put("control_right", right).put("control_bottom", bottom)
          .put("whole_control_visible", wholeVisible).put("ime_occludes_control", imeOccludes)
      }
    }
    return observed
  }

  private fun nativeTapObservationsAgree(before: JSONObject, beforeNative: JSONObject, after: JSONObject, afterNative: JSONObject): Boolean {
    val cssKeys = listOf("x", "y", "left", "top", "right", "bottom", "viewport_width", "viewport_height")
    val nativeKeys = listOf("view_left", "view_top", "view_width", "view_height", "screen_x", "screen_y")
    fun close(a: JSONObject, b: JSONObject, keys: List<String>): Boolean = keys.all { key ->
      a.has(key) && b.has(key) && a.optDouble(key).isFinite() && b.optDouble(key).isFinite() && kotlin.math.abs(a.getDouble(key) - b.getDouble(key)) <= 0.6
    }
    return before.optBoolean("found") && after.optBoolean("found") && close(before, after, cssKeys) && close(beforeNative, afterNative, nativeKeys) &&
      before.optString("surface_id") == after.optString("surface_id") && before.optString("editor_label") == after.optString("editor_label") &&
      beforeNative.optBoolean("native_touch_owned_by_app", true) && afterNative.optBoolean("native_touch_owned_by_app", true)
  }

  private fun nativeTapForeground(mapping: JSONObject): Boolean = mapping.optString("scenario_state") == Lifecycle.State.RESUMED.name &&
    mapping.optBoolean("activity_window_focus") && mapping.optBoolean("webview_window_focus") && mapping.optBoolean("shown")

  private fun dispatchNativeTapOnce(
    screenX: Float, screenY: Float, deadline: Long,
    inject: (MotionEvent) -> Boolean = { event -> instrumentation.sendPointerSync(event); true }
  ) {
    val press = android.view.ViewConfiguration.getTapTimeout() / 2L
    val settle = android.view.ViewConfiguration.getTapTimeout() * 3L / 2L
    assertTrue("a single native tap and its processing must fit the original action deadline", SystemClock.elapsedRealtime() + press + settle < deadline)
    val downTime = SystemClock.uptimeMillis()
    val pointer = MotionEvent.PointerProperties().apply { id = 0; toolType = MotionEvent.TOOL_TYPE_FINGER }
    var downRequested = false
    var upCompleted = false
    var upTime = downTime
    fun event(action: Int): MotionEvent {
      val coordinates = MotionEvent.PointerCoords().apply { x = screenX; y = screenY; pressure = if (action == MotionEvent.ACTION_DOWN) 1f else 0f; size = 1f }
      return MotionEvent.obtain(downTime, SystemClock.uptimeMillis(), action, 1, arrayOf(pointer), arrayOf(coordinates), 0, 0, 1f, 1f, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0)
    }
    try {
      val down = event(MotionEvent.ACTION_DOWN)
      downRequested = true
      try { assertTrue("the sole native DOWN must be accepted", inject(down)) } finally { down.recycle() }
      // Match AndroidX sendDown: keep the sole press long enough to become a tap.
      val untilRelease = downTime + press - SystemClock.uptimeMillis()
      if (untilRelease > 0) SystemClock.sleep(untilRelease)
      assertTrue("the sole native release must begin inside the original action deadline", SystemClock.elapsedRealtime() < deadline)
      assertTrue("an overslept native tap must not silently become a long press", SystemClock.uptimeMillis() < downTime + android.view.ViewConfiguration.getLongPressTimeout())
      // Create UP after the physical press interval, preserving monotonic chronology.
      val up = event(MotionEvent.ACTION_UP)
      upTime = up.eventTime
      try { assertTrue("the sole native UP must be accepted", inject(up)); upCompleted = true } finally { up.recycle() }
    } finally {
      if (downRequested && !upCompleted) {
        val cancel = event(MotionEvent.ACTION_CANCEL)
        try { runCatching { inject(cancel) } } finally { cancel.recycle() }
      }
    }
    // AndroidX SINGLE also allows 1.5 tap timeouts for main-thread processing after the gesture.
    val remaining = deadline - SystemClock.elapsedRealtime()
    assertTrue("native tap processing must retain its original action deadline", remaining >= settle)
    SystemClock.sleep(settle)
    println("native_tap_event_pair=" + JSONObject().put("screen_x", screenX).put("screen_y", screenY).put("down_time", downTime).put("up_time", upTime).put("tool_type", "finger").put("event_count", 2))
    System.out.flush()
  }

  private fun tapNativeControlOnce(scenario: ActivityScenario<MainActivity>, name: String, selector: String = "button", deadlineOverride: Long? = null) {
    val deadline = deadlineOverride ?: (SystemClock.elapsedRealtime() + 30_000L)
    val script = """
      (()=>{
        const button=Array.from(document.querySelectorAll(SELECTOR)).find(b=>!b.disabled&&b.getBoundingClientRect().width>0&&!b.closest('[aria-hidden=true],[inert]')&&(()=>{const label=(b.getAttribute('aria-label')||(b.labels&&b.labels.length?Array.from(b.labels).map(n=>n.textContent).join(' '):(b.getAttribute('role')==='menuitem'&&b.querySelector('span')?b.querySelector('span').textContent:b.textContent))).trim();return SELECTOR==='button'?label===NAME:label.startsWith(NAME);})());
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
        return {found:true,x:clientX-left,y:clientY-top,left:rect.left-left,top:rect.top-top,right:rect.right-left,bottom:rect.bottom-top,
          viewport_width:width,viewport_height:height,width:rect.width,height:rect.height,
          fully_visible:rect.left>=left-0.6&&rect.right<=left+width+0.6&&rect.top>=top-0.6&&rect.bottom<=top+height+0.6,
          hit:hit===button||button.contains(hit),disabled:button.disabled};
      })()
    """.trimIndent().replace("NAME", JSONObject.quote(name)).replace("SELECTOR", JSONObject.quote(selector))
    var target = JSONObject()
    var mapping = JSONObject()
    var phase = "readiness"
    var imeDismissRequested = false
    var imeDismissAccepted: Boolean? = null
    try {
      enableNativeWindowObservation()
      var ready = false
      while (SystemClock.elapsedRealtime() < deadline) {
        target = runCatching { JSONObject(evaluate(scenario, script, deadlineOverride = deadline)) }
          .getOrElse { JSONObject().put("capture_failed", true).put("failure_type", it.javaClass.simpleName) }
        mapping = nativeControlGeometry(scenario, target)
        val foreground = nativeTapForeground(mapping)
        if (foreground && mapping.optBoolean("ime_occludes_control") && !imeDismissRequested) {
          imeDismissRequested = true
          phase = "ime_dismiss"
          scenario.onActivity { activity ->
            val view = requireNotNull(findWebView(activity.window.decorView))
            val input = activity.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
            imeDismissAccepted = input.hideSoftInputFromWindow(view.windowToken, 0)
          }
        } else if (foreground && target.optBoolean("found") && target.optDouble("width") > 0 && target.optDouble("height") > 0 &&
          target.optBoolean("fully_visible") && target.optBoolean("hit") && !target.optBoolean("disabled") && mapping.optBoolean("whole_control_visible")) {
          // Sample after a real frame interval so a moving IME/task cannot pass two immediate reads.
          SystemClock.sleep(100L)
          val confirmed = JSONObject(evaluate(scenario, script.replace("button.scrollIntoView({block:'nearest',inline:'nearest'});", ""), deadlineOverride = deadline))
          val confirmedMapping = nativeControlGeometry(scenario, confirmed)
          if (nativeTapObservationsAgree(target, mapping, confirmed, confirmedMapping) && nativeTapForeground(confirmedMapping) &&
            confirmed.optBoolean("fully_visible") && confirmed.optBoolean("hit") && !confirmed.optBoolean("disabled") && confirmedMapping.optBoolean("whole_control_visible")) {
            target = confirmed
            mapping = confirmedMapping
            ready = true
            break
          }
        }
        phase = "readiness"
        SystemClock.sleep(100L)
      }
      assertTrue("the native control must be enabled and whole inside the actual visible app window before a single tap", ready)
      if (deadlineOverride != null) assertTrue("native control activation must retain the original action deadline", SystemClock.elapsedRealtime() < deadlineOverride)
      phase = "tap"
      dispatchNativeTapOnce(mapping.getDouble("screen_x").toFloat(), mapping.getDouble("screen_y").toFloat(), deadline)
      println("native_control_activation=" + JSONObject().put("control", name).put("phase", "event_pair_dispatched")
        .put("target", target).put("mapping", mapping).put("ime_dismiss_requested", imeDismissRequested)
        .put("ime_dismiss_accepted", imeDismissAccepted ?: JSONObject.NULL))
      System.out.flush()
    } catch (failure: Throwable) {
      val window = runCatching { nativeHandoffState(scenario, name) }.getOrElse { JSONObject().put("capture_failed", true) }
      val after = runCatching { nativeControlGeometry(scenario, target) }.getOrElse { JSONObject().put("capture_failed", true) }
      println("native_control_activation_failure=" + JSONObject().put("control", name).put("phase", phase).put("failure_type", failure.javaClass.simpleName)
        .put("target", target).put("mapping", mapping).put("native_window", window).put("native_geometry_after", after).put("ime_dismiss_requested", imeDismissRequested)
        .put("ime_dismiss_accepted", imeDismissAccepted ?: JSONObject.NULL))
      System.out.flush()
      throw failure
    }
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

  private fun actualAppNativeWindowReady(observed: JSONObject): Boolean =
    observed.optString("scenario_state") == androidx.lifecycle.Lifecycle.State.RESUMED.name &&
      observed.optBoolean("activity_window_focus") && observed.optBoolean("webview_window_focus") && observed.optBoolean("webview_shown") &&
      observed.optInt("webview_width") > 0 && observed.optInt("webview_height") > 0

  private fun waitForAppNativeWindow(
    scenario: ActivityScenario<MainActivity>, control: String, pickerPackage: String? = null, returnDeadlineElapsedMs: Long? = null
  ) {
    val deadline = returnDeadlineElapsedMs ?: (SystemClock.elapsedRealtime() + 30_000L)
    var observed = JSONObject()
    while (SystemClock.elapsedRealtime() < deadline) {
      observed = nativeHandoffState(scenario, control, pickerPackage)
      if (actualAppNativeWindowReady(observed)) return
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

  private fun focusNativeWebView(scenario: ActivityScenario<MainActivity>, deadlineOverride: Long? = null): JSONObject {
    scenario.onActivity { activity -> requireNotNull(findWebView(activity.window.decorView)).requestFocus() }
    instrumentation.waitForIdleSync()
    val deadline = minOf(SystemClock.elapsedRealtime() + 10_000L, deadlineOverride ?: Long.MAX_VALUE)
    var latest = JSONObject()
    while (SystemClock.elapsedRealtime() < deadline) {
      scenario.onActivity { activity ->
        val view = requireNotNull(findWebView(activity.window.decorView))
        latest = JSONObject().put("activity_window_focus", activity.hasWindowFocus()).put("webview_focus", view.hasFocus()).put("webview_window_focus", view.hasWindowFocus()).put("webview_shown", view.isShown)
      }
      if (latest.getBoolean("activity_window_focus") && latest.getBoolean("webview_focus") && latest.getBoolean("webview_window_focus") && latest.getBoolean("webview_shown")) return latest
      SystemClock.sleep(100L)
    }
    val focusedRoot = instrumentation.uiAutomation.rootInActiveWindow
    latest.put("power_interactive", (clientContext.getSystemService(android.content.Context.POWER_SERVICE) as android.os.PowerManager).isInteractive)
      .put("keyguard_locked", (clientContext.getSystemService(android.content.Context.KEYGUARD_SERVICE) as android.app.KeyguardManager).isKeyguardLocked)
      .put("native_owner_is_target", focusedRoot?.packageName?.toString() == TARGET_PACKAGE)
      .put("native_owner_window_id", focusedRoot?.windowId ?: JSONObject.NULL)
      .put("native_owner_class", focusedRoot?.className?.toString()?.take(80) ?: JSONObject.NULL)
    throw AssertionError("the actual app WebView must own native input focus before input: " + latest)
  }

  private fun replaceEditorText(scenario: ActivityScenario<MainActivity>, text: String) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    waitForCondition(scenario, "!!document.querySelector('.cm-content[contenteditable=true]')", "draft must expose the actual editable surface", deadlineOverride = deadline)
    val nativeFocus = focusNativeWebView(scenario, deadlineOverride = deadline)
    if (InstrumentationRegistry.getArguments().getString("s047InputTrace") == "true") {
      evaluate(scenario, """
        (()=>{
          if(window.__s047EditorEvents)return true;
          const rows=window.__s047EditorEvents=[];
          const node=n=>n?{tag:n.nodeName,class_name:String(n.className).slice(0,96),label:n.getAttribute?(n.getAttribute('aria-label')||'').slice(0,128):null}:null;
          for(const type of ['touchstart','touchend','touchcancel','pointerdown','pointerup','pointercancel','mousedown','mouseup','click','focusin','focusout'])
            document.addEventListener(type,e=>{
              const touch=e.changedTouches&&e.changedTouches[0];
              const row={type:type,time:performance.now(),trusted:e.isTrusted,target:node(e.target),active:node(document.activeElement),client_x:touch?touch.clientX:e.clientX,client_y:touch?touch.clientY:e.clientY,pointer_type:e.pointerType,pointer_id:e.pointerId,default_prevented:e.defaultPrevented};
              rows.push(row);if(rows.length>100)rows.shift();
              Promise.resolve().then(()=>{row.default_prevented=e.defaultPrevented;row.active_after= node(document.activeElement);});
            },{capture:true,passive:true});
          return true;
        })()
      """.trimIndent(), deadlineOverride = deadline)
    }
    val script = """
      (()=>{
        const editor=document.querySelector('.cm-content[contenteditable=true]');
        if(!editor)return {found:false};
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
        return {found:true,x:clientX-left,y:clientY-top,left:clientX-left,top:clientY-top,right:clientX-left+1,bottom:clientY-top+1,
          client_x:clientX,client_y:clientY,viewport_width:width,viewport_height:height,visible_width:visible.right-visible.left,visible_height:visible.bottom-visible.top,
          editor_rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height},
          viewport:{left:left,top:top,width:width,height:height,scale:viewport?viewport.scale:1},
          hit_is_editor:hit===editor||editor.contains(hit),hit_tag:hit?hit.nodeName:null,hit_class:hit?String(hit.className).slice(0,128):null,
          surface_id:document.querySelector('.document-surface').id,editor_label:editor.getAttribute('aria-label')};
      })()
    """.trimIndent()
    var target = JSONObject()
    var nativeMapping = JSONObject()
    try {
      enableNativeWindowObservation()
      var ready = false
      while (SystemClock.elapsedRealtime() < deadline) {
        target = JSONObject(evaluate(scenario, script, deadlineOverride = deadline))
        nativeMapping = nativeControlGeometry(scenario, target)
        if (target.optBoolean("hit_is_editor") && target.optDouble("visible_width") > 0 && target.optDouble("visible_height") > 0 &&
          nativeTapForeground(nativeMapping) && nativeMapping.optBoolean("whole_control_visible")) {
          // Match control readiness: observe geometry across a real frame interval.
          SystemClock.sleep(100L)
          val confirmed = JSONObject(evaluate(scenario, script.replace("editor.scrollIntoView({block:'nearest',inline:'nearest'});", ""), deadlineOverride = deadline))
          val confirmedMapping = nativeControlGeometry(scenario, confirmed)
          if (nativeTapObservationsAgree(target, nativeMapping, confirmed, confirmedMapping) && confirmed.optBoolean("hit_is_editor") &&
            confirmed.optDouble("visible_width") > 0 && confirmed.optDouble("visible_height") > 0 && nativeTapForeground(confirmedMapping) && confirmedMapping.optBoolean("whole_control_visible")) {
            target = confirmed
            nativeMapping = confirmedMapping.put("focus_before", nativeFocus)
            ready = true
            break
          }
        }
        SystemClock.sleep(100L)
      }
      assertTrue("the sole native edit tap must hit actual editor content in a coherent visible native window within the original action deadline", ready && SystemClock.elapsedRealtime() < deadline)
    } catch (failure: Throwable) {
      captureEditorFocusFailure(scenario, "before_native_touch", target, nativeMapping)
      throw failure
    }
    val point = floatArrayOf(nativeMapping.getDouble("screen_x").toFloat(), nativeMapping.getDouble("screen_y").toFloat())
    dispatchNativeTapOnce(point[0], point[1], deadline)
    instrumentation.waitForIdleSync()
    try {
      waitForCondition(scenario, "document.hasFocus() && document.activeElement===document.querySelector('.cm-content[contenteditable=true]')", "the actual editor must own browser focus after a native touch before editing", deadlineOverride = deadline)
    } catch (failure: AssertionError) {
      captureEditorFocusFailure(scenario, "after_native_touch", target, nativeMapping)
      throw failure
    }
    // A touch starts the IME asynchronously. Do not retain a pre-IME connection across its restart.
    var servedIme = false
    var imeObservation = JSONObject()
    while (SystemClock.elapsedRealtime() < deadline) {
      var active = false
      scenario.onActivity { activity ->
        val view = requireNotNull(findWebView(activity.window.decorView))
        val manager = activity.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
        active = manager.isActive(view) && manager.isAcceptingText
      }
      val visible = visibleNativeImeBounds().isNotEmpty()
      imeObservation = JSONObject().put("served_editor", active).put("ime_window_visible", visible)
      if (active && visible) { servedIme = true; break }
      SystemClock.sleep(50L)
    }
    assertTrue("the actual served editor IME must be ready before creating its input connection inside the original input deadline: " + imeObservation, servedIme)
    val browserBefore = browserEditorInputSnapshot(scenario, deadlineOverride = deadline)
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
    val (connection, handler) = waitForFocusedInputConnection(scenario,
      "document.hasFocus()&&document.activeElement===document.querySelector('.cm-content[contenteditable=true]')&&document.querySelector('.document-surface').id===" + JSONObject.quote(target.getString("surface_id")), deadline, beforeInputText)
    println("native_editor_input=" + JSONObject().put("phase", "before_native_commit").put("api_level", Build.VERSION.SDK_INT)
      .put("native_focus", nativeFocus).put("browser_edit", browserBefore).put("input_connection", JSONObject().put("connection_created", true)))
    System.out.flush()
    waitForNativeEditorState(connection, handler, beforeInputText, "before_native_selection", deadlineOverride = deadline)
    assertTrue("native IME must finish any active composition", onEditorInputThread(connection, handler, deadlineOverride = deadline) { it.finishComposingText() })
    assertTrue("native IME must select the complete semantic source, excluding rendered paragraph markers", onEditorInputThread(connection, handler, deadlineOverride = deadline) { it.setSelection(0, semanticSelectionEnd) })
    val selectedState = waitForNativeEditorState(connection, handler, beforeInputText, "selected_before_commit", 0, semanticSelectionEnd, deadlineOverride = deadline)
    if (browserBefore.getBoolean("edit_context_attached")) {
      waitForCondition(scenario, "(()=>{const editor=document.querySelector('.cm-content[contenteditable=true]');const context=editor&&editor.editContext;return !!context&&context.selectionStart===0&&context.selectionEnd===" + semanticSelectionEnd + ";})()", "native IME selection must reach the actual EditContext before replacement", deadlineOverride = deadline)
    }
    assertTrue("native IME must accept the exact Unicode and multiline text", onEditorInputThread(connection, handler, deadlineOverride = deadline) { it.commitText(text, 1) })
    val browserAfter = try {
      waitForBrowserEditorCommit(scenario, text, target.getString("surface_id"), target.getString("editor_label"), deadlineOverride = deadline)
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
      val (currentConnection, currentHandler) = waitForFocusedInputConnection(scenario,
        "document.hasFocus()&&document.activeElement===document.querySelector('.cm-content[contenteditable=true]')&&document.querySelector('.document-surface').id===" + JSONObject.quote(target.getString("surface_id")), deadline, afterInputText)
      waitForNativeEditorState(currentConnection, currentHandler, afterInputText, "committed", text.length, text.length, deadlineOverride = deadline)
    } catch (failure: AssertionError) {
      captureEditorFocusFailure(scenario, "native_committed_state", target, nativeMapping)
      throw failure
    }
    println("native_editor_input=" + JSONObject().put("phase", "native_commit_verified").put("api_level", Build.VERSION.SDK_INT)
      .put("input_path", "WebView.InputConnection.setSelection+commitText").put("selected_state", selectedState)
      .put("committed_state", committedState).put("browser_edit_after", browserAfter).put("visible_exact_text", true).put("committed_utf8_bytes", text.toByteArray(Charsets.UTF_8).size))
    System.out.flush()
    assertTrue("exact native and browser editor verification must complete inside the original action deadline", SystemClock.elapsedRealtime() < deadline)
  }

  private fun waitForBrowserEditorCommit(
    scenario: ActivityScenario<MainActivity>, expected: String, surfaceId: String, editorLabel: String, deadlineOverride: Long? = null
  ): JSONObject {
    // Observe raw DOM and public editing text together before freezing the native
    // expectation from one coherent, focused current-editor snapshot.
    val deadline = minOf(SystemClock.elapsedRealtime() + 30_000L, deadlineOverride ?: Long.MAX_VALUE)
    var latest = JSONObject()
    while (SystemClock.elapsedRealtime() < deadline) {
      val observed = runCatching { browserEditorInputSnapshot(scenario, deadlineOverride = deadline) }.getOrElse { JSONObject().put("capture_failed", true) }
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

  private fun editableSourceText(scenario: ActivityScenario<MainActivity>, deadlineOverride: Long? = null): String {
    val value = JSONObject(evaluate(scenario, "(()=>{const editor=document.querySelector('.cm-content[contenteditable=true]');return {present:!!editor,text:editor?Array.from(editor.querySelectorAll(':scope > .cm-line')).map(n=>n.textContent).join('\\n'):null};})()", deadlineOverride = deadlineOverride))
    assertTrue("exact editable source readback requires the actual current editor", value.getBoolean("present"))
    return value.getString("text")
  }

  private fun browserEditorInputSnapshot(scenario: ActivityScenario<MainActivity>, deadlineOverride: Long? = null): JSONObject = JSONObject(evaluate(scenario, """
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
  """.trimIndent(), deadlineOverride = deadlineOverride))

  private fun captureEditorFocusFailure(
    scenario: ActivityScenario<MainActivity>, stage: String, target: JSONObject, mapping: JSONObject = JSONObject()
  ) {
    val screenshotSaved = runCatching { saveScreenshot("s047-editor-input-failure.png") }.getOrDefault(false)
    val journal = runCatching { JSONArray(evaluate(scenario, "window.__s047EditorEvents||[]")) }.getOrElse { JSONArray() }
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
    val taskState = runCatching {
      JSONObject(evaluate(scenario, "(()=>{const shown=n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&!n.closest('[aria-hidden=true],[inert]');};return {statuses:Array.from(document.querySelectorAll('[role=status],[role=alert],#large-text-status')).filter(shown).slice(0,12).map(n=>(n.textContent||'').slice(0,256)),fields:Array.from(document.querySelectorAll('input,select')).filter(shown).slice(0,12).map(n=>({tag:n.nodeName,label:(n.getAttribute('aria-label')||'').slice(0,128),value:String(n.value).slice(0,128),disabled:n.disabled}))};})()"))
    }.getOrElse { JSONObject().put("capture_failed", true) }
    val observation = JSONObject().put("stage", stage).put("api_level", Build.VERSION.SDK_INT)
      .put("expected_source_commit", InstrumentationRegistry.getArguments().getString("expectedSource") ?: JSONObject.NULL)
      .put("input_trace_requested", InstrumentationRegistry.getArguments().getString("s047InputTrace") == "true")
      .put("before_target", target).put("native_mapping", mapping).put("browser_after", browser)
      .put("native_after", native).put("hit_at_original_client_point", hit)
      .put("screenshot_saved", screenshotSaved).put("input_events", journal).put("task_state", taskState)
    val metadataSaved = runCatching {
      clientContext.openFileOutput("s047-editor-input-failure.json", 0).use { it.write(observation.toString(2).toByteArray(Charsets.UTF_8)) }
      true
    }.getOrDefault(false)
    observation.remove("input_events")
    println("native_editor_focus_failure=" + observation.put("diagnostic_json_saved", metadataSaved))
    for (index in 0 until journal.length()) println("native_editor_input_event=" + journal.getJSONObject(index))
    System.out.flush()
  }

  private fun <T> onEditorInputThread(
    connection: android.view.inputmethod.InputConnection,
    handler: android.os.Handler,
    deadlineOverride: Long? = null, action: (android.view.inputmethod.InputConnection) -> T
  ): T {
    if (deadlineOverride != null) assertTrue("native input must begin inside the original action deadline", SystemClock.elapsedRealtime() < deadlineOverride)
    val result = AtomicReference<T>()
    val failure = AtomicReference<Throwable?>()
    val done = CountDownLatch(1)
    assertTrue("native input action must be posted to the connection handler", handler.post {
      try { result.set(action(connection)) } catch (error: Throwable) { failure.set(error) } finally { done.countDown() }
    })
    val remaining = minOf(10_000L, (deadlineOverride ?: Long.MAX_VALUE) - SystemClock.elapsedRealtime())
    assertTrue("native input action must finish within the original deadline without blocking the app UI", remaining > 0 && done.await(remaining, TimeUnit.MILLISECONDS))
    failure.get()?.let { throw AssertionError("native InputConnection action failed", it) }
    return result.get()
  }

  private fun waitForNativeEditorState(
    connection: android.view.inputmethod.InputConnection,
    handler: android.os.Handler,
    expected: String,
    phase: String,
    selectionStart: Int? = null,
    selectionEnd: Int? = null, deadlineOverride: Long? = null
  ): JSONObject {
    val deadline = minOf(SystemClock.elapsedRealtime() + 10_000L, deadlineOverride ?: Long.MAX_VALUE)
    var latest = JSONObject()
    while (SystemClock.elapsedRealtime() < deadline) {
      val extracted = onEditorInputThread(connection, handler, deadlineOverride = deadline) {
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
    deadlineOverride: Long? = null, prerequisite: (() -> Boolean)? = null
  ) {
    val deadline = deadlineOverride ?: (SystemClock.elapsedRealtime() + 30_000L)
    while (SystemClock.elapsedRealtime() < deadline) {
      if (prerequisite != null) {
        val ready = runCatching { prerequisite() }
        observations?.let { it.put("prerequisite_count", it.optInt("prerequisite_count") + 1) }
        if (ready.isFailure) observations?.put("prerequisite_failure_type", ready.exceptionOrNull()?.javaClass?.simpleName)
        if (!ready.getOrDefault(false)) { SystemClock.sleep(100L); continue }
      }
      val result = runCatching { evaluate(scenario, script, deadlineOverride = deadlineOverride) }
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
            .put("last_callback_timeout", failure?.message == "WebView observation or activation did not complete")
        }
      }
      if (result.getOrDefault("false") == "true" && (deadlineOverride == null || SystemClock.elapsedRealtime() < deadline)) return
      SystemClock.sleep(100L)
    }
    throw AssertionError(reason)
  }

  private fun externalNativeWindowState(
    root: android.view.accessibility.AccessibilityNodeInfo? = instrumentation.uiAutomation.rootInActiveWindow
  ): JSONObject {
    val bounds = android.graphics.Rect()
    root?.getBoundsInScreen(bounds)
    return nativeRectBounds(bounds).put("package", root?.packageName?.toString() ?: JSONObject.NULL)
      .put("visible", root?.isVisibleToUser == true).put("width", bounds.width()).put("height", bounds.height())
  }

  private fun externalNativeLayerState(expectedPackage: String): JSONObject {
    val root = instrumentation.uiAutomation.rootInActiveWindow
    val fresh = root?.refresh() == true
    val windows = instrumentation.uiAutomation.windows
    val window = externalNativeWindowState(root)
    val owner = windows.firstOrNull { it.id == root?.windowId && it.type == android.view.accessibility.AccessibilityWindowInfo.TYPE_APPLICATION }
    val bounds = android.graphics.Rect(window.getInt("left"), window.getInt("top"), window.getInt("right"), window.getInt("bottom"))
    val ime = visibleNativeImeBounds(windows).filter { android.graphics.Rect.intersects(it, bounds) }
    // API24 can omit the actual LatinIME window from accessibility while it consumes Back.
    // Observe the system input-method service, never infer absence from an empty bounds list alone.
    val imeServiceShown = if (Build.VERSION.SDK_INT == 24) {
      val dump = checkedShell("dumpsys -t 2 input_method")
      val shown = Regex("(?:^|\\s)mInputShown=(true|false)(?:\\s|$)").find(dump)
      assertTrue("API24 external IME state must be explicitly recognized", shown != null)
      shown!!.groupValues[1] == "true"
    } else false
    return window.put("root_fresh", fresh).put("owner_window_present", owner != null)
      .put("owner_focused", owner?.isFocused == true).put("owner_active", owner?.isActive == true)
      .put("verified_owner", fresh && owner?.isFocused == true && expectedPackage.isNotEmpty() && expectedPackage != TARGET_PACKAGE &&
        window.optString("package") == expectedPackage && window.optBoolean("visible") && window.optInt("width") > 0 && window.optInt("height") > 0)
      .put("ime_window_bounds", JSONArray(ime.map { nativeRectBounds(it) }))
      .put("ime_service_shown", imeServiceShown).put("ime_present", imeServiceShown || ime.isNotEmpty())
  }

  private fun awaitExternalNativeIdle(deadline: Long) {
    val remaining = deadline - SystemClock.elapsedRealtime()
    assertTrue("native layer readiness must begin inside the original handoff-return budget", remaining > 0L)
    instrumentation.uiAutomation.waitForIdle(100L, remaining)
    assertTrue("native layer readiness must finish inside the original handoff-return budget", SystemClock.elapsedRealtime() < deadline)
  }

  private fun cancelExternalNativeWindow(scenario: ActivityScenario<MainActivity>, control: String, expectedPackage: String) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    var phase = "observe_layers"
    var imeBackRequested = false
    var windowBackRequested = false
    var layers = JSONObject()
    var app = JSONObject()
    fun completed(outcome: String) {
      assertTrue("external cancellation must finish inside the original handoff-return budget", SystemClock.elapsedRealtime() < deadline)
      println("external_native_cancel=" + JSONObject().put("control", control).put("expected_package", expectedPackage)
        .put("outcome", outcome).put("ime_back_requested", imeBackRequested).put("window_back_requested", windowBackRequested)
        .put("layers", layers).put("app_window", app))
      System.out.flush()
    }
    try {
      enableNativeWindowObservation()
      phase = "await_initial_native_idle"
      awaitExternalNativeIdle(deadline)
      phase = "observe_layers"
      layers = externalNativeLayerState(expectedPackage)
      assertTrue("cancellation must start at the verified visible external owner", layers.getBoolean("verified_owner"))
      println("external_native_cancel_layers=" + JSONObject().put("control", control).put("expected_package", expectedPackage).put("layers", layers))
      System.out.flush()
      if (layers.getBoolean("ime_present")) {
        assertTrue("keyboard dismissal must begin inside the original handoff-return budget", SystemClock.elapsedRealtime() < deadline)
        phase = "ime_back"
        imeBackRequested = true
        pressExternalWindowBack(control + " keyboard", expectedPackage, true, deadline)
        phase = "await_ime_hidden"
        var imeHiddenAtOwner = false
        while (SystemClock.elapsedRealtime() < deadline) {
          app = nativeHandoffState(scenario, control, expectedPackage)
          if (actualAppNativeWindowReady(app)) { completed("returned_after_first_pair"); return }
          layers = externalNativeLayerState(expectedPackage)
          if (layers.getBoolean("verified_owner") && !layers.getBoolean("ime_present")) {
            imeHiddenAtOwner = true
            break
          }
          SystemClock.sleep(100L)
        }
        assertTrue("the observed external IME must disappear while the same owner persists before any window Back", imeHiddenAtOwner)
        phase = "await_post_ime_native_idle"
        awaitExternalNativeIdle(deadline)
        app = nativeHandoffState(scenario, control, expectedPackage)
        if (actualAppNativeWindowReady(app)) { completed("returned_after_first_pair"); return }
        phase = "verify_post_ime_layers"
        layers = externalNativeLayerState(expectedPackage)
        assertTrue("the same focused external owner must persist after IME readiness", layers.getBoolean("verified_owner"))
        assertTrue("a dismissed IME must stay absent before the single window Back", !layers.getBoolean("ime_present"))
      }
      assertTrue("window cancellation must begin inside the original handoff-return budget", SystemClock.elapsedRealtime() < deadline)
      phase = "window_back"
      windowBackRequested = true
      pressExternalWindowBack(control + " window", expectedPackage, false, deadline)
      phase = "await_app_return"
      waitForAppNativeWindow(scenario, control, expectedPackage, deadline)
      app = nativeHandoffState(scenario, control, expectedPackage)
      assertTrue("external cancellation must return the actual resumed focused app window", actualAppNativeWindowReady(app))
      completed("returned_after_window_pair")
    } catch (failure: Throwable) {
      val after = runCatching { externalNativeLayerState(expectedPackage) }.getOrElse { JSONObject().put("capture_failed", true) }
      val appAfter = runCatching { nativeHandoffState(scenario, control, expectedPackage) }.getOrElse { JSONObject().put("capture_failed", true) }
      val screenshotSaved = runCatching { saveScreenshot("s046-authoring.png") }.getOrDefault(false)
      println("external_native_cancel_failure=" + JSONObject().put("control", control).put("expected_package", expectedPackage)
        .put("phase", phase).put("failure_type", failure.javaClass.simpleName).put("ime_back_requested", imeBackRequested)
        .put("window_back_requested", windowBackRequested).put("last_layers", layers).put("layers_after", after).put("app_window_after", appAfter)
        .put("screenshot_saved", screenshotSaved))
      System.out.flush()
      throw failure
    }
  }

  private fun pressExternalWindowBack(control: String, expectedPackage: String, expectedIme: Boolean, deadline: Long) {
    val before = externalNativeLayerState(expectedPackage)
    var phase = "owner_and_layer_check"
    var downAccepted = false
    var upAccepted = false
    try {
      println("external_native_back_before=" + JSONObject().put("control", control).put("expected_package", expectedPackage)
        .put("expected_ime", expectedIme).put("remaining_ms", deadline - SystemClock.elapsedRealtime()).put("layers", before))
      System.out.flush()
      assertTrue("external Back must name a different application owner", expectedPackage.isNotEmpty() && expectedPackage != TARGET_PACKAGE)
      assertEquals("external Back must target the verified current native window", expectedPackage, before.optString("package"))
      assertTrue("external Back must target a visible native window", before.getBoolean("visible") && before.getInt("width") > 0 && before.getInt("height") > 0)
      assertTrue("external Back must retain a fresh focused native owner", before.getBoolean("verified_owner"))
      assertEquals("the observed IME layer must still match the selected single Back", expectedIme, before.getBoolean("ime_present"))
      val downTime = SystemClock.uptimeMillis()
      val down = KeyEvent(downTime, downTime, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_BACK, 0, 0,
        android.view.KeyCharacterMap.VIRTUAL_KEYBOARD, 0, KeyEvent.FLAG_FROM_SYSTEM, InputDevice.SOURCE_KEYBOARD)
      phase = "down"
      assertTrue("Back DOWN must begin inside the original handoff-return budget", SystemClock.elapsedRealtime() < deadline)
      downAccepted = instrumentation.uiAutomation.injectInputEvent(down, true)
      assertTrue("the external native window must accept the single Back DOWN", downAccepted)
      val up = KeyEvent(downTime, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, KeyEvent.KEYCODE_BACK, 0, 0,
        android.view.KeyCharacterMap.VIRTUAL_KEYBOARD, 0, KeyEvent.FLAG_FROM_SYSTEM, InputDevice.SOURCE_KEYBOARD)
      phase = "up"
      upAccepted = instrumentation.uiAutomation.injectInputEvent(up, true)
      assertTrue("the external native window must accept the single Back UP", upAccepted)
      println("external_native_back=" + JSONObject().put("control", control).put("expected_package", expectedPackage)
        .put("phase", "event_pair_accepted").put("window_before", before).put("down_accepted", downAccepted).put("up_accepted", upAccepted))
      System.out.flush()
    } catch (failure: Throwable) {
      val after = runCatching { externalNativeLayerState(expectedPackage) }.getOrElse { JSONObject().put("capture_failed", true) }
      println("external_native_back_failure=" + JSONObject().put("control", control).put("expected_package", expectedPackage)
        .put("phase", phase).put("failure_type", failure.javaClass.simpleName).put("window_before", before).put("window_after", after)
        .put("down_accepted", downAccepted).put("up_accepted", upAccepted))
      System.out.flush()
      throw failure
    }
  }

  private fun clickNativeText(expected: String, click: Boolean = true): String {
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
      val root = instrumentation.uiAutomation.rootInActiveWindow
      if (visit(root)) return requireNotNull(root?.packageName?.toString()) { "matched native chooser must expose its actual window owner" }
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
  private fun saveScreenshot(name: String): Boolean {
    val bitmap = instrumentation.uiAutomation.takeScreenshot() ?: return false
    return try { clientContext.openFileOutput(name, 0).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) } } finally { bitmap.recycle() }
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
      val actualPixels = java.nio.ByteBuffer.allocate(4 * 3 * 4)
      val expectedPixels = java.nio.ByteBuffer.allocate(4 * 3 * 4)
      for (y in 0 until 3) for (x in 0 until 4) { actualPixels.putInt(bitmap.getPixel(x,y)); expectedPixels.putInt(expected.getPixel(x,y)) }
      recordJourneyReadback(6, "png_pixels", expectedPixels.array(), actualPixels.array())
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

  private fun waitForBodyText(scenario: ActivityScenario<MainActivity>, vararg expected: String, deadlineOverride: Long? = null) {
    // Keep startup tolerance and exact markers without transporting the whole large document on every poll.
    val deadline = minOf(SystemClock.elapsedRealtime() + 60_000L, deadlineOverride ?: Long.MAX_VALUE)
    val markers = JSONArray(expected.toList()).toString()
    var latest = JSONObject().put("length", 0).put("matched", false)
    while (SystemClock.elapsedRealtime() < deadline) {
      val webView = AtomicReference<WebView?>()
      scenario.onActivity { activity -> webView.set(findWebView(activity.window.decorView)) }
      webView.get()?.let { view ->
        val result = AtomicReference("null")
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync {
          view.evaluateJavascript("(()=>{const text=document.body?document.body.innerText:'';return {matched:" + markers + ".every(marker=>text.includes(marker)),length:text.length};})()") { value ->
            result.set(value ?: "null")
            latch.countDown()
          }
        }
        val remaining = minOf(2_000L, deadline - SystemClock.elapsedRealtime())
        if (remaining > 0 && latch.await(remaining, TimeUnit.MILLISECONDS)) {
          runCatching { JSONObject(result.get()) }.getOrNull()?.let { latest = it }
        }
      }
      if (latest.optBoolean("matched")) return
      SystemClock.sleep(minOf(100L, maxOf(0L, deadline - SystemClock.elapsedRealtime())))
    }
    captureEditorFocusFailure(scenario, "body_marker_timeout", JSONObject().put("markers", JSONArray(expected.map { it.take(128) })).put("observation", latest))
    throw AssertionError("document surface did not expose expected synthetic evidence; observed length=" + latest.optInt("length"))
  }

  private fun evaluate(scenario: ActivityScenario<MainActivity>, script: String, deadlineOverride: Long? = null, actionCallback: Boolean = false): String {
    if (deadlineOverride != null) assertTrue("WebView observation or activation must begin inside the original action deadline", SystemClock.elapsedRealtime() < deadlineOverride)
    val view = AtomicReference<WebView?>()
    scenario.onActivity { view.set(findWebView(it.window.decorView)) }
    val latch = CountDownLatch(1)
    val result = AtomicReference("null")
    val requested = SystemClock.elapsedRealtime()
    val posted = java.util.concurrent.atomic.AtomicLong(0L)
    val traceCallbacks = InstrumentationRegistry.getArguments().getString("s047ObservationTrace") == "true"
    val caller = if (traceCallbacks) Throwable().stackTrace.firstOrNull { it.methodName != "evaluate" && it.methodName != "evaluate\$default" } else null
    val scriptDigest = if (traceCallbacks) sha256(script.toByteArray(Charsets.UTF_8)) else "trace_disabled"
    instrumentation.runOnMainSync {
      posted.set(SystemClock.elapsedRealtime())
      requireNotNull(view.get()).evaluateJavascript(script) { value ->
        result.set(value ?: "null"); latch.countDown()
        val completed = SystemClock.elapsedRealtime()
        if (traceCallbacks && completed - requested >= 1_000L) {
          println("native_webview_slow_callback=" + JSONObject().put("requested_at", requested).put("posted_at", posted.get()).put("completed_at", completed)
            .put("elapsed_ms", completed - requested).put("payload_characters", value?.length ?: 0).put("script_sha256", scriptDigest).put("caller", caller?.toString()).put("activation", actionCallback))
          System.out.flush()
        }
      }
    }
    val remaining = minOf(if (actionCallback) 30_000L else 2_000L, (deadlineOverride ?: Long.MAX_VALUE) - SystemClock.elapsedRealtime())
    val completed = remaining > 0 && latch.await(remaining, TimeUnit.MILLISECONDS)
    if (!completed) {
      println("native_webview_callback_timeout=" + JSONObject().put("requested_at", requested).put("posted_at", posted.get()).put("elapsed_ms", SystemClock.elapsedRealtime() - requested)
        .put("allowed_wait_ms", remaining).put("script_characters", script.length).put("script_sha256", scriptDigest).put("caller", caller?.toString()).put("activation", actionCallback))
      System.out.flush()
    }
    assertTrue("WebView observation or activation did not complete", completed)
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
          webView.evaluateJavascript("(()=>{const image=document.querySelector('.image-preview');const background=document.querySelector('select[aria-label=\"Image background\"]');const status=document.querySelector('.image-status');const matches=!!image && image.alt===$expectedLiteral;const blob=!!image && image.src.startsWith('blob:');const changed=!$changed || (!!image && image.src!==window.__s040PreviousPreview);return {pass:changed && matches && image.complete && image.naturalWidth===4 && image.naturalHeight===3 && blob,matches:matches,complete:!!image && image.complete,width:image ? image.naturalWidth : 0,height:image ? image.naturalHeight : 0,blob:blob,background:!!background,status:status ? status.textContent.slice(0,256) : ''};})()") {
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
