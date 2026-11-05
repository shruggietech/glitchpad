package com.shruggietech.glitchpad.source

import org.junit.Assert.assertEquals
import org.junit.Test

class DiagnosticShareSelectionsTest {
  @Test fun chooserSelectionIsOneHandoffAndCancellationCannotBecomeDelivery() {
    var handoffs = 0
    DiagnosticShareSelections.register("first") { handoffs++ }
    DiagnosticShareSelections.selected("first")
    DiagnosticShareSelections.selected("first")
    assertEquals(1, handoffs)
    DiagnosticShareSelections.register("cancelled") { handoffs++ }
    DiagnosticShareSelections.remove("cancelled")
    DiagnosticShareSelections.selected("cancelled")
    assertEquals(1, handoffs)
  }
}
