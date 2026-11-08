package com.shruggietech.glitchpad.source

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.RectF
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.pdf.PrintedPdfDocument
import java.util.concurrent.Executor

internal class PdfPrintAdapter(private val context: Context, private val store: PdfPrintStore,
  private val job: PdfPrintStore.Job, private val executor: Executor) : PrintDocumentAdapter() {
  private var attributes: PrintAttributes? = null
  override fun onLayout(oldAttributes: PrintAttributes?, newAttributes: PrintAttributes, cancellation: CancellationSignal, callback: LayoutResultCallback, extras: Bundle?) {
    if (cancellation.isCanceled) { store.observe(job, "cancelled"); callback.onLayoutCancelled(); return }
    attributes = newAttributes; store.observe(job, "layout")
    callback.onLayoutFinished(PrintDocumentInfo.Builder("Glitchpad PDF").setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).setPageCount(job.pages.size).build(), oldAttributes != newAttributes)
  }
  override fun onWrite(ranges: Array<out PageRange>, destination: ParcelFileDescriptor, cancellation: CancellationSignal, callback: WriteResultCallback) {
    val layout = attributes ?: run { callback.onWriteFailed("Print layout unavailable"); return }
    store.observe(job, "writing")
    executor.execute {
      val written = mutableListOf<PageRange>(); var document: PrintedPdfDocument? = null
      try {
        val pdf = PrintedPdfDocument(context, layout); document = pdf
        for ((index, source) in job.pages.withIndex()) {
          if (cancellation.isCanceled) { store.observe(job, "cancelled"); callback.onWriteCancelled(); return@execute }
          if (ranges.none { index in it.start..it.end }) continue
          val digest = java.security.MessageDigest.getInstance("SHA-256")
          source.file.inputStream().use { input -> val bytes = ByteArray(262144); while (true) { val count = input.read(bytes); if (count < 0) break; if (cancellation.isCanceled) throw java.util.concurrent.CancellationException(); digest.update(bytes, 0, count) } }
          check(digest.digest().joinToString("") { "%02x".format(it) } == source.sha256) { "Print page changed" }
          val bitmap = BitmapFactory.decodeFile(source.file.absolutePath) ?: throw IllegalStateException("Print page unavailable")
          try {
            val page = pdf.startPage(index + 1); val bounds = page.info.contentRect
            val scale = minOf(bounds.width().toFloat() / bitmap.width, bounds.height().toFloat() / bitmap.height)
            val width = bitmap.width * scale; val height = bitmap.height * scale
            val left = bounds.left + (bounds.width() - width) / 2; val top = bounds.top + (bounds.height() - height) / 2
            page.canvas.drawBitmap(bitmap, null, RectF(left, top, left + width, top + height), null)
            pdf.finishPage(page); written.add(PageRange(index, index))
          } finally { bitmap.recycle() }
        }
        if (cancellation.isCanceled) { store.observe(job, "cancelled"); callback.onWriteCancelled(); return@execute }
        ParcelFileDescriptor.AutoCloseOutputStream(destination).use { output -> pdf.writeTo(output); output.flush() }
        store.observe(job, "written", written.size); callback.onWriteFinished(written.toTypedArray())
      } catch (_: java.util.concurrent.CancellationException) { store.observe(job, "cancelled"); callback.onWriteCancelled() }
      catch (error: Exception) { android.util.Log.w("GlitchpadPdfPrint", "stage=write failure="+error.javaClass.simpleName); store.observe(job, "failed"); callback.onWriteFailed("PDF print output failed") }
      finally { document?.close(); runCatching { destination.close() } }
    }
  }
  override fun onFinish() { store.finish(job) }
}
