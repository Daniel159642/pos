import React from 'react'
import Select from '../common/Select'
import Input from '../common/Input'
import Button from '../common/Button'

function AccountFilters({ filters, onFilterChange, onClearFilters }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  const handleChange = (e) => {
    const { name, value } = e.target
    onFilterChange({
      ...filters,
      [name]: value === '' ? undefined : name === 'is_active' ? value === 'true' : value,
    })
  }

  const accountTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'Asset', label: 'Asset' },
    { value: 'Liability', label: 'Liability' },
    { value: 'Equity', label: 'Equity' },
    { value: 'Revenue', label: 'Revenue' },
    { value: 'Expense', label: 'Expense' },
    { value: 'COGS', label: 'COGS' },
  ]

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'true', label: 'Active Only' },
    { value: 'false', label: 'Inactive Only' },
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
          placeholder="Search accounts..."
          style={{ marginBottom: 0 }}
        />

        <Select
          name="account_type"
          value={filters.account_type || ''}
          onChange={handleChange}
          options={accountTypeOptions}
          style={{ marginBottom: 0 }}
        />

        <Select
          name="is_active"
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

export default AccountFilters
