package com.menumaker.testutils

import com.menumaker.data.local.entities.CartEntity
import com.menumaker.data.remote.models.*
import com.menumaker.fixtures.SharedFixtures
import java.util.UUID

/**
 * Factory object for creating consistent test data across all unit tests.
 * Provides factory methods for all DTOs and entities used in the application.
 *
 * Requirements: 1.4 - Use mocked ApiService and DAO dependencies to ensure deterministic results
 */
object TestDataFactory {

    private val fixtureDish: DishDto
        get() = SharedFixtures.dishes.first()

    private val fixtureOrder: OrderDto
        get() = SharedFixtures.orders.first()

    private val fixtureOrderItem: OrderItemDto
        get() = fixtureOrder.items.firstOrNull() ?: OrderItemDto(
            id = "item-fixture",
            dishId = fixtureDish.id,
            dishName = fixtureDish.name,
            quantity = 1,
            priceCents = fixtureDish.priceCents,
            totalCents = fixtureDish.priceCents
        )

    // ==================== Auth Models ====================

    fun createUser(
        id: String = "user-${UUID.randomUUID()}",
        email: String = "test@example.com",
        name: String = "Test User",
        phone: String? = "+1234567890",
        address: String? = "123 Test Street",
        photoUrl: String? = null,
        role: String = "customer",
        createdAt: String = "2025-01-01T00:00:00Z",
        updatedAt: String? = null
    ) = UserDto(
        id = id,
        email = email,
        name = name,
        phone = phone,
        address = address,
        photoUrl = photoUrl,
        role = role,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    fun createAuthData(
        accessToken: String = "test-access-token-${UUID.randomUUID()}",
        refreshToken: String = "test-refresh-token-${UUID.randomUUID()}",
        user: UserDto = createUser()
    ) = AuthData(
        accessToken = accessToken,
        refreshToken = refreshToken,
        user = user
    )

    fun createAuthResponse(
        success: Boolean = true,
        data: AuthData = createAuthData()
    ) = AuthResponse(
        success = success,
        data = data
    )

    fun createLoginRequest(
        email: String = "test@example.com",
        password: String = "password123"
    ) = LoginRequest(
        email = email,
        password = password
    )

    fun createSignupRequest(
        email: String = "test@example.com",
        password: String = "password123",
        name: String = "Test User",
        phone: String? = "+1234567890"
    ) = SignupRequest(
        email = email,
        password = password,
        name = name,
        phone = phone
    )

    // ==================== Business Models ====================

    fun createBusiness(
        id: String = "business-${UUID.randomUUID()}",
        name: String = "Test Restaurant",
        slug: String = "test-restaurant",
        description: String? = "A test restaurant",
        logoUrl: String? = null,
        ownerId: String = "owner-${UUID.randomUUID()}",
        isActive: Boolean = true,
        createdAt: String = "2025-01-01T00:00:00Z",
        updatedAt: String = "2025-01-01T00:00:00Z"
    ) = BusinessDto(
        id = id,
        name = name,
        slug = slug,
        description = description,
        logoUrl = logoUrl,
        ownerId = ownerId,
        isActive = isActive,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    fun createBusinessResponse(
        success: Boolean = true,
        business: BusinessDto = createBusiness()
    ) = BusinessResponse(
        success = success,
        data = BusinessData(business = business)
    )

    fun createBusinessListResponse(
        success: Boolean = true,
        businesses: List<BusinessDto> = listOf(createBusiness())
    ) = BusinessListResponse(
        success = success,
        data = BusinessListData(businesses = businesses)
    )

    // ==================== Order Models ====================

    fun createOrderItem(
        id: String = fixtureOrderItem.id,
        dishId: String = fixtureOrderItem.dishId,
        dishName: String = fixtureOrderItem.dishName,
        quantity: Int = fixtureOrderItem.quantity,
        priceCents: Int = fixtureOrderItem.priceCents,
        totalCents: Int = fixtureOrderItem.totalCents
    ) = OrderItemDto(
        id = id,
        dishId = dishId,
        dishName = dishName,
        quantity = quantity,
        priceCents = priceCents,
        totalCents = totalCents
    )

    fun createOrder(
        id: String = fixtureOrder.id,
        businessId: String = fixtureOrder.businessId,
        customerName: String = fixtureOrder.customerName,
        customerPhone: String? = fixtureOrder.customerPhone,
        customerEmail: String? = fixtureOrder.customerEmail,
        totalCents: Int = fixtureOrder.totalCents,
        status: String = fixtureOrder.status,
        items: List<OrderItemDto> = fixtureOrder.items,
        createdAt: String = fixtureOrder.createdAt,
        updatedAt: String = fixtureOrder.updatedAt
    ) = OrderDto(
        id = id,
        businessId = businessId,
        customerName = customerName,
        customerPhone = customerPhone,
        customerEmail = customerEmail,
        totalCents = totalCents,
        status = status,
        items = items,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    fun createOrderResponse(
        success: Boolean = true,
        order: OrderDto = createOrder()
    ) = OrderResponse(
        success = success,
        data = OrderData(order = order)
    )

    fun createOrderListResponse(
        success: Boolean = true,
        orders: List<OrderDto> = listOf(createOrder()),
        total: Int = orders.size
    ) = OrderListResponse(
        success = success,
        data = OrderListData(orders = orders, total = total)
    )

    // ==================== Dish Models ====================

    fun createDish(
        id: String = fixtureDish.id,
        businessId: String = fixtureDish.businessId,
        name: String = fixtureDish.name,
        description: String? = fixtureDish.description,
        priceCents: Int = fixtureDish.priceCents,
        imageUrl: String? = fixtureDish.imageUrl,
        category: String? = fixtureDish.category,
        isVegetarian: Boolean = fixtureDish.isVegetarian,
        isAvailable: Boolean = fixtureDish.isAvailable,
        createdAt: String = fixtureDish.createdAt,
        updatedAt: String = fixtureDish.updatedAt
    ) = DishDto(
        id = id,
        businessId = businessId,
        name = name,
        description = description,
        priceCents = priceCents,
        imageUrl = imageUrl,
        category = category,
        isVegetarian = isVegetarian,
        isAvailable = isAvailable,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    fun createDishResponse(
        success: Boolean = true,
        dish: DishDto = createDish()
    ) = DishResponse(
        success = success,
        data = DishData(dish = dish)
    )

    fun createDishListResponse(
        success: Boolean = true,
        dishes: List<DishDto> = listOf(createDish())
    ) = DishListResponse(
        success = success,
        data = DishListData(dishes = dishes)
    )


    // ==================== Cart Models ====================

    fun createCartEntity(
        dishId: String = "dish-${UUID.randomUUID()}",
        businessId: String = "business-${UUID.randomUUID()}",
        dishName: String = "Test Dish",
        quantity: Int = 1,
        priceCents: Int = 500,
        addedAt: Long = System.currentTimeMillis()
    ) = CartEntity(
        dishId = dishId,
        businessId = businessId,
        dishName = dishName,
        quantity = quantity,
        priceCents = priceCents,
        addedAt = addedAt
    )

    fun createCartItemDto(
        dishId: String = "dish-${UUID.randomUUID()}",
        dishName: String = "Test Dish",
        quantity: Int = 1,
        priceCents: Int = 500
    ) = CartItemDto(
        dishId = dishId,
        dishName = dishName,
        quantity = quantity,
        priceCents = priceCents
    )

    // ==================== Coupon Models ====================

    fun createCoupon(
        id: String = "coupon-${UUID.randomUUID()}",
        businessId: String = "business-${UUID.randomUUID()}",
        code: String = "TESTCODE",
        discountType: String = "percentage",
        discountValue: Int = 10,
        maxDiscountCents: Int? = 500,
        minOrderValueCents: Int = 100,
        validUntil: String? = "2025-12-31T23:59:59Z",
        usageLimitType: String = "unlimited",
        totalUsageLimit: Int? = null,
        isActive: Boolean = true,
        createdAt: String = "2025-01-01T00:00:00Z"
    ) = CouponDto(
        id = id,
        businessId = businessId,
        code = code,
        discountType = discountType,
        discountValue = discountValue,
        maxDiscountCents = maxDiscountCents,
        minOrderValueCents = minOrderValueCents,
        validUntil = validUntil,
        usageLimitType = usageLimitType,
        totalUsageLimit = totalUsageLimit,
        isActive = isActive,
        createdAt = createdAt
    )

    fun createCouponResponse(
        success: Boolean = true,
        coupon: CouponDto = createCoupon()
    ) = CouponResponse(
        success = success,
        data = CouponData(coupon = coupon)
    )

    fun createCouponListResponse(
        success: Boolean = true,
        coupons: List<CouponDto> = listOf(createCoupon())
    ) = CouponListResponse(
        success = success,
        data = CouponListData(coupons = coupons)
    )

    // ==================== Notification Models ====================

    fun createNotification(
        id: String = "notification-${UUID.randomUUID()}",
        userId: String = "user-${UUID.randomUUID()}",
        type: NotificationType = NotificationType.ORDER_PLACED,
        title: String = "Test Notification",
        message: String = "This is a test notification",
        data: Map<String, Any>? = null,
        isRead: Boolean = false,
        createdAt: String = "2025-01-01T00:00:00Z"
    ) = NotificationDto(
        id = id,
        userId = userId,
        type = type,
        title = title,
        message = message,
        data = data,
        isRead = isRead,
        createdAt = createdAt
    )

    fun createNotificationResponse(
        success: Boolean = true,
        notification: NotificationDto = createNotification()
    ) = NotificationResponse(
        success = success,
        data = NotificationData(notification = notification)
    )

    fun createNotificationListResponse(
        success: Boolean = true,
        notifications: List<NotificationDto> = listOf(createNotification()),
        total: Int = notifications.size,
        limit: Int = 20,
        offset: Int = 0
    ) = NotificationListResponse(
        success = success,
        data = NotificationListData(
            notifications = notifications,
            total = total,
            limit = limit,
            offset = offset
        )
    )

    // ==================== Review Models ====================

    fun createReview(
        id: String = "review-${UUID.randomUUID()}",
        businessId: String = "business-${UUID.randomUUID()}",
        customerName: String = "Test Customer",
        rating: Int = 5,
        comment: String? = "Great food!",
        imageUrls: List<String>? = null,
        createdAt: String = "2025-01-01T00:00:00Z"
    ) = ReviewDto(
        id = id,
        businessId = businessId,
        customerName = customerName,
        rating = rating,
        comment = comment,
        imageUrls = imageUrls,
        createdAt = createdAt
    )

    fun createReviewResponse(
        success: Boolean = true,
        review: ReviewDto = createReview()
    ) = ReviewResponse(
        success = success,
        data = ReviewData(review = review)
    )

    fun createReviewListResponse(
        success: Boolean = true,
        reviews: List<ReviewDto> = listOf(createReview()),
        averageRating: Double = 4.5,
        totalReviews: Int = reviews.size
    ) = ReviewListResponse(
        success = success,
        data = ReviewListData(
            reviews = reviews,
            averageRating = averageRating,
            totalReviews = totalReviews
        )
    )

    // ==================== Marketplace Models ====================

    fun createMarketplaceSeller(
        id: String = "seller-${UUID.randomUUID()}",
        name: String = "Test Restaurant",
        slug: String = "test-restaurant",
        description: String? = "A test restaurant",
        logoUrl: String? = null,
        cuisineType: String? = "Indian",
        rating: Double = 4.5,
        reviewCount: Int = 100,
        latitude: Double? = 12.9716,
        longitude: Double? = 77.5946,
        distanceKm: Double? = 2.5
    ) = MarketplaceSellerDto(
        id = id,
        name = name,
        slug = slug,
        description = description,
        logoUrl = logoUrl,
        cuisineType = cuisineType,
        rating = rating,
        reviewCount = reviewCount,
        latitude = latitude,
        longitude = longitude,
        distanceKm = distanceKm
    )

    fun createMarketplaceResponse(
        success: Boolean = true,
        sellers: List<MarketplaceSellerDto> = listOf(createMarketplaceSeller()),
        total: Int = sellers.size
    ) = MarketplaceResponse(
        success = success,
        data = MarketplaceData(sellers = sellers, total = total)
    )

    // ==================== Favorite Models ====================

    fun createFavorite(
        id: String = "favorite-${UUID.randomUUID()}",
        userId: String = "user-${UUID.randomUUID()}",
        businessId: String = "business-${UUID.randomUUID()}",
        business: BusinessDto? = createBusiness(),
        createdAt: String = "2025-01-01T00:00:00Z"
    ) = FavoriteDto(
        id = id,
        userId = userId,
        businessId = businessId,
        business = business,
        createdAt = createdAt
    )

    fun createFavoriteResponse(
        success: Boolean = true,
        favorite: FavoriteDto = createFavorite()
    ) = FavoriteResponse(
        success = success,
        data = FavoriteData(favorite = favorite)
    )

    fun createFavoriteListResponse(
        success: Boolean = true,
        favorites: List<FavoriteDto> = listOf(createFavorite())
    ) = FavoriteListResponse(
        success = success,
        data = FavoriteListData(favorites = favorites)
    )


    // ==================== Referral Models ====================

    fun createReferralStats(
        totalReferrals: Int = 10,
        successfulReferrals: Int = 5,
        pendingReferrals: Int = 3,
        monthlyReferrals: Int = 2,
        totalEarningsCents: Int = 5000,
        availableCreditsCents: Int = 2500,
        pendingRewardsCents: Int = 1500,
        referralCode: String = "TESTREF123",
        leaderboardPosition: Int? = 5
    ) = ReferralStatsDto(
        totalReferrals = totalReferrals,
        successfulReferrals = successfulReferrals,
        pendingReferrals = pendingReferrals,
        monthlyReferrals = monthlyReferrals,
        totalEarningsCents = totalEarningsCents,
        availableCreditsCents = availableCreditsCents,
        pendingRewardsCents = pendingRewardsCents,
        referralCode = referralCode,
        leaderboardPosition = leaderboardPosition
    )

    fun createReferralHistory(
        id: String = "referral-${UUID.randomUUID()}",
        referredUserName: String = "Referred User",
        referredAt: String = "2025-01-01T00:00:00Z",
        status: ReferralStatus = ReferralStatus.COMPLETED,
        rewardCents: Int = 500
    ) = ReferralHistoryDto(
        id = id,
        referredUserName = referredUserName,
        referredAt = referredAt,
        status = status,
        rewardCents = rewardCents
    )

    fun createReferralStatsResponse(
        success: Boolean = true,
        stats: ReferralStatsDto = createReferralStats(),
        leaderboard: List<ReferralLeaderboardDto> = emptyList()
    ) = ReferralStatsResponse(
        success = success,
        data = ReferralStatsData(stats = stats, leaderboard = leaderboard)
    )

    fun createReferralHistoryResponse(
        success: Boolean = true,
        referrals: List<ReferralHistoryDto> = listOf(createReferralHistory())
    ) = ReferralHistoryResponse(
        success = success,
        data = ReferralHistoryData(referrals = referrals)
    )

    fun createApplyReferralResponse(
        success: Boolean = true,
        message: String? = "Referral code applied successfully"
    ) = ApplyReferralResponse(
        success = success,
        message = message
    )

    // ==================== Payment Models ====================

    fun createPaymentProcessor(
        id: String = "processor-${UUID.randomUUID()}",
        processorType: String = "stripe",
        status: String = "active",
        isActive: Boolean = true,
        priority: Int = 1,
        settlementSchedule: String? = "daily",
        minPayoutThresholdCents: Int? = 10000,
        feePercentage: Double? = 2.9,
        fixedFeeCents: Int? = 30,
        lastTransactionAt: String? = null,
        verifiedAt: String? = "2025-01-01T00:00:00Z",
        connectionError: String? = null,
        metadata: Map<String, Any>? = null,
        createdAt: String? = "2025-01-01T00:00:00Z"
    ) = PaymentProcessorDto(
        id = id,
        processorType = processorType,
        status = status,
        isActive = isActive,
        priority = priority,
        settlementSchedule = settlementSchedule,
        minPayoutThresholdCents = minPayoutThresholdCents,
        feePercentage = feePercentage,
        fixedFeeCents = fixedFeeCents,
        lastTransactionAt = lastTransactionAt,
        verifiedAt = verifiedAt,
        connectionError = connectionError,
        metadata = metadata,
        createdAt = createdAt
    )

    fun createPaymentProcessorResponse(
        success: Boolean = true,
        processor: PaymentProcessorDto = createPaymentProcessor()
    ) = PaymentProcessorResponse(
        success = success,
        data = PaymentProcessorData(processor = processor)
    )

    fun createPaymentProcessorListResponse(
        success: Boolean = true,
        processors: List<PaymentProcessorDto> = listOf(createPaymentProcessor())
    ) = PaymentProcessorListResponse(
        success = success,
        data = PaymentProcessorListData(processors = processors)
    )

    fun createPayout(
        id: String = "payout-${UUID.randomUUID()}",
        businessId: String = "business-${UUID.randomUUID()}",
        processorId: String? = "processor-${UUID.randomUUID()}",
        amountCents: Int = 10000,
        feeCents: Int = 300,
        netAmountCents: Int = 9700,
        currency: String = "INR",
        status: String = "completed",
        payoutReference: String? = "ref-123",
        failureReason: String? = null,
        initiatedAt: String? = "2025-01-01T00:00:00Z",
        completedAt: String? = "2025-01-01T01:00:00Z",
        createdAt: String = "2025-01-01T00:00:00Z"
    ) = PayoutDto(
        id = id,
        businessId = businessId,
        processorId = processorId,
        amountCents = amountCents,
        feeCents = feeCents,
        netAmountCents = netAmountCents,
        currency = currency,
        status = status,
        payoutReference = payoutReference,
        failureReason = failureReason,
        initiatedAt = initiatedAt,
        completedAt = completedAt,
        createdAt = createdAt
    )

    fun createPayoutListResponse(
        success: Boolean = true,
        payouts: List<PayoutDto> = listOf(createPayout()),
        total: Int = payouts.size,
        limit: Int = 20,
        offset: Int = 0
    ) = PayoutListResponse(
        success = success,
        data = PayoutListData(
            payouts = payouts,
            total = total,
            limit = limit,
            offset = offset
        )
    )

    // ==================== Integration Models ====================

    fun createIntegration(
        id: String = "integration-${UUID.randomUUID()}",
        businessId: String = "business-${UUID.randomUUID()}",
        provider: String = "square",
        type: String = "pos",
        isActive: Boolean = true,
        lastSyncAt: String? = "2025-01-01T00:00:00Z",
        createdAt: String = "2025-01-01T00:00:00Z"
    ) = IntegrationDto(
        id = id,
        businessId = businessId,
        provider = provider,
        type = type,
        isActive = isActive,
        lastSyncAt = lastSyncAt,
        createdAt = createdAt
    )

    fun createIntegrationListResponse(
        success: Boolean = true,
        integrations: List<IntegrationDto> = listOf(createIntegration())
    ) = IntegrationListResponse(
        success = success,
        data = IntegrationListData(integrations = integrations)
    )

    // ==================== Menu Models ====================

    fun createMenu(
        id: String = "menu-${UUID.randomUUID()}",
        businessId: String = "business-${UUID.randomUUID()}",
        name: String = "Main Menu",
        description: String? = "Our main menu",
        isActive: Boolean = true,
        displayOrder: Int = 1,
        createdAt: String = "2025-01-01T00:00:00Z",
        updatedAt: String = "2025-01-01T00:00:00Z"
    ) = MenuDto(
        id = id,
        businessId = businessId,
        name = name,
        description = description,
        isActive = isActive,
        displayOrder = displayOrder,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    fun createMenuResponse(
        success: Boolean = true,
        menu: MenuDto = createMenu()
    ) = MenuResponse(
        success = success,
        data = MenuData(menu = menu)
    )

    fun createMenuListResponse(
        success: Boolean = true,
        menus: List<MenuDto> = listOf(createMenu())
    ) = MenuListResponse(
        success = success,
        data = MenuListData(menus = menus)
    )

    // ==================== Analytics Models ====================

    fun createPopularItem(
        id: String = "item-${UUID.randomUUID()}",
        name: String = "Popular Dish",
        salesCount: Int = 100,
        revenue: Double = 5000.0,
        imageUrl: String? = null
    ) = PopularItem(
        id = id,
        name = name,
        salesCount = salesCount,
        revenue = revenue,
        imageUrl = imageUrl
    )

    fun createSalesDataPoint(
        id: String = "sales-${UUID.randomUUID()}",
        date: String = "2025-01-01",
        sales: Double = 1000.0,
        orders: Int = 10
    ) = SalesDataPoint(
        id = id,
        date = date,
        sales = sales,
        orders = orders
    )

    fun createPeakHour(
        hour: Int = 12,
        orderCount: Int = 50
    ) = PeakHour(
        hour = hour,
        orderCount = orderCount
    )

    fun createAnalyticsData(
        totalSales: Double = 10000.0,
        totalOrders: Int = 100,
        totalRevenue: Double = 9500.0,
        averageOrderValue: Double = 100.0,
        newCustomers: Int = 20,
        repeatCustomers: Int = 30,
        popularItems: List<PopularItem> = listOf(createPopularItem()),
        salesData: List<SalesDataPoint> = listOf(createSalesDataPoint()),
        peakHours: List<PeakHour> = listOf(createPeakHour())
    ) = AnalyticsData(
        totalSales = totalSales,
        totalOrders = totalOrders,
        totalRevenue = totalRevenue,
        averageOrderValue = averageOrderValue,
        newCustomers = newCustomers,
        repeatCustomers = repeatCustomers,
        popularItems = popularItems,
        salesData = salesData,
        peakHours = peakHours
    )

    fun createCustomerInsights(
        newCustomers: Int = 20,
        repeatCustomers: Int = 30,
        totalCustomers: Int = 50,
        averageOrdersPerCustomer: Double = 2.5
    ) = CustomerInsights(
        newCustomers = newCustomers,
        repeatCustomers = repeatCustomers,
        totalCustomers = totalCustomers,
        averageOrdersPerCustomer = averageOrdersPerCustomer
    )

    fun createPayoutInfo(
        pendingAmount: Double = 5000.0,
        completedAmount: Double = 10000.0,
        nextPayoutDate: String? = "2025-01-15"
    ) = PayoutInfo(
        pendingAmount = pendingAmount,
        completedAmount = completedAmount,
        nextPayoutDate = nextPayoutDate
    )

    fun createAnalyticsResponse(
        success: Boolean = true,
        analytics: AnalyticsData = createAnalyticsData(),
        customerInsights: CustomerInsights = createCustomerInsights(),
        payouts: PayoutInfo = createPayoutInfo()
    ) = AnalyticsResponse(
        success = success,
        data = AnalyticsResponseData(
            analytics = analytics,
            customerInsights = customerInsights,
            payouts = payouts
        )
    )

    // ==================== Mock Charge Models ====================

    fun createMockChargeRequest(
        amountCents: Int = 1000,
        currency: String = "INR",
        method: String = "card",
        reference: String? = "order-123"
    ) = MockChargeRequest(
        amountCents = amountCents,
        currency = currency,
        method = method,
        reference = reference
    )

    fun createMockChargeResponse(
        success: Boolean = true,
        paymentId: String = "payment-${UUID.randomUUID()}",
        status: String = "succeeded"
    ) = MockChargeResponse(
        success = success,
        data = MockChargeData(paymentId = paymentId, status = status)
    )
}
