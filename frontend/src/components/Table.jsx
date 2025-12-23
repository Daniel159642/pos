function Table({ columns, data }) {
  const formatValue = (value, column) => {
    if (value === null || value === undefined) return ''
    
    // Format currency fields
    if (column.includes('price') || column.includes('cost') || column.includes('total') || 
        column.includes('amount') || column.includes('fee') || column.includes('balance') ||
        column.includes('income') || column.includes('expense') || column.includes('revenue')) {
      if (typeof value === 'number') {
        return `$${value.toFixed(2)}`
      }
      if (typeof value === 'string' && !isNaN(parseFloat(value))) {
        return `$${parseFloat(value).toFixed(2)}`
      }
    }
    
    // Format percentage fields
    if (column.includes('rate') && typeof value === 'number') {
      return `${(value * 100).toFixed(2)}%`
    }
    
    // Format dates/timestamps
    if (column.includes('date') || column.includes('time') || column.includes('timestamp')) {
      if (value) {
        try {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            return date.toLocaleString()
          }
        } catch (e) {
          // Not a valid date
        }
      }
    }
    
    // Format numbers
    if (typeof value === 'number') {
      return value % 1 !== 0 ? value.toFixed(2) : value.toString()
    }
    
    // Format boolean
    if (typeof value === 'boolean' || value === 0 || value === 1) {
      return value ? 'Yes' : 'No'
    }
    
    return String(value)
  }

  const isNumeric = (value) => {
    return typeof value === 'number' || 
           (typeof value === 'string' && !isNaN(value) && !isNaN(parseFloat(value)))
  }

  const getCellStyle = (col, value) => {
    const baseStyle = { 
      padding: '8px 12px', 
      borderBottom: '1px solid #eee',
      fontSize: '14px'
    }
    
    if (col.includes('price') || col.includes('cost') || col.includes('total') || 
        col.includes('amount') || col.includes('fee') || col.includes('balance') ||
        col.includes('income') || col.includes('expense') || col.includes('revenue')) {
      return { ...baseStyle, textAlign: 'right', fontFamily: 'monospace' }
    }
    
    if (isNumeric(value)) {
      return { ...baseStyle, textAlign: 'right' }
    }
    
    return baseStyle
  }

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            {columns.map(col => (
              <th
                key={col}
                style={{
                  padding: '12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  borderBottom: '2px solid #dee2e6',
                  color: '#495057',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </th>
            ))}
          </tr>
        </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
            {columns.map(col => (
              <td key={col} style={getCellStyle(col, row[col])}>
                {formatValue(row[col], col)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  )
}

export default Table

