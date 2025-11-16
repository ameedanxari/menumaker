package com.menumaker.data.local.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.menumaker.data.local.entities.MenuEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface MenuDao {

    @Query("SELECT * FROM menus WHERE id = :menuId")
    fun getMenuById(menuId: String): Flow<MenuEntity?>

    @Query("SELECT * FROM menus WHERE business_id = :businessId")
    fun getMenusByBusiness(businessId: String): Flow<List<MenuEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMenu(menu: MenuEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMenus(menus: List<MenuEntity>)

    @Query("DELETE FROM menus WHERE id = :menuId")
    suspend fun deleteMenu(menuId: String)

    @Query("DELETE FROM menus")
    suspend fun deleteAll()
}
