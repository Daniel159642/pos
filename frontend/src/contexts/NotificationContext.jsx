import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const NotificationContext = createContext()

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  const refreshAllNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const [shipmentRes, scheduledRes] = await Promise.all([
        fetch('/api/shipment-issues?status=open&limit=50'),
        fetch('/api/scheduled-alerts')
      ])

      const shipmentData = await shipmentRes.json()
      const scheduledData = await scheduledRes.json()

      let list = []

      if (shipmentData.success && Array.isArray(shipmentData.data)) {
        list = [...list, ...shipmentData.data.map((issue) => ({
          id: `shipment_issue_${issue.issue_id}`,
          type: 'shipment_issue',
          title: `Shipment issue: ${issue.vendor_name || 'Vendor'}${issue.purchase_order_number ? ` (PO: ${issue.purchase_order_number})` : ''}`,
          body: issue.description || `${String(issue.issue_type || '').replace(/_/g, ' ')}`,
          time: issue.reported_at ? new Date(issue.reported_at).getTime() : Date.now(),
          pending_shipment_id: issue.pending_shipment_id,
          issue_id: issue.issue_id
        }))]
      }

      if (scheduledData.success && Array.isArray(scheduledData.data)) {
        list = [...list, ...scheduledData.data.map((alert) => ({
          id: `scheduled_alert_${alert.alert_id}`,
          type: 'order', // Using 'order' type so it shows the ShoppingBag icon
          title: alert.title,
          body: alert.body,
          time: alert.created_at ? new Date(alert.created_at).getTime() : Date.now(),
          alert_id: alert.alert_id,
          order_id: alert.order_id,
          order_number: alert.order_number,
          scheduled_time: alert.scheduled_time
        }))]
      }

      // Sort by time descending
      list.sort((a, b) => b.time - a.time)
      setNotifications(list)
    } catch (e) {
      console.error('Error fetching notifications:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('sessionToken') : null
    if (!token) {
      setNotifications([])
      return
    }
    refreshAllNotifications()
    const interval = setInterval(refreshAllNotifications, 30000)
    return () => clearInterval(interval)
  }, [refreshAllNotifications])

  const dismissNotification = useCallback(async (id) => {
    const notification = notifications.find(n => n.id === id)
    if (notification && notification.alert_id) {
      // Mark as viewed in backend
      try {
        await fetch('/api/scheduled-alerts/mark-viewed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alert_id: notification.alert_id })
        })
      } catch (e) {
        console.error('Error marking alert as viewed:', e)
      }
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [notifications])

  const value = {
    notifications,
    notificationCount: notifications.length,
    refreshNotifications: refreshAllNotifications,
    dismissNotification,
    loading
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
