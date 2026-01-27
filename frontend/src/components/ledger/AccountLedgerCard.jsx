import React from 'react'

function AccountLedgerCard({ ledgerData, dateRange }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const calculatePeriodActivity = () => {
    const periodDebits = ledgerData.entries.reduce((sum, entry) => sum + (entry.debit_amount || 0), 0)
    const periodCredits = ledgerData.entries.reduce((sum, entry) => sum + (entry.credit_amount || 0), 0)
    
    let netChange = 0
    if (ledgerData.account.balance_type === 'debit') {
      netChange = periodDebits - periodCredits
    } else {
      netChange = periodCredits - periodDebits
    }

    const beginningBalance = ledgerData.ending_balance - netChange

    return { periodDebits, periodCredits, netChange, beginningBalance }
  }

  const { periodDebits, periodCredits, netChange, beginningBalance } = calculatePeriodActivity()

  const cardStyle = {
    backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
    border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
    boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.1)'
  }

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px',
    marginBottom: '24px'
  }

  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e5e7eb'

  return (
    <div style={cardStyle}>
      <div style={gridStyle}>
        {/* Account Info */}
        <div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            marginBottom: '16px',
            color: textColor
          }}>
            Account Details
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Account Number:</span>
              <span style={{ fontWeight: '500', color: textColor }}>
                {ledgerData.account.account_number || 'N/A'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Account Name:</span>
              <span style={{ fontWeight: '500', color: textColor }}>
                {ledgerData.account.account_name}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Account Type:</span>
              <span style={{ fontWeight: '500', color: textColor }}>
                {ledgerData.account.account_type}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Balance Type:</span>
              <span style={{ fontWeight: '500', color: textColor, textTransform: 'capitalize' }}>
                {ledgerData.account.balance_type}
              </span>
            </div>
          </div>
        </div>

        {/* Balance Summary */}
        <div>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            marginBottom: '16px',
            color: textColor
          }}>
            Balance Summary
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {dateRange?.start && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Period:</span>
                <span style={{ fontWeight: '500', color: textColor }}>
                  {dateRange.start ? new Date(dateRange.start).toLocaleDateString() : 'Beginning'} - 
                  {dateRange.end ? new Date(dateRange.end).toLocaleDateString() : 'Now'}
                </span>
              </div>
            )}
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              paddingTop: '8px',
              borderTop: `1px solid ${borderColor}`
            }}>
              <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Beginning Balance:</span>
              <span style={{ fontWeight: '600', color: textColor }}>
                ${beginningBalance.toFixed(2)}
              </span>
            </div>
            
            <div style={{ 
              backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
              padding: '12px',
              borderRadius: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: '14px' }}>Period Debits:</span>
                <span style={{ fontWeight: '500', fontSize: '14px', color: textColor }}>
                  +${periodDebits.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: '14px' }}>Period Credits:</span>
                <span style={{ fontWeight: '500', fontSize: '14px', color: textColor }}>
                  -${periodCredits.toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Net Change:</span>
              <span style={{ 
                fontWeight: '600',
                color: netChange >= 0 ? '#10b981' : '#ef4444'
              }}>
                {netChange >= 0 ? '+' : ''}${netChange.toFixed(2)}
              </span>
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              paddingTop: '8px',
              borderTop: `2px solid ${borderColor}`
            }}>
              <span style={{ color: textColor, fontWeight: '600' }}>Ending Balance:</span>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#6366f1' }}>
                ${ledgerData.ending_balance.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Count */}
      <div style={{ 
        marginTop: '24px', 
        paddingTop: '16px', 
        borderTop: `1px solid ${borderColor}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Total Transactions:</span>
        <span style={{ fontWeight: '600', fontSize: '18px', color: textColor }}>
          {ledgerData.entries.length}
        </span>
      </div>
    </div>
  )
}

export default AccountLedgerCard
