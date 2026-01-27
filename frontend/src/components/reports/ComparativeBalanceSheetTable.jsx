import React from 'react'

function ComparativeBalanceSheetTable({ data, currentLabel, priorLabel }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatVariance = (amount) => {
    const sign = amount >= 0 ? '+' : '-'
    return `${sign}${formatCurrency(Math.abs(amount))}`
  }

  const formatPercentage = (p) => {
    const sign = p >= 0 ? '+' : ''
    return `${sign}${p.toFixed(1)}%`
  }

  const getVarianceColor = (amount, isLiability = false) => {
    const good = isLiability ? amount < 0 : amount > 0
    return good ? '#10b981' : '#ef4444'
  }

  const TotalRow = ({ label, current, prior, variance, variancePercent, className = '', isLiability = false }) => {
    const bg = className.includes('blue') ? (isDarkMode ? '#1a1a3a' : '#dbeafe')
      : className.includes('red') ? (isDarkMode ? '#3a1a1a' : '#fee2e2')
      : className.includes('green') ? (isDarkMode ? '#1a3a1a' : '#d1fae5')
      : 'transparent'
    return (
      <tr style={{ fontWeight: '600', backgroundColor: bg }}>
        <td style={{ padding: '12px 24px', fontSize: '14px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{label}</td>
        <td style={{ padding: '12px 24px', fontSize: '14px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#1a1a1a' }}>
          {formatCurrency(current)}
        </td>
        <td style={{ padding: '12px 24px', fontSize: '14px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#1a1a1a' }}>
          {formatCurrency(prior)}
        </td>
        <td style={{ padding: '12px 24px', fontSize: '14px', textAlign: 'right', fontWeight: '600', color: getVarianceColor(variance, isLiability) }}>
          {formatVariance(variance)}
        </td>
        <td style={{ padding: '12px 24px', fontSize: '14px', textAlign: 'right', fontWeight: '600', color: getVarianceColor(variance, isLiability) }}>
          {formatPercentage(variancePercent)}
        </td>
      </tr>
    )
  }

  const v = data.variance
  const vp = data.variance_percentage
  const totLECurr = data.current.liabilities.total_liabilities + data.current.equity.total_equity
  const totLEPrior = data.prior.liabilities.total_liabilities + data.prior.equity.total_equity

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
    borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb')
  }

  return (
    <div style={{
      backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
      borderRadius: '8px',
      border: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb'),
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
              label="Total Assets"
              current={data.current.assets.total_assets}
              prior={data.prior.assets.total_assets}
              variance={v.total_assets}
              variancePercent={vp.total_assets}
              className="blue"
            />
            <TotalRow
              label="Total Liabilities"
              current={data.current.liabilities.total_liabilities}
              prior={data.prior.liabilities.total_liabilities}
              variance={v.total_liabilities}
              variancePercent={vp.total_liabilities}
              className="red"
              isLiability
            />
            <TotalRow
              label="Total Equity"
              current={data.current.equity.total_equity}
              prior={data.prior.equity.total_equity}
              variance={v.total_equity}
              variancePercent={vp.total_equity}
              className="green"
            />
            <tr style={{ fontWeight: '700', backgroundColor: isDarkMode ? '#2a2a2a' : '#e5e7eb', borderTop: '4px solid ' + (isDarkMode ? '#555' : '#1a1a1a') }}>
              <td style={{ padding: '16px 24px', fontSize: '16px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>
                Total Liabilities and Equity
              </td>
              <td style={{ padding: '16px 24px', fontSize: '16px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#1a1a1a' }}>
                {formatCurrency(totLECurr)}
              </td>
              <td style={{ padding: '16px 24px', fontSize: '16px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#1a1a1a' }}>
                {formatCurrency(totLEPrior)}
              </td>
              <td style={{ padding: '16px 24px', fontSize: '16px', textAlign: 'right', fontWeight: '600' }}>
                {formatVariance(v.total_liabilities + v.total_equity)}
              </td>
              <td style={{ padding: '16px 24px', fontSize: '16px', textAlign: 'right' }}>-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ComparativeBalanceSheetTable
