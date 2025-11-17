package com.menumaker

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.menumaker.pageobjects.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Android Tests for Marketplace and Ordering Flow
 */
@RunWith(AndroidJUnit4::class)
class MarketplaceFlowTests {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        // Login before tests
        val loginPage = LoginPage(composeTestRule)
        Thread.sleep(2000)
        if (loginPage.emailField.exists) {
            loginPage.login("test@example.com", "password123")
            Thread.sleep(2000)
        }
    }

    // MARK: - Marketplace Browse Tests (P0)

    @Test
    fun testMarketplaceScreenDisplays() {
        val marketplacePage = MarketplacePage(composeTestRule)
        marketplacePage.assertScreenDisplayed()
    }

    @Test
    fun testSellersDisplayed() {
        val marketplacePage = MarketplacePage(composeTestRule)
        marketplacePage.assertSellersDisplayed()
    }

    @Test
    fun testSearchSellers() {
        val marketplacePage = MarketplacePage(composeTestRule)

        marketplacePage
            .search("pizza")

        Thread.sleep(1000)
        // Results should be filtered
    }

    @Test
    fun testSortByDistance() {
        val marketplacePage = MarketplacePage(composeTestRule)

        marketplacePage.sortByDistance()

        Thread.sleep(1000)
        marketplacePage.assertSellersDisplayed()
    }

    @Test
    fun testSortByRating() {
        val marketplacePage = MarketplacePage(composeTestRule)

        marketplacePage.sortByRating()

        Thread.sleep(1000)
        marketplacePage.assertSellersDisplayed()
    }

    // MARK: - Menu Viewing Tests (P0)

    @Test
    fun testViewSellerMenu() {
        val marketplacePage = MarketplacePage(composeTestRule)

        val menuPage = marketplacePage.tapFirstSeller()

        menuPage.assertScreenDisplayed()
        menuPage.assertMenuItemsDisplayed()
    }

    // MARK: - Cart Tests (P0)

    @Test
    fun testAddItemToCart() {
        val marketplacePage = MarketplacePage(composeTestRule)
        val menuPage = marketplacePage.tapFirstSeller()

        menuPage
            .addFirstItemToCart()
            .assertCartBadgeCount(1)
    }

    @Test
    fun testAddMultipleItemsToCart() {
        val marketplacePage = MarketplacePage(composeTestRule)
        val menuPage = marketplacePage.tapFirstSeller()

        menuPage
            .addFirstItemToCart()
            .addItemToCart(1)
            .assertCartBadgeCount(2)
    }

    @Test
    fun testNavigateToCart() {
        val marketplacePage = MarketplacePage(composeTestRule)
        val menuPage = marketplacePage.tapFirstSeller()

        menuPage.addFirstItemToCart()

        val cartPage = menuPage.navigateToCart()

        cartPage.assertScreenDisplayed()
        cartPage.assertCartNotEmpty()
    }

    @Test
    fun testRemoveItemFromCart() {
        val marketplacePage = MarketplacePage(composeTestRule)
        val menuPage = marketplacePage.tapFirstSeller()

        menuPage.addFirstItemToCart()

        val cartPage = menuPage.navigateToCart()

        cartPage
            .assertCartNotEmpty()
            .removeFirstItem()

        Thread.sleep(1000)
        // Cart should be empty or have fewer items
    }

    @Test
    fun testUpdateItemQuantity() {
        val marketplacePage = MarketplacePage(composeTestRule)
        val menuPage = marketplacePage.tapFirstSeller()

        menuPage.addFirstItemToCart()

        val cartPage = menuPage.navigateToCart()

        cartPage
            .assertCartNotEmpty()
            .increaseQuantity()

        Thread.sleep(500)
        // Quantity should increase
    }

    @Test
    fun testApplyCoupon() {
        val marketplacePage = MarketplacePage(composeTestRule)
        val menuPage = marketplacePage.tapFirstSeller()

        menuPage.addFirstItemToCart()

        val cartPage = menuPage.navigateToCart()

        cartPage
            .assertCartNotEmpty()
            .applyCoupon("TESTCODE")

        Thread.sleep(2000)
        // Coupon should be applied or show error
    }

    // MARK: - Checkout Tests (P0)

    @Test
    fun testProceedToCheckout() {
        val marketplacePage = MarketplacePage(composeTestRule)
        val menuPage = marketplacePage.tapFirstSeller()

        menuPage.addFirstItemToCart()

        val cartPage = menuPage.navigateToCart()
        val checkoutPage = cartPage.proceedToCheckout()

        checkoutPage.assertScreenDisplayed()
    }

    @Test
    fun testPlaceOrderWithCashPayment() {
        val marketplacePage = MarketplacePage(composeTestRule)
        val menuPage = marketplacePage.tapFirstSeller()

        menuPage.addFirstItemToCart()

        val cartPage = menuPage.navigateToCart()
        val checkoutPage = cartPage.proceedToCheckout()

        checkoutPage
            .enterDeliveryAddress("123 Test Street, Test City")
            .selectPaymentMethod(CheckoutPage.PaymentMethod.CASH)
            .placeOrder()

        Thread.sleep(3000)
        // Order should be placed successfully
    }

    @Test
    fun testPlaceOrderWithCardPayment() {
        val marketplacePage = MarketplacePage(composeTestRule)
        val menuPage = marketplacePage.tapFirstSeller()

        menuPage.addFirstItemToCart()

        val cartPage = menuPage.navigateToCart()
        val checkoutPage = cartPage.proceedToCheckout()

        checkoutPage
            .enterDeliveryAddress("123 Test Street, Test City")
            .selectPaymentMethod(CheckoutPage.PaymentMethod.CARD)

        Thread.sleep(1000)
        // Card payment form should appear
    }

    @Test
    fun testCheckoutWithEmptyAddress() {
        val marketplacePage = MarketplacePage(composeTestRule)
        val menuPage = marketplacePage.tapFirstSeller()

        menuPage.addFirstItemToCart()

        val cartPage = menuPage.navigateToCart()
        val checkoutPage = cartPage.proceedToCheckout()

        checkoutPage
            .selectPaymentMethod(CheckoutPage.PaymentMethod.CASH)
            .placeOrder()

        Thread.sleep(1000)
        // Should show validation error
    }
}
