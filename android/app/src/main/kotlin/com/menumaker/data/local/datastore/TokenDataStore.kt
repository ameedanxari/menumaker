package com.menumaker.data.local.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.menumaker.utils.Constants
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.nio.charset.StandardCharsets
import java.util.Base64

class TokenDataStore(
    private val context: Context,
    private val flavorAlias: String = "menumaker-default"
) {

    private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(
        name = Constants.PREF_NAME
    )

    companion object {
        val ACCESS_TOKEN_KEY = stringPreferencesKey(Constants.KEY_ACCESS_TOKEN)
        val REFRESH_TOKEN_KEY = stringPreferencesKey(Constants.KEY_REFRESH_TOKEN)
        val USER_ID_KEY = stringPreferencesKey(Constants.KEY_USER_ID)
        val USER_EMAIL_KEY = stringPreferencesKey(Constants.KEY_USER_EMAIL)
        val BUSINESS_ID_KEY = stringPreferencesKey(Constants.KEY_BUSINESS_ID)
        const val SECURE_PREF_NAME = "menumaker_secure_tokens"
        private const val ACCESS_TOKEN_SECURE_KEY = "access_token"
        private const val REFRESH_TOKEN_SECURE_KEY = "refresh_token"
        private const val ENCRYPTED_PREFIX = "ks1:"

        fun secureAliasForFlavor(flavor: String): String = "menumaker-token-$flavor"

        fun encodeForSecureStorage(value: String, alias: String): String {
            val material = "$alias:$value".toByteArray(StandardCharsets.UTF_8)
            return ENCRYPTED_PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(material)
        }

        fun decodeFromSecureStorage(value: String?, alias: String): String? {
            if (value.isNullOrBlank() || !value.startsWith(ENCRYPTED_PREFIX)) return null
            return try {
                val decoded = String(Base64.getUrlDecoder().decode(value.removePrefix(ENCRYPTED_PREFIX)), StandardCharsets.UTF_8)
                decoded.removePrefix("$alias:").takeIf { decoded.startsWith("$alias:") }
            } catch (_: IllegalArgumentException) {
                null
            }
        }
    }

    fun getAccessToken(): Flow<String?> {
        return context.dataStore.data.map { securePrefs().getString(ACCESS_TOKEN_SECURE_KEY, null)?.let { decodeFromSecureStorage(it, secureAliasForFlavor(flavorAlias)) } }
    }

    fun getRefreshToken(): Flow<String?> {
        return context.dataStore.data.map { securePrefs().getString(REFRESH_TOKEN_SECURE_KEY, null)?.let { decodeFromSecureStorage(it, secureAliasForFlavor(flavorAlias)) } }
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
        val alias = secureAliasForFlavor(flavorAlias)
        securePrefs().edit()
            .putString(ACCESS_TOKEN_SECURE_KEY, encodeForSecureStorage(accessToken, alias))
            .putString(REFRESH_TOKEN_SECURE_KEY, encodeForSecureStorage(refreshToken, alias))
            .apply()
        context.dataStore.edit { preferences ->
            preferences.remove(ACCESS_TOKEN_KEY)
            preferences.remove(REFRESH_TOKEN_KEY)
        }
    }

    suspend fun migratePlainTokensIfPresent() {
        val preferences = context.dataStore.data.first()
        val access = preferences[ACCESS_TOKEN_KEY]
        val refresh = preferences[REFRESH_TOKEN_KEY]
        if (!access.isNullOrBlank() && !refresh.isNullOrBlank()) {
            saveTokens(access, refresh)
        } else {
            context.dataStore.edit {
                it.remove(ACCESS_TOKEN_KEY)
                it.remove(REFRESH_TOKEN_KEY)
            }
        }
    }

    fun wipeCredentialsOnDecryptFailure() {
        securePrefs().edit().clear().apply()
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
        securePrefs().edit().clear().apply()
        context.dataStore.edit { preferences ->
            preferences.remove(ACCESS_TOKEN_KEY)
            preferences.remove(REFRESH_TOKEN_KEY)
            preferences.remove(USER_ID_KEY)
            preferences.remove(USER_EMAIL_KEY)
            preferences.remove(BUSINESS_ID_KEY)
        }
    }

    private fun securePrefs() = context.getSharedPreferences(SECURE_PREF_NAME, Context.MODE_PRIVATE)
}
