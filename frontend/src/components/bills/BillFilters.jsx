import React from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

function BillFilters({ filters, vendors = [], onFilterChange, onClearFilters }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const handleChange = (e) => {
    const { name, value, type } = e.target
    const checked = e.target.checked
    let v = value
    if (type === 'checkbox') v = checked
    else if (value === '') v = undefined
    else if (name === 'vendor_id') v = parseInt(value, 10) || undefined
    const next = { ...filters, [name]: v }
    if (['vendor_id', 'status', 'start_date', 'end_date', 'search', 'overdue_only'].includes(name)) next.page = 1
    onFilterChange(next)
  }

  const vendorOptions = [
    { value: '', label: 'All Vendors' },
    ...(vendors || []).map((v) => ({
      value: v.id,
      label: `${v.vendor_number || ''} - ${v.vendor_name || ''}`.replace(/^ - | - $/g, '').trim() || `Vendor ${v.id}`
    }))
  ]

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'open', label: 'Open' },
    { value: 'partial', label: 'Partial' },
    { value: 'paid', label: 'Paid' },
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
          label="Start"
          value={filters.start_date || ''}
          onChange={handleChange}
          style={{ marginBottom: 0 }}
        />
        <Input
          name="end_date"
          type="date"
          label="End"
          value={filters.end_date || ''}
          onChange={handleChange}
          style={{ marginBottom: 0 }}
        />
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={onClearFilters} style={{ width: '100%' }}>
            Clear
          </Button>
        </div>
      </div>
      <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <Input
          name="search"
          value={filters.search || ''}
          onChange={handleChange}
          placeholder="Search by bill number or vendor reference..."
          style={{ marginBottom: 0, minWidth: '240px', flex: 1 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#e5e7eb' : '#374151', whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            name="overdue_only"
            checked={!!filters.overdue_only}
            onChange={handleChange}
            style={{ width: '16px', height: '16px' }}
          />
          <span>Overdue Only</span>
        </label>
      </div>
    </div>
  )
}

export default BillFilters
