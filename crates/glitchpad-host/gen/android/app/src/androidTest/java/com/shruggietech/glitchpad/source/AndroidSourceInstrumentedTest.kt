package com.shruggietech.glitchpad.source

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.provider.DocumentsContract
import android.system.Os
import android.system.OsConstants
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
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
  private val modes = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
  private val clientUid = clientContext.packageManager.getApplicationInfo(clientContext.packageName, 0).uid
  private val grantedUris = mutableSetOf<Uri>()

  @After
  fun revokeFixtureGrants() {
    finishGrantActivity()
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
    assertEquals(
      PackageManager.PERMISSION_GRANTED,
      clientContext.checkUriPermission(source, -1, clientUid, Intent.FLAG_GRANT_READ_URI_PERMISSION),
    )

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
    }

    finishGrantActivity()
    grantedUris.remove(source)
    assertGrantRevoked(source)
  }

  private fun grant(uri: Uri): Uri {
    // ActivityManager stands in for the system picker, which alone can grant a protected provider URI.
    executeShellCommand(
      "am start -W --grant-read-uri-permission --grant-write-uri-permission " +
        "-a com.shruggietech.glitchpad.TEST_URI_GRANT -d $uri " +
        "-n ${clientContext.packageName}/.MainActivity",
    )
    assertEquals(
      PackageManager.PERMISSION_GRANTED,
      clientContext.checkUriPermission(uri, -1, clientUid, modes),
    )
    grantedUris.add(uri)
    return uri
  }

  private fun executeShellCommand(command: String) {
    val descriptor = instrumentation.uiAutomation.executeShellCommand(command)
    ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { output -> output.readBytes() }
  }

  private fun finishGrantActivity() {
    instrumentation.runOnMainSync {
      Stage.values()
        .flatMap { stage -> ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(stage) }
        .toSet()
        .forEach { activity -> activity.finish() }
    }
    instrumentation.waitForIdleSync()
  }

  private fun assertGrantRevoked(uri: Uri) {
    repeat(20) {
      if (clientContext.checkUriPermission(uri, -1, clientUid, modes) == PackageManager.PERMISSION_DENIED) return
      SystemClock.sleep(50)
    }
    assertEquals(
      PackageManager.PERMISSION_DENIED,
      clientContext.checkUriPermission(uri, -1, clientUid, modes),
    )
  }

  private fun rootUri(): Uri = DocumentsContract.buildDocumentUri(AUTHORITY, ROOT_ID)
  private fun documentUri(id: String): Uri = DocumentsContract.buildDocumentUri(AUTHORITY, id)

  companion object {
    private const val AUTHORITY = "com.shruggietech.glitchpad.fixture.documents"
    private const val ROOT_ID = "fixture-root"
  }
}
