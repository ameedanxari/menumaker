package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.ApplyReferralResponse
import com.menumaker.data.remote.models.ReferralHistoryDto
import com.menumaker.data.remote.models.ReferralLeaderboardDto
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
    fun `getReferralStats suppresses launch-gated rewards rank and leaderboard`() = runTest {
        // Given
        val stats = TestDataFactory.createReferralStats(
            totalReferrals = 10,
            successfulReferrals = 8,
            totalEarningsCents = 50_000,
            availableCreditsCents = 30_000,
            pendingRewardsCents = 20_000,
            referralCode = "RAW-REWARD",
            leaderboardPosition = 1
        )
        val leaderboard = listOf(
            ReferralLeaderboardDto(
                rank = 1,
                userName = "Seller",
                referralCount = 8,
                earningsCents = 50_000
            )
        )
        fakeApiService.getReferralStatsResponse = Response.success(
            TestDataFactory.createReferralStatsResponse(stats = stats, leaderboard = leaderboard)
        )

        // When
        val results = repository.getReferralStats().toList()

        // Then
        val successResult = results.last() as Resource.Success<ReferralStatsData>
        assertThat(successResult.data.stats.referralCode).isEqualTo("RAW-REWARD")
        assertThat(successResult.data.stats.totalReferrals).isEqualTo(10)
        assertThat(successResult.data.stats.totalEarningsCents).isEqualTo(0)
        assertThat(successResult.data.stats.availableCreditsCents).isEqualTo(0)
        assertThat(successResult.data.stats.pendingRewardsCents).isEqualTo(0)
        assertThat(successResult.data.stats.leaderboardPosition).isNull()
        assertThat(successResult.data.leaderboard).isEmpty()
    }

    @Test
    fun `getReferralStats rejects unsafe referral code and negative counters`() = runTest {
        // Given
        val unsafeStats = TestDataFactory.createReferralStats(
            totalReferrals = -1,
            referralCode = "REF\u0000CODE"
        )
        fakeApiService.getReferralStatsResponse = Response.success(
            TestDataFactory.createReferralStatsResponse(stats = unsafeStats)
        )

        // When
        val results = repository.getReferralStats().toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Total referrals must be non-negative")
    }

    @Test
    fun `getReferralStats rejects invisible control referral code before UI exposure`() = runTest {
        // Given
        val unsafeStats = TestDataFactory.createReferralStats(
            totalReferrals = 1,
            successfulReferrals = 1,
            pendingReferrals = 0,
            monthlyReferrals = 1,
            referralCode = "REF\u202ECODE"
        )
        fakeApiService.getReferralStatsResponse = Response.success(
            TestDataFactory.createReferralStatsResponse(stats = unsafeStats)
        )

        // When
        val results = repository.getReferralStats().toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Referral code contains unsafe control characters")
    }

    @Test
    fun `getReferralStats rejects impossible referral counters before UI exposure`() = runTest {
        // Given
        val impossibleStats = TestDataFactory.createReferralStats(
            totalReferrals = 3,
            successfulReferrals = 4,
            pendingReferrals = 1,
            monthlyReferrals = 2,
            referralCode = "REF-COUNTERS"
        )
        fakeApiService.getReferralStatsResponse = Response.success(
            TestDataFactory.createReferralStatsResponse(stats = impossibleStats)
        )

        // When
        val results = repository.getReferralStats().toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Successful referrals must not exceed total referrals")
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
    fun `getReferralHistory suppresses reward cents while rewards are launch-gated`() = runTest {
        // Given
        val history = listOf(
            TestDataFactory.createReferralHistory(
                id = " ref-1 ",
                referredUserName = " Customer ",
                rewardCents = 50_000
            )
        )
        fakeApiService.getReferralHistoryResponse = Response.success(
            TestDataFactory.createReferralHistoryResponse(referrals = history)
        )

        // When
        val results = repository.getReferralHistory().toList()

        // Then
        val successResult = results.last() as Resource.Success<List<ReferralHistoryDto>>
        assertThat(successResult.data.single().id).isEqualTo("ref-1")
        assertThat(successResult.data.single().referredUserName).isEqualTo("Customer")
        assertThat(successResult.data.single().rewardCents).isEqualTo(0)
    }

    @Test
    fun `getReferralHistory rejects unsafe history text before UI exposure`() = runTest {
        // Given
        val history = listOf(
            TestDataFactory.createReferralHistory(
                id = "ref-1",
                referredUserName = "Customer\u0000Name"
            )
        )
        fakeApiService.getReferralHistoryResponse = Response.success(
            TestDataFactory.createReferralHistoryResponse(referrals = history)
        )

        // When
        val results = repository.getReferralHistory().toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Referred user name contains unsafe control characters")
    }

    @Test
    fun `getReferralHistory rejects invisible controls before UI exposure`() = runTest {
        // Given
        val history = listOf(
            TestDataFactory.createReferralHistory(
                id = "ref-1",
                referredUserName = "Customer\u200BName"
            )
        )
        fakeApiService.getReferralHistoryResponse = Response.success(
            TestDataFactory.createReferralHistoryResponse(referrals = history)
        )

        // When
        val results = repository.getReferralHistory().toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Referred user name contains unsafe control characters")
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
        val results = repository.applyReferralCode(" VALIDCODE ").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<ApplyReferralResponse>
        assertThat(successResult.data.success).isTrue()
        assertThat(fakeApiService.lastApplyReferralCodeRequest).containsEntry("code", "VALIDCODE")
    }

    @Test
    fun `applyReferralCode rejects unsafe code before API call`() = runTest {
        // When
        val results = repository.applyReferralCode("BAD\u0000CODE").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Referral code contains unsafe control characters")
        assertThat(fakeApiService.lastApplyReferralCodeRequest).isNull()
    }

    @Test
    fun `applyReferralCode rejects invisible control code before API call`() = runTest {
        // When
        val results = repository.applyReferralCode("BAD\u2060CODE").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Referral code contains unsafe control characters")
        assertThat(fakeApiService.lastApplyReferralCodeRequest).isNull()
    }

    @Test
    fun `applyReferralCode rejects blank code before API call`() = runTest {
        // When
        val results = repository.applyReferralCode("   ").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Referral code is required")
        assertThat(fakeApiService.lastApplyReferralCodeRequest).isNull()
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
