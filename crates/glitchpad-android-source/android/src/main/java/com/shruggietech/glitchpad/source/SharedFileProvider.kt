package com.shruggietech.glitchpad.source

import android.content.ClipDescription
import android.net.Uri
import androidx.core.content.FileProvider

/** Advertise the existing file representation to platform styled-text paste. URI grants and path checks remain owned by FileProvider. */
class SharedFileProvider : FileProvider() {
  override fun getStreamTypes(uri: Uri, mimeTypeFilter: String): Array<String>? {
    val type = getType(uri) ?: return null
    return if (ClipDescription.compareMimeTypes(type, mimeTypeFilter)) arrayOf(type) else null
  }
}
