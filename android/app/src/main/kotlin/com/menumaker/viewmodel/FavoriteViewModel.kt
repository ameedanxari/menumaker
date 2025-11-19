package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.FavoriteDto
import com.menumaker.data.repository.FavoriteRepository
import com.menumaker.services.AnalyticsService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for managing user favorites
 */
@HiltViewModel
class FavoriteViewModel @Inject constructor(
    private val repository: FavoriteRepository,
    private val analyticsService: AnalyticsService
) : ViewModel() {

    private val _favoritesState = MutableStateFlow<Resource<com.menumaker.data.remote.models.FavoriteListData>>(Resource.Loading)
    val favoritesState: StateFlow<Resource<com.menumaker.data.remote.models.FavoriteListData>> = _favoritesState.asStateFlow()

    private val _favorites = MutableStateFlow<List<FavoriteDto>>(emptyList())
    val favorites: StateFlow<List<FavoriteDto>> = _favorites.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _filteredFavorites = MutableStateFlow<List<FavoriteDto>>(emptyList())
    val filteredFavorites: StateFlow<List<FavoriteDto>> = _filteredFavorites.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    init {
        loadFavorites()
        setupSearchFilter()
    }

    /**
     * Setup search filter observer
     */
    private fun setupSearchFilter() {
        viewModelScope.launch {
            _searchQuery.collect { query ->
                filterFavorites(query)
            }
        }
    }

    /**
     * Load all user favorites
     */
    fun loadFavorites() {
        viewModelScope.launch {
            repository.getFavorites().collect { result ->
                _favoritesState.value = result
                when (result) {
                    is Resource.Loading -> {
                        _isLoading.value = true
                        _errorMessage.value = null
                    }
                    is Resource.Success -> {
                        _isLoading.value = false
                        _favorites.value = result.data.favorites
                        filterFavorites(_searchQuery.value)
                        analyticsService.trackScreen("Favorites")
                    }
                    is Resource.Error -> {
                        _isLoading.value = false
                        _errorMessage.value = result.message
                    }
                }
            }
        }
    }

    /**
     * Refresh favorites list
     */
    fun refreshFavorites() {
        loadFavorites()
    }

    /**
     * Filter favorites based on search query
     */
    private fun filterFavorites(query: String) {
        _filteredFavorites.value = if (query.isEmpty()) {
            _favorites.value
        } else {
            _favorites.value.filter { favorite ->
                favorite.business?.name?.contains(query, ignoreCase = true) == true ||
                favorite.business?.description?.contains(query, ignoreCase = true) == true
            }
        }
    }

    /**
     * Update search query
     */
    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    /**
     * Add a business to favorites
     */
    fun addFavorite(businessId: String) {
        viewModelScope.launch {
            repository.addFavorite(businessId).collect { result ->
                when (result) {
                    is Resource.Loading -> {
                        _isLoading.value = true
                    }
                    is Resource.Success -> {
                        _isLoading.value = false
                        // Reload favorites to get updated list with business details
                        loadFavorites()
                        analyticsService.track("favorite_saved", mapOf("business_id" to businessId))
                    }
                    is Resource.Error -> {
                        _isLoading.value = false
                        _errorMessage.value = result.message
                    }
                }
            }
        }
    }

    /**
     * Remove a favorite by favorite ID
     */
    fun removeFavorite(favoriteId: String) {
        viewModelScope.launch {
            repository.removeFavorite(favoriteId).collect { result ->
                when (result) {
                    is Resource.Loading -> {
                        _isLoading.value = true
                    }
                    is Resource.Success -> {
                        _isLoading.value = false
                        // Update local list
                        _favorites.value = _favorites.value.filter { it.id != favoriteId }
                        filterFavorites(_searchQuery.value)
                        analyticsService.track("favorite_removed", mapOf("favorite_id" to favoriteId))
                    }
                    is Resource.Error -> {
                        _isLoading.value = false
                        _errorMessage.value = result.message
                    }
                }
            }
        }
    }

    /**
     * Remove a favorite by business ID
     */
    fun removeFavoriteByBusinessId(businessId: String) {
        viewModelScope.launch {
            repository.removeFavoriteByBusinessId(businessId).collect { result ->
                when (result) {
                    is Resource.Loading -> {
                        _isLoading.value = true
                    }
                    is Resource.Success -> {
                        _isLoading.value = false
                        // Update local list
                        _favorites.value = _favorites.value.filter { it.businessId != businessId }
                        filterFavorites(_searchQuery.value)
                        analyticsService.track("favorite_removed", mapOf("business_id" to businessId))
                    }
                    is Resource.Error -> {
                        _isLoading.value = false
                        _errorMessage.value = result.message
                    }
                }
            }
        }
    }

    /**
     * Check if a business is favorited
     */
    fun isFavorite(businessId: String): Boolean {
        return _favorites.value.any { it.businessId == businessId }
    }

    /**
     * Get favorite for a specific business
     */
    fun getFavorite(businessId: String): FavoriteDto? {
        return _favorites.value.find { it.businessId == businessId }
    }

    /**
     * Clear error message
     */
    fun clearError() {
        _errorMessage.value = null
    }
}
