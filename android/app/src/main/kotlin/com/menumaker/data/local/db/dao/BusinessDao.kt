package com.menumaker.data.local.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.menumaker.data.local.entities.BusinessEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface BusinessDao {

    @Query("SELECT * FROM businesses WHERE id = :businessId")
    fun getBusinessById(businessId: String): Flow<BusinessEntity?>

    @Query("SELECT * FROM businesses WHERE owner_id = :ownerId")
    fun getBusinessesByOwner(ownerId: String): Flow<List<BusinessEntity>>

    @Query("SELECT * FROM businesses")
    fun getAllBusinesses(): Flow<List<BusinessEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBusiness(business: BusinessEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBusinesses(businesses: List<BusinessEntity>)

    @Query("DELETE FROM businesses WHERE id = :businessId")
    suspend fun deleteBusiness(businessId: String)

    @Query("DELETE FROM businesses")
    suspend fun deleteAll()
}
