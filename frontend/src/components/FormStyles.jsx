import React from 'react'

/**
 * Reusable form styling constants and components
 * Based on the "Upload New Shipment" form design
 */

// Form title style
export const formTitleStyle = (isDarkMode) => ({
  margin: 0,
  fontSize: '16px',
  fontWeight: 700,
  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
  marginBottom: '12px'
})

// Form label style
export const formLabelStyle = (isDarkMode) => ({
  display: 'block',
  marginBottom: '10px',
  fontWeight: 600,
  fontSize: '14px',
  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
})

// Input container style (base)
export const inputBaseStyle = (isDarkMode, themeColorRgb, isFocused = false) => ({
  width: '100%',
  padding: '8px 14px',
  border: isFocused 
    ? `1px solid rgba(${themeColorRgb}, 0.5)`
    : (isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd'),
  borderRadius: '8px',
  fontSize: '14px',
  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
  transition: 'all 0.2s ease',
  outline: 'none',
  boxShadow: isFocused ? `0 0 0 3px rgba(${themeColorRgb}, 0.1)` : 'none'
})

// Form field container style
export const formFieldContainerStyle = {
  marginBottom: '24px'
}

// Form container style
export const formContainerStyle = {
  width: '100%'
}

// Required field indicator style
export const requiredIndicatorStyle = {
  color: '#f44336'
}

// Helper function to get focus handlers for inputs
export const getInputFocusHandlers = (themeColorRgb, isDarkMode) => ({
  onFocus: (e) => {
    e.target.style.borderColor = `rgba(${themeColorRgb}, 0.5)`
    e.target.style.boxShadow = `0 0 0 3px rgba(${themeColorRgb}, 0.1)`
  },
  onBlur: (e) => {
    e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'
    e.target.style.boxShadow = 'none'
  }
})

// Form title component
export const FormTitle = ({ children, isDarkMode, style = {} }) => (
  <h2 style={{ ...formTitleStyle(isDarkMode), ...style }}>
    {children}
  </h2>
)

// Form label component
export const FormLabel = ({ children, isDarkMode, required = false, style = {} }) => (
  <label style={{ ...formLabelStyle(isDarkMode), ...style }}>
    {children}
    {required && <span style={requiredIndicatorStyle}> *</span>}
  </label>
)

// Form field wrapper component
export const FormField = ({ children, style = {} }) => (
  <div style={{ ...formFieldContainerStyle, ...style }}>
    {children}
  </div>
)
