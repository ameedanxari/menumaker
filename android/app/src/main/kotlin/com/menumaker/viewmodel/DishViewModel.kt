package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.DishDto
import com.menumaker.data.repository.DishRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class DishViewModel @Inject constructor(
    private val dishRepository: DishRepository
) : ViewModel() {

    private val _dishesState = MutableStateFlow<Resource<List<DishDto>>?>(null)
    val dishesState: StateFlow<Resource<List<DishDto>>?> = _dishesState.asStateFlow()

    private val _dishDetailState = MutableStateFlow<Resource<DishDto>?>(null)
    val dishDetailState: StateFlow<Resource<DishDto>?> = _dishDetailState.asStateFlow()

    fun loadDishes(businessId: String) {
        viewModelScope.launch {
            dishRepository.getDishesByBusiness(businessId).collect { resource ->
                _dishesState.value = resource
            }
        }
    }

    fun loadDishDetail(dishId: String) {
        viewModelScope.launch {
            dishRepository.getDishById(dishId).collect { resource ->
                _dishDetailState.value = resource
            }
        }
    }
}
