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

    // MARK: - Enhanced Validation Tests for Requirements 3.4, 8.3

    @Test
    fun `createCoupon with percentage discount type`() = runTest {
        // Given
        val couponData = mapOf(
            "business_id" to "business-1",
            "code" to "PERCENT10",
            "discount_type" to "percentage",
            "discount_value" to 10
        )
        val percentageCoupon = mockCoupon.copy(
            code = "PERCENT10",
            discountType = "percentage",
            discountValue = 10
        )
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(percentageCoupon))
        }
        val couponsFlow = flow {
            emit(Resource.Success(listOf(percentageCoupon)))
        }

        `when`(couponRepository.createCoupon(couponData)).thenReturn(successFlow)
        `when`(couponRepository.getCoupons("business-1")).thenReturn(couponsFlow)

        // When
        viewModel.createCoupon(couponData)

        // Then
        assertTrue(viewModel.createState.value is Resource.Success)
        assertEquals("percentage", (viewModel.createState.value as Resource.Success).data.discountType)
    }

    @Test
    fun `createCoupon with fixed discount type`() = runTest {
        // Given
        val couponData = mapOf(
            "business_id" to "business-1",
            "code" to "FIXED500",
            "discount_type" to "fixed",
            "discount_value" to 500
        )
        val fixedCoupon = mockCoupon.copy(
            code = "FIXED500",
            discountType = "fixed",
            discountValue = 500
        )
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(fixedCoupon))
        }
        val couponsFlow = flow {
            emit(Resource.Success(listOf(fixedCoupon)))
        }

        `when`(couponRepository.createCoupon(couponData)).thenReturn(successFlow)
        `when`(couponRepository.getCoupons("business-1")).thenReturn(couponsFlow)

        // When
        viewModel.createCoupon(couponData)

        // Then
        assertTrue(viewModel.createState.value is Resource.Success)
        assertEquals("fixed", (viewModel.createState.value as Resource.Success).data.discountType)
    }

    @Test
    fun `createCoupon with minimum order value`() = runTest {
        // Given
        val minOrderValue = 2000
        val couponData = mapOf(
            "business_id" to "business-1",
            "code" to "MINORDER",
            "discount_type" to "percentage",
            "discount_value" to 10,
            "min_order_value_cents" to minOrderValue
        )
        val couponWithMinOrder = mockCoupon.copy(
            code = "MINORDER",
            minOrderValueCents = minOrderValue
        )
        val successFlow = flow {
            emit(Resource.Success(couponWithMinOrder))
        }
        val couponsFlow = flow {
            emit(Resource.Success(listOf(couponWithMinOrder)))
        }

        `when`(couponRepository.createCoupon(couponData)).thenReturn(successFlow)
        `when`(couponRepository.getCoupons("business-1")).thenReturn(couponsFlow)

        // When
        viewModel.createCoupon(couponData)

        // Then
        assertTrue(viewModel.createState.value is Resource.Success)
        assertEquals(minOrderValue, (viewModel.createState.value as Resource.Success).data.minOrderValueCents)
    }

    @Test
    fun `createCoupon with max discount cap`() = runTest {
        // Given
        val maxDiscount = 1000
        val couponData = mapOf(
            "business_id" to "business-1",
            "code" to "MAXCAP",
            "discount_type" to "percentage",
            "discount_value" to 20,
            "max_discount_cents" to maxDiscount
        )
        val couponWithMaxCap = mockCoupon.copy(
            code = "MAXCAP",
            maxDiscountCents = maxDiscount
        )
        val successFlow = flow {
            emit(Resource.Success(couponWithMaxCap))
        }
        val couponsFlow = flow {
            emit(Resource.Success(listOf(couponWithMaxCap)))
        }

        `when`(couponRepository.createCoupon(couponData)).thenReturn(successFlow)
        `when`(couponRepository.getCoupons("business-1")).thenReturn(couponsFlow)

        // When
        viewModel.createCoupon(couponData)

        // Then
        assertTrue(viewModel.createState.value is Resource.Success)
        assertEquals(maxDiscount, (viewModel.createState.value as Resource.Success).data.maxDiscountCents)
    }

    @Test
    fun `createCoupon with invalid data returns error`() = runTest {
        // Given
        val couponData = mapOf(
            "business_id" to "business-1",
            "code" to "" // Invalid empty code
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
    fun `createCoupon with duplicate code returns error`() = runTest {
        // Given
        val couponData = mapOf(
            "business_id" to "business-1",
            "code" to "EXISTING",
            "discount_type" to "percentage",
            "discount_value" to 10
        )
        val errorMessage = "Coupon code already exists"
        val errorFlow = flow {
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
    fun `loadCoupons returns multiple coupons`() = runTest {
        // Given
        val businessId = "business-1"
        val coupon1 = mockCoupon.copy(id = "coupon-1", code = "CODE1")
        val coupon2 = mockCoupon.copy(id = "coupon-2", code = "CODE2")
        val coupons = listOf(coupon1, coupon2)
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(coupons))
        }

        `when`(couponRepository.getCoupons(businessId)).thenReturn(successFlow)

        // When
        viewModel.loadCoupons(businessId)

        // Then
        assertTrue(viewModel.couponsState.value is Resource.Success)
        assertEquals(2, (viewModel.couponsState.value as Resource.Success).data.size)
    }

    @Test
    fun `loadCoupons with empty list returns success`() = runTest {
        // Given
        val businessId = "business-1"
        val successFlow = flow {
            emit(Resource.Loading)
            emit(Resource.Success(emptyList<CouponDto>()))
        }

        `when`(couponRepository.getCoupons(businessId)).thenReturn(successFlow)

        // When
        viewModel.loadCoupons(businessId)

        // Then
        assertTrue(viewModel.couponsState.value is Resource.Success)
        assertTrue((viewModel.couponsState.value as Resource.Success).data.isEmpty())
    }

    @Test
    fun `deleteCoupon refreshes coupons list`() = runTest {
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
    fun `createCoupon with expiration date`() = runTest {
        // Given
        val validUntil = "2025-12-31T23:59:59Z"
        val couponData = mapOf(
            "business_id" to "business-1",
            "code" to "EXPIRING",
            "discount_type" to "percentage",
            "discount_value" to 15,
            "valid_until" to validUntil
        )
        val expiringCoupon = mockCoupon.copy(
            code = "EXPIRING",
            validUntil = validUntil
        )
        val successFlow = flow {
            emit(Resource.Success(expiringCoupon))
        }
        val couponsFlow = flow {
            emit(Resource.Success(listOf(expiringCoupon)))
        }

        `when`(couponRepository.createCoupon(couponData)).thenReturn(successFlow)
        `when`(couponRepository.getCoupons("business-1")).thenReturn(couponsFlow)

        // When
        viewModel.createCoupon(couponData)

        // Then
        assertTrue(viewModel.createState.value is Resource.Success)
        assertEquals(validUntil, (viewModel.createState.value as Resource.Success).data.validUntil)
    }
}
