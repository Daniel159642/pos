import React, { useState } from 'react'

function InvoiceTable({ invoices, onView, onEdit, onDelete, onSend, onVoid, onRecordPayment }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const [expandedIds, setExpandedIds] = useState(new Set())

  const toggleExpand = (id) => {
    const next = new Set(expandedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedIds(next)
  }

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const statusColors = {
    draft: { bg: isDarkMode ? 'rgba(107,114,128,0.2)' : '#f3f4f6', color: '#4b5563' },
    sent: { bg: isDarkMode ? 'rgba(59,130,246,0.2)' : '#dbeafe', color: '#2563eb' },
    viewed: { bg: isDarkMode ? 'rgba(168,85,247,0.2)' : '#f3e8ff', color: '#9333ea' },
    partial: { bg: isDarkMode ? 'rgba(234,179,8,0.2)' : '#fef9c3', color: '#a16207' },
    paid: { bg: isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7', color: '#16a34a' },
    overdue: { bg: isDarkMode ? 'rgba(239,68,68,0.2)' : '#fee2e2', color: '#dc2626' },
    void: { bg: isDarkMode ? '#2a2a2a' : '#e5e7eb', color: '#6b7280' }
  }

  const getStatusStyle = (status) => statusColors[status] || statusColors.draft

  const getCustomerName = (customer) => {
    if (!customer) return 'Unknown Customer'
    return customer.display_name || customer.company_name || [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || 'Customer'
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
        No invoices found
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
            <th style={{ ...thStyle, width: '36px' }} />
            <th style={thStyle}>Invoice #</th>
            <th style={thStyle}>Customer</th>
            <th style={thStyle}>Date / Due</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Balance Due</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((item) => {
            const inv = item.invoice || item
            const lines = item.lines || []
            const customer = item.customer
            const isExpanded = expandedIds.has(inv.id)
            const isOverdue = inv.status === 'overdue'
            const statusStyle = getStatusStyle(inv.status)

            return (
              <React.Fragment key={inv.id}>
                <tr
                  style={{
                    backgroundColor: isOverdue ? (isDarkMode ? 'rgba(239,68,68,0.08)' : '#fef2f2') : 'transparent',
                    opacity: inv.status === 'void' ? 0.6 : 1
                  }}
                >
                  <td style={tdStyle}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(inv.id)}
                      style={{ background: 'none', border: 'none', color: isDarkMode ? '#6b7280' : '#9ca3af', cursor: 'pointer', padding: '4px' }}
                    >
                      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: '#2563eb' }}>{inv.invoice_number}</td>
                  <td style={tdStyle}>{getCustomerName(customer)}</td>
                  <td style={tdStyle}>
                    <div>{new Date(inv.invoice_date).toLocaleDateString()}</div>
                    <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Due: {new Date(inv.due_date).toLocaleDateString()}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>{formatCurrency(inv.total_amount)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={{ fontWeight: 600, color: (inv.balance_due || 0) > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(inv.balance_due)}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                      {String(inv.status || '').charAt(0).toUpperCase() + (inv.status || '').slice(1)}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => onView(item)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>View</button>
                      {inv.status === 'draft' && (
                        <>
                          <button type="button" onClick={() => onEdit(item)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Edit</button>
                          <button type="button" onClick={() => onSend(item)} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Send</button>
                          <button type="button" onClick={() => onDelete(item)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Delete</button>
                        </>
                      )}
                      {(inv.balance_due || 0) > 0 && inv.status !== 'void' && inv.status !== 'draft' && (
                        <button type="button" onClick={() => onRecordPayment(item)} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Payment</button>
                      )}
                      {inv.status !== 'void' && (inv.amount_paid || 0) === 0 && (
                        <button type="button" onClick={() => onVoid(item)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Void</button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={8} style={{ padding: '16px 24px', backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                      <div style={{ fontSize: '14px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '8px', color: isDarkMode ? '#e5e7eb' : '#374151' }}>Line Items</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f3f4f6' }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Description</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Qty</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Price</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map((line) => (
                              <tr key={line.id || line.line_number} style={{ borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                                <td style={{ padding: '8px 12px', color: isDarkMode ? '#e5e7eb' : '#111' }}>{line.description}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#374151' }}>{line.quantity}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#374151' }}>{formatCurrency(line.unit_price)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(line.line_total_with_tax)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {inv.memo && (
                          <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '6px', backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : '#eff6ff', fontSize: '13px' }}>
                            <span style={{ fontWeight: 600, color: isDarkMode ? '#93c5fd' : '#1e40af' }}>Memo:</span> {inv.memo}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default InvoiceTable
