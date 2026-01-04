package com.menumaker.di

import com.menumaker.data.repository.AuthRepository
import com.menumaker.data.repository.BusinessRepository
import com.menumaker.data.repository.CartRepository
import com.menumaker.data.repository.CouponRepository
import com.menumaker.data.repository.DishRepository
import com.menumaker.data.repository.FavoriteRepository
import com.menumaker.data.repository.IntegrationRepository
import com.menumaker.data.repository.MarketplaceRepository
import com.menumaker.data.repository.MenuRepository
import com.menumaker.data.repository.NotificationRepository
import com.menumaker.data.repository.OrderRepository
import com.menumaker.data.repository.PaymentRepository
import com.menumaker.data.repository.ReferralRepository
import com.menumaker.data.repository.ReviewRepository
import com.menumaker.fakes.FakeAuthRepository
import com.menumaker.fakes.FakeBusinessRepository
import com.menumaker.fakes.FakeCartRepository
import com.menumaker.fakes.FakeCouponRepository
import com.menumaker.fakes.FakeDishRepository
import com.menumaker.fakes.FakeFavoriteRepository
import com.menumaker.fakes.FakeIntegrationRepository
import com.menumaker.fakes.FakeMarketplaceRepository
import com.menumaker.fakes.FakeMenuRepository
import com.menumaker.fakes.FakeNotificationRepository
import com.menumaker.fakes.FakeOrderRepository
import com.menumaker.fakes.FakePaymentRepository
import com.menumaker.fakes.FakeReferralRepository
import com.menumaker.fakes.FakeReviewRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.components.SingletonComponent
import dagger.hilt.testing.TestInstallIn
import javax.inject.Singleton

/**
 * Hilt test module that replaces real repositories with fake implementations.
 * This module is used in UI tests to provide deterministic, network-independent testing.
 * 
 * Usage in tests:
 * ```
 * @HiltAndroidTest
 * class MyUITest {
 *     @get:Rule
 *     val hiltRule = HiltAndroidRule(this)
 *     
 *     @Inject
 *     lateinit var authRepository: AuthRepository
 *     
 *     @Before
 *     fun setup() {
 *         hiltRule.inject()
 *         // Cast to fake for configuration
 *         (authRepository as FakeAuthRepository).configureSuccessfulLogin()
 *     }
 * }
 * ```
 */
@Module
@TestInstallIn(
    components = [SingletonComponent::class],
    replaces = [RepositoryModule::class]
)
object FakeRepositoryModule {

    @Provides
    @Singleton
    fun provideAuthRepository(): AuthRepository {
        return FakeAuthRepository()
    }

    @Provides
    @Singleton
    fun provideBusinessRepository(): BusinessRepository {
        return FakeBusinessRepository()
    }

    @Provides
    @Singleton
    fun provideDishRepository(): DishRepository {
        return FakeDishRepository()
    }

    @Provides
    @Singleton
    fun provideMenuRepository(): MenuRepository {
        return FakeMenuRepository()
    }

    @Provides
    @Singleton
    fun provideOrderRepository(): OrderRepository {
        return FakeOrderRepository()
    }

    @Provides
    @Singleton
    fun provideCouponRepository(): CouponRepository {
        return FakeCouponRepository()
    }

    @Provides
    @Singleton
    fun provideCartRepository(): CartRepository {
        return FakeCartRepository()
    }

    @Provides
    @Singleton
    fun provideMarketplaceRepository(): MarketplaceRepository {
        return FakeMarketplaceRepository()
    }

    @Provides
    @Singleton
    fun providePaymentRepository(): PaymentRepository {
        return FakePaymentRepository()
    }

    @Provides
    @Singleton
    fun provideReviewRepository(): ReviewRepository {
        return FakeReviewRepository()
    }

    @Provides
    @Singleton
    fun provideReferralRepository(): ReferralRepository {
        return FakeReferralRepository()
    }

    @Provides
    @Singleton
    fun provideIntegrationRepository(): IntegrationRepository {
        return FakeIntegrationRepository()
    }

    @Provides
    @Singleton
    fun provideFavoriteRepository(): FavoriteRepository {
        return FakeFavoriteRepository()
    }

    @Provides
    @Singleton
    fun provideNotificationRepository(): NotificationRepository {
        return FakeNotificationRepository()
    }
}
