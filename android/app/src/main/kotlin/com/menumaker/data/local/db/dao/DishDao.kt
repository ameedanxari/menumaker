package com.menumaker.data.local.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.menumaker.data.local.entities.DishEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface DishDao {

    @Query("SELECT * FROM dishes WHERE id = :dishId")
    fun getDishById(dishId: String): Flow<DishEntity?>

    @Query("SELECT * FROM dishes WHERE business_id = :businessId")
    fun getDishesByBusiness(businessId: String): Flow<List<DishEntity>>

    @Query("SELECT * FROM dishes WHERE business_id = :businessId AND is_available = 1")
    fun getAvailableDishesByBusiness(businessId: String): Flow<List<DishEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDish(dish: DishEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDishes(dishes: List<DishEntity>)

    @Query("DELETE FROM dishes WHERE id = :dishId")
    suspend fun deleteDish(dishId: String)

    @Query("DELETE FROM dishes WHERE business_id = :businessId")
    suspend fun deleteDishesByBusiness(businessId: String)

    @Query("DELETE FROM dishes")
    suspend fun deleteAll()
}
