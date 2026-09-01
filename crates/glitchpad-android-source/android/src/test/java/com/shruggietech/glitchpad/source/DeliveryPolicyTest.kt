package com.shruggietech.glitchpad.source

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeliveryPolicyTest {
  private val uri = Uri.parse("content://fixture/document/one")

  @Test
  fun viewRequiresExactlyOneReadableContentUri() {
    val intent = Intent(Intent.ACTION_VIEW, uri)
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    val candidate = DeliveryPolicy.inbound(intent).getOrThrow()
    assertEquals(DeliveryKind.VIEW, candidate.kind)
    assertFalse(candidate.persistenceOffered)
  }

  @Test
  fun duplicateShareCompatibilityFieldsNormalizeToOneItem() {
    val intent = Intent(Intent.ACTION_SEND).apply {
      putExtra(Intent.EXTRA_STREAM, uri)
      clipData = ClipData.newRawUri("document", uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
    }
    val candidate = DeliveryPolicy.inbound(intent).getOrThrow()
    assertEquals(DeliveryKind.SHARE, candidate.kind)
    assertEquals(0, DeliveryPolicy.persistableModes(candidate))
  }

  @Test
  fun distinctSharedItemsAreRejected() {
    val clip = ClipData.newRawUri("one", uri)
    clip.addItem(ClipData.Item(Uri.parse("content://fixture/document/two")))
    val intent = Intent(Intent.ACTION_SEND).apply {
      clipData = clip
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    assertTrue(DeliveryPolicy.inbound(intent).isFailure)
  }

  @Test
  fun pickerPersistenceUsesOnlyOfferedModes() {
    val intent = Intent().setData(uri).addFlags(
      Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
    )
    val candidate = DeliveryPolicy.pickerResult(intent, DeliveryKind.OPEN_RESULT).getOrThrow()
    assertEquals(Intent.FLAG_GRANT_READ_URI_PERMISSION, DeliveryPolicy.persistableModes(candidate))
  }

  @Test
  fun createResultSuppliesReadAndWriteWithoutChangingInboundPolicy() {
    val intent = Intent().setData(uri).addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
    val candidate = DeliveryPolicy.pickerResult(intent, DeliveryKind.CREATE_RESULT).getOrThrow()
    assertTrue(candidate.readOffered)
    assertTrue(candidate.writeOffered)
    assertEquals(
      Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
      DeliveryPolicy.persistableModes(candidate),
    )
  }

  @Test
  fun unsupportedAndMissingDeliveriesAreStableFailures() {
    assertTrue(DeliveryPolicy.inbound(Intent(Intent.ACTION_EDIT, uri)).isFailure)
    assertTrue(DeliveryPolicy.inbound(Intent(Intent.ACTION_SEND)).isFailure)
    assertTrue(DeliveryPolicy.pickerResult(null, DeliveryKind.OPEN_RESULT).isFailure)
  }
}
