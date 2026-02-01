import React from 'react'

function BalanceSheetTable({ data, onAccountClick }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const AccountRow = ({ account, indent = false }) => {
    const rowStyle = {
      cursor: onAccountClick ? 'pointer' : 'default',
      backgroundColor: 'transparent'
    }
    return (
      <tr
        style={rowStyle}
        onClick={() => onAccountClick && onAccountClick(account.account_id ?? account.id)}
        onMouseEnter={(e) => {
          if (onAccountClick) e.currentTarget.style.backgroundColor = isDarkMode ? '#3a3a3a' : '#f3f4f6'
        }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <td style={{
          padding: '8px 24px',
          fontSize: '14px',
          color: isDarkMode ? '#d1d5db' : '#1a1a1a',
          paddingLeft: indent ? '48px' : '24px'
        }}>
          {account.account_number && `${account.account_number} - `}
          {account.account_name}
        </td>
        <td style={{
          padding: '8px 24px',
          fontSize: '14px',
          color: isDarkMode ? '#d1d5db' : '#1a1a1a',
          textAlign: 'right',
          fontWeight: '500'
        }}>
          {formatCurrency(account.balance)}
        </td>
      </tr>
    )
  }

  const SubtotalRow = ({ label, amount, className = '' }) => {
    const bg = className.includes('blue') ? (isDarkMode ? '#1a1a3a' : '#dbeafe')
      : className.includes('red') ? (isDarkMode ? '#3a1a1a' : '#fee2e2')
      : className.includes('green') ? (isDarkMode ? '#1a3a1a' : '#d1fae5')
      : 'transparent'
    return (
      <tr style={{ fontWeight: '600', backgroundColor: bg }}>
        <td style={{ padding: '12px 24px', fontSize: '14px', color: isDarkMode ? '#fff' : '#1a1a1a', paddingLeft: '48px' }}>
          {label}
        </td>
        <td style={{
          padding: '12px 24px',
          fontSize: '14px',
          color: isDarkMode ? '#fff' : '#1a1a1a',
          textAlign: 'right',
          borderTop: `1px solid ${isDarkMode ? '#3a3a3a' : '#d1d5db'}`
        }}>
          {formatCurrency(amount)}
        </td>
      </tr>
    )
  }

  const TotalRow = ({ label, amount, className = '' }) => {
    const bg = className.includes('blue') ? (isDarkMode ? '#1a1a3a' : '#93c5fd')
      : className.includes('red') ? (isDarkMode ? '#3a1a1a' : '#fca5a5')
      : className.includes('green') ? (isDarkMode ? '#1a3a1a' : '#6ee7b7')
      : className.includes('gray') ? (isDarkMode ? '#2a2a2a' : '#e5e7eb')
      : 'transparent'
    return (
      <tr style={{ fontWeight: '700', backgroundColor: bg }}>
        <td style={{ padding: '16px 24px', fontSize: '16px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>
          {label}
        </td>
        <td style={{
          padding: '16px 24px',
          fontSize: '16px',
          color: isDarkMode ? '#fff' : '#1a1a1a',
          textAlign: 'right',
          borderTop: `2px solid ${isDarkMode ? '#555' : '#1a1a1a'}`
        }}>
          {formatCurrency(amount)}
        </td>
      </tr>
    )
  }

  const sectionStyle = {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '700',
    color: isDarkMode ? '#fff' : '#1a1a1a'
  }

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
    borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
  }

  const totalLE = data.liabilities.total_liabilities + data.equity.total_equity

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
              <th style={thStyle}>Account</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: isDarkMode ? '#1a1a3a' : '#dbeafe' }}>
              <td colSpan={2} style={sectionStyle}>ASSETS</td>
            </tr>

            {data.assets.current_assets?.length > 0 && (
              <>
                <tr style={{ backgroundColor: isDarkMode ? '#1a1a3a' : '#bfdbfe' }}>
                  <td colSpan={2} style={{ ...sectionStyle, paddingLeft: '48px', fontWeight: '600' }}>Current Assets</td>
                </tr>
                {data.assets.current_assets.map((a) => <AccountRow key={a.account_id ?? a.id} account={a} indent />)}
                <SubtotalRow label="Total Current Assets" amount={data.assets.total_current_assets} className="blue" />
              </>
            )}

            {data.assets.fixed_assets?.length > 0 && (
              <>
                <tr style={{ backgroundColor: isDarkMode ? '#1a1a3a' : '#bfdbfe' }}>
                  <td colSpan={2} style={{ ...sectionStyle, paddingLeft: '48px', fontWeight: '600' }}>Fixed Assets</td>
                </tr>
                {data.assets.fixed_assets.map((a) => <AccountRow key={a.account_id ?? a.id} account={a} indent />)}
                <SubtotalRow label="Total Fixed Assets" amount={data.assets.total_fixed_assets} className="blue" />
              </>
            )}

            {data.assets.other_assets?.length > 0 && (
              <>
                <tr style={{ backgroundColor: isDarkMode ? '#1a1a3a' : '#bfdbfe' }}>
                  <td colSpan={2} style={{ ...sectionStyle, paddingLeft: '48px', fontWeight: '600' }}>Other Assets</td>
                </tr>
                {data.assets.other_assets.map((a) => <AccountRow key={a.account_id ?? a.id} account={a} indent />)}
                <SubtotalRow label="Total Other Assets" amount={data.assets.total_other_assets} className="blue" />
              </>
            )}

            <TotalRow label="TOTAL ASSETS" amount={data.assets.total_assets} className="blue" />

            <tr style={{ backgroundColor: isDarkMode ? '#3a1a1a' : '#fee2e2' }}>
              <td colSpan={2} style={sectionStyle}>LIABILITIES</td>
            </tr>

            {data.liabilities.current_liabilities?.length > 0 && (
              <>
                <tr style={{ backgroundColor: isDarkMode ? '#3a1a1a' : '#fecaca' }}>
                  <td colSpan={2} style={{ ...sectionStyle, paddingLeft: '48px', fontWeight: '600' }}>Current Liabilities</td>
                </tr>
                {data.liabilities.current_liabilities.map((a) => <AccountRow key={a.account_id ?? a.id} account={a} indent />)}
                <SubtotalRow label="Total Current Liabilities" amount={data.liabilities.total_current_liabilities} className="red" />
              </>
            )}

            {data.liabilities.long_term_liabilities?.length > 0 && (
              <>
                <tr style={{ backgroundColor: isDarkMode ? '#3a1a1a' : '#fecaca' }}>
                  <td colSpan={2} style={{ ...sectionStyle, paddingLeft: '48px', fontWeight: '600' }}>Long-term Liabilities</td>
                </tr>
                {data.liabilities.long_term_liabilities.map((a) => <AccountRow key={a.account_id ?? a.id} account={a} indent />)}
                <SubtotalRow label="Total Long-term Liabilities" amount={data.liabilities.total_long_term_liabilities} className="red" />
              </>
            )}

            <TotalRow label="TOTAL LIABILITIES" amount={data.liabilities.total_liabilities} className="red" />

            <tr style={{ backgroundColor: isDarkMode ? '#1a3a1a' : '#d1fae5' }}>
              <td colSpan={2} style={sectionStyle}>EQUITY</td>
            </tr>

            {data.equity.equity_accounts?.map((a) => <AccountRow key={a.account_id ?? a.id} account={a} indent />)}

            {typeof data.equity.inventory_valuation_adjustment === 'number' && Math.abs(data.equity.inventory_valuation_adjustment) >= 0.005 && (
              <tr style={{ cursor: 'default' }}>
                <td style={{ padding: '8px 24px', fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', paddingLeft: '48px' }}>
                  Inventory valuation adjustment
                </td>
                <td style={{ padding: '8px 24px', fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#1a1a1a', textAlign: 'right', fontWeight: '500' }}>
                  {formatCurrency(data.equity.inventory_valuation_adjustment)}
                </td>
              </tr>
            )}

            <tr style={{ cursor: 'default' }}>
              <td style={{ padding: '8px 24px', fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#1a1a1a', paddingLeft: '48px' }}>
                Current Year Earnings
              </td>
              <td style={{ padding: '8px 24px', fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#1a1a1a', textAlign: 'right', fontWeight: '500' }}>
                {formatCurrency(data.equity.current_year_earnings)}
              </td>
            </tr>

            <TotalRow label="TOTAL EQUITY" amount={data.equity.total_equity} className="green" />

            <TotalRow
              label="TOTAL LIABILITIES AND EQUITY"
              amount={totalLE}
              className="gray"
            />

            {!data.balances && (
              <tr style={{ backgroundColor: '#fef2f2' }}>
                <td colSpan={2} style={{ padding: '12px 24px', fontSize: '14px', color: '#b91c1c', fontWeight: '600', textAlign: 'center' }}>
                  ⚠️ Warning: Balance Sheet does not balance! Assets ({formatCurrency(data.assets.total_assets)}) ≠ Liabilities + Equity ({formatCurrency(totalLE)})
                </td>
              </tr>
            )}

            {data.balances && (
              <tr style={{ backgroundColor: isDarkMode ? '#1a3a1a' : '#d1fae5' }}>
                <td colSpan={2} style={{ padding: '12px 24px', fontSize: '14px', color: '#065f46', fontWeight: '600', textAlign: 'center' }}>
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
