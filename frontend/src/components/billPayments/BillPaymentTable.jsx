import React, { useState } from 'react'

function BillPaymentTable({
  payments = [],
  onView,
  onVoid,
  onDelete,
  onPrintCheck
}) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const [expandedIds, setExpandedIds] = useState(new Set())

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getStatusColor = (status) => {
    const map = {
      pending: { bg: isDarkMode ? 'rgba(234,179,8,0.2)' : '#fef9c3', color: '#a16207' },
      cleared: { bg: isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7', color: '#16a34a' },
      void: { bg: isDarkMode ? '#2a2a2a' : '#e5e7eb', color: '#6b7280' }
    }
    return map[status] || map.pending
  }

  const getPaymentMethodLabel = (method) => {
    const labels = {
      check: 'Check',
      ach: 'ACH',
      wire: 'Wire',
      credit_card: 'Credit Card',
      cash: 'Cash',
      other: 'Other'
    }
    return labels[method] || method
  }

  if (payments.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
        No bill payments found
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
            <th style={{ ...thStyle, width: '36px' }} />
            <th style={thStyle}>Payment #</th>
            <th style={thStyle}>Vendor</th>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Method</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Applied</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((item) => {
            const isExpanded = expandedIds.has(item.payment.id)
            const totalApplied = item.applications.reduce((sum, app) => sum + (app.amount_applied || 0), 0)
            const statusStyle = getStatusColor(item.payment.status)
            
            return (
              <React.Fragment key={item.payment.id}>
                <tr style={{
                  backgroundColor: item.payment.status === 'void' 
                    ? (isDarkMode ? '#2a2a2a' : '#f3f4f6')
                    : (isDarkMode ? '#1f1f1f' : 'white'),
                  opacity: item.payment.status === 'void' ? 0.6 : 1
                }}>
                  <td style={tdStyle}>
                    {item.applications.length > 0 && (
                      <button
                        onClick={() => toggleExpand(item.payment.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isDarkMode ? '#9ca3af' : '#9ca3af',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                      >
                        <svg
                          style={{
                            width: '20px',
                            height: '20px',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s'
                          }}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: '#2563eb', fontWeight: 500 }}>
                    {item.payment.payment_number}
                  </td>
                  <td style={tdStyle}>
                    {item.vendor?.vendor_name || 'Unknown'}
                    <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>
                      {item.vendor?.vendor_number}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {new Date(item.payment.payment_date).toLocaleDateString()}
                  </td>
                  <td style={tdStyle}>
                    {getPaymentMethodLabel(item.payment.payment_method)}
                    {item.payment.reference_number && (
                      <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>
                        Ref: {item.payment.reference_number}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>
                    {formatCurrency(item.payment.payment_amount)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(totalApplied)}</span>
                    {item.payment.unapplied_amount > 0 && (
                      <div style={{ fontSize: '12px', color: '#ea580c', marginTop: '4px' }}>
                        Unapplied: {formatCurrency(item.payment.unapplied_amount)}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '9999px',
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.color
                    }}>
                      {item.payment.status.charAt(0).toUpperCase() + item.payment.status.slice(1)}
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
                      {item.payment.payment_method === 'check' && onPrintCheck && item.payment.status !== 'void' && (
                        <button
                          onClick={() => onPrintCheck(item)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#9333ea',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500
                          }}
                        >
                          Print Check
                        </button>
                      )}
                      {item.payment.status !== 'void' && (
                        <button
                          onClick={() => onVoid(item)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500
                          }}
                        >
                          Void
                        </button>
                      )}
                      {item.payment.status !== 'void' && item.applications.length === 0 && (
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
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded Applications */}
                {isExpanded && (
                  <tr>
                    <td colSpan={9} style={{
                      padding: '24px',
                      backgroundColor: isDarkMode ? '#2a2a2a' : '#f9fafb'
                    }}>
                      <div style={{ fontSize: '14px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '12px', color: isDarkMode ? '#ffffff' : '#111827' }}>
                          Applied to Bills:
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f3f4f6' }}>
                              <th style={{ ...thStyle, padding: '8px 12px', fontSize: '11px' }}>Bill #</th>
                              <th style={{ ...thStyle, padding: '8px 12px', fontSize: '11px' }}>Vendor Ref</th>
                              <th style={{ ...thStyle, padding: '8px 12px', fontSize: '11px', textAlign: 'right' }}>Bill Total</th>
                              <th style={{ ...thStyle, padding: '8px 12px', fontSize: '11px', textAlign: 'right' }}>Balance Due</th>
                              <th style={{ ...thStyle, padding: '8px 12px', fontSize: '11px', textAlign: 'right' }}>Amount Applied</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.applied_bills?.map((app) => (
                              <tr key={app.id} style={{ borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}` }}>
                                <td style={{ ...tdStyle, padding: '8px 12px' }}>{app.bill_number}</td>
                                <td style={{ ...tdStyle, padding: '8px 12px', fontSize: '12px' }}>{app.vendor_reference || '-'}</td>
                                <td style={{ ...tdStyle, padding: '8px 12px', textAlign: 'right' }}>{formatCurrency(app.total_amount)}</td>
                                <td style={{ ...tdStyle, padding: '8px 12px', textAlign: 'right' }}>{formatCurrency(app.balance_due)}</td>
                                <td style={{ ...tdStyle, padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: '#16a34a' }}>
                                  {formatCurrency(app.amount_applied)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {item.payment.memo && (
                          <div style={{
                            marginTop: '12px',
                            padding: '8px',
                            backgroundColor: isDarkMode ? '#1e3a5f' : '#dbeafe',
                            borderRadius: '6px'
                          }}>
                            <span style={{ fontWeight: 600, fontSize: '12px', color: isDarkMode ? '#ffffff' : '#111827' }}>Memo:</span>{' '}
                            <span style={{ fontSize: '12px', color: isDarkMode ? '#d1d5db' : '#374151' }}>{item.payment.memo}</span>
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

export default BillPaymentTable
