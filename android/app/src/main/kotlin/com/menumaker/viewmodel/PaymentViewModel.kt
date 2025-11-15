package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.PaymentProcessorData
import com.menumaker.data.remote.models.PaymentProcessorDto
import com.menumaker.data.remote.models.PayoutListData
import com.menumaker.data.repository.PaymentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PaymentViewModel @Inject constructor(
    private val repository: PaymentRepository
) : ViewModel() {

    private val _processorsState = MutableStateFlow<Resource<List<PaymentProcessorDto>>?>(null)
    val processorsState: StateFlow<Resource<List<PaymentProcessorDto>>?> = _processorsState.asStateFlow()

    private val _payoutsState = MutableStateFlow<Resource<PayoutListData>?>(null)
    val payoutsState: StateFlow<Resource<PayoutListData>?> = _payoutsState.asStateFlow()

    private val _connectState = MutableStateFlow<Resource<PaymentProcessorData>?>(null)
    val connectState: StateFlow<Resource<PaymentProcessorData>?> = _connectState.asStateFlow()

    fun loadProcessors(businessId: String) {
        viewModelScope.launch {
            repository.getPaymentProcessors(businessId).collect { resource ->
                _processorsState.value = resource
            }
        }
    }

    fun connectProcessor(provider: String) {
        viewModelScope.launch {
            repository.connectProcessor(provider).collect { resource ->
                _connectState.value = resource
            }
        }
    }

    fun disconnectProcessor(id: String, businessId: String) {
        viewModelScope.launch {
            repository.disconnectProcessor(id).collect { resource ->
                if (resource is Resource.Success) {
                    loadProcessors(businessId)
                }
            }
        }
    }

    fun loadPayouts(businessId: String) {
        viewModelScope.launch {
            repository.getPayouts(businessId).collect { resource ->
                _payoutsState.value = resource
            }
        }
    }

    fun updatePayoutSchedule(schedule: Map<String, Any>) {
        viewModelScope.launch {
            repository.updatePayoutSchedule(schedule).collect { resource ->
                _payoutsState.value = resource
            }
        }
    }
}
