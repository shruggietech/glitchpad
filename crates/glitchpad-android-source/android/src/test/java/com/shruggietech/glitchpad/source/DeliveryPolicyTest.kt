package com.shruggietech.glitchpad.source

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeliveryPolicyTest {
  private val uri = "content://fixture/document/one"

  @Test
  fun viewRequiresExactlyOneReadableContentUri() {
    val candidate = DeliveryRules.inbound(
      DeliveryRules.ACTION_VIEW,
      listOf(uri),
      DeliveryRules.GRANT_READ,
    ).getOrThrow()
    assertEquals(DeliveryKind.VIEW, candidate.kind)
    assertFalse(candidate.persistenceOffered)
  }

  @Test
  fun duplicateShareCompatibilityFieldsNormalizeToOneItem() {
    val candidate = DeliveryRules.inbound(
      DeliveryRules.ACTION_SEND,
      listOf(uri, uri),
      DeliveryRules.GRANT_READ or DeliveryRules.GRANT_PERSIST,
    ).getOrThrow()
    assertEquals(DeliveryKind.SHARE, candidate.kind)
    assertEquals(0, DeliveryRules.persistableModes(candidate))
  }

  @Test
  fun distinctSharedItemsAreRejected() {
    assertTrue(
      DeliveryRules.inbound(
        DeliveryRules.ACTION_SEND,
        listOf(uri, "content://fixture/document/two"),
        DeliveryRules.GRANT_READ,
      ).isFailure,
    )
  }

  @Test
  fun pickerPersistenceUsesOnlyOfferedModes() {
    val candidate = DeliveryRules.pickerResult(
      uri,
      DeliveryKind.OPEN_RESULT,
      DeliveryRules.GRANT_READ or DeliveryRules.GRANT_PERSIST,
    ).getOrThrow()
    assertEquals(DeliveryRules.GRANT_READ, DeliveryRules.persistableModes(candidate))
  }

  @Test
  fun createResultSuppliesReadAndWriteWithoutChangingInboundPolicy() {
    val candidate = DeliveryRules.pickerResult(
      uri,
      DeliveryKind.CREATE_RESULT,
      DeliveryRules.GRANT_PERSIST,
    ).getOrThrow()
    assertTrue(candidate.readOffered)
    assertTrue(candidate.writeOffered)
    assertEquals(
      DeliveryRules.GRANT_READ or DeliveryRules.GRANT_WRITE,
      DeliveryRules.persistableModes(candidate),
    )
  }

  @Test
  fun unsupportedAndMissingDeliveriesAreStableFailures() {
    assertTrue(DeliveryRules.inbound("android.intent.action.EDIT", listOf(uri), DeliveryRules.GRANT_READ).isFailure)
    assertTrue(DeliveryRules.inbound(DeliveryRules.ACTION_SEND, emptyList(), DeliveryRules.GRANT_READ).isFailure)
    assertTrue(DeliveryRules.pickerResult(null, DeliveryKind.OPEN_RESULT, DeliveryRules.GRANT_READ).isFailure)
  }
}
