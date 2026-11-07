package com.shruggietech.glitchpad.source

import java.io.File
import java.io.IOException
import java.io.FileNotFoundException
import java.util.UUID

internal data class PreparedClipboardText(
  val inlineText: String?,
  val file: File?,
  internal val previousFiles: List<File>,
)

/** Keep large text out of Binder while preserving the clipboard until replacement succeeds. */
internal class ClipboardTextStore(private val directory: File) {
  companion object {
    const val MAX_INLINE_CODE_UNITS = 32 * 1024
    private val TOKEN_NAME = Regex("clip-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.txt")
  }

  fun prepare(text: String): PreparedClipboardText {
    // Snapshot before creating this payload. A later queued copy may already have a file when cleanup runs.
    val previous = directory.listFiles()?.filter { it.isFile && it.name.startsWith("clip-") && it.name.endsWith(".txt") } ?: emptyList()
    if (text.length <= MAX_INLINE_CODE_UNITS) return PreparedClipboardText(text, null, previous)
    if (!directory.isDirectory && !directory.mkdirs()) throw IOException("Clipboard text directory is unavailable")
    val file = File(directory, "clip-" + UUID.randomUUID().toString() + ".txt")
    if (!file.createNewFile()) throw IOException("Clipboard payload already exists")
    try {
      file.outputStream().bufferedWriter(Charsets.UTF_8).use { it.write(text) }
      return PreparedClipboardText(null, file, previous)
    } catch (error: Exception) {
      file.delete()
      throw error
    }
  }

  /** Resolve exactly one opaque copied-text token, never a directory, path, or linked file outside this store. */
  fun resolveToken(name: String): File {
    if (!TOKEN_NAME.matches(name)) throw FileNotFoundException("Clipboard payload unavailable")
    val file = File(directory, name)
    val canonical = file.canonicalFile
    if (canonical.parentFile != directory.canonicalFile || !canonical.isFile) throw FileNotFoundException("Clipboard payload unavailable")
    return canonical
  }

  /** Called only after setPrimaryClip succeeds; never removes a subsequently prepared payload. */
  fun retirePrevious(payload: PreparedClipboardText) {
    payload.previousFiles.forEach { file -> runCatching { file.delete() } }
  }

  fun discardUncommitted(payload: PreparedClipboardText) {
    payload.file?.let { file -> runCatching { file.delete() } }
  }
}
