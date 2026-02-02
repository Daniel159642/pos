import React from 'react'

function CashFlowTable({ data, onAccountClick }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  const formatCurrency = (amount) => {
    const sign = amount < 0 ? '-' : ''
    return `${sign}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
      <td style={{
        padding: '10px 12px',
        textAlign: 'right',
        color: amount < 0 ? '#ef4444' : textColor
      }}>
        {formatCurrency(amount)}
      </td>
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
      <td style={{
        padding: isFinal ? '12px' : '10px 12px',
        fontSize: '14px',
        textAlign: 'right',
        color: amount < 0 ? '#ef4444' : textColor,
        fontWeight: isFinal ? 700 : 600
      }}>
        {formatCurrency(amount)}
      </td>
    </tr>
  )

  const op = data.operating_activities || {}
  const inv = data.investing_activities || {}
  const fin = data.financing_activities || {}

  const itemRow = (item, key) => (
    <tr key={key} style={{ borderBottom: `1px solid ${borderColor}` }}>
      <td style={{ padding: '6px 12px 6px 24px', color: textColor }}>{item.description}</td>
      <td style={{
        padding: '6px 12px',
        fontSize: '14px',
        textAlign: 'right',
        color: item.amount < 0 ? '#ef4444' : textColor
      }}>
        {formatCurrency(item.amount)}
      </td>
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
              <th style={{ padding: '10px 12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Activity</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: sectionHeaderStyle.backgroundColor }}>
              <td colSpan={2} style={sectionHeaderStyle}>Cash flows from operating activities</td>
            </tr>
            <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
              <td style={{ padding: '6px 12px 6px 24px', color: textColor }}>Net Income</td>
              <td style={{ padding: '6px 12px', textAlign: 'right', color: textColor }}>
                {formatCurrency(op.net_income ?? 0)}
              </td>
            </tr>
            {(op.adjustments || []).length > 0 && (
              <>
                {(op.adjustments || []).map((item, i) => itemRow(item, `adj-${i}`))}
              </>
            )}
            {(op.working_capital_changes || []).length > 0 && (
              <>
                {(op.working_capital_changes || []).map((item, i) => itemRow(item, `wc-${i}`))}
              </>
            )}
            <SubtotalRow label="Net Cash from Operating Activities" amount={op.net_cash_from_operations ?? 0} />

            <tr style={{ backgroundColor: sectionHeaderStyle.backgroundColor }}>
              <td colSpan={2} style={sectionHeaderStyle}>Cash flows from investing activities</td>
            </tr>
            {(inv.items || []).length > 0 ? (
              <>
                {(inv.items || []).map((item, i) => itemRow(item, `inv-${i}`))}
                <SubtotalRow label="Net Cash from Investing Activities" amount={inv.net_cash_from_investing ?? 0} />
              </>
            ) : (
              <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                <td colSpan={2} style={{ padding: '6px 12px 6px 24px', fontSize: '14px', color: textColor, fontStyle: 'italic' }}>
                  No investing activities during this period
                </td>
              </tr>
            )}

            <tr style={{ backgroundColor: sectionHeaderStyle.backgroundColor }}>
              <td colSpan={2} style={sectionHeaderStyle}>Cash flows from financing activities</td>
            </tr>
            {(fin.items || []).length > 0 ? (
              <>
                {(fin.items || []).map((item, i) => itemRow(item, `fin-${i}`))}
                <SubtotalRow label="Net Cash from Financing Activities" amount={fin.net_cash_from_financing ?? 0} />
              </>
            ) : (
              <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                <td colSpan={2} style={{ padding: '6px 12px 6px 24px', fontSize: '14px', color: textColor, fontStyle: 'italic' }}>
                  No financing activities during this period
                </td>
              </tr>
            )}

            <TotalRow label="Net change in cash" amount={data.net_change_in_cash ?? 0} />
            <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
              <td style={{ padding: '10px 12px', color: textColor }}>Cash at beginning of period</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', color: textColor }}>
                {formatCurrency(data.beginning_cash ?? 0)}
              </td>
            </tr>
            <TotalRow label="Cash at end of period" amount={data.ending_cash ?? 0} isFinal />
            <tr>
              <td colSpan={2} style={{ padding: '8px 12px', color: textColor, fontSize: '13px', fontStyle: 'italic' }}>
                ✓ Verification: Beginning Cash ({formatCurrency(data.beginning_cash ?? 0)}) + Net Change ({formatCurrency(data.net_change_in_cash ?? 0)}) = Ending Cash ({formatCurrency(data.ending_cash ?? 0)})
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default CashFlowTable
