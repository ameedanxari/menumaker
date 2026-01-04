package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.local.db.dao.CartDao
import com.menumaker.data.local.entities.CartEntity
import com.menumaker.data.repository.CartRepositoryImpl
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.positiveInt
import io.kotest.property.checkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.Mockito
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/**
 * Unit tests for CartRepositoryImpl.
 * Tests getCartItems, addToCart, updateCartItem, removeFromCart, clearCart, and getCartTotal.
 *
 * Requirements: 4.3, 8.1, 8.2
 */
@OptIn(ExperimentalCoroutinesApi::class)
class CartRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var mockCartDao: CartDao
    private lateinit var repository: CartRepositoryImpl

    @Before
    fun setup() {
        mockCartDao = mock()
        repository = CartRepositoryImpl(mockCartDao)
    }

    // ==================== getCartItems Tests ====================

    @Test
    fun `getCartItems returns items from DAO`() = runTest {
        // Given
        val items = listOf(
            TestDataFactory.createCartEntity(dishId = "dish-1", quantity = 2, priceCents = 500),
            TestDataFactory.createCartEntity(dishId = "dish-2", quantity = 1, priceCents = 800)
        )
        whenever(mockCartDao.getCartItems("business-123")).thenReturn(flowOf(items))

        // When
        val result = repository.getCartItems("business-123").first()

        // Then
        assertThat(result).hasSize(2)
        assertThat(result[0].dishId).isEqualTo("dish-1")
        assertThat(result[1].dishId).isEqualTo("dish-2")
    }

    @Test
    fun `getCartItems returns empty list when cart is empty`() = runTest {
        // Given
        whenever(mockCartDao.getCartItems("business-123")).thenReturn(flowOf(emptyList()))

        // When
        val result = repository.getCartItems("business-123").first()

        // Then
        assertThat(result).isEmpty()
    }

    // ==================== getAllCartItems Tests ====================

    @Test
    fun `getAllCartItems returns all items from DAO`() = runTest {
        // Given
        val items = listOf(
            TestDataFactory.createCartEntity(dishId = "dish-1", businessId = "business-1"),
            TestDataFactory.createCartEntity(dishId = "dish-2", businessId = "business-2")
        )
        whenever(mockCartDao.getAllCartItems()).thenReturn(flowOf(items))

        // When
        val result = repository.getAllCartItems().first()

        // Then
        assertThat(result).hasSize(2)
    }

    // ==================== addToCart Tests ====================

    @Test
    fun `addToCart inserts item via DAO`() = runTest {
        // Given
        val item = TestDataFactory.createCartEntity(
            dishId = "dish-123",
            businessId = "business-123",
            quantity = 2,
            priceCents = 500
        )

        // When
        repository.addToCart(item)

        // Then
        verify(mockCartDao).insertCartItem(item)
    }

    // ==================== updateCartItem Tests ====================

    @Test
    fun `updateCartItem updates item via DAO`() = runTest {
        // Given
        val item = TestDataFactory.createCartEntity(
            dishId = "dish-123",
            quantity = 5,
            priceCents = 500
        )

        // When
        repository.updateCartItem(item)

        // Then
        verify(mockCartDao).updateCartItem(item)
    }

    // ==================== removeFromCart Tests ====================

    @Test
    fun `removeFromCart deletes item via DAO`() = runTest {
        // Given
        val dishId = "dish-123"

        // When
        repository.removeFromCart(dishId)

        // Then
        verify(mockCartDao).removeCartItem(dishId)
    }

    // ==================== clearCart Tests ====================

    @Test
    fun `clearCart removes all items for business via DAO`() = runTest {
        // Given
        val businessId = "business-123"

        // When
        repository.clearCart(businessId)

        // Then
        verify(mockCartDao).clearCart(businessId)
    }

    // ==================== getCartTotal Tests ====================

    @Test
    fun `getCartTotal calculates correct total`() = runTest {
        // Given
        val items = listOf(
            TestDataFactory.createCartEntity(dishId = "dish-1", quantity = 2, priceCents = 500),  // 1000
            TestDataFactory.createCartEntity(dishId = "dish-2", quantity = 3, priceCents = 300)   // 900
        )
        whenever(mockCartDao.getCartItems("business-123")).thenReturn(flowOf(items))

        // When
        val total = repository.getCartTotal("business-123").first()

        // Then
        assertThat(total).isEqualTo(1900)  // 1000 + 900
    }

    @Test
    fun `getCartTotal returns zero for empty cart`() = runTest {
        // Given
        whenever(mockCartDao.getCartItems("business-123")).thenReturn(flowOf(emptyList()))

        // When
        val total = repository.getCartTotal("business-123").first()

        // Then
        assertThat(total).isEqualTo(0)
    }

    @Test
    fun `getCartTotal handles single item correctly`() = runTest {
        // Given
        val items = listOf(
            TestDataFactory.createCartEntity(dishId = "dish-1", quantity = 4, priceCents = 250)
        )
        whenever(mockCartDao.getCartItems("business-123")).thenReturn(flowOf(items))

        // When
        val total = repository.getCartTotal("business-123").first()

        // Then
        assertThat(total).isEqualTo(1000)  // 4 * 250
    }
}


