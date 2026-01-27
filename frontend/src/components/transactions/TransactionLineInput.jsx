import React, { useState } from 'react'
import Select from '../common/Select'
import Input from '../common/Input'

function TransactionLineInput({ line, lineIndex, accounts, onChange, onRemove, canRemove }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const [errors, setErrors] = useState({})

  const handleChange = (field, value) => {
    const updatedLine = { ...line, [field]: value }

    // If changing debit, clear credit
    if (field === 'debit_amount' && parseFloat(value) > 0) {
      updatedLine.credit_amount = 0
    }
    // If changing credit, clear debit
    if (field === 'credit_amount' && parseFloat(value) > 0) {
      updatedLine.debit_amount = 0
    }

    onChange(lineIndex, updatedLine)
    
    // Clear errors
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const accountOptions = accounts
    .filter((acc) => acc.is_active)
    .map((acc) => ({
      value: acc.id,
      label: `${acc.account_number ? acc.account_number + ' - ' : ''}${acc.account_name}`
    }))

  const containerStyle = {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 120px 120px 1fr 40px',
    gap: '12px',
    alignItems: 'start',
    padding: '12px',
    backgroundColor: isDarkMode ? '#2a2a2a' : '#f9fafb',
    borderRadius: '8px',
    border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
    marginBottom: '8px'
  }

  const lineNumberStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '8px',
    fontWeight: '600',
    color: isDarkMode ? '#9ca3af' : '#6b7280'
  }

  const removeButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '8px',
    cursor: 'pointer',
    color: '#ef4444',
    background: 'none',
    border: 'none',
    fontSize: '18px'
  }

  return (
    <div style={containerStyle}>
      <div style={lineNumberStyle}>
        {lineIndex + 1}
      </div>

      <div>
        <Select
          name={`account_${lineIndex}`}
          value={line.account_id || ''}
          onChange={(e) => handleChange('account_id', parseInt(e.target.value))}
          options={accountOptions}
          placeholder="Select account"
          required
          error={errors.account_id}
        />
      </div>

      <div>
        <Input
          name={`debit_${lineIndex}`}
          type="number"
          step="0.01"
          value={line.debit_amount || 0}
          onChange={(e) => handleChange('debit_amount', parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          style={{ textAlign: 'right' }}
        />
      </div>

      <div>
        <Input
          name={`credit_${lineIndex}`}
          type="number"
          step="0.01"
          value={line.credit_amount || 0}
          onChange={(e) => handleChange('credit_amount', parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          style={{ textAlign: 'right' }}
        />
      </div>

      <div>
        <Input
          name={`description_${lineIndex}`}
          value={line.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Line description"
          required
          error={errors.description}
        />
      </div>

      <div style={removeButtonStyle}>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(lineIndex)}
            style={removeButtonStyle}
            title="Remove line"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

export default TransactionLineInput
