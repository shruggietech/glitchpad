package com.shruggietech.glitchpad.source

internal data class DocumentDestination(val authority: String?, val documentId: String?)

/** Pure preflight and readback rules shared by draft, copy, and diagnostic writes. */
internal object DocumentWritePolicy {
  fun payload(size: Int, name: String, mime: String?) {
    if (size !in 0..16 * 1024 * 1024) throw IllegalStateException("budget_exceeded")
    if (name.codePointCount(0, name.length) !in 1..256 || name.any { it.isISOControl() || it == '/' || it == '\\' })
      throw IllegalStateException("invalid_destination_name")
    if (mime != null && (mime.length > 128 || !mime.matches(Regex("[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+"))))
      throw IllegalStateException("invalid_media_type")
  }

  fun destination(sources: Collection<DocumentDestination>, destination: DocumentDestination, size: Long?) {
    if (destination.authority.isNullOrBlank() || destination.documentId.isNullOrEmpty())
      throw IllegalStateException("independent_destination_required")
    if (sources.any { it == destination }) throw IllegalStateException("original_destination_denied")
    if (size != 0L) throw IllegalStateException("destination_conflict")
  }

  fun descriptorSize(size: Long) {
    if (size != 0L) throw IllegalStateException("destination_conflict")
  }

  fun verified(expected: ByteArray, observed: ByteArray) {
    if (!expected.contentEquals(observed)) throw IllegalStateException("write_verification_failed")
  }
}
