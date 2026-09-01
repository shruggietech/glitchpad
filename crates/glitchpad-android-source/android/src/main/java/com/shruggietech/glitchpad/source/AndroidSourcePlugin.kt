package com.shruggietech.glitchpad.source

import android.app.Activity
import android.content.Intent
import android.content.UriPermission
import android.database.Cursor
import android.net.Uri
import android.os.CancellationSignal
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.system.Os
import android.system.OsConstants
import android.webkit.WebView
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.FileInputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@TauriPlugin
class AndroidSourcePlugin(private val activity: Activity) : Plugin(activity) {
  private val ioExecutor = Executors.newSingleThreadExecutor()
  private val pending = ConcurrentLinkedQueue<DeliveryCandidate>()
  private val rejections = ConcurrentLinkedQueue<String>()
  private val sources = ConcurrentHashMap<String, NativeSource>()
  private val streams = ConcurrentHashMap<String, NativeStream>()
  private val restoration = RestorationStore(activity)

  override fun load(webView: WebView) {
    super.load(webView)
    if (initialIntentConsumed.compareAndSet(false, true)) enqueueInbound(activity.intent)
  }

  override fun onNewIntent(intent: Intent) {
    enqueueInbound(intent)
  }

  @Command
  fun drainDeliveries(invoke: Invoke) {
    val maximum = invoke.parseArgs(DrainArgs::class.java).maximum.coerceIn(1, MAX_QUEUE_DRAIN)
    ioExecutor.execute {
      val deliveries = JSArray()
      repeat(maximum) {
        val candidate = pending.poll() ?: return@repeat
        acquire(candidate).onSuccess(deliveries::put).onFailure { rejections.add(code(it)) }
      }
      val rejected = JSArray()
      repeat(maximum) {
        val rejection = rejections.poll() ?: return@repeat
        rejected.put(JSObject().put("code", rejection).put("retryable", rejection == "provider_unavailable"))
      }
      invoke.resolve(JSObject().put("deliveries", deliveries).put("rejections", rejected))
    }
  }

  @Command
  fun openDocument(invoke: Invoke) {
    val args = invoke.parseArgs(PickerArgs::class.java)
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
      .addCategory(Intent.CATEGORY_OPENABLE)
      .setType(args.mediaType?.takeIf(String::isNotBlank) ?: "*/*")
      .addFlags(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or
          Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
          Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
      )
    startActivityForResult(invoke, intent, "openDocumentResult")
  }

  @ActivityCallback
  fun openDocumentResult(invoke: Invoke, result: ActivityResult) {
    if (result.resultCode == Activity.RESULT_CANCELED) return invoke.reject("picker_cancelled")
    if (result.resultCode != Activity.RESULT_OK) return invoke.reject("picker_failed")
    ioExecutor.execute {
      DeliveryPolicy.pickerResult(result.data, DeliveryKind.OPEN_RESULT)
        .flatMap(::acquire)
        .onSuccess(invoke::resolve)
        .onFailure { invoke.reject(code(it)) }
    }
  }

  @Command
  fun readRange(invoke: Invoke) {
    val args = invoke.parseArgs(ReadArgs::class.java)
    if (args.offset < 0 || args.length < 0 || args.length > MAX_CHUNK_BYTES) {
      return invoke.reject("budget_exceeded")
    }
    val source = sources[args.bridgeToken] ?: return invoke.reject("source_not_found")
    ioExecutor.execute {
      runCatching {
        activity.contentResolver.openFileDescriptor(source.uri, "r", CancellationSignal())?.use { descriptor ->
          if (args.offset > 0) Os.lseek(descriptor.fileDescriptor, args.offset, OsConstants.SEEK_SET)
          val requested = args.length.toInt()
          val output = ByteArray(requested)
          var consumed = 0
          FileInputStream(descriptor.fileDescriptor).use { stream ->
            while (consumed < requested) {
              val read = stream.read(output, consumed, requested - consumed)
              if (read < 0) break
              consumed += read
            }
          }
          val bytes = JSArray()
          output.copyOf(consumed).forEach { bytes.put(it.toInt() and 0xff) }
          JSObject().put("bytes", bytes).put("endOfSource", consumed < requested)
        } ?: throw IllegalStateException("provider_unavailable")
      }.onSuccess(invoke::resolve).onFailure { invoke.reject(code(it)) }
    }
  }

