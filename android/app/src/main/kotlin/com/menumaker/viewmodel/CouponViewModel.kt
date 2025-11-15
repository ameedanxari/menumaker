package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.CouponDto
import com.menumaker.data.repository.CouponRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CouponViewModel @Inject constructor(
    private val repository: CouponRepository
) : ViewModel() {

    private val _couponsState = MutableStateFlow<Resource<List<CouponDto>>?>(null)
    val couponsState: StateFlow<Resource<List<CouponDto>>?> = _couponsState.asStateFlow()

    private val _createState = MutableStateFlow<Resource<CouponDto>?>(null)
    val createState: StateFlow<Resource<CouponDto>?> = _createState.asStateFlow()

    fun loadCoupons(businessId: String) {
        viewModelScope.launch {
            repository.getCoupons(businessId).collect { resource ->
                _couponsState.value = resource
            }
        }
    }

    fun createCoupon(coupon: Map<String, Any>) {
        viewModelScope.launch {
            repository.createCoupon(coupon).collect { resource ->
                _createState.value = resource
                if (resource is Resource.Success) {
                    // Refresh coupons list
                    coupon["business_id"]?.let { businessId ->
                        loadCoupons(businessId.toString())
                    }
                }
            }
        }
    }

    fun deleteCoupon(id: String, businessId: String) {
        viewModelScope.launch {
            repository.deleteCoupon(id).collect { resource ->
                if (resource is Resource.Success) {
                    loadCoupons(businessId)
                }
            }
        }
    }
}
