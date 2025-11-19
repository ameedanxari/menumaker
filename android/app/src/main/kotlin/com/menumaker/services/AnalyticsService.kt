package com.menumaker.services

import android.content.Context
import android.os.Bundle
import com.google.firebase.analytics.FirebaseAnalytics
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AnalyticsService @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val firebaseAnalytics: FirebaseAnalytics by lazy {
        FirebaseAnalytics.getInstance(context)
    }

    fun logEvent(eventName: String, params: Map<String, Any>? = null) {
        val bundle = Bundle().apply {
            params?.forEach { (key, value) ->
                when (value) {
                    is String -> putString(key, value)
                    is Int -> putInt(key, value)
                    is Long -> putLong(key, value)
                    is Double -> putDouble(key, value)
                    is Boolean -> putBoolean(key, value)
                }
            }
        }
        firebaseAnalytics.logEvent(eventName, bundle)
    }

    fun setUserId(userId: String) {
        firebaseAnalytics.setUserId(userId)
    }

    fun setUserProperty(name: String, value: String) {
        firebaseAnalytics.setUserProperty(name, value)
    }

    // Predefined events
    fun logLogin(method: String) {
        logEvent(FirebaseAnalytics.Event.LOGIN, mapOf("method" to method))
    }

    fun logSignup(method: String) {
        logEvent(FirebaseAnalytics.Event.SIGN_UP, mapOf("method" to method))
    }

    fun logPurchase(value: Double, currency: String = "INR") {
        logEvent(FirebaseAnalytics.Event.PURCHASE, mapOf(
            FirebaseAnalytics.Param.VALUE to value,
            FirebaseAnalytics.Param.CURRENCY to currency
        ))
    }

    fun logViewItem(itemId: String, itemName: String) {
        logEvent(FirebaseAnalytics.Event.VIEW_ITEM, mapOf(
            FirebaseAnalytics.Param.ITEM_ID to itemId,
            FirebaseAnalytics.Param.ITEM_NAME to itemName
        ))
    }

    // Convenience methods for ViewModels
    fun track(eventName: String, params: Map<String, Any> = emptyMap()) {
        logEvent(eventName, params)
    }

    fun trackScreen(screenName: String) {
        logEvent(FirebaseAnalytics.Event.SCREEN_VIEW, mapOf(
            FirebaseAnalytics.Param.SCREEN_NAME to screenName
        ))
    }
}
