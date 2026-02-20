import { useEffect, useState, useRef } from 'react'
import { ShoppingBag, Calendar, Info, AlertTriangle, X } from 'lucide-react'

const ANIM_DURATION_MS = 250

/**
 * Transparent notification area: slides in from the right. No header, no X — click outside to close.
 * Only the notification items have a container background; panel background is clear.
 * onNotificationClick(notification): when user clicks a notification (e.g. open shipment report).
 */
export default function NotificationPanel({ open, onClose, notifications = [], onNotificationClick, onDismissNotification }) {
  const [isExiting, setIsExiting] = useState(false)
  const [dismissingNotifications, setDismissingNotifications] = useState([])
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      setIsExiting(false)
    } else if (wasOpenRef.current) {
      setIsExiting(true)
    }
  }, [open])

  useEffect(() => {
    if (!open && !isExiting) return
    const handleEscape = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, isExiting, onClose])

  const handlePanelAnimationEnd = (e) => {
    if (e.animationName === 'notificationPanelOut') {
      wasOpenRef.current = false
      setIsExiting(false)
    }
  }

  const handleDismiss = (id) => {
    const notification = notifications.find((n) => n.id === id)
    if (notification) {
      setDismissingNotifications((prev) => [...prev, notification])
      setTimeout(() => {
        onDismissNotification?.(id)
        setDismissingNotifications((prev) => prev.filter((n) => n.id !== id))
      }, 250) // Match animation duration
    }
  }

  const handleNotificationDismissEnd = (e) => {
    if (e.animationName === 'notificationDismissOut') {
      // Animation complete
    }
  }

  // Show current notifications plus any that are dismissing (to allow animation to complete)
  const allNotifications = [...notifications, ...dismissingNotifications.filter((dn) => !notifications.find((n) => n.id === dn.id))]

  if (!open && !isExiting) return null

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
      case 'shipment_issue': return <AlertTriangle size={18} style={{ color: 'rgba(244, 67, 54, 0.9)', flexShrink: 0 }} />
      default: return <Info size={18} style={{ color: 'var(--text-tertiary, #666)', flexShrink: 0 }} />
    }
  }

  const isClickable = (n) => n.type === 'shipment_issue' && n.pending_shipment_id

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
          padding: '12px 12px 12px 20px',
          animation: isExiting
            ? `notificationPanelOut ${ANIM_DURATION_MS}ms ease-in forwards`
            : `notificationPanelIn ${ANIM_DURATION_MS}ms ease-out`
        }}
        onAnimationEnd={handlePanelAnimationEnd}
        onClick={(e) => e.stopPropagation()}
        className="notification-panel"
      >
        {allNotifications.length === 0 ? (
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, transition: 'gap 0.25s ease-out' }}>
            {allNotifications.map((n) => {
              const clickable = isClickable(n)
              const isDismissing = dismissingNotifications.some((dn) => dn.id === n.id)
              return (
                <div
                  key={n.id}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => onNotificationClick?.(n) : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter') onNotificationClick?.(n) } : undefined}
                  onAnimationEnd={handleNotificationDismissEnd}
                  className={`notification-card notification-card--with-dismiss ${isDismissing ? 'notification-card--dismissing' : ''}`}
                  style={{
                    position: 'relative',
                    padding: '12px 16px',
                    borderRadius: 12,
                    cursor: clickable ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                    border: '1px solid var(--border-light, rgba(0, 0, 0, 0.06))',
                    animation: isDismissing ? 'notificationDismissOut 250ms ease-out forwards' : undefined,
                    overflow: 'visible'
                  }}
                >
                  {onDismissNotification && (
                    <button
                      type="button"
                      className="notification-card__dismiss"
                      aria-label="Dismiss notification"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDismiss(n.id)
                      }}
                      style={{
                        position: 'absolute',
                        top: -8,
                        left: -8,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.95)',
                        color: 'var(--text-secondary, #666)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
                        transition: 'opacity 0.15s, background 0.15s, transform 0.15s',
                        zIndex: 10
                      }}
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  )}
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
                      {clickable && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #666)', marginTop: 4 }}>
                          Click to open shipment report
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style>{`
        @keyframes notificationPanelIn {
          from { transform: translateX(100%); opacity: 0.95; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes notificationPanelOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0.95; }
        }
        @keyframes notificationDismissOut {
          from {
            opacity: 1;
            transform: translateY(0);
            max-height: 200px;
            margin-bottom: 8px;
          }
          to {
            opacity: 0;
            transform: translateY(-10px);
            max-height: 0;
            margin-bottom: 0;
            padding-top: 0;
            padding-bottom: 0;
          }
        }
        .notification-card__dismiss {
          opacity: 0;
        }
        .notification-card--with-dismiss:hover .notification-card__dismiss {
          opacity: 1;
        }
        .notification-card--with-dismiss .notification-card__dismiss:hover {
          background: rgba(0, 0, 0, 0.08);
          transform: scale(1.1);
        }
        .notification-card--dismissing {
          overflow: hidden;
        }
      `}</style>
    </>
  )
}
