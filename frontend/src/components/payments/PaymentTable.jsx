import React, { useState } from 'react'

function PaymentTable({ payments, onView, onVoid, onDelete }) {
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
    pending: { bg: isDarkMode ? 'rgba(234,179,8,0.2)' : '#fef9c3', color: '#a16207' },
    cleared: { bg: isDarkMode ? 'rgba(59,130,246,0.2)' : '#dbeafe', color: '#2563eb' },
    deposited: { bg: isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7', color: '#16a34a' },
    void: { bg: isDarkMode ? '#2a2a2a' : '#e5e7eb', color: '#6b7280' }
  }
  const getStatusStyle = (status) => statusColors[status] || statusColors.pending

  const methodLabels = {
    cash: 'Cash',
    check: 'Check',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    bank_transfer: 'Bank Transfer',
    ach: 'ACH',
    other: 'Other'
  }
  const getMethodLabel = (method) => methodLabels[method] || method || 'Other'

  if (!payments || payments.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
        No payments found
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
            <th style={thStyle}>Payment #</th>
            <th style={thStyle}>Customer</th>
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
            const pmt = item.payment || item
            const apps = item.applications || []
            const customer = item.customer
            const appliedInvoices = item.applied_invoices || []
            const totalApplied = apps.reduce((sum, a) => sum + (a.amount_applied || 0), 0)
            const isExpanded = expandedIds.has(pmt.id)
            const statusStyle = getStatusStyle(pmt.status)

            return (
              <React.Fragment key={pmt.id}>
                <tr style={{ opacity: pmt.status === 'void' ? 0.6 : 1, backgroundColor: pmt.status === 'void' ? (isDarkMode ? '#1f1f1f' : '#f9fafb') : 'transparent' }}>
                  <td style={tdStyle}>
                    {apps.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(pmt.id)}
                        style={{ background: 'none', border: 'none', color: isDarkMode ? '#6b7280' : '#9ca3af', cursor: 'pointer', padding: '4px' }}
                      >
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ) : (
                      <span />
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: '#2563eb' }}>{pmt.payment_number}</td>
                  <td style={tdStyle}>
                    <div style={{ color: isDarkMode ? '#e5e7eb' : '#111' }}>{customer?.display_name || customer?.company_name || 'Unknown'}</div>
                    {customer?.customer_number && <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{customer.customer_number}</div>}
                  </td>
                  <td style={tdStyle}>{new Date(pmt.payment_date).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <div style={{ color: isDarkMode ? '#e5e7eb' : '#111' }}>{getMethodLabel(pmt.payment_method)}</div>
                    {pmt.reference_number && <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Ref: {pmt.reference_number}</div>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>{formatCurrency(pmt.payment_amount)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(totalApplied)}</span>
                    {(pmt.unapplied_amount || 0) > 0 && (
                      <div style={{ fontSize: '12px', color: '#ea580c' }}>Unapplied: {formatCurrency(pmt.unapplied_amount)}</div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                      {String(pmt.status || '').charAt(0).toUpperCase() + (pmt.status || '').slice(1)}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => onView(item)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                        View
                      </button>
                      {pmt.status !== 'void' && (
                        <button type="button" onClick={() => onVoid(item)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                          Void
                        </button>
                      )}
                      {pmt.status !== 'void' && apps.length === 0 && (
                        <button type="button" onClick={() => onDelete(item)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={9} style={{ padding: '16px 24px', backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                      <div style={{ fontSize: '14px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '8px', color: isDarkMode ? '#e5e7eb' : '#374151' }}>Applied to Invoices</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f3f4f6' }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Invoice #</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Invoice Total</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Balance Due</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Amount Applied</th>
                            </tr>
                          </thead>
                          <tbody>
                            {appliedInvoices.map((app) => {
                              const inv = app.invoice || {}
                              const appl = app.application || {}
                              return (
                                <tr key={appl.id || inv.id} style={{ borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                                  <td style={{ padding: '8px 12px', color: isDarkMode ? '#e5e7eb' : '#111' }}>{inv.invoice_number}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#374151' }}>{formatCurrency(inv.total_amount)}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#374151' }}>{formatCurrency(inv.balance_due)}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: '#16a34a' }}>{formatCurrency(appl.amount_applied)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        {pmt.memo && (
                          <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '6px', backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : '#eff6ff', fontSize: '13px' }}>
                            <span style={{ fontWeight: 600, color: isDarkMode ? '#93c5fd' : '#1e40af' }}>Memo:</span> {pmt.memo}
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

export default PaymentTable
