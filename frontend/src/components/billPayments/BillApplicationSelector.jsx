import React, { useState, useEffect } from 'react'

function BillApplicationSelector({
  outstandingBills = [],
  paymentAmount = 0,
  applications = [],
  onChange
}) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const [selectedBills, setSelectedBills] = useState(new Set())

  useEffect(() => {
    const selected = new Set(applications.map(app => app.bill_id))
    setSelectedBills(selected)
  }, [applications])

  const handleBillToggle = (bill) => {
    const newSelected = new Set(selectedBills)
    const newApplications = [...applications]

    if (newSelected.has(bill.id)) {
      // Unselect
      newSelected.delete(bill.id)
      const index = newApplications.findIndex(app => app.bill_id === bill.id)
      if (index > -1) {
        newApplications.splice(index, 1)
      }
    } else {
      // Select and auto-apply
      newSelected.add(bill.id)
      const totalApplied = newApplications.reduce((sum, app) => sum + app.amount_applied, 0)
      const remainingPayment = paymentAmount - totalApplied
      const amountToApply = Math.min(bill.balance_due, remainingPayment)
      
      newApplications.push({
        bill_id: bill.id,
        amount_applied: amountToApply
      })
    }

    setSelectedBills(newSelected)
    onChange(newApplications)
  }

  const handleAmountChange = (billId, amount) => {
    const newApplications = applications.map(app => 
      app.bill_id === billId 
        ? { ...app, amount_applied: parseFloat(amount) || 0 }
        : app
    )
    onChange(newApplications)
  }

  const totalApplied = applications.reduce((sum, app) => sum + (app.amount_applied || 0), 0)
  const unappliedAmount = paymentAmount - totalApplied
  const isOverApplied = totalApplied > paymentAmount

  const formatCurrency = (amount) => {
    return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getApplication = (billId) => {
    return applications.find(app => app.bill_id === billId)
  }

  if (outstandingBills.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '32px',
        backgroundColor: isDarkMode ? '#2a2a2a' : '#f9fafb',
        borderRadius: '8px',
        color: isDarkMode ? '#ffffff' : '#6b7280'
      }}>
        <p>No outstanding bills for this vendor</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        backgroundColor: isDarkMode ? '#1e3a5f' : '#dbeafe',
        border: `1px solid ${isDarkMode ? '#3b82f6' : '#93c5fd'}`,
        borderRadius: '8px',
        padding: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#ffffff' : '#374151', margin: 0 }}>
              Payment Amount: {formatCurrency(paymentAmount)}
            </p>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#6b7280', margin: '4px 0 0 0' }}>
              Select bills to pay
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#ffffff' : '#374151', margin: 0 }}>
              Applied: <span style={{ fontWeight: 600 }}>{formatCurrency(totalApplied)}</span>
            </p>
            <p style={{ 
              fontSize: '14px', 
              color: isOverApplied ? '#dc2626' : (isDarkMode ? '#d1d5db' : '#6b7280'),
              margin: '4px 0 0 0'
            }}>
              Unapplied: <span style={{ fontWeight: 600 }}>{formatCurrency(unappliedAmount)}</span>
            </p>
          </div>
        </div>
        {isOverApplied && (
          <p style={{
            marginTop: '8px',
            fontSize: '14px',
            color: '#dc2626',
            fontWeight: 600
          }}>
            ⚠️ Warning: Total applied exceeds payment amount!
          </p>
        )}
      </div>

      <div style={{
        border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f9fafb' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#ffffff' : '#6b7280', textTransform: 'uppercase', width: '48px' }}>
                Pay
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#ffffff' : '#6b7280', textTransform: 'uppercase' }}>
                Bill #
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#ffffff' : '#6b7280', textTransform: 'uppercase' }}>
                Date / Due
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#ffffff' : '#6b7280', textTransform: 'uppercase' }}>
                Total
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#ffffff' : '#6b7280', textTransform: 'uppercase' }}>
                Balance Due
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#ffffff' : '#6b7280', textTransform: 'uppercase' }}>
                Amount to Pay
              </th>
            </tr>
          </thead>
          <tbody>
            {outstandingBills.map((bill) => {
              const isSelected = selectedBills.has(bill.id)
              const application = getApplication(bill.id)
              const isOverdue = new Date(bill.due_date) < new Date()

              return (
                <tr 
                  key={bill.id} 
                  style={{
                    backgroundColor: isSelected 
                      ? (isDarkMode ? '#1e3a5f' : '#dbeafe')
                      : (isOverdue ? (isDarkMode ? '#4a1f1f' : '#fef2f2') : (isDarkMode ? '#1f1f1f' : 'white')),
                    borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
                  }}
                >
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleBillToggle(bill)}
                      style={{
                        width: '16px',
                        height: '16px',
                        cursor: 'pointer'
                      }}
                    />
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#ffffff' : '#111827' }}>
                    {bill.bill_number}
                    {bill.vendor_reference && (
                      <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>
                        Ref: {bill.vendor_reference}
                      </div>
                    )}
                    {isOverdue && (
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
                        OVERDUE
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', color: isDarkMode ? '#ffffff' : '#111827' }}>
                    <div>{new Date(bill.bill_date).toLocaleDateString()}</div>
                    <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>
                      Due: {new Date(bill.due_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', color: isDarkMode ? '#ffffff' : '#111827', textAlign: 'right' }}>
                    {formatCurrency(bill.total_amount)}
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', textAlign: 'right' }}>
                    <span style={{ fontWeight: 600, color: '#dc2626' }}>
                      {formatCurrency(bill.balance_due)}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    {isSelected ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={bill.balance_due}
                        value={application?.amount_applied || 0}
                        onChange={(e) => handleAmountChange(bill.id, e.target.value)}
                        style={{
                          width: '128px',
                          padding: '4px 8px',
                          fontSize: '14px',
                          textAlign: 'right',
                          border: `1px solid ${isDarkMode ? '#3a3a3a' : '#d1d5db'}`,
                          borderRadius: '6px',
                          backgroundColor: isDarkMode ? '#1f1f1f' : 'white',
                          color: isDarkMode ? '#ffffff' : '#1a1a1a',
                          outline: 'none'
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '14px', color: isDarkMode ? '#6b7280' : '#9ca3af' }}>-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot style={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f3f4f6', fontWeight: 600 }}>
            <tr>
              <td colSpan={5} style={{ padding: '12px 24px', textAlign: 'right', fontSize: '14px', color: isDarkMode ? '#ffffff' : '#111827' }}>
                Total Paying:
              </td>
              <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                <span style={{ 
                  fontSize: '18px', 
                  color: isOverApplied ? '#dc2626' : '#16a34a'
                }}>
                  {formatCurrency(totalApplied)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default BillApplicationSelector
