package com.shruggietech.glitchpad.shell

import android.content.pm.ActivityInfo
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.CoordinatesProvider
import androidx.test.espresso.action.GeneralClickAction
import androidx.test.espresso.action.Press
import androidx.test.espresso.action.Tap
import androidx.test.espresso.matcher.ViewMatchers.isAssignableFrom
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
        scenario.onActivity { activity ->
            val webView = findWebView(activity.window.decorView)
            assertNotNull("Tauri must host a real Android WebView", webView)
            webView!!.evaluateJavascript(script) { value ->
                result = value
                completed.countDown()
            }
        }
        assertTrue("WebView JavaScript evaluation timed out", completed.await(timeoutSeconds, TimeUnit.SECONDS))
        return result ?: "null"
    }

    private fun decodedJavascriptString(result: String): String =
        JSONArray("[$result]").getString(0)

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
        return JSONObject(decodedJavascriptString(result))
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
        cssX: Double,
        cssY: Double,
        devicePixelRatio: Double,
    ) {
        onView(isAssignableFrom(WebView::class.java)).perform(
            GeneralClickAction(
                Tap.SINGLE,
                CoordinatesProvider { view ->
                    val location = IntArray(2)
                    view.getLocationOnScreen(location)
                    floatArrayOf(
                        location[0] + (cssX * devicePixelRatio).toFloat(),
                        location[1] + (cssY * devicePixelRatio).toFloat(),
                    )
                },
                Press.FINGER,
            ),
        )
    }

    private fun measureIme(scenario: ActivityScenario<MainActivity>): JSONObject {
        var hasWindowFocus = false
        val focusDeadline = SystemClock.elapsedRealtime() + 15_000L
        while (!hasWindowFocus && SystemClock.elapsedRealtime() < focusDeadline) {
            scenario.onActivity { activity ->
                val webView = findWebView(activity.window.decorView)!!
                webView.requestFocus()
                webView.requestFocusFromTouch()
                hasWindowFocus = activity.hasWindowFocus()
            }
            if (!hasWindowFocus) SystemClock.sleep(100L)
        }
        assertTrue("Android host window must have focus before the WebView touch", hasWindowFocus)

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
              return JSON.stringify({
                present: document.body.contains(input),
                focused: document.activeElement === input,
                x: bounds.left + bounds.width / 2,
                y: bounds.top + bounds.height / 2,
                devicePixelRatio: window.devicePixelRatio || 1
              });
            })()
                    """.trimIndent(),
                ),
            ),
        )
        assertTrue("IME probe must be present before the native request: $probe", probe.getBoolean("present"))
        assertTrue("IME probe must accept DOM focus before the native request: $probe", probe.getBoolean("focused"))
        tapWebViewPoint(
            probe.getDouble("x"),
            probe.getDouble("y"),
            probe.getDouble("devicePixelRatio"),
        )
        SystemClock.sleep(250L)
        var imeShowRequested = false
        var imeRequestPath = "legacy-input-method-manager"
        scenario.onActivity { activity ->
            val webView = findWebView(activity.window.decorView)!!
            if (Build.VERSION.SDK_INT >= 30) {
                imeRequestPath = "window-insets-controller"
                val controller = webView.windowInsetsController
                imeShowRequested = controller != null
                controller?.show(WindowInsets.Type.ime())
            } else {
                imeShowRequested = (activity.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
                    .showSoftInput(webView, InputMethodManager.SHOW_IMPLICIT)
            }
        }
        val imeDeadline = SystemClock.elapsedRealtime() + 15_000L
        var imeSnapshot = snapshot(scenario)
        while (imeSnapshot.getDouble("imeBlockEnd") <= 0.0 && SystemClock.elapsedRealtime() < imeDeadline) {
            SystemClock.sleep(100L)
            imeSnapshot = snapshot(scenario)
        }
        assertAppFrame(imeSnapshot)
        assertTrue(
            "IME probe must retain DOM focus ($imeRequestPath accepted: $imeShowRequested): $imeSnapshot",
            imeSnapshot.getBoolean("imeProbeFocused"),
        )
        assertTrue(
            "IME must publish a positive AppFrame block-end inset ($imeRequestPath accepted: $imeShowRequested): $imeSnapshot",
            imeSnapshot.getDouble("imeBlockEnd") > 0.0,
        )

        evaluate(
            scenario,
            "document.querySelector('#brandbuilder-ime-probe')?.blur(); document.querySelector('#brandbuilder-ime-probe')?.remove(); true",
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
        while (hiddenSnapshot.getDouble("imeBlockEnd") > 0.0 && SystemClock.elapsedRealtime() < hiddenDeadline) {
            SystemClock.sleep(100L)
            hiddenSnapshot = snapshot(scenario)
        }
        assertTrue("IME inset must clear before orientation evidence: $hiddenSnapshot", hiddenSnapshot.getDouble("imeBlockEnd") <= 0.0)
        return imeSnapshot
    }

    @Test
    fun appFrameOwnsActualAndroidWebViewGeometry() {
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
