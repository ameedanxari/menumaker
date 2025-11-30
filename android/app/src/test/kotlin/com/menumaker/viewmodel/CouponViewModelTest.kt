package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.CouponDto
import com.menumaker.data.repository.CouponRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class CouponViewModelTest {

    @Mock
    private lateinit var couponRepository: CouponRepository

    private lateinit var viewModel: CouponViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    private val mockCoupon = CouponDto(
        id = "coupon-1",
        businessId = "business-1",
        code = "SAVE20",
        discountType = "percentage",
        discountValue = 20,
        maxDiscountCents = 500,
        minOrderValueCents = 1000,
        validUntil = "2024-12-31T23:59:59Z",
        usageLimitType = "unlimited",
        totalUsageLimit = null,
        isActive = true,
        createdAt = "2024-01-01T00:00:00Z"
    )

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)

        viewModel = CouponViewModel(couponRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadCoupons updates couponsState with success`() = runTest {
        // Given
        val businessId = "business-1"
        val coupons = listOf(mockCoupon)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(coupons))
        }

        `when`(couponRepository.getCoupons(businessId)).thenReturn(successFlow)

        // When
        viewModel.loadCoupons(businessId)

        // Then
        assertTrue(viewModel.couponsState.value is Resource.Success)
        assertEquals(coupons, (viewModel.couponsState.value as Resource.Success).data)
    }

    @Test
    fun `loadCoupons updates couponsState with error`() = runTest {
        // Given
        val businessId = "business-1"
        val errorMessage = "Failed to load coupons"
        val errorFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Error(errorMessage))
        }

        `when`(couponRepository.getCoupons(businessId)).thenReturn(errorFlow)

        // When
        viewModel.loadCoupons(businessId)

        // Then
        assertTrue(viewModel.couponsState.value is Resource.Error)
        assertEquals(errorMessage, (viewModel.couponsState.value as Resource.Error).message)
    }

    @Test
    fun `createCoupon updates createState with success`() = runTest {
        // Given
        val couponData = mapOf(
            "business_id" to "business-1",
            "code" to "SAVE20",
            "discount_type" to "percentage",
            "discount_value" to 20
        )
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(mockCoupon))
        }

        `when`(couponRepository.createCoupon(couponData)).thenReturn(successFlow)
        
        // Mock loadCoupons call
        val couponsFlow = flow {
            emit(Resource.Success(listOf(mockCoupon)))
        }
        `when`(couponRepository.getCoupons("business-1")).thenReturn(couponsFlow)

        // When
        viewModel.createCoupon(couponData)

        // Then
        assertTrue(viewModel.createState.value is Resource.Success)
        assertEquals(mockCoupon, (viewModel.createState.value as Resource.Success).data)
    }

    @Test
    fun `createCoupon updates createState with error`() = runTest {
        // Given
        val couponData = mapOf(
            "business_id" to "business-1",
            "code" to "INVALID"
        )
        val errorMessage = "Invalid coupon data"
        val errorFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Error(errorMessage))
        }

        `when`(couponRepository.createCoupon(couponData)).thenReturn(errorFlow)

        // When
        viewModel.createCoupon(couponData)

        // Then
        assertTrue(viewModel.createState.value is Resource.Error)
        assertEquals(errorMessage, (viewModel.createState.value as Resource.Error).message)
    }

    @Test
    fun `deleteCoupon refreshes coupons on success`() = runTest {
        // Given
        val couponId = "coupon-1"
        val businessId = "business-1"
        val deleteFlow = flow {
            emit(Resource.Success(Unit))
        }
        val couponsFlow = flow {
            emit(Resource.Success(emptyList<CouponDto>()))
        }

        `when`(couponRepository.deleteCoupon(couponId)).thenReturn(deleteFlow)
        `when`(couponRepository.getCoupons(businessId)).thenReturn(couponsFlow)

        // When
        viewModel.deleteCoupon(couponId, businessId)

        // Then
        verify(couponRepository).deleteCoupon(couponId)
        verify(couponRepository).getCoupons(businessId)
    }

    @Test
    fun `initial state is null`() {
        assertEquals(null, viewModel.couponsState.value)
        assertEquals(null, viewModel.createState.value)
    }
}
