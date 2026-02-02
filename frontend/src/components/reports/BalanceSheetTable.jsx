import React from 'react'

function BalanceSheetTable({ data, onAccountClick }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  const formatCurrency = (amount) => {
    return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const sectionHeaderStyle = {
    padding: '8px 12px',
    fontSize: '14px',
    fontWeight: 600,
    color: textColor,
    backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9'
  }

  const SubtotalRow = ({ label, amount }) => (
    <tr style={{ borderBottom: `1px solid ${borderColor}`, fontWeight: 600 }}>
      <td style={{ padding: '10px 12px', color: textColor }}>{label}</td>
      <td style={{ padding: '10px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(amount)}</td>
    </tr>
  )

  const TotalRow = ({ label, amount, isFinal }) => (
    <tr style={{
      fontWeight: isFinal ? 700 : 600,
      backgroundColor: isFinal ? (isDarkMode ? '#252525' : '#e8e8e8') : 'transparent',
      borderTop: isFinal ? `2px solid ${borderColor}` : undefined,
      borderBottom: !isFinal ? `1px solid ${borderColor}` : undefined
    }}>
      <td style={{ padding: isFinal ? '12px' : '10px 12px', fontSize: '14px', color: textColor, fontWeight: isFinal ? 700 : 600 }}>{label}</td>
      <td style={{ padding: isFinal ? '12px' : '10px 12px', fontSize: '14px', textAlign: 'right', color: textColor, fontWeight: isFinal ? 700 : 600 }}>{formatCurrency(amount)}</td>
    </tr>
  )

  const totalLE = data.liabilities.total_liabilities + data.equity.total_equity

  const renderAccountRow = (row) => (
    <tr key={row.account_id ?? row.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
      <td style={{ padding: '6px 12px 6px 24px', color: textColor }}>{row.account_number} {row.account_name}</td>
      <td style={{ padding: '6px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(row.balance)}</td>
    </tr>
  )

  return (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Account</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: sectionHeaderStyle.backgroundColor }}>
              <td colSpan={2} style={sectionHeaderStyle}>Assets</td>
            </tr>

            {data.assets.current_assets?.length > 0 && (
              <>
                {data.assets.current_assets.map((a) => renderAccountRow(a))}
                <SubtotalRow label="Total Current Assets" amount={data.assets.total_current_assets} />
              </>
            )}

            {data.assets.fixed_assets?.length > 0 && (
              <>
                {data.assets.fixed_assets.map((a) => renderAccountRow(a))}
                <SubtotalRow label="Total Fixed Assets" amount={data.assets.total_fixed_assets} />
              </>
            )}

            {data.assets.other_assets?.length > 0 && (
              <>
                {data.assets.other_assets.map((a) => renderAccountRow(a))}
                <SubtotalRow label="Total Other Assets" amount={data.assets.total_other_assets} />
              </>
            )}

            <TotalRow label="Total Assets" amount={data.assets.total_assets} />

            <tr style={{ backgroundColor: sectionHeaderStyle.backgroundColor }}>
              <td colSpan={2} style={sectionHeaderStyle}>Liabilities</td>
            </tr>

            {data.liabilities.current_liabilities?.length > 0 && (
              <>
                {data.liabilities.current_liabilities.map((a) => renderAccountRow(a))}
                <SubtotalRow label="Total Current Liabilities" amount={data.liabilities.total_current_liabilities} />
              </>
            )}

            {data.liabilities.long_term_liabilities?.length > 0 && (
              <>
                {data.liabilities.long_term_liabilities.map((a) => renderAccountRow(a))}
                <SubtotalRow label="Total Long-term Liabilities" amount={data.liabilities.total_long_term_liabilities} />
              </>
            )}

            <TotalRow label="Total Liabilities" amount={data.liabilities.total_liabilities} />

            <tr style={{ backgroundColor: sectionHeaderStyle.backgroundColor }}>
              <td colSpan={2} style={sectionHeaderStyle}>Equity</td>
            </tr>

            {data.equity.equity_accounts?.map((a) => renderAccountRow(a))}

            {typeof data.equity.inventory_valuation_adjustment === 'number' && Math.abs(data.equity.inventory_valuation_adjustment) >= 0.005 && (
              <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                <td style={{ padding: '6px 12px 6px 24px', fontSize: '14px', color: textColor }}>
                  Inventory valuation adjustment
                </td>
                <td style={{ padding: '6px 12px', fontSize: '14px', color: textColor, textAlign: 'right' }}>
                  {formatCurrency(data.equity.inventory_valuation_adjustment)}
                </td>
              </tr>
            )}

            <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
              <td style={{ padding: '6px 12px 6px 24px', fontSize: '14px', color: textColor }}>
                Current Year Earnings
              </td>
              <td style={{ padding: '6px 12px', fontSize: '14px', color: textColor, textAlign: 'right' }}>
                {formatCurrency(data.equity.current_year_earnings)}
              </td>
            </tr>

            <TotalRow label="Total Equity" amount={data.equity.total_equity} />

            <TotalRow
              label="Total Liabilities & Equity"
              amount={totalLE}
              isFinal
            />

            {!data.balances && (
              <tr>
                <td colSpan={2} style={{ padding: '8px 12px', color: textColor, fontSize: '13px', fontStyle: 'italic' }}>
                  ⚠️ Warning: Balance Sheet does not balance! Assets ({formatCurrency(data.assets.total_assets)}) ≠ Liabilities + Equity ({formatCurrency(totalLE)})
                </td>
              </tr>
            )}

            {data.balances && (
              <tr>
                <td colSpan={2} style={{ padding: '8px 12px', color: textColor, fontSize: '13px', fontStyle: 'italic' }}>
                  ✓ Balance Sheet balances correctly (Assets = Liabilities + Equity)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BalanceSheetTable
