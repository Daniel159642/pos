import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null) // { message, type: 'success' | 'error' | 'warning', action?: { label, onClick } }

  const show = useCallback((message, type = 'success', actionOrOptions) => {
    const action = actionOrOptions && (actionOrOptions.label != null || actionOrOptions.onClick != null)
      ? actionOrOptions
      : undefined
    const icon = actionOrOptions && actionOrOptions.icon ? actionOrOptions.icon : undefined
    const autoDismiss = actionOrOptions && 'autoDismiss' in actionOrOptions ? actionOrOptions.autoDismiss : 4000
    const onDismiss = actionOrOptions && actionOrOptions.onDismiss ? actionOrOptions.onDismiss : undefined
    const variant = actionOrOptions && actionOrOptions.variant ? actionOrOptions.variant : undefined
    const pulseColor = actionOrOptions && actionOrOptions.pulseColor ? actionOrOptions.pulseColor : undefined
    setToast({ message, type, action: action || undefined, icon: icon || undefined, autoDismiss, onDismiss, variant, pulseColor })
  }, [])

  useEffect(() => {
    if (!toast) return
    if (toast.autoDismiss === false) return

    const timeoutDuration = typeof toast.autoDismiss === 'number' ? toast.autoDismiss : 4000;
    const t = setTimeout(() => {
      if (toast.onDismiss) toast.onDismiss();
      setToast(null);
    }, timeoutDuration)
    return () => clearTimeout(t)
  }, [toast])

  const handleToastClick = () => {
    if (toast?.action?.onClick) {
      toast.action.onClick()
    }
    if (toast?.onDismiss) {
      toast.onDismiss()
    }
    setToast(null)
  }

  return (
    <ToastContext.Provider value={{ show, toast, setToast }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={
            toast.variant === 'sidebar'
              ? {
                position: 'fixed',
                top: '24px',
                right: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 20px',
                background: toast.pulseColor === 'red' ? 'linear-gradient(to right, rgba(239, 68, 68, 0.15), transparent)' : toast.pulseColor === 'green' ? 'linear-gradient(to right, rgba(16, 185, 129, 0.15), transparent)' : toast.pulseColor === 'shopify' ? 'linear-gradient(to right, rgba(150, 191, 72, 0.15), transparent)' : 'transparent',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                color: 'var(--text-primary, #fff)',
                border: `1.5px solid ${toast.pulseColor === 'red' ? 'rgba(239, 68, 68, 0.8)' : toast.pulseColor === 'green' ? 'rgba(16, 185, 129, 0.8)' : toast.pulseColor === 'shopify' ? 'rgba(150, 191, 72, 0.8)' : 'var(--border-light, rgba(0,0,0,0.1))'}`,
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                zIndex: 99999,
                fontSize: '15px',
                fontWeight: 600,
                width: '320px',
                maxWidth: '90vw',
                cursor: toast.action?.onClick ? 'pointer' : 'default',
                animation: `slideInSidebar 0.4s cubic-bezier(0.16, 1, 0.3, 1), ${toast.pulseColor === 'red' ? 'pulseRed' : toast.pulseColor === 'green' ? 'pulseGreen' : toast.pulseColor === 'shopify' ? 'pulseShopify' : ''
                  } 2.5s infinite alternate ease-in-out`
              }
              : {
                position: 'fixed',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 20px',
                backgroundColor: 'var(--bg-secondary, #2d2d2d)',
                color: 'var(--text-primary, #fff)',
                border: '1px solid var(--border-color, #404040)',
                borderRadius: '24px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                zIndex: 10001,
                fontSize: '14px',
                fontWeight: 500,
                maxWidth: '90vw',
                cursor: toast.action?.onClick ? 'pointer' : 'default',
                animation: 'toastFadeIn 0.2s ease-out'
              }
          }
          onClick={handleToastClick}
        >
          {toast.icon ? (
            <img src={toast.icon.src} alt="" style={{ height: '24px', width: 'auto', maxWidth: '72px', objectFit: 'contain', flexShrink: 0 }} />
          ) : (
            <>
              {toast.type === 'error' && <XCircle size={20} style={{ flexShrink: 0, color: toast.action?.iconColor ?? '#ef4444' }} />}
              {toast.type === 'warning' && <AlertCircle size={20} style={{ flexShrink: 0, color: toast.action?.iconColor ?? '#f59e0b' }} />}
              {toast.type === 'success' && <CheckCircle size={20} style={{ flexShrink: 0, color: toast.action?.iconColor ?? '#10b981' }} />}
            </>
          )}
          <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
          {toast.action && (
            <span
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                backgroundColor: toast.action.buttonColor ?? (toast.pulseColor === 'red' ? '#ef4444' : toast.pulseColor === 'green' ? '#10b981' : 'var(--theme-color, #2196f3)'),
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}
            >
              {toast.action.label}
            </span>
          )}
        </div>
      )}
      <style>{`
        @keyframes slideInSidebar {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes toastFadeIn {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes pulseRed {
          0% { box-shadow: 0 0 2px 0 rgba(239, 68, 68, 0.2); }
          100% { box-shadow: 0 0 8px 1px rgba(239, 68, 68, 0.4); }
        }
        @keyframes pulseGreen {
          0% { box-shadow: 0 0 2px 0 rgba(16, 185, 129, 0.2); }
          100% { box-shadow: 0 0 8px 1px rgba(16, 185, 129, 0.4); }
        }
        @keyframes pulseShopify {
          0% { box-shadow: 0 0 2px 0 rgba(150, 191, 72, 0.2); }
          100% { box-shadow: 0 0 8px 1px rgba(150, 191, 72, 0.4); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) return { show: () => { }, toast: null, setToast: () => { } }
  return ctx
}
