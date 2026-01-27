import React, { useMemo } from 'react'
import Input from '../common/Input'
import Select from '../common/Select'

function BillLineInput({
  line,
  lineIndex,
  expenseAccounts = [],
  taxRates = [],
  customers = [],
  onChange,
  onRemove,
  canRemove
}) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const calculatedTotal = useMemo(() => {
    const lineTotal = (line.quantity || 0) * (line.unit_cost || 0)
    let taxAmount = 0
    if (line.tax_rate_id && Array.isArray(taxRates)) {
      const tr = taxRates.find((t) => t.id === line.tax_rate_id)
      if (tr && (tr.tax_rate != null)) {
        const rate = typeof tr.tax_rate === 'number' ? tr.tax_rate : parseFloat(tr.tax_rate) || 0
        taxAmount = lineTotal * (rate / 100)
      }
    }
    return lineTotal + taxAmount
  }, [line.quantity, line.unit_cost, line.tax_rate_id, taxRates])

  const handleChange = (field, value) => {
    const updated = { ...line, [field]: value }
    onChange(lineIndex, updated)
  }

  const accountOptions = (expenseAccounts || []).map((acc) => ({
    value: acc.id,
    label: `${acc.account_number ? acc.account_number + ' - ' : ''}${acc.account_name}`
  }))

  const taxRateOptions = [
    { value: '', label: 'No Tax' },
    ...(taxRates || []).map((r) => ({
      value: r.id,
      label: `${r.tax_name || 'Tax'} (${(r.tax_rate != null ? r.tax_rate : 0)}%)`
    }))
  ]

  const customerOptions = [
    { value: '', label: 'None' },
    ...(customers || []).map((c) => ({
      value: c.id,
      label: `${c.customer_number || ''} - ${c.display_name || c.company_name || 'Customer'}`.replace(/^ - | - $/g, '').trim() || `Customer ${c.id}`
    }))
  ]

  const rowStyle = {
    display: 'grid',
    gridTemplateColumns: '32px 1fr 80px 100px 140px 100px 90px 40px',
    gap: '8px',
    alignItems: 'start',
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb',
    border: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb'),
    marginBottom: '8px',
    minWidth: '700px'
  }

  return (
    <div>
      <div style={rowStyle}>
        <div style={{ paddingTop: '24px', fontWeight: 600, color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: '14px', textAlign: 'center' }}>
          {lineIndex + 1}
        </div>
        <div style={{ marginBottom: 0 }}>
          <Input
            name={`description_${lineIndex}`}
            value={line.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Expense description"
            required
            style={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ marginBottom: 0 }}>
          <Input
            name={`quantity_${lineIndex}`}
            type="number"
            step="0.01"
            min="0"
            value={line.quantity ?? ''}
            onChange={(e) => handleChange('quantity', parseFloat(e.target.value) || 0)}
            placeholder="Qty"
            required
            style={{ marginBottom: 0, textAlign: 'right' }}
          />
        </div>
        <div style={{ marginBottom: 0 }}>
          <Input
            name={`unit_cost_${lineIndex}`}
            type="number"
            step="0.01"
            min="0"
            value={line.unit_cost ?? ''}
            onChange={(e) => handleChange('unit_cost', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            required
            style={{ marginBottom: 0, textAlign: 'right' }}
          />
        </div>
        <div style={{ marginBottom: 0 }}>
          <Select
            name={`account_${lineIndex}`}
            value={line.account_id ?? ''}
            onChange={(e) => handleChange('account_id', e.target.value ? parseInt(e.target.value, 10) : null)}
            options={accountOptions}
            placeholder="Expense account"
            required
            style={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ marginBottom: 0 }}>
          <Select
            name={`tax_${lineIndex}`}
            value={line.tax_rate_id ?? ''}
            onChange={(e) => handleChange('tax_rate_id', e.target.value ? parseInt(e.target.value, 10) : undefined)}
            options={taxRateOptions}
            style={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ paddingTop: '24px', textAlign: 'right', fontWeight: 600, fontSize: '14px', color: isDarkMode ? '#e5e7eb' : '#111' }}>
          ${Number(calculatedTotal).toFixed(2)}
        </div>
        <div style={{ paddingTop: '20px', display: 'flex', justifyContent: 'center' }}>
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(lineIndex)}
              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '4px' }}
              title="Remove line"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div style={{ marginLeft: '48px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#e5e7eb' : '#374151' }}>
          <input
            type="checkbox"
            checked={!!line.billable}
            onChange={(e) => handleChange('billable', e.target.checked)}
            style={{ width: '16px', height: '16px' }}
          />
          <span>Billable to customer</span>
        </label>
        {line.billable && (
          <div style={{ width: '240px', marginBottom: 0 }}>
            <Select
              name={`customer_${lineIndex}`}
              value={line.customer_id ?? ''}
              onChange={(e) => handleChange('customer_id', e.target.value ? parseInt(e.target.value, 10) : undefined)}
              options={customerOptions}
              placeholder="Select customer"
              required={!!line.billable}
              style={{ marginBottom: 0 }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default BillLineInput
