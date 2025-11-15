# MenuMaker Android Development Guide

Complete guide for developers working on the MenuMaker Android app.

## 🎯 Overview

The MenuMaker Android app is a native Kotlin application built with:
- **Jetpack Compose** for modern UI
- **Material Design 3** with dynamic theming
- **Offline-first architecture** using Room database
- **MVVM pattern** with ViewModels and Repositories
- **Hilt** for dependency injection
- **Coroutines + Flow** for reactive programming

## 📁 Project Structure

### Core Modules

#### 1. Dependency Injection (`di/`)
All Hilt modules for dependency injection:
- `NetworkModule`: Retrofit, OkHttp, API Service
- `DatabaseModule`: Room database and DAOs
- `RepositoryModule`: Repository implementations
- `WorkManagerModule`: Background work configuration

#### 2. Data Layer (`data/`)

**Remote** (`data/remote/`):
- `api/ApiService.kt`: Retrofit interface for all API endpoints
- `models/`: DTOs for API responses (AuthModels, BusinessModels, DishModels, OrderModels)

**Local** (`data/local/`):
- `db/MenuMakerDatabase.kt`: Room database
- `db/dao/`: Data Access Objects (BusinessDao, DishDao, OrderDao)
- `entities/`: Room entities for local caching
- `datastore/TokenDataStore.kt`: Encrypted token storage

**Repository** (`data/repository/`):
- Interface + Implementation pattern
- Offline-first: Cache-then-network strategy
- Example: `AuthRepository`, `OrderRepository`

#### 3. UI Layer (`ui/`)

**Theme** (`ui/theme/`):
- `Color.kt`: Material 3 color palette
- `Type.kt`: Typography scales
- `Theme.kt`: Dynamic theming with Material You

**Navigation** (`ui/navigation/`):
- `Destinations.kt`: Route definitions
- `NavGraph.kt`: Navigation graph with Compose Navigation

**Screens** (`ui/screens/`):
- `auth/`: Login, Signup
- `seller/`: Dashboard, Orders, Menu Editor
- `customer/`: Marketplace, Checkout

**Components** (`ui/components/`):
- Reusable Compose components
- Follow Material 3 guidelines

#### 4. ViewModels (`viewmodel/`)
- State management with StateFlow
- UI state exposed via `StateFlow<Resource<T>>`
- Handle business logic and repository calls
- Example: `AuthViewModel`, `OrderViewModel`

#### 5. Services (`services/`)
- `MenuMakerFirebaseMessagingService`: FCM push notifications
- Background services for offline sync

#### 6. Workers (`workers/`)
- `SyncWorker`: WorkManager for background data sync
- Runs every 15 minutes when network available

## 🛠️ Development Workflow

### 1. Adding a New Feature

#### Step 1: Create Data Models
```kotlin
// data/remote/models/NewFeatureModels.kt
data class NewFeatureDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String
)
```

#### Step 2: Add Room Entity (if caching)
```kotlin
// data/local/entities/NewFeatureEntity.kt
@Entity(tableName = "new_features")
data class NewFeatureEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "name") val name: String
)
```

#### Step 3: Create DAO
```kotlin
// data/local/db/dao/NewFeatureDao.kt
@Dao
interface NewFeatureDao {
    @Query("SELECT * FROM new_features")
    fun getAll(): Flow<List<NewFeatureEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: NewFeatureEntity)
}
```

#### Step 4: Add API Endpoint
```kotlin
// data/remote/api/ApiService.kt
@GET("new-features")
suspend fun getNewFeatures(): Response<NewFeatureListResponse>
```

#### Step 5: Create Repository
```kotlin
// data/repository/NewFeatureRepository.kt
interface NewFeatureRepository {
    fun getFeatures(): Flow<Resource<List<NewFeatureDto>>>
}

class NewFeatureRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val dao: NewFeatureDao
) : NewFeatureRepository {
    override fun getFeatures(): Flow<Resource<List<NewFeatureDto>>> = flow {
        emit(Resource.Loading)
        // Emit cached data first
        dao.getAll().collect { cached ->
            if (cached.isNotEmpty()) {
                emit(Resource.Success(cached.map { it.toDto() }))
            }
        }
        // Then fetch fresh data
        val response = apiService.getNewFeatures()
        if (response.isSuccessful) {
            val features = response.body()!!.data.features
            dao.insertAll(features.map { it.toEntity() })
            emit(Resource.Success(features))
        } else {
            emit(Resource.Error(response.message()))
        }
    }
}
```

#### Step 6: Create ViewModel
```kotlin
// viewmodel/NewFeatureViewModel.kt
@HiltViewModel
class NewFeatureViewModel @Inject constructor(
    private val repository: NewFeatureRepository
) : ViewModel() {
    private val _state = MutableStateFlow<Resource<List<NewFeatureDto>>?>(null)
    val state: StateFlow<Resource<List<NewFeatureDto>>?> = _state.asStateFlow()

    fun loadFeatures() {
        viewModelScope.launch {
            repository.getFeatures().collect { resource ->
                _state.value = resource
            }
        }
    }
}
```

