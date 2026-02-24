import React, { useState, useMemo } from 'react'

function GeneralLedgerTable({ entries, loading = false, showRunningBalance = false, onViewTransaction, fixedHeader = false }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const [sortField, setSortField] = useState('transaction_date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [hoveredTransactionId, setHoveredTransactionId] = useState(null)

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const dateA = new Date(a.transaction_date).getTime()
      const dateB = new Date(b.transaction_date).getTime()
      const idA = a.transaction_id != null ? a.transaction_id : 0
      const idB = b.transaction_id != null ? b.transaction_id : 0
      if (dateA !== dateB) return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
      if (idA !== idB) return sortDirection === 'asc' ? idA - idB : idB - idA
      const lineA = a.line_id ?? a.line_number ?? 0
      const lineB = b.line_id ?? b.line_number ?? 0
      if (lineA !== lineB) return lineA - lineB
      const accountCmp = (a.account_name || '').localeCompare(b.account_name || '')
      return sortField === 'account_name' ? (sortDirection === 'asc' ? accountCmp : -accountCmp) : 0
    })
    return sorted
  }, [entries, sortField, sortDirection])

  // Group rows by transaction_id so one transaction = one block; hover highlights entire block
  const groupedByTransaction = useMemo(() => {
    const groups = []
    for (const entry of sortedEntries) {
      const tid = entry.transaction_id != null ? entry.transaction_id : (entry.id != null ? `tx-${entry.id}` : `line-${entry.line_id ?? Math.random()}`)
      const last = groups[groups.length - 1]
      if (last && last.transaction_id === tid) {
        last.entries.push(entry)
      } else {
        groups.push({ transaction_id: tid, entries: [entry] })
      }
    }
    return groups
  }, [sortedEntries])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const calculateTotals = () => {
    const totalDebits = entries.reduce((sum, entry) => sum + (parseFloat(entry.debit_amount) || 0), 0)
    const totalCredits = entries.reduce((sum, entry) => sum + (parseFloat(entry.credit_amount) || 0), 0)
    return { totalDebits, totalCredits }
  }

  const { totalDebits, totalCredits } = calculateTotals()

  // Match Financial Statements reports: teal/blue-grey headers, same borders and cell styles
  const mainHeaderBg = isDarkMode ? '#2d4a5a' : '#2d5a6b'
  const subHeaderBg = isDarkMode ? '#3a5566' : '#c5d9e0'
  const totalRowBg = isDarkMode ? '#2a3a45' : '#e8e8e8'
  const borderColor = isDarkMode ? '#3a4a55' : '#d0d0d0'
  const textColor = isDarkMode ? '#e8e8e8' : '#333'
  const subHeaderText = isDarkMode ? '#c8d4dc' : '#2d4a5a'

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <span style={{ marginLeft: '4px', opacity: 0.8 }}>↕</span>
    }
    return <span style={{ marginLeft: '4px' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
  }

  const bannerStyle = {
    backgroundColor: mainHeaderBg,
    padding: '14px 20px',
    textAlign: 'center',
    border: `1px solid ${borderColor}`,
    borderBottom: 'none'
  }

  const columnHeaderStyle = {
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 700,
    color: subHeaderText,
    backgroundColor: subHeaderBg,
    border: `1px solid ${borderColor}`,
    borderTop: 'none',
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    cursor: 'pointer'
  }

  const getCellStyle = (backgroundColor) => ({
    padding: '6px 12px',
    fontSize: '14px',
    color: textColor,
    border: `1px solid ${borderColor}`,
    borderTop: 'none',
    backgroundColor: backgroundColor ?? (isDarkMode ? '#1f2a33' : '#fff')
  })

  const totalRowStyle = {
    padding: '10px 12px',
    fontSize: '14px',
    fontWeight: 700,
    color: textColor,
    backgroundColor: totalRowBg,
    border: `1px solid ${borderColor}`,
    borderTop: `2px solid ${borderColor}`
  }

  const finalTotalRowStyle = {
    ...totalRowStyle,
    borderTop: `1px solid ${borderColor}`,
    borderBottomStyle: 'double',
    borderBottomWidth: '4px',
    borderBottomColor: textColor,
    padding: '12px'
  }

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  }

  const rowBg = isDarkMode ? '#1f2a33' : '#fff'
  const hoverBg = totalRowBg

  const colWidths = showRunningBalance ? '11% 12% 18% 32% 9% 9% 9%' : '11% 14% 20% 35% 10% 10%'
  const headerRow = (
    <tr>
      <th
        style={columnHeaderStyle}
        onClick={() => handleSort('transaction_date')}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDarkMode ? '#4a6577' : '#b8d0d8' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = subHeaderBg }}
      >
        Date <SortIcon field="transaction_date" />
      </th>
      <th style={columnHeaderStyle}>Transaction #</th>
      <th
        style={columnHeaderStyle}
        onClick={() => handleSort('account_name')}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDarkMode ? '#4a6577' : '#b8d0d8' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = subHeaderBg }}
      >
        Account <SortIcon field="account_name" />
      </th>
      <th style={columnHeaderStyle}>Description</th>
      <th style={{ ...columnHeaderStyle, textAlign: 'right' }}>Debit</th>
      <th style={{ ...columnHeaderStyle, textAlign: 'right' }}>Credit</th>
      {showRunningBalance && (
        <th style={{ ...columnHeaderStyle, textAlign: 'right' }}>Balance</th>
      )}
    </tr>
  )

  const showPlaceholder = loading || entries.length === 0
  const placeholderColSpan = showRunningBalance ? 7 : 6
  const placeholderBody = (
    <tbody>
      <tr>
        <td
          colSpan={placeholderColSpan}
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: subHeaderText,
            fontSize: '14px',
            border: `1px solid ${borderColor}`,
            borderTop: 'none',
            backgroundColor: rowBg
          }}
        >
          {loading ? 'Loading…' : (
            <>
              <p style={{ marginBottom: '8px' }}>No ledger entries found for the selected criteria</p>
              <p style={{ fontSize: '14px', color: textColor }}>Try adjusting your filters or post some transactions</p>
            </>
          )}
        </td>
      </tr>
    </tbody>
  )

  if (showPlaceholder) {
    return (
      <div style={{
        flex: fixedHeader ? 1 : undefined,
        minHeight: fixedHeader ? 0 : undefined,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        backgroundColor: isDarkMode ? '#1f2a33' : '#fff'
      }}>
        <div style={bannerStyle}>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>General Ledger</span>
        </div>
        <div style={{ overflowX: 'auto', flex: fixedHeader ? 1 : undefined, minHeight: fixedHeader ? 0 : undefined }}>
          <table style={{ ...tableStyle, tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              {colWidths.split(' ').map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <thead>{headerRow}</thead>
            {placeholderBody}
          </table>
        </div>
      </div>
    )
  }

  if (fixedHeader) {
    return (
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        backgroundColor: isDarkMode ? '#1f2a33' : '#fff'
      }}>
        <div style={{ flexShrink: 0 }}>
          <div style={bannerStyle}>
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>General Ledger</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ ...tableStyle, tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                {colWidths.split(' ').map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead>{headerRow}</thead>
            </table>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <table style={{ ...tableStyle, tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              {colWidths.split(' ').map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            {groupedByTransaction.map((group) => {
              const isGroupHovered = hoveredTransactionId === group.transaction_id
              const groupRowBg = isGroupHovered ? hoverBg : rowBg
              const cellBg = groupRowBg
              const baseCell = getCellStyle(cellBg)
              const txId = group.entries[0]?.transaction_id
              return (
                <tbody
                  key={String(group.transaction_id)}
                  onMouseEnter={() => setHoveredTransactionId(group.transaction_id)}
                  onMouseLeave={() => setHoveredTransactionId(null)}
                >
                  {group.entries.map((entry) => (
                    <tr
                      key={`${entry.transaction_id}-${entry.line_id}`}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: cellBg,
                        transition: 'background-color 0.15s ease'
                      }}
                      onClick={() => onViewTransaction(entry.transaction_id != null ? entry.transaction_id : txId)}
                    >
                      <td style={baseCell}>
                        {new Date(entry.transaction_date).toLocaleDateString()}
                      </td>
                      <td style={{ ...baseCell, fontWeight: 600, color: isDarkMode ? '#93c5fd' : '#2563eb' }}>
                        {entry.transaction_number}
                      </td>
                      <td style={baseCell}>
                        <div style={{ fontWeight: 500 }}>
                          {entry.account_number && `${entry.account_number} - `}
                          {entry.account_name}
                        </div>
                        <div style={{ fontSize: '12px', color: subHeaderText, marginTop: '2px' }}>
                          {entry.account_type}
                        </div>
                      </td>
                      <td style={baseCell}>
                        <div>{entry.line_description}</div>
                        {entry.reference_number && (
                          <div style={{ fontSize: '12px', color: subHeaderText, marginTop: '2px' }}>
                            Ref: {entry.reference_number}
                          </div>
                        )}
                      </td>
                      <td style={{ ...baseCell, textAlign: 'right', fontWeight: 600 }}>
                        {(parseFloat(entry.debit_amount) || 0) > 0 ? `$${(parseFloat(entry.debit_amount) || 0).toFixed(2)}` : '-'}
                      </td>
                      <td style={{ ...baseCell, textAlign: 'right', fontWeight: 600 }}>
                        {(parseFloat(entry.credit_amount) || 0) > 0 ? `$${(parseFloat(entry.credit_amount) || 0).toFixed(2)}` : '-'}
                      </td>
                      {showRunningBalance && entry.running_balance !== undefined && (
                        <td style={{ ...baseCell, textAlign: 'right', fontWeight: 700 }}>
                          ${(parseFloat(entry.running_balance) || 0).toFixed(2)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              )
            })}
          </table>
        </div>
        <div style={{ flexShrink: 0, overflowX: 'auto', borderTop: `2px solid ${borderColor}` }}>
          <table style={{ ...tableStyle, tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              {colWidths.split(' ').map((w, i) => <col key={i} style={{ width: w }} />)}
            </colgroup>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ ...finalTotalRowStyle, textAlign: 'right' }}>Totals:</td>
                <td style={{ ...finalTotalRowStyle, textAlign: 'right' }}>${totalDebits.toFixed(2)}</td>
                <td style={{ ...finalTotalRowStyle, textAlign: 'right' }}>${totalCredits.toFixed(2)}</td>
                {showRunningBalance && <td style={{ ...finalTotalRowStyle }}></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: isDarkMode ? '#1f2a33' : '#fff'
    }}>
      <div style={bannerStyle}>
        <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>General Ledger</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>{headerRow}</thead>
          {groupedByTransaction.map((group) => {
            const isGroupHovered = hoveredTransactionId === group.transaction_id
            const groupRowBg = isGroupHovered ? hoverBg : rowBg
            const cellBg = groupRowBg
            const baseCell = getCellStyle(cellBg)
            const txId = group.entries[0]?.transaction_id
            return (
              <tbody
                key={String(group.transaction_id)}
                onMouseEnter={() => setHoveredTransactionId(group.transaction_id)}
                onMouseLeave={() => setHoveredTransactionId(null)}
              >
                {group.entries.map((entry) => (
                  <tr
                    key={`${entry.transaction_id}-${entry.line_id}`}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: cellBg,
                      transition: 'background-color 0.15s ease'
                    }}
                    onClick={() => onViewTransaction(entry.transaction_id != null ? entry.transaction_id : txId)}
                  >
                    <td style={baseCell}>
                      {new Date(entry.transaction_date).toLocaleDateString()}
                    </td>
                    <td style={{ ...baseCell, fontWeight: 600, color: isDarkMode ? '#93c5fd' : '#2563eb' }}>
                      {entry.transaction_number}
                    </td>
                    <td style={baseCell}>
                      <div style={{ fontWeight: 500 }}>
                        {entry.account_number && `${entry.account_number} - `}
                        {entry.account_name}
                      </div>
                      <div style={{ fontSize: '12px', color: subHeaderText, marginTop: '2px' }}>
                        {entry.account_type}
                      </div>
                    </td>
                    <td style={baseCell}>
                      <div>{entry.line_description}</div>
                      {entry.reference_number && (
                        <div style={{ fontSize: '12px', color: subHeaderText, marginTop: '2px' }}>
                          Ref: {entry.reference_number}
                        </div>
                      )}
                    </td>
                    <td style={{ ...baseCell, textAlign: 'right', fontWeight: 600 }}>
                      {(parseFloat(entry.debit_amount) || 0) > 0 ? `$${(parseFloat(entry.debit_amount) || 0).toFixed(2)}` : '-'}
                    </td>
                    <td style={{ ...baseCell, textAlign: 'right', fontWeight: 600 }}>
                      {(parseFloat(entry.credit_amount) || 0) > 0 ? `$${(parseFloat(entry.credit_amount) || 0).toFixed(2)}` : '-'}
                    </td>
                    {showRunningBalance && entry.running_balance !== undefined && (
                      <td style={{ ...baseCell, textAlign: 'right', fontWeight: 700 }}>
                        ${(parseFloat(entry.running_balance) || 0).toFixed(2)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            )
          })}
          <tfoot>
            <tr>
              <td colSpan={4} style={{ ...finalTotalRowStyle, textAlign: 'right' }}>Totals:</td>
              <td style={{ ...finalTotalRowStyle, textAlign: 'right' }}>${totalDebits.toFixed(2)}</td>
              <td style={{ ...finalTotalRowStyle, textAlign: 'right' }}>${totalCredits.toFixed(2)}</td>
              {showRunningBalance && <td style={{ ...finalTotalRowStyle }}></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default GeneralLedgerTable
