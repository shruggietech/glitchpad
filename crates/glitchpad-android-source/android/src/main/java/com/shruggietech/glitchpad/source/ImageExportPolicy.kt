package com.shruggietech.glitchpad.source

/** Source-bound export guards are evaluated before opening a provider destination for writing. */
internal object ImageExportPolicy {
  fun readGenerated(input: java.io.InputStream, maximum: Int = 8 * 1024 * 1024): ByteArray {
    val output = java.io.ByteArrayOutputStream()
    val chunk = ByteArray(16 * 1024)
    while (true) {
      val count = input.read(chunk, 0, minOf(chunk.size, maximum - output.size() + 1))
      if (count < 0) return output.toByteArray()
      if (count > maximum - output.size()) throw IllegalStateException("budget_exceeded")
      output.write(chunk, 0, count)
    }
  }

  fun destination(originalAuthority: String?, originalId: String?, authority: String?, id: String?, existingBytes: Long?) {
    if (originalAuthority.isNullOrBlank() || originalId.isNullOrBlank() || authority.isNullOrBlank() || id.isNullOrBlank()) throw IllegalStateException("independent_destination_required")
    if (originalAuthority == authority && originalId == id) throw IllegalStateException("original_destination_denied")
    if (existingBytes != 0L) throw IllegalStateException("destination_conflict")
  }

  fun source(expectedHash: String, observedHash: String, cancelled: Boolean, registered: Boolean) {
    if (cancelled || !registered || expectedHash != observedHash) throw IllegalStateException("source_changed")
  }

  fun verified(expected: ByteArray, observed: ByteArray, cancelled: Boolean) {
    if (cancelled || !observed.contentEquals(expected)) throw IllegalStateException("write_verification_failed")
  }
}
