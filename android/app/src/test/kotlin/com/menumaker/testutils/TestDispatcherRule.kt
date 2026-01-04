package com.menumaker.testutils

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.rules.TestWatcher
import org.junit.runner.Description

/**
 * JUnit TestRule that sets the Main dispatcher to a test dispatcher for coroutine testing.
 * This ensures deterministic execution of coroutines in unit tests.
 *
 * Usage:
 * ```
 * @get:Rule
 * val dispatcherRule = TestDispatcherRule()
 *
 * @Test
 * fun myTest() = runTest {
 *     // Test code using coroutines
 * }
 * ```
 *
 * Requirements: 2.4 - Use mocked repositories with UnconfinedTestDispatcher for deterministic coroutine execution
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TestDispatcherRule(
    val testDispatcher: TestDispatcher = UnconfinedTestDispatcher()
) : TestWatcher() {

    override fun starting(description: Description) {
        Dispatchers.setMain(testDispatcher)
    }

    override fun finished(description: Description) {
        Dispatchers.resetMain()
    }
}
