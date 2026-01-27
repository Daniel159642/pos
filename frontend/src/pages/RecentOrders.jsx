import { useState, useEffect, Fragment, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import BarcodeScanner from '../components/BarcodeScanner'
import { ScanBarcode, CheckCircle, XCircle, ChevronDown } from 'lucide-react'
import { formLabelStyle, inputBaseStyle, getInputFocusHandlers, FormField, FormLabel } from '../components/FormStyles'
import Table from '../components/Table'

function RecentOrders() {
  const navigate = useNavigate()
  const { themeColor, themeMode } = useTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedRow, setExpandedRow] = useState(null)
  const [orderDetails, setOrderDetails] = useState({})
  const [loadingDetails, setLoadingDetails] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [selectedOrderType, setSelectedOrderType] = useState('all') // 'all', 'pickup', 'delivery', or 'in-person'
  const [allOrderItems, setAllOrderItems] = useState([]) // Cache all order items for searching
  const [scannedProducts, setScannedProducts] = useState([]) // Array of {product_id, product_name, sku, barcode}
  const [orderItemsMap, setOrderItemsMap] = useState({}) // Map of order_id -> order items
  const [highlightedOrderId, setHighlightedOrderId] = useState(null) // Order ID to highlight in table
  const [scannedOrderId, setScannedOrderId] = useState(null) // Order ID from scanned receipt barcode (filters table to show only this order)
  const [toast, setToast] = useState(null) // { message, type: 'success' | 'error' }
  const rowRefs = useRef({}) // Refs for table rows to enable scrolling
  const chipsContainerRef = useRef(null) // Ref for chips container
  
  // Return modal state
  const [order, setOrder] = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [selectedItems, setSelectedItems] = useState({})
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [returnLoading, setReturnLoading] = useState(false)
  const [returnType, setReturnType] = useState(null) // 'exchange' (use now) or 'store_credit' (use later)
  const [exchangeTiming, setExchangeTiming] = useState(null) // 'now' or 'later' (automatically set based on return type)
  const [employeeId, setEmployeeId] = useState(null)
  const [returnTypeDropdownOpen, setReturnTypeDropdownOpen] = useState(false)
  const [exchangeTimingDropdownOpen, setExchangeTimingDropdownOpen] = useState(false)
  const returnTypeDropdownRef = useRef(null)
  const exchangeTimingDropdownRef = useRef(null)
  const conditionDropdownRefs = useRef({}) // Refs for condition dropdowns per item
  const [openConditionDropdowns, setOpenConditionDropdowns] = useState({}) // Track which condition dropdowns are open
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  // Determine if dark mode is active
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark-theme')
  })
  
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark-theme'))
    }
    
    checkDarkMode()
    
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    
    return () => observer.disconnect()
  }, [themeMode])

  useEffect(() => {
    loadData()
    loadOrderItems()
    
    // Get employee ID for returns
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
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (returnTypeDropdownRef.current && !returnTypeDropdownRef.current.contains(event.target)) {
        setReturnTypeDropdownOpen(false)
      }
      if (exchangeTimingDropdownRef.current && !exchangeTimingDropdownRef.current.contains(event.target)) {
        setExchangeTimingDropdownOpen(false)
      }
      // Close condition dropdowns
      Object.keys(conditionDropdownRefs.current).forEach(itemId => {
        const ref = conditionDropdownRefs.current[itemId]
        if (ref && !ref.contains(event.target)) {
          setOpenConditionDropdowns(prev => ({ ...prev, [itemId]: false }))
        }
      })
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Load all order items when products are scanned (for filtering)
  const loadAllOrderItems = async () => {
    try {
      const itemsResponse = await fetch('/api/order_items')
      const itemsResult = await itemsResponse.json()
      const items = itemsResult.data || []
      setAllOrderItems(items)
      
      // Group items by order_id (normalize to number for consistent lookups)
      const itemsByOrder = {}
      items.forEach(item => {
        const orderId = item.order_id || item.orderId
        if (orderId) {
          const normalizedOrderId = parseInt(orderId)
          if (!isNaN(normalizedOrderId)) {
            if (!itemsByOrder[normalizedOrderId]) {
              itemsByOrder[normalizedOrderId] = []
            }
            itemsByOrder[normalizedOrderId].push(item)
          }
        }
      })
      
      console.log('Order items map populated:', Object.keys(itemsByOrder).length, 'orders')
      setOrderItemsMap(itemsByOrder)
    } catch (err) {
      console.error('Error loading order items:', err)
    }
  }
  
  const loadOrderItems = async () => {
    try {
      const itemsResponse = await fetch('/api/order_items')
      const itemsResult = await itemsResponse.json()
      setAllOrderItems(itemsResult.data || [])
    } catch (err) {
      console.error('Error loading order items:', err)
    }
  }

  // Load order items when products are scanned
  useEffect(() => {
    if (scannedProducts.length > 0) {
      console.log('Loading order items for scanned products:', scannedProducts)
      loadAllOrderItems()
    }
  }, [scannedProducts.length])

  // Scroll to highlighted order when it changes
  useEffect(() => {
    if (highlightedOrderId && rowRefs.current[highlightedOrderId]) {
      setTimeout(() => {
        rowRefs.current[highlightedOrderId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }, 100)
    }
  }, [highlightedOrderId])

  // Update input padding when chips change
  useEffect(() => {
    if (chipsContainerRef.current) {
      const chipsWidth = chipsContainerRef.current.offsetWidth
      const input = chipsContainerRef.current.nextElementSibling
      if (input) {
        input.style.paddingLeft = chipsWidth > 0 ? `${chipsWidth + 12}px` : '0'
      }
    }
  }, [scannedOrderId, scannedProducts])

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

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

  const fetchOrderById = async (orderId) => {
    setReturnLoading(true)
    setOrder(null)
    setOrderItems([])
    setSelectedItems({})

    try {
      // First try to find in current orders list
      let foundOrder = null
      if (data && data.data) {
        foundOrder = data.data.find(o => o.order_id === parseInt(orderId))
      }
      
      // If not found, search for it
      if (!foundOrder) {
        const searchResponse = await fetch(`/api/orders/search?order_id=${orderId}`)
        const searchResult = await searchResponse.json()
        if (searchResult.data && searchResult.data.length > 0) {
          foundOrder = searchResult.data[0]
          // Add to orders list if not present
          if (data && data.data) {
            const orderExists = data.data.some(o => o.order_id === foundOrder.order_id)
            if (!orderExists) {
              setData(prev => ({
                ...prev,
                data: [foundOrder, ...(prev.data || [])]
              }))
            }
          }
        }
      }

      if (!foundOrder) {
        setToast({ message: 'Order not found', type: 'error' })
        return
      }

      setOrder(foundOrder)
      
      // Highlight the order in the table
      setHighlightedOrderId(parseInt(orderId))
      setTimeout(() => setHighlightedOrderId(null), 5000)

      // Get order items
      const itemsResponse = await fetch('/api/order_items')
      const itemsResult = await itemsResponse.json()
      const items = itemsResult.data?.filter(item => item.order_id === parseInt(orderId)) || []
      setOrderItems(items)
      
      // Update orderItemsMap for filtering
      setOrderItemsMap(prev => ({
        ...prev,
        [parseInt(orderId)]: items
      }))
    } catch (err) {
      setToast({ message: 'Error loading order', type: 'error' })
      console.error(err)
    } finally {
      setReturnLoading(false)
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
      setToast({ message: 'Please select at least one item to return', type: 'error' })
      return
    }

    if (!returnType) {
      setToast({ message: 'Please select return type', type: 'error' })
      return
    }

    if (!employeeId) {
      setToast({ message: 'Employee ID not found. Please log in again.', type: 'error' })
      return
    }

    setReturnLoading(true)

    // Calculate return amounts
    let returnSubtotal = 0
    let returnTax = 0
    let returnProcessingFee = 0
    
    Object.entries(selectedItems).forEach(([itemId, data]) => {
      const item = orderItems.find(i => i.order_item_id === parseInt(itemId))
      if (item) {
        const itemSubtotal = parseFloat(item.unit_price || 0) * data.quantity
        const itemDiscount = parseFloat(item.discount || 0) * (data.quantity / item.quantity)
        const itemSubtotalAfterDiscount = itemSubtotal - itemDiscount
        const itemTaxRate = parseFloat(item.tax_rate || order.tax_rate || 0.08)
        const itemTax = itemSubtotalAfterDiscount * itemTaxRate
        
        returnSubtotal += itemSubtotalAfterDiscount
        returnTax += itemTax
      }
    })
    
    // Calculate processing fee (proportional to original order)
    if (order.transaction_fee && order.subtotal) {
      const feeRate = parseFloat(order.transaction_fee) / parseFloat(order.subtotal)
      returnProcessingFee = returnSubtotal * feeRate
    }
    
    const returnTotal = returnSubtotal + returnTax - returnProcessingFee

    const itemsToReturn = Object.entries(selectedItems).map(([orderItemId, data]) => ({
      order_item_id: parseInt(orderItemId),
      quantity: data.quantity,
      condition: data.condition,
      notes: ''
    }))

    try {
      const response = await fetch('/api/process_return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.order_id,
          items: itemsToReturn,
          employee_id: employeeId,
          customer_id: order.customer_id,
          reason: reason,
          notes: notes,
          return_type: returnType === 'store_credit' ? 'exchange' : returnType, // 'exchange', 'store_credit' (mapped to 'exchange'), or 'refund'
          exchange_timing: returnType === 'refund' ? null : exchangeTiming, // 'now' or 'later' (null for refund)
          return_subtotal: returnSubtotal,
          return_tax: returnTax,
          return_processing_fee: returnProcessingFee,
          return_total: returnTotal,
          payment_method: order.payment_method
        })
      })

      const result = await response.json()

      if (result.success) {
        // Print return receipt
        if (result.return_receipt_url) {
          window.open(result.return_receipt_url, '_blank')
        }
        
        // If store credit (use later), print exchange receipt
        if (returnType === 'store_credit' && result.exchange_receipt_url) {
          setTimeout(() => {
            window.open(result.exchange_receipt_url, '_blank')
          }, 500)
        }
        
        // If exchange (use now), open POS with credit
        if (returnType === 'exchange') {
          // Store exchange credit info for POS
          localStorage.setItem('exchangeCredit', JSON.stringify({
            credit_id: result.exchange_credit_id,
            amount: returnTotal,
            return_id: result.return_id
          }))
          // Navigate to POS or open in new tab
          window.open('/pos', '_blank')
        }
        
        setToast({ message: `Return processed successfully! Return #: ${result.return_number}`, type: 'success' })
        
        // Reset form
        setOrder(null)
        setOrderItems([])
        setSelectedItems({})
        setReason('')
        setNotes('')
        setReturnType(null)
        setExchangeTiming(null)
      } else {
        setToast({ message: result.message || 'Failed to process return', type: 'error' })
      }
    } catch (err) {
      setToast({ message: 'Error processing return', type: 'error' })
      console.error(err)
    } finally {
      setReturnLoading(false)
    }
  }

  const handleRowClick = async (row) => {
    const orderId = row.order_id || row.orderId
    if (!orderId) return

    // Normalize orderId for consistency
    const normalizedOrderId = parseInt(orderId)
    if (isNaN(normalizedOrderId)) return

    // Toggle expansion
    if (expandedRow === normalizedOrderId) {
      setExpandedRow(null)
      return
    }

    setExpandedRow(normalizedOrderId)

    // If we already have the details, don't fetch again
    if (orderDetails[normalizedOrderId]) {
      return
    }

      // Fetch order details
      setLoadingDetails(prev => ({ ...prev, [normalizedOrderId]: true }))
    try {
      // Fetch order items
      const itemsResponse = await fetch('/api/order_items')
      const itemsResult = await itemsResponse.json()
      const items = itemsResult.data || []
      
      // Filter items for this order (normalize both sides for comparison)
      const orderItems = items.filter(item => {
        const itemOrderId = item.order_id || item.orderId
        return parseInt(itemOrderId) === normalizedOrderId
      })

      // Get order details from the row data
      const details = {
        employee_id: row.employee_id || row.employeeId || null,
        customer_id: row.customer_id || row.customerId || null,
        subtotal: parseFloat(row.subtotal) || 0,
        tax_rate: parseFloat(row.tax_rate) || 0,
        tax_amount: parseFloat(row.tax_amount || row.tax) || 0,
        discount: parseFloat(row.discount) || 0,
        transaction_fee: parseFloat(row.transaction_fee) || 0,
        notes: row.notes || '',
        tip: parseFloat(row.tip) || 0,
        items: orderItems
      }

      // Update orderItemsMap for filtering FIRST (normalize orderId to number)
      // This ensures the filtering logic can find the items immediately
      if (!isNaN(normalizedOrderId) && orderItems.length > 0) {
        setOrderItemsMap(prev => ({
          ...prev,
          [normalizedOrderId]: orderItems
        }))
      }

      // Store orderDetails with normalized orderId for consistency
      setOrderDetails(prev => ({ ...prev, [normalizedOrderId]: details }))
    } catch (err) {
      console.error('Error loading order details:', err)
    } finally {
      setLoadingDetails(prev => ({ ...prev, [normalizedOrderId]: false }))
    }
  }

  // Add Actions column to the data
  const processedData = data && data.data ? data.data.map(row => ({
    ...row,
    _actions: row // Store the full row for actions
  })) : []

  const handleBarcodeScan = async (barcode) => {
    try {
      const scannedBarcode = barcode.toString().trim()
      console.log('Scanned barcode:', scannedBarcode, 'Length:', scannedBarcode.length)
      
      // First, check if barcode matches an order number (receipt barcode)
      // Try to parse as order_id first (if numeric)
      const orderIdMatch = parseInt(scannedBarcode)
      let matchingOrder = null
      
      if (!isNaN(orderIdMatch)) {
        // Try searching by order_id
        try {
          const orderIdResponse = await fetch(`/api/orders/search?order_id=${orderIdMatch}`)
          const orderIdResult = await orderIdResponse.json()
          if (orderIdResult.data && orderIdResult.data.length > 0) {
            matchingOrder = orderIdResult.data[0]
            console.log('Found order by order_id:', matchingOrder.order_id)
          }
        } catch (err) {
          console.log('Error searching by order_id:', err)
        }
      }
      
      // If not found by order_id, try searching by order_number
      if (!matchingOrder) {
        try {
          const orderNumResponse = await fetch(`/api/orders/search?order_number=${encodeURIComponent(scannedBarcode)}`)
          const orderNumResult = await orderNumResponse.json()
          if (orderNumResult.data && orderNumResult.data.length > 0) {
            // Try exact match first
            matchingOrder = orderNumResult.data.find(o => {
              if (!o.order_number) return false
              const orderNum = o.order_number.toString().trim()
              return orderNum === scannedBarcode || orderNum.toLowerCase() === scannedBarcode.toLowerCase()
            })
            
            // If no exact match, use first result (partial match)
            if (!matchingOrder && orderNumResult.data.length > 0) {
              matchingOrder = orderNumResult.data[0]
            }
          }
        } catch (err) {
          console.log('Error searching by order_number:', err)
        }
      }
      
      if (matchingOrder) {
        console.log('Found matching order:', matchingOrder.order_number, 'ID:', matchingOrder.order_id)
        // Found order by receipt barcode - filter table to show only this order
        setToast({ message: `Found order: ${matchingOrder.order_number}`, type: 'success' })
        
        // Add order to data if not already present
        if (data && data.data) {
          const orderExists = data.data.some(o => o.order_id === matchingOrder.order_id)
          if (!orderExists) {
            // Add to the beginning of the list
            setData(prev => ({
              ...prev,
              data: [matchingOrder, ...(prev.data || [])]
            }))
          }
        }
        
        // Filter table to show only this order
        setScannedOrderId(matchingOrder.order_id)
        
        // Highlight the order in the table
        setHighlightedOrderId(matchingOrder.order_id)
        setTimeout(() => setHighlightedOrderId(null), 5000) // Remove highlight after 5 seconds
        
        // Don't open the modal - just show the order in the table
        setShowBarcodeScanner(false)
        return
      }
      
      // If not an order number, try to find product by barcode
      const inventoryResponse = await fetch('/api/inventory')
      const inventoryResult = await inventoryResponse.json()
      
      let product = null
      if (inventoryResult.data) {
        // Try to find by barcode first (exact match)
        product = inventoryResult.data.find(p => 
          p.barcode && p.barcode.toString().trim() === barcode.toString().trim()
        )
        
        // If not found and barcode is 13 digits (EAN13), try without leading 0 (12 digits)
        if (!product && barcode.length === 13 && barcode.startsWith('0')) {
          const barcode12 = barcode.substring(1)
          product = inventoryResult.data.find(p => 
            p.barcode && p.barcode.toString().trim() === barcode12
          )
        }
        
        // If not found and barcode is 12 digits, try with leading 0 (13 digits)
        if (!product && barcode.length === 12) {
          const barcode13 = '0' + barcode
          product = inventoryResult.data.find(p => 
            p.barcode && (p.barcode.toString().trim() === barcode13 || p.barcode.toString().trim() === barcode)
          )
        }
        
        // If not found by barcode, try by SKU
        if (!product) {
          product = inventoryResult.data.find(p => 
            p.sku && p.sku.toString().trim() === barcode.toString().trim()
          )
        }
        
        if (product) {
          // Check if product is already scanned
          const alreadyScanned = scannedProducts.some(sp => 
            sp.product_id === product.product_id || sp.sku === product.sku
          )
          
          if (!alreadyScanned) {
            setScannedProducts(prev => [...prev, {
              product_id: product.product_id,
              product_name: product.product_name,
              sku: product.sku,
              barcode: product.barcode
            }])
            setToast({ message: `Added ${product.product_name} to filter`, type: 'success' })
          } else {
            setToast({ message: `${product.product_name} already scanned`, type: 'success' })
          }
          // Keep scanner open for continuous scanning
          return
        }
      }
      
      // Neither order nor product found
      // Check if it looks like it could be an order number (numeric or alphanumeric)
      const looksLikeOrderNumber = /^[A-Z0-9-]+$/i.test(scannedBarcode) && scannedBarcode.length >= 3
      
      if (looksLikeOrderNumber) {
        setToast({ message: `Order or product with barcode "${barcode}" not found. Please check the barcode and try again.`, type: 'error' })
      } else {
        setToast({ message: `Product with barcode "${barcode}" not found`, type: 'error' })
      }
      
    } catch (err) {
      console.error('Barcode scan error:', err)
      setToast({ message: 'Error processing barcode scan', type: 'error' })
    }
  }

  const removeScannedProduct = (productId) => {
    setScannedProducts(prev => prev.filter(sp => sp.product_id !== productId))
  }

  const clearScannedProducts = () => {
    setScannedProducts([])
  }

  const clearScannedOrder = () => {
    setScannedOrderId(null)
    setHighlightedOrderId(null)
  }

  // Filter data based on search query, order type, scanned order, and scanned products
  let filteredData = processedData

  // First, filter by scanned order (receipt barcode) - show only that order
  if (scannedOrderId) {
    filteredData = filteredData.filter(row => {
      const orderId = row.order_id || row.orderId
      return orderId === scannedOrderId
    })
  }

  // Then filter by order type (skip if 'all' is selected)
  if (selectedOrderType !== 'all') {
    filteredData = filteredData.filter(row => {
      const rowOrderType = row.order_type || row.orderType
      if (selectedOrderType === 'in-person') {
        // In-person orders have null or empty order_type
        if (rowOrderType !== null && rowOrderType !== undefined && rowOrderType !== '') {
          return false
        }
      } else {
        // Pickup or delivery orders
        if (rowOrderType !== selectedOrderType) {
          return false
        }
      }
      return true
    })
  }

  // Then filter by scanned products (orders that contain any of the scanned products)
  if (scannedProducts.length > 0) {
    filteredData = filteredData.filter(row => {
      const orderId = row.order_id || row.orderId
      if (!orderId) return false
      
      // Normalize orderId to number for consistent lookups
      const normalizedOrderId = parseInt(orderId)
      if (isNaN(normalizedOrderId)) return false
      
      // If row is expanded, keep it visible (items are being loaded)
      if (expandedRow === normalizedOrderId) {
        return true
      }
      
      // Check order items map first
      const items = orderItemsMap[normalizedOrderId]
      if (items && items.length > 0) {
        const matches = scannedProducts.some(scanned => {
          const found = items.some(item => {
            const itemProductId = item.product_id || item.productId
            const itemSku = (item.sku || '').toString().trim()
            const itemBarcode = (item.barcode || '').toString().trim()
            const scannedSku = (scanned.sku || '').toString().trim()
            const scannedBarcode = (scanned.barcode || '').toString().trim()
            
            const productIdMatch = itemProductId === scanned.product_id
            const skuMatch = itemSku && scannedSku && itemSku === scannedSku
            const barcodeMatch = itemBarcode && scannedBarcode && itemBarcode === scannedBarcode
            
            return productIdMatch || skuMatch || barcodeMatch
          })
          if (found) {
            console.log('Match found for scanned product:', scanned.product_name, 'in order:', normalizedOrderId)
          }
          return found
        })
        return matches
      }
      
      // Check order details if available
      if (orderDetails[normalizedOrderId] && orderDetails[normalizedOrderId].items) {
        const items = orderDetails[normalizedOrderId].items
        const matches = scannedProducts.some(scanned => {
          const found = items.some(item => {
            const itemProductId = item.product_id || item.productId
            const itemSku = (item.sku || '').toString().trim()
            const itemBarcode = (item.barcode || '').toString().trim()
            const scannedSku = (scanned.sku || '').toString().trim()
            const scannedBarcode = (scanned.barcode || '').toString().trim()
            
            const productIdMatch = itemProductId === scanned.product_id
            const skuMatch = itemSku && scannedSku && itemSku === scannedSku
            const barcodeMatch = itemBarcode && scannedBarcode && itemBarcode === scannedBarcode
            
            return productIdMatch || skuMatch || barcodeMatch
          })
          if (found) {
            console.log('Match found in orderDetails for scanned product:', scanned.product_name, 'in order:', normalizedOrderId)
          }
          return found
        })
        return matches
      }
      
      // Check allOrderItems as fallback
      const orderItems = allOrderItems.filter(item => {
        const itemOrderId = item.order_id || item.orderId
        return parseInt(itemOrderId) === normalizedOrderId
      })
      if (orderItems.length > 0) {
        const matches = scannedProducts.some(scanned => {
          const found = orderItems.some(item => {
            const itemProductId = item.product_id || item.productId
            const itemSku = (item.sku || '').toString().trim()
            const itemBarcode = (item.barcode || '').toString().trim()
            const scannedSku = (scanned.sku || '').toString().trim()
            const scannedBarcode = (scanned.barcode || '').toString().trim()
            
            const productIdMatch = itemProductId === scanned.product_id
            const skuMatch = itemSku && scannedSku && itemSku === scannedSku
            const barcodeMatch = itemBarcode && scannedBarcode && itemBarcode === scannedBarcode
            
            return productIdMatch || skuMatch || barcodeMatch
          })
          if (found) {
            console.log('Match found in allOrderItems for scanned product:', scanned.product_name, 'in order:', normalizedOrderId)
          }
          return found
        })
        return matches
      }
      
      // If we don't have items loaded yet, include it (will be filtered when items load)
      return true
    })
  }

  // Finally, filter by search query
  if (searchQuery) {
    filteredData = filteredData.filter(row => {
      const orderId = row.order_id || row.orderId
      const query = searchQuery.toLowerCase()
      
      // First check if search matches order fields directly
      const matchesOrderFields = Object.values(row).some(value => {
        if (value === null || value === undefined) return false
        return String(value).toLowerCase().includes(query)
      })
      
      // If not found in order fields, check order items
      if (!matchesOrderFields && orderId) {
        // Check order items map first
        const items = orderItemsMap[orderId] || []
        if (items.length === 0) {
          // Fallback to allOrderItems
          const orderItems = allOrderItems.filter(item => 
            (item.order_id || item.orderId) === orderId
          )
          
          const matchesItems = orderItems.some(item => {
            const productName = (item.product_name || '').toLowerCase()
            const sku = (item.sku || '').toLowerCase()
            return productName.includes(query) || sku.includes(query)
          })
          
          return matchesItems
        } else {
          const matchesItems = items.some(item => {
            const productName = (item.product_name || '').toLowerCase()
            const sku = (item.sku || '').toLowerCase()
            return productName.includes(query) || sku.includes(query)
          })
          return matchesItems
        }
      }
      
      return matchesOrderFields
    })
  }

  // Fields to hide from main table (shown in dropdown)
  const hiddenFields = ['order_id', 'orderId', 'employee_id', 'employeeId', 'customer_id', 'customerId', 'subtotal', 'tax_rate', 'tax_amount', 'tax', 'discount', 'transaction_fee', 'notes', 'tip']
  
  // Filter out hidden fields from columns
  const visibleColumns = data && data.columns ? data.columns.filter(col => !hiddenFields.includes(col)) : []
  const columnsWithActions = [...visibleColumns, 'Actions']

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto', backgroundColor: '#ffffff', minHeight: '100vh' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ 
            position: 'relative', 
            flex: 1, 
            minWidth: '200px',
            display: 'flex',
            alignItems: 'center'
          }}>
            {/* Chips Container - Inside search input */}
            <div
              ref={(el) => {
                chipsContainerRef.current = el
                if (el) {
                  // Update input padding based on chips container width
                  const chipsWidth = el.offsetWidth
                  const input = el.nextElementSibling
                  if (input) {
                    input.style.paddingLeft = chipsWidth > 0 ? `${chipsWidth + 12}px` : '0'
                  }
                }
              }}
              style={{
                position: 'absolute',
                left: '0',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
                maxWidth: 'calc(100% - 60px)',
                pointerEvents: 'auto',
                marginLeft: '4px'
              }}
            >
              {/* Scanned Order Chip (Receipt Barcode) */}
              {scannedOrderId && (
                <div 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
                    border: `1px solid rgba(${themeColorRgb}, 0.4)`,
                    borderRadius: '20px',
                    fontSize: '12px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    whiteSpace: 'nowrap',
                    height: '24px',
                    lineHeight: '16px',
                    userSelect: 'none'
                  }}>
                  <span>
                    {data?.data?.find(o => o.order_id === scannedOrderId)?.order_number || `Order #${scannedOrderId}`}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      clearScannedOrder()
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      cursor: 'pointer',
                      padding: '0',
                      marginLeft: '2px',
                      fontSize: '14px',
                      lineHeight: '1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent'
                    }}
                    title="Show all orders"
                  >
                    ×
                  </button>
                </div>
              )}
              
              {/* Scanned Products Chips */}
              {scannedProducts.map((product) => (
                <div
                  key={product.product_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
                    border: `1px solid rgba(${themeColorRgb}, 0.4)`,
                    borderRadius: '20px',
                    fontSize: '12px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    whiteSpace: 'nowrap',
                    height: '24px',
                    lineHeight: '16px',
                    userSelect: 'none',
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {product.product_name || product.sku}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      removeScannedProduct(product.product_id)
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      cursor: 'pointer',
                      padding: '0',
                      marginLeft: '2px',
                      fontSize: '14px',
                      lineHeight: '1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      transition: 'background-color 0.2s',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent'
                    }}
                    title="Remove filter"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            
            <input
              type="text"
              placeholder={(scannedOrderId || scannedProducts.length > 0) ? "" : "Search orders by order number, customer, or items..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={(e) => {
                // Ensure cursor is at the end when focusing
                const len = e.target.value.length
                setTimeout(() => {
                  e.target.setSelectionRange(len, len)
                }, 0)
              }}
              onMouseDown={(e) => {
                // Prevent clicking inside the chips area
                const chipsContainer = e.target.previousElementSibling
                if (chipsContainer) {
                  const chipsRect = chipsContainer.getBoundingClientRect()
                  const inputRect = e.target.getBoundingClientRect()
                  const clickX = e.clientX - inputRect.left
                  const chipsEnd = chipsRect.right - inputRect.left + 12
                  if (clickX < chipsEnd) {
                    e.preventDefault()
                    const len = e.target.value.length
                    setTimeout(() => {
                      e.target.focus()
                      e.target.setSelectionRange(len, len)
                    }, 0)
                  }
                }
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                paddingLeft: '0',
                border: 'none',
                borderBottom: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #ddd',
                borderRadius: '0',
                backgroundColor: 'transparent',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontFamily: '"Product Sans", sans-serif',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                transition: 'padding-left 0.2s ease',
                position: 'relative',
                zIndex: 1
              }}
            />
          </div>
          <button
            onClick={() => setShowBarcodeScanner(true)}
            style={{
              padding: '4px',
              width: '40px',
              height: '40px',
              backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
              e.target.style.boxShadow = `0 4px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
              e.target.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }}
            title="Scan barcode to filter by product or find order by receipt"
          >
            <ScanBarcode size={24} />
          </button>
        </div>
        
        {/* Order Type Filters */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={() => setSelectedOrderType('all')}
            style={{
              padding: '6px 16px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              backgroundColor: selectedOrderType === 'all' 
                ? `rgba(${themeColorRgb}, 0.7)` 
                : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
              border: selectedOrderType === 'all' 
                ? `1px solid rgba(${themeColorRgb}, 0.5)` 
                : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: selectedOrderType === 'all' ? 600 : 500,
              color: selectedOrderType === 'all' ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: selectedOrderType === 'all' ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
            }}
          >
            All
          </button>
          <button
            onClick={() => setSelectedOrderType(selectedOrderType === 'pickup' ? 'all' : 'pickup')}
            style={{
              padding: '6px 16px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              backgroundColor: selectedOrderType === 'pickup' 
                ? `rgba(${themeColorRgb}, 0.7)` 
                : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
              border: selectedOrderType === 'pickup' 
                ? `1px solid rgba(${themeColorRgb}, 0.5)` 
                : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: selectedOrderType === 'pickup' ? 600 : 500,
              color: selectedOrderType === 'pickup' ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: selectedOrderType === 'pickup' ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
            }}
          >
            Pickup
          </button>
          <button
            onClick={() => setSelectedOrderType(selectedOrderType === 'delivery' ? 'all' : 'delivery')}
            style={{
              padding: '6px 16px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              backgroundColor: selectedOrderType === 'delivery' 
                ? `rgba(${themeColorRgb}, 0.7)` 
                : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
              border: selectedOrderType === 'delivery' 
                ? `1px solid rgba(${themeColorRgb}, 0.5)` 
                : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: selectedOrderType === 'delivery' ? 600 : 500,
              color: selectedOrderType === 'delivery' ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: selectedOrderType === 'delivery' ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
            }}
          >
            Delivery
          </button>
          <button
            onClick={() => setSelectedOrderType(selectedOrderType === 'in-person' ? 'all' : 'in-person')}
            style={{
              padding: '6px 16px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              backgroundColor: selectedOrderType === 'in-person' 
                ? `rgba(${themeColorRgb}, 0.7)` 
                : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
              border: selectedOrderType === 'in-person' 
                ? `1px solid rgba(${themeColorRgb}, 0.5)` 
                : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: selectedOrderType === 'in-person' ? 600 : 500,
              color: selectedOrderType === 'in-person' ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: selectedOrderType === 'in-person' ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
            }}
          >
            In-Person
          </button>
        </div>
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
                    const normalizedOrderId = parseInt(orderId)
                    const isExpanded = expandedRow === normalizedOrderId
                    const details = orderDetails[normalizedOrderId]
                    const isLoading = loadingDetails[normalizedOrderId]
                    const isHighlighted = highlightedOrderId === normalizedOrderId

                    return (
                      <Fragment key={normalizedOrderId || idx}>
                        <tr 
                          ref={el => {
                            if (normalizedOrderId) {
                              rowRefs.current[normalizedOrderId] = el
                            }
                          }}
                          onClick={() => handleRowClick(row)}
                          style={{ 
                            backgroundColor: isHighlighted 
                              ? `rgba(${themeColorRgb}, 0.3)`
                              : (idx % 2 === 0 ? (isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff') : (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#fafafa')),
                            cursor: 'pointer',
                            border: isHighlighted ? `2px solid rgba(${themeColorRgb}, 0.7)` : 'none',
                            transition: 'all 0.3s ease'
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
                            style={{ padding: '8px 12px', borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                fetchOrderById(normalizedOrderId)
                              }}
                              style={{
                                padding: '6px 16px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                whiteSpace: 'nowrap',
                                backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                                border: `1px solid rgba(${themeColorRgb}, 0.5)`,
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3)`
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
                                e.target.style.boxShadow = `0 4px 20px rgba(${themeColorRgb}, 0.4)`
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
                                e.target.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3)`
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
                                      <strong>Subtotal:</strong> ${(parseFloat(details.subtotal) || 0).toFixed(2)}
                                    </div>
                                    <div>
                                      <strong>Tax Rate:</strong> {((parseFloat(details.tax_rate) || 0) * 100).toFixed(2)}%
                                    </div>
                                    <div>
                                      <strong>Tax Amount:</strong> ${(parseFloat(details.tax_amount) || 0).toFixed(2)}
                                    </div>
                                    <div>
                                      <strong>Discount:</strong> ${(parseFloat(details.discount) || 0).toFixed(2)}
                                    </div>
                                    <div>
                                      <strong>Transaction Fee:</strong> ${(parseFloat(details.transaction_fee) || 0).toFixed(2)}
                                    </div>
                                    <div>
                                      <strong>Tip:</strong> ${(parseFloat(details.tip) || 0).toFixed(2)}
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
                                                <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px' }}>${(parseFloat(item.unit_price) || 0).toFixed(2)}</td>
                                                <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px' }}>${(parseFloat(item.discount) || 0).toFixed(2)}</td>
                                                <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px' }}>${(parseFloat(item.subtotal) || 0).toFixed(2)}</td>
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
                      </Fragment>
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
            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
            borderRadius: '8px',
            padding: '30px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              marginBottom: '16px'
            }}>
              <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                Create Return - Order: {order.order_number}
              </h2>
            </div>

            <div style={{ marginBottom: '24px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', fontSize: '14px' }}>
              <span style={{ marginRight: '16px' }}>Date: {new Date(order.order_date).toLocaleDateString()}</span>
              <span style={{ marginRight: '16px' }}>Total: ${parseFloat(order.total || 0).toFixed(2)}</span>
              <span>Payment: {order.payment_method ? (order.payment_method === 'cash' ? 'Cash' : 'Card') : 'N/A'}</span>
            </div>

            {/* Return Type Selection */}
            <div style={{ marginBottom: '12px' }}>
              <FormField>
                <FormLabel isDarkMode={isDarkMode}>Return Type:</FormLabel>
                <div ref={returnTypeDropdownRef} style={{ position: 'relative', width: '100%' }}>
                  <button
                    type="button"
                    onClick={() => setReturnTypeDropdownOpen(!returnTypeDropdownOpen)}
                    style={{
                      ...inputBaseStyle(isDarkMode, themeColorRgb, returnTypeDropdownOpen),
                      width: '100%',
                      padding: '8px 14px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = `rgba(${themeColorRgb}, 0.5)`
                      e.target.style.boxShadow = `0 0 0 3px rgba(${themeColorRgb}, 0.1)`
                    }}
                    onBlur={(e) => {
                      setTimeout(() => {
                        if (!returnTypeDropdownOpen) {
                          e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'
                          e.target.style.boxShadow = 'none'
                        }
                      }, 200)
                    }}
                  >
                    <span style={{ color: returnType ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333') : (isDarkMode ? 'var(--text-secondary, #999)' : '#999') }}>
                      {returnType === 'exchange' ? 'Exchange' : returnType === 'store_credit' ? 'Return Store Credit' : returnType === 'refund' ? 'Refund' : 'Select return type...'}
                    </span>
                    <ChevronDown 
                      size={18} 
                      style={{ 
                        color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                        transform: returnTypeDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }} 
                    />
                  </button>
                  {returnTypeDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                      border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                      borderRadius: '8px',
                      boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
                      zIndex: 1000,
                      overflow: 'hidden'
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          setReturnType('exchange')
                          setExchangeTiming('now')
                          setReturnTypeDropdownOpen(false)
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: 'none',
                          background: returnType === 'exchange' ? `rgba(${themeColorRgb}, 0.1)` : 'none',
                          textAlign: 'left',
                          fontSize: '14px',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                          fontWeight: returnType === 'exchange' ? 600 : 400
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #1a1a1a)' : '#f5f5f5'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = returnType === 'exchange' ? `rgba(${themeColorRgb}, 0.1)` : 'transparent'
                        }}
                      >
                        Exchange
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReturnType('store_credit')
                          setExchangeTiming('later')
                          setReturnTypeDropdownOpen(false)
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: 'none',
                          background: returnType === 'store_credit' ? `rgba(${themeColorRgb}, 0.1)` : 'none',
                          textAlign: 'left',
                          fontSize: '14px',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                          fontWeight: returnType === 'store_credit' ? 600 : 400
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #1a1a1a)' : '#f5f5f5'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = returnType === 'store_credit' ? `rgba(${themeColorRgb}, 0.1)` : 'transparent'
                        }}
                      >
                        Return Store Credit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReturnType('refund')
                          setExchangeTiming(null)
                          setReturnTypeDropdownOpen(false)
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: 'none',
                          background: returnType === 'refund' ? `rgba(${themeColorRgb}, 0.1)` : 'none',
                          textAlign: 'left',
                          fontSize: '14px',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                          fontWeight: returnType === 'refund' ? 600 : 400
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #1a1a1a)' : '#f5f5f5'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = returnType === 'refund' ? `rgba(${themeColorRgb}, 0.1)` : 'transparent'
                        }}
                      >
                        Refund
                      </button>
                    </div>
                  )}
                </div>
              </FormField>
            </div>

            {orderItems.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {orderItems.map((item) => {
                        const isSelected = !!selectedItems[item.order_item_id]
                        const selectedData = selectedItems[item.order_item_id] || { quantity: 1, condition: 'new', maxQuantity: item.quantity }
                        
                        const conditionOptions = [
                          { value: 'new', label: 'New' },
                          { value: 'opened', label: 'Opened' },
                          { value: 'damaged', label: 'Damaged' },
                          { value: 'defective', label: 'Defective' }
                        ]
                        const currentCondition = isSelected ? selectedData.condition : 'new'
                        const conditionLabel = conditionOptions.find(opt => opt.value === currentCondition)?.label || 'New'
                        const isConditionDropdownOpen = openConditionDropdowns[item.order_item_id] || false
                        
                        if (!conditionDropdownRefs.current[item.order_item_id]) {
                          conditionDropdownRefs.current[item.order_item_id] = { current: null }
                        }
                        
                        return (
                          <tr key={item.order_item_id}>
                            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#f0f0f0'}`, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333', fontSize: '14px' }}>
                              {item.product_name || item.sku}
                            </td>
                            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#f0f0f0'}`, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                              <input
                                type="number"
                                min="1"
                                max={item.quantity}
                                value={isSelected ? selectedData.quantity : 1}
                                onChange={(e) => {
                                  const qty = parseInt(e.target.value) || 1
                                  if (isSelected) {
                                    updateItemQuantity(item.order_item_id, qty, item.quantity)
                                  } else {
                                    toggleItem(item.order_item_id, item.quantity)
                                    setTimeout(() => updateItemQuantity(item.order_item_id, qty, item.quantity), 0)
                                  }
                                }}
                                disabled={!isSelected}
                                style={{
                                  ...inputBaseStyle(isDarkMode, themeColorRgb),
                                  width: '60px',
                                  padding: '4px 8px',
                                  fontSize: '14px',
                                  opacity: isSelected ? 1 : 0.5
                                }}
                                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                              />
                            </td>
                            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#f0f0f0'}` }}>
                              <div ref={el => conditionDropdownRefs.current[item.order_item_id].current = el} style={{ position: 'relative', width: '100px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isSelected) {
                                      toggleItem(item.order_item_id, item.quantity)
                                    }
                                    setOpenConditionDropdowns(prev => ({ ...prev, [item.order_item_id]: !prev[item.order_item_id] }))
                                  }}
                                  disabled={!isSelected}
                                  style={{
                                    ...inputBaseStyle(isDarkMode, themeColorRgb, isConditionDropdownOpen),
                                    width: '100px',
                                    padding: '4px 8px',
                                    fontSize: '14px',
                                    cursor: isSelected ? 'pointer' : 'not-allowed',
                                    opacity: isSelected ? 1 : 0.5,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    textAlign: 'left'
                                  }}
                                  onFocus={(e) => {
                                    if (isSelected) {
                                      e.target.style.borderColor = `rgba(${themeColorRgb}, 0.5)`
                                      e.target.style.boxShadow = `0 0 0 3px rgba(${themeColorRgb}, 0.1)`
                                    }
                                  }}
                                  onBlur={(e) => {
                                    setTimeout(() => {
                                      if (!isConditionDropdownOpen && isSelected) {
                                        e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'
                                        e.target.style.boxShadow = 'none'
                                      }
                                    }, 200)
                                  }}
                                >
                                  <span style={{ fontSize: '14px' }}>{conditionLabel}</span>
                                  <ChevronDown 
                                    size={14} 
                                    style={{ 
                                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                                      transform: isConditionDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                      transition: 'transform 0.2s ease'
                                    }} 
                                  />
                                </button>
                                {isConditionDropdownOpen && isSelected && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: '4px',
                                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                                    border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                                    borderRadius: '8px',
                                    boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
                                    zIndex: 1000,
                                    overflow: 'hidden'
                                  }}>
                                    {conditionOptions.map((option) => (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                          updateItemCondition(item.order_item_id, option.value)
                                          setOpenConditionDropdowns(prev => ({ ...prev, [item.order_item_id]: false }))
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '8px 12px',
                                          border: 'none',
                                          background: currentCondition === option.value ? `rgba(${themeColorRgb}, 0.1)` : 'none',
                                          textAlign: 'left',
                                          fontSize: '14px',
                                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                          cursor: 'pointer',
                                          transition: 'background-color 0.2s ease',
                                          fontWeight: currentCondition === option.value ? 600 : 400
                                        }}
                                        onMouseEnter={(e) => {
                                          e.target.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #1a1a1a)' : '#f5f5f5'
                                        }}
                                        onMouseLeave={(e) => {
                                          e.target.style.backgroundColor = currentCondition === option.value ? `rgba(${themeColorRgb}, 0.1)` : 'transparent'
                                        }}
                                      >
                                        {option.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#f0f0f0'}`, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333', fontSize: '14px' }}>
                              ${parseFloat(item.unit_price || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#f0f0f0'}` }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleItem(item.order_item_id, item.quantity)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <FormField>
                    <FormLabel isDarkMode={isDarkMode}>Reason:</FormLabel>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for return"
                      style={inputBaseStyle(isDarkMode, themeColorRgb)}
                      {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                    />
                  </FormField>

                  {/* Return Amount Summary */}
                  {(() => {
                    let returnSubtotal = 0
                    let returnTax = 0
                    let returnProcessingFee = 0
                    
                    Object.entries(selectedItems).forEach(([itemId, data]) => {
                      const item = orderItems.find(i => i.order_item_id === parseInt(itemId))
                      if (item) {
                        const itemSubtotal = parseFloat(item.unit_price || 0) * data.quantity
                        const itemDiscount = parseFloat(item.discount || 0) * (data.quantity / item.quantity)
                        const itemSubtotalAfterDiscount = itemSubtotal - itemDiscount
                        const itemTaxRate = parseFloat(item.tax_rate || order.tax_rate || 0.08)
                        const itemTax = itemSubtotalAfterDiscount * itemTaxRate
                        
                        returnSubtotal += itemSubtotalAfterDiscount
                        returnTax += itemTax
                      }
                    })
                    
                    if (order.transaction_fee && order.subtotal) {
                      const feeRate = parseFloat(order.transaction_fee) / parseFloat(order.subtotal)
                      returnProcessingFee = returnSubtotal * feeRate
                    }
                    
                    const returnTotal = returnSubtotal + returnTax - returnProcessingFee
                    
                    return (
                      <div style={{ 
                        marginTop: '24px',
                        marginBottom: '24px', 
                        padding: '16px', 
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f8f9fa',
                        borderRadius: '8px'
                      }}>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '1fr auto', 
                          gap: '8px',
                          fontSize: '14px',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                        }}>
                          <span>Return Subtotal:</span>
                          <span style={{ fontWeight: 500 }}>${returnSubtotal.toFixed(2)}</span>
                          <span>Return Tax:</span>
                          <span style={{ fontWeight: 500 }}>${returnTax.toFixed(2)}</span>
                          {returnProcessingFee > 0 && (
                            <>
                              <span>Processing Fee (non-refundable):</span>
                              <span style={{ fontWeight: 500, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>-${returnProcessingFee.toFixed(2)}</span>
                            </>
                          )}
                          <div style={{ 
                            gridColumn: '1 / -1', 
                            borderTop: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                            marginTop: '8px',
                            paddingTop: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span style={{ fontWeight: 600, fontSize: '16px' }}>Refund Amount:</span>
                            <span style={{ fontWeight: 700, fontSize: '18px', color: `rgb(${themeColorRgb})` }}>${returnTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setOrder(null)
                        setOrderItems([])
                        setSelectedItems({})
                        setReason('')
                        setNotes('')
                        setReturnType(null)
                        setExchangeTiming(null)
                      }}
                      disabled={returnLoading}
                      style={{
                        padding: '4px 16px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                        cursor: returnLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: 'none'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createReturn}
                      disabled={returnLoading || Object.keys(selectedItems).length === 0 || !returnType}
                      style={{
                        padding: '4px 16px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap',
                        backgroundColor: returnLoading || Object.keys(selectedItems).length === 0 || !returnType || (returnType === 'exchange' && !exchangeTiming) ? '#ccc' : `rgba(${themeColorRgb}, 0.7)`,
                        border: `1px solid rgba(${themeColorRgb}, 0.5)`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#fff',
                        cursor: returnLoading || Object.keys(selectedItems).length === 0 || !returnType || (returnType === 'exchange' && !exchangeTiming) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3)`
                      }}
                    >
                      {returnLoading ? 'Processing...' : 'Process Return'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowBarcodeScanner(false)}
          themeColor={themeColor}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 20px',
            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
            border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
            borderRadius: '12px',
            boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.15)',
            zIndex: 10001,
            fontSize: '14px',
            fontWeight: 500,
            maxWidth: '90vw'
          }}
        >
          {toast.type === 'error' ? (
            <XCircle size={20} style={{ flexShrink: 0, color: '#d32f2f' }} />
          ) : (
            <CheckCircle size={20} style={{ flexShrink: 0, color: `rgb(${themeColorRgb})` }} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}

export default RecentOrders

