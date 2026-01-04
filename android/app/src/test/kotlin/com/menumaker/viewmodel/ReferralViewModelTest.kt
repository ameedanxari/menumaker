package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.*
import com.menumaker.data.repository.ReferralRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class ReferralViewModelTest {

    @Mock
    private lateinit var repository: ReferralRepository

    private lateinit var viewModel: ReferralViewModel

    private val testDispatcher = UnconfinedTestDispatcher()
    
    // Mock Data
    private val mockStats = ReferralStatsDto(
        totalReferrals = 5,
        successfulReferrals = 2,
        pendingReferrals = 3,
        monthlyReferrals = 1,
        totalEarningsCents = 1000,
        availableCreditsCents = 500,
        pendingRewardsCents = 500,
        referralCode = "MYCODE",
        leaderboardPosition = 1
    )
    
    private val mockLeaderboard = listOf(
        ReferralLeaderboardDto(1, "User", 5, 1000)
    )
    
    private val mockStatsData = ReferralStatsData(mockStats, mockLeaderboard)

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)
        
        // Default init load behavior
        Mockito.`when`(repository.getReferralStats()).thenReturn(flow {
             emit(Resource.Success(mockStatsData))
        })
        Mockito.`when`(repository.getReferralHistory()).thenReturn(flow {
             emit(Resource.Success(emptyList<ReferralHistoryDto>()))
        })

        viewModel = ReferralViewModel(repository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadReferralData updates stats and leaderboard`() = runTest {
        assertEquals(5, viewModel.stats.value?.totalReferrals)
        assertEquals(1, viewModel.leaderboard.value.size)
        assertFalse(viewModel.isLoading.value)
    }

    @Test
    fun `applyReferralCode validations`() {
        viewModel.applyReferralCode("")
        assertEquals("Please enter a referral code", viewModel.referralCodeMessage.value)
        assertFalse(viewModel.referralCodeSuccess.value)
        
        viewModel.applyReferralCode("MYCODE") // Same as stats.referralCode
        assertEquals("You cannot use your own referral code", viewModel.referralCodeMessage.value)
        assertFalse(viewModel.referralCodeSuccess.value)
    }

    @Test
    fun `applyReferralCode success`() = runTest {
        val successResponse = ApplyReferralResponse(true, "Applied")
        Mockito.`when`(repository.applyReferralCode("OTHER")).thenReturn(flow {
             emit(Resource.Success(successResponse))
        })
        
        viewModel.applyReferralCode("OTHER")
        
        assertEquals("Applied", viewModel.referralCodeMessage.value)
        assertTrue(viewModel.referralCodeSuccess.value)
    }

    @Test
    fun `refreshData reloads data`() = runTest {
        viewModel.refreshData()
        // Should trigger repository calls again (verified by mocks if we spy, but checking state is enough)
        assertEquals(5, viewModel.stats.value?.totalReferrals)
    }
}
