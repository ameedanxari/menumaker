package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.local.db.dao.CouponDao
import com.menumaker.data.local.entities.CouponEntity
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.CouponDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

interface CouponRepository {
    fun getCoupons(businessId: String): Flow<Resource<List<CouponDto>>>
    fun createCoupon(coupon: Map<String, Any>): Flow<Resource<CouponDto>>
    fun deleteCoupon(id: String): Flow<Resource<Unit>>
}

class CouponRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val couponDao: CouponDao
) : CouponRepository {

    override fun getCoupons(businessId: String): Flow<Resource<List<CouponDto>>> = flow {
        emit(Resource.Loading)
        try {
            // Emit cached data first
            couponDao.getCouponsByBusiness(businessId).collect { cached ->
                if (cached.isNotEmpty()) {
                    emit(Resource.Success(cached.map { it.toDto() }))
                }
            }

            // Then fetch fresh data
            val response = apiService.getCoupons(businessId)
            if (response.isSuccessful && response.body() != null) {
                val coupons = response.body()!!.data.coupons
                couponDao.insertCoupons(coupons.map { it.toEntity() })
                emit(Resource.Success(coupons))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load coupons"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun createCoupon(coupon: Map<String, Any>): Flow<Resource<CouponDto>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.createCoupon(coupon)
            if (response.isSuccessful && response.body() != null) {
                val newCoupon = response.body()!!.data.coupon
                emit(Resource.Success(newCoupon))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to create coupon"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun deleteCoupon(id: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.deleteCoupon(id)
            if (response.isSuccessful) {
                couponDao.deleteCoupon(id)
                emit(Resource.Success(Unit))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to delete coupon"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    private fun CouponDto.toEntity() = CouponEntity(
        id = id,
        businessId = businessId,
        code = code,
        discountType = discountType,
        discountValue = discountValue,
        isActive = isActive,
        createdAt = createdAt
    )

    private fun CouponEntity.toDto() = CouponDto(
        id = id,
        businessId = businessId,
        code = code,
        discountType = discountType,
        discountValue = discountValue,
        maxDiscountCents = null,
        minOrderValueCents = 0,
        validUntil = null,
        usageLimitType = "unlimited",
        totalUsageLimit = null,
        isActive = isActive,
        createdAt = createdAt
    )
}
