package com.shruggietech.glitchpad.source

import java.io.File
import java.io.IOException
import java.io.FileNotFoundException
import java.nio.file.Files
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class ClipboardTextStoreTest {
  @get:Rule val temporary = TemporaryFolder()
  private fun directory() = File(temporary.root, "clipboard")
  private fun largeText() = "Ω🙂 first\n" + "source text\n".repeat(50_000) + "last\n"

  @Test fun smallAndBoundaryTextRemainInlineWithoutCreatingAFile() {
    val directory = directory()
    val store = ClipboardTextStore(directory)
    for (text in listOf("", "Ω🙂\nsecond", "x".repeat(ClipboardTextStore.MAX_INLINE_CODE_UNITS))) {
      val payload = store.prepare(text)
      assertEquals(text, payload.inlineText)
      assertNull(payload.file)
    }
    assertFalse(directory.exists())
  }

  @Test fun largeTextUsesAnIndependentExactUtf8FileWithoutTruncation() {
    val store = ClipboardTextStore(directory())
    val text = largeText()
    val first = store.prepare(text)
    val second = store.prepare(text + "new")
    assertNull(first.inlineText)
    assertNotNull(first.file)
    assertNotEquals(first.file, second.file)
    assertArrayEquals(text.toByteArray(Charsets.UTF_8), first.file!!.readBytes())
    assertEquals(text + "new", second.file!!.readText(Charsets.UTF_8))
  }

  @Test fun crossingTheInlineBoundaryDoesNotDropACharacter() {
    val text = "x".repeat(ClipboardTextStore.MAX_INLINE_CODE_UNITS) + "Ω"
    val payload = ClipboardTextStore(directory()).prepare(text)
    assertNull(payload.inlineText)
    assertEquals(text, payload.file!!.readText(Charsets.UTF_8))
  }

  @Test fun aFailedReplacementKeepsThePreviouslyPublishedPayload() {
    val store = ClipboardTextStore(directory())
    val published = store.prepare(largeText())
    store.retirePrevious(published)
    val failed = store.prepare(largeText() + "replacement")
    store.discardUncommitted(failed)
    assertFalse(failed.file!!.exists())
    assertEquals(largeText(), published.file!!.readText(Charsets.UTF_8))
  }

  @Test fun queuedReplacementCleanupCannotDeleteANewerPreparedPayload() {
    val store = ClipboardTextStore(directory())
    val first = store.prepare(largeText())
    val second = store.prepare(largeText() + "second")
    val third = store.prepare(largeText() + "third")
    store.retirePrevious(first)
    assertTrue(second.file!!.exists())
    assertTrue(third.file!!.exists())
    store.retirePrevious(second)
    assertFalse(first.file!!.exists())
    assertTrue(second.file!!.exists())
    assertTrue(third.file!!.exists())
    store.retirePrevious(third)
    assertFalse(second.file!!.exists())
    assertEquals(largeText() + "third", third.file!!.readText(Charsets.UTF_8))
  }

  @Test fun successfulInlineReplacementRetiresOnlyOwnedPreviousFiles() {
    val directory = directory()
    val store = ClipboardTextStore(directory)
    val large = store.prepare(largeText())
    val unrelated = File(directory, "unrelated.txt").apply { writeText("keep", Charsets.UTF_8) }
    val small = store.prepare("small")
    assertTrue(large.file!!.exists())
    store.retirePrevious(small)
    assertFalse(large.file!!.exists())
    assertEquals("keep", unrelated.readText(Charsets.UTF_8))
  }

  @Test fun unavailableStorageCannotProduceAPartialPayload() {
    val notDirectory = temporary.newFile("blocked")
    val store = ClipboardTextStore(notDirectory)
    assertEquals("small", store.prepare("small").inlineText)
    try { store.prepare(largeText()); fail("large payload unexpectedly used unavailable storage") }
    catch (_: IOException) { assertEquals(0L, notDirectory.length()) }
  }

  @Test fun opaqueTokensResolveOnlyTheExactPreparedFile() {
    val store = ClipboardTextStore(directory())
    val first = store.prepare(largeText()).file!!
    val second = store.prepare(largeText()).file!!
    assertTrue(first.name.matches(Regex("clip-[0-9a-f-]{36}\\.txt")))
    assertNotEquals(first.name, second.name)
    assertEquals(first.canonicalFile, store.resolveToken(first.name))
    assertArrayEquals(largeText().toByteArray(Charsets.UTF_8), store.resolveToken(first.name).readBytes())
  }

  private fun rejectsToken(store: ClipboardTextStore, name: String) {
    try { store.resolveToken(name); fail("unexpected clipboard token: " + name) }
    catch (_: FileNotFoundException) { }
  }

  @Test fun tokensCannotEnumerateTraverseOrReadAnUnrelatedFile() {
    val directory = directory().apply { mkdirs() }
    val unrelated = File(directory, "unrelated.txt").apply { writeText("not copied", Charsets.UTF_8) }
    val store = ClipboardTextStore(directory)
    for (name in listOf("", ".", "..", "../" + unrelated.name, unrelated.name, unrelated.absolutePath,
      "clip-00000000-0000-4000-8000-000000000000.txt", "clip-00000000-0000-4000-8000-000000000000.txt/../unrelated.txt")) rejectsToken(store, name)
    assertEquals("not copied", unrelated.readText(Charsets.UTF_8))
  }

  @Test fun aTokenCannotFollowALinkOutsideTheClipboardDirectory() {
    val directory = directory().apply { mkdirs() }
    val outside = temporary.newFile("private.txt").apply { writeText("private", Charsets.UTF_8) }
    val link = File(directory, "clip-00000000-0000-4000-8000-000000000000.txt")
    Files.createSymbolicLink(link.toPath(), outside.toPath())
    rejectsToken(ClipboardTextStore(directory), link.name)
    assertEquals("private", outside.readText(Charsets.UTF_8))
  }

  @Test fun successfulReplacementMakesAnOldTokenUnreadable() {
    val store = ClipboardTextStore(directory())
    val first = store.prepare(largeText()).file!!
    assertEquals(first.canonicalFile, store.resolveToken(first.name))
    store.retirePrevious(store.prepare("next copy"))
    rejectsToken(store, first.name)
  }
}
