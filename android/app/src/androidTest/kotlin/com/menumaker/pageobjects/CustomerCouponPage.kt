package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Customer Coupon Browsing and Application
 * Provides fluent API for customer coupon interactions
 */
class CustomerCouponPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val availableCouponsList = composeTestRule.onAllNodesWithTag("AvailableCoupon")
    private val viewAllCouponsButton = composeTestRule.onNode(
        hasText("view all", substring = true, ignoreCase = true) or
        hasText("see all", substring = true, ignoreCase = true)
    )
    private val applyCouponButton = composeTestRule.onNodeWithText("apply", substring = true, ignoreCase = true)
    private val removeCouponButton = composeTestRule.onNodeWithText("remove", substring = true, ignoreCase = true)
    private val discountAmountLabel = composeTestRule.onNode(
        hasText("₹", substring = true) or hasText("%", substring = true)
    )
    private val appliedCouponBadge = composeTestRule.onNode(
        hasText("applied", substring = true, ignoreCase = true) or
        hasText("active", substring = true, ignoreCase = true)
    )
    private val couponErrorMessage = composeTestRule.onNode(
        hasText("invalid", substring = true, ignoreCase = true) or
        hasText("expired", substring = true, ignoreCase = true) or
        hasText("minimum order", substring = true, ignoreCase = true)
    )
    private val emptyStateMessage = composeTestRule.onNodeWithText("no coupon", substring = true, ignoreCase = true)
    private val searchCouponField = composeTestRule.onNodeWithTag("search-coupon-field")
    private val couponDescriptionLabel = composeTestRule.onNode(
        hasText("discount", substring = true, ignoreCase = true) or
        hasText("off", substring = true, ignoreCase = true)
    )
    private val validityLabel = composeTestRule.onNode(
        hasText("valid", substring = true, ignoreCase = true) or
        hasText("expire", substring = true, ignoreCase = true)
    )
    private val termsAndConditionsLabel = composeTestRule.onNode(
        hasText("terms", substring = true, ignoreCase = true) or
        hasText("conditions", substring = true, ignoreCase = true)
    )

    // Actions
    fun tapViewAllCoupons(): CustomerCouponPage {
        viewAllCouponsButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapFirstCoupon(): CustomerCouponPage {
        if (availableCouponsList.fetchSemanticsNodes().isNotEmpty()) {
            availableCouponsList[0].performClick()
            Thread.sleep(1000)
        }
        return this
    }

    fun applyCoupon(code: String): CustomerCouponPage {
        // Find and tap the coupon with matching code
        val couponElement = composeTestRule.onNodeWithText(code)
        try {
            couponElement.performClick()
            Thread.sleep(1000)
        } catch (e: AssertionError) {
            // Coupon not found
        }

        try {
            applyCouponButton.performClick()
            Thread.sleep(1000)
        } catch (e: AssertionError) {
            // Apply button not found
        }

        return this
    }

    fun applyFirstAvailableCoupon(): CustomerCouponPage {
        tapFirstCoupon()

        try {
            applyCouponButton.performClick()
            Thread.sleep(1000)
        } catch (e: AssertionError) {
            // Apply button not found
        }

        return this
    }

    fun removeCoupon(): CustomerCouponPage {
        removeCouponButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun searchCoupon(query: String): CustomerCouponPage {
        searchCouponField.performTextInput(query)
        return this
    }

    fun filterCoupons(filter: CouponFilter): CustomerCouponPage {
        val filterButton = when (filter) {
            CouponFilter.ALL -> composeTestRule.onNodeWithText("all", ignoreCase = true)
            CouponFilter.ACTIVE -> composeTestRule.onNodeWithText("active", ignoreCase = true)
            CouponFilter.EXPIRED -> composeTestRule.onNodeWithText("expired", ignoreCase = true)
        }

        try {
            filterButton.performClick()
            Thread.sleep(1000)
        } catch (e: AssertionError) {
            // Filter button not found
        }

        return this
    }

    // Assertions
    fun assertScreenDisplayed(): CustomerCouponPage {
        composeTestRule.waitUntil(timeoutMillis = 2000) {
            availableCouponsList.fetchSemanticsNodes().isNotEmpty() ||
            try { emptyStateMessage.assertExists(); true } catch (e: AssertionError) { false } ||
            try { viewAllCouponsButton.assertExists(); true } catch (e: AssertionError) { false }
        }
        return this
    }

    fun assertCouponsAvailable(): CustomerCouponPage {
        assert(availableCouponsList.fetchSemanticsNodes().isNotEmpty()) {
            "Coupons should be available"
        }
        return this
    }

    fun assertCouponApplied(): CustomerCouponPage {
        val badgeExists = try { appliedCouponBadge.assertExists(); true } catch (e: AssertionError) { false }
        val removeButtonExists = try { removeCouponButton.assertExists(); true } catch (e: AssertionError) { false }
        assert(badgeExists || removeButtonExists) {
            "Coupon should be applied"
        }
        return this
    }

    fun assertCouponRemoved(): CustomerCouponPage {
        appliedCouponBadge.assertDoesNotExist()
        removeCouponButton.assertDoesNotExist()
        return this
    }

    fun assertCouponError(): CustomerCouponPage {
        couponErrorMessage.assertExists()
        return this
    }

    fun assertEmptyState(): CustomerCouponPage {
        emptyStateMessage.assertExists()
        return this
    }

    fun assertCouponDetails(): CustomerCouponPage {
        val descriptionExists = try { couponDescriptionLabel.assertExists(); true } catch (e: AssertionError) { false }
        val validityExists = try { validityLabel.assertExists(); true } catch (e: AssertionError) { false }
        assert(descriptionExists || validityExists) {
            "Coupon details should be displayed"
        }
        return this
    }

    fun assertDiscountDisplayed(): CustomerCouponPage {
        discountAmountLabel.assertExists()
        return this
    }

    enum class CouponFilter {
        ALL,
        ACTIVE,
        EXPIRED
    }
}
