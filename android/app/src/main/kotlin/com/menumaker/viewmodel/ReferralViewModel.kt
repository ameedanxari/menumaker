package com.menumaker.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.ReferralHistoryDto
import com.menumaker.data.remote.models.ReferralLeaderboardDto
import com.menumaker.data.remote.models.ReferralStatsDto
import com.menumaker.data.repository.ReferralRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ReferralViewModel @Inject constructor(
    private val repository: ReferralRepository
) : ViewModel() {

    // State properties
    private val _stats = MutableStateFlow<ReferralStatsDto?>(null)
    val stats: StateFlow<ReferralStatsDto?> = _stats.asStateFlow()

    private val _leaderboard = MutableStateFlow<List<ReferralLeaderboardDto>>(emptyList())
    val leaderboard: StateFlow<List<ReferralLeaderboardDto>> = _leaderboard.asStateFlow()

    private val _referralHistory = MutableStateFlow<List<ReferralHistoryDto>>(emptyList())
    val referralHistory: StateFlow<List<ReferralHistoryDto>> = _referralHistory.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _referralCodeMessage = MutableStateFlow<String?>(null)
    val referralCodeMessage: StateFlow<String?> = _referralCodeMessage.asStateFlow()

    private val _referralCodeSuccess = MutableStateFlow(false)
    val referralCodeSuccess: StateFlow<Boolean> = _referralCodeSuccess.asStateFlow()

    init {
        loadReferralData()
    }

    // MARK: - Data Loading

    private fun loadReferralData() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            // Load stats and leaderboard
            repository.getReferralStats().collect { resource ->
                when (resource) {
                    is Resource.Loading -> _isLoading.value = true
                    is Resource.Success -> {
                        resource.data?.let { data ->
                            _stats.value = data.stats
                            _leaderboard.value = data.leaderboard
                        }
                    }
                    is Resource.Error -> {
                        _errorMessage.value = resource.message
                    }
                }
            }

            // Load referral history
            repository.getReferralHistory().collect { resource ->
                when (resource) {
                    is Resource.Loading -> {} // Already loading
                    is Resource.Success -> {
                        resource.data?.let { history ->
                            _referralHistory.value = history
                        }
                        _isLoading.value = false
                    }
                    is Resource.Error -> {
                        _errorMessage.value = resource.message
                        _isLoading.value = false
                    }
                }
            }
        }
    }

    fun refreshData() {
        loadReferralData()
    }

    // MARK: - Referral Code

    fun getReferralCode(): String? {
        return _stats.value?.referralCode
    }

    // MARK: - Apply Referral Code

    fun applyReferralCode(code: String) {
        if (code.isEmpty()) {
            _referralCodeMessage.value = "Please enter a referral code"
            _referralCodeSuccess.value = false
            return
        }

        // Check if user is trying to apply their own code
        if (code.uppercase() == _stats.value?.referralCode?.uppercase()) {
            _referralCodeMessage.value = "You cannot use your own referral code"
            _referralCodeSuccess.value = false
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            _referralCodeMessage.value = null

            repository.applyReferralCode(code).collect { resource ->
                when (resource) {
                    is Resource.Loading -> _isLoading.value = true
                    is Resource.Success -> {
                        resource.data?.let { result ->
                            if (result.success) {
                                _referralCodeMessage.value = result.message ?: "Referral code applied successfully! ₹50 credit added."
                                _referralCodeSuccess.value = true

                                // Refresh data to show updated credits
                                loadReferralData()
                            } else {
                                _referralCodeMessage.value = result.message ?: "Invalid or expired referral code"
                                _referralCodeSuccess.value = false
                            }
                        }
                        _isLoading.value = false
                    }
                    is Resource.Error -> {
                        _referralCodeMessage.value = resource.message
                        _referralCodeSuccess.value = false
                        _isLoading.value = false
                    }
                }
            }
        }
    }

    // Clear message after some time (called from UI)
    fun clearReferralCodeMessage() {
        _referralCodeMessage.value = null
    }
}
