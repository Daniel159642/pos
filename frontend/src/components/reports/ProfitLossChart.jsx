import React from 'react'

function ProfitLossChart({ data }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const maxValue = Math.max(
    data.total_revenue,
    data.total_cogs,
    data.total_expenses,
    Math.abs(data.net_income)
  )

  const getBarWidth = (value) => {
    if (maxValue === 0) return 0
    return (Math.abs(value) / maxValue) * 100
  }

  const BarChart = ({ label, value, color, negative = false }) => {
    const percentage = data.total_revenue > 0 
      ? ((value / data.total_revenue) * 100).toFixed(1)
      : '0.0'

    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '500', 
            color: isDarkMode ? '#d1d5db' : '#374151' 
          }}>
            {label}
          </span>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '600',
            color: negative && value < 0 ? '#ef4444' : (isDarkMode ? '#ffffff' : '#1a1a1a')
          }}>
            ${Math.abs(value).toFixed(2)}
          </span>
        </div>
        <div style={{ 
          width: '100%', 
          backgroundColor: isDarkMode ? '#1a1a1a' : '#e5e7eb',
          borderRadius: '9999px',
          height: '24px',
          overflow: 'hidden'
        }}>
          <div
            style={{
              height: '24px',
              borderRadius: '9999px',
              backgroundColor: color,
              width: `${getBarWidth(value)}%`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: '8px',
              transition: 'width 0.3s ease'
            }}
          >
            <span style={{ 
              fontSize: '12px', 
              color: 'white', 
              fontWeight: '500' 
            }}>
              {percentage}%
            </span>
          </div>
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
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: '600', 
        marginBottom: '24px',
        color: isDarkMode ? '#ffffff' : '#1a1a1a'
      }}>
        Visual Summary
      </h3>
      
      <BarChart label="Revenue" value={data.total_revenue} color="#3b82f6" />
      
      {data.total_cogs > 0 && (
        <>
          <BarChart label="Cost of Goods Sold" value={data.total_cogs} color="#eab308" />
          <BarChart label="Gross Profit" value={data.gross_profit} color="#10b981" />
        </>
      )}
      
      <BarChart label="Total Expenses" value={data.total_expenses} color="#ef4444" />
      
      <div style={{ 
        marginTop: '24px', 
        paddingTop: '24px', 
        borderTop: `2px solid ${isDarkMode ? '#3a3a3a' : '#d1d5db'}`
      }}>
        <BarChart 
          label="Net Income" 
          value={data.net_income} 
          color={data.net_income >= 0 ? '#10b981' : '#ef4444'} 
          negative
        />
      </div>
    </div>
  )
}

export default ProfitLossChart
