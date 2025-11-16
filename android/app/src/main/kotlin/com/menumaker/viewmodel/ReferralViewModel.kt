package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.ReferralStatsData
import com.menumaker.data.repository.ReferralRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ReferralViewModel @Inject constructor(
    private val repository: ReferralRepository
) : ViewModel() {

    private val _statsState = MutableStateFlow<Resource<ReferralStatsData>?>(null)
    val statsState: StateFlow<Resource<ReferralStatsData>?> = _statsState.asStateFlow()

    fun loadStats() {
        viewModelScope.launch {
            repository.getReferralStats().collect { resource ->
                _statsState.value = resource
            }
        }
    }
}
