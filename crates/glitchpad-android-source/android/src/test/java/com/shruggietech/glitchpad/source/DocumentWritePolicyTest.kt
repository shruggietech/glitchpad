package com.shruggietech.glitchpad.source

import org.junit.Assert.assertEquals
import org.junit.Test

class DocumentWritePolicyTest {
  private fun refuses(code: String, action: () -> Unit) {
    try { action(); throw AssertionError("unsafe document write accepted") }
    catch (error: IllegalStateException) { assertEquals(code, error.message) }
  }

  @Test fun refusesKnownSourceAliasesAndNonemptyOrUnknownDestinationsBeforeWrite() {
    val source = DocumentDestination("provider", "source")
    refuses("original_destination_denied") { DocumentWritePolicy.destination(listOf(source), source, 0) }
    refuses("destination_conflict") { DocumentWritePolicy.destination(emptyList(), DocumentDestination("provider", "new"), 4) }
    refuses("destination_conflict") { DocumentWritePolicy.destination(emptyList(), DocumentDestination("provider", "new"), null) }
    refuses("independent_destination_required") { DocumentWritePolicy.destination(emptyList(), DocumentDestination(null, null), 0) }
    DocumentWritePolicy.destination(listOf(source), DocumentDestination("provider", "new"), 0)
    DocumentWritePolicy.destination(emptyList(), DocumentDestination("provider", "draft"), 0)
  }

  @Test fun descriptorAndReadbackPreventMisreportedSizeAndPartialSuccess() {
    refuses("destination_conflict") { DocumentWritePolicy.descriptorSize(3) }
    refuses("destination_conflict") { DocumentWritePolicy.descriptorSize(-1) }
    DocumentWritePolicy.descriptorSize(0)
    refuses("write_verification_failed") { DocumentWritePolicy.verified(byteArrayOf(1,2,3), byteArrayOf(1,2)) }
    DocumentWritePolicy.verified(byteArrayOf(1,2,3), byteArrayOf(1,2,3))
    DocumentWritePolicy.verified(byteArrayOf(), byteArrayOf())
  }

  @Test fun payloadBoundsNameAndMimeAreCheckedBeforePicker() {
    DocumentWritePolicy.payload(0, "untitled.md", "text/markdown")
    DocumentWritePolicy.payload(16 * 1024 * 1024, "Unicode 文本.txt", null)
    refuses("budget_exceeded") { DocumentWritePolicy.payload(16 * 1024 * 1024 + 1, "x", null) }
    for (name in listOf("", "../private", "a\\b", "line\nname", "x".repeat(257))) {
      refuses("invalid_destination_name") { DocumentWritePolicy.payload(1, name, null) }
    }
    refuses("invalid_media_type") { DocumentWritePolicy.payload(1, "x", "text/plain\nprivate") }
  }
}
