package com.menumaker.di

import com.menumaker.data.local.datastore.TokenDataStore
import com.menumaker.data.local.db.dao.BusinessDao
import com.menumaker.data.local.db.dao.DishDao
import com.menumaker.data.local.db.dao.MenuDao
import com.menumaker.data.local.db.dao.OrderDao
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.repository.AuthRepository
import com.menumaker.data.repository.AuthRepositoryImpl
import com.menumaker.data.repository.BusinessRepository
import com.menumaker.data.repository.BusinessRepositoryImpl
import com.menumaker.data.repository.DishRepository
import com.menumaker.data.repository.DishRepositoryImpl
import com.menumaker.data.repository.MenuRepository
import com.menumaker.data.repository.MenuRepositoryImpl
import com.menumaker.data.repository.OrderRepository
import com.menumaker.data.repository.OrderRepositoryImpl
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideAuthRepository(
        apiService: ApiService,
        tokenDataStore: TokenDataStore
    ): AuthRepository {
        return AuthRepositoryImpl(apiService, tokenDataStore)
    }

    @Provides
    @Singleton
    fun provideBusinessRepository(
        apiService: ApiService,
        businessDao: BusinessDao
    ): BusinessRepository {
        return BusinessRepositoryImpl(apiService, businessDao)
    }

    @Provides
    @Singleton
    fun provideDishRepository(
        apiService: ApiService,
        dishDao: DishDao
    ): DishRepository {
        return DishRepositoryImpl(apiService, dishDao)
    }

    @Provides
    @Singleton
    fun provideMenuRepository(
        apiService: ApiService,
        menuDao: MenuDao
    ): MenuRepository {
        return MenuRepositoryImpl(apiService, menuDao)
    }

    @Provides
    @Singleton
    fun provideOrderRepository(
        apiService: ApiService,
        orderDao: OrderDao
    ): OrderRepository {
        return OrderRepositoryImpl(apiService, orderDao)
    }
}
