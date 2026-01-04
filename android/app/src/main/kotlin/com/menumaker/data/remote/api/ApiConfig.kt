package com.menumaker.data.remote.api

import com.menumaker.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Holds the current API base URL with a mutable override for debug/QA.
 */
object ApiConfig {
    private val _baseUrl = MutableStateFlow(BuildConfig.API_BASE_URL_DEFAULT)
    val baseUrl: StateFlow<String> = _baseUrl

    fun overrideBaseUrl(newUrl: String) {
        _baseUrl.value = newUrl
    }
}
