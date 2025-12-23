import { useState, useEffect } from 'react'

function POS({ employeeId, employeeName }) {
  const [cart, setCart] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [taxRate, setTaxRate] = useState(0.08) // Default 8% tax
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState(null)

  // Search products
  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchProducts(searchTerm)
    } else {
      setSearchResults([])
    }
  }, [searchTerm])

  const searchProducts = async (term) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/inventory`)
      const data = await response.json()
      
      if (data.data) {
        const filtered = data.data.filter(product => 
          product.product_name?.toLowerCase().includes(term.toLowerCase()) ||
          product.sku?.toLowerCase().includes(term.toLowerCase())
        )
        setSearchResults(filtered.slice(0, 10)) // Limit to 10 results
      }
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.product_id === product.product_id)
    
    if (existingItem) {
      // Increase quantity
      setCart(cart.map(item =>
        item.product_id === product.product_id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      // Add new item
      setCart([...cart, {
        product_id: product.product_id,
        product_name: product.product_name,
        sku: product.sku,
        unit_price: product.product_price,
        quantity: 1,
        available_quantity: product.current_quantity || 0
      }])
    }
    setSearchTerm('')
    setSearchResults([])
  }

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }
    
    setCart(cart.map(item =>
      item.product_id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ))
  }

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId))
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
  }

  const calculateTax = () => {
    return calculateSubtotal() * taxRate
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax()
  }

  const processOrder = async () => {
    if (cart.length === 0) {
      setMessage({ type: 'error', text: 'Cart is empty' })
      return
    }

    setProcessing(true)
    setMessage(null)

    try {
      const items = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: 0
      }))

      const response = await fetch('/api/create_order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          items: items,
          payment_method: paymentMethod,
          tax_rate: taxRate
        })
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: `Order ${result.order_number} processed successfully!` })
        setCart([])
        setSearchTerm('')
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to process order' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error processing order. Please try again.' })
      console.error('Order error:', err)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{ 
      display: 'flex', 
      height: 'calc(100vh - 100px)',
      gap: '20px',
      padding: '20px',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Left Column - Cart */}
      <div style={{
        flex: '1',
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Current Order</h2>
        
        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
          {cart.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: '#999', 
              padding: '40px',
              fontSize: '16px'
            }}>
              No items in cart
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee' }}>
                  <th style={{ textAlign: 'left', padding: '10px', fontSize: '14px', color: '#666' }}>Item</th>
                  <th style={{ textAlign: 'right', padding: '10px', fontSize: '14px', color: '#666' }}>Price</th>
                  <th style={{ textAlign: 'center', padding: '10px', fontSize: '14px', color: '#666' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '10px', fontSize: '14px', color: '#666' }}>Total</th>
                  <th style={{ padding: '10px', width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, idx) => (
                  <tr key={item.product_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 500 }}>{item.product_name}</div>
                      <div style={{ fontSize: '12px', color: '#999' }}>{item.sku}</div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px', fontFamily: 'monospace' }}>
                      ${item.unit_price.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          style={{
                            width: '28px',
                            height: '28px',
                            border: '1px solid #ddd',
                            backgroundColor: '#fff',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '18px',
                            lineHeight: '1'
                          }}
                        >-</button>
                        <span style={{ minWidth: '30px', textAlign: 'center', fontWeight: 500 }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          disabled={item.quantity >= item.available_quantity}
                          style={{
                            width: '28px',
                            height: '28px',
                            border: '1px solid #ddd',
                            backgroundColor: '#fff',
                            borderRadius: '4px',
                            cursor: item.quantity >= item.available_quantity ? 'not-allowed' : 'pointer',
                            fontSize: '18px',
                            lineHeight: '1',
                            opacity: item.quantity >= item.available_quantity ? 0.5 : 1
                          }}
                        >+</button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px', fontFamily: 'monospace', fontWeight: 500 }}>
                      ${(item.unit_price * item.quantity).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        style={{
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: '#d32f2f',
                          cursor: 'pointer',
                          fontSize: '18px',
                          padding: '0',
                          width: '24px',
                          height: '24px'
                        }}
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Order Summary */}
        <div style={{
          borderTop: '2px solid #eee',
          paddingTop: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#666' }}>Subtotal:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
              ${calculateSubtotal().toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#666' }}>Tax ({(taxRate * 100).toFixed(1)}%):</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
              ${calculateTax().toFixed(2)}
            </span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '24px',
            fontWeight: 600,
            paddingTop: '12px',
            borderTop: '2px solid #000',
            marginTop: '12px'
          }}>
            <span>Total:</span>
            <span style={{ fontFamily: 'monospace' }}>
              ${calculateTotal().toFixed(2)}
            </span>
          </div>

          {/* Payment Method */}
          <div style={{ marginTop: '20px', marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              Payment Method:
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            >
              <option value="cash">Cash</option>
              <option value="credit_card">Credit Card</option>
              <option value="debit_card">Debit Card</option>
              <option value="mobile_payment">Mobile Payment</option>
            </select>
          </div>

          {/* Tax Rate */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              Tax Rate (%):
            </label>
            <input
              type="number"
              value={taxRate * 100}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) / 100 || 0)}
              min="0"
              max="100"
              step="0.1"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px'
              }}
            />
          </div>

          {/* Message */}
          {message && (
            <div style={{
              padding: '12px',
              marginBottom: '12px',
              borderRadius: '4px',
              backgroundColor: message.type === 'success' ? '#e8f5e9' : '#ffebee',
              color: message.type === 'success' ? '#2e7d32' : '#d32f2f',
              fontSize: '14px'
            }}>
              {message.text}
            </div>
          )}

          {/* Process Order Button */}
          <button
            onClick={processOrder}
            disabled={processing || cart.length === 0}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: processing || cart.length === 0 ? '#ccc' : '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '18px',
              fontWeight: 600,
              cursor: processing || cart.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {processing ? 'Processing...' : 'Process Order'}
          </button>
        </div>
      </div>

      {/* Right Column - Product Search */}
      <div style={{
        flex: '1',
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Search Products</h2>
        
        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            border: '2px solid #ddd',
            borderRadius: '4px',
            fontSize: '16px',
            marginBottom: '20px',
            boxSizing: 'border-box'
          }}
          autoFocus
        />

        {/* Search Results */}
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              Searching...
            </div>
          ) : searchResults.length === 0 && searchTerm.length >= 2 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              No products found
            </div>
          ) : searchTerm.length < 2 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              Type at least 2 characters to search
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {searchResults.map(product => (
                <div
                  key={product.product_id}
                  onClick={() => addToCart(product)}
                  style={{
                    padding: '16px',
                    border: '1px solid #eee',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: (product.current_quantity || 0) > 0 ? '#fff' : '#ffebee'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = (product.current_quantity || 0) > 0 ? '#fff' : '#ffebee'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: '16px', marginBottom: '4px' }}>
                        {product.product_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
                        SKU: {product.sku}
                      </div>
                      <div style={{ fontSize: '12px', color: (product.current_quantity || 0) > 0 ? '#2e7d32' : '#d32f2f' }}>
                        Stock: {product.current_quantity || 0}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      color: '#000'
                    }}>
                      ${(product.product_price || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default POS

