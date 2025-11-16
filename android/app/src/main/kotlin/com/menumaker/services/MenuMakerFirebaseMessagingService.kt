package com.menumaker.services

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.menumaker.MainActivity
import com.menumaker.MenuMakerApplication
import com.menumaker.R

class MenuMakerFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val orderId = message.data["orderId"]
        val total = message.data["total"]
        val customerName = message.data["customerName"]

        if (orderId != null) {
            showOrderNotification(orderId, total, customerName)
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // TODO: Send token to backend
    }

    private fun showOrderNotification(
        orderId: String,
        total: String?,
        customerName: String?
    ) {
        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra("orderId", orderId)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, MenuMakerApplication.CHANNEL_ORDERS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("New Order")
            .setContentText("₹$total from $customerName")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager?.notify(orderId.hashCode(), notification)
    }
}
