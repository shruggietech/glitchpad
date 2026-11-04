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
import android.view.KeyEvent
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
    waitForBodyText(scenario, "resolver-cold.md", "S031_COLD_MARKER_4F2A")
    val warmIntent = viewIntent(warm, "text/plain")
    assertTrue("installed Glitchpad package did not resolve the warm fixture", glitchpadComponent(warmIntent) != null)
    clientContext.startActivity(warmIntent.setComponent(component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    waitForBodyText(scenario, "resolver-warm.txt", "S031_WARM_MARKER_7C9D")
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
    scenario.onActivity { activity -> requireNotNull(findWebView(activity.window.decorView)).requestFocus() }
    instrumentation.waitForIdleSync()
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
    println("markdown_delivery_failure=" + JSONObject().put("fixture", name).put("route", InstrumentationRegistry.getArguments().getString("deliveryAction")).put("api_level", Build.VERSION.SDK_INT).put("screenshot_saved", screenshotSaved).put("state_json", snapshot.take(24576)).toString())
    System.out.flush()
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
      clickControl(scenario, "Add document")
      clickControl(scenario, choice)
      waitForBodyText(scenario, name)
      waitForCondition(scenario, "(()=>{const n=document.querySelector('[data-draft-identity]');if(!n)return false;const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&n.textContent.includes('Unsaved changes');})()", "new draft must have visible identity and unsaved state")
      replaceEditorText(scenario, text)
      chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, ActivityResult(Activity.RESULT_CANCELED, Intent()), { menuAction(scenario, "Save") }, "Cancelled. Your document and edits remain available.")
      waitForCondition(scenario, "!!document.querySelector('.cm-content[contenteditable=true]')", "cancelled draft must remain editable")
      val refused = destination(type, "s046-write-refused")
      chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, chosen(refused), { menuAction(scenario, "Save") }, "The action failed. Your document and edits remain available.")
      assertEquals("failed native write must not change its empty destination", 0, readBytes(refused).size)
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
    clickControl(scenario, "Add document"); clickControl(scenario, "New Markdown")
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
      clickControl(scenario, "Add document")
      clickControl(scenario, "New Markdown")
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
    clickControl(scenario, "Add document"); clickControl(scenario, "New text file")
    replaceEditorText(scenario, "S046_DIRTY_CLOSE_BYTES\n")
    assertEquals("true", evaluate(scenario, "(()=>{document.querySelector('.app-shell').dispatchEvent(new KeyboardEvent('keydown',{key:'w',ctrlKey:true,bubbles:true}));return true;})()"))
    waitForBodyText(scenario, "Unsaved changes in Untitled.txt", "No content has been discarded.")
    clickControl(scenario, "Cancel")
    waitForCondition(scenario, "!document.querySelector('.resolution-dialog') && !!document.querySelector('.cm-content[contenteditable=true]')", "dirty close cancellation must retain the draft")
    assertEquals("true", evaluate(scenario, "(()=>{document.querySelector('.app-shell').dispatchEvent(new KeyboardEvent('keydown',{key:'w',ctrlKey:true,bubbles:true}));return true;})()"))
    waitForBodyText(scenario, "Unsaved changes in Untitled.txt")
    val monitor = instrumentation.addMonitor(IntentFilter(Intent.ACTION_CREATE_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); addDataType("*/*") }, null, false)
    try {
      clickControl(scenario, "Save As")
      waitForCondition(scenario, "Array.from(document.querySelectorAll('.resolution-dialog button')).every(b=>b.disabled)", "pending native Save must disable Discard/Close decisions")
      assertEquals("true", evaluate(scenario, "(()=>{const discard=Array.from(document.querySelectorAll('.resolution-dialog button')).find(b=>b.textContent.trim()==='Discard');if(!discard||!discard.disabled)return false;discard.click();return !!document.querySelector('.cm-content');})()"))
      instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
      waitForBodyText(scenario, "Save cancelled. Edits remain open.")
      assertTrue("one native create chooser must own the pending save", monitor.hits == 1)
    } finally { instrumentation.removeMonitor(monitor) }
    waitForBodyText(scenario, "Unsaved changes in Untitled.txt")
    clickControl(scenario, "Cancel")
    chooseNative(scenario, Intent.ACTION_CREATE_DOCUMENT, chosen(destination), { menuAction(scenario, "Save") }, "Saved after native verification.")
    assertTrue("pending Discard attempt must not lose draft bytes", "S046_DIRTY_CLOSE_BYTES\n".toByteArray(Charsets.UTF_8).contentEquals(readBytes(destination)))
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
    clickControl(scenario, "Share previewed bundle")
    clickNativeText("Glitchpad diagnostic fixture", false)
    instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_BACK)
    waitForBodyText(scenario, "Cancelled. The preview is retained.")
    assertEquals("Share cancellation must retain the exact preview", frozen, stringValue(evaluate(scenario, "document.querySelector('.diagnostic-preview').textContent")))
    clickControl(scenario, "Share previewed bundle")
    clickNativeText("Glitchpad diagnostic fixture")
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    var received = resolver.call(FixtureGrantProvider.COMMAND_URI, "share_result", null, null)
    while (SystemClock.elapsedRealtime() < deadline && received?.getString("json") == null) { SystemClock.sleep(100L); received = resolver.call(FixtureGrantProvider.COMMAND_URI, "share_result", null, null) }
    assertEquals("actual receiving activity must read the frozen JSON", frozen, received?.getString("json"))
    assertTrue("receiver must have a temporary read grant", received?.getBoolean("read_granted") == true)
    waitForBodyText(scenario, "Shared with the system. Recipient delivery is unconfirmed.")
    println("recovery_runtime_evidence=" + JSONObject().put("apk_sha256", apkSha256()).put("source_commit", expectedSource).put("package", TARGET_PACKAGE).put("product_version", packageInfo.versionName).put("evidence_class", "hosted_debug_instrumentation").put("signed_release_bytes_tested", false).put("recovery_probe_variant", "compiled_test_only").put("native_environment", native).put("font_scale", clientContext.resources.configuration.fontScale).toString())
    clickControl(scenario, "Close diagnostics")
  }

  private fun chooseNative(scenario: ActivityScenario<MainActivity>, action: String, result: ActivityResult, trigger: () -> Unit, vararg expected: String) {
    val filter = IntentFilter(action).apply { addCategory(Intent.CATEGORY_OPENABLE); addDataType("*/*") }
    val monitor = instrumentation.addMonitor(filter, result, true)
    try { trigger(); waitForBodyText(scenario, *expected); assertEquals("native chooser must be invoked exactly once", 1, monitor.hits) }
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
    waitForCondition(scenario, script, "the active document surface must own the expected delivery identity")
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

  private fun keyboardSave(scenario: ActivityScenario<MainActivity>) {
    scenario.onActivity { activity -> requireNotNull(findWebView(activity.window.decorView)).requestFocus() }
    assertEquals("actual editor must hold DOM focus before keyboard Save", "true", evaluate(scenario, "(()=>{const editor=document.querySelector('.cm-content[contenteditable=true]');if(!editor)return false;editor.focus();return document.activeElement===editor;})()"))
    instrumentation.waitForIdleSync()
    val downTime = SystemClock.uptimeMillis()
    instrumentation.sendKeySync(KeyEvent(downTime, downTime, KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_S, 0, KeyEvent.META_CTRL_ON))
    instrumentation.sendKeySync(KeyEvent(downTime, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, KeyEvent.KEYCODE_S, 0, KeyEvent.META_CTRL_ON))
  }

  private fun replaceEditorText(scenario: ActivityScenario<MainActivity>, text: String) {
    waitForCondition(scenario, "!!document.querySelector('.cm-content[contenteditable=true]')", "draft must expose the actual editable surface")
    assertEquals("browser editing must insert actual document content", "true", evaluate(scenario, "(()=>{const editor=document.querySelector('.cm-content[contenteditable=true]');editor.focus();document.execCommand('selectAll',false,null);return document.execCommand('insertText',false," + JSONObject.quote(text) + ");})()"))
    waitForBodyText(scenario, text.lineSequence().first())
  }

  private fun waitForCondition(scenario: ActivityScenario<MainActivity>, script: String, reason: String) {
    val deadline = SystemClock.elapsedRealtime() + 30_000L
    while (SystemClock.elapsedRealtime() < deadline) { if (runCatching { evaluate(scenario, script) }.getOrDefault("false") == "true") return; SystemClock.sleep(100L) }
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
