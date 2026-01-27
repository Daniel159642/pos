import React from 'react'

function VendorTable({ vendors = [], onView, onEdit, onDelete, onToggleStatus }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (!vendors || vendors.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
        No vendors found
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
    borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb'),
    backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb'
  }
  const tdStyle = {
    padding: '12px 24px',
    fontSize: '14px',
    verticalAlign: 'middle',
    borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb')
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Vendor</th>
            <th style={thStyle}>Contact</th>
            <th style={thStyle}>Payment Terms</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Balance Owed</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v) => (
            <tr key={v.id} style={{ opacity: !v.is_active ? 0.6 : 1, backgroundColor: !v.is_active ? (isDarkMode ? '#1f1f1f' : '#f9fafb') : 'transparent' }}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 500, color: isDarkMode ? '#e5e7eb' : '#111' }}>{v.vendor_name}</div>
                <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{v.vendor_number}</div>
                {v.is_1099_vendor && (
                  <span style={{ display: 'inline-block', marginTop: '4px', padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500, backgroundColor: isDarkMode ? 'rgba(234,179,8,0.2)' : '#fef9c3', color: '#a16207' }}>
                    1099 Vendor
                  </span>
                )}
              </td>
              <td style={tdStyle}>
                {v.contact_name && <div style={{ fontWeight: 500, color: isDarkMode ? '#e5e7eb' : '#111' }}>{v.contact_name}</div>}
                {v.email && <div style={{ fontSize: '13px', color: isDarkMode ? '#93c5fd' : '#2563eb' }}>{v.email}</div>}
                {v.phone && <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{v.phone}</div>}
              </td>
              <td style={tdStyle}>
                <div style={{ color: isDarkMode ? '#e5e7eb' : '#111' }}>{v.payment_terms || 'Net 30'}</div>
                {v.payment_method && <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>via {String(v.payment_method).replace('_', ' ')}</div>}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                <span style={{ fontWeight: 500, color: (v.account_balance || 0) > 0 ? '#dc2626' : (isDarkMode ? '#e5e7eb' : '#111') }}>
                  {formatCurrency(v.account_balance)}
                </span>
              </td>
              <td style={tdStyle}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: v.is_active ? (isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7') : (isDarkMode ? '#2a2a2a' : '#e5e7eb'),
                    color: v.is_active ? '#16a34a' : '#6b7280'
                  }}
                >
                  {v.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => onView(v)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>View</button>
                  <button type="button" onClick={() => onEdit(v)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Edit</button>
                  <button type="button" onClick={() => onToggleStatus(v)} style={{ background: 'none', border: 'none', color: '#a16207', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                    {v.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button type="button" onClick={() => onDelete(v)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default VendorTable