  @Command
  fun revalidate(invoke: Invoke) {
    val args = invoke.parseArgs(TokenArgs::class.java)
    val source = sources[args.bridgeToken] ?: return invoke.reject("source_not_found")
    ioExecutor.execute {
      acquireSnapshot(source).onSuccess(invoke::resolve).onFailure { invoke.reject(code(it)) }
    }
  }

  @Command
  fun openStream(invoke: Invoke) {
    val args = invoke.parseArgs(OpenStreamArgs::class.java)
    if (args.offset < 0 || args.totalBudget <= 0 || args.offset > Long.MAX_VALUE - args.totalBudget) {
      return invoke.reject("budget_exceeded")
    }
    val source = sources[args.bridgeToken] ?: return invoke.reject("source_not_found")
    ioExecutor.execute {
      runCatching {
        val descriptor = activity.contentResolver.openFileDescriptor(source.uri, "r", CancellationSignal())
          ?: throw IllegalStateException("provider_unavailable")
        try {
          if (args.offset > 0) Os.lseek(descriptor.fileDescriptor, args.offset, OsConstants.SEEK_SET)
          val token = UUID.randomUUID().toString()
          streams[token] = NativeStream(
            token = token,
            sourceToken = source.token,
            descriptor = descriptor,
            input = FileInputStream(descriptor.fileDescriptor),
            remaining = args.totalBudget,
          )
          JSObject().put("streamToken", token)
        } catch (error: Throwable) {
          descriptor.close()
          throw error
        }
      }.onSuccess(invoke::resolve).onFailure { invoke.reject(code(it)) }
    }
  }

  @Command
  fun readStream(invoke: Invoke) {
    val args = invoke.parseArgs(ReadStreamArgs::class.java)
    if (args.length <= 0 || args.length > MAX_CHUNK_BYTES) return invoke.reject("budget_exceeded")
    ioExecutor.execute {
      val stream = streams[args.streamToken] ?: return@execute invoke.reject("stream_not_found")
      if (args.length > stream.remaining) return@execute invoke.reject("budget_exceeded")
      runCatching {
        val requested = args.length.toInt()
        val output = ByteArray(requested)
        var consumed = 0
        while (consumed < requested) {
          val read = stream.input.read(output, consumed, requested - consumed)
          if (read < 0) break
          consumed += read
        }
        stream.remaining -= consumed.toLong()
        val terminal = consumed < requested || stream.remaining == 0L
        if (terminal) streams.remove(stream.token)?.close()
        val bytes = JSArray()
        output.copyOf(consumed).forEach { bytes.put(it.toInt() and 0xff) }
        JSObject().put("bytes", bytes).put("endOfSource", consumed < requested)
      }.onSuccess(invoke::resolve).onFailure {
        streams.remove(stream.token)?.close()
        invoke.reject(code(it))
      }
    }
  }

  @Command
  fun closeStream(invoke: Invoke) {
    val args = invoke.parseArgs(StreamTokenArgs::class.java)
    streams.remove(args.streamToken)?.close()
      ?: return invoke.reject("stream_not_found")
    invoke.resolve()
  }

