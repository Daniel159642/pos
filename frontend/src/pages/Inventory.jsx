import { useState, useEffect } from 'react'
import Table from '../components/Table'
import EditProductModal from '../components/EditProductModal'

function Inventory() {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterView, setFilterView] = useState('category') // 'category', 'vendor', 'all'
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [sessionToken, setSessionToken] = useState(null)

  useEffect(() => {
    setSessionToken(localStorage.getItem('sessionToken'))
  }, [])

  useEffect(() => {
    loadInventory()
  }, [])

  const loadInventory = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/inventory')
      const result = await response.json()
      // API returns { columns: [...], data: [...] }
      if (result.data) {
        setInventory(result.data)
      }
    } catch (err) {
      setError('Error loading inventory')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleEditProduct = (product) => {
    setEditingProduct(product)
    setIsEditModalOpen(true)
  }

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setEditingProduct(null)
  }

  const handleSaveProduct = () => {
    loadInventory() // Reload inventory after save
  }

  // Get unique categories
  const categories = [...new Set(inventory.map(item => item.category).filter(Boolean))].sort()
  
  // Get unique vendors (from vendor_id or vendor field)
  const vendors = [...new Set(
    inventory
      .map(item => item.vendor_name || item.vendor || (item.vendor_id ? `Vendor ${item.vendor_id}` : null))
      .filter(Boolean)
  )].sort()

  // Filter inventory based on search
  const filteredInventory = inventory.filter(item => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      item.product_name?.toLowerCase().includes(query) ||
      item.sku?.toLowerCase().includes(query) ||
      item.barcode?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query) ||
      (item.vendor_name || item.vendor)?.toLowerCase().includes(query)
    )
  })

  // Get items by category
  const getItemsByCategory = (category) => {
    return filteredInventory.filter(item => item.category === category)
  }

  // Get items by vendor
  const getItemsByVendor = (vendorName) => {
    return filteredInventory.filter(item => 
      (item.vendor_name || item.vendor) === vendorName
    )
  }

  // Handle category click
  const handleCategoryClick = (category) => {
    setSelectedCategory(category)
    setSelectedVendor(null)
  }

  // Handle vendor click
  const handleVendorClick = (vendorName) => {
    setSelectedVendor(vendorName)
    setSelectedCategory(null)
  }

  // Handle filter view change
  const handleFilterChange = (view) => {
    setFilterView(view)
    setSelectedCategory(null)
    setSelectedVendor(null)
  }

  // Render category grid
  const renderCategoryGrid = () => {
    if (selectedCategory) {
      const items = getItemsByCategory(selectedCategory)
      return (
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '20px' 
          }}>
            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ← Back
            </button>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 500 }}>
              {selectedCategory} ({items.length} items)
            </h2>
          </div>
          {items.length > 0 ? (
            <Table 
              columns={['product_name', 'sku', 'barcode', 'product_price', 'current_quantity', 'vendor_name', 'vendor']} 
              data={items}
              onEdit={handleEditProduct}
            />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
              No items found in this category
            </div>
          )}
        </div>
      )
    }

    return (
      <div>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
          gap: '16px',
          marginTop: '20px'
        }}>
          {categories.map(category => {
            const itemCount = getItemsByCategory(category).length
            return (
              <div
                key={category}
                onClick={() => handleCategoryClick(category)}
                style={{
                  padding: '24px',
                  backgroundColor: '#fff',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#4a90e2'
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e0e0e0'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 600, 
                  marginBottom: '8px',
                  color: '#333'
                }}>
                  {category}
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#666' 
                }}>
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </div>
              </div>
            )
          })}
        </div>
        {categories.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
            No categories found
          </div>
        )}
      </div>
    )
  }

  // Render vendor grid
  const renderVendorGrid = () => {
    if (selectedVendor) {
      const items = getItemsByVendor(selectedVendor)
      return (
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '20px' 
          }}>
            <button
              onClick={() => setSelectedVendor(null)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ← Back
            </button>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 500 }}>
              {selectedVendor} ({items.length} items)
            </h2>
          </div>
          {items.length > 0 ? (
            <Table 
              columns={['product_name', 'sku', 'barcode', 'product_price', 'current_quantity', 'category']} 
              data={items}
              onEdit={handleEditProduct}
            />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
              No items found for this vendor
            </div>
          )}
        </div>
      )
    }

    return (
      <div>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
          gap: '16px',
          marginTop: '20px'
        }}>
          {vendors.map(vendor => {
            const itemCount = getItemsByVendor(vendor).length
            return (
              <div
                key={vendor}
                onClick={() => handleVendorClick(vendor)}
                style={{
                  padding: '24px',
                  backgroundColor: '#fff',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#4a90e2'
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e0e0e0'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 600, 
                  marginBottom: '8px',
                  color: '#333'
                }}>
                  {vendor}
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#666' 
                }}>
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </div>
              </div>
            )
          })}
        </div>
        {vendors.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
            No vendors found
          </div>
        )}
      </div>
    )
  }

  // Render all items list
  const renderAllItems = () => {
    if (filteredInventory.length === 0) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
          {searchQuery ? 'No items match your search' : 'No items found'}
        </div>
      )
    }

    return (
      <div style={{ marginTop: '20px' }}>
        <Table 
          columns={['product_name', 'sku', 'barcode', 'product_price', 'current_quantity', 'category', 'vendor_name', 'vendor']} 
          data={filteredInventory}
          onEdit={handleEditProduct}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        {error}
      </div>
    )
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '30px', fontSize: '28px', fontWeight: 500 }}>
        Inventory
      </h1>
      
      <div style={{ display: 'flex', gap: '30px', height: 'calc(100vh - 200px)' }}>
        {/* Left Column - Search */}
        <div style={{ 
          width: '300px', 
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px', 
              fontWeight: 500,
              color: '#333'
            }}>
              Search Inventory
            </label>
            <input
              type="text"
              placeholder="Search by name, SKU, barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Right Column - Grid with Filters */}
        <div style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Filter Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '20px',
            borderBottom: '2px solid #eee',
            paddingBottom: '12px'
          }}>
            <button
              onClick={() => handleFilterChange('category')}
              style={{
                padding: '10px 20px',
                backgroundColor: filterView === 'category' ? '#000' : '#f0f0f0',
                color: filterView === 'category' ? '#fff' : '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              Category
            </button>
            <button
              onClick={() => handleFilterChange('vendor')}
              style={{
                padding: '10px 20px',
                backgroundColor: filterView === 'vendor' ? '#000' : '#f0f0f0',
                color: filterView === 'vendor' ? '#fff' : '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              Vendor
            </button>
            <button
              onClick={() => handleFilterChange('all')}
              style={{
                padding: '10px 20px',
                backgroundColor: filterView === 'all' ? '#000' : '#f0f0f0',
                color: filterView === 'all' ? '#fff' : '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.2s'
              }}
            >
              All
            </button>
          </div>

          {/* Content Area */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto',
            overflowX: 'hidden'
          }}>
            {filterView === 'category' && renderCategoryGrid()}
            {filterView === 'vendor' && renderVendorGrid()}
            {filterView === 'all' && renderAllItems()}
          </div>
        </div>
      </div>

      <EditProductModal
        product={editingProduct}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSave={handleSaveProduct}
        sessionToken={sessionToken}
      />
    </div>
  )
}

export default Inventory
