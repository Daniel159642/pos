import React from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

function InvoiceFilters({ filters, customers = [], onFilterChange, onClearFilters }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const handleChange = (e) => {
    const { name, value, type } = e.target
    const checked = e.target.checked
    let v = value
    if (type === 'checkbox') v = checked
    else if (name === 'customer_id') v = value === '' ? undefined : parseInt(value, 10)
    else if (value === '') v = undefined
    const next = { ...filters, [name]: v }
    if (['customer_id', 'status', 'start_date', 'end_date', 'search', 'overdue_only'].includes(name)) {
      next.page = 1
    }
    onFilterChange(next)
  }

  const customerOptions = [
    { value: '', label: 'All Customers' },
    ...customers.map((c) => ({
      value: c.id,
      label: `${c.customer_number || ''} - ${c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer'}`
    }))
  ]

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'partial', label: 'Partial' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'void', label: 'Void' }
  ]

  return (
    <div
      style={{
        backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
        marginBottom: '24px'
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          alignItems: 'end'
        }}
      >
        <div style={{ minWidth: '200px' }}>
          <Select name="customer_id" label="Customer" value={filters.customer_id ?? ''} onChange={handleChange} options={customerOptions} style={{ marginBottom: 0 }} />
        </div>
        <Select name="status" label="Status" value={filters.status || ''} onChange={handleChange} options={statusOptions} style={{ marginBottom: 0 }} />
        <Input name="start_date" label="Start" type="date" value={filters.start_date || ''} onChange={handleChange} placeholder="Start date" style={{ marginBottom: 0 }} />
        <Input name="end_date" label="End" type="date" value={filters.end_date || ''} onChange={handleChange} placeholder="End date" style={{ marginBottom: 0 }} />
        <Button type="button" variant="secondary" onClick={onClearFilters} style={{ width: '100%' }}>
          Clear
        </Button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
          <Input name="search" value={filters.search || ''} onChange={handleChange} placeholder="Search by invoice number..." style={{ marginBottom: 0 }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" name="overdue_only" checked={!!filters.overdue_only} onChange={handleChange} style={{ width: '16px', height: '16px' }} />
          Overdue Only
        </label>
      </div>
    </div>
  )
}

export default InvoiceFilters
