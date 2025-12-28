import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Table from '../components/Table'

function RecentOrders() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedRow, setExpandedRow] = useState(null)
  const [orderDetails, setOrderDetails] = useState({})
  const [loadingDetails, setLoadingDetails] = useState({})
  const [searchQuery, setSearchQuery] = useState('')

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

  const handleRowClick = async (row) => {
    const orderId = row.order_id || row.orderId
    if (!orderId) return

    // Toggle expansion
    if (expandedRow === orderId) {
      setExpandedRow(null)
      return
    }

    setExpandedRow(orderId)

    // If we already have the details, don't fetch again
    if (orderDetails[orderId]) {
      return
    }

    // Fetch order details
    setLoadingDetails(prev => ({ ...prev, [orderId]: true }))
    try {
      // Fetch order items
      const itemsResponse = await fetch('/api/order_items')
      const itemsResult = await itemsResponse.json()
      const items = itemsResult.data || []
      
      // Filter items for this order
      const orderItems = items.filter(item => 
        (item.order_id || item.orderId) === orderId
      )

      // Get order details from the row data
      const details = {
        employee_id: row.employee_id || row.employeeId || null,
        customer_id: row.customer_id || row.customerId || null,
        subtotal: row.subtotal || 0,
        tax_rate: row.tax_rate || 0,
        tax_amount: row.tax_amount || row.tax || 0,
        discount: row.discount || 0,
        transaction_fee: row.transaction_fee || 0,
        notes: row.notes || '',
        tip: row.tip || 0,
        items: orderItems
      }

      setOrderDetails(prev => ({ ...prev, [orderId]: details }))
    } catch (err) {
      console.error('Error loading order details:', err)
    } finally {
      setLoadingDetails(prev => ({ ...prev, [orderId]: false }))
    }
  }

  // Add Actions column to the data
  const processedData = data && data.data ? data.data.map(row => ({
    ...row,
    _actions: row // Store the full row for actions
  })) : []

  // Filter data based on search query
  const filteredData = searchQuery ? processedData.filter(row => {
    const query = searchQuery.toLowerCase()
    return Object.values(row).some(value => {
      if (value === null || value === undefined) return false
      return String(value).toLowerCase().includes(query)
    })
  }) : processedData

  // Fields to hide from main table (shown in dropdown)
  const hiddenFields = ['order_id', 'orderId', 'employee_id', 'employeeId', 'customer_id', 'customerId', 'subtotal', 'tax_rate', 'tax_amount', 'tax', 'discount', 'transaction_fee', 'notes', 'tip']
  
  // Filter out hidden fields from columns
  const visibleColumns = data && data.columns ? data.columns.filter(col => !hiddenFields.includes(col)) : []
  const columnsWithActions = [...visibleColumns, 'Actions']

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search orders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 0',
            border: 'none',
            borderBottom: '2px solid #ddd',
            borderRadius: '0',
            backgroundColor: 'transparent',
            outline: 'none',
            fontSize: '14px',
            boxSizing: 'border-box',
            fontFamily: '"Product Sans", sans-serif'
          }}
        />
      </div>
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
                  {filteredData.map((row, idx) => {
                    const orderId = row.order_id || row.orderId
                    const isExpanded = expandedRow === orderId
                    const details = orderDetails[orderId]
                    const isLoading = loadingDetails[orderId]

                    return (
                      <>
                        <tr 
                          key={idx} 
                          onClick={() => handleRowClick(row)}
                          style={{ 
                            backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa',
                            cursor: 'pointer'
                          }}
                        >
                          {visibleColumns.map(col => {
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
                          <td 
                            style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleReturn(row.order_number || row.orderNumber, orderId)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'rgba(128, 0, 128, 0.7)',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                color: '#fff',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 600,
                                boxShadow: '0 4px 15px rgba(128, 0, 128, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                transition: 'all 0.3s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = 'rgba(128, 0, 128, 0.8)'
                                e.target.style.boxShadow = '0 4px 20px rgba(128, 0, 128, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'rgba(128, 0, 128, 0.7)'
                                e.target.style.boxShadow = '0 4px 15px rgba(128, 0, 128, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                              }}
                            >
                              Return
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${idx}-details`}>
                            <td colSpan={columnsWithActions.length} style={{ padding: '0', borderBottom: '1px solid #eee' }}>
                              <div style={{
                                padding: '20px',
                                backgroundColor: '#f8f9fa',
                                borderTop: '2px solid #dee2e6'
                              }}>
                                {isLoading ? (
                                  <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                                    Loading details...
                                  </div>
                                ) : details ? (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                    <div>
                                      <strong>Order ID:</strong> {orderId || 'N/A'}
                                    </div>
                                    <div>
                                      <strong>Employee ID:</strong> {details.employee_id || 'N/A'}
                                    </div>
                                    <div>
                                      <strong>Customer ID:</strong> {details.customer_id || 'N/A'}
                                    </div>
                                    <div>
                                      <strong>Subtotal:</strong> ${details.subtotal.toFixed(2)}
                                    </div>
                                    <div>
                                      <strong>Tax Rate:</strong> {(details.tax_rate * 100).toFixed(2)}%
                                    </div>
                                    <div>
                                      <strong>Tax Amount:</strong> ${details.tax_amount.toFixed(2)}
                                    </div>
                                    <div>
                                      <strong>Discount:</strong> ${details.discount.toFixed(2)}
                                    </div>
                                    <div>
                                      <strong>Transaction Fee:</strong> ${details.transaction_fee.toFixed(2)}
                                    </div>
                                    <div>
                                      <strong>Tip:</strong> ${details.tip.toFixed(2)}
                                    </div>
                                    {details.notes && (
                                      <div style={{ gridColumn: '1 / -1' }}>
                                        <strong>Notes:</strong> {details.notes}
                                      </div>
                                    )}
                                    <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
                                      <strong>Items Purchased:</strong>
                                      {details.items && details.items.length > 0 ? (
                                        <table style={{ width: '100%', marginTop: '8px', borderCollapse: 'collapse' }}>
                                          <thead>
                                            <tr style={{ backgroundColor: '#e9ecef' }}>
                                              <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 600 }}>Product</th>
                                              <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 600 }}>SKU</th>
                                              <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px', fontWeight: 600 }}>Quantity</th>
                                              <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px', fontWeight: 600 }}>Unit Price</th>
                                              <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px', fontWeight: 600 }}>Discount</th>
                                              <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px', fontWeight: 600 }}>Subtotal</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {details.items.map((item, itemIdx) => (
                                              <tr key={itemIdx} style={{ backgroundColor: itemIdx % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                                                <td style={{ padding: '8px', fontSize: '13px' }}>{item.product_name || 'N/A'}</td>
                                                <td style={{ padding: '8px', fontSize: '13px' }}>{item.sku || 'N/A'}</td>
                                                <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px' }}>{item.quantity || 0}</td>
                                                <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px' }}>${(item.unit_price || 0).toFixed(2)}</td>
                                                <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px' }}>${(item.discount || 0).toFixed(2)}</td>
                                                <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px' }}>${(item.subtotal || 0).toFixed(2)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      ) : (
                                        <div style={{ marginTop: '8px', color: '#999', fontSize: '13px' }}>No items found</div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                                    No details available
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
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

