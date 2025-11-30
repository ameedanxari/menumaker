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
        let pendingOrder = Order(
            id: "order-1",
            businessId: "business-1",
            customerName: "John Doe",
            customerPhone: nil,
            customerEmail: nil,
            items: [],
            total: 25.00,
            status: "pending",
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        
        viewModel.orders = [pendingOrder]
        
        #expect(viewModel.pendingOrders.count == 1)
        #expect(viewModel.pendingOrders.first?.id == "order-1")
    }
    
    @Test("Active orders filter correctly")
    func testActiveOrders() async {
        let viewModel = OrderViewModel()
        let confirmedOrder = Order(
            id: "order-1",
            businessId: "business-1",
            customerName: "John Doe",
            customerPhone: nil,
            customerEmail: nil,
            items: [],
            total: 25.00,
            status: "confirmed",
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        let preparingOrder = Order(
            id: "order-2",
            businessId: "business-1",
            customerName: "Jane Doe",
            customerPhone: nil,
            customerEmail: nil,
            items: [],
            total: 30.00,
            status: "preparing",
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        
        viewModel.orders = [confirmedOrder, preparingOrder]
        
        #expect(viewModel.activeOrders.count == 2)
    }
    
    @Test("Completed orders filter correctly")
    func testCompletedOrders() async {
        let viewModel = OrderViewModel()
        let deliveredOrder = Order(
            id: "order-1",
            businessId: "business-1",
            customerName: "John Doe",
            customerPhone: nil,
            customerEmail: nil,
            items: [],
            total: 25.00,
            status: "delivered",
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        
        viewModel.orders = [deliveredOrder]
        
        #expect(viewModel.completedOrders.count == 1)
        #expect(viewModel.completedOrders.first?.id == "order-1")
    }
    
    @Test("Cancelled orders filter correctly")
    func testCancelledOrders() async {
        let viewModel = OrderViewModel()
        let cancelledOrder = Order(
            id: "order-1",
            businessId: "business-1",
            customerName: "John Doe",
            customerPhone: nil,
            customerEmail: nil,
            items: [],
            total: 25.00,
            status: "cancelled",
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        
        viewModel.orders = [cancelledOrder]
        
        #expect(viewModel.cancelledOrders.count == 1)
        #expect(viewModel.cancelledOrders.first?.id == "order-1")
    }
    
    // MARK: - Statistics Tests
    
    @Test("Get orders count for status returns correct count")
    func testGetOrdersCount() async {
        let viewModel = OrderViewModel()
        let pendingOrder1 = Order(
            id: "order-1",
            businessId: "business-1",
            customerName: "John Doe",
            customerPhone: nil,
            customerEmail: nil,
            items: [],
            total: 25.00,
            status: "pending",
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        let pendingOrder2 = Order(
            id: "order-2",
            businessId: "business-1",
            customerName: "Jane Doe",
            customerPhone: nil,
            customerEmail: nil,
            items: [],
            total: 30.00,
            status: "pending",
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        
        viewModel.orders = [pendingOrder1, pendingOrder2]
        
        #expect(viewModel.getOrdersCount(for: .pending) == 2)
    }
    
    @Test("Total revenue is calculated correctly")
    func testTotalRevenue() async {
        let viewModel = OrderViewModel()
        let order1 = Order(
            id: "order-1",
            businessId: "business-1",
            customerName: "John Doe",
            customerPhone: nil,
            customerEmail: nil,
            items: [],
            total: 25.00,
            status: "delivered",
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        let order2 = Order(
            id: "order-2",
            businessId: "business-1",
            customerName: "Jane Doe",
            customerPhone: nil,
            customerEmail: nil,
            items: [],
            total: 30.00,
            status: "delivered",
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        
        viewModel.orders = [order1, order2]
        
        let expectedRevenue = 25.00 + 30.00
        #expect(abs(viewModel.getTotalRevenue() - expectedRevenue) < 0.01)
    }
    
    @Test("Today orders filter correctly")
    func testTodayOrders() async {
        let viewModel = OrderViewModel()
        let todayOrder = Order(
            id: "order-1",
            businessId: "business-1",
            customerName: "John Doe",
            customerPhone: nil,
            customerEmail: nil,
            items: [],
            total: 25.00,
            status: "pending",
            createdAt: ISO8601DateFormatter().string(from: Date()),
            updatedAt: ISO8601DateFormatter().string(from: Date())
        )
        
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
