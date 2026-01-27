import React from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

function ItemFilters({ filters, onFilterChange, onClearFilters }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const handleChange = (e) => {
    const { name, value, type } = e.target
    const checked = e.target.checked

    let v = value === '' ? undefined : value
    if (type === 'checkbox') {
      v = checked
    } else if (name === 'is_active' && value !== '') {
      v = value === 'true'
    }

    const next = { ...filters, [name]: v }
    if (['item_type', 'is_active', 'low_stock', 'search'].includes(name)) {
      next.page = 1
    }
    onFilterChange(next)
  }

  const itemTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'non_inventory', label: 'Non-Inventory' },
    { value: 'service', label: 'Service' },
    { value: 'bundle', label: 'Bundle' }
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '16px',
        alignItems: 'end'
      }}>
        <Input
          name="search"
          value={filters.search || ''}
          onChange={handleChange}
          placeholder="Search items..."
          style={{ marginBottom: 0 }}
        />

        <Select
          name="item_type"
          label="Item Type"
          value={filters.item_type || ''}
          onChange={handleChange}
          options={itemTypeOptions}
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

        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            color: isDarkMode ? '#e5e7eb' : '#374151'
          }}>
            <input
              type="checkbox"
              name="low_stock"
              checked={filters.low_stock || false}
              onChange={handleChange}
              style={{ width: '16px', height: '16px' }}
            />
            <span>Low Stock Only</span>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={onClearFilters} style={{ width: '100%' }}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ItemFilters
