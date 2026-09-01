package com.shruggietech.glitchpad.source

import android.content.Context
import android.content.Intent
import android.net.Uri

class RestorationStore(context: Context) {
  private val preferences = context.getSharedPreferences(STORE, Context.MODE_PRIVATE)

  fun canPut(uri: Uri): Boolean {
    val current = preferences.getStringSet(RECORDS, emptySet()).orEmpty()
    return current.any { it.substringAfter('|', "") == uri.toString() } || current.size < MAX_RESTORATION_RECORDS
  }

  fun put(uri: Uri, modes: Int): Boolean {
    val current = preferences.getStringSet(RECORDS, emptySet()).orEmpty().toMutableSet()
    val encoded = "$modes|$uri"
    val updated = updatedRestorationRecords(current, encoded, uri.toString()) ?: return false
    return preferences.edit().putStringSet(RECORDS, updated).commit()
  }

  fun remove(uri: Uri) {
    val current = preferences.getStringSet(RECORDS, emptySet()).orEmpty().toMutableSet()
    current.removeAll { it.substringAfter('|', "") == uri.toString() }
    preferences.edit().putStringSet(RECORDS, current).commit()
  }

  fun records(): List<Pair<Uri, Int>> = preferences
    .getStringSet(RECORDS, emptySet())
    .orEmpty()
    .take(MAX_RESTORATION_RECORDS)
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
  }
}

internal fun updatedRestorationRecords(
  current: Set<String>,
  encoded: String,
  uri: String,
  maximum: Int = MAX_RESTORATION_RECORDS,
): Set<String>? {
  val replacing = current.any { it.substringAfter('|', "") == uri }
  if (!replacing && current.size >= maximum) return null
  return current.filterNotTo(mutableSetOf()) { it.substringAfter('|', "") == uri }.apply { add(encoded) }
}

private const val MAX_RESTORATION_RECORDS = 64
