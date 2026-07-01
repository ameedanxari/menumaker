package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.api.ApiService
import com.menumaker.data.remote.models.IntegrationDto
import com.menumaker.data.repository.IntegrationRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import java.io.IOException

/**
 * Unit tests for IntegrationRepositoryImpl.
 * Tests getIntegrations and connectIntegration flows.
 *
 * Requirements: 12.1, 12.2
 */
@OptIn(ExperimentalCoroutinesApi::class)
class IntegrationRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var repository: IntegrationRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        repository = IntegrationRepositoryImpl(fakeApiService)
    }

    // ==================== getIntegrations Tests ====================

    @Test
    fun `getIntegrations suppresses launch-gated POS and delivery rows`() = runTest {
        // Given
        val integrations = listOf(
            TestDataFactory.createIntegration(id = "int-1", provider = "square", type = "pos"),
            TestDataFactory.createIntegration(id = "int-2", provider = "doordash", type = " DELIVERY ")
        )
        fakeApiService.getIntegrationsResponse = Response.success(
            TestDataFactory.createIntegrationListResponse(integrations = integrations)
        )

        // When
        val results = repository.getIntegrations("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<List<IntegrationDto>>
        assertThat(successResult.data).isEmpty()
    }

    @Test
    fun `getIntegrations hides unsafe stale integration rows while launch gated`() = runTest {
        // Given
        val integrations = listOf(
            TestDataFactory.createIntegration(id = "int-1", provider = "square", type = "pos\u202E"),
            TestDataFactory.createIntegration(id = "int-2", provider = "door\u200Bdash", type = "delivery"),
            TestDataFactory.createIntegration(id = "int-\u20603", provider = "stripe", type = "payment")
        )
        fakeApiService.getIntegrationsResponse = Response.success(
            TestDataFactory.createIntegrationListResponse(integrations = integrations)
        )

        // When
        val results = repository.getIntegrations("business-123").toList()

        // Then
        val successResult = results.last() as Resource.Success<List<IntegrationDto>>
        assertThat(successResult.data).isEmpty()
    }

    @Test
    fun `getIntegrations hides malformed stale integration rows while preserving valid visible rows`() = runTest {
        // Given
        val integrations = listOf(
            TestDataFactory.createIntegration(id = "   ", provider = "stripe", type = "payment"),
            TestDataFactory.createIntegration(id = "int-2", provider = "   ", type = "payment"),
            TestDataFactory.createIntegration(id = "int-3", provider = "stripe", type = "   "),
            TestDataFactory.createIntegration(id = "int-4", provider = "s".repeat(65), type = "payment"),
            TestDataFactory.createIntegration(id = "int-5", provider = "stripe", type = "p".repeat(65)),
            TestDataFactory.createIntegration(id = "int-visible", provider = "stripe", type = "payment")
        )
        fakeApiService.getIntegrationsResponse = Response.success(
            TestDataFactory.createIntegrationListResponse(integrations = integrations)
        )

        // When
        val results = repository.getIntegrations("business-123").toList()

        // Then
        val successResult = results.last() as Resource.Success<List<IntegrationDto>>
        assertThat(successResult.data).hasSize(1)
        assertThat(successResult.data.single().id).isEqualTo("int-visible")
        assertThat(successResult.data.single().provider).isEqualTo("stripe")
        assertThat(successResult.data.single().type).isEqualTo("payment")
    }

    @Test
    fun `getIntegrations trims business ID before API call`() = runTest {
        // When
        val results = repository.getIntegrations(" business-123 ").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Success::class.java)
        assertThat(fakeApiService.lastGetIntegrationsBusinessId).isEqualTo("business-123")
    }

    @Test
    fun `getIntegrations rejects unsafe business ID before API call`() = runTest {
        // When
        val results = repository.getIntegrations("business\u0000123").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Business ID contains unsafe control characters")
        assertThat(fakeApiService.lastGetIntegrationsBusinessId).isNull()
    }

    @Test
    fun `getIntegrations rejects invisible control business ID before API call`() = runTest {
        // When
        val results = repository.getIntegrations("business\u202E123").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Business ID contains unsafe control characters")
        assertThat(fakeApiService.lastGetIntegrationsBusinessId).isNull()
    }

    @Test
    fun `getIntegrations emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500

        // When
        val results = repository.getIntegrations("business-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `getIntegrations handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.getIntegrations("business-123").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    @Test
    fun `ApiService does not expose direct disabled capability endpoints`() {
        val disabledRoutePrefixes = listOf(
            "pos",
            "delivery",
            "ocr",
            "tax",
            "tax-reports",
            "reports/tax",
            "subscriptions",
            "affiliates",
            "leaderboard",
            "badges",
            "customers/referrals",
            "referrals/share",
            "referrals/leaderboard"
        )
        val exposedDisabledRoutes = ApiService::class.java.methods
            .mapNotNull { method ->
                method.retrofitRoute()?.trimStart('/')?.let { route ->
                    method.name to route
                }
            }
            .filter { (_, route) ->
                disabledRoutePrefixes.any { prefix ->
                    route == prefix || route.startsWith("$prefix/")
                }
            }

        assertThat(exposedDisabledRoutes).isEmpty()
    }

    // ==================== connectPOS Tests ====================

    @Test
    fun `connectPOS emits Loading then launch-gated Error without provider success`() = runTest {
        // When
        val results = repository.connectPOS(" square ").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("POS provider 'square' is launch-gated")
    }

    @Test
    fun `connectPOS rejects unsafe provider text without echoing it`() = runTest {
        // When
        val results = repository.connectPOS("square\u0000").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("POS provider contains unsafe control characters")
        assertThat(errorResult.message).doesNotContain("square\u0000")
    }

    @Test
    fun `connectPOS rejects invisible provider controls without echoing them`() = runTest {
        // When
        val results = repository.connectPOS("square\u200B").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("POS provider contains unsafe control characters")
        assertThat(errorResult.message).doesNotContain("square\u200B")
    }

    @Test
    fun `connectPOS ignores API failure while launch-gated`() = runTest {
        // Given
        fakeApiService.errorCode = 400

        // When
        val results = repository.connectPOS("invalid-provider").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("POS provider 'invalid-provider' is launch-gated")
    }

    @Test
    fun `connectPOS does not surface network errors while launch-gated`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Connection timeout")

        // When
        val results = repository.connectPOS("square").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("POS provider 'square' is launch-gated")
        assertThat(errorResult.message).doesNotContain("Connection timeout")
    }

    // ==================== connectDelivery Tests ====================

    @Test
    fun `connectDelivery emits Loading then launch-gated Error without provider success`() = runTest {
        // When
        val results = repository.connectDelivery(" doordash ").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Delivery provider 'doordash' is launch-gated")
    }

    @Test
    fun `connectDelivery rejects blank provider text before launch-gated message`() = runTest {
        // When
        val results = repository.connectDelivery("   ").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Delivery provider is required")
    }

    @Test
    fun `connectDelivery ignores API failure while launch-gated`() = runTest {
        // Given
        fakeApiService.errorCode = 400

        // When
        val results = repository.connectDelivery("invalid-provider").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Delivery provider 'invalid-provider' is launch-gated")
    }

    // ==================== disconnectIntegration Tests ====================

    @Test
    fun `disconnectIntegration emits Loading then launch-gated Error without backend call`() = runTest {
        // When
        val results = repository.disconnectIntegration(" int-123 ").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Integration disconnect for 'int-123' is launch-gated")
        assertThat(errorResult.message).contains("POS and delivery-provider integrations remain disabled")
        assertThat(fakeApiService.lastDisconnectIntegrationId).isNull()
    }

    @Test
    fun `disconnectIntegration rejects unsafe integration ID without backend call`() = runTest {
        // When
        val results = repository.disconnectIntegration("int\u0000123").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Integration ID contains unsafe control characters")
        assertThat(fakeApiService.lastDisconnectIntegrationId).isNull()
    }

    @Test
    fun `disconnectIntegration rejects invisible control integration ID without backend call`() = runTest {
        // When
        val results = repository.disconnectIntegration("int\u2060123").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Integration ID contains unsafe control characters")
        assertThat(fakeApiService.lastDisconnectIntegrationId).isNull()
    }

    @Test
    fun `disconnectIntegration ignores API failure while launch-gated`() = runTest {
        // Given
        fakeApiService.errorCode = 404

        // When
        val results = repository.disconnectIntegration("nonexistent-int").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Integration disconnect for 'nonexistent-int' is launch-gated")
        assertThat(errorResult.message).doesNotContain("Error")
    }

    @Test
    fun `disconnectIntegration does not surface network errors while launch-gated`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.disconnectIntegration("int-123").toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Integration disconnect for 'int-123' is launch-gated")
        assertThat(errorResult.message).doesNotContain("Network unavailable")
    }
}

private fun java.lang.reflect.Method.retrofitRoute(): String? =
    getAnnotation(GET::class.java)?.value
        ?: getAnnotation(POST::class.java)?.value
        ?: getAnnotation(PUT::class.java)?.value
        ?: getAnnotation(PATCH::class.java)?.value
        ?: getAnnotation(DELETE::class.java)?.value
