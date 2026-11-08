package com.shruggietech.glitchpad.source

import android.graphics.BitmapFactory
import android.system.Os
import app.tauri.plugin.JSObject
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.UUID

/** One private job. Original PDF bytes, paths and credentials never enter this adapter. */
internal class PdfPrintStore(private val root: File) {
  internal data class Page(val file: File, val width: Double, val height: Double, val sha256: String)
  internal data class Job(val id: String, val owner: String, val count: Int, val directory: File,
    val pages: MutableList<Page> = mutableListOf(), var pending: File? = null, var encoded: Long = 0,
    var status: String = "preparing", var written: Int = 0)
  private var job: Job? = null
  init {
    if (!root.isDirectory && !root.mkdirs()) throw IllegalStateException("print_cache_unavailable")
    Os.chmod(root.absolutePath, 448)
    root.listFiles()?.filter { it.isDirectory && uuid(it.name) }?.take(32)?.forEach { it.deleteRecursively() }
  }
  private fun uuid(value: String): Boolean = runCatching { UUID.fromString(value).toString() == value }.getOrDefault(false)
  @Synchronized fun current(args: PdfPrintArgs): Job {
    val value = job ?: throw IllegalStateException("print_job_unavailable")
    check(value.id == args.requestId && value.owner == args.owner) { "print_job_unavailable" }
    return value
  }
  @Synchronized fun begin(args: PdfPrintArgs): JSObject {
    check(uuid(args.requestId) && args.owner.length in 1..256 && args.pageCount in 1..10000) { "invalid_print_job" }
    check(job?.status !in listOf("preparing", "ready", "handed_off", "layout", "writing", "written")) { "print_pending" }
    job?.directory?.deleteRecursively()
    val directory = File(root, args.requestId)
    check(directory.mkdir()) { "print_cache_unavailable" }; Os.chmod(directory.absolutePath, 448)
    val next = Job(args.requestId, args.owner, args.pageCount, directory); job = next
    return snapshot(next)
  }
  @Synchronized fun append(args: PdfPrintArgs): JSObject {
    val value = current(args)
    check(value.status == "preparing" && args.pageIndex == value.pages.size && args.pageIndex < value.count) { "invalid_print_page" }
    check(args.bytes.size in 1..262144 && args.bytes.all { it in 0..255 }) { "print_chunk_limit" }
    val file = value.pending ?: File(value.directory, "page-" + value.pages.size + ".png").also { check(it.createNewFile()); Os.chmod(it.absolutePath, 384); value.pending = it }
    check(file.length() + args.bytes.size <= 16777216L && value.encoded + args.bytes.size <= 134217728L) { "print_cache_limit" }
    FileOutputStream(file, true).use { output -> output.write(ByteArray(args.bytes.size) { args.bytes[it].toByte() }) }
    value.encoded += args.bytes.size
    return snapshot(value)
  }
  @Synchronized fun seal(args: PdfPrintArgs): JSObject {
    val value = current(args); val file = value.pending ?: throw IllegalStateException("invalid_print_page")
    check(value.status == "preparing" && args.pageIndex == value.pages.size && args.width.isFinite() && args.height.isFinite() && args.width in 1.0..14400.0 && args.height in 1.0..14400.0) { "invalid_print_page" }
    val digest = MessageDigest.getInstance("SHA-256"); file.inputStream().use { input -> val bytes = ByteArray(262144); while (true) { val count = input.read(bytes); if (count < 0) break; digest.update(bytes, 0, count) } }
    val hash = digest.digest().joinToString("") { "%02x".format(it) }
    check(args.sha256.isEmpty() || args.sha256 == hash) { "print_hash_mismatch" }
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeFile(file.absolutePath, options)
    check(options.outMimeType == "image/png" && options.outWidth in 1..8192 && options.outHeight in 1..8192 && options.outWidth.toLong() * options.outHeight <= 16000000L) { "print_surface_limit" }
    val ratio = options.outWidth.toDouble() / options.outHeight
    check(kotlin.math.abs(ratio - args.width / args.height) <= 0.02) { "print_page_dimensions" }
    value.pages.add(Page(file, args.width, args.height, hash)); value.pending = null
    if (value.pages.size == value.count) value.status = "ready"
    return snapshot(value)
  }
  @Synchronized fun status(args: PdfPrintArgs): JSObject = snapshot(current(args))
  @Synchronized fun cancel(args: PdfPrintArgs): JSObject { val value = current(args); check(value.status in listOf("preparing", "ready", "cancelled", "failed", "finished")) { "print_already_handed_off" }; value.status = "cancelled"; value.directory.deleteRecursively(); return snapshot(value) }
  @Synchronized fun handedOff(args: PdfPrintArgs): Job { val value = current(args); check(value.status == "ready"); value.status = "handed_off"; return value }
  @Synchronized fun observe(value: Job, status: String, written: Int = value.written) { if (job !== value) return; value.status = status; value.written = written }
  @Synchronized fun finish(value: Job) { if (job !== value) return; if (value.status !in listOf("failed", "cancelled")) value.status = "finished"; value.directory.deleteRecursively() }
  @Synchronized private fun snapshot(value: Job): JSObject = JSObject().put("request_id", value.id).put("status", value.status).put("pages_written", value.written)
}
