package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.pageobjects.CustomerCouponPage
import com.menumaker.pageobjects.SellerCouponPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for coupon system - seller creation and customer application
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class CouponFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    // MARK: - Seller Coupon Management Tests

    @Test
    fun testSellerCouponScreenDisplays() {
        val couponPage = SellerCouponPage(composeTestRule)
        couponPage.assertScreenDisplayed()
    }

    @Test
    fun testCreatePercentageCoupon() {
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
            .assertCouponExists("SAVE20")
    }

    @Test
    fun testCreateFixedAmountCoupon() {
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
            .assertCouponExists("FLAT100")
    }

    @Test
    fun testCreateCouponWithMaxDiscount() {
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
    }

    @Test
    fun testCreateCouponWithUsageLimit() {
        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapCreateCoupon()
            .enterCouponCode("LIMITED10")
            .selectDiscountType(SellerCouponPage.DiscountType.PERCENTAGE)
            .enterDiscountValue("10")
            .enterUsageLimit("100")
            .saveCoupon()
            .assertCouponSaved()
    }

    @Test
    fun testEditCoupon() {
        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapFirstCoupon()
            .assertCouponFormDisplayed()
            .enterDiscountValue("25")
            .saveCoupon()
            .assertCouponSaved()
    }

    @Test
    fun testToggleCouponActive() {
        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapFirstCoupon()
            .toggleCouponActive()
            .saveCoupon()
    }

    @Test
    fun testDeleteCoupon() {
        val couponPage = SellerCouponPage(composeTestRule)
        couponPage
            .tapFirstCoupon()
            .deleteCoupon()
            .assertCouponCount(0)
    }

    // MARK: - Customer Coupon Application Tests

    @Test
    fun testCustomerCouponScreenDisplays() {
        val couponPage = CustomerCouponPage(composeTestRule)
        couponPage.assertScreenDisplayed()
    }

    @Test
    fun testApplyCoupon() {
        val couponPage = CustomerCouponPage(composeTestRule)
        couponPage
            .assertCouponsAvailable()
            .applyFirstAvailableCoupon()
            .assertCouponApplied()
    }

    @Test
    fun testRemoveCoupon() {
        val couponPage = CustomerCouponPage(composeTestRule)
        couponPage
            .applyFirstAvailableCoupon()
            .assertCouponApplied()
            .removeCoupon()
            .assertCouponRemoved()
    }

    @Test
    fun testSearchCoupons() {
        val couponPage = CustomerCouponPage(composeTestRule)
        couponPage
            .searchCoupon("SAVE")
            .assertCouponsAvailable()
    }

    @Test
    fun testFilterCoupons() {
        val couponPage = CustomerCouponPage(composeTestRule)
        couponPage
            .filterCoupons(CustomerCouponPage.CouponFilter.ACTIVE)
            .assertCouponsAvailable()
    }
}
