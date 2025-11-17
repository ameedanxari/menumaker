package com.menumaker.pageobjects

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

    // Assertions
    fun assertScreenDisplayed(): ReferralPage {
        referralCodeText.assertExists()
        return this
    }

    fun assertReferralCodeDisplayed(): ReferralPage {
        referralCodeText.assertExists()
        assert(referralCodeText.fetchSemanticsNode().config.getOrNull(SemanticsProperties.Text)?.firstOrNull()?.text?.length ?: 0 > 5) {
            "Referral code should be valid length"
        }
        return this
    }

    fun assertStatsDisplayed(): ReferralPage {
        totalReferralsLabel.assertExists()
        return this
    }
}
