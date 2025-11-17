package com.menumaker

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.menumaker.pageobjects.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Comprehensive Android UI Tests covering all user stories
 * Includes: Seller Management, Referrals, Delivery Tracking, Reviews, Profile, Settings
 */
@RunWith(AndroidJUnit4::class)
class ComprehensiveUITests {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        val loginPage = LoginPage(composeTestRule)
        Thread.sleep(2000)
        if (loginPage.emailField.exists) {
            loginPage.login("test@example.com", "password123")
            Thread.sleep(2000)
        }
    }

    // MARK: - Seller Menu Management Tests (P0)

    @Test
    fun testSellerMenuEditorDisplays() {
        // Navigate to seller menu editor
        // This assumes user has seller permissions

        val editorPage = SellerMenuEditorPage(composeTestRule)
        editorPage.assertScreenDisplayed()
    }

    @Test
    fun testCreateMenuItem() {
        val editorPage = SellerMenuEditorPage(composeTestRule)

        editorPage
            .createMenuItem(
                name = "Test Pizza",
                description = "Delicious test pizza",
                price = "299"
            )
            .assertItemExists("Test Pizza")
    }

    @Test
    fun testEditMenuItem() {
        val editorPage = SellerMenuEditorPage(composeTestRule)

        // Tap existing item
        editorPage.menuItems.onFirst().performClick()
        Thread.sleep(500)

        editorPage
            .enterItemName("Updated Pizza")
            .tapSave()
            .assertItemExists("Updated Pizza")
    }

    @Test
    fun testDeleteMenuItem() {
        val editorPage = SellerMenuEditorPage(composeTestRule)

        editorPage.deleteFirstItem()

        Thread.sleep(1000)
        // Item should be deleted
    }

    @Test
    fun testToggleItemAvailability() {
        val editorPage = SellerMenuEditorPage(composeTestRule)

        editorPage.toggleAvailability()

        Thread.sleep(500)
        // Availability should toggle
    }

    // MARK: - Referral System Tests (P0)

    @Test
    fun testReferralScreenDisplays() {
        // Navigate to referrals
        navigateToReferrals()

        val referralPage = ReferralPage(composeTestRule)
        referralPage.assertScreenDisplayed()
    }

    @Test
    fun testReferralCodeDisplayed() {
        navigateToReferrals()

        val referralPage = ReferralPage(composeTestRule)
        referralPage.assertReferralCodeDisplayed()
    }

    @Test
    fun testCopyReferralCode() {
        navigateToReferrals()

        val referralPage = ReferralPage(composeTestRule)
        referralPage.tapCopyCode()

        Thread.sleep(500)
        // Code should be copied to clipboard
    }

    @Test
    fun testShareReferralCode() {
        navigateToReferrals()

        val referralPage = ReferralPage(composeTestRule)
        referralPage.tapShare()

        Thread.sleep(1000)
        // Share sheet should appear
    }

    @Test
    fun testApplyReferralCode() {
        navigateToReferrals()

        val referralPage = ReferralPage(composeTestRule)
        referralPage.applyCode("TESTCODE123")

        Thread.sleep(2000)
        // Should show success or error message
    }

    @Test
    fun testViewReferralStats() {
        navigateToReferrals()

        val referralPage = ReferralPage(composeTestRule)
        referralPage.assertStatsDisplayed()
    }

    // MARK: - Delivery Tracking Tests (P0)

    @Test
    fun testDeliveryTrackingDisplays() {
        // Navigate to active order
        navigateToActiveOrder()

        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage.assertScreenDisplayed()
    }

    @Test
    fun testTrackingStepsDisplayed() {
        navigateToActiveOrder()

        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage.assertTrackingStepsDisplayed()
    }

    @Test
    fun testMapDisplayed() {
        navigateToActiveOrder()

        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage.assertMapDisplayed()
    }

    @Test
    fun testCallDeliveryPerson() {
        navigateToActiveOrder()

        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage
            .assertCallButtonVisible()
            .tapCallDeliveryPerson()

        Thread.sleep(1000)
    }

    @Test
    fun testWhatsAppDeliveryPerson() {
        navigateToActiveOrder()

        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage.tapWhatsAppDeliveryPerson()

        Thread.sleep(1000)
    }

    @Test
    fun testCancelOrder() {
        navigateToActiveOrder()

        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage.tapCancelOrder()

        Thread.sleep(2000)
        // Order should be cancelled
    }

    // MARK: - Review System Tests (P0)

    @Test
    fun testReviewScreenDisplays() {
        // Navigate to review screen
        navigateToReviewScreen()

        val reviewPage = ReviewPage(composeTestRule)
        reviewPage.assertScreenDisplayed()
    }

    @Test
    fun testSubmitRating() {
        navigateToReviewScreen()

        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .selectRating(5)
            .tapSubmit()

        Thread.sleep(2000)
        // Rating should be submitted
    }

    @Test
    fun testSubmitReviewWithText() {
        navigateToReviewScreen()

        val reviewPage = ReviewPage(composeTestRule)
        reviewPage.submitQuickReview(4, "Great food and service!")

        Thread.sleep(2000)
        // Review should be submitted
    }

    @Test
    fun testSubmitReviewWithPhoto() {
        navigateToReviewScreen()

        val reviewPage = ReviewPage(composeTestRule)
        reviewPage
            .selectRating(5)
            .enterReview("Amazing food!")
            .tapAddPhoto()

        Thread.sleep(1000)
        // Photo picker should appear
    }

    @Test
    fun testViewSellerReviews() {
        // Navigate to seller profile
        val marketplacePage = MarketplacePage(composeTestRule)
        marketplacePage.tapFirstSeller()

        Thread.sleep(1000)

        // Scroll to reviews section
        val reviewPage = ReviewPage(composeTestRule)
        reviewPage.assertReviewsDisplayed()
    }

    @Test
    fun testViewAverageRating() {
        val marketplacePage = MarketplacePage(composeTestRule)
        marketplacePage.tapFirstSeller()

        val reviewPage = ReviewPage(composeTestRule)
        reviewPage.assertAverageRatingDisplayed()
    }

    // MARK: - Profile Management Tests (P0)

    @Test
    fun testProfileScreenDisplays() {
        navigateToProfile()

        val profilePage = ProfilePage(composeTestRule)
        profilePage.assertScreenDisplayed()
    }

    @Test
    fun testProfileInfoDisplayed() {
        navigateToProfile()

        val profilePage = ProfilePage(composeTestRule)
        profilePage.assertProfileInfoDisplayed()
    }

    @Test
    fun testEditProfile() {
        navigateToProfile()

        val profilePage = ProfilePage(composeTestRule)
        profilePage
            .tapEditProfile()
            .assertEditFormDisplayed()
            .enterName("Updated Test User")
            .enterPhone("9876543210")
            .tapSave()

        Thread.sleep(2000)
        // Profile should be updated
    }

    @Test
    fun testNavigateToOrders() {
        navigateToProfile()

        val profilePage = ProfilePage(composeTestRule)
        profilePage.tapOrders()

        Thread.sleep(1000)
        // Orders screen should be displayed
    }

    @Test
    fun testNavigateToFavorites() {
        navigateToProfile()

        val profilePage = ProfilePage(composeTestRule)
        profilePage.tapFavorites()

        Thread.sleep(1000)
        // Favorites screen should be displayed
    }

    @Test
    fun testNavigateToSettings() {
        navigateToProfile()

        val profilePage = ProfilePage(composeTestRule)
        profilePage.tapSettings()

        Thread.sleep(1000)

        val settingsPage = SettingsPage(composeTestRule)
        settingsPage.assertScreenDisplayed()
    }

    @Test
    fun testLogout() {
        navigateToProfile()

        val profilePage = ProfilePage(composeTestRule)
        profilePage.tapLogout()

        Thread.sleep(2000)

        // Should navigate to login screen
        val loginPage = LoginPage(composeTestRule)
        loginPage.assertScreenDisplayed()
    }

    // MARK: - Settings Tests (P0)

    @Test
    fun testSettingsScreenDisplays() {
        navigateToProfile()
        val profilePage = ProfilePage(composeTestRule)
        profilePage.tapSettings()

        val settingsPage = SettingsPage(composeTestRule)
        settingsPage.assertScreenDisplayed()
    }

    @Test
    fun testToggleOrderNotifications() {
        navigateToProfile()
        val profilePage = ProfilePage(composeTestRule)
        profilePage.tapSettings()

        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .tapNotificationSettings()
            .toggleOrderNotifications()

        Thread.sleep(500)
    }

    @Test
    fun testTogglePromoNotifications() {
        navigateToProfile()
        val profilePage = ProfilePage(composeTestRule)
        profilePage.tapSettings()

        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .tapNotificationSettings()
            .togglePromoNotifications()

        Thread.sleep(500)
    }

    @Test
    fun testChangeLanguage() {
        navigateToProfile()
        val profilePage = ProfilePage(composeTestRule)
        profilePage.tapSettings()

        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .tapLanguageSettings()
            .selectLanguage(SettingsPage.Language.ENGLISH)

        Thread.sleep(1000)
        // Language should be changed
    }

    @Test
    fun testToggleDarkMode() {
        navigateToProfile()
        val profilePage = ProfilePage(composeTestRule)
        profilePage.tapSettings()

        val settingsPage = SettingsPage(composeTestRule)
        settingsPage.toggleDarkMode()

        Thread.sleep(1000)
        // UI should switch to dark/light mode
    }

    @Test
    fun testViewAbout() {
        navigateToProfile()
        val profilePage = ProfilePage(composeTestRule)
        profilePage.tapSettings()

        val settingsPage = SettingsPage(composeTestRule)
        settingsPage
            .tapAbout()
            .assertVersionDisplayed()
    }

    @Test
    fun testViewPrivacySettings() {
        navigateToProfile()
        val profilePage = ProfilePage(composeTestRule)
        profilePage.tapSettings()

        val settingsPage = SettingsPage(composeTestRule)
        settingsPage.tapPrivacy()

        Thread.sleep(1000)
    }

    // MARK: - Integration Tests (P1)

    @Test
    fun testCompleteOrderFlow() {
        // Complete end-to-end order flow
        val marketplacePage = MarketplacePage(composeTestRule)
        val menuPage = marketplacePage.tapFirstSeller()

        menuPage.addFirstItemToCart()

        val cartPage = menuPage.navigateToCart()
        val checkoutPage = cartPage.proceedToCheckout()

        checkoutPage
            .enterDeliveryAddress("123 Test Street")
            .selectPaymentMethod(CheckoutPage.PaymentMethod.CASH)
            .placeOrder()

        Thread.sleep(3000)

        // Order should be placed, navigate to tracking
        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage.assertScreenDisplayed()
    }

    @Test
    fun testOrderWithCouponAndTracking() {
        val marketplacePage = MarketplacePage(composeTestRule)
        val menuPage = marketplacePage.tapFirstSeller()

        menuPage
            .addFirstItemToCart()
            .addItemToCart(1)

        val cartPage = menuPage.navigateToCart()

        cartPage.applyCoupon("SAVE10")
        Thread.sleep(2000)

        val checkoutPage = cartPage.proceedToCheckout()

        checkoutPage
            .enterDeliveryAddress("456 Main St")
            .selectPaymentMethod(CheckoutPage.PaymentMethod.CASH)
            .placeOrder()

        Thread.sleep(3000)

        // Verify order tracking
        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage
            .assertScreenDisplayed()
            .assertTrackingStepsDisplayed()
    }

    @Test
    fun testReviewAfterOrderCompletion() {
        // Navigate to completed order
        navigateToCompletedOrder()

        val trackingPage = DeliveryTrackingPage(composeTestRule)
        trackingPage.tapRateOrder()

        val reviewPage = ReviewPage(composeTestRule)
        reviewPage.submitQuickReview(5, "Excellent service!")

        Thread.sleep(2000)
    }

    // MARK: - Helper Methods

    private fun navigateToProfile() {
        composeTestRule.onNodeWithContentDescription("Profile", ignoreCase = true).performClick()
        Thread.sleep(1000)
    }

    private fun navigateToReferrals() {
        navigateToProfile()
        composeTestRule.onNodeWithText("Referrals", ignoreCase = true).performClick()
        Thread.sleep(1000)
    }

    private fun navigateToActiveOrder() {
        composeTestRule.onNodeWithContentDescription("Orders", ignoreCase = true).performClick()
        Thread.sleep(1000)
        composeTestRule.onAllNodes(hasTestTag("OrderItem")).onFirst().performClick()
        Thread.sleep(1000)
    }

    private fun navigateToCompletedOrder() {
        composeTestRule.onNodeWithContentDescription("Orders", ignoreCase = true).performClick()
        Thread.sleep(1000)
        composeTestRule.onNodeWithText("Completed", ignoreCase = true).performClick()
        Thread.sleep(500)
        composeTestRule.onAllNodes(hasTestTag("OrderItem")).onFirst().performClick()
        Thread.sleep(1000)
    }

    private fun navigateToReviewScreen() {
        val marketplacePage = MarketplacePage(composeTestRule)
        marketplacePage.tapFirstSeller()
        Thread.sleep(1000)
        composeTestRule.onNodeWithText("Reviews", ignoreCase = true).performClick()
        Thread.sleep(500)
        composeTestRule.onNodeWithText("Write Review", ignoreCase = true).performClick()
        Thread.sleep(500)
    }
}
