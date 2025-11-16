package com.menumaker.data.local.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.menumaker.data.local.entities.CouponEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CouponDao {
    @Query("SELECT * FROM coupons WHERE business_id = :businessId")
    fun getCouponsByBusiness(businessId: String): Flow<List<CouponEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCoupons(coupons: List<CouponEntity>)

    @Query("DELETE FROM coupons WHERE id = :couponId")
    suspend fun deleteCoupon(couponId: String)

    @Query("DELETE FROM coupons")
    suspend fun deleteAll()
}
