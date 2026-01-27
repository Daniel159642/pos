import React from 'react'

function CustomerTable({ customers, onView, onEdit, onDelete, onToggleStatus }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getDisplayName = (c) => {
    if (c.display_name) return c.display_name
    if (c.customer_type === 'business') return c.company_name || c.customer_number
    return `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.customer_number
  }

  if (!customers || customers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
        No customers found
      </div>
    )
  }

  const cellStyle = {
    padding: '12px 24px',
    fontSize: '14px',
    verticalAlign: 'middle',
    borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
  }
  const thStyle = {
    ...cellStyle,
    textAlign: 'left',
    fontWeight: 500,
    color: isDarkMode ? '#9ca3af' : '#6b7280',
    textTransform: 'uppercase',
    fontSize: '12px',
    backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb'
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle }}>Customer</th>
            <th style={{ ...thStyle }}>Type</th>
            <th style={{ ...thStyle }}>Contact</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Balance</th>
            <th style={{ ...thStyle }}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr
              key={c.id}
              style={{
                backgroundColor: !c.is_active ? (isDarkMode ? '#1a1a1a' : '#f9fafb') : 'transparent',
                opacity: !c.is_active ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (c.is_active) e.currentTarget.style.backgroundColor = isDarkMode ? '#2a2a2a' : '#f9fafb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = !c.is_active ? (isDarkMode ? '#1a1a1a' : '#f9fafb') : 'transparent'
              }}
            >
              <td style={cellStyle}>
                <div style={{ fontWeight: 500, color: isDarkMode ? '#fff' : '#111' }}>{getDisplayName(c)}</div>
                <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{c.customer_number}</div>
              </td>
              <td style={cellStyle}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: c.customer_type === 'business' ? (isDarkMode ? 'rgba(59,130,246,0.2)' : '#dbeafe') : (isDarkMode ? 'rgba(168,85,247,0.2)' : '#f3e8ff'),
                  color: c.customer_type === 'business' ? '#3b82f6' : '#9333ea'
                }}>
                  {c.customer_type === 'business' ? 'Business' : 'Individual'}
                </span>
              </td>
              <td style={{ ...cellStyle, color: isDarkMode ? '#e5e7eb' : '#374151' }}>
                {c.email && <div>{c.email}</div>}
                {c.phone && <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{c.phone}</div>}
              </td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>
                <span style={{
                  fontWeight: 500,
                  color: (c.account_balance || 0) > 0 ? '#dc2626' : (isDarkMode ? '#e5e7eb' : '#111')
                }}>
                  {formatCurrency(c.account_balance)}
                </span>
                {c.credit_limit && Number(c.credit_limit) > 0 && (
                  <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                    Limit: {formatCurrency(c.credit_limit)}
                  </div>
                )}
              </td>
              <td style={cellStyle}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: c.is_active ? (isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7') : (isDarkMode ? '#2a2a2a' : '#f3f4f6'),
                  color: c.is_active ? '#16a34a' : (isDarkMode ? '#9ca3af' : '#4b5563')
                }}>
                  {c.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => onView(c)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6366f1',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(c)}
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
                  <button
                    type="button"
                    onClick={() => onToggleStatus(c)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#d97706',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    {c.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c)}
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
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CustomerTable