  @Command
  fun restore(invoke: Invoke) {
    ioExecutor.execute {
      val deliveries = JSArray()
      val rejected = JSArray()
      restoration.records().forEach { (uri, modes) ->
        val held = activity.contentResolver.persistedUriPermissions.any { permission ->
          permission.uri == uri && permission.isReadPermission
        }
        if (!held) {
          restoration.remove(uri)
          rejected.put(JSObject().put("code", "permission_revoked").put("retryable", true))
        } else {
          val candidate = DeliveryCandidate(
            uri,
            DeliveryKind.OPEN_RESULT,
            readOffered = modes and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0,
            writeOffered = modes and Intent.FLAG_GRANT_WRITE_URI_PERMISSION != 0,
            persistenceOffered = true,
          )
          acquire(candidate).onSuccess(deliveries::put).onFailure {
            rejected.put(JSObject().put("code", code(it)).put("retryable", true))
          }
        }
      }
      invoke.resolve(JSObject().put("deliveries", deliveries).put("rejections", rejected))
    }
  }

  @Command
  fun saveAs(invoke: Invoke) {
    val args = invoke.parseArgs(PickerArgs::class.java)
    if ((args.bytes?.size ?: 0) > MAX_SAVE_BYTES) return invoke.reject("budget_exceeded")
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
      .addCategory(Intent.CATEGORY_OPENABLE)
      .setType(args.mediaType?.takeIf(String::isNotBlank) ?: "application/octet-stream")
      .putExtra(Intent.EXTRA_TITLE, args.suggestedName?.take(MAX_NAME_CHARS) ?: "document")
      .addFlags(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or
          Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
          Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
      )
    startActivityForResult(invoke, intent, "saveAsResult")
  }

  @ActivityCallback
  fun saveAsResult(invoke: Invoke, result: ActivityResult) {
    if (result.resultCode == Activity.RESULT_CANCELED) return invoke.reject("picker_cancelled")
    if (result.resultCode != Activity.RESULT_OK) return invoke.reject("picker_failed")
    val args = invoke.parseArgs(PickerArgs::class.java)
    val bytes = args.bytes?.map(Int::toByte)?.toByteArray() ?: ByteArray(0)
    ioExecutor.execute {
      DeliveryPolicy.pickerResult(result.data, DeliveryKind.CREATE_RESULT).flatMap { candidate ->
        runCatching {
          activity.contentResolver.openFileDescriptor(candidate.uri, "w", CancellationSignal())?.use { descriptor ->
            descriptor.fileDescriptor.let { fileDescriptor ->
              java.io.FileOutputStream(fileDescriptor).use { stream ->
                stream.write(bytes)
                stream.flush()
                fileDescriptor.sync()
              }
              descriptor.checkError()
            }
          } ?: throw IllegalStateException("provider_unavailable")
          val observed = activity.contentResolver.openInputStream(candidate.uri)?.use { input ->
            input.readBytes(MAX_SAVE_BYTES + 1)
          } ?: throw IllegalStateException("provider_unavailable")
          if (!observed.contentEquals(bytes)) throw IllegalStateException("write_verification_failed")
          acquire(candidate).getOrThrow() to bytes.size
        }
      }.onSuccess { (delivery, count) ->
        invoke.resolve(JSObject().put("delivery", delivery).put("byteCount", count))
      }.onFailure { invoke.reject(code(it)) }
    }
  }

  @Command
  fun close(invoke: Invoke) {
    val args = invoke.parseArgs(TokenArgs::class.java)
    val source = sources.remove(args.bridgeToken) ?: return invoke.reject("source_not_found")
    streams.entries.removeIf { (_, stream) ->
      if (stream.sourceToken == source.token) {
        stream.close()
        true
      } else {
        false
      }
    }
    if (source.persistedRead || source.persistedWrite) {
      var modes = 0
      if (source.persistedRead) modes = modes or Intent.FLAG_GRANT_READ_URI_PERMISSION
      if (source.persistedWrite) modes = modes or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
      runCatching { activity.contentResolver.releasePersistableUriPermission(source.uri, modes) }
      restoration.remove(source.uri)
    }
    invoke.resolve()
  }

  @Command
  fun discard(invoke: Invoke) {
    val args = invoke.parseArgs(TokenArgs::class.java)
    val source = sources.remove(args.bridgeToken) ?: return invoke.reject("source_not_found")
    streams.entries.removeIf { (_, stream) ->
      if (stream.sourceToken == source.token) {
        stream.close()
        true
      } else {
        false
      }
    }
    invoke.resolve()
  }

