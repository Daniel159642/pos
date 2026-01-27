import React, { useState } from 'react'
import Button from '../common/Button'

function TransactionTable({ transactions, onView, onEdit, onDelete, onPost, onUnpost, onVoid }) {
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

  const calculateTotals = (lines) => {
    const debits = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0)
    const credits = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0)
    return { debits, credits }
  }

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: isDarkMode ? '#2a2a2a' : 'white'
  }

  const thStyle = {
    padding: '12px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    color: isDarkMode ? '#9ca3af' : '#6b7280',
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
  }

  const tdStyle = {
    padding: '12px',
    fontSize: '14px',
    color: isDarkMode ? '#d1d5db' : '#1a1a1a',
    borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
  }

  const statusBadgeStyle = (status) => {
    const baseStyle = {
      padding: '4px 8px',
      fontSize: '12px',
      fontWeight: '600',
      borderRadius: '12px',
      display: 'inline-block'
    }
    
    if (status === 'voided') {
      return { ...baseStyle, backgroundColor: '#fee2e2', color: '#991b1b' }
    } else if (status === 'posted') {
      return { ...baseStyle, backgroundColor: '#d1fae5', color: '#065f46' }
    } else {
      return { ...baseStyle, backgroundColor: '#fef3c7', color: '#92400e' }
    }
  }

  const actionButtonStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    padding: '4px 8px',
    margin: '0 4px'
  }

  if (transactions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
        <p>No transactions found</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}></th>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Transaction #</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Description</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((item) => {
            const isExpanded = expandedIds.has(item.transaction.id)
            const { debits, credits } = calculateTotals(item.lines)
            const status = item.transaction.is_void ? 'voided' : 
                          item.transaction.is_posted ? 'posted' : 'draft'
            
            return (
              <React.Fragment key={item.transaction.id}>
                <tr style={{
                  backgroundColor: item.transaction.is_void 
                    ? (isDarkMode ? '#2a1a1a' : '#fee2e2') 
                    : (isDarkMode ? '#2a2a2a' : 'white'),
                  opacity: item.transaction.is_void ? 0.6 : 1
                }}>
                  <td style={tdStyle}>
                    <button
                      onClick={() => toggleExpand(item.transaction.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: isDarkMode ? '#9ca3af' : '#6b7280',
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}
                    >
                      ▶
                    </button>
                  </td>
                  <td style={tdStyle}>
                    {new Date(item.transaction.transaction_date).toLocaleDateString()}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: '600' }}>
                    {item.transaction.transaction_number}
                  </td>
                  <td style={tdStyle}>
                    {item.transaction.transaction_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </td>
                  <td style={tdStyle}>
                    {item.transaction.description}
                    {item.transaction.reference_number && (
                      <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>
                        Ref: {item.transaction.reference_number}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600' }}>
                    ${debits.toFixed(2)}
                  </td>
                  <td style={tdStyle}>
                    <span style={statusBadgeStyle(status)}>
                      {status === 'voided' ? 'Voided' : status === 'posted' ? 'Posted' : 'Draft'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => onView(item)}
                        style={{ ...actionButtonStyle, color: '#6366f1' }}
                      >
                        View
                      </button>
                      {!item.transaction.is_posted && !item.transaction.is_void && (
                        <>
                          <button
                            onClick={() => onEdit(item)}
                            style={{ ...actionButtonStyle, color: '#2563eb' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onPost(item)}
                            style={{ ...actionButtonStyle, color: '#10b981' }}
                          >
                            Post
                          </button>
                          <button
                            onClick={() => onDelete(item)}
                            style={{ ...actionButtonStyle, color: '#ef4444' }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {item.transaction.is_posted && !item.transaction.is_void && (
                        <>
                          <button
                            onClick={() => onUnpost(item)}
                            style={{ ...actionButtonStyle, color: '#f59e0b' }}
                          >
                            Unpost
                          </button>
                          <button
                            onClick={() => onVoid(item)}
                            style={{ ...actionButtonStyle, color: '#ef4444' }}
                          >
                            Void
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded Lines */}
                {isExpanded && (
                  <tr>
                    <td colSpan={8} style={{ ...tdStyle, padding: '16px', backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb' }}>
                      <div style={{ fontSize: '14px' }}>
                        <div style={{ fontWeight: '600', marginBottom: '12px', color: isDarkMode ? '#ffffff' : '#1a1a1a' }}>
                          Transaction Lines:
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f3f4f6' }}>
                              <th style={{ ...tdStyle, padding: '8px', fontSize: '12px', fontWeight: '600' }}>Account</th>
                              <th style={{ ...tdStyle, padding: '8px', fontSize: '12px', fontWeight: '600' }}>Description</th>
                              <th style={{ ...tdStyle, padding: '8px', fontSize: '12px', fontWeight: '600', textAlign: 'right' }}>Debit</th>
                              <th style={{ ...tdStyle, padding: '8px', fontSize: '12px', fontWeight: '600', textAlign: 'right' }}>Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.lines.map((line) => (
                              <tr key={line.id} style={{ borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}` }}>
                                <td style={{ ...tdStyle, padding: '8px' }}>
                                  {line.account_number && `${line.account_number} - `}
                                  {line.account_name}
                                </td>
                                <td style={{ ...tdStyle, padding: '8px' }}>{line.description}</td>
                                <td style={{ ...tdStyle, padding: '8px', textAlign: 'right' }}>
                                  {line.debit_amount > 0 ? `$${line.debit_amount.toFixed(2)}` : '-'}
                                </td>
                                <td style={{ ...tdStyle, padding: '8px', textAlign: 'right' }}>
                                  {line.credit_amount > 0 ? `$${line.credit_amount.toFixed(2)}` : '-'}
                                </td>
                              </tr>
                            ))}
                            <tr style={{ fontWeight: '600', backgroundColor: isDarkMode ? '#2a2a2a' : '#f3f4f6' }}>
                              <td style={{ ...tdStyle, padding: '8px' }} colSpan={2}>
                                Totals:
                              </td>
                              <td style={{ ...tdStyle, padding: '8px', textAlign: 'right' }}>${debits.toFixed(2)}</td>
                              <td style={{ ...tdStyle, padding: '8px', textAlign: 'right' }}>${credits.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                        {item.transaction.is_void && (
                          <div style={{ marginTop: '12px', color: '#ef4444' }}>
                            <strong>Void Reason:</strong> {item.transaction.void_reason}
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

export default TransactionTable
