package com.menumaker.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = Primary500,
    onPrimary = Neutral50,
    primaryContainer = Primary700,
    onPrimaryContainer = Primary50,
    secondary = Secondary500,
    onSecondary = Neutral50,
    secondaryContainer = Secondary700,
    onSecondaryContainer = Secondary50,
    tertiary = Warning500,
    error = Error500,
    errorContainer = Error500,
    onError = Neutral50,
    background = BackgroundDark,
    onBackground = Neutral50,
    surface = SurfaceDark,
    onSurface = Neutral50,
    surfaceVariant = Neutral800,
    onSurfaceVariant = Neutral300,
    outline = Neutral600,
    outlineVariant = Neutral700,
)

private val LightColorScheme = lightColorScheme(
    primary = Primary500,
    onPrimary = Neutral50,
    primaryContainer = Primary100,
    onPrimaryContainer = Primary900,
    secondary = Secondary500,
    onSecondary = Neutral50,
    secondaryContainer = Secondary50,
    onSecondaryContainer = Secondary700,
    tertiary = Warning500,
    error = Error500,
    errorContainer = Error500,
    onError = Neutral50,
    background = BackgroundLight,
    onBackground = Neutral900,
    surface = SurfaceLight,
    onSurface = Neutral900,
    surfaceVariant = Neutral100,
    onSurfaceVariant = Neutral700,
    outline = Neutral400,
    outlineVariant = Neutral300,
)

@Composable
fun MenuMakerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Dynamic color is available on Android 12+
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }

        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
