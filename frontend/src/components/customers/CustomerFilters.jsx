import React from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

function CustomerFilters({ filters, onFilterChange, onClearFilters }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const handleChange = (e) => {
    const { name, value } = e.target
    const next = {
      ...filters,
      [name]: value === '' ? undefined : name === 'is_active' ? value === 'true' : value
    }
    if (name === 'search' || name === 'customer_type' || name === 'is_active') {
      next.page = 1
    }
    onFilterChange(next)
  }

  const customerTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'individual', label: 'Individual' },
    { value: 'business', label: 'Business' }
  ]

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'true', label: 'Active Only' },
    { value: 'false', label: 'Inactive Only' }
  ]

  return (
    <div style={{
      backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
      marginBottom: '24px'
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        alignItems: 'end'
      }}>
        <Input
          name="search"
          value={filters.search || ''}
          onChange={handleChange}
          placeholder="Search customers..."
          style={{ marginBottom: 0 }}
        />
        <Select
          name="customer_type"
          label="Type"
          value={filters.customer_type || ''}
          onChange={handleChange}
          options={customerTypeOptions}
          style={{ marginBottom: 0 }}
        />
        <Select
          name="is_active"
          label="Status"
          value={filters.is_active === undefined ? '' : String(filters.is_active)}
          onChange={handleChange}
          options={statusOptions}
          style={{ marginBottom: 0 }}
        />
        <Button type="button" variant="secondary" onClick={onClearFilters} style={{ width: '100%' }}>
          Clear Filters
        </Button>
      </div>
    </div>
  )
}

export default CustomerFilters
