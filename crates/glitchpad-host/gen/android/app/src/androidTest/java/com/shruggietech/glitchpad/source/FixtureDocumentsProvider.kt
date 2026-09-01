package com.shruggietech.glitchpad.source

import android.database.Cursor
import android.database.MatrixCursor
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract.Document
import android.provider.DocumentsContract.Root
import android.provider.DocumentsProvider
import java.io.File
import java.io.FileNotFoundException

class FixtureDocumentsProvider : DocumentsProvider() {
  private val rootId = "fixture-root"

  override fun onCreate(): Boolean {
    val directory = fixtureDirectory()
    directory.mkdirs()
    File(directory, "seekable.txt").writeText("seekable fixture payload", Charsets.UTF_8)
    File(directory, "unknown-size.txt").writeText("unknown size payload", Charsets.UTF_8)
    File(directory, "pipe.txt").writeText("pipe fixture payload", Charsets.UTF_8)
    return true
  }

  override fun queryRoots(projection: Array<out String>?): Cursor {
    val columns = projection ?: ROOT_COLUMNS
    return MatrixCursor(columns).apply {
      newRow().apply {
        add(Root.COLUMN_ROOT_ID, rootId)
        add(Root.COLUMN_DOCUMENT_ID, rootId)
        add(Root.COLUMN_TITLE, "Glitchpad fixtures")
        add(Root.COLUMN_FLAGS, Root.FLAG_SUPPORTS_CREATE)
        add(Root.COLUMN_MIME_TYPES, "text/plain")
        add(Root.COLUMN_AVAILABLE_BYTES, fixtureDirectory().usableSpace)
      }
    }
  }

  override fun queryDocument(documentId: String, projection: Array<out String>?): Cursor =
    MatrixCursor(projection ?: DOCUMENT_COLUMNS).apply { includeDocument(this, documentId) }

  override fun queryChildDocuments(
    parentDocumentId: String,
    projection: Array<out String>?,
    sortOrder: String?,
  ): Cursor = MatrixCursor(projection ?: DOCUMENT_COLUMNS).apply {
    if (parentDocumentId != rootId) throw FileNotFoundException(parentDocumentId)
    fixtureDirectory().listFiles().orEmpty().sortedBy(File::getName).forEach {
      includeDocument(this, it.name)
    }
  }

  override fun getDocumentType(documentId: String): String =
    if (documentId == rootId) Document.MIME_TYPE_DIR else "text/plain"

  override fun openDocument(
    documentId: String,
    mode: String,
    signal: CancellationSignal?,
  ): ParcelFileDescriptor {
    signal?.throwIfCanceled()
    val file = documentFile(documentId)
    if (documentId == "pipe.txt" && !mode.contains("w")) {
      val (readSide, writeSide) = ParcelFileDescriptor.createPipe()
      Thread {
        ParcelFileDescriptor.AutoCloseOutputStream(writeSide).use { output ->
          output.write(file.readBytes())
        }
      }.start()
      return readSide
    }
    val access = when {
      mode.contains("w") -> ParcelFileDescriptor.MODE_READ_WRITE or ParcelFileDescriptor.MODE_CREATE
      else -> ParcelFileDescriptor.MODE_READ_ONLY
    }
    return ParcelFileDescriptor.open(file, access)
  }

  override fun createDocument(parentDocumentId: String, mimeType: String, displayName: String): String {
    if (parentDocumentId != rootId || mimeType != "text/plain") {
      throw FileNotFoundException(parentDocumentId)
    }
    val safeName = displayName.replace(Regex("[^A-Za-z0-9._ -]"), "_").take(80)
    val file = File(fixtureDirectory(), safeName.ifBlank { "untitled.txt" })
    file.createNewFile()
    return file.name
  }

  override fun renameDocument(documentId: String, displayName: String): String {
    val source = documentFile(documentId)
    val target = File(fixtureDirectory(), displayName.replace(Regex("[^A-Za-z0-9._ -]"), "_").take(80))
    if (!source.renameTo(target)) throw IllegalStateException("rename_failed")
    return target.name
  }

  override fun deleteDocument(documentId: String) {
    if (!documentFile(documentId).delete()) throw IllegalStateException("delete_failed")
  }

  private fun includeDocument(cursor: MatrixCursor, documentId: String) {
    val row = cursor.newRow()
    if (documentId == rootId) {
      row.add(Document.COLUMN_DOCUMENT_ID, rootId)
      row.add(Document.COLUMN_DISPLAY_NAME, "Glitchpad fixtures")
      row.add(Document.COLUMN_MIME_TYPE, Document.MIME_TYPE_DIR)
      row.add(Document.COLUMN_FLAGS, Document.FLAG_DIR_SUPPORTS_CREATE)
      return
    }
    val file = documentFile(documentId)
    row.add(Document.COLUMN_DOCUMENT_ID, file.name)
    row.add(Document.COLUMN_DISPLAY_NAME, file.name)
    row.add(Document.COLUMN_MIME_TYPE, "text/plain")
    row.add(Document.COLUMN_FLAGS, Document.FLAG_SUPPORTS_WRITE or Document.FLAG_SUPPORTS_RENAME or Document.FLAG_SUPPORTS_DELETE)
    if (file.name != "unknown-size.txt") row.add(Document.COLUMN_SIZE, file.length())
    row.add(Document.COLUMN_LAST_MODIFIED, file.lastModified())
  }

  private fun fixtureDirectory(): File = File(requireNotNull(context).filesDir, "document-provider-fixtures")

  private fun documentFile(documentId: String): File {
    if (documentId == rootId || documentId.contains('/') || documentId.contains('\\')) {
      throw FileNotFoundException(documentId)
    }
    return File(fixtureDirectory(), documentId).takeIf(File::exists)
      ?: throw FileNotFoundException(documentId)
  }

  companion object {
    private val ROOT_COLUMNS = arrayOf(
      Root.COLUMN_ROOT_ID,
      Root.COLUMN_DOCUMENT_ID,
      Root.COLUMN_TITLE,
      Root.COLUMN_FLAGS,
      Root.COLUMN_MIME_TYPES,
      Root.COLUMN_AVAILABLE_BYTES,
    )
    private val DOCUMENT_COLUMNS = arrayOf(
      Document.COLUMN_DOCUMENT_ID,
      Document.COLUMN_DISPLAY_NAME,
      Document.COLUMN_MIME_TYPE,
      Document.COLUMN_FLAGS,
      Document.COLUMN_SIZE,
      Document.COLUMN_LAST_MODIFIED,
    )
  }
}
