import React from 'react'

function CashFlowChart({ data }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const op = data.operating_activities?.net_cash_from_operations ?? 0
  const inv = data.investing_activities?.net_cash_from_investing ?? 0
  const fin = data.financing_activities?.net_cash_from_financing ?? 0
  const netChange = data.net_change_in_cash ?? 0
  const beg = data.beginning_cash ?? 0
  const end = data.ending_cash ?? 0

  const maxAbs = Math.max(Math.abs(op), Math.abs(inv), Math.abs(fin), Math.abs(netChange), 1)
  const getBarWidth = (value) => (Math.abs(value) / maxAbs) * 100

  const BarChart = ({ label, value, color }) => {
    const pct = beg !== 0 && !Number.isNaN(value / beg) ? ((value / beg) * 100).toFixed(1) : '-'
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: '500', color: isDarkMode ? '#d1d5db' : '#374151' }}>{label}</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: value < 0 ? '#dc2626' : '#059669' }}>
            {value < 0 ? '-' : '+'}{formatCurrency(value)}
          </span>
        </div>
        <div style={{ width: '100%', backgroundColor: isDarkMode ? '#1a1a1a' : '#e5e7eb', borderRadius: '9999px', height: '24px', overflow: 'hidden', position: 'relative' }}>
          {value !== 0 && (
            <div
              style={{
                width: `${getBarWidth(value)}%`,
                height: '24px',
                borderRadius: '9999px',
                backgroundColor: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: value < 0 ? 'flex-start' : 'flex-end',
                paddingLeft: value < 0 ? '8px' : 0,
                paddingRight: value >= 0 ? '8px' : 0,
                minWidth: value !== 0 ? '40px' : 0
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: '500', color: 'white' }}>{pct}%</span>
            </div>
          )}
          {value === 0 && (
            <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', fontSize: '12px', color: isDarkMode ? '#6b7280' : '#9ca3af' }}>No activity</span>
          )}
        </div>
      </div>
    )
  }

  const containerStyle = {
    backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
    padding: '24px',
    borderRadius: '8px',
    border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
    boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
  }

  return (
    <div style={containerStyle}>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>
        Cash Flow Summary
      </h3>
      <BarChart label="Operating Activities" value={op} color={op >= 0 ? '#3b82f6' : '#ef4444'} />
      <BarChart label="Investing Activities" value={inv} color={inv >= 0 ? '#eab308' : '#ef4444'} />
      <BarChart label="Financing Activities" value={fin} color={fin >= 0 ? '#22c55e' : '#ef4444'} />
      <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: `2px solid ${isDarkMode ? '#3a3a3a' : '#d1d5db'}` }}>
        <BarChart label="Net Change in Cash" value={netChange} color={netChange >= 0 ? '#059669' : '#dc2626'} />
      </div>
      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: `2px solid ${isDarkMode ? '#3a3a3a' : '#d1d5db'}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Beginning Cash:</span>
            <span style={{ fontWeight: '600', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{formatCurrency(beg)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Net Change:</span>
            <span style={{ fontWeight: '600', color: netChange >= 0 ? '#059669' : '#dc2626' }}>
              {netChange >= 0 ? '+' : '-'}{formatCurrency(netChange)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '700', paddingTop: '8px', borderTop: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}` }}>
            <span style={{ color: isDarkMode ? '#fff' : '#1a1a1a' }}>Ending Cash:</span>
            <span style={{ color: '#2563eb' }}>{formatCurrency(end)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CashFlowChart
