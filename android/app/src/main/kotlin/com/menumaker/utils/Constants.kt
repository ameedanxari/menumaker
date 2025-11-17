package com.menumaker.utils

import com.menumaker.BuildConfig

object Constants {
    // API
    const val BASE_URL = BuildConfig.API_BASE_URL
    const val CONNECT_TIMEOUT = 30L
    const val READ_TIMEOUT = 30L
    const val WRITE_TIMEOUT = 30L

    // Preferences
    const val PREF_NAME = "menumaker_prefs"
    const val KEY_ACCESS_TOKEN = "access_token"
    const val KEY_REFRESH_TOKEN = "refresh_token"
    const val KEY_USER_ID = "user_id"
    const val KEY_USER_EMAIL = "user_email"
    const val KEY_BUSINESS_ID = "business_id"

    // Pagination
    const val PAGE_SIZE = 20
    const val INITIAL_LOAD_SIZE = 40

    // Cache
    const val CACHE_TIMEOUT_MINUTES = 5L

    // WorkManager
    const val SYNC_WORK_NAME = "menumaker_sync"
    const val SYNC_INTERVAL_MINUTES = 15L

    // Notification
    const val NOTIFICATION_ID_ORDER = 1001
}
