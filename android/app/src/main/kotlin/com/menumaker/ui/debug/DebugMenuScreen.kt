package com.menumaker.ui.debug

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.menumaker.data.remote.api.ApiConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Composable
fun DebugMenuScreen(
    scope: CoroutineScope,
    onClose: () -> Unit
) {
    val baseUrl by ApiConfig.baseUrl.collectAsState()
    var input by remember(baseUrl) { mutableStateOf(baseUrl) }

    Column(modifier = Modifier.padding(16.dp)) {
        Text("Fake backend / API override")
        OutlinedTextField(
            value = input,
            onValueChange = { input = it },
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            label = { Text("API Base URL") }
        )
        Button(
            onClick = {
                scope.launch {
                    ApiConfig.overrideBaseUrl(input.trim())
                    onClose()
                }
            },
            modifier = Modifier.padding(top = 8.dp)
        ) {
            Text("Apply")
        }
        Button(
            onClick = {
                scope.launch {
                    ApiConfig.overrideBaseUrl(BuildConfig.API_BASE_URL_DEFAULT)
                    onClose()
                }
            },
            modifier = Modifier.padding(top = 8.dp)
        ) {
            Text("Reset to default")
        }
    }
}
