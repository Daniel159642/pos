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

// Input container style (base) – minHeight matches CustomDropdown when compactTrigger
export const inputBaseStyle = (isDarkMode, themeColorRgb, isFocused = false) => ({
  width: '100%',
  padding: '5px 14px',
  minHeight: '32px',
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

// Modal form container style (for Add Customer, Edit Customer, etc.)
export const formModalStyle = (isDarkMode) => ({
  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
  borderRadius: '8px',
  padding: '24px',
  maxWidth: '400px',
  width: '90%',
  boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
})

// Shared modal overlay: soft blur + semi-transparent backdrop (use for modals across the app)
export const modalOverlayStyle = (isDarkMode, zIndex = 1001) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.28)',
  backdropFilter: 'blur(3px)',
  WebkitBackdropFilter: 'blur(3px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex
})

// Shared modal content (dialog box): subtle shadow, rounded corners (use for modal panels)
export const modalContentStyle = (isDarkMode, overrides = {}) => ({
  backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
  borderRadius: '8px',
  padding: '24px',
  maxWidth: '420px',
  width: '100%',
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: isDarkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.15)',
  ...overrides
})

// Form modal actions: Cancel + primary button using button-26 style
// primaryType: 'button' (default) uses onClick, 'submit' uses form submit
export const FormModalActions = ({
  onCancel,
  onPrimary,
  primaryLabel,
  primaryDisabled = false,
  primaryType = 'button'
}) => (
  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
    <button
      type="button"
      className="button-26 button-26--header"
      role="button"
      onClick={onCancel}
      disabled={primaryDisabled}
    >
      <div className="button-26__content">
        <span className="button-26__text text">Cancel</span>
      </div>
    </button>
    <button
      type={primaryType}
      className="button-26 button-26--header"
      role="button"
      onClick={primaryType === 'button' ? onPrimary : undefined}
      disabled={primaryDisabled}
      style={{ opacity: primaryDisabled ? 0.6 : 1, cursor: primaryDisabled ? 'not-allowed' : 'pointer' }}
    >
      <div className="button-26__content">
        <span className="button-26__text text">{primaryLabel}</span>
      </div>
    </button>
  </div>
)

// =============================================================================
// COMPACT FORM TEMPLATE (Create Product form / Customers page style)
// Use for: create product, add category, inline forms with tight spacing,
// Cancel + primary buttons (Customers-style), small labels, dropdowns.
// =============================================================================

/** Compact form label: smaller (12px), less gap below (4px) */
export const compactFormLabelStyle = (isDarkMode) => ({
  display: 'block',
  marginBottom: '4px',
  fontWeight: 600,
  fontSize: '12px',
  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
})

/** Spacing between compact form fields */
export const compactFormFieldStyle = {
  marginBottom: '10px'
}

/** Tighter spacing between form fields (modals) */
export const compactFormFieldStyleTight = {
  marginBottom: '6px'
}

/** Two-column grid with gap (e.g. Price + Cost) */
export const compactFormGridStyle = (gap = '12px') => ({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap
})

/** Wrapper for Cancel + primary action buttons */
export const compactFormActionsStyle = {
  display: 'flex',
  gap: '8px',
  justifyContent: 'flex-end',
  marginTop: '24px'
}

/** Cancel button style (compact form / Customers page) */
export const compactCancelButtonStyle = (isDarkMode, disabled = false) => ({
  padding: '4px 16px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  backgroundColor: 'var(--bg-tertiary)',
  border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'all 0.3s ease',
  boxShadow: 'none',
  opacity: disabled ? 0.6 : 1
})

/** Primary button style (Create / Save – compact form / Customers page) */
export const compactPrimaryButtonStyle = (themeColorRgb, disabled = false) => ({
  padding: '4px 16px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
  border: `1px solid rgba(${themeColorRgb}, 0.5)`,
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'all 0.3s ease',
  boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3)`,
  opacity: disabled ? 0.6 : 1
})

/** Section divider for compact form (e.g. "Sizes / Variants", "Ingredients") */
export const compactFormSectionStyle = (isDarkMode, overrides = {}) => ({
  ...compactFormFieldStyle,
  marginTop: '12px',
  paddingTop: '12px',
  borderTop: isDarkMode ? '1px solid #333' : '1px solid #eee',
  ...overrides
})

/**
 * Compact form actions: Cancel + primary button (same as Create Product / Customers form).
 * primaryType: 'button' | 'submit'
 */
export const CompactFormActions = ({
  onCancel,
  onPrimary,
  primaryLabel,
  cancelLabel = 'Cancel',
  primaryDisabled = false,
  primaryType = 'button',
  isDarkMode,
  themeColorRgb = '132, 0, 255'
}) => (
  <div style={compactFormActionsStyle}>
    <button
      type="button"
      onClick={onCancel}
      disabled={primaryDisabled}
      style={compactCancelButtonStyle(isDarkMode, primaryDisabled)}
    >
      {cancelLabel}
    </button>
    <button
      type={primaryType}
      onClick={primaryType === 'button' ? onPrimary : undefined}
      disabled={primaryDisabled}
      style={compactPrimaryButtonStyle(themeColorRgb, primaryDisabled)}
    >
      {primaryLabel}
    </button>
  </div>
)

/** Compact form field wrapper – use with compactFormFieldStyle spacing */
export const CompactFormField = ({ children, style = {} }) => (
  <div style={{ ...compactFormFieldStyle, ...style }}>
    {children}
  </div>
)

/** Compact form label – use with compactFormLabelStyle */
export const CompactFormLabel = ({ children, isDarkMode, required = false, style = {} }) => (
  <label style={{ ...compactFormLabelStyle(isDarkMode), ...style }}>
    {children}
    {required && <span style={requiredIndicatorStyle}> *</span>}
  </label>
)
