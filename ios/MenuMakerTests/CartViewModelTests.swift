//
//  CartViewModelTests.swift
//  MenuMakerTests
//
//  Unit tests for CartViewModel
//

import Foundation
import Testing
@testable import MenuMaker

@MainActor
struct CartViewModelTests {
    
    // MARK: - Add Item Tests
    
    @Test("Adding item to cart increases item count")
    func testAddItem() async {
        let viewModel = CartViewModel()
        let dish = Dish(
            id: "dish-1",
            businessId: "business-1",
            name: "Pizza",
            description: "Delicious pizza",
            price: 12.99,
            imageUrl: nil,
            category: "Main",
            isVegetarian: true,
            isAvailable: true,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        viewModel.addItem(dish, businessId: "business-1")
        
        #expect(viewModel.getItemCount() == 1)
        #expect(viewModel.contains(dish.id))
        #expect(viewModel.getQuantity(dish.id) == 1)
    }
    
    @Test("Adding same item twice increases quantity")
    func testAddSameItemTwice() async {
        let viewModel = CartViewModel()
        let dish = Dish(
            id: "dish-1",
            businessId: "business-1",
            name: "Pizza",
            description: nil,
            price: 12.99,
            imageUrl: nil,
            category: nil,
            isVegetarian: false,
            isAvailable: true,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        viewModel.addItem(dish, businessId: "business-1")
        viewModel.addItem(dish, businessId: "business-1")
        
        #expect(viewModel.getItemCount() == 1)
        #expect(viewModel.getQuantity(dish.id) == 2)
    }
    
    // MARK: - Remove Item Tests
    
    @Test("Removing item from cart decreases item count")
    func testRemoveItem() async {
        let viewModel = CartViewModel()
        let dish = Dish(
            id: "dish-1",
            businessId: "business-1",
            name: "Pizza",
            description: nil,
            price: 12.99,
            imageUrl: nil,
            category: nil,
            isVegetarian: false,
            isAvailable: true,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        viewModel.addItem(dish, businessId: "business-1")
        #expect(viewModel.getItemCount() == 1)
        
        viewModel.removeItem(dish.id)
        #expect(viewModel.getItemCount() == 0)
        #expect(!viewModel.contains(dish.id))
    }
    
    // MARK: - Quantity Management Tests
    
    @Test("Updating quantity changes item quantity")
    func testUpdateQuantity() async {
        let viewModel = CartViewModel()
        let dish = Dish(
            id: "dish-1",
            businessId: "business-1",
            name: "Pizza",
            description: nil,
            price: 12.99,
            imageUrl: nil,
            category: nil,
            isVegetarian: false,
            isAvailable: true,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        viewModel.addItem(dish, businessId: "business-1")
        viewModel.updateQuantity(dish.id, quantity: 5)
        
        #expect(viewModel.getQuantity(dish.id) == 5)
    }
    
    @Test("Incrementing quantity increases by 1")
    func testIncrementQuantity() async {
        let viewModel = CartViewModel()
        let dish = Dish(
            id: "dish-1",
            businessId: "business-1",
            name: "Pizza",
            description: nil,
            price: 12.99,
            imageUrl: nil,
            category: nil,
            isVegetarian: false,
            isAvailable: true,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        viewModel.addItem(dish, businessId: "business-1")
        let initialQuantity = viewModel.getQuantity(dish.id)
        
        viewModel.incrementQuantity(dish.id)
        
        #expect(viewModel.getQuantity(dish.id) == initialQuantity + 1)
    }
    
    @Test("Decrementing quantity decreases by 1")
    func testDecrementQuantity() async {
        let viewModel = CartViewModel()
        let dish = Dish(
            id: "dish-1",
            businessId: "business-1",
            name: "Pizza",
            description: nil,
            price: 12.99,
            imageUrl: nil,
            category: nil,
            isVegetarian: false,
            isAvailable: true,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        viewModel.addItem(dish, businessId: "business-1")
        viewModel.updateQuantity(dish.id, quantity: 3)
        
        viewModel.decrementQuantity(dish.id)
        
        #expect(viewModel.getQuantity(dish.id) == 2)
    }
    
    // MARK: - Clear Cart Tests
    
    @Test("Clearing cart removes all items")
    func testClearCart() async {
        let viewModel = CartViewModel()
        let dish1 = Dish(
            id: "dish-1",
            businessId: "business-1",
            name: "Pizza",
            description: nil,
            price: 12.99,
            imageUrl: nil,
            category: nil,
            isVegetarian: false,
            isAvailable: true,
            createdAt: Date(),
            updatedAt: Date()
        )
        let dish2 = Dish(
            id: "dish-2",
            businessId: "business-1",
            name: "Pasta",
            description: nil,
            price: 10.99,
            imageUrl: nil,
            category: nil,
            isVegetarian: false,
            isAvailable: true,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        viewModel.addItem(dish1, businessId: "business-1")
        viewModel.addItem(dish2, businessId: "business-1")
        #expect(viewModel.getItemCount() == 2)
        
        viewModel.clearCart()
        
        #expect(viewModel.getItemCount() == 0)
        #expect(viewModel.isEmpty())
        #expect(viewModel.appliedCoupon == nil)
        #expect(viewModel.discount == 0.0)
    }
    
    // MARK: - Total Calculation Tests
    
    @Test("Subtotal is calculated correctly")
    func testSubtotalCalculation() async {
        let viewModel = CartViewModel()
        let dish = Dish(
            id: "dish-1",
            businessId: "business-1",
            name: "Pizza",
            description: nil,
            price: 12.99,
            imageUrl: nil,
            category: nil,
            isVegetarian: false,
            isAvailable: true,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        viewModel.addItem(dish, businessId: "business-1")
        viewModel.updateQuantity(dish.id, quantity: 2)
        
        let expectedSubtotal = 12.99 * 2
        #expect(abs(viewModel.getSubtotal() - expectedSubtotal) < 0.01)
    }
    
    @Test("Total with discount is calculated correctly")
    func testTotalWithDiscount() async {
        let viewModel = CartViewModel()
        let dish = Dish(
            id: "dish-1",
            businessId: "business-1",
            name: "Pizza",
            description: nil,
            price: 10.00,
            imageUrl: nil,
            category: nil,
            isVegetarian: false,
            isAvailable: true,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        viewModel.addItem(dish, businessId: "business-1")
        viewModel.discount = 2.00
        
        let expectedTotal = 10.00 - 2.00
        #expect(abs(viewModel.getTotal() - expectedTotal) < 0.01)
    }
    
    // MARK: - Empty Cart Tests
    
    @Test("isEmpty returns true for empty cart")
    func testIsEmpty() async {
        let viewModel = CartViewModel()
        #expect(viewModel.isEmpty())
    }
    
    @Test("isEmpty returns false for non-empty cart")
    func testIsNotEmpty() async {
        let viewModel = CartViewModel()
        let dish = Dish(
            id: "dish-1",
            businessId: "business-1",
            name: "Pizza",
            description: nil,
            price: 12.99,
            imageUrl: nil,
            category: nil,
            isVegetarian: false,
            isAvailable: true,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        viewModel.addItem(dish, businessId: "business-1")
        #expect(!viewModel.isEmpty())
    }
    
    // MARK: - Error Handling Tests
    
    @Test("clearError clears error message")
    func testClearError() async {
        let viewModel = CartViewModel()
        viewModel.errorMessage = "Test error"
        
        viewModel.clearError()
        
        #expect(viewModel.errorMessage == nil)
    }
}
