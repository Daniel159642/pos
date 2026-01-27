import React, { useEffect } from 'react'

function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizeStyles = {
    sm: { maxWidth: '448px' },
    md: { maxWidth: '512px' },
    lg: { maxWidth: '768px' },
    xl: { maxWidth: '1024px' },
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      overflowY: 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      {/* Background overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          transition: 'opacity 0.2s'
        }}
        onClick={onClose}
      />

      {/* Modal panel */}
      <div style={{
        position: 'relative',
        backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
        borderRadius: '8px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        width: '100%',
        ...sizeStyles[size],
        margin: '32px auto'
      }}>
        <div style={{ padding: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 500,
              color: isDarkMode ? '#ffffff' : '#111827',
              margin: 0
            }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: isDarkMode ? '#9ca3af' : '#6b7280',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '24px',
                lineHeight: 1
              }}
              onMouseEnter={(e) => e.target.style.color = isDarkMode ? '#ffffff' : '#111827'}
              onMouseLeave={(e) => e.target.style.color = isDarkMode ? '#9ca3af' : '#6b7280'}
            >
              ×
            </button>
          </div>
          <div>{children}</div>
        </div>
      </div>
    </div>
  )
}

export default Modal
