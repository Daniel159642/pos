import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Table from '../components/Table'

function RecentOrders() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/orders')
      const result = await response.json()
      // Show only recent orders (last 50)
      if (result.data) {
        result.data = result.data.slice(0, 50)
      }
      setData(result)
    } catch (err) {
      setError('Error loading data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleReturn = (orderNumber, orderId) => {
    // Navigate to returns page with order number
    navigate(`/returns?orderNumber=${encodeURIComponent(orderNumber)}&orderId=${orderId}`)
  }

  // Add Actions column to the data
  const processedData = data && data.data ? data.data.map(row => ({
    ...row,
    _actions: row // Store the full row for actions
  })) : []

  const columnsWithActions = data && data.columns ? [...data.columns, 'Actions'] : []

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '30px', fontSize: '28px', fontWeight: 500 }}>
        Recent Orders
      </h1>
      <div style={{ overflowX: 'auto' }}>
        {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading...</div>}
        {error && <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>{error}</div>}
        {!loading && !error && data && (
          data.data && data.data.length > 0 ? (
            <div style={{ 
              backgroundColor: '#fff', 
              borderRadius: '4px', 
              overflowX: 'auto',
              overflowY: 'visible',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              width: '100%'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    {columnsWithActions.map(col => (
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
                  {processedData.map((row, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      {data.columns.map(col => {
                        const value = row[col]
                        let formattedValue = ''
                        
                        if (value === null || value === undefined) {
                          formattedValue = ''
                        } else if (col.includes('price') || col.includes('cost') || col.includes('total') || 
                                  col.includes('amount') || col.includes('fee')) {
                          formattedValue = typeof value === 'number' 
                            ? `$${value.toFixed(2)}` 
                            : `$${parseFloat(value || 0).toFixed(2)}`
                        } else if (col.includes('date') || col.includes('time')) {
                          try {
                            const date = new Date(value)
                            if (!isNaN(date.getTime())) {
                              formattedValue = date.toLocaleString()
                            } else {
                              formattedValue = String(value)
                            }
                          } catch {
                            formattedValue = String(value)
                          }
                        } else {
                          formattedValue = String(value)
                        }
                        
                        return (
                          <td 
                            key={col} 
                            style={{ 
                              padding: '8px 12px', 
                              borderBottom: '1px solid #eee',
                              fontSize: '14px',
                              textAlign: (col.includes('price') || col.includes('cost') || col.includes('total') || 
                                         col.includes('amount') || col.includes('fee')) ? 'right' : 'left'
                            }}
                          >
                            {formattedValue}
                          </td>
                        )
                      })}
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}>
                        <button
                          onClick={() => handleReturn(row.order_number || row.orderNumber, row.order_id || row.orderId)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#4a90e2',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 500,
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#357abd'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#4a90e2'}
                        >
                          Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No orders found</div>
          )
        )}
      </div>
    </div>
  )
}

export default RecentOrders

