import React from 'react'

function ProfitLossTable({ data, showPercentages = true, onAccountClick, periodLabel }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatPercentage = (percentage) => {
    if (percentage === undefined || percentage === null) return ''
    const n = Number(percentage)
    if (Number.isNaN(n)) return ''
    return `${n.toFixed(1)}%`
  }

  // Match Balance Sheet: teal/blue-grey headers, light grey totals
  const mainHeaderBg = isDarkMode ? '#2d4a5a' : '#2d5a6b'
  const subHeaderBg = isDarkMode ? '#3a5566' : '#c5d9e0'
  const totalRowBg = isDarkMode ? '#2a3a45' : '#e8e8e8'
  const borderColor = isDarkMode ? '#3a4a55' : '#d0d0d0'
  const textColor = isDarkMode ? '#e8e8e8' : '#333'
  const subHeaderText = isDarkMode ? '#c8d4dc' : '#2d4a5a'

  const bannerStyle = {
    backgroundColor: mainHeaderBg,
    padding: '14px 20px',
    textAlign: 'center',
    border: `1px solid ${borderColor}`,
    borderBottom: 'none'
  }

  const sectionHeaderStyle = {
    padding: '10px 12px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#fff',
    backgroundColor: mainHeaderBg,
    border: `1px solid ${borderColor}`,
    borderTop: 'none',
    textTransform: 'uppercase',
    letterSpacing: '0.02em'
  }

  const columnHeaderStyle = {
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 700,
    color: subHeaderText,
    backgroundColor: subHeaderBg,
    border: `1px solid ${borderColor}`,
    borderTop: 'none',
    textAlign: 'left'
  }

  const cellStyle = {
    padding: '6px 12px',
    fontSize: '14px',
    color: textColor,
    border: `1px solid ${borderColor}`,
    borderTop: 'none',
    backgroundColor: isDarkMode ? '#1f2a33' : '#fff'
  }

  const cellIndentStyle = { ...cellStyle, paddingLeft: '24px' }

  const subtotalRowStyle = {
    padding: '10px 12px',
    fontSize: '14px',
    fontWeight: 700,
    color: textColor,
    backgroundColor: totalRowBg,
    border: `1px solid ${borderColor}`,
    borderTop: `2px solid ${borderColor}`
  }

  const finalTotalRowStyle = {
    ...subtotalRowStyle,
    borderTop: `1px solid ${borderColor}`,
    borderBottomStyle: 'double',
    borderBottomWidth: '4px',
    borderBottomColor: textColor,
    padding: '12px'
  }

  const revenueBase = data.net_sales ?? data.total_revenue ?? 0
  const grossProfitPercentage = revenueBase > 0 ? (data.gross_profit / revenueBase) * 100 : 0
  const netIncomePercentage = revenueBase > 0 ? (data.net_income / revenueBase) * 100 : 0

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  }

  return (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: isDarkMode ? '#1f2a33' : '#fff'
    }}>
      {/* Title: Income Statement, centered above the sheet */}
      <div style={bannerStyle}>
        <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>
          Income Statement
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...columnHeaderStyle, textAlign: 'left' }}>Account</th>
              <th style={{ ...columnHeaderStyle, textAlign: 'right', width: '140px' }}>Amount</th>
              {showPercentages && (
                <th style={{ ...columnHeaderStyle, textAlign: 'right', width: '100px' }}>% of Revenue</th>
              )}
            </tr>
          </thead>
          <tbody>
            {/* Revenue Section */}
            <tr>
              <td colSpan={showPercentages ? 3 : 2} style={sectionHeaderStyle}>
                Revenue
              </td>
            </tr>
            {(data.revenue || []).map((account) => (
              <tr
                key={account.account_id}
                onClick={() => onAccountClick?.(account.account_id)}
                style={{ cursor: onAccountClick ? 'pointer' : 'default' }}
              >
                <td style={cellIndentStyle}>{account.account_number} {account.account_name}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{formatCurrency(account.balance)}</td>
                {showPercentages && (
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{formatPercentage(account.percentage_of_revenue)}</td>
                )}
              </tr>
            ))}
            {(data.contra_revenue || []).map((account) => (
              <tr
                key={account.account_id}
                onClick={() => onAccountClick?.(account.account_id)}
                style={{ cursor: onAccountClick ? 'pointer' : 'default' }}
              >
                <td style={{ ...cellIndentStyle, paddingLeft: '32px' }}>Less: {account.account_name}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{formatCurrency(account.balance)}</td>
                {showPercentages && (
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{formatPercentage(account.percentage_of_revenue)}</td>
                )}
              </tr>
            ))}
            <tr>
              <td style={subtotalRowStyle}>Net Sales</td>
              <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>{formatCurrency(data.net_sales ?? data.total_revenue)}</td>
              {showPercentages && (
                <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>
                  {(data.net_sales ?? data.total_revenue) > 0 ? '100.0%' : ''}
                </td>
              )}
            </tr>

            {/* Cost of Goods Sold */}
            <tr>
              <td colSpan={showPercentages ? 3 : 2} style={sectionHeaderStyle}>
                Cost of Goods Sold
              </td>
            </tr>
            {(data.cost_of_goods_sold || []).map((account) => (
              <tr
                key={account.account_id}
                onClick={() => onAccountClick?.(account.account_id)}
                style={{ cursor: onAccountClick ? 'pointer' : 'default' }}
              >
                <td style={cellIndentStyle}>{account.account_number} {account.account_name}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{formatCurrency(account.balance)}</td>
                {showPercentages && (
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{formatPercentage(account.percentage_of_revenue)}</td>
                )}
              </tr>
            ))}
            <tr>
              <td style={subtotalRowStyle}>Total Cost of Goods Sold</td>
              <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>{formatCurrency(data.total_cogs)}</td>
              {showPercentages && (
                <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>
                  {(data.net_sales ?? data.total_revenue) ? formatPercentage((data.total_cogs / (data.net_sales ?? data.total_revenue)) * 100) : ''}
                </td>
              )}
            </tr>
            <tr>
              <td style={subtotalRowStyle}>Gross Profit</td>
              <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>{formatCurrency(data.gross_profit)}</td>
              {showPercentages && (
                <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>{formatPercentage(grossProfitPercentage)}</td>
              )}
            </tr>

            {/* Operating Expenses */}
            <tr>
              <td colSpan={showPercentages ? 3 : 2} style={sectionHeaderStyle}>
                Operating Expenses
              </td>
            </tr>
            {(data.expenses || []).map((account) => (
              <tr
                key={account.account_id}
                onClick={() => onAccountClick?.(account.account_id)}
                style={{ cursor: onAccountClick ? 'pointer' : 'default' }}
              >
                <td style={cellIndentStyle}>{account.account_number} {account.account_name}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{formatCurrency(account.balance)}</td>
                {showPercentages && (
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{formatPercentage(account.percentage_of_revenue)}</td>
                )}
              </tr>
            ))}
            <tr>
              <td style={subtotalRowStyle}>Total Operating Expenses</td>
              <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>{formatCurrency(data.total_expenses)}</td>
              {showPercentages && (
                <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>
                  {(data.net_sales ?? data.total_revenue) ? formatPercentage((data.total_expenses / (data.net_sales ?? data.total_revenue)) * 100) : ''}
                </td>
              )}
            </tr>
            <tr>
              <td style={subtotalRowStyle}>Operating Profit (Loss)</td>
              <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>{formatCurrency(data.operating_profit ?? (data.gross_profit - data.total_expenses))}</td>
              {showPercentages && (
                <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>
                  {revenueBase > 0 ? formatPercentage(((data.operating_profit ?? (data.gross_profit - data.total_expenses)) / revenueBase) * 100) : ''}
                </td>
              )}
            </tr>

            {/* Add Other Income */}
            <tr>
              <td colSpan={showPercentages ? 3 : 2} style={{ ...cellStyle, paddingLeft: '24px', fontWeight: 600 }}>
                Add Other Income
              </td>
            </tr>
            {(data.other_income || []).map((account) => (
              <tr
                key={account.account_id}
                onClick={() => onAccountClick?.(account.account_id)}
                style={{ cursor: onAccountClick ? 'pointer' : 'default' }}
              >
                <td style={cellIndentStyle}>{account.account_number} {account.account_name}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{formatCurrency(account.balance)}</td>
                {showPercentages && (
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{formatPercentage(account.percentage_of_revenue)}</td>
                )}
              </tr>
            ))}
            <tr>
              <td style={subtotalRowStyle}>Profit (Loss) Before Taxes</td>
              <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>{formatCurrency(data.profit_before_taxes ?? data.net_income)}</td>
              {showPercentages && (
                <td style={{ ...subtotalRowStyle, textAlign: 'right' }}>
                  {revenueBase > 0 && (data.profit_before_taxes != null) ? formatPercentage((data.profit_before_taxes / revenueBase) * 100) : ''}
                </td>
              )}
            </tr>
            <tr>
              <td style={cellIndentStyle}>Less: Tax Expense</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{formatCurrency(data.tax_expense ?? 0)}</td>
              {showPercentages && (
                <td style={{ ...cellStyle, textAlign: 'right' }}>
                  {revenueBase > 0 && (data.tax_expense != null) ? formatPercentage((data.tax_expense / revenueBase) * 100) : ''}
                </td>
              )}
            </tr>

            {/* Net Profit (Loss) - final total with thicker border */}
            <tr>
              <td style={finalTotalRowStyle}>Net Profit (Loss)</td>
              <td style={{
                ...finalTotalRowStyle,
                textAlign: 'right',
                color: data.net_income < 0 ? (isDarkMode ? '#f0a0a0' : '#b91c1c') : textColor
              }}>
                {formatCurrency(data.net_income)}
              </td>
              {showPercentages && (
                <td style={{ ...finalTotalRowStyle, textAlign: 'right' }}>{formatPercentage(netIncomePercentage)}</td>
              )}
            </tr>
            {periodLabel && (
              <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                <td colSpan={showPercentages ? 3 : 2} style={{ padding: '8px 12px', color: textColor, fontSize: '13px', fontStyle: 'italic' }}>
                  {periodLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ProfitLossTable
