package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.AuthData
import com.menumaker.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _loginState = MutableStateFlow<Resource<AuthData>?>(null)
    val loginState: StateFlow<Resource<AuthData>?> = _loginState.asStateFlow()

    private val _signupState = MutableStateFlow<Resource<AuthData>?>(null)
    val signupState: StateFlow<Resource<AuthData>?> = _signupState.asStateFlow()

    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _passwordResetState = MutableStateFlow<Resource<Unit>?>(null)
    val passwordResetState: StateFlow<Resource<Unit>?> = _passwordResetState.asStateFlow()

    init {
        checkAuthentication()
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            authRepository.login(email, password).collect { resource ->
                _loginState.value = resource
                if (resource is Resource.Success) {
                    _isAuthenticated.value = true
                }
            }
        }
    }

    fun signup(email: String, password: String, name: String) {
        viewModelScope.launch {
            authRepository.signup(email, password, name).collect { resource ->
                _signupState.value = resource
                if (resource is Resource.Success) {
                    _isAuthenticated.value = true
                }
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout().collect {
                _isAuthenticated.value = false
                _loginState.value = null
                _signupState.value = null
            }
        }
    }

    fun sendPasswordReset(email: String) {
        viewModelScope.launch {
            authRepository.sendPasswordReset(email).collect { resource ->
                _passwordResetState.value = resource
            }
        }
    }

    fun clearPasswordResetState() {
        _passwordResetState.value = null
    }

    private fun checkAuthentication() {
        viewModelScope.launch {
            authRepository.isAuthenticated().collect { isAuth ->
                _isAuthenticated.value = isAuth
            }
        }
    }
}
