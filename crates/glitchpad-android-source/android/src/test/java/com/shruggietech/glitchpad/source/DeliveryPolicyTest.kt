package com.shruggietech.glitchpad.source

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DeliveryPolicyTest {
  @Test
  fun oversizedDocumentIdentitiesRemainBoundedAndUnique() {
    val sharedPrefix = "a".repeat(513)
    val first = boundedDocumentIdentity("${sharedPrefix}first")
    val second = boundedDocumentIdentity("${sharedPrefix}second")

    assertTrue(first.startsWith("sha256:"))
    assertEquals(71, first.length)
    assertNotEquals(first, second)
    assertEquals("short-id", boundedDocumentIdentity("short-id"))
  }

  @Test
  fun restorationCapacityRejectsNewRecordsWithoutEvictingTrackedGrants() {
    val current = (0 until 64).mapTo(mutableSetOf()) { "1|content://fixture/document/$it" }

    assertEquals(
      null,
      updatedRestorationRecords(
        current,
        "1|content://fixture/document/overflow",
        "content://fixture/document/overflow",
      ),
    )
    assertEquals(64, current.size)
    assertTrue(current.contains("1|content://fixture/document/0"))
  }

  @Test
  fun restorationCapacityStillAllowsExistingRecordsToBeUpdated() {
    val current = (0 until 64).mapTo(mutableSetOf()) { "1|content://fixture/document/$it" }
    val updated = requireNotNull(
      updatedRestorationRecords(
        current,
        "3|content://fixture/document/0",
        "content://fixture/document/0",
      ),
    )

    assertEquals(64, updated.size)
    assertFalse(updated.contains("1|content://fixture/document/0"))
    assertTrue(updated.contains("3|content://fixture/document/0"))
  }

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
