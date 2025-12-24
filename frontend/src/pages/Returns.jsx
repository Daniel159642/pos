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
  }, [])

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

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 500 }}>Returns</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setView('create')}
            style={{
              padding: '8px 16px',
              backgroundColor: view === 'create' ? '#000' : '#f0f0f0',
              color: view === 'create' ? '#fff' : '#000',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Create Return
          </button>
          <button
            onClick={() => setView('pending')}
            style={{
              padding: '8px 16px',
              backgroundColor: view === 'pending' ? '#000' : '#f0f0f0',
              color: view === 'pending' ? '#fff' : '#000',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer'
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
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Enter order number"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchOrder()}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              />
              <button
                onClick={searchOrder}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {order && (
              <div style={{
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <h3 style={{ marginTop: 0 }}>Order: {order.order_number}</h3>
                <p>Date: {new Date(order.order_date).toLocaleDateString()}</p>
                <p>Total: ${parseFloat(order.total || 0).toFixed(2)}</p>
              </div>
            )}

            {orderItems.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3>Select Items to Return</h3>
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
                    <h3>Return Details</h3>
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
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Reason:</label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for return"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Notes:</label>
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
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <button
                    onClick={createReturn}
                    disabled={loading || Object.keys(selectedItems).length === 0}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: loading ? '#ccc' : '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      fontWeight: 500
                    }}
                  >
                    {loading ? 'Creating...' : 'Create Pending Return'}
                  </button>
                </div>
              </div>
            )}
          </div>
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
