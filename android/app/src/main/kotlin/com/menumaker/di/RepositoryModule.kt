package com.menumaker.di

import com.menumaker.data.local.datastore.TokenDataStore
import com.menumaker.data.local.db.dao.*
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.repository.*
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

    @Provides
    @Singleton
    fun provideCouponRepository(
        apiService: ApiService,
        couponDao: CouponDao
    ): CouponRepository = CouponRepositoryImpl(apiService, couponDao)

    @Provides
    @Singleton
    fun provideCartRepository(
        cartDao: CartDao
    ): CartRepository = CartRepositoryImpl(cartDao)

    @Provides
    @Singleton
    fun provideMarketplaceRepository(
        apiService: ApiService
    ): MarketplaceRepository = MarketplaceRepositoryImpl(apiService)

    @Provides
    @Singleton
    fun providePaymentRepository(
        apiService: ApiService
    ): PaymentRepository = PaymentRepositoryImpl(apiService)

    @Provides
    @Singleton
    fun provideReviewRepository(
        apiService: ApiService,
        reviewDao: ReviewDao
    ): ReviewRepository = ReviewRepositoryImpl(apiService, reviewDao)

    @Provides
    @Singleton
    fun provideReferralRepository(
        apiService: ApiService
    ): ReferralRepository = ReferralRepositoryImpl(apiService)

    @Provides
    @Singleton
    fun provideIntegrationRepository(
        apiService: ApiService
    ): IntegrationRepository = IntegrationRepositoryImpl(apiService)
}
