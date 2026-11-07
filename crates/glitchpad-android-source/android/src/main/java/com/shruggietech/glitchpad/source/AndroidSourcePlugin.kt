package com.shruggietech.glitchpad.source

import android.app.Activity
import android.app.PendingIntent
import android.content.ClipData
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.activity.BackEventCompat
import androidx.activity.OnBackPressedCallback
import androidx.activity.OnBackPressedDispatcherOwner
import androidx.core.content.FileProvider
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.webkit.WebViewCompat
import java.io.File
import android.content.Intent
import android.content.UriPermission
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
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@TauriPlugin
class AndroidSourcePlugin(private val activity: Activity) : Plugin(activity) {
  private val ioExecutor = Executors.newSingleThreadExecutor()
  private val clipboardTextStore = ClipboardTextStore(File(activity.filesDir, "clipboard"))
  private val pending = ArrayBlockingQueue<DeliveryCandidate>(MAX_PENDING_DELIVERIES)
  private val rejections = ArrayBlockingQueue<String>(MAX_PENDING_REJECTIONS)
  private val sources = ConcurrentHashMap<String, NativeSource>()
  private val imageExports = ImageExportCancellations()
  private val streams = ConcurrentHashMap<String, NativeStream>()
  private val restoration = RestorationStore(activity)
  private val initialIntentConsumed = AtomicBoolean(false)
  private var backCallback: OnBackPressedCallback? = null
  private var pendingBack: String? = null
  private val backObservation = IntArray(7)
  private val shareJobs = ConcurrentHashMap<Invoke, DiagnosticShareJob>()
  private val sharePending = AtomicBoolean(false)
  private val mainHandler = Handler(Looper.getMainLooper())
  private var deliveryWebView: WebView? = null
  private var deliveryLifecycleObserver: DefaultLifecycleObserver? = null
  private val deliveryWake = PendingDeliveryWake(
    hasPending = {
      val owner = activity as? LifecycleOwner
      owner?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) == true &&
        (pending.isNotEmpty() || rejections.isNotEmpty())
    },
    post = { task -> deliveryWebView?.postOnAnimation(task) },
    remove = { task -> deliveryWebView?.removeCallbacks(task) },
    notifyReady = { notifyDeliveriesReady() },
  )

  // Hosted instrumentation reads this private, bounded state by reflection only.
  private val deliveryObservation = if ((activity.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) DeliveryObservation() else null

  private enum class SaveObservationStage {
    PICKER_LAUNCH_REQUESTED, PICKER_LAUNCH_RETURNED, PICKER_LAUNCH_FAILED,
    RESULT_CANCELLED, RESULT_OK, RESULT_OTHER, CANCEL_REJECT_REQUESTED, CANCEL_REJECT_RETURNED
  }

  private fun observeSave(stage: SaveObservationStage) {
    if (deliveryObservation != null) runCatching { android.util.Log.d("GlitchpadSaveObs", stage.name) }
  }

  private enum class DeliveryStage {
    CREATED, LOADED, NEW_INTENT_RECEIVED, INBOUND_IGNORED, CANDIDATE_QUEUED,
    CANDIDATE_REJECTED, QUEUE_FULL, NOTIFICATION_CALLED, NOTIFICATION_RETURNED,
    DRAIN_REQUESTED, DRAIN_COMPLETED
  }

  private class DeliveryObservation {
    private var loadCount = 0
    private var newIntentCount = 0
    private var notificationCount = 0
    private var drainCount = 0
    private var lastStage = DeliveryStage.CREATED
    private var lastInboundStage = DeliveryStage.CREATED
    private var lastHandled = false
    private var listenerAtNotification = false

    @Synchronized
    fun record(stage: DeliveryStage, handled: Boolean? = null, listener: Boolean? = null) {
      when (stage) {
        DeliveryStage.LOADED -> loadCount = minOf(loadCount + 1, 65_535)
        DeliveryStage.NEW_INTENT_RECEIVED -> newIntentCount = minOf(newIntentCount + 1, 65_535)
        DeliveryStage.NOTIFICATION_CALLED -> notificationCount = minOf(notificationCount + 1, 65_535)
        DeliveryStage.DRAIN_REQUESTED -> drainCount = minOf(drainCount + 1, 65_535)
        else -> Unit
      }
      lastStage = stage
      if (handled != null) { lastInboundStage = stage; lastHandled = handled }
      if (listener != null) listenerAtNotification = listener
    }

    @Synchronized
    fun snapshot(): JSObject = JSObject().put("enabled", true).put("load_count", loadCount)
      .put("new_intent_count", newIntentCount).put("notification_count", notificationCount).put("drain_count", drainCount)
      .put("last_stage", lastStage.name).put("last_inbound_stage", lastInboundStage.name)
      .put("last_inbound_handled", lastHandled).put("listener_at_notification", listenerAtNotification)
  }

  private fun deliveryRouteSnapshot(): JSObject = (deliveryObservation?.snapshot() ?: JSObject().put("enabled", false))
    .put("pending_count", pending.size).put("rejection_count", rejections.size)
    .put("delivery_listener_present", hasListener("deliveriesReady"))

  override fun load(webView: WebView) {
    super.load(webView)
    deliveryObservation?.record(DeliveryStage.LOADED)
    installBackCallback()
    installDeliveryWake(webView)
    if (initialIntentConsumed.compareAndSet(false, true) && enqueueInbound(activity.intent))
      notifyDeliveriesReady()
  }

  private fun installDeliveryWake(webView: WebView) {
    activity.runOnUiThread {
      deliveryWake.cancel()
      deliveryWebView = webView
      val owner = activity as? LifecycleOwner ?: return@runOnUiThread
      if (deliveryLifecycleObserver == null) {
        val observer = object : DefaultLifecycleObserver {
          override fun onResume(owner: LifecycleOwner) {
            // The next WebView frame runs after WryActivity activates the WebView.
            deliveryWake.schedule()
          }

          override fun onPause(owner: LifecycleOwner) {
            deliveryWake.cancel()
          }

          override fun onDestroy(owner: LifecycleOwner) {
            deliveryWake.cancel()
            deliveryWebView = null
            owner.lifecycle.removeObserver(this)
            deliveryLifecycleObserver = null
          }
        }
        deliveryLifecycleObserver = observer
        owner.lifecycle.addObserver(observer)
      }
      deliveryWake.schedule()
    }
  }

  override fun onNewIntent(intent: Intent) {
    deliveryObservation?.record(DeliveryStage.NEW_INTENT_RECEIVED)
    if (enqueueInbound(intent)) notifyDeliveriesReady()
  }

  @Command
  fun drainDeliveries(invoke: Invoke) {
    deliveryObservation?.record(DeliveryStage.DRAIN_REQUESTED)
    val maximum = invoke.parseArgs(DrainArgs::class.java).maximum.coerceIn(1, MAX_QUEUE_DRAIN)
    ioExecutor.execute {
      val deliveries = JSArray()
      repeat(maximum) {
        val candidate = pending.poll() ?: return@repeat
        acquire(candidate).onSuccess(deliveries::put).onFailure { enqueueRejection(code(it)) }
      }
      val rejected = JSArray()
      repeat(maximum) {
        val rejection = rejections.poll() ?: return@repeat
        rejected.put(JSObject().put("code", rejection).put("retryable", rejection == "provider_unavailable"))
      }
      deliveryObservation?.record(DeliveryStage.DRAIN_COMPLETED)
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
    runCatching { DocumentWritePolicy.payload(args.bytes?.size ?: 0, args.suggestedName ?: "document", args.mediaType) }
      .onFailure { return invoke.reject(code(it)) }
    if (args.protectedBridgeToken != null && !sources.containsKey(args.protectedBridgeToken)) return invoke.reject("source_not_found")
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
      .addCategory(Intent.CATEGORY_OPENABLE)
      .setType(args.mediaType ?: "application/octet-stream")
      .putExtra(Intent.EXTRA_TITLE, args.suggestedName ?: "document")
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
    observeSave(SaveObservationStage.PICKER_LAUNCH_REQUESTED)
    try {
      startActivityForResult(invoke, intent, "saveAsResult")
      observeSave(SaveObservationStage.PICKER_LAUNCH_RETURNED)
    } catch (error: Exception) {
      observeSave(SaveObservationStage.PICKER_LAUNCH_FAILED)
      invoke.reject("picker_failed")
    }
  }

  @Command
  fun exportImage(invoke: Invoke) {
    val args = invoke.parseArgs(ImageExportArgs::class.java)
    if ((args.bytes?.size ?: 0) !in 8..(8 * 1024 * 1024) || !args.sourceSha256.matches(Regex("[0-9a-f]{64}"))) return invoke.reject("budget_exceeded")
    if (!sources.containsKey(args.bridgeToken)) return invoke.reject("source_not_found")
    val flag = runCatching { imageExports.register(args.requestId) }.getOrElse { return invoke.reject(code(it)) }
    if (flag.get()) { imageExports.finish(args.requestId); return invoke.resolve(JSObject().put("exported", false).put("byteCount", 0)) }
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
      .setType("image/png").putExtra(Intent.EXTRA_TITLE, "selected-icon-entry.png")
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
    try { startActivityForResult(invoke, intent, "exportImageResult") }
    catch (error: Exception) { imageExports.finish(args.requestId); invoke.reject("picker_failed") }
  }

  @Command
  fun cancelImageExport(invoke: Invoke) {
    val args = invoke.parseArgs(ImageExportCancelArgs::class.java)
    runCatching { imageExports.cancel(args.requestId) }.getOrElse { return invoke.reject(code(it)) }
    invoke.resolve()
  }

  @ActivityCallback
  fun exportImageResult(invoke: Invoke, result: ActivityResult) {
    val args = invoke.parseArgs(ImageExportArgs::class.java)
    val cancelled = imageExports.flag(args.requestId) ?: return invoke.reject("source_not_found")
    if (result.resultCode == Activity.RESULT_CANCELED || cancelled.get()) {
      imageExports.finish(args.requestId)
      return invoke.resolve(JSObject().put("exported", false).put("byteCount", 0))
    }
    if (result.resultCode != Activity.RESULT_OK) { imageExports.finish(args.requestId); return invoke.reject("picker_failed") }
    val bytes = args.bytes?.map(Int::toByte)?.toByteArray() ?: ByteArray(0)
    ioExecutor.execute {
      var started = false
      var destination: Uri? = null
      runCatching {
        val source = sources[args.bridgeToken] ?: throw IllegalStateException("source_not_found")
        val candidate = DeliveryPolicy.pickerResult(result.data, DeliveryKind.CREATE_RESULT).getOrThrow()
        destination = candidate.uri
        if (!DocumentsContract.isDocumentUri(activity, source.uri) || !DocumentsContract.isDocumentUri(activity, candidate.uri)) throw IllegalStateException("independent_destination_required")
        ImageExportPolicy.destination(source.uri.authority, DocumentsContract.getDocumentId(source.uri), candidate.uri.authority, DocumentsContract.getDocumentId(candidate.uri), queryMetadata(candidate.uri).size)
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        activity.contentResolver.openInputStream(source.uri)?.use { input ->
          val chunk = ByteArray(1024 * 1024)
          var total = 0L
          while (true) {
            if (cancelled.get()) throw IllegalStateException("export_cancelled")
            val count = input.read(chunk)
            if (count < 0) break
            total += count
            if (total > 128L * 1024 * 1024) throw IllegalStateException("budget_exceeded")
            digest.update(chunk, 0, count)
          }
        } ?: throw IllegalStateException("provider_unavailable")
        val hash = digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
        ImageExportPolicy.source(args.sourceSha256, hash, cancelled.get(), sources.containsKey(args.bridgeToken))
        if (queryMetadata(candidate.uri).size != 0L) throw IllegalStateException("destination_conflict")
        activity.contentResolver.openFileDescriptor(candidate.uri, "rw", CancellationSignal())?.use { descriptor ->
          if (descriptor.statSize != 0L) throw IllegalStateException("destination_conflict")
          if (cancelled.get() || !sources.containsKey(args.bridgeToken)) throw IllegalStateException("export_cancelled")
          started = true
          java.io.FileOutputStream(descriptor.fileDescriptor).use { output -> output.write(bytes); output.flush(); descriptor.fileDescriptor.sync() }
          descriptor.checkError()
        } ?: throw IllegalStateException("provider_unavailable")
        if (cancelled.get()) throw IllegalStateException("export_cancelled")
        val observed = activity.contentResolver.openInputStream(candidate.uri)?.use { ImageExportPolicy.readGenerated(it) } ?: throw IllegalStateException("provider_unavailable")
        ImageExportPolicy.verified(bytes, observed, cancelled.get())
        bytes.size
      }.onSuccess { imageExports.finish(args.requestId); invoke.resolve(JSObject().put("exported", true).put("byteCount", it)) }
        .onFailure {
          // Never delete a refused original/alias. Cleanup is limited to an independent destination we wrote.
          if (started) destination?.let { uri -> runCatching { DocumentsContract.deleteDocument(activity.contentResolver, uri) } }
          imageExports.finish(args.requestId)
          invoke.reject(code(it))
        }
    }
  }

  @ActivityCallback
  fun saveAsResult(invoke: Invoke, result: ActivityResult) {
    if (result.resultCode == Activity.RESULT_CANCELED) {
      observeSave(SaveObservationStage.RESULT_CANCELLED)
      observeSave(SaveObservationStage.CANCEL_REJECT_REQUESTED)
      invoke.reject("picker_cancelled")
      observeSave(SaveObservationStage.CANCEL_REJECT_RETURNED)
      return
    }
    if (result.resultCode != Activity.RESULT_OK) {
      observeSave(SaveObservationStage.RESULT_OTHER)
      return invoke.reject("picker_failed")
    }
    observeSave(SaveObservationStage.RESULT_OK)
    val args = invoke.parseArgs(PickerArgs::class.java)
    val bytes = args.bytes?.map(Int::toByte)?.toByteArray() ?: ByteArray(0)
    ioExecutor.execute {
      var started = false
      var destination: Uri? = null
      runCatching {
        DocumentWritePolicy.payload(bytes.size, args.suggestedName ?: "document", args.mediaType)
        val candidate = DeliveryPolicy.pickerResult(result.data, DeliveryKind.CREATE_RESULT).getOrThrow()
        destination = candidate.uri
        val protected = args.protectedBridgeToken?.let { sources[it] ?: throw IllegalStateException("source_not_found") }
        val known = sources.values.map { documentDestination(it.uri) }.toMutableList()
        if (protected != null) known.add(documentDestination(protected.uri))
        DocumentWritePolicy.destination(known, documentDestination(candidate.uri), queryMetadata(candidate.uri).size)
        // rw does not truncate: metadata and descriptor must independently agree this is a new empty destination.
        activity.contentResolver.openFileDescriptor(candidate.uri, "rw", CancellationSignal())?.use { descriptor ->
          DocumentWritePolicy.descriptorSize(descriptor.statSize)
          if (args.protectedBridgeToken != null && !sources.containsKey(args.protectedBridgeToken)) throw IllegalStateException("source_not_found")
          started = true
          java.io.FileOutputStream(descriptor.fileDescriptor).use { output -> output.write(bytes); output.flush(); descriptor.fileDescriptor.sync() }
          descriptor.checkError()
        } ?: throw IllegalStateException("provider_unavailable")
        val observed = activity.contentResolver.openInputStream(candidate.uri)?.use { it.readBytes(MAX_SAVE_BYTES + 1) }
          ?: throw IllegalStateException("provider_unavailable")
        DocumentWritePolicy.verified(bytes, observed)
        acquire(candidate).getOrThrow() to bytes.size
      }.onSuccess { (delivery, count) -> invoke.resolve(JSObject().put("delivery", delivery).put("byteCount", count)) }
        .onFailure {
          // Cleanup never deletes a refused source/alias or a destination we did not write.
          if (started) destination?.let { uri -> runCatching { DocumentsContract.deleteDocument(activity.contentResolver, uri) } }
          invoke.reject(code(it))
        }
    }
  }

  private fun documentDestination(uri: Uri): DocumentDestination {
    if (!DocumentsContract.isDocumentUri(activity, uri)) return DocumentDestination(uri.authority, null)
    return DocumentDestination(uri.authority, runCatching { DocumentsContract.getDocumentId(uri) }.getOrNull())
  }

  private fun observeBack(index: Int) {
    if (backObservation[index] < Int.MAX_VALUE) backObservation[index]++
  }

  private fun backRouteSnapshot(): JSObject = JSObject()
    .put("started", backObservation[0]).put("progressed", backObservation[1]).put("cancelled", backObservation[2])
    .put("committed", backObservation[3]).put("requested", backObservation[4])
    .put("completed", backObservation[5]).put("delegated", backObservation[6])
    .put("pending", pendingBack != null).put("enabled", backCallback?.isEnabled == true)

  private fun installBackCallback() {
    if (backCallback != null) return
    val owner = activity as? OnBackPressedDispatcherOwner ?: return
    val callback = object : OnBackPressedCallback(true) {
      override fun handleOnBackStarted(backEvent: BackEventCompat) { observeBack(0) }
      override fun handleOnBackProgressed(backEvent: BackEventCompat) { observeBack(1) }
      override fun handleOnBackCancelled() { observeBack(2) }
      override fun handleOnBackPressed() {
        observeBack(3)
        if (!hasListener("androidBackRequested")) {
          pendingBack = null
          observeBack(6)
          delegateAndroidBack(owner, this)
          return
        }
        if (pendingBack != null) return
        val request = UUID.randomUUID().toString()
        pendingBack = request
        observeBack(4)
        trigger("androidBackRequested", JSObject().put("requestId", request))
        mainHandler.postDelayed({ if (pendingBack == request) pendingBack = null }, 5_000)
      }
    }
    backCallback = callback
    registerAndroidBackCallback(owner, callback)
  }

  @Command
  fun completeAndroidBack(invoke: Invoke) {
    val args = invoke.parseArgs(AndroidBackArgs::class.java)
    activity.runOnUiThread {
      if (args.requestId == pendingBack) {
        observeBack(5)
        pendingBack = null
        if (!args.handled) {
          observeBack(6)
          val owner = activity as? OnBackPressedDispatcherOwner
          val callback = backCallback
          if (owner != null && callback != null) delegateAndroidBack(owner, callback)
        }
      }
      invoke.resolve()
    }
  }

  @Command
  fun writeClipboard(invoke: Invoke) {
    val args = invoke.parseArgs(ClipboardTextArgs::class.java)
    // One IO queue preserves request order for both inline and file-backed copies.
    ioExecutor.execute {
      val payload = try { clipboardTextStore.prepare(args.text) }
      catch (_: Exception) { invoke.reject("Clipboard copy could not complete"); return@execute }
      val clip = try {
        val file = payload.file
        if (file == null) ClipData.newPlainText("Glitchpad", payload.inlineText)
        else {
          val uri = if (Build.VERSION.SDK_INT < 26) LegacyClipboardTextProvider.uriForFile(activity, file)
            else FileProvider.getUriForFile(activity, activity.packageName + ".fileprovider", file)
          ClipData.newUri(activity.contentResolver, "Glitchpad", uri)
        }
      } catch (_: Exception) {
        clipboardTextStore.discardUncommitted(payload)
        invoke.reject("Clipboard copy could not complete")
        return@execute
      }
      activity.runOnUiThread {
        try {
          val clipboard = activity.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
          clipboard.setPrimaryClip(clip)
        } catch (_: Exception) {
          ioExecutor.execute { clipboardTextStore.discardUncommitted(payload) }
          invoke.reject("Clipboard copy could not complete")
          return@runOnUiThread
        }
        ioExecutor.execute { clipboardTextStore.retirePrevious(payload) }
        invoke.resolve()
      }
    }
  }

  @Command
  fun applicationInfo(invoke: Invoke) {
    activity.runOnUiThread {
      val info = activity.packageManager.getPackageInfo(activity.packageName, 0)
      val versionCode = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else {
        @Suppress("DEPRECATION")
        info.versionCode.toLong()
      }
      invoke.resolve(JSObject().put("package_identifier", activity.packageName)
        .put("version", info.versionName ?: "unavailable").put("version_code", versionCode)
        .put("channel", if ((activity.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) "debug" else "release")
        .put("platform", "android"))
    }
  }

  @Command
  fun diagnosticEnvironment(invoke: Invoke) {
    val args = invoke.parseArgs(DiagnosticEnvironmentArgs::class.java)
    activity.runOnUiThread {
      val webview = runCatching { WebViewCompat.getCurrentWebViewPackage(activity) }.getOrNull()
      val response = JSObject().put("androidVersion", Build.VERSION.RELEASE.take(64)).put("apiLevel", Build.VERSION.SDK_INT)
        .put("webviewVersion", webview?.versionName?.take(128)).put("webviewPackage", webview?.packageName?.take(128))
      if (args.includeViewport) response.put("viewport", runCatching { diagnosticViewportSnapshot() }.getOrNull() ?: org.json.JSONObject.NULL)
      invoke.resolve(response)
    }
  }

  private fun diagnosticViewportSnapshot(): JSObject? {
    val view = deliveryWebView ?: return null
    if (!view.isAttachedToWindow || !view.isShown || view.windowVisibility != android.view.View.VISIBLE) return null
    val location = IntArray(2)
    view.getLocationOnScreen(location)
    val local = android.graphics.Rect()
    if (!view.getLocalVisibleRect(local)) return null
    val window = android.graphics.Rect()
    view.getWindowVisibleDisplayFrame(window)
    val observed = DiagnosticViewportGeometry.snapshot(location[0], location[1], view.width, view.height, view.scrollX, view.scrollY,
      DiagnosticPixelRect(local.left, local.top, local.right, local.bottom),
      DiagnosticPixelRect(window.left, window.top, window.right, window.bottom), view.resources.displayMetrics.density) ?: return null
    fun rectangle(value: DiagnosticPixelRect): JSObject = JSObject().put("left", value.left).put("top", value.top)
      .put("right", value.right).put("bottom", value.bottom)
    return JSObject().put("webviewScreen", rectangle(observed.webviewScreen)).put("visibleScreen", rectangle(observed.visibleScreen))
      .put("viewWidth", observed.viewWidth).put("viewHeight", observed.viewHeight).put("density", observed.density.toDouble())
  }

  @Command
  fun shareDiagnostics(invoke: Invoke) {
    val args = invoke.parseArgs(DiagnosticShareArgs::class.java)
    if (args.json.length > MAX_DIAGNOSTIC_BYTES || args.json.toByteArray(Charsets.UTF_8).size > MAX_DIAGNOSTIC_BYTES)
      return invoke.reject("budget_exceeded")
    if (!sharePending.compareAndSet(false, true)) return invoke.reject("operation_pending")
    ioExecutor.execute {
      var file: File? = null
      runCatching {
        val directory = File(activity.cacheDir, "diagnostics")
        if (!directory.isDirectory && !directory.mkdirs()) throw IllegalStateException("provider_unavailable")
        val now = System.currentTimeMillis()
        directory.listFiles()?.filter { it.name.startsWith("diagnostics-") && now - it.lastModified() >= DIAGNOSTIC_SHARE_TTL_MS }?.forEach { it.delete() }
        if ((directory.listFiles()?.size ?: 0) >= MAX_DIAGNOSTIC_SHARE_FILES) throw IllegalStateException("share_capacity_exceeded")
        val bytes = args.json.toByteArray(Charsets.UTF_8)
        file = File.createTempFile("diagnostics-", ".json", directory)
        java.io.FileOutputStream(file!!).use { output -> output.write(bytes); output.flush(); output.fd.sync() }
        if (!file!!.readBytes().contentEquals(bytes)) throw IllegalStateException("write_verification_failed")
        val uri = FileProvider.getUriForFile(activity, activity.packageName + ".fileprovider", file!!)
        val token = UUID.randomUUID().toString()
        val job = DiagnosticShareJob(token, file!!, AtomicBoolean(false))
        shareJobs[invoke] = job
        DiagnosticShareSelections.register(token) {
          if (job.finished.compareAndSet(false, true)) {
            sharePending.set(false)
            invoke.resolve(JSObject().put("status", "handed_off"))
          }
        }
        activity.runOnUiThread {
          try {
            val selected = Intent(activity, DiagnosticShareReceiver::class.java).putExtra("token", token)
            val pendingFlags = PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_CANCEL_CURRENT or if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
            val callback = PendingIntent.getBroadcast(activity, 0, selected, pendingFlags)
            val send = Intent(Intent.ACTION_SEND).setType("application/json").putExtra(Intent.EXTRA_STREAM, uri)
              .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            send.clipData = ClipData.newRawUri("Glitchpad diagnostics", uri)
            val chooser = Intent.createChooser(send, "Share diagnostics", callback.intentSender).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            startActivityForResult(invoke, chooser, "shareDiagnosticsResult")
            mainHandler.postDelayed({
              DiagnosticShareSelections.remove(token); shareJobs.remove(invoke); job.file.delete()
              if (job.finished.compareAndSet(false, true)) { sharePending.set(false); invoke.reject("share_unavailable") }
            }, DIAGNOSTIC_SHARE_TTL_MS)
          } catch (error: Exception) {
            DiagnosticShareSelections.remove(token); shareJobs.remove(invoke); sharePending.set(false); job.file.delete()
            if (job.finished.compareAndSet(false, true)) invoke.reject("share_unavailable")
          }
        }
      }.onFailure { file?.delete(); sharePending.set(false); invoke.reject(code(it)) }
    }
  }

  @ActivityCallback
  fun shareDiagnosticsResult(invoke: Invoke, result: ActivityResult) {
    val job = shareJobs[invoke] ?: return
    // Give the chooser's selection broadcast its next main-thread turn before classifying a cancellation.
    mainHandler.postDelayed({
      shareJobs.remove(invoke)
      DiagnosticShareSelections.remove(job.token)
      if (job.finished.compareAndSet(false, true)) {
        sharePending.set(false)
        if (result.resultCode == Activity.RESULT_CANCELED) {
          job.file.delete()
          invoke.resolve(JSObject().put("status", "cancelled"))
        } else invoke.resolve(JSObject().put("status", "handed_off"))
      }
    }, if (result.resultCode == Activity.RESULT_CANCELED) 250 else 0)
  }

  private data class DiagnosticShareJob(val token: String, val file: File, val finished: AtomicBoolean)

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

  private fun enqueueInbound(intent: Intent?): Boolean {
    if (intent?.action != Intent.ACTION_VIEW && intent?.action != Intent.ACTION_SEND) {
      deliveryObservation?.record(DeliveryStage.INBOUND_IGNORED, handled = false)
      return false
    }
    DeliveryPolicy.inbound(intent)
      .onSuccess { candidate ->
        if (pending.offer(candidate)) deliveryObservation?.record(DeliveryStage.CANDIDATE_QUEUED, handled = true)
        else {
          deliveryObservation?.record(DeliveryStage.QUEUE_FULL, handled = true)
          enqueueRejection("delivery_queue_full")
        }
      }
      .onFailure {
        deliveryObservation?.record(DeliveryStage.CANDIDATE_REJECTED, handled = true)
        enqueueRejection(code(it))
      }
    return true
  }

  private fun enqueueRejection(rejection: String) {
    if (rejections.offer(rejection)) return
    rejections.poll()
    rejections.offer(rejection)
  }

  private fun notifyDeliveriesReady() {
    deliveryObservation?.record(DeliveryStage.NOTIFICATION_CALLED, listener = hasListener("deliveriesReady"))
    trigger("deliveriesReady", JSObject())
    deliveryObservation?.record(DeliveryStage.NOTIFICATION_RETURNED)
  }

  private fun acquire(candidate: DeliveryCandidate): Result<JSObject> = runCatching {
    val persistModes = DeliveryPolicy.persistableModes(candidate)
    if (persistModes != 0 && !restoration.canPut(candidate.uri)) {
      throw IllegalStateException("restoration_capacity_exceeded")
    }
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
    if (heldModes != 0 && !restoration.put(candidate.uri, heldModes)) {
      sources.remove(source.token)
      val newlyPersistedModes = heldModes and permissionModes(previousPermission).inv()
      if (newlyPersistedModes != 0) {
        runCatching { activity.contentResolver.releasePersistableUriPermission(candidate.uri, newlyPersistedModes) }
      }
      throw IllegalStateException("restoration_capacity_exceeded")
    }
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
    val identityToken = documentIdentity?.second?.let(::boundedDocumentIdentity) ?: source.token
    val seekable = runCatching {
      activity.contentResolver.openFileDescriptor(source.uri, "r", CancellationSignal())?.use {
        Os.lseek(it.fileDescriptor, 0, OsConstants.SEEK_CUR)
      } ?: throw IllegalStateException()
      true
    }.getOrDefault(false)
    JSObject()
      .put("bridgeToken", source.token)
      .put("deliveryKind", source.kind.wireName)
      .put("identityScope", documentIdentity?.first?.take(MAX_IDENTITY_SCOPE_CHARS) ?: "temporary")
      .put("identityToken", identityToken)
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
    val portable = queryMetadataColumns(uri, PORTABLE_METADATA_PROJECTION)
    val document = if (DocumentsContract.isDocumentUri(activity, uri)) {
      queryMetadataColumns(uri, DOCUMENT_METADATA_PROJECTION)
    } else {
      null
    }
    return ProviderMetadata(
      displayName = portable.optionalString(OpenableColumns.DISPLAY_NAME) ?: "Untitled document",
      size = portable.optionalLong(OpenableColumns.SIZE),
      modified = document?.optionalLong(DocumentsContract.Document.COLUMN_LAST_MODIFIED),
      flags = document?.optionalLong(DocumentsContract.Document.COLUMN_FLAGS)?.toInt() ?: 0,
      mimeType = activity.contentResolver.getType(uri),
    )
  }

  private fun queryMetadataColumns(uri: Uri, projection: Array<String>): MetadataColumns {
    val cursor = activity.contentResolver.query(uri, projection, null, null, null, CancellationSignal())
      ?: throw IllegalStateException("provider_unavailable")
    cursor.use {
      if (!it.moveToFirst()) throw IllegalStateException("provider_unavailable")
      return MetadataColumns(projection.associateWith { column ->
        it.getColumnIndex(column).takeIf { index -> index >= 0 && !it.isNull(index) }?.let { index ->
          if (column == OpenableColumns.DISPLAY_NAME) it.getString(index) else it.getLong(index)
        }
      })
    }
  }

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

  private data class MetadataColumns(val values: Map<String, Any?>) {
    fun optionalString(column: String): String? = values[column] as? String
    fun optionalLong(column: String): Long? = values[column] as? Long
  }

  companion object {
    private const val MAX_QUEUE_DRAIN = 64
    private const val MAX_PENDING_DELIVERIES = 64
    private const val MAX_PENDING_REJECTIONS = 64
    private const val MAX_CHUNK_BYTES = 1024L * 1024L
    private const val MAX_SAVE_BYTES = 16 * 1024 * 1024
    private const val MAX_DIAGNOSTIC_BYTES = 2 * 1024 * 1024
    private const val MAX_DIAGNOSTIC_SHARE_FILES = 16
    private const val DIAGNOSTIC_SHARE_TTL_MS = 60L * 60 * 1000
    private const val MAX_NAME_CHARS = 256
    private const val MAX_MEDIA_TYPE_CHARS = 128
    private val SAFE_CODES = setOf(
      "missing_delivery", "unsupported_action", "invalid_source_shape", "read_authority_required",
      "missing_picker_source", "invalid_source_scheme", "directory_unsupported",
      "virtual_document_unsupported", "provider_unavailable", "write_verification_failed",
      "restoration_capacity_exceeded", "original_destination_denied", "destination_conflict",
      "independent_destination_required", "invalid_destination_name", "invalid_media_type",
      "share_capacity_exceeded", "share_unavailable", "operation_pending", "picker_failed", "picker_cancelled", "budget_exceeded", "source_not_found",
    )
    private val PORTABLE_METADATA_PROJECTION = arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
    private val DOCUMENT_METADATA_PROJECTION = arrayOf(
      DocumentsContract.Document.COLUMN_LAST_MODIFIED,
      DocumentsContract.Document.COLUMN_FLAGS,
    )
  }
}

internal fun boundedDocumentIdentity(documentId: String): String {
  if (documentId.length <= MAX_DOCUMENT_ID_CHARS) return documentId
  val digest = MessageDigest.getInstance("SHA-256").digest(documentId.toByteArray(Charsets.UTF_8))
  return buildString(SHA_256_PREFIX.length + digest.size * 2) {
    append(SHA_256_PREFIX)
    digest.forEach { byte ->
      val value = byte.toInt() and 0xff
      append(HEX_DIGITS[value ushr 4])
      append(HEX_DIGITS[value and 0x0f])
    }
  }
}

private const val MAX_DOCUMENT_ID_CHARS = 512
private const val MAX_IDENTITY_SCOPE_CHARS = 512
private const val SHA_256_PREFIX = "sha256:"
private const val HEX_DIGITS = "0123456789abcdef"

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
