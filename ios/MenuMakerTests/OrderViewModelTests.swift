//
//  OrderViewModelTests.swift
//  MenuMakerTests
//
//  Unit tests for OrderViewModel
//

import Foundation
import Testing
@testable import MenuMaker

@MainActor
struct OrderViewModelTests {
    
    // MARK: - Filter Tests
    
    @Test("Filtering by status updates selectedStatus")
    func testFilterByStatus() async {
        let viewModel = OrderViewModel()
        
        viewModel.filterByStatus(.pending)
        
        #expect(viewModel.selectedStatus == .pending)
    }
    
    @Test("Clear filters resets status and search query")
    func testClearFilters() async {
        let viewModel = OrderViewModel()
        viewModel.selectedStatus = .confirmed
        viewModel.searchQuery = "test"
        
        viewModel.clearFilters()
        
        #expect(viewModel.selectedStatus == nil)
        #expect(viewModel.searchQuery == "")
    }
    
    // MARK: - Order Categorization Tests
    
    @Test("Pending orders filter correctly")
    func testPendingOrders() async {
        let viewModel = OrderViewModel()
        let orders = loadOrdersFixture()
        let pendingOrder = orders.first!
        
        viewModel.orders = [pendingOrder]
        
        #expect(viewModel.pendingOrders.count == 1)
        #expect(viewModel.pendingOrders.first?.id == "order-1")
    }
    
    @Test("Active orders filter correctly")
    func testActiveOrders() async {
        let viewModel = OrderViewModel()
        let orders = loadOrdersFixture()
        let confirmedOrder = orders.first!.withStatus("confirmed")
        let preparingOrder = orders.last!.withStatus("preparing")
        
        viewModel.orders = [confirmedOrder, preparingOrder]
        
        #expect(viewModel.activeOrders.count == 2)
    }
    
    @Test("Completed orders filter correctly")
    func testCompletedOrders() async {
        let viewModel = OrderViewModel()
        let deliveredOrder = loadOrdersFixture().first!
            .withStatus("delivered")
        
        viewModel.orders = [deliveredOrder]
        
        #expect(viewModel.completedOrders.count == 1)
        #expect(viewModel.completedOrders.first?.id == "order-1")
    }
    
    @Test("Cancelled orders filter correctly")
    func testCancelledOrders() async {
        let viewModel = OrderViewModel()
        let cancelledOrder = loadOrdersFixture().first!
            .withStatus("cancelled")
        
        viewModel.orders = [cancelledOrder]
        
        #expect(viewModel.cancelledOrders.count == 1)
        #expect(viewModel.cancelledOrders.first?.id == "order-1")
    }
    
    // MARK: - Statistics Tests
    
    @Test("Get orders count for status returns correct count")
    func testGetOrdersCount() async {
        let viewModel = OrderViewModel()
        let orders = loadOrdersFixture()
        let pendingOrder1 = orders.first!
        let pendingOrder2 = orders.last!.copy(id: "order-2", totalCents: 3000, status: "pending")
        
        viewModel.orders = [pendingOrder1, pendingOrder2]
        
        #expect(viewModel.getOrdersCount(for: .pending) == 2)
    }
    
    @Test("Total revenue is calculated correctly")
    func testTotalRevenue() async {
        let viewModel = OrderViewModel()
        let orders = loadOrdersFixture()
        let order1 = orders.first!.withStatus("delivered")
        let order2 = orders.last!.copy(id: "order-2", totalCents: 3000, status: "delivered")
        
        viewModel.orders = [order1, order2]
        
        let expectedRevenue = order1.total + order2.total
        #expect(abs(viewModel.getTotalRevenue() - expectedRevenue) < 0.01)
    }
    
    @Test("Today orders filter correctly")
    func testTodayOrders() async {
        let viewModel = OrderViewModel()
        var todayOrder = loadOrdersFixture().first!
        todayOrder = todayOrder.copy(createdAt: ISO8601DateFormatter().string(from: Date()))
        
        viewModel.orders = [todayOrder]
        
        #expect(viewModel.getTodayOrders().count == 1)
    }
    
    // MARK: - Error Handling Tests
    
    @Test("clearError clears error message")
    func testClearError() async {
        let viewModel = OrderViewModel()
        viewModel.errorMessage = "Test error"
        
        viewModel.clearError()
        
        #expect(viewModel.errorMessage == nil)
    }
    
    // MARK: - Initial State Tests
    
    @Test("Initial state is correct")
    func testInitialState() async {
        let viewModel = OrderViewModel()
        
        #expect(viewModel.selectedStatus == nil)
        #expect(viewModel.searchQuery == "")
        #expect(viewModel.isLoading == false)
        #expect(viewModel.errorMessage == nil)
    }
}

// MARK: - Helper

private func loadOrdersFixture() -> [Order] {
    try! TestFixtureLoader
        .load(["orders", "200.json"], as: OrderListResponse.self)
        .data.orders
}

private extension Order {
    func withStatus(_ newStatus: String) -> Order {
        copy(status: newStatus)
    }

    func copy(
        id: String? = nil,
        businessId: String? = nil,
        customerName: String? = nil,
        customerPhone: String?? = nil,
        customerEmail: String?? = nil,
        totalCents: Int? = nil,
        status: String? = nil,
        items: [OrderItem]? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        deliveryAddress: String?? = nil,
        estimatedDeliveryTime: String?? = nil,
        deliveryPersonName: String?? = nil,
        deliveryPersonPhone: String?? = nil,
        deliveryFeeCents: Int?? = nil
    ) -> Order {
        Order(
            id: id ?? self.id,
            businessId: businessId ?? self.businessId,
            customerName: customerName ?? self.customerName,
            customerPhone: customerPhone ?? self.customerPhone,
            customerEmail: customerEmail ?? self.customerEmail,
            totalCents: totalCents ?? self.totalCents,
            status: status ?? self.status,
            items: items ?? self.items,
            createdAt: createdAt ?? self.createdAt,
            updatedAt: updatedAt ?? self.updatedAt,
            deliveryAddress: deliveryAddress ?? self.deliveryAddress,
            estimatedDeliveryTime: estimatedDeliveryTime ?? self.estimatedDeliveryTime,
            deliveryPersonName: deliveryPersonName ?? self.deliveryPersonName,
            deliveryPersonPhone: deliveryPersonPhone ?? self.deliveryPersonPhone,
            deliveryFeeCents: deliveryFeeCents ?? self.deliveryFeeCents
        )
    }
}
