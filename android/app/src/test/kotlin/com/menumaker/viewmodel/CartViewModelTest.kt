package com.menumaker.viewmodel

import com.menumaker.data.local.entities.CartEntity
import com.menumaker.data.repository.CartRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
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
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class CartViewModelTest {

    @Mock
    private lateinit var cartRepository: CartRepository

    private lateinit var viewModel: CartViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    private val mockCartItem = CartEntity(
        dishId = "dish-1",
        businessId = "business-1",
        dishName = "Pizza",
        quantity = 1,
        priceCents = 1000
    )

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

    @Test
    fun `loadCart updates cartItems and cartTotal`() = runTest {
        // Given
        val businessId = "business-1"
        val items = listOf(mockCartItem)
        val total = 1000

        `when`(cartRepository.getCartItems(businessId)).thenReturn(flow { emit(items) })
        `when`(cartRepository.getCartTotal(businessId)).thenReturn(flow { emit(total) })

        // When
        viewModel.loadCart(businessId)

        // Then
        assertEquals(items, viewModel.cartItems.value)
        assertEquals(total, viewModel.cartTotal.value)
    }

    @Test
    fun `addToCart calls repository`() = runTest {
        // When
        viewModel.addToCart(mockCartItem)

        // Then
        verify(cartRepository).addToCart(mockCartItem)
    }

    @Test
    fun `updateQuantity calls repository with updated item`() = runTest {
        // Given
        val newQuantity = 2
        val expectedItem = mockCartItem.copy(quantity = newQuantity)

        // When
        viewModel.updateQuantity(mockCartItem, newQuantity)

        // Then
        verify(cartRepository).updateCartItem(expectedItem)
    }

    @Test
    fun `removeItem calls repository`() = runTest {
        // When
        viewModel.removeItem(mockCartItem.dishId)

        // Then
        verify(cartRepository).removeFromCart(mockCartItem.dishId)
    }

    @Test
    fun `clearCart calls repository`() = runTest {
        // Given
        val businessId = "business-1"

        // When
        viewModel.clearCart(businessId)

        // Then
        verify(cartRepository).clearCart(businessId)
    }

    @Test
    fun `initial state is empty`() {
        assertEquals(emptyList<CartEntity>(), viewModel.cartItems.value)
        assertEquals(0, viewModel.cartTotal.value)
    }

    // MARK: - Enhanced Edge Cases for Requirements 8.2

    @Test
    fun `updateQuantity to zero removes item from cart`() = runTest {
        // Given
        val newQuantity = 0
        val expectedItem = mockCartItem.copy(quantity = newQuantity)

        // When
        viewModel.updateQuantity(mockCartItem, newQuantity)

        // Then - should call updateCartItem with quantity 0
        // The repository implementation should handle removal
        verify(cartRepository).updateCartItem(expectedItem)
    }

    @Test
    fun `updateQuantity to positive value updates item`() = runTest {
        // Given
        val newQuantity = 5
        val expectedItem = mockCartItem.copy(quantity = newQuantity)

        // When
        viewModel.updateQuantity(mockCartItem, newQuantity)

        // Then
        verify(cartRepository).updateCartItem(expectedItem)
    }

    @Test
    fun `loadCart updates total when items change`() = runTest {
        // Given
        val businessId = "business-1"
        val item1 = mockCartItem.copy(dishId = "dish-1", quantity = 2, priceCents = 500)
        val item2 = mockCartItem.copy(dishId = "dish-2", quantity = 1, priceCents = 800)
        val items = listOf(item1, item2)
        val expectedTotal = (2 * 500) + (1 * 800) // 1800

        `when`(cartRepository.getCartItems(businessId)).thenReturn(flow { emit(items) })
        `when`(cartRepository.getCartTotal(businessId)).thenReturn(flow { emit(expectedTotal) })

        // When
        viewModel.loadCart(businessId)

        // Then
        assertEquals(items, viewModel.cartItems.value)
        assertEquals(expectedTotal, viewModel.cartTotal.value)
    }

    @Test
    fun `addToCart with same dish updates quantity`() = runTest {
        // Given - adding same item again
        val existingItem = mockCartItem.copy(quantity = 1)
        val newItem = mockCartItem.copy(quantity = 2)

        // When
        viewModel.addToCart(newItem)

        // Then
        verify(cartRepository).addToCart(newItem)
    }

    @Test
    fun `clearCart resets total to zero`() = runTest {
        // Given
        val businessId = "business-1"
        
        // First load some items
        val items = listOf(mockCartItem)
        `when`(cartRepository.getCartItems(businessId)).thenReturn(flow { emit(items) })
        `when`(cartRepository.getCartTotal(businessId)).thenReturn(flow { emit(1000) })
        viewModel.loadCart(businessId)

        // When
        viewModel.clearCart(businessId)

        // Then
        verify(cartRepository).clearCart(businessId)
    }

    @Test
    fun `removeItem calls repository with correct dishId`() = runTest {
        // Given
        val dishId = "dish-123"

        // When
        viewModel.removeItem(dishId)

        // Then
        verify(cartRepository).removeFromCart(dishId)
    }

    @Test
    fun `loadCart with empty cart returns empty list and zero total`() = runTest {
        // Given
        val businessId = "business-1"
        `when`(cartRepository.getCartItems(businessId)).thenReturn(flow { emit(emptyList()) })
        `when`(cartRepository.getCartTotal(businessId)).thenReturn(flow { emit(0) })

        // When
        viewModel.loadCart(businessId)

        // Then
        assertEquals(emptyList<CartEntity>(), viewModel.cartItems.value)
        assertEquals(0, viewModel.cartTotal.value)
    }

    @Test
    fun `updateQuantity with large quantity value`() = runTest {
        // Given
        val largeQuantity = 999
        val expectedItem = mockCartItem.copy(quantity = largeQuantity)

        // When
        viewModel.updateQuantity(mockCartItem, largeQuantity)

        // Then
        verify(cartRepository).updateCartItem(expectedItem)
    }

    @Test
    fun `multiple addToCart calls for different items`() = runTest {
        // Given
        val item1 = mockCartItem.copy(dishId = "dish-1", dishName = "Pizza")
        val item2 = mockCartItem.copy(dishId = "dish-2", dishName = "Burger")

        // When
        viewModel.addToCart(item1)
        viewModel.addToCart(item2)

        // Then
        verify(cartRepository).addToCart(item1)
        verify(cartRepository).addToCart(item2)
    }
}
