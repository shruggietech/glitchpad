package com.shruggietech.glitchpad.source

import androidx.activity.BackEventCompat
import androidx.activity.OnBackPressedCallback
import androidx.activity.OnBackPressedDispatcher
import androidx.activity.OnBackPressedDispatcherOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidBackOwnershipTest {
  private class Owner : OnBackPressedDispatcherOwner {
    var fallback = 0
    override val onBackPressedDispatcher = OnBackPressedDispatcher(Runnable { fallback++ })
    val registry = LifecycleRegistry.createUnsafe(this)
    override val lifecycle: Lifecycle get() = registry
    init { registry.handleLifecycleEvent(Lifecycle.Event.ON_CREATE) }
  }
  private class Callback : OnBackPressedCallback(true) {
    var started = 0; var progressed = 0; var cancelled = 0; var committed = 0
    override fun handleOnBackStarted(backEvent: BackEventCompat) { started++ }
    override fun handleOnBackProgressed(backEvent: BackEventCompat) { progressed++ }
    override fun handleOnBackCancelled() { cancelled++ }
    override fun handleOnBackPressed() { committed++ }
  }
  private fun gesture(owner: Owner) {
    owner.onBackPressedDispatcher.dispatchOnBackStarted(BackEventCompat(0f, 100f, 0f, BackEventCompat.EDGE_LEFT))
    owner.onBackPressedDispatcher.dispatchOnBackProgressed(BackEventCompat(80f, 100f, 0.5f, BackEventCompat.EDGE_LEFT))
    owner.onBackPressedDispatcher.dispatchOnBackCancelled()
  }
  @Test fun sourceOwnsPredictiveCallbacksAfterFrameworkLifecycleActivation() {
    val owner = Owner(); val framework = Callback(); val source = Callback()
    owner.onBackPressedDispatcher.addCallback(owner, framework)
    registerAndroidBackCallback(owner, source)
    owner.registry.handleLifecycleEvent(Lifecycle.Event.ON_START)
    gesture(owner)
    assertEquals(1, source.started); assertEquals(1, source.progressed); assertEquals(1, source.cancelled)
    assertEquals(0, framework.started); assertEquals(0, source.committed)
    owner.onBackPressedDispatcher.onBackPressed()
    assertEquals(1, source.committed); assertEquals(0, framework.committed)
  }
  @Test fun stopResumeAndDestroyPreserveOneOwnedRouteAndFallback() {
    val owner = Owner(); val framework = Callback(); val source = Callback()
    owner.onBackPressedDispatcher.addCallback(owner, framework)
    registerAndroidBackCallback(owner, source)
    owner.registry.handleLifecycleEvent(Lifecycle.Event.ON_START)
    owner.registry.handleLifecycleEvent(Lifecycle.Event.ON_STOP)
    owner.onBackPressedDispatcher.onBackPressed()
    assertEquals(1, owner.fallback); assertEquals(0, source.committed)
    owner.registry.handleLifecycleEvent(Lifecycle.Event.ON_START)
    gesture(owner)
    assertEquals(1, source.started); assertEquals(1, source.progressed); assertEquals(1, source.cancelled)
    delegateAndroidBack(owner, source)
    assertEquals(1, framework.committed); assertEquals(0, source.committed)
    assertTrue(source.isEnabled)
    owner.onBackPressedDispatcher.onBackPressed()
    assertEquals(1, source.committed)
    owner.registry.handleLifecycleEvent(Lifecycle.Event.ON_STOP)
    owner.registry.handleLifecycleEvent(Lifecycle.Event.ON_DESTROY)
    owner.onBackPressedDispatcher.onBackPressed()
    assertEquals(2, owner.fallback); assertEquals(1, source.committed)
  }
  @Test fun fallbackFailureRestoresTheExistingSourceRoute() {
    val owner = Owner(); val source = Callback(); val failure = IllegalStateException("controlled fallback")
    owner.onBackPressedDispatcher.addCallback(owner, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() { throw failure }
    })
    registerAndroidBackCallback(owner, source)
    owner.registry.handleLifecycleEvent(Lifecycle.Event.ON_START)
    assertSame(failure, runCatching { delegateAndroidBack(owner, source) }.exceptionOrNull())
    assertTrue(source.isEnabled)
    owner.onBackPressedDispatcher.onBackPressed()
    assertEquals(1, source.committed)
  }
}
