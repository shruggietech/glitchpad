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
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RestorationInstrumentedTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val clientContext = instrumentation.targetContext
  private val resolver = clientContext.contentResolver
  private val source = DocumentsContract.buildDocumentUri(AUTHORITY, "seekable.txt")

  @Test
  fun privateRestorationRecordSurvivesProcessBoundary() {
    when (InstrumentationRegistry.getArguments().getString("restorationPhase")) {
      "seed" -> seedPersistedSource()
      "verify" -> verifyPersistedSource()
      else -> {
        seedPersistedSource()
        verifyPersistedSource()
      }
    }
  }

  private fun seedPersistedSource() {
    grant(source)
    resolver.takePersistableUriPermission(source, PERSISTED_MODES)
    RestorationStore(clientContext).put(source, PERSISTED_MODES)
    assertTrue(resolver.persistedUriPermissions.any { it.uri == source && it.isReadPermission })
  }

  private fun verifyPersistedSource() {
    val record = RestorationStore(clientContext).records().single { it.first == source }
    assertEquals(PERSISTED_MODES, record.second)
    assertTrue(resolver.persistedUriPermissions.any { it.uri == source && it.isReadPermission })
    resolver.query(
      source,
      arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME),
      null,
      null,
      null,
    ).use { cursor ->
      requireNotNull(cursor)
      assertTrue(cursor.moveToFirst())
      assertEquals("seekable.txt", cursor.getString(0))
      assertEquals("seekable.txt", cursor.getString(1))
    }
    resolver.openFileDescriptor(source, "r").use { descriptor ->
      requireNotNull(descriptor)
      assertEquals(0L, Os.lseek(descriptor.fileDescriptor, 0, OsConstants.SEEK_CUR))
      assertTrue(FileInputStream(descriptor.fileDescriptor).read() >= 0)
    }
    RestorationStore(clientContext).remove(source)
    resolver.releasePersistableUriPermission(source, PERSISTED_MODES)
    revoke(source)
  }

  private fun grant(uri: Uri) {
    val launchOutput = executeShellCommand(
      "am start -a ${FixtureGrantActivity.ACTION_GRANT} " +
        "--es ${FixtureGrantActivity.EXTRA_URI} $uri " +
        "-n ${instrumentation.context.packageName}/${FixtureGrantActivity::class.java.name}",
    )
    repeat(40) {
      try {
        resolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID), null, null, null).use { cursor ->
          if (cursor != null && cursor.moveToFirst()) return
        }
      } catch (_: SecurityException) {
        // The delegated activity grant can take a moment to become visible to the target process.
      }
      if (it < 39) SystemClock.sleep(50)
      else fail("fixture URI grant did not become usable: $launchOutput")
    }
  }

  private fun revoke(uri: Uri) {
    executeShellCommand(
      "am start -a ${FixtureGrantActivity.ACTION_REVOKE} " +
        "--es ${FixtureGrantActivity.EXTRA_URI} $uri " +
        "-n ${instrumentation.context.packageName}/${FixtureGrantActivity::class.java.name}",
    )
  }

  private fun executeShellCommand(command: String): String {
    val descriptor = instrumentation.uiAutomation.executeShellCommand(command)
    return ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { output ->
      output.readBytes().toString(Charsets.UTF_8)
    }
  }

  companion object {
    private const val AUTHORITY = "com.shruggietech.glitchpad.fixture.documents"
    private const val PERSISTED_MODES =
      Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
  }
}
