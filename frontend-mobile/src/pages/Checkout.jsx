import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, ClipboardList, Calendar as CalendarIcon, Package, Percent, ScanBarcode } from 'lucide-react'
import api from '../services/api'
import CameraScanner from '../components/CameraScanner'
import ProfileButton from '../components/ProfileButton'
import './Checkout.css'

const TAX_RATE = 0.08

export default function Checkout() {
  const navigate = useNavigate()
  const [cart, setCart] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categoryProducts, setCategoryProducts] = useState([])
  const [showScanner, setShowScanner] = useState(false)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [amountPaid, setAmountPaid] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (!allProducts.length) return
    const raw = allProducts.map((p) => p.category).filter(Boolean)
    const pathPrefixes = (path) => {
      if (!path || typeof path !== 'string') return []
      const parts = path.split(' > ').map((p) => p.trim()).filter(Boolean)
      const out = []
      for (let i = 1; i <= parts.length; i++) out.push(parts.slice(0, i).join(' > '))
      return out
    }
    setCategories([...new Set(raw.flatMap(pathPrefixes))].sort())
  }, [allProducts])

  useEffect(() => {
    if (selectedCategory && searchTerm.length < 2) {
      const filtered = allProducts.filter((p) => {
        const cat = p.category || ''
        return cat === selectedCategory || cat.startsWith(selectedCategory + ' > ')
      })
      setCategoryProducts(filtered)
    } else {
      setCategoryProducts([])
    }
  }, [selectedCategory, allProducts, searchTerm])

  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([])
      return
    }
    const term = searchTerm.toLowerCase()
    const filtered = allProducts.filter(
      (p) =>
        (p.product_name || '').toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term) ||
        (p.category || '').toLowerCase().includes(term)
    )
    setSearchResults(filtered.slice(0, 20))
  }, [searchTerm, allProducts])

  const loadProducts = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('inventory?item_type=product&include_variants=1')
      if (res.data?.data) setAllProducts(res.data.data || [])
    } catch (e) {
      setError('Could not load products')
    } finally {
      setLoading(false)
    }
  }

  const normalizeBarcode = (val) => (val || '').toString().replace(/\s+/g, '').trim()
  const handleBarcodeScanned = (barcode) => {
    const norm = normalizeBarcode(barcode)
    if (!norm) return
    const product = allProducts.find((p) => {
      const pb = normalizeBarcode(p.barcode)
      const sku = normalizeBarcode(p.sku)
      if (pb && pb === norm) return true
      if (sku && sku === norm) return true
      if (norm.length === 13 && norm.startsWith('0') && pb === norm.slice(1)) return true
      if (norm.length === 12 && pb === '0' + norm) return true
      return false
    })
    if (product) {
      addToCart(product)
      setShowScanner(false)
      setError('')
    } else {
      setError(`No product for barcode "${norm}"`)
    }
  }

  const addToCart = (product, variant = null) => {
    const unitPrice =
      variant != null && (variant.price != null || variant.unit_price != null)
        ? parseFloat(variant.price ?? variant.unit_price)
        : parseFloat(product.product_price) || 0
    const name =
      variant ? `${product.product_name} (${variant.variant_name || variant.name || 'Size'})` : product.product_name
    const variantId = variant?.variant_id != null ? Number(variant.variant_id) : null

    setCart((prev) => {
      const existing = prev.find(
        (item) =>
          item.product_id === product.product_id &&
          (item.variant_id ?? null) === variantId
      )
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.product_id && (item.variant_id ?? null) === variantId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [
        ...prev,
        {
          product_id: product.product_id,
          product_name: name,
          unit_price: unitPrice,
          quantity: 1,
          variant_id: variantId,
        },
      ]
    })
    setSearchTerm('')
    setSearchResults([])
  }

  const updateQty = (productId, variantId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product_id !== productId || (item.variant_id ?? null) !== (variantId ?? null))
            return item
          const q = item.quantity + delta
          return q < 1 ? null : { ...item, quantity: q }
        })
        .filter(Boolean)
    )
  }

  const removeLine = (productId, variantId) => {
    setCart((prev) =>
      prev.filter(
        (item) =>
          !(item.product_id === productId && (item.variant_id ?? null) === (variantId ?? null))
      )
    )
  }

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)
  const tax = subtotal * TAX_RATE
  const total = subtotal + tax

  const handlePayTap = () => {
    if (cart.length === 0) return
    setShowPayment(true)
  }

  const handlePaymentSubmit = async () => {
    if (cart.length === 0) return
    if (paymentMethod === 'cash') {
      const paid = parseFloat(amountPaid) || 0
      if (paid < total) {
        setError('Amount paid is less than total')
        return
      }
    }
    setProcessing(true)
    setError('')
    try {
      const token = localStorage.getItem('sessionToken')
      if (!token) {
        setError('Please log in to process payment')
        setProcessing(false)
        return
      }
      const items = cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        variant_id: item.variant_id || undefined,
      }))
      const startRes = await api.post('transaction/start', { items })
      if (!startRes.data?.success || !startRes.data?.data?.transaction_id) {
        setError(startRes.data?.message || 'Failed to start transaction')
        setProcessing(false)
        return
      }
      const { transaction_id } = startRes.data.data
      const methodsRes = await api.get('payment-methods')
      const methods = methodsRes.data?.data || []
      const cashMethod = methods.find(
        (m) => m.method_type === 'cash' || (m.method_name || '').toLowerCase().includes('cash')
      )
      if (!cashMethod) {
        setError('No cash payment method configured')
        setProcessing(false)
        return
      }
      const amount = paymentMethod === 'cash' ? parseFloat(amountPaid) || total : total
      const paymentMethodId = cashMethod.payment_method_id ?? cashMethod.id
      const payRes = await api.post('payment/process', {
        transaction_id,
        payment_method_id: paymentMethodId,
        amount,
        tip: 0,
      })
      if (payRes.data?.success) {
        setCart([])
        setShowPayment(false)
        setAmountPaid('')
        setError('')
        const change = paymentMethod === 'cash' ? Math.max(0, (parseFloat(amountPaid) || 0) - total) : 0
        if (change > 0) alert(`Change: $${change.toFixed(2)}`)
        navigate('/')
      } else {
        setError(payRes.data?.message || payRes.data?.data?.message || 'Payment failed')
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Payment failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleKeypad = (key) => {
    if (key === 'C') setAmountPaid('')
    else if (key === '⌫') setAmountPaid((s) => s.slice(0, -1))
    else if (key === '.') setAmountPaid((s) => (s.includes('.') ? s : s + '.'))
    else setAmountPaid((s) => s + key)
  }

  return (
    <div className="checkout-page">
      {error && <div className="checkout-error">{error}</div>}

      <div className="checkout-cart-container">
        <div className="checkout-search-row-wrap">
          <ProfileButton />
          <div className="checkout-search-row">
            <Search size={20} className="checkout-search-icon" />
            <input
              type="search"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="checkout-search-input"
            />
          </div>
          <button
            type="button"
            className="checkout-scan-btn"
            onClick={() => setShowScanner((s) => !s)}
            aria-label="Scan barcode"
            title="Scan barcode"
          >
            <ScanBarcode size={22} strokeWidth={2} />
          </button>
        </div>

        {showScanner && (
          <CameraScanner
            onScan={handleBarcodeScanned}
            onClose={() => setShowScanner(false)}
          />
        )}

        {!showScanner && categories.length > 0 && (
          <div className="checkout-categories">
            <button
              type="button"
              className={`checkout-category-chip ${selectedCategory === null ? 'checkout-category-chip--active' : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                type="button"
                key={cat}
                className={`checkout-category-chip ${selectedCategory === cat ? 'checkout-category-chip--active' : ''}`}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {searchTerm.length >= 2 ? (
          <div className="checkout-results-inner">
            {loading ? (
              <p className="checkout-muted">Loading...</p>
            ) : searchResults.length === 0 ? (
              <p className="checkout-muted">No products found</p>
            ) : (
              <ul className="checkout-result-list">
                {searchResults.map((p) => (
                  <li key={p.product_id}>
                    {p.variants && p.variants.length > 0 ? (
                      p.variants.map((v) => (
                        <button
                          type="button"
                          key={v.variant_id}
                          className="checkout-result-item"
                          onClick={() => addToCart(p, v)}
                        >
                          <span>{p.product_name} — {v.variant_name || v.name}</span>
                          <span className="checkout-result-price">
                            ${(parseFloat(v.price ?? v.unit_price) || 0).toFixed(2)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        className="checkout-result-item"
                        onClick={() => addToCart(p)}
                      >
                        <span>{p.product_name}</span>
                        <span className="checkout-result-price">
                          ${(parseFloat(p.product_price) || 0).toFixed(2)}
                        </span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : selectedCategory && categoryProducts.length > 0 ? (
          <div className="checkout-results-inner">
            <ul className="checkout-result-list">
              {categoryProducts.map((p) => (
                <li key={p.product_id}>
                  {p.variants && p.variants.length > 0 ? (
                    p.variants.map((v) => (
                      <button
                        type="button"
                        key={v.variant_id}
                        className="checkout-result-item"
                        onClick={() => addToCart(p, v)}
                      >
                        <span>{p.product_name} — {v.variant_name || v.name}</span>
                        <span className="checkout-result-price">
                          ${(parseFloat(v.price ?? v.unit_price) || 0).toFixed(2)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      className="checkout-result-item"
                      onClick={() => addToCart(p)}
                    >
                      <span>{p.product_name}</span>
                      <span className="checkout-result-price">
                        ${(parseFloat(p.product_price) || 0).toFixed(2)}
                      </span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="checkout-cart-inner">
            <h2 className="checkout-cart-title">Cart</h2>
            {cart.length === 0 ? (
              <p className="checkout-muted">Search or scan a barcode to add products.</p>
            ) : (
              <ul className="checkout-cart-list">
                {cart.map((item) => (
                  <li key={`${item.product_id}-${item.variant_id ?? 'x'}`} className="checkout-cart-row">
                    <div className="checkout-cart-name">{item.product_name}</div>
                    <div className="checkout-cart-qty">
                      <button
                        type="button"
                        className="checkout-qty-btn"
                        onClick={() => updateQty(item.product_id, item.variant_id, -1)}
                        aria-label="Decrease"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="checkout-qty-num">{item.quantity}</span>
                      <button
                        type="button"
                        className="checkout-qty-btn"
                        onClick={() => updateQty(item.product_id, item.variant_id, 1)}
                        aria-label="Increase"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="checkout-cart-price">
                      ${(item.unit_price * item.quantity).toFixed(2)}
                    </div>
                    <button
                      type="button"
                      className="checkout-remove"
                      onClick={() => removeLine(item.product_id, item.variant_id)}
                      aria-label="Remove"
                    >
                      <Trash2 size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="checkout-totals-pay-wrap">
        <div className="checkout-totals">
          <div className="checkout-totals-row">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="checkout-totals-row">
            <span>Tax ({(TAX_RATE * 100).toFixed(0)}%)</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="checkout-totals-row checkout-totals-total">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
        {!showPayment ? (
          <div className="checkout-pay-row">
            <button
              type="button"
              className="checkout-pay-btn"
              disabled={cart.length === 0}
              onClick={handlePayTap}
            >
              Pay ${total.toFixed(2)}
            </button>
            <button
              type="button"
              className="checkout-discount-btn"
              aria-label="Discount"
              disabled={cart.length === 0}
            >
              <Percent size={22} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className="checkout-payment-panel">
            <div className="checkout-payment-total">Total: ${total.toFixed(2)}</div>
          {paymentMethod === 'cash' && (
            <>
              <label className="checkout-payment-label">Amount tendered</label>
              <div className="checkout-amount-display">{amountPaid || '0.00'}</div>
              <div className="checkout-keypad">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="checkout-keypad-key"
                    onClick={() => handleKeypad(k)}
                  >
                    {k}
                  </button>
                ))}
                <button
                  type="button"
                  className="checkout-keypad-key"
                  onClick={() => setAmountPaid('')}
                >
                  C
                </button>
                <button
                  type="button"
                  className="checkout-keypad-key checkout-keypad-key--full"
                  onClick={() => setAmountPaid(total.toFixed(2))}
                >
                  Exact
                </button>
              </div>
            </>
          )}
          <div className="checkout-payment-actions">
            <button
              type="button"
              className="checkout-payment-cancel"
              onClick={() => setShowPayment(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="checkout-pay-btn"
              disabled={processing}
              onClick={handlePaymentSubmit}
            >
              {processing ? 'Processing…' : 'Complete payment'}
            </button>
            </div>
          </div>
        )}
      </div>

      <nav className="bottom-nav">
        <button type="button" className="nav-item nav-item--cart" onClick={() => navigate('/')} aria-label="Cart">
          <span className="nav-cart-circle">
            <ShoppingCart size={36} strokeWidth={2} />
          </span>
        </button>
        <button type="button" className="nav-item" aria-label="Orders" onClick={() => navigate('/orders')}>
          <ClipboardList size={36} strokeWidth={2} />
        </button>
        <button type="button" className="nav-item" aria-label="Calendar" onClick={() => navigate('/calendar')}>
          <CalendarIcon size={36} strokeWidth={2} />
        </button>
        <button type="button" className="nav-item" aria-label="Inventory" onClick={() => navigate('/inventory')}>
          <Package size={36} strokeWidth={2} />
        </button>
        <button type="button" className="nav-item" aria-label="Add">
          <Plus size={36} strokeWidth={2} />
        </button>
      </nav>
    </div>
  )
}
