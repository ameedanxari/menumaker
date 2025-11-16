package com.menumaker.data.local.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.menumaker.data.local.db.dao.*
import com.menumaker.data.local.entities.*

@Database(
    entities = [
        BusinessEntity::class,
        DishEntity::class,
        MenuEntity::class,
        OrderEntity::class,
        CouponEntity::class,
        ReviewEntity::class,
        CartEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class MenuMakerDatabase : RoomDatabase() {
    abstract fun businessDao(): BusinessDao
    abstract fun dishDao(): DishDao
    abstract fun menuDao(): MenuDao
    abstract fun orderDao(): OrderDao
    abstract fun couponDao(): CouponDao
    abstract fun reviewDao(): ReviewDao
    abstract fun cartDao(): CartDao
}
