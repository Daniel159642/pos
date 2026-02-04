import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, ClipboardList, Calendar as CalendarIcon, Package, Plus, Search, ChevronRight, X, ChevronDown } from 'lucide-react'
import api from '../services/api'
import ProfileButton from '../components/ProfileButton'
import './Inventory.css'

const INVENTORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'product', label: 'Products' },
  { id: 'ingredient', label: 'Ingredients' }
]

export default function Inventory() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [allVendors, setAllVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [inventoryFilter, setInventoryFilter] = useState('all')

  // Create menu
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [showCreateProduct, setShowCreateProduct] = useState(false)
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [showCreateVendor, setShowCreateVendor] = useState(false)

  // Edit product
  const [editingProduct, setEditingProduct] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState(null)
  const [editSuccess, setEditSuccess] = useState(false)

  // Create form state
  const [createProductData, setCreateProductData] = useState({
    product_name: '',
    sku: '',
    barcode: '',
    product_price: '',
    product_cost: '',
    current_quantity: '0',
    category: '',
    vendor: '',
    vendor_id: null,
    item_type: 'product',
    unit: ''
  })
  const [createCategoryData, setCreateCategoryData] = useState({ parent_path: '', category_name: '' })
  const [createVendorData, setCreateVendorData] = useState({
    vendor_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: ''
  })
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [createSuccess, setCreateSuccess] = useState(false)

  useEffect(() => {
    loadInventory()
    loadCategories()
    loadVendors()
  }, [inventoryFilter])

  const loadInventory = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (inventoryFilter && inventoryFilter !== 'all') params.set('item_type', inventoryFilter)
      params.set('include_variants', '1')
      const url = params.toString() ? `inventory?${params}` : 'inventory'
      const res = await api.get(url)
      const data = res.data?.data || res.data || []
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      setError('Could not load inventory')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const res = await api.get('categories')
      const data = res.data?.data || res.data || []
      setAllCategories(Array.isArray(data) ? data : [])
    } catch {
      setAllCategories([])
    }
  }

  const loadVendors = async () => {
    try {
      const res = await api.get('vendors')
      const data = res.data?.data || res.data || []
      setAllVendors(Array.isArray(data) ? data : [])
    } catch {
      setAllVendors([])
    }
  }

  const filteredItems = searchTerm.trim()
    ? items.filter((item) => {
        const term = searchTerm.toLowerCase().trim()
        const name = (item.product_name || '').toLowerCase()
        const sku = (item.sku || '').toLowerCase()
        const cat = (item.category || '').toLowerCase()
        const barcode = (item.barcode || '').toString().toLowerCase()
        return name.includes(term) || sku.includes(term) || cat.includes(term) || barcode.includes(term)
      })
    : items

  const categoryPaths = allCategories
    .map((c) => c.category_path || c.category_name || c.name)
    .filter(Boolean)
    .sort()

  const openCreate = (which) => {
    setShowCreateMenu(false)
    setCreateError(null)
    setCreateSuccess(false)
    if (which === 'product') {
      setCreateProductData({
        product_name: '',
        sku: '',
        barcode: '',
        product_price: '',
        product_cost: '',
        current_quantity: '0',
        category: '',
        vendor: '',
        vendor_id: null,
        item_type: 'product',
        unit: ''
      })
      setShowCreateProduct(true)
    } else if (which === 'category') {
      setCreateCategoryData({ parent_path: '', category_name: '' })
      setShowCreateCategory(true)
    } else if (which === 'vendor') {
      setCreateVendorData({
        vendor_name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: ''
      })
      setShowCreateVendor(true)
    }
  }

  const handleCreateProduct = async (e) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    setCreateSuccess(false)
    try {
      const payload = {
        product_name: createProductData.product_name,
        sku: createProductData.sku,
        barcode: createProductData.barcode || '',
        product_price: createProductData.item_type === 'ingredient' ? 0 : parseFloat(createProductData.product_price) || 0,
        product_cost: parseFloat(createProductData.product_cost) || 0,
        current_quantity: parseInt(createProductData.current_quantity, 10) || 0,
        category: createProductData.category || '',
        vendor: createProductData.vendor || '',
        item_type: createProductData.item_type || 'product'
      }
      if (createProductData.unit) payload.unit = createProductData.unit
      if (createProductData.vendor_id) payload.vendor_id = createProductData.vendor_id
      await api.post('inventory', payload)
      setCreateSuccess(true)
      setCreateProductData({
        product_name: '',
        sku: '',
        barcode: '',
        product_price: '',
        product_cost: '',
        current_quantity: '0',
        category: '',
        vendor: '',
        vendor_id: null,
        item_type: 'product',
        unit: ''
      })
      loadInventory()
      setTimeout(() => {
        setShowCreateProduct(false)
        setCreateSuccess(false)
      }, 1200)
    } catch (err) {
      setCreateError(err.response?.data?.message || err.message || 'Failed to create product')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    setCreateSuccess(false)
    try {
      const path = createCategoryData.parent_path
        ? `${createCategoryData.parent_path} > ${createCategoryData.category_name}`
        : createCategoryData.category_name
      await api.post('categories', { category_name: path })
      setCreateSuccess(true)
      setCreateCategoryData({ parent_path: '', category_name: '' })
      loadCategories()
      loadInventory()
      setTimeout(() => {
        setShowCreateCategory(false)
        setCreateSuccess(false)
      }, 1200)
    } catch (err) {
      setCreateError(err.response?.data?.message || err.message || 'Failed to create category')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleCreateVendor = async (e) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    setCreateSuccess(false)
    try {
      await api.post('vendors', createVendorData)
      setCreateSuccess(true)
      setCreateVendorData({
        vendor_name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: ''
      })
      loadVendors()
      loadInventory()
      setTimeout(() => {
        setShowCreateVendor(false)
        setCreateSuccess(false)
      }, 1200)
    } catch (err) {
      setCreateError(err.response?.data?.message || err.message || 'Failed to create vendor')
    } finally {
      setCreateLoading(false)
    }
  }

  const openEdit = (item) => {
    setEditingProduct(item)
    setEditFormData({
      product_name: item.product_name || '',
      sku: item.sku || '',
      barcode: item.barcode || '',
      product_price: item.product_price ?? '',
      product_cost: item.product_cost ?? '',
      current_quantity: item.current_quantity ?? '',
      category: item.category || '',
      vendor: item.vendor || '',
      vendor_id: item.vendor_id || null,
      photo: item.photo || ''
    })
    setEditError(null)
    setEditSuccess(false)
  }

  const closeEdit = () => {
    setEditingProduct(null)
    setEditFormData({})
    setEditError(null)
    setEditSuccess(false)
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditFormData((prev) => ({
      ...prev,
      [name]:
        name === 'product_price' || name === 'product_cost' || name === 'current_quantity' || name === 'vendor_id'
          ? (value === '' ? '' : parseFloat(value))
          : value
    }))
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editingProduct?.product_id) return
    setEditLoading(true)
    setEditError(null)
    setEditSuccess(false)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const payload = {
        ...editFormData,
        session_token: sessionToken
      }
      await api.put(`inventory/${editingProduct.product_id}`, payload)
      setEditSuccess(true)
      loadInventory()
      setTimeout(() => {
        closeEdit()
      }, 1000)
    } catch (err) {
      setEditError(err.response?.data?.message || err.message || 'Failed to update product')
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <ProfileButton />
        <h1 className="inventory-title">Inventory</h1>
      </div>

      {/* Type filter: All | Products | Ingredients */}
      <div className="inventory-filter-row">
        {INVENTORY_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`inventory-filter-btn ${inventoryFilter === f.id ? 'inventory-filter-btn--active' : ''}`}
            onClick={() => setInventoryFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Create dropdown */}
      <div className="inventory-create-wrap">
        <div className="inventory-create-trigger-wrap">
          <button
            type="button"
            className={`inventory-create-btn ${showCreateMenu ? 'inventory-create-btn--open' : ''}`}
            onClick={() => setShowCreateMenu((v) => !v)}
            aria-expanded={showCreateMenu}
          >
            <Plus size={18} />
            Create
            <ChevronDown size={16} />
          </button>
          {showCreateMenu && (
            <>
              <div
                className="inventory-create-backdrop"
                onClick={() => setShowCreateMenu(false)}
                aria-hidden
              />
              <div className="inventory-create-menu">
                <button type="button" className="inventory-create-menu-item" onClick={() => openCreate('product')}>
                  <Plus size={18} />
                  New Product
                </button>
                <button type="button" className="inventory-create-menu-item" onClick={() => openCreate('category')}>
                  <Plus size={18} />
                  New Category
                </button>
                <button type="button" className="inventory-create-menu-item" onClick={() => openCreate('vendor')}>
                  <Plus size={18} />
                  New Vendor
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="inventory-search-row">
        <Search size={20} className="inventory-search-icon" />
        <input
          type="search"
          placeholder="Search by name, SKU, category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="inventory-search-input"
        />
      </div>

      {error && <div className="inventory-error">{error}</div>}

      <div className="inventory-list-wrap">
        {loading ? (
          <p className="inventory-muted">Loading…</p>
        ) : filteredItems.length === 0 ? (
          <p className="inventory-muted">{searchTerm.trim() ? 'No items match.' : 'No inventory yet.'}</p>
        ) : (
          <ul className="inventory-list">
            {filteredItems.map((item) => (
              <li
                key={item.product_id}
                className="inventory-row"
                onClick={() => openEdit(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openEdit(item)
                  }
                }}
              >
                <div className="inventory-row-main">
                  <span className="inventory-name">{item.product_name || '—'}</span>
                  <span className="inventory-sku">{item.sku ? `SKU: ${item.sku}` : ''}</span>
                  {item.category && <span className="inventory-category">{item.category}</span>}
                </div>
                <div className="inventory-row-meta">
                  <span className="inventory-price">${(parseFloat(item.product_price) || 0).toFixed(2)}</span>
                  <span className="inventory-qty">Qty: {parseInt(item.current_quantity, 10) ?? 0}</span>
                </div>
                <ChevronRight size={20} className="inventory-chevron" />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create Product Modal */}
      {showCreateProduct && (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <div className="inventory-modal-header">
              <h2 className="inventory-modal-title">New Product</h2>
              <button type="button" className="inventory-modal-close" onClick={() => setShowCreateProduct(false)} aria-label="Close">
                <X size={24} />
              </button>
            </div>
            {createError && <div className="inventory-form-error">{createError}</div>}
            {createSuccess && <div className="inventory-form-success">Product created.</div>}
            <form onSubmit={handleCreateProduct} className="inventory-form">
              <label className="inventory-form-label">Product name *</label>
              <input
                type="text"
                className="inventory-form-input"
                value={createProductData.product_name}
                onChange={(e) => setCreateProductData((p) => ({ ...p, product_name: e.target.value }))}
                required
              />
              <label className="inventory-form-label">Type</label>
              <select
                className="inventory-form-input"
                value={createProductData.item_type}
                onChange={(e) => setCreateProductData((p) => ({ ...p, item_type: e.target.value }))}
              >
                <option value="product">Product</option>
                <option value="ingredient">Ingredient</option>
              </select>
              {createProductData.item_type === 'ingredient' && (
                <>
                  <label className="inventory-form-label">Unit</label>
                  <input
                    type="text"
                    className="inventory-form-input"
                    value={createProductData.unit}
                    onChange={(e) => setCreateProductData((p) => ({ ...p, unit: e.target.value }))}
                    placeholder="e.g. oz, lb"
                  />
                </>
              )}
              <label className="inventory-form-label">SKU *</label>
              <input
                type="text"
                className="inventory-form-input"
                value={createProductData.sku}
                onChange={(e) => setCreateProductData((p) => ({ ...p, sku: e.target.value }))}
                required
              />
              <label className="inventory-form-label">Barcode</label>
              <input
                type="text"
                className="inventory-form-input"
                value={createProductData.barcode}
                onChange={(e) => setCreateProductData((p) => ({ ...p, barcode: e.target.value }))}
              />
              <div className="inventory-form-row">
                <div className="inventory-form-group">
                  <label className="inventory-form-label">Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="inventory-form-input"
                    value={createProductData.product_price}
                    onChange={(e) => setCreateProductData((p) => ({ ...p, product_price: e.target.value }))}
                    required={createProductData.item_type === 'product'}
                  />
                </div>
                <div className="inventory-form-group">
                  <label className="inventory-form-label">Cost *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="inventory-form-input"
                    value={createProductData.product_cost}
                    onChange={(e) => setCreateProductData((p) => ({ ...p, product_cost: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <label className="inventory-form-label">Quantity</label>
              <input
                type="number"
                min="0"
                className="inventory-form-input"
                value={createProductData.current_quantity}
                onChange={(e) => setCreateProductData((p) => ({ ...p, current_quantity: e.target.value }))}
              />
              <label className="inventory-form-label">Category</label>
              <input
                type="text"
                className="inventory-form-input"
                value={createProductData.category}
                onChange={(e) => setCreateProductData((p) => ({ ...p, category: e.target.value }))}
              />
              <label className="inventory-form-label">Vendor</label>
              <input
                type="text"
                className="inventory-form-input"
                value={createProductData.vendor}
                onChange={(e) => setCreateProductData((p) => ({ ...p, vendor: e.target.value }))}
              />
              <div className="inventory-form-actions">
                <button type="button" className="inventory-btn inventory-btn--secondary" onClick={() => setShowCreateProduct(false)}>
                  Cancel
                </button>
                <button type="submit" className="inventory-btn inventory-btn--primary" disabled={createLoading}>
                  {createLoading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {showCreateCategory && (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <div className="inventory-modal-header">
              <h2 className="inventory-modal-title">New Category</h2>
              <button type="button" className="inventory-modal-close" onClick={() => setShowCreateCategory(false)} aria-label="Close">
                <X size={24} />
              </button>
            </div>
            {createError && <div className="inventory-form-error">{createError}</div>}
            {createSuccess && <div className="inventory-form-success">Category created.</div>}
            <form onSubmit={handleCreateCategory} className="inventory-form">
              <label className="inventory-form-label">Parent category</label>
              <select
                className="inventory-form-input"
                value={createCategoryData.parent_path}
                onChange={(e) => setCreateCategoryData((p) => ({ ...p, parent_path: e.target.value }))}
              >
                <option value="">Top level</option>
                {categoryPaths.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
              <label className="inventory-form-label">Category name *</label>
              <input
                type="text"
                className="inventory-form-input"
                value={createCategoryData.category_name}
                onChange={(e) => setCreateCategoryData((p) => ({ ...p, category_name: e.target.value }))}
                placeholder={createCategoryData.parent_path ? 'e.g. Fruit' : 'e.g. Food & Beverage'}
                required
              />
              <div className="inventory-form-actions">
                <button type="button" className="inventory-btn inventory-btn--secondary" onClick={() => setShowCreateCategory(false)}>
                  Cancel
                </button>
                <button type="submit" className="inventory-btn inventory-btn--primary" disabled={createLoading}>
                  {createLoading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Vendor Modal */}
      {showCreateVendor && (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <div className="inventory-modal-header">
              <h2 className="inventory-modal-title">New Vendor</h2>
              <button type="button" className="inventory-modal-close" onClick={() => setShowCreateVendor(false)} aria-label="Close">
                <X size={24} />
              </button>
            </div>
            {createError && <div className="inventory-form-error">{createError}</div>}
            {createSuccess && <div className="inventory-form-success">Vendor created.</div>}
            <form onSubmit={handleCreateVendor} className="inventory-form">
              <label className="inventory-form-label">Vendor name *</label>
              <input
                type="text"
                className="inventory-form-input"
                value={createVendorData.vendor_name}
                onChange={(e) => setCreateVendorData((p) => ({ ...p, vendor_name: e.target.value }))}
                required
              />
              <label className="inventory-form-label">Contact person</label>
              <input
                type="text"
                className="inventory-form-input"
                value={createVendorData.contact_person}
                onChange={(e) => setCreateVendorData((p) => ({ ...p, contact_person: e.target.value }))}
              />
              <label className="inventory-form-label">Email</label>
              <input
                type="email"
                className="inventory-form-input"
                value={createVendorData.email}
                onChange={(e) => setCreateVendorData((p) => ({ ...p, email: e.target.value }))}
              />
              <label className="inventory-form-label">Phone</label>
              <input
                type="tel"
                className="inventory-form-input"
                value={createVendorData.phone}
                onChange={(e) => setCreateVendorData((p) => ({ ...p, phone: e.target.value }))}
              />
              <label className="inventory-form-label">Address</label>
              <textarea
                className="inventory-form-input inventory-form-textarea"
                value={createVendorData.address}
                onChange={(e) => setCreateVendorData((p) => ({ ...p, address: e.target.value }))}
                rows={3}
              />
              <div className="inventory-form-actions">
                <button type="button" className="inventory-btn inventory-btn--secondary" onClick={() => setShowCreateVendor(false)}>
                  Cancel
                </button>
                <button type="submit" className="inventory-btn inventory-btn--primary" disabled={createLoading}>
                  {createLoading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="inventory-modal-overlay">
          <div className="inventory-modal">
            <div className="inventory-modal-header">
              <h2 className="inventory-modal-title">Edit Product</h2>
              <button type="button" className="inventory-modal-close" onClick={closeEdit} aria-label="Close">
                <X size={24} />
              </button>
            </div>
            {editError && <div className="inventory-form-error">{editError}</div>}
            {editSuccess && <div className="inventory-form-success">Product updated.</div>}
            <form onSubmit={handleEditSubmit} className="inventory-form">
              <label className="inventory-form-label">Product name *</label>
              <input
                type="text"
                name="product_name"
                className="inventory-form-input"
                value={editFormData.product_name ?? ''}
                onChange={handleEditChange}
                required
              />
              <label className="inventory-form-label">SKU *</label>
              <input
                type="text"
                name="sku"
                className="inventory-form-input"
                value={editFormData.sku ?? ''}
                onChange={handleEditChange}
                required
              />
              <label className="inventory-form-label">Barcode</label>
              <input
                type="text"
                name="barcode"
                className="inventory-form-input"
                value={editFormData.barcode ?? ''}
                onChange={handleEditChange}
              />
              <label className="inventory-form-label">Category</label>
              <input
                type="text"
                name="category"
                className="inventory-form-input"
                value={editFormData.category ?? ''}
                onChange={handleEditChange}
              />
              <div className="inventory-form-row">
                <div className="inventory-form-group">
                  <label className="inventory-form-label">Price *</label>
                  <input
                    type="number"
                    name="product_price"
                    step="0.01"
                    min="0"
                    className="inventory-form-input"
                    value={editFormData.product_price ?? ''}
                    onChange={handleEditChange}
                    required
                  />
                </div>
                <div className="inventory-form-group">
                  <label className="inventory-form-label">Cost *</label>
                  <input
                    type="number"
                    name="product_cost"
                    step="0.01"
                    min="0"
                    className="inventory-form-input"
                    value={editFormData.product_cost ?? ''}
                    onChange={handleEditChange}
                    required
                  />
                </div>
              </div>
              <label className="inventory-form-label">Quantity *</label>
              <input
                type="number"
                name="current_quantity"
                min="0"
                className="inventory-form-input"
                value={editFormData.current_quantity ?? ''}
                onChange={handleEditChange}
                required
              />
              <label className="inventory-form-label">Vendor</label>
              <input
                type="text"
                name="vendor"
                className="inventory-form-input"
                value={editFormData.vendor ?? ''}
                onChange={handleEditChange}
              />
              <label className="inventory-form-label">Photo URL</label>
              <input
                type="text"
                name="photo"
                className="inventory-form-input"
                value={editFormData.photo ?? ''}
                onChange={handleEditChange}
              />
              <div className="inventory-form-actions">
                <button type="button" className="inventory-btn inventory-btn--secondary" onClick={closeEdit}>
                  Cancel
                </button>
                <button type="submit" className="inventory-btn inventory-btn--primary" disabled={editLoading}>
                  {editLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <button type="button" className="nav-item nav-item--cart" aria-label="Cart" onClick={() => navigate('/checkout')}>
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
        <button type="button" className="nav-item nav-item--active" aria-label="Inventory" onClick={() => navigate('/inventory')}>
          <Package size={36} strokeWidth={2} />
        </button>
        <button type="button" className="nav-item" aria-label="Add">
          <Plus size={36} strokeWidth={2} />
        </button>
      </nav>
    </div>
  )
}