// ==================== Property-Based Tests ====================

/**
 * **Feature: android-test-coverage, Property 9: Cart Total Calculation**
 * **Validates: Requirements 4.3, 8.1**
 *
 * Property: For any combination of cart items with quantities and prices,
 * the cart total SHALL equal the sum of (quantity × price) for all items.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class CartTotalCalculationPropertyTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var mockCartDao: CartDao
    private lateinit var repository: CartRepositoryImpl

    @Before
    fun setup() {
        mockCartDao = mock()
        repository = CartRepositoryImpl(mockCartDao)
    }

    // Custom Arb for cart items
    private fun arbCartItem(): Arb<CartEntity> = arbitrary { rs ->
        val chars = ('a'..'z') + ('0'..'9')
        val dishId = (1..10).map { chars.random(rs.random) }.joinToString("")
        val businessId = (1..10).map { chars.random(rs.random) }.joinToString("")
        val dishName = (1..15).map { chars.random(rs.random) }.joinToString("")
        val quantity = (1..10).random(rs.random)
        val priceCents = (100..5000).random(rs.random)
        
        CartEntity(
            dishId = dishId,
            businessId = businessId,
            dishName = dishName,
            quantity = quantity,
            priceCents = priceCents
        )
    }

    // Custom Arb for list of cart items
    private fun arbCartItems(maxSize: Int = 10): Arb<List<CartEntity>> = arbitrary { rs ->
        val size = (0..maxSize).random(rs.random)
        (0 until size).map { arbCartItem().bind() }
    }

    @Test
    fun `property - cart total equals sum of quantity times price for all items`() = runTest {
        // Property: For any list of cart items, total = sum(quantity * price)
        checkAll(
            iterations = 100,
            arbCartItems(10)
        ) { items ->
            // Reset mock for each iteration
            Mockito.reset(mockCartDao)
            whenever(mockCartDao.getCartItems(any())).thenReturn(flowOf(items))

            // Calculate expected total manually
            val expectedTotal = items.sumOf { it.quantity * it.priceCents }

            // When
            val actualTotal = repository.getCartTotal("business-123").first()

            // Then - total should equal sum of (quantity * price)
            assertThat(actualTotal).isEqualTo(expectedTotal)
        }
    }

    @Test
    fun `property - empty cart always has zero total`() = runTest {
        // Property: Empty cart total is always 0
        checkAll(
            iterations = 50,
            Arb.int(0..100)  // Just to run multiple iterations
        ) { _ ->
            // Reset mock for each iteration
            Mockito.reset(mockCartDao)
            whenever(mockCartDao.getCartItems(any())).thenReturn(flowOf(emptyList()))

            // When
            val total = repository.getCartTotal("business-123").first()

            // Then - empty cart should have zero total
            assertThat(total).isEqualTo(0)
        }
    }

    @Test
    fun `property - single item cart total equals quantity times price`() = runTest {
        // Property: For single item, total = quantity * price
        checkAll(
            iterations = 100,
            Arb.positiveInt(100),  // quantity (1-100)
            Arb.positiveInt(10000) // priceCents (1-10000)
        ) { quantity, priceCents ->
            // Reset mock for each iteration
            Mockito.reset(mockCartDao)
            
            val item = TestDataFactory.createCartEntity(
                quantity = quantity,
                priceCents = priceCents
            )
            whenever(mockCartDao.getCartItems(any())).thenReturn(flowOf(listOf(item)))

            // When
            val total = repository.getCartTotal("business-123").first()

            // Then - total should equal quantity * price
            assertThat(total).isEqualTo(quantity * priceCents)
        }
    }

    @Test
    fun `property - adding item increases total by item value`() = runTest {
        // Property: Adding an item increases total by (quantity * price)
        checkAll(
            iterations = 100,
            arbCartItems(5),
            arbCartItem()
        ) { existingItems, newItem ->
            // Reset mock for each iteration
            Mockito.reset(mockCartDao)
            
            // Calculate totals
            val existingTotal = existingItems.sumOf { it.quantity * it.priceCents }
            val newItemValue = newItem.quantity * newItem.priceCents
            val expectedNewTotal = existingTotal + newItemValue
            
            // Setup mock with combined items
            val allItems = existingItems + newItem
            whenever(mockCartDao.getCartItems(any())).thenReturn(flowOf(allItems))

            // When
            val actualTotal = repository.getCartTotal("business-123").first()

            // Then - new total should equal old total + new item value
            assertThat(actualTotal).isEqualTo(expectedNewTotal)
        }
    }
}
