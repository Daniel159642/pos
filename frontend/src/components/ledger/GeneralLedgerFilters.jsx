import React from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

function GeneralLedgerFilters({ filters, accounts, onFilterChange, onClearFilters, onExport, onExportExcel, loading = false }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const handleChange = (e) => {
    const { name, value } = e.target
    onFilterChange({
      ...filters,
      [name]: value === '' ? undefined : name === 'account_id' ? parseInt(value) : value,
    })
  }

  const accountOptions = [
    { value: '', label: 'All Accounts' },
    ...accounts
      .filter((acc) => acc.is_active)
      .sort((a, b) => {
        const numA = a.account_number || ''
        const numB = b.account_number || ''
        return numA.localeCompare(numB)
      })
      .map((acc) => ({
        value: acc.id,
        label: `${acc.account_number ? acc.account_number + ' - ' : ''}${acc.account_name}`,
      })),
  ]

  const containerStyle = {
    backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
    padding: '24px',
    borderRadius: '8px',
    border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
    marginBottom: '24px',
    boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
  }

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px'
  }

  const buttonContainerStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '16px'
  }

  return (
    <div style={containerStyle}>
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: '600', 
        marginBottom: '16px',
        color: isDarkMode ? '#ffffff' : '#1a1a1a'
      }}>
        Filter Ledger
      </h3>
      
      <div style={gridStyle}>
        <div style={{ gridColumn: 'span 2' }}>
          <Select
            label="Account"
            name="account_id"
            value={filters.account_id || ''}
            onChange={handleChange}
            options={accountOptions}
          />
        </div>

        <Input
          label="Start Date"
          name="start_date"
          type="date"
          value={filters.start_date || ''}
          onChange={handleChange}
        />

        <Input
          label="End Date"
          name="end_date"
          type="date"
          value={filters.end_date || ''}
          onChange={handleChange}
        />
      </div>

      <div style={buttonContainerStyle}>
        {onExport && (
          <Button
            type="button"
            variant="secondary"
            onClick={onExport}
            disabled={loading}
          >
            📊 Export to CSV
          </Button>
        )}
        {onExportExcel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onExportExcel}
            disabled={loading}
          >
            📗 Export to Excel
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={onClearFilters}
          disabled={loading}
        >
          Clear Filters
        </Button>
      </div>
    </div>
  )
}

export default GeneralLedgerFilters
