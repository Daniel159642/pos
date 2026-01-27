import React from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

function BillPaymentFilters({ filters, vendors = [], onFilterChange, onClearFilters }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const handleChange = (e) => {
    const { name, value } = e.target
    let v = value === '' ? undefined : value
    if (name === 'vendor_id') {
      v = value ? parseInt(value, 10) : undefined
    }
    const next = { ...filters, [name]: v }
    if (['vendor_id', 'payment_method', 'status', 'start_date', 'end_date', 'search'].includes(name)) {
      next.page = 1
    }
    onFilterChange(next)
  }

  const vendorOptions = [
    { value: '', label: 'All Vendors' },
    ...(vendors || []).map((v) => ({
      value: v.id,
      label: `${v.vendor_number || ''} - ${v.vendor_name || ''}`.replace(/^ - | - $/g, '').trim() || `Vendor ${v.id}`
    }))
  ]

  const paymentMethodOptions = [
    { value: '', label: 'All Methods' },
    { value: 'check', label: 'Check' },
    { value: 'ach', label: 'ACH' },
    { value: 'wire', label: 'Wire' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'cash', label: 'Cash' },
    { value: 'other', label: 'Other' }
  ]

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'cleared', label: 'Cleared' },
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
        <div style={{ gridColumn: '1 / -1', maxWidth: '280px' }}>
          <Select
            name="vendor_id"
            label="Vendor"
            value={filters.vendor_id ?? ''}
            onChange={handleChange}
            options={vendorOptions}
            style={{ marginBottom: 0 }}
          />
        </div>
        <Select
          name="payment_method"
          label="Payment Method"
          value={filters.payment_method || ''}
          onChange={handleChange}
          options={paymentMethodOptions}
          style={{ marginBottom: 0 }}
        />
        <Select
          name="status"
          label="Status"
          value={filters.status || ''}
          onChange={handleChange}
          options={statusOptions}
          style={{ marginBottom: 0 }}
        />
        <Input
          name="start_date"
          type="date"
          label="Start Date"
          value={filters.start_date || ''}
          onChange={handleChange}
          style={{ marginBottom: 0 }}
        />
        <Input
          name="end_date"
          type="date"
          label="End Date"
          value={filters.end_date || ''}
          onChange={handleChange}
          style={{ marginBottom: 0 }}
        />
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={onClearFilters} style={{ width: '100%' }}>
            Clear Filters
          </Button>
        </div>
      </div>
      <div style={{ marginTop: '16px' }}>
        <Input
          name="search"
          value={filters.search || ''}
          onChange={handleChange}
          placeholder="Search by payment number..."
          style={{ marginBottom: 0, minWidth: '240px' }}
        />
      </div>
    </div>
  )
}

export default BillPaymentFilters
