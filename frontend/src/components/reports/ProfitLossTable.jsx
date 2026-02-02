import React from 'react'

function ProfitLossTable({ data, showPercentages = true, onAccountClick }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

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

  const TotalRow = ({ label, amount, percentage, className = '' }) => {
    const isFinalTotal = className.includes('final-total')
    const rowStyle = {
      fontWeight: isFinalTotal ? 700 : 600,
      backgroundColor: isFinalTotal ? (isDarkMode ? '#252525' : '#e8e8e8') : 'transparent',
      borderTop: isFinalTotal ? `2px solid ${borderColor}` : undefined,
      borderBottom: !isFinalTotal ? `1px solid ${borderColor}` : undefined
    }
    const pad = isFinalTotal ? '12px' : '10px 12px'
    return (
      <tr style={rowStyle}>
        <td style={{
          padding: pad,
          fontSize: '14px',
          color: textColor,
          fontWeight: rowStyle.fontWeight
        }}>
          {label}
        </td>
        <td style={{
          padding: pad,
          fontSize: '14px',
          textAlign: 'right',
          fontWeight: rowStyle.fontWeight,
          color: amount < 0 ? '#ef4444' : textColor
        }}>
          {formatCurrency(amount)}
        </td>
        {showPercentages && (
          <td style={{
            padding: pad,
            fontSize: '14px',
            textAlign: 'right',
            color: textColor
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
    fontSize: '14px'
  }

  const thStyle = {
    padding: '10px 12px',
    textAlign: 'left',
    color: textColor,
    backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9',
    borderBottom: `1px solid ${borderColor}`
  }

  const sectionHeaderStyle = {
    padding: '8px 12px',
    fontSize: '14px',
    fontWeight: 600,
    color: textColor,
    backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9'
  }

  return (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      overflow: 'hidden'
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
            <tr style={{ backgroundColor: sectionHeaderStyle.backgroundColor }}>
              <td colSpan={showPercentages ? 3 : 2} style={sectionHeaderStyle}>
                Revenue
              </td>
            </tr>
            {data.revenue.map((account) => (
              <tr key={account.account_id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                <td style={{ padding: '6px 12px 6px 24px', color: textColor }}>{account.account_number} {account.account_name}</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(account.balance)}</td>
                {showPercentages && (
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: textColor }}>{formatPercentage(account.percentage_of_revenue)}</td>
                )}
              </tr>
            ))}
            <TotalRow
              label="Total Revenue"
              amount={data.total_revenue}
              percentage={100}
            />

            {/* COGS Section */}
            {data.cost_of_goods_sold && data.cost_of_goods_sold.length > 0 && (
              <>
                <tr style={{ backgroundColor: sectionHeaderStyle.backgroundColor }}>
                  <td colSpan={showPercentages ? 3 : 2} style={sectionHeaderStyle}>
                    Cost of Goods Sold
                  </td>
                </tr>
                {data.cost_of_goods_sold.map((account) => (
                  <tr key={account.account_id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <td style={{ padding: '6px 12px 6px 24px', color: textColor }}>{account.account_number} {account.account_name}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(account.balance)}</td>
                    {showPercentages && (
                      <td style={{ padding: '6px 12px', textAlign: 'right', color: textColor }}>{formatPercentage(account.percentage_of_revenue)}</td>
                    )}
                  </tr>
                ))}
                <TotalRow
                  label="Gross Profit"
                  amount={data.gross_profit}
                  percentage={grossProfitPercentage}
                />
              </>
            )}

            {/* Expenses Section */}
            <tr style={{ backgroundColor: sectionHeaderStyle.backgroundColor }}>
              <td colSpan={showPercentages ? 3 : 2} style={sectionHeaderStyle}>
                Expenses
              </td>
            </tr>
            {data.expenses.map((account) => (
              <tr key={account.account_id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                <td style={{ padding: '6px 12px 6px 24px', color: textColor }}>{account.account_number} {account.account_name}</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(account.balance)}</td>
                {showPercentages && (
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: textColor }}>{formatPercentage(account.percentage_of_revenue)}</td>
                )}
              </tr>
            ))}
            <TotalRow
              label="Total Expenses"
              amount={data.total_expenses}
              percentage={(data.total_expenses / data.total_revenue) * 100}
            />

            {/* Net Income */}
            <TotalRow
              label="Net Income"
              amount={data.net_income}
              percentage={netIncomePercentage}
              className="final-total"
            />
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ProfitLossTable
