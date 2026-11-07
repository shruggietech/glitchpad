package com.shruggietech.glitchpad.source

import androidx.activity.OnBackPressedCallback
import androidx.activity.OnBackPressedDispatcherOwner

/** Activity-owned native editing UI shares the existing Back route. */
interface AndroidNativeEditOwner {
  val androidNativeEditModeActive: Boolean
  fun dismissAndroidNativeEditMode(): Boolean
}

internal fun registerAndroidBackCallback(owner: OnBackPressedDispatcherOwner, callback: OnBackPressedCallback) {
  // Tauri reactivates its lifecycle callback on start. Matching that lifecycle keeps this later source route on top after every resume.
  owner.onBackPressedDispatcher.addCallback(owner, callback)
}

internal fun delegateAndroidBack(owner: OnBackPressedDispatcherOwner, callback: OnBackPressedCallback) {
  val enabled = callback.isEnabled
  callback.isEnabled = false
  try { owner.onBackPressedDispatcher.onBackPressed() }
  finally { callback.isEnabled = enabled }
}
