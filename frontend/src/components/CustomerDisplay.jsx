import { useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useTheme } from '../contexts/ThemeContext'
import './CustomerDisplay.css'

function CustomerDisplay() {
  const { themeColor, themeMode } = useTheme()
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  // Create gradient from theme color
  const getGradientBackground = useCallback(() => {
    const rgb = themeColorRgb.split(', ')
    // Create a darker shade for gradient end
    const darkerR = Math.max(0, parseInt(rgb[0]) - 30)
    const darkerG = Math.max(0, parseInt(rgb[1]) - 30)
    const darkerB = Math.max(0, parseInt(rgb[2]) - 30)
    return `linear-gradient(135deg, ${themeColor} 0%, rgb(${darkerR}, ${darkerG}, ${darkerB}) 100%)`
  }, [themeColor, themeColorRgb])
  
  const [currentScreen, setCurrentScreen] = useState('idle') // idle, transaction, payment, tip, card, receipt, success
  const [transaction, setTransaction] = useState(null)
  const [items, setItems] = useState([])
  const [subtotal, setSubtotal] = useState(0)
  const [tax, setTax] = useState(0)
  const [total, setTotal] = useState(0)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null)
  const [selectedTip, setSelectedTip] = useState(0)
  const [tipSuggestions, setTipSuggestions] = useState([15, 18, 20, 25])
  const [tipEnabled, setTipEnabled] = useState(false)
  const [amountDue, setAmountDue] = useState(0)
  const [cardStatus, setCardStatus] = useState('waiting')
  const [receiptType, setReceiptType] = useState(null)
  const [receiptContact, setReceiptContact] = useState('')
  const [socket, setSocket] = useState(null)
  
  // Update CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement
    const gradient = getGradientBackground()
    root.style.setProperty('--customer-display-theme-color', themeColor)
    root.style.setProperty('--customer-display-theme-color-rgb', themeColorRgb)
    root.style.setProperty('--customer-display-gradient', gradient)
  }, [themeColor, themeColorRgb, getGradientBackground])

  // Initialize Socket.IO connection
  useEffect(() => {
    // Use relative URL - Vite proxy will handle routing to backend
    const newSocket = io({
      transports: ['websocket', 'polling'],
      path: '/socket.io/'
    })
    
    newSocket.on('connect', () => {
      console.log('Connected to Socket.IO server')
      newSocket.emit('join', { room: 'customer_display' })
    })
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server')
    })
    
    newSocket.on('transaction_started', (data) => {
      console.log('Transaction started:', data)
      setTransaction(data)
      setItems(data.items || [])
      setSubtotal(data.subtotal || 0)
      setTax(data.tax || 0)
      setTotal(data.total || 0)
      setCurrentScreen('transaction')
    })
    
    newSocket.on('payment_processed', (data) => {
      console.log('Payment processed:', data)
      if (data.success) {
        setCardStatus('approved')
        setTimeout(() => {
          setCurrentScreen('receipt')
        }, 2000)
      }
    })
    
    newSocket.on('payment_success', (data) => {
      console.log('Payment success:', data)
      setCurrentScreen('receipt')
    })
    
    newSocket.on('payment_error', (data) => {
      console.log('Payment error:', data)
      setCardStatus('declined')
    })
    
    setSocket(newSocket)
    
    return () => {
      newSocket.close()
    }
  }, [])

  useEffect(() => {
    loadDisplaySettings()
    loadPaymentMethods()
  }, [])

  const loadDisplaySettings = async () => {
    try {
      const response = await fetch('/api/customer-display/settings')
      const result = await response.json()
      if (result.success) {
        setTipEnabled(result.data.tip_enabled || false)
        setTipSuggestions(result.data.tip_suggestions || [15, 18, 20, 25])
      }
    } catch (err) {
      console.error('Error loading display settings:', err)
    }
  }

  const loadPaymentMethods = async () => {
    try {
      const response = await fetch('/api/payment-methods')
      const result = await response.json()
      if (result.success) {
        setPaymentMethods(result.data)
      }
    } catch (err) {
      console.error('Error loading payment methods:', err)
    }
  }

  const loadTransaction = async (transactionId) => {
    try {
      const response = await fetch(`/api/transaction/${transactionId}`)
      const result = await response.json()
      if (result.success) {
        const txn = result.data.transaction
        const txnItems = result.data.items
        
        setTransaction(txn)
        setItems(txnItems)
        setSubtotal(parseFloat(txn.subtotal))
        setTax(parseFloat(txn.tax))
        setTotal(parseFloat(txn.total))
        setCurrentScreen('transaction')
      }
    } catch (err) {
      console.error('Error loading transaction:', err)
    }
  }

  const showPaymentScreen = () => {
    setAmountDue(total + selectedTip)
    if (tipEnabled && selectedTip === 0) {
      setCurrentScreen('tip')
    } else {
      setCurrentScreen('payment')
    }
  }

  const selectTip = (percent) => {
    const tipAmount = (total * percent / 100).toFixed(2)
    setSelectedTip(parseFloat(tipAmount))
    setCurrentScreen('payment')
    setAmountDue(total + parseFloat(tipAmount))
  }

  const skipTip = () => {
    setSelectedTip(0)
    setCurrentScreen('payment')
    setAmountDue(total)
  }

  const selectPaymentMethod = (method) => {
    setSelectedPaymentMethod(method)
    
    if (method.requires_terminal || method.method_type === 'card') {
      setCurrentScreen('card')
      setCardStatus('waiting')
      // Simulate card processing
      setTimeout(() => {
        setCardStatus('reading')
        setTimeout(() => {
          setCardStatus('processing')
          setTimeout(() => {
            setCardStatus('approved')
            setTimeout(() => {
              setCurrentScreen('receipt')
            }, 2000)
          }, 2000)
        }, 2000)
      }, 1000)
    } else if (method.method_type === 'cash') {
      // Cash - cashier handles this
      setCurrentScreen('card')
      setCardStatus('waiting')
    }
  }

  const selectReceipt = (type) => {
    setReceiptType(type)
    if (type === 'email' || type === 'sms') {
      // Show input field (handled in render)
    } else {
      submitReceiptPreference(type)
    }
  }

  const submitReceiptPreference = async (type = receiptType, contact = receiptContact) => {
    if (!transaction) return

    try {
      await fetch('/api/receipt/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transaction.transaction_id,
          receipt_type: type,
          email: type === 'email' ? contact : null,
          phone: type === 'sms' ? contact : null
        })
      })

      showSuccessScreen()
    } catch (err) {
      console.error('Error saving receipt preference:', err)
      showSuccessScreen()
    }
  }

  const showSuccessScreen = () => {
    setCurrentScreen('success')
    setTimeout(() => {
      returnToIdle()
    }, 5000)
  }

  const returnToIdle = () => {
    setCurrentScreen('idle')
    setTransaction(null)
    setItems([])
    setSubtotal(0)
    setTax(0)
    setTotal(0)
    setSelectedPaymentMethod(null)
    setSelectedTip(0)
    setAmountDue(0)
    setCardStatus('waiting')
    setReceiptType(null)
    setReceiptContact('')
    sessionStorage.removeItem('activeTransaction')
  }

  const paymentMethodIcons = {
    'card': '💳',
    'cash': '💵',
    'mobile_wallet': '📱',
    'gift_card': '🎁',
    'store_credit': '💰',
    'check': '📝'
  }

  return (
    <div className="customer-display-container" style={{ background: getGradientBackground() }}>
      {/* Idle Screen */}
      {currentScreen === 'idle' && (
        <div className="idle-screen">
          <div className="idle-content">
            <h1>Welcome to Our Store!</h1>
            <p>Your cashier will be with you shortly</p>
          </div>
        </div>
      )}

      {/* Transaction Screen */}
      {currentScreen === 'transaction' && (
        <div className="transaction-screen">
          <div className="screen-header">
            <h2>Your Items</h2>
          </div>
          
          <div className="items-list">
            {items.map((item, idx) => (
              <div key={idx} className="item-row">
                <span className="item-name">{item.product_name}</span>
                <span className="item-quantity">× {item.quantity}</span>
                <span className="item-price">${(item.unit_price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          
          <div className="totals-section">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="total-row">
              <span>Tax:</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="total-row final">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <button className="btn-primary" onClick={showPaymentScreen}>
            Proceed to Payment
          </button>
        </div>
      )}

      {/* Tip Screen */}
      {currentScreen === 'tip' && (
        <div className="payment-screen">
          <div className="screen-header">
            <h2>Add a tip?</h2>
          </div>
          
          <div className="tip-options">
            {tipSuggestions.map((percent) => {
              const tipAmount = (total * percent / 100).toFixed(2)
              return (
                <div
                  key={percent}
                  className="tip-option"
                  onClick={() => selectTip(percent)}
                >
                  <div className="tip-percentage">{percent}%</div>
                  <div className="tip-amount">${tipAmount}</div>
                </div>
              )
            })}
            <div className="tip-option" onClick={skipTip}>
              <div className="tip-percentage">No Tip</div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Method Selection */}
      {currentScreen === 'payment' && (
        <div className="payment-screen">
          <div className="screen-header">
            <h2>How would you like to pay?</h2>
            <div className="amount-due">${amountDue.toFixed(2)}</div>
          </div>
          
          <div className="payment-methods">
            {paymentMethods.map((method) => (
              <div
                key={method.payment_method_id}
                className={`payment-method ${selectedPaymentMethod?.payment_method_id === method.payment_method_id ? 'selected' : ''}`}
                onClick={() => selectPaymentMethod(method)}
              >
                <div className="payment-method-icon">
                  {paymentMethodIcons[method.method_type] || '💳'}
                </div>
                <div className="payment-method-name">{method.method_name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card Processing Screen */}
      {currentScreen === 'card' && (
        <div className="card-processing-screen">
          <div className="card-animation">💳</div>
          <div className="card-instruction">
            {selectedPaymentMethod?.method_type === 'cash' 
              ? 'Please give cash to cashier'
              : 'Please insert, tap, or swipe your card'}
          </div>
          <div className="card-status">
            {cardStatus === 'waiting' && 'Waiting for card...'}
            {cardStatus === 'reading' && 'Reading card...'}
            {cardStatus === 'processing' && 'Processing payment...'}
            {cardStatus === 'approved' && 'Payment approved!'}
            {cardStatus === 'declined' && 'Payment declined. Please try again.'}
          </div>
        </div>
      )}

      {/* Receipt Screen */}
      {currentScreen === 'receipt' && (
        <div className="receipt-screen">
          <div className="screen-header">
            <h2>Would you like a receipt?</h2>
          </div>
          
          <div className="receipt-options">
            <div className="receipt-option" onClick={() => selectReceipt('printed')}>
              <div className="receipt-icon">🖨️</div>
              <div className="receipt-label">Print Receipt</div>
            </div>
            
            <div className="receipt-option" onClick={() => selectReceipt('email')}>
              <div className="receipt-icon">📧</div>
              <div className="receipt-label">Email Receipt</div>
            </div>
            
            <div className="receipt-option" onClick={() => selectReceipt('sms')}>
              <div className="receipt-icon">📱</div>
              <div className="receipt-label">Text Receipt</div>
            </div>
            
            <div className="receipt-option" onClick={() => selectReceipt('none')}>
              <div className="receipt-icon">🚫</div>
              <div className="receipt-label">No Receipt</div>
            </div>
          </div>
          
          {(receiptType === 'email' || receiptType === 'sms') && (
            <div className="receipt-input">
              <input
                type={receiptType === 'email' ? 'email' : 'tel'}
                placeholder={receiptType === 'email' ? 'Enter your email' : 'Enter your phone number'}
                value={receiptContact}
                onChange={(e) => setReceiptContact(e.target.value)}
              />
              <button className="btn-primary" onClick={() => submitReceiptPreference()}>
                Submit
              </button>
            </div>
          )}
        </div>
      )}

      {/* Success Screen */}
      {currentScreen === 'success' && (
        <div className="success-screen">
          <div className="success-icon">✓</div>
          <div className="success-message">Payment Successful!</div>
          <div className="success-details">Thank you for your purchase</div>
        </div>
      )}
    </div>
  )
}

export default CustomerDisplay

