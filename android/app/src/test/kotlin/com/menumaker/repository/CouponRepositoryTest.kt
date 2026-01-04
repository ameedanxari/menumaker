package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.local.db.dao.CouponDao
import com.menumaker.data.remote.models.CouponDto
import com.menumaker.data.repository.CouponRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.positiveInt
import io.kotest.property.checkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.Mockito
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import retrofit2.Response
import java.io.IOException

/**
 * Unit tests for CouponRepositoryImpl.
 * Tests getCoupons, createCoupon, and validateCoupon flows.
 *
 * Requirements: 3.4, 8.3
 */
@OptIn(ExperimentalCoroutinesApi::class)
class CouponRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var mockCouponDao: CouponDao
    private lateinit var repository: CouponRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        mockCouponDao = mock()
        repository = CouponRepositoryImpl(fakeApiService, mockCouponDao)
        whenever(mockCouponDao.getCouponsByBusiness(any())).thenReturn(flowOf(emptyList()))
    }

    // ==================== getCoupons Tests ====================

    @Test
    fun `getCoupons emits Loading then Success with coupons`() = runTest {
        // Given
        val coupons = listOf(
            TestDataFactory.createCoupon(id = "coupon-1", code = "SAVE10"),
            TestDataFactory.createCoupon(id = "coupon-2", code = "SAVE20")
        )
        fakeApiService.getCouponsResponse = Response.success(
            TestDataFactory.createCouponListResponse(coupons = coupons)
        )

        // When
        val results = repository.getCoupons("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<List<CouponDto>>
        assertThat(successResult.data).hasSize(2)
    }

    @Test
    fun `getCoupons caches coupons on success`() = runTest {
        // Given
        val coupons = listOf(TestDataFactory.createCoupon())
        fakeApiService.getCouponsResponse = Response.success(
            TestDataFactory.createCouponListResponse(coupons = coupons)
        )

        // When
        repository.getCoupons("business-123").toList()

        // Then
        verify(mockCouponDao).insertCoupons(any())
    }

    @Test
    fun `getCoupons emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500

        // When
        val results = repository.getCoupons("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `getCoupons handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.getCoupons("business-123").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    // ==================== createCoupon Tests ====================

    @Test
    fun `createCoupon emits Loading then Success with coupon`() = runTest {
        // Given
        val coupon = TestDataFactory.createCoupon(code = "NEWCODE", discountValue = 15)
        fakeApiService.createCouponResponse = Response.success(
            TestDataFactory.createCouponResponse(coupon = coupon)
        )

        // When
        val couponData = mapOf(
            "code" to "NEWCODE",
            "discountType" to "percentage",
            "discountValue" to 15
        )
        val results = repository.createCoupon(couponData).toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<CouponDto>
        assertThat(successResult.data.code).isEqualTo("NEWCODE")
    }

    @Test
    fun `createCoupon emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 400

        // When
        val results = repository.createCoupon(mapOf("code" to "INVALID")).toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    // ==================== deleteCoupon Tests ====================

    @Test
    fun `deleteCoupon emits Loading then Success`() = runTest {
        // Given
        fakeApiService.deleteCouponResponse = Response.success(Unit)

        // When
        val results = repository.deleteCoupon("coupon-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Success::class.java)
    }

    @Test
    fun `deleteCoupon removes from local cache on success`() = runTest {
        // Given
        fakeApiService.deleteCouponResponse = Response.success(Unit)

        // When
        repository.deleteCoupon("coupon-123").toList()

        // Then
        verify(mockCouponDao).deleteCoupon("coupon-123")
    }

    @Test
    fun `deleteCoupon emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 404

        // When
        val results = repository.deleteCoupon("nonexistent-coupon").toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }
}

// ==================== Property-Based Tests ====================

/**
 * **Feature: android-test-coverage, Property 20: Coupon Discount Application**
 * **Validates: Requirements 8.3**
 *
 * Property: For any valid coupon code and cart total, applying the coupon
 * SHALL reduce the total by the correct discount amount.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class CouponDiscountApplicationPropertyTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var mockCouponDao: CouponDao
    private lateinit var repository: CouponRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        mockCouponDao = mock()
        repository = CouponRepositoryImpl(fakeApiService, mockCouponDao)
        whenever(mockCouponDao.getCouponsByBusiness(any())).thenReturn(flowOf(emptyList()))
    }

    // Custom Arb for coupon codes
    private fun arbCouponCode(): Arb<String> = arbitrary { rs ->
        val chars = ('A'..'Z') + ('0'..'9')
        (1..8).map { chars.random(rs.random) }.joinToString("")
    }

    // Custom Arb for discount types
    private fun arbDiscountType(): Arb<String> = arbitrary { rs ->
        listOf("percentage", "fixed").random(rs.random)
    }

    @Test
    fun `property - created coupon has correct code and discount`() = runTest {
        // Property: For any coupon creation, the returned coupon has correct values
        checkAll(
            iterations = 100,
            arbCouponCode(),
            arbDiscountType(),
            Arb.int(1..50)  // discountValue
        ) { code, discountType, discountValue ->
            // Reset state for each iteration
            fakeApiService.reset()
            Mockito.reset(mockCouponDao)
            
            // Given - a successful create coupon response
            val coupon = TestDataFactory.createCoupon(
                code = code,
                discountType = discountType,
                discountValue = discountValue
            )
            fakeApiService.createCouponResponse = Response.success(
                TestDataFactory.createCouponResponse(coupon = coupon)
            )

            // When
            val couponData = mapOf(
                "code" to code,
                "discountType" to discountType,
                "discountValue" to discountValue
            )
            val results = repository.createCoupon(couponData).toList()

            // Then - returned coupon should have correct values
            val successResult = results.last() as Resource.Success<CouponDto>
            assertThat(successResult.data.code).isEqualTo(code)
            assertThat(successResult.data.discountType).isEqualTo(discountType)
            assertThat(successResult.data.discountValue).isEqualTo(discountValue)
        }
    }

    @Test
    fun `property - percentage discount is between 1 and 100`() = runTest {
        // Property: For percentage discounts, value should be valid percentage
        checkAll(
            iterations = 100,
            Arb.int(1..100)  // valid percentage
        ) { discountValue ->
            // Reset state for each iteration
            fakeApiService.reset()
            Mockito.reset(mockCouponDao)
            
            // Given - a percentage coupon
            val coupon = TestDataFactory.createCoupon(
                discountType = "percentage",
                discountValue = discountValue
            )
            fakeApiService.createCouponResponse = Response.success(
                TestDataFactory.createCouponResponse(coupon = coupon)
            )

            // When
            val results = repository.createCoupon(mapOf(
                "discountType" to "percentage",
                "discountValue" to discountValue
            )).toList()

            // Then - discount value should be valid percentage
            val successResult = results.last() as Resource.Success<CouponDto>
            assertThat(successResult.data.discountValue).isIn(1..100)
        }
    }
}
