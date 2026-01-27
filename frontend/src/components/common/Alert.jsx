import React from 'react'

function Alert({ type, message, onClose }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  const typeStyles = {
    success: {
      backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4',
      borderColor: '#10b981',
      color: isDarkMode ? '#34d399' : '#166534',
      icon: '✓'
    },
    error: {
      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
      borderColor: '#ef4444',
      color: isDarkMode ? '#f87171' : '#991b1b',
      icon: '✕'
    },
    warning: {
      backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
      borderColor: '#f59e0b',
      color: isDarkMode ? '#fbbf24' : '#92400e',
      icon: '⚠'
    },
    info: {
      backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
      borderColor: '#3b82f6',
      color: isDarkMode ? '#60a5fa' : '#1e40af',
      icon: 'ℹ'
    },
  }

  const style = typeStyles[type] || typeStyles.info

  return (
    <div style={{
      borderLeft: `4px solid ${style.borderColor}`,
      padding: '16px',
      marginBottom: '16px',
      backgroundColor: style.backgroundColor,
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px'
    }}>
      <span style={{
        fontSize: '20px',
        fontWeight: 'bold',
        color: style.borderColor,
        flexShrink: 0
      }}>
        {style.icon}
      </span>
      <div style={{ flex: 1 }}>
        <p style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: 500,
          color: style.color
        }}>
          {message}
        </p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: style.color,
            cursor: 'pointer',
            padding: '4px',
            fontSize: '18px',
            lineHeight: 1,
            opacity: 0.7
          }}
          onMouseEnter={(e) => e.target.style.opacity = '1'}
          onMouseLeave={(e) => e.target.style.opacity = '0.7'}
        >
          ×
        </button>
      )}
    </div>
  )
}

export default Alert
