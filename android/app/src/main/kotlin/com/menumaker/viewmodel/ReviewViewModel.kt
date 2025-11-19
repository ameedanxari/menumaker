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

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _showSuccessMessage = MutableStateFlow(false)
    val showSuccessMessage: StateFlow<Boolean> = _showSuccessMessage.asStateFlow()

    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    fun loadReviews(businessId: String) {
        viewModelScope.launch {
            repository.getReviews(businessId).collect { resource ->
                _reviewsState.value = resource
            }
        }
    }

    fun createReview(review: Map<String, Any>) {
        viewModelScope.launch {
            _isLoading.value = true
            _showSuccessMessage.value = false
            repository.createReview(review).collect { resource ->
                _createState.value = resource
                when (resource) {
                    is Resource.Loading -> _isLoading.value = true
                    is Resource.Success -> {
                        _isLoading.value = false
                        _showSuccessMessage.value = true
                        _successMessage.value = "Your review has been submitted successfully!"
                        review["business_id"]?.let { businessId ->
                            loadReviews(businessId.toString())
                        }
                    }
                    is Resource.Error -> {
                        _isLoading.value = false
                        _showSuccessMessage.value = false
                        _successMessage.value = null
                    }
                }
            }
        }
    }

    fun submitReview(
        businessId: String,
        orderId: String?,
        customerName: String,
        rating: Int,
        comment: String,
        imageUris: List<android.net.Uri>
    ) {
        val review = mutableMapOf<String, Any>(
            "business_id" to businessId,
            "customer_name" to customerName,
            "rating" to rating,
            "comment" to comment
        )

        if (orderId != null) {
            review["order_id"] = orderId
        }

        // TODO: Handle image uploads
        // For now, just submit the review without images

        createReview(review)
    }

    fun clearSuccessMessage() {
        _showSuccessMessage.value = false
        _successMessage.value = null
    }
}
