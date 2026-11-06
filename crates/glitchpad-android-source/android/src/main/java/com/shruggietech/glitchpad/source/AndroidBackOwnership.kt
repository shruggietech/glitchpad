package com.shruggietech.glitchpad.source

import androidx.activity.OnBackPressedCallback
import androidx.activity.OnBackPressedDispatcherOwner

internal fun registerAndroidBackCallback(owner: OnBackPressedDispatcherOwner, callback: OnBackPressedCallback) {
  // Tauri reactivates its lifecycle callback on start. Matching that lifecycle keeps this later source route on top after every resume.
  owner.onBackPressedDispatcher.addCallback(owner, callback)
}
