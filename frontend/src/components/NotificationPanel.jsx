import { useEffect } from 'react'
import { ShoppingBag, Calendar, Info } from 'lucide-react'

/**
 * Transparent notification area: slides in from the right. No header, no X — click outside to close.
 * Only the notification items have a container background; panel background is clear.
 */
export default function NotificationPanel({ open, onClose, notifications = [] }) {
  useEffect(() => {
    if (!open) return
    const handleEscape = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  const formatTime = (t) => {
    if (!t) return ''
    const d = typeof t === 'number' ? new Date(t) : new Date(t)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const iconForType = (type) => {
    switch (type) {
      case 'order': return <ShoppingBag size={18} style={{ color: 'var(--text-tertiary, #666)', flexShrink: 0 }} />
      case 'schedule': return <Calendar size={18} style={{ color: 'var(--text-tertiary, #666)', flexShrink: 0 }} />
      default: return <Info size={18} style={{ color: 'var(--text-tertiary, #666)', flexShrink: 0 }} />
    }
  }

  return (
    <>
      {/* Invisible overlay — click outside to close; page stays bright */}
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'transparent',
          zIndex: 1099
        }}
      />
      {/* Transparent panel sliding from right; only notification cards have background */}
      <div
        role="dialog"
        aria-label="Notifications"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(380px, 92vw)',
          maxWidth: 380,
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          background: 'transparent',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 12px 12px 0',
          animation: 'notificationPanelIn 0.25s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
        className="notification-panel"
      >
        {notifications.length === 0 ? (
          <div
            className="notification-empty"
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-tertiary, #666)',
              fontSize: 14,
              background: 'rgba(255, 255, 255, 0.7)',
              borderRadius: 12,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)'
            }}
          >
            No notifications yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                className="notification-card"
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  cursor: 'default',
                  transition: 'background 0.15s',
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                  border: '1px solid var(--border-light, rgba(0, 0, 0, 0.06))'
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ marginTop: 2 }}>{iconForType(n.type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #000)', marginBottom: 2 }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary, #333)', lineHeight: 1.4 }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary, #666)', marginTop: 4 }}>
                      {formatTime(n.time)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`
        @keyframes notificationPanelIn {
          from { transform: translateX(100%); opacity: 0.95; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
