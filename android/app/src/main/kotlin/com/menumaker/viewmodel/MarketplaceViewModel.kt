package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.MarketplaceSellerDto
import com.menumaker.data.repository.MarketplaceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MarketplaceViewModel @Inject constructor(
    private val repository: MarketplaceRepository
) : ViewModel() {

    private val _sellersState = MutableStateFlow<Resource<List<MarketplaceSellerDto>>?>(null)
    val sellersState: StateFlow<Resource<List<MarketplaceSellerDto>>?> = _sellersState.asStateFlow()

    fun searchSellers(
        latitude: Double? = null,
        longitude: Double? = null,
        cuisine: String? = null,
        ratingMin: Double? = null,
        distanceKm: Double? = null
    ) {
        viewModelScope.launch {
            repository.searchSellers(latitude, longitude, cuisine, ratingMin, distanceKm)
                .collect { resource ->
                    _sellersState.value = resource
                }
        }
    }
}
