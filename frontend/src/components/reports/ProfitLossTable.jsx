import React from 'react'

function ProfitLossTable({ data, showPercentages = true, onAccountClick }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toFixed(2)}`
  }

  const formatPercentage = (percentage) => {
    if (percentage === undefined || percentage === null) return ''
    const n = Number(percentage)
    if (Number.isNaN(n)) return ''
    return `${n.toFixed(1)}%`
  }

  const AccountRow = ({ account, indent = false }) => {
    const rowStyle = {
      cursor: onAccountClick ? 'pointer' : 'default',
      backgroundColor: 'transparent'
    }

    return (
      <tr
        style={rowStyle}
        onMouseEnter={(e) => {
          if (onAccountClick) {
            e.target.closest('tr').style.backgroundColor = isDarkMode ? '#3a3a3a' : '#f3f4f6'
          }
        }}
        onMouseLeave={(e) => {
          e.target.closest('tr').style.backgroundColor = 'transparent'
        }}
        onClick={() => onAccountClick && onAccountClick(account.account_id ?? account.id)}
      >
        <td style={{
          padding: '8px 24px',
          fontSize: '14px',
          color: isDarkMode ? '#d1d5db' : '#1a1a1a',
          paddingLeft: indent ? '48px' : '24px'
        }}>
          {account.account_number && `${account.account_number} - `}
          {account.account_name}
        </td>
        <td style={{
          padding: '8px 24px',
          fontSize: '14px',
          color: isDarkMode ? '#d1d5db' : '#1a1a1a',
          textAlign: 'right',
          fontWeight: '500'
        }}>
          {formatCurrency(account.balance)}
        </td>
        {showPercentages && (
          <td style={{
            padding: '8px 24px',
            fontSize: '14px',
            color: isDarkMode ? '#9ca3af' : '#6b7280',
            textAlign: 'right'
          }}>
            {formatPercentage(account.percentage_of_revenue)}
          </td>
        )}
      </tr>
    )
  }

  const TotalRow = ({ label, amount, percentage, className = '' }) => {
    const rowStyle = {
      fontWeight: '600',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
      borderTop: `2px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
    }

    if (className.includes('text-lg')) {
      rowStyle.fontSize = '16px'
      rowStyle.borderTop = `4px solid ${isDarkMode ? '#ffffff' : '#1a1a1a'}`
    }

    if (className.includes('bg-green')) {
      rowStyle.backgroundColor = isDarkMode ? '#1a3a1a' : '#d1fae5'
    } else if (className.includes('bg-red')) {
      rowStyle.backgroundColor = isDarkMode ? '#3a1a1a' : '#fee2e2'
    } else if (className.includes('bg-blue')) {
      rowStyle.backgroundColor = isDarkMode ? '#1a1a3a' : '#dbeafe'
    } else if (className.includes('bg-yellow')) {
      rowStyle.backgroundColor = isDarkMode ? '#3a3a1a' : '#fef3c7'
    }

    return (
      <tr style={rowStyle}>
        <td style={{
          padding: '12px 24px',
          fontSize: '14px',
          color: isDarkMode ? '#ffffff' : '#1a1a1a',
          fontWeight: '600'
        }}>
          {label}
        </td>
        <td style={{
          padding: '12px 24px',
          fontSize: '14px',
          textAlign: 'right',
          fontWeight: '700',
          color: amount < 0 ? '#ef4444' : (isDarkMode ? '#ffffff' : '#1a1a1a')
        }}>
          {formatCurrency(amount)}
        </td>
        {showPercentages && (
          <td style={{
            padding: '12px 24px',
            fontSize: '14px',
            textAlign: 'right',
            color: isDarkMode ? '#9ca3af' : '#6b7280'
          }}>
            {percentage !== undefined && percentage !== null ? formatPercentage(percentage) : ''}
          </td>
        )}
      </tr>
    )
  }

  const grossProfitPercentage = data.total_revenue > 0 
    ? (data.gross_profit / data.total_revenue) * 100 
    : 0

  const netIncomePercentage = data.total_revenue > 0 
    ? (data.net_income / data.total_revenue) * 100 
    : 0

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: isDarkMode ? '#2a2a2a' : 'white'
  }

  const thStyle = {
    padding: '12px 24px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    color: isDarkMode ? '#9ca3af' : '#6b7280',
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
  }

  const sectionHeaderStyle = {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '700',
    color: isDarkMode ? '#ffffff' : '#1a1a1a',
    backgroundColor: isDarkMode ? '#1a1a3a' : '#dbeafe'
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
              <th style={thStyle}>Account</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
              {showPercentages && (
                <th style={{ ...thStyle, textAlign: 'right' }}>% of Revenue</th>
              )}
            </tr>
          </thead>
          <tbody>
            {/* Revenue Section */}
            <tr>
              <td colSpan={showPercentages ? 3 : 2} style={sectionHeaderStyle}>
                REVENUE
              </td>
            </tr>
            {data.revenue.map((account) => (
              <AccountRow key={account.account_id} account={account} indent />
            ))}
            <TotalRow
              label="Total Revenue"
              amount={data.total_revenue}
              percentage={100}
              className="bg-blue"
            />

            {/* COGS Section */}
            {data.cost_of_goods_sold && data.cost_of_goods_sold.length > 0 && (
              <>
                <tr>
                  <td colSpan={showPercentages ? 3 : 2} style={{
                    ...sectionHeaderStyle,
                    backgroundColor: isDarkMode ? '#3a3a1a' : '#fef3c7'
                  }}>
                    COST OF GOODS SOLD
                  </td>
                </tr>
                {data.cost_of_goods_sold.map((account) => (
                  <AccountRow key={account.account_id} account={account} indent />
                ))}
                <TotalRow
                  label="Total Cost of Goods Sold"
                  amount={data.total_cogs}
                  percentage={(data.total_cogs / data.total_revenue) * 100}
                  className="bg-yellow"
                />
                
                <TotalRow
                  label="GROSS PROFIT"
                  amount={data.gross_profit}
                  percentage={grossProfitPercentage}
                  className="bg-green text-lg"
                />
              </>
            )}

            {/* Expenses Section */}
            <tr>
              <td colSpan={showPercentages ? 3 : 2} style={{
                ...sectionHeaderStyle,
                backgroundColor: isDarkMode ? '#3a1a1a' : '#fee2e2'
              }}>
                EXPENSES
              </td>
            </tr>
            {data.expenses.map((account) => (
              <AccountRow key={account.account_id} account={account} indent />
            ))}
            <TotalRow
              label="Total Expenses"
              amount={data.total_expenses}
              percentage={(data.total_expenses / data.total_revenue) * 100}
              className="bg-red"
            />

            {/* Net Income */}
            <TotalRow
              label="NET INCOME"
              amount={data.net_income}
              percentage={netIncomePercentage}
              className={`text-lg ${data.net_income >= 0 ? 'bg-green' : 'bg-red'}`}
            />
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ProfitLossTable
