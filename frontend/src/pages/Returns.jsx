import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Table from '../components/Table'

function Returns() {
  const [searchParams] = useSearchParams()
  const [view, setView] = useState('create') // 'create' or 'pending'
  const [orderNumber, setOrderNumber] = useState('')
  const [order, setOrder] = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [selectedItems, setSelectedItems] = useState({})
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pendingReturns, setPendingReturns] = useState(null)
  const [employeeId, setEmployeeId] = useState(null)
  const [ordersData, setOrdersData] = useState(null)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  const [orderDetails, setOrderDetails] = useState({})
  const [loadingDetails, setLoadingDetails] = useState({})

  useEffect(() => {
    const token = localStorage.getItem('sessionToken')
    if (token) {
      fetch('/api/verify_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: token })
      })
        .then(res => res.json())
        .then(data => {
          if (data.valid) {
            setEmployeeId(data.employee_id)
          }
        })
    }
    loadOrders()
  }, [])

  const loadOrders = async () => {
    setOrdersLoading(true)
    try {
      const response = await fetch('/api/orders')
      const result = await response.json()
      // Show only recent orders (last 50)
      if (result.data) {
        result.data = result.data.slice(0, 50)
      }
      setOrdersData(result)
    } catch (err) {
      console.error('Error loading orders:', err)
    } finally {
      setOrdersLoading(false)
    }
  }

  const fetchOrderById = async (orderId) => {
    setLoading(true)
    setError('')
    setOrder(null)
    setOrderItems([])
    setSelectedItems({})

    try {
      // Fetch order details
      const response = await fetch(`/api/orders`)
      const result = await response.json()
      
      const foundOrder = result.data?.find(o => o.order_id === parseInt(orderId))

      if (!foundOrder) {
        setError('Order not found')
        return
      }

      setOrder(foundOrder)
      setOrderNumber(foundOrder.order_number || '')

      // Get order items
      const itemsResponse = await fetch('/api/order_items')
      const itemsResult = await itemsResponse.json()
      const items = itemsResult.data?.filter(item => item.order_id === parseInt(orderId)) || []
      setOrderItems(items)
    } catch (err) {
      setError('Error loading order')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Check if order number is in URL params
    const urlOrderNumber = searchParams.get('orderNumber')
    const urlOrderId = searchParams.get('orderId')
    
    if (urlOrderNumber || urlOrderId) {
      if (urlOrderNumber) {
        setOrderNumber(urlOrderNumber)
      }
      setView('create')
      // Auto-search for the order
      if (urlOrderId) {
        // If we have order ID, fetch directly
        fetchOrderById(urlOrderId)
      } else if (urlOrderNumber) {
        // Otherwise search by order number
        setTimeout(() => {
          searchOrder()
        }, 100)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const loadPendingReturns = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/pending_returns?status=pending')
      const result = await response.json()
      setPendingReturns(result)
    } catch (err) {
      setError('Error loading pending returns')
    } finally {
      setLoading(false)
    }
  }

  const searchOrder = async () => {
    if (!orderNumber.trim()) {
      setError('Please enter an order number')
      return
    }

    setLoading(true)
    setError('')
    setOrder(null)
    setOrderItems([])
    setSelectedItems({})

    try {
      const response = await fetch('/api/orders')
      const result = await response.json()
      
      const foundOrder = result.data?.find(o => 
        o.order_number?.toLowerCase().includes(orderNumber.toLowerCase())
      )

      if (!foundOrder) {
        setError('Order not found')
        return
      }

      setOrder(foundOrder)

      // Get order items
      const itemsResponse = await fetch('/api/order_items')
      const itemsResult = await itemsResponse.json()
      const items = itemsResult.data?.filter(item => item.order_id === foundOrder.order_id) || []
      setOrderItems(items)
    } catch (err) {
      setError('Error searching for order')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleItem = (itemId, maxQuantity) => {
    setSelectedItems(prev => {
      const newItems = { ...prev }
      if (newItems[itemId]) {
        delete newItems[itemId]
      } else {
        newItems[itemId] = { quantity: 1, condition: 'new', maxQuantity }
      }
      return newItems
    })
  }

  const updateItemQuantity = (itemId, quantity, maxQuantity) => {
    if (quantity < 1) quantity = 1
    if (quantity > maxQuantity) quantity = maxQuantity
    
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], quantity }
    }))
  }

  const updateItemCondition = (itemId, condition) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], condition }
    }))
  }

  const createReturn = async () => {
    if (Object.keys(selectedItems).length === 0) {
      setError('Please select at least one item to return')
      return
    }

    if (!employeeId) {
      setError('Employee ID not found. Please log in again.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const itemsToReturn = Object.entries(selectedItems).map(([orderItemId, data]) => ({
      order_item_id: parseInt(orderItemId),
      quantity: data.quantity,
      condition: data.condition,
      notes: ''
    }))

    try {
      const response = await fetch('/api/create_return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.order_id,
          items: itemsToReturn,
          employee_id: employeeId,
          customer_id: order.customer_id,
          reason: reason,
          notes: notes
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(`Return created successfully! Return #: ${result.return_number}`)
        setOrder(null)
        setOrderItems([])
        setSelectedItems({})
        setOrderNumber('')
        setReason('')
        setNotes('')
        setTimeout(() => setSuccess(''), 5000)
      } else {
        setError(result.message || 'Failed to create return')
      }
    } catch (err) {
      setError('Error creating return')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const approveReturn = async (returnId) => {
    if (!employeeId) {
      setError('Employee ID not found')
      return
    }

    if (!confirm('Approve this return? Items will be returned to inventory.')) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/approve_return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          return_id: returnId,
          approved_by: employeeId
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess('Return approved successfully')
        loadPendingReturns()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(result.message || 'Failed to approve return')
      }
    } catch (err) {
      setError('Error approving return')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const rejectReturn = async (returnId) => {
    if (!employeeId) {
      setError('Employee ID not found')
      return
    }

    const reason = prompt('Enter rejection reason:')
    if (!reason) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/reject_return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          return_id: returnId,
          rejected_by: employeeId,
          reason: reason
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess('Return rejected')
        loadPendingReturns()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(result.message || 'Failed to reject return')
      }
    } catch (err) {
      setError('Error rejecting return')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Fields to hide from main table (shown in dropdown)
  const hiddenFields = ['order_id', 'orderId', 'employee_id', 'employeeId', 'customer_id', 'customerId', 'subtotal', 'tax_rate', 'tax_amount', 'tax', 'discount', 'transaction_fee', 'notes', 'tip']
  
  // Filter out hidden fields from columns
  const visibleColumns = ordersData && ordersData.columns ? ordersData.columns.filter(col => !hiddenFields.includes(col)) : []
  const columnsWithActions = [...visibleColumns, 'Actions']

  // Filter data based on search query
  const processedOrders = ordersData && ordersData.data ? ordersData.data.map(row => ({
    ...row,
    _actions: row
  })) : []

  const filteredOrders = searchQuery ? processedOrders.filter(row => {
    const query = searchQuery.toLowerCase()
    return Object.values(row).some(value => {
      if (value === null || value === undefined) return false
      return String(value).toLowerCase().includes(query)
    })
  }) : processedOrders

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

  const handleOrderClick = async (row) => {
    const orderId = row.order_id || row.orderId
    if (!orderId) return
    fetchOrderById(orderId)
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setView('create')}
            style={{
              padding: '10px 16px',
              backgroundColor: view === 'create' ? 'rgba(128, 0, 128, 0.7)' : 'rgba(128, 0, 128, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: view === 'create' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(128, 0, 128, 0.3)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: view === 'create' ? 600 : 500,
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: view === 'create' ? '0 4px 15px rgba(128, 0, 128, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : '0 2px 8px rgba(128, 0, 128, 0.1)'
            }}
          >
            Create Return
          </button>
          <button
            onClick={() => setView('pending')}
            style={{
              padding: '10px 16px',
              backgroundColor: view === 'pending' ? 'rgba(128, 0, 128, 0.7)' : 'rgba(128, 0, 128, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: view === 'pending' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(128, 0, 128, 0.3)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: view === 'pending' ? 600 : 500,
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: view === 'pending' ? '0 4px 15px rgba(128, 0, 128, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : '0 2px 8px rgba(128, 0, 128, 0.1)'
            }}
          >
            Pending Returns
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          backgroundColor: '#ffebee',
          color: '#d32f2f',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          backgroundColor: '#e8f5e9',
          color: '#2e7d32',
          borderRadius: '4px'
        }}>
          {success}
        </div>
      )}

      {view === 'create' ? (
        <div>
          {/* Search Bar */}
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

          {/* Orders Table */}
          {ordersLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading...</div>
          ) : ordersData && filteredOrders.length > 0 ? (
            <div style={{ 
              backgroundColor: '#fff', 
              borderRadius: '4px', 
              overflowX: 'auto',
              overflowY: 'visible',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              width: '100%',
              marginBottom: '30px'
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
                  {filteredOrders.map((row, idx) => {
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
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOrderClick(row)
                              }}
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
                              Select
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
          )}

          {/* Return Form Modal */}
          {order && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                padding: '30px',
                maxWidth: '800px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '24px'
                }}>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600, fontFamily: '"Product Sans", sans-serif' }}>
                    Create Return - Order: {order.order_number}
                  </h2>
                  <button
                    onClick={() => {
                      setOrder(null)
                      setOrderItems([])
                      setSelectedItems({})
                      setReason('')
                      setNotes('')
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      color: '#666',
                      padding: '0',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '15px',
                  marginBottom: '20px'
                }}>
                  <p style={{ margin: '4px 0' }}>Date: {new Date(order.order_date).toLocaleDateString()}</p>
                  <p style={{ margin: '4px 0' }}>Total: ${parseFloat(order.total || 0).toFixed(2)}</p>
                </div>

                {orderItems.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ marginBottom: '12px', fontFamily: '"Product Sans", sans-serif' }}>Select Items to Return</h3>
                    <div style={{
                      backgroundColor: '#fff',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      overflowX: 'auto',
                      overflowY: 'visible',
                      width: '100%'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5' }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Product</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Quantity</th>
                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>Price</th>
                            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Return</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map(item => (
                            <tr key={item.order_item_id}>
                              <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                                {item.product_name || item.sku}
                              </td>
                              <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
                                {item.quantity}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #eee' }}>
                                ${parseFloat(item.unit_price || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #eee' }}>
                                <input
                                  type="checkbox"
                                  checked={!!selectedItems[item.order_item_id]}
                                  onChange={() => toggleItem(item.order_item_id, item.quantity)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {Object.keys(selectedItems).length > 0 && (
                      <div style={{
                        backgroundColor: '#fff',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        padding: '20px',
                        marginTop: '20px'
                      }}>
                        <h3 style={{ fontFamily: '"Product Sans", sans-serif' }}>Return Details</h3>
                        {Object.entries(selectedItems).map(([itemId, data]) => {
                          const item = orderItems.find(i => i.order_item_id === parseInt(itemId))
                          return (
                            <div key={itemId} style={{
                              padding: '15px',
                              border: '1px solid #eee',
                              borderRadius: '4px',
                              marginBottom: '10px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <strong>{item?.product_name || item?.sku}</strong>
                                <span>${(item?.unit_price * data.quantity).toFixed(2)}</span>
                              </div>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <label>Quantity:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={data.maxQuantity}
                                  value={data.quantity}
                                  onChange={(e) => updateItemQuantity(itemId, parseInt(e.target.value), data.maxQuantity)}
                                  style={{
                                    width: '80px',
                                    padding: '6px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                  }}
                                />
                                <label style={{ marginLeft: '20px' }}>Condition:</label>
                                <select
                                  value={data.condition}
                                  onChange={(e) => updateItemCondition(itemId, e.target.value)}
                                  style={{
                                    padding: '6px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                  }}
                                >
                                  <option value="new">New</option>
                                  <option value="opened">Opened</option>
                                  <option value="damaged">Damaged</option>
                                  <option value="defective">Defective</option>
                                </select>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div style={{ marginTop: '20px' }}>
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500, fontFamily: '"Product Sans", sans-serif' }}>Reason:</label>
                        <input
                          type="text"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Reason for return"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontFamily: '"Product Sans", sans-serif'
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500, fontFamily: '"Product Sans", sans-serif' }}>Notes:</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Additional notes"
                          rows="3"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontFamily: '"Product Sans", sans-serif'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            setOrder(null)
                            setOrderItems([])
                            setSelectedItems({})
                            setReason('')
                            setNotes('')
                          }}
                          disabled={loading}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: '#f0f0f0',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 500,
                            fontFamily: '"Product Sans", sans-serif'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={createReturn}
                          disabled={loading || Object.keys(selectedItems).length === 0}
                          style={{
                            padding: '10px 20px',
                            backgroundColor: loading || Object.keys(selectedItems).length === 0 ? '#ccc' : 'rgba(128, 0, 128, 0.7)',
                            backdropFilter: loading || Object.keys(selectedItems).length === 0 ? 'none' : 'blur(10px)',
                            WebkitBackdropFilter: loading || Object.keys(selectedItems).length === 0 ? 'none' : 'blur(10px)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: loading || Object.keys(selectedItems).length === 0 ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 600,
                            fontFamily: '"Product Sans", sans-serif',
                            boxShadow: loading || Object.keys(selectedItems).length === 0 ? 'none' : '0 4px 15px rgba(128, 0, 128, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          {loading ? 'Creating...' : 'Create Pending Return'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading...</div>}
          {pendingReturns && pendingReturns.data && pendingReturns.data.length > 0 ? (
            <div>
              <Table columns={pendingReturns.columns} data={pendingReturns.data} />
              <div style={{ marginTop: '20px' }}>
                <h3>Actions</h3>
                <p style={{ color: '#666' }}>Click on a return to approve or reject it. This will be implemented in the table view.</p>
              </div>
            </div>
          ) : (
            !loading && <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No pending returns</div>
          )}
        </div>
      )}
    </div>
  )
}

export default Returns
