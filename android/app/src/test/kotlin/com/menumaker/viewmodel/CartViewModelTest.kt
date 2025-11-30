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
}
