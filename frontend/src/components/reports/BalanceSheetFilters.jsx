import React from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

function BalanceSheetFilters({ filters, onFilterChange, onGenerate, loading = false }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const handleChange = (e) => {
    const { name, value } = e.target
    onFilterChange({ ...filters, [name]: value })
  }

  const setPresetDate = (preset) => {
    const today = new Date()
    let asOfDate

    switch (preset) {
      case 'today':
        asOfDate = today
        break
      case 'end_of_month':
        asOfDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        break
      case 'end_of_last_month':
        asOfDate = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'end_of_quarter':
        const quarter = Math.floor(today.getMonth() / 3)
        asOfDate = new Date(today.getFullYear(), (quarter + 1) * 3, 0)
        break
      case 'end_of_year':
        asOfDate = new Date(today.getFullYear(), 11, 31)
        break
      case 'end_of_last_year':
        asOfDate = new Date(today.getFullYear() - 1, 11, 31)
        break
      default:
        return
    }

    onFilterChange({
      ...filters,
      as_of_date: asOfDate.toISOString().split('T')[0]
    })
  }

  const comparisonOptions = [
    { value: 'none', label: 'No Comparison' },
    { value: 'previous_month', label: 'Previous Month' },
    { value: 'previous_year', label: 'Previous Year' }
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

  const quickSelectStyle = {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
  }

  const quickLinkStyle = {
    fontSize: '14px',
    color: '#6366f1',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0
  }

  return (
    <div style={containerStyle}>
      <h3 style={{
        fontSize: '18px',
        fontWeight: '600',
        marginBottom: '16px',
        color: isDarkMode ? '#ffffff' : '#1a1a1a'
      }}>
        Report Settings
      </h3>

      <div style={gridStyle}>
        <Input
          label="As of Date"
          name="as_of_date"
          type="date"
          value={filters.as_of_date || ''}
          onChange={handleChange}
          required
        />
        <Select
          label="Compare To"
          name="comparison_type"
          value={filters.comparison_type || 'none'}
          onChange={handleChange}
          options={comparisonOptions}
        />
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button
            type="button"
            onClick={onGenerate}
            disabled={loading || !filters.as_of_date}
            style={{ width: '100%' }}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>
        </div>
      </div>

      <div style={quickSelectStyle}>
        <span style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginRight: '8px' }}>
          Quick Select:
        </span>
        <button type="button" onClick={() => setPresetDate('today')} style={quickLinkStyle}>Today</button>
        <button type="button" onClick={() => setPresetDate('end_of_month')} style={quickLinkStyle}>End of Month</button>
        <button type="button" onClick={() => setPresetDate('end_of_last_month')} style={quickLinkStyle}>End of Last Month</button>
        <button type="button" onClick={() => setPresetDate('end_of_quarter')} style={quickLinkStyle}>End of Quarter</button>
        <button type="button" onClick={() => setPresetDate('end_of_year')} style={quickLinkStyle}>End of Year</button>
        <button type="button" onClick={() => setPresetDate('end_of_last_year')} style={quickLinkStyle}>End of Last Year</button>
      </div>
    </div>
  )
}

export default BalanceSheetFilters
