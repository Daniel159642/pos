import React from 'react'

function LoadingSpinner({ size = 'md', text }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  const sizeStyles = {
    sm: { width: '32px', height: '32px', borderWidth: '2px' },
    md: { width: '48px', height: '48px', borderWidth: '3px' },
    lg: { width: '64px', height: '64px', borderWidth: '4px' },
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px'
    }}>
      <div
        style={{
          ...sizeStyles[size],
          border: `${sizeStyles[size].borderWidth} solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
      {text && (
        <p style={{
          marginTop: '16px',
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          fontSize: '14px'
        }}>
          {text}
        </p>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default LoadingSpinner
