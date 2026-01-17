import { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import Table from '../components/Table'

function Inventory() {
  const { themeColor, themeMode } = useTheme()
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  const [inventory, setInventory] = useState([])
  const [allVendors, setAllVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterView, setFilterView] = useState('category') // 'category', 'vendor', 'all'
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState(null)
  const [editSuccess, setEditSuccess] = useState(false)
  const [sessionToken, setSessionToken] = useState(null)
  
  // Create forms state
  const [showCreateProduct, setShowCreateProduct] = useState(false)
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [showCreateVendor, setShowCreateVendor] = useState(false)
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
    photo: null
  })
  const [photoPreview, setPhotoPreview] = useState(null)
  const [createCategoryData, setCreateCategoryData] = useState({ category_name: '' })
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
    setSessionToken(localStorage.getItem('sessionToken'))
  }, [])

  useEffect(() => {
    loadInventory()
    loadVendors()
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

  const loadVendors = async () => {
    try {
      const response = await fetch('/api/vendors')
      const result = await response.json()
      if (result.data) {
        setAllVendors(result.data)
      }
    } catch (err) {
      console.error('Error loading vendors:', err)
    }
  }

  const handleEditProduct = (product) => {
    setEditingProduct(product)
    setEditFormData({
      product_name: product.product_name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      product_price: product.product_price || 0,
      product_cost: product.product_cost || 0,
      current_quantity: product.current_quantity || 0,
      category: product.category || '',
      vendor: product.vendor || '',
      vendor_id: product.vendor_id || null,
      photo: product.photo || ''
    })
    setEditError(null)
    setEditSuccess(false)
  }

  const handleCloseEdit = () => {
    setEditingProduct(null)
    setEditFormData({})
    setEditError(null)
    setEditSuccess(false)
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: name === 'product_price' || name === 'product_cost' || name === 'current_quantity' || name === 'vendor_id'
        ? (value === '' ? null : parseFloat(value))
        : value
    }))
  }

  const handleSaveProduct = async (e) => {
    if (e) e.preventDefault()
    setEditLoading(true)
    setEditError(null)
    setEditSuccess(false)

    try {
      const updateData = {
        ...editFormData,
        session_token: sessionToken
      }

      const response = await fetch(`/api/inventory/${editingProduct.product_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update product')
      }

      setEditSuccess(true)
      setTimeout(() => {
        loadInventory() // Reload inventory after save
        handleCloseEdit()
      }, 1000)
    } catch (err) {
      setEditError(err.message || 'An error occurred while updating the product')
    } finally {
      setEditLoading(false)
    }
  }

  const handleCreateProduct = async (e) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    setCreateSuccess(false)

    try {
      // Create FormData to support file uploads
      const formData = new FormData()
      formData.append('product_name', createProductData.product_name)
      formData.append('sku', createProductData.sku)
      formData.append('barcode', createProductData.barcode || '')
      formData.append('product_price', createProductData.product_price)
      formData.append('product_cost', createProductData.product_cost)
      formData.append('current_quantity', createProductData.current_quantity || '0')
      formData.append('category', createProductData.category || '')
      formData.append('vendor', createProductData.vendor || '')
      if (createProductData.vendor_id) {
        formData.append('vendor_id', createProductData.vendor_id)
      }
      if (createProductData.photo) {
        formData.append('photo', createProductData.photo)
      }

      const response = await fetch('/api/inventory', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create product')
      }

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
        photo: null
      })
      setPhotoPreview(null)
      setTimeout(() => {
        loadInventory()
        setShowCreateProduct(false)
        setCreateSuccess(false)
      }, 1000)
    } catch (err) {
      setCreateError(err.message || 'An error occurred while creating the product')
    } finally {
      setCreateLoading(false)
    }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setCreateProductData({ ...createProductData, photo: file })
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    } else {
      setCreateProductData({ ...createProductData, photo: null })
      setPhotoPreview(null)
    }
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    setCreateSuccess(false)

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category_name: createCategoryData.category_name })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create category')
      }

      setCreateSuccess(true)
      setCreateCategoryData({ category_name: '' })
      setTimeout(() => {
        loadInventory()
        setShowCreateCategory(false)
        setCreateSuccess(false)
      }, 1000)
    } catch (err) {
      setCreateError(err.message || 'An error occurred while creating the category')
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
      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createVendorData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create vendor')
      }

      setCreateSuccess(true)
      setCreateVendorData({
        vendor_name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: ''
      })
      setTimeout(() => {
        loadVendors()
        setShowCreateVendor(false)
        setCreateSuccess(false)
      }, 1000)
    } catch (err) {
      setCreateError(err.message || 'An error occurred while creating the vendor')
    } finally {
      setCreateLoading(false)
    }
  }

  // Get unique categories
  const categories = [...new Set(inventory.map(item => item.category).filter(Boolean))].sort()
  
  // Get all vendors from vendors table (not just vendors with products)
  const vendors = allVendors.map(vendor => vendor.vendor_name).sort()

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

  // Filter inventory based on search
  const filteredInventory = inventory.filter(item => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    
    // Special handling for semantic searches (fruit, vegetable, etc.)
    const semanticTypes = {
      'fruit': 'fruit',
      'fruits': 'fruit',
      'vegetable': 'vegetable',
      'vegetables': 'vegetable',
      'dairy': 'dairy',
      'produce': null // Produce is a category, not a type
    }
    
    const expectedType = semanticTypes[query]
    
    const nameMatch = fuzzyMatch(item.product_name, searchQuery)
    const skuMatch = fuzzyMatch(item.sku, searchQuery)
    const barcodeMatch = fuzzyMatch(item.barcode, searchQuery)
    const categoryMatch = fuzzyMatch(item.category, searchQuery)
    const vendorMatch = fuzzyMatch(item.vendor_name || item.vendor, searchQuery)
    
    // Search in metadata keywords
    let keywordMatch = false
    if (item.keywords) {
      try {
        const keywords = typeof item.keywords === 'string' 
          ? JSON.parse(item.keywords) 
          : item.keywords
        if (Array.isArray(keywords)) {
          keywordMatch = keywords.some(kw => 
            kw && fuzzyMatch(kw, searchQuery)
          )
        }
      } catch (e) {
        // If not JSON, treat as string
        keywordMatch = fuzzyMatch(item.keywords, searchQuery)
      }
    }
    
    // Search in metadata tags
    let tagMatch = false
    if (item.tags) {
      try {
        const tags = typeof item.tags === 'string' 
          ? JSON.parse(item.tags) 
          : item.tags
        if (Array.isArray(tags)) {
          tagMatch = tags.some(tag => 
            tag && fuzzyMatch(tag, searchQuery)
          )
        }
      } catch (e) {
        // If not JSON, treat as string
        tagMatch = fuzzyMatch(item.tags, searchQuery)
      }
    }
    
    // Search in metadata attributes (type, texture, taste, etc.)
    let attributeMatch = false
    let typeMatch = false
    if (item.attributes) {
      try {
        const attrs = typeof item.attributes === 'string' 
          ? JSON.parse(item.attributes) 
          : item.attributes
        if (typeof attrs === 'object' && attrs !== null) {
          // Check all attribute values for general match
          attributeMatch = Object.values(attrs).some(val => {
            if (typeof val === 'string') {
              return fuzzyMatch(val, searchQuery)
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
        attributeMatch = fuzzyMatch(item.attributes, searchQuery)
      }
    }
    
    // If searching for a specific type (fruit, vegetable), require type match
    if (expectedType !== null && expectedType !== undefined) {
      return typeMatch || nameMatch || skuMatch
    }
    
    // Otherwise, match on any field
    return nameMatch || skuMatch || barcodeMatch || categoryMatch || vendorMatch || keywordMatch || tagMatch || attributeMatch
  })

  // Get items by category
  const getItemsByCategory = (category) => {
    return filteredInventory.filter(item => item.category === category)
  }

  // Get items by vendor
  const getItemsByVendor = (vendorName) => {
    // Find vendor by name to get vendor_id
    const vendor = allVendors.find(v => v.vendor_name === vendorName)
    if (vendor) {
      return filteredInventory.filter(item => 
        item.vendor_id === vendor.vendor_id || 
        (item.vendor_name || item.vendor) === vendorName
      )
    }
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
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f0f0f0',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            >
              ← Back
            </button>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              {selectedCategory} ({items.length} items)
            </h2>
          </div>
          {items.length > 0 ? (
            <Table 
              columns={['photo', 'product_name', 'sku', 'barcode', 'product_price', 'current_quantity', 'vendor_name', 'vendor']} 
              data={items}
              onEdit={handleEditProduct}
            />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
              No items found in this category
            </div>
          )}
        </div>
      )
    }

    return (
      <div>
        <div style={{ 
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginTop: '20px'
        }}>
          {categories.map(category => {
            const itemCount = getItemsByCategory(category).length
            return (
              <button
                key={category}
                onClick={() => handleCategoryClick(category)}
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
            )
          })}
        </div>
        {categories.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
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
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f0f0f0',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            >
              ← Back
            </button>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              {selectedVendor} ({items.length} items)
            </h2>
          </div>
          {items.length > 0 ? (
            <Table 
              columns={['photo', 'product_name', 'sku', 'barcode', 'product_price', 'current_quantity', 'category']} 
              data={items}
              onEdit={handleEditProduct}
            />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
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
                  backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                  border: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #e0e0e0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = isDarkMode ? `rgba(${themeColorRgb}, 0.5)` : '#4a90e2'
                  e.currentTarget.style.boxShadow = isDarkMode ? `0 4px 8px rgba(${themeColorRgb}, 0.2)` : '0 4px 8px rgba(0,0,0,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#e0e0e0'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 600, 
                  marginBottom: '8px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  {vendor}
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' 
                }}>
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </div>
              </div>
            )
          })}
        </div>
        {vendors.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
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
        <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
          {searchQuery ? 'No items match your search' : 'No items found'}
        </div>
      )
    }

    return (
      <div style={{ marginTop: '20px' }}>
        <Table 
          columns={['photo', 'product_name', 'sku', 'barcode', 'product_price', 'current_quantity', 'category', 'vendor_name', 'vendor']} 
          data={filteredInventory}
          onEdit={handleEditProduct}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
        {error}
      </div>
    )
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header with Create Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setShowCreateProduct(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.2)`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.9)`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
          }}
        >
          + Create Product
        </button>
        <button
          onClick={() => setShowCreateCategory(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.2)`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.9)`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
          }}
        >
          + Create Category
        </button>
        <button
          onClick={() => setShowCreateVendor(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.2)`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.9)`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
          }}
        >
          + Create Vendor
        </button>
      </div>

      <div style={{ display: 'flex', gap: '30px', height: 'calc(100vh - 200px)' }}>
        {/* Left Column - Search */}
        <div style={{ 
          width: '300px', 
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Search by name, SKU, barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 0',
                border: 'none',
                borderBottom: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #ddd',
                borderRadius: '0',
                backgroundColor: 'transparent',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontFamily: '"Product Sans", sans-serif',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            />
          </div>

          {/* Create Product Form */}
          {showCreateProduct && (
            <div style={{
              backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
              maxHeight: 'calc(100vh - 300px)',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                  Create New Product
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateProduct(false)
                    setCreateError(null)
                    setCreateSuccess(false)
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
                      photo: null
                    })
                    setPhotoPreview(null)
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                    cursor: 'pointer',
                    fontSize: '20px',
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>

              {createError && (
                <div style={{
                  padding: '8px',
                  backgroundColor: isDarkMode ? 'rgba(198, 40, 40, 0.2)' : '#fee',
                  border: isDarkMode ? '1px solid rgba(198, 40, 40, 0.4)' : '1px solid #fcc',
                  borderRadius: '4px',
                  color: isDarkMode ? '#ef5350' : '#c33',
                  marginBottom: '12px',
                  fontSize: '12px'
                }}>
                  {createError}
                </div>
              )}

              {createSuccess && (
                <div style={{
                  padding: '8px',
                  backgroundColor: isDarkMode ? 'rgba(46, 125, 50, 0.2)' : '#efe',
                  border: isDarkMode ? '1px solid rgba(46, 125, 50, 0.4)' : '1px solid #cfc',
                  borderRadius: '4px',
                  color: isDarkMode ? '#81c784' : '#3c3',
                  marginBottom: '12px',
                  fontSize: '12px'
                }}>
                  Product created successfully!
                </div>
              )}

              <form onSubmit={handleCreateProduct}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={createProductData.product_name}
                      onChange={(e) => setCreateProductData({ ...createProductData, product_name: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      SKU *
                    </label>
                    <input
                      type="text"
                      value={createProductData.sku}
                      onChange={(e) => setCreateProductData({ ...createProductData, sku: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Barcode
                    </label>
                    <input
                      type="text"
                      value={createProductData.barcode}
                      onChange={(e) => setCreateProductData({ ...createProductData, barcode: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                        Price *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={createProductData.product_price}
                        onChange={(e) => setCreateProductData({ ...createProductData, product_price: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                        Cost *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={createProductData.product_cost}
                        onChange={(e) => setCreateProductData({ ...createProductData, product_cost: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={createProductData.current_quantity}
                      onChange={(e) => setCreateProductData({ ...createProductData, current_quantity: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Category
                    </label>
                    <input
                      type="text"
                      value={createProductData.category}
                      onChange={(e) => setCreateProductData({ ...createProductData, category: e.target.value })}
                      placeholder="e.g., Electronics &gt; Phones"
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Vendor
                    </label>
                    <select
                      value={createProductData.vendor || ''}
                      onChange={(e) => {
                        const vendor = allVendors.find(v => v.vendor_name === e.target.value)
                        setCreateProductData({ 
                          ...createProductData, 
                          vendor: e.target.value,
                          vendor_id: vendor ? vendor.vendor_id : null
                        })
                      }}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="">Select a vendor (optional)</option>
                      {allVendors.map(vendor => (
                        <option key={vendor.vendor_id} value={vendor.vendor_name}>
                          {vendor.vendor_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Product Photo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    />
                    {photoPreview && (
                      <div style={{ marginTop: '8px' }}>
                        <img
                          src={photoPreview}
                          alt="Preview"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '120px',
                            borderRadius: '4px',
                            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd'
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateProduct(false)
                        setCreateError(null)
                        setCreateSuccess(false)
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
                          photo: null
                        })
                        setPhotoPreview(null)
                      }}
                      disabled={createLoading}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f0f0f0',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: createLoading ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: createLoading ? '#ccc' : `rgba(${themeColorRgb}, 0.7)`,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: createLoading ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 500
                      }}
                    >
                      {createLoading ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Create Category Form */}
          {showCreateCategory && (
            <div style={{
              backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                  Create New Category
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateCategory(false)
                    setCreateError(null)
                    setCreateSuccess(false)
                    setCreateCategoryData({ category_name: '' })
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                    cursor: 'pointer',
                    fontSize: '20px',
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>

              {createError && (
                <div style={{
                  padding: '8px',
                  backgroundColor: isDarkMode ? 'rgba(198, 40, 40, 0.2)' : '#fee',
                  border: isDarkMode ? '1px solid rgba(198, 40, 40, 0.4)' : '1px solid #fcc',
                  borderRadius: '4px',
                  color: isDarkMode ? '#ef5350' : '#c33',
                  marginBottom: '12px',
                  fontSize: '12px'
                }}>
                  {createError}
                </div>
              )}

              {createSuccess && (
                <div style={{
                  padding: '8px',
                  backgroundColor: isDarkMode ? 'rgba(46, 125, 50, 0.2)' : '#efe',
                  border: isDarkMode ? '1px solid rgba(46, 125, 50, 0.4)' : '1px solid #cfc',
                  borderRadius: '4px',
                  color: isDarkMode ? '#81c784' : '#3c3',
                  marginBottom: '12px',
                  fontSize: '12px'
                }}>
                  Category created successfully!
                </div>
              )}

              <form onSubmit={handleCreateCategory}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Category Name *
                    </label>
                    <input
                      type="text"
                      value={createCategoryData.category_name}
                      onChange={(e) => setCreateCategoryData({ category_name: e.target.value })}
                      placeholder="e.g., Electronics &gt; Phones or just Electronics"
                      required
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    />
                    <p style={{ marginTop: '6px', fontSize: '11px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>
                      Use &quot;&gt;&quot; to create subcategories (e.g., &quot;Electronics &gt; Phones&quot;)
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateCategory(false)
                        setCreateError(null)
                        setCreateSuccess(false)
                        setCreateCategoryData({ category_name: '' })
                      }}
                      disabled={createLoading}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f0f0f0',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: createLoading ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: createLoading ? '#ccc' : `rgba(${themeColorRgb}, 0.7)`,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: createLoading ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 500
                      }}
                    >
                      {createLoading ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Create Vendor Form */}
          {showCreateVendor && (
            <div style={{
              backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
              maxHeight: 'calc(100vh - 300px)',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                  Create New Vendor
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateVendor(false)
                    setCreateError(null)
                    setCreateSuccess(false)
                    setCreateVendorData({
                      vendor_name: '',
                      contact_person: '',
                      email: '',
                      phone: '',
                      address: ''
                    })
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                    cursor: 'pointer',
                    fontSize: '20px',
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>

              {createError && (
                <div style={{
                  padding: '8px',
                  backgroundColor: isDarkMode ? 'rgba(198, 40, 40, 0.2)' : '#fee',
                  border: isDarkMode ? '1px solid rgba(198, 40, 40, 0.4)' : '1px solid #fcc',
                  borderRadius: '4px',
                  color: isDarkMode ? '#ef5350' : '#c33',
                  marginBottom: '12px',
                  fontSize: '12px'
                }}>
                  {createError}
                </div>
              )}

              {createSuccess && (
                <div style={{
                  padding: '8px',
                  backgroundColor: isDarkMode ? 'rgba(46, 125, 50, 0.2)' : '#efe',
                  border: isDarkMode ? '1px solid rgba(46, 125, 50, 0.4)' : '1px solid #cfc',
                  borderRadius: '4px',
                  color: isDarkMode ? '#81c784' : '#3c3',
                  marginBottom: '12px',
                  fontSize: '12px'
                }}>
                  Vendor created successfully!
                </div>
              )}

              <form onSubmit={handleCreateVendor}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Vendor Name *
                    </label>
                    <input
                      type="text"
                      value={createVendorData.vendor_name}
                      onChange={(e) => setCreateVendorData({ ...createVendorData, vendor_name: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={createVendorData.contact_person}
                      onChange={(e) => setCreateVendorData({ ...createVendorData, contact_person: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={createVendorData.email}
                      onChange={(e) => setCreateVendorData({ ...createVendorData, email: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={createVendorData.phone}
                      onChange={(e) => setCreateVendorData({ ...createVendorData, phone: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Address
                    </label>
                    <textarea
                      value={createVendorData.address}
                      onChange={(e) => setCreateVendorData({ ...createVendorData, address: e.target.value })}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateVendor(false)
                        setCreateError(null)
                        setCreateSuccess(false)
                        setCreateVendorData({
                          vendor_name: '',
                          contact_person: '',
                          email: '',
                          phone: '',
                          address: ''
                        })
                      }}
                      disabled={createLoading}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f0f0f0',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: createLoading ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: createLoading ? '#ccc' : `rgba(${themeColorRgb}, 0.7)`,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: createLoading ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 500
                      }}
                    >
                      {createLoading ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Edit Product Form */}
          {editingProduct && (
            <div style={{
              backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '20px'
            }}>
              {editError && (
                <div style={{
                  padding: '8px',
                  backgroundColor: isDarkMode ? 'rgba(198, 40, 40, 0.2)' : '#fee',
                  border: isDarkMode ? '1px solid rgba(198, 40, 40, 0.4)' : '1px solid #fcc',
                  borderRadius: '4px',
                  color: isDarkMode ? '#ef5350' : '#c33',
                  marginBottom: '12px',
                  fontSize: '12px'
                }}>
                  {editError}
                </div>
              )}

              {editSuccess && (
                <div style={{
                  padding: '8px',
                  backgroundColor: isDarkMode ? 'rgba(46, 125, 50, 0.2)' : '#efe',
                  border: isDarkMode ? '1px solid rgba(46, 125, 50, 0.4)' : '1px solid #cfc',
                  borderRadius: '4px',
                  color: isDarkMode ? '#81c784' : '#3c3',
                  marginBottom: '12px',
                  fontSize: '12px'
                }}>
                  Product updated successfully!
                </div>
              )}

              <form onSubmit={handleSaveProduct}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, fontFamily: '"Product Sans", sans-serif', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Product Name *
                    </label>
                    <input
                      type="text"
                      name="product_name"
                      value={editFormData.product_name || ''}
                      onChange={handleEditChange}
                      required
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        fontFamily: '"Product Sans", sans-serif',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, fontFamily: '"Product Sans", sans-serif', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      SKU *
                    </label>
                    <input
                      type="text"
                      name="sku"
                      value={editFormData.sku || ''}
                      onChange={handleEditChange}
                      required
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        fontFamily: '"Product Sans", sans-serif',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, fontFamily: '"Product Sans", sans-serif', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Barcode
                    </label>
                    <input
                      type="text"
                      name="barcode"
                      value={editFormData.barcode || ''}
                      onChange={handleEditChange}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        fontFamily: '"Product Sans", sans-serif',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, fontFamily: '"Product Sans", sans-serif', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Category
                    </label>
                    <input
                      type="text"
                      name="category"
                      value={editFormData.category || ''}
                      onChange={handleEditChange}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        fontFamily: '"Product Sans", sans-serif',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, fontFamily: '"Product Sans", sans-serif', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Product Price *
                    </label>
                    <input
                      type="number"
                      name="product_price"
                      value={editFormData.product_price || ''}
                      onChange={handleEditChange}
                      required
                      min="0"
                      step="0.01"
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        fontFamily: '"Product Sans", sans-serif',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, fontFamily: '"Product Sans", sans-serif', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Product Cost *
                    </label>
                    <input
                      type="number"
                      name="product_cost"
                      value={editFormData.product_cost || ''}
                      onChange={handleEditChange}
                      required
                      min="0"
                      step="0.01"
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        fontFamily: '"Product Sans", sans-serif',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, fontFamily: '"Product Sans", sans-serif', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Current Quantity *
                    </label>
                    <input
                      type="number"
                      name="current_quantity"
                      value={editFormData.current_quantity || ''}
                      onChange={handleEditChange}
                      required
                      min="0"
                      step="1"
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        fontFamily: '"Product Sans", sans-serif',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 500, fontFamily: '"Product Sans", sans-serif', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      Vendor
                    </label>
                    <input
                      type="text"
                      name="vendor"
                      value={editFormData.vendor || ''}
                      onChange={handleEditChange}
                      style={{
                        width: '100%',
                        padding: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        fontFamily: '"Product Sans", sans-serif',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    />
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '4px'
                  }}>
                    <button
                      type="button"
                      onClick={handleCloseEdit}
                      disabled={editLoading}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f0f0f0',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '4px',
                        cursor: editLoading ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                        fontFamily: '"Product Sans", sans-serif',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editLoading}
                      style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: editLoading ? '#ccc' : `rgba(${themeColorRgb}, 0.7)`,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: editLoading ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                        fontFamily: '"Product Sans", sans-serif'
                      }}
                    >
                      {editLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right Column - Grid with Filters */}
        <div style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderLeft: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
          paddingLeft: '30px'
        }}>
          {/* Filter Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '20px',
            borderBottom: isDarkMode ? '2px solid var(--border-light, #333)' : '2px solid #eee',
            paddingBottom: '12px'
          }}>
            <button
              onClick={() => handleFilterChange('category')}
              style={{
                padding: '10px 16px',
                backgroundColor: filterView === 'category' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: filterView === 'category' ? '1px solid rgba(255, 255, 255, 0.3)' : `1px solid rgba(${themeColorRgb}, 0.3)`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: filterView === 'category' ? 600 : 500,
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: filterView === 'category' ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`
              }}
            >
              Category
            </button>
            <button
              onClick={() => handleFilterChange('vendor')}
              style={{
                padding: '10px 16px',
                backgroundColor: filterView === 'vendor' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: filterView === 'vendor' ? '1px solid rgba(255, 255, 255, 0.3)' : `1px solid rgba(${themeColorRgb}, 0.3)`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: filterView === 'vendor' ? 600 : 500,
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: filterView === 'vendor' ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`
              }}
            >
              Vendor
            </button>
            <button
              onClick={() => handleFilterChange('all')}
              style={{
                padding: '10px 16px',
                backgroundColor: filterView === 'all' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: filterView === 'all' ? '1px solid rgba(255, 255, 255, 0.3)' : `1px solid rgba(${themeColorRgb}, 0.3)`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: filterView === 'all' ? 600 : 500,
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: filterView === 'all' ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`
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

    </div>
  )
}

export default Inventory
