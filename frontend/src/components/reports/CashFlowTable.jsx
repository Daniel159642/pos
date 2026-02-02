import React from 'react'

function CashFlowTable({ data, onAccountClick, periodLabel }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  // Match Balance Sheet: teal/blue-grey headers, light grey totals
  const mainHeaderBg = isDarkMode ? '#2d4a5a' : '#2d5a6b'
  const subHeaderBg = isDarkMode ? '#3a5566' : '#c5d9e0'
  const totalRowBg = isDarkMode ? '#2a3a45' : '#e8e8e8'
  const borderColor = isDarkMode ? '#3a4a55' : '#d0d0d0'
  const textColor = isDarkMode ? '#e8e8e8' : '#333'
  const subHeaderText = isDarkMode ? '#c8d4dc' : '#2d4a5a'

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return ''
    if (n === 0) return ''
    if (n < 0) return `($${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatCurrencyAlways = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    if (n < 0) return `($${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  const subHeaderStyle = {
    padding: '8px 12px 8px 24px',
    fontSize: '12px',
    fontWeight: 700,
    color: subHeaderText,
    backgroundColor: subHeaderBg,
    border: `1px solid ${borderColor}`,
    borderTop: 'none',
    textTransform: 'uppercase',
    letterSpacing: '0.02em'
  }

  const cellStyle = {
    padding: '6px 12px 6px 32px',
    fontSize: '14px',
    color: textColor,
    border: `1px solid ${borderColor}`,
    borderTop: 'none',
    backgroundColor: isDarkMode ? '#1f2a33' : '#fff'
  }

  const amountCellStyle = (amount) => ({
    padding: '6px 12px',
    fontSize: '14px',
    textAlign: 'right',
    color: amount < 0 ? '#ef4444' : textColor,
    border: `1px solid ${borderColor}`,
    borderTop: 'none',
    backgroundColor: isDarkMode ? '#1f2a33' : '#fff'
  })

  const subtotalRowStyle = {
    padding: '10px 12px',
    fontSize: '14px',
    fontWeight: 700,
    color: textColor,
    backgroundColor: totalRowBg,
    border: `1px solid ${borderColor}`,
    borderTop: `2px solid ${borderColor}`
  }

  const netIncreaseStyle = {
    ...subtotalRowStyle,
    borderTop: `3px solid ${borderColor}`,
    padding: '12px'
  }

  const op = data.operating_activities || {}
  const inv = data.investing_activities || {}
  const fin = data.financing_activities || {}

  const receiptsFrom = (items) => (items.cash_receipts_from || [])
  const paidFor = (items) => (items.cash_paid_for || [])

  const lineRow = (item, key) => (
    <tr key={key}>
      <td style={cellStyle}>{item.description}</td>
      <td style={amountCellStyle(item.amount)}>
        {item.amount !== 0 ? formatCurrency(item.amount) : ''}
      </td>
    </tr>
  )

  const renderSection = (title, receipts, paid, netLabel, netAmount) => (
    <>
      <tr>
        <td colSpan={2} style={sectionHeaderStyle}>{title}</td>
      </tr>
      <tr>
        <td colSpan={2} style={subHeaderStyle}>Cash receipts from:</td>
      </tr>
      {receipts.map((item, i) => lineRow(item, `r-${i}`))}
      <tr>
        <td colSpan={2} style={subHeaderStyle}>Cash paid for:</td>
      </tr>
      {paid.map((item, i) => lineRow(item, `p-${i}`))}
      <tr>
        <td style={subtotalRowStyle}>{netLabel}</td>
        <td style={{ ...subtotalRowStyle, textAlign: 'right', color: netAmount < 0 ? '#ef4444' : textColor }}>
          {formatCurrencyAlways(netAmount)}
        </td>
      </tr>
    </>
  )

  const tableHeaderStyle = {
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 700,
    color: subHeaderText,
    backgroundColor: subHeaderBg,
    border: `1px solid ${borderColor}`,
    borderTop: 'none',
    textAlign: 'left'
  }

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
      backgroundColor: isDarkMode ? '#1f2a33' : '#fff'
    }}>
      <div style={titleStyle}>Cash Flow Statement</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr>
              <th style={{ ...tableHeaderStyle }}>Activity</th>
              <th style={{ ...tableHeaderStyle, textAlign: 'right', width: '160px' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
              <td style={{ padding: '10px 12px', color: textColor }}>Cash at beginning of year</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: textColor }}>
                {formatCurrencyAlways(data.beginning_cash ?? 0)}
              </td>
            </tr>

            {renderSection(
              'Operations',
              receiptsFrom(op),
              paidFor(op),
              'Net Cash Flow from Operations',
              op.net_cash_from_operations ?? 0
            )}

            {renderSection(
              'Investing Activities',
              receiptsFrom(inv),
              paidFor(inv),
              'Net Cash Flow from Investing Activities',
              inv.net_cash_from_investing ?? 0
            )}

            {renderSection(
              'Financing Activities',
              receiptsFrom(fin),
              paidFor(fin),
              'Net Cash Flow from Financing Activities',
              fin.net_cash_from_financing ?? 0
            )}

            <tr>
              <td style={netIncreaseStyle}>Net Increase in Cash</td>
              <td style={{
                ...netIncreaseStyle,
                textAlign: 'right',
                color: (data.net_change_in_cash ?? 0) < 0 ? '#ef4444' : textColor
              }}>
                {formatCurrencyAlways(data.net_change_in_cash ?? 0)}
              </td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
              <td style={{ padding: '10px 12px', color: textColor }}>Cash at end of year</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: textColor }}>
                {formatCurrencyAlways(data.ending_cash ?? 0)}
              </td>
            </tr>
            {periodLabel && (
              <tr>
                <td colSpan={2} style={{ padding: '8px 12px', color: textColor, fontSize: '13px', fontStyle: 'italic', borderBottom: `1px solid ${borderColor}` }}>
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

export default CashFlowTable