  private fun enqueueInbound(intent: Intent?) {
    DeliveryPolicy.inbound(intent).onSuccess(pending::add).onFailure { rejections.add(code(it)) }
  }

  private fun acquire(candidate: DeliveryCandidate): Result<JSObject> = runCatching {
    val persistModes = DeliveryPolicy.persistableModes(candidate)
    val previousPermission = if (persistModes != 0) persistedPermission(candidate.uri) else null
    if (persistModes != 0) runCatching {
      activity.contentResolver.takePersistableUriPermission(candidate.uri, persistModes)
    }
    // Inbound VIEW and SEND grants are always temporary, even if the same URI was
    // persisted earlier through the document picker.
    val persisted = if (persistModes != 0) persistedPermission(candidate.uri) else null
    val source = NativeSource(
      token = UUID.randomUUID().toString(),
      uri = candidate.uri,
      kind = candidate.kind,
      readGranted = candidate.readOffered,
      writeGranted = candidate.writeOffered,
      persistedRead = persisted?.isReadPermission == true,
      persistedWrite = persisted?.isWritePermission == true,
    )
    if (!source.readGranted && candidate.kind != DeliveryKind.CREATE_RESULT) {
      throw SecurityException("read_authority_required")
    }
    sources[source.token] = source
    val snapshot = acquireSnapshot(source).getOrElse {
      sources.remove(source.token)
      val newlyPersistedModes = permissionModes(persisted) and permissionModes(previousPermission).inv()
      if (newlyPersistedModes != 0) {
        runCatching { activity.contentResolver.releasePersistableUriPermission(candidate.uri, newlyPersistedModes) }
      }
      if (permissionModes(previousPermission) == 0) restoration.remove(candidate.uri)
      throw it
    }
    val heldModes = permissionModes(persisted)
    if (heldModes != 0) restoration.put(candidate.uri, heldModes)
    snapshot
  }

  private fun persistedPermission(uri: Uri): UriPermission? =
    activity.contentResolver.persistedUriPermissions.firstOrNull { it.uri == uri }

  private fun permissionModes(permission: UriPermission?): Int {
    var modes = 0
    if (permission?.isReadPermission == true) modes = modes or Intent.FLAG_GRANT_READ_URI_PERMISSION
    if (permission?.isWritePermission == true) modes = modes or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    return modes
  }

  private fun acquireSnapshot(source: NativeSource): Result<JSObject> = runCatching {
    val metadata = queryMetadata(source.uri)
    if (metadata.mimeType == DocumentsContract.Document.MIME_TYPE_DIR) {
      throw IllegalArgumentException("directory_unsupported")
    }
    if (metadata.flags and DocumentsContract.Document.FLAG_VIRTUAL_DOCUMENT != 0) {
      throw IllegalArgumentException("virtual_document_unsupported")
    }
    val documentIdentity = runCatching {
      val authority = requireNotNull(source.uri.authority?.takeIf(String::isNotBlank))
      val documentId = DocumentsContract.getDocumentId(source.uri).takeIf(String::isNotBlank)
        ?: throw IllegalArgumentException()
      if (!DocumentsContract.isDocumentUri(activity, source.uri)) throw IllegalArgumentException()
      authority to documentId
    }.getOrNull()
    val identityToken = documentIdentity?.second ?: source.token
    val seekable = runCatching {
      activity.contentResolver.openFileDescriptor(source.uri, "r", CancellationSignal())?.use {
        Os.lseek(it.fileDescriptor, 0, OsConstants.SEEK_CUR)
      } ?: throw IllegalStateException()
      true
    }.getOrDefault(false)
    JSObject()
      .put("bridgeToken", source.token)
      .put("deliveryKind", source.kind.wireName)
      .put("identityScope", documentIdentity?.first?.take(MAX_IDENTITY_CHARS) ?: "temporary")
      .put("identityToken", identityToken.take(MAX_IDENTITY_CHARS))
      .put("identityStrength", if (documentIdentity != null) "strong" else "weak")
      .put("displayName", metadata.displayName.take(MAX_NAME_CHARS))
      .put("mediaType", metadata.mimeType?.take(MAX_MEDIA_TYPE_CHARS))
      .put("byteLength", metadata.size)
      .put("modifiedUnixMs", metadata.modified)
      .put("readGranted", source.readGranted)
      .put("writeGranted", source.writeGranted)
      .put("persistedRead", source.persistedRead)
      .put("persistedWrite", source.persistedWrite)
      .put("seekable", seekable)
  }

