package com.shruggietech.glitchpad.source

import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.ProviderInfo
import android.content.res.AssetManager
import android.net.Uri
import android.os.SystemClock
import android.provider.DocumentsContract
import android.system.Os
import android.system.OsConstants
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.UUID
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidSourceInstrumentedTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val clientContext = instrumentation.targetContext
  private val resolver = clientContext.contentResolver
  private val grantedUris = mutableSetOf<Uri>()

  @After
  fun revokeFixtureGrants() {
    grantedUris.forEach(::revoke)
    grantedUris.clear()
  }

  @Test
  fun controlledProviderSupportsMetadataSeekAndVerifiedWrite() {
    val source = grant(documentUri("seekable.txt"))
    resolver.query(source, null, null, null, null).use { cursor ->
      requireNotNull(cursor)
      assertTrue(cursor.moveToFirst())
      assertEquals("seekable.txt", cursor.getString(cursor.getColumnIndexOrThrow("_display_name")))
      assertTrue(cursor.getLong(cursor.getColumnIndexOrThrow("_size")) > 0)
    }
    resolver.openFileDescriptor(source, "r").use { descriptor ->
      requireNotNull(descriptor)
      assertTrue(descriptor.fileDescriptor.valid())
      assertTrue(FileInputStream(descriptor.fileDescriptor).channel.position(5).position() == 5L)
    }

    val createdId = DocumentsContract.createDocument(resolver, grant(rootUri()), "text/plain", "save-as.txt")
    val created = grant(requireNotNull(createdId))
    val payload = "verified save-as payload".toByteArray()
    resolver.openFileDescriptor(created, "rw").use { descriptor ->
      requireNotNull(descriptor)
      FileOutputStream(descriptor.fileDescriptor).use { output ->
        output.channel.truncate(0)
        output.write(payload)
        output.fd.sync()
      }
    }
    val observed = resolver.openInputStream(created).use { requireNotNull(it).readBytes() }
    assertArrayEquals(payload, observed)
  }

  @Test
  fun controlledProviderPreservesOptionalSizeAndMutationEvidence() {
    val source = grant(documentUri("unknown-size.txt"))
    resolver.query(source, arrayOf("_display_name", "_size", "last_modified"), null, null, null).use { cursor ->
      requireNotNull(cursor)
      assertTrue(cursor.moveToFirst())
      assertTrue(cursor.isNull(cursor.getColumnIndexOrThrow("_size")))
      assertTrue(cursor.getLong(cursor.getColumnIndexOrThrow("last_modified")) > 0)
    }
    assertEquals("text/plain", resolver.getType(source))

    resolver.openFileDescriptor(grant(documentUri("pipe.txt")), "r").use { descriptor ->
      requireNotNull(descriptor)
      try {
        Os.lseek(descriptor.fileDescriptor, 0, OsConstants.SEEK_CUR)
        fail("pipe fixture unexpectedly advertised seek support")
      } catch (_: android.system.ErrnoException) {
        // Expected stream-only provider behavior.
      }
    }
  }

  @Test
  fun controlledProviderPreservesMetadataOmissionsAndUnicodeVerbatim() {
    val omitted = grant(documentUri("metadata-omitted.txt"))
    resolver.query(omitted, arrayOf("_display_name", "_size", "last_modified"), null, null, null).use { cursor ->
      requireNotNull(cursor)
      assertTrue(cursor.moveToFirst())
      assertTrue(cursor.isNull(cursor.getColumnIndexOrThrow("_display_name")))
      assertTrue(cursor.isNull(cursor.getColumnIndexOrThrow("_size")))
      assertTrue(cursor.isNull(cursor.getColumnIndexOrThrow("last_modified")))
    }

    val unicodeName = "\u05e9\u05dc\u05d5\u05dd-e\u0301-\ud83e\uddea.txt"
    val unicode = grant(documentUri(unicodeName))
    resolver.query(unicode, arrayOf("_display_name"), null, null, null).use { cursor ->
      requireNotNull(cursor)
      assertTrue(cursor.moveToFirst())
      assertEquals(unicodeName, cursor.getString(0))
    }
  }

  @Test
  fun controlledProviderSurfacesUnavailableMetadataWithoutInventingARow() {
    val unavailable = grant(documentUri("provider-unavailable.txt"))
    resolver.query(unavailable, arrayOf("_display_name", "_size"), null, null, null).use { cursor ->
      assertNull(cursor)
    }
  }

  @Test
  fun controlledProviderDeliversExactMermaidSourceAndMediaType() {
    val source = grant(documentUri("diagram.mmd"))
    assertEquals("text/vnd.mermaid", resolver.getType(source))
    val expected = "flowchart LR\nSource --> Session\n".toByteArray()
    val observed = resolver.openInputStream(source).use { requireNotNull(it).readBytes() }
    assertArrayEquals(expected, observed)
  }

  @Test
  fun controlledProviderExposesRenameFailureAndRevocationEvidence() {
    val source = grant(documentUri("seekable.txt"))
    resolver.openInputStream(source).use { assertTrue(requireNotNull(it).read() >= 0) }

    val mutable = grant(requireNotNull(DocumentsContract.createDocument(resolver, grant(rootUri()), "text/plain", "rename-me.txt")))
    val renamed = grant(requireNotNull(DocumentsContract.renameDocument(resolver, mutable, "renamed.txt")))
    resolver.query(renamed, arrayOf("_display_name"), null, null, null).use { cursor ->
      requireNotNull(cursor)
      assertTrue(cursor.moveToFirst())
      assertEquals("renamed.txt", cursor.getString(0))
    }
    DocumentsContract.deleteDocument(resolver, renamed)
    try {
      resolver.openInputStream(renamed)?.close()
      fail("deleted provider source remained readable")
    } catch (_: java.io.FileNotFoundException) {
      // Expected controlled provider failure.
    } catch (_: SecurityException) {
      // DocumentsProvider may revoke the deleted document's URI grant immediately.
    }

    revoke(source)
    grantedUris.remove(source)
    assertGrantRevoked(source)
  }

  @Test
  fun controlledProviderRecreationKeepsCanonicalRevisionAndRefreshesChangedBytes() {
    val isolated = File(clientContext.cacheDir, "canonical-provider-recreation-" + UUID.randomUUID())
    assertTrue("the isolated provider fixture root must be created", isolated.mkdir())
    val fixtureContext = object : ContextWrapper(clientContext) {
      override fun getFilesDir(): File = isolated
      override fun getAssets(): AssetManager = instrumentation.context.assets
    }
    fun recreate(): FixtureDocumentsProvider {
      val provider = FixtureDocumentsProvider()
      val info = ProviderInfo().apply {
        authority = AUTHORITY
        exported = true
        grantUriPermissions = true
        readPermission = "android.permission.MANAGE_DOCUMENTS"
        writePermission = "android.permission.MANAGE_DOCUMENTS"
      }
      provider.attachInfo(fixtureContext, info)
      return provider
    }
    fun overwrite(file: File, bytes: ByteArray) {
      FileOutputStream(file).use { output -> output.write(bytes); output.fd.sync() }
    }
    fun revision(provider: FixtureDocumentsProvider, id: String): Long =
      provider.queryDocument(id, arrayOf(DocumentsContract.Document.COLUMN_LAST_MODIFIED)).use { cursor ->
        assertTrue("the recreated provider must expose revision evidence", cursor.moveToFirst())
        cursor.getLong(0)
      }
    try {
      val first = recreate()
      val directory = File(isolated, "document-provider-fixtures")
      val expected = requireNotNull(directory.listFiles()).associate { it.name to it.readBytes() }
      assertTrue("text, binary and empty canonical fixtures must all be present", expected.containsKey("recovery-warm-corpus.md") && expected.containsKey("original.png") && expected.getValue("recovery-empty.md").isEmpty())
      val stableTime = 1577836800000L
      expected.keys.forEach { name -> assertTrue("a controlled canonical timestamp must be supported", File(directory, name).setLastModified(stableTime)) }
      assertEquals(stableTime, revision(first, "resolver-warm"))
      val second = recreate()
      expected.forEach { (name, bytes) ->
        val file = File(directory, name)
        assertArrayEquals("provider recreation must retain exact canonical bytes", bytes, file.readBytes())
        assertEquals("matching canonical bytes must retain modification time", stableTime, file.lastModified())
      }
      assertEquals("the public warm-source revision must remain stable", stableTime, revision(second, "resolver-warm"))
      assertEquals("the public warm-corpus revision must remain stable", stableTime, revision(second, "recovery-warm-corpus.md"))

      val changedNames = listOf("recovery-warm-corpus.md", "original.png")
      changedNames.forEach { name ->
        val stale = expected.getValue(name).clone()
        stale[stale.lastIndex] = (stale.last().toInt() xor 1).toByte()
        overwrite(File(directory, name), stale)
        assertTrue(File(directory, name).setLastModified(stableTime + 12_000L))
      }
      assertTrue("a missing canonical fixture must be recreated", File(directory, "seekable.txt").delete())
      val explicitId = second.createDocument(ROOT_ID, "text/plain", "s046-explicit-mutation.txt")
      val explicit = File(directory, explicitId)
      val explicitBytes = "S046_EXPLICIT_MUTATION_RETAINED\n".toByteArray(Charsets.UTF_8)
      overwrite(explicit, explicitBytes)
      assertTrue(explicit.setLastModified(stableTime))
      val third = recreate()
      expected.forEach { (name, bytes) -> assertArrayEquals("stale or missing canonical fixtures must match the current APK", bytes, File(directory, name).readBytes()) }
      changedNames.forEach { name -> assertTrue("changed canonical bytes must be refreshed", File(directory, name).lastModified() != stableTime + 12_000L) }
      assertArrayEquals("provider initialization must retain explicit noncanonical mutations", explicitBytes, explicit.readBytes())
      assertEquals(stableTime, explicit.lastModified())
      val refreshedRevision = revision(third, "recovery-warm-corpus.md")
      val refreshedTimes = expected.keys.associateWith { File(directory, it).lastModified() }
      val fourth = recreate()
      expected.forEach { (name, bytes) ->
        assertArrayEquals(bytes, File(directory, name).readBytes())
        assertEquals("a refreshed canonical fixture must become idempotent", refreshedTimes.getValue(name), File(directory, name).lastModified())
      }
      assertEquals(refreshedRevision, revision(fourth, "recovery-warm-corpus.md"))
    } finally {
      assertTrue("the isolated provider fixture root must be removed", isolated.deleteRecursively())
    }
  }

  private fun grant(uri: Uri): Uri {
    resolver.call(FixtureGrantProvider.COMMAND_URI, FixtureGrantProvider.METHOD_GRANT, uri.toString(), null)
    resolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID), null, null, null).use { cursor ->
      if (cursor != null && cursor.moveToFirst()) {
        grantedUris.add(uri)
        return uri
      }
    }
    fail("fixture provider returned no document row after a synchronous URI grant")
    error("fixture grant assertion returned unexpectedly")
  }

  private fun revoke(uri: Uri) {
    instrumentation.context.revokeUriPermission(
      uri,
      Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
    )
  }

  private fun assertGrantRevoked(uri: Uri) {
    repeat(20) {
      try {
        resolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID), null, null, null)?.close()
      } catch (_: SecurityException) {
        return
      }
      SystemClock.sleep(50)
    }
    fail("fixture URI remained usable after its grant activity finished")
  }

  private fun rootUri(): Uri = DocumentsContract.buildDocumentUri(AUTHORITY, ROOT_ID)
  private fun documentUri(id: String): Uri = DocumentsContract.buildDocumentUri(AUTHORITY, id)

  companion object {
    private const val AUTHORITY = "com.shruggietech.glitchpad.fixture.documents"
    private const val ROOT_ID = "fixture-root"
  }
}
