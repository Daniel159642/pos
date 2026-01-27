import React from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

function VendorFilters({ filters, onFilterChange, onClearFilters }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const handleChange = (e) => {
    const { name, value } = e.target
    let v = value === '' ? undefined : value
    if (name === 'is_1099_vendor' || name === 'is_active') v = value === 'true' ? true : value === 'false' ? false : undefined
    const next = { ...filters, [name]: v }
    if (['search', 'is_1099_vendor', 'is_active'].includes(name)) next.page = 1
    onFilterChange(next)
  }

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'true', label: 'Active Only' },
    { value: 'false', label: 'Inactive Only' }
  ]

  const vendor1099Options = [
    { value: '', label: 'All Vendors' },
    { value: 'true', label: '1099 Vendors Only' },
    { value: 'false', label: 'Non-1099 Vendors' }
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          alignItems: 'end'
        }}
      >
        <Input name="search" value={filters.search || ''} onChange={handleChange} placeholder="Search vendors..." style={{ marginBottom: 0 }} />
        <Select name="is_1099_vendor" label="1099" value={filters.is_1099_vendor === undefined ? '' : String(filters.is_1099_vendor)} onChange={handleChange} options={vendor1099Options} style={{ marginBottom: 0 }} />
        <Select name="is_active" label="Status" value={filters.is_active === undefined ? '' : String(filters.is_active)} onChange={handleChange} options={statusOptions} style={{ marginBottom: 0 }} />
        <Button type="button" variant="secondary" onClick={onClearFilters} style={{ width: '100%' }}>
          Clear Filters
        </Button>
      </div>
    </div>
  )
}

export default VendorFilters
