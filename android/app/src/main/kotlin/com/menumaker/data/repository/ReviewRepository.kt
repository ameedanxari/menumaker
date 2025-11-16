package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.local.db.dao.ReviewDao
import com.menumaker.data.local.entities.ReviewEntity
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.ReviewDto
import com.menumaker.data.remote.models.ReviewListData
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

interface ReviewRepository {
    fun getReviews(businessId: String): Flow<Resource<ReviewListData>>
    fun createReview(review: Map<String, Any>): Flow<Resource<ReviewDto>>
}

class ReviewRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val reviewDao: ReviewDao
) : ReviewRepository {

    override fun getReviews(businessId: String): Flow<Resource<ReviewListData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.getReviews(businessId)
            if (response.isSuccessful && response.body() != null) {
                val data = response.body()!!.data
                // Cache reviews
                reviewDao.insertReviews(data.reviews.map { it.toEntity() })
                emit(Resource.Success(data))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to load reviews"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun createReview(review: Map<String, Any>): Flow<Resource<ReviewDto>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.createReview(review)
            if (response.isSuccessful && response.body() != null) {
                val newReview = response.body()!!.data.review
                emit(Resource.Success(newReview))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to create review"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    private fun ReviewDto.toEntity() = ReviewEntity(
        id = id,
        businessId = businessId,
        customerName = customerName,
        rating = rating,
        comment = comment,
        createdAt = createdAt
    )
}
