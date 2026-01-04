package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.BusinessDto
import com.menumaker.data.remote.models.FavoriteDto
import com.menumaker.data.remote.models.FavoriteListData
import com.menumaker.data.remote.models.FavoriteResponse
import com.menumaker.data.remote.models.FavoriteData
import com.menumaker.data.repository.FavoriteRepository
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class FavoriteViewModelTest {

    @Mock
    private lateinit var repository: FavoriteRepository
    
    @Mock
    private lateinit var analyticsService: AnalyticsService

    private lateinit var viewModel: FavoriteViewModel

    private val testDispatcher = UnconfinedTestDispatcher()
    
    private val mockBusiness = BusinessDto(
        id = "b1",
        name = "Test Biz",
        slug = "test-biz",
        description = "Description",
        logoUrl = null,
        ownerId = "o1",
        isActive = true,
        createdAt = "",
        updatedAt = ""
    )
    
    private val mockFavorite = FavoriteDto(
        id = "f1",
        userId = "u1",
        businessId = "b1",
        business = mockBusiness,
        createdAt = ""
    )
    
    private val mockFavoriteList = FavoriteListData(listOf(mockFavorite))

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)
        
        val flow = flow { emit(Resource.Success(mockFavoriteList)) }
        Mockito.`when`(repository.getFavorites()).thenReturn(flow)

        viewModel = FavoriteViewModel(repository, analyticsService)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadFavorites updates favorites state`() = runTest {
        assertEquals(1, viewModel.favorites.value.size)
        assertEquals("f1", viewModel.favorites.value[0].id)
    }

    @Test
    fun `addFavorite updates favorites`() = runTest {
        val successFlow = flow { emit(Resource.Success(mockFavorite)) }
        Mockito.`when`(repository.addFavorite("b1")).thenReturn(successFlow)
        
        // Mock getFavorites again as addFavorite calls loadFavorites
        val listFlow = flow { emit(Resource.Success(mockFavoriteList)) }
        Mockito.`when`(repository.getFavorites()).thenReturn(listFlow)
        
        viewModel.addFavorite("b1")
        
        // Verify analytics tracked?
        // Since we mock analyticsService but didn't stub track, it does nothing, which is fine.
        // We check state update.
        assertEquals(1, viewModel.favorites.value.size)
    }

    @Test
    fun `removeFavorite updates favorites`() = runTest {
        val successFlow = flow { emit(Resource.Success(Unit)) }
        Mockito.`when`(repository.removeFavorite("f1")).thenReturn(successFlow)
        
        // Mock getFavorites reload
        val listFlow = flow { emit(Resource.Success(FavoriteListData(emptyList()))) }
        Mockito.`when`(repository.getFavorites()).thenReturn(listFlow)
        
        viewModel.removeFavorite("f1")
        
        assertEquals(0, viewModel.favorites.value.size)
    }

    @Test
    fun `isFavorite returns correct value`() {
        assertTrue(viewModel.isFavorite("b1"))
        assertFalse(viewModel.isFavorite("b2"))
    }
    
    @Test
    fun `filterFavorites filters by name`() = runTest {
        viewModel.updateSearchQuery("Test")
        // viewModel uses debounce, but UnconfinedTestDispatcher/flow might execute immediately?
        // Actually debounce usually requires advanceTimeBy.
        // But FavoriteViewModel implementation uses viewModelScope.launch { _searchQuery.collect { ... } }
        // The implementation has `filterFavorites` called inside `collect`.
        
        // Wait, setupSearchFilter uses debounce?
        // No, in the file:
        // `_searchQuery.collect { query -> filterFavorites(query) }`
        // There is NO debounce in the collector lambda in `setupSearchFilter`.
        // Wait, line 15 import debounce.
        // But line 56-60:
        /*
            _searchQuery.collect { query ->
                filterFavorites(query)
            }
        */
        // It seems debounce is NOT used in the collector chain shown in `setupSearchFilter`.
        // So it should work immediately.
        
        // But wait, `_filteredFavorites` is updated inside `filterFavorites`.
        // Let's check logic:
        /*
            _favorites.value.filter {
                favorite.business?.name?.contains(query...
            }
        */
        // "Test Biz" contains "Test".
        
        assertEquals(1, viewModel.filteredFavorites.value.size)
        
        viewModel.updateSearchQuery("XYZ")
        assertEquals(0, viewModel.filteredFavorites.value.size)
    }
}
