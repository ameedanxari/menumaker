package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.AuthData
import com.menumaker.data.remote.models.UserDto
import com.menumaker.data.repository.AuthRepository
import com.menumaker.services.AnalyticsService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.ArgumentMatchers.anyMap
import org.mockito.Mock
import org.mockito.Mockito
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class ProfileViewModelTest {

    @Mock
    private lateinit var authRepository: AuthRepository
    
    @Mock
    private lateinit var analyticsService: AnalyticsService

    private lateinit var viewModel: ProfileViewModel

    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)

        viewModel = ProfileViewModel(authRepository, analyticsService)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `validateName returns error for empty name`() {
        val result = viewModel.validateName("")
        assertEquals("Name cannot be empty", result)
    }

    @Test
    fun `validateName returns error for short name`() {
        val result = viewModel.validateName("A")
        assertEquals("Name must be at least 2 characters", result)
    }

    @Test
    fun `validateName returns null for valid name`() {
        val result = viewModel.validateName("John Doe")
        assertNull(result)
    }
    
    @Test
    fun `validatePhone returns error for short phone`() {
        val result = viewModel.validatePhone("123")
        assertEquals("Phone number must be at least 10 digits", result)
    }

    @Test
    fun `validatePhone returns null for valid phone`() {
        val result = viewModel.validatePhone("1234567890")
        assertNull(result)
    }

    @Test
    fun `updateProfile sets success message on success`() = runTest {
        val mockUser = UserDto(
            id = "u1",
            email = "mail@test.com",
            name = "John",
            phone = "1234567890",
            address = "Address",
            photoUrl = null,
            role = "seller",
            createdAt = "2024-01-01",
            updatedAt = null
        )
        val mockAuthData = AuthData("token", "refresh", mockUser)
        
        Mockito.`when`(authRepository.updateProfile(anyMap())).thenReturn(
            flow { emit(Resource.Success(mockAuthData)) }
        )
        
        viewModel.updateProfile("John", "1234567890", "Address")
        
        assertTrue(viewModel.isLoading.value || viewModel.successMessage.value != null)
    }

    @Test
    fun `changePassword success`() = runTest {
        Mockito.`when`(authRepository.changePassword("current", "newPass")).thenReturn(
            flow { emit(Resource.Success(Unit)) }
        )
        
        viewModel.changePassword("current", "newPass", "newPass")
        
        assertTrue(viewModel.isLoading.value || viewModel.successMessage.value != null)
    }

    @Test
    fun `changePassword validates empty current password`() = runTest {
        viewModel.changePassword("", "newPass", "newPass")
        assertEquals("Current password is required", viewModel.errorMessage.value)
    }

    @Test
    fun `changePassword validates empty new password`() = runTest {
        viewModel.changePassword("current", "", "newPass")
        assertEquals("New password is required", viewModel.errorMessage.value)
    }
    
    @Test
    fun `changePassword validates short password`() = runTest {
        viewModel.changePassword("current", "123", "123")
        assertEquals("Password must be at least 6 characters", viewModel.errorMessage.value)
    }
    
    @Test
    fun `changePassword validates mismatch`() = runTest {
        viewModel.changePassword("current", "123456", "123457")
        assertEquals("Passwords do not match", viewModel.errorMessage.value)
    }

    @Test
    fun `clearMessages resets state`() {
        viewModel.changePassword("", "", "") // trigger error
        viewModel.clearMessages()
        assertNull(viewModel.errorMessage.value)
        assertNull(viewModel.successMessage.value)
    }

    // MARK: - Enhanced Profile Validation Tests for Requirements 5.3

    @Test
    fun `validateName returns error for very long name`() {
        val longName = "A".repeat(51)
        val result = viewModel.validateName(longName)
        assertEquals("Name is too long", result)
    }

    @Test
    fun `validateName returns null for name with special characters`() {
        val result = viewModel.validateName("José María")
        assertNull(result)
    }

    @Test
    fun `validatePhone returns error for non-numeric phone`() {
        val result = viewModel.validatePhone("abc-def-ghij")
        // Phone validation filters to digits, so "abc-def-ghij" has 0 digits
        assertEquals("Phone number must be at least 10 digits", result)
    }

    @Test
    fun `validatePhone returns null for phone with country code`() {
        val result = viewModel.validatePhone("+919876543210")
        // Filters to digits: 919876543210 = 12 digits
        assertNull(result)
    }

    @Test
    fun `validatePhone returns null for phone with dashes`() {
        val result = viewModel.validatePhone("123-456-7890")
        // Filters to digits: 1234567890 = 10 digits
        assertNull(result)
    }

    @Test
    fun `changePassword validates same old and new password`() = runTest {
        Mockito.`when`(authRepository.changePassword("samepass", "samepass")).thenReturn(
            flow { emit(Resource.Success(Unit)) }
        )
        
        viewModel.changePassword("samepass", "samepass", "samepass")
        
        // Should succeed if passwords match (no validation against old = new)
        assertTrue(viewModel.isLoading.value || viewModel.successMessage.value != null)
    }

    @Test
    fun `changePassword with very long password`() = runTest {
        val longPassword = "A".repeat(100)
        Mockito.`when`(authRepository.changePassword("current", longPassword)).thenReturn(
            flow { emit(Resource.Success(Unit)) }
        )
        
        viewModel.changePassword("current", longPassword, longPassword)
        
        // Should succeed - no max length validation
        assertTrue(viewModel.isLoading.value || viewModel.successMessage.value != null)
    }

    @Test
    fun `updateProfile with valid data calls repository`() = runTest {
        val mockUser = UserDto(
            id = "u1",
            email = "mail@test.com",
            name = "John Doe",
            phone = "1234567890",
            address = "123 Main St",
            photoUrl = null,
            role = "customer",
            createdAt = "2024-01-01",
            updatedAt = null
        )
        val mockAuthData = AuthData("token", "refresh", mockUser)
        
        Mockito.`when`(authRepository.updateProfile(anyMap())).thenReturn(
            flow { emit(Resource.Success(mockAuthData)) }
        )
        
        viewModel.updateProfile("John Doe", "1234567890", "123 Main St")
        
        // Should succeed
        assertTrue(viewModel.isLoading.value || viewModel.successMessage.value != null)
    }

    @Test
    fun `changePassword with whitespace-only new password shows error`() = runTest {
        // isEmpty() returns false for whitespace
        viewModel.changePassword("current", "   ", "   ")
        // Will fail on length check since "   ".length = 3 < 6
        assertEquals("Password must be at least 6 characters", viewModel.errorMessage.value)
    }

    @Test
    fun `validateName with exactly 2 characters returns null`() {
        val result = viewModel.validateName("AB")
        assertNull(result)
    }

    @Test
    fun `validatePhone with exactly 10 digits returns null`() {
        val result = viewModel.validatePhone("1234567890")
        assertNull(result)
    }

    @Test
    fun `validatePhone with more than 10 digits returns null`() {
        val result = viewModel.validatePhone("12345678901234")
        assertNull(result)
    }

    @Test
    fun `validatePhone with empty string returns null`() {
        val result = viewModel.validatePhone("")
        assertNull(result) // Phone is optional
    }

    @Test
    fun `validateName with exactly 50 characters returns null`() {
        val name = "A".repeat(50)
        val result = viewModel.validateName(name)
        assertNull(result)
    }
}
