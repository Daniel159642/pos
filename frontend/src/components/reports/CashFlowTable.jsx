import React from 'react'

function CashFlowTable({ data, onAccountClick }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    const sign = amount < 0 ? '-' : ''
    return `${sign}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const ItemRow = ({ item, indent = false }) => {
    const accountId = item.account_id ?? item.id
    const rowStyle = {
      cursor: accountId && onAccountClick ? 'pointer' : 'default',
      backgroundColor: 'transparent'
    }
    return (
      <tr
        style={rowStyle}
        onClick={() => accountId && onAccountClick && onAccountClick(accountId)}
        onMouseEnter={(e) => {
          if (accountId && onAccountClick) e.currentTarget.style.backgroundColor = isDarkMode ? '#3a3a3a' : '#f3f4f6'
        }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <td style={{ padding: '8px 24px', fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#1a1a1a', paddingLeft: indent ? '48px' : '24px' }}>
          {item.description}
        </td>
        <td style={{
          padding: '8px 24px',
          fontSize: '14px',
          textAlign: 'right',
          fontWeight: '500',
          color: item.amount < 0 ? '#dc2626' : (isDarkMode ? '#d1d5db' : '#1a1a1a')
        }}>
          {formatCurrency(item.amount)}
        </td>
      </tr>
    )
  }

  const SubtotalRow = ({ label, amount, className = '' }) => {
    const bg = className.includes('blue') ? (isDarkMode ? '#1a1a3a' : '#93c5fd')
      : className.includes('yellow') ? (isDarkMode ? '#3a3a1a' : '#fef08a')
      : className.includes('green') ? (isDarkMode ? '#1a3a1a' : '#6ee7b7')
      : className.includes('gray') ? (isDarkMode ? '#2a2a2a' : '#e5e7eb')
      : 'transparent'
    return (
      <tr style={{ fontWeight: '600', backgroundColor: bg }}>
        <td style={{ padding: '12px 24px', fontSize: '14px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{label}</td>
        <td style={{
          padding: '12px 24px',
          fontSize: '14px',
          textAlign: 'right',
          borderTop: `1px solid ${isDarkMode ? '#3a3a3a' : '#d1d5db'}`,
          color: amount < 0 ? '#dc2626' : '#059669'
        }}>
          {formatCurrency(amount)}
        </td>
      </tr>
    )
  }

  const TotalRow = ({ label, amount, className = '' }) => {
    const bg = className.includes('gray') ? (isDarkMode ? '#2a2a2a' : '#e5e7eb') : (isDarkMode ? '#1a1a3a' : '#93c5fd')
    return (
      <tr style={{ fontWeight: '700', backgroundColor: bg }}>
        <td style={{ padding: '16px 24px', fontSize: '16px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{label}</td>
        <td style={{
          padding: '16px 24px',
          fontSize: '16px',
          textAlign: 'right',
          borderTop: `2px solid ${isDarkMode ? '#555' : '#1a1a1a'}`,
          color: amount < 0 ? '#dc2626' : '#059669'
        }}>
          {formatCurrency(amount)}
        </td>
      </tr>
    )
  }

  const sectionStyle = { padding: '12px 24px', fontSize: '14px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a' }
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

  const op = data.operating_activities || {}
  const inv = data.investing_activities || {}
  const fin = data.financing_activities || {}

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
              <th style={thStyle}>Activity</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: isDarkMode ? '#1a1a3a' : '#dbeafe' }}>
              <td colSpan={2} style={sectionStyle}>CASH FLOWS FROM OPERATING ACTIVITIES</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 24px', fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#1a1a1a', paddingLeft: '48px' }}>Net Income</td>
              <td style={{ padding: '8px 24px', fontSize: '14px', textAlign: 'right', fontWeight: '500', color: isDarkMode ? '#d1d5db' : '#1a1a1a' }}>
                {formatCurrency(op.net_income ?? 0)}
              </td>
            </tr>
            {(op.adjustments || []).length > 0 && (
              <>
                <tr style={{ backgroundColor: isDarkMode ? '#1a1a3a' : '#bfdbfe' }}>
                  <td colSpan={2} style={{ ...sectionStyle, paddingLeft: '48px', fontSize: '12px', fontWeight: '600' }}>Adjustments to reconcile net income to cash:</td>
                </tr>
                {(op.adjustments || []).map((item, i) => <ItemRow key={`adj-${i}`} item={item} indent />)}
              </>
            )}
            {(op.working_capital_changes || []).length > 0 && (
              <>
                <tr style={{ backgroundColor: isDarkMode ? '#1a1a3a' : '#bfdbfe' }}>
                  <td colSpan={2} style={{ ...sectionStyle, paddingLeft: '48px', fontSize: '12px', fontWeight: '600' }}>Changes in working capital:</td>
                </tr>
                {(op.working_capital_changes || []).map((item, i) => <ItemRow key={`wc-${i}`} item={item} indent />)}
              </>
            )}
            <SubtotalRow label="Net Cash from Operating Activities" amount={op.net_cash_from_operations ?? 0} className="blue" />

            <tr style={{ backgroundColor: isDarkMode ? '#3a3a1a' : '#fef9c3' }}>
              <td colSpan={2} style={sectionStyle}>CASH FLOWS FROM INVESTING ACTIVITIES</td>
            </tr>
            {(inv.items || []).length > 0 ? (
              <>
                {(inv.items || []).map((item, i) => <ItemRow key={`inv-${i}`} item={item} indent />)}
                <SubtotalRow label="Net Cash from Investing Activities" amount={inv.net_cash_from_investing ?? 0} className="yellow" />
              </>
            ) : (
              <tr>
                <td colSpan={2} style={{ padding: '8px 24px', fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', fontStyle: 'italic', paddingLeft: '48px' }}>
                  No investing activities during this period
                </td>
              </tr>
            )}

            <tr style={{ backgroundColor: isDarkMode ? '#1a3a1a' : '#d1fae5' }}>
              <td colSpan={2} style={sectionStyle}>CASH FLOWS FROM FINANCING ACTIVITIES</td>
            </tr>
            {(fin.items || []).length > 0 ? (
              <>
                {(fin.items || []).map((item, i) => <ItemRow key={`fin-${i}`} item={item} indent />)}
                <SubtotalRow label="Net Cash from Financing Activities" amount={fin.net_cash_from_financing ?? 0} className="green" />
              </>
            ) : (
              <tr>
                <td colSpan={2} style={{ padding: '8px 24px', fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', fontStyle: 'italic', paddingLeft: '48px' }}>
                  No financing activities during this period
                </td>
              </tr>
            )}

            <TotalRow label="NET CHANGE IN CASH" amount={data.net_change_in_cash ?? 0} className="gray" />
            <tr>
              <td style={{ padding: '12px 24px', fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#1a1a1a' }}>Cash at Beginning of Period</td>
              <td style={{ padding: '12px 24px', fontSize: '14px', textAlign: 'right', fontWeight: '500', color: isDarkMode ? '#d1d5db' : '#1a1a1a' }}>
                {formatCurrency(data.beginning_cash ?? 0)}
              </td>
            </tr>
            <TotalRow label="CASH AT END OF PERIOD" amount={data.ending_cash ?? 0} className="blue" />
            <tr style={{ backgroundColor: isDarkMode ? '#1a3a1a' : '#d1fae5' }}>
              <td colSpan={2} style={{ padding: '12px 24px', fontSize: '14px', color: '#065f46', fontWeight: '600', textAlign: 'center' }}>
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
