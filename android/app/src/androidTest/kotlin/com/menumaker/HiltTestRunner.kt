package com.menumaker

import android.app.Application
import android.content.Context
import androidx.test.runner.AndroidJUnitRunner
import dagger.hilt.android.testing.HiltTestApplication

/**
 * Custom test runner for Hilt-based instrumented tests.
 * 
 * This runner replaces the default AndroidJUnitRunner to enable Hilt dependency injection
 * in UI tests. It creates a HiltTestApplication instead of the regular application,
 * allowing test modules to replace production dependencies with fakes.
 * 
 * Usage:
 * 1. Configure in build.gradle.kts:
 *    ```
 *    defaultConfig {
 *        testInstrumentationRunner = "com.menumaker.HiltTestRunner"
 *    }
 *    ```
 * 
 * 2. Use in tests:
 *    ```
 *    @HiltAndroidTest
 *    class MyUITest {
 *        @get:Rule
 *        val hiltRule = HiltAndroidRule(this)
 *        
 *        @Before
 *        fun setup() {
 *            hiltRule.inject()
 *        }
 *    }
 *    ```
 */
class HiltTestRunner : AndroidJUnitRunner() {

    override fun newApplication(
        cl: ClassLoader?,
        className: String?,
        context: Context?
    ): Application {
        return super.newApplication(cl, HiltTestApplication::class.java.name, context)
    }
}
