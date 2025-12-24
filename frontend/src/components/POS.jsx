import { useState, useEffect } from 'react'
import { usePermissions, ProtectedComponent } from '../contexts/PermissionContext'
import BarcodeScanner from './BarcodeScanner'

function POS({ employeeId, employeeName }) {
  const { hasPermission } = usePermissions()
  const [cart, setCart] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [taxRate, setTaxRate] = useState(0.08) // Default 8% tax
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [amountPaid, setAmountPaid] = useState('')
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  
  // Check if user can process sales
  const canProcessSale = hasPermission('process_sale')
  const canApplyDiscount = hasPermission('apply_discount')
  const canVoidTransaction = hasPermission('void_transaction')

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

  const handleBarcodeScan = async (barcode) => {
    setLoading(true)
    setMessage(null)
    
    try {
      // First try to find product by barcode in local inventory
      const response = await fetch(`/api/inventory`)
      const data = await response.json()
      
      if (data.data) {
        // Try to find by barcode first
        let product = data.data.find(p => p.barcode === barcode)
        
        // If not found by barcode, try by SKU
        if (!product) {
          product = data.data.find(p => p.sku === barcode)
        }
        
        if (product) {
          addToCart(product)
          setMessage({ type: 'success', text: `Added ${product.product_name} to cart` })
          setShowBarcodeScanner(false)
          // Auto-dismiss message after 2 seconds
          setTimeout(() => setMessage(null), 2000)
          return
        }
      }
      
      // If not found locally, show error
      setMessage({ 
        type: 'error', 
        text: `Product with barcode "${barcode}" not found. Try taking a photo for image-based identification.` 
      })
      setTimeout(() => setMessage(null), 4000)
      
    } catch (err) {
      console.error('Barcode scan error:', err)
      setMessage({ type: 'error', text: 'Error looking up product. Please try again.' })
      setTimeout(() => setMessage(null), 4000)
    } finally {
      setLoading(false)
    }
  }

  const handleImageScan = async (imageFile) => {
    setLoading(true)
    setMessage(null)
    
    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('use_barcode', 'true')
      formData.append('use_image_matching', 'true')
      formData.append('top_k', '3')
      formData.append('threshold', '0.7')
      formData.append('identified_by', employeeName || 'unknown')
      formData.append('context', 'manual_lookup')
      
      const response = await fetch('/api/identify_product', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      
      if (data.success && data.matches && data.matches.length > 0) {
        const match = data.matches[0]
        // Get full product details
        const productResponse = await fetch(`/api/inventory`)
        const productData = await productResponse.json()
        
        if (productData.data) {
          const product = productData.data.find(p => p.product_id === match.product_id)
          if (product) {
            addToCart(product)
            setMessage({ 
              type: 'success', 
              text: `Added ${product.product_name} to cart (${(match.confidence * 100).toFixed(0)}% confidence)` 
            })
            setShowBarcodeScanner(false)
            setTimeout(() => setMessage(null), 3000)
            return
          }
        }
      }
      
      setMessage({ 
        type: 'error', 
        text: data.message || 'Product not identified. Please try again or search manually.' 
      })
      setTimeout(() => setMessage(null), 4000)
      
    } catch (err) {
      console.error('Image scan error:', err)
      setMessage({ type: 'error', text: 'Error identifying product. Please try again.' })
      setTimeout(() => setMessage(null), 4000)
    } finally {
      setLoading(false)
    }
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

  const calculateChange = () => {
    const paid = parseFloat(amountPaid) || 0
    const total = calculateTotal()
    return paid - total
  }

  const handleCalculatorInput = (value) => {
    if (value === 'clear') {
      setAmountPaid('')
    } else if (value === 'backspace') {
      setAmountPaid(prev => prev.slice(0, -1))
    } else if (value === 'exact') {
      setAmountPaid(calculateTotal().toFixed(2))
    } else {
      setAmountPaid(prev => prev + value)
    }
  }

  const processOrder = async () => {
    // Check permission
    if (!canProcessSale) {
      setMessage({ type: 'error', text: 'You do not have permission to process sales' })
      return
    }
    
    if (cart.length === 0) {
      setMessage({ type: 'error', text: 'Cart is empty' })
      return
    }

    if (paymentMethod === 'cash') {
      const paid = parseFloat(amountPaid) || 0
      const total = calculateTotal()
      if (paid < total) {
        setMessage({ type: 'error', text: 'Amount paid is insufficient' })
        return
      }
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
        setShowPaymentForm(false)
        setAmountPaid('')
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

          {/* Pay Button */}
          <ProtectedComponent permission="process_sale" fallback={
            <button
              disabled
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#ccc',
                color: '#666',
                border: 'none',
                borderRadius: '4px',
                fontSize: '18px',
                fontWeight: 600,
                cursor: 'not-allowed'
              }}
            >
              No Permission to Process Sales
            </button>
          }>
            <button
              onClick={() => setShowPaymentForm(true)}
              disabled={cart.length === 0}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: cart.length === 0 ? '#ccc' : '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '18px',
                fontWeight: 600,
                cursor: cart.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Pay
            </button>
          </ProtectedComponent>
        </div>
      </div>

      {/* Right Column - Product Search or Payment Form */}
      <div style={{
        flex: '1',
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {showPaymentForm ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0 }}>Payment</h2>
              <button
                onClick={() => {
                  setShowPaymentForm(false)
                  setAmountPaid('')
                }}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '24px',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  lineHeight: '1'
                }}
              >
                ×
              </button>
            </div>

            {/* Payment Method */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setPaymentMethod('cash')
                    setAmountPaid('')
                  }}
                  style={{
                    flex: 1,
                    padding: '16px',
                    border: paymentMethod === 'cash' ? '3px solid #000' : '2px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    fontWeight: 600,
                    backgroundColor: paymentMethod === 'cash' ? '#000' : '#fff',
                    color: paymentMethod === 'cash' ? '#fff' : '#000',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Cash
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod('credit_card')
                    setAmountPaid('')
                  }}
                  style={{
                    flex: 1,
                    padding: '16px',
                    border: paymentMethod === 'credit_card' ? '3px solid #000' : '2px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    fontWeight: 600,
                    backgroundColor: paymentMethod === 'credit_card' ? '#000' : '#fff',
                    color: paymentMethod === 'credit_card' ? '#fff' : '#000',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Card
                </button>
              </div>
            </div>

            {/* Calculator */}
            <div style={{ marginBottom: '20px' }}>
                {/* Amount Display */}
                <div style={{
                  width: '100%',
                  padding: '16px',
                  border: amountPaid && parseFloat(amountPaid) > 0 && paymentMethod === 'cash'
                    ? `2px solid ${calculateChange() >= 0 ? '#4caf50' : '#f44336'}` 
                    : '2px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '24px',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  marginBottom: '12px',
                  backgroundColor: amountPaid && parseFloat(amountPaid) > 0 && paymentMethod === 'cash'
                    ? (calculateChange() >= 0 ? '#e8f5e9' : '#ffebee')
                    : '#f9f9f9',
                  minHeight: '60px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box'
                }}>
                  {amountPaid && parseFloat(amountPaid) > 0 && paymentMethod === 'cash' && (
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: calculateChange() >= 0 ? '#2e7d32' : '#d32f2f'
                    }}>
                      {calculateChange() >= 0 ? `Change: $${calculateChange().toFixed(2)}` : 'Insufficient'}
                    </div>
                  )}
                  <div style={{ fontSize: '24px', color: '#000' }}>
                    {amountPaid ? `$${parseFloat(amountPaid || 0).toFixed(2)}` : '$0.00'}
                  </div>
                </div>

                {/* Calculator Keypad */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px'
                }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, '00'].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleCalculatorInput(num.toString())}
                      style={{
                        padding: '16px',
                        border: '2px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '18px',
                        fontWeight: 600,
                        backgroundColor: '#fff',
                        color: '#000',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                {/* Calculator Action Buttons */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  marginTop: '8px'
                }}>
                  <button
                    onClick={() => handleCalculatorInput('exact')}
                    style={{
                      padding: '12px',
                      border: '2px solid #4caf50',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: 600,
                      backgroundColor: '#fff',
                      color: '#4caf50',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8f5e9'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    Exact
                  </button>
                  <button
                    onClick={() => handleCalculatorInput('backspace')}
                    style={{
                      padding: '12px',
                      border: '2px solid #ff9800',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: 600,
                      backgroundColor: '#fff',
                      color: '#ff9800',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff3e0'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    ⌫
                  </button>
                  <button
                    onClick={() => handleCalculatorInput('clear')}
                    style={{
                      padding: '12px',
                      border: '2px solid #f44336',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: 600,
                      backgroundColor: '#fff',
                      color: '#f44336',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ffebee'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    Clear
                  </button>
                </div>
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
              {processing ? 'Processing...' : 'Complete Payment'}
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0 }}>Search Products</h2>
              <button
                onClick={() => setShowBarcodeScanner(true)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>📷</span>
                <span>Scan Barcode</span>
              </button>
            </div>
            
            {/* Search Bar */}
            <input
              type="text"
              placeholder="Search by name, SKU, or scan barcode..."
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
          </>
        )}
      </div>

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onImageScan={handleImageScan}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {/* Message Display */}
      {message && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '16px 24px',
            backgroundColor: message.type === 'success' ? '#4caf50' : '#f44336',
            color: '#fff',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 2000,
            maxWidth: '400px',
            animation: 'slideIn 0.3s ease-out'
          }}
          onClick={() => setMessage(null)}
        >
          {message.text}
        </div>
      )}
    </div>
  )
}

export default POS


