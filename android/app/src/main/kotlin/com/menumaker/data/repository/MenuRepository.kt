package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.local.db.dao.MenuDao
import com.menumaker.data.local.entities.MenuEntity
import com.menumaker.data.remote.api.ApiService
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

interface MenuRepository {
    fun getMenusByBusiness(businessId: String): Flow<Resource<List<MenuEntity>>>
}

class MenuRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val menuDao: MenuDao
) : MenuRepository {

    override fun getMenusByBusiness(businessId: String): Flow<Resource<List<MenuEntity>>> = flow {
        emit(Resource.Loading)
        try {
            menuDao.getMenusByBusiness(businessId).collect { menus ->
                emit(Resource.Success(menus))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }
}
