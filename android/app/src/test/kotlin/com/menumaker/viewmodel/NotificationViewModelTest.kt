package com.menumaker.viewmodel

import com.menumaker.data.common.Resource
import com.menumaker.data.remote.models.NotificationDto
import com.menumaker.data.remote.models.NotificationListData
import com.menumaker.data.remote.models.NotificationType
import com.menumaker.data.repository.NotificationRepository
import com.menumaker.services.AnalyticsService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.Mockito
import org.mockito.MockitoAnnotations

@ExperimentalCoroutinesApi
class NotificationViewModelTest {

    @Mock
    private lateinit var repository: NotificationRepository
    
    @Mock
    private lateinit var analyticsService: AnalyticsService

    private lateinit var viewModel: NotificationViewModel

    private val testDispatcher = UnconfinedTestDispatcher()
    
    private val mockNotification = NotificationDto(
        id = "n1",
        userId = "u1",
        type = NotificationType.SYSTEM,
        title = "Title",
        message = "Message",
        isRead = false,
        createdAt = "2024-01-01",
        data = null
    )
    
    private val mockNotificationList = NotificationListData(
        notifications = listOf(mockNotification),
        total = 1,
        limit = 50,
        offset = 0
    )

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)
        
        val flow = flow { emit(Resource.Success(mockNotificationList)) }
        Mockito.`when`(repository.getNotifications()).thenReturn(flow)

        viewModel = NotificationViewModel(repository, analyticsService)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadNotifications updates notifications`() = runTest {
        assertEquals(1, viewModel.notifications.value.size)
        assertEquals(1, viewModel.unreadCount.value)
    }

    @Test
    fun `markAsRead updates local state`() = runTest {
        Mockito.`when`(repository.markNotificationAsRead("n1")).thenReturn(flow { emit(Resource.Success(mockNotification.copy(isRead = true))) })
        
        viewModel.markAsRead("n1")
        
        assertTrue(viewModel.notifications.value[0].isRead)
        assertEquals(0, viewModel.unreadCount.value)
    }

    @Test
    fun `markAllAsRead updates all`() = runTest {
         Mockito.`when`(repository.markAllNotificationsAsRead()).thenReturn(flow { emit(Resource.Success(Unit)) })
         
         viewModel.markAllAsRead()
         
         assertTrue(viewModel.notifications.value[0].isRead)
         assertEquals(0, viewModel.unreadCount.value)
    }

    // MARK: - Enhanced Tests for Requirements 9.1, 9.2

    @Test
    fun `markAsRead decrements unread count by one`() = runTest {
        // Given - initial state has 1 unread notification
        assertEquals(1, viewModel.unreadCount.value)
        
        Mockito.`when`(repository.markNotificationAsRead("n1")).thenReturn(
            flow { emit(Resource.Success(mockNotification.copy(isRead = true))) }
        )
        
        // When
        viewModel.markAsRead("n1")
        
        // Then
        assertEquals(0, viewModel.unreadCount.value)
    }

    @Test
    fun `markAllAsRead sets unread count to zero`() = runTest {
        // Given - initial state has unread notifications
        assertTrue(viewModel.unreadCount.value > 0)
        
        Mockito.`when`(repository.markAllNotificationsAsRead()).thenReturn(
            flow { emit(Resource.Success(Unit)) }
        )
        
        // When
        viewModel.markAllAsRead()
        
        // Then
        assertEquals(0, viewModel.unreadCount.value)
    }

    @Test
    fun `loadNotifications with multiple unread updates count correctly`() = runTest {
        // Given
        val notification1 = mockNotification.copy(id = "n1", isRead = false)
        val notification2 = mockNotification.copy(id = "n2", isRead = false)
        val notification3 = mockNotification.copy(id = "n3", isRead = true)
        val notificationList = NotificationListData(
            notifications = listOf(notification1, notification2, notification3),
            total = 3,
            limit = 50,
            offset = 0
        )
        
        Mockito.`when`(repository.getNotifications()).thenReturn(
            flow { emit(Resource.Success(notificationList)) }
        )
        
        // When - create new viewModel to trigger loadNotifications
        viewModel = NotificationViewModel(repository, analyticsService)
        
        // Then
        assertEquals(3, viewModel.notifications.value.size)
        assertEquals(2, viewModel.unreadCount.value) // 2 unread
    }

    @Test
    fun `markAsRead updates notification isRead status`() = runTest {
        // Given
        assertFalse(viewModel.notifications.value[0].isRead)
        
        Mockito.`when`(repository.markNotificationAsRead("n1")).thenReturn(
            flow { emit(Resource.Success(mockNotification.copy(isRead = true))) }
        )
        
        // When
        viewModel.markAsRead("n1")
        
        // Then
        assertTrue(viewModel.notifications.value[0].isRead)
    }

    @Test
    fun `loadNotifications with empty list returns empty state`() = runTest {
        // Given
        val emptyList = NotificationListData(
            notifications = emptyList(),
            total = 0,
            limit = 50,
            offset = 0
        )
        
        Mockito.`when`(repository.getNotifications()).thenReturn(
            flow { emit(Resource.Success(emptyList)) }
        )
        
        // When
        viewModel = NotificationViewModel(repository, analyticsService)
        
        // Then
        assertTrue(viewModel.notifications.value.isEmpty())
        assertEquals(0, viewModel.unreadCount.value)
    }

    @Test
    fun `markAsRead with non-existent id does not crash`() = runTest {
        // Given
        Mockito.`when`(repository.markNotificationAsRead("non-existent")).thenReturn(
            flow { emit(Resource.Error("Notification not found")) }
        )
        
        // When - should not throw
        viewModel.markAsRead("non-existent")
        
        // Then - original state should be preserved
        assertEquals(1, viewModel.notifications.value.size)
    }

    @Test
    fun `unread count reflects actual unread notifications`() = runTest {
        // Given - all notifications are read
        val readNotification = mockNotification.copy(isRead = true)
        val notificationList = NotificationListData(
            notifications = listOf(readNotification),
            total = 1,
            limit = 50,
            offset = 0
        )
        
        Mockito.`when`(repository.getNotifications()).thenReturn(
            flow { emit(Resource.Success(notificationList)) }
        )
        
        // When
        viewModel = NotificationViewModel(repository, analyticsService)
        
        // Then
        assertEquals(0, viewModel.unreadCount.value)
    }
}
