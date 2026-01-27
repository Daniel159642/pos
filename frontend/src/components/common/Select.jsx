import React from 'react'

function Select({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  error,
  placeholder,
  className = '',
  style = {}
}) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const selectStyle = {
    width: '100%',
    padding: '8px 12px',
    border: error ? '1px solid #ef4444' : `1px solid ${isDarkMode ? '#3a3a3a' : '#d1d5db'}`,
    borderRadius: '6px',
    backgroundColor: disabled ? (isDarkMode ? '#2a2a2a' : '#f3f4f6') : (isDarkMode ? '#1f1f1f' : 'white'),
    color: isDarkMode ? '#ffffff' : '#1a1a1a',
    fontSize: '14px',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'border-color 0.2s',
    ...style
  }

  return (
    <div style={{ marginBottom: '16px', ...style }} className={className}>
      {label && (
        <label 
          htmlFor={name} 
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 500,
            color: isDarkMode ? '#ffffff' : '#374151',
            marginBottom: '4px'
          }}
        >
          {label}
          {required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
        </label>
      )}
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        style={selectStyle}
        onFocus={(e) => {
          e.target.style.borderColor = '#3b82f6'
          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? '#ef4444' : (isDarkMode ? '#3a3a3a' : '#d1d5db')
          e.target.style.boxShadow = 'none'
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p style={{ marginTop: '4px', fontSize: '12px', color: '#ef4444' }}>
          {error}
        </p>
      )}
    </div>
  )
}

export default Select
