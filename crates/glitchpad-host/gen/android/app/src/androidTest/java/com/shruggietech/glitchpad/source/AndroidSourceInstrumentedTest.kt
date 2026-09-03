package com.shruggietech.glitchpad.source

import android.content.Intent
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.provider.DocumentsContract
import android.system.Os
import android.system.OsConstants
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.FileInputStream
import java.io.FileOutputStream
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
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

  private fun grant(uri: Uri): Uri {
    // Shell opens the test-only provider UI; that foreground provider activity delegates URI authority.
    val launchOutput = executeShellCommand(
      "am start -a ${FixtureGrantActivity.ACTION_GRANT} " +
        "--es ${FixtureGrantActivity.EXTRA_URI} $uri " +
        "-n ${instrumentation.context.packageName}/${FixtureGrantActivity::class.java.name}",
    )
    var lastFailure = "provider returned no document row"
    repeat(40) {
      try {
        resolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID), null, null, null).use { cursor ->
          if (cursor != null && cursor.moveToFirst()) {
            grantedUris.add(uri)
            return uri
          }
        }
      } catch (error: SecurityException) {
        lastFailure = error.message ?: error.javaClass.name
        // The delegated activity grant can take a moment to become visible to the target process.
      }
      if (it < 39) {
        SystemClock.sleep(50)
      } else {
        fail("fixture URI grant did not become usable ($lastFailure): $launchOutput")
      }
    }
    error("fixture grant assertion returned unexpectedly")
  }

  private fun executeShellCommand(command: String): String {
    val descriptor = instrumentation.uiAutomation.executeShellCommand(command)
    return ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { output ->
      output.readBytes().toString(Charsets.UTF_8)
    }
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
