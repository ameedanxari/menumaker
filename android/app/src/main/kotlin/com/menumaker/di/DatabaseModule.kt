package com.menumaker.di

import android.content.Context
import androidx.room.Room
import com.menumaker.data.local.db.MenuMakerDatabase
import com.menumaker.data.local.db.dao.BusinessDao
import com.menumaker.data.local.db.dao.DishDao
import com.menumaker.data.local.db.dao.MenuDao
import com.menumaker.data.local.db.dao.OrderDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideMenuMakerDatabase(
        @ApplicationContext context: Context
    ): MenuMakerDatabase {
        return Room.databaseBuilder(
            context,
            MenuMakerDatabase::class.java,
            "menumaker_db"
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    @Singleton
    fun provideBusinessDao(database: MenuMakerDatabase): BusinessDao {
        return database.businessDao()
    }

    @Provides
    @Singleton
    fun provideDishDao(database: MenuMakerDatabase): DishDao {
        return database.dishDao()
    }

    @Provides
    @Singleton
    fun provideMenuDao(database: MenuMakerDatabase): MenuDao {
        return database.menuDao()
    }

    @Provides
    @Singleton
    fun provideOrderDao(database: MenuMakerDatabase): OrderDao {
        return database.orderDao()
    }

    @Provides
    @Singleton
    fun provideCouponDao(database: MenuMakerDatabase) = database.couponDao()

    @Provides
    @Singleton
    fun provideReviewDao(database: MenuMakerDatabase) = database.reviewDao()

    @Provides
    @Singleton
    fun provideCartDao(database: MenuMakerDatabase) = database.cartDao()
}
