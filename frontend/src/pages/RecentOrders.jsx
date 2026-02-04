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
  const [scannerExpanded, setScannerExpanded] = useState(false) // for smooth open/close animation
  const [selectedStatus, setSelectedStatus] = useState('all') // 'all' | 'in_progress' | 'out_for_delivery' | 'completed'
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const filterDropdownRef = useRef(null)
  // Extra filters (sent to API): returns, canceled, order types (Out for delivery is a top chip, delivery-only)
  const [filterReturns, setFilterReturns] = useState(false)
  const [filterCanceled, setFilterCanceled] = useState(false)
  const [filterOrderTypePickup, setFilterOrderTypePickup] = useState(false)
  const [filterOrderTypeDelivery, setFilterOrderTypeDelivery] = useState(false)
  const [filterOrderTypeInPerson, setFilterOrderTypeInPerson] = useState(false)
  const [allOrderItems, setAllOrderItems] = useState([]) // Cache all order items for searching
  const [scannedProducts, setScannedProducts] = useState([]) // Array of {product_id, product_name, sku, barcode}
  const [orderItemsMap, setOrderItemsMap] = useState({}) // Map of order_id -> order items
  const [highlightedOrderId, setHighlightedOrderId] = useState(null) // Order ID to highlight in table
  const [scannedOrderId, setScannedOrderId] = useState(null) // Order ID from scanned receipt barcode (filters table to show only this order)
  const [toast, setToast] = useState(null) // { message, type: 'success' | 'error' }
  const [statusUpdatingOrderId, setStatusUpdatingOrderId] = useState(null) // order_id while PATCH status in progress
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

  const MOBILE_BREAKPOINT = 768
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

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
    loadOrderItems()
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

  useEffect(() => {
    loadData()
  }, [filterReturns, filterCanceled, filterOrderTypePickup, filterOrderTypeDelivery, filterOrderTypeInPerson])

  // Smooth scanner open: expand after mount (mobile inline only)
  useEffect(() => {
    if (showBarcodeScanner && isMobile) {
      const id = setTimeout(() => setScannerExpanded(true), 50)
      return () => clearTimeout(id)
    } else if (!showBarcodeScanner) {
      setScannerExpanded(false)
    }
  }, [showBarcodeScanner, isMobile])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (returnTypeDropdownRef.current && !returnTypeDropdownRef.current.contains(event.target)) {
        setReturnTypeDropdownOpen(false)
      }
      if (exchangeTimingDropdownRef.current && !exchangeTimingDropdownRef.current.contains(event.target)) {
        setExchangeTimingDropdownOpen(false)
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setFilterDropdownOpen(false)
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
    const params = new URLSearchParams()
    params.set('limit', '100')
    const statusIn = []
    if (filterReturns) statusIn.push('returned')
    if (filterCanceled) statusIn.push('voided')
    if (statusIn.length) params.set('order_status_in', statusIn.join(','))
    const typeIn = []
    if (filterOrderTypePickup) typeIn.push('pickup')
    if (filterOrderTypeDelivery) typeIn.push('delivery')
    if (filterOrderTypeInPerson) typeIn.push('in-person')
    if (typeIn.length) params.set('order_type_in', typeIn.join(','))
    const query = params.toString()
    const url = query ? `/api/orders?${query}` : '/api/orders?limit=100'
    try {
      const response = await fetch(url)
      const result = await response.json()
      if (result.data) {
        result.data = result.data.slice(0, 100)
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
        employee_name: row.employee_name ?? null,
        establishment_id: row.establishment_id ?? null,
        customer_id: row.customer_id || row.customerId || null,
        subtotal: parseFloat(row.subtotal) || 0,
        tax_rate: parseFloat(row.tax_rate) || 0,
        tax_amount: parseFloat(row.tax_amount || row.tax) || 0,
        discount: parseFloat(row.discount) || 0,
        transaction_fee: parseFloat(row.transaction_fee) || 0,
        notes: row.notes || '',
        tip: parseFloat(row.tip) || 0,
        order_status: row.order_status ?? 'completed',
        payment_status: row.payment_status ?? 'completed',
        order_type: row.order_type ?? row.orderType ?? null,
        receipt_type: row.receipt_type ?? null,
        receipt_email: row.receipt_email ?? null,
        receipt_phone: row.receipt_phone ?? null,
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

  const updateOrderStatus = async (orderId, order_status, payment_status = null, payment_method = null) => {
    setStatusUpdatingOrderId(orderId)
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({
          order_status,
          ...(payment_status != null && { payment_status }),
          ...(payment_method != null && { payment_method })
        })
      })
      const result = await res.json()
      if (result.success) {
        setToast({ message: 'Status updated', type: 'success' })
        await loadData()
        setOrderDetails(prev => ({
          ...prev,
          [orderId]: prev[orderId] ? {
            ...prev[orderId],
            order_status,
            payment_status: payment_status ?? prev[orderId].payment_status,
            payment_method: payment_method ?? prev[orderId].payment_method
          } : prev[orderId]
        }))
      } else {
        setToast({ message: result.message || 'Failed to update status', type: 'error' })
      }
    } catch (err) {
      console.error(err)
      setToast({ message: 'Failed to update status', type: 'error' })
    } finally {
      setStatusUpdatingOrderId(null)
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

  // Filter data based on search query, order status, scanned order, and scanned products
  let filteredData = processedData

  // First, filter by scanned order (receipt barcode) - show only that order
  if (scannedOrderId) {
    filteredData = filteredData.filter(row => {
      const orderId = row.order_id || row.orderId
      return orderId === scannedOrderId
    })
  }

  // Progress chips: In progress = placed, being_made, ready (before "Start delivery"). Out for delivery = out_for_delivery (delivery orders only). Completed = voided, paid, delivered, returned.
  const IN_PROGRESS_STATUSES = ['placed', 'being_made', 'ready']
  const isOrderInProgress = (orderStatus) => IN_PROGRESS_STATUSES.includes((orderStatus || 'completed').toLowerCase())
  if (selectedStatus !== 'all') {
    filteredData = filteredData.filter(row => {
      const rowStatus = (row.order_status || row.orderStatus || 'completed').toLowerCase()
      const rowType = (row.order_type || row.orderType || '').toLowerCase()
      if (selectedStatus === 'in_progress') return isOrderInProgress(rowStatus)
      if (selectedStatus === 'out_for_delivery') return rowStatus === 'out_for_delivery' && rowType === 'delivery'
      if (selectedStatus === 'completed') return !isOrderInProgress(rowStatus) && rowStatus !== 'out_for_delivery'
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

  // Format date/time: "Today 2:30 PM", "Yesterday 2:30 PM", or full date
  const formatOrderDate = (value) => {
    try {
      const date = new Date(value)
      if (isNaN(date.getTime())) return String(value)
      const now = new Date()
      const orderDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
      const todayDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const oneDayMs = 24 * 60 * 60 * 1000
      const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
      if (orderDayStart === todayDayStart) return `Today ${timeStr}`
      if (orderDayStart === todayDayStart - oneDayMs) return `Yesterday ${timeStr}`
      return date.toLocaleString()
    } catch {
      return String(value)
    }
  }

  // Fields to hide from main table (shown in dropdown); order_status/payment_* combined into Status column
  const hiddenFields = ['order_id', 'orderId', 'employee_id', 'employeeId', 'customer_id', 'customerId', 'subtotal', 'tax_rate', 'tax_amount', 'tax', 'discount', 'transaction_fee', 'notes', 'tip', 'receipt_type', 'receipt_email', 'receipt_phone', 'establishment_id', 'employee_name', 'order_status', 'payment_status', 'payment_method']
  
  // Phase label for order_status (pickup/delivery flow)
  const getStatusLabel = (orderStatus, orderType) => {
    const s = (orderStatus || 'completed').toLowerCase()
    const type = (orderType || '').toLowerCase()
    if (s === 'placed') return 'Placed'
    if (s === 'being_made') return 'Being made'
    if (s === 'ready') return type === 'pickup' ? 'Ready for pickup' : 'Ready'
    if (s === 'out_for_delivery') return 'Out for delivery'
    if (s === 'delivered') return 'Delivered'
    if (s === 'completed') return 'Paid'
    if (s === 'voided') return 'Voided'
    if (s === 'returned') return 'Returned'
    return (orderStatus || 'Paid').replace(/_/g, ' ')
  }
  const getStatusDisplay = (row) => {
    // Support both snake_case (API) and camelCase
    const orderType = ((row.order_type ?? row.orderType) ?? '').toLowerCase()
    const paymentStatus = ((row.payment_status ?? row.paymentStatus) ?? 'completed').toLowerCase()
    const orderStatus = ((row.order_status ?? row.orderStatus) ?? 'completed').toLowerCase()
    const label = getStatusLabel(orderStatus, orderType)
    const isPickupOrDelivery = orderType === 'pickup' || orderType === 'delivery'
    const paymentPending = paymentStatus === 'pending'
    const isUnpaidPhase = ['placed', 'being_made', 'ready', 'out_for_delivery', 'delivered'].includes(orderStatus)
    const needsPayment = isPickupOrDelivery && (paymentPending || (isUnpaidPhase && paymentStatus !== 'completed'))
    return needsPayment ? `${label} • Needs payment` : label
  }

  // Filter out hidden fields and insert Status column (replacing order_status / payment_method)
  const baseVisible = data && data.columns ? data.columns.filter(col => !hiddenFields.includes(col)) : []
  const orderNumIdx = baseVisible.indexOf('order_number')
  const visibleColumns = orderNumIdx >= 0
    ? [...baseVisible.slice(0, orderNumIdx + 1), 'Status', ...baseVisible.slice(orderNumIdx + 1)]
    : ['Status', ...baseVisible]
  const columnsWithActions = [...visibleColumns, 'Actions']

  const pagePadding = isMobile ? '12px' : '40px'
  const pageMaxWidth = isMobile ? '100%' : '1400px'

  return (
    <div style={{ padding: pagePadding, maxWidth: pageMaxWidth, margin: '0 auto', backgroundColor: isDarkMode ? 'var(--bg-primary)' : '#ffffff', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: isMobile ? '12px' : '20px', paddingTop: isMobile ? '12px' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', flexWrap: 'wrap' }}>
          <div style={{ 
            position: 'relative', 
            flex: 1, 
            minWidth: isMobile ? '0' : '200px',
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
              width: isMobile ? '36px' : '40px',
              height: isMobile ? '36px' : '40px',
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
            <ScanBarcode size={isMobile ? 20 : 24} />
          </button>
        </div>
        
        {/* Order Status Filters */}
        {(() => {
          const statusFilters = [
            { value: 'all', label: 'All' },
            { value: 'in_progress', label: 'In progress' },
            { value: 'out_for_delivery', label: 'Out for delivery' },
            { value: 'completed', label: 'Completed' }
          ]
            return (
            <div style={{ display: 'flex', gap: isMobile ? '6px' : '8px', marginTop: isMobile ? '8px' : '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              {statusFilters.map(({ value, label }) => {
                const isSelected = selectedStatus === value
                return (
                  <button
                    key={value}
                    onClick={() => setSelectedStatus(value === 'all' ? 'all' : (isSelected ? 'all' : value))}
                    style={{
                      padding: isMobile ? '5px 12px' : '6px 16px',
                      height: isMobile ? '28px' : '32px',
                      display: 'flex',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                      fontSize: isMobile ? '13px' : '14px',
                      backgroundColor: isSelected
                        ? `rgba(${themeColorRgb}, 0.7)`
                        : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                      border: isSelected
                        ? `1px solid rgba(${themeColorRgb}, 0.5)`
                        : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: isSelected ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
                    }}
                  >
                    {label}
                  </button>
                )
              })}
              {/* Filter button with dropdown */}
              <div ref={filterDropdownRef} style={{ position: 'relative', marginLeft: isMobile ? '0' : 'auto' }}>
                <button
                  type="button"
                  onClick={() => setFilterDropdownOpen(prev => !prev)}
                  style={{
                    padding: isMobile ? '5px 10px' : '6px 14px',
                    height: isMobile ? '28px' : '32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    fontSize: isMobile ? '13px' : '14px',
                    backgroundColor: (filterReturns || filterCanceled || filterOrderTypePickup || filterOrderTypeDelivery || filterOrderTypeInPerson)
                      ? `rgba(${themeColorRgb}, 0.5)`
                      : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                    border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    cursor: 'pointer'
                  }}
                >
                  Filter
                </button>
                {filterDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '6px',
                      minWidth: '220px',
                      padding: '12px',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                      border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                      borderRadius: '8px',
                      boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 1000
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary, #aaa)' : '#666', marginBottom: '8px', textTransform: 'uppercase' }}>Status</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer', fontSize: '14px' }}>
                      <input type="checkbox" checked={filterReturns} onChange={() => setFilterReturns(v => !v)} />
                      Returns
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer', fontSize: '14px' }}>
                      <input type="checkbox" checked={filterCanceled} onChange={() => setFilterCanceled(v => !v)} />
                      Canceled
                    </label>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary, #aaa)' : '#666', marginTop: '12px', marginBottom: '8px', textTransform: 'uppercase' }}>Order type</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer', fontSize: '14px' }}>
                      <input type="checkbox" checked={filterOrderTypePickup} onChange={() => setFilterOrderTypePickup(v => !v)} />
                      Pickup
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer', fontSize: '14px' }}>
                      <input type="checkbox" checked={filterOrderTypeDelivery} onChange={() => setFilterOrderTypeDelivery(v => !v)} />
                      Delivery
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer', fontSize: '14px' }}>
                      <input type="checkbox" checked={filterOrderTypeInPerson} onChange={() => setFilterOrderTypeInPerson(v => !v)} />
                      In-person
                    </label>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Barcode Scanner - inline below filters on mobile only, smooth expand/collapse */}
      {(showBarcodeScanner || scannerExpanded) && isMobile && (
        <div
          style={{
            maxHeight: scannerExpanded ? '420px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.35s ease-out',
            marginBottom: scannerExpanded ? '16px' : '0',
            transitionProperty: 'max-height, margin-bottom'
          }}
          onTransitionEnd={() => {
            if (!scannerExpanded) setShowBarcodeScanner(false)
          }}
        >
          {showBarcodeScanner && (
            <BarcodeScanner
              onScan={handleBarcodeScan}
              onClose={() => setScannerExpanded(false)}
              themeColor={themeColor}
              inline
            />
          )}
        </div>
      )}

      {/* Barcode Scanner - modal overlay on desktop */}
      {showBarcodeScanner && !isMobile && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowBarcodeScanner(false)}
          themeColor={themeColor}
        />
      )}

      <div style={{ overflowX: 'auto' }}>
        {loading && <div style={{ padding: isMobile ? '24px' : '40px', textAlign: 'center', color: isDarkMode ? '#999' : '#999' }}>Loading...</div>}
        {error && <div style={{ padding: isMobile ? '24px' : '40px', textAlign: 'center', color: isDarkMode ? '#e57373' : '#c62828' }}>{error}</div>}
        {!loading && !error && data && (
          data.data && data.data.length > 0 ? (
            isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredData.map((row, idx) => {
                  const orderId = row.order_id || row.orderId
                  const normalizedOrderId = parseInt(orderId)
                  const isExpanded = expandedRow === normalizedOrderId
                  const details = orderDetails[normalizedOrderId]
                  const isLoading = loadingDetails[normalizedOrderId]
                  const isHighlighted = highlightedOrderId === normalizedOrderId
                  const totalVal = row.total != null ? row.total : (row.subtotal != null ? row.subtotal : 0)
                  const totalStr = typeof totalVal === 'number' ? `$${totalVal.toFixed(2)}` : `$${parseFloat(totalVal || 0).toFixed(2)}`
                  return (
                    <div
                      key={normalizedOrderId || idx}
                      onClick={() => handleRowClick(row)}
                      style={{
                        backgroundColor: isHighlighted ? `rgba(${themeColorRgb}, 0.2)` : (isDarkMode ? 'var(--bg-secondary)' : '#fff'),
                        borderRadius: '10px',
                        padding: '14px',
                        boxShadow: isDarkMode ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.08)',
                        border: isHighlighted ? `2px solid rgba(${themeColorRgb}, 0.6)` : (isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee'),
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>
                          {row.order_number || `#${orderId}`}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: `rgba(${themeColorRgb}, 1)` }}>{totalStr}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#666' }}>
                          {formatOrderDate(row.order_date || row.orderDate || '')}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>
                          {getStatusDisplay(row)}
                        </span>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee' }}>
                          {isLoading ? (
                            <div style={{ textAlign: 'center', padding: '12px', color: isDarkMode ? '#999' : '#999', fontSize: '13px' }}>Loading...</div>
                          ) : details ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: isDarkMode ? 'var(--text-secondary)' : '#666' }}>Subtotal</span>
                                <span>${(parseFloat(details.subtotal) || 0).toFixed(2)}</span>
                              </div>
                              {details.items && details.items.length > 0 && (
                                <div style={{ marginTop: '4px' }}>
                                  <div style={{ fontWeight: 600, marginBottom: '6px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>Items</div>
                                  {details.items.slice(0, 5).map((item, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                      <span style={{ color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>{item.product_name || 'Item'}</span>
                                      <span>×{item.quantity || 0}</span>
                                    </div>
                                  ))}
                                  {details.items.length > 5 && <div style={{ color: isDarkMode ? '#999' : '#888', fontSize: '12px' }}>+{details.items.length - 5} more</div>}
                                </div>
                              )}
                              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); fetchOrderById(normalizedOrderId) }}
                                  style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: `rgba(${themeColorRgb}, 0.8)`,
                                    color: '#fff',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Select
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
            <div style={{ 
              backgroundColor: isDarkMode ? 'var(--bg-primary)' : '#fff', 
              borderRadius: '4px', 
              overflowX: 'auto',
              overflowY: 'visible',
              boxShadow: isDarkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
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
                            if (col === 'Status') {
                              return (
                                <td
                                  key={col}
                                  style={{
                                    padding: '8px 12px',
                                    borderBottom: '1px solid #eee',
                                    fontSize: '14px',
                                    textAlign: 'left'
                                  }}
                                >
                                  {getStatusDisplay(row)}
                                </td>
                              )
                            }
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
                              formattedValue = formatOrderDate(value)
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
                                    {details.employee_name != null && (
                                      <div>
                                        <strong>Employee Name:</strong> {details.employee_name}
                                      </div>
                                    )}
                                    {details.establishment_id != null && (
                                      <div>
                                        <strong>Establishment ID:</strong> {details.establishment_id}
                                      </div>
                                    )}
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
                                    {/* Status / phase update for pickup & delivery */}
                                    <div style={{ gridColumn: '1 / -1', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #dee2e6' }}>
                                      <strong>Status:</strong> {getStatusLabel(details.order_status, details.order_type)}
                                      {((details.order_type || '').toLowerCase() === 'pickup' || (details.order_type || '').toLowerCase() === 'delivery') && (details.payment_status || 'completed').toLowerCase() === 'pending' && (
                                        <span style={{ marginLeft: '6px', color: 'var(--theme-color, #7c3aed)', fontWeight: 600 }}>• Needs payment</span>
                                      )}
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                                        <select
                                          value={details.order_status || 'completed'}
                                          onChange={(e) => {
                                            const v = e.target.value
                                            if (v && v !== (details.order_status || 'completed')) {
                                              updateOrderStatus(normalizedOrderId, v)
                                            }
                                          }}
                                          disabled={!!statusUpdatingOrderId}
                                          style={{
                                            padding: '6px 10px',
                                            borderRadius: '6px',
                                            border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                                            backgroundColor: isDarkMode ? '#2d2d2d' : '#fff',
                                            color: isDarkMode ? '#fff' : '#333',
                                            fontSize: '13px',
                                            minWidth: '140px'
                                          }}
                                        >
                                          <option value="placed">Placed</option>
                                          <option value="being_made">Being made</option>
                                          <option value="ready">{(details.order_type || '').toLowerCase() === 'pickup' ? 'Ready for pickup' : 'Ready'}</option>
                                          {(details.order_type || '').toLowerCase() === 'delivery' && (
                                            <>
                                              <option value="out_for_delivery">Out for delivery</option>
                                              <option value="delivered">Delivered</option>
                                            </>
                                          )}
                                          <option value="completed">Paid / Complete</option>
                                        </select>
                                        {((details.order_type || '').toLowerCase() === 'pickup' || (details.order_type || '').toLowerCase() === 'delivery') && (details.payment_status || 'completed').toLowerCase() === 'pending' && (
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); updateOrderStatus(normalizedOrderId, 'completed', 'completed', 'cash') }}
                                            disabled={!!statusUpdatingOrderId}
                                            style={{
                                              padding: '6px 14px',
                                              borderRadius: '8px',
                                              border: `1px solid rgba(${themeColorRgb}, 0.5)`,
                                              backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                                              color: '#fff',
                                              fontWeight: 600,
                                              fontSize: '13px',
                                              cursor: statusUpdatingOrderId ? 'not-allowed' : 'pointer'
                                            }}
                                          >
                                            {statusUpdatingOrderId === normalizedOrderId ? 'Updating…' : 'Mark as paid (cash)'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    {(details.receipt_type != null || details.receipt_email || details.receipt_phone) && (
                                      <>
                                        {details.receipt_type != null && (
                                          <div>
                                            <strong>Receipt Type:</strong> {String(details.receipt_type)}
                                          </div>
                                        )}
                                        {details.receipt_email && (
                                          <div>
                                            <strong>Receipt Email:</strong> {details.receipt_email}
                                          </div>
                                        )}
                                        {details.receipt_phone && (
                                          <div>
                                            <strong>Receipt Phone:</strong> {details.receipt_phone}
                                          </div>
                                        )}
                                      </>
                                    )}
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
            )
          ) : (
            <div style={{ padding: isMobile ? '24px' : '40px', textAlign: 'center', color: isDarkMode ? '#999' : '#999' }}>No orders found</div>
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
            padding: isMobile ? '16px' : '30px',
            maxWidth: '800px',
            width: isMobile ? '95%' : '90%',
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

