package com.menumaker.data.repository

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.api.ApiService
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject

interface MediaRepository {
    fun uploadImage(uri: Uri): Flow<Resource<String>>
}

class MediaRepositoryImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val apiService: ApiService
) : MediaRepository {
    override fun uploadImage(uri: Uri): Flow<Resource<String>> = flow {
        emit(Resource.Loading)
        try {
            val part = withContext(Dispatchers.IO) { uri.toMultipartPart() }
            val response = apiService.uploadMedia(part)
            if (response.isSuccessful && response.body() != null) {
                emit(Resource.Success(response.body()!!.data.url))
            } else {
                emit(Resource.Error(response.message() ?: "Failed to upload image"))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e.message ?: "Failed to upload image", e))
        }
    }

    private fun Uri.toMultipartPart(): MultipartBody.Part {
        val mimeType = AndroidUploadMetadata.normalizeMimeType(context.contentResolver.getType(this) ?: "image/jpeg")
        val fileName = AndroidUploadMetadata.normalizeFileName(
            displayName() ?: "android-upload-${System.currentTimeMillis()}.jpg"
        )
        val bytes = context.contentResolver.openInputStream(this)?.use { input ->
            input.readBytes()
        } ?: throw IllegalArgumentException("Unable to read selected image")
        AndroidUploadMetadata.requireSupportedSize(bytes.size)

        val mediaType = mimeType.toMediaTypeOrNull()
            ?: throw IllegalArgumentException("Upload MIME type is invalid")
        val requestBody = bytes.toRequestBody(mediaType)
        return MultipartBody.Part.createFormData("file", fileName, requestBody)
    }

    private fun Uri.displayName(): String? {
        return context.contentResolver.query(this, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (index >= 0) cursor.getString(index) else null
                } else {
                    null
                }
            }
    }
}

internal object AndroidUploadMetadata {
    const val MAX_UPLOAD_BYTES: Int = 5 * 1024 * 1024
    private val forbiddenFileNameCharacters = setOf('"', '\\', '/', ':', ';')
    private val forbiddenMimeCharacters = setOf('"', '\\', ';', ',')

    fun normalizeFileName(fileName: String): String {
        val normalized = fileName.trim()
        require(normalized.isNotEmpty()) { "Upload file name is required" }
        require(normalized.none { it.isUnsafeUploadMetadataCharacter() }) {
            "Upload file name contains unsafe control characters"
        }
        require(normalized.none { it in forbiddenFileNameCharacters }) {
            "Upload file name contains unsupported multipart header characters"
        }
        return normalized
    }

    fun normalizeMimeType(mimeType: String): String {
        val normalized = mimeType.trim()
        require(normalized.isNotEmpty()) { "Upload MIME type is required" }
        require(normalized.none { it.isUnsafeUploadMetadataCharacter() || it.isWhitespace() }) {
            "Upload MIME type contains unsafe control characters"
        }
        require(normalized.none { it in forbiddenMimeCharacters }) {
            "Upload MIME type contains unsupported multipart header characters"
        }
        require(normalized.count { it == '/' } == 1 && !normalized.startsWith("/") && !normalized.endsWith("/")) {
            "Upload MIME type is invalid"
        }
        return normalized
    }

    fun requireSupportedSize(byteCount: Int) {
        require(byteCount <= MAX_UPLOAD_BYTES) {
            "Upload image exceeds 5 MB limit"
        }
    }

    private fun Char.isUnsafeUploadMetadataCharacter(): Boolean {
        return code in 0x00..0x1F ||
            code in 0x7F..0x9F ||
            Character.getType(this) == Character.FORMAT.toInt()
    }
}
