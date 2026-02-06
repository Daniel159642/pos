import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { useTheme } from '../contexts/ThemeContext'
import { mergeCheckoutUiFromApi } from '../utils/checkoutUi'
import './CustomerDisplay.css'
import './CustomerDisplayButtons.css'

function CustomerDisplayPopup({ cart, subtotal, tax, discount = 0, transactionFee = 0, total, tip: propTip, paymentMethod, amountPaid, onClose, onPaymentMethodSelect, onTipSelect, onReceiptSelect, onProceedToPayment, showSummary, employeeId, paymentCompleted, transactionId: propTransactionId, orderId: propOrderId, orderNumber: propOrderNumber, returnId, onReturnReceiptSelect, initialCheckoutUi, onZeroTotalComplete, exchangeCreditRemaining = 0 }) {
  const { themeColor, themeMode } = useTheme()
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    if (!hex || typeof hex !== 'string') {
      // Fallback to blue if themeColor is invalid
      return '107, 163, 240' // #6ba3f0 in RGB
    }
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '107, 163, 240'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  // Create gradient from theme color
  const getGradientBackground = () => {
    const rgbStr = hexToRgb(themeColor)
    const rgb = rgbStr.split(', ')
    // Create a darker shade for gradient end
    const darkerR = Math.max(0, parseInt(rgb[0]) - 30)
    const darkerG = Math.max(0, parseInt(rgb[1]) - 30)
    const darkerB = Math.max(0, parseInt(rgb[2]) - 30)
    const effectiveThemeColor = themeColor || '#6ba3f0'
    return `linear-gradient(135deg, ${effectiveThemeColor} 0%, rgb(${darkerR}, ${darkerG}, ${darkerB}) 100%)`
  }
  
  // Start with receipt screen if payment is already completed, otherwise start with transaction
  const [currentScreen, setCurrentScreen] = useState(() => {
    // If payment is completed, always start on receipt screen
    return paymentCompleted ? 'receipt' : 'transaction'
  }) // transaction, tip, payment, card, cash_confirmation, receipt, success
  const [paymentMethods, setPaymentMethods] = useState([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null)
  const [selectedTip, setSelectedTip] = useState(propTip || 0)
  const [tipSuggestions, setTipSuggestions] = useState([15, 18, 20])
  const [tipEnabled, setTipEnabled] = useState(false)
  const [customTipInCheckout, setCustomTipInCheckout] = useState(true)
  const [amountDue, setAmountDue] = useState(total)
  const [cardStatus, setCardStatus] = useState('waiting')
  const [receiptType, setReceiptType] = useState(null)
  const [receiptContact, setReceiptContact] = useState('')
  const [socket, setSocket] = useState(null)
  const [transactionId, setTransactionId] = useState(propTransactionId || null)
  const [orderId, setOrderId] = useState(propOrderId || null)
  const [orderNumber, setOrderNumber] = useState(propOrderNumber || null)
  const [showCustomTip, setShowCustomTip] = useState(false)
  const [customTipAmount, setCustomTipAmount] = useState('')
  const [signatureData, setSignatureData] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)
  // Initialize with defaults to avoid blue flash when opening; use API/initialCheckoutUi when available
  const [checkoutUi, setCheckoutUi] = useState(() =>
    (returnId != null && initialCheckoutUi != null)
      ? mergeCheckoutUiFromApi(initialCheckoutUi)
      : mergeCheckoutUiFromApi(null)
  )
  // When user picks Cash/Card and tip is enabled, we show tip screen first; this holds the method until they pick a tip
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState(null)
  const [requireSignature, setRequireSignature] = useState(false) // from display settings: block Print/No receipt/Email until signed

  // Treat amount due as zero when exchange/credit exactly covers (avoids float noise and shows single Continue)
  const amountWithTip = total + selectedTip
  const isEffectivelyZero = amountWithTip <= 0 || amountWithTip < 0.01

  // Return receipt mode: require signature and start on receipt screen
  useEffect(() => {
    if (returnId != null) {
      setRequireSignature(true)
    }
  }, [returnId])

  // Initialize Socket.IO connection – use same origin so Vite proxy (or Flask) handles /socket.io
  useEffect(() => {
    const newSocket = io({
      transports: ['polling'],
      upgrade: false,
      path: '/socket.io/',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000
    })
    
    newSocket.on('connect', () => {
      console.log('Customer display connected to Socket.IO')
      newSocket.emit('join', { room: 'customer_display' })
    })
    
    newSocket.on('disconnect', () => {
      console.log('Customer display disconnected')
    })
    
    newSocket.on('payment_processed', (data) => {
      if (data.success) {
        setCardStatus('approved')
        // Don't automatically show receipt screen - user must click receipt button
      }
    })
    
    newSocket.on('payment_success', () => {
      // Don't automatically show receipt screen - user must click receipt button
      // Just show success screen or keep current screen
    })
    
    newSocket.on('payment_error', () => {
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

  // Refetch display settings when popup becomes visible so edits saved in Settings are applied
  useEffect(() => {
    if (showSummary) {
      loadDisplaySettings()
    }
  }, [showSummary])

  // When opening for return receipt: use initialCheckoutUi immediately so background/colors match API from first frame; also refetch to stay in sync
  useEffect(() => {
    if (returnId != null && initialCheckoutUi != null) {
      setCheckoutUi(mergeCheckoutUiFromApi(initialCheckoutUi))
    }
  }, [returnId, initialCheckoutUi])

  useEffect(() => {
    if (returnId != null) {
      loadDisplaySettings()
    }
  }, [returnId])

  useEffect(() => {
    // Update amount due when total or tip changes
    setAmountDue(total + selectedTip)
  }, [total, selectedTip])

  // Sync tip from props
  useEffect(() => {
    if (propTip !== undefined) {
      setSelectedTip(propTip)
    }
  }, [propTip])

  // Sync props to state when used inline (not as popup). Tip screen is shown only after Cash/Card choice, not before.
  useEffect(() => {
    if (returnId != null) {
      setCurrentScreen('receipt')
      return
    }
    if (paymentCompleted) return
    if (currentScreen === 'card' || currentScreen === 'receipt' || currentScreen === 'success' || currentScreen === 'cash_confirmation' || currentScreen === 'tip') {
      return
    }
    if (showSummary) {
      setCurrentScreen('transaction')
    } else if (cart && cart.length > 0) {
      if (currentScreen === 'idle' || (!currentScreen && cart.length > 0)) {
        setCurrentScreen('transaction')
      }
    } else if (cart && cart.length === 0) {
      setCurrentScreen('transaction')
    }
  }, [cart, currentScreen, showSummary, paymentCompleted, returnId])

  useEffect(() => {
    // Don't interfere if payment is completed - we should be on receipt screen
    if (paymentCompleted) {
      return
    }
    
    // Only show payment screens for card payments
    // Don't interfere if we're already in payment flow
    if (currentScreen === 'card' || currentScreen === 'receipt' || currentScreen === 'success' || currentScreen === 'cash_confirmation') {
      return
    }
    
    if (paymentMethod === 'credit_card' && currentScreen === 'transaction' && !showSummary) {
      // Payment form opened for card, move to card screen
      setCurrentScreen('card')
    }
    // For cash payments, don't show customer display during payment - only at end for receipt
  }, [paymentMethod, currentScreen, cart, showSummary, paymentCompleted])

  useEffect(() => {
    if (paymentCompleted) {
      // If payment is completed, always show receipt screen (unless already on success or receipt)
      // Force it to receipt screen immediately
      if (currentScreen !== 'receipt' && currentScreen !== 'success') {
        setCurrentScreen('receipt')
      }
      // For card payments, show approved status
      if (currentScreen === 'card') {
        setCardStatus('approved')
      }
    }
  }, [paymentCompleted, currentScreen, paymentMethod])
  
  // Additional effect to ensure receipt screen when paymentCompleted changes to true
  useEffect(() => {
    if (paymentCompleted && currentScreen !== 'receipt' && currentScreen !== 'success') {
      setCurrentScreen('receipt')
    }
  }, [paymentCompleted])

  useEffect(() => {
    if (propTransactionId) {
      setTransactionId(propTransactionId)
    }
    if (propOrderId) {
      setOrderId(propOrderId)
    }
    if (propOrderNumber) {
      setOrderNumber(propOrderNumber)
    }
  }, [propTransactionId, propOrderId, propOrderNumber])

  // Initialize signature canvas when receipt screen is shown
  const receiptSigBg = checkoutUi?.receipt?.signature_background || '#ffffff'
  const receiptSigInk = checkoutUi?.receipt?.signature_ink_color || '#000000'
  useEffect(() => {
    if (currentScreen === 'receipt') {
      // Small delay to ensure canvas is rendered
      const timer = setTimeout(() => {
        const canvas = document.getElementById('signatureCanvas')
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas size based on container
        const container = canvas.parentElement
        if (container) {
          const rect = container.getBoundingClientRect()
          canvas.width = rect.width
          canvas.height = rect.height
        } else {
          canvas.width = 800
          canvas.height = 250
        }

        // Clear canvas with configured background
        ctx.fillStyle = receiptSigBg
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Set drawing style (ink color from settings)
        ctx.strokeStyle = receiptSigInk
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        let drawing = false
        let lastX = 0
        let lastY = 0

        const getCoordinates = (e) => {
          const rect = canvas.getBoundingClientRect()
          const scaleX = canvas.width / rect.width
          const scaleY = canvas.height / rect.height
          return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
          }
        }

        const startDrawing = (e) => {
          drawing = true
          setIsDrawing(true)
          const coords = getCoordinates(e)
          lastX = coords.x
          lastY = coords.y
        }

        const draw = (e) => {
          if (!drawing) return
          const coords = getCoordinates(e)
          const currentX = coords.x
          const currentY = coords.y

          ctx.beginPath()
          ctx.moveTo(lastX, lastY)
          ctx.lineTo(currentX, currentY)
          ctx.stroke()

          lastX = currentX
          lastY = currentY
          
          // Save signature data continuously
          const dataURL = canvas.toDataURL('image/png')
          setSignatureData(dataURL)
        }

        const stopDrawing = () => {
          if (drawing) {
            drawing = false
            setIsDrawing(false)
            // Save signature data
            const dataURL = canvas.toDataURL('image/png')
            setSignatureData(dataURL)
          }
        }

        // Mouse events
        canvas.addEventListener('mousedown', startDrawing)
        canvas.addEventListener('mousemove', draw)
        canvas.addEventListener('mouseup', stopDrawing)
        canvas.addEventListener('mouseout', stopDrawing)

        // Touch events
        const handleTouchStart = (e) => {
          e.preventDefault()
          const touch = e.touches[0]
          const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
          })
          canvas.dispatchEvent(mouseEvent)
        }

        const handleTouchMove = (e) => {
          e.preventDefault()
          const touch = e.touches[0]
          const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
          })
          canvas.dispatchEvent(mouseEvent)
        }

        const handleTouchEnd = (e) => {
          e.preventDefault()
          const mouseEvent = new MouseEvent('mouseup', {})
          canvas.dispatchEvent(mouseEvent)
        }

        canvas.addEventListener('touchstart', handleTouchStart)
        canvas.addEventListener('touchmove', handleTouchMove)
        canvas.addEventListener('touchend', handleTouchEnd)

        return () => {
          clearTimeout(timer)
          canvas.removeEventListener('mousedown', startDrawing)
          canvas.removeEventListener('mousemove', draw)
          canvas.removeEventListener('mouseup', stopDrawing)
          canvas.removeEventListener('mouseout', stopDrawing)
          canvas.removeEventListener('touchstart', handleTouchStart)
          canvas.removeEventListener('touchmove', handleTouchMove)
          canvas.removeEventListener('touchend', handleTouchEnd)
        }
      }, 100)

      return () => clearTimeout(timer)
    } else {
      // Clear signature when leaving receipt screen
      setSignatureData(null)
      setIsDrawing(false)
    }
  }, [currentScreen, receiptSigBg, receiptSigInk])


  const loadDisplaySettings = async () => {
    try {
      const response = await fetch('/api/customer-display/settings')
      const result = await response.json()
      if (result.success) {
        setTipEnabled(result.data.tip_enabled || false)
        setRequireSignature(result.data.signature_required === 1 || result.data.signature_required === true)
        setCustomTipInCheckout(result.data.tip_custom_in_checkout === 1 || result.data.tip_custom_in_checkout === true)
        if (result.data.tip_suggestions) {
          const arr = Array.isArray(result.data.tip_suggestions) ? result.data.tip_suggestions : [15, 18, 20]
          setTipSuggestions(arr.slice(0, 3))
        }
        setCheckoutUi(mergeCheckoutUiFromApi(result.data.checkout_ui))
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
        setPaymentMethods(result.data || [])
      } else {
        console.error('Failed to load payment methods:', result.error)
        // Set empty array as fallback
        setPaymentMethods([])
      }
    } catch (err) {
      console.error('Error loading payment methods:', err)
      // Set empty array as fallback
      setPaymentMethods([])
    }
  }

  const showPaymentScreen = () => {
    setAmountDue(total + selectedTip)
    // Notify POS that we're proceeding to payment (this will set showSummary to false)
    if (onProceedToPayment) {
      onProceedToPayment()
    }
    // Show payment method selection screen
    setCurrentScreen('payment')
  }

  const goToPaymentScreenAfterTip = (method) => {
    if (!method) return
    setPendingPaymentMethod(null)
    if (method.method_type === 'cash') {
      setCurrentScreen('cash_confirmation')
    } else {
      if (onPaymentMethodSelect) onPaymentMethodSelect(method)
      setCurrentScreen('card')
      setCardStatus('waiting')
    }
  }

  const selectTip = (percent) => {
    const tipAmount = (total * percent / 100).toFixed(2)
    const amount = parseFloat(tipAmount)
    console.log('[TIP DEBUG] CustomerDisplayPopup selectTip:', { percent, total, amount })
    setSelectedTip(amount)
    setAmountDue(total + amount)
    setShowCustomTip(false)
    setCustomTipAmount('')
    if (onTipSelect) onTipSelect(amount)
    const newTotalWithTip = total + amount
    if ((newTotalWithTip <= 0 || newTotalWithTip < 0.01) && onZeroTotalComplete) {
      return
    }
    if (pendingPaymentMethod) {
      goToPaymentScreenAfterTip(pendingPaymentMethod)
    } else {
      setCurrentScreen('transaction')
    }
  }

  const skipTip = () => {
    console.log('[TIP DEBUG] CustomerDisplayPopup skipTip (no tip)')
    setSelectedTip(0)
    setAmountDue(total)
    setShowCustomTip(false)
    setCustomTipAmount('')
    if (onTipSelect) onTipSelect(0)
    if ((total <= 0 || total < 0.01) && onZeroTotalComplete) {
      return
    }
    if (pendingPaymentMethod) {
      goToPaymentScreenAfterTip(pendingPaymentMethod)
    } else {
      setCurrentScreen('transaction')
    }
  }

  const handleCustomTipInput = (value) => {
    // Only allow numbers and one decimal point
    const cleaned = value.replace(/[^0-9.]/g, '')
    // Ensure only one decimal point
    const parts = cleaned.split('.')
    if (parts.length > 2) {
      return // Invalid input, don't update
    }
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return // Too many decimal places, don't update
    }
    setCustomTipAmount(cleaned)
  }

  const applyCustomTip = () => {
    const tipValue = parseFloat(customTipAmount) || 0
    console.log('[TIP DEBUG] CustomerDisplayPopup applyCustomTip:', { customTipAmount, tipValue })
    setSelectedTip(tipValue)
    setAmountDue(total + tipValue)
    setShowCustomTip(false)
    setCustomTipAmount('')
    if (onTipSelect) onTipSelect(tipValue)
    const newTotalWithTip = total + tipValue
    if ((newTotalWithTip <= 0 || newTotalWithTip < 0.01) && onZeroTotalComplete) {
      return
    }
    if (pendingPaymentMethod) {
      goToPaymentScreenAfterTip(pendingPaymentMethod)
    } else {
      setCurrentScreen('transaction')
    }
  }

  const selectPaymentMethod = async (method) => {
    setSelectedPaymentMethod(method)
    if (tipEnabled) {
      setPendingPaymentMethod(method)
      setCurrentScreen('tip')
      return
    }
    if (method.method_type === 'cash') {
      setCurrentScreen('cash_confirmation')
    } else if (method.method_type === 'card' || method.method_type === 'credit_card' || method.requires_terminal) {
      if (onPaymentMethodSelect) onPaymentMethodSelect(method)
      setCurrentScreen('card')
      setCardStatus('waiting')
    }
  }

  const handleContinueFromCash = () => {
    // Continue from cash confirmation - trigger calculator
    if (onPaymentMethodSelect && selectedPaymentMethod) {
      onPaymentMethodSelect(selectedPaymentMethod)
    }
  }

  // Process payment when cashier completes it
  const processPayment = async () => {
    if (!selectedPaymentMethod || !transactionId) return
    
    setCardStatus('processing')
    
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/payment/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          transaction_id: transactionId,
          payment_method_id: selectedPaymentMethod.payment_method_id,
          amount: paymentMethod === 'cash' ? parseFloat(amountPaid) : (total + selectedTip),
          tip: selectedTip
        })
      })
      
      const result = await response.json()
      
      if (result.success && result.data.success) {
        setCardStatus('approved')
        // Don't automatically show receipt screen - user must click receipt button
      } else {
        setCardStatus('declined')
      }
    } catch (err) {
      console.error('Payment processing error:', err)
      setCardStatus('declined')
    }
  }

  // Auto-advance when payment is completed from POS
  useEffect(() => {
    if (paymentCompleted) {
      // If we're on card screen, show approved status
      if (currentScreen === 'card') {
        setCardStatus('approved')
      }
      // Don't automatically show receipt screen - user must click receipt button
    }
  }, [paymentCompleted, currentScreen])

  const selectReceipt = async (type) => {
    setReceiptType(type)

    // Return receipt mode: delegate to parent and close
    if (returnId != null) {
      if (type === 'email' || type === 'sms') {
        return // show email/sms input; submit will go through submitReceiptPreference
      }
      if (onReturnReceiptSelect) {
        onReturnReceiptSelect(type, signatureData)
      }
      if (onClose) onClose()
      return
    }
    
    // Save signature first if available (before generating receipt)
    if (signatureData && transactionId) {
      try {
        const sigResponse = await fetch('/api/transaction/signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction_id: transactionId,
            signature: signatureData
          })
        })
        const sigResult = await sigResponse.json()
        if (sigResult.success) {
          console.log('Signature saved successfully')
          // Small delay to ensure database is updated
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (sigErr) {
        console.error('Error saving signature:', sigErr)
        // Continue even if signature save fails
      }
    }
    
    if (type === 'print') {
      // If this order used exchange credit, use combined exchange completion receipt (one PDF: returned items + new items + total)
      const exchangeCreditUsed = sessionStorage.getItem('exchangeCreditUsed')
      const creditInfo = exchangeCreditUsed ? (() => { try { return JSON.parse(exchangeCreditUsed) } catch { return null } })() : null
      const exchangeOrderId = creditInfo?.order_id

      const generateReceiptForId = async (id, isOrder = false, forceRegularOrder = false) => {
        try {
          // Prefer exchange completion receipt when this order used exchange credit (unless fallback from 404)
          let endpoint = isOrder ? `/api/receipt/${id}` : `/api/receipt/transaction/${id}`
          if (isOrder && exchangeOrderId && parseInt(id, 10) === parseInt(exchangeOrderId, 10) && !forceRegularOrder) {
            endpoint = `/api/receipt/exchange_completion/${exchangeOrderId}`
          }
          console.log('Generating receipt for:', endpoint, 'ID:', id, 'isOrder:', isOrder)
          const response = await fetch(endpoint)
          console.log('Receipt response status:', response.status, 'Content-Type:', response.headers.get('content-type'))
          
          // Check if response is OK and is a PDF
          if (response.ok) {
            const contentType = response.headers.get('content-type') || ''
            
            // Verify it's actually a PDF
            if (contentType.includes('application/pdf')) {
              const blob = await response.blob()
              
              // Double-check blob type or size
              if (blob.type === 'application/pdf' || blob.size > 0) {
                const isExchangeCompletion = endpoint.includes('exchange_completion')
                const downloadUrl = window.URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = downloadUrl
                link.download = isExchangeCompletion ? `exchange_receipt_order_${id}.pdf` : `receipt-${isOrder ? 'order' : 'transaction'}-${id}.pdf`
                link.style.display = 'none'
                document.body.appendChild(link)
                link.click()
                setTimeout(() => {
                  if (link.parentNode) document.body.removeChild(link)
                  window.URL.revokeObjectURL(downloadUrl)
                }, 500)
                
                console.log('Receipt downloaded successfully')
                if (isExchangeCompletion && creditInfo) {
                  sessionStorage.removeItem('exchangeCreditUsed')
                }
                
                return true
              } else {
                console.error('Invalid blob type received:', blob.type, 'Size:', blob.size)
                return false
              }
            } else {
              // If not PDF, read error message
              const text = await response.text()
              console.error('Response was not a PDF. Content-Type:', contentType, 'Response:', text)
              return false
            }
          } else {
            // Try to read error message
            const errorText = await response.text()
            console.error('Failed to generate receipt. Status:', response.status, 'Error:', errorText)
            return false
          }
        } catch (err) {
          console.error('Error generating receipt:', err)
          return false
        }
      }
      
      // Try transaction receipt first (includes tip), then exchange completion if applicable, then order receipt
      let success = false
      if (transactionId) {
        success = await generateReceiptForId(transactionId, false)
      }
      if (!success && exchangeOrderId) {
        success = await generateReceiptForId(exchangeOrderId, true)
        if (!success) success = await generateReceiptForId(exchangeOrderId, true, true)
      }
      if (!success && orderId) {
        success = await generateReceiptForId(orderId, true)
      }
      await submitReceiptPreference(type)
    } else if (type === 'email' || type === 'sms') {
      // Show input field (handled in render)
    } else {
      submitReceiptPreference(type)
    }
  }

  const submitReceiptPreference = async (type = receiptType, contact = receiptContact) => {
    if (returnId != null) {
      if (onReturnReceiptSelect) {
        onReturnReceiptSelect(type, signatureData)
      }
      if (onClose) onClose()
      return
    }
    if (!transactionId) {
      // If no transaction ID, just call the callback
      if (onReceiptSelect) {
        onReceiptSelect(type, contact)
      }
      showSuccessScreen()
      return
    }

    try {
      // Save signature if available (in case it wasn't saved earlier)
      if (signatureData) {
        try {
          await fetch('/api/transaction/signature', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transaction_id: transactionId,
              signature: signatureData
            })
          })
        } catch (sigErr) {
          console.error('Error saving signature:', sigErr)
          // Continue even if signature save fails
        }
      }

      await fetch('/api/receipt/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transactionId,
          receipt_type: type,
          email: type === 'email' ? contact : null,
          phone: type === 'sms' ? contact : null
        })
      })

      if (onReceiptSelect) {
        onReceiptSelect(type, contact)
      }
      showSuccessScreen()
    } catch (err) {
      console.error('Error saving receipt preference:', err)
      showSuccessScreen()
    }
  }

  const showSuccessScreen = () => {
    setCurrentScreen('success')
    setTimeout(() => {
      if (onClose) {
        onClose()
      }
    }, 3000)
  }

  const paymentMethodIcons = {
    'card': '💳',
    'cash': '💵',
    'mobile_wallet': '📱',
    'gift_card': '🎁',
    'store_credit': '💰',
    'check': '📝'
  }

  // Calculate change for cash payments
  const calculateChange = () => {
    if (paymentMethod === 'cash' && amountPaid) {
      const paid = parseFloat(amountPaid) || 0
      return paid - (total + selectedTip)
    }
    return 0
  }

  const checkoutScreenKey = currentScreen === 'transaction' ? 'review_order' : currentScreen === 'cash_confirmation' ? 'cash_confirmation' : currentScreen === 'receipt' ? 'receipt' : currentScreen === 'tip' ? 'tip_selection' : currentScreen === 'card' ? 'card' : null
  const screenStyle = checkoutScreenKey && checkoutUi?.[checkoutScreenKey] ? checkoutUi[checkoutScreenKey] : null
  const popupBackground = screenStyle?.backgroundColor || getGradientBackground()
  const popupColor = screenStyle?.textColor || '#333'
  const popupFontFamily = screenStyle?.title_font ?? (screenStyle?.fontFamily || '-apple-system, "system-ui", "SF Pro Display", "Segoe UI", Roboto, sans-serif')
  const popupFontWeight = screenStyle?.fontWeight || '600'
  const buttonBg = screenStyle?.buttonColor || '#4a90e2'
  const getCheckoutTextStyle = (s, type) => {
    if (!s) return {}
    const t = type === 'title' ? 'title' : type === 'button' ? 'button' : 'body'
    const font = s[`${t}_font`] ?? s.fontFamily ?? 'system-ui'
    const size = s[`${t}_font_size`] != null ? s[`${t}_font_size`] : (t === 'title' ? 36 : t === 'button' ? 36 : 24)
    const bold = s[`${t}_bold`] ?? (t === 'button')
    const fw = s.fontWeight ?? '600'
    return {
      fontFamily: font,
      fontSize: `${Number(size)}px`,
      fontWeight: bold ? '700' : (t === 'button' ? fw : '400'),
      fontStyle: s[`${t}_italic`] ? 'italic' : 'normal',
      textAlign: (s[`${t}_align`] || (t === 'title' ? 'center' : 'left'))
    }
  }
  const titleStyle = screenStyle ? getCheckoutTextStyle(screenStyle, 'title') : {}
  const bodyStyle = screenStyle ? getCheckoutTextStyle(screenStyle, 'body') : {}
  const buttonTextStyle = screenStyle ? getCheckoutTextStyle(screenStyle, 'button') : {}
  const buttonStyleId = screenStyle?.button_style || 'default'

  const renderCheckoutButton = (label, onClick, fullWidth = false) => {
    const wrapStyle = { flex: fullWidth ? 'none' : 1, width: fullWidth ? '100%' : undefined, minWidth: 0 }
    const defaultBtnStyle = {
      flex: fullWidth ? 'none' : 1,
      width: fullWidth ? '100%' : undefined,
      height: '100px',
      padding: '16px',
      paddingTop: '8px',
      backgroundColor: buttonBg,
      backgroundImage: 'none',
      color: '#fff',
      border: 0,
      borderRadius: '8px',
      cursor: 'pointer',
      boxShadow: 'inset 0 -8px rgb(0 0 0/0.4), 0 2px 4px rgb(0 0 0/0.2)',
      transition: 'transform 0.4s cubic-bezier(0.55, 1, 0.15, 1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      touchAction: 'manipulation',
      ...buttonTextStyle
    }
    if (buttonStyleId === 'default') {
      return (
        <button
          type="button"
          role="button"
          onClick={onClick}
          style={defaultBtnStyle}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {label}
        </button>
      )
    }
    if (buttonStyleId === 'push') {
      return (
        <div className="checkout-btn-wrap" style={wrapStyle}>
          <button
            type="button"
            role="button"
            className="checkout-btn--push"
            style={{ ['--checkout-btn-color']: buttonBg, ...buttonTextStyle }}
            onClick={onClick}
          >
            <span className="checkout-btn__shadow" aria-hidden />
            <span className="checkout-btn__edge" aria-hidden />
            <span className="checkout-btn__front">{label}</span>
          </button>
        </div>
      )
    }
    const className = `checkout-btn--${buttonStyleId}`
    return (
      <div className={`checkout-btn-wrap${fullWidth ? ' checkout-btn-wrap--full' : ''}`} style={wrapStyle}>
        <button
          type="button"
          role="button"
          className={className}
          style={{ ['--checkout-btn-color']: buttonBg, ...buttonTextStyle }}
          onClick={onClick}
        >
          {buttonStyleId === 'soft-push' ? <span className="checkout-btn__text">{label}</span> : label}
        </button>
      </div>
    )
  }

  return (
    <div style={{ 
      height: '100vh', 
      width: '100%', 
      overflow: 'auto',
      background: popupBackground,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div className="customer-display-popup-container" style={{ 
        maxWidth: '100%', 
        maxHeight: '100%', 
        borderRadius: '0', 
        padding: '20px',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        color: popupColor,
        fontFamily: popupFontFamily,
        fontWeight: popupFontWeight,
        background: 'transparent',
        boxShadow: 'none'
      }}>
        {/* Transaction Screen - Summary before payment (choose Cash or Card) */}
        {currentScreen === 'transaction' && (
          <div className="transaction-screen-popup" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '4px' }}>
              <button
                onClick={() => onClose && onClose()}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: '#999',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 400,
                  cursor: 'pointer',
                  opacity: 0.6
                }}
              >
                Cancel
              </button>
            </div>
            <div className="screen-header" style={{ marginTop: 0, marginBottom: '20px' }}>
              <h2 style={titleStyle}>Review Your Order</h2>
            </div>
            
            <div className="items-list" style={bodyStyle}>
              {cart.map((item, idx) => (
                <div key={idx} className="item-row">
                  <span className="item-name">{item.product_name}</span>
                  {item.quantity > 1 && <span className="item-quantity">× {item.quantity}</span>}
                  <span className="item-price">${(item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            
            <div className="totals-section" style={bodyStyle}>
              <div className="total-row">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="total-row">
                  <span>Discount:</span>
                  <span>-${Number(discount).toFixed(2)}</span>
                </div>
              )}
              <div className="total-row">
                <span>Tax:</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Fee:</span>
                <span>${Number(transactionFee || 0).toFixed(2)}</span>
              </div>
              {selectedTip > 0 && (
                <div className="total-row">
                  <span>Tip:</span>
                  <span>${selectedTip.toFixed(2)}</span>
                </div>
              )}
              <div className="total-row final">
                <span>Total:</span>
                <span>${(total + selectedTip).toFixed(2)}</span>
              </div>
              {exchangeCreditRemaining > 0 && isEffectivelyZero && (
                <div className="total-row" style={{ marginTop: '8px', fontSize: '0.95em', opacity: 0.9 }}>
                  <span>Store credit remaining:</span>
                  <span>${Number(exchangeCreditRemaining).toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '20px', width: '100%', marginTop: '20px' }}>
              {(() => {
                // When exchange/credit covers (or nearly covers), show single Continue so they can complete without Cash/Card
                if (isEffectivelyZero && onZeroTotalComplete) {
                  return renderCheckoutButton('Continue', () => onZeroTotalComplete())
                }
                if (isEffectivelyZero) {
                  return renderCheckoutButton('Continue', () => setCurrentScreen('tip'))
                }
                const cashMethod = paymentMethods.find(m => m.method_type === 'cash')
                const cardMethod = paymentMethods.find(m => m.method_type === 'card' || m.method_type === 'credit_card')
                const cash = cashMethod || { method_type: 'cash', payment_method_id: 'cash_default' }
                const card = cardMethod || { method_type: 'card', payment_method_id: 'card_default' }
                return (
                  <>
                    {renderCheckoutButton('Cash', () => selectPaymentMethod(cash))}
                    {renderCheckoutButton('Card', () => selectPaymentMethod(card))}
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* Tip Screen - shown after Cash/Card when tip enabled; 4 options: 3 percentages + No tip */}
        {currentScreen === 'tip' && (
          <div className="payment-screen-popup" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '8px' }}>
              {(pendingPaymentMethod || (isEffectivelyZero && onZeroTotalComplete)) ? (
                <button
                  type="button"
                  onClick={() => { setPendingPaymentMethod(null); setCurrentScreen('transaction') }}
                  style={{ padding: '6px 12px', background: 'transparent', color: popupColor, border: 'none', fontSize: '14px', cursor: 'pointer', opacity: 0.8 }}
                >
                  Back
                </button>
              ) : <span />}
            </div>
            <div className="screen-header" style={titleStyle}>
              <h2>Add a tip?</h2>
            </div>
            {!showCustomTip ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', width: '100%', maxWidth: '400px', margin: '0 auto', flex: 1, alignContent: 'start' }}>
                {(tipSuggestions.slice(0, 3)).map((percent) => {
                  const tipAmount = (total * percent / 100).toFixed(2)
                  return (
                    <button
                      key={percent}
                      type="button"
                      onClick={() => selectTip(percent)}
                      style={{
                        aspectRatio: '1',
                        minHeight: 0,
                        padding: '16px',
                        backgroundColor: buttonBg,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...buttonTextStyle
                      }}
                      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                    >
                      <div style={{ fontSize: 'clamp(28px, 6vw, 36px)', fontWeight: 600, marginBottom: '4px' }}>{percent}%</div>
                      <div style={{ fontSize: 'clamp(16px, 3.5vw, 20px)', opacity: 0.95 }}>${tipAmount}</div>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={skipTip}
                  style={{
                    aspectRatio: '1',
                    minHeight: 0,
                    padding: '16px',
                    backgroundColor: buttonBg,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'clamp(22px, 5vw, 28px)',
                    fontWeight: 600,
                    ...buttonTextStyle
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  No tip
                </button>
                {customTipInCheckout && (
                  <button
                    type="button"
                    onClick={() => setShowCustomTip(true)}
                    style={{
                      gridColumn: '1 / -1',
                      padding: '20px 16px',
                      backgroundColor: `rgba(${themeColorRgb}, 0.35)`,
                      color: popupColor,
                      border: `2px solid ${buttonBg}`,
                      borderRadius: '8px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'clamp(18px, 4vw, 22px)',
                      fontWeight: 600,
                      ...buttonTextStyle
                    }}
                    onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    Custom
                  </button>
                )}
              </div>
            ) : (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                width: '100%',
                maxWidth: '500px',
                margin: '0 auto'
              }}>
                <div style={{ 
                  fontSize: '24px', 
                  marginBottom: '20px',
                  color: '#333'
                }}>
                  Enter custom tip amount
                </div>
                <div style={{
                  width: '100%',
                  marginBottom: '20px'
                }}>
                  <input
                    type="text"
                    value={customTipAmount}
                    onChange={(e) => handleCustomTipInput(e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '20px',
                      fontSize: '32px',
                      fontFamily: 'monospace',
                      textAlign: 'center',
                      border: `3px solid rgba(${themeColorRgb}, 0.5)`,
                      borderRadius: '15px',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      color: '#333',
                      fontWeight: 600
                    }}
                    autoFocus
                  />
                  {customTipAmount && parseFloat(customTipAmount) > 0 && (
                    <div style={{
                      marginTop: '10px',
                      fontSize: '18px',
                      color: '#333',
                      textAlign: 'center'
                    }}>
                      Tip: ${parseFloat(customTipAmount || 0).toFixed(2)}
                    </div>
                  )}
                </div>
                <div style={{
                  display: 'flex',
                  gap: '15px',
                  width: '100%'
                }}>
                  <button
                    onClick={() => {
                      setShowCustomTip(false)
                      setCustomTipAmount('')
                    }}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      border: '2px solid white'
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={applyCustomTip}
                    disabled={!customTipAmount || parseFloat(customTipAmount) <= 0}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      backgroundColor: parseFloat(customTipAmount) > 0 ? 'white' : 'rgba(255, 255, 255, 0.3)',
                      color: parseFloat(customTipAmount) > 0 ? themeColor : 'white',
                      cursor: parseFloat(customTipAmount) > 0 ? 'pointer' : 'not-allowed',
                      opacity: parseFloat(customTipAmount) > 0 ? 1 : 0.5
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
            {isEffectivelyZero && onZeroTotalComplete && (
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '24px' }}>
                {renderCheckoutButton('Continue', () => onZeroTotalComplete())}
              </div>
            )}
          </div>
        )}


        {/* Cash Confirmation Screen */}
        {currentScreen === 'cash_confirmation' && (
          <div className="payment-screen-popup" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '10px', marginTop: '-10px' }}>
              <button
                onClick={() => onClose && onClose()}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: '#999',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 400,
                  cursor: 'pointer',
                  opacity: 0.6
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleContinueFromCash}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: '#999',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 400,
                  cursor: 'pointer',
                  opacity: 0.6
                }}
              >
                Continue
              </button>
            </div>
            
            <div className="screen-header" style={{ width: '100%', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, ...titleStyle }}>
                Please give the cash amount to the cashier
              </h2>
            </div>
            
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <div className="totals-section" style={{ background: `rgba(${themeColorRgb}, 0.15)`, borderRadius: '15px', padding: '20px', width: '100%', ...bodyStyle }}>
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="total-row">
                    <span>Discount:</span>
                    <span>-${Number(discount).toFixed(2)}</span>
                  </div>
                )}
                <div className="total-row">
                  <span>Tax:</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                {transactionFee > 0 && (
                  <div className="total-row">
                    <span>Transaction fee:</span>
                    <span>${Number(transactionFee).toFixed(2)}</span>
                  </div>
                )}
                {selectedTip > 0 && (
                  <div className="total-row">
                    <span>Tip:</span>
                    <span>${selectedTip.toFixed(2)}</span>
                  </div>
                )}
                <div className="total-row final">
                  <span>Total:</span>
                  <span>${amountDue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card Processing Screen */}
        {currentScreen === 'card' && (
          <div className="card-processing-screen-popup" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-start', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '10px', marginTop: '-10px' }}>
              <button
                onClick={() => onClose && onClose()}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  color: '#999',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 400,
                  cursor: 'pointer',
                  opacity: 0.6
                }}
              >
                Cancel
              </button>
            </div>
            <div className="card-animation" style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', marginTop: '48px' }}>
              <img src="/contactless-svgrepo-com.svg" alt="" style={{ width: '320px', height: '320px', color: 'inherit' }} />
            </div>
            <div className="card-instruction" style={{ fontSize: '1.25rem', textAlign: 'center', ...bodyStyle }}>
              {checkoutUi?.card?.instruction_text ?? 'Please insert or tap your card'}
            </div>
            {cardStatus !== 'waiting' && cardStatus !== 'reading' && (
              <div className="card-status" style={{ marginTop: '12px', textAlign: 'center' }}>
                {cardStatus === 'processing' && 'Processing payment...'}
                {cardStatus === 'approved' && 'Payment approved!'}
                {cardStatus === 'declined' && 'Payment declined. Please try again.'}
              </div>
            )}
          </div>
        )}

        {/* Receipt Screen */}
        {currentScreen === 'receipt' && (
          <div className="receipt-screen-popup" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            {returnId != null && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: '8px' }}>
                <button
                  onClick={() => onClose && onClose()}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    color: popupColor || '#999',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    opacity: 0.8,
                    ...bodyStyle
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="screen-header" style={{ width: '100%', marginBottom: '30px' }}>
              <h2 style={titleStyle}>{returnId != null ? 'Sign below for return receipt' : 'Sign Below'}</h2>
            </div>
            
            {/* Signature Area */}
            <div style={{
              width: '100%',
              height: '250px',
              border: `${checkoutUi?.receipt?.signature_border_width ?? 2}px solid ${checkoutUi?.receipt?.signature_border_color || `rgba(${themeColorRgb}, 0.3)`}`,
              borderRadius: '8px',
              backgroundColor: checkoutUi?.receipt?.signature_background || '#fff',
              marginBottom: '30px',
              position: 'relative'
            }}>
              <canvas
                id="signatureCanvas"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '6px',
                  cursor: 'crosshair'
                }}
              />
            </div>
            
            {/* Receipt Options - when requireSignature is on, must sign before Print/No receipt/Email */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                width: '100%',
                marginTop: '20px',
                opacity: requireSignature && !signatureData ? 0.5 : 1,
                pointerEvents: requireSignature && !signatureData ? 'none' : 'auto'
              }}
            >
              {(() => {
                const opts = checkoutUi?.receipt?.receipt_options_offered || {}
                const showPrint = opts.print !== false
                const showEmail = opts.email !== false
                const showNoReceipt = opts.no_receipt !== false
                const hasAnyOption = showPrint || showEmail || showNoReceipt
                if (!hasAnyOption) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
                      <div style={{ textAlign: 'center', fontSize: '18px', color: popupColor, opacity: 0.9 }}>
                        Thank you for your purchase
                      </div>
                      {renderCheckoutButton('Done', () => submitReceiptPreference('none'), true)}
                    </div>
                  )
                }
                return (
                  <>
                    <div style={{ display: 'flex', gap: '20px', width: '100%' }}>
                      {showPrint && renderCheckoutButton('Print', () => selectReceipt('print'))}
                      {showNoReceipt && renderCheckoutButton('No Receipt', () => selectReceipt('none'))}
                    </div>
                    {showEmail && renderCheckoutButton('Email', () => selectReceipt('email'), true)}
                  </>
                )
              })()}
            </div>
            
            {receiptType === 'email' && (
              <div style={{ marginTop: '20px', width: '100%' }}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={receiptContact}
                  onChange={(e) => setReceiptContact(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '16px',
                    marginBottom: '12px'
                  }}
                />
                <button
                  onClick={() => submitReceiptPreference()}
                  style={{
                    width: '100%',
                    padding: '24px 16px',
                    minHeight: '70px',
                    backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    fontSize: '28px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                    transition: 'all 0.3s ease'
                  }}
                >
                  Submit
                </button>
              </div>
            )}
          </div>
        )}

        {/* Success Screen */}
        {currentScreen === 'success' && (
          <div className="success-screen-popup">
            <div className="success-icon">✓</div>
            <div className="success-message">Payment Successful!</div>
            <div className="success-details">Thank you for your purchase</div>
            <button
              onClick={() => setCurrentScreen('receipt')}
              style={{
                marginTop: '30px',
                padding: '20px 40px',
                fontSize: '24px',
                fontWeight: 600,
                backgroundColor: `rgba(${themeColorRgb}, 0.8)`,
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3)`,
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = `rgba(${themeColorRgb}, 1)`
                e.target.style.transform = 'scale(1.05)'
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
                e.target.style.transform = 'scale(1)'
              }}
            >
              Get Receipt
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomerDisplayPopup

