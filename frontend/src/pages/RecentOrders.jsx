import { useState, useEffect, Fragment, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { cachedFetch } from '../services/offlineSync'
import BarcodeScanner from '../components/BarcodeScanner'
import { ScanBarcode, CheckCircle, XCircle, ChevronDown, Pencil, MoreVertical, List, LayoutGrid } from 'lucide-react'
import { formLabelStyle, formTitleStyle, inputBaseStyle, getInputFocusHandlers, FormField, FormLabel, CompactFormActions, modalOverlayStyle, modalContentStyle } from '../components/FormStyles'
import Table from '../components/Table'
import CustomerDisplayPopup from '../components/CustomerDisplayPopup'
import { playNewOrderSound } from '../utils/notificationSound'

const NEW_ORDER_TOAST_OPTIONS_KEY = 'pos_new_order_toast_options'
const DEFAULT_NEW_ORDER_TOAST_OPTIONS = { play_sound: true, sound_type: 'default', volume: 0.5, sound_until_dismiss: false, auto_dismiss_sec: 0, click_action: 'go_to_order' }

function getNewOrderToastOptions() {
  try {
    const s = localStorage.getItem(NEW_ORDER_TOAST_OPTIONS_KEY)
    if (s) {
      const parsed = JSON.parse(s)
      return { ...DEFAULT_NEW_ORDER_TOAST_OPTIONS, ...parsed }
    }
  } catch (_) {}
  return { ...DEFAULT_NEW_ORDER_TOAST_OPTIONS }
}

function RecentOrders() {
  const navigate = useNavigate()
  const { themeColor, themeMode } = useTheme()
  const [ordersPage, setOrdersPage] = useState(0)
  const ORDERS_PAGE_SIZE = 50
  const queryClient = useQueryClient()
  const [expandedRow, setExpandedRow] = useState(null)
  const [expandedCardGridRow, setExpandedCardGridRow] = useState(null) // grid row index when in card view; expanding one card expands whole row
  const [orderDetails, setOrderDetails] = useState({})
  const [loadingDetails, setLoadingDetails] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [scannerExpanded, setScannerExpanded] = useState(false) // for smooth open/close animation
  const [selectedStatus, setSelectedStatus] = useState('in_progress') // 'all' | 'in_progress' | 'ready' | 'out_for_delivery' | 'completed'
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const filterDropdownRef = useRef(null)
  // Extra filters (sent to API): returns, canceled, order types (Out for delivery is a top chip, delivery-only)
  const [filterReturns, setFilterReturns] = useState(false)
  const [filterCanceled, setFilterCanceled] = useState(false)
  const [filterOrderTypePickup, setFilterOrderTypePickup] = useState(false)
  const [filterOrderTypeDelivery, setFilterOrderTypeDelivery] = useState(false)
  const [filterOrderTypeInPerson, setFilterOrderTypeInPerson] = useState(false)
  const [dateRange, setDateRange] = useState('today') // null | 'today' | 'week' | 'month' - sort/filter list by date
  const [viewMode, setViewMode] = useState('cards') // 'table' | 'cards' - how we view the order list
  const [allOrderItems, setAllOrderItems] = useState([]) // Cache all order items for searching
  const [scannedProducts, setScannedProducts] = useState([]) // Array of {product_id, product_name, sku, barcode}
  const [orderItemsMap, setOrderItemsMap] = useState({}) // Map of order_id -> order items
  const [highlightedOrderId, setHighlightedOrderId] = useState(null) // Order ID to highlight in table
  const [scannedOrderId, setScannedOrderId] = useState(null) // Order ID from scanned receipt barcode (filters table to show only this order)
  const [toast, setToast] = useState(null) // { message, type: 'success' | 'error' }
  const [statusUpdatingOrderId, setStatusUpdatingOrderId] = useState(null) // order_id while PATCH status in progress
  const rowRefs = useRef({}) // Refs for table rows to enable scrolling
  const chipsContainerRef = useRef(null) // Ref for chips container
  const scannerInputRef = useRef(null) // Focus target for hardware barcode scanner (persistent scanning)
  const [scannerInputValue, setScannerInputValue] = useState('')
  const lastKnownOrderIdRef = useRef(null)
  const [newOrderToast, setNewOrderToast] = useState(null) // { order_id, order_number, order_source }
  const [creatingDemoOrders, setCreatingDemoOrders] = useState(false)
  const [statusPhaseModal, setStatusPhaseModal] = useState(null) // { row, orderId } when open; null when closed
  const [statusPhaseModalLoadingItems, setStatusPhaseModalLoadingItems] = useState(false)
  const [doordashCancelModal, setDoordashCancelModal] = useState(null) // { orderId } when open
  const [doordashCancelReason, setDoordashCancelReason] = useState('OTHER')
  const [doordashCancelDetails, setDoordashCancelDetails] = useState('')
  const [doordashCancelLoading, setDoordashCancelLoading] = useState(false)
  const [doordashOrderManagerModal, setDoordashOrderManagerModal] = useState(null) // { orderId, loading?, url?, error? }
  const [dasherPopoverOrderId, setDasherPopoverOrderId] = useState(null) // orderId when Dasher popover is open
  const [doordashAdjustModalOrderId, setDoordashAdjustModalOrderId] = useState(null) // orderId when Adjust info modal is open
  const dasherPopoverRef = useRef(null)

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
  const [actionsDropdownOrderId, setActionsDropdownOrderId] = useState(null)
  const actionsDropdownRef = useRef(null)
  const conditionDropdownRefs = useRef({}) // Refs for condition dropdowns per item
  const [openConditionDropdowns, setOpenConditionDropdowns] = useState({}) // Track which condition dropdowns are open
  const [conditionDropdownRect, setConditionDropdownRect] = useState(null) // { itemId, top, left, width, height } for portal positioning
  const conditionDropdownPortalRef = useRef(null) // Ref for portal dropdown so click-outside doesn't close when clicking inside
  const reasonDropdownRefs = useRef({})
  const [openReasonDropdowns, setOpenReasonDropdowns] = useState({})
  const [reasonDropdownRect, setReasonDropdownRect] = useState(null)
  const reasonDropdownPortalRef = useRef(null)
  const [expandedNoteItemId, setExpandedNoteItemId] = useState(null) // order_item_id for which the note row is expanded
  const [posReturnSettings, setPosReturnSettings] = useState({ return_transaction_fee_take_loss: false, return_tip_refund: false, require_signature_for_return: false })
  const [tipRefundFrom, setTipRefundFrom] = useState('store') // 'employee' | 'store' from display settings
  const [returnProcessedResult, setReturnProcessedResult] = useState(null) // after process: show receipt options or "Show receipt options" (if require_signature)
  const [returnSignatureStep, setReturnSignatureStep] = useState(false) // legacy: receipt choice before process (no longer used when require_signature)
  const [returnReceiptChoice, setReturnReceiptChoice] = useState(null)
  const [showReturnReceiptOptionsModal, setShowReturnReceiptOptionsModal] = useState(false) // opens CustomerDisplayPopup (checkout UI) for sign + print/email/none
  const [returnReceiptOptionsLoading, setReturnReceiptOptionsLoading] = useState(false)
  const [returnCheckoutUi, setReturnCheckoutUi] = useState(null) // Checkout UI from API so return receipt screen matches POS Settings from first frame
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)

  const ordersQueryKey = ['orders', filterReturns, filterCanceled, filterOrderTypePickup, filterOrderTypeDelivery, filterOrderTypeInPerson, ordersPage]
  const inventoryQueryKey = ['inventory']
  const { data: inventoryResponse } = useQuery({
    queryKey: inventoryQueryKey,
    queryFn: async () => {
      const res = await cachedFetch('/api/inventory')
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || 'Failed to load inventory')
      return result
    },
    staleTime: 2 * 60 * 1000
  })
  const { data: ordersResponse, isLoading: loading, error: ordersError, refetch: refetchOrders } = useQuery({
    queryKey: ordersQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('limit', String(ORDERS_PAGE_SIZE))
      params.set('offset', String(ordersPage * ORDERS_PAGE_SIZE))
      const statusIn = []
      if (filterReturns) statusIn.push('returned')
      if (filterCanceled) statusIn.push('voided')
      if (statusIn.length) params.set('order_status_in', statusIn.join(','))
      const typeIn = []
      if (filterOrderTypePickup) typeIn.push('pickup')
      if (filterOrderTypeDelivery) typeIn.push('delivery')
      if (filterOrderTypeInPerson) typeIn.push('in-person')
      if (typeIn.length) params.set('order_type_in', typeIn.join(','))
      const res = await cachedFetch(`/api/orders?${params.toString()}`)
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || 'Failed to load orders')
      return result
    },
    staleTime: 60 * 1000
  })
  const data = ordersResponse ?? { columns: [], data: [] }
  const error = ordersError?.message ?? null
  const ordersTotal = ordersResponse?.total ?? 0

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
    setOrdersPage(0)
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

  // Load POS return settings (transaction fee take loss, refund tip)
  useEffect(() => {
    let cancelled = false
    cachedFetch('/api/pos-settings')
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.success && data.settings) {
          setPosReturnSettings({
            return_transaction_fee_take_loss: !!data.settings.return_transaction_fee_take_loss,
            return_tip_refund: !!data.settings.return_tip_refund,
            require_signature_for_return: !!data.settings.require_signature_for_return
          })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Load display settings for tip_refund_from (deduct from employee vs store absorbs)
  useEffect(() => {
    let cancelled = false
    cachedFetch('/api/customer-display/settings')
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.success && data.data) {
          const v = data.data.tip_refund_from
          setTipRefundFrom(v === 'employee' ? 'employee' : 'store')
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Clear dropdown and note state when return modal closes
  useEffect(() => {
    if (!order) {
      setConditionDropdownRect(null)
      setOpenConditionDropdowns({})
      setReasonDropdownRect(null)
      setOpenReasonDropdowns({})
      setExpandedNoteItemId(null)
    }
  }, [order])

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
      if (actionsDropdownOrderId != null && actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target)) {
        setActionsDropdownOrderId(null)
      }
      if (dasherPopoverOrderId != null && dasherPopoverRef.current && !dasherPopoverRef.current.contains(event.target)) {
        setDasherPopoverOrderId(null)
      }
      // Close condition dropdowns (trigger is in ref; dropdown may be in portal)
      const isInsideConditionPortal = conditionDropdownPortalRef.current?.contains(event.target)
      Object.keys(conditionDropdownRefs.current).forEach(itemId => {
        const ref = conditionDropdownRefs.current[itemId]
        const isInsideTrigger = ref?.current?.contains(event.target)
        if (!isInsideTrigger && !isInsideConditionPortal) {
          setOpenConditionDropdowns(prev => ({ ...prev, [itemId]: false }))
          setConditionDropdownRect(null)
        }
      })
      // Close reason dropdowns
      const isInsideReasonPortal = reasonDropdownPortalRef.current?.contains(event.target)
      Object.keys(reasonDropdownRefs.current).forEach(itemId => {
        const ref = reasonDropdownRefs.current[itemId]
        const isInsideTrigger = ref?.current?.contains(event.target)
        if (!isInsideTrigger && !isInsideReasonPortal) {
          setOpenReasonDropdowns(prev => ({ ...prev, [itemId]: false }))
          setReasonDropdownRect(null)
        }
      })
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [actionsDropdownOrderId, dasherPopoverOrderId])

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

  // Load all order items when in cards view so each card can show purchased items
  useEffect(() => {
    if (viewMode === 'cards' && data.data?.length > 0) {
      loadAllOrderItems()
    }
  }, [viewMode, data.data?.length])

  // Poll for new orders (integration orders) and show toast when a new order arrives
  useEffect(() => {
    if (!data?.data?.length) return
    const firstOrderId = data.data[0]?.order_id
    if (firstOrderId != null && lastKnownOrderIdRef.current === null) {
      lastKnownOrderIdRef.current = firstOrderId
    }
  }, [data?.data])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/orders/latest')
        const result = await res.json()
        const latestId = result.order_id
        if (latestId == null) return
        if (lastKnownOrderIdRef.current != null && latestId !== lastKnownOrderIdRef.current) {
          lastKnownOrderIdRef.current = latestId
          try {
            const notifSettings = localStorage.getItem('pos_notification_settings')
            const prefs = notifSettings ? JSON.parse(notifSettings) : {}
            if (prefs.recent_new_order !== false) {
              const source = (result.order_source || '').toLowerCase().trim()
              setNewOrderToast({
                order_id: latestId,
                order_number: result.order_number || `#${latestId}`,
                order_source: source
              })
            }
          } catch (_) {
            const source = (result.order_source || '').toLowerCase().trim()
            setNewOrderToast({ order_id: latestId, order_number: result.order_number || `#${latestId}`, order_source: source })
          }
          invalidateOrders()
        }
      } catch (_) {}
    }, 12000)
    return () => clearInterval(interval)
  }, [])

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

  // New order toast: play sound and/or auto-dismiss per settings
  const newOrderSoundIntervalRef = useRef(null)
  useEffect(() => {
    if (!newOrderToast) return
    const opts = getNewOrderToastOptions()
    const soundOpts = { sound_type: opts.sound_type ?? 'default', volume: opts.volume ?? 0.5 }
    if (opts.play_sound && opts.sound_type !== 'none') {
      if (opts.sound_until_dismiss) {
        playNewOrderSound(soundOpts)
        newOrderSoundIntervalRef.current = setInterval(() => {
          playNewOrderSound(soundOpts)
        }, 1200)
      } else {
        playNewOrderSound(soundOpts)
      }
    }
    return () => {
      if (newOrderSoundIntervalRef.current) {
        clearInterval(newOrderSoundIntervalRef.current)
        newOrderSoundIntervalRef.current = null
      }
    }
  }, [newOrderToast])

  useEffect(() => {
    if (!newOrderToast) return
    const opts = getNewOrderToastOptions()
    if (opts.auto_dismiss_sec > 0) {
      const t = setTimeout(() => setNewOrderToast(null), opts.auto_dismiss_sec * 1000)
      return () => clearTimeout(t)
    }
  }, [newOrderToast])

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

  const invalidateOrders = () => queryClient.invalidateQueries({ queryKey: ['orders'] })

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
              queryClient.setQueryData(ordersQueryKey, (prev) => (prev ? { ...prev, data: [foundOrder, ...(prev.data || [])] } : { columns: [], data: [foundOrder] }))
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
        newItems[itemId] = { quantity: 1, condition: 'new', maxQuantity, reason: '', note: '' }
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

  const updateItemReason = (itemId, reason) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], reason }
    }))
  }

  const updateItemNote = (itemId, note) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], note: note || '' }
    }))
  }

  const createReturn = async (receiptAction = null) => {
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
    
    // Proportional order-level discount (deduct from refund)
    const orderSubtotal = parseFloat(order.subtotal) || 0
    const orderDiscount = parseFloat(order.discount) || 0
    const orderTip = parseFloat(order.tip) || 0
    const returnOrderDiscountDeduction = orderSubtotal > 0 && orderDiscount > 0
      ? orderDiscount * (returnSubtotal / orderSubtotal)
      : 0
    const returnSubtotalAfterOrderDiscount = returnSubtotal - returnOrderDiscountDeduction
    // Proportional tip by returned item value (returnSubtotal / orderSubtotal * orderTip)
    const returnTipDeduction = orderSubtotal > 0 && orderTip > 0
      ? orderTip * (returnSubtotal / orderSubtotal)
      : 0
    // Processing fee: only refund when ALL items on the order are being returned
    const totalOrderQty = orderItems.reduce((sum, i) => sum + (i.quantity || 0), 0)
    const totalReturnQty = Object.values(selectedItems).reduce((sum, d) => sum + (d.quantity || 0), 0)
    const isFullReturn = totalOrderQty > 0 && totalReturnQty >= totalOrderQty
    if (isFullReturn && !posReturnSettings.return_transaction_fee_take_loss && order.transaction_fee && order.subtotal) {
      const feeRate = parseFloat(order.transaction_fee) / parseFloat(order.subtotal)
      returnProcessingFee = returnSubtotalAfterOrderDiscount * feeRate
    }
    const effectiveTipDeduction = posReturnSettings.return_tip_refund ? 0 : returnTipDeduction
    const returnTotal = returnSubtotalAfterOrderDiscount + returnTax - returnProcessingFee - effectiveTipDeduction
    // When refunding tip, this is the proportional tip amount being refunded (for accounting: deduct from employee vs store)
    const returnTipAmount = posReturnSettings.return_tip_refund ? returnTipDeduction : 0

    const itemsToReturn = Object.entries(selectedItems).map(([orderItemId, data]) => {
      const parts = [data.reason, data.note].filter(Boolean)
      return {
        order_item_id: parseInt(orderItemId),
        quantity: data.quantity,
        condition: data.condition,
        notes: parts.length ? parts.join(' — ') : ''
      }
    })

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
          return_subtotal: returnSubtotalAfterOrderDiscount,
          return_tax: returnTax,
          return_processing_fee: posReturnSettings.return_transaction_fee_take_loss ? 0 : returnProcessingFee,
          return_total: returnTotal,
          payment_method: order.payment_method,
          return_tip_amount: returnTipAmount,
          tip_refund_from: tipRefundFrom
        })
      })

      const result = await response.json()

      if (result.success) {
        const doReceiptAction = (action) => {
          if (action === 'print' && result.return_receipt_url) {
            window.open(result.return_receipt_url, '_blank')
          }
          if (action === 'email' && result.return_receipt_url) {
            window.open(result.return_receipt_url, '_blank')
          }
        }
        if (receiptAction !== null) {
          doReceiptAction(receiptAction)
          setReturnSignatureStep(false)
          if (returnType === 'store_credit' && result.exchange_receipt_url) {
            setTimeout(() => window.open(result.exchange_receipt_url, '_blank'), 500)
          }
          if (returnType === 'exchange') {
            localStorage.setItem('exchangeCredit', JSON.stringify({
              credit_id: result.exchange_credit_id,
              amount: returnTotal,
              return_id: result.return_id
            }))
            navigate('/pos')
          }
          setOrder(null)
          setOrderItems([])
          setSelectedItems({})
          setReason('')
          setNotes('')
          setReturnType(null)
          setExchangeTiming(null)
        } else {
          setReturnProcessedResult(result)
          if (returnType === 'exchange') {
            localStorage.setItem('exchangeCredit', JSON.stringify({
              credit_id: result.exchange_credit_id,
              amount: returnTotal,
              return_id: result.return_id
            }))
            // Open POS so customer can use exchange credit (same window)
            navigate('/pos')
            setOrder(null)
            setOrderItems([])
            setSelectedItems({})
            setReason('')
            setNotes('')
            setReturnType(null)
            setExchangeTiming(null)
            setReturnProcessedResult(null)
          }
        }
        setToast({ message: `Return processed successfully! Return #: ${result.return_number}`, type: 'success' })
        await invalidateOrders()
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

  // Fetch and cache order details for one order (no expansion state change). Used by table row click and by card row expand.
  const loadOrderDetailsIfNeeded = async (row) => {
    const orderId = row.order_id || row.orderId
    if (!orderId) return
    const normalizedOrderId = parseInt(orderId)
    if (isNaN(normalizedOrderId)) return
    if (orderDetails[normalizedOrderId]) return

    setLoadingDetails(prev => ({ ...prev, [normalizedOrderId]: true }))
    try {
      const itemsResponse = await fetch('/api/order_items')
      const itemsResult = await itemsResponse.json()
      const items = itemsResult.data || []
      const orderItems = items.filter(item => parseInt(item.order_id || item.orderId) === normalizedOrderId)
      const baseTotal = (parseFloat(row.subtotal) || 0) + (parseFloat(row.tax_amount || row.tax) || 0) - (parseFloat(row.discount) || 0)
      const tipAmt = parseFloat(row.tip) || 0
      const storedTotal = parseFloat(row.total) || 0
      const displayTotal = tipAmt > 0 && storedTotal <= baseTotal ? baseTotal + tipAmt : (row.total != null ? row.total : row.subtotal ?? 0)
      const details = {
        employee_id: row.employee_id || row.employeeId || null,
        employee_name: row.employee_name ?? null,
        establishment_id: row.establishment_id ?? null,
        customer_id: row.customer_id || row.customerId || null,
        subtotal: parseFloat(row.subtotal) || 0,
        tax_rate: parseFloat(row.tax_rate) || 0,
        tax_amount: parseFloat(row.tax_amount || row.tax) || 0,
        discount: parseFloat(row.discount) || 0,
        discount_type: row.discount_type ?? null,
        transaction_fee: parseFloat(row.transaction_fee) || 0,
        notes: row.notes || '',
        tip: tipAmt,
        total: displayTotal,
        order_status: row.order_status ?? 'completed',
        payment_status: row.payment_status ?? 'completed',
        order_type: row.order_type ?? row.orderType ?? null,
        receipt_type: row.receipt_type ?? null,
        receipt_email: row.receipt_email ?? null,
        receipt_phone: row.receipt_phone ?? null,
        prepare_by: row.prepare_by ?? null,
        order_source: row.order_source ?? row.orderSource ?? null,
        dasher_status: row.dasher_status ?? null,
        dasher_status_at: row.dasher_status_at ?? null,
        dasher_info: row.dasher_info ?? null,
        items: orderItems
      }
      if (!isNaN(normalizedOrderId) && orderItems.length > 0) {
        setOrderItemsMap(prev => ({ ...prev, [normalizedOrderId]: orderItems }))
      }
      setOrderDetails(prev => ({ ...prev, [normalizedOrderId]: details }))
    } catch (err) {
      console.error('Error loading order details:', err)
    } finally {
      setLoadingDetails(prev => ({ ...prev, [normalizedOrderId]: false }))
    }
  }

  const handleRowClick = async (row) => {
    const orderId = row.order_id || row.orderId
    if (!orderId) return
    const normalizedOrderId = parseInt(orderId)
    if (isNaN(normalizedOrderId)) return

    if (expandedRow === normalizedOrderId) {
      setExpandedRow(null)
      return
    }
    setExpandedRow(normalizedOrderId)
    await loadOrderDetailsIfNeeded(row)
  }

  const CARDS_PER_ROW = isMobile ? 1 : 3

  const handleCardClick = async (row, idx) => {
    const rowIndex = Math.floor(idx / CARDS_PER_ROW)
    if (expandedCardGridRow === rowIndex) {
      setExpandedCardGridRow(null)
      return
    }
    setExpandedCardGridRow(rowIndex)
    const start = rowIndex * CARDS_PER_ROW
    const end = Math.min(start + CARDS_PER_ROW, filteredData.length)
    for (let i = start; i < end; i++) {
      await loadOrderDetailsIfNeeded(filteredData[i])
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
        const msg = order_status === 'ready' && result.doordash_ready_sent
          ? 'Status updated. DoorDash notified: order ready for pickup.'
          : 'Status updated'
        setToast({ message: msg, type: 'success' })
        await invalidateOrders()
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

  const cancelDoordashOrder = async (orderId) => {
    if (!orderId || doordashCancelLoading) return
    setDoordashCancelLoading(true)
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/orders/${orderId}/doordash-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({
          cancel_reason: doordashCancelReason,
          cancel_details: doordashCancelDetails.trim() || undefined
        })
      })
      const result = await res.json()
      if (result.success) {
        setToast({ message: 'Order cancelled with DoorDash', type: 'success' })
        setDoordashCancelModal(null)
        setDoordashCancelReason('OTHER')
        setDoordashCancelDetails('')
        await invalidateOrders()
        setOrderDetails(prev => ({
          ...prev,
          [orderId]: prev[orderId] ? { ...prev[orderId], order_status: 'voided' } : prev[orderId]
        }))
      } else {
        setToast({ message: result.message || 'DoorDash cancellation failed', type: 'error' })
      }
    } catch (err) {
      console.error(err)
      setToast({ message: 'Failed to cancel with DoorDash', type: 'error' })
    } finally {
      setDoordashCancelLoading(false)
    }
  }

  const openDoordashOrderManager = async (orderId) => {
    if (!orderId) return
    setDoordashOrderManagerModal({ orderId, loading: true })
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/orders/${orderId}/doordash-order-manager-url`, {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) }
      })
      const result = await res.json()
      if (result.success && result.url) {
        setDoordashOrderManagerModal(prev => ({ ...prev, loading: false, url: result.url, error: null }))
      } else {
        setDoordashOrderManagerModal(prev => ({ ...prev, loading: false, url: null, error: result.message || 'Could not load Order Manager' }))
      }
    } catch (err) {
      console.error(err)
      setDoordashOrderManagerModal(prev => ({ ...prev, loading: false, url: null, error: 'Order Manager is unavailable. Please try again or contact support.' }))
    }
  }

  // Add Actions column and ensure total includes tip for display
  const processedData = data && data.data ? data.data.map(row => {
    const baseTotal = (parseFloat(row.subtotal) || 0) + (parseFloat(row.tax_amount) || 0) - (parseFloat(row.discount) || 0)
    const tipAmt = parseFloat(row.tip) || 0
    const storedTotal = parseFloat(row.total) || 0
    const displayTotal = tipAmt > 0 && storedTotal <= baseTotal ? baseTotal + tipAmt : (row.total != null ? row.total : row.subtotal ?? 0)
    return { ...row, total: displayTotal, _actions: row }
  }) : []

  const focusScannerInput = () => {
    setScannerInputValue('')
    setTimeout(() => scannerInputRef.current?.focus(), 0)
  }

  const handleBarcodeScan = async (barcode) => {
    try {
      const scannedBarcode = barcode.toString().trim()
      if (!scannedBarcode) {
        focusScannerInput()
        return
      }
      
      // First, check if barcode matches an order number (receipt barcode)
      const orderIdMatch = parseInt(scannedBarcode)
      let matchingOrder = null
      
      if (!isNaN(orderIdMatch)) {
        try {
          const orderIdResponse = await cachedFetch(`/api/orders/search?order_id=${orderIdMatch}`)
          const orderIdResult = await orderIdResponse.json()
          if (orderIdResult.data && orderIdResult.data.length > 0) {
            matchingOrder = orderIdResult.data[0]
          }
        } catch (err) {
          console.log('Error searching by order_id:', err)
        }
      }
      
      if (!matchingOrder) {
        try {
          const orderNumResponse = await cachedFetch(`/api/orders/search?order_number=${encodeURIComponent(scannedBarcode)}`)
          const orderNumResult = await orderNumResponse.json()
          if (orderNumResult.data && orderNumResult.data.length > 0) {
            matchingOrder = orderNumResult.data.find(o => {
              if (!o.order_number) return false
              const orderNum = o.order_number.toString().trim()
              return orderNum === scannedBarcode || orderNum.toLowerCase() === scannedBarcode.toLowerCase()
            })
            if (!matchingOrder && orderNumResult.data.length > 0) {
              matchingOrder = orderNumResult.data[0]
            }
          }
        } catch (err) {
          console.log('Error searching by order_number:', err)
        }
      }
      
      if (matchingOrder) {
        setToast({ message: `Found order: ${matchingOrder.order_number}`, type: 'success' })
        if (data && data.data) {
          const orderExists = data.data.some(o => o.order_id === matchingOrder.order_id)
          if (!orderExists) {
            queryClient.setQueryData(ordersQueryKey, (prev) => (prev ? { ...prev, data: [matchingOrder, ...(prev.data || [])] } : { columns: [], data: [matchingOrder] }))
          }
        }
        setScannedOrderId(matchingOrder.order_id)
        setHighlightedOrderId(matchingOrder.order_id)
        setTimeout(() => setHighlightedOrderId(null), 5000)
        setShowBarcodeScanner(false)
        focusScannerInput()
        return
      }
      
      // Use cached inventory (from useQuery) so we don't refetch on every scan
      let inventoryData = inventoryResponse?.data
      if (!inventoryData) {
        const res = await cachedFetch('/api/inventory')
        const result = await res.json()
        inventoryData = result.data
      }
      
      let product = null
      if (inventoryData) {
        const barcodeStr = scannedBarcode
        product = inventoryData.find(p =>
          p.barcode && p.barcode.toString().trim() === barcodeStr
        )
        if (!product && barcodeStr.length === 13 && barcodeStr.startsWith('0')) {
          product = inventoryData.find(p =>
            p.barcode && p.barcode.toString().trim() === barcodeStr.substring(1)
          )
        }
        if (!product && barcodeStr.length === 12) {
          const barcode13 = '0' + barcodeStr
          product = inventoryData.find(p =>
            p.barcode && (p.barcode.toString().trim() === barcode13 || p.barcode.toString().trim() === barcodeStr)
          )
        }
        if (!product) {
          product = inventoryData.find(p =>
            p.sku && p.sku.toString().trim() === barcodeStr
          )
        }
        
        if (product) {
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
          focusScannerInput()
          return
        }
      }
      
      const looksLikeOrderNumber = /^[A-Z0-9-]+$/i.test(scannedBarcode) && scannedBarcode.length >= 3
      if (looksLikeOrderNumber) {
        setToast({ message: `Order or product with barcode "${barcode}" not found. Please check the barcode and try again.`, type: 'error' })
      } else {
        setToast({ message: `Product with barcode "${barcode}" not found`, type: 'error' })
      }
    } catch (err) {
      console.error('Barcode scan error:', err)
      setToast({ message: 'Error processing barcode scan', type: 'error' })
    } finally {
      focusScannerInput()
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

  // Filter data based on search query, order status, date range, scanned order, and scanned products
  let filteredData = processedData

  // Filter by date range (today / week / month)
  if (dateRange) {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    let rangeStart
    let rangeEnd
    if (dateRange === 'today') {
      rangeStart = todayStart
      rangeEnd = todayStart + 24 * 60 * 60 * 1000
    } else if (dateRange === 'week') {
      const day = now.getDay()
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - (day === 0 ? 6 : day - 1)) // Monday start
      rangeStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).getTime()
      rangeEnd = rangeStart + 7 * 24 * 60 * 60 * 1000
    } else {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
    }
    filteredData = filteredData.filter(row => {
      const raw = row.order_date ?? row.orderDate
      if (!raw) return false
      const t = new Date(raw).getTime()
      return t >= rangeStart && t < rangeEnd
    })
  }


  // First, filter by scanned order (receipt barcode) - show only that order
  if (scannedOrderId) {
    filteredData = filteredData.filter(row => {
      const orderId = row.order_id || row.orderId
      return orderId === scannedOrderId
    })
  }

  // Chips: In progress = pickup/delivery placed or being_made. Ready = pickup/delivery ready (DoorDash, Shopify, Uber Eats, in-house). Out for delivery = delivery only. Completed = in-person; or pickup/delivery delivered/completed/voided/returned.
  const IN_PROGRESS_STATUSES = ['placed', 'being_made']
  if (selectedStatus !== 'all') {
    filteredData = filteredData.filter(row => {
      const rowStatus = (row.order_status || row.orderStatus || 'completed').toLowerCase()
      const rowType = (row.order_type || row.orderType || '').toLowerCase().replace(/_/g, '-')
      const isInPerson = rowType === 'in-person' || rowType === 'inperson'
      if (selectedStatus === 'in_progress') return (rowType === 'pickup' || rowType === 'delivery') && IN_PROGRESS_STATUSES.includes(rowStatus)
      if (selectedStatus === 'ready') return (rowType === 'pickup' || rowType === 'delivery') && rowStatus === 'ready'
      if (selectedStatus === 'out_for_delivery') return rowType === 'delivery' && rowStatus === 'out_for_delivery'
      if (selectedStatus === 'completed') return isInPerson || ['delivered', 'completed', 'voided', 'returned'].includes(rowStatus)
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
      const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
      if (orderDayStart === todayDayStart) return `Today ${timeStr}`
      if (orderDayStart === todayDayStart - oneDayMs) return `Yesterday ${timeStr}`
      return date.toLocaleString()
    } catch {
      return String(value)
    }
  }

  // Fields to hide from main table (shown in dropdown); order_status/payment_* combined into Status column
  const hiddenFields = ['order_id', 'orderId', 'employee_id', 'employeeId', 'customer_id', 'customerId', 'subtotal', 'tax_rate', 'tax_amount', 'tax', 'discount', 'discount_type', 'transaction_fee', 'notes', 'tip', 'receipt_type', 'receipt_email', 'receipt_phone', 'establishment_id', 'employee_name', 'order_status', 'payment_status', 'payment_method', 'order_source', 'orderSource']
  
  // Status: In Progress (pickup/delivery when placed/being_made), Ready, Out for delivery (delivery only), Completed (in-person always; pickup/delivery when done)
  const getStatusLabel = (orderStatus, orderType) => {
    const s = (orderStatus || 'completed').toLowerCase()
    const type = (orderType || '').toLowerCase().replace(/_/g, '-')
    // All in-person orders show as Completed
    if (type === 'in-person' || type === 'inperson') return 'Completed'
    // Pickup / delivery
    if (type === 'pickup' || type === 'delivery') {
      if (s === 'placed' || s === 'being_made') return 'In Progress'
      if (s === 'ready') return 'Ready'
      if (s === 'out_for_delivery') return 'Out for delivery'
      if (s === 'delivered' || s === 'completed') return 'Completed'
    }
    if (s === 'voided') return 'Voided'
    if (s === 'returned') return 'Returned'
    return 'Completed'
  }
  const getStatusDisplay = (row) => {
    const orderType = ((row.order_type ?? row.orderType) ?? '').toLowerCase()
    const paymentStatus = ((row.payment_status ?? row.paymentStatus) ?? 'completed').toLowerCase()
    const orderStatus = ((row.order_status ?? row.orderStatus) ?? 'completed').toLowerCase()
    const label = getStatusLabel(orderStatus, orderType)
    const isPickupOrDelivery = orderType === 'pickup' || orderType === 'delivery'
    const paymentPending = paymentStatus === 'pending'
    const isUnpaidPhase = ['placed', 'being_made', 'ready', 'out_for_delivery', 'delivered'].includes(orderStatus)
    const needsPayment = isPickupOrDelivery && (paymentPending || (isUnpaidPhase && paymentStatus !== 'completed'))
    const paidOrUnpaid = isPickupOrDelivery ? (needsPayment ? ' - Unpaid' : ' - Paid') : ''
    return `${label}${paidOrUnpaid}`
  }

  // Next phase for status-phase modal: { nextStatus, label } or null if no next (completed/voided/returned)
  const getNextPhase = (row) => {
    const orderStatus = ((row.order_status ?? row.orderStatus) ?? 'completed').toLowerCase()
    const orderType = ((row.order_type ?? row.orderType) ?? '').toLowerCase()
    if (orderStatus === 'voided' || orderStatus === 'returned') return null
    if (orderType === 'in-person' || orderType === 'inperson') return null
    if (orderType === 'pickup' || orderType === 'delivery') {
      if (orderStatus === 'placed' || orderStatus === 'being_made') return { nextStatus: 'ready', label: 'Ready' }
      if (orderStatus === 'ready') return orderType === 'delivery' ? { nextStatus: 'out_for_delivery', label: 'Out for delivery' } : { nextStatus: 'completed', label: 'Completed' }
      if (orderStatus === 'out_for_delivery') return { nextStatus: 'delivered', label: 'Delivered' }
      if (orderStatus === 'delivered') return { nextStatus: 'completed', label: 'Completed' }
    }
    return null
  }

  const openStatusPhaseModal = (row, e) => {
    if (e) e.stopPropagation()
    const orderId = row.order_id ?? row.orderId
    if (!orderId) return
    const normalizedOrderId = parseInt(orderId)
    if (isNaN(normalizedOrderId)) return
    if (!getNextPhase(row)) return // no next phase, don't open
    setStatusPhaseModal({ row, orderId: normalizedOrderId })
    const hasItems = (orderDetails[normalizedOrderId]?.items ?? orderItemsMap[normalizedOrderId] ?? []).length > 0
    if (!hasItems) loadOrderDetailsForModal(normalizedOrderId)
  }

  const loadOrderDetailsForModal = async (orderId) => {
    setStatusPhaseModalLoadingItems(true)
    try {
      const itemsResponse = await fetch('/api/order_items')
      const itemsResult = await itemsResponse.json()
      const items = itemsResult.data || []
      const orderItems = items.filter(item => parseInt(item.order_id || item.orderId) === orderId)
      setOrderDetails(prev => ({ ...prev, [orderId]: { ...(prev[orderId] || {}), items: orderItems } }))
      setOrderItemsMap(prev => ({ ...prev, [orderId]: orderItems }))
    } catch (err) {
      console.error(err)
    } finally {
      setStatusPhaseModalLoadingItems(false)
    }
  }

  const closeStatusPhaseModal = () => {
    setStatusPhaseModal(null)
    setStatusPhaseModalLoadingItems(false)
  }

  const confirmStatusPhaseMove = async () => {
    if (!statusPhaseModal) return
    const { row, orderId } = statusPhaseModal
    const next = getNextPhase(row)
    if (!next) return
    setStatusUpdatingOrderId(orderId)
    try {
      await updateOrderStatus(orderId, next.nextStatus)
      closeStatusPhaseModal()
      await invalidateOrders()
      setToast({ message: `Order moved to ${next.label}`, type: 'success' })
    } catch (err) {
      setToast({ message: 'Failed to update status', type: 'error' })
    } finally {
      setStatusUpdatingOrderId(null)
    }
  }

  // Void option: only for orders that are unpaid (payment_status === 'pending', not voided).
  // Prefer `details` when available (from expanded order) for accurate payment_status.
  const isUnpaidOrder = (row, details = null) => {
    const source = details || row
    const paymentStatus = ((source.payment_status ?? source.paymentStatus) ?? 'completed').toLowerCase()
    const orderStatus = ((source.order_status ?? source.orderStatus) ?? '').toLowerCase()
    if (orderStatus === 'voided') return false
    return paymentStatus === 'pending'
  }

  const handleReprintReceipt = (orderId) => {
    setActionsDropdownOrderId(null)
    window.open(`/api/receipt/${orderId}`, '_blank')
  }

  const handleVoidOrder = (orderId) => {
    setActionsDropdownOrderId(null)
    updateOrderStatus(orderId, 'voided')
  }

  // Pill colors per status (frontend-only)
  const getStatusPillStyle = (row) => {
    const label = getStatusLabel((row.order_status ?? row.orderStatus ?? 'completed').toLowerCase(), row.order_type ?? row.orderType)
    const base = {
      display: 'inline-block',
      padding: '5px 12px',
      borderRadius: '20px',
      fontSize: '13px',
      fontWeight: 500
    }
    const colors = {
      'In Progress': { backgroundColor: 'rgba(37, 99, 235, 0.25)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.5)' },
      'Ready': { backgroundColor: 'rgba(217, 119, 6, 0.25)', color: '#b45309', border: '1px solid rgba(217, 119, 6, 0.5)' },
      'Out for delivery': { backgroundColor: 'rgba(124, 58, 237, 0.25)', color: '#7c3aed', border: '1px solid rgba(124, 58, 237, 0.5)' },
      'Completed': { backgroundColor: 'rgba(5, 150, 105, 0.25)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.5)' },
      'Voided': { backgroundColor: 'rgba(107, 114, 128, 0.25)', color: '#6b7280', border: '1px solid rgba(107, 114, 128, 0.5)' },
      'Returned': { backgroundColor: 'rgba(107, 114, 128, 0.25)', color: '#6b7280', border: '1px solid rgba(107, 114, 128, 0.5)' }
    }
    const style = colors[label] || colors['Completed']
    return { ...base, ...style }
  }

  const getColumnHeaderLabel = (col) => {
    const formatted = col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    if (col === 'order_type') return 'Type'
    if (col === 'customer_name') return 'Customer'
    return formatted
  }

  // Order source logo for DoorDash / Shopify / Uber Eats (order_source from API)
  const getOrderSourceLogo = (row) => {
    const raw = row?.order_source ?? row?.orderSource ?? (row && row['order_source']) ?? ''
    const source = String(raw).toLowerCase().trim().replace(/\s+/g, '_')
    if (source === 'doordash') return { src: '/doordash-logo.svg', alt: 'DoorDash', textOnly: false }
    if (source === 'shopify') return { src: '/shopify-logo.svg', alt: 'Shopify', textOnly: false }
    if (source === 'uber_eats' || source === 'ubereats') return { src: '/uber-eats-logo.svg', alt: 'Uber Eats', textOnly: false }
    return null
  }

  // DoorDash Dasher Status webhook: human-readable label for dasher_status
  const getDasherStatusLabel = (status) => {
    if (!status || typeof status !== 'string') return ''
    const s = status.toLowerCase().trim()
    const map = {
      dasher_confirmed: 'Dasher confirmed',
      arriving_at_store: 'Arriving at store',
      arrived_at_store: 'Arrived at store',
      dasher_out_for_delivery: 'Out for delivery',
      dropoff: 'Dropped off'
    }
    return map[s] || status
  }

  // Filter out hidden fields and insert Status column (replacing order_status / payment_method)
  // Use default columns when loading so table headers are always visible
  const defaultVisibleColumns = ['order_number', 'order_date', 'order_type', 'customer_name', 'total']
  const baseVisible = (data && data.columns && data.columns.length)
    ? data.columns.filter(col => !hiddenFields.includes(col))
    : defaultVisibleColumns
  const orderNumIdx = baseVisible.indexOf('order_number')
  const visibleColumns = orderNumIdx >= 0
    ? [...baseVisible.slice(0, orderNumIdx + 1), 'Status', ...baseVisible.slice(orderNumIdx + 1)]
    : ['Status', ...baseVisible]
  const columnsWithActions = [...visibleColumns, 'Actions']

  const pagePadding = isMobile ? '12px' : '40px'
  const pageMaxWidth = isMobile ? '100%' : '1400px'

  return (
    <>
      {/* New order toast popup when an integration order arrives */}
      {newOrderToast && createPortal(
        (() => {
          const toastLogo = getOrderSourceLogo({ order_source: newOrderToast.order_source })
          const fromLabel = toastLogo ? toastLogo.alt : (newOrderToast.order_source || 'New order')
          const opts = getNewOrderToastOptions()
          const handleGoToOrder = () => {
            setHighlightedOrderId(newOrderToast.order_id)
            setNewOrderToast(null)
          }
          const handlePrintReceipt = () => {
            window.open(`/api/receipt/${newOrderToast.order_id}`, '_blank')
            setNewOrderToast(null)
          }
          const handlePrimaryClick = opts.click_action === 'go_to_order' ? handleGoToOrder : opts.click_action === 'print_receipt' ? handlePrintReceipt : null
          return (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            padding: '14px 20px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#fff',
            border: `2px solid rgba(${themeColorRgb}, 0.8)`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '90vw',
            flexWrap: 'wrap',
            animation: 'fadeIn 0.3s ease'
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', minWidth: 0, cursor: handlePrimaryClick ? 'pointer' : 'default' }}
            onClick={handlePrimaryClick || undefined}
            onKeyDown={e => { if (handlePrimaryClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handlePrimaryClick() } }}
            role={handlePrimaryClick ? 'button' : undefined}
            tabIndex={handlePrimaryClick ? 0 : undefined}
          >
            {toastLogo && !toastLogo.textOnly && (
              <img src={toastLogo.src} alt="" style={{ height: '28px', width: 'auto', maxWidth: '80px', objectFit: 'contain', flexShrink: 0 }} />
            )}
            <span style={{ fontWeight: 600, color: `rgba(${themeColorRgb}, 1)` }}>New order</span>
            <span style={{ color: isDarkMode ? 'var(--text-primary)' : '#333' }}>
              {newOrderToast.order_number} from {fromLabel}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {opts.click_action === 'go_to_order' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleGoToOrder() }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: `rgba(${themeColorRgb}, 0.9)`,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                View order
              </button>
            )}
            {opts.click_action === 'print_receipt' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handlePrintReceipt() }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: `rgba(${themeColorRgb}, 0.9)`,
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Print receipt
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setNewOrderToast(null) }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: isDarkMode ? '#444' : '#eee',
                color: isDarkMode ? '#fff' : '#333',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
          )
        })(),
        document.body
      )}
      <div
        style={{
          padding: pagePadding,
          maxWidth: pageMaxWidth,
          margin: '0 auto',
          backgroundColor: isDarkMode ? 'var(--bg-primary)' : '#ffffff',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
      <div style={{ flexShrink: 0, marginBottom: isMobile ? '12px' : '20px', paddingTop: isMobile ? '12px' : 0 }}>
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
          <input
            ref={scannerInputRef}
            type="text"
            value={scannerInputValue}
            onChange={(e) => setScannerInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = scannerInputValue.trim()
                if (v) {
                  e.preventDefault()
                  handleBarcodeScan(v)
                }
              }
            }}
            placeholder="Barcode / order #"
            title="Scan with hardware scanner or type and press Enter"
            style={{
              width: isMobile ? 100 : 130,
              maxWidth: '140px',
              padding: '6px 10px',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              outline: 'none',
              fontSize: '13px',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
              boxSizing: 'border-box'
            }}
          />
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
            { value: 'ready', label: 'Ready' },
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
              {/* Date range: Today, Week, Month */}
              {[
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' }
              ].map(({ value, label }) => {
                const isSelected = dateRange === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDateRange(isSelected ? null : value)}
                    style={{
                      padding: isMobile ? '5px 10px' : '6px 14px',
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
              {/* View mode: Table | Cards */}
              {[
                { value: 'table', label: 'Table', icon: List },
                { value: 'cards', label: 'Cards', icon: LayoutGrid }
              ].map(({ value, label, icon: Icon }) => {
                const isSelected = viewMode === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setViewMode(value)}
                    style={{
                      padding: isMobile ? '5px 10px' : '6px 14px',
                      height: isMobile ? '28px' : '32px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                      fontSize: isMobile ? '13px' : '14px',
                      backgroundColor: isSelected
                        ? `rgba(${themeColorRgb}, 0.7)`
                        : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                      border: isSelected
                        ? `1px solid rgba(${themeColorRgb}, 0.5)`
                        : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                      borderRadius: '8px',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: isSelected ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
                    }}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                )
              })}
              {/* Create 3 demo integration orders (Shopify, DoorDash, Uber Eats) */}
              <button
                type="button"
                onClick={async () => {
                  setCreatingDemoOrders(true)
                  try {
                    const res = await fetch('/api/orders/create-demo-integration-orders', { method: 'POST' })
                    const data = await res.json()
                    if (data.success) {
                      setToast({ message: data.message || 'Demo orders created', type: 'success' })
                      await invalidateOrders()
                      if (viewMode === 'cards') loadAllOrderItems()
                    } else {
                      setToast({ message: data.message || 'Failed to create demo orders', type: 'error' })
                    }
                  } catch (e) {
                    setToast({ message: 'Failed to create demo orders', type: 'error' })
                  } finally {
                    setCreatingDemoOrders(false)
                  }
                }}
                disabled={creatingDemoOrders}
                style={{
                  padding: isMobile ? '5px 10px' : '6px 14px',
                  height: isMobile ? '28px' : '32px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  fontSize: isMobile ? '12px' : '13px',
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                  borderRadius: '8px',
                  fontWeight: 500,
                  color: isDarkMode ? 'var(--text-secondary)' : '#666',
                  cursor: creatingDemoOrders ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="Create 3 demo orders (Shopify, DoorDash, Uber Eats) to preview logos and layout"
              >
                {creatingDemoOrders ? 'Creating…' : 'Create demo orders'}
              </button>
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

      <div style={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {error && <div style={{ padding: isMobile ? '24px' : '40px', textAlign: 'center', color: isDarkMode ? '#e57373' : '#c62828' }}>{error}</div>}
        {!error && (
          loading ? (
            /* Desktop: table with headers + loading row. Mobile: loading message. */
            isMobile ? (
              <div style={{ padding: '24px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999', fontSize: '14px' }}>Loading…</div>
            ) : (
              <div style={{
                backgroundColor: isDarkMode ? 'var(--bg-primary)' : '#fff',
                borderRadius: '4px',
                overflowX: 'auto',
                boxShadow: isDarkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
                width: '100%'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
                  <thead>
                    <tr style={{ backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f8f9fa' }}>
                      {columnsWithActions.map(col => (
                        <th
                          key={col}
                          style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 1,
                            padding: '12px',
                            textAlign: 'left',
                            fontWeight: 600,
                            borderBottom: '2px solid #dee2e6',
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#495057',
                            fontSize: '13px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f8f9fa',
                            boxShadow: '0 1px 0 0 #dee2e6'
                          }}
                        >
                          {getColumnHeaderLabel(col)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={columnsWithActions.length} style={{ textAlign: 'center', padding: '40px 20px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999', fontSize: '14px' }}>
                        Loading…
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          ) : data.data && data.data.length > 0 ? (
            <>
            {viewMode === 'cards' ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: isMobile ? '10px' : '16px',
                alignContent: 'start'
              }}>
                {filteredData.map((row, idx) => {
                  const orderId = row.order_id || row.orderId
                  const normalizedOrderId = parseInt(orderId)
                  const isExpanded = expandedCardGridRow !== null && Math.floor(idx / CARDS_PER_ROW) === expandedCardGridRow
                  const details = orderDetails[normalizedOrderId]
                  const isLoading = loadingDetails[normalizedOrderId]
                  // Order total should include tip (updated by process_payment). Fallback: add tip for legacy orders where total wasn't updated
                  const baseTotal = (parseFloat(row.subtotal) || 0) + (parseFloat(row.tax_amount) || 0) - (parseFloat(row.discount) || 0)
                  const tipAmt = parseFloat(row.tip) || 0
                  const storedTotal = parseFloat(row.total) || 0
                  const totalVal = tipAmt > 0 && storedTotal <= baseTotal ? baseTotal + tipAmt : (row.total != null ? row.total : (row.subtotal != null ? row.subtotal : 0))
                  const totalStr = typeof totalVal === 'number' ? `$${totalVal.toFixed(2)}` : `$${parseFloat(totalVal || 0).toFixed(2)}`
                  const cardSource = String(row?.order_source ?? row?.orderSource ?? '').toLowerCase().trim()
                  const cardOutline = cardSource === 'doordash' ? '2px solid #FF3008' : cardSource === 'shopify' ? '2px solid #5A863E' : cardSource === 'uber_eats' ? '2px solid #1a1a1a' : (isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee')
                  const cardThemeColor = cardSource === 'doordash' ? '#FF3008' : cardSource === 'shopify' ? '#5A863E' : cardSource === 'uber_eats' ? '#1a1a1a' : themeColor
                  const cardNextPhase = getNextPhase(row)
                  return (
                    <div
                      key={`order-${normalizedOrderId ?? 'n/a'}-${idx}`}
                      onClick={() => handleCardClick(row, idx)}
                      style={{
                        backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#fff',
                        borderRadius: '10px',
                        padding: '14px',
                        boxShadow: isDarkMode ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.08)',
                        border: cardOutline,
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px', color: isDarkMode ? 'var(--text-primary)' : '#333', minWidth: 0 }}>
                          {(() => {
                            const logo = getOrderSourceLogo(row)
                            if (!logo) return null
                            if (logo.textOnly) {
                              return <span key={`src-${normalizedOrderId}`} style={{ flexShrink: 0, fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#666' }}>{logo.alt}</span>
                            }
                            return <img key={`logo-${normalizedOrderId}`} src={logo.src} alt={logo.alt} style={{ height: '18px', width: 'auto', maxWidth: '80px', minWidth: '20px', objectFit: 'contain', flexShrink: 0, display: 'block' }} />
                          })()}
                          <span style={{ flexShrink: 0 }}>{row.order_number || `#${orderId}`}</span>
                        </span>
                        <span
                          role={cardNextPhase ? 'button' : undefined}
                          onClick={cardNextPhase ? (e) => openStatusPhaseModal(row, e) : undefined}
                          style={{
                            ...getStatusPillStyle(row),
                            padding: '4px 10px',
                            fontSize: '12px',
                            cursor: cardNextPhase ? 'pointer' : 'default'
                          }}
                        >
                          {getStatusDisplay(row)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#666' }}>
                          {formatOrderDate(row.order_date || row.orderDate || '')}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: cardThemeColor }}>{totalStr}</span>
                      </div>
                      {(row.prepare_by) && (
                        <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#666', marginTop: '4px' }}>
                          Prepare by: {formatOrderDate(row.prepare_by)}
                        </div>
                      )}
                      {cardSource === 'doordash' && (row.dasher_status || row.dasher_info) && (
                        <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#666', marginTop: '4px' }}>
                          {row.dasher_status && <span>Dasher: {getDasherStatusLabel(row.dasher_status)}</span>}
                          {row.dasher_status && row.dasher_info && (row.dasher_info.first_name || row.dasher_info.last_name || (row.dasher_info.vehicle && (row.dasher_info.vehicle.make || row.dasher_info.vehicle.model))) && ' · '}
                          {row.dasher_info && (row.dasher_info.first_name || row.dasher_info.last_name) && (
                            <span>{[row.dasher_info.first_name, row.dasher_info.last_name].filter(Boolean).join(' ')}</span>
                          )}
                          {row.dasher_info?.vehicle && (row.dasher_info.vehicle.make || row.dasher_info.vehicle.model) && (
                            <span> · {[row.dasher_info.vehicle.make, row.dasher_info.vehicle.model].filter(Boolean).join(' ')}</span>
                          )}
                        </div>
                      )}
                      {/* DoorDash order action buttons on card */}
                      {cardSource === 'doordash' && (row.order_status || '').toLowerCase() !== 'voided' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
                          <div style={{ position: 'relative' }} ref={dasherPopoverOrderId === normalizedOrderId ? dasherPopoverRef : null}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDasherPopoverOrderId(prev => prev === normalizedOrderId ? null : normalizedOrderId) }}
                              style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${cardThemeColor}`, background: 'transparent', color: cardThemeColor, fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Dasher
                            </button>
                            {dasherPopoverOrderId === normalizedOrderId && (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: 0,
                                  marginBottom: '4px',
                                  padding: '8px 10px',
                                  minWidth: '160px',
                                  backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#fff',
                                  border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #dee2e6',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                  zIndex: 60,
                                  fontSize: '12px',
                                  color: isDarkMode ? 'var(--text-primary)' : '#333'
                                }}
                              >
                                {row.dasher_status && <div><strong>Status:</strong> {getDasherStatusLabel(row.dasher_status)}</div>}
                                {row.dasher_info && (row.dasher_info.first_name || row.dasher_info.last_name) && (
                                  <div><strong>Name:</strong> {[row.dasher_info.first_name, row.dasher_info.last_name].filter(Boolean).join(' ')}</div>
                                )}
                                {row.dasher_info?.vehicle && (row.dasher_info.vehicle.make || row.dasher_info.vehicle.model) && (
                                  <div><strong>Vehicle:</strong> {[row.dasher_info.vehicle.make, row.dasher_info.vehicle.model].filter(Boolean).join(' ')}</div>
                                )}
                                {row.dasher_info?.phone_number && <div style={{ marginTop: '4px' }}><strong>Phone:</strong> {row.dasher_info.phone_number}</div>}
                                {!row.dasher_status && !row.dasher_info && <div>No dasher info yet</div>}
                              </div>
                            )}
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); updateOrderStatus(normalizedOrderId, 'ready') }} disabled={!!statusUpdatingOrderId} style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`, background: isDarkMode ? '#333' : '#f0f0f0', color: isDarkMode ? '#fff' : '#333', fontSize: '11px', cursor: statusUpdatingOrderId ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>{statusUpdatingOrderId === normalizedOrderId ? '…' : 'Mark ready'}</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); openDoordashOrderManager(normalizedOrderId) }} style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`, background: isDarkMode ? '#333' : '#f0f0f0', color: isDarkMode ? '#fff' : '#333', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Order Manager</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setDoordashAdjustModalOrderId(normalizedOrderId) }} style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`, background: isDarkMode ? '#333' : '#f0f0f0', color: isDarkMode ? '#fff' : '#333', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Adjust</button>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setDoordashCancelModal({ orderId: normalizedOrderId }); setDoordashCancelReason('OTHER'); setDoordashCancelDetails('') }} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #b91c1c', background: isDarkMode ? '#5c1a1a' : '#fef2f2', color: isDarkMode ? '#fca5a5' : '#b91c1c', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Cancel</button>
                        </div>
                      )}
                      {/* Product info + actions ellipsis inline (bottom right when collapsed) */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${cardThemeColor}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {(() => {
                            const cardItems = orderDetails[normalizedOrderId]?.items ?? orderItemsMap[normalizedOrderId] ?? []
                            if (cardItems.length === 0) return null
                            return (
                              <>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#666', marginBottom: '6px', textTransform: 'uppercase' }}>Items</div>
                                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#555', lineHeight: 1.5 }}>
                                  {cardItems.slice(0, 5).map((item, i) => (
                                    <li key={i}>
                                      {item.product_name || item.productName || 'Item'} ×{item.quantity || 0}
                                    </li>
                                  ))}
                                  {cardItems.length > 5 && (
                                    <li style={{ color: isDarkMode ? '#999' : '#888', fontSize: '12px' }}>+{cardItems.length - 5} more</li>
                                  )}
                                </ul>
                              </>
                            )
                          })()}
                        </div>
                        {!isExpanded && (
                          <div
                            ref={actionsDropdownOrderId === normalizedOrderId ? actionsDropdownRef : null}
                            style={{ position: 'relative', flexShrink: 0 }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActionsDropdownOrderId(prev => prev === normalizedOrderId ? null : normalizedOrderId)
                              }}
                              style={{
                                padding: '6px',
                                border: 'none',
                                background: 'none',
                                color: isDarkMode ? 'var(--text-primary)' : '#333',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <MoreVertical size={20} />
                            </button>
                            {actionsDropdownOrderId === normalizedOrderId && (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  right: 0,
                                  left: 'auto',
                                  marginBottom: '4px',
                                  minWidth: '160px',
                                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#fff',
                                  border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #dee2e6',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                  zIndex: 50,
                                  overflow: 'hidden'
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setActionsDropdownOrderId(null); fetchOrderById(normalizedOrderId) }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    textAlign: 'left',
                                    border: 'none',
                                    background: 'none',
                                    fontSize: '14px',
                                    color: isDarkMode ? 'var(--text-primary)' : '#333',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Return
                                </button>
                                {isUnpaidOrder(row, details) && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleVoidOrder(normalizedOrderId) }}
                                    style={{
                                      width: '100%',
                                      padding: '10px 14px',
                                      textAlign: 'left',
                                      border: 'none',
                                      borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                                      background: 'none',
                                      fontSize: '14px',
                                      color: isDarkMode ? 'var(--text-primary)' : '#333',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Void
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleReprintReceipt(normalizedOrderId) }}
                                  style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    textAlign: 'left',
                                    border: 'none',
                                    borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                                    background: 'none',
                                    fontSize: '14px',
                                    color: isDarkMode ? 'var(--text-primary)' : '#333',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Reprint receipt
                                </button>
                                {cardSource === 'doordash' && (row.order_status || '').toLowerCase() !== 'voided' && (
                                  <>
                                    <div style={{ borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee', margin: '4px 0' }} />
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setActionsDropdownOrderId(null); updateOrderStatus(normalizedOrderId, 'ready') }} disabled={!!statusUpdatingOrderId} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'none', fontSize: '14px', color: isDarkMode ? 'var(--text-primary)' : '#333', cursor: 'pointer' }}>Mark ready</button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setActionsDropdownOrderId(null); openDoordashOrderManager(normalizedOrderId) }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'none', fontSize: '14px', color: isDarkMode ? 'var(--text-primary)' : '#333', cursor: 'pointer' }}>Order Manager</button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setActionsDropdownOrderId(null); setDoordashAdjustModalOrderId(normalizedOrderId) }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'none', fontSize: '14px', color: isDarkMode ? 'var(--text-primary)' : '#333', cursor: 'pointer' }}>Adjust</button>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setActionsDropdownOrderId(null); setDoordashCancelModal({ orderId: normalizedOrderId }); setDoordashCancelReason('OTHER'); setDoordashCancelDetails('') }} style={{ width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'none', fontSize: '14px', color: '#b91c1c', cursor: 'pointer' }}>Cancel with DoorDash</button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${cardThemeColor}` }}>
                          {isLoading ? (
                            <div style={{ textAlign: 'center', padding: '12px', color: isDarkMode ? '#999' : '#999', fontSize: '13px' }}>Loading...</div>
                          ) : details ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                              {details.prepare_by && (
                                <div style={{ color: isDarkMode ? 'var(--text-secondary)' : '#666' }}>Prepare by: {formatOrderDate(details.prepare_by)}</div>
                              )}
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
                              <div
                                ref={actionsDropdownOrderId === normalizedOrderId ? actionsDropdownRef : null}
                                style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${cardThemeColor}`, position: 'relative', display: 'flex', justifyContent: 'flex-end' }}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setActionsDropdownOrderId(prev => prev === normalizedOrderId ? null : normalizedOrderId)
                                  }}
                                  style={{
                                    padding: '6px',
                                    border: 'none',
                                    background: 'none',
                                    color: isDarkMode ? 'var(--text-primary)' : '#333',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <MoreVertical size={20} />
                                </button>
                                {actionsDropdownOrderId === normalizedOrderId && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: '100%',
                                      right: 0,
                                      left: 'auto',
                                      marginTop: '4px',
                                      minWidth: '160px',
                                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#fff',
                                      border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #dee2e6',
                                      borderRadius: '8px',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                      zIndex: 50,
                                      overflow: 'hidden'
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setActionsDropdownOrderId(null); fetchOrderById(normalizedOrderId) }}
                                      style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        textAlign: 'left',
                                        border: 'none',
                                        background: 'none',
                                        fontSize: '14px',
                                        color: isDarkMode ? 'var(--text-primary)' : '#333',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Return
                                    </button>
                                    {isUnpaidOrder(row, details) && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleVoidOrder(normalizedOrderId) }}
                                        style={{
                                          width: '100%',
                                          padding: '10px 14px',
                                          textAlign: 'left',
                                          border: 'none',
                                          borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                                          background: 'none',
                                          fontSize: '14px',
                                          color: isDarkMode ? 'var(--text-primary)' : '#333',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Void
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleReprintReceipt(normalizedOrderId) }}
                                      style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        textAlign: 'left',
                                        border: 'none',
                                        borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                                        background: 'none',
                                        fontSize: '14px',
                                        color: isDarkMode ? 'var(--text-primary)' : '#333',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Reprint
                                    </button>
                                  </div>
                                )}
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
                  <tr style={{ backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f8f9fa' }}>
                    {columnsWithActions.map(col => (
                      <th
                        key={col}
                        style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                          padding: '12px',
                          textAlign: 'left',
                          fontWeight: 600,
                          borderBottom: '2px solid #dee2e6',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#495057',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f8f9fa',
                          boxShadow: '0 1px 0 0 #dee2e6'
                        }}
                      >
                        {getColumnHeaderLabel(col)}
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
                    return (
                      <Fragment key={`order-${normalizedOrderId ?? 'n/a'}-${idx}`}>
                        <tr 
                          ref={el => {
                            if (normalizedOrderId) {
                              rowRefs.current[normalizedOrderId] = el
                            }
                          }}
                          onClick={() => handleRowClick(row)}
                          style={{ 
                            backgroundColor: idx % 2 === 0 ? (isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff') : (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#fafafa'),
                            cursor: 'pointer',
                            border: 'none',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          {visibleColumns.map(col => {
                            if (col === 'Status') {
                              const nextPhase = getNextPhase(row)
                              return (
                                <td
                                  key={col}
                                  style={{
                                    padding: '8px 12px',
                                    borderBottom: '1px solid #eee',
                                    fontSize: '14px',
                                    textAlign: 'left',
                                    cursor: nextPhase ? 'pointer' : 'default'
                                  }}
                                  onClick={nextPhase ? (e) => openStatusPhaseModal(row, e) : undefined}
                                  role={nextPhase ? 'button' : undefined}
                                  title={nextPhase ? `Move to ${nextPhase.label}` : undefined}
                                >
                                  <span style={getStatusPillStyle(row)}>
                                    {getStatusDisplay(row)}
                                  </span>
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
                            const sourceLogo = col === 'order_number' ? getOrderSourceLogo(row) : null
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
                                {sourceLogo ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                    {sourceLogo.textOnly ? (
                                      <span style={{ fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#666' }}>{sourceLogo.alt}</span>
                                    ) : (
                                      <img src={sourceLogo.src} alt={sourceLogo.alt} style={{ height: '18px', width: 'auto', maxWidth: '80px', objectFit: 'contain' }} />
                                    )}
                                    {formattedValue}
                                  </span>
                                ) : formattedValue}
                              </td>
                            )
                          })}
                          <td 
                            style={{ padding: '8px 12px', borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee', position: 'relative' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              ref={actionsDropdownOrderId === normalizedOrderId ? actionsDropdownRef : null}
                              style={{ position: 'relative', display: 'inline-block' }}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActionsDropdownOrderId(prev => prev === normalizedOrderId ? null : normalizedOrderId)
                                }}
                                style={{
                                  padding: '6px',
                                  border: 'none',
                                  background: 'none',
                                  color: isDarkMode ? 'var(--text-primary)' : '#333',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <MoreVertical size={20} />
                              </button>
                              {actionsDropdownOrderId === normalizedOrderId && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '4px',
                                    minWidth: '140px',
                                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#fff',
                                    border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #dee2e6',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    zIndex: 50,
                                    overflow: 'hidden'
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setActionsDropdownOrderId(null); fetchOrderById(normalizedOrderId) }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 14px',
                                      textAlign: 'left',
                                      border: 'none',
                                      background: 'none',
                                      fontSize: '13px',
                                      color: isDarkMode ? 'var(--text-primary)' : '#333',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Return
                                  </button>
                                  {isUnpaidOrder(row, details) && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleVoidOrder(normalizedOrderId) }}
                                      style={{
                                        width: '100%',
                                        padding: '8px 14px',
                                        textAlign: 'left',
                                        border: 'none',
                                        borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                                        background: 'none',
                                        fontSize: '13px',
                                        color: isDarkMode ? 'var(--text-primary)' : '#333',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Void
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleReprintReceipt(normalizedOrderId) }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 14px',
                                      textAlign: 'left',
                                      border: 'none',
                                      borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee',
                                      background: 'none',
                                      fontSize: '13px',
                                      color: isDarkMode ? 'var(--text-primary)' : '#333',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Reprint
                                  </button>
                                </div>
                              )}
                            </div>
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
                                    {(details.customer_name || details.customerName) && (
                                      <div>
                                        <strong>Customer:</strong> {details.customer_name || details.customerName}
                                      </div>
                                    )}
                                    {(details.customer_phone || details.customerPhone) && (
                                      <div style={{ gridColumn: '1 / -1' }}>
                                        <strong>Customer phone:</strong>{' '}
                                        <a href={`tel:${(details.customer_phone || details.customerPhone).replace(/\s/g, '')}`} style={{ color: isDarkMode ? '#93c5fd' : '#2563eb', textDecoration: 'none' }}>
                                          {details.customer_phone || details.customerPhone}
                                        </a>
                                        {(details.order_source || details.orderSource)?.toString().toLowerCase().trim() === 'doordash' && (
                                          <span style={{ fontSize: '11px', color: isDarkMode ? '#888' : '#666', marginLeft: '6px' }}>(masked; call from store number)</span>
                                        )}
                                      </div>
                                    )}
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
                                      <strong>Discount Type:</strong> {details.discount_type ? ({ student: 'Student', employee: 'Employee', senior: 'Senior', military: 'Military', other: 'Other' }[details.discount_type] || details.discount_type) : '—'}
                                    </div>
                                    <div>
                                      <strong>Transaction Fee:</strong> ${(parseFloat(details.transaction_fee) || 0).toFixed(2)}
                                    </div>
                                    <div>
                                      <strong>Tip:</strong> ${(parseFloat(details.tip) || 0).toFixed(2)}
                                    </div>
                                    {details.prepare_by && (
                                      <div style={{ gridColumn: '1 / -1' }}>
                                        <strong>Prepare by:</strong> {formatOrderDate(details.prepare_by)}
                                      </div>
                                    )}
                                    {(details.order_source || details.orderSource)?.toString().toLowerCase().trim() === 'doordash' && (details.dasher_status || details.dasher_info) && (
                                      <div style={{ gridColumn: '1 / -1' }}>
                                        <strong>Dasher:</strong>{' '}
                                        {details.dasher_status && getDasherStatusLabel(details.dasher_status)}
                                        {details.dasher_status && details.dasher_info && (details.dasher_info.first_name || details.dasher_info.last_name || (details.dasher_info.vehicle && (details.dasher_info.vehicle.make || details.dasher_info.vehicle.model))) && ' · '}
                                        {details.dasher_info && (details.dasher_info.first_name || details.dasher_info.last_name) && (
                                          <span>{[details.dasher_info.first_name, details.dasher_info.last_name].filter(Boolean).join(' ')}</span>
                                        )}
                                        {details.dasher_info?.vehicle && (details.dasher_info.vehicle.make || details.dasher_info.vehicle.model) && (
                                          <span> · {[details.dasher_info.vehicle.make, details.dasher_info.vehicle.model].filter(Boolean).join(' ')}</span>
                                        )}
                                        {details.dasher_info?.phone_number && (
                                          <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: isDarkMode ? '#888' : '#666' }}>
                                            Phone: {details.dasher_info.phone_number} (call from store number)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {(details.order_type || details.orderType || '').toLowerCase() === 'delivery' && (details.customer_address || details.customerAddress) && (
                                      <div style={{ gridColumn: '1 / -1' }}>
                                        <strong>Delivery address:</strong> {details.customer_address || details.customerAddress}
                                      </div>
                                    )}
                                    {/* Status / phase update for pickup & delivery */}
                                    <div style={{ gridColumn: '1 / -1', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #dee2e6' }}>
                                      <strong>Status:</strong> {getStatusDisplay(details)}
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
                                        {(details.order_source || details.orderSource) && (
                                          <span style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap' }}>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); updateOrderStatus(normalizedOrderId, 'ready') }} disabled={!!statusUpdatingOrderId} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`, background: isDarkMode ? '#333' : '#f0f0f0', color: isDarkMode ? '#fff' : '#333', fontSize: '12px', cursor: statusUpdatingOrderId ? 'not-allowed' : 'pointer' }}>{statusUpdatingOrderId === normalizedOrderId ? '…' : 'Mark ready'}</button>
                                            {(details.order_source || details.orderSource).toString().toLowerCase().trim() === 'doordash' && (details.order_status || '').toLowerCase() !== 'voided' && (
                                              <>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); openDoordashOrderManager(normalizedOrderId); }} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`, background: isDarkMode ? '#333' : '#f0f0f0', color: isDarkMode ? '#fff' : '#333', fontSize: '12px', cursor: 'pointer' }}>Order Manager</button>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setDoordashAdjustModalOrderId(normalizedOrderId); }} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`, background: isDarkMode ? '#333' : '#f0f0f0', color: isDarkMode ? '#fff' : '#333', fontSize: '12px', cursor: 'pointer' }}>Adjust</button>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setDoordashCancelModal({ orderId: normalizedOrderId }); setDoordashCancelReason('OTHER'); setDoordashCancelDetails(''); }} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#8b2e2e' : '#c53030'}`, background: isDarkMode ? '#5c1a1a' : '#fef2f2', color: isDarkMode ? '#fca5a5' : '#b91c1c', fontSize: '12px', cursor: 'pointer' }}>Cancel with DoorDash</button>
                                              </>
                                            )}
                                            {(details.order_type || '').toLowerCase() === 'delivery' && (
                                              <>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); updateOrderStatus(normalizedOrderId, 'out_for_delivery') }} disabled={!!statusUpdatingOrderId} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`, background: isDarkMode ? '#333' : '#f0f0f0', color: isDarkMode ? '#fff' : '#333', fontSize: '12px', cursor: statusUpdatingOrderId ? 'not-allowed' : 'pointer' }}>{statusUpdatingOrderId === normalizedOrderId ? '…' : 'Out for delivery'}</button>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); updateOrderStatus(normalizedOrderId, 'delivered') }} disabled={!!statusUpdatingOrderId} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`, background: isDarkMode ? '#333' : '#f0f0f0', color: isDarkMode ? '#fff' : '#333', fontSize: '12px', cursor: statusUpdatingOrderId ? 'not-allowed' : 'pointer' }}>{statusUpdatingOrderId === normalizedOrderId ? '…' : 'Shipped'}</button>
                                              </>
                                            )}
                                          </span>
                                        )}
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
            )}
            {ordersTotal > ORDERS_PAGE_SIZE && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap', padding: '0 16px 16px' }}>
                <span style={{ fontSize: '13px', color: isDarkMode ? '#aaa' : '#666' }}>
                  Page {ordersPage + 1} of {Math.max(1, Math.ceil(ordersTotal / ORDERS_PAGE_SIZE))} ({ordersTotal} orders)
                </span>
                <button
                  type="button"
                  disabled={ordersPage === 0 || loading}
                  onClick={() => setOrdersPage((p) => Math.max(0, p - 1))}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    border: isDarkMode ? '1px solid #444' : '1px solid #ccc',
                    borderRadius: '6px',
                    background: isDarkMode ? '#333' : '#f5f5f5',
                    color: (ordersPage === 0 || loading) ? (isDarkMode ? '#666' : '#999') : (isDarkMode ? '#fff' : '#333'),
                    cursor: (ordersPage === 0 || loading) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={ordersPage >= Math.ceil(ordersTotal / ORDERS_PAGE_SIZE) - 1 || loading}
                  onClick={() => setOrdersPage((p) => p + 1)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    border: isDarkMode ? '1px solid #444' : '1px solid #ccc',
                    borderRadius: '6px',
                    background: isDarkMode ? '#333' : '#f5f5f5',
                    color: (ordersPage >= Math.ceil(ordersTotal / ORDERS_PAGE_SIZE) - 1 || loading) ? (isDarkMode ? '#666' : '#999') : (isDarkMode ? '#fff' : '#333'),
                    cursor: (ordersPage >= Math.ceil(ordersTotal / ORDERS_PAGE_SIZE) - 1 || loading) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
          ) : (
            <div style={{ padding: isMobile ? '24px' : '40px', textAlign: 'center', color: isDarkMode ? '#999' : '#999' }}>No orders found</div>
          )
        )}
      </div>

      {/* Status phase confirmation modal */}
      {statusPhaseModal && (() => {
        const { row, orderId } = statusPhaseModal
        const next = getNextPhase(row)
        const modalItems = orderDetails[orderId]?.items ?? orderItemsMap[orderId] ?? []
        return (
          <div
            style={modalOverlayStyle(isDarkMode)}
            onClick={closeStatusPhaseModal}
          >
            <div
              style={modalContentStyle(isDarkMode, { padding: isMobile ? '16px' : '24px', maxWidth: isMobile ? '95%' : '420px' })}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={formTitleStyle(isDarkMode)}>Move order to next phase</h3>
              <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary)' : '#666', marginBottom: '12px' }}>
                Order <strong>{row.order_number ?? row.orderNumber ?? orderId}</strong> · Current: {getStatusDisplay(row)}
              </div>
              {next && (
                <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#555', marginBottom: '16px' }}>
                  Next phase: <strong>{next.label}</strong>
                </div>
              )}
              <FormField>
                <FormLabel isDarkMode={isDarkMode}>Items in order</FormLabel>
                {statusPhaseModalLoadingItems ? (
                  <div style={{ padding: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#666', fontSize: '14px' }}>Loading items…</div>
                ) : modalItems.length === 0 ? (
                  <div style={{ padding: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#666', fontSize: '14px' }}>No items</div>
                ) : (
                  <ul style={{ margin: '0 0 0', paddingLeft: '20px', fontSize: '14px', color: isDarkMode ? 'var(--text-secondary)' : '#444', lineHeight: 1.6 }}>
                    {modalItems.map((item, idx) => (
                      <li key={item.order_item_id ?? item.orderItemId ?? idx}>
                        {(item.quantity ?? 1) > 1 ? `${item.quantity}x ` : ''}
                        {item.product_name ?? item.productName ?? item.name ?? 'Item'}
                        {item.variant_name || item.variantName ? ` (${item.variant_name ?? item.variantName})` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </FormField>
              <CompactFormActions
                onCancel={closeStatusPhaseModal}
                onPrimary={confirmStatusPhaseMove}
                primaryLabel={next && statusUpdatingOrderId === orderId ? 'Updating…' : (next ? `Move to ${next.label}` : 'Move')}
                primaryDisabled={!next || statusUpdatingOrderId === orderId}
                primaryType="button"
                isDarkMode={isDarkMode}
                themeColorRgb={themeColorRgb}
              />
            </div>
          </div>
        )
      })()}

      {/* DoorDash cancel order modal */}
      {doordashCancelModal && (
        <div
          style={modalOverlayStyle(isDarkMode)}
          onClick={() => !doordashCancelLoading && setDoordashCancelModal(null)}
        >
          <div
            style={modalContentStyle(isDarkMode, { padding: isMobile ? '16px' : '24px', maxWidth: isMobile ? '95%' : '400px' })}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={formTitleStyle(isDarkMode)}>Cancel order with DoorDash</h3>
            <p style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#666', marginBottom: '12px' }}>
              This tells DoorDash to cancel the order. STORE_CLOSED deactivates the store 12 hrs; KITCHEN_BUSY for 15 min.
            </p>
            <FormField>
              <FormLabel isDarkMode={isDarkMode}>Reason</FormLabel>
              <select
                value={doordashCancelReason}
                onChange={(e) => setDoordashCancelReason(e.target.value)}
                disabled={doordashCancelLoading}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                  background: isDarkMode ? '#2d2d2d' : '#fff',
                  color: isDarkMode ? '#fff' : '#333',
                  fontSize: '14px'
                }}
              >
                <option value="ITEM_OUT_OF_STOCK">Item out of stock</option>
                <option value="STORE_CLOSED">Store closed</option>
                <option value="KITCHEN_BUSY">Kitchen busy</option>
                <option value="OTHER">Other</option>
              </select>
            </FormField>
            <FormField>
              <FormLabel isDarkMode={isDarkMode}>Details (optional)</FormLabel>
              <textarea
                value={doordashCancelDetails}
                onChange={(e) => setDoordashCancelDetails(e.target.value)}
                disabled={doordashCancelLoading}
                placeholder="e.g. Store closed due to low capacity"
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                  background: isDarkMode ? '#2d2d2d' : '#fff',
                  color: isDarkMode ? '#fff' : '#333',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
            </FormField>
            <CompactFormActions
              onCancel={() => !doordashCancelLoading && setDoordashCancelModal(null)}
              onPrimary={() => cancelDoordashOrder(doordashCancelModal.orderId)}
              primaryLabel={doordashCancelLoading ? 'Cancelling…' : 'Cancel with DoorDash'}
              primaryDisabled={doordashCancelLoading}
              primaryType="button"
              isDarkMode={isDarkMode}
              themeColorRgb={themeColorRgb}
            />
          </div>
        </div>
      )}

      {/* DoorDash Adjust info modal */}
      {doordashAdjustModalOrderId && (
        <div role="dialog" aria-modal="true" style={modalOverlayStyle} onClick={() => setDoordashAdjustModalOrderId(null)}>
          <div style={{ ...modalContentStyle(isDarkMode), maxWidth: '360px' }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '0 0 12px', fontSize: '14px', color: isDarkMode ? 'var(--text-primary)' : '#333' }}>
              To adjust items (change quantity, remove item, or substitute), use DoorDash Order Manager.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setDoordashAdjustModalOrderId(null)} style={{ padding: '8px 14px', borderRadius: '6px', border: isDarkMode ? '1px solid #555' : '1px solid #ccc', background: 'transparent', color: isDarkMode ? '#fff' : '#333', cursor: 'pointer' }}>Close</button>
              <button type="button" onClick={() => { openDoordashOrderManager(doordashAdjustModalOrderId); setDoordashAdjustModalOrderId(null); }} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #FF3008', background: '#FF3008', color: '#fff', cursor: 'pointer' }}>Open Order Manager</button>
            </div>
          </div>
        </div>
      )}
      {/* DoorDash Live Order Manager modal (iframe) */}
      {doordashOrderManagerModal && (
        <div
          style={modalOverlayStyle(isDarkMode)}
          onClick={() => setDoordashOrderManagerModal(null)}
        >
          <div
            style={{
              ...modalContentStyle(isDarkMode, { padding: 0, maxWidth: '96vw', width: '96vw', height: '90vh', display: 'flex', flexDirection: 'column' }),
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: isDarkMode ? '1px solid var(--border-light)' : '1px solid #eee' }}>
              <span style={{ fontWeight: 600, fontSize: '16px' }}>DoorDash Order Manager</span>
              <button type="button" onClick={() => setDoordashOrderManagerModal(null)} style={{ padding: '6px 12px', borderRadius: '6px', border: isDarkMode ? '1px solid #555' : '1px solid #ccc', background: isDarkMode ? '#333' : '#f0f0f0', color: isDarkMode ? '#fff' : '#333', cursor: 'pointer', fontSize: '14px' }}>Close</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              {doordashOrderManagerModal.loading && <p style={{ color: isDarkMode ? 'var(--text-secondary)' : '#666' }}>Loading Order Manager…</p>}
              {doordashOrderManagerModal.error && (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: isDarkMode ? '#fca5a5' : '#b91c1c', marginBottom: '12px' }}>{doordashOrderManagerModal.error}</p>
                  <p style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#666' }}>Order Manager is unavailable at this time. Please reach out to support to update this order.</p>
                </div>
              )}
              {doordashOrderManagerModal.url && !doordashOrderManagerModal.loading && (
                <iframe
                  title="DoorDash Order Manager"
                  src={doordashOrderManagerModal.url}
                  style={{ width: '100%', height: '100%', minHeight: '500px', border: 'none', borderRadius: '8px' }}
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </div>
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
            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
            borderRadius: '8px',
            padding: isMobile ? '16px' : '30px',
            maxWidth: isMobile ? '95%' : '960px',
            width: isMobile ? '95%' : '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ marginBottom: 0, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', fontSize: '14px' }}>
              <span style={{ marginRight: '16px' }}>Date: {new Date(order.order_date).toLocaleDateString()}</span>
              <span style={{ marginRight: '16px' }}>Total: ${(() => {
                const base = (parseFloat(order.subtotal) || 0) + (parseFloat(order.tax_amount || order.tax) || 0) - (parseFloat(order.discount) || 0)
                const tip = parseFloat(order.tip) || 0
                const stored = parseFloat(order.total) || 0
                const val = tip > 0 && stored <= base ? base + tip : (order.total != null ? order.total : order.subtotal ?? 0)
                return parseFloat(val || 0).toFixed(2)
              })()}</span>
              <span style={{ marginRight: '16px' }}>Payment: {order.payment_method ? (order.payment_method === 'cash' ? 'Cash' : 'Card') : 'N/A'}</span>
              <span style={{ color: isDarkMode ? 'var(--text-tertiary, #666)' : '#999', fontWeight: 400 }}>Order: {order.order_number}</span>
            </div>

            {orderItems.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '24px',
              alignItems: 'flex-start'
            }}>
              {/* Left column: return type, reason, summary, actions */}
              <div style={{
                flex: isMobile ? 'none' : '0 0 280px',
                width: isMobile ? '100%' : '280px',
                minWidth: 0
              }}>
            {/* Return Type Selection */}
            <div style={{ marginTop: '13px', marginBottom: '12px' }}>
              <FormField>
                <FormLabel isDarkMode={isDarkMode}>Return Type:</FormLabel>
                <div ref={returnTypeDropdownRef} style={{ position: 'relative', width: '100%' }}>
                  <button
                    type="button"
                    onClick={() => setReturnTypeDropdownOpen(!returnTypeDropdownOpen)}
                    style={{
                      ...inputBaseStyle(isDarkMode, themeColorRgb, returnTypeDropdownOpen),
                      width: '100%',
                      padding: '5px 14px',
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

                {/* Return Amount Summary - discount and tip aware */}
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
                  const orderSubtotal = parseFloat(order.subtotal) || 0
                  const orderDiscount = parseFloat(order.discount) || 0
                  const orderTip = parseFloat(order.tip) || 0
                  const returnOrderDiscountDeduction = orderSubtotal > 0 && orderDiscount > 0
                    ? orderDiscount * (returnSubtotal / orderSubtotal)
                    : 0
                  const returnSubtotalAfterOrderDiscount = returnSubtotal - returnOrderDiscountDeduction
                  const returnTipDeduction = orderSubtotal > 0 && orderTip > 0
                    ? orderTip * (returnSubtotal / orderSubtotal)
                    : 0
                  const totalOrderQtySummary = orderItems.reduce((s, i) => s + (i.quantity || 0), 0)
                  const totalReturnQtySummary = Object.values(selectedItems).reduce((s, d) => s + (d.quantity || 0), 0)
                  const isFullReturnSummary = totalOrderQtySummary > 0 && totalReturnQtySummary >= totalOrderQtySummary
                  if (isFullReturnSummary && order.transaction_fee && order.subtotal) {
                    const feeRate = parseFloat(order.transaction_fee) / parseFloat(order.subtotal)
                    returnProcessingFee = returnSubtotalAfterOrderDiscount * feeRate
                  }
                  const effectiveFee = posReturnSettings.return_transaction_fee_take_loss ? 0 : (isFullReturnSummary ? returnProcessingFee : 0)
                  const effectiveTip = posReturnSettings.return_tip_refund ? 0 : returnTipDeduction
                  const returnTotal = returnSubtotalAfterOrderDiscount + returnTax - effectiveFee - effectiveTip
                  return (
                    <div style={{
                      marginTop: '16px',
                      marginBottom: '16px',
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
                        <span>Discount (proportional):</span>
                        <span style={{ fontWeight: 500, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>${returnOrderDiscountDeduction.toFixed(2)}</span>
                        <span>Return Tax:</span>
                        <span style={{ fontWeight: 500 }}>${returnTax.toFixed(2)}</span>
                        <span>{posReturnSettings.return_transaction_fee_take_loss ? 'Transaction fee:' : 'Transaction fee (non-refundable):'}</span>
                        <span style={{ fontWeight: 500, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>
                          ${posReturnSettings.return_transaction_fee_take_loss ? returnProcessingFee.toFixed(2) : effectiveFee.toFixed(2)}
                        </span>
                        <span>{posReturnSettings.return_tip_refund ? 'Tip:' : 'Tip (non-refundable):'}</span>
                        <span style={{ fontWeight: 500, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>
                          ${posReturnSettings.return_tip_refund ? returnTipDeduction.toFixed(2) : effectiveTip.toFixed(2)}
                        </span>
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
              </div>

              {/* Right column: product list */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: 0 }}>
                <div style={{ overflowX: 'auto', marginTop: 0, paddingTop: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 0 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${isDarkMode ? 'var(--border-light, #333)' : '#dee2e6'}` }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', textTransform: 'uppercase' }}>Product</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', textTransform: 'uppercase' }}>Qty</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', textTransform: 'uppercase' }}>Condition</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', textTransform: 'uppercase' }}>Reason</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', textTransform: 'uppercase' }}>Note</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', textTransform: 'uppercase' }}>Price</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', textTransform: 'uppercase' }}>Select</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item) => {
                        const isSelected = !!selectedItems[item.order_item_id]
                        const selectedData = selectedItems[item.order_item_id] || { quantity: 1, condition: 'new', maxQuantity: item.quantity, reason: '', note: '' }
                        
                        const reasonOptions = [
                          { value: '', label: 'Select' },
                          { value: 'defective', label: 'Defective' },
                          { value: 'wrong_item', label: 'Wrong item' },
                          { value: 'changed_mind', label: 'Changed mind' },
                          { value: 'damaged', label: 'Damaged' },
                          { value: 'other', label: 'Other' }
                        ]
                        const conditionOptions = [
                          { value: 'new', label: 'New' },
                          { value: 'opened', label: 'Opened' },
                          { value: 'damaged', label: 'Damaged' },
                          { value: 'defective', label: 'Defective' }
                        ]
                        const currentCondition = isSelected ? selectedData.condition : 'new'
                        const conditionLabel = conditionOptions.find(opt => opt.value === currentCondition)?.label || 'New'
                        const isConditionDropdownOpen = openConditionDropdowns[item.order_item_id] || false
                        const currentReason = selectedData.reason || ''
                        const reasonLabel = reasonOptions.find(opt => opt.value === currentReason)?.label || 'Select'
                        const isReasonDropdownOpen = openReasonDropdowns[item.order_item_id] || false
                        const isNoteExpanded = expandedNoteItemId === item.order_item_id
                        
                        if (!conditionDropdownRefs.current[item.order_item_id]) {
                          conditionDropdownRefs.current[item.order_item_id] = { current: null }
                        }
                        if (!reasonDropdownRefs.current[item.order_item_id]) {
                          reasonDropdownRefs.current[item.order_item_id] = { current: null }
                        }
                        
                        return (
                          <Fragment key={item.order_item_id}>
                          <tr>
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
                                disabled={!isSelected || item.quantity === 1}
                                style={{
                                  ...inputBaseStyle(isDarkMode, themeColorRgb),
                                  width: '60px',
                                  padding: '4px 8px',
                                  fontSize: '14px',
                                  opacity: isSelected && item.quantity > 1 ? 1 : 0.5
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
                                    const opening = !openConditionDropdowns[item.order_item_id]
                                    setOpenConditionDropdowns(prev => ({ ...prev, [item.order_item_id]: !prev[item.order_item_id] }))
                                    if (opening) {
                                      requestAnimationFrame(() => {
                                        const el = conditionDropdownRefs.current[item.order_item_id]?.current
                                        if (el) {
                                          const r = el.getBoundingClientRect()
                                          setConditionDropdownRect({ itemId: item.order_item_id, top: r.top, left: r.left, width: r.width, height: r.height })
                                        }
                                      })
                                    } else {
                                      setConditionDropdownRect(null)
                                    }
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
                              </div>
                            </td>
                            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#f0f0f0'}` }}>
                              <div ref={el => { reasonDropdownRefs.current[item.order_item_id].current = el }} style={{ position: 'relative', width: 'fit-content', minWidth: '72px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isSelected) toggleItem(item.order_item_id, item.quantity)
                                    const opening = !openReasonDropdowns[item.order_item_id]
                                    setOpenReasonDropdowns(prev => ({ ...prev, [item.order_item_id]: !prev[item.order_item_id] }))
                                    if (opening) {
                                      requestAnimationFrame(() => {
                                        const el = reasonDropdownRefs.current[item.order_item_id]?.current
                                        if (el) {
                                          const r = el.getBoundingClientRect()
                                          setReasonDropdownRect({ itemId: item.order_item_id, top: r.top, left: r.left, width: r.width, height: r.height })
                                        }
                                      })
                                    } else {
                                      setReasonDropdownRect(null)
                                    }
                                  }}
                                  disabled={!isSelected}
                                  style={{
                                    ...inputBaseStyle(isDarkMode, themeColorRgb, isReasonDropdownOpen),
                                    width: 'fit-content',
                                    minWidth: '72px',
                                    padding: '4px 8px',
                                    fontSize: '13px',
                                    cursor: isSelected ? 'pointer' : 'not-allowed',
                                    opacity: isSelected ? 1 : 0.5,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    textAlign: 'left'
                                  }}
                                >
                                  <span style={{ fontSize: '13px' }}>{reasonLabel}</span>
                                  <ChevronDown size={14} style={{ color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', transform: isReasonDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '8px 12px', borderBottom: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#f0f0f0'}` }}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isSelected) toggleItem(item.order_item_id, item.quantity)
                                  setExpandedNoteItemId(prev => prev === item.order_item_id ? null : item.order_item_id)
                                }}
                                disabled={!isSelected}
                                style={{
                                  padding: '6px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  background: isNoteExpanded ? `rgba(${themeColorRgb}, 0.2)` : (isDarkMode ? 'var(--bg-tertiary, #2d2d2d)' : '#f0f0f0'),
                                  color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                                  cursor: isSelected ? 'pointer' : 'not-allowed',
                                  opacity: isSelected ? 1 : 0.5
                                }}
                                title="Add note"
                              >
                                <Pencil size={14} />
                              </button>
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
                          {isNoteExpanded && (
                            <tr>
                              <td colSpan={7} style={{ padding: '0', borderBottom: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#f0f0f0'}` }}>
                                <div style={{ padding: '8px 12px', backgroundColor: isDarkMode ? 'var(--bg-secondary, #252525)' : '#f8f9fa' }}>
                                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>Note for this item</label>
                                  <textarea
                                    value={selectedData.note || ''}
                                    onChange={(e) => updateItemNote(item.order_item_id, e.target.value)}
                                    placeholder="Write a note..."
                                    rows={2}
                                    style={{
                                      ...inputBaseStyle(isDarkMode, themeColorRgb),
                                      width: '100%',
                                      minHeight: '56px',
                                      resize: 'vertical',
                                      fontSize: '14px'
                                    }}
                                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                  />
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
              </div>
            </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee' }}>
              {returnProcessedResult ? (
                <>
                  {posReturnSettings.require_signature_for_return ? (
                    <>
                      <button
                        onClick={() => {
                          setOrder(null)
                          setOrderItems([])
                          setSelectedItems({})
                          setReason('')
                          setNotes('')
                          setReturnType(null)
                          setExchangeTiming(null)
                          setReturnProcessedResult(null)
                          setReturnReceiptChoice(null)
                        }}
                        style={{
                          padding: '4px 16px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap',
                          backgroundColor: 'var(--bg-tertiary)', border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`, borderRadius: '8px',
                          fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer'
                        }}
                      >
                        Done
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/customer-display/settings')
                            const data = await res.json()
                            if (data.success && data.data) {
                              setReturnCheckoutUi(data.data.checkout_ui ?? null)
                            }
                          } catch (e) {
                            console.error('Failed to load checkout UI for return receipt', e)
                          }
                          setShowReturnReceiptOptionsModal(true)
                        }}
                        style={{
                          padding: '4px 16px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap',
                          backgroundColor: `rgba(${themeColorRgb}, 0.7)`, border: `1px solid rgba(${themeColorRgb}, 0.5)`, borderRadius: '8px',
                          fontSize: '14px', fontWeight: 600, color: '#fff', cursor: 'pointer'
                        }}
                      >
                        Show receipt options
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (returnProcessedResult.return_receipt_url) window.open(returnProcessedResult.return_receipt_url, '_blank')
                          setOrder(null)
                          setOrderItems([])
                          setSelectedItems({})
                          setReason('')
                          setNotes('')
                          setReturnType(null)
                          setExchangeTiming(null)
                          setReturnProcessedResult(null)
                          setReturnReceiptChoice(null)
                        }}
                        style={{
                          padding: '4px 16px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap',
                          backgroundColor: 'var(--bg-tertiary)', border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`, borderRadius: '8px',
                          fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer'
                        }}
                      >
                        Print
                      </button>
                      <button
                        onClick={() => {
                          setOrder(null)
                          setOrderItems([])
                          setSelectedItems({})
                          setReason('')
                          setNotes('')
                          setReturnType(null)
                          setExchangeTiming(null)
                          setReturnProcessedResult(null)
                          setReturnReceiptChoice(null)
                        }}
                        style={{
                          padding: '4px 16px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap',
                          backgroundColor: 'var(--bg-tertiary)', border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`, borderRadius: '8px',
                          fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer'
                        }}
                      >
                        No receipt
                      </button>
                      <button
                        onClick={() => {
                          if (returnProcessedResult.return_receipt_url) window.open(returnProcessedResult.return_receipt_url, '_blank')
                          setOrder(null)
                          setOrderItems([])
                          setSelectedItems({})
                          setReason('')
                          setNotes('')
                          setReturnType(null)
                          setExchangeTiming(null)
                          setReturnProcessedResult(null)
                          setReturnReceiptChoice(null)
                        }}
                        style={{
                          padding: '4px 16px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap',
                          backgroundColor: `rgba(${themeColorRgb}, 0.7)`, border: `1px solid rgba(${themeColorRgb}, 0.5)`, borderRadius: '8px',
                          fontSize: '14px', fontWeight: 600, color: '#fff', cursor: 'pointer'
                        }}
                      >
                        Email
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setOrder(null)
                      setOrderItems([])
                      setSelectedItems({})
                      setReason('')
                      setNotes('')
                      setReturnType(null)
                      setExchangeTiming(null)
                      setReturnProcessedResult(null)
                      setReturnSignatureStep(false)
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
                    onClick={() => createReturn(null)}
                    disabled={returnLoading || Object.keys(selectedItems).length === 0 || !returnType || (returnType === 'exchange' && !exchangeTiming)}
                    style={{
                      padding: '4px 16px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
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
                  >
                    {returnLoading ? 'Processing...' : 'Process Return'}
                  </button>
                </>
              )}
            </div>
            {/* Checkout UI (same as POS): sign + print/email/none when "Require signature for return" is on */}
            {showReturnReceiptOptionsModal && returnProcessedResult && (
              <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10003,
                display: 'flex',
                flexDirection: 'column',
                background: 'transparent'
              }}>
                <CustomerDisplayPopup
                  cart={[]}
                  subtotal={0}
                  tax={0}
                  discount={0}
                  transactionFee={0}
                  total={0}
                  tip={0}
                  paymentMethod={null}
                  amountPaid={null}
                  showSummary={true}
                  paymentCompleted={true}
                  returnId={returnProcessedResult.return_id}
                  initialCheckoutUi={returnCheckoutUi}
                  onReturnReceiptSelect={async (receiptAction, signatureData) => {
                    setReturnReceiptOptionsLoading(true)
                    try {
                      const res = await fetch('/api/return_receipt_options', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          return_id: returnProcessedResult.return_id,
                          signature: signatureData || null,
                          receipt_action: receiptAction
                        })
                      })
                      const data = await res.json()
                      if (data.success) {
                        if (data.return_receipt_url) window.open(data.return_receipt_url, '_blank')
                        setShowReturnReceiptOptionsModal(false)
                        setOrder(null)
                        setOrderItems([])
                        setSelectedItems({})
                        setReason('')
                        setNotes('')
                        setReturnType(null)
                        setExchangeTiming(null)
                        setReturnProcessedResult(null)
                        setExpandedRow(null)
                        setToast({ message: receiptAction === 'none' ? 'Done.' : 'Return receipt options saved.', type: 'success' })
                      } else {
                        setToast({ message: data.message || 'Failed to save', type: 'error' })
                      }
                    } catch (e) {
                      setToast({ message: 'Error saving receipt options', type: 'error' })
                    } finally {
                      setReturnReceiptOptionsLoading(false)
                    }
                  }}
                  onClose={() => {
                    setShowReturnReceiptOptionsModal(false)
                  }}
                />
              </div>
            )}
          </div>
        {conditionDropdownRect && openConditionDropdowns[conditionDropdownRect.itemId] && (() => {
          const itemId = conditionDropdownRect.itemId
          const currentCondition = selectedItems[itemId]?.condition || 'new'
          const conditionOptions = [
            { value: 'new', label: 'New' },
            { value: 'opened', label: 'Opened' },
            { value: 'damaged', label: 'Damaged' },
            { value: 'defective', label: 'Defective' }
          ]
          return createPortal(
            <div
              ref={conditionDropdownPortalRef}
              style={{
                position: 'fixed',
                top: conditionDropdownRect.top + conditionDropdownRect.height + 4,
                left: conditionDropdownRect.left,
                minWidth: conditionDropdownRect.width,
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                borderRadius: '8px',
                boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 10002,
                overflow: 'hidden'
              }}
            >
              {conditionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    updateItemCondition(itemId, option.value)
                    setOpenConditionDropdowns(prev => ({ ...prev, [itemId]: false }))
                    setConditionDropdownRect(null)
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
            </div>,
            document.body
          )
        })()}
        {reasonDropdownRect && openReasonDropdowns[reasonDropdownRect.itemId] && (() => {
          const itemId = reasonDropdownRect.itemId
          const currentReason = selectedItems[itemId]?.reason || ''
          const reasonOptions = [
            { value: '', label: 'Select' },
            { value: 'defective', label: 'Defective' },
            { value: 'wrong_item', label: 'Wrong item' },
            { value: 'changed_mind', label: 'Changed mind' },
            { value: 'damaged', label: 'Damaged' },
            { value: 'other', label: 'Other' }
          ]
          return createPortal(
            <div
              ref={reasonDropdownPortalRef}
              style={{
                position: 'fixed',
                top: reasonDropdownRect.top + reasonDropdownRect.height + 4,
                left: reasonDropdownRect.left,
                width: 'max-content',
                minWidth: '100px',
                maxWidth: '180px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                borderRadius: '8px',
                boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 10002,
                overflow: 'hidden'
              }}
            >
              {reasonOptions.map((option) => (
                <button
                  key={option.value || 'none'}
                  type="button"
                  onClick={() => {
                    updateItemReason(itemId, option.value)
                    setOpenReasonDropdowns(prev => ({ ...prev, [itemId]: false }))
                    setReasonDropdownRect(null)
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    background: currentReason === option.value ? `rgba(${themeColorRgb}, 0.1)` : 'none',
                    textAlign: 'left',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    fontWeight: currentReason === option.value ? 600 : 400
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #1a1a1a)' : '#f5f5f5'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = currentReason === option.value ? `rgba(${themeColorRgb}, 0.1)` : 'transparent'
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body
          )
        })()}
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
    </>
  )
}

export default RecentOrders

