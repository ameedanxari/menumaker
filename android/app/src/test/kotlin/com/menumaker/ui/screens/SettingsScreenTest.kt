package com.menumaker.ui.screens

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SettingsScreenTest {

    @Test
    fun `settings destinations are configured HTTPS URLs`() {
        SettingsDestination.entries.forEach { destination ->
            assertTrue(destination.url, destination.url.startsWith("https://"))
        }
    }

    @Test
    fun `legal destinations are stable product paths`() {
        assertEquals("https://menumaker.app/terms", SettingsDestination.Terms.url)
        assertEquals("https://menumaker.app/privacy", SettingsDestination.Privacy.url)
    }
}
