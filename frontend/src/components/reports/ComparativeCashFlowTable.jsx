import React from 'react'

function ComparativeCashFlowTable({ data, currentLabel, priorLabel }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    const sign = amount < 0 ? '-' : ''
    return `${sign}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatVariance = (amount) => {
    const sign = amount >= 0 ? '+' : '-'
    return `${sign}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getVarianceColor = (amount) => (amount >= 0 ? '#10b981' : '#ef4444')

  const TotalRow = ({ label, current, prior, variance, className = '' }) => {
    const bg = className.includes('blue') ? (isDarkMode ? '#1a1a3a' : '#dbeafe')
      : className.includes('yellow') ? (isDarkMode ? '#3a3a1a' : '#fef9c3')
      : className.includes('green') ? (isDarkMode ? '#1a3a1a' : '#d1fae5')
      : 'transparent'
    return (
      <tr style={{ fontWeight: '600', backgroundColor: bg }}>
        <td style={{ padding: '12px 24px', fontSize: '14px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{label}</td>
        <td style={{ padding: '12px 24px', fontSize: '14px', textAlign: 'right', color: current < 0 ? '#dc2626' : (isDarkMode ? '#d1d5db' : '#1a1a1a') }}>
          {formatCurrency(current)}
        </td>
        <td style={{ padding: '12px 24px', fontSize: '14px', textAlign: 'right', color: prior < 0 ? '#dc2626' : (isDarkMode ? '#d1d5db' : '#1a1a1a') }}>
          {formatCurrency(prior)}
        </td>
        <td style={{ padding: '12px 24px', fontSize: '14px', textAlign: 'right', fontWeight: '600', color: getVarianceColor(variance) }}>
          {formatVariance(variance)}
        </td>
      </tr>
    )
  }

  const v = data.variance || {}
  const tableStyle = { width: '100%', borderCollapse: 'collapse', backgroundColor: isDarkMode ? '#2a2a2a' : 'white' }
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
            </tr>
          </thead>
          <tbody>
            <TotalRow
              label="Cash from Operating Activities"
              current={data.current?.operating_activities?.net_cash_from_operations ?? 0}
              prior={data.prior?.operating_activities?.net_cash_from_operations ?? 0}
              variance={v.net_cash_from_operations ?? 0}
              className="blue"
            />
            <TotalRow
              label="Cash from Investing Activities"
              current={data.current?.investing_activities?.net_cash_from_investing ?? 0}
              prior={data.prior?.investing_activities?.net_cash_from_investing ?? 0}
              variance={v.net_cash_from_investing ?? 0}
              className="yellow"
            />
            <TotalRow
              label="Cash from Financing Activities"
              current={data.current?.financing_activities?.net_cash_from_financing ?? 0}
              prior={data.prior?.financing_activities?.net_cash_from_financing ?? 0}
              variance={v.net_cash_from_financing ?? 0}
              className="green"
            />
            <TotalRow
              label="Net Change in Cash"
              current={data.current?.net_change_in_cash ?? 0}
              prior={data.prior?.net_change_in_cash ?? 0}
              variance={v.net_change_in_cash ?? 0}
              className="gray"
            />
            <tr style={{ fontWeight: '500', backgroundColor: isDarkMode ? '#2a2a2a' : '#f3f4f6' }}>
              <td style={{ padding: '12px 24px', fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151' }}>Beginning Cash</td>
              <td style={{ padding: '12px 24px', fontSize: '14px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#1a1a1a' }}>
                {formatCurrency(data.current?.beginning_cash ?? 0)}
              </td>
              <td style={{ padding: '12px 24px', fontSize: '14px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#1a1a1a' }}>
                {formatCurrency(data.prior?.beginning_cash ?? 0)}
              </td>
              <td style={{ padding: '12px 24px', fontSize: '14px', textAlign: 'right' }}>-</td>
            </tr>
            <tr style={{ fontWeight: '700', backgroundColor: isDarkMode ? '#1a1a3a' : '#93c5fd', borderTop: `4px solid ${isDarkMode ? '#555' : '#1a1a1a'}` }}>
              <td style={{ padding: '16px 24px', fontSize: '16px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>Ending Cash</td>
              <td style={{ padding: '16px 24px', fontSize: '16px', textAlign: 'right', color: isDarkMode ? '#fff' : '#1a1a1a' }}>
                {formatCurrency(data.current?.ending_cash ?? 0)}
              </td>
              <td style={{ padding: '16px 24px', fontSize: '16px', textAlign: 'right', color: isDarkMode ? '#fff' : '#1a1a1a' }}>
                {formatCurrency(data.prior?.ending_cash ?? 0)}
              </td>
              <td style={{ padding: '16px 24px', fontSize: '16px', textAlign: 'right' }}>-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ComparativeCashFlowTable
