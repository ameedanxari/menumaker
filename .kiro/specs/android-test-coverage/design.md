# Design Document: Android Test Coverage

## Overview

This design document outlines the comprehensive testing strategy for the MenuMaker Android application to achieve production-ready test coverage. The testing approach follows a layered architecture with unit tests for repositories and ViewModels, and UI tests for screen interactions. All tests use mocked dependencies to ensure deterministic, network-independent execution.

## Architecture

### Testing Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     UI Tests (Compose)                       │
│  - Screen rendering tests                                    │
│  - Navigation tests                                          │
│  - User interaction tests                                    │
│  - Uses HiltAndroidTest with mocked repositories             │
├─────────────────────────────────────────────────────────────┤
│                   ViewModel Unit Tests                       │
│  - State management tests                                    │
│  - Input validation tests                                    │
│  - Error handling tests                                      │
│  - Uses mocked repositories + UnconfinedTestDispatcher       │
├─────────────────────────────────────────────────────────────┤
│                  Repository Unit Tests                       │
│  - API response handling tests                               │
│  - Cache operations tests                                    │
│  - Error propagation tests                                   │
│  - Uses mocked ApiService + mocked DAOs                      │
├─────────────────────────────────────────────────────────────┤
│                    Model/Utility Tests                       │
│  - Data transformation tests                                 │
│  - Validation logic tests                                    │
│  - Formatter tests                                           │
└─────────────────────────────────────────────────────────────┘
```

### Test Directory Structure

```
android/app/src/
├── test/kotlin/com/menumaker/
│   ├── viewmodel/           # ViewModel unit tests (existing)
│   ├── repository/          # Repository unit tests (NEW)
│   ├── data/                # Model and utility tests
│   └── testutils/           # Shared test utilities
└── androidTest/kotlin/com/menumaker/
    ├── ui/                  # UI flow tests (existing)
    ├── pageobjects/         # Page object pattern (existing)
    ├── di/                  # Hilt test modules (NEW)
    └── fakes/               # Fake implementations (NEW)
```

## Components and Interfaces

### Test Utilities Module

```kotlin
// TestDispatcherRule.kt - Coroutine test rule
class TestDispatcherRule(
    val testDispatcher: TestDispatcher = UnconfinedTestDispatcher()
) : TestWatcher() {
    override fun starting(description: Description) {
        Dispatchers.setMain(testDispatcher)
    }
    override fun finished(description: Description) {
        Dispatchers.resetMain()
    }
}

// FakeApiService.kt - Configurable fake API
class FakeApiService : ApiService {
    var loginResponse: Response<AuthResponse>? = null
    var ordersResponse: Response<OrderListResponse>? = null
    // ... configurable responses for all endpoints
}

// FakeTokenDataStore.kt - In-memory token storage
class FakeTokenDataStore : TokenDataStore {
    private var accessToken: String? = null
    private var refreshToken: String? = null
    // ... in-memory implementation
}
```

### Hilt Test Modules

```kotlin
// FakeRepositoryModule.kt
@Module
@TestInstallIn(
    components = [SingletonComponent::class],
    replaces = [RepositoryModule::class]
)
object FakeRepositoryModule {
    @Provides
    @Singleton
    fun provideAuthRepository(): AuthRepository = FakeAuthRepository()
    
    @Provides
    @Singleton
    fun provideOrderRepository(): OrderRepository = FakeOrderRepository()
    // ... fake implementations for all repositories
}
```

## Data Models

### Test Data Factories

```kotlin
// TestDataFactory.kt
object TestDataFactory {
    fun createUser(
        id: String = "user-${UUID.randomUUID()}",
        email: String = "test@example.com",
        name: String = "Test User",
        role: String = "customer"
    ) = UserDto(id, email, name, null, null, null, role, "2025-01-01T00:00:00Z", null)
    
    fun createOrder(
        id: String = "order-${UUID.randomUUID()}",
        status: String = "pending",
        totalCents: Int = 1000
    ) = OrderDto(id, "business-1", "Customer", "+1234567890", "test@example.com", 
                 totalCents, status, emptyList(), "2025-01-01T00:00:00Z", null)
    
