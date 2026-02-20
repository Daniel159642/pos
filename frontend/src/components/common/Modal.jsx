import React, { useEffect } from 'react'

function Modal({ isOpen, onClose, title, children, size = 'md', showCloseButton = true }) {
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
    xl: { maxWidth: '960px' },
  }

  const isLarge = size === 'lg' || size === 'xl'

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      overflowY: 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 16px'
    }}>
      {/* Background overlay: light blur so modal sits in front of everything (including sidebar) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.4)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transition: 'opacity 0.2s'
        }}
        onClick={onClose}
      />

      {/* Modal panel: cap height so it fits on one screen */}
      <div style={{
        position: 'relative',
        backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
        borderRadius: '8px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        width: '100%',
        maxHeight: isLarge ? '90vh' : undefined,
        display: isLarge ? 'flex' : undefined,
        flexDirection: isLarge ? 'column' : undefined,
        ...sizeStyles[size],
        margin: '0 auto'
      }}>
        <div style={{ padding: isLarge ? '16px 20px 0' : '24px', flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: isLarge ? '12px' : '16px'
          }}>
            <h3 style={{
              fontSize: isLarge ? '16px' : '18px',
              fontWeight: 500,
              color: isDarkMode ? '#ffffff' : '#111827',
              margin: 0
            }}>
              {title}
            </h3>
            {showCloseButton && (
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
            )}
          </div>
        </div>
        <div style={{
          padding: isLarge ? '0 20px 20px' : '0 24px 24px',
          overflowY: 'auto',
          flex: isLarge ? 1 : undefined,
          minHeight: isLarge ? 0 : undefined
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default Modal
