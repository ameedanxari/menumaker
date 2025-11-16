package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.ReviewDto
import com.menumaker.data.remote.models.ReviewListData
import com.menumaker.data.repository.ReviewRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ReviewViewModel @Inject constructor(
    private val repository: ReviewRepository
) : ViewModel() {

    private val _reviewsState = MutableStateFlow<Resource<ReviewListData>?>(null)
    val reviewsState: StateFlow<Resource<ReviewListData>?> = _reviewsState.asStateFlow()

    private val _createState = MutableStateFlow<Resource<ReviewDto>?>(null)
    val createState: StateFlow<Resource<ReviewDto>?> = _createState.asStateFlow()

    fun loadReviews(businessId: String) {
        viewModelScope.launch {
            repository.getReviews(businessId).collect { resource ->
                _reviewsState.value = resource
            }
        }
    }

    fun createReview(review: Map<String, Any>) {
        viewModelScope.launch {
            repository.createReview(review).collect { resource ->
                _createState.value = resource
                if (resource is Resource.Success) {
                    review["business_id"]?.let { businessId ->
                        loadReviews(businessId.toString())
                    }
                }
            }
        }
    }
}
