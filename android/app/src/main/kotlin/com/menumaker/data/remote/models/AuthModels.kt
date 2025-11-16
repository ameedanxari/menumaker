package com.menumaker.data.remote.models

import com.google.gson.annotations.SerializedName

// Request models
data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)

data class SignupRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String,
    @SerializedName("name") val name: String,
    @SerializedName("phone") val phone: String? = null
)

data class RefreshTokenRequest(
    @SerializedName("refresh_token") val refreshToken: String
)

// Response models
data class AuthResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: AuthData
)

data class AuthData(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("refresh_token") val refreshToken: String,
    @SerializedName("user") val user: UserDto
)

data class UserDto(
    @SerializedName("id") val id: String,
    @SerializedName("email") val email: String,
    @SerializedName("name") val name: String,
    @SerializedName("phone") val phone: String?,
    @SerializedName("role") val role: String,
    @SerializedName("created_at") val createdAt: String
)
