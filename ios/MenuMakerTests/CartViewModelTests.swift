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
        let viewModel = makeViewModel()
        let dish = try! TestFixtureLoader
            .load(["dishes", "200.json"], as: DishListResponse.self)
            .data.dishes.first!
        
        viewModel.addItem(dish, businessId: dish.businessId)
        
        #expect(viewModel.getItemCount() == 1)
        #expect(viewModel.contains(dish.id))
        #expect(viewModel.getQuantity(dish.id) == 1)
    }
    
    @Test("Adding same item twice increases quantity")
    func testAddSameItemTwice() async {
        let viewModel = makeViewModel()
        let dish = makeDish(id: "dish-1", priceCents: 1299)
        
        viewModel.addItem(dish, businessId: "business-1")
        viewModel.addItem(dish, businessId: "business-1")
        
        #expect(viewModel.getItemCount() == 2)
        #expect(viewModel.getQuantity(dish.id) == 2)
    }
    
    // MARK: - Remove Item Tests
    
    @Test("Removing item from cart decreases item count")
    func testRemoveItem() async {
        let viewModel = makeViewModel()
        let dish = makeDish(id: "dish-1", priceCents: 1299)
        
        viewModel.addItem(dish, businessId: "business-1")
        #expect(viewModel.getItemCount() == 1)
        
        viewModel.removeItem(dish.id)
        #expect(viewModel.getItemCount() == 0)
        #expect(!viewModel.contains(dish.id))
    }
    
    // MARK: - Quantity Management Tests
    
    @Test("Updating quantity changes item quantity")
    func testUpdateQuantity() async {
        let viewModel = makeViewModel()
        let dish = makeDish(id: "dish-1", priceCents: 1299)
        
        viewModel.addItem(dish, businessId: "business-1")
        viewModel.updateQuantity(dish.id, quantity: 5)
        
        #expect(viewModel.getQuantity(dish.id) == 5)
    }
    
    @Test("Incrementing quantity increases by 1")
    func testIncrementQuantity() async {
        let viewModel = makeViewModel()
        let dish = makeDish(id: "dish-1", priceCents: 1299)
        
        viewModel.addItem(dish, businessId: "business-1")
        let initialQuantity = viewModel.getQuantity(dish.id)
        
        viewModel.incrementQuantity(dish.id)
        
        #expect(viewModel.getQuantity(dish.id) == initialQuantity + 1)
    }
    
    @Test("Decrementing quantity decreases by 1")
    func testDecrementQuantity() async {
        let viewModel = makeViewModel()
        let dish = try! TestFixtureLoader
            .load(["dishes", "200.json"], as: DishListResponse.self)
            .data.dishes.first!
        
        viewModel.addItem(dish, businessId: "business-1")
        viewModel.updateQuantity(dish.id, quantity: 3)
        
        viewModel.decrementQuantity(dish.id)
        
        #expect(viewModel.getQuantity(dish.id) == 2)
    }
    
    // MARK: - Clear Cart Tests
    
    @Test("Clearing cart removes all items")
    func testClearCart() async {
        let viewModel = makeViewModel()
        let dishes = try! TestFixtureLoader
            .load(["dishes", "200.json"], as: DishListResponse.self)
            .data.dishes
        let dish1 = dishes[0]
        let dish2 = dishes[1]
        
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
        let viewModel = makeViewModel()
        let dish = try! TestFixtureLoader
            .load(["dishes", "200.json"], as: DishListResponse.self)
            .data.dishes.first!
        
        viewModel.addItem(dish, businessId: "business-1")
        viewModel.updateQuantity(dish.id, quantity: 2)
        
        let expectedSubtotal = dish.price * 2
        #expect(abs(viewModel.getSubtotal() - expectedSubtotal) < 0.01)
    }
    
    @Test("Total with discount is calculated correctly")
    func testTotalWithDiscount() async {
        let viewModel = makeViewModel()
        let dish = try! TestFixtureLoader
            .load(["dishes", "200.json"], as: DishListResponse.self)
            .data.dishes.first!
        
        viewModel.addItem(dish, businessId: "business-1")
        viewModel.discount = 2.00
        
        let expectedTotal = dish.price - 2.00
        #expect(abs(viewModel.getTotal() - expectedTotal) < 0.01)
    }
    
    // MARK: - Empty Cart Tests
    
    @Test("isEmpty returns true for empty cart")
    func testIsEmpty() async {
        let viewModel = makeViewModel()
        #expect(viewModel.isEmpty())
    }
    
    @Test("isEmpty returns false for non-empty cart")
    func testIsNotEmpty() async {
        let viewModel = makeViewModel()
        let dish = makeDish(id: "dish-1", priceCents: 1299)
        
        viewModel.addItem(dish, businessId: "business-1")
        #expect(!viewModel.isEmpty())
    }
    
    // MARK: - Error Handling Tests
    
    @Test("clearError clears error message")
    func testClearError() async {
        let viewModel = makeViewModel()
        viewModel.errorMessage = "Test error"
        
        viewModel.clearError()
        
        #expect(viewModel.errorMessage == nil)
    }
    
    // MARK: - Helpers
    
    private func makeDish(
        id: String,
        name: String = "Pizza",
        businessId: String = "business-1",
        description: String? = nil,
        priceCents: Int = 1299,
        imageUrl: String? = nil,
        category: String? = nil,
        isVegetarian: Bool = false,
        isAvailable: Bool = true,
        createdAt: String = "2024-01-01T00:00:00Z",
        updatedAt: String = "2024-01-01T00:00:00Z"
    ) -> Dish {
        Dish(
            id: id,
            businessId: businessId,
            name: name,
            description: description,
            priceCents: priceCents,
            imageUrl: imageUrl,
            category: category,
            isVegetarian: isVegetarian,
            isAvailable: isAvailable,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    private func makeViewModel() -> CartViewModel {
        CartRepository.shared.clearCart()
        return CartViewModel()
    }
}
