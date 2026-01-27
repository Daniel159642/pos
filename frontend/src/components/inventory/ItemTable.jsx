import React from 'react'

function ItemTable({
  items = [],
  onView,
  onEdit,
  onAdjust,
  onDelete
}) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const isLowStock = (item) => {
    return item.item_type === 'inventory' && 
           item.quantity_on_hand <= item.reorder_point && 
           item.reorder_point > 0
  }

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
        No items found
      </div>
    )
  }

  const thStyle = {
    padding: '12px 24px',
    fontSize: '12px',
    fontWeight: 500,
    color: isDarkMode ? '#9ca3af' : '#6b7280',
    textTransform: 'uppercase',
    textAlign: 'left',
    borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
    backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb'
  }

  const tdStyle = {
    padding: '12px 24px',
    fontSize: '14px',
    verticalAlign: 'middle',
    borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
    color: isDarkMode ? '#ffffff' : '#111827'
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Item</th>
            <th style={thStyle}>Type</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Qty on Hand</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Avg Cost</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Sales Price</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Value</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const lowStock = isLowStock(item)
            const inventoryValue = item.quantity_on_hand * item.average_cost

            return (
              <tr 
                key={item.id} 
                style={{
                  backgroundColor: lowStock 
                    ? (isDarkMode ? '#4a1f1f' : '#fef9c3')
                    : (isDarkMode ? '#1f1f1f' : 'white'),
                  opacity: !item.is_active ? 0.6 : 1
                }}
              >
                <td style={tdStyle}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#ffffff' : '#111827' }}>
                    {item.item_name}
                  </div>
                  <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>
                    {item.item_number}
                    {item.barcode && ` • ${item.barcode}`}
                  </div>
                  {lowStock && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      backgroundColor: isDarkMode ? '#7f1d1d' : '#fde047',
                      color: isDarkMode ? '#fca5a5' : '#a16207',
                      marginTop: '4px'
                    }}>
                      ⚠️ Low Stock
                    </span>
                  )}
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '9999px',
                    backgroundColor: item.item_type === 'inventory' 
                      ? (isDarkMode ? 'rgba(59,130,246,0.2)' : '#dbeafe')
                      : item.item_type === 'service'
                      ? (isDarkMode ? 'rgba(168,85,247,0.2)' : '#f3e8ff')
                      : (isDarkMode ? '#2a2a2a' : '#f3f4f6'),
                    color: item.item_type === 'inventory'
                      ? '#2563eb'
                      : item.item_type === 'service'
                      ? '#9333ea'
                      : (isDarkMode ? '#9ca3af' : '#6b7280')
                  }}>
                    {item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1).replace('_', ' ')}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {item.item_type === 'inventory' ? (
                    <div>
                      <div style={{ fontWeight: 500 }}>{item.quantity_on_hand.toFixed(2)}</div>
                      {item.reorder_point > 0 && (
                        <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>
                          Reorder: {item.reorder_point}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: isDarkMode ? '#6b7280' : '#9ca3af' }}>-</span>
                  )}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {item.item_type === 'inventory' ? formatCurrency(item.average_cost) : '-'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>
                  {formatCurrency(item.sales_price)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                  {item.item_type === 'inventory' ? formatCurrency(inventoryValue) : '-'}
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '9999px',
                    backgroundColor: item.is_active
                      ? (isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7')
                      : (isDarkMode ? '#2a2a2a' : '#f3f4f6'),
                    color: item.is_active
                      ? '#16a34a'
                      : (isDarkMode ? '#9ca3af' : '#6b7280')
                  }}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => onView(item)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#4f46e5',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500
                      }}
                    >
                      View
                    </button>
                    <button
                      onClick={() => onEdit(item)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500
                      }}
                    >
                      Edit
                    </button>
                    {item.item_type === 'inventory' && (
                      <button
                        onClick={() => onAdjust(item)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#16a34a',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 500
                        }}
                      >
                        Adjust
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(item)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc2626',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ItemTable
