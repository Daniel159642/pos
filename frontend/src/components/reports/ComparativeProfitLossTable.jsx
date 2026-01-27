import React from 'react'

function ComparativeProfitLossTable({ data, currentLabel, priorLabel }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    return `$${Math.abs(amount).toFixed(2)}`
  }

  const formatVariance = (amount) => {
    const sign = amount >= 0 ? '+' : '-'
    return `${sign}$${Math.abs(amount).toFixed(2)}`
  }

  const formatPercentage = (percentage) => {
    const sign = percentage >= 0 ? '+' : ''
    return `${sign}${percentage.toFixed(1)}%`
  }

  const getVarianceClass = (amount, isExpense = false) => {
    const isGood = isExpense ? amount < 0 : amount > 0
    return isGood ? '#10b981' : '#ef4444'
  }

  const TotalRow = ({ 
    label, 
    current, 
    prior, 
    variance, 
    variancePercent,
    className = '',
    isExpense = false 
  }) => {
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
          color: isDarkMode ? '#d1d5db' : '#1a1a1a'
        }}>
          {formatCurrency(current)}
        </td>
        <td style={{
          padding: '12px 24px',
          fontSize: '14px',
          textAlign: 'right',
          color: isDarkMode ? '#d1d5db' : '#1a1a1a'
        }}>
          {formatCurrency(prior)}
        </td>
        <td style={{
          padding: '12px 24px',
          fontSize: '14px',
          textAlign: 'right',
          fontWeight: '600',
          color: getVarianceClass(variance, isExpense)
        }}>
          {formatVariance(variance)}
        </td>
        <td style={{
          padding: '12px 24px',
          fontSize: '14px',
          textAlign: 'right',
          fontWeight: '600',
          color: getVarianceClass(variance, isExpense)
        }}>
          {formatPercentage(variancePercent)}
        </td>
      </tr>
    )
  }

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
              <th style={thStyle}></th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{currentLabel}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{priorLabel}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Variance $</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Variance %</th>
            </tr>
          </thead>
          <tbody>
            <TotalRow
              label="Total Revenue"
              current={data.current.total_revenue}
              prior={data.prior.total_revenue}
              variance={data.variance.revenue}
              variancePercent={data.variance_percentage.revenue}
              className="bg-blue"
            />

            {(data.current.total_cogs > 0 || data.prior.total_cogs > 0) && (
              <>
                <TotalRow
                  label="Total Cost of Goods Sold"
                  current={data.current.total_cogs}
                  prior={data.prior.total_cogs}
                  variance={data.variance.cogs}
                  variancePercent={data.variance_percentage.cogs}
                  className="bg-yellow"
                  isExpense
                />

                <TotalRow
                  label="Gross Profit"
                  current={data.current.gross_profit}
                  prior={data.prior.gross_profit}
                  variance={data.variance.gross_profit}
                  variancePercent={data.variance_percentage.gross_profit}
                  className="bg-green"
                />
              </>
            )}

            <TotalRow
              label="Total Expenses"
              current={data.current.total_expenses}
              prior={data.prior.total_expenses}
              variance={data.variance.expenses}
              variancePercent={data.variance_percentage.expenses}
              className="bg-red"
              isExpense
            />

            <TotalRow
              label="NET INCOME"
              current={data.current.net_income}
              prior={data.prior.net_income}
              variance={data.variance.net_income}
              variancePercent={data.variance_percentage.net_income}
              className={`text-lg ${data.current.net_income >= 0 ? 'bg-green' : 'bg-red'}`}
            />
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ComparativeProfitLossTable
