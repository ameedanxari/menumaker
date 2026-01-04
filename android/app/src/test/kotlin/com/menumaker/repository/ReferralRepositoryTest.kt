package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.ApplyReferralResponse
import com.menumaker.data.remote.models.ReferralHistoryDto
import com.menumaker.data.remote.models.ReferralStatsData
import com.menumaker.data.repository.ReferralRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.checkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import retrofit2.Response
import java.io.IOException

/**
 * Unit tests for ReferralRepositoryImpl.
 * Tests getReferralStats and applyReferralCode flows.
 *
 * Requirements: 11.1, 11.2
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ReferralRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var repository: ReferralRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        repository = ReferralRepositoryImpl(fakeApiService)
    }

    // ==================== getReferralStats Tests ====================

    @Test
    fun `getReferralStats emits Loading then Success with stats`() = runTest {
        // Given
        val stats = TestDataFactory.createReferralStats(
            totalReferrals = 10,
            successfulReferrals = 5,
            referralCode = "TESTCODE123"
        )
        fakeApiService.getReferralStatsResponse = Response.success(
            TestDataFactory.createReferralStatsResponse(stats = stats)
        )

        // When
        val results = repository.getReferralStats().toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<ReferralStatsData>
        assertThat(successResult.data.stats.totalReferrals).isEqualTo(10)
        assertThat(successResult.data.stats.referralCode).isEqualTo("TESTCODE123")
    }

    @Test
    fun `getReferralStats emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500

        // When
        val results = repository.getReferralStats().toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `getReferralStats handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.getReferralStats().toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    // ==================== getReferralHistory Tests ====================

    @Test
    fun `getReferralHistory emits Loading then Success with history`() = runTest {
        // Given
        val history = listOf(
            TestDataFactory.createReferralHistory(id = "ref-1"),
            TestDataFactory.createReferralHistory(id = "ref-2")
        )
        fakeApiService.getReferralHistoryResponse = Response.success(
            TestDataFactory.createReferralHistoryResponse(referrals = history)
        )

        // When
        val results = repository.getReferralHistory().toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<List<ReferralHistoryDto>>
        assertThat(successResult.data).hasSize(2)
    }

    @Test
    fun `getReferralHistory emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 401

        // When
        val results = repository.getReferralHistory().toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    // ==================== applyReferralCode Tests ====================

    @Test
    fun `applyReferralCode emits Loading then Success`() = runTest {
        // Given
        fakeApiService.applyReferralCodeResponse = Response.success(
            TestDataFactory.createApplyReferralResponse(success = true)
        )

        // When
        val results = repository.applyReferralCode("VALIDCODE").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<ApplyReferralResponse>
        assertThat(successResult.data.success).isTrue()
    }

    @Test
    fun `applyReferralCode emits Error for invalid code`() = runTest {
        // Given
        fakeApiService.errorCode = 400
        fakeApiService.errorMessage = "Invalid referral code"

        // When
        val results = repository.applyReferralCode("INVALIDCODE").toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `applyReferralCode handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Connection timeout")

        // When
        val results = repository.applyReferralCode("TESTCODE").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Connection timeout")
    }
}

// ==================== Property-Based Tests ====================

/**
 * **Feature: android-test-coverage, Property 24: Referral Code Validation**
 * **Validates: Requirements 11.2**
 *
 * Property: For any referral code, applying it SHALL either succeed
 * with benefits or fail with validation error.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ReferralCodeValidationPropertyTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var repository: ReferralRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        repository = ReferralRepositoryImpl(fakeApiService)
    }

    // Custom Arb for referral codes
    private fun arbReferralCode(): Arb<String> = arbitrary { rs ->
        val chars = ('A'..'Z') + ('0'..'9')
        (1..10).map { chars.random(rs.random) }.joinToString("")
    }

    @Test
    fun `property - valid referral code returns success response`() = runTest {
        // Property: For any valid referral code, applyReferralCode returns success
        checkAll(
            iterations = 100,
            arbReferralCode()
        ) { code ->
            // Reset state for each iteration
            fakeApiService.reset()
            
            // Given - a successful apply referral response
            fakeApiService.applyReferralCodeResponse = Response.success(
                TestDataFactory.createApplyReferralResponse(success = true)
            )

            // When
            val results = repository.applyReferralCode(code).toList()

            // Then - should emit Loading first
            assertThat(results.first()).isEqualTo(Resource.Loading)
            
            // And then Success
            val successResult = results.last() as Resource.Success<ApplyReferralResponse>
            assertThat(successResult.data.success).isTrue()
        }
    }

    @Test
    fun `property - applyReferralCode always emits Loading first`() = runTest {
        // Property: For any referral code, Loading is always emitted first
        checkAll(
            iterations = 100,
            arbReferralCode()
        ) { code ->
            // Reset state for each iteration
            fakeApiService.reset()
            fakeApiService.applyReferralCodeResponse = Response.success(
                TestDataFactory.createApplyReferralResponse(success = true)
            )

            // When
            val results = repository.applyReferralCode(code).toList()

            // Then - first emission should always be Loading
            assertThat(results.first()).isEqualTo(Resource.Loading)
        }
    }

    @Test
    fun `property - referral stats contain valid referral code`() = runTest {
        // Property: Referral stats always contain a non-empty referral code
        checkAll(
            iterations = 50,
            arbReferralCode()
        ) { referralCode ->
            // Reset state for each iteration
            fakeApiService.reset()
            
            // Given - stats with the referral code
            val stats = TestDataFactory.createReferralStats(referralCode = referralCode)
            fakeApiService.getReferralStatsResponse = Response.success(
                TestDataFactory.createReferralStatsResponse(stats = stats)
            )

            // When
            val results = repository.getReferralStats().toList()

            // Then - referral code should match
            val successResult = results.last() as Resource.Success<ReferralStatsData>
            assertThat(successResult.data.stats.referralCode).isEqualTo(referralCode)
            assertThat(successResult.data.stats.referralCode).isNotEmpty()
        }
    }
}
