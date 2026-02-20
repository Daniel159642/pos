import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const NotificationContext = createContext()

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchShipmentIssueNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/shipment-issues?status=open&limit=50')
      const data = await res.json()
      if (!data.success || !Array.isArray(data.data)) {
        setNotifications([])
        return
      }
      const list = data.data.map((issue) => ({
        id: `shipment_issue_${issue.issue_id}`,
        type: 'shipment_issue',
        title: `Shipment issue: ${issue.vendor_name || 'Vendor'}${issue.purchase_order_number ? ` (PO: ${issue.purchase_order_number})` : ''}`,
        body: issue.description || `${String(issue.issue_type || '').replace(/_/g, ' ')}`,
        time: issue.reported_at ? new Date(issue.reported_at).getTime() : Date.now(),
        pending_shipment_id: issue.pending_shipment_id,
        issue_id: issue.issue_id
      }))
      setNotifications(list)
    } catch (e) {
      console.error('Error fetching shipment issue notifications:', e)
      setNotifications([])
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
    fetchShipmentIssueNotifications()
    const interval = setInterval(fetchShipmentIssueNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchShipmentIssueNotifications])

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const value = {
    notifications,
    notificationCount: notifications.length,
    refreshNotifications: fetchShipmentIssueNotifications,
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
