import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { usePermissions, ProtectedComponent } from '../contexts/PermissionContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import BarcodeScanner from './BarcodeScanner'
import CustomerDisplayPopup from './CustomerDisplayPopup'
import { ScanBarcode, UserPlus, CheckCircle, Gift, X, AlertCircle, Percent, Check, Pencil } from 'lucide-react'
import { formLabelStyle, formModalStyle, inputBaseStyle, getInputFocusHandlers, FormModalActions } from './FormStyles'

function POS({ employeeId, employeeName }) {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const { themeColor, themeMode } = useTheme()
  const { show: showToast } = useToast()
  
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
  const [cart, setCart] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categoryProducts, setCategoryProducts] = useState([])
  const [taxRate, setTaxRate] = useState(0.08) // Default 8% tax
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [processing, setProcessing] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [amountPaid, setAmountPaid] = useState('')
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [showChangeScreen, setShowChangeScreen] = useState(false)
  const [changeAmount, setChangeAmount] = useState(0)
  const [paymentCompleted, setPaymentCompleted] = useState(false)
  const [currentTransactionId, setCurrentTransactionId] = useState(null)
  const [currentOrderId, setCurrentOrderId] = useState(null)
  const [currentOrderNumber, setCurrentOrderNumber] = useState(null)
  const [showCustomerDisplay, setShowCustomerDisplay] = useState(false)
  const [showSummary, setShowSummary] = useState(false) // Show transaction summary before payment
  const [selectedTip, setSelectedTip] = useState(0) // Tip amount selected by customer
  const selectedTipRef = useRef(0) // Ref to avoid stale closure when processOrder runs
  const [orderType, setOrderType] = useState(null) // 'pickup', 'delivery', or null
  const [customerInfoConfirmed, setCustomerInfoConfirmed] = useState(false) // when true, hide pickup/delivery form and show summary only
  const [payAtPickupOrDelivery, setPayAtPickupOrDelivery] = useState(false) // true = pay when pickup/delivery (order placed with payment pending)
  const [allowPayAtPickupEnabled, setAllowPayAtPickupEnabled] = useState(false) // from Settings: "Allow pay at pickup" — when false, only "Pay now" is valid
  const [orderPlacedPayLater, setOrderPlacedPayLater] = useState(null) // { orderId, orderNumber, total } after placing pay-later order
  const [orderToPayFromScan, setOrderToPayFromScan] = useState(null) // legacy: modal "Mark as paid (cash)" only
  const [payingForOrderId, setPayingForOrderId] = useState(null) // when set: order loaded in POS for payment (cart + customer); complete via checkout UI
  const [payingForOrderNumber, setPayingForOrderNumber] = useState(null)
  const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false) // Show customer info modal
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  })
  const [rewardsSettings, setRewardsSettings] = useState({
    enabled: false,
    require_email: false,
    require_phone: false,
    require_both: false,
    reward_type: 'points',
    points_per_dollar: 1.0,
    points_redemption_value: 0.01
  })
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)
  const [showRewardsModal, setShowRewardsModal] = useState(false)
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false)
  const [editCustomerForm, setEditCustomerForm] = useState({ customer_name: '', email: '', phone: '', address: '' })
  const [customerRewardsDetail, setCustomerRewardsDetail] = useState(null)
  const [pointsToUse, setPointsToUse] = useState('')
  const [rewardsDetailLoading, setRewardsDetailLoading] = useState(false)
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountInput, setDiscountInput] = useState('')
  const [orderDiscount, setOrderDiscount] = useState(0)
  const [orderDiscountType, setOrderDiscountType] = useState('') // 'student' | 'employee' | 'senior' | 'military' | 'other' | ''
  // Preset discount scenarios (label and percent)
  const DISCOUNT_PRESETS = [
    { id: 'student', label: 'Student', percent: 10 },
    { id: 'employee', label: 'Employee', percent: 15 },
    { id: 'senior', label: 'Senior', percent: 10 },
    { id: 'military', label: 'Military', percent: 10 }
  ]
  // POS intelligent search: space-separated tokens become filter chips (size, topping, etc.) – configurable for any product type
  const [searchFilterChips, setSearchFilterChips] = useState([])
  const [posSearchFilters, setPosSearchFilters] = useState(null)
  const [pendingQuantityForChip, setPendingQuantityForChip] = useState(null) // e.g. "½" when user typed "1/2 " before next word
  // Transaction fee: settings from pos + accounting; method set when customer picks Cash/Card
  const [transactionFeeSettings, setTransactionFeeSettings] = useState({ rates: {}, mode: 'additional', charge_cash: false })
  const [paymentMethodForFee, setPaymentMethodForFee] = useState(null) // 'cash' | 'credit_card' | null
  const searchInputRef = useRef(null) // focus after scan so scanner's Enter doesn't trigger Pay

  // Default filter config so intelligent search works even if API fails (sm, roni, 1/2 pep, etc.)
  const DEFAULT_POS_FILTERS = {
    filter_groups: [
      { id: 'size', label: 'Size', options: [
        { abbrevs: ['sm', 's'], value: 'Small', variant_name: 'Small' },
        { abbrevs: ['md', 'm', 'med'], value: 'Medium', variant_name: 'Medium' },
        { abbrevs: ['lg', 'l'], value: 'Large', variant_name: 'Large' },
        { abbrevs: ['slice', 'sl'], value: 'Slice', variant_name: 'Slice' },
        { abbrevs: ['10', '10in'], value: '10"', variant_name: '10" Small' },
        { abbrevs: ['12', '12in'], value: '12"', variant_name: '12" Medium' },
        { abbrevs: ['14', '14in'], value: '14"', variant_name: '14" Large' },
      ]},
      { id: 'topping', label: 'Topping', options: [
        { abbrevs: ['roni', 'pep'], value: 'Pepperoni' },
        { abbrevs: ['pep'], value: 'Peppers', quantity_abbrevs: { '1/2': '½', 'half': '½', 'full': 'Full' } },
        { abbrevs: ['mush'], value: 'Mushrooms' },
        { abbrevs: ['olive'], value: 'Olives' },
        { abbrevs: ['saus'], value: 'Sausage' },
        { abbrevs: ['ham'], value: 'Ham' },
        { abbrevs: ['bacon'], value: 'Bacon' },
      ]},
      { id: 'drink_addin', label: 'Add-in', options: [
        { abbrevs: ['esp', 'shot'], value: 'Extra shot' },
        { abbrevs: ['oat'], value: 'Oat milk' },
        { abbrevs: ['ice'], value: 'Iced' },
        { abbrevs: ['decaf'], value: 'Decaf' },
      ]},
    ],
  }
  const effectiveFilters = posSearchFilters && posSearchFilters.filter_groups ? posSearchFilters : DEFAULT_POS_FILTERS
  
  // Check if user can process sales
  const canProcessSale = hasPermission('process_sale')
  const canApplyDiscount = hasPermission('apply_discount')
  const canVoidTransaction = hasPermission('void_transaction')

  const checkRegisterOpen = async () => {
    const sessionToken = localStorage.getItem('sessionToken')
    if (!sessionToken) return false
    try {
      const res = await fetch(`/api/register/session?status=open`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })
      const data = await res.json()
      return data.success && data.data && Array.isArray(data.data) && data.data.length > 0
    } catch (e) {
      return false
    }
  }

  // Check for exchange credit on mount
  useEffect(() => {
    const exchangeCredit = localStorage.getItem('exchangeCredit')
    if (exchangeCredit) {
      try {
        const credit = JSON.parse(exchangeCredit)
        // Add exchange credit as a special item in cart
        setCart([{
          product_id: 'EXCHANGE_CREDIT',
          product_name: 'Exchange Credit',
          sku: credit.credit_id ? `EXC-${credit.credit_id}` : 'EXCHANGE',
          unit_price: -credit.amount, // Negative price = credit/discount
          quantity: 1,
          available_quantity: 999,
          is_exchange_credit: true,
          exchange_credit_id: credit.credit_id,
          exchange_return_id: credit.return_id
        }])
        showToast(`Exchange credit of $${credit.amount.toFixed(2)} added to cart`, 'success')
        // Clear from localStorage after adding
        localStorage.removeItem('exchangeCredit')
      } catch (e) {
        console.error('Error parsing exchange credit:', e)
        localStorage.removeItem('exchangeCredit')
      }
    }
  }, [])

  // React Query: cache POS bootstrap; refetch on window focus for fresh products
  const {
    data: bootstrapData,
    isLoading: bootstrapLoading,
    isSuccess: bootstrapSuccess,
    refetch: refetchBootstrap
  } = useQuery({
    queryKey: ['pos-bootstrap'],
    queryFn: async () => {
      const res = await fetch('/api/pos-bootstrap')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load')
      return json
    },
    staleTime: 2 * 60 * 1000,
    retry: 1
  })

  useEffect(() => {
    if (!bootstrapSuccess || !bootstrapData?.success) return
    const data = bootstrapData
    if (data.inventory?.data) {
      setAllProducts(data.inventory.data)
      const rawPaths = (data.inventory.data || []).map(p => p.category).filter(cat => cat && cat.trim() !== '')
      const pathPrefixes = (path) => {
        if (!path || typeof path !== 'string') return []
        const parts = path.split(' > ').map(p => p.trim()).filter(Boolean)
        const out = []
        for (let i = 1; i <= parts.length; i++) out.push(parts.slice(0, i).join(' > '))
        return out
      }
      setCategories([...new Set(rawPaths.flatMap(pathPrefixes))].sort())
    }
    if (data.posSearchFilters) setPosSearchFilters(data.posSearchFilters)
    if (data.rewardsSettings) {
      setRewardsSettings(prev => ({
        ...prev,
        enabled: data.rewardsSettings.enabled === 1 || data.rewardsSettings.enabled === true,
        require_email: data.rewardsSettings.require_email === 1 || data.rewardsSettings.require_email === true,
        require_phone: data.rewardsSettings.require_phone === 1 || data.rewardsSettings.require_phone === true,
        require_both: data.rewardsSettings.require_both === 1 || data.rewardsSettings.require_both === true,
        reward_type: data.rewardsSettings.reward_type || 'points',
        points_per_dollar: parseFloat(data.rewardsSettings.points_per_dollar) || 1.0,
        points_redemption_value: parseFloat(data.rewardsSettings.points_redemption_value) || 0.01
      }))
    }
    if (data.posSettings) {
      setTransactionFeeSettings(prev => ({
        ...prev,
        mode: (data.posSettings.transaction_fee_mode || 'additional').toLowerCase(),
        charge_cash: !!data.posSettings.transaction_fee_charge_cash
      }))
    }
  }, [bootstrapSuccess, bootstrapData])

  const loading = bootstrapLoading

  useEffect(() => {
    const handleFocus = () => {
      refetchBootstrap()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refetchBootstrap])

  // Hide scrollbar for POS category buttons
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .pos-category-buttons-scroll::-webkit-scrollbar {
        display: none;
      }
    `
    document.head.appendChild(style)
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style)
      }
    }
  }, [])

  // Load accounting fee rates when logged in (mode/charge_cash come from bootstrap posSettings)
  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem('sessionToken')
    const load = async () => {
      try {
        const defaultRates = { credit_card: 0.029, debit_card: 0.015, mobile_payment: 0.026, cash: 0, check: 0, store_credit: 0 }
        if (!token) {
          if (!cancelled) setTransactionFeeSettings(prev => ({ ...prev, rates: defaultRates }))
          return
        }
        const accRes = await fetch('/api/accounting/settings', { headers: { 'X-Session-Token': token } })
        const accData = accRes.ok ? await accRes.json() : {}
        if (cancelled) return
        const rates = accData.data?.transaction_fee_rates || defaultRates
        setTransactionFeeSettings(prev => ({ ...prev, rates }))
      } catch (e) {
        if (!cancelled) setTransactionFeeSettings(prev => ({ ...prev }))
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Load order/delivery settings so "Pay at pickup" option is only shown when enabled in Settings
  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem('sessionToken')
    const load = async () => {
      try {
        if (!token) return
        const res = await fetch('/api/order-delivery-settings', { headers: { 'X-Session-Token': token } })
        const data = res.ok ? await res.json() : {}
        if (cancelled) return
        const enabled = !!data.allow_pay_at_pickup
        setAllowPayAtPickupEnabled(enabled)
        if (!enabled) setPayAtPickupOrDelivery(false) // ensure pay-later is off when setting is disabled
      } catch (e) {
        if (!cancelled) {
          setAllowPayAtPickupEnabled(false)
          setPayAtPickupOrDelivery(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const loadRewardsSettings = async () => {
    try {
      const response = await fetch('/api/customer-rewards-settings')
      const data = await response.json()
      if (data.success && data.settings) {
        setRewardsSettings(prev => ({
          ...prev,
          enabled: data.settings.enabled === 1 || data.settings.enabled === true,
          require_email: data.settings.require_email === 1 || data.settings.require_email === true,
          require_phone: data.settings.require_phone === 1 || data.settings.require_phone === true,
          require_both: data.settings.require_both === 1 || data.settings.require_both === true,
          reward_type: data.settings.reward_type || 'points',
          points_per_dollar: parseFloat(data.settings.points_per_dollar) || 1.0,
          points_redemption_value: parseFloat(data.settings.points_redemption_value) || 0.01
        }))
      }
    } catch (error) {
      console.error('Error loading rewards settings:', error)
    }
  }

  // Resolve a word (and optional pending quantity) to a filter chip. Returns { type, label, value, variant_name } or null.
  const resolveFilterWord = (word, pendingQty) => {
    if (!word || typeof word !== 'string') return null
    const w = word.toLowerCase().trim()
    if (!w) return null
    const config = effectiveFilters?.filter_groups || []
    for (const group of config) {
      for (const opt of group.options || []) {
        const abbrevs = (opt.abbrevs || []).map(a => (a || '').toLowerCase())
        const quantityAbbrevs = opt.quantity_abbrevs || {}
        if (pendingQty) {
          const qKey = Object.keys(quantityAbbrevs).find(k => k.toLowerCase() === pendingQty.word?.toLowerCase())
          const qLabel = qKey ? quantityAbbrevs[qKey] : pendingQty.label
          if (abbrevs.includes(w)) {
            return { type: group.id, typeLabel: group.label, value: opt.value, variant_name: opt.variant_name, label: qLabel ? `${qLabel} ${opt.value}` : opt.value }
          }
        } else {
          if (abbrevs.includes(w)) {
            return { type: group.id, typeLabel: group.label, value: opt.value, variant_name: opt.variant_name, label: opt.value }
          }
          const qKey = Object.keys(quantityAbbrevs).find(k => k.toLowerCase() === w)
          if (qKey) {
            return { isQuantityPrefix: true, label: quantityAbbrevs[qKey], word: w }
          }
        }
      }
    }
    return null
  }

  // Search products (use searchTerm; filter chips are separate and applied when adding to cart)
  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchProducts(searchTerm)
      setSelectedCategory(null) // Clear category selection when searching
    } else {
      setSearchResults([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  // Match product to category: exact or under that path (e.g. "Food & Beverage" shows "Food & Beverage > Produce > Fruits")
  const productMatchesCategory = (product, category) => {
    const cat = product.category || ''
    if (cat === category) return true
    if (category && cat.startsWith(category + ' >')) return true
    return false
  }

  // Update category products when category is selected
  useEffect(() => {
    if (selectedCategory && searchTerm.length < 2) {
      const filtered = allProducts.filter(product =>
        productMatchesCategory(product, selectedCategory)
      )
      setCategoryProducts(filtered)
    } else {
      setCategoryProducts([])
    }
  }, [selectedCategory, allProducts, searchTerm])

  const fetchAllProducts = async () => {
    try {
      const response = await fetch(`/api/inventory?item_type=product&include_variants=1`)
      const data = await response.json()
      
      if (data.data) {
        setAllProducts(data.data)
        // Build category list with every path prefix so item appears under master and all subcategories
        const rawPaths = data.data
          .map(product => product.category)
          .filter(cat => cat && cat.trim() !== '')
        const pathPrefixes = (path) => {
          if (!path || typeof path !== 'string') return []
          const parts = path.split(' > ').map(p => p.trim()).filter(Boolean)
          const out = []
          for (let i = 1; i <= parts.length; i++) out.push(parts.slice(0, i).join(' > '))
          return out
        }
        const uniqueCategories = [...new Set(rawPaths.flatMap(pathPrefixes))].sort()
        setCategories(uniqueCategories)
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
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
    try {
      // Always fetch fresh data from API to include newly created products
      const response = await fetch(`/api/inventory?item_type=product&include_variants=1`)
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
    }
  }

  const [showVariantModal, setShowVariantModal] = useState(false)
  const [productForVariant, setProductForVariant] = useState(null)

  const addToCart = (product, variant = null, notes = null) => {
    // For any product with variants (drinks, pizza, all sized items): if user has a size chip, use it and skip modal
    if (product.variants && product.variants.length > 0 && !variant) {
      const sizeChip = searchFilterChips.find(c => c.variant_name != null)
      const matchedVariant = sizeChip && product.variants
        ? product.variants.find(v => {
            const vName = (v.variant_name || '').toLowerCase().replace(/\s+/g, ' ').trim()
            const chipName = (sizeChip.variant_name || '').toLowerCase().replace(/\s+/g, ' ').trim()
            if (!chipName) return false
            // Exact match first (so Small/Large for coffee match correctly)
            if (vName === chipName) return true
            // Then variant name contains chip (e.g. "10\" Small" contains "small" for pizza)
            return vName.includes(chipName)
          })
        : null
      if (matchedVariant) {
        const noteChips = searchFilterChips.filter(c => c.variant_name == null)
        const notesStr = noteChips.length ? noteChips.map(c => c.label).join(', ') : null
        addToCart(product, matchedVariant, notesStr)
        return
      }
      setProductForVariant(product)
      setShowVariantModal(true)
      return
    }
    // Use variant price when present (API may return price or unit_price)
    const variantPrice = variant != null && (variant.price !== undefined || variant.unit_price !== undefined)
      ? parseFloat(variant.price ?? variant.unit_price)
      : null
    const unitPrice = variantPrice != null && !Number.isNaN(variantPrice)
      ? variantPrice
      : (parseFloat(product.product_price) || 0)
    const baseName = variant ? `${product.product_name} (${variant.variant_name || variant.name || 'Size'})` : product.product_name
    const displayName = notes ? `${baseName} — ${notes}` : baseName
    const notesStr = notes && notes.trim() ? notes.trim() : null
    const variantId = variant?.variant_id != null ? Number(variant.variant_id) : null
    setCart(prevCart => {
      const existingItem = prevCart.find(item =>
        item.product_id === product.product_id &&
        (item.variant_id != null ? Number(item.variant_id) : null) === variantId &&
        (item.notes || '') === (notesStr || '')
      )
      if (existingItem) {
        return prevCart.map(item =>
          item.product_id === product.product_id &&
          (item.variant_id != null ? Number(item.variant_id) : null) === variantId &&
          (item.notes || '') === (notesStr || '')
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prevCart, {
        product_id: product.product_id,
        product_name: displayName,
        sku: product.sku,
        unit_price: unitPrice,
        quantity: 1,
        available_quantity: product.current_quantity || 0,
        variant_id: variantId,
        variant_name: variant?.variant_name || variant?.name || null,
        notes: notesStr
      }]
    })
    setSearchTerm('')
    setSearchResults([])
    setSearchFilterChips([])
    setPendingQuantityForChip(null)
    setShowVariantModal(false)
    setProductForVariant(null)
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
    
    try {
      // Always fetch fresh data from API to include newly created products
      const response = await fetch(`/api/inventory?item_type=product&include_variants=1`)
      const data = await response.json()
      
      // Update cached products list
      if (data.data) {
        setAllProducts(data.data)
        // Build category list with every path prefix (master + subcategories)
        const rawPaths = data.data
          .map(product => product.category)
          .filter(cat => cat && cat.trim() !== '')
        const pathPrefixes = (path) => {
          if (!path || typeof path !== 'string') return []
          const parts = path.split(' > ').map(p => p.trim()).filter(Boolean)
          const out = []
          for (let i = 1; i <= parts.length; i++) out.push(parts.slice(0, i).join(' > '))
          return out
        }
        const uniqueCategories = [...new Set(rawPaths.flatMap(pathPrefixes))].sort()
        setCategories(uniqueCategories)
        
        // Normalize scanned barcode - remove all whitespace and convert to string
        const normalizedScannedBarcode = barcode.toString().replace(/\s+/g, '')
        const rawBarcode = barcode.toString().trim()
        // Extract order number from scan (scanners may send ORD# or wrong chars): keep only letters, digits, dashes
        const cleanedOrderBarcode = rawBarcode.replace(/[^A-Za-z0-9-]/g, '')
        const orderNumberMatch = rawBarcode.match(/(ORD-?\d{4}-?\d{2}-?\d{2}-?\d+)/i) || cleanedOrderBarcode.match(/(ORD-?\d{8}-?\d+)/i)
        const extractedOrderNumber = orderNumberMatch ? orderNumberMatch[1].toUpperCase().replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : null
        
        // Debug logging
        console.log('Scanned barcode:', barcode, 'Normalized:', normalizedScannedBarcode, 'Cleaned:', cleanedOrderBarcode, 'Extracted:', extractedOrderNumber)
        
        // Helper function to normalize barcode for comparison
        const normalizeBarcode = (barcodeValue) => {
          if (!barcodeValue) return null
          // Convert to string, remove all whitespace, and trim
          return barcodeValue.toString().replace(/\s+/g, '').trim()
        }
        
        // Helper function to compare barcodes (handles string/number and leading zeros)
        const compareBarcodes = (barcode1, barcode2) => {
          const norm1 = normalizeBarcode(barcode1)
          const norm2 = normalizeBarcode(barcode2)
          if (!norm1 || !norm2) return false
          
          // Exact match
          if (norm1 === norm2) return true
          
          // Try numeric comparison (handles leading zeros)
          const num1 = parseInt(norm1, 10)
          const num2 = parseInt(norm2, 10)
          if (!isNaN(num1) && !isNaN(num2) && num1 === num2) {
            return true
          }
          
          return false
        }
        
        // Debug: log all products with barcodes
        const productsWithBarcodes = data.data.filter(p => p.barcode)
        console.log('Products with barcodes:', productsWithBarcodes.map(p => ({
          name: p.product_name,
          barcode: p.barcode,
          normalized: normalizeBarcode(p.barcode),
          barcodeLength: normalizeBarcode(p.barcode)?.length
        })))
        
        // Try to find by barcode first (exact match with normalization)
        let product = data.data.find(p => p.barcode && compareBarcodes(p.barcode, normalizedScannedBarcode))
        
        // If not found and barcode is 13 digits (EAN13), try without leading 0 (12 digits)
        if (!product && normalizedScannedBarcode.length === 13 && normalizedScannedBarcode.startsWith('0')) {
          const barcode12 = normalizedScannedBarcode.substring(1)
          console.log('Trying 12-digit version:', barcode12)
          product = data.data.find(p => p.barcode && compareBarcodes(p.barcode, barcode12))
        }
        
        // If not found and barcode is 12 digits, try with leading 0 (13 digits)
        if (!product && normalizedScannedBarcode.length === 12 && /^\d+$/.test(normalizedScannedBarcode)) {
          const barcode13 = '0' + normalizedScannedBarcode
          console.log('Trying 13-digit version:', barcode13)
          product = data.data.find(p => p.barcode && compareBarcodes(p.barcode, barcode13))
        }
        
        // If not found by barcode, try by SKU (with normalization)
        if (!product) {
          product = data.data.find(p => {
            if (!p.sku) return false
            const normalizedSku = normalizeBarcode(p.sku)
            return normalizedSku && compareBarcodes(normalizedSku, normalizedScannedBarcode)
          })
        }
        
        if (product) {
          console.log('Product found:', product.product_name)
          // Add to cart
          addToCart(product)
          console.log('Cart updated with product:', product.product_name)
          // Keep scanner open for continuous scanning
          showToast(`Added ${product.product_name} to cart`, 'success')
          return
        }

        // Check if barcode is an order number (store credit receipt OR pay-later order to complete payment)
        // Only treat as order when it contains "ORD" or is a short digit string (order_id); long digit-only = product barcode (UPC/EAN)
        const digitsOnly = (rawBarcode.replace(/\D/g, '') || '')
        const looksLikeOrderNumber = /ORD/i.test(rawBarcode) || extractedOrderNumber || (/^\d+$/.test(cleanedOrderBarcode) && cleanedOrderBarcode.length <= 10)
        // Build order number variants: try exact scan first (e.g. ORD-20260205-211812), then normalized forms
        const orderNumVariants = [cleanedOrderBarcode, rawBarcode, extractedOrderNumber].filter(Boolean)
        const ordDigits = cleanedOrderBarcode.replace(/^ORD/i, '').replace(/-/g, '')
        if (ordDigits.length >= 9 && /^ORD/i.test(cleanedOrderBarcode)) {
          const withDashes = `ORD-${ordDigits.slice(0, 8)}-${ordDigits.slice(8)}`
          if (!orderNumVariants.includes(withDashes)) orderNumVariants.push(withDashes)
        }
        if (looksLikeOrderNumber) {
          // Only try variants that look like valid order numbers (avoid mangled scanner data like ORD#",4:"%/-)
          const validOrderNum = (s) => typeof s === 'string' && s.length >= 3 && /^[A-Za-z0-9\-]+$/.test(s)
          const variantsToTry = orderNumVariants.filter(validOrderNum)
          if (variantsToTry.length === 0 && cleanedOrderBarcode) variantsToTry.push(cleanedOrderBarcode)
          for (const orderNum of variantsToTry) {
            if (!orderNum || orderNum.length < 3) continue
            try {
              const storeCreditRes = await fetch(`/api/store_credit/by_order/${encodeURIComponent(orderNum)}`)
              const storeCreditData = await storeCreditRes.json()
              if (storeCreditData.success && storeCreditData.credit) {
                const credit = storeCreditData.credit
                const existingCredit = cart.find(item => item.is_exchange_credit && item.exchange_credit_id === credit.transaction_id)
                if (existingCredit) {
                  showToast('Store credit from this order is already in cart', 'error')
                  return
                }
                setCart(prevCart => [...prevCart, {
                  product_id: 'EXCHANGE_CREDIT',
                  product_name: 'Store Credit',
                  sku: credit.credit_number || `EXC-order-${credit.order_id}`,
                  unit_price: -credit.amount,
                  quantity: 1,
                  available_quantity: 999,
                  is_exchange_credit: true,
                  exchange_credit_id: credit.transaction_id,
                  exchange_return_id: credit.return_id
                }])
                setShowSummary(false)
                setShowCustomerDisplay(false)
                showToast(`Store credit $${credit.amount.toFixed(2)} (order ${credit.order_number || orderNum}) added to cart`, 'success')
                setTimeout(() => searchInputRef.current?.focus(), 0)
                return
              }
            } catch (e) {
              console.error('Store credit by order lookup:', e)
            }
          }
          // No store credit for this barcode: try loading as pay-later order (order search)
          const orderSearchVariants = []
          if (extractedOrderNumber) orderSearchVariants.push({ type: 'order_number', value: extractedOrderNumber })
          if (cleanedOrderBarcode && cleanedOrderBarcode.toUpperCase().startsWith('ORD')) orderSearchVariants.push({ type: 'order_number', value: cleanedOrderBarcode })
          orderSearchVariants.push({ type: 'order_number', value: rawBarcode })
          if (digitsOnly) orderSearchVariants.push({ type: 'order_id', value: digitsOnly })
          if (/^\d+$/.test(cleanedOrderBarcode)) orderSearchVariants.push({ type: 'order_id', value: cleanedOrderBarcode })
          for (const { type, value } of orderSearchVariants) {
            if (!value) continue
            if (type === 'order_id' ? value.length < 1 : value.length < 3) continue
            try {
              const searchParam = type === 'order_id' ? `order_id=${encodeURIComponent(value)}` : `order_number=${encodeURIComponent(value)}`
              const orderRes = await fetch(`/api/orders/search?${searchParam}`)
              const orderData = await orderRes.json()
              const order = Array.isArray(orderData.data) && orderData.data.length > 0 ? orderData.data[0] : orderData.data
              if (order) {
                // Before loading any order for payment: if this order has store credit, add credit to cart only (don't open checkout)
                const canonicalOrderNum = order.order_number ?? (order.order_id != null ? String(order.order_id) : '')
                if (canonicalOrderNum) {
                try {
                  const storeCreditCheck = await fetch(`/api/store_credit/by_order/${encodeURIComponent(canonicalOrderNum)}`)
                  const storeCreditCheckData = await storeCreditCheck.json()
                  if (storeCreditCheckData.success && storeCreditCheckData.credit) {
                    const credit = storeCreditCheckData.credit
                    const existingCredit = cart.find(item => item.is_exchange_credit && item.exchange_credit_id === credit.transaction_id)
                    if (!existingCredit) {
                      setCart(prev => [...prev, {
                        product_id: 'EXCHANGE_CREDIT',
                        product_name: 'Store Credit',
                        sku: credit.credit_number || `EXC-order-${credit.order_id}`,
                        unit_price: -credit.amount,
                        quantity: 1,
                        available_quantity: 999,
                        is_exchange_credit: true,
                        exchange_credit_id: credit.transaction_id,
                        exchange_return_id: credit.return_id
                      }])
                      setShowSummary(false)
                      setShowCustomerDisplay(false)
                      showToast(`Store credit $${credit.amount.toFixed(2)} added to cart`, 'success')
                      setTimeout(() => searchInputRef.current?.focus(), 0)
                      return
                    }
                  }
                } catch (e) { /* ignore */ }
                }
                // Scanning an order barcode = store credit receipt only. Never open checkout or load order for payment.
                const orderLabel = order.order_number || order.order_id || 'order'
                if ((order.payment_status || 'completed').toLowerCase() === 'pending') {
                  showToast(`No store credit for ${orderLabel}. Use Recent Orders to pay for this order.`, 'error')
                } else {
                  showToast(`No store credit for ${orderLabel} (already paid).`, 'error')
                }
                return
              }
            } catch (orderErr) {
              console.error('Order lookup error:', orderErr)
            }
          }
        }
        
        // Check if barcode is an exchange credit (starts with EXC-)
        if (barcode.toString().startsWith('EXC-')) {
          try {
            const creditResponse = await fetch(`/api/exchange_credit/${barcode}`)
            const creditData = await creditResponse.json()
            
            if (creditData.success && creditData.credit) {
              const credit = creditData.credit
              // Check if credit is already in cart
              const existingCredit = cart.find(item => item.is_exchange_credit && item.exchange_credit_id === credit.transaction_id)
              if (existingCredit) {
                showToast('Exchange credit already in cart', 'error')
                return
              }
              
              // Add exchange credit to cart
              setCart(prevCart => [...prevCart, {
                product_id: 'EXCHANGE_CREDIT',
                product_name: 'Exchange Credit',
                sku: credit.credit_number || `EXC-${credit.transaction_id}`,
                unit_price: -credit.amount, // Negative price = credit/discount
                quantity: 1,
                available_quantity: 999,
                is_exchange_credit: true,
                exchange_credit_id: credit.transaction_id,
                exchange_return_id: credit.return_id
              }])
              setShowSummary(false)
              setShowCustomerDisplay(false)
              showToast(`Exchange credit of $${credit.amount.toFixed(2)} added to cart`, 'success')
              setTimeout(() => searchInputRef.current?.focus(), 0)
              return
            }
          } catch (creditErr) {
            console.error('Error looking up exchange credit:', creditErr)
          }
        }
      }
      
      // If not found locally, show error
      console.log('Product not found for barcode:', barcode)
      showToast(`Product with barcode "${barcode}" not found. Try taking a photo for image-based identification.`, 'error')
      
    } catch (err) {
      console.error('Barcode scan error:', err)
      showToast('Error looking up product. Please try again.', 'error')
    } finally {
    }
  }

  const handleImageScan = async (imageFile) => {
    
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
        const productResponse = await fetch(`/api/inventory?item_type=product&include_variants=1`)
        const productData = await productResponse.json()
        
        if (productData.data) {
          const product = productData.data.find(p => p.product_id === match.product_id)
          if (product) {
            addToCart(product) // Will show variant modal if product has variants
            showToast(`Added ${product.product_name} to cart (${(match.confidence * 100).toFixed(0)}% confidence)`, 'success')
            setShowBarcodeScanner(false)
            return
          }
        }
      }
      
      showToast(data.message || 'Product not identified. Please try again or search manually.', 'error')
      
    } catch (err) {
      console.error('Image scan error:', err)
      showToast('Error identifying product. Please try again.', 'error')
    } finally {
    }
  }

  const updateQuantity = (productId, newQuantity, variantId = null, notes = null) => {
    if (newQuantity <= 0) {
      removeFromCart(productId, variantId, notes)
      return
    }
    setCart(cart.map(item =>
      item.product_id === productId &&
      (item.variant_id || null) === (variantId ?? null) &&
      (item.notes || '') === (notes ?? '')
        ? { ...item, quantity: newQuantity }
        : item
    ))
  }

  const removeFromCart = (productId, variantId = null, notes = null) => {
    setCart(cart.filter(item => !(
      item.product_id === productId &&
      (item.variant_id || null) === (variantId ?? null) &&
      (item.notes || '') === (notes ?? '')
    )))
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      // Exchange credit has negative price, so it reduces the total
      return sum + (parseFloat(item.unit_price) * item.quantity)
    }, 0)
  }

  const calculateTax = () => {
    // Calculate tax only on non-credit items
    const taxableSubtotal = cart
      .filter(item => !item.is_exchange_credit)
      .reduce((sum, item) => sum + (parseFloat(item.unit_price) * item.quantity), 0)
    return taxableSubtotal * taxRate
  }

  const calculateTotal = () => {
    // Exchange credit (negative price) is already included in subtotal; order discount reduces total
    const beforeDiscount = calculateSubtotal() + calculateTax()
    return Math.max(0, beforeDiscount - (orderDiscount || 0))
  }

  // Transaction fee for display (depends on payment method and pos_settings)
  const calculateTransactionFee = () => {
    const preFee = calculateTotal()
    const { rates, mode, charge_cash } = transactionFeeSettings
    if (!paymentMethodForFee || mode === 'included' || mode === 'none') return 0
    const method = paymentMethodForFee === 'credit_card' ? 'credit_card' : paymentMethodForFee === 'cash' ? 'cash' : 'credit_card'
    if (method === 'cash' && !charge_cash) return 0
    const rate = rates[method] != null ? Number(rates[method]) : 0
    return Math.round(preFee * rate * 100) / 100
  }

  const getTotalWithFee = () => calculateTotal() + calculateTransactionFee()
  
  // Get exchange credit amount if present
  const getExchangeCredit = () => {
    const creditItem = cart.find(item => item.is_exchange_credit)
    return creditItem ? Math.abs(parseFloat(creditItem.unit_price) * creditItem.quantity) : 0
  }

  // Total before applying exchange credit (for "remaining" calculation)
  const getTotalBeforeExchangeCredit = () => {
    const subtotalNoCredit = cart
      .filter(item => !item.is_exchange_credit)
      .reduce((sum, item) => sum + (parseFloat(item.unit_price) || 0) * (item.quantity || 0), 0)
    const taxNoCredit = subtotalNoCredit * taxRate
    const beforeFee = Math.max(0, subtotalNoCredit + taxNoCredit - (orderDiscount || 0))
    const fee = (() => {
      const { rates, mode, charge_cash } = transactionFeeSettings
      if (!paymentMethodForFee || mode === 'included' || mode === 'none') return 0
      const method = paymentMethodForFee === 'credit_card' ? 'credit_card' : paymentMethodForFee === 'cash' ? 'cash' : 'credit_card'
      if (method === 'cash' && !charge_cash) return 0
      const rate = rates[method] != null ? Number(rates[method]) : 0
      return Math.round(beforeFee * rate * 100) / 100
    })()
    return beforeFee + fee + (selectedTip || 0)
  }

  // When credit exceeds order total, amount that rolls over (for display below Total)
  const getExchangeCreditRemaining = () => {
    const credit = getExchangeCredit()
    if (credit <= 0) return 0
    const totalBeforeCredit = getTotalBeforeExchangeCredit()
    const amountUsed = Math.min(credit, totalBeforeCredit)
    return Math.round((credit - amountUsed) * 100) / 100
  }

  const calculateTotalWithTip = () => {
    return getTotalWithFee() + selectedTip
  }

  const calculateChange = () => {
    const paid = parseFloat(amountPaid) || 0
    const totalWithTip = calculateTotalWithTip()
    return paid - totalWithTip
  }

  const applyPresetDiscount = (preset) => {
    const beforeDiscount = calculateSubtotal() + calculateTax()
    const amount = Math.min((beforeDiscount * preset.percent) / 100, Math.max(0, beforeDiscount))
    setOrderDiscount(Math.round(amount * 100) / 100)
    setOrderDiscountType(preset.id)
    setShowDiscountModal(false)
    setDiscountInput('')
    showToast(`${preset.label} (${preset.percent}%): $${amount.toFixed(2)}`, 'success')
  }

  const applyDiscountFromModal = () => {
    const raw = (discountInput || '').trim()
    if (!raw) {
      setOrderDiscount(0)
      setOrderDiscountType('')
      setShowDiscountModal(false)
      setDiscountInput('')
      showToast('Discount cleared', 'success')
      return
    }
    const beforeDiscount = calculateSubtotal() + calculateTax()
    const isPercent = raw.endsWith('%')
    const value = parseFloat(isPercent ? raw.slice(0, -1).trim() : raw)
    if (Number.isNaN(value) || value < 0) {
      showToast('Enter a valid amount or percentage', 'error')
      return
    }
    let amount = isPercent ? (beforeDiscount * value) / 100 : value
    const maxDiscount = Math.max(0, beforeDiscount)
    amount = Math.min(Math.max(0, amount), maxDiscount)
    setOrderDiscount(Math.round(amount * 100) / 100)
    setOrderDiscountType('other')
    setShowDiscountModal(false)
    setDiscountInput('')
    showToast(amount > 0 ? `Discount applied: $${amount.toFixed(2)}` : 'Discount cleared', 'success')
  }

  const handleDismissChange = () => {
    setShowChangeScreen(false)
    // Only show customer display if payment was completed and user clicked the button
    if (paymentCompleted) {
      setShowCustomerDisplay(true)
      setShowSummary(false) // Don't show summary, go straight to receipt screen
    } else {
      // If payment wasn't completed, reset everything
      setCart([])
      setOrderDiscount(0)
      setOrderDiscountType('')
      setSearchTerm('')
      setShowPaymentForm(false)
      setAmountPaid('')
      setChangeAmount(0)
      setSelectedTip(0)
      setShowCustomerDisplay(false)
    }
  }
  
  const handleShowReceiptOptions = () => {
    // User explicitly wants to see receipt options
    // This should work regardless of paymentCompleted state
    // since the button is shown after payment is processed
    // Ensure all payment-related states are cleared and paymentCompleted is true
    setShowChangeScreen(false)
    setShowPaymentForm(false)
    setShowSummary(false)
    // Ensure paymentCompleted is true so CustomerDisplayPopup shows receipt screen
    if (!paymentCompleted) {
      setPaymentCompleted(true)
    }
    setShowCustomerDisplay(true)
  }

  const handleTipSelect = (tip) => {
    const amt = typeof tip === 'number' ? tip : parseFloat(tip) || 0
    console.log('[TIP DEBUG] handleTipSelect called:', { raw: tip, parsed: amt })
    setSelectedTip(amt)
    selectedTipRef.current = amt
  }
  useEffect(() => {
    selectedTipRef.current = selectedTip
  }, [selectedTip])

  const generateReceipt = async (orderId, orderNumber) => {
    try {
      const response = await fetch(`/api/receipt/${orderId}`)
      
      // Check if response is OK and is a PDF
      if (response.ok) {
        const contentType = response.headers.get('content-type') || ''
        
        // Verify it's actually a PDF
        if (contentType.includes('application/pdf')) {
          const blob = await response.blob()
          
          // Double-check blob type or size
          if (blob.type === 'application/pdf' || blob.size > 0) {
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `receipt_${orderNumber}.pdf`
            a.style.display = 'none' // Hide the link
            document.body.appendChild(a)
            
            // Use setTimeout to ensure the link is fully added to DOM
            setTimeout(() => {
              a.click()
              // Clean up after a delay to ensure download starts
              setTimeout(() => {
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
              }, 100)
            }, 10)
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

  const generateReceiptFromTransaction = async (transactionId, orderNumber) => {
    try {
      const response = await fetch(`/api/receipt/transaction/${transactionId}`)
      
      // Check if response is OK and is a PDF
      if (response.ok) {
        const contentType = response.headers.get('content-type') || ''
        
        // Verify it's actually a PDF
        if (contentType.includes('application/pdf')) {
          const blob = await response.blob()
          
          // Double-check blob type or size
          if (blob.type === 'application/pdf' || blob.size > 0) {
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const filename = orderNumber 
              ? `receipt_${orderNumber}.pdf`
              : `receipt_transaction_${transactionId}.pdf`
            a.download = filename
            a.style.display = 'none' // Hide the link
            document.body.appendChild(a)
            
            // Use setTimeout to ensure the link is fully added to DOM
            setTimeout(() => {
              a.click()
              // Clean up after a delay to ensure download starts
              setTimeout(() => {
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
              }, 100)
            }, 10)
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

  const handleReceiptSelect = () => {
      // Clear cart if payment was completed (called when customer chose receipt on display or when cashier clicks Done)
      if (paymentCompleted) {
        setCart([])
        setOrderDiscount(0)
        setOrderDiscountType('')
        setSearchTerm('')
        setAmountPaid('')
        setPaymentCompleted(false)
        setSelectedTip(0) // Reset tip
        setOrderType(null) // Reset order type
        setCustomerInfo({ name: '', email: '', phone: '', address: '' }) // Reset customer info
        setCustomerInfoConfirmed(false)
        setShowCustomerDisplay(false)
        setShowPaymentForm(false)
        setShowChangeScreen(false) // No "Show Receipt Options" when they already chose on customer display
      }
  }

  const checkCustomerInfoRequirements = () => {
    // If a customer was selected from the database, their record is sufficient—don't block payment
    if (selectedCustomer?.customer_id) return true
    // Check rewards settings requirements for walk-in / new customer (customerInfo only)
    if (rewardsSettings.enabled) {
      if (rewardsSettings.require_both) {
        return customerInfo.name && customerInfo.email && customerInfo.phone
      } else if (rewardsSettings.require_email) {
        return customerInfo.name && customerInfo.email
      } else if (rewardsSettings.require_phone) {
        return customerInfo.name && customerInfo.phone
      }
    }
    // If rewards not enabled or no requirements, return true
    return true
  }

  const searchCustomers = async (term) => {
    if (!term || term.length < 1) {
      setCustomerSearchResults([])
      return
    }
    try {
      const response = await fetch(`/api/customers/search?q=${encodeURIComponent(term)}`)
      const data = await response.json()
      if (data.success && data.data) {
        setCustomerSearchResults(data.data.slice(0, 10))
      } else {
        setCustomerSearchResults([])
      }
    } catch (error) {
      console.error('Error searching customers:', error)
      setCustomerSearchResults([])
    }
  }

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer)
    setCustomerInfo({
      name: customer.customer_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || ''
    })
    setCustomerSearchTerm('')
    setCustomerSearchResults([])
    setShowRewardsModal(true)
    setPointsToUse('')
    setCustomerRewardsDetail(null)
  }

  useEffect(() => {
    if (showRewardsModal && selectedCustomer?.customer_id) {
      setRewardsDetailLoading(true)
      fetch(`/api/customers/${selectedCustomer.customer_id}/rewards`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setCustomerRewardsDetail(data.data)
          }
          setRewardsDetailLoading(false)
        })
        .catch(() => setRewardsDetailLoading(false))
    }
  }, [showRewardsModal, selectedCustomer?.customer_id])

  const addPointsRedemptionToCart = (points) => {
    const p = parseInt(points, 10)
    if (!selectedCustomer || isNaN(p) || p <= 0) return
    const available = (customerRewardsDetail?.loyalty_points ?? selectedCustomer.loyalty_points ?? 0) || 0
    if (p > available) {
      showToast(`Customer has ${available} points`, 'error')
      return
    }
    const value = rewardsSettings.points_redemption_value || 0.01
    const discountAmount = p * value
    const existing = cart.find(item => item.is_points_redemption)
    if (existing) {
      setCart(prev => prev.map(item =>
        item.is_points_redemption
          ? { ...item, points_used: p, quantity: 1, unit_price: -discountAmount }
          : item
      ))
    } else {
      setCart(prev => [...prev, {
        product_id: 'POINTS_REDEMPTION',
        product_name: 'Points redemption',
        sku: 'POINTS',
        unit_price: -discountAmount,
        quantity: 1,
        discount: 0,
        tax_rate: taxRate,
        available_quantity: 999,
        is_points_redemption: true,
        points_used: p
      }])
    }
    showToast(`${p} points ($${discountAmount.toFixed(2)}) added to cart`, 'success')
    setShowRewardsModal(false)
    setPointsToUse('')
  }

  const removePointsRedemptionFromCart = () => {
    setCart(prev => prev.filter(item => !item.is_points_redemption))
    showToast('Points redemption removed from cart', 'success')
  }

  const handleCreateCustomer = () => {
    setShowCreateCustomer(true)
    setShowCustomerInfoModal(true)
    // Clear any existing customer selection and order type
    // This ensures the modal always shows as customer creation form
    setSelectedCustomer(null)
    setOrderType(null) // Clear order type so modal shows as customer creation
    setCustomerInfo({ name: '', email: '', phone: '', address: '' })
  }

  const handleClearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerInfo({ name: '', email: '', phone: '', address: '' })
    setCustomerInfoConfirmed(false)
    setPayAtPickupOrDelivery(false)
    setCustomerSearchTerm('')
    setCustomerSearchResults([])
    setShowRewardsModal(false)
    setShowEditCustomerModal(false)
    setCart(prev => prev.filter(item => !item.is_points_redemption))
  }

  const handleOpenEditCustomer = () => {
    if (!selectedCustomer) return
    setEditCustomerForm({
      customer_name: selectedCustomer.customer_name || customerInfo.name || '',
      email: selectedCustomer.email || customerInfo.email || '',
      phone: (selectedCustomer.phone || customerInfo.phone || '').replace(/\D/g, '').slice(0, 10),
      address: selectedCustomer.address || customerInfo.address || ''
    })
    setShowEditCustomerModal(true)
  }

  const handleSaveEditCustomer = async () => {
    if (!selectedCustomer?.customer_id) return
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/customers/${selectedCustomer.customer_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({
          customer_name: editCustomerForm.customer_name || null,
          email: editCustomerForm.email || null,
          phone: editCustomerForm.phone || null,
          address: editCustomerForm.address || null
        })
      })
      const data = await res.json()
      if (data.success && data.data) {
        setSelectedCustomer(prev => ({ ...prev, ...data.data, customer_name: data.data.customer_name ?? editCustomerForm.customer_name, email: data.data.email ?? editCustomerForm.email, phone: data.data.phone ?? editCustomerForm.phone, address: data.data.address ?? editCustomerForm.address }))
        setCustomerInfo(prev => ({
          ...prev,
          name: editCustomerForm.customer_name || prev.name,
          email: editCustomerForm.email ?? prev.email,
          phone: editCustomerForm.phone ?? prev.phone,
          address: editCustomerForm.address ?? prev.address
        }))
        setShowEditCustomerModal(false)
        showToast('Customer updated', 'success')
      } else {
        showToast(data.message || 'Failed to update customer', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Failed to update customer', 'error')
    }
  }

  const handleCalculatorInput = (value) => {
    if (value === 'clear') {
      setAmountPaid('')
    } else if (value === 'backspace') {
      setAmountPaid(prev => prev.slice(0, -1))
    } else if (value === 'exact') {
      setAmountPaid(calculateTotalWithTip().toFixed(2))
    } else {
      setAmountPaid(prev => prev + value)
    }
  }

  const placeOrderPayLater = async () => {
    if (!canProcessSale) {
      showToast('You do not have permission to process sales', 'error')
      return
    }
    if (cart.length === 0) {
      showToast('Cart is empty', 'error')
      return
    }
    if (!customerInfo.name || !customerInfo.phone) {
      showToast('Name and phone required for pickup/delivery', 'error')
      return
    }
    if (orderType === 'delivery' && !customerInfo.address) {
      showToast('Address required for delivery', 'error')
      return
    }
    setProcessing(true)
    try {
      const items = cart
        .filter(item => !item.is_exchange_credit && item.product_id !== 'EXCHANGE_CREDIT' && !item.is_points_redemption && item.product_id !== 'POINTS_REDEMPTION')
        .map(item => ({
          product_id: item.product_id,
          quantity: parseInt(item.quantity) || 1,
          unit_price: parseFloat(item.unit_price) || 0,
          discount: parseFloat(item.discount) || 0,
          tax_rate: parseFloat(item.tax_rate) || taxRate || 0.08,
          ...(item.variant_id ? { variant_id: item.variant_id } : {}),
          ...(item.notes ? { notes: item.notes } : {})
        }))
      const empId = employeeId ?? (localStorage.getItem('employeeId') ? parseInt(localStorage.getItem('employeeId'), 10) : null)
      const customerId = selectedCustomer?.customer_id || null
      const customerInfoToSave = customerInfo.name ? customerInfo : null
      const res = await fetch('/api/create_order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('sessionToken') && { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` })
        },
        body: JSON.stringify({
          employee_id: empId,
          items,
          payment_method: 'cash',
          tax_rate: taxRate,
          tip: selectedTip || 0,
          discount: orderDiscount || 0,
          discount_type: orderDiscountType || null,
          order_type: orderType,
          customer_info: customerInfoToSave,
          customer_id: customerId,
          points_used: 0,
          payment_status: 'pending',
          order_status: 'placed'
        })
      })
      const result = await res.json()
      if (result.success) {
        const total = calculateTotal()
        showToast(`Order ${result.order_number} placed. Customer will pay when ${orderType === 'pickup' ? 'they pick up' : 'delivered'}.`, 'success')
        setOrderPlacedPayLater({
          orderId: result.order_id,
          orderNumber: result.order_number,
          total
        })
        setCart([])
        setOrderDiscount(0)
        setOrderDiscountType('')
        setPayAtPickupOrDelivery(false)
        setShowSummary(false)
        setShowPaymentForm(false)
      } else {
        showToast(result.message || 'Failed to place order', 'error')
      }
    } catch (err) {
      console.error(err)
      showToast('Failed to place order', 'error')
    } finally {
      setProcessing(false)
    }
  }

  const processOrder = async () => {
    // Check permission
    if (!canProcessSale) {
      showToast('You do not have permission to process sales', 'error')
      return
    }
    
    if (cart.length === 0) {
      showToast('Cart is empty', 'error')
      return
    }

    const totalWithTip = calculateTotalWithTip()
    // Only require cash amount when total is meaningfully positive (skip when exchange/credit covers it)
    if (paymentMethod === 'cash' && totalWithTip >= 0.01) {
      const paid = parseFloat(amountPaid) || 0
      if (paid < totalWithTip) {
        showToast('Amount paid is insufficient', 'error')
        return
      }
    }

    setProcessing(true)

    try {
      // Paying for a scanned pay-later order: UPDATE the existing order (mark paid/complete), do NOT create a new order
      if (payingForOrderId) {
        const token = localStorage.getItem('sessionToken')
        const res = await fetch(`/api/orders/${payingForOrderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
          body: JSON.stringify({
            order_status: 'completed',
            payment_status: 'completed',
            payment_method: paymentMethod === 'credit_card' ? 'credit_card' : paymentMethod === 'debit_card' ? 'debit_card' : 'cash'
          })
        })
        const result = await res.json()
        if (result.success) {
          showToast(`Order ${payingForOrderNumber || payingForOrderId} paid successfully`, 'success')
          setPaymentCompleted(true)
          setCurrentOrderId(payingForOrderId)
          setCurrentOrderNumber(payingForOrderNumber || String(payingForOrderId))
          setCart([])
          setOrderDiscount(0)
          setOrderDiscountType('')
          setPayingForOrderId(null)
          setPayingForOrderNumber(null)
          if (paymentMethod === 'cash') {
            const change = (parseFloat(amountPaid) || 0) - calculateTotalWithTip()
            setChangeAmount(change > 0 ? change : 0)
            setShowChangeScreen(true)
          }
          setShowPaymentForm(false)
          setShowSummary(false)
        } else {
          showToast(result.message || 'Failed to complete payment', 'error')
        }
        setProcessing(false)
        return // do not fall through – we updated the existing order; never create_order or transaction/start
      }

      // New sale: create order / start transaction (only when NOT paying for an existing scanned order)
      // Get exchange credit info if present
      const exchangeCreditItem = cart.find(item => item.is_exchange_credit)
      const exchangeCreditAmount = exchangeCreditItem ? Math.abs(parseFloat(exchangeCreditItem.unit_price) * exchangeCreditItem.quantity) : 0
      const exchangeCreditId = exchangeCreditItem?.exchange_credit_id
      const exchangeReturnId = exchangeCreditItem?.exchange_return_id
      
      // Points redemption: get points used from cart (single line)
      const pointsRedemptionItem = cart.find(item => item.is_points_redemption)
      const pointsUsed = pointsRedemptionItem ? (pointsRedemptionItem.points_used || 0) : 0

      // Prepare items with all required fields for order creation (exclude exchange credit and points redemption)
      const items = cart
        .filter(item => !item.is_exchange_credit && item.product_id !== 'EXCHANGE_CREDIT' && !item.is_points_redemption && item.product_id !== 'POINTS_REDEMPTION')
        .map(item => ({
          product_id: item.product_id,
          quantity: parseInt(item.quantity) || 1,
          unit_price: parseFloat(item.unit_price) || 0,
          discount: parseFloat(item.discount) || 0,
          tax_rate: parseFloat(item.tax_rate) || taxRate || 0.08,
          ...(item.variant_id ? { variant_id: item.variant_id } : {}),
          ...(item.notes ? { notes: item.notes } : {})
        }))
      
      // Log items being sent for debugging
      console.log('Items being sent to create_order:', items)

      // Prepare customer info and order type for order creation
      let customerId = selectedCustomer?.customer_id || null
      const orderTypeToSave = orderType || null
      // Include customer info if customer is selected/entered (optional for rewards)
      let customerInfoToSave = null
      if (selectedCustomer || customerInfo.name) {
        customerInfoToSave = customerInfo.name ? customerInfo : null
      }

      // Start transaction for customer display
      let transactionId = null
      let orderNumber = null
      let orderId = null
        try {
          const sessionToken = localStorage.getItem('sessionToken')
          const transactionResponse = await fetch('/api/transaction/start', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
              items: items,
              customer_id: customerId || undefined,
              discount: (orderDiscount || 0) + (exchangeCreditAmount || 0),
              discount_type: orderDiscountType || undefined
            })
          })
          
          const transactionResult = await transactionResponse.json()
          if (transactionResult.success) {
            transactionId = transactionResult.data.transaction_id
            orderId = transactionResult.data.order_id
            orderNumber = transactionResult.data.order_number
            setCurrentTransactionId(transactionId)
            if (orderId) {
              setCurrentOrderId(orderId)
            }
            if (orderNumber) {
              setCurrentOrderNumber(orderNumber)
            }
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
          const totalWithTipVal = calculateTotalWithTip()
          const tipAmount = selectedTipRef.current || selectedTip || 0
          const paid = totalWithTipVal <= 0 ? 0 : (paymentMethod === 'cash' ? parseFloat(amountPaid) || 0 : (calculateTotal() + tipAmount))
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
              tip: Math.max(0, Number(tipAmount) || 0)
            })
          })
          
          result = await response.json()
          
          if (result.success && result.data.success) {
            showToast('Order processed successfully!', 'success')
            
            // Try to get order_id from payment_transactions if not already available
            let foundOrderId = currentOrderId
            let foundOrderNumber = currentOrderNumber
            if (transactionId && !currentOrderId) {
              try {
                const orderLookupResponse = await fetch(`/api/payment_transactions`)
                const orderLookupResult = await orderLookupResponse.json()
                if (orderLookupResult.data && orderLookupResult.data.length > 0) {
                  // Find payment_transaction with matching transaction_id
                  const paymentTx = orderLookupResult.data.find(pt => 
                    pt.transaction_id === transactionId || pt.transaction_id === parseInt(transactionId)
                  )
                  if (paymentTx && paymentTx.order_id) {
                    foundOrderId = paymentTx.order_id
                    foundOrderNumber = paymentTx.order_number
                    setCurrentOrderId(paymentTx.order_id)
                    if (paymentTx.order_number) {
                      setCurrentOrderNumber(paymentTx.order_number)
                    }
                  }
                }
              } catch (err) {
                console.error('Error looking up order_id:', err)
              }
            }
            
            // Apply exchange credit if present (as discount on order)
            if (exchangeCreditAmount > 0 && foundOrderId) {
              try {
                // Apply exchange credit as discount
                const creditResponse = await fetch('/api/apply_exchange_credit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    order_id: foundOrderId,
                    exchange_credit_id: exchangeCreditId,
                    credit_amount: exchangeCreditAmount,
                    discount_already_included: true
                  })
                })
                const creditResult = await creditResponse.json()
                if (creditResult.success) {
                  console.log('Exchange credit applied:', creditResult)
                }
              } catch (err) {
                console.error('Error applying exchange credit:', err)
              }
            }
            
            // Don't automatically generate receipt - let user choose in customer display popup
            setPaymentCompleted(true)
            
            const totalWithTipVal = calculateTotalWithTip()
            if (totalWithTipVal <= 0) {
              setShowPaymentForm(false)
            } else if (paymentMethod === 'cash') {
              const change = result.data.data?.change || calculateChange()
              setChangeAmount(change)
              setShowChangeScreen(true)
              setShowPaymentForm(false)
            } else {
              setShowPaymentForm(false)
            }
            
            // If exchange credit was used, print exchange receipt after order receipt
            if (exchangeCreditId && foundOrderId) {
              // Store exchange credit info for receipt printing (order_id used for exchange completion receipt)
              sessionStorage.setItem('exchangeCreditUsed', JSON.stringify({
                credit_id: exchangeCreditId,
                return_id: exchangeReturnId,
                amount_used: exchangeCreditAmount,
                order_id: foundOrderId
              }))
            }
            
            // Clear active transaction
            sessionStorage.removeItem('activeTransaction')
          } else {
            showToast(result.data?.error || 'Failed to process payment', 'error')
          }
        } else {
          // Fall back to old system (no matching payment method - use create_order)
          // Pass transaction_id so backend updates existing order instead of creating duplicate
          const tipForCreate = selectedTipRef.current || selectedTip || 0
          response = await fetch('/api/create_order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(localStorage.getItem('sessionToken') && { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` })
            },
            body: JSON.stringify({
              transaction_id: transactionId,
              employee_id: employeeId,
              items: items,
              payment_method: paymentMethod,
              tax_rate: taxRate,
              tip: tipForCreate,
              discount: (orderDiscount || 0) + (exchangeCreditAmount || 0),
              discount_type: orderDiscountType || null,
              order_type: orderTypeToSave,
              customer_info: customerInfoToSave,
              customer_id: customerId,
              points_used: pointsUsed
            })
          })
          result = await response.json()
          
          if (result.success) {
            // Apply exchange credit if present
            if (exchangeCreditAmount > 0 && result.order_id && exchangeCreditId) {
              try {
                await fetch('/api/apply_exchange_credit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    order_id: result.order_id,
                    exchange_credit_id: exchangeCreditId,
                    credit_amount: exchangeCreditAmount,
                    discount_already_included: true
                  })
                })
              } catch (err) {
                console.error('Error applying exchange credit:', err)
              }
            }
            
            showToast('Order processed successfully!', 'success')
            setPaymentCompleted(true)
            
            // Store order information for receipt generation
            if (result.order_id) {
              setCurrentOrderId(result.order_id)
              setCurrentOrderNumber(result.order_number)
              
              // If exchange credit was used, store for receipt printing
              if (exchangeCreditId && result.order_id) {
                sessionStorage.setItem('exchangeCreditUsed', JSON.stringify({
                  credit_id: exchangeCreditId,
                  return_id: exchangeReturnId,
                  amount_used: exchangeCreditAmount,
                  order_id: result.order_id
                }))
              }
            }
            
            // Payment completed - wait for user to click something
            // For cash payments, show change screen and wait for user to click
            if (paymentMethod === 'cash') {
              const change = calculateChange()
              setChangeAmount(change)
              setShowChangeScreen(true)
              setShowPaymentForm(false)
              // Don't automatically show customer display - wait for user to click
            } else {
              // For non-cash payments, don't automatically show anything - wait for user action
              setShowPaymentForm(false)
            }
          } else {
            showToast(result.message || 'Failed to process order', 'error')
          }
        }
      } else {
        // Transaction/start failed or unavailable – fall back to create_order
        const tipForCreate = selectedTipRef.current || selectedTip || 0
        response = await fetch('/api/create_order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('sessionToken') && { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` })
          },
          body: JSON.stringify({
            employee_id: employeeId,
            items: items,
            payment_method: paymentMethod,
            tax_rate: taxRate,
            tip: tipForCreate,
            discount: (orderDiscount || 0) + (exchangeCreditAmount || 0),
            discount_type: orderDiscountType || null,
            order_type: orderTypeToSave,
            customer_info: customerInfoToSave,
            customer_id: customerId,
            points_used: pointsUsed
          })
        })
        result = await response.json()
        if (result.success) {
          if (exchangeCreditAmount > 0 && result.order_id && exchangeCreditId) {
            try {
              await fetch('/api/apply_exchange_credit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  order_id: result.order_id,
                  exchange_credit_id: exchangeCreditId,
                  credit_amount: exchangeCreditAmount,
                  discount_already_included: true
                })
              })
            } catch (err) {
              console.error('Error applying exchange credit:', err)
            }
          }
          showToast('Order processed successfully!', 'success')
          setPaymentCompleted(true)
          if (result.order_id) {
            setCurrentOrderId(result.order_id)
            setCurrentOrderNumber(result.order_number)
            if (exchangeCreditId) {
              sessionStorage.setItem('exchangeCreditUsed', JSON.stringify({
                credit_id: exchangeCreditId,
                return_id: exchangeReturnId,
                amount_used: exchangeCreditAmount,
                order_id: result.order_id
              }))
            }
          }
          if (paymentMethod === 'cash') {
            const change = calculateChange()
            setChangeAmount(change)
            setShowChangeScreen(true)
            setShowPaymentForm(false)
          } else {
            setShowPaymentForm(false)
          }
        } else {
          showToast(result.message || 'Failed to process order', 'error')
        }
      }
    } catch (err) {
      showToast('Error processing order. Please try again.', 'error')
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
      {/* Size / Variant selection modal */}
      {showVariantModal && productForVariant && productForVariant.variants && productForVariant.variants.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
          backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }} onClick={() => { setShowVariantModal(false); setProductForVariant(null) }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '360px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Choose size</div>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: '#666' }}>{productForVariant.product_name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {productForVariant.variants.map(v => (
                <button
                  key={v.variant_id}
                  type="button"
                  onClick={() => {
                    const noteChips = searchFilterChips.filter(c => c.variant_name == null)
                    const notesStr = noteChips.length ? noteChips.map(c => c.label).join(', ') : null
                    addToCart(productForVariant, v, notesStr)
                  }}
                  style={{
                    padding: '12px 16px',
                    border: `2px solid rgba(${themeColorRgb}, 0.5)`,
                    borderRadius: '8px',
                    backgroundColor: `rgba(${themeColorRgb}, 0.08)`,
                    fontSize: '15px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{v.variant_name}</span>
                  <span>${parseFloat(v.price).toFixed(2)}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setShowVariantModal(false); setProductForVariant(null) }}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#f5f5f5',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
                  <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                    <button
                      onClick={() => {
                        setShowPaymentForm(false)
                        setShowCustomerDisplay(false)
                        setAmountPaid('')
                        setShowSummary(false)
                      }}
                      style={{
                        flex: 1,
                        padding: '12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        color: '#333',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={processOrder}
                      disabled={processing || cart.length === 0 || (paymentMethod === 'cash' && calculateTotalWithTip() > 0 && (!amountPaid || parseFloat(amountPaid) < calculateTotalWithTip()))}
                      style={{
                        flex: 2,
                        padding: '12px',
                        backgroundColor: processing || cart.length === 0 || (paymentMethod === 'cash' && calculateTotalWithTip() > 0 && (!amountPaid || parseFloat(amountPaid) < calculateTotalWithTip())) ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.7)`,
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        color: '#fff',
                        border: processing || cart.length === 0 || (paymentMethod === 'cash' && calculateTotalWithTip() > 0 && (!amountPaid || parseFloat(amountPaid) < calculateTotalWithTip())) ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 600,
                        cursor: processing || cart.length === 0 || (paymentMethod === 'cash' && calculateTotalWithTip() > 0 && (!amountPaid || parseFloat(amountPaid) < calculateTotalWithTip())) ? 'not-allowed' : 'pointer',
                        boxShadow: processing || cart.length === 0 || (paymentMethod === 'cash' && calculateTotalWithTip() > 0 && (!amountPaid || parseFloat(amountPaid) < calculateTotalWithTip())) ? `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)` : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                        transition: 'all 0.3s ease',
                        opacity: 1
                      }}
                    >
                      {processing ? 'Processing...' : 'Process'}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Close Button - Show when on summary screen only, not during payment flow or when customer display is active */}
              {showSummary && !showPaymentForm && !showCustomerDisplay && (
                <button
                  onClick={() => {
                    setShowCustomerDisplay(false)
                    setShowSummary(false)
                    setPayingForOrderId(null)
                    setPayingForOrderNumber(null)
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
                discount={orderDiscount || 0}
                transactionFee={calculateTransactionFee()}
                total={getTotalWithFee()}
                tip={selectedTip}
                exchangeCreditRemaining={getExchangeCreditRemaining()}
                paymentMethod={paymentCompleted ? paymentMethod : (showPaymentForm && paymentMethod === 'credit_card' ? paymentMethod : null)}
                amountPaid={amountPaid}
                onClose={() => {
                  setShowCustomerDisplay(false)
                  setShowPaymentForm(false)
                  setShowSummary(false)
                  setAmountPaid('')
                  setPaymentMethodForFee(null)
                  setPayingForOrderId(null)
                  setPayingForOrderNumber(null)
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
                  if (method.method_type === 'cash') {
                    setPaymentMethodForFee('cash')
                    setPaymentMethod('cash')
                    setShowPaymentForm(true)
                    setShowCustomerDisplay(false)
                  } else if (method.method_type === 'card') {
                    setPaymentMethodForFee('credit_card')
                    setPaymentMethod('credit_card')
                    setShowPaymentForm(true)
                  }
                }}
                onZeroTotalComplete={() => {
                  setPaymentMethod('cash')
                  setAmountPaid('0')
                  processOrder()
                }}
                showSummary={showSummary && !showPaymentForm}
                employeeId={employeeId}
                paymentCompleted={paymentCompleted}
                transactionId={currentTransactionId}
                orderId={payingForOrderId || currentOrderId}
                orderNumber={payingForOrderNumber || currentOrderNumber}
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
                  <th style={{ textAlign: 'left', padding: '12.75px 10px 10px 10px', fontSize: '14px', color: '#666' }}>Item</th>
                  <th style={{ textAlign: 'right', padding: '12.75px 10px 10px 10px', fontSize: '14px', color: '#666' }}>Price</th>
                  <th style={{ textAlign: 'center', padding: '12.75px 10px 10px 10px', fontSize: '14px', color: '#666' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '12.75px 10px 10px 10px', fontSize: '14px', color: '#666' }}>Total</th>
                  <th style={{ padding: '12.75px 10px 10px 10px', width: '40px' }}></th>
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
                      ${(parseFloat(item.unit_price) || 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      {item.is_points_redemption ? (
                        <span style={{ fontWeight: 500 }}>{item.points_used || 0} pts</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1, item.variant_id, item.notes)}
                            disabled={showPaymentForm}
                            style={{
                              width: '28px',
                              height: '28px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              borderRadius: '4px',
                              cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                              fontSize: '18px',
                              lineHeight: '1',
                              color: themeColor,
                              opacity: showPaymentForm ? 0.3 : 1
                            }}
                          >-</button>
                          <span style={{ minWidth: '30px', textAlign: 'center', fontWeight: 500 }}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1, item.variant_id, item.notes)}
                            disabled={showPaymentForm || item.quantity >= item.available_quantity}
                            style={{
                              width: '28px',
                              height: '28px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              borderRadius: '4px',
                              cursor: (showPaymentForm || item.quantity >= item.available_quantity) ? 'not-allowed' : 'pointer',
                              fontSize: '18px',
                              lineHeight: '1',
                              color: themeColor,
                              opacity: (showPaymentForm || item.quantity >= item.available_quantity) ? 0.3 : 1
                            }}
                          >+</button>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px', fontFamily: '"Product Sans", sans-serif', fontWeight: 500 }}>
                      ${(parseFloat(item.unit_price) * item.quantity || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <button
                        onClick={() => removeFromCart(item.product_id, item.variant_id, item.notes)}
                        disabled={showPaymentForm}
                        style={{
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: themeColor,
                          cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                          fontSize: '18px',
                          padding: '0',
                          width: '24px',
                          height: '24px',
                          opacity: showPaymentForm ? 0.3 : 1
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
          {/* Pickup/Delivery Options */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  if (!showPaymentForm) {
                    if (orderType === 'pickup') {
                      setOrderType(null)
                      setPayAtPickupOrDelivery(false)
                      setCustomerInfo({ name: '', email: '', phone: '', address: '' })
                      setSelectedCustomer(null)
                      setCustomerInfoConfirmed(false)
                    } else {
                      setOrderType('pickup')
                      setCustomerInfoConfirmed(false)
                      if (selectedCustomer) {
                        setCustomerInfo(prev => ({
                          ...prev,
                          name: selectedCustomer.customer_name || prev.name,
                          phone: (selectedCustomer.phone || prev.phone || '').replace(/\D/g, '').slice(0, 10),
                          email: selectedCustomer.email || prev.email
                        }))
                      }
                    }
                  }
                }}
                disabled={showPaymentForm}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  border: orderType === 'pickup' ? '2px solid ' + themeColor : '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: orderType === 'pickup' ? 600 : 400,
                  backgroundColor: orderType === 'pickup' ? `rgba(${themeColorRgb}, 0.1)` : '#fff',
                  color: orderType === 'pickup' ? themeColor : '#666',
                  cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: showPaymentForm ? 0.3 : 1
                }}
              >
                Pickup
              </button>
              <button
                onClick={async () => {
                  if (!showPaymentForm) {
                    if (orderType === 'delivery') {
                      setOrderType(null)
                      setPayAtPickupOrDelivery(false)
                      setCustomerInfo({ name: '', email: '', phone: '', address: '' })
                      setSelectedCustomer(null)
                      setCustomerInfoConfirmed(false)
                    } else {
                      setOrderType('delivery')
                      setCustomerInfoConfirmed(false)
                      if (selectedCustomer) {
                        const sanitizePhone = (v) => (v || '').replace(/\D/g, '').slice(0, 10)
                        let info = {
                          name: selectedCustomer.customer_name || customerInfo.name,
                          phone: sanitizePhone(selectedCustomer.phone || customerInfo.phone),
                          email: selectedCustomer.email || customerInfo.email,
                          address: selectedCustomer.address ?? customerInfo.address ?? ''
                        }
                        if (selectedCustomer.customer_id) {
                          try {
                            const res = await fetch(`/api/customers/${selectedCustomer.customer_id}`)
                            const data = await res.json()
                            if (data.success && data.data) {
                              const c = data.data
                              info = {
                                name: c.customer_name ?? info.name,
                                phone: sanitizePhone(c.phone ?? info.phone),
                                email: c.email ?? info.email,
                                address: (c.address != null && c.address !== '') ? c.address : info.address
                              }
                              if (c.address != null && c.address !== '') {
                                setSelectedCustomer(prev => prev ? { ...prev, address: c.address } : null)
                              }
                            }
                          } catch (_) { /* keep existing info */ }
                        }
                        setCustomerInfo(info)
                      }
                    }
                  }
                }}
                disabled={showPaymentForm}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  border: orderType === 'delivery' ? '2px solid ' + themeColor : '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: orderType === 'delivery' ? 600 : 400,
                  backgroundColor: orderType === 'delivery' ? `rgba(${themeColorRgb}, 0.1)` : '#fff',
                  color: orderType === 'delivery' ? themeColor : '#666',
                  cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: showPaymentForm ? 0.3 : 1
                }}
              >
                Delivery
              </button>
            </div>
            {/* Combined delivery/pickup summary is shown in Customer section below when orderType && customerInfoConfirmed */}
          </div>

          {/* Inline Customer Info Form for Pickup/Delivery - hidden after check */}
          {orderType && !customerInfoConfirmed && (
            <>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  placeholder="Customer name"
                  disabled={showPaymentForm}
                  style={{
                    ...inputBaseStyle(isDarkMode, themeColorRgb),
                    opacity: showPaymentForm ? 0.3 : 1,
                    cursor: showPaymentForm ? 'not-allowed' : 'text'
                  }}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  autoFocus={!showPaymentForm}
                />
              </div>

              {/* Last field box: phone (pickup) or address (delivery) with Done button at end */}
              {orderType === 'pickup' ? (
                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="Phone number"
                    disabled={showPaymentForm}
                    style={{
                      ...inputBaseStyle(isDarkMode, themeColorRgb),
                      flex: 1,
                      opacity: showPaymentForm ? 0.3 : 1,
                      cursor: showPaymentForm ? 'not-allowed' : 'text'
                    }}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (showPaymentForm) return
                      const needsName = !customerInfo.name?.trim()
                      const needsPhone = !customerInfo.phone?.trim()
                      if (needsName || needsPhone) {
                        showToast('Please enter name and phone', 'error')
                        return
                      }
                      setCustomerInfoConfirmed(true)
                    }}
                    disabled={showPaymentForm}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      backgroundColor: `rgba(${themeColorRgb}, 0.85)`,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                      opacity: showPaymentForm ? 0.5 : 1,
                      boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.3)`
                    }}
                    title="Done – close form"
                  >
                    <Check size={16} />
                    Done
                  </button>
                </div>
              ) : (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      placeholder="Phone number"
                      disabled={showPaymentForm}
                      style={{
                        ...inputBaseStyle(isDarkMode, themeColorRgb),
                        opacity: showPaymentForm ? 0.3 : 1,
                        cursor: showPaymentForm ? 'not-allowed' : 'text'
                      }}
                      {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                    />
                  </div>
                  <div style={{
                    ...inputBaseStyle(isDarkMode, themeColorRgb),
                    padding: '10px 12px',
                    fontFamily: 'inherit'
                  }}>
                    <textarea
                      value={customerInfo.address}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                      placeholder="Delivery address"
                      rows={3}
                      disabled={showPaymentForm}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        resize: 'vertical',
                        outline: 'none',
                        opacity: showPaymentForm ? 0.3 : 1,
                        cursor: showPaymentForm ? 'not-allowed' : 'text'
                      }}
                      {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (showPaymentForm) return
                          const needsName = !customerInfo.name?.trim()
                          const needsPhone = !customerInfo.phone?.trim()
                          const needsAddress = !customerInfo.address?.trim()
                          if (needsName || needsPhone) {
                            showToast('Please enter name and phone', 'error')
                            return
                          }
                          if (needsAddress) {
                            showToast('Please enter delivery address', 'error')
                            return
                          }
                          setCustomerInfoConfirmed(true)
                        }}
                        disabled={showPaymentForm}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          backgroundColor: `rgba(${themeColorRgb}, 0.85)`,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                          opacity: showPaymentForm ? 0.5 : 1,
                          boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.3)`
                        }}
                        title="Done – close form"
                      >
                        <Check size={16} />
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Customer Lookup (Optional) – combined with delivery/pickup summary when confirmed */}
          <div style={{ marginBottom: '16px' }}>
            {orderType && customerInfoConfirmed ? (
              /* Combined: customer + delivery/pickup type + address + Pay now / Pay on delivery */
              <div style={{
                padding: '12px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#666'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: '#333' }}>
                      {customerInfo.name || selectedCustomer?.customer_name || 'Customer'}
                    </div>
                    <div style={{ marginBottom: orderType === 'delivery' && (customerInfo.address || selectedCustomer?.address) ? '6px' : 0 }}>
                      {(customerInfo.email || customerInfo.phone || selectedCustomer?.email || selectedCustomer?.phone)
                        ? [customerInfo.email || selectedCustomer?.email, customerInfo.phone || selectedCustomer?.phone].filter(Boolean).join(' • ')
                        : ''}
                      {selectedCustomer?.loyalty_points !== undefined && selectedCustomer?.loyalty_points > 0 && (
                        <span> • {selectedCustomer.loyalty_points} points</span>
                      )}
                    </div>
                    {orderType === 'delivery' && (customerInfo.address || selectedCustomer?.address) && (
                      <div style={{ marginTop: '4px' }}>
                        <strong>Address:</strong> {customerInfo.address || selectedCustomer?.address || ''}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {allowPayAtPickupEnabled ? (
                      <>
                        <button
                          type="button"
                          onClick={() => !showPaymentForm && setPayAtPickupOrDelivery(false)}
                          disabled={showPaymentForm}
                          style={{
                            padding: '4px 12px',
                            border: '1px solid ' + (!payAtPickupOrDelivery ? themeColor : '#ccc'),
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: !payAtPickupOrDelivery ? 600 : 400,
                            backgroundColor: !payAtPickupOrDelivery ? themeColor : 'transparent',
                            color: !payAtPickupOrDelivery ? '#fff' : '#666',
                            cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                            opacity: showPaymentForm ? 0.3 : 1
                          }}
                        >
                          Pay now
                        </button>
                        <button
                          type="button"
                          onClick={() => !showPaymentForm && setPayAtPickupOrDelivery(true)}
                          disabled={showPaymentForm}
                          style={{
                            padding: '4px 12px',
                            border: '1px solid ' + (payAtPickupOrDelivery ? themeColor : '#ccc'),
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: payAtPickupOrDelivery ? 600 : 400,
                            backgroundColor: payAtPickupOrDelivery ? themeColor : 'transparent',
                            color: payAtPickupOrDelivery ? '#fff' : '#666',
                            cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                            opacity: showPaymentForm ? 0.3 : 1
                          }}
                        >
                          {orderType === 'pickup' ? 'Pay at pickup' : 'Pay on delivery'}
                        </button>
                      </>
                    ) : null}
                    {selectedCustomer ? (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenEditCustomer() }}
                          disabled={showPaymentForm}
                          type="button"
                          style={{
                            padding: 0,
                            margin: 0,
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#666',
                            cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                            opacity: showPaymentForm ? 0.3 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1
                          }}
                          title="Edit customer"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleClearCustomer() }}
                          disabled={showPaymentForm}
                          type="button"
                          style={{
                            padding: 0,
                            margin: 0,
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#666',
                            cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                            opacity: showPaymentForm ? 0.3 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1
                          }}
                          title="Remove customer"
                        >
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => !showPaymentForm && setCustomerInfoConfirmed(false)}
                        disabled={showPaymentForm}
                        title="Edit customer details"
                        style={{
                          padding: '4px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#666',
                          cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                          opacity: showPaymentForm ? 0.3 : 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1
                        }}
                      >
                        <Pencil size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : !selectedCustomer ? (
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={customerSearchTerm}
                    onChange={(e) => {
                      if (!showPaymentForm) {
                        setCustomerSearchTerm(e.target.value)
                        searchCustomers(e.target.value)
                      }
                    }}
                    placeholder="Search for customers"
                    disabled={showPaymentForm}
                    style={{
                      ...inputBaseStyle(isDarkMode, themeColorRgb),
                      flex: 1,
                      paddingTop: '6px',
                      paddingBottom: '6px',
                      opacity: showPaymentForm ? 0.3 : 1,
                      cursor: showPaymentForm ? 'not-allowed' : 'text'
                    }}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                  <button
                    onClick={handleCreateCustomer}
                    disabled={showPaymentForm}
                    style={{
                      padding: '4px',
                      width: '40px',
                      height: '40px',
                      backgroundColor: showPaymentForm ? `rgba(${themeColorRgb}, 0.3)` : `rgba(${themeColorRgb}, 0.7)`,
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 600,
                      boxShadow: showPaymentForm ? `0 2px 8px rgba(${themeColorRgb}, 0.2)` : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: showPaymentForm ? 0.3 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!showPaymentForm) {
                        e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
                        e.currentTarget.style.boxShadow = `0 4px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!showPaymentForm) {
                        e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
                        e.currentTarget.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                      }
                    }}
                    title="Add Customer"
                  >
                    <UserPlus size={24} />
                  </button>
                </div>
                {customerSearchResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {customerSearchResults.map(customer => (
                      <div
                        key={customer.customer_id}
                        onClick={() => !showPaymentForm && handleCustomerSelect(customer)}
                        style={{
                          padding: '12px',
                          cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                          borderBottom: '1px solid #eee',
                          transition: 'background-color 0.2s',
                          opacity: showPaymentForm ? 0.3 : 1,
                          pointerEvents: showPaymentForm ? 'none' : 'auto'
                        }}
                        onMouseEnter={(e) => {
                          if (!showPaymentForm) {
                            e.target.style.backgroundColor = '#f5f5f5'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!showPaymentForm) {
                            e.target.style.backgroundColor = '#fff'
                          }
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                          {customer.customer_name || 'No name'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {customer.email && <span>{customer.email}</span>}
                          {customer.email && customer.phone && <span> • </span>}
                          {customer.phone && <span>{customer.phone}</span>}
                          {customer.loyalty_points !== undefined && customer.loyalty_points > 0 && (
                            <span> • {customer.loyalty_points} points</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                padding: '12px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div
                  style={{ flex: 1, cursor: 'pointer' }}
                  onClick={() => setShowRewardsModal(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowRewardsModal(true) }}
                >
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                    {selectedCustomer.customer_name || 'No name'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {selectedCustomer.email && <span>{selectedCustomer.email}</span>}
                    {selectedCustomer.email && selectedCustomer.phone && <span> • </span>}
                    {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                    {selectedCustomer.loyalty_points !== undefined && selectedCustomer.loyalty_points > 0 && (
                      <span> • {selectedCustomer.loyalty_points} points</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenEditCustomer() }}
                  disabled={showPaymentForm}
                  type="button"
                  style={{
                    padding: 0,
                    margin: 0,
                    marginRight: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#666',
                    cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                    opacity: showPaymentForm ? 0.3 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1
                  }}
                  title="Edit customer"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleClearCustomer() }}
                  disabled={showPaymentForm}
                  type="button"
                  style={{
                    padding: 0,
                    margin: 0,
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#666',
                    cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                    opacity: showPaymentForm ? 0.3 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1
                  }}
                  title="Remove customer"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#666' }}>Subtotal:</span>
            <span style={{ fontFamily: '"Product Sans", sans-serif', fontWeight: 500 }}>
              ${calculateSubtotal().toFixed(2)}
            </span>
          </div>
          {orderDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#666' }}>
                Discount{orderDiscountType ? ` (${DISCOUNT_PRESETS.find(p => p.id === orderDiscountType)?.label || orderDiscountType})` : ''}:
              </span>
              <span style={{ fontFamily: '"Product Sans", sans-serif', fontWeight: 500 }}>
                -${orderDiscount.toFixed(2)}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#666' }}>Tax ({(taxRate * 100).toFixed(1)}%):</span>
            <span style={{ fontFamily: '"Product Sans", sans-serif', fontWeight: 500 }}>
              ${calculateTax().toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#666' }}>Transaction fee:</span>
            <span style={{ fontFamily: '"Product Sans", sans-serif', fontWeight: 500 }}>
              {paymentMethodForFee !== null ? `$${calculateTransactionFee().toFixed(2)}` : '$0.00'}
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
          {getExchangeCreditRemaining() > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '14px', color: '#666' }}>
              <span>Store credit remaining:</span>
              <span style={{ fontFamily: '"Product Sans", sans-serif', fontWeight: 500 }}>
                ${getExchangeCreditRemaining().toFixed(2)}
              </span>
            </div>
          )}

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
                onClick={async () => {
                  if (!showPaymentForm) {
                    // Pay when pickup/delivery: place order without payment
                    if (orderType && payAtPickupOrDelivery) {
                      placeOrderPayLater()
                      return
                    }
                    const registerOpen = await checkRegisterOpen()
                    if (!registerOpen) {
                      showToast('Register is closed.', 'warning', {
                        label: 'Open Register',
                        onClick: () => navigate('/settings?tab=cash'),
                        iconColor: '#ef4444',
                        buttonColor: themeColor
                      })
                      return
                    }
                    // Only check requirements if rewards are enabled AND customer is selected/entered
                    if (rewardsSettings.enabled && (selectedCustomer || customerInfo.name) && !checkCustomerInfoRequirements()) {
                      setShowCustomerInfoModal(true)
                      return
                    }
                    setShowSummary(true)
                    setShowCustomerDisplay(true)
                  }
                }}
                disabled={cart.length === 0 || showPaymentForm || (orderType && payAtPickupOrDelivery && processing)}
                style={{
                  flex: 1,
                  padding: '16px',
                  backgroundColor: (cart.length === 0 || showPaymentForm) ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.7)`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#fff',
                  border: (cart.length === 0 || showPaymentForm) ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: 600,
                  cursor: (cart.length === 0 || showPaymentForm) ? 'not-allowed' : 'pointer',
                  boxShadow: (cart.length === 0 || showPaymentForm) ? `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)` : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                  transition: 'all 0.3s ease',
                  opacity: showPaymentForm ? 0.3 : 1
                }}
              >
                {orderType && payAtPickupOrDelivery ? (processing ? 'Placing…' : 'Place order') : 'Pay'}
              </button>
            </ProtectedComponent>
            <ProtectedComponent permission="apply_discount" fallback={null}>
              <button
                onClick={() => {
                  if (!showPaymentForm) {
                    setDiscountInput(orderDiscount ? String(orderDiscount) : '')
                    setShowDiscountModal(true)
                  }
                }}
                disabled={cart.length === 0 || showPaymentForm}
                style={{
                  padding: '16px 24px',
                  backgroundColor: (cart.length === 0 || showPaymentForm) ? `rgba(${themeColorRgb}, 0.35)` : `rgba(${themeColorRgb}, 0.55)`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#fff',
                  border: (cart.length === 0 || showPaymentForm) ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: 600,
                  cursor: (cart.length === 0 || showPaymentForm) ? 'not-allowed' : 'pointer',
                  boxShadow: (cart.length === 0 || showPaymentForm) ? `0 2px 8px rgba(${themeColorRgb}, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15)` : `0 4px 15px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                  transition: 'all 0.3s ease',
                  opacity: showPaymentForm ? 0.3 : 1
                }}
              >
                %
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
                onClick={handleShowReceiptOptions}
                style={{
                  padding: '16px 32px',
                  backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.9)`
                  e.currentTarget.style.transform = 'scale(1.02)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                Show Receipt Options
              </button>
            </div>
          </>
        ) : showPaymentForm ? (
          <>
            {paymentMethod !== 'cash' && (
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
            )}

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

            {/* Process Order Button */}
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: 'auto' }}>
              <button
                onClick={() => {
                  setShowPaymentForm(false)
                  setShowCustomerDisplay(false)
                  setAmountPaid('')
                  setShowSummary(false)
                }}
                style={{
                  flex: 1,
                  padding: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#333',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  fontSize: '18px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                  transition: 'all 0.3s ease'
                }}
              >
                Cancel
              </button>
              <button
                onClick={processOrder}
                disabled={processing || cart.length === 0}
                style={{
                  flex: 2,
                  padding: '16px',
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
                {processing ? 'Processing...' : 'Process'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Search Bar: chips inside bar + input, then scan button */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '6px',
                    borderBottom: '2px solid #ddd',
                    padding: '6px 0',
                    minHeight: '40px',
                    boxSizing: 'border-box'
                  }}
                >
                  {searchFilterChips.map((chip, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        backgroundColor: `rgba(${themeColorRgb}, 0.15)`,
                        border: `1px solid rgba(${themeColorRgb}, 0.4)`,
                        color: isDarkMode ? '#fff' : '#333'
                      }}
                    >
                      {chip.label}
                      <button
                        type="button"
                        onClick={(ev) => { ev.preventDefault(); setSearchFilterChips(prev => prev.filter((_, i) => i !== idx)) }}
                        style={{
                          padding: 0,
                          marginLeft: '2px',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          lineHeight: 1,
                          color: 'inherit',
                          opacity: 0.8
                        }}
                        aria-label="Remove filter"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder={searchFilterChips.length ? "Search…" : "Search products…"}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' && searchTerm.length > 0) {
                        const trimmed = searchTerm.trim()
                        const segments = trimmed.split(/\s+/)
                        const word = segments[segments.length - 1]
                        if (!word) return
                        const resolved = resolveFilterWord(word, pendingQuantityForChip)
                        if (resolved) {
                          e.preventDefault()
                          if (resolved.isQuantityPrefix) {
                            setPendingQuantityForChip({ label: resolved.label, word: word })
                            setSearchTerm(prev => prev.replace(new RegExp('\\s*' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$'), '').trim())
                            return
                          }
                          setSearchFilterChips(prev => [...prev, resolved])
                          setPendingQuantityForChip(null)
                          setSearchTerm(prev => prev.replace(new RegExp('\\s*' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$'), '').trim())
                        }
                      }
                    }}
                    disabled={showPaymentForm}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '4px 0',
                      border: 'none',
                      borderRadius: 0,
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      backgroundColor: 'transparent',
                      outline: 'none',
                      opacity: showPaymentForm ? 0.3 : 1,
                      cursor: showPaymentForm ? 'not-allowed' : 'text'
                    }}
                    autoFocus={!showPaymentForm}
                  />
                </div>
                <button
                onClick={() => setShowBarcodeScanner(true)}
                disabled={showPaymentForm}
                style={{
                  padding: '4px',
                  width: '40px',
                  height: '40px',
                  backgroundColor: showPaymentForm ? `rgba(${themeColorRgb}, 0.3)` : `rgba(${themeColorRgb}, 0.7)`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  boxShadow: showPaymentForm ? `0 2px 8px rgba(${themeColorRgb}, 0.2)` : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: showPaymentForm ? 0.3 : 1
                }}
                onMouseEnter={(e) => {
                  if (!showPaymentForm) {
                    e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
                    e.target.style.boxShadow = `0 4px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showPaymentForm) {
                    e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
                    e.target.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                  }
                }}
                title="Scan Barcode"
              >
                <ScanBarcode size={24} />
              </button>
              </div>
            </div>

            {/* Category Navigation */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ position: 'relative' }}>
                <div 
                  className="pos-category-buttons-scroll"
                  style={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    gap: '8px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                >
                  {categories.map(category => {
                    const label = category.includes(' > ') ? category.split(' > ').pop().trim() : category
                    return (
                    <button
                      key={category}
                      onClick={() => handleCategorySelect(category)}
                      disabled={showPaymentForm}
                      title={category}
                      style={{
                        padding: '4px 16px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                        backgroundColor: selectedCategory === category 
                          ? `rgba(${themeColorRgb}, 0.7)` 
                          : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                        border: selectedCategory === category 
                          ? `1px solid rgba(${themeColorRgb}, 0.5)` 
                          : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: selectedCategory === category ? 600 : 500,
                        color: selectedCategory === category ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                        cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: selectedCategory === category ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none',
                        opacity: showPaymentForm ? 0.3 : 1
                      }}
                    >
                      {label}
                    </button>
                  )})}
                </div>
                {/* Left gradient fade */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: '4px',
                  width: '20px',
                  background: `linear-gradient(to right, ${isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white'} 0%, ${isDarkMode ? 'rgba(26, 26, 26, 0.3)' : 'rgba(255, 255, 255, 0.3)'} 50%, transparent 100%)`,
                  pointerEvents: 'none',
                  zIndex: 1
                }} />
                {/* Right gradient fade */}
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: '4px',
                  width: '20px',
                  background: `linear-gradient(to left, ${isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white'} 0%, ${isDarkMode ? 'rgba(26, 26, 26, 0.3)' : 'rgba(255, 255, 255, 0.3)'} 50%, transparent 100%)`,
                  pointerEvents: 'none',
                  zIndex: 1
                }} />
              </div>
            </div>

            {/* Product List / Search Results – shell always visible; skeletons while data loads */}
            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }} aria-busy="true" aria-label="Loading products">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 12px',
                        border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#eee'}`,
                        borderRadius: '4px',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fafafa'
                      }}
                    >
                      <div style={{
                        width: '50px',
                        height: '50px',
                        minWidth: '50px',
                        borderRadius: '4px',
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#e8e8e8'
                      }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{
                          height: '14px',
                          width: `${60 + (i % 3) * 15}%`,
                          maxWidth: '200px',
                          borderRadius: '4px',
                          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e0e0e0'
                        }} />
                        <div style={{
                          height: '11px',
                          width: `${40 + (i % 2) * 20}%`,
                          maxWidth: '120px',
                          borderRadius: '4px',
                          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#eee'
                        }} />
                      </div>
                      <div style={{
                        height: '16px',
                        width: '48px',
                        borderRadius: '4px',
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e0e0e0'
                      }} />
                    </div>
                  ))}
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
                        onClick={() => !showPaymentForm && addToCart(product)}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #eee',
                          borderRadius: '4px',
                          cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          backgroundColor: (product.current_quantity || 0) > 0 ? '#fff' : '#ffebee',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center',
                          opacity: showPaymentForm ? 0.3 : 1,
                          pointerEvents: showPaymentForm ? 'none' : 'auto'
                        }}
                        onMouseEnter={(e) => {
                          if (!showPaymentForm) {
                            e.currentTarget.style.backgroundColor = '#f5f5f5'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!showPaymentForm) {
                            e.currentTarget.style.backgroundColor = (product.current_quantity || 0) > 0 ? '#fff' : '#ffebee'
                          }
                        }}
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
                            ${(parseFloat(product.product_price) || 0).toFixed(2)}
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
                        onClick={() => !showPaymentForm && addToCart(product)}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #eee',
                          borderRadius: '4px',
                          cursor: showPaymentForm ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          backgroundColor: (product.current_quantity || 0) > 0 ? '#fff' : '#ffebee',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'center',
                          opacity: showPaymentForm ? 0.3 : 1,
                          pointerEvents: showPaymentForm ? 'none' : 'auto'
                        }}
                        onMouseEnter={(e) => {
                          if (!showPaymentForm) {
                            e.currentTarget.style.backgroundColor = '#f5f5f5'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!showPaymentForm) {
                            e.currentTarget.style.backgroundColor = (product.current_quantity || 0) > 0 ? '#fff' : '#ffebee'
                          }
                        }}
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
                            ${(parseFloat(product.product_price) || 0).toFixed(2)}
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

      {/* Customer Info Modal */}
      {showCustomerInfoModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={formModalStyle(isDarkMode)}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontFamily: '"Product Sans", sans-serif', color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a' }}>
                {showCreateCustomer ? 'Add Customer' : (orderType ? (orderType === 'pickup' ? 'Pickup' : 'Delivery') : 'Customer')} Information
              </h3>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={formLabelStyle(isDarkMode)}>
                Name <span style={{ color: '#f44336' }}>*</span>
              </label>
              <input
                type="text"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                placeholder="Customer name"
                style={inputBaseStyle(isDarkMode, themeColorRgb)}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                autoFocus
              />
            </div>

            {(rewardsSettings.enabled && (rewardsSettings.require_email || rewardsSettings.require_both)) || orderType || showCreateCustomer ? (
              <div style={{ marginBottom: '16px' }}>
                <label style={formLabelStyle(isDarkMode)}>
                  Email {((rewardsSettings.enabled && rewardsSettings.require_email) || rewardsSettings.require_both) ? <span style={{ color: '#f44336' }}>*</span> : ''}
                </label>
                <input
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                  placeholder="Email address"
                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                />
              </div>
            ) : null}

            {(rewardsSettings.enabled && (rewardsSettings.require_phone || rewardsSettings.require_both)) || orderType || showCreateCustomer ? (
              <div style={{ marginBottom: '16px' }}>
                <label style={formLabelStyle(isDarkMode)}>
                  Phone Number {(orderType || showCreateCustomer || (rewardsSettings.enabled && (rewardsSettings.require_phone || rewardsSettings.require_both))) ? <span style={{ color: '#f44336' }}>*</span> : ''}
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="Phone number"
                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                />
              </div>
            ) : null}

            {(orderType === 'delivery' || showCreateCustomer) && (
              <div style={{ marginBottom: '16px' }}>
                <label style={formLabelStyle(isDarkMode)}>
                  Address {orderType === 'delivery' ? <span style={{ color: '#f44336' }}>*</span> : ''}
                </label>
                <textarea
                  value={customerInfo.address}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                  placeholder={orderType === 'delivery' ? 'Delivery address' : 'Address (optional)'}
                  rows={3}
                  style={{
                    ...inputBaseStyle(isDarkMode, themeColorRgb),
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                />
              </div>
            )}

            <FormModalActions
              onCancel={() => {
                setShowCustomerInfoModal(false)
                if (showCreateCustomer) {
                  setShowCreateCustomer(false)
                  setCustomerInfo({ name: '', email: '', phone: '', address: '' })
                } else if (!orderType) {
                  setCustomerInfo({ name: '', email: '', phone: '', address: '' })
                } else {
                  setOrderType(null)
                  setCustomerInfo({ name: '', email: '', phone: '', address: '' })
                }
              }}
              onPrimary={async () => {
                let requiredFields = false
                let errorMessage = ''
                if (showCreateCustomer) {
                  requiredFields = customerInfo.name && customerInfo.phone
                  errorMessage = 'Please fill in name and phone'
                  if (requiredFields) {
                    try {
                      const response = await fetch('/api/customers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          customer_name: customerInfo.name,
                          email: customerInfo.email || null,
                          phone: customerInfo.phone,
                          address: customerInfo.address || null
                        })
                      })
                      const data = await response.json()
                      if (data.success) {
                        setSelectedCustomer({
                          customer_id: data.customer_id,
                          customer_name: customerInfo.name,
                          email: customerInfo.email,
                          phone: customerInfo.phone,
                          address: customerInfo.address
                        })
                        showToast('Customer added successfully', 'success')
                        setShowCustomerInfoModal(false)
                        setShowCreateCustomer(false)
                        setCustomerInfo({ name: '', email: '', phone: '', address: '' })
                      } else {
                        showToast(data.message || 'Failed to create customer', 'error')
                      }
                    } catch (err) {
                      console.error('Error creating customer:', err)
                      showToast('Error creating customer. Please try again.', 'error')
                    }
                    return
                  }
                  showToast(errorMessage, 'error')
                  return
                }
                if (orderType === 'pickup') {
                  requiredFields = customerInfo.name && customerInfo.phone
                  errorMessage = 'Please fill in name and phone'
                } else if (orderType === 'delivery') {
                  requiredFields = customerInfo.name && customerInfo.phone && customerInfo.address
                  errorMessage = 'Please fill in name, phone, and address'
                } else if (rewardsSettings.enabled) {
                  if (rewardsSettings.require_both) {
                    requiredFields = customerInfo.name && customerInfo.email && customerInfo.phone
                    errorMessage = 'Please fill in name, email, and phone'
                  } else if (rewardsSettings.require_email) {
                    requiredFields = customerInfo.name && customerInfo.email
                    errorMessage = 'Please fill in name and email'
                  } else if (rewardsSettings.require_phone) {
                    requiredFields = customerInfo.name && customerInfo.phone
                    errorMessage = 'Please fill in name and phone'
                  } else {
                    requiredFields = customerInfo.name
                    errorMessage = 'Please fill in name'
                  }
                } else {
                  requiredFields = customerInfo.name
                  errorMessage = 'Please fill in name'
                }
                if (requiredFields) {
                  setShowCustomerInfoModal(false)
                  if (rewardsSettings.enabled && !orderType) {
                    setShowSummary(true)
                    setShowCustomerDisplay(true)
                  }
                } else {
                  alert(errorMessage)
                }
              }}
              primaryLabel={showCreateCustomer ? 'Add Customer' : 'Save'}
            />
          </div>
        </div>
      )}

      {/* Customer Rewards Modal - shown when a customer is selected */}
      {showRewardsModal && selectedCustomer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1500,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              borderRadius: '12px',
              maxWidth: '420px',
              width: '90%',
              maxHeight: '85vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              padding: '20px',
              pointerEvents: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gift size={22} style={{ color: `rgb(${themeColorRgb})` }} />
                Customer Rewards
              </h3>
              <button
                type="button"
                onClick={() => setShowRewardsModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#666' }}>
              {selectedCustomer.customer_name || 'Customer'}
            </p>
            {rewardsDetailLoading ? (
              <p style={{ color: '#666' }}>Loading…</p>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px', minWidth: '100px' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Points</div>
                    <div style={{ fontSize: '20px', fontWeight: 700 }}>{customerRewardsDetail?.loyalty_points ?? selectedCustomer.loyalty_points ?? 0}</div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px', minWidth: '100px' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Orders</div>
                    <div style={{ fontSize: '20px', fontWeight: 700 }}>{customerRewardsDetail?.order_count ?? 0}</div>
                  </div>
                  <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px', minWidth: '100px' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>Total spent</div>
                    <div style={{ fontSize: '18px', fontWeight: 700 }}>${(customerRewardsDetail?.total_spent ?? 0).toFixed(2)}</div>
                  </div>
                </div>
                {customerRewardsDetail?.popular_items?.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>Popular items</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                      {customerRewardsDetail.popular_items.map((it, i) => (
                        <li key={i}>{it.product_name} (×{it.qty})</li>
                      ))}
                    </ul>
                  </div>
                )}
                {rewardsSettings.reward_type === 'points' && (customerRewardsDetail?.loyalty_points ?? selectedCustomer.loyalty_points ?? 0) > 0 && (
                  <div style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
                    <div style={{ fontSize: '13px', marginBottom: '8px' }}>Use points (100 pts = $1)</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="number"
                        min={1}
                        max={customerRewardsDetail?.loyalty_points ?? selectedCustomer.loyalty_points ?? 0}
                        value={pointsToUse}
                        onChange={e => setPointsToUse(e.target.value.replace(/\D/g, ''))}
                        placeholder="Points to use"
                        style={{
                          ...inputBaseStyle(isDarkMode, themeColorRgb),
                          width: '100px',
                          padding: '8px'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setPointsToUse(String(customerRewardsDetail?.loyalty_points ?? selectedCustomer.loyalty_points ?? 0))}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
                          border: `1px solid rgba(${themeColorRgb}, 0.5)`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Use all
                      </button>
                      <button
                        type="button"
                        onClick={() => addPointsRedemptionToCart(pointsToUse)}
                        disabled={!pointsToUse || parseInt(pointsToUse, 10) <= 0}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600
                        }}
                      >
                        Add to cart
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Customer Modal - same style as Add Customer / Customer Info form */}
      {showEditCustomerModal && selectedCustomer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }} onClick={() => setShowEditCustomerModal(false)}>
          <div style={formModalStyle(isDarkMode)} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontFamily: '"Product Sans", sans-serif', color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a' }}>
                Edit customer
              </h3>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={formLabelStyle(isDarkMode)}>Name</label>
              <input
                type="text"
                value={editCustomerForm.customer_name}
                onChange={e => setEditCustomerForm(prev => ({ ...prev, customer_name: e.target.value }))}
                placeholder="Customer name"
                style={inputBaseStyle(isDarkMode, themeColorRgb)}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={formLabelStyle(isDarkMode)}>Email</label>
              <input
                type="email"
                value={editCustomerForm.email}
                onChange={e => setEditCustomerForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Email address"
                style={inputBaseStyle(isDarkMode, themeColorRgb)}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={formLabelStyle(isDarkMode)}>Phone Number</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={editCustomerForm.phone}
                onChange={e => setEditCustomerForm(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                placeholder="Phone number"
                style={inputBaseStyle(isDarkMode, themeColorRgb)}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={formLabelStyle(isDarkMode)}>Address</label>
              <textarea
                value={editCustomerForm.address}
                onChange={e => setEditCustomerForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Address (optional)"
                rows={3}
                style={{
                  ...inputBaseStyle(isDarkMode, themeColorRgb),
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              />
            </div>

            <FormModalActions
              onCancel={() => setShowEditCustomerModal(false)}
              onPrimary={handleSaveEditCustomer}
              primaryLabel="Save"
            />
          </div>
        </div>
      )}

      {/* Discount form - no full-page dark overlay; no header, Preset label, or X */}
      {showDiscountModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1500,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              pointerEvents: 'auto',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              padding: '20px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {DISCOUNT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPresetDiscount(preset)}
                  style={{
                    padding: '8px 14px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                    backgroundColor: `rgba(${themeColorRgb}, 0.15)`,
                    border: `1px solid rgba(${themeColorRgb}, 0.4)`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: `rgb(${themeColorRgb})`,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: 'none'
                  }}
                >
                  {preset.label} {preset.percent}%
                </button>
              ))}
            </div>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Or enter custom amount</div>
            <input
              type="text"
              value={discountInput}
              onChange={e => setDiscountInput(e.target.value)}
              placeholder="e.g. 10 or 10%"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') applyDiscountFromModal(); if (e.key === 'Escape') { setShowDiscountModal(false); setDiscountInput('') } }}
              style={{
                ...inputBaseStyle(isDarkMode, themeColorRgb),
                width: '100%',
                padding: '10px 12px',
                marginBottom: '20px',
                boxSizing: 'border-box'
              }}
              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => { setShowDiscountModal(false); setDiscountInput('') }}
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
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: 'none'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyDiscountFromModal}
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
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order placed (pay later) - show receipt with barcode + Print button */}
      {orderPlacedPayLater && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1600
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#333' }}>Order placed</h3>
            <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: '#333' }}>
              #{orderPlacedPayLater.orderNumber}
            </p>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#666' }}>
              Total: ${(orderPlacedPayLater.total || 0).toFixed(2)} — Customer will pay at pickup/delivery
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  if (orderPlacedPayLater.orderId) {
                    window.open(`/api/receipt/${orderPlacedPayLater.orderId}`, '_blank', 'noopener')
                  }
                }}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: `2px solid ${themeColor}`,
                  backgroundColor: 'transparent',
                  color: themeColor,
                  fontWeight: 600,
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                Print receipt (with barcode)
              </button>
              <button
                type="button"
                onClick={() => setOrderPlacedPayLater(null)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                  fontWeight: 600,
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay for order (scanned barcode = order number) */}
      {orderToPayFromScan && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1600
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#333' }}>Pay for order</h3>
            <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: '#333' }}>
              #{orderToPayFromScan.orderNumber}
            </p>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#666' }}>
              Total: ${(orderToPayFromScan.total || 0).toFixed(2)}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={async () => {
                  const token = localStorage.getItem('sessionToken')
                  const res = await fetch(`/api/orders/${orderToPayFromScan.orderId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
                    body: JSON.stringify({ order_status: 'completed', payment_status: 'completed', payment_method: 'cash' })
                  })
                  const result = await res.json()
                  if (result.success) {
                    showToast(`Order ${orderToPayFromScan.orderNumber} marked as paid`, 'success')
                    setOrderToPayFromScan(null)
                  } else {
                    showToast(result.message || 'Failed to mark as paid', 'error')
                  }
                }}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: themeColor,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                Mark as paid (cash)
              </button>
              <button
                type="button"
                onClick={() => setOrderToPayFromScan(null)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                  fontWeight: 600,
                  fontSize: '15px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onImageScan={handleImageScan}
          onClose={() => setShowBarcodeScanner(false)}
          themeColor={themeColor}
        />
      )}
    </div>
  )
}

export default POS


