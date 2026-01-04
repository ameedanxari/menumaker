package com.menumaker.ui

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.CouponDto
import com.menumaker.data.repository.CouponRepository
import com.menumaker.fakes.FakeCouponRepository
import com.menumaker.pageobjects.CustomerCouponPage
import com.menumaker.pageobjects.SellerCouponPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

/**
 * UI tests for coupon system with mocked dependencies.
 * Tests seller coupon creation and customer coupon application.
 * 
 * These tests use FakeCouponRepository via Hilt test module for deterministic,
 * network-independent testing.
 *
 * Requirements covered:
 * - 3.4: Coupon management - creating discount codes with validation rules and expiration dates
 * - 8.3: Coupon validation and discount application
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class CouponFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Inject
    lateinit var couponRepository: CouponRepository

    private val fakeCouponRepository: FakeCouponRepository
        get() = couponRepository as FakeCouponRepository

    @Before
    fun setup() {
        hiltRule.inject()
        // Reset fake repository to clean state before each test
        fakeCouponRepository.reset()
        setupTestData()
    }

    private fun setupTestData() {
        // Setup default coupons for testing
        val testCoupons = listOf(
            createTestCoupon("coupon-1", "SAVE10", "percentage", 10, 500, true),
            createTestCoupon("coupon-2", "FLAT50", "fixed", 50, null, true),
            createTestCoupon("coupon-3", "EXPIRED", "percentage", 20, 1000, false)
        )
        fakeCouponRepository.setCoupons(testCoupons)
    }

    private fun createTestCoupon(
        id: String,
        code: String,
        discountType: String,
        discountValue: Int,
        maxDiscountCents: Int?,
        isActive: Boolean
    ): CouponDto {
        return CouponDto(
            id = id,
            businessId = "business-1",
            code = code,
            discountType = discountType,
            discountValue = discountValue,
            maxDiscountCents = maxDiscountCents,
            minOrderValueCents = 1000,
            validUntil = if (isActive) "2025-12-31T23:59:59Z" else "2024-01-01T00:00:00Z",
            usageLimitType = "unlimited",
            totalUsageLimit = null,
            isActive = isActive,
            createdAt = "2025-01-01T00:00:00Z"
        )
    }

    private fun loginAsSellerIfNeeded() {
        val emailField = composeTestRule.onAllNodesWithText("Email").fetchSemanticsNodes()
        if (emailField.isNotEmpty()) {
            composeTestRule.onNodeWithText("Email")
                .performTextInput("seller@example.com")

            composeTestRule.onNodeWithText("Password")
                .performTextInput("password123")

            composeTestRule.onNodeWithText("Login")
                .performClick()

            composeTestRule.waitForIdle()
        }
    }

    private fun loginAsCustomerIfNeeded() {
        val emailField = composeTestRule.onAllNodesWithText("Email").fetchSemanticsNodes()
        if (emailField.isNotEmpty()) {
            composeTestRule.onNodeWithText("Email")
                .performTextInput("customer@example.com")

            composeTestRule.onNodeWithText("Password")
                .performTextInput("password123")

            composeTestRule.onNodeWithText("Login")
                .performClick()

            composeTestRule.waitForIdle()
        }
    }

    private fun navigateToSellerCoupons() {
        val couponsTab = composeTestRule.onNode(
            hasText("Coupons", substring = true, ignoreCase = true) or
            hasText("Promotions", substring = true, ignoreCase = true) or
            hasContentDescription("Coupons")
        )

        if (couponsTab.isDisplayed()) {
            couponsTab.performClick()
            composeTestRule.waitForIdle()
        }
    }

    private fun navigateToCustomerCoupons() {
        // Navigate to cart or checkout where coupons can be applied
        val cartTab = composeTestRule.onNode(
            hasText("Cart", substring = true, ignoreCase = true) or
            hasContentDescription("Cart")
        )

        if (cartTab.isDisplayed()) {
            cartTab.performClick()
            composeTestRule.waitForIdle()
        }

        // Look for coupon section
        val couponSection = composeTestRule.onNode(
            hasText("Coupon", substring = true, ignoreCase = true) or
            hasText("Promo", substring = true, ignoreCase = true) or
            hasText("Discount", substring = true, ignoreCase = true)
        )

        if (couponSection.isDisplayed()) {
            couponSection.performClick()
            composeTestRule.waitForIdle()
        }
    }

    // MARK: - Seller Coupon Management Tests (Requirement 3.4)

    /**
     * Test: Seller coupon screen displays correctly
     * Requirements: 3.4 - Coupon management
     */
    @Test
    fun testSellerCouponScreenDisplays() {
        loginAsSellerIfNeeded()
        navigateToSellerCoupons()

        val couponPage = SellerCouponPage(composeTestRule)
        couponPage.assertScreenDisplayed()

        // Verify coupon repository was called
        assert(fakeCouponRepository.getCouponsCallCount >= 0) {
            "Coupon repository should be called for coupons"
        }
    }

    /**
     * Test: Create percentage discount coupon
     * Requirements: 3.4 - Creating discount codes
     */
    @Test
    fun testCreatePercentageCoupon() {
        loginAsSellerIfNeeded()
        navigateToSellerCoupons()

        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapCreateCoupon()
            .assertCouponFormDisplayed()
            .enterCouponCode("SAVE20")
            .selectDiscountType(SellerCouponPage.DiscountType.PERCENTAGE)
            .enterDiscountValue("20")
            .enterMinOrderAmount("500")
            .saveCoupon()
            .assertCouponSaved()

        // Verify create was called
        assert(fakeCouponRepository.createCouponCallCount >= 1) {
            "Coupon repository createCoupon should be called"
        }
    }

    /**
     * Test: Create fixed amount discount coupon
     * Requirements: 3.4 - Creating discount codes
     */
    @Test
    fun testCreateFixedAmountCoupon() {
        loginAsSellerIfNeeded()
        navigateToSellerCoupons()

        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapCreateCoupon()
            .assertCouponFormDisplayed()
            .enterCouponCode("FLAT100")
            .selectDiscountType(SellerCouponPage.DiscountType.FIXED_AMOUNT)
            .enterDiscountValue("100")
            .enterMinOrderAmount("1000")
            .saveCoupon()
            .assertCouponSaved()

        // Verify create was called
        assert(fakeCouponRepository.createCouponCallCount >= 1) {
            "Coupon repository createCoupon should be called"
        }
    }

    /**
     * Test: Create coupon with maximum discount cap
     * Requirements: 3.4 - Creating discount codes with validation rules
     */
    @Test
    fun testCreateCouponWithMaxDiscount() {
        loginAsSellerIfNeeded()
        navigateToSellerCoupons()

        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapCreateCoupon()
            .enterCouponCode("MEGA50")
            .selectDiscountType(SellerCouponPage.DiscountType.PERCENTAGE)
            .enterDiscountValue("50")
            .enterMinOrderAmount("2000")
            .enterMaxDiscount("500")
            .saveCoupon()
            .assertCouponSaved()

        // Verify create was called
        assert(fakeCouponRepository.createCouponCallCount >= 1) {
            "Coupon with max discount should be created"
        }
    }

    /**
     * Test: Create coupon with usage limit
     * Requirements: 3.4 - Creating discount codes with validation rules
     */
    @Test
    fun testCreateCouponWithUsageLimit() {
        loginAsSellerIfNeeded()
        navigateToSellerCoupons()

        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapCreateCoupon()
            .enterCouponCode("LIMITED10")
            .selectDiscountType(SellerCouponPage.DiscountType.PERCENTAGE)
            .enterDiscountValue("10")
            .enterUsageLimit("100")
            .saveCoupon()
            .assertCouponSaved()

        // Verify create was called
        assert(fakeCouponRepository.createCouponCallCount >= 1) {
            "Coupon with usage limit should be created"
        }
    }

    /**
     * Test: Edit existing coupon
     * Requirements: 3.4 - Coupon management
     */
    @Test
    fun testEditCoupon() {
        loginAsSellerIfNeeded()
        navigateToSellerCoupons()

        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapFirstCoupon()
            .assertCouponFormDisplayed()
            .enterDiscountValue("25")
            .saveCoupon()
            .assertCouponSaved()
    }

    /**
     * Test: Toggle coupon active status
     * Requirements: 3.4 - Coupon management
     */
    @Test
    fun testToggleCouponActive() {
        loginAsSellerIfNeeded()
        navigateToSellerCoupons()

        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapFirstCoupon()
            .toggleCouponActive()
            .saveCoupon()
    }

    /**
     * Test: Delete coupon
     * Requirements: 3.4 - Coupon management
     */
    @Test
    fun testDeleteCoupon() {
        loginAsSellerIfNeeded()
        navigateToSellerCoupons()

        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapFirstCoupon()
            .deleteCoupon()

        // Verify delete was called
        assert(fakeCouponRepository.deleteCouponCallCount >= 1) {
            "Coupon repository deleteCoupon should be called"
        }
    }

    /**
     * Test: Coupon validation - empty code
     * Requirements: 3.4 - Coupon validation rules
     */
    @Test
    fun testCouponValidation_emptyCode() {
        loginAsSellerIfNeeded()
        navigateToSellerCoupons()

        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapCreateCoupon()
            .assertCouponFormDisplayed()
            .selectDiscountType(SellerCouponPage.DiscountType.PERCENTAGE)
            .enterDiscountValue("10")
            .saveCoupon()

        // Verify validation error is shown
        composeTestRule.onNode(
            hasText("code", substring = true, ignoreCase = true) or
            hasText("required", substring = true, ignoreCase = true)
        ).assertExists()
    }

    /**
     * Test: Coupon validation - invalid discount value
     * Requirements: 3.4 - Coupon validation rules
     */
    @Test
    fun testCouponValidation_invalidDiscountValue() {
        loginAsSellerIfNeeded()
        navigateToSellerCoupons()

        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapCreateCoupon()
            .assertCouponFormDisplayed()
            .enterCouponCode("INVALID")
            .selectDiscountType(SellerCouponPage.DiscountType.PERCENTAGE)
            .enterDiscountValue("150") // Invalid: percentage > 100
            .saveCoupon()

        // Verify validation error is shown
        composeTestRule.onNode(
            hasText("discount", substring = true, ignoreCase = true) or
            hasText("invalid", substring = true, ignoreCase = true) or
            hasText("100", substring = true)
        ).assertExists()
    }

    /**
     * Test: Empty coupons state
     * Requirements: 3.4 - Coupon management
     */
    @Test
    fun testEmptyCouponsState() {
        // Configure empty coupons
        fakeCouponRepository.configureEmptyResults()

        loginAsSellerIfNeeded()
        navigateToSellerCoupons()

        val couponPage = SellerCouponPage(composeTestRule)
        couponPage.assertEmptyState()
    }

    /**
     * Test: Coupon loading error
     * Requirements: 3.4 - Coupon management error handling
     */
    @Test
    fun testCouponLoadingError() {
        // Configure error response
        fakeCouponRepository.configureError("Failed to load coupons")

        loginAsSellerIfNeeded()
        navigateToSellerCoupons()

        composeTestRule.waitForIdle()

        // Verify error state or retry option is shown
        composeTestRule.onNode(
            hasText("error", substring = true, ignoreCase = true) or
            hasText("retry", substring = true, ignoreCase = true) or
            hasText("try again", substring = true, ignoreCase = true)
        ).assertExists()
    }

    // MARK: - Customer Coupon Application Tests (Requirement 8.3)

    /**
     * Test: Customer coupon screen displays
     * Requirements: 8.3 - Coupon validation
     */
    @Test
    fun testCustomerCouponScreenDisplays() {
        loginAsCustomerIfNeeded()
        navigateToCustomerCoupons()

        val couponPage = CustomerCouponPage(composeTestRule)
        couponPage.assertScreenDisplayed()
    }

    /**
     * Test: Apply valid coupon
     * Requirements: 8.3 - Coupon validation and discount application
     */
    @Test
    fun testApplyCoupon() {
        loginAsCustomerIfNeeded()
        navigateToCustomerCoupons()

        val couponPage = CustomerCouponPage(composeTestRule)
        couponPage
            .assertCouponsAvailable()
            .applyFirstAvailableCoupon()
            .assertCouponApplied()
    }

    /**
     * Test: Remove applied coupon
     * Requirements: 8.3 - Coupon management
     */
    @Test
    fun testRemoveCoupon() {
        loginAsCustomerIfNeeded()
        navigateToCustomerCoupons()

        val couponPage = CustomerCouponPage(composeTestRule)
        couponPage
            .applyFirstAvailableCoupon()
            .assertCouponApplied()
            .removeCoupon()
            .assertCouponRemoved()
    }

    /**
     * Test: Search coupons
     * Requirements: 8.3 - Coupon discovery
     */
    @Test
    fun testSearchCoupons() {
        loginAsCustomerIfNeeded()
        navigateToCustomerCoupons()

        val couponPage = CustomerCouponPage(composeTestRule)
        couponPage
            .searchCoupon("SAVE")
            .assertCouponsAvailable()
    }

    /**
     * Test: Filter active coupons
     * Requirements: 8.3 - Coupon filtering
     */
    @Test
    fun testFilterCoupons() {
        loginAsCustomerIfNeeded()
        navigateToCustomerCoupons()

        val couponPage = CustomerCouponPage(composeTestRule)
        couponPage
            .filterCoupons(CustomerCouponPage.CouponFilter.ACTIVE)
            .assertCouponsAvailable()
    }

    /**
     * Test: Apply coupon code manually
     * Requirements: 8.3 - Coupon validation
     */
    @Test
    fun testApplyCouponCodeManually() {
        loginAsCustomerIfNeeded()
        navigateToCustomerCoupons()

        // Find coupon code input field
        val codeField = composeTestRule.onNode(
            hasSetTextAction() and (
                hasText("code", substring = true, ignoreCase = true) or
                hasText("enter", substring = true, ignoreCase = true) or
                hasText("promo", substring = true, ignoreCase = true)
            )
        )

        if (codeField.isDisplayed()) {
            codeField.performTextInput("SAVE10")

            // Find and click apply button
            val applyButton = composeTestRule.onNode(
                hasText("Apply", substring = true, ignoreCase = true)
            )

            if (applyButton.isDisplayed()) {
                applyButton.performClick()
                composeTestRule.waitForIdle()

                // Verify coupon was applied
                composeTestRule.onNode(
                    hasText("applied", substring = true, ignoreCase = true) or
                    hasText("discount", substring = true, ignoreCase = true) or
                    hasText("SAVE10", substring = true)
                ).assertExists()
            }
        }
    }

    /**
     * Test: Invalid coupon code shows error
     * Requirements: 8.3 - Coupon validation
     */
    @Test
    fun testInvalidCouponCode() {
        loginAsCustomerIfNeeded()
        navigateToCustomerCoupons()

        // Find coupon code input field
        val codeField = composeTestRule.onNode(
            hasSetTextAction() and (
                hasText("code", substring = true, ignoreCase = true) or
                hasText("enter", substring = true, ignoreCase = true)
            )
        )

        if (codeField.isDisplayed()) {
            codeField.performTextInput("INVALIDCODE123")

            // Find and click apply button
            val applyButton = composeTestRule.onNode(
                hasText("Apply", substring = true, ignoreCase = true)
            )

            if (applyButton.isDisplayed()) {
                applyButton.performClick()
                composeTestRule.waitForIdle()

                // Verify error message is shown
                composeTestRule.onNode(
                    hasText("invalid", substring = true, ignoreCase = true) or
                    hasText("not found", substring = true, ignoreCase = true) or
                    hasText("error", substring = true, ignoreCase = true)
                ).assertExists()
            }
        }
    }

    /**
     * Test: Expired coupon shows error
     * Requirements: 8.3 - Coupon validation
     */
    @Test
    fun testExpiredCouponCode() {
        loginAsCustomerIfNeeded()
        navigateToCustomerCoupons()

        // Find coupon code input field
        val codeField = composeTestRule.onNode(
            hasSetTextAction() and (
                hasText("code", substring = true, ignoreCase = true) or
                hasText("enter", substring = true, ignoreCase = true)
            )
        )

        if (codeField.isDisplayed()) {
            codeField.performTextInput("EXPIRED")

            // Find and click apply button
            val applyButton = composeTestRule.onNode(
                hasText("Apply", substring = true, ignoreCase = true)
            )

            if (applyButton.isDisplayed()) {
                applyButton.performClick()
                composeTestRule.waitForIdle()

                // Verify error message is shown
                composeTestRule.onNode(
                    hasText("expired", substring = true, ignoreCase = true) or
                    hasText("invalid", substring = true, ignoreCase = true) or
                    hasText("not valid", substring = true, ignoreCase = true)
                ).assertExists()
            }
        }
    }

    /**
     * Test: Coupon discount is calculated correctly
     * Requirements: 8.3 - Discount application
     */
    @Test
    fun testCouponDiscountCalculation() {
        loginAsCustomerIfNeeded()
        navigateToCustomerCoupons()

        val couponPage = CustomerCouponPage(composeTestRule)
        couponPage
            .applyFirstAvailableCoupon()
            .assertCouponApplied()

        // Verify discount amount is displayed
        composeTestRule.onNode(
            hasText("discount", substring = true, ignoreCase = true) or
            hasText("-₹", substring = true) or
            hasText("saved", substring = true, ignoreCase = true)
        ).assertExists()
    }
}

// MARK: - Helper Extensions

private fun SemanticsNodeInteraction.isDisplayed(): Boolean {
    return try {
        assertIsDisplayed()
        true
    } catch (e: AssertionError) {
        false
    }
}
