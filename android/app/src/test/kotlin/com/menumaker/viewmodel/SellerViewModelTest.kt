package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.AnalyticsData
import com.menumaker.data.remote.models.AnalyticsResponseData
import com.menumaker.data.remote.models.BusinessDto
import com.menumaker.data.remote.models.CustomerInsights
import com.menumaker.data.remote.models.DishDto
import com.menumaker.data.remote.models.ExportFormat
import com.menumaker.data.remote.models.OrderDto
import com.menumaker.data.remote.models.PayoutInfo
import com.menumaker.data.remote.models.ReviewDto
import com.menumaker.data.remote.models.ReviewListData
import com.menumaker.data.remote.models.TimePeriod
import com.menumaker.data.repository.BusinessRepository
import com.menumaker.data.repository.DishRepository
import com.menumaker.data.repository.OrderRepository
import com.menumaker.data.repository.ReviewRepository
import com.menumaker.services.AnalyticsService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.any
import org.mockito.kotlin.verify

@ExperimentalCoroutinesApi
class SellerViewModelTest {

    @Mock private lateinit var businessRepository: BusinessRepository
    @Mock private lateinit var orderRepository: OrderRepository
    @Mock private lateinit var dishRepository: DishRepository
    @Mock private lateinit var reviewRepository: ReviewRepository
    @Mock private lateinit var analyticsService: AnalyticsService

