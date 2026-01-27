import React, { useState } from 'react'

function BillTable({ bills = [], onView, onEdit, onDelete, onVoid, onPayBill }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const [expandedIds, setExpandedIds] = useState(new Set())

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getStatusColor = (status) => {
    const map = {
      draft: { bg: isDarkMode ? '#2a2a2a' : '#e5e7eb', color: '#6b7280' },
      open: { bg: isDarkMode ? 'rgba(59,130,246,0.2)' : '#dbeafe', color: '#2563eb' },
      partial: { bg: isDarkMode ? 'rgba(234,179,8,0.2)' : '#fef9c3', color: '#a16207' },
      paid: { bg: isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7', color: '#16a34a' },
      void: { bg: isDarkMode ? '#2a2a2a' : '#e5e7eb', color: '#6b7280' }
    }
    return map[status] || map.open
  }

  const getVendorName = (vendor) => {
    if (!vendor) return 'Unknown Vendor'
    return vendor.vendor_name || 'Unknown'
  }

  const isOverdue = (b) => {
    if (!b || !b.due_date) return false
    return new Date(b.due_date) < new Date() && (b.balance_due || 0) > 0 && b.status !== 'void' && b.status !== 'paid'
  }

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!bills || bills.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
        No bills found
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
            <th style={thStyle}>Bill #</th>
            <th style={thStyle}>Vendor</th>
            <th style={thStyle}>Date / Due</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Balance Due</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((item) => {
            const b = item.bill || item
            const lines = item.lines || []
            const vendor = item.vendor
            const expanded = expandedIds.has(b.id)
            const overdue = isOverdue(b)
            const statusStyle = getStatusColor(b.status)
            const canEdit = (b.status === 'draft' || b.status === 'open') && (b.amount_paid || 0) === 0
            const canPay = (b.balance_due || 0) > 0 && b.status !== 'void' && b.status !== 'draft'
            const canVoid = b.status !== 'void' && (b.amount_paid || 0) === 0

            return (
              <React.Fragment key={b.id}>
                <tr
                  style={{
                    backgroundColor: overdue ? (isDarkMode ? 'rgba(220,38,38,0.08)' : '#fef2f2') : 'transparent',
                    opacity: b.status === 'void' ? 0.6 : 1
                  }}
                >
                  <td style={tdStyle}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(b.id)}
                      style={{ background: 'none', border: 'none', color: isDarkMode ? '#9ca3af' : '#6b7280', cursor: 'pointer', padding: '4px' }}
                    >
                      <svg
                        width="20"
                        height="20"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500, color: '#2563eb' }}>{b.bill_number}</div>
                    {b.vendor_reference && <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Ref: {b.vendor_reference}</div>}
                  </td>
                  <td style={tdStyle}>{getVendorName(vendor)}</td>
                  <td style={tdStyle}>
                    <div>{b.bill_date ? new Date(b.bill_date).toLocaleDateString() : '—'}</div>
                    <div style={{ fontSize: '12px', color: overdue ? '#dc2626' : (isDarkMode ? '#9ca3af' : '#6b7280'), fontWeight: overdue ? 600 : 400 }}>
                      Due: {b.due_date ? new Date(b.due_date).toLocaleDateString() : '—'}
                      {overdue && ' (OVERDUE)'}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>
                    {formatCurrency(b.total_amount)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={{ fontWeight: 600, color: (b.balance_due || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                      {formatCurrency(b.balance_due)}
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
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.color
                      }}
                    >
                      {(b.status || 'open').charAt(0).toUpperCase() + (b.status || '').slice(1)}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => onView(item)} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                        View
                      </button>
                      {canEdit && (
                        <>
                          <button type="button" onClick={() => onEdit(item)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                            Edit
                          </button>
                          <button type="button" onClick={() => onDelete(item)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                            Delete
                          </button>
                        </>
                      )}
                      {canPay && (
                        <button type="button" onClick={() => onPayBill(item)} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                          Pay Bill
                        </button>
                      )}
                      {canVoid && (
                        <button type="button" onClick={() => onVoid(item)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                          Void
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={8} style={{ padding: '16px 24px', backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                      <div style={{ fontSize: '14px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '8px' }}>Line Items</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                                Description
                              </th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                                Account
                              </th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                                Qty
                              </th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                                Cost
                              </th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {lines.map((line, i) => (
                              <tr key={line.id || i} style={{ borderBottom: '1px solid ' + (isDarkMode ? '#2a2a2a' : '#e5e7eb') }}>
                                <td style={{ padding: '8px 12px' }}>
                                  {line.description}
                                  {line.billable && (
                                    <span style={{ marginLeft: '8px', display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, backgroundColor: isDarkMode ? 'rgba(168,85,247,0.2)' : '#f3e8ff', color: '#7c3aed' }}>
                                      Billable
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: '13px' }}>
                                  {line.account_number && `${line.account_number} - `}
                                  {line.account_name || '—'}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{line.quantity}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatCurrency(line.unit_cost)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(line.line_total || (line.quantity || 0) * (line.unit_cost || 0))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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

export default BillTable
