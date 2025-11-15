package com.menumaker.data.local.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.menumaker.data.local.db.dao.BusinessDao
import com.menumaker.data.local.db.dao.DishDao
import com.menumaker.data.local.db.dao.MenuDao
import com.menumaker.data.local.db.dao.OrderDao
import com.menumaker.data.local.entities.BusinessEntity
import com.menumaker.data.local.entities.DishEntity
import com.menumaker.data.local.entities.MenuEntity
import com.menumaker.data.local.entities.OrderEntity

@Database(
    entities = [
        BusinessEntity::class,
        DishEntity::class,
        MenuEntity::class,
        OrderEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class MenuMakerDatabase : RoomDatabase() {
    abstract fun businessDao(): BusinessDao
    abstract fun dishDao(): DishDao
    abstract fun menuDao(): MenuDao
    abstract fun orderDao(): OrderDao
}
