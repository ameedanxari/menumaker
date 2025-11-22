package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Delivery Tracking Screen
 */
class DeliveryTrackingPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val orderStatusLabel = composeTestRule.onNode(hasTestTag("OrderStatus"))
    private val estimatedTimeLabel = composeTestRule.onNode(hasTestTag("EstimatedTime"))
    private val trackingSteps = composeTestRule.onAllNodes(hasTestTag("TrackingStep"))
    private val deliveryPersonName = composeTestRule.onNode(hasTestTag("DeliveryPersonName"))
    private val callButton = composeTestRule.onNodeWithText("Call", ignoreCase = true)
    private val whatsappButton = composeTestRule.onNodeWithText("WhatsApp", ignoreCase = true)
    private val mapView = composeTestRule.onNode(hasTestTag("MapView"))
    private val cancelOrderButton = composeTestRule.onNodeWithText("Cancel Order", ignoreCase = true)
    private val rateOrderButton = composeTestRule.onNodeWithText("Rate", substring = true, ignoreCase = true)

    // Actions
    fun tapCallDeliveryPerson(): DeliveryTrackingPage {
        callButton.performClick()
        Thread.sleep(500)
        return this
    }

    fun tapWhatsAppDeliveryPerson(): DeliveryTrackingPage {
        whatsappButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapCancelOrder(): DeliveryTrackingPage {
        cancelOrderButton.performScrollTo()
        cancelOrderButton.performClick()
        Thread.sleep(1000)
        composeTestRule.onNodeWithText("Confirm", ignoreCase = true).performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapRateOrder(): DeliveryTrackingPage {
        rateOrderButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapMapForFullScreen(): DeliveryTrackingPage {
        mapView.performClick()
        Thread.sleep(500)
        return this
    }

    fun refreshTracking(): DeliveryTrackingPage {
        composeTestRule.onNode(hasContentDescription("refresh", substring = true, ignoreCase = true)).performClick()
        Thread.sleep(1000)
        return this
    }

    fun confirmCancellation(reason: String? = null): DeliveryTrackingPage {
        if (reason != null) {
            // Enter cancellation reason if provided
            val reasonField = composeTestRule.onNode(
                hasTestTag("CancellationReasonField") or
                hasText("Reason", substring = true, ignoreCase = true) or
                hasText("Why are you cancelling", substring = true, ignoreCase = true)
            )
            try {
                reasonField.performTextInput(reason)
            } catch (e: AssertionError) {
                // Reason field not found or not required
            }
        }
        composeTestRule.onNode(
            hasTestTag("ConfirmCancellationButton") or
            hasText("Confirm", ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapReportIssue(): DeliveryTrackingPage {
        composeTestRule.onNode(
            hasTestTag("ReportIssueButton") or
            hasText("Report Issue", ignoreCase = true) or
            hasText("Report a problem", substring = true, ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun selectIssue(issue: String): DeliveryTrackingPage {
        composeTestRule.onNode(
            hasTestTag("IssueOption_$issue") or
            hasText(issue, ignoreCase = true)
        ).performClick()
        Thread.sleep(500)
        return this
    }

    fun submitIssue(): DeliveryTrackingPage {
        composeTestRule.onNode(
            hasTestTag("SubmitIssueButton") or
            hasText("Submit", ignoreCase = true) or
            hasText("Report", ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): DeliveryTrackingPage {
        orderStatusLabel.assertExists()
        return this
    }

    fun assertTrackingStepsDisplayed(): DeliveryTrackingPage {
        assert(trackingSteps.fetchSemanticsNodes().isNotEmpty()) {
            "Tracking steps should be displayed"
        }
        return this
    }

    fun assertMapDisplayed(): DeliveryTrackingPage {
        mapView.assertExists()
        return this
    }

    fun assertDeliveryPersonInfoDisplayed(): DeliveryTrackingPage {
        deliveryPersonName.assertExists()
        return this
    }

    fun assertCallButtonVisible(): DeliveryTrackingPage {
        callButton.assertExists()
        return this
    }

    fun assertOrderDetailsDisplayed(): DeliveryTrackingPage {
        orderStatusLabel.assertExists()
        return this
    }

    fun assertTrackingStatusDisplayed(): DeliveryTrackingPage {
        orderStatusLabel.assertExists()
        return this
    }

    fun assertDeliveryPersonNameDisplayed(): DeliveryTrackingPage {
        deliveryPersonName.assertExists()
        return this
    }

    fun assertEstimatedTimeDisplayed(): DeliveryTrackingPage {
        estimatedTimeLabel.assertExists()
        return this
    }

    fun assertOrderIdDisplayed(): DeliveryTrackingPage {
        // Check for order ID display with multiple strategies
        composeTestRule.onNode(
            hasTestTag("OrderId") or
            hasTestTag("OrderNumber") or
            hasText("#", substring = true) or
            (hasText("order", substring = true, ignoreCase = true) and hasText("#", substring = true))
        ).assertExists()
        return this
    }

    fun assertStatusStepsDisplayed(): DeliveryTrackingPage {
        assertTrackingStepsDisplayed()
        return this
    }

    fun assertDeliveryPersonPhoneDisplayed(): DeliveryTrackingPage {
        composeTestRule.onNode(
            hasTestTag("DeliveryPersonPhone") or
            hasTestTag("ContactNumber") or
            (hasText("+", substring = true) and hasText("91", substring = true)) or
            hasText("phone", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertOrderCancelled(): DeliveryTrackingPage {
        composeTestRule.onNode(
            hasTestTag("OrderStatus_Cancelled") or
            hasText("cancelled", substring = true, ignoreCase = true) or
            hasText("canceled", substring = true, ignoreCase = true) or
            hasText("Order has been cancelled", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertDeliveryAddressDisplayed(): DeliveryTrackingPage {
        composeTestRule.onNode(
            hasTestTag("DeliveryAddress") or
            hasTestTag("DeliveryLocation") or
            hasText("deliver to", substring = true, ignoreCase = true) or
            hasText("address", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertIssueReported(): DeliveryTrackingPage {
        composeTestRule.onNode(
            hasTestTag("IssueReportedMessage") or
            hasText("reported successfully", substring = true, ignoreCase = true) or
            hasText("issue has been reported", substring = true, ignoreCase = true) or
            hasText("submitted", substring = true, ignoreCase = true) or
            hasText("thank you for reporting", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }
}
