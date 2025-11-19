package com.menumaker.data.repository

import com.menumaker.data.common.Resource
import com.menumaker.data.local.datastore.TokenDataStore
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.AuthData
import com.menumaker.data.remote.models.LoginRequest
import com.menumaker.data.remote.models.SignupRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

interface AuthRepository {
    fun login(email: String, password: String): Flow<Resource<AuthData>>
    fun signup(email: String, password: String, name: String): Flow<Resource<AuthData>>
    fun logout(): Flow<Resource<Unit>>
    fun isAuthenticated(): Flow<Boolean>
    fun sendPasswordReset(email: String): Flow<Resource<Unit>>
}

class AuthRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val tokenDataStore: TokenDataStore
) : AuthRepository {

    override fun login(email: String, password: String): Flow<Resource<AuthData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.login(LoginRequest(email, password))
            if (response.isSuccessful && response.body() != null) {
                val authData = response.body()!!.data
                tokenDataStore.saveTokens(authData.accessToken, authData.refreshToken)
                tokenDataStore.saveUserId(authData.user.id)
                tokenDataStore.saveUserEmail(authData.user.email)
                emit(Resource.Success(authData))
            } else {
                emit(Resource.Error(response.message() ?: "Login failed"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun signup(email: String, password: String, name: String): Flow<Resource<AuthData>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.signup(SignupRequest(email, password, name))
            if (response.isSuccessful && response.body() != null) {
                val authData = response.body()!!.data
                tokenDataStore.saveTokens(authData.accessToken, authData.refreshToken)
                tokenDataStore.saveUserId(authData.user.id)
                tokenDataStore.saveUserEmail(authData.user.email)
                emit(Resource.Success(authData))
            } else {
                emit(Resource.Error(response.message() ?: "Signup failed"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }

    override fun logout(): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            apiService.logout()
            tokenDataStore.clearTokens()
            emit(Resource.Success(Unit))
        } catch (e: Exception) {
            // Still clear local tokens even if API call fails
            tokenDataStore.clearTokens()
            emit(Resource.Success(Unit))
        }
    }

    override fun isAuthenticated(): Flow<Boolean> = flow {
        tokenDataStore.getAccessToken().collect { token ->
            emit(!token.isNullOrEmpty())
        }
    }

    override fun sendPasswordReset(email: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            val response = apiService.sendPasswordReset(mapOf("email" to email))
            if (response.isSuccessful) {
                emit(Resource.Success(Unit))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to send password reset email"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "An error occurred", e))
        }
    }
}
