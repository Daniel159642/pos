import React, { useState, useMemo } from 'react'

function GeneralLedgerTable({ entries, showRunningBalance = false, onViewTransaction }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const [sortField, setSortField] = useState('transaction_date')
  const [sortDirection, setSortDirection] = useState('desc')

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      let comparison = 0
      
      if (sortField === 'transaction_date') {
        comparison = new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
      } else {
        comparison = (a.account_name || '').localeCompare(b.account_name || '')
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [entries, sortField, sortDirection])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const calculateTotals = () => {
    const totalDebits = entries.reduce((sum, entry) => sum + (entry.debit_amount || 0), 0)
    const totalCredits = entries.reduce((sum, entry) => sum + (entry.credit_amount || 0), 0)
    return { totalDebits, totalCredits }
  }

  const { totalDebits, totalCredits } = calculateTotals()

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <span style={{ marginLeft: '4px', color: isDarkMode ? '#6b7280' : '#9ca3af' }}>↕</span>
    }
    return <span style={{ marginLeft: '4px' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: isDarkMode ? '#2a2a2a' : 'white'
  }

  const thStyle = {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    color: isDarkMode ? '#9ca3af' : '#6b7280',
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
    cursor: 'pointer'
  }

  const tdStyle = {
    padding: '12px 16px',
    fontSize: '14px',
    color: isDarkMode ? '#d1d5db' : '#1a1a1a',
    borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
  }

  if (entries.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '48px', 
        backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
        borderRadius: '8px',
        border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
      }}>
        <p style={{ color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '8px' }}>
          No ledger entries found for the selected criteria
        </p>
        <p style={{ fontSize: '14px', color: isDarkMode ? '#6b7280' : '#9ca3af' }}>
          Try adjusting your filters or post some transactions
        </p>
      </div>
    )
  }

  return (
    <div style={{ 
      backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
      borderRadius: '8px',
      border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
      overflow: 'hidden',
      boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th
                style={thStyle}
                onClick={() => handleSort('transaction_date')}
                onMouseEnter={(e) => e.target.style.backgroundColor = isDarkMode ? '#2a2a2a' : '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = isDarkMode ? '#1a1a1a' : '#f9fafb'}
              >
                Date <SortIcon field="transaction_date" />
              </th>
              <th style={thStyle}>Transaction #</th>
              <th
                style={thStyle}
                onClick={() => handleSort('account_name')}
                onMouseEnter={(e) => e.target.style.backgroundColor = isDarkMode ? '#2a2a2a' : '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = isDarkMode ? '#1a1a1a' : '#f9fafb'}
              >
                Account <SortIcon field="account_name" />
              </th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Debit</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Credit</th>
              {showRunningBalance && (
                <th style={{ ...thStyle, textAlign: 'right' }}>Balance</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry, index) => (
              <tr
                key={`${entry.transaction_id}-${entry.line_id}`}
                style={{
                  cursor: 'pointer',
                  backgroundColor: index % 2 === 0 
                    ? (isDarkMode ? '#2a2a2a' : 'white')
                    : (isDarkMode ? '#1f1f1f' : '#f9fafb')
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = isDarkMode ? '#3a3a3a' : '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = index % 2 === 0 
                  ? (isDarkMode ? '#2a2a2a' : 'white')
                  : (isDarkMode ? '#1f1f1f' : '#f9fafb')
                }
                onClick={() => onViewTransaction(entry.transaction_id)}
              >
                <td style={tdStyle}>
                  {new Date(entry.transaction_date).toLocaleDateString()}
                </td>
                <td style={{ ...tdStyle, fontWeight: '600', color: '#6366f1' }}>
                  {entry.transaction_number}
                </td>
                <td style={tdStyle}>
                  <div style={{ fontWeight: '500' }}>
                    {entry.account_number && `${entry.account_number} - `}
                    {entry.account_name}
                  </div>
                  <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '2px' }}>
                    {entry.account_type}
                  </div>
                </td>
                <td style={tdStyle}>
                  <div>{entry.line_description}</div>
                  {entry.reference_number && (
                    <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '2px' }}>
                      Ref: {entry.reference_number}
                    </div>
                  )}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600' }}>
                  {entry.debit_amount > 0 ? `$${entry.debit_amount.toFixed(2)}` : '-'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600' }}>
                  {entry.credit_amount > 0 ? `$${entry.credit_amount.toFixed(2)}` : '-'}
                </td>
                {showRunningBalance && entry.running_balance !== undefined && (
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700' }}>
                    ${entry.running_balance.toFixed(2)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f3f4f6', fontWeight: '600' }}>
            <tr>
              <td colSpan={4} style={{ ...tdStyle, textAlign: 'right' }}>
                Totals:
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700' }}>
                ${totalDebits.toFixed(2)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700' }}>
                ${totalCredits.toFixed(2)}
              </td>
              {showRunningBalance && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default GeneralLedgerTable
