import React from 'react'

function BalanceSheetTable({ data, onAccountClick, dateLabel }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Template colors: teal/blue-grey headers, light grey totals
  const mainHeaderBg = isDarkMode ? '#2d4a5a' : '#2d5a6b'
  const subHeaderBg = isDarkMode ? '#3a5566' : '#c5d9e0'
  const totalRowBg = isDarkMode ? '#2a3a45' : '#e8e8e8'
  const borderColor = isDarkMode ? '#3a4a55' : '#d0d0d0'
  const textColor = isDarkMode ? '#e8e8e8' : '#333'
  const subHeaderText = isDarkMode ? '#c8d4dc' : '#2d4a5a'

  const mainHeaderStyle = {
    padding: '10px 12px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#fff',
    backgroundColor: mainHeaderBg,
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    border: `1px solid ${borderColor}`,
    borderBottom: 'none'
  }

  const subHeaderStyle = {
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 700,
    color: subHeaderText,
    backgroundColor: subHeaderBg,
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    border: `1px solid ${borderColor}`,
    borderTop: 'none'
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

  const totalRowStyle = {
    padding: '10px 12px',
    fontSize: '14px',
    fontWeight: 700,
    color: textColor,
    backgroundColor: totalRowBg,
    border: `1px solid ${borderColor}`,
    borderTop: `2px solid ${borderColor}`
  }

  const totalRowFinalStyle = {
    ...totalRowStyle,
    borderTop: `3px solid ${borderColor}`,
    padding: '12px'
  }

  const yearHeaderStyle = {
    ...mainHeaderStyle,
    textAlign: 'right',
    width: '120px'
  }

  const renderAccountRow = (row, indent = false, index = 0) => {
    const hasAccount = row.account_id != null || row.id != null
    return (
      <tr
        key={row.account_id ?? row.id ?? `synthetic-${index}`}
        onClick={() => hasAccount && onAccountClick?.(row.account_id ?? row.id)}
        style={{ cursor: hasAccount && onAccountClick ? 'pointer' : 'default' }}
      >
        <td style={indent ? cellIndentStyle : cellStyle}>{row.account_number ? `${row.account_number} ` : ''}{row.account_name}</td>
        <td style={{ ...cellStyle, textAlign: 'right' }}>{formatCurrency(row.balance)}</td>
      </tr>
    )
  }

  const totalLE = data.liabilities.total_liabilities + data.equity.total_equity

  // Financial ratios (avoid division by zero)
  const totalAssets = data.assets.total_assets || 0
  const totalLiab = data.liabilities.total_liabilities || 0
  const totalEquity = data.equity.total_equity || 0
  const currentAssets = data.assets.total_current_assets || 0
  const currentLiab = data.liabilities.total_current_liabilities || 0

  const debtRatio = totalAssets !== 0 ? (totalLiab / totalAssets).toFixed(2) : '-'
  const currentRatio = currentLiab !== 0 ? (currentAssets / currentLiab).toFixed(2) : '-'
  const workingCapital = currentAssets - currentLiab
  const assetsToEquity = totalEquity !== 0 ? (totalAssets / totalEquity).toFixed(2) : '-'
  const debtToEquity = totalEquity !== 0 ? (totalLiab / totalEquity).toFixed(2) : '-'

  const renderAssetsColumn = () => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', tableLayout: 'fixed' }}>
      <thead>
        <tr>
          <th style={{ ...mainHeaderStyle, textAlign: 'left' }}>ASSETS</th>
          <th style={{ ...yearHeaderStyle, borderLeft: 'none' }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {data.assets.current_assets?.length > 0 && (
          <>
            <tr><td colSpan={2} style={subHeaderStyle}>CURRENT ASSETS</td></tr>
            {data.assets.current_assets.map((a, i) => renderAccountRow(a, true, i))}
            <tr>
              <td style={totalRowStyle}>TOTAL CURRENT ASSETS</td>
              <td style={{ ...totalRowStyle, textAlign: 'right' }}>{formatCurrency(data.assets.total_current_assets)}</td>
            </tr>
          </>
        )}
        {data.assets.fixed_assets?.length > 0 && (
          <>
            <tr><td colSpan={2} style={subHeaderStyle}>FIXED (LONG TERM) ASSETS</td></tr>
            {data.assets.fixed_assets.map((a, i) => renderAccountRow(a, true, i))}
            <tr>
              <td style={totalRowStyle}>TOTAL FIXED ASSETS</td>
              <td style={{ ...totalRowStyle, textAlign: 'right' }}>{formatCurrency(data.assets.total_fixed_assets)}</td>
            </tr>
          </>
        )}
        {data.assets.other_assets?.length > 0 && (
          <>
            <tr><td colSpan={2} style={subHeaderStyle}>OTHER ASSETS</td></tr>
            {data.assets.other_assets.map((a, i) => renderAccountRow(a, true, i))}
            <tr>
              <td style={totalRowStyle}>TOTAL OTHER ASSETS</td>
              <td style={{ ...totalRowStyle, textAlign: 'right' }}>{formatCurrency(data.assets.total_other_assets)}</td>
            </tr>
          </>
        )}
        <tr>
          <td style={totalRowFinalStyle}>TOTAL ASSETS</td>
          <td style={{ ...totalRowFinalStyle, textAlign: 'right' }}>{formatCurrency(data.assets.total_assets)}</td>
        </tr>
      </tbody>
    </table>
  )

  const renderLiabilitiesColumn = () => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', tableLayout: 'fixed' }}>
      <thead>
        <tr>
          <th style={{ ...mainHeaderStyle, textAlign: 'left' }}>LIABILITIES AND OWNER'S EQUITY</th>
          <th style={{ ...yearHeaderStyle, borderLeft: 'none' }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {data.liabilities.current_liabilities?.length > 0 && (
          <>
            <tr><td colSpan={2} style={subHeaderStyle}>CURRENT LIABILITIES</td></tr>
            {data.liabilities.current_liabilities.map((a, i) => renderAccountRow(a, true, i))}
            <tr>
              <td style={totalRowStyle}>TOTAL CURRENT LIABILITIES</td>
              <td style={{ ...totalRowStyle, textAlign: 'right' }}>{formatCurrency(data.liabilities.total_current_liabilities)}</td>
            </tr>
          </>
        )}
        {data.liabilities.long_term_liabilities?.length > 0 && (
          <>
            <tr><td colSpan={2} style={subHeaderStyle}>LONG TERM LIABILITIES</td></tr>
            {data.liabilities.long_term_liabilities.map((a, i) => renderAccountRow(a, true, i))}
            <tr>
              <td style={totalRowStyle}>TOTAL LONG-TERM LIABILITIES</td>
              <td style={{ ...totalRowStyle, textAlign: 'right' }}>{formatCurrency(data.liabilities.total_long_term_liabilities)}</td>
            </tr>
          </>
        )}
        <>
          <tr><td colSpan={2} style={subHeaderStyle}>OWNER'S EQUITY</td></tr>
          {data.equity.equity_accounts?.map((a, i) => renderAccountRow(a, true, i))}
          {typeof data.equity.inventory_valuation_adjustment === 'number' && Math.abs(data.equity.inventory_valuation_adjustment) >= 0.005 && (
            <tr>
              <td style={cellIndentStyle}>Inventory valuation adjustment</td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{formatCurrency(data.equity.inventory_valuation_adjustment)}</td>
            </tr>
          )}
          <tr>
            <td style={cellIndentStyle}>Current Year Earnings</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>{formatCurrency(data.equity.current_year_earnings)}</td>
          </tr>
          <tr>
            <td style={totalRowStyle}>TOTAL OWNER'S EQUITY</td>
            <td style={{ ...totalRowStyle, textAlign: 'right' }}>{formatCurrency(data.equity.total_equity)}</td>
          </tr>
        </>
        <tr>
          <td style={totalRowFinalStyle}>TOTAL LIABILITIES AND OWNER'S EQUITY</td>
          <td style={{ ...totalRowFinalStyle, textAlign: 'right' }}>{formatCurrency(totalLE)}</td>
        </tr>
      </tbody>
    </table>
  )

  const titleStyle = {
    backgroundColor: mainHeaderBg,
    color: '#fff',
    padding: '14px 20px',
    textAlign: 'center',
    fontSize: '20px',
    fontWeight: 700,
    border: `1px solid ${borderColor}`,
    borderBottom: 'none'
  }

  return (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: isDarkMode ? '#1a2530' : '#fff'
    }}>
      <div style={titleStyle}>Balance Sheet</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 0,
        alignItems: 'start'
      }}>
        <div style={{ borderRight: `1px solid ${borderColor}` }}>
          {renderAssetsColumn()}
        </div>
        <div>
          {renderLiabilitiesColumn()}
        </div>
      </div>

      {/* COMMON FINANCIAL RATIO */}
      <div style={{ borderTop: `2px solid ${borderColor}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...mainHeaderStyle, textAlign: 'left' }}>COMMON FINANCIAL RATIO</th>
              <th style={{ ...yearHeaderStyle, borderLeft: 'none' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={cellStyle}>Debt Ratio <span style={{ fontWeight: 400, color: subHeaderText, fontSize: '12px' }}>(Total Liabilities / Total Assets)</span></td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{debtRatio}</td>
            </tr>
            <tr>
              <td style={cellStyle}>Current Ratio <span style={{ fontWeight: 400, color: subHeaderText, fontSize: '12px' }}>(Current Assets / Current Liabilities)</span></td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{currentRatio}</td>
            </tr>
            <tr>
              <td style={cellStyle}>Working Capital <span style={{ fontWeight: 400, color: subHeaderText, fontSize: '12px' }}>(Current Assets - Current Liabilities)</span></td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{formatCurrency(workingCapital)}</td>
            </tr>
            <tr>
              <td style={cellStyle}>Assets-to-Equity Ratio <span style={{ fontWeight: 400, color: subHeaderText, fontSize: '12px' }}>(Total Assets / Owner's Equity)</span></td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{assetsToEquity}</td>
            </tr>
            <tr>
              <td style={cellStyle}>Debt-to-Equity Ratio <span style={{ fontWeight: 400, color: subHeaderText, fontSize: '12px' }}>(Total Liabilities / Owner's Equity)</span></td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>{debtToEquity}</td>
            </tr>
            {dateLabel && (
              <tr>
                <td colSpan={2} style={{ padding: '8px 12px', color: textColor, fontSize: '13px', fontStyle: 'italic', borderBottom: `1px solid ${borderColor}` }}>
                  {dateLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!data.balances && (
        <div style={{
          padding: '12px 16px',
          fontSize: '13px',
          color: isDarkMode ? '#e8a0a0' : '#b91c1c',
          backgroundColor: isDarkMode ? '#3a2020' : '#fef2f2',
          borderTop: `1px solid ${borderColor}`
        }}>
          ⚠️ Balance Sheet does not balance: Assets ({formatCurrency(data.assets.total_assets)}) ≠ Liabilities + Equity ({formatCurrency(totalLE)})
        </div>
      )}
      {data.balances && (
        <div style={{
          padding: '8px 16px',
          fontSize: '13px',
          fontStyle: 'italic',
          color: subHeaderText,
          borderTop: `1px solid ${borderColor}`
        }}>
          ✓ Balance Sheet balances (Assets = Liabilities + Equity)
        </div>
      )}
    </div>
  )
}

export default BalanceSheetTable
