import React from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

function TransactionFilters({ filters, onFilterChange, onClearFilters }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const handleChange = (e) => {
    const { name, value } = e.target
    onFilterChange({
      ...filters,
      [name]: value === '' ? undefined : 
              name === 'is_posted' || name === 'is_void' ? value === 'true' :
              name === 'account_id' ? parseInt(value) : value,
    })
  }

  const transactionTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'journal_entry', label: 'Journal Entry' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'bill', label: 'Bill' },
    { value: 'payment', label: 'Payment' },
    { value: 'adjustment', label: 'Adjustment' },
  ]

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'true', label: 'Posted Only' },
    { value: 'false', label: 'Draft Only' },
  ]

  const voidOptions = [
    { value: '', label: 'Include All' },
    { value: 'false', label: 'Active Only' },
    { value: 'true', label: 'Voided Only' },
  ]

  const containerStyle = {
    backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
    padding: '20px',
    borderRadius: '8px',
    border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
    marginBottom: '24px',
    boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
  }

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginBottom: '16px'
  }

  return (
    <div style={containerStyle}>
      <div style={gridStyle}>
        <Input
          name="start_date"
          type="date"
          label="Start Date"
          value={filters.start_date || ''}
          onChange={handleChange}
        />

        <Input
          name="end_date"
          type="date"
          label="End Date"
          value={filters.end_date || ''}
          onChange={handleChange}
        />

        <Select
          name="transaction_type"
          label="Type"
          value={filters.transaction_type || ''}
          onChange={handleChange}
          options={transactionTypeOptions}
        />

        <Select
          name="is_posted"
          label="Status"
          value={filters.is_posted === undefined ? '' : String(filters.is_posted)}
          onChange={handleChange}
          options={statusOptions}
        />

        <Select
          name="is_void"
          label="Void Status"
          value={filters.is_void === undefined ? '' : String(filters.is_void)}
          onChange={handleChange}
          options={voidOptions}
        />

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={onClearFilters} style={{ width: '100%' }}>
            Clear Filters
          </Button>
        </div>
      </div>
      
      <div>
        <Input
          name="search"
          label="Search"
          value={filters.search || ''}
          onChange={handleChange}
          placeholder="Search by transaction number or description..."
        />
      </div>
    </div>
  )
}

export default TransactionFilters
