package com.menumaker.fakes

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.CouponDto
import com.menumaker.data.repository.CouponRepository
import com.menumaker.fixtures.SharedFixtures
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Fake implementation of CouponRepository for UI tests.
 * Provides configurable responses for deterministic testing.
 */
class FakeCouponRepository : CouponRepository {

    // Configurable responses
    var couponsResponse: Resource<List<CouponDto>>? = null
    var createCouponResponse: Resource<CouponDto>? = null
    var deleteCouponResponse: Resource<Unit> = Resource.Success(Unit)

    // In-memory storage for coupons
    private val coupons = mutableListOf<CouponDto>()

    // Track method calls for verification
    var getCouponsCallCount = 0
    var createCouponCallCount = 0
    var deleteCouponCallCount = 0
    var lastBusinessId: String? = null
    var lastDeletedCouponId: String? = null

    // Default test data
    private val defaultCoupons: List<CouponDto>
        get() = SharedFixtures.coupons

    init {
        coupons.addAll(defaultCoupons)
    }

    override fun getCoupons(businessId: String): Flow<Resource<List<CouponDto>>> = flow {
        emit(Resource.Loading)
        getCouponsCallCount++
        lastBusinessId = businessId

        val response = couponsResponse 
            ?: Resource.Success(coupons.filter { it.businessId == businessId })
        emit(response)
    }

    override fun createCoupon(coupon: Map<String, Any>): Flow<Resource<CouponDto>> = flow {
        emit(Resource.Loading)
        createCouponCallCount++

        if (createCouponResponse != null) {
            emit(createCouponResponse!!)
        } else {
            val newCoupon = CouponDto(
                id = "coupon-${System.currentTimeMillis()}",
                businessId = coupon["business_id"] as? String ?: "business-1",
                code = coupon["code"] as? String ?: "NEWCODE",
                discountType = coupon["discount_type"] as? String ?: "percentage",
                discountValue = (coupon["discount_value"] as? Number)?.toInt() ?: 10,
                maxDiscountCents = (coupon["max_discount_cents"] as? Number)?.toInt(),
                minOrderValueCents = (coupon["min_order_value_cents"] as? Number)?.toInt() ?: 0,
                validUntil = coupon["valid_until"] as? String,
                usageLimitType = coupon["usage_limit_type"] as? String ?: "unlimited",
                totalUsageLimit = (coupon["total_usage_limit"] as? Number)?.toInt(),
                isActive = coupon["is_active"] as? Boolean ?: true,
                createdAt = "2025-01-01T00:00:00Z"
            )
            coupons.add(newCoupon)
            emit(Resource.Success(newCoupon))
        }
    }

    override fun deleteCoupon(id: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        deleteCouponCallCount++
        lastDeletedCouponId = id

        coupons.removeAll { it.id == id }
        emit(deleteCouponResponse)
    }

    /**
     * Reset all state for clean test setup
     */
    fun reset() {
        couponsResponse = null
        createCouponResponse = null
        deleteCouponResponse = Resource.Success(Unit)
        coupons.clear()
        coupons.addAll(defaultCoupons)
        getCouponsCallCount = 0
        createCouponCallCount = 0
        deleteCouponCallCount = 0
        lastBusinessId = null
        lastDeletedCouponId = null
    }

    /**
     * Set coupons directly for test setup
     */
    fun setCoupons(newCoupons: List<CouponDto>) {
        coupons.clear()
        coupons.addAll(newCoupons)
    }

    /**
     * Configure for empty results scenario
     */
    fun configureEmptyResults() {
        coupons.clear()
        couponsResponse = Resource.Success(emptyList())
    }

    /**
     * Configure for error scenario
     */
    fun configureError(errorMessage: String = "Failed to load coupons") {
        couponsResponse = Resource.Error(errorMessage)
    }
}
