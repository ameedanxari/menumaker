package com.menumaker.repository

import android.content.ContentResolver
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.repository.AndroidUploadMetadata
import com.menumaker.data.repository.MediaRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.io.ByteArrayInputStream

@OptIn(ExperimentalCoroutinesApi::class)
class MediaRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var context: Context
    private lateinit var contentResolver: ContentResolver
    private lateinit var fakeApiService: FakeApiService
    private lateinit var repository: MediaRepositoryImpl
    private lateinit var uri: Uri

    @Before
    fun setup() {
        context = mock()
        contentResolver = mock()
        fakeApiService = FakeApiService()
        repository = MediaRepositoryImpl(context, fakeApiService)
        uri = mock()

        whenever(context.contentResolver).thenReturn(contentResolver)
        whenever(contentResolver.getType(uri)).thenReturn(" image/jpeg ")
        stubImageBytes(byteArrayOf(1, 2, 3, 4))
        stubDisplayName(" profile-photo.jpg ")
    }

    @Test
    fun `uploadImage trims safe metadata before multipart upload`() = runTest {
        val results = repository.uploadImage(uri).toList()

        assertThat(results.first()).isEqualTo(Resource.Loading)
        val success = results.last() as Resource.Success<String>
        assertThat(success.data).isEqualTo("https://cdn.menumaker.test/android-upload.jpg")
        assertThat(fakeApiService.uploadMediaCallCount).isEqualTo(1)

        val disposition = fakeApiService.lastUploadMediaPart?.headers?.get("Content-Disposition")
        assertThat(disposition).contains("filename=\"profile-photo.jpg\"")
    }

    @Test
    fun `uploadImage rejects multipart header breaking file name before API call`() = runTest {
        stubDisplayName("profile\"photo.jpg")

        val results = repository.uploadImage(uri).toList()

        val error = results.last() as Resource.Error
        assertThat(error.message).contains("unsupported multipart header characters")
        assertThat(fakeApiService.uploadMediaCallCount).isEqualTo(0)
    }

    @Test
    fun `uploadImage rejects invisible file name controls before API call`() = runTest {
        stubDisplayName("profile\u202Ephoto.jpg")

        val results = repository.uploadImage(uri).toList()

        val error = results.last() as Resource.Error
        assertThat(error.message).contains("unsafe control characters")
        assertThat(fakeApiService.uploadMediaCallCount).isEqualTo(0)
    }

    @Test
    fun `uploadImage rejects unsafe MIME metadata before reading file or calling API`() = runTest {
        whenever(contentResolver.getType(uri)).thenReturn("image/jpeg\u202E")

        val results = repository.uploadImage(uri).toList()

        val error = results.last() as Resource.Error
        assertThat(error.message).contains("unsafe control characters")
        assertThat(fakeApiService.uploadMediaCallCount).isEqualTo(0)
        verify(contentResolver, never()).openInputStream(any())
    }

    @Test
    fun `uploadImage rejects blank MIME metadata before API call`() = runTest {
        whenever(contentResolver.getType(uri)).thenReturn("  ")

        val results = repository.uploadImage(uri).toList()

        val error = results.last() as Resource.Error
        assertThat(error.message).contains("Upload MIME type is required")
        assertThat(fakeApiService.uploadMediaCallCount).isEqualTo(0)
    }

    @Test
    fun `uploadImage rejects oversized image before API call`() = runTest {
        stubImageBytes(ByteArray(AndroidUploadMetadata.MAX_UPLOAD_BYTES + 1) { 0x7F })

        val results = repository.uploadImage(uri).toList()

        val error = results.last() as Resource.Error
        assertThat(error.message).contains("5 MB")
        assertThat(fakeApiService.uploadMediaCallCount).isEqualTo(0)
    }

    private fun stubImageBytes(bytes: ByteArray) {
        whenever(contentResolver.openInputStream(uri)).thenAnswer {
            ByteArrayInputStream(bytes)
        }
    }

    private fun stubDisplayName(displayName: String) {
        val cursor = mock<Cursor>()
        whenever(cursor.moveToFirst()).thenReturn(true)
        whenever(cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)).thenReturn(0)
        whenever(cursor.getString(0)).thenReturn(displayName)
        whenever(
            contentResolver.query(
                eq(uri),
                any<Array<String>>(),
                isNull(),
                isNull(),
                isNull()
            )
        ).thenReturn(cursor)
    }
}