    private val testDispatcher = UnconfinedTestDispatcher()
    private val business = BusinessDto("b1", "Seller", "seller", null, null, "owner", true, "", "")

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadDashboardData emits content from repositories`() = runTest {
        stubDashboard(
            orders = listOf(order("o1", totalCents = 2500, status = "pending")),
            dishes = listOf(dish("d1", isAvailable = true)),
            reviews = listOf(review("r1", rating = 5))
        )

        val viewModel = createViewModel()

        assertEquals(SellerDashboardStatus.Content, viewModel.dashboardState.value.status)
        assertEquals(25.0, viewModel.todayRevenue.value, 0.0)
        assertEquals(1, viewModel.pendingOrders.value)
        assertEquals(1, viewModel.getAvailableDishes())
        assertEquals(5.0, viewModel.getAverageRating(), 0.0)
    }

    @Test
    fun `loadDashboardData emits empty state without sample data`() = runTest {
        stubDashboard()

        val viewModel = createViewModel()

        assertEquals(SellerDashboardStatus.Empty, viewModel.dashboardState.value.status)
        assertTrue(viewModel.todayOrders.value.isEmpty())
        assertTrue(viewModel.dishes.value.isEmpty())
        assertTrue(viewModel.recentReviews.value.isEmpty())
    }

    @Test
    fun `loadDashboardData emits partial error with successful sections retained`() = runTest {
        stubDashboard(
            orders = listOf(order("o1")),
            dishResource = Resource.Error("Dishes unavailable"),
            reviews = listOf(review("r1", rating = 4))
        )

        val viewModel = createViewModel()

        assertEquals(SellerDashboardStatus.PartialError, viewModel.dashboardState.value.status)
        assertEquals(listOf("orders"), viewModel.todayOrders.value.map { "orders" })
        assertEquals("dishes", viewModel.dashboardState.value.sectionErrors.single().source)
    }

    @Test
    fun `loadDashboardData emits stale offline when cached section is followed by error`() = runTest {
        `when`(businessRepository.getBusinesses()).thenReturn(flowOf(Resource.Success(listOf(business))))
        `when`(orderRepository.getOrdersByBusiness("b1")).thenReturn(
            flowOf(
                Resource.Success(listOf(order("cached-order"))),
                Resource.Error("Network offline")
            )
        )
        `when`(dishRepository.getDishesByBusiness("b1")).thenReturn(flowOf(Resource.Success(emptyList())))
        `when`(reviewRepository.getReviews("b1")).thenReturn(flowOf(Resource.Success(ReviewListData(emptyList(), 0.0, 0))))
        `when`(businessRepository.getAnalytics("b1", "today")).thenReturn(flowOf(Resource.Success(analyticsResponse(totalRevenue = 12.0))))

        val viewModel = createViewModel()

        assertEquals(SellerDashboardStatus.StaleOffline, viewModel.dashboardState.value.status)
        assertEquals("cached-order", viewModel.todayOrders.value.single().id)
        assertEquals("orders", viewModel.dashboardState.value.sectionErrors.single().source)
    }

    @Test
    fun `loadAnalytics updates state on success`() = runTest {
        stubDashboard()
        val viewModel = createViewModel()
        `when`(businessRepository.getAnalytics("b1", "today")).thenReturn(flowOf(Resource.Success(analyticsResponse(totalRevenue = 100.0))))

        viewModel.loadAnalytics(TimePeriod.TODAY)

        assertEquals(100.0, viewModel.analyticsData.value?.totalRevenue)
    }

    @Test
    fun `exportAnalytics calls repository`() = runTest {
        stubDashboard()
        val viewModel = createViewModel()
        `when`(businessRepository.exportAnalytics(any())).thenReturn(flowOf(Resource.Success(Unit)))

        viewModel.exportAnalytics(ExportFormat.PDF)

        verify(businessRepository).exportAnalytics(any())
    }

    private fun createViewModel() = SellerViewModel(
        businessRepository,
        orderRepository,
        dishRepository,
        reviewRepository,
        analyticsService
    )

    private fun stubDashboard(
        orders: List<OrderDto> = emptyList(),
        dishes: List<DishDto> = emptyList(),
        reviews: List<ReviewDto> = emptyList(),
        dishResource: Resource<List<DishDto>> = Resource.Success(dishes)
    ) {
        `when`(businessRepository.getBusinesses()).thenReturn(flowOf(Resource.Success(listOf(business))))
        `when`(orderRepository.getOrdersByBusiness("b1")).thenReturn(flowOf(Resource.Success(orders)))
        `when`(dishRepository.getDishesByBusiness("b1")).thenReturn(flowOf(dishResource))
        `when`(reviewRepository.getReviews("b1")).thenReturn(flowOf(Resource.Success(ReviewListData(reviews, reviews.map { it.rating }.averageOrZero(), reviews.size))))
        `when`(businessRepository.getAnalytics("b1", "today")).thenReturn(
            flowOf(Resource.Success(analyticsResponse(totalRevenue = orders.sumOf { it.totalCents } / 100.0)))
        )
    }

    private fun order(id: String, totalCents: Int = 1000, status: String = "pending") = OrderDto(
        id = id,
        businessId = "b1",
        customerName = "Customer",
        customerPhone = null,
        customerEmail = null,
        totalCents = totalCents,
        status = status,
        items = emptyList(),
        createdAt = "",
        updatedAt = ""
    )

    private fun dish(id: String, isAvailable: Boolean = true) = DishDto(
        id = id,
        businessId = "b1",
        name = "Dish",
        description = null,
        priceCents = 1000,
        imageUrl = null,
        category = null,
        isVegetarian = true,
        isAvailable = isAvailable,
        createdAt = "",
        updatedAt = ""
    )

    private fun review(id: String, rating: Int) = ReviewDto(
        id = id,
        businessId = "b1",
        customerName = "Reviewer",
        rating = rating,
        comment = null,
        imageUrls = emptyList(),
        createdAt = ""
    )

    private fun analyticsResponse(totalRevenue: Double = 0.0) = AnalyticsResponseData(
        analytics = AnalyticsData(
            totalSales = totalRevenue,
            totalOrders = 0,
            totalRevenue = totalRevenue,
            averageOrderValue = 0.0,
            newCustomers = 0,
            repeatCustomers = 0,
            popularItems = emptyList(),
            salesData = emptyList(),
            peakHours = emptyList()
        ),
        customerInsights = CustomerInsights(0, 0, 0, 0.0),
        payouts = PayoutInfo(0.0, 0.0, null)
    )

    private fun List<Int>.averageOrZero(): Double = if (isEmpty()) 0.0 else average()
}
