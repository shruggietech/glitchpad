package com.shruggietech.glitchpad.source

import java.io.File
import java.io.IOException

internal data class PreparedClipboardText(
  val inlineText: String?,
  val file: File?,
  internal val previousFiles: List<File>,
)

/** Keep large text out of Binder while preserving the clipboard until replacement succeeds. */
internal class ClipboardTextStore(private val directory: File) {
  companion object {
    const val MAX_INLINE_CODE_UNITS = 32 * 1024
  }

  fun prepare(text: String): PreparedClipboardText {
    // Snapshot before creating this payload. A later queued copy may already have a file when cleanup runs.
    val previous = directory.listFiles()?.filter { it.isFile && it.name.startsWith("clip-") && it.name.endsWith(".txt") } ?: emptyList()
    if (text.length <= MAX_INLINE_CODE_UNITS) return PreparedClipboardText(text, null, previous)
    if (!directory.isDirectory && !directory.mkdirs()) throw IOException("Clipboard text directory is unavailable")
    val file = File.createTempFile("clip-", ".txt", directory)
    try {
      file.outputStream().bufferedWriter(Charsets.UTF_8).use { it.write(text) }
      return PreparedClipboardText(null, file, previous)
    } catch (error: Exception) {
      file.delete()
      throw error
    }
  }

  /** Called only after setPrimaryClip succeeds; never removes a subsequently prepared payload. */
  fun retirePrevious(payload: PreparedClipboardText) {
    payload.previousFiles.forEach { file -> runCatching { file.delete() } }
  }

  fun discardUncommitted(payload: PreparedClipboardText) {
    payload.file?.let { file -> runCatching { file.delete() } }
  }
}
