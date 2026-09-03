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
import com.shruggietech.glitchpad.R
import java.io.File
import java.io.FileInputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.xmlpull.v1.XmlPullParser

@RunWith(AndroidJUnit4::class)
class RestorationInstrumentedTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val clientContext = instrumentation.targetContext
  private val resolver = clientContext.contentResolver
  private val source = DocumentsContract.buildDocumentUri(AUTHORITY, "seekable.txt")

  @Test
  fun privateRestorationRecordSurvivesProcessBoundary() {
    assertRecoveryExcludedFromBackup()
    when (InstrumentationRegistry.getArguments().getString("restorationPhase")) {
      "seed" -> {
        seedPersistedSource()
        seedRecoveryRecord()
      }
      "verify" -> {
        verifyPersistedSource()
        verifyRecoveryRecord()
      }
      else -> {
        seedPersistedSource()
        seedRecoveryRecord()
        verifyPersistedSource()
        verifyRecoveryRecord()
      }
    }
  }

  private fun seedRecoveryRecord() {
    assertTrue(recoveryDirectory.mkdirs() || recoveryDirectory.isDirectory)
    recoveryRecord.writeBytes(RECOVERY_EVIDENCE)
  }

  private fun verifyRecoveryRecord() {
    assertTrue(recoveryRecord.isFile)
    assertTrue(recoveryRecord.readBytes().contentEquals(RECOVERY_EVIDENCE))
    assertTrue(recoveryRecord.delete())
    recoveryDirectory.delete()
  }

  private fun assertRecoveryExcludedFromBackup() {
    assertBackupRule(R.xml.backup_rules)
    assertBackupRule(R.xml.backup_rules_legacy)
  }

  private fun assertBackupRule(resourceId: Int) {
    val parser = clientContext.resources.getXml(resourceId)
    var matched = false
    while (parser.eventType != XmlPullParser.END_DOCUMENT) {
      if (
        parser.eventType == XmlPullParser.START_TAG &&
        parser.name == "exclude" &&
        parser.getAttributeValue(null, "domain") == "root" &&
        parser.getAttributeValue(null, "path") == "recovery-v1/"
      ) {
        matched = true
      }
      parser.next()
    }
    parser.close()
    assertTrue("recovery-v1 must be excluded from backup and transfer", matched)
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
    instrumentation.context.revokeUriPermission(uri, PERSISTED_MODES)
  }

  private fun executeShellCommand(command: String): String {
    repeat(20) { attempt ->
      // API 36 can transiently return null while its UiAutomation bridge reconnects between tests.
      val automation = InstrumentationRegistry.getInstrumentation().uiAutomation
      if (automation != null) {
        val descriptor = automation.executeShellCommand(command)
        return ParcelFileDescriptor.AutoCloseInputStream(descriptor).use { output ->
          output.readBytes().toString(Charsets.UTF_8)
        }
      }
      if (attempt < 19) SystemClock.sleep(100)
    }
    error("UiAutomation remained unavailable while executing: $command")
  }

  companion object {
    private const val AUTHORITY = "com.shruggietech.glitchpad.fixture.documents"
    private const val PERSISTED_MODES =
      Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
    private val RECOVERY_EVIDENCE = "private recovery survives force-stop".toByteArray(Charsets.UTF_8)
  }

  private val recoveryDirectory: File
    get() = File(clientContext.dataDir, "recovery-v1")
  private val recoveryRecord: File
    get() = File(recoveryDirectory, "00000000-0000-4000-8000-000000000012.json")
}
