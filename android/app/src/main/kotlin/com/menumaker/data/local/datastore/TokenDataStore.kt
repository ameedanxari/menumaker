package com.menumaker.data.local.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.menumaker.utils.Constants
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class TokenDataStore(private val context: Context) {

    private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
        name = Constants.PREF_NAME
    )

    companion object {
        val ACCESS_TOKEN_KEY = stringPreferencesKey(Constants.KEY_ACCESS_TOKEN)
        val REFRESH_TOKEN_KEY = stringPreferencesKey(Constants.KEY_REFRESH_TOKEN)
        val USER_ID_KEY = stringPreferencesKey(Constants.KEY_USER_ID)
        val USER_EMAIL_KEY = stringPreferencesKey(Constants.KEY_USER_EMAIL)
        val BUSINESS_ID_KEY = stringPreferencesKey(Constants.KEY_BUSINESS_ID)
    }

    fun getAccessToken(): Flow<String?> {
        return context.dataStore.data.map { preferences ->
            preferences[ACCESS_TOKEN_KEY]
        }
    }

    fun getRefreshToken(): Flow<String?> {
        return context.dataStore.data.map { preferences ->
            preferences[REFRESH_TOKEN_KEY]
        }
    }

    fun getUserId(): Flow<String?> {
        return context.dataStore.data.map { preferences ->
            preferences[USER_ID_KEY]
        }
    }

    fun getUserEmail(): Flow<String?> {
        return context.dataStore.data.map { preferences ->
            preferences[USER_EMAIL_KEY]
        }
    }

    fun getBusinessId(): Flow<String?> {
        return context.dataStore.data.map { preferences ->
            preferences[BUSINESS_ID_KEY]
        }
    }

    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        context.dataStore.edit { preferences ->
            preferences[ACCESS_TOKEN_KEY] = accessToken
            preferences[REFRESH_TOKEN_KEY] = refreshToken
        }
    }

    suspend fun saveUserId(userId: String) {
        context.dataStore.edit { preferences ->
            preferences[USER_ID_KEY] = userId
        }
    }

    suspend fun saveUserEmail(email: String) {
        context.dataStore.edit { preferences ->
            preferences[USER_EMAIL_KEY] = email
        }
    }

    suspend fun saveBusinessId(businessId: String) {
        context.dataStore.edit { preferences ->
            preferences[BUSINESS_ID_KEY] = businessId
        }
    }

    suspend fun clearTokens() {
        context.dataStore.edit { preferences ->
            preferences.remove(ACCESS_TOKEN_KEY)
            preferences.remove(REFRESH_TOKEN_KEY)
            preferences.remove(USER_ID_KEY)
            preferences.remove(USER_EMAIL_KEY)
            preferences.remove(BUSINESS_ID_KEY)
        }
    }
}
