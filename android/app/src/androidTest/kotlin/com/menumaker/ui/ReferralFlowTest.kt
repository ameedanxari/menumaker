package com.menumaker.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import com.menumaker.MainActivity
import com.menumaker.pageobjects.ReferralPage
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * UI tests for referral program functionality
 */
@LargeTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class ReferralFlowTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun testReferralScreenDisplays() {
        val referralPage = ReferralPage(composeTestRule)
        referralPage.assertScreenDisplayed()
    }

    @Test
    fun testReferralCodeDisplays() {
        val referralPage = ReferralPage(composeTestRule)
        referralPage
            .assertReferralCodeDisplayed()
            .assertReferralLinkDisplayed()
    }

    @Test
    fun testCopyReferralCode() {
        val referralPage = ReferralPage(composeTestRule)
        referralPage
            .tapCopyCode()
            .assertCodeCopied()
    }

    @Test
    fun testShareReferralCode() {
        val referralPage = ReferralPage(composeTestRule)
        referralPage
            .tapShareCode()
            .assertShareDialogDisplayed()
    }

    @Test
    fun testViewReferralStats() {
        val referralPage = ReferralPage(composeTestRule)
        referralPage
            .assertStatsDisplayed()
            .assertTotalReferralsDisplayed()
            .assertEarningsDisplayed()
    }

    @Test
    fun testViewReferralHistory() {
        val referralPage = ReferralPage(composeTestRule)
        referralPage
            .tapViewHistory()
            .assertHistoryDisplayed()
    }

    @Test
    fun testViewLeaderboard() {
        val referralPage = ReferralPage(composeTestRule)
        referralPage
            .tapLeaderboard()
            .assertLeaderboardDisplayed()
    }

    @Test
    fun testViewTermsAndConditions() {
        val referralPage = ReferralPage(composeTestRule)
        referralPage
            .tapTermsAndConditions()
            .assertTermsDisplayed()
    }

    @Test
    fun testReferralRewardsDisplay() {
        val referralPage = ReferralPage(composeTestRule)
        referralPage
            .assertRewardsDisplayed()
            .assertRewardAmountDisplayed()
    }

    @Test
    fun testSocialMediaShare() {
        val referralPage = ReferralPage(composeTestRule)
        referralPage
            .shareViaWhatsApp()
            .assertShareDialogDisplayed()
    }
}
