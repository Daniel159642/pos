import { useState, useEffect } from 'react'
import { usePermissions, ProtectedComponent } from '../contexts/PermissionContext'
import { useTheme } from '../contexts/ThemeContext'
import BarcodeScanner from './BarcodeScanner'
import CustomerDisplayPopup from './CustomerDisplayPopup'

function POS({ employeeId, employeeName }) {
  const { hasPermission } = usePermissions()
  const { themeColor } = useTheme()
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  const [cart, setCart] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categoryProducts, setCategoryProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [taxRate, setTaxRate] = useState(0.08) // Default 8% tax
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState(null)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [amountPaid, setAmountPaid] = useState('')
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [showChangeScreen, setShowChangeScreen] = useState(false)
  const [changeAmount, setChangeAmount] = useState(0)
  const [paymentCompleted, setPaymentCompleted] = useState(false)
  const [currentTransactionId, setCurrentTransactionId] = useState(null)
  const [showCustomerDisplay, setShowCustomerDisplay] = useState(false)
  const [showSummary, setShowSummary] = useState(false) // Show transaction summary before payment
  const [selectedTip, setSelectedTip] = useState(0) // Tip amount selected by customer
  
  // Check if user can process sales
  const canProcessSale = hasPermission('process_sale')
  const canApplyDiscount = hasPermission('apply_discount')
  const canVoidTransaction = hasPermission('void_transaction')

  // Fetch all products and categories on mount and when window gains focus
  useEffect(() => {
    fetchAllProducts()
    
    // Refresh products when window gains focus (user switches back to POS tab)
    const handleFocus = () => {
      fetchAllProducts()
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // Search products
  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchProducts(searchTerm)
      setSelectedCategory(null) // Clear category selection when searching
    } else {
      setSearchResults([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  // Update category products when category is selected
  useEffect(() => {
    if (selectedCategory && searchTerm.length < 2) {
      const filtered = allProducts.filter(product => 
        product.category === selectedCategory
      )
      setCategoryProducts(filtered)
    } else {
      setCategoryProducts([])
    }
  }, [selectedCategory, allProducts, searchTerm])

  const fetchAllProducts = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/inventory`)
      const data = await response.json()
      
      if (data.data) {
        setAllProducts(data.data)
        // Extract unique categories (filter out null/empty)
        const uniqueCategories = [...new Set(
          data.data
            .map(product => product.category)
            .filter(cat => cat && cat.trim() !== '')
        )].sort()
        setCategories(uniqueCategories)
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fuzzy string matching function - allows for typos
  const fuzzyMatch = (str, pattern) => {
    if (!str || !pattern) return false
    
    const strLower = str.toLowerCase()
    const patternLower = pattern.toLowerCase()
    
    // Exact match or contains match (fastest)
    if (strLower.includes(patternLower)) return true
    
    // Simple fuzzy matching: allow 1-2 character differences for short patterns
    if (pattern.length <= 3) {
      // For very short patterns, be more lenient
      const maxDistance = Math.max(1, Math.floor(pattern.length * 0.5))
      return levenshteinDistance(strLower, patternLower) <= maxDistance
    }
    
    // For longer patterns, check if pattern is mostly contained
    // Allow up to 30% character difference
    const maxDistance = Math.max(1, Math.floor(pattern.length * 0.3))
    return levenshteinDistance(strLower, patternLower) <= maxDistance
  }
  
  // Simple Levenshtein distance calculation
  const levenshteinDistance = (str1, str2) => {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  const searchProducts = async (term) => {
    setLoading(true)
    try {
      // Always fetch fresh data from API to include newly created products
      const response = await fetch(`/api/inventory`)
      const data = await response.json()
      
      const productsToSearch = data.data || []
      
      // Update the cached products list
      if (productsToSearch.length > 0) {
        setAllProducts(productsToSearch)
        // Extract unique categories (filter out null/empty)
        const uniqueCategories = [...new Set(
          productsToSearch
            .map(product => product.category)
            .filter(cat => cat && cat.trim() !== '')
        )].sort()
        setCategories(uniqueCategories)
      }
      
      const termLower = term.toLowerCase()
      
      // Special handling for semantic searches (fruit, vegetable, etc.)
      const semanticTypes = {
        'fruit': 'fruit',
        'fruits': 'fruit',
        'vegetable': 'vegetable',
        'vegetables': 'vegetable',
        'dairy': 'dairy',
        'produce': null // Produce is a category, not a type
      }
      
      const expectedType = semanticTypes[termLower]
      
      const filtered = productsToSearch.filter(product => {
        const nameMatch = fuzzyMatch(product.product_name, term)
        const skuMatch = fuzzyMatch(product.sku, term)
        const categoryMatch = fuzzyMatch(product.category, term)
        
        // Search in metadata keywords
        let keywordMatch = false
        if (product.keywords) {
          try {
            const keywords = typeof product.keywords === 'string' 
              ? JSON.parse(product.keywords) 
              : product.keywords
            if (Array.isArray(keywords)) {
              keywordMatch = keywords.some(kw => 
                kw && fuzzyMatch(kw, term)
              )
            }
          } catch (e) {
            // If not JSON, treat as string
            keywordMatch = fuzzyMatch(product.keywords, term)
          }
        }
        
        // Search in metadata tags
        let tagMatch = false
        if (product.tags) {
          try {
            const tags = typeof product.tags === 'string' 
              ? JSON.parse(product.tags) 
              : product.tags
            if (Array.isArray(tags)) {
              tagMatch = tags.some(tag => 
                tag && fuzzyMatch(tag, term)
              )
            }
          } catch (e) {
            // If not JSON, treat as string
            tagMatch = fuzzyMatch(product.tags, term)
          }
        }
        
        // Search in metadata attributes (type, texture, taste, etc.)
        let attributeMatch = false
        let typeMatch = false
        if (product.attributes) {
          try {
            const attrs = typeof product.attributes === 'string' 
              ? JSON.parse(product.attributes) 
              : product.attributes
            if (typeof attrs === 'object' && attrs !== null) {
              // Check all attribute values for general match
              attributeMatch = Object.values(attrs).some(val => {
                if (typeof val === 'string') {
                  return fuzzyMatch(val, term)
                }
                return false
              })
              
              // For semantic searches (fruit, vegetable), check type attribute specifically
              // Use exact match for type to avoid false positives
              if (expectedType !== null && expectedType !== undefined) {
                typeMatch = attrs.type && attrs.type.toLowerCase() === expectedType
              }
            }
          } catch (e) {
            // If not JSON, treat as string
            attributeMatch = fuzzyMatch(product.attributes, term)
          }
        }
        
        // If searching for a specific type (fruit, vegetable), require type match
        if (expectedType !== null && expectedType !== undefined) {
          return typeMatch || nameMatch || skuMatch
        }
        
        // Otherwise, match on any field
        return nameMatch || skuMatch || categoryMatch || keywordMatch || tagMatch || attributeMatch
      })
      setSearchResults(filtered.slice(0, 50)) // Show more results (was 10)
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (product) => {
    // Use functional update to ensure we're working with latest cart state
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product_id === product.product_id)
      
      if (existingItem) {
        // Increase quantity
        return prevCart.map(item =>
          item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        // Add new item
        return [...prevCart, {
          product_id: product.product_id,
          product_name: product.product_name,
          sku: product.sku,
          unit_price: product.product_price,
          quantity: 1,
          available_quantity: product.current_quantity || 0
        }]
      }
    })
    setSearchTerm('')
    setSearchResults([])
  }

  const handleCategorySelect = (category) => {
    if (selectedCategory === category) {
      // Deselect if clicking the same category
      setSelectedCategory(null)
      setCategoryProducts([])
    } else {
      setSelectedCategory(category)
      setSearchTerm('') // Clear search when selecting category
    }
  }

  const handleBarcodeScan = async (barcode) => {
    setLoading(true)
    setMessage(null)
    
    try {
      // Always fetch fresh data from API to include newly created products
      const response = await fetch(`/api/inventory`)
      const data = await response.json()
      
      // Update cached products list
      if (data.data) {
        setAllProducts(data.data)
        // Extract unique categories (filter out null/empty)
        const uniqueCategories = [...new Set(
          data.data
            .map(product => product.category)
            .filter(cat => cat && cat.trim() !== '')
        )].sort()
        setCategories(uniqueCategories)
        
        // Debug logging
        console.log('Scanned barcode:', barcode, 'Length:', barcode.length)
        
        // Debug: log all products with barcodes
        const productsWithBarcodes = data.data.filter(p => p.barcode)
        console.log('Products with barcodes:', productsWithBarcodes.map(p => ({
          name: p.product_name,
          barcode: p.barcode,
          barcodeLength: p.barcode?.length
        })))
        
        // Try to find by barcode first (exact match)
        let product = data.data.find(p => p.barcode && p.barcode.toString().trim() === barcode.toString().trim())
        
        // If not found and barcode is 13 digits (EAN13), try without leading 0 (12 digits)
        if (!product && barcode.length === 13 && barcode.startsWith('0')) {
          const barcode12 = barcode.substring(1)
          console.log('Trying 12-digit version:', barcode12)
          product = data.data.find(p => p.barcode && p.barcode.toString().trim() === barcode12)
        }
        
        // If not found and barcode is 12 digits, try with leading 0 (13 digits)
        if (!product && barcode.length === 12) {
          const barcode13 = '0' + barcode
          console.log('Trying 13-digit version:', barcode13)
          product = data.data.find(p => p.barcode && (p.barcode.toString().trim() === barcode13 || p.barcode.toString().trim() === barcode))
        }
        
        // If not found by barcode, try by SKU
        if (!product) {
          product = data.data.find(p => p.sku && p.sku.toString().trim() === barcode.toString().trim())
        }
        
        if (product) {
          console.log('Product found:', product.product_name)
          // Add to cart
          addToCart(product)
          console.log('Cart updated with product:', product.product_name)
          // Keep scanner open for continuous scanning
          setMessage({ type: 'success', text: `Added ${product.product_name} to cart` })
          // Auto-dismiss message after 2 seconds
          setTimeout(() => setMessage(null), 2000)
          return
        }
      }
      
      // If not found locally, show error
      console.log('Product not found for barcode:', barcode)
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

  const calculateTotalWithTip = () => {
    return calculateTotal() + selectedTip
  }

  const calculateChange = () => {
    const paid = parseFloat(amountPaid) || 0
    const totalWithTip = calculateTotalWithTip()
    return paid - totalWithTip
  }

  const handleDismissChange = () => {
    setShowChangeScreen(false)
    // Show customer display for receipt selection after cash payment
    if (paymentCompleted && paymentMethod === 'cash') {
      setShowCustomerDisplay(true)
      setShowSummary(false) // Don't show summary, go straight to receipt screen
    } else if (paymentCompleted) {
      // For non-cash, customer display should already be showing
      setShowCustomerDisplay(true)
    } else {
      // If payment wasn't completed, reset everything
      setCart([])
      setSearchTerm('')
      setShowPaymentForm(false)
      setAmountPaid('')
      setChangeAmount(0)
      setSelectedTip(0)
      setShowCustomerDisplay(false)
    }
  }

  const handleTipSelect = (tip) => {
    setSelectedTip(tip)
  }

  const generateReceipt = async (orderId, orderNumber) => {
    try {
      const response = await fetch(`/api/receipt/${orderId}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `receipt_${orderNumber}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        console.error('Failed to generate receipt')
      }
    } catch (err) {
      console.error('Error generating receipt:', err)
    }
  }

  const handleReceiptSelect = () => {
    // Clear cart if payment was completed
    if (paymentCompleted) {
      setCart([])
      setSearchTerm('')
      setAmountPaid('')
      setPaymentCompleted(false)
      setSelectedTip(0) // Reset tip
      setShowCustomerDisplay(false)
      setShowPaymentForm(false)
    }
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

      // Start transaction for customer display
      let transactionId = null
      let transactionNumber = null
      try {
        const sessionToken = localStorage.getItem('sessionToken')
        const transactionResponse = await fetch('/api/transaction/start', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({ items: items })
        })
        
        const transactionResult = await transactionResponse.json()
        if (transactionResult.success) {
          transactionId = transactionResult.data.transaction_id
          transactionNumber = transactionResult.data.transaction_number
          setCurrentTransactionId(transactionId)
          // Notify customer display
          sessionStorage.setItem('activeTransaction', JSON.stringify(transactionResult.data))
          // Store transaction ID for customer display
          sessionStorage.setItem('currentTransactionId', transactionId)
        }
      } catch (err) {
        console.error('Error starting transaction:', err)
      }

      // Process payment using new transaction system if available, otherwise fall back to old system
      let response, result
      if (transactionId) {
        // Get payment method ID
        const paymentMethodsResponse = await fetch('/api/payment-methods')
        const paymentMethodsResult = await paymentMethodsResponse.json()
        // Find payment method by matching method_type or method_name
        const paymentMethodObj = paymentMethodsResult.data?.find(
          pm => {
            if (paymentMethod === 'cash') {
              return pm.method_type === 'cash' || pm.method_name.toLowerCase().includes('cash')
            } else {
              // For card payments, match any card type (card, mobile_wallet)
              return pm.method_type === 'card' || pm.method_name.toLowerCase() === 'card'
            }
          }
        )
        
        if (paymentMethodObj) {
          const paid = paymentMethod === 'cash' ? parseFloat(amountPaid) || 0 : (calculateTotal() + selectedTip)
          const tipAmount = selectedTip || 0
          
          response = await fetch('/api/payment/process', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
            },
            body: JSON.stringify({
              transaction_id: transactionId,
              payment_method_id: paymentMethodObj.payment_method_id,
              amount: paid,
              tip: tipAmount
            })
          })
          
          result = await response.json()
          
          if (result.success && result.data.success) {
            const successMessage = transactionNumber 
              ? `Transaction ${transactionNumber} processed successfully!`
              : 'Transaction processed successfully!'
            setMessage({ type: 'success', text: successMessage })
            
            // Trigger customer display to show receipt screen
            setPaymentCompleted(true)
            
            // For cash payments, show change screen briefly then automatically show customer display
            if (paymentMethod === 'cash') {
              const change = result.data.data?.change || calculateChange()
              setChangeAmount(change)
              setShowChangeScreen(true)
              setShowPaymentForm(false)
              // Automatically show customer display for receipt selection after 3 seconds
              setTimeout(() => {
                setShowChangeScreen(false)
                setShowCustomerDisplay(true)
                setShowSummary(false) // Don't show summary, go straight to receipt screen
              }, 3000)
            } else {
              // For non-cash payments, show customer display for receipt selection
              setShowCustomerDisplay(true)
              setShowPaymentForm(false)
            }
            // Clear active transaction
            sessionStorage.removeItem('activeTransaction')
          } else {
            setMessage({ type: 'error', text: result.data?.error || 'Failed to process payment' })
          }
        } else {
          // Fall back to old system
          response = await fetch('/api/create_order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: employeeId,
              items: items,
              payment_method: paymentMethod,
              tax_rate: taxRate
            })
          })
          result = await response.json()
          
          if (result.success) {
            setMessage({ type: 'success', text: `Order ${result.order_number} processed successfully!` })
            setPaymentCompleted(true)
            
            // Automatically generate and download receipt
            if (result.order_id) {
              generateReceipt(result.order_id, result.order_number)
            }
            
            // Payment completed - show customer display for receipt selection
            // For cash payments, show change screen briefly then automatically show customer display
            if (paymentMethod === 'cash') {
              const change = calculateChange()
              setChangeAmount(change)
              setShowChangeScreen(true)
              setShowPaymentForm(false)
              // Automatically show customer display for receipt selection after 3 seconds
              setTimeout(() => {
                setShowChangeScreen(false)
                setShowCustomerDisplay(true)
                setShowSummary(false) // Don't show summary, go straight to receipt screen
              }, 3000)
            } else {
              // For non-cash payments, show customer display for receipt selection
              setShowCustomerDisplay(true)
              setShowPaymentForm(false)
            }
          } else {
            setMessage({ type: 'error', text: result.message || 'Failed to process order' })
          }
        }
      } else {
        // Fall back to old system
        response = await fetch('/api/create_order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: employeeId,
            items: items,
            payment_method: paymentMethod,
            tax_rate: taxRate
          })
        })
        result = await response.json()
        
        if (result.success) {
          setMessage({ type: 'success', text: `Order ${result.order_number} processed successfully!` })
          
          if (paymentMethod === 'cash') {
            const change = calculateChange()
            setChangeAmount(change)
            setShowChangeScreen(true)
            setShowPaymentForm(false)
          } else {
            setCart([])
            setSearchTerm('')
            setShowPaymentForm(false)
            setAmountPaid('')
          }
        } else {
          setMessage({ type: 'error', text: result.message || 'Failed to process order' })
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error processing order. Please try again.' })
      console.error('Order error:', err)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="pos-page" style={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: 'calc(100vh - 60px)',
      gap: '20px',
      padding: '0 20px 0 20px',
      paddingTop: '0',
      paddingBottom: '0',
      backgroundColor: 'white',
      position: 'relative',
      fontFamily: '"Product Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Customer Display Full Screen Overlay */}
      {showCustomerDisplay && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          backgroundColor: '#f5f5f5'
        }}>
          <div style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Cashier Controls Bar - Small overlay at top right */}
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              alignItems: 'flex-end'
            }}>
              {/* Payment Form Controls - Only show when payment form is active and payment method is cash */}
              {showPaymentForm && paymentMethod === 'cash' && (
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  minWidth: '300px',
                  maxWidth: '400px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontFamily: '"Product Sans", sans-serif' }}>Cashier Controls</h3>
                    <button
                      onClick={() => {
                        setShowCustomerDisplay(false)
                        setShowPaymentForm(false)
                        setAmountPaid('')
                      }}
                      style={{
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#666',
                        cursor: 'pointer',
                        fontSize: '20px',
                        padding: '0',
                        width: '24px',
                        height: '24px',
                        lineHeight: '1'
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Payment Method */}
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setPaymentMethod('cash')
                          setAmountPaid('')
                        }}
                        style={{
                          flex: 1,
                          padding: '12px',
                          border: paymentMethod === 'cash' ? '2px solid #000' : '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontWeight: 600,
                          backgroundColor: paymentMethod === 'cash' ? '#000' : '#fff',
                          color: paymentMethod === 'cash' ? '#fff' : '#000',
                          cursor: 'pointer'
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
                          padding: '12px',
                          border: paymentMethod === 'credit_card' ? '2px solid #000' : '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontWeight: 600,
                          backgroundColor: paymentMethod === 'credit_card' ? '#000' : '#fff',
                          color: paymentMethod === 'credit_card' ? '#fff' : '#000',
                          cursor: 'pointer'
                        }}
                      >
                        Card
                      </button>
                    </div>
                  </div>

                  {/* Amount Display for Cash */}
                  {paymentMethod === 'cash' && (
                    <div style={{ marginBottom: '15px' }}>
                      <div style={{
                        padding: '12px',
                        border: '2px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '20px',
                        fontFamily: '"Product Sans", sans-serif',
                        fontWeight: 600,
                        marginBottom: '10px',
                        backgroundColor: '#f9f9f9',
                        textAlign: 'right'
                      }}>
                        {amountPaid ? `$${parseFloat(amountPaid || 0).toFixed(2)}` : '$0.00'}
                        {amountPaid && parseFloat(amountPaid) > 0 && (
                          <div style={{ fontSize: '14px', color: calculateChange() >= 0 ? '#2e7d32' : '#d32f2f', marginTop: '5px' }}>
                            Change: ${calculateChange().toFixed(2)}
                          </div>
                        )}
                      </div>
                      
                      {/* Quick Amount Buttons */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
                        {[10, 20, 50, 100].map(amt => (
                          <button
                            key={amt}
                            onClick={() => setAmountPaid(amt.toString())}
                            style={{
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '12px',
                              backgroundColor: '#fff',
                              cursor: 'pointer'
                            }}
                          >
                            ${amt}
                          </button>
                        ))}
                      </div>

                      {/* Calculator Input */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'C'].map((val) => (
                          <button
                            key={val}
                            onClick={() => {
                              if (val === 'C') {
                                setAmountPaid('')
                              } else {
                                handleCalculatorInput(val.toString())
                              }
                            }}
                            style={{
                              padding: '10px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px',
                              backgroundColor: '#fff',
                              cursor: 'pointer'
                            }}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Process Payment Button */}
                  <button
                    onClick={processOrder}
                    disabled={processing || cart.length === 0 || (paymentMethod === 'cash' && (!amountPaid || parseFloat(amountPaid) < calculateTotal()))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: processing || cart.length === 0 || (paymentMethod === 'cash' && (!amountPaid || parseFloat(amountPaid) < calculateTotal())) ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.7)`,
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      color: '#fff',
                      border: processing || cart.length === 0 || (paymentMethod === 'cash' && (!amountPaid || parseFloat(amountPaid) < calculateTotal())) ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: 600,
                      cursor: processing || cart.length === 0 || (paymentMethod === 'cash' && (!amountPaid || parseFloat(amountPaid) < calculateTotal())) ? 'not-allowed' : 'pointer',
                      boxShadow: processing || cart.length === 0 || (paymentMethod === 'cash' && (!amountPaid || parseFloat(amountPaid) < calculateTotal())) ? `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)` : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                      transition: 'all 0.3s ease',
                      opacity: 1
                    }}
                  >
                    {processing ? 'Processing...' : 'Complete Payment'}
                  </button>

                  {/* Message */}
                  {message && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px',
                      borderRadius: '4px',
                      backgroundColor: message.type === 'success' ? '#e8f5e9' : '#ffebee',
                      color: message.type === 'success' ? '#2e7d32' : '#d32f2f',
                      fontSize: '12px'
                    }}>
                      {message.text}
                    </div>
                  )}
                </div>
              )}
              
              {/* Close Button - Show when on summary screen only, not during payment flow or when customer display is active */}
              {showSummary && !showPaymentForm && !showCustomerDisplay && (
                <button
                  onClick={() => {
                    setShowCustomerDisplay(false)
                    setShowSummary(false)
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'transparent',
                    color: '#666',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 400,
                    cursor: 'pointer',
                    opacity: 0.7
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
            
            {/* Full Screen Customer Display */}
            <div style={{
              flex: 1,
              width: '100%',
              height: '100%',
              overflow: 'hidden'
            }}>
              <CustomerDisplayPopup
                cart={cart}
                subtotal={calculateSubtotal()}
                tax={calculateTax()}
                total={calculateTotal()}
                tip={selectedTip}
                paymentMethod={paymentCompleted ? paymentMethod : (showPaymentForm && paymentMethod === 'credit_card' ? paymentMethod : null)}
                amountPaid={amountPaid}
                onClose={() => {
                  setShowCustomerDisplay(false)
                  setShowPaymentForm(false)
                  setShowSummary(false)
                  setAmountPaid('')
                }}
                onTipSelect={handleTipSelect}
                onReceiptSelect={handleReceiptSelect}
                onProceedToPayment={() => {
                  // User clicked "Proceed to Payment" from summary - set showSummary to false
                  setShowSummary(false)
                  // Don't show payment form yet - wait for payment method selection
                  // Payment form will be shown when payment method is selected
                }}
                onPaymentMethodSelect={(method) => {
                  // Set payment method based on customer's selection
                  if (method.method_type === 'cash') {
                    setPaymentMethod('cash')
                    setShowPaymentForm(true) // Show payment form for cashier
                    setShowCustomerDisplay(false) // Hide customer display for cash - cashier handles it
                  } else if (method.method_type === 'card') {
                    setPaymentMethod('credit_card')
                    setShowPaymentForm(true) // Show payment form
                    // Keep customer display open for card payments
                  }
                }}
                showSummary={showSummary && !showPaymentForm}
                employeeId={employeeId}
                paymentCompleted={paymentCompleted}
                transactionId={currentTransactionId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Row - Hidden when customer display is showing */}
      <div style={{
        display: showCustomerDisplay ? 'none' : 'flex',
        gap: '0',
        flex: '1',
        minHeight: 0
      }}>
        {/* Left Column - Cart */}
        <div style={{
          flex: '1',
          padding: '20px',
          paddingRight: '20px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          borderRight: '1px solid #ddd'
        }}>
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
                    <td style={{ textAlign: 'right', padding: '12px', fontFamily: '"Product Sans", sans-serif' }}>
                      ${item.unit_price.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          style={{
                            width: '28px',
                            height: '28px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '18px',
                            lineHeight: '1',
                            color: themeColor
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
                            border: 'none',
                            backgroundColor: 'transparent',
                            borderRadius: '4px',
                            cursor: item.quantity >= item.available_quantity ? 'not-allowed' : 'pointer',
                            fontSize: '18px',
                            lineHeight: '1',
                            color: themeColor,
                            opacity: item.quantity >= item.available_quantity ? 0.5 : 1
                          }}
                        >+</button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px', fontFamily: '"Product Sans", sans-serif', fontWeight: 500 }}>
                      ${(item.unit_price * item.quantity).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        style={{
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: themeColor,
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
            <span style={{ fontFamily: '"Product Sans", sans-serif', fontWeight: 500 }}>
              ${calculateSubtotal().toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#666' }}>Tax ({(taxRate * 100).toFixed(1)}%):</span>
            <span style={{ fontFamily: '"Product Sans", sans-serif', fontWeight: 500 }}>
              ${calculateTax().toFixed(2)}
            </span>
          </div>
          {selectedTip > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Tip:</span>
              <span style={{ fontFamily: '"Product Sans", sans-serif', fontWeight: 500 }}>
                ${selectedTip.toFixed(2)}
              </span>
            </div>
          )}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '24px',
            fontWeight: 600,
            paddingTop: '12px',
            borderTop: '2px solid #eee',
            marginTop: '12px'
          }}>
            <span style={{ color: '#666' }}>Total:</span>
            <span style={{ fontFamily: '"Product Sans", sans-serif', color: '#000' }}>
              ${calculateTotalWithTip().toFixed(2)}
            </span>
          </div>

          {/* Pay and Discount Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <ProtectedComponent permission="process_sale" fallback={
              <button
                disabled
                style={{
                  flex: 1,
                  padding: '16px',
                  backgroundColor: '#E9D5FF',
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
                onClick={() => {
                  setShowSummary(true)
                  setShowCustomerDisplay(true)
                }}
                disabled={cart.length === 0}
                style={{
                  flex: 1,
                  padding: '16px',
                  backgroundColor: cart.length === 0 ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.7)`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#fff',
                  border: cart.length === 0 ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: 600,
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: cart.length === 0 ? `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)` : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                  transition: 'all 0.3s ease',
                  opacity: 1
                }}
              >
                Pay
              </button>
            </ProtectedComponent>
            <ProtectedComponent permission="apply_discount" fallback={null}>
              <button
                onClick={() => {
                  // TODO: Implement discount functionality
                  const discountAmount = prompt('Enter discount amount (e.g., 10 for $10 or 10% for 10%):')
                  if (discountAmount) {
                    // Handle discount logic here
                    console.log('Discount:', discountAmount)
                  }
                }}
                disabled={cart.length === 0}
                style={{
                  padding: '16px 24px',
                  backgroundColor: cart.length === 0 ? `rgba(${themeColorRgb}, 0.35)` : `rgba(${themeColorRgb}, 0.55)`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#fff',
                  border: cart.length === 0 ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: 600,
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: cart.length === 0 ? `0 2px 8px rgba(${themeColorRgb}, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15)` : `0 4px 15px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                  transition: 'all 0.3s ease',
                  opacity: 1
                }}
              >
                Discount
              </button>
            </ProtectedComponent>
          </div>
        </div>
      </div>

        {/* Right Column - Product Search or Payment Form or Change Screen */}
        <div style={{
          flex: '1',
          padding: '20px',
          paddingLeft: '20px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
        {showChangeScreen ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, fontFamily: '"Product Sans", sans-serif' }}>Change Due</h2>
              <button
                onClick={handleDismissChange}
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
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              minHeight: '400px'
            }}>
              <div style={{
                fontSize: '48px',
                fontWeight: 700,
                color: '#2e7d32',
                marginBottom: '20px',
                fontFamily: '"Product Sans", sans-serif'
              }}>
                ${changeAmount.toFixed(2)}
              </div>
              <div style={{
                fontSize: '24px',
                color: '#666',
                marginBottom: '40px',
                textAlign: 'center'
              }}>
                Change to return to customer
              </div>
              <button
                onClick={handleDismissChange}
                style={{
                  padding: '16px 32px',
                  backgroundColor: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '18px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#000'}
              >
                Show Receipt Options
              </button>
            </div>
          </>
        ) : showPaymentForm ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0, fontFamily: '"Product Sans", sans-serif' }}>Payment</h2>
              <button
                onClick={() => {
                  setShowPaymentForm(false)
                  setShowCustomerDisplay(false)
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
                    backgroundColor: paymentMethod === 'cash' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.5)`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: '#fff',
                    border: paymentMethod === 'cash' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: paymentMethod === 'cash' 
                      ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` 
                      : `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)`,
                    transition: 'all 0.3s ease'
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
                    backgroundColor: paymentMethod === 'credit_card' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.5)`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: '#fff',
                    border: paymentMethod === 'credit_card' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: paymentMethod === 'credit_card' 
                      ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` 
                      : `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)`,
                    transition: 'all 0.3s ease'
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
                  fontFamily: '"Product Sans", sans-serif',
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
                marginTop: 'auto',
                backgroundColor: processing || cart.length === 0 ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.7)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#fff',
                border: processing || cart.length === 0 ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: 600,
                cursor: processing || cart.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: processing || cart.length === 0 ? `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)` : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                transition: 'all 0.3s ease',
                opacity: 1
              }}
            >
              {processing ? 'Processing...' : 'Complete Payment'}
            </button>
          </>
        ) : (
          <>
            {/* Search Bar with Scan Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Search by name, SKU, or scan barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  border: 'none',
                  borderBottom: '2px solid #ddd',
                  borderRadius: '0',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  backgroundColor: 'transparent',
                  outline: 'none'
                }}
                autoFocus
              />
              <button
                onClick={() => setShowBarcodeScanner(true)}
                style={{
                  padding: '8px',
                  backgroundColor: 'transparent',
                  color: '#000',
                  border: 'none',
                  borderRadius: '0',
                  fontSize: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '40px',
                  height: '40px'
                }}
                title="Scan Barcode"
              >
                📷
              </button>
            </div>

            {/* Category Navigation - Show when not searching */}
            {searchTerm.length < 2 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  {categories.map(category => (
                    <button
                      key={category}
                      onClick={() => handleCategorySelect(category)}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: selectedCategory === category ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: selectedCategory === category ? '1px solid rgba(255, 255, 255, 0.3)' : `1px solid rgba(${themeColorRgb}, 0.3)`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: selectedCategory === category ? 600 : 500,
                        color: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: selectedCategory === category ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Product List / Search Results */}
            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  Loading...
                </div>
              ) : searchTerm.length >= 2 ? (
                // Show search results
                searchResults.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    No products found
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {searchResults.map(product => {
                      const productImage = product.photo
                      // Construct image URL - handle both relative paths and full paths
                      let imageUrl = null
                      if (productImage) {
                        if (productImage.startsWith('http://') || productImage.startsWith('https://')) {
                          imageUrl = productImage
                        } else if (productImage.startsWith('/')) {
                          imageUrl = productImage
                        } else if (productImage.startsWith('uploads/')) {
                          imageUrl = `/${productImage}`
                        } else {
                          imageUrl = `/uploads/${productImage}`
                        }
                      }
                      
                      return (
                      <div
                        key={product.product_id}
                        onClick={() => addToCart(product)}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #eee',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          backgroundColor: (product.current_quantity || 0) > 0 ? '#fff' : '#ffebee',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = (product.current_quantity || 0) > 0 ? '#fff' : '#ffebee'}
                      >
                        {/* Product Image */}
                        {imageUrl ? (
                          <div style={{
                            width: '50px',
                            height: '50px',
                            minWidth: '50px',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            backgroundColor: '#e0e0e0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <img
                              src={imageUrl}
                              alt={product.product_name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.parentElement.innerHTML = '<span style="color: #999; font-size: 20px;">📦</span>'
                              }}
                            />
                          </div>
                        ) : (
                          <div style={{
                            width: '50px',
                            height: '50px',
                            minWidth: '50px',
                            borderRadius: '4px',
                            backgroundColor: '#e0e0e0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px'
                          }}>
                            📦
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '2px' }}>
                              {product.product_name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#999', display: 'inline-block', marginRight: '8px' }}>
                              SKU: {product.sku}
                            </div>
                            <div style={{ fontSize: '11px', color: (product.current_quantity || 0) > 0 ? themeColor : '#d32f2f', display: 'inline-block' }}>
                              Stock: {product.current_quantity || 0}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            fontFamily: '"Product Sans", sans-serif',
                            color: '#000'
                          }}>
                            ${(product.product_price || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                )
              ) : selectedCategory ? (
                // Show category products
                categoryProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    No products in this category
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {categoryProducts.map(product => {
                      const productImage = product.photo
                      // Construct image URL - handle both relative paths and full paths
                      let imageUrl = null
                      if (productImage) {
                        if (productImage.startsWith('http://') || productImage.startsWith('https://')) {
                          imageUrl = productImage
                        } else if (productImage.startsWith('/')) {
                          imageUrl = productImage
                        } else if (productImage.startsWith('uploads/')) {
                          imageUrl = `/${productImage}`
                        } else {
                          imageUrl = `/uploads/${productImage}`
                        }
                      }
                      
                      return (
                      <div
                        key={product.product_id}
                        onClick={() => addToCart(product)}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #eee',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          backgroundColor: (product.current_quantity || 0) > 0 ? '#fff' : '#ffebee',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = (product.current_quantity || 0) > 0 ? '#fff' : '#ffebee'}
                      >
                        {/* Product Image */}
                        {imageUrl ? (
                          <div style={{
                            width: '50px',
                            height: '50px',
                            minWidth: '50px',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            backgroundColor: '#e0e0e0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <img
                              src={imageUrl}
                              alt={product.product_name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.parentElement.innerHTML = '<span style="color: #999; font-size: 20px;">📦</span>'
                              }}
                            />
                          </div>
                        ) : (
                          <div style={{
                            width: '50px',
                            height: '50px',
                            minWidth: '50px',
                            borderRadius: '4px',
                            backgroundColor: '#e0e0e0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px'
                          }}>
                            📦
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '2px' }}>
                              {product.product_name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#999', display: 'inline-block', marginRight: '8px' }}>
                              SKU: {product.sku}
                            </div>
                            <div style={{ fontSize: '11px', color: (product.current_quantity || 0) > 0 ? themeColor : '#d32f2f', display: 'inline-block' }}>
                              Stock: {product.current_quantity || 0}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            fontFamily: '"Product Sans", sans-serif',
                            color: '#000'
                          }}>
                            ${(product.product_price || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                )
              ) : (
                // Show message when no category selected and no search
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                  Select a category above or search for products
                </div>
              )}
            </div>
          </>
        )}
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onImageScan={handleImageScan}
          onClose={() => setShowBarcodeScanner(false)}
          themeColor={themeColor}
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