#### Step 7: Create Compose Screen
```kotlin
// ui/screens/NewFeatureScreen.kt
@Composable
fun NewFeatureScreen(
    viewModel: NewFeatureViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadFeatures()
    }

    when (val currentState = state) {
        is Resource.Loading -> LoadingView()
        is Resource.Success -> FeatureList(currentState.data)
        is Resource.Error -> ErrorView(currentState.message)
        null -> EmptyView()
    }
}
```

#### Step 8: Add to Navigation
```kotlin
// ui/navigation/Destinations.kt
object NewFeature : Destination("new-feature")

// ui/navigation/NavGraph.kt
composable(Destination.NewFeature.route) {
    NewFeatureScreen()
}
```

### 2. Testing

#### Unit Test Example
```kotlin
// src/test/kotlin/viewmodel/AuthViewModelTest.kt
@Test
fun `login success updates state correctly`() = runTest {
    val viewModel = AuthViewModel(mockRepository)
    viewModel.login("test@test.com", "password123")

    val state = viewModel.loginState.value
    assertTrue(state is Resource.Success)
}
```

#### Instrumentation Test Example
```kotlin
// src/androidTest/kotlin/LoginScreenTest.kt
@Test
fun loginScreen_validCredentials_navigatesToDashboard() {
    composeTestRule.setContent {
        LoginScreen(onNavigateToDashboard = { navigated = true })
    }

    composeTestRule.onNodeWithText("Email").performTextInput("test@test.com")
    composeTestRule.onNodeWithText("Password").performTextInput("password123")
    composeTestRule.onNodeWithText("Sign In").performClick()

    assertTrue(navigated)
}
```

## 🔧 Common Tasks

### Debugging Network Requests
1. Enable logging in `NetworkModule.kt`:
   ```kotlin
   level = HttpLoggingInterceptor.Level.BODY
   ```
2. Check Logcat for HTTP requests/responses

### Inspecting Database
1. Run app in debug mode
2. Tools → Database Inspector
3. Select `MenuMakerDatabase`

### Testing Push Notifications
1. Use Firebase Console → Cloud Messaging
2. Send test message with:
   ```json
   {
     "data": {
       "orderId": "test-123",
       "total": "1500",
       "customerName": "Test Customer"
     }
   }
   ```

### Simulating Offline Mode
1. Android Studio → Network Profiler
2. Toggle network connection
3. Verify offline caching works

## 📚 Best Practices

### 1. State Management
- Use `StateFlow` for UI state
- Expose immutable state: `StateFlow<T>` not `MutableStateFlow<T>`
- Collect state in Composables with `collectAsState()`

### 2. Error Handling
- Wrap API calls in try-catch
- Use `Resource<T>` sealed class for loading/success/error states
- Show user-friendly error messages

### 3. Performance
- Use `remember` for expensive computations
- Avoid recomposition with `derivedStateOf`
- Profile with Android Studio Profiler

### 4. Code Style
- Follow Kotlin coding conventions
- Use meaningful variable names
- Document complex logic
- Keep functions small and focused

### 5. Offline Support
- Cache all critical data in Room
- Sync pending changes with WorkManager
- Handle network failures gracefully

## 🐛 Troubleshooting

### Build Fails
1. Clean project: `./gradlew clean`
2. Invalidate caches: File → Invalidate Caches
3. Check JDK version (must be 17)
4. Sync Gradle: File → Sync Project with Gradle Files

### Room Migration Issues
1. Uninstall app from device
2. Update database version in `MenuMakerDatabase.kt`
3. Create migration if needed

### Hilt Injection Fails
1. Verify `@HiltAndroidApp` on Application class
2. Check module is `@InstallIn(SingletonComponent::class)`
3. Rebuild project

## 📦 Release Process

### 1. Update Version
```kotlin
// app/build.gradle.kts
versionCode = 2
versionName = "1.1.0"
```

### 2. Generate Signed APK
1. Build → Generate Signed Bundle/APK
2. Select Android App Bundle
3. Create/use existing keystore
4. Build release variant

### 3. Test Release Build
```bash
./gradlew assembleRelease
adb install app/build/outputs/apk/release/app-release.apk
```

### 4. Upload to Play Store
- Open Play Console
- Upload AAB file
- Fill release notes
- Submit for review

## 🔐 Security Checklist

- [ ] Tokens stored in encrypted DataStore
- [ ] ProGuard enabled for release
- [ ] No hardcoded secrets in code
- [ ] HTTPS for all API calls
- [ ] Certificate pinning (optional)
- [ ] Input validation on all forms

## 📈 Performance Benchmarks

| Metric | Target | Current |
|--------|--------|---------|
| Cold start | < 2.5s | TBD |
| Memory usage | < 180MB | TBD |
| APK size | < 50MB | ~35MB |
| Frame rate | 60fps | TBD |

## 📝 Additional Resources

- [Jetpack Compose Docs](https://developer.android.com/jetpack/compose)
- [Material Design 3](https://m3.material.io/)
- [Hilt Documentation](https://dagger.dev/hilt/)
- [Room Database Guide](https://developer.android.com/training/data-storage/room)
- [Kotlin Coroutines](https://kotlinlang.org/docs/coroutines-overview.html)

---

**Happy Coding! 🚀**
