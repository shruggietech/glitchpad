package com.shruggietech.glitchpad.source

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.io.FileNotFoundException

/** Android 7/8 clipboard services cannot reliably relay private-provider URI grants. Only explicitly copied, opaque text tokens are readable here. */
class LegacyClipboardTextProvider : ContentProvider() {
  companion object {
    fun uriForFile(context: Context, file: File): Uri = Uri.Builder().scheme("content")
      .authority(context.packageName + ".clipboard").appendPath(file.name).build()
  }

  override fun onCreate() = true

  private fun payload(uri: Uri): File {
    val owner = requireNotNull(context)
    if (uri.scheme != "content" || uri.authority != owner.packageName + ".clipboard" || uri.pathSegments.size != 1 || uri.query != null || uri.fragment != null)
      throw FileNotFoundException("Clipboard payload unavailable")
    return ClipboardTextStore(File(owner.filesDir, "clipboard")).resolveToken(uri.pathSegments.single())
  }

  override fun getType(uri: Uri): String { payload(uri); return "text/plain" }

  override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
    if (mode != "r") throw SecurityException("Clipboard payload is read-only")
    return ParcelFileDescriptor.open(payload(uri), ParcelFileDescriptor.MODE_READ_ONLY)
  }

  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor {
    val file = payload(uri)
    if (selection != null || selectionArgs != null || sortOrder != null) throw IllegalArgumentException("Clipboard queries do not select or enumerate files")
    val columns = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
    val values = columns.map { column -> when (column) {
      OpenableColumns.DISPLAY_NAME -> "Glitchpad clipboard.txt"
      OpenableColumns.SIZE -> file.length()
      else -> throw IllegalArgumentException("Unsupported clipboard column")
    } }.toTypedArray()
    return MatrixCursor(columns).apply { addRow(values) }
  }

  override fun insert(uri: Uri, values: ContentValues?): Uri = throw SecurityException("Clipboard payload is read-only")
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = throw SecurityException("Clipboard payload is read-only")
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = throw SecurityException("Clipboard payload is read-only")
}
