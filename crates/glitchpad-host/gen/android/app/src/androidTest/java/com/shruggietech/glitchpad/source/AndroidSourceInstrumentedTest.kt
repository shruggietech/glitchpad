package com.shruggietech.glitchpad.source

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.DocumentsContract
import android.system.Os
import android.system.OsConstants
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.FileInputStream
import java.io.FileOutputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidSourceInstrumentedTest {
  private val resolver = InstrumentationRegistry.getInstrumentation().context.contentResolver

  @Test
  fun controlledProviderSupportsMetadataSeekAndVerifiedWrite() {
    val source = documentUri("seekable.txt")
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

    val createdId = DocumentsContract.createDocument(resolver, rootUri(), "text/plain", "save-as.txt")
    val created = requireNotNull(createdId)
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
    val source = documentUri("unknown-size.txt")
    resolver.query(source, arrayOf("_display_name", "_size", "last_modified"), null, null, null).use { cursor ->
      requireNotNull(cursor)
      assertTrue(cursor.moveToFirst())
      assertTrue(cursor.isNull(cursor.getColumnIndexOrThrow("_size")))
      assertTrue(cursor.getLong(cursor.getColumnIndexOrThrow("last_modified")) > 0)
    }
    assertEquals("text/plain", resolver.getType(source))

    resolver.openFileDescriptor(documentUri("pipe.txt"), "r").use { descriptor ->
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
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val testContext = instrumentation.context
    val targetContext = instrumentation.targetContext
    val source = documentUri("seekable.txt")
    val modes = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    val targetUid = targetContext.packageManager.getApplicationInfo(targetContext.packageName, 0).uid
    testContext.grantUriPermission(targetContext.packageName, source, modes)
    assertEquals(
      PackageManager.PERMISSION_GRANTED,
      targetContext.checkUriPermission(source, -1, targetUid, Intent.FLAG_GRANT_READ_URI_PERMISSION),
    )

    val mutable = requireNotNull(DocumentsContract.createDocument(resolver, rootUri(), "text/plain", "rename-me.txt"))
    val renamed = requireNotNull(DocumentsContract.renameDocument(resolver, mutable, "renamed.txt"))
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
    }

    testContext.revokeUriPermission(targetContext.packageName, source, modes)
    assertEquals(
      PackageManager.PERMISSION_DENIED,
      targetContext.checkUriPermission(source, -1, targetUid, Intent.FLAG_GRANT_READ_URI_PERMISSION),
    )
  }

  private fun rootUri(): Uri = DocumentsContract.buildDocumentUri(AUTHORITY, ROOT_ID)
  private fun documentUri(id: String): Uri = DocumentsContract.buildDocumentUri(AUTHORITY, id)

  companion object {
    private const val AUTHORITY = "com.shruggietech.glitchpad.fixture.documents"
    private const val ROOT_ID = "fixture-root"
  }
}
