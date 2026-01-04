package com.menumaker.fixtures

import androidx.test.platform.app.InstrumentationRegistry
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.menumaker.data.remote.models.*
import java.io.InputStreamReader

/**
 * Loads shared mock JSON from the root-level shared/mocks directory so both
 * unit tests and instrumented tests consume the same data contracts.
 */
object SharedMockLoader {
    private val gson = Gson()

    fun loadJson(path: String): String {
        // Try classpath resources first (unit tests)
        javaClass.classLoader?.getResourceAsStream(path)?.let { stream ->
            return stream.bufferedReader().use { it.readText() }
        }

        // Fallback to instrumented test assets
        return runCatching {
            val assetManager = InstrumentationRegistry.getInstrumentation().context.assets
            assetManager.open(path).bufferedReader().use { it.readText() }
        }.getOrElse {
            throw IllegalStateException("Unable to load fixture at $path", it)
        }
    }

    inline fun <reified T> load(path: String): T {
        val json = loadJson(path)
        val type = object : TypeToken<T>() {}.type
        return gson.fromJson(json, type)
    }
}

/**
 * Typed accessors for shared fixtures used across tests.
 */
object SharedFixtures {
    val dishes: List<DishDto> by lazy {
        SharedMockLoader.load<DishListResponse>("dishes/200.json").data.dishes
    }

    val orders: List<OrderDto> by lazy {
        SharedMockLoader.load<OrderListResponse>("orders/list/200.json").data.orders
    }

    val businesses: List<BusinessDto> by lazy {
        SharedMockLoader.load<BusinessListResponse>("businesses/list/200.json").data.businesses
    }

    val menus: List<MenuDto> by lazy {
        SharedMockLoader.load<MenuListResponse>("menus/list/200.json").data.menus
    }

    val marketplaceSellers: List<MarketplaceSellerDto> by lazy {
        SharedMockLoader.load<MarketplaceResponse>("marketplace/list/200.json").data.sellers
    }

    val coupons: List<CouponDto> by lazy {
        SharedMockLoader.load<CouponListResponse>("coupons/list/200.json").data.coupons
    }

    val reviews: ReviewListData by lazy {
        SharedMockLoader.load<ReviewListResponse>("reviews/list/200.json").data
    }

    val notifications: NotificationListData by lazy {
        SharedMockLoader.load<NotificationListResponse>("notifications/list/200.json").data
    }

    val favorites: FavoriteListData by lazy {
        SharedMockLoader.load<FavoriteListResponse>("favorites/list/200.json").data
    }

    val paymentProcessors: List<PaymentProcessorDto> by lazy {
        SharedMockLoader.load<PaymentProcessorListResponse>("payments/processors/200.json").data.processors
    }

    val payouts: PayoutListData by lazy {
        SharedMockLoader.load<PayoutListResponse>("payments/payouts/200.json").data
    }

    val referralStats: ReferralStatsData by lazy {
        SharedMockLoader.load<ReferralStatsResponse>("referrals/stats/200.json").data
    }

    val referralHistory: ReferralHistoryData by lazy {
        SharedMockLoader.load<ReferralHistoryResponse>("referrals/history/200.json").data
    }

    val integrations: List<IntegrationDto> by lazy {
        SharedMockLoader.load<IntegrationListResponse>("integrations/list/200.json").data.integrations
    }
}
