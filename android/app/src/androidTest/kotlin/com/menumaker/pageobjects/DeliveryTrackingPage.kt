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
}
