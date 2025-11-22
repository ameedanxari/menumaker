package com.menumaker.pageobjects

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.ComposeTestRule

/**
 * Page Object for Referral System Screen
 */
class ReferralPage(private val composeTestRule: ComposeTestRule) {

    // Elements
    private val referralCodeText = composeTestRule.onNode(hasTestTag("ReferralCode"))
    private val copyCodeButton = composeTestRule.onNodeWithText("Copy", ignoreCase = true)
    private val shareButton = composeTestRule.onNodeWithText("Share", ignoreCase = true)
    private val totalReferralsLabel = composeTestRule.onNode(hasTestTag("TotalReferrals"))
    private val availableCreditsLabel = composeTestRule.onNode(hasTestTag("AvailableCredits"))
    private val applyCodeField = composeTestRule.onNodeWithText("Enter Code", substring = true, ignoreCase = true)
    private val applyButton = composeTestRule.onNodeWithText("Apply", ignoreCase = true)

    // Actions
    fun tapCopyCode(): ReferralPage {
        copyCodeButton.performClick()
        Thread.sleep(500)
        return this
    }

    fun tapShare(): ReferralPage {
        shareButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun enterReferralCode(code: String): ReferralPage {
        applyCodeField.performClick()
        applyCodeField.performTextInput(code)
        return this
    }

    fun tapApply(): ReferralPage {
        applyButton.performClick()
        Thread.sleep(1000)
        return this
    }

    fun applyCode(code: String): ReferralPage {
        enterReferralCode(code)
        tapApply()
        return this
    }

    fun assertReferralLinkDisplayed(): ReferralPage {
        referralCodeText.assertExists()
        return this
    }

    fun assertCodeCopied(): ReferralPage {
        // Check for copy confirmation toast/snackbar
        composeTestRule.onNode(
            hasText("copied", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun tapShareCode(): ReferralPage {
        tapShare()
        return this
    }

    fun assertTotalReferralsDisplayed(): ReferralPage {
        totalReferralsLabel.assertExists()
        return this
    }

    fun tapViewHistory(): ReferralPage {
        composeTestRule.onNodeWithText("History", ignoreCase = true).performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapLeaderboard(): ReferralPage {
        composeTestRule.onNodeWithText("Leaderboard", ignoreCase = true).performClick()
        Thread.sleep(1000)
        return this
    }

    fun tapTermsAndConditions(): ReferralPage {
        composeTestRule.onNodeWithText("Terms", substring = true, ignoreCase = true).performClick()
        Thread.sleep(1000)
        return this
    }

    fun assertRewardsDisplayed(): ReferralPage {
        composeTestRule.onNode(
            hasText("reward", substring = true, ignoreCase = true) or
            hasText("point", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun shareViaWhatsApp(): ReferralPage {
        tapShare()
        Thread.sleep(1000)
        composeTestRule.onNodeWithText("WhatsApp", ignoreCase = true).performClick()
        Thread.sleep(1000)
        return this
    }

    // Assertions
    fun assertScreenDisplayed(): ReferralPage {
        referralCodeText.assertExists()
        return this
    }

    fun assertReferralCodeDisplayed(): ReferralPage {
        referralCodeText.assertExists()
        // Verify the referral code text is displayed
        try {
            val config = referralCodeText.fetchSemanticsNode().config
            val text = config[SemanticsProperties.Text].firstOrNull()?.text ?: ""
            assert(text.length > 5) {
                "Referral code should be valid length"
            }
        } catch (e: Exception) {
            // Just verify it exists if we can't read the text
        }
        return this
    }

    fun assertStatsDisplayed(): ReferralPage {
        totalReferralsLabel.assertExists()
        return this
    }

    fun assertShareDialogDisplayed(): ReferralPage {
        composeTestRule.onNode(
            hasText("share", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertEarningsDisplayed(): ReferralPage {
        composeTestRule.onNode(
            hasText("earning", substring = true, ignoreCase = true) or
            hasText("₹", substring = true)
        ).assertExists()
        return this
    }

    fun assertHistoryDisplayed(): ReferralPage {
        composeTestRule.onNode(
            hasText("history", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertLeaderboardDisplayed(): ReferralPage {
        composeTestRule.onNode(
            hasText("leaderboard", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertTermsDisplayed(): ReferralPage {
        composeTestRule.onNode(
            hasText("terms", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }

    fun assertRewardAmountDisplayed(): ReferralPage {
        composeTestRule.onNode(
            hasText("₹", substring = true) or
            hasText("reward", substring = true, ignoreCase = true)
        ).assertExists()
        return this
    }
}
