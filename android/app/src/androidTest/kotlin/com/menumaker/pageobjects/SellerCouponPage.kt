package com.menumaker.pageobjects

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Seller Coupon Management Screen
 * Provides fluent API for seller coupon management interactions
 */
class SellerCouponPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val createCouponButton = composeTestRule.onNode(
        hasText("create", substring = true, ignoreCase = true) or
        hasText("add coupon", substring = true, ignoreCase = true)
    )
    private val couponList = composeTestRule.onAllNodesWithTag("CouponItem")
    private val emptyStateMessage = composeTestRule.onNodeWithText("no coupon", substring = true, ignoreCase = true)

    // Coupon form elements
    private val couponCodeField = composeTestRule.onNodeWithTag("coupon-code-field")
    private val percentageButton = composeTestRule.onNode(
        hasText("percentage", substring = true, ignoreCase = true) or hasText("%", substring = true)
    )
    private val fixedAmountButton = composeTestRule.onNode(
        hasText("fixed", substring = true, ignoreCase = true) or hasText("₹", substring = true)
    )
    private val discountValueField = composeTestRule.onNodeWithTag("discount-value-field")
    private val minOrderAmountField = composeTestRule.onNodeWithTag("min-order-amount-field")
    private val maxDiscountField = composeTestRule.onNodeWithTag("max-discount-field")
    private val usageLimitField = composeTestRule.onNodeWithTag("usage-limit-field")
    private val saveCouponButton = composeTestRule.onNode(
        hasText("save", substring = true, ignoreCase = true) or
        hasText("create", substring = true, ignoreCase = true)
    )
    private val cancelButton = composeTestRule.onNodeWithText("cancel", substring = true, ignoreCase = true)
    private val toggleActiveSwitch = composeTestRule.onNodeWithTag("toggle-active-switch")
    private val deleteButton = composeTestRule.onNodeWithText("delete", substring = true, ignoreCase = true)
    private val confirmDeleteButton = composeTestRule.onNode(
        hasText("confirm", substring = true, ignoreCase = true) or
        hasText("yes", ignoreCase = true)
    )

    // Actions
    fun tapCreateCoupon(): SellerCouponPage {
        composeTestRule.onNode(
            hasTestTag("CreateCouponButton") or
            hasText("create", substring = true, ignoreCase = true) or
            hasText("add coupon", substring = true, ignoreCase = true) or
            hasText("new coupon", substring = true, ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun enterCouponCode(code: String): SellerCouponPage {
        composeTestRule.onNode(
            hasTestTag("coupon-code-field") or
            hasTestTag("CouponCodeField") or
            hasText("code", substring = true, ignoreCase = true)
        ).performTextInput(code)
        return this
    }

    fun selectDiscountType(type: DiscountType): SellerCouponPage {
        when (type) {
            DiscountType.PERCENTAGE -> composeTestRule.onNode(
                hasTestTag("PercentageDiscountButton") or
                hasText("percentage", substring = true, ignoreCase = true) or
                hasText("%", substring = true)
            ).performClick()
            DiscountType.FIXED_AMOUNT -> composeTestRule.onNode(
                hasTestTag("FixedAmountButton") or
                hasText("fixed", substring = true, ignoreCase = true) or
                hasText("₹", substring = true) or
                hasText("amount", substring = true, ignoreCase = true)
            ).performClick()
        }
        return this
    }

    fun enterDiscountValue(value: String): SellerCouponPage {
        composeTestRule.onNode(
            hasTestTag("discount-value-field") or
            hasTestTag("DiscountValueField") or
            hasText("value", substring = true, ignoreCase = true) or
            hasText("discount", substring = true, ignoreCase = true)
        ).performTextInput(value)
        return this
    }

    fun enterMinOrderAmount(amount: String): SellerCouponPage {
        try {
            composeTestRule.onNode(
                hasTestTag("min-order-amount-field") or
                hasTestTag("MinOrderAmountField") or
                hasText("minimum order", substring = true, ignoreCase = true) or
                hasText("min amount", substring = true, ignoreCase = true)
            ).performTextInput(amount)
        } catch (e: AssertionError) {
            // Field not found or not required
        }
        return this
    }

    fun enterMaxDiscount(amount: String): SellerCouponPage {
        try {
            composeTestRule.onNode(
                hasTestTag("max-discount-field") or
                hasTestTag("MaxDiscountField") or
                hasText("maximum discount", substring = true, ignoreCase = true) or
                hasText("max discount", substring = true, ignoreCase = true)
            ).performTextInput(amount)
        } catch (e: AssertionError) {
            // Field not found or not required
        }
        return this
    }

    fun enterUsageLimit(limit: String): SellerCouponPage {
        try {
            composeTestRule.onNode(
                hasTestTag("usage-limit-field") or
                hasTestTag("UsageLimitField") or
                hasText("usage limit", substring = true, ignoreCase = true) or
                hasText("max uses", substring = true, ignoreCase = true)
            ).performTextInput(limit)
        } catch (e: AssertionError) {
            // Field not found or not required
        }
        return this
    }

    fun saveCoupon(): SellerCouponPage {
        composeTestRule.onNode(
            hasTestTag("SaveCouponButton") or
            hasText("save", substring = true, ignoreCase = true) or
            hasText("create", substring = true, ignoreCase = true) or
            hasText("add", substring = true, ignoreCase = true)
        ).performClick()
        Thread.sleep(1000)
        return this
    }

    fun cancelCouponCreation(): SellerCouponPage {
        composeTestRule.onNode(
            hasTestTag("CancelButton") or
            hasText("cancel", substring = true, ignoreCase = true) or
            hasText("back", ignoreCase = true)
        ).performClick()
        return this
    }

    fun tapFirstCoupon(): SellerCouponPage {
        if (couponList.fetchSemanticsNodes().isNotEmpty()) {
            couponList[0].performClick()
            Thread.sleep(1000)
        }
        return this
    }

    fun toggleCouponActive(): SellerCouponPage {
        try {
            composeTestRule.onNode(
                hasTestTag("toggle-active-switch") or
                hasTestTag("CouponActiveToggle") or
                hasContentDescription("toggle active", substring = true, ignoreCase = true)
            ).performClick()
            Thread.sleep(1000)
        } catch (e: AssertionError) {
            // Toggle not found or not applicable
        }
        return this
    }

    fun deleteCoupon(): SellerCouponPage {
        composeTestRule.onNode(
            hasTestTag("DeleteCouponButton") or
            hasText("delete", substring = true, ignoreCase = true) or
            hasText("remove", substring = true, ignoreCase = true)
        ).performClick()

        try {
            composeTestRule.onNode(
                hasTestTag("ConfirmDeleteButton") or
                hasText("confirm", substring = true, ignoreCase = true) or
                hasText("yes", ignoreCase = true) or
                hasText("delete", ignoreCase = true)
            ).performClick()
        } catch (e: AssertionError) {
            // Confirm button not found - direct delete
        }
        Thread.sleep(1000)
        return this
    }

    fun swipeToDelete(index: Int = 0): SellerCouponPage {
        val coupons = composeTestRule.onAllNodesWithTag("CouponItem")
        if (coupons.fetchSemanticsNodes().size > index) {
            coupons[index].performTouchInput {
                swipeLeft()
            }
            Thread.sleep(500)

            val deleteAction = composeTestRule.onNode(
                hasTestTag("SwipeDeleteAction") or
                hasText("Delete", ignoreCase = true) or
                hasText("Remove", ignoreCase = true)
            )
            try {
                deleteAction.performClick()
                Thread.sleep(500)
            } catch (e: AssertionError) {
                // Delete action not found
            }
        }
        return this
    }

    fun createCoupon(code: String, type: DiscountType, value: String, minOrder: String? = null): SellerCouponPage {
        tapCreateCoupon()
        enterCouponCode(code)
        selectDiscountType(type)
        enterDiscountValue(value)

        if (minOrder != null) {
            enterMinOrderAmount(minOrder)
        }

        saveCoupon()
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): SellerCouponPage {
        composeTestRule.waitUntil(timeoutMillis = 2000) {
            try { createCouponButton.assertExists(); true } catch (e: AssertionError) { false } ||
            couponList.fetchSemanticsNodes().isNotEmpty() ||
            try { emptyStateMessage.assertExists(); true } catch (e: AssertionError) { false }
        }
        return this
    }

    fun assertCouponFormDisplayed(): SellerCouponPage {
        composeTestRule.onNode(
            hasTestTag("coupon-code-field") or
            hasTestTag("CouponCodeField") or
            hasText("code", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertCouponExists(code: String): SellerCouponPage {
        composeTestRule.onNode(
            hasTestTag("CouponItem_$code") or
            hasText(code, substring = true)
        ).assertExists()
        return this
    }

    fun assertCouponSaved(): SellerCouponPage {
        Thread.sleep(1000)
        // Verify form is closed by checking code field doesn't exist
        composeTestRule.onNode(
            hasTestTag("coupon-code-field") or
            hasTestTag("CouponCodeField")
        ).assertDoesNotExist()
        return this
    }

    fun assertCouponCount(expectedCount: Int): SellerCouponPage {
        val coupons = composeTestRule.onAllNodesWithTag("CouponItem")
        val actualCount = coupons.fetchSemanticsNodes().size
        assert(actualCount == expectedCount) {
            "Expected $expectedCount coupons, but found $actualCount"
        }
        return this
    }

    fun assertEmptyState(): SellerCouponPage {
        composeTestRule.onNode(
            hasTestTag("EmptyStateMessage") or
            hasText("no coupon", substring = true, ignoreCase = true) or
            hasText("no coupons available", substring = true, ignoreCase = true) or
            hasText("create your first coupon", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    enum class DiscountType {
        PERCENTAGE,
        FIXED_AMOUNT
    }
}
