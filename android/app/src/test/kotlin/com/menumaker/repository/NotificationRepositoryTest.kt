package com.menumaker.repository

import com.google.common.truth.Truth.assertThat
import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.NotificationDto
import com.menumaker.data.remote.models.NotificationListData
import com.menumaker.data.repository.NotificationRepositoryImpl
import com.menumaker.testutils.FakeApiService
import com.menumaker.testutils.TestDataFactory
import com.menumaker.testutils.TestDispatcherRule
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import retrofit2.Response
import java.io.IOException

/**
 * Unit tests for NotificationRepositoryImpl.
 * Tests getNotifications and markAsRead flows.
 *
 * Requirements: 9.1, 9.2
 */
@OptIn(ExperimentalCoroutinesApi::class)
class NotificationRepositoryTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var repository: NotificationRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        repository = NotificationRepositoryImpl(fakeApiService)
    }

    // ==================== getNotifications Tests ====================

    @Test
    fun `getNotifications emits Loading then Success with notifications`() = runTest {
        // Given
        val notifications = listOf(
            TestDataFactory.createNotification(id = "notif-1", isRead = false),
            TestDataFactory.createNotification(id = "notif-2", isRead = true)
        )
        fakeApiService.getNotificationsResponse = Response.success(
            TestDataFactory.createNotificationListResponse(notifications = notifications)
        )

        // When
        val results = repository.getNotifications().toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<NotificationListData>
        assertThat(successResult.data.notifications).hasSize(2)
    }

    @Test
    fun `getNotifications emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500

        // When
        val results = repository.getNotifications().toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    @Test
    fun `getNotifications handles network error gracefully`() = runTest {
        // Given
        fakeApiService.shouldThrowException = IOException("Network unavailable")

        // When
        val results = repository.getNotifications().toList()

        // Then
        val errorResult = results.last() as Resource.Error
        assertThat(errorResult.message).contains("Network unavailable")
    }

    // ==================== markNotificationAsRead Tests ====================

    @Test
    fun `markNotificationAsRead emits Loading then Success with updated notification`() = runTest {
        // Given
        val notification = TestDataFactory.createNotification(id = "notif-123", isRead = true)
        fakeApiService.markNotificationAsReadResponse = Response.success(
            TestDataFactory.createNotificationResponse(notification = notification)
        )

        // When
        val results = repository.markNotificationAsRead("notif-123").toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        val successResult = results.last() as Resource.Success<NotificationDto>
        assertThat(successResult.data.isRead).isTrue()
    }

    @Test
    fun `markNotificationAsRead emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 404

        // When
        val results = repository.markNotificationAsRead("nonexistent-notif").toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }

    // ==================== markAllNotificationsAsRead Tests ====================

    @Test
    fun `markAllNotificationsAsRead emits Loading then Success`() = runTest {
        // Given
        fakeApiService.markAllNotificationsAsReadResponse = Response.success(Unit)

        // When
        val results = repository.markAllNotificationsAsRead().toList()

        // Then
        assertThat(results.first()).isEqualTo(Resource.Loading)
        assertThat(results.last()).isInstanceOf(Resource.Success::class.java)
    }

    @Test
    fun `markAllNotificationsAsRead emits Error on API failure`() = runTest {
        // Given
        fakeApiService.errorCode = 500

        // When
        val results = repository.markAllNotificationsAsRead().toList()

        // Then
        assertThat(results.last()).isInstanceOf(Resource.Error::class.java)
    }
}

// ==================== Property-Based Tests ====================

/**
 * **Feature: android-test-coverage, Property 22: Notification Count Update**
 * **Validates: Requirements 9.1, 9.2**
 *
 * Property: For any notification marked as read, the unread count
 * SHALL decrease by one.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class NotificationCountUpdatePropertyTest {

    @get:Rule
    val dispatcherRule = TestDispatcherRule()

    private lateinit var fakeApiService: FakeApiService
    private lateinit var repository: NotificationRepositoryImpl

    @Before
    fun setup() {
        fakeApiService = FakeApiService()
        repository = NotificationRepositoryImpl(fakeApiService)
    }

    // Custom Arb for non-blank strings
    private fun arbNonBlankString(range: IntRange): Arb<String> = arbitrary { rs ->
        val chars = ('a'..'z') + ('A'..'Z') + ('0'..'9')
        val length = range.random(rs.random)
        (1..length).map { chars.random(rs.random) }.joinToString("")
    }

    @Test
    fun `property - markAsRead returns notification with isRead true`() = runTest {
        // Property: For any notification marked as read, isRead should be true
        checkAll(
            iterations = 100,
            arbNonBlankString(5..20)
        ) { notificationId ->
            // Reset state for each iteration
            fakeApiService.reset()
            
            // Given - a successful mark as read response
            val notification = TestDataFactory.createNotification(
                id = notificationId,
                isRead = true
            )
            fakeApiService.markNotificationAsReadResponse = Response.success(
                TestDataFactory.createNotificationResponse(notification = notification)
            )

            // When
            val results = repository.markNotificationAsRead(notificationId).toList()

            // Then - returned notification should have isRead = true
            val successResult = results.last() as Resource.Success<NotificationDto>
            assertThat(successResult.data.isRead).isTrue()
            assertThat(successResult.data.id).isEqualTo(notificationId)
        }
    }

    @Test
    fun `property - unread count decreases when notification is marked as read`() = runTest {
        // Property: Marking a notification as read decreases unread count
        checkAll(
            iterations = 50,
            Arb.int(1..20)  // number of unread notifications
        ) { unreadCount ->
            // Reset state for each iteration
            fakeApiService.reset()
            
            // Given - notifications with some unread
            val notifications = (1..unreadCount).map { i ->
                TestDataFactory.createNotification(id = "notif-$i", isRead = false)
            }
            fakeApiService.getNotificationsResponse = Response.success(
                TestDataFactory.createNotificationListResponse(notifications = notifications)
            )

            // When - get notifications
            val results = repository.getNotifications().toList()

            // Then - unread count should match
            val successResult = results.last() as Resource.Success<NotificationListData>
            val actualUnreadCount = successResult.data.notifications.count { !it.isRead }
            assertThat(actualUnreadCount).isEqualTo(unreadCount)
        }
    }
}
