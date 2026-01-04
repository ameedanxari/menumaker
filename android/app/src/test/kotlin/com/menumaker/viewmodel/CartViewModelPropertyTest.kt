package com.menumaker.viewmodel

import com.menumaker.data.local.entities.CartEntity
import com.menumaker.data.repository.CartRepository
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito.reset
import org.mockito.Mockito.verify
import org.mockito.MockitoAnnotations

/**
 * **Feature: android-test-coverage, Property 10: Cart Quantity Update**
 * **Validates: Requirements 8.2**
 *
 * Property: For any cart item, updating its quantity to a positive value SHALL update
 * the item, and updating to zero SHALL remove the item.
 */
@ExperimentalCoroutinesApi
class CartQuantityUpdatePropertyTest {

    @Mock
    private lateinit var cartRepository: CartRepository

    private lateinit var viewModel: CartViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)
        viewModel = CartViewModel(cartRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // Custom Arb for dish IDs
    private fun arbDishId(): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('0'..'9')
        "dish-" + (1..8).map { chars.random(rs.random) }.joinToString("")
    }

    // Custom Arb for business IDs
    private fun arbBusinessId(): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('0'..'9')
        "business-" + (1..8).map { chars.random(rs.random) }.joinToString("")
    }

    // Custom Arb for dish names
    private fun arbDishName(): Arb<String> = arbitrary { rs ->
        val names = listOf("Pizza", "Burger", "Pasta", "Salad", "Soup", "Steak", "Sushi", "Tacos")
        names.random(rs.random)
    }

    // Custom Arb for positive quantities (1-100)
    private fun arbPositiveQuantity(): Arb<Int> = Arb.int(1..100)

    // Custom Arb for prices in cents (100-10000)
    private fun arbPriceCents(): Arb<Int> = Arb.int(100..10000)

    private fun createCartItem(
        dishId: String,
        businessId: String,
        dishName: String,
        quantity: Int,
        priceCents: Int
    ) = CartEntity(
        dishId = dishId,
        businessId = businessId,
        dishName = dishName,
        quantity = quantity,
        priceCents = priceCents
    )

    @Test
    fun `property - updating quantity to positive value updates item`() = runTest {
        // Property: For any cart item and any positive quantity, updateQuantity SHALL
        // call repository.updateCartItem with the new quantity
        checkAll(
            iterations = 100,
            arbDishId(),
            arbBusinessId(),
            arbDishName(),
            arbPositiveQuantity(),  // initial quantity
            arbPositiveQuantity(),  // new quantity
            arbPriceCents()
        ) { dishId, businessId, dishName, initialQuantity, newQuantity, priceCents ->
            // Reset mock for each iteration
            reset(cartRepository)
            viewModel = CartViewModel(cartRepository)

            // Given - a cart item with initial quantity
            val cartItem = createCartItem(
                dishId = dishId,
                businessId = businessId,
                dishName = dishName,
                quantity = initialQuantity,
                priceCents = priceCents
            )

            // When - quantity is updated to a positive value
            viewModel.updateQuantity(cartItem, newQuantity)

            // Then - repository should be called with updated item
            val expectedItem = cartItem.copy(quantity = newQuantity)
            verify(cartRepository).updateCartItem(expectedItem)
        }
    }

    @Test
    fun `property - updating quantity to zero calls update with zero quantity`() = runTest {
        // Property: For any cart item, updating quantity to zero SHALL call
        // repository.updateCartItem with quantity 0 (repository handles removal)
        checkAll(
            iterations = 100,
            arbDishId(),
            arbBusinessId(),
            arbDishName(),
            arbPositiveQuantity(),  // initial quantity
            arbPriceCents()
        ) { dishId, businessId, dishName, initialQuantity, priceCents ->
            // Reset mock for each iteration
            reset(cartRepository)
            viewModel = CartViewModel(cartRepository)

            // Given - a cart item with positive quantity
            val cartItem = createCartItem(
                dishId = dishId,
                businessId = businessId,
                dishName = dishName,
                quantity = initialQuantity,
                priceCents = priceCents
            )

            // When - quantity is updated to zero
            viewModel.updateQuantity(cartItem, 0)

            // Then - repository should be called with quantity 0
            val expectedItem = cartItem.copy(quantity = 0)
            verify(cartRepository).updateCartItem(expectedItem)
        }
    }

    @Test
    fun `property - quantity update preserves other item properties`() = runTest {
        // Property: For any quantity update, all other item properties SHALL be preserved
        checkAll(
            iterations = 100,
            arbDishId(),
            arbBusinessId(),
            arbDishName(),
            arbPositiveQuantity(),
            arbPositiveQuantity(),
            arbPriceCents()
        ) { dishId, businessId, dishName, initialQuantity, newQuantity, priceCents ->
            // Reset mock for each iteration
            reset(cartRepository)
            viewModel = CartViewModel(cartRepository)

            // Given - a cart item with fixed addedAt to avoid timestamp comparison issues
            val fixedTimestamp = 1000L
            val cartItem = CartEntity(
                dishId = dishId,
                businessId = businessId,
                dishName = dishName,
                quantity = initialQuantity,
                priceCents = priceCents,
                addedAt = fixedTimestamp
            )

            // When - quantity is updated
            viewModel.updateQuantity(cartItem, newQuantity)

            // Then - all properties except quantity should be preserved
            val expectedItem = CartEntity(
                dishId = dishId,
                businessId = businessId,
                dishName = dishName,
                quantity = newQuantity,
                priceCents = priceCents,
                addedAt = fixedTimestamp
            )
            verify(cartRepository).updateCartItem(expectedItem)
        }
    }

    @Test
    fun `property - addToCart preserves all item properties`() = runTest {
        // Property: For any cart item added, all properties SHALL be preserved
        checkAll(
            iterations = 100,
            arbDishId(),
            arbBusinessId(),
            arbDishName(),
            arbPositiveQuantity(),
            arbPriceCents()
        ) { dishId, businessId, dishName, quantity, priceCents ->
            // Reset mock for each iteration
            reset(cartRepository)
            viewModel = CartViewModel(cartRepository)

            // Given - a cart item
            val cartItem = createCartItem(
                dishId = dishId,
                businessId = businessId,
                dishName = dishName,
                quantity = quantity,
                priceCents = priceCents
            )

            // When - item is added to cart
            viewModel.addToCart(cartItem)

            // Then - repository should be called with exact same item
            verify(cartRepository).addToCart(cartItem)
        }
    }

    @Test
    fun `property - removeItem uses correct dishId`() = runTest {
        // Property: For any dish removal, the correct dishId SHALL be passed to repository
        checkAll(
            iterations = 100,
            arbDishId()
        ) { dishId ->
            // Reset mock for each iteration
            reset(cartRepository)
            viewModel = CartViewModel(cartRepository)

            // When - item is removed
            viewModel.removeItem(dishId)

            // Then - repository should be called with exact dishId
            verify(cartRepository).removeFromCart(dishId)
        }
    }

    @Test
    fun `property - clearCart uses correct businessId`() = runTest {
        // Property: For any cart clear operation, the correct businessId SHALL be passed
        checkAll(
            iterations = 100,
            arbBusinessId()
        ) { businessId ->
            // Reset mock for each iteration
            reset(cartRepository)
            viewModel = CartViewModel(cartRepository)

            // When - cart is cleared
            viewModel.clearCart(businessId)

            // Then - repository should be called with exact businessId
            verify(cartRepository).clearCart(businessId)
        }
    }
}
