package com.shruggietech.glitchpad.source

import android.app.Activity
import android.content.Intent
import android.net.Uri

internal class RestorationStore(activity: Activity) {
  private val preferences = activity.getSharedPreferences(STORE, Activity.MODE_PRIVATE)

  fun put(uri: Uri, modes: Int) {
    val current = preferences.getStringSet(RECORDS, emptySet()).orEmpty().toMutableSet()
    val encoded = "$modes|$uri"
    current.removeAll { it.substringAfter('|', "") == uri.toString() }
    current.add(encoded)
    while (current.size > MAX_RECORDS) current.remove(current.first())
    preferences.edit().putStringSet(RECORDS, current).apply()
  }

  fun remove(uri: Uri) {
    val current = preferences.getStringSet(RECORDS, emptySet()).orEmpty().toMutableSet()
    current.removeAll { it.substringAfter('|', "") == uri.toString() }
    preferences.edit().putStringSet(RECORDS, current).apply()
  }

  fun records(): List<Pair<Uri, Int>> = preferences
    .getStringSet(RECORDS, emptySet())
    .orEmpty()
    .take(MAX_RECORDS)
    .mapNotNull { value ->
      val separator = value.indexOf('|')
      if (separator <= 0) return@mapNotNull null
      val modes = value.substring(0, separator).toIntOrNull() ?: return@mapNotNull null
      val uri = Uri.parse(value.substring(separator + 1))
      if (uri.scheme != "content" || modes and Intent.FLAG_GRANT_READ_URI_PERMISSION == 0) null
      else uri to modes
    }

  companion object {
    private const val STORE = "glitchpad_android_sources"
    private const val RECORDS = "persisted_sources_v1"
    private const val MAX_RECORDS = 64
  }
}
