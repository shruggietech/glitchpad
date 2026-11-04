package com.shruggietech.glitchpad.shell

import android.app.ActivityManager
import android.content.pm.ActivityInfo
import android.content.Context
import android.content.res.Configuration
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.shruggietech.glitchpad.MainActivity
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.max

@RunWith(AndroidJUnit4::class)
class BrandBuilderAppFrameInstrumentedTest {
    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view !is ViewGroup) return null
        for (index in 0 until view.childCount) {
            findWebView(view.getChildAt(index))?.let { return it }
        }
        return null
    }

    private fun evaluate(
        scenario: ActivityScenario<MainActivity>,
        script: String,
        timeoutSeconds: Long = 5,
    ): String {
        val completed = CountDownLatch(1)
        var result: String? = null
        var nativeState = JSONObject().put("stage", "activity_callback_pending")
        scenario.onActivity { activity ->
            val webView = findWebView(activity.window.decorView)
            assertNotNull("Tauri must host a real Android WebView", webView)
            nativeState = readinessSnapshot(
                Build.VERSION.SDK_INT,
                activity.resources.configuration.orientation,
                webView!!.isAttachedToWindow,
                webView.hasWindowFocus(),
                webView.hasFocus(),
                webView.visibility,
                webView.width,
                webView.height,
            )
            webView.evaluateJavascript(script) { value ->
                result = value
                completed.countDown()
            }
        }
        assertTrue("WebView JavaScript evaluation timed out (stage=evaluate_callback; native=$nativeState)", completed.await(timeoutSeconds, TimeUnit.SECONDS))
        return result ?: "null"
    }

    private fun decodedJavascriptString(result: String): String =
        JSONArray("[$result]").getString(0)

    private fun readinessSnapshot(
        api: Int, orientation: Int, attached: Boolean, windowFocused: Boolean,
        viewFocused: Boolean, visibility: Int, width: Int, height: Int,
    ): JSONObject = JSONObject()
        .put("api_level", api)
        .put("orientation", orientation)
        .put("attached", attached)
        .put("window_focused", windowFocused)
        .put("view_focused", viewFocused)
        .put("visibility", visibility)
        .put("width_px", width)
        .put("height_px", height)

    private fun focusCategory(line: String): String = when {
        line.contains("com.shruggietech.glitchpad.test/") -> "test"
        line.contains("com.shruggietech.glitchpad/") -> "target"
        line.contains("com.android.") || line.contains("android/") -> "system"
        line.contains("=null") -> "none"
        else -> "other"
    }

    private fun focusedWindowState(): String =
        ParcelFileDescriptor.AutoCloseInputStream(
            InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("dumpsys window"),
        ).bufferedReader().use { reader ->
            reader.lineSequence()
                .filter { it.contains("mCurrentFocus=") || it.contains("mFocusedApp=") }
                .take(4)
                .map { focusCategory(it) }
                .distinct()
                .joinToString(";")
                .ifEmpty { "unavailable" }
        }

    private fun assertCallbackDiagnosticsContainOnlyBoundedNativeState() {
        val diagnostic = readinessSnapshot(36, 1, true, false, false, 0, 1080, 1920)
        assertEquals(
            setOf("api_level", "orientation", "attached", "window_focused", "view_focused", "visibility", "width_px", "height_px"),
            diagnostic.keys().asSequence().toSet(),
        )
        assertEquals("other", focusCategory("mCurrentFocus=private-title /private/user/document.pdf"))
        assertEquals("target", focusCategory("mCurrentFocus=com.shruggietech.glitchpad/MainActivity private-title"))
        assertEquals("system", focusCategory("mFocusedApp=com.android.launcher/Launcher private-title"))
    }

    private fun waitForShell(scenario: ActivityScenario<MainActivity>) {
        val deadline = SystemClock.elapsedRealtime() + 60_000L
        var webViewReady = false
        while (!webViewReady && SystemClock.elapsedRealtime() < deadline) {
            scenario.onActivity { webViewReady = findWebView(it.window.decorView) != null }
            if (!webViewReady) SystemClock.sleep(100L)
        }
        assertTrue("Tauri must attach its Android WebView", webViewReady)

        var ready = false
        while (!ready && SystemClock.elapsedRealtime() < deadline) {
            ready = evaluate(
                scenario,
                "document.querySelector('.app-shell[data-performance-ready=\\\"true\\\"]') !== null",
            ) == "true"
            if (!ready) SystemClock.sleep(100L)
        }
        assertTrue("Glitchpad AppFrame shell must become ready", ready)
    }

    private fun waitForOrientation(
        scenario: ActivityScenario<MainActivity>,
        requestedOrientation: Int,
        expectedConfiguration: Int,
    ) {
        scenario.onActivity { it.requestedOrientation = requestedOrientation }
        val deadline = SystemClock.elapsedRealtime() + 15_000L
        var observed = false
        while (!observed && SystemClock.elapsedRealtime() < deadline) {
            scenario.onActivity {
                observed = it.resources.configuration.orientation == expectedConfiguration
            }
            if (!observed) SystemClock.sleep(100L)
        }
        assertTrue("requested Android orientation must be observed", observed)
        waitForShell(scenario)
    }

    private fun snapshot(scenario: ActivityScenario<MainActivity>): JSONObject {
        val result = evaluate(
            scenario,
            """
            (() => {
              const frame = document.querySelector('[data-bb-app-frame]');
              const main = frame ? frame.querySelector('main') : null;
              const shell = document.querySelector('.app-shell');
              const menu = document.querySelector('.application-menu-trigger');
              const popup = document.querySelector('.application-menu');
              const viewport = window.visualViewport || {
                offsetLeft: 0,
                offsetTop: 0,
                width: window.innerWidth,
                height: window.innerHeight
              };
              const bounds = menu ? menu.getBoundingClientRect() : null;
              const popupBounds = popup ? popup.getBoundingClientRect() : null;
              const frameStyle = frame ? getComputedStyle(frame) : null;
              return JSON.stringify({
                frameCount: document.querySelectorAll('[data-bb-app-frame]').length,
                host: frame ? frame.getAttribute('data-bb-host') : null,
                layout: frame ? frame.getAttribute('data-bb-layout') : null,
                mainCount: document.querySelectorAll('main').length,
                nestedMainCount: main ? main.querySelectorAll('main').length : -1,
                shellInsideMain: Boolean(main && shell && main.contains(shell)),
                rootOverflow: getComputedStyle(document.documentElement).overflow,
                bodyOverflow: getComputedStyle(document.body).overflow,
                layoutViewportHeight: window.innerHeight,
                measuredVisualViewportHeight: viewport.height,
                measuredVisualViewportOffset: viewport.offsetTop,
                visualViewportHeight: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bb-visual-viewport-height')),
                visualViewportOffset: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bb-visual-viewport-offset-block-start')),
                imeBlockEnd: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bb-ime-block-end')),
                menuInsideViewport: Boolean(bounds && viewport && bounds.left >= viewport.offsetLeft && bounds.top >= viewport.offsetTop && bounds.right <= viewport.offsetLeft + viewport.width && bounds.bottom <= viewport.offsetTop + viewport.height),
                menuOpen: Boolean(popup),
                popupInsideViewport: !popupBounds || Boolean(viewport && popupBounds.left >= viewport.offsetLeft && popupBounds.top >= viewport.offsetTop && popupBounds.right <= viewport.offsetLeft + viewport.width && popupBounds.bottom <= viewport.offsetTop + viewport.height),
                imeProbeFocused: Boolean(document.activeElement && document.activeElement.id === 'brandbuilder-ime-probe'),
                framePaddingTop: Number.parseFloat(frameStyle ? frameStyle.paddingTop : '0'),
                framePaddingRight: Number.parseFloat(frameStyle ? frameStyle.paddingRight : '0'),
                framePaddingBottom: Number.parseFloat(frameStyle ? frameStyle.paddingBottom : '0'),
                framePaddingLeft: Number.parseFloat(frameStyle ? frameStyle.paddingLeft : '0')
              });
            })()
            """.trimIndent(),
        )
        val observed = JSONObject(decodedJavascriptString(result))
        scenario.onActivity { activity ->
            val webView = findWebView(activity.window.decorView)!!
            val visibleFrame = Rect()
            webView.getWindowVisibleDisplayFrame(visibleFrame)
            val native = JSONObject()
                .put("webViewHeightPx", webView.height)
                .put("visibleDisplayHeightPx", visibleFrame.height())
            if (Build.VERSION.SDK_INT >= 30) {
                val insets = webView.rootWindowInsets
                native.put("imeVisible", insets?.isVisible(WindowInsets.Type.ime()) ?: false)
                native.put("imeBottomPx", insets?.getInsets(WindowInsets.Type.ime())?.bottom ?: 0)
            }
            observed.put("native", native)
        }
        return observed
    }

    private fun visualImeObstruction(observed: JSONObject): Double = max(
        0.0,
        observed.getDouble("layoutViewportHeight") - observed.getDouble("measuredVisualViewportHeight") -
            observed.getDouble("measuredVisualViewportOffset"),
    )

    private fun nativeLayoutReduced(before: JSONObject, observed: JSONObject): Boolean =
        observed.getJSONObject("native").getInt("webViewHeightPx") < before.getJSONObject("native").getInt("webViewHeightPx") &&
            observed.getDouble("layoutViewportHeight") < before.getDouble("layoutViewportHeight")

    private fun nativeImeShown(before: JSONObject, observed: JSONObject): Boolean {
        val native = observed.getJSONObject("native")
        return if (Build.VERSION.SDK_INT >= 30) {
            native.getBoolean("imeVisible") && native.getInt("imeBottomPx") > 0
        } else {
            native.getInt("visibleDisplayHeightPx") < before.getJSONObject("native").getInt("visibleDisplayHeightPx") &&
                nativeLayoutReduced(before, observed)
        }
    }

    private fun imeGeometryObserved(before: JSONObject, observed: JSONObject): Boolean =
        nativeImeShown(before, observed) &&
            (nativeLayoutReduced(before, observed) || visualImeObstruction(observed) > 0.0)

    private fun imeGeometryRestored(before: JSONObject, observed: JSONObject): Boolean {
        val native = observed.getJSONObject("native")
        val priorNative = before.getJSONObject("native")
        val nativeHidden = Build.VERSION.SDK_INT < 30 ||
            (!native.getBoolean("imeVisible") && native.getInt("imeBottomPx") == 0)
        return nativeHidden &&
            native.getInt("webViewHeightPx") >= priorNative.getInt("webViewHeightPx") - 1 &&
            native.getInt("visibleDisplayHeightPx") >= priorNative.getInt("visibleDisplayHeightPx") - 1 &&
            observed.getDouble("layoutViewportHeight") >= before.getDouble("layoutViewportHeight") - 1.0 &&
            observed.getDouble("measuredVisualViewportHeight") >= before.getDouble("measuredVisualViewportHeight") - 1.0 &&
            abs(observed.getDouble("measuredVisualViewportOffset") - before.getDouble("measuredVisualViewportOffset")) <= 1.0 &&
            abs(observed.getDouble("imeBlockEnd")) <= 1.0
    }

    private fun assertAppFrame(snapshot: JSONObject) {
        assertEquals(1, snapshot.getInt("frameCount"))
        assertEquals("tauri", snapshot.getString("host"))
        assertEquals("full-bleed", snapshot.getString("layout"))
        assertEquals(1, snapshot.getInt("mainCount"))
        assertEquals(0, snapshot.getInt("nestedMainCount"))
        assertTrue(snapshot.getBoolean("shellInsideMain"))
        assertEquals("hidden", snapshot.getString("rootOverflow"))
        assertEquals("hidden", snapshot.getString("bodyOverflow"))
        assertTrue(snapshot.getDouble("visualViewportHeight") > 0.0)
        assertTrue(snapshot.getDouble("visualViewportOffset") >= 0.0)
        assertTrue(
            "menu trigger must remain inside the visual viewport: $snapshot",
            snapshot.getBoolean("menuInsideViewport"),
        )
    }

    private fun tapWebViewPoint(
        scenario: ActivityScenario<MainActivity>,
        cssX: Double,
        cssY: Double,
        devicePixelRatio: Double,
    ) {
        var screenX = 0
        var screenY = 0
        scenario.onActivity { activity ->
            val webView = findWebView(activity.window.decorView)!!
            val location = IntArray(2)
            webView.getLocationOnScreen(location)
            screenX = location[0] + (cssX * devicePixelRatio).toInt()
            screenY = location[1] + (cssY * devicePixelRatio).toInt()
        }
        val automation = InstrumentationRegistry.getInstrumentation().uiAutomation
        val downTime = SystemClock.uptimeMillis()
        val down = MotionEvent.obtain(
            downTime,
            downTime,
            MotionEvent.ACTION_DOWN,
            screenX.toFloat(),
            screenY.toFloat(),
            0,
        ).apply { source = InputDevice.SOURCE_TOUCHSCREEN }
        val up = MotionEvent.obtain(
            downTime,
            downTime + 50L,
            MotionEvent.ACTION_UP,
            screenX.toFloat(),
            screenY.toFloat(),
            0,
        ).apply { source = InputDevice.SOURCE_TOUCHSCREEN }
        try {
            assertTrue("UiAutomation must inject the IME probe touch-down", automation.injectInputEvent(down, true))
            assertTrue("UiAutomation must inject the IME probe touch-up", automation.injectInputEvent(up, true))
        } finally {
            down.recycle()
            up.recycle()
        }
    }

    private fun measureIme(scenario: ActivityScenario<MainActivity>): JSONObject {
        scenario.onActivity { activity ->
            val webView = findWebView(activity.window.decorView)!!
            webView.requestFocus()
            webView.requestFocusFromTouch()
            if (Build.VERSION.SDK_INT >= 36) {
                val task = (activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager)
                    .appTasks.firstOrNull { it.taskInfo.id == activity.taskId }
                assertNotNull("The AppFrame scenario must own an Android task", task)
                task!!.moveToFront()
            }
        }
        val windowFocusDeadline = SystemClock.elapsedRealtime() + 30_000L
        var webViewWindowFocused = false
        while (!webViewWindowFocused && SystemClock.elapsedRealtime() < windowFocusDeadline) {
            scenario.onActivity { activity ->
                webViewWindowFocused = findWebView(activity.window.decorView)!!.hasWindowFocus()
            }
            if (!webViewWindowFocused) SystemClock.sleep(100L)
        }
        if (!webViewWindowFocused) {
            var viewState = "unavailable"
            scenario.onActivity { activity ->
                val webView = findWebView(activity.window.decorView)!!
                viewState = "task=${activity.taskId}, " +
                    "decorAttached=${activity.window.decorView.isAttachedToWindow}, " +
                    "decorWindowFocus=${activity.window.decorView.hasWindowFocus()}, " +
                    "webViewAttached=${webView.isAttachedToWindow}, webViewWindowFocus=${webView.hasWindowFocus()}"
            }
            val windowDump = focusedWindowState()
            assertTrue("WebView window must have focus before the IME probe touch ($viewState; $windowDump)", false)
        }

        val beforeIme = snapshot(scenario)
        assertAppFrame(beforeIme)
        assertTrue(
            "IME baseline must have positive native and layout bounds: $beforeIme",
            beforeIme.getJSONObject("native").getInt("webViewHeightPx") > 0 && beforeIme.getDouble("layoutViewportHeight") > 0.0,
        )
        assertTrue("IME baseline must be unobstructed before the native probe: $beforeIme", abs(beforeIme.getDouble("imeBlockEnd")) <= 1.0)
        if (Build.VERSION.SDK_INT >= 30) {
            assertTrue("Native IME must be hidden before the probe: $beforeIme", !beforeIme.getJSONObject("native").getBoolean("imeVisible"))
        }

        val probe = JSONObject(
            decodedJavascriptString(
                evaluate(
                    scenario,
                    """
            (() => {
              let input = document.querySelector('#brandbuilder-ime-probe');
              if (!input) {
                input = document.createElement('textarea');
                input.id = 'brandbuilder-ime-probe';
                input.setAttribute('aria-label', 'BrandBuilder IME probe');
                input.style.position = 'fixed';
                input.style.left = '50%';
                input.style.top = '50%';
                input.style.width = '48px';
                input.style.height = '48px';
                input.style.transform = 'translate(-50%, -50%)';
                input.style.zIndex = '2147483647';
                document.body.append(input);
              }
              input.focus();
              input.click();
              const bounds = input.getBoundingClientRect();
              const x = bounds.left + bounds.width / 2;
              const y = bounds.top + bounds.height / 2;
              window.__brandbuilderImeTouchTarget = null;
              document.addEventListener('pointerdown', event => {
                window.__brandbuilderImeTouchTarget = event.target instanceof Element ? event.target.id : null;
              }, { once: true });
              return JSON.stringify({
                present: document.body.contains(input),
                focused: document.activeElement === input,
                hit: document.elementFromPoint(x, y) === input,
                x,
                y,
                devicePixelRatio: window.devicePixelRatio || 1
              });
            })()
                    """.trimIndent(),
                ),
            ),
        )
        assertTrue("IME probe must be present before the native request: $probe", probe.getBoolean("present"))
        assertTrue("IME probe must accept DOM focus before the native request: $probe", probe.getBoolean("focused"))
        assertTrue("IME probe must receive a touch at its center: $probe", probe.getBoolean("hit"))
        tapWebViewPoint(
            scenario,
            probe.getDouble("x"),
            probe.getDouble("y"),
            probe.getDouble("devicePixelRatio"),
        )
        SystemClock.sleep(250L)
        val touchTarget = decodedJavascriptString(evaluate(scenario, "window.__brandbuilderImeTouchTarget"))
        assertEquals("The injected touch must reach the IME probe: $probe", "brandbuilder-ime-probe", touchTarget)
        var imeShowRequested = false
        var imeRequestPath = "legacy-input-method-manager"
        var imeRequestAttempts = 0
        fun requestIme() {
            scenario.onActivity { activity ->
                val webView = findWebView(activity.window.decorView)!!
                val inputMethodManager =
                    activity.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                if (Build.VERSION.SDK_INT >= 30) {
                    imeRequestPath = "window-insets-controller+input-method-manager"
                    val controller = webView.windowInsetsController
                    controller?.show(WindowInsets.Type.ime())
                    // The injected touch is an explicit user gesture; implicit requests may be ignored.
                    val inputMethodManagerAccepted =
                        inputMethodManager.showSoftInput(webView, 0)
                    imeShowRequested = imeShowRequested || controller != null || inputMethodManagerAccepted
                } else {
                    imeShowRequested = imeShowRequested ||
                        inputMethodManager.showSoftInput(webView, InputMethodManager.SHOW_IMPLICIT)
                }
            }
            imeRequestAttempts += 1
        }

        requestIme()
        SystemClock.sleep(250L)
        val imeDeadline = SystemClock.elapsedRealtime() + 15_000L
        var imeSnapshot = snapshot(scenario)
        while (!imeGeometryObserved(beforeIme, imeSnapshot) && SystemClock.elapsedRealtime() < imeDeadline) {
            if (Build.VERSION.SDK_INT >= 30) requestIme()
            SystemClock.sleep(250L)
            imeSnapshot = snapshot(scenario)
        }
        assertAppFrame(imeSnapshot)
        assertTrue(
            "IME probe must retain DOM focus ($imeRequestPath accepted: $imeShowRequested after $imeRequestAttempts attempts): $imeSnapshot",
            imeSnapshot.getBoolean("imeProbeFocused"),
        )
        assertTrue(
            "A real native IME must contract WebView/layout bounds or obstruct the visual viewport ($imeRequestPath accepted: $imeShowRequested after $imeRequestAttempts attempts; before=$beforeIme): $imeSnapshot",
            imeGeometryObserved(beforeIme, imeSnapshot),
        )
        val remainingObstruction = visualImeObstruction(imeSnapshot)
        assertEquals(
            "AppFrame must reserve only remaining visual obstruction after native resize: $imeSnapshot",
            remainingObstruction,
            imeSnapshot.getDouble("imeBlockEnd"),
            1.0,
        )

        evaluate(
            scenario,
            "var probe = document.querySelector('#brandbuilder-ime-probe'); if (probe) { probe.blur(); probe.remove(); } true",
        )
        scenario.onActivity { activity ->
            val webView = findWebView(activity.window.decorView)!!
            if (Build.VERSION.SDK_INT >= 30) {
                webView.windowInsetsController?.hide(WindowInsets.Type.ime())
            } else {
                (activity.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
                    .hideSoftInputFromWindow(webView.windowToken, 0)
            }
        }
        val hiddenDeadline = SystemClock.elapsedRealtime() + 15_000L
        var hiddenSnapshot = snapshot(scenario)
        while (!imeGeometryRestored(beforeIme, hiddenSnapshot) && SystemClock.elapsedRealtime() < hiddenDeadline) {
            SystemClock.sleep(100L)
            hiddenSnapshot = snapshot(scenario)
        }
        assertTrue("Native/layout/visual IME bounds must restore before orientation evidence (before=$beforeIme): $hiddenSnapshot", imeGeometryRestored(beforeIme, hiddenSnapshot))
        assertAppFrame(hiddenSnapshot)
        return imeSnapshot
            .put("beforeIme", beforeIme)
            .put("afterIme", hiddenSnapshot)
            .put("nativeLayoutReduced", nativeLayoutReduced(beforeIme, imeSnapshot))
            .put("remainingVisualObstruction", remainingObstruction)
    }

    @Test
    fun appFrameOwnsActualAndroidWebViewGeometry() {
        assertCallbackDiagnosticsContainOnlyBoundedNativeState()
        assertTrue("reference API must be governed", Build.VERSION.SDK_INT == 24 || Build.VERSION.SDK_INT == 36)
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            assertEquals(
                "Android host must resize the WebView for IME geometry",
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE,
                activity.window.attributes.softInputMode and WindowManager.LayoutParams.SOFT_INPUT_MASK_ADJUST,
            )
        }
        waitForShell(scenario)

        waitForOrientation(
            scenario,
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT,
            Configuration.ORIENTATION_PORTRAIT,
        )
        val portrait = snapshot(scenario)
        assertAppFrame(portrait)
        val imeSnapshot = measureIme(scenario)

        waitForOrientation(
            scenario,
            ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE,
            Configuration.ORIENTATION_LANDSCAPE,
        )
        val landscape = snapshot(scenario)
        assertAppFrame(landscape)

        scenario.onActivity { activity ->
            findWebView(activity.window.decorView)!!.requestFocus()
        }
        assertEquals(
            "true",
            evaluate(
                scenario,
                "var trigger = document.querySelector('.application-menu-trigger'); if (trigger) trigger.click(); Boolean(trigger)",
            ),
        )
        SystemClock.sleep(100L)
        val openMenu = snapshot(scenario)
        assertAppFrame(openMenu)
        assertTrue("application menu must open in the actual WebView", openMenu.getBoolean("menuOpen"))
        assertTrue("open menu must remain inside the visual viewport", openMenu.getBoolean("popupInsideViewport"))
        evaluate(
            scenario,
            "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true",
        )

        waitForOrientation(
            scenario,
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT,
            Configuration.ORIENTATION_PORTRAIT,
        )

        var cutoutInsets = intArrayOf(0, 0, 0, 0)
        scenario.onActivity { activity ->
            val cutout = if (Build.VERSION.SDK_INT >= 28) activity.window.decorView.rootWindowInsets?.displayCutout else null
            if (Build.VERSION.SDK_INT >= 28) assertNotNull("API 36 emulator must expose the enabled display cutout", cutout)
            if (cutout != null) {
                cutoutInsets = intArrayOf(
                    cutout.safeInsetTop,
                    cutout.safeInsetRight,
                    cutout.safeInsetBottom,
                    cutout.safeInsetLeft,
                )
            }
        }
        val cutoutSnapshot = snapshot(scenario)
        assertAppFrame(cutoutSnapshot)
        if (Build.VERSION.SDK_INT >= 28) {
            assertTrue("enabled display cutout must expose a nonzero safe inset", cutoutInsets.any { it > 0 })
            assertTrue(
                "AppFrame must consume the WebView safe-area inset",
                listOf("framePaddingTop", "framePaddingRight", "framePaddingBottom", "framePaddingLeft")
                    .any { cutoutSnapshot.getDouble(it) > 0.0 },
            )
        }

        val evidence = JSONObject()
            .put("schema_version", 1)
            .put("api_level", Build.VERSION.SDK_INT)
            .put("actual_tauri_webview", true)
            .put("callback_diagnostics_contract", "pass")
            .put("portrait", portrait)
            .put("landscape", landscape)
            .put("open_menu", openMenu)
            .put("ime", imeSnapshot)
            .put("cutout_supported", Build.VERSION.SDK_INT >= 28)
            .put("cutout_safe_insets_px", JSONArray(cutoutInsets.toList()))
            .put("cutout", cutoutSnapshot)
        InstrumentationRegistry.getInstrumentation().sendStatus(
            0,
            Bundle().apply { putString("appframe_evidence", evidence.toString()) },
        )
    }
}
