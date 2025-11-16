package com.menumaker.services

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import androidx.core.content.FileProvider
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ImageService @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val photoDir: File by lazy {
        File(context.cacheDir, "photos").apply {
            if (!exists()) mkdirs()
        }
    }

    fun createImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val imageFileName = "JPEG_${timeStamp}_"
        return File.createTempFile(imageFileName, ".jpg", photoDir)
    }

    fun getUriForFile(file: File): Uri {
        return FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
    }

    fun saveBitmap(bitmap: Bitmap): File? {
        return try {
            val file = createImageFile()
            FileOutputStream(file).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
            }
            file
        } catch (e: IOException) {
            e.printStackTrace()
            null
        }
    }

    fun clearCache() {
        photoDir.listFiles()?.forEach { it.delete() }
    }
}
