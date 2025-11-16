package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.IntegrationDto
import com.menumaker.data.remote.models.PaymentProcessorData
import com.menumaker.data.repository.IntegrationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class IntegrationViewModel @Inject constructor(
    private val repository: IntegrationRepository
) : ViewModel() {

    private val _integrationsState = MutableStateFlow<Resource<List<IntegrationDto>>?>(null)
    val integrationsState: StateFlow<Resource<List<IntegrationDto>>?> = _integrationsState.asStateFlow()

    private val _connectState = MutableStateFlow<Resource<PaymentProcessorData>?>(null)
    val connectState: StateFlow<Resource<PaymentProcessorData>?> = _connectState.asStateFlow()

    fun loadIntegrations(businessId: String) {
        viewModelScope.launch {
            repository.getIntegrations(businessId).collect { resource ->
                _integrationsState.value = resource
            }
        }
    }

    fun connectPOS(provider: String) {
        viewModelScope.launch {
            repository.connectPOS(provider).collect { resource ->
                _connectState.value = resource
            }
        }
    }

    fun connectDelivery(provider: String) {
        viewModelScope.launch {
            repository.connectDelivery(provider).collect { resource ->
                _connectState.value = resource
            }
        }
    }

    fun disconnectIntegration(id: String, businessId: String) {
        viewModelScope.launch {
            repository.disconnectIntegration(id).collect { resource ->
                if (resource is Resource.Success) {
                    loadIntegrations(businessId)
                }
            }
        }
    }
}
