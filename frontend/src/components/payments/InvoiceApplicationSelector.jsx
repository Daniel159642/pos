import React, { useState, useEffect } from 'react'

function InvoiceApplicationSelector({ outstandingInvoices, paymentAmount, applications, onChange }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const [selectedInvoices, setSelectedInvoices] = useState(new Set())

  useEffect(() => {
    const selected = new Set((applications || []).map((app) => app.invoice_id))
    setSelectedInvoices(selected)
  }, [applications])

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getApplication = (invoiceId) => (applications || []).find((app) => app.invoice_id === invoiceId)

  const handleInvoiceToggle = (invoice) => {
    const newSelected = new Set(selectedInvoices)
    const newApplications = [...(applications || [])]

    if (newSelected.has(invoice.id)) {
      newSelected.delete(invoice.id)
      const idx = newApplications.findIndex((app) => app.invoice_id === invoice.id)
      if (idx > -1) newApplications.splice(idx, 1)
    } else {
      newSelected.add(invoice.id)
      const totalApplied = newApplications.reduce((sum, app) => sum + (app.amount_applied || 0), 0)
      const remaining = Math.max(0, (paymentAmount || 0) - totalApplied)
      const amountToApply = Math.min(Number(invoice.balance_due) || 0, remaining)
      newApplications.push({ invoice_id: invoice.id, amount_applied: amountToApply })
    }

    setSelectedInvoices(newSelected)
    onChange(newApplications)
  }

  const handleAmountChange = (invoiceId, amount) => {
    const amt = Math.max(0, parseFloat(amount) || 0)
    const newApplications = (applications || []).map((app) =>
      app.invoice_id === invoiceId ? { ...app, amount_applied: amt } : app
    )
    onChange(newApplications)
  }

  const totalApplied = (applications || []).reduce((sum, app) => sum + (app.amount_applied || 0), 0)
  const unapplied = (paymentAmount || 0) - totalApplied
  const isOverApplied = totalApplied > (paymentAmount || 0)

  if (!outstandingInvoices || outstandingInvoices.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '32px 16px',
          backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb',
          borderRadius: '8px',
          color: isDarkMode ? '#9ca3af' : '#6b7280'
        }}
      >
        No outstanding invoices for this customer
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : '#eff6ff',
          border: '1px solid ' + (isDarkMode ? 'rgba(59,130,246,0.3)' : '#bfdbfe')
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#93c5fd' : '#1e40af', margin: '0 0 4px' }}>
              Payment Amount: {formatCurrency(paymentAmount)}
            </p>
            <p style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#4b5563', margin: 0 }}>Select invoices to apply this payment</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', margin: '0 0 4px' }}>
              Applied: <span style={{ fontWeight: 600 }}>{formatCurrency(totalApplied)}</span>
            </p>
            <p style={{ fontSize: '14px', margin: 0, color: isOverApplied ? '#dc2626' : isDarkMode ? '#9ca3af' : '#6b7280' }}>
              Unapplied: <span style={{ fontWeight: 600 }}>{formatCurrency(unapplied)}</span>
            </p>
          </div>
        </div>
        {isOverApplied && (
          <p style={{ marginTop: '12px', marginBottom: 0, fontSize: '14px', fontWeight: 600, color: '#dc2626' }}>
            ⚠️ Warning: Total applied exceeds payment amount!
          </p>
        )}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb'), borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '48px', textAlign: 'center' }}>Apply</th>
              <th style={thStyle}>Invoice #</th>
              <th style={thStyle}>Date / Due</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Balance Due</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Amount to Apply</th>
            </tr>
          </thead>
          <tbody>
            {outstandingInvoices.map((invoice) => {
              const isSelected = selectedInvoices.has(invoice.id)
              const app = getApplication(invoice.id)
              const isOverdue = new Date(invoice.due_date) < new Date()
              const balanceDue = Number(invoice.balance_due) || 0

              return (
                <tr
                  key={invoice.id}
                  style={{
                    backgroundColor: isOverdue ? (isDarkMode ? 'rgba(239,68,68,0.08)' : '#fef2f2') : isSelected ? (isDarkMode ? 'rgba(59,130,246,0.08)' : '#eff6ff') : 'transparent'
                  }}
                >
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleInvoiceToggle(invoice)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500, color: isDarkMode ? '#e5e7eb' : '#111' }}>{invoice.invoice_number}</span>
                    {isOverdue && (
                      <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>OVERDUE</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ color: isDarkMode ? '#e5e7eb' : '#111' }}>{new Date(invoice.invoice_date).toLocaleDateString()}</div>
                    <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Due: {new Date(invoice.due_date).toLocaleDateString()}</div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(invoice.total_amount)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatCurrency(balanceDue)}</span>
                  </td>
                  <td style={tdStyle}>
                    {isSelected ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={balanceDue}
                        value={app?.amount_applied ?? ''}
                        onChange={(e) => handleAmountChange(invoice.id, e.target.value)}
                        style={{
                          width: '120px',
                          padding: '6px 10px',
                          fontSize: '14px',
                          textAlign: 'right',
                          border: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#d1d5db'),
                          borderRadius: '6px',
                          backgroundColor: isDarkMode ? '#1f1f1f' : 'white',
                          color: isDarkMode ? '#fff' : '#111'
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '14px', color: isDarkMode ? '#6b7280' : '#9ca3af' }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot style={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f3f4f6', fontWeight: 600 }}>
            <tr>
              <td colSpan={5} style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none' }}>
                Total Applied:
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none', color: isOverApplied ? '#dc2626' : '#16a34a', fontSize: '16px' }}>
                {formatCurrency(totalApplied)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default InvoiceApplicationSelector
