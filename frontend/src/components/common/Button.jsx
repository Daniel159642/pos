import React from 'react'

function Button({ 
  children, 
  onClick, 
  type = 'button', 
  variant = 'primary', 
  size = 'md', 
  disabled = false, 
  className = '',
  style = {}
}) {
  const baseStyle = {
    fontWeight: 500,
    borderRadius: '6px',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    opacity: disabled ? 0.5 : 1,
    ...style
  }
  
  const variantStyles = {
    primary: {
      backgroundColor: '#3b82f6',
      color: 'white',
    },
    secondary: {
      backgroundColor: '#6b7280',
      color: 'white',
    },
    danger: {
      backgroundColor: '#ef4444',
      color: 'white',
    },
    success: {
      backgroundColor: '#10b981',
      color: 'white',
    },
  }

  const sizeStyles = {
    sm: { padding: '6px 12px', fontSize: '14px' },
    md: { padding: '8px 16px', fontSize: '16px' },
    lg: { padding: '12px 24px', fontSize: '18px' },
  }

  const hoverStyle = disabled ? {} : {
    ':hover': {
      opacity: 0.9,
      transform: 'translateY(-1px)'
    }
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{
        ...baseStyle,
        ...variantStyles[variant],
        ...sizeStyles[size],
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.target.style.opacity = '0.9'
          e.target.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.target.style.opacity = '1'
          e.target.style.transform = 'translateY(0)'
        }
      }}
    >
      {children}
    </button>
  )
}

export default Button
