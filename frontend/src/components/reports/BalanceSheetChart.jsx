import React from 'react'

function BalanceSheetChart({ data }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const maxVal = Math.max(
    data.assets.total_assets,
    data.liabilities.total_liabilities + data.equity.total_equity
  )
  const getBarWidth = (v) => (maxVal > 0 ? (v / maxVal) * 100 : 0)

  const totalLE = data.liabilities.total_liabilities + data.equity.total_equity

  const containerStyle = {
    backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
    padding: '24px',
    borderRadius: '8px',
    border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
    boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
  }

  const Bar = ({ label, value, color, pct }) => (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>{label}</span>
        <span style={{ fontSize: '12px', fontWeight: '600', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{formatCurrency(value)}</span>
      </div>
      <div style={{ width: '100%', backgroundColor: isDarkMode ? '#1a1a1a' : '#e5e7eb', borderRadius: '9999px', height: '16px', overflow: 'hidden' }}>
        <div
          style={{
            width: `${getBarWidth(value)}%`,
            height: '16px',
            borderRadius: '9999px',
            backgroundColor: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '6px',
            fontSize: '11px',
            color: 'white',
            fontWeight: '500'
          }}
        >
          {pct != null && !Number.isNaN(pct) ? `${pct.toFixed(0)}%` : ''}
        </div>
      </div>
    </div>
  )

  return (
    <div style={containerStyle}>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>
        Financial Position Summary
      </h3>

      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: isDarkMode ? '#d1d5db' : '#374151', marginBottom: '12px' }}>
          Assets Composition
        </h4>
        {data.assets.total_current_assets > 0 && (
          <Bar
            label="Current Assets"
            value={data.assets.total_current_assets}
            color="#60a5fa"
            pct={data.assets.total_assets > 0 ? (data.assets.total_current_assets / data.assets.total_assets) * 100 : 0}
          />
        )}
        {data.assets.total_fixed_assets > 0 && (
          <Bar
            label="Fixed Assets"
            value={data.assets.total_fixed_assets}
            color="#3b82f6"
            pct={data.assets.total_assets > 0 ? (data.assets.total_fixed_assets / data.assets.total_assets) * 100 : 0}
          />
        )}
        {data.assets.total_other_assets > 0 && (
          <Bar
            label="Other Assets"
            value={data.assets.total_other_assets}
            color="#2563eb"
            pct={data.assets.total_assets > 0 ? (data.assets.total_other_assets / data.assets.total_assets) * 100 : 0}
          />
        )}
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: isDarkMode ? '#fff' : '#1a1a1a' }}>Total Assets</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#3b82f6' }}>{formatCurrency(data.assets.total_assets)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: isDarkMode ? '#d1d5db' : '#374151', marginBottom: '12px' }}>
          Liabilities & Equity Composition
        </h4>
        {data.liabilities.total_liabilities > 0 && (
          <Bar
            label="Total Liabilities"
            value={data.liabilities.total_liabilities}
            color="#f87171"
            pct={totalLE > 0 ? (data.liabilities.total_liabilities / totalLE) * 100 : 0}
          />
        )}
        <Bar
          label="Total Equity"
          value={data.equity.total_equity}
          color="#34d399"
          pct={totalLE > 0 ? (data.equity.total_equity / totalLE) * 100 : 0}
        />
      </div>

      <div style={{ paddingTop: '16px', borderTop: `2px solid ${isDarkMode ? '#3a3a3a' : '#d1d5db'}` }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', color: isDarkMode ? '#d1d5db' : '#374151', marginBottom: '12px' }}>
          Key Ratios
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Current Ratio</span>
            <span style={{ fontWeight: '600', color: isDarkMode ? '#fff' : '#1a1a1a' }}>
              {data.liabilities.total_current_liabilities > 0
                ? (data.assets.total_current_assets / data.liabilities.total_current_liabilities).toFixed(2)
                : 'N/A'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Debt-to-Equity Ratio</span>
            <span style={{ fontWeight: '600', color: isDarkMode ? '#fff' : '#1a1a1a' }}>
              {data.equity.total_equity > 0
                ? (data.liabilities.total_liabilities / data.equity.total_equity).toFixed(2)
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BalanceSheetChart