  private fun queryMetadata(uri: Uri): ProviderMetadata {
    val projection = arrayOf(
      OpenableColumns.DISPLAY_NAME,
      OpenableColumns.SIZE,
      DocumentsContract.Document.COLUMN_LAST_MODIFIED,
      DocumentsContract.Document.COLUMN_FLAGS,
    )
    val cursor = activity.contentResolver.query(uri, projection, null, null, null, CancellationSignal())
      ?: throw IllegalStateException("provider_unavailable")
    cursor.use {
      if (!it.moveToFirst()) throw IllegalStateException("provider_unavailable")
      return ProviderMetadata(
        displayName = it.optionalString(OpenableColumns.DISPLAY_NAME) ?: "Untitled document",
        size = it.optionalLong(OpenableColumns.SIZE),
        modified = it.optionalLong(DocumentsContract.Document.COLUMN_LAST_MODIFIED),
        flags = it.optionalLong(DocumentsContract.Document.COLUMN_FLAGS)?.toInt() ?: 0,
        mimeType = activity.contentResolver.getType(uri),
      )
    }
  }

  private fun Cursor.optionalString(column: String): String? =
    getColumnIndex(column).takeIf { it >= 0 && !isNull(it) }?.let(::getString)

  private fun Cursor.optionalLong(column: String): Long? =
    getColumnIndex(column).takeIf { it >= 0 && !isNull(it) }?.let(::getLong)

  private fun code(error: Throwable): String = when (error) {
    is SecurityException -> "permission_revoked"
    is IllegalArgumentException -> error.message?.takeIf(SAFE_CODES::contains) ?: "invalid_input"
    else -> error.message?.takeIf(SAFE_CODES::contains) ?: "provider_unavailable"
  }

  private data class ProviderMetadata(
    val displayName: String,
    val size: Long?,
    val modified: Long?,
    val flags: Int,
    val mimeType: String?,
  )

  companion object {
    private const val MAX_QUEUE_DRAIN = 64
    private const val MAX_CHUNK_BYTES = 1024L * 1024L
    private const val MAX_SAVE_BYTES = 16 * 1024 * 1024
    private const val MAX_NAME_CHARS = 256
    private const val MAX_MEDIA_TYPE_CHARS = 128
    private const val MAX_IDENTITY_CHARS = 512
    private val initialIntentConsumed = AtomicBoolean(false)
    private val SAFE_CODES = setOf(
      "missing_delivery", "unsupported_action", "invalid_source_shape", "read_authority_required",
      "missing_picker_source", "invalid_source_scheme", "directory_unsupported",
      "virtual_document_unsupported", "provider_unavailable", "write_verification_failed",
    )
  }
}

private inline fun <T, R> Result<T>.flatMap(transform: (T) -> Result<R>): Result<R> =
  fold(transform, Result.Companion::failure)

private fun java.io.InputStream.readBytes(maximum: Int): ByteArray {
  val output = java.io.ByteArrayOutputStream()
  val buffer = ByteArray(8192)
  while (output.size() <= maximum) {
    val read = read(buffer)
    if (read < 0) break
    output.write(buffer, 0, read)
  }
  if (output.size() > maximum) throw IllegalStateException("write_verification_failed")
  return output.toByteArray()
}