    fun createDish(
        id: String = "dish-${UUID.randomUUID()}",
        name: String = "Test Dish",
        priceCents: Int = 500
    ) = DishDto(id, "menu-1", name, "Description", priceCents, null, true, 0)
    
    fun createCartItem(
        dishId: String = "dish-1",
        quantity: Int = 1,
        priceCents: Int = 500
    ) = CartEntity(dishId, "business-1", "Test Dish", quantity, priceCents)
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Repository Success Response Handling
*For any* repository method and valid API response, calling the method SHALL emit Resource.Loading followed by Resource.Success containing the expected data.
**Validates: Requirements 1.1, 1.3**

### Property 2: Repository Error Response Handling
*For any* repository method and API error response, calling the method SHALL emit Resource.Loading followed by Resource.Error with the error message.
**Validates: Requirements 1.2, 1.3**

### Property 3: Repository Cache Round-Trip
*For any* data written to the local cache via a repository, reading from the cache SHALL return equivalent data.
**Validates: Requirements 1.5**

### Property 4: ViewModel Error State Preservation
*For any* ViewModel that has successfully loaded data, receiving an error response SHALL update error state while preserving the previously loaded valid data.
**Validates: Requirements 2.1**

### Property 5: ViewModel Input Validation
*For any* invalid input (empty required fields, malformed email, weak password), the ViewModel SHALL reject the input and set an appropriate error message.
**Validates: Requirements 2.3, 5.3**

### Property 6: Order Status Transitions
*For any* order, updating its status SHALL result in the new status being reflected in the order detail state.
**Validates: Requirements 3.2**

### Property 7: Menu Item CRUD Operations
*For any* menu item, creating, updating, or deleting SHALL result in the corresponding change being reflected in the menu list.
**Validates: Requirements 3.3**

### Property 8: Marketplace Search Filtering
*For any* search query on the marketplace, the returned results SHALL only contain restaurants matching the search criteria.
**Validates: Requirements 4.1**

### Property 9: Cart Total Calculation
*For any* combination of cart items with quantities and prices, the cart total SHALL equal the sum of (quantity × price) for all items.
**Validates: Requirements 4.3, 8.1**

### Property 10: Cart Quantity Update
*For any* cart item, updating its quantity to a positive value SHALL update the item, and updating to zero SHALL remove the item.
**Validates: Requirements 8.2**

### Property 11: Order Status Display
*For any* order with a given status, the order tracking screen SHALL display the correct status indicator.
**Validates: Requirements 4.5**

### Property 12: Favorites Toggle
*For any* restaurant, adding to favorites then removing SHALL result in the restaurant not being in favorites.
**Validates: Requirements 4.6**

### Property 13: Authentication Token Storage
*For any* successful login, the access token and refresh token SHALL be stored and retrievable.
**Validates: Requirements 5.1**

### Property 14: Authentication Error Handling
*For any* invalid login credentials, the login state SHALL be Resource.Error and no tokens SHALL be stored.
**Validates: Requirements 5.2**

### Property 15: Logout Token Clearing
*For any* logged-in user, calling logout SHALL clear all stored tokens.
**Validates: Requirements 5.4**

### Property 16: Offline Cache Serving
*For any* cached data and network failure, the repository SHALL return the cached data.
**Validates: Requirements 6.1**

### Property 17: Cache-First Data Loading
*For any* repository with cached data, the flow SHALL emit cached data before network data.
**Validates: Requirements 6.3**

### Property 18: Navigation Correctness
*For any* navigation action, the resulting destination SHALL match the expected route.
**Validates: Requirements 7.2**

### Property 19: Form Validation Feedback
*For any* form with invalid input, submitting SHALL display validation error messages.
**Validates: Requirements 7.3**

### Property 20: Coupon Discount Application
*For any* valid coupon code and cart total, applying the coupon SHALL reduce the total by the correct discount amount.
**Validates: Requirements 8.3**

### Property 21: Checkout Validation
*For any* checkout attempt with missing required fields, the checkout SHALL be blocked with validation errors.
**Validates: Requirements 8.4**

### Property 22: Notification Count Update
*For any* notification marked as read, the unread count SHALL decrease by one.
**Validates: Requirements 9.1, 9.2**

### Property 23: Payment Validation
*For any* invalid payment details (invalid card number, expired date, invalid CVV), validation SHALL fail with appropriate error.
**Validates: Requirements 10.2**

### Property 24: Referral Code Validation
*For any* referral code, applying it SHALL either succeed with benefits or fail with validation error.
**Validates: Requirements 11.2**

## Error Handling

### Test Error Scenarios

| Scenario | Expected Behavior | Test Approach |
|----------|-------------------|---------------|
| Network timeout | Resource.Error with timeout message | Mock delayed response |
| HTTP 401 Unauthorized | Clear tokens, redirect to login | Mock 401 response |
| HTTP 404 Not Found | Resource.Error with not found message | Mock 404 response |
| HTTP 500 Server Error | Resource.Error with server error message | Mock 500 response |
| Malformed JSON | Resource.Error with parse error | Mock invalid JSON |
| Empty response | Handle gracefully, return empty list | Mock empty response |
| Database error | Resource.Error with database message | Mock DAO exception |

### Error State Testing Pattern

```kotlin
@Test
fun `repository handles network error gracefully`() = runTest {
    // Given
    val errorMessage = "Network unavailable"
    fakeApiService.shouldThrowException = IOException(errorMessage)
    
    // When
    val result = repository.getData().toList()
    
    // Then
    assertThat(result[0]).isInstanceOf(Resource.Loading::class.java)
    assertThat(result[1]).isInstanceOf(Resource.Error::class.java)
    assertThat((result[1] as Resource.Error).message).contains(errorMessage)
}
```

## Testing Strategy

### Unit Testing Framework

- **Framework**: JUnit 4 with Mockito-Kotlin
- **Coroutines**: kotlinx-coroutines-test with UnconfinedTestDispatcher
- **Assertions**: JUnit Assert + Truth (for fluent assertions)
- **Mocking**: Mockito-Kotlin for repository/API mocking

### UI Testing Framework

- **Framework**: Compose UI Testing with JUnit 4
- **DI**: Hilt Android Testing for dependency injection
- **Pattern**: Page Object pattern for screen interactions
- **Assertions**: Compose semantics matchers

### Test Configuration

```kotlin
// build.gradle.kts test dependencies
testImplementation("junit:junit:4.13.2")
testImplementation("org.mockito.kotlin:mockito-kotlin:5.2.1")
testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
testImplementation("androidx.arch.core:core-testing:2.2.0")
testImplementation("com.google.truth:truth:1.1.5")

androidTestImplementation("androidx.test.ext:junit:1.1.5")
androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
androidTestImplementation("androidx.compose.ui:ui-test-junit4")
androidTestImplementation("com.google.dagger:hilt-android-testing:2.48")
```

### Test Naming Convention

```
methodName_stateUnderTest_expectedBehavior

Examples:
- login_withValidCredentials_emitsSuccessState
- loadOrders_whenNetworkFails_returnsCachedData
- addToCart_withValidItem_updatesCartTotal
```

### Coverage Targets

| Layer | Target Coverage | Priority |
|-------|-----------------|----------|
| Repositories | 90%+ | High |
| ViewModels | 85%+ | High |
| Data Models | 80%+ | Medium |
| UI Screens | 70%+ | Medium |
| Utilities | 90%+ | Low |

### Test Execution

```bash
# Run all unit tests
./gradlew testCustomerDebugUnitTest testSellerDebugUnitTest

# Run specific test class
./gradlew testCustomerDebugUnitTest --tests "*.AuthRepositoryTest"

# Run UI tests (requires emulator/device)
./gradlew connectedCustomerDebugAndroidTest

# Generate coverage report
./gradlew testDebugUnitTestCoverage
```
