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
        createCouponButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun enterCouponCode(code: String): SellerCouponPage {
        couponCodeField.performTextInput(code)
        return this
    }

    fun selectDiscountType(type: DiscountType): SellerCouponPage {
        when (type) {
            DiscountType.PERCENTAGE -> percentageButton.performClick()
            DiscountType.FIXED_AMOUNT -> fixedAmountButton.performClick()
        }
        return this
    }

    fun enterDiscountValue(value: String): SellerCouponPage {
        discountValueField.performTextInput(value)
        return this
    }

    fun enterMinOrderAmount(amount: String): SellerCouponPage {
        if (minOrderAmountField.fetchSemanticsNode(false) != null) {
            minOrderAmountField.performTextInput(amount)
        }
        return this
    }

    fun enterMaxDiscount(amount: String): SellerCouponPage {
        if (maxDiscountField.fetchSemanticsNode(false) != null) {
            maxDiscountField.performTextInput(amount)
        }
        return this
    }

    fun enterUsageLimit(limit: String): SellerCouponPage {
        if (usageLimitField.fetchSemanticsNode(false) != null) {
            usageLimitField.performTextInput(limit)
        }
        return this
    }

    fun saveCoupon(): SellerCouponPage {
        saveCouponButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun cancelCouponCreation(): SellerCouponPage {
        cancelButton.performClick()
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
        if (toggleActiveSwitch.fetchSemanticsNode(false) != null) {
            toggleActiveSwitch.performClick()
            Thread.sleep(1000)
        }
        return this
    }

    fun deleteCoupon(): SellerCouponPage {
        deleteButton.performClick()
        if (confirmDeleteButton.fetchSemanticsNode(false) != null) {
            confirmDeleteButton.performClick()
        }
        Thread.sleep(1000)
        return this
    }

    fun swipeToDelete(index: Int = 0): SellerCouponPage {
        if (couponList.fetchSemanticsNodes().size > index) {
            couponList[index].performTouchInput {
                swipeLeft()
            }
            val deleteAction = composeTestRule.onNodeWithText("Delete", ignoreCase = true)
            if (deleteAction.fetchSemanticsNode(false) != null) {
                deleteAction.performClick()
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
            createCouponButton.fetchSemanticsNode(false) != null ||
            couponList.fetchSemanticsNodes().isNotEmpty() ||
            emptyStateMessage.fetchSemanticsNode(false) != null
        }
        return this
    }

    fun assertCouponFormDisplayed(): SellerCouponPage {
        couponCodeField.assertExists()
        return this
    }

    fun assertCouponExists(code: String): SellerCouponPage {
        composeTestRule.onNodeWithText(code).assertExists()
        return this
    }

    fun assertCouponSaved(): SellerCouponPage {
        Thread.sleep(1000)
        couponCodeField.assertDoesNotExist()
        return this
    }

    fun assertCouponCount(expectedCount: Int): SellerCouponPage {
        val actualCount = couponList.fetchSemanticsNodes().size
        assert(actualCount == expectedCount) {
            "Should have $expectedCount coupons, found $actualCount"
        }
        return this
    }

    fun assertEmptyState(): SellerCouponPage {
        emptyStateMessage.assertExists()
        return this
    }

    enum class DiscountType {
        PERCENTAGE,
        FIXED_AMOUNT
    }
}
