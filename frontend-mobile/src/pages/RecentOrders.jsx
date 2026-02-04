import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, ClipboardList, Calendar as CalendarIcon, Package, Plus, ChevronRight, ScanBarcode, Search } from 'lucide-react'
import api from '../services/api'
import CameraScanner from '../components/CameraScanner'
import ProfileButton from '../components/ProfileButton'
import './RecentOrders.css'

export default function RecentOrders() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('in_progress')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showScanner, setShowScanner] = useState(false)

  useEffect(() => {
    loadOrders(statusFilter)
  }, [statusFilter])

  const loadOrders = async (status) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (status) params.set('order_status', status)
      const res = await api.get(`orders?${params.toString()}`)
      const data = res.data?.data || res.data || []
      setOrders(Array.isArray(data) ? data : [])
    } catch (e) {
      setError('Could not load orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (d) => {
    if (!d) return '—'
    const date = new Date(d)
    if (isNaN(date.getTime())) return d
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const formatStatus = (status) => (status || '—').replace(/_/g, ' ')
  const formatPayment = (status) => (status || '—').replace(/_/g, ' ')

  const filteredOrders = searchTerm.trim()
    ? orders.filter((o) => {
        const term = searchTerm.toLowerCase().trim()
        const num = (o.order_number || '').toString().toLowerCase()
        const id = (o.order_id ?? '').toString()
        const customer = (o.customer_name || '').toLowerCase()
        return num.includes(term) || id.includes(term) || customer.includes(term)
      })
    : orders

  const handleScanResult = (barcode) => {
    setSearchTerm(barcode)
    setShowSearch(true)
    setShowScanner(false)
  }

  return (
    <div className="recent-orders-page">
      <div className="recent-orders-header">
        <ProfileButton />
        <h1 className="recent-orders-title">Recent Orders</h1>
        <div className="recent-orders-header-actions">
          <button
            type="button"
            className="recent-orders-header-btn"
            onClick={() => setShowScanner((s) => !s)}
            aria-label="Scan barcode"
          >
            <ScanBarcode size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="recent-orders-header-btn"
            onClick={() => setShowSearch((s) => !s)}
            aria-label="Search"
          >
            <Search size={22} strokeWidth={2} />
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="recent-orders-search-row">
          <Search size={20} className="recent-orders-search-icon" />
          <input
            type="search"
            placeholder="Order #, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="recent-orders-search-input"
          />
          <button
            type="button"
            className="recent-orders-search-close"
            onClick={() => { setShowSearch(false); setSearchTerm('') }}
            aria-label="Close search"
          >
            ×
          </button>
        </div>
      )}

      <div className="recent-orders-filters">
        <button
          type="button"
          className={`recent-orders-filter-btn ${statusFilter === 'in_progress' ? 'recent-orders-filter-btn--active' : ''}`}
          onClick={() => setStatusFilter('in_progress')}
        >
          In progress
        </button>
        <button
          type="button"
          className={`recent-orders-filter-btn ${statusFilter === 'out_for_delivery' ? 'recent-orders-filter-btn--active' : ''}`}
          onClick={() => setStatusFilter('out_for_delivery')}
        >
          Out for delivery
        </button>
        <button
          type="button"
          className={`recent-orders-filter-btn ${statusFilter === 'completed' ? 'recent-orders-filter-btn--active' : ''}`}
          onClick={() => setStatusFilter('completed')}
        >
          Completed
        </button>
      </div>

      {showScanner && (
        <CameraScanner
          onScan={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}

      {error && <div className="recent-orders-error">{error}</div>}

      <div className="recent-orders-list-wrap">
        {loading ? (
          <p className="recent-orders-muted">Loading…</p>
        ) : filteredOrders.length === 0 ? (
          <p className="recent-orders-muted">{searchTerm.trim() ? 'No orders match.' : 'No orders yet.'}</p>
        ) : (
          <ul className="recent-orders-list">
            {filteredOrders.map((order) => (
              <li key={order.order_id} className="recent-orders-row">
                <div className="recent-orders-row-main">
                  <span className="recent-orders-number">
                    {order.order_number || `#${order.order_id}`}
                  </span>
                  <span className="recent-orders-date">{formatDate(order.order_date)}</span>
                </div>
                <div className="recent-orders-row-meta">
                  <span className="recent-orders-status">{formatStatus(order.order_status)}</span>
                  <span className="recent-orders-payment">{formatPayment(order.payment_status)}</span>
                </div>
                <div className="recent-orders-row-total">
                  ${(parseFloat(order.total) || 0).toFixed(2)}
                </div>
                <ChevronRight size={20} className="recent-orders-chevron" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <nav className="bottom-nav">
        <button
          type="button"
          className="nav-item nav-item--cart"
          aria-label="Cart"
          onClick={() => navigate('/checkout')}
        >
          <span className="nav-cart-circle">
            <ShoppingCart size={36} strokeWidth={2} />
          </span>
        </button>
        <button
          type="button"
          className="nav-item nav-item--active"
          aria-label="Orders"
          onClick={() => navigate('/orders')}
        >
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
