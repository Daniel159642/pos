import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import Table from '../components/Table'
import BarcodeScanner from '../components/BarcodeScanner'
import { ScanBarcode, Plus, ChevronDown, Upload, Image as ImageIcon, Share2, Download, Printer, X } from 'lucide-react'

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
  const [allCategories, setAllCategories] = useState([])
  const [categoryColumns, setCategoryColumns] = useState([])
  const [vendorColumns, setVendorColumns] = useState([])
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
  const [editPhotoPreview, setEditPhotoPreview] = useState(null)
  const [editShowPhotoPreview, setEditShowPhotoPreview] = useState(false)
  const [editIsCroppingPhoto, setEditIsCroppingPhoto] = useState(false)
  const [editPhotoDimensions, setEditPhotoDimensions] = useState({ width: 0, height: 0 })
  const [editPhotoDisplaySize, setEditPhotoDisplaySize] = useState({ width: 0, height: 0 })
  const [editFixedContainerSize, setEditFixedContainerSize] = useState({ width: 0, height: 0 })
  const [editCropBox, setEditCropBox] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [editIsDrawingCrop, setEditIsDrawingCrop] = useState(false)
  const [editCropStart, setEditCropStart] = useState({ x: 0, y: 0 })
  const [editResizingHandle, setEditResizingHandle] = useState(null)
  const editResizeStartRef = useRef({ cropBox: null, clientX: 0, clientY: 0 })
  const editFileInputRef = useRef(null)
  const editCropImageRef = useRef(null)
  const editCropContainerRef = useRef(null)
  const [sessionToken, setSessionToken] = useState(null)
  
  // Create forms state
  const [showCreateProduct, setShowCreateProduct] = useState(false)
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [showCreateVendor, setShowCreateVendor] = useState(false)
  const [showCreateDropdown, setShowCreateDropdown] = useState(false)
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
    photo: null,
    item_type: 'product',
    unit: ''
  })
  const [inventoryFilter, setInventoryFilter] = useState('all') // 'all' | 'product' | 'ingredient'
  const [editingVariants, setEditingVariants] = useState([])
  const [editingIngredients, setEditingIngredients] = useState([])
  const [newVariant, setNewVariant] = useState({ variant_name: '', price: '', cost: '0' })
  const [newRecipeRow, setNewRecipeRow] = useState({ ingredient_id: '', quantity_required: '', unit: '' })
  const [createVariants, setCreateVariants] = useState([])
  const [createRecipeRows, setCreateRecipeRows] = useState([])
  const [createNewVariant, setCreateNewVariant] = useState({ variant_name: '', price: '', cost: '0' })
  const [createNewRecipeRow, setCreateNewRecipeRow] = useState({ ingredient_id: '', quantity_required: '', unit: '' })
  const [photoPreview, setPhotoPreview] = useState(null)
  const [showPhotoPreview, setShowPhotoPreview] = useState(false)
  const [isCroppingPhoto, setIsCroppingPhoto] = useState(false)
  const [photoDimensions, setPhotoDimensions] = useState({ width: 0, height: 0 })
  const [photoDisplaySize, setPhotoDisplaySize] = useState({ width: 0, height: 0 })
  const [fixedContainerSize, setFixedContainerSize] = useState({ width: 0, height: 0 })
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [isDrawingCrop, setIsDrawingCrop] = useState(false)
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 })
  const [resizingHandle, setResizingHandle] = useState(null)
  const resizeStartRef = useRef({ cropBox: null, clientX: 0, clientY: 0 })
  const fileInputRef = useRef(null)
  const cropImageRef = useRef(null)
  const cropContainerRef = useRef(null)

  const MIN_CROP = 20
  const [createCategoryData, setCreateCategoryData] = useState({ parent_path: '', category_name: '' })
  const [createVendorData, setCreateVendorData] = useState({
    vendor_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: ''
  })
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingVendor, setEditingVendor] = useState(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [barcodePreview, setBarcodePreview] = useState(null)
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [barcodeError, setBarcodeError] = useState(null)
  const barcodeObjectUrlRef = useRef(null)
  
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
    loadInventory(inventoryFilter)
    loadVendors()
    loadCategories()
  }, [inventoryFilter])

  // Hide scrollbar for inventory buttons
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .inventory-buttons-scroll::-webkit-scrollbar {
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCreateDropdown && !event.target.closest('[data-create-dropdown]')) {
        setShowCreateDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCreateDropdown])

  const handleBarcodeScan = async (barcode) => {
    // Set the search query to the scanned barcode
    setSearchQuery(barcode)
    // Optionally, you could also filter the inventory immediately
  }

  const loadInventory = async (filter = inventoryFilter) => {
    setLoading(true)
    setError(null)
    try {
      const url = filter && filter !== 'all' ? `/api/inventory?item_type=${filter}` : '/api/inventory'
      const response = await fetch(url)
      const result = await response.json()
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
      if (result.columns) {
        setVendorColumns(result.columns)
      } else if (result.data && result.data.length > 0) {
        setVendorColumns(Object.keys(result.data[0]))
      }
    } catch (err) {
      console.error('Error loading vendors:', err)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      const result = await response.json()
      if (result.data) {
        setAllCategories(result.data)
      } else {
        setAllCategories([])
      }
      if (result.columns) {
        setCategoryColumns(result.columns)
      } else if (result.data && result.data.length > 0) {
        setCategoryColumns(Object.keys(result.data[0]))
      }
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  const loadProductVariants = async (productId) => {
    try {
      const res = await fetch(`/api/inventory/${productId}/variants`)
      const data = await res.json()
      setEditingVariants(data.data || [])
    } catch {
      setEditingVariants([])
    }
  }
  const loadProductIngredients = async (productId) => {
    try {
      const res = await fetch(`/api/inventory/${productId}/ingredients`)
      const data = await res.json()
      setEditingIngredients(data.data || [])
    } catch {
      setEditingIngredients([])
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
      vendor: product.vendor || product.vendor_name || '',
      vendor_id: product.vendor_id || null,
      photo: null,
      item_type: product.item_type || 'product',
      unit: product.unit || ''
    })
    // Set photo preview from existing product photo if available
    if (product.photo) {
      setEditPhotoPreview(product.photo)
    } else {
      setEditPhotoPreview(null)
    }
    setEditError(null)
    setEditSuccess(false)
    setEditIsCroppingPhoto(false)
    setEditCropBox({ x: 0, y: 0, width: 0, height: 0 })
    setEditFixedContainerSize({ width: 0, height: 0 })
    setEditingVariants([])
    setEditingIngredients([])
    setNewVariant({ variant_name: '', price: '', cost: '0' })
    setNewRecipeRow({ ingredient_id: '', quantity_required: '', unit: '' })
    if (product.item_type !== 'ingredient') {
      loadProductVariants(product.product_id)
      loadProductIngredients(product.product_id)
    }
    setShowCreateProduct(false)
    setShowCreateCategory(false)
    setShowCreateVendor(false)
    setShowCreateDropdown(false)
    handleCloseBarcodePreview()
  }

  const handleCloseEdit = () => {
    setEditingProduct(null)
    setEditFormData({})
    setEditError(null)
    setEditSuccess(false)
    setEditPhotoPreview(null)
    setEditIsCroppingPhoto(false)
    setEditCropBox({ x: 0, y: 0, width: 0, height: 0 })
    setEditFixedContainerSize({ width: 0, height: 0 })
  }

  const handleCloseBarcodePreview = () => {
    if (barcodeObjectUrlRef.current) {
      URL.revokeObjectURL(barcodeObjectUrlRef.current)
      barcodeObjectUrlRef.current = null
    }
    setBarcodePreview(null)
    setBarcodeError(null)
  }

  const handleGenerateBarcode = async (product) => {
    const pid = product?.product_id
    if (!pid) return
    
    // Close other forms when opening barcode
    setShowCreateProduct(false)
    setShowCreateCategory(false)
    setShowCreateVendor(false)
    setEditingProduct(null)
    setEditingCategory(null)
    setEditingVendor(null)
    
    if (barcodeObjectUrlRef.current) {
      URL.revokeObjectURL(barcodeObjectUrlRef.current)
      barcodeObjectUrlRef.current = null
    }
    setBarcodeLoading(true)
    setBarcodeError(null)
    setBarcodePreview(null)
    try {
      const res = await fetch(`/api/product_barcode_image?product_id=${pid}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed to generate barcode (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      barcodeObjectUrlRef.current = url
      setBarcodePreview({ product, imageDataUrl: url, blob })
    } catch (e) {
      setBarcodeError(e.message || 'Failed to generate barcode')
    } finally {
      setBarcodeLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (barcodeObjectUrlRef.current) {
        URL.revokeObjectURL(barcodeObjectUrlRef.current)
      }
    }
  }, [])

  const handleEditPhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setEditFormData({ ...editFormData, photo: file })
      setEditShowPhotoPreview(false)
      setEditIsCroppingPhoto(false)
      setEditCropBox({ x: 0, y: 0, width: 0, height: 0 })
      setEditPhotoDisplaySize({ width: 0, height: 0 })
      setEditFixedContainerSize({ width: 0, height: 0 })
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setEditPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    } else {
      setEditFormData({ ...editFormData, photo: null })
      setEditPhotoPreview(null)
      setEditShowPhotoPreview(false)
      setEditIsCroppingPhoto(false)
      setEditCropBox({ x: 0, y: 0, width: 0, height: 0 })
      setEditPhotoDisplaySize({ width: 0, height: 0 })
      setEditFixedContainerSize({ width: 0, height: 0 })
    }
  }

  useEffect(() => {
    if (!editPhotoPreview) {
      setEditPhotoDimensions({ width: 0, height: 0 })
      setEditCropBox({ x: 0, y: 0, width: 0, height: 0 })
      setEditPhotoDisplaySize({ width: 0, height: 0 })
      return
    }

    const img = new window.Image()
    img.onload = () => {
      const width = img.naturalWidth || 0
      const height = img.naturalHeight || 0
      setEditPhotoDimensions({ width, height })
      setEditCropBox({ x: 0, y: 0, width: 0, height: 0 })
    }
    img.src = editPhotoPreview
  }, [editPhotoPreview])

  useEffect(() => {
    if (editIsCroppingPhoto && editPhotoDisplaySize.width > 0 && editPhotoDisplaySize.height > 0) {
      setEditCropBox({
        x: 0,
        y: 0,
        width: editPhotoDisplaySize.width,
        height: editPhotoDisplaySize.height
      })
    }
  }, [editIsCroppingPhoto, editPhotoDisplaySize])

  const applyEditPhotoCrop = () => {
    if (!editPhotoPreview || !editCropBox.width || !editCropBox.height) return
    const displayWidth = editPhotoDisplaySize.width || editCropImageRef.current?.getBoundingClientRect().width || 0
    const displayHeight = editPhotoDisplaySize.height || editCropImageRef.current?.getBoundingClientRect().height || 0
    if (!displayWidth || !displayHeight || !editPhotoDimensions.width || !editPhotoDimensions.height) return

    const scaleX = editPhotoDimensions.width / displayWidth
    const scaleY = editPhotoDimensions.height / displayHeight
    const scaledCrop = {
      x: Math.round(editCropBox.x * scaleX),
      y: Math.round(editCropBox.y * scaleY),
      width: Math.round(editCropBox.width * scaleX),
      height: Math.round(editCropBox.height * scaleY)
    }

    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = scaledCrop.width
      canvas.height = scaledCrop.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(
        img,
        scaledCrop.x,
        scaledCrop.y,
        scaledCrop.width,
        scaledCrop.height,
        0,
        0,
        scaledCrop.width,
        scaledCrop.height
      )

      canvas.toBlob((blob) => {
        if (!blob) return
        const fileName = editFormData.photo?.name || 'cropped-image.png'
        const croppedFile = new File([blob], fileName, { type: blob.type || 'image/png' })
        setEditFormData((prev) => ({ ...prev, photo: croppedFile }))

        const reader = new FileReader()
        reader.onloadend = () => {
          setEditPhotoPreview(reader.result)
          setEditIsCroppingPhoto(false)
        }
        reader.readAsDataURL(blob)
      })
    }
    img.src = editPhotoPreview
  }

  const handleEditRemovePhoto = () => {
    setEditFormData((prev) => ({ ...prev, photo: null }))
    setEditPhotoPreview(null)
    setEditShowPhotoPreview(false)
    setEditIsCroppingPhoto(false)
    setEditFixedContainerSize({ width: 0, height: 0 })
    if (editFileInputRef.current) {
      editFileInputRef.current.value = ''
    }
  }

  const getEditCropPoint = (event) => {
    if (!editCropContainerRef.current) return null
    const rect = editCropContainerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height))
    return { x, y, width: rect.width, height: rect.height }
  }

  const handleEditCropMouseDown = (event) => {
    if (!editIsCroppingPhoto) return
  }

  const handleEditCropMouseMove = (event) => {
    if (!editIsDrawingCrop || !editIsCroppingPhoto) return
    const point = getEditCropPoint(event)
    if (!point) return
    const startX = editCropStart.x
    const startY = editCropStart.y
    const currentX = point.x
    const currentY = point.y
    const x = Math.min(startX, currentX)
    const y = Math.min(startY, currentY)
    const width = Math.abs(currentX - startX)
    const height = Math.abs(currentY - startY)
    setEditCropBox({ x, y, width, height })
  }

  const handleEditCropMouseUp = () => {
    if (editIsDrawingCrop) {
      setEditIsDrawingCrop(false)
    }
  }

  const handleEditResizeMouseDown = (e, handle) => {
    e.stopPropagation()
    setEditResizingHandle(handle)
    editResizeStartRef.current = {
      cropBox: { ...editCropBox },
      clientX: e.clientX,
      clientY: e.clientY
    }
  }

  useEffect(() => {
    if (!editResizingHandle) return
    const container = editCropContainerRef.current
    const getRect = () => container?.getBoundingClientRect() ?? { width: 0, height: 0, left: 0, top: 0 }

    const onMouseMove = (e) => {
      const { cropBox: start, clientX: startX, clientY: startY } = editResizeStartRef.current
      if (!start) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const rect = getRect()
      const maxW = rect.width
      const maxH = rect.height
      let { x, y, width, height } = start

      switch (editResizingHandle) {
        case 'nw':
          x = Math.max(0, Math.min(start.x + dx, start.x + start.width - MIN_CROP))
          width = start.x + start.width - x
          y = Math.max(0, Math.min(start.y + dy, start.y + start.height - MIN_CROP))
          height = start.y + start.height - y
          break
        case 'n':
          y = Math.max(0, Math.min(start.y + dy, start.y + start.height - MIN_CROP))
          height = start.y + start.height - y
          break
        case 'ne':
          width = Math.max(MIN_CROP, Math.min(start.width + dx, maxW - start.x))
          y = Math.max(0, Math.min(start.y + dy, start.y + start.height - MIN_CROP))
          height = start.y + start.height - y
          break
        case 'e':
          width = Math.max(MIN_CROP, Math.min(start.width + dx, maxW - start.x))
          break
        case 'se':
          width = Math.max(MIN_CROP, Math.min(start.width + dx, maxW - start.x))
          height = Math.max(MIN_CROP, Math.min(start.height + dy, maxH - start.y))
          break
        case 's':
          height = Math.max(MIN_CROP, Math.min(start.height + dy, maxH - start.y))
          break
        case 'sw':
          x = Math.max(0, Math.min(start.x + dx, start.x + start.width - MIN_CROP))
          width = start.x + start.width - x
          height = Math.max(MIN_CROP, Math.min(start.height + dy, maxH - start.y))
          break
        case 'w':
          x = Math.max(0, Math.min(start.x + dx, start.x + start.width - MIN_CROP))
          width = start.x + start.width - x
          break
        default:
          return
      }
      setEditCropBox({ x, y, width, height })
    }

    const onMouseUp = () => {
      setEditResizingHandle(null)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [editResizingHandle])

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: name === 'product_price' || name === 'product_cost' || name === 'current_quantity' || name === 'vendor_id'
        ? (value === '' ? null : parseFloat(value))
        : value
    }))
  }

  const handleAddVariant = async () => {
    if (!editingProduct?.product_id || !newVariant.variant_name?.trim() || newVariant.price === '' || parseFloat(newVariant.price) < 0) return
    try {
      const res = await fetch(`/api/inventory/${editingProduct.product_id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_name: newVariant.variant_name.trim(),
          price: parseFloat(newVariant.price),
          cost: parseFloat(newVariant.cost) || 0
        })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to add variant')
      setNewVariant({ variant_name: '', price: '', cost: '0' })
      loadProductVariants(editingProduct.product_id)
    } catch (err) {
      setEditError(err.message || 'Failed to add variant')
    }
  }
  const handleDeleteVariant = async (variantId) => {
    if (!editingProduct?.product_id) return
    try {
      const res = await fetch(`/api/inventory/variants/${variantId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete variant')
      loadProductVariants(editingProduct.product_id)
    } catch (err) {
      setEditError(err.message || 'Failed to delete variant')
    }
  }
  const handleAddRecipeIngredient = async () => {
    if (!editingProduct?.product_id || !newRecipeRow.ingredient_id || !newRecipeRow.quantity_required || parseFloat(newRecipeRow.quantity_required) <= 0 || !newRecipeRow.unit?.trim()) return
    try {
      const res = await fetch(`/api/inventory/${editingProduct.product_id}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_id: parseInt(newRecipeRow.ingredient_id, 10),
          quantity_required: parseFloat(newRecipeRow.quantity_required),
          unit: newRecipeRow.unit.trim()
        })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to add ingredient')
      setNewRecipeRow({ ingredient_id: '', quantity_required: '', unit: '' })
      loadProductIngredients(editingProduct.product_id)
    } catch (err) {
      setEditError(err.message || 'Failed to add ingredient')
    }
  }
  const handleDeleteRecipeIngredient = async (recipeId) => {
    try {
      const res = await fetch(`/api/inventory/ingredients/${recipeId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to remove')
      if (editingProduct?.product_id) loadProductIngredients(editingProduct.product_id)
    } catch (err) {
      setEditError(err.message || 'Failed to remove ingredient')
    }
  }

  const addCreateVariant = () => {
    const name = (createNewVariant.variant_name || '').trim()
    const price = parseFloat(createNewVariant.price)
    if (!name || isNaN(price) || price < 0) return
    setCreateVariants(prev => [...prev, { variant_name: name, price, cost: parseFloat(createNewVariant.cost) || 0 }])
    setCreateNewVariant({ variant_name: '', price: '', cost: '0' })
  }
  const removeCreateVariant = (idx) => {
    setCreateVariants(prev => prev.filter((_, i) => i !== idx))
  }
  const addCreateRecipeRow = () => {
    const ingredient_id = createNewRecipeRow.ingredient_id
    const qty = parseFloat(createNewRecipeRow.quantity_required)
    const unit = (createNewRecipeRow.unit || '').trim()
    if (!ingredient_id || isNaN(qty) || qty <= 0 || !unit) return
    const ing = inventory.find(i => i.product_id === parseInt(ingredient_id, 10))
    setCreateRecipeRows(prev => [...prev, { ingredient_id: parseInt(ingredient_id, 10), quantity_required: qty, unit, ingredient_name: ing?.product_name || '' }])
    setCreateNewRecipeRow({ ingredient_id: '', quantity_required: '', unit: '' })
  }
  const removeCreateRecipeRow = (idx) => {
    setCreateRecipeRows(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSaveProduct = async (e) => {
    if (e) e.preventDefault()
    setEditLoading(true)
    setEditError(null)
    setEditSuccess(false)

    try {
      // Create FormData to support file uploads
      const formData = new FormData()
      formData.append('product_name', editFormData.product_name)
      formData.append('sku', editFormData.sku)
      formData.append('barcode', editFormData.barcode || '')
      formData.append('product_price', editFormData.product_price)
      formData.append('product_cost', editFormData.product_cost)
      formData.append('current_quantity', editFormData.current_quantity || '0')
      formData.append('category', editFormData.category || '')
      formData.append('vendor', editFormData.vendor || '')
      formData.append('item_type', editFormData.item_type || 'product')
      if (editFormData.unit != null) formData.append('unit', editFormData.unit || '')
      if (editFormData.vendor_id) {
        formData.append('vendor_id', editFormData.vendor_id)
      }
      if (editFormData.photo) {
        formData.append('photo', editFormData.photo)
      }
      formData.append('session_token', sessionToken)

      const response = await fetch(`/api/inventory/${editingProduct.product_id}`, {
        method: 'PUT',
        body: formData
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
      formData.append('product_price', createProductData.item_type === 'ingredient' ? '0' : (createProductData.product_price || '0'))
      formData.append('product_cost', createProductData.product_cost || '0')
      formData.append('current_quantity', createProductData.current_quantity || '0')
      formData.append('category', createProductData.category || '')
      formData.append('vendor', createProductData.vendor || '')
      formData.append('item_type', createProductData.item_type || 'product')
      if (createProductData.unit) formData.append('unit', createProductData.unit)
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

      const productId = result.product_id
      if (productId && (createProductData.item_type || 'product') === 'product') {
        for (const v of createVariants) {
          const vr = await fetch(`/api/inventory/${productId}/variants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ variant_name: v.variant_name, price: v.price, cost: v.cost })
          })
          const vd = await vr.json()
          if (!vd.success) throw new Error(vd.message || 'Failed to add variant')
        }
        for (const r of createRecipeRows) {
          const rr = await fetch(`/api/inventory/${productId}/ingredients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ingredient_id: r.ingredient_id, quantity_required: r.quantity_required, unit: r.unit })
          })
          const rd = await rr.json()
          if (!rd.success) throw new Error(rd.message || 'Failed to add ingredient')
        }
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
        photo: null,
        item_type: 'product',
        unit: ''
      })
      setCreateVariants([])
      setCreateRecipeRows([])
      setCreateNewVariant({ variant_name: '', price: '', cost: '0' })
      setCreateNewRecipeRow({ ingredient_id: '', quantity_required: '', unit: '' })
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
      setShowPhotoPreview(false)
      setIsCroppingPhoto(false)
      setCropBox({ x: 0, y: 0, width: 0, height: 0 })
      setPhotoDisplaySize({ width: 0, height: 0 })
      setFixedContainerSize({ width: 0, height: 0 })
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    } else {
      setCreateProductData({ ...createProductData, photo: null })
      setPhotoPreview(null)
      setShowPhotoPreview(false)
      setIsCroppingPhoto(false)
      setCropBox({ x: 0, y: 0, width: 0, height: 0 })
      setPhotoDisplaySize({ width: 0, height: 0 })
      setFixedContainerSize({ width: 0, height: 0 })
    }
  }

  useEffect(() => {
    if (!photoPreview) {
      setPhotoDimensions({ width: 0, height: 0 })
      setCropBox({ x: 0, y: 0, width: 0, height: 0 })
      setPhotoDisplaySize({ width: 0, height: 0 })
      return
    }

    const img = new window.Image()
    img.onload = () => {
      const width = img.naturalWidth || 0
      const height = img.naturalHeight || 0
      setPhotoDimensions({ width, height })
      setCropBox({ x: 0, y: 0, width: 0, height: 0 })
    }
    img.src = photoPreview
  }, [photoPreview])

  // Initialize crop box to full image when crop mode is activated
  useEffect(() => {
    if (isCroppingPhoto && photoDisplaySize.width > 0 && photoDisplaySize.height > 0) {
      setCropBox({
        x: 0,
        y: 0,
        width: photoDisplaySize.width,
        height: photoDisplaySize.height
      })
    }
  }, [isCroppingPhoto, photoDisplaySize])

  const applyPhotoCrop = () => {
    if (!photoPreview || !cropBox.width || !cropBox.height) return
    const displayWidth = photoDisplaySize.width || cropImageRef.current?.getBoundingClientRect().width || 0
    const displayHeight = photoDisplaySize.height || cropImageRef.current?.getBoundingClientRect().height || 0
    if (!displayWidth || !displayHeight || !photoDimensions.width || !photoDimensions.height) return

    const scaleX = photoDimensions.width / displayWidth
    const scaleY = photoDimensions.height / displayHeight
    const scaledCrop = {
      x: Math.round(cropBox.x * scaleX),
      y: Math.round(cropBox.y * scaleY),
      width: Math.round(cropBox.width * scaleX),
      height: Math.round(cropBox.height * scaleY)
    }

    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = scaledCrop.width
      canvas.height = scaledCrop.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(
        img,
        scaledCrop.x,
        scaledCrop.y,
        scaledCrop.width,
        scaledCrop.height,
        0,
        0,
        scaledCrop.width,
        scaledCrop.height
      )

      canvas.toBlob((blob) => {
        if (!blob) return
        const fileName = createProductData.photo?.name || 'cropped-image.png'
        const croppedFile = new File([blob], fileName, { type: blob.type || 'image/png' })
        setCreateProductData((prev) => ({ ...prev, photo: croppedFile }))

        const reader = new FileReader()
        reader.onloadend = () => {
          setPhotoPreview(reader.result)
          setIsCroppingPhoto(false)
        }
        reader.readAsDataURL(blob)
      })
    }
    img.src = photoPreview
  }

  const handleRemovePhoto = () => {
    setCreateProductData((prev) => ({ ...prev, photo: null }))
    setPhotoPreview(null)
    setShowPhotoPreview(false)
    setIsCroppingPhoto(false)
    setFixedContainerSize({ width: 0, height: 0 })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getCropPoint = (event) => {
    if (!cropContainerRef.current) return null
    const rect = cropContainerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height))
    return { x, y, width: rect.width, height: rect.height }
  }

  const handleCropMouseDown = (event) => {
    // Disable drag-to-draw when in crop mode - only allow resize handles
    // The crop box is already initialized to full image size
    if (!isCroppingPhoto) return
    // Don't start a new draw - only resize handles should work
  }

  const handleCropMouseMove = (event) => {
    if (!isDrawingCrop || !isCroppingPhoto) return
    const point = getCropPoint(event)
    if (!point) return
    const startX = cropStart.x
    const startY = cropStart.y
    const currentX = point.x
    const currentY = point.y
    const x = Math.min(startX, currentX)
    const y = Math.min(startY, currentY)
    const width = Math.abs(currentX - startX)
    const height = Math.abs(currentY - startY)
    setCropBox({ x, y, width, height })
  }

  const handleCropMouseUp = () => {
    if (isDrawingCrop) {
      setIsDrawingCrop(false)
    }
  }

  const handleResizeMouseDown = (e, handle) => {
    e.stopPropagation()
    setResizingHandle(handle)
    resizeStartRef.current = {
      cropBox: { ...cropBox },
      clientX: e.clientX,
      clientY: e.clientY
    }
  }

  useEffect(() => {
    if (!resizingHandle) return
    const container = cropContainerRef.current
    const getRect = () => container?.getBoundingClientRect() ?? { width: 0, height: 0, left: 0, top: 0 }

    const onMouseMove = (e) => {
      const { cropBox: start, clientX: startX, clientY: startY } = resizeStartRef.current
      if (!start) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const rect = getRect()
      const maxW = rect.width
      const maxH = rect.height
      let { x, y, width, height } = start

      switch (resizingHandle) {
        case 'nw':
          x = Math.max(0, Math.min(start.x + dx, start.x + start.width - MIN_CROP))
          width = start.x + start.width - x
          y = Math.max(0, Math.min(start.y + dy, start.y + start.height - MIN_CROP))
          height = start.y + start.height - y
          break
        case 'n':
          y = Math.max(0, Math.min(start.y + dy, start.y + start.height - MIN_CROP))
          height = start.y + start.height - y
          break
        case 'ne':
          width = Math.max(MIN_CROP, Math.min(start.width + dx, maxW - start.x))
          y = Math.max(0, Math.min(start.y + dy, start.y + start.height - MIN_CROP))
          height = start.y + start.height - y
          break
        case 'e':
          width = Math.max(MIN_CROP, Math.min(start.width + dx, maxW - start.x))
          break
        case 'se':
          width = Math.max(MIN_CROP, Math.min(start.width + dx, maxW - start.x))
          height = Math.max(MIN_CROP, Math.min(start.height + dy, maxH - start.y))
          break
        case 's':
          height = Math.max(MIN_CROP, Math.min(start.height + dy, maxH - start.y))
          break
        case 'sw':
          x = Math.max(0, Math.min(start.x + dx, start.x + start.width - MIN_CROP))
          width = start.x + start.width - x
          height = Math.max(MIN_CROP, Math.min(start.height + dy, maxH - start.y))
          break
        case 'w':
          x = Math.max(0, Math.min(start.x + dx, start.x + start.width - MIN_CROP))
          width = start.x + start.width - x
          break
        default:
          return
      }
      setCropBox({ x, y, width, height })
    }

    const onMouseUp = () => {
      setResizingHandle(null)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [resizingHandle])

  const handleEditCategory = (category) => {
    // Close other forms
    setShowCreateVendor(false)
    setShowCreateProduct(false)
    setEditingVendor(null)
    setEditingProduct(null)
    handleCloseBarcodePreview()
    
    setEditingCategory(category)
    // Parse full path into parent + name for dropdown UX (e.g. "Food & Beverage > Fruit" -> parent "Food & Beverage", name "Fruit")
    const categoryPath = category.category_path || category.category_name || category.name || ''
    const lastGt = categoryPath.lastIndexOf(' > ')
    const parent_path = lastGt > 0 ? categoryPath.slice(0, lastGt) : ''
    const category_name = lastGt > 0 ? categoryPath.slice(lastGt + 3) : categoryPath
    setCreateCategoryData({ parent_path, category_name })
    setShowCreateCategory(true)
    setCreateError(null)
    setCreateSuccess(false)
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    setCreateSuccess(false)

    try {
      const url = editingCategory 
        ? `/api/categories/${editingCategory.category_id}`
        : '/api/categories'
      const method = editingCategory ? 'PUT' : 'POST'

      const path = createCategoryData.parent_path
        ? (createCategoryData.parent_path + ' > ' + createCategoryData.category_name)
        : createCategoryData.category_name
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category_name: path })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `Failed to ${editingCategory ? 'update' : 'create'} category`)
      }

      setCreateSuccess(true)
      setCreateCategoryData({ parent_path: '', category_name: '' })
      setEditingCategory(null)
      setTimeout(() => {
        loadInventory()
        loadCategories()
        setShowCreateCategory(false)
        setCreateSuccess(false)
      }, 1000)
    } catch (err) {
      setCreateError(err.message || `An error occurred while ${editingCategory ? 'updating' : 'creating'} the category`)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleEditVendor = (vendor) => {
    // Close other forms
    setShowCreateCategory(false)
    setShowCreateProduct(false)
    setEditingCategory(null)
    setEditingProduct(null)
    handleCloseBarcodePreview()
    
    setEditingVendor(vendor)
    setCreateVendorData({
      vendor_name: vendor.vendor_name || '',
      contact_person: vendor.contact_person || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || ''
    })
    setShowCreateVendor(true)
    setCreateError(null)
    setCreateSuccess(false)
  }

  const handleCreateVendor = async (e) => {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    setCreateSuccess(false)

    try {
      const url = editingVendor 
        ? `/api/vendors/${editingVendor.vendor_id}`
        : '/api/vendors'
      const method = editingVendor ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createVendorData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `Failed to ${editingVendor ? 'update' : 'create'} vendor`)
      }

      setCreateSuccess(true)
      setCreateVendorData({
        vendor_name: '',
        contact_person: '',
        email: '',
        phone: '',
        address: ''
      })
      setEditingVendor(null)
      setTimeout(() => {
        loadVendors()
        setShowCreateVendor(false)
        setCreateSuccess(false)
      }, 1000)
    } catch (err) {
      setCreateError(err.message || `An error occurred while ${editingVendor ? 'updating' : 'creating'} the vendor`)
    } finally {
      setCreateLoading(false)
    }
  }

  const categoryNamesFromDb = allCategories
    .map(category => category.category_path || category.category_name || category.name)
    .filter(Boolean)

  // Build category list including every path prefix so items appear under master and all subcategories
  // e.g. "Food & Beverage > Produce > Fruits" adds: "Food & Beverage", "Food & Beverage > Produce", "Food & Beverage > Produce > Fruits"
  const rawPaths = categoryNamesFromDb.length > 0
    ? categoryNamesFromDb
    : inventory.map(item => item.category).filter(Boolean)
  const pathPrefixes = (path) => {
    if (!path || typeof path !== 'string') return []
    const parts = path.split(' > ').map(p => p.trim()).filter(Boolean)
    const out = []
    for (let i = 1; i <= parts.length; i++) out.push(parts.slice(0, i).join(' > '))
    return out
  }
  const categories = [...new Set(rawPaths.flatMap(pathPrefixes))].sort()
  
  // Get all vendors from vendors table (not just vendors with products)
  const vendors = allVendors.map(vendor => vendor.vendor_name).filter(Boolean).sort()

  const resolvedCategoryColumns = categoryColumns.length > 0
    ? categoryColumns
    : (allCategories[0] ? Object.keys(allCategories[0]) : ['category_name'])

  const resolvedVendorColumns = vendorColumns.length > 0
    ? vendorColumns
    : (allVendors[0] ? Object.keys(allVendors[0]) : ['vendor_name'])

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

  // Get items by category (master category includes all subcategories, e.g. "Electronics" includes "Electronics > Phones")
  const getItemsByCategory = (category) => {
    return filteredInventory.filter(item => {
      const itemCat = item.category || ''
      if (itemCat === category) return true
      if (category && itemCat.startsWith(category + ' >')) return true
      return false
    })
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
    return (
      <div>
        <div style={{ position: 'relative', marginTop: '8px', marginBottom: '20px' }}>
          <div 
            className="inventory-buttons-scroll"
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
          {categories.map((category, index) => {
            const itemCount = getItemsByCategory(category).length
            const label = category.includes(' > ') ? category.split(' > ').pop().trim() : category
            return (
              <button
                key={`${category}-${index}`}
                onClick={() => handleCategoryClick(category)}
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
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: selectedCategory === category ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
                }}
              >
                {label}
              </button>
            )
          })}
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
        {!selectedCategory && (
          <div style={{ marginTop: '20px' }}>
            {allCategories.length > 0 ? (
              <Table
                columns={[...resolvedCategoryColumns, 'actions']}
                data={allCategories}
                onEdit={handleEditCategory}
                actionsAsEllipsis
                ellipsisMenuItems={[
                  { label: 'Edit', onClick: (r) => handleEditCategory(r) }
                ]}
              />
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
                No categories found in database
              </div>
            )}
          </div>
        )}
        {selectedCategory && (
          <div>
            {(() => {
              const items = getItemsByCategory(selectedCategory)
              return items.length > 0 ? (
                <Table 
                  columns={['photo', 'product_name', 'sku', 'barcode', 'product_price', 'current_quantity', 'vendor_name', 'vendor']} 
                  data={items}
                  onEdit={handleEditProduct}
                  actionsAsEllipsis
                  ellipsisMenuItems={[
                    { label: 'Edit', onClick: (r) => handleEditProduct(r) },
                    { label: 'Barcode', onClick: (r) => handleGenerateBarcode(r) }
                  ]}
                />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
                  No items found in this category
                </div>
              )
            })()}
          </div>
        )}
      </div>
    )
  }

  // Render vendor grid
  const renderVendorGrid = () => {
    return (
      <div>
        <div style={{ position: 'relative', marginTop: '8px', marginBottom: '20px' }}>
          <div 
            className="inventory-buttons-scroll"
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
          {vendors.map((vendor, index) => {
            const itemCount = getItemsByVendor(vendor).length
            return (
              <button
                key={`${vendor}-${index}`}
                onClick={() => handleVendorClick(vendor)}
                style={{
                  padding: '4px 16px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  backgroundColor: selectedVendor === vendor 
                    ? `rgba(${themeColorRgb}, 0.7)` 
                    : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                  border: selectedVendor === vendor 
                    ? `1px solid rgba(${themeColorRgb}, 0.5)` 
                    : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: selectedVendor === vendor ? 600 : 500,
                  color: selectedVendor === vendor ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: selectedVendor === vendor ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
                }}
              >
                {vendor}
              </button>
            )
          })}
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
        {!selectedVendor && (
          <div style={{ marginTop: '20px' }}>
            {allVendors.length > 0 ? (
              <Table
                columns={[...resolvedVendorColumns, 'actions']}
                data={allVendors}
                onEdit={handleEditVendor}
                actionsAsEllipsis
                ellipsisMenuItems={[
                  { label: 'Edit', onClick: (r) => handleEditVendor(r) }
                ]}
              />
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
                No vendors found
              </div>
            )}
          </div>
        )}
        {selectedVendor && (
          <div>
            {(() => {
              const items = getItemsByVendor(selectedVendor)
              return items.length > 0 ? (
                <Table 
                  columns={['photo', 'product_name', 'sku', 'barcode', 'product_price', 'current_quantity', 'category']} 
                  data={items}
                  onEdit={handleEditProduct}
                  actionsAsEllipsis
                  ellipsisMenuItems={[
                    { label: 'Edit', onClick: (r) => handleEditProduct(r) },
                    { label: 'Barcode', onClick: (r) => handleGenerateBarcode(r) }
                  ]}
                />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
                  No items found for this vendor
                </div>
              )
            })()}
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
          actionsAsEllipsis
          ellipsisMenuItems={[
            { label: 'Edit', onClick: (r) => handleEditProduct(r) },
            { label: 'Barcode', onClick: (r) => handleGenerateBarcode(r) }
          ]}
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
    <div style={{ padding: '20px 40px 40px 40px', maxWidth: '1600px', margin: '0 auto', backgroundColor: 'white' }}>
      {/* Header with Create Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        marginTop: '0'
      }}>
      </div>

      <div style={{ display: 'flex', gap: '30px', height: 'calc(100vh - 200px)' }}>
        {/* Left Column - Search */}
        <div style={{ 
          width: '300px', 
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '0px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0' }}>
            <input
              type="text"
              placeholder="Search by name, SKU, barcode..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                // Clear selected category/vendor when searching to show all results
                if (e.target.value.trim() !== '') {
                  setSelectedCategory(null)
                  setSelectedVendor(null)
                  // Automatically switch to 'all' view when searching
                  if (filterView !== 'all') {
                    setFilterView('all')
                  }
                }
              }}
              style={{
                flex: 1,
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
            <button
              onClick={() => setShowBarcodeScanner(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                padding: '4px',
                backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                color: '#fff',
                boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
              }}
            >
              <ScanBarcode size={16} />
            </button>
          </div>

          {/* Barcode Preview Container */}
          {(barcodeLoading || barcodePreview || barcodeError) && (
            <div style={{
              marginTop: '20px',
              marginBottom: '20px',
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              boxShadow: isDarkMode ? '0 2px 8px rgba(0, 0, 0, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}>
              {barcodeError && !barcodeLoading && (
                <div style={{
                  padding: '8px',
                  backgroundColor: isDarkMode ? 'rgba(198, 40, 40, 0.2)' : '#fee',
                  border: isDarkMode ? '1px solid rgba(198, 40, 40, 0.4)' : '1px solid #fcc',
                  borderRadius: '4px',
                  color: isDarkMode ? '#ef5350' : '#c33',
                  marginBottom: '12px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>{barcodeError}</span>
                  <button
                    type="button"
                    onClick={handleCloseBarcodePreview}
                    aria-label="Close"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      border: 'none',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      color: isDarkMode ? '#ef5350' : '#c33',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              
              {barcodeLoading && (
                <div style={{
                  padding: '12px',
                  textAlign: 'center',
                  color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666',
                  fontSize: '13px'
                }}>
                  Generating barcode...
                </div>
              )}
              
              {barcodePreview && !barcodeLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      padding: '8px',
                      backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f8f9fa',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img
                        src={barcodePreview.imageDataUrl}
                        alt="Product barcode"
                        style={{ height: '60px', width: 'auto', objectFit: 'contain' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        marginBottom: '4px',
                        fontFamily: '"Product Sans", sans-serif'
                      }}>
                        {barcodePreview.product?.product_name || 'Product'}
                      </div>
                      {(barcodePreview.product?.sku || barcodePreview.product?.barcode) && (
                        <div style={{
                          fontSize: '12px',
                          color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                          fontFamily: '"Product Sans", sans-serif'
                        }}>
                          {[barcodePreview.product?.sku, barcodePreview.product?.barcode].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    paddingTop: '8px',
                    borderTop: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee'
                  }}>
                    {typeof navigator !== 'undefined' && navigator.share && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const f = new File(
                              [barcodePreview.blob],
                              `barcode_${(barcodePreview.product?.product_name || 'product').replace(/[^a-z0-9.-]/gi, '_')}.png`,
                              { type: 'image/png' }
                            )
                            await navigator.share({
                              files: [f],
                              title: `${barcodePreview.product?.product_name || 'Product'} – Barcode`
                            })
                          } catch (e) {
                            if (e.name !== 'AbortError') console.error(e)
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          border: 'none',
                          borderRadius: '6px',
                          backgroundColor: `rgba(${themeColorRgb}, 0.1)`,
                          color: `rgb(${themeColorRgb})`,
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          fontFamily: '"Product Sans", sans-serif'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.1)`
                        }}
                      >
                        <Share2 size={14} /> Share
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const a = document.createElement('a')
                        a.href = barcodePreview.imageDataUrl
                        a.download = `barcode_${(barcodePreview.product?.product_name || 'product').replace(/[^a-z0-9.-]/gi, '_')}_${barcodePreview.product?.product_id || ''}.png`
                        a.click()
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: `rgba(${themeColorRgb}, 0.1)`,
                        color: `rgb(${themeColorRgb})`,
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        fontFamily: '"Product Sans", sans-serif'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.1)`
                      }}
                    >
                      <Download size={14} /> Download
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const w = window.open('', '_blank', 'width=400,height=360')
                        if (!w) return
                        const name = (barcodePreview.product?.product_name || 'Product').replace(/</g, '&lt;')
                        const sku = (barcodePreview.product?.sku || '').replace(/</g, '&lt;')
                        const bc = (barcodePreview.product?.barcode || '').replace(/</g, '&lt;')
                        w.document.write(`
                          <!DOCTYPE html><html><head><title>Barcode – ${name}</title></head>
                          <body style="margin:24px;font-family:sans-serif;text-align:center">
                            <h2 style="margin:0 0 16px">${name}</h2>
                            <img src="${barcodePreview.imageDataUrl}" alt="Barcode" style="max-width:100%;height:auto" />
                            <p style="margin:16px 0 0;color:#666">${sku} ${bc}</p>
                            <p style="margin:12px 0 0"><a href="#" onclick="window.close();return false">Close</a></p>
                          </body></html>
                        `)
                        w.document.close()
                        w.focus()
                        w.print()
                        if (w.onafterprint !== undefined) w.onafterprint = () => w.close()
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: `rgba(${themeColorRgb}, 0.1)`,
                        color: `rgb(${themeColorRgb})`,
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        fontFamily: '"Product Sans", sans-serif'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.1)`
                      }}
                    >
                      <Printer size={14} /> Print
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Create Product Form */}
          {showCreateProduct && (
            <div style={{
              marginTop: '20px',
              marginBottom: '20px',
              maxHeight: 'calc(100vh - 300px)',
              overflowY: 'auto'
            }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Product Name
                    </label>
                    <input
                      type="text"
                      value={createProductData.product_name}
                      onChange={(e) => setCreateProductData({ ...createProductData, product_name: e.target.value })}
                      placeholder={createProductData.item_type === 'ingredient' ? 'Ingredient Name *' : 'Product Name *'}
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Type
                    </label>
                    <select
                      value={createProductData.item_type || 'product'}
                      onChange={(e) => setCreateProductData({ ...createProductData, item_type: e.target.value })}
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
                      <option value="product">Product (sold at POS)</option>
                      <option value="ingredient">Ingredient (used in recipes, not sold)</option>
                    </select>
                  </div>

                  {createProductData.item_type === 'ingredient' && (
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                        fontFamily: '"Product Sans", sans-serif'
                      }}>
                        Unit
                      </label>
                      <input
                        type="text"
                        value={createProductData.unit || ''}
                        onChange={(e) => setCreateProductData({ ...createProductData, unit: e.target.value })}
                        placeholder="e.g. oz, lb, g, ml, each"
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
                  )}

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      SKU
                    </label>
                    <input
                      type="text"
                      value={createProductData.sku}
                      onChange={(e) => setCreateProductData({ ...createProductData, sku: e.target.value })}
                      placeholder="SKU *"
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Barcode
                    </label>
                    <input
                      type="text"
                      value={createProductData.barcode}
                      onChange={(e) => setCreateProductData({ ...createProductData, barcode: e.target.value })}
                      placeholder="Barcode"
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
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                        fontFamily: '"Product Sans", sans-serif'
                      }}>
                        Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={createProductData.product_price}
                        onChange={(e) => setCreateProductData({ ...createProductData, product_price: e.target.value })}
                        placeholder="Price *"
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
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                        fontFamily: '"Product Sans", sans-serif'
                      }}>
                        Cost
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={createProductData.product_cost}
                        onChange={(e) => setCreateProductData({ ...createProductData, product_cost: e.target.value })}
                        placeholder="Cost *"
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={createProductData.current_quantity}
                      onChange={(e) => setCreateProductData({ ...createProductData, current_quantity: e.target.value })}
                      placeholder="Quantity *"
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Category
                    </label>
                    <input
                      type="text"
                      value={createProductData.category}
                      onChange={(e) => setCreateProductData({ ...createProductData, category: e.target.value })}
                      placeholder="Category (e.g., Electronics > Phones)"
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
                    <CustomDropdown
                      value={createProductData.vendor || ''}
                      onChange={(e) => {
                        const vendor = allVendors.find(v => v.vendor_name === e.target.value)
                        setCreateProductData({ 
                          ...createProductData, 
                          vendor: e.target.value,
                          vendor_id: vendor ? vendor.vendor_id : null
                        })
                      }}
                      options={[
                        { value: '', label: 'Vendor (optional)' },
                        ...allVendors.map(vendor => ({
                          value: vendor.vendor_name,
                          label: vendor.vendor_name
                        }))
                      ]}
                      placeholder="Vendor (optional)"
                      isDarkMode={isDarkMode}
                      themeColorRgb={themeColorRgb}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    {!createProductData.photo ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s ease',
                          fontFamily: '"Product Sans", sans-serif'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.borderColor = `rgba(${themeColorRgb}, 0.5)`
                          e.target.style.backgroundColor = isDarkMode 
                            ? `rgba(${themeColorRgb}, 0.1)` 
                            : `rgba(${themeColorRgb}, 0.05)`
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'
                          e.target.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff'
                        }}
                      >
                        <Upload size={16} />
                        <span>Choose File</span>
                      </button>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCroppingPhoto(false)
                            setShowPhotoPreview((prev) => !prev)
                          }}
                          style={{
                            width: '100%',
                            padding: '6px',
                            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '13px',
                            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                            boxSizing: 'border-box',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s ease',
                            fontFamily: '"Product Sans", sans-serif'
                          }}
                        >
                          <ImageIcon size={16} />
                          <span>Preview</span>
                        </button>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      style={{ display: 'none' }}
                    />
                  </div>

                  {(createProductData.item_type || 'product') === 'product' && (
                    <>
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: isDarkMode ? '1px solid #333' : '1px solid #eee' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>Sizes / Variants (e.g. Small $3, Large $5)</label>
                        {createVariants.length > 0 && (
                          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px 0' }}>
                            {createVariants.map((v, idx) => (
                              <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px' }}>
                                <span style={{ flex: 1 }}>{v.variant_name} — ${Number(v.price).toFixed(2)}</span>
                                <button type="button" onClick={() => removeCreateVariant(idx)} style={{ padding: '2px 8px', fontSize: '11px', color: '#c33', border: '1px solid #c33', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}>Remove</button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <input type="text" placeholder="Size name" value={createNewVariant.variant_name} onChange={(e) => setCreateNewVariant({ ...createNewVariant, variant_name: e.target.value })} style={{ width: '100px', padding: '6px', border: isDarkMode ? '1px solid #404040' : '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#333' }} />
                          <input type="number" step="0.01" min="0" placeholder="Price" value={createNewVariant.price} onChange={(e) => setCreateNewVariant({ ...createNewVariant, price: e.target.value })} style={{ width: '80px', padding: '6px', border: isDarkMode ? '1px solid #404040' : '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#333' }} />
                          <input type="number" step="0.01" min="0" placeholder="Cost" value={createNewVariant.cost} onChange={(e) => setCreateNewVariant({ ...createNewVariant, cost: e.target.value })} style={{ width: '70px', padding: '6px', border: isDarkMode ? '1px solid #404040' : '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#333' }} />
                          <button type="button" onClick={addCreateVariant} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: `rgba(${themeColorRgb}, 0.7)`, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add size</button>
                        </div>
                      </div>
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: isDarkMode ? '1px solid #333' : '1px solid #eee' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>Ingredients used (recipe)</label>
                        {createRecipeRows.length > 0 && (
                          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px 0' }}>
                            {createRecipeRows.map((r, idx) => (
                              <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px' }}>
                                <span style={{ flex: 1 }}>{r.ingredient_name || 'Ingredient'} — {r.quantity_required} {r.unit}</span>
                                <button type="button" onClick={() => removeCreateRecipeRow(idx)} style={{ padding: '2px 8px', fontSize: '11px', color: '#c33', border: '1px solid #c33', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}>Remove</button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <select value={createNewRecipeRow.ingredient_id} onChange={(e) => setCreateNewRecipeRow({ ...createNewRecipeRow, ingredient_id: e.target.value })} style={{ minWidth: '140px', padding: '6px', border: isDarkMode ? '1px solid #404040' : '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#333' }}>
                            <option value="">Select ingredient</option>
                            {inventory.filter((i) => i.item_type === 'ingredient').map((ing) => (
                              <option key={ing.product_id} value={ing.product_id}>{ing.product_name} ({ing.unit || '—'})</option>
                            ))}
                          </select>
                          <input type="number" step="0.0001" min="0.0001" placeholder="Qty" value={createNewRecipeRow.quantity_required} onChange={(e) => setCreateNewRecipeRow({ ...createNewRecipeRow, quantity_required: e.target.value })} style={{ width: '70px', padding: '6px', border: isDarkMode ? '1px solid #404040' : '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#333' }} />
                          <input type="text" placeholder="Unit" value={createNewRecipeRow.unit} onChange={(e) => setCreateNewRecipeRow({ ...createNewRecipeRow, unit: e.target.value })} style={{ width: '70px', padding: '6px', border: isDarkMode ? '1px solid #404040' : '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#333' }} />
                          <button type="button" onClick={addCreateRecipeRow} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: `rgba(${themeColorRgb}, 0.7)`, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
                        </div>
                      </div>
                    </>
                  )}

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
                          photo: null,
                          item_type: 'product',
                          unit: ''
                        })
                        setCreateVariants([])
                        setCreateRecipeRows([])
                        setCreateNewVariant({ variant_name: '', price: '', cost: '0' })
                        setCreateNewRecipeRow({ ingredient_id: '', quantity_required: '', unit: '' })
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
              marginTop: '20px',
              marginBottom: '20px'
            }}>
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
                  Category {editingCategory ? 'updated' : 'created'} successfully!
                </div>
              )}

              <form onSubmit={handleCreateCategory}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Parent category
                    </label>
                    <CustomDropdown
                      value={createCategoryData.parent_path}
                      onChange={(e) => setCreateCategoryData(prev => ({ ...prev, parent_path: e.target.value }))}
                      options={[
                        { value: '', label: 'Top level (no parent)' },
                        ...allCategories
                          .map(c => c.category_path || c.category_name || c.name)
                          .filter(Boolean)
                          .filter(p => {
                            const current = editingCategory && (editingCategory.category_path || editingCategory.category_name || editingCategory.name)
                            return !current || p !== current
                          })
                          .sort()
                          .map(path => ({ value: path, label: path }))
                      ]}
                      placeholder="Top level (no parent)"
                      isDarkMode={isDarkMode}
                      themeColorRgb={themeColorRgb}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Category name
                    </label>
                    <input
                      type="text"
                      value={createCategoryData.category_name}
                      onChange={(e) => setCreateCategoryData(prev => ({ ...prev, category_name: e.target.value }))}
                      placeholder={createCategoryData.parent_path ? 'e.g. Fruit, Produce' : 'e.g. Food & Beverage, Electronics'}
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
                    {createCategoryData.parent_path && (
                      <p style={{ marginTop: '6px', fontSize: '11px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>
                        Full path: {createCategoryData.parent_path} &gt; {createCategoryData.category_name || '…'}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateCategory(false)
                        setCreateError(null)
                        setCreateSuccess(false)
                        setCreateCategoryData({ parent_path: '', category_name: '' })
                        setEditingCategory(null)
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
                      {createLoading ? (editingCategory ? 'Updating...' : 'Creating...') : (editingCategory ? 'Update' : 'Create')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Create Vendor Form */}
          {showCreateVendor && (
            <div style={{
              marginTop: '20px',
              marginBottom: '20px',
              maxHeight: 'calc(100vh - 300px)',
              overflowY: 'auto'
            }}>
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
                  Vendor {editingVendor ? 'updated' : 'created'} successfully!
                </div>
              )}

              <form onSubmit={handleCreateVendor}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Vendor Name
                    </label>
                    <input
                      type="text"
                      value={createVendorData.vendor_name}
                      onChange={(e) => setCreateVendorData({ ...createVendorData, vendor_name: e.target.value })}
                      placeholder="Vendor Name *"
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={createVendorData.contact_person}
                      onChange={(e) => setCreateVendorData({ ...createVendorData, contact_person: e.target.value })}
                      placeholder="Contact Person"
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={createVendorData.email}
                      onChange={(e) => setCreateVendorData({ ...createVendorData, email: e.target.value })}
                      placeholder="Email"
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={createVendorData.phone}
                      onChange={(e) => setCreateVendorData({ ...createVendorData, phone: e.target.value })}
                      placeholder="Phone"
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Address
                    </label>
                    <textarea
                      value={createVendorData.address}
                      onChange={(e) => setCreateVendorData({ ...createVendorData, address: e.target.value })}
                      placeholder="Address"
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
                        setEditingVendor(null)
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
                      {createLoading ? (editingVendor ? 'Updating...' : 'Creating...') : (editingVendor ? 'Update' : 'Create')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Edit Product Form */}
          {editingProduct && (
            <div style={{
              marginTop: '20px',
              marginBottom: '20px',
              maxHeight: 'calc(100vh - 300px)',
              overflowY: 'auto'
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Product Name
                    </label>
                    <input
                      type="text"
                      name="product_name"
                      value={editFormData.product_name || ''}
                      onChange={handleEditChange}
                      placeholder="Product Name *"
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      SKU
                    </label>
                    <input
                      type="text"
                      name="sku"
                      value={editFormData.sku || ''}
                      onChange={handleEditChange}
                      placeholder="SKU *"
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Barcode
                    </label>
                    <input
                      type="text"
                      name="barcode"
                      value={editFormData.barcode || ''}
                      onChange={handleEditChange}
                      placeholder="Barcode"
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
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 500, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', fontFamily: '"Product Sans", sans-serif' }}>Type</label>
                    <select
                      name="item_type"
                      value={editFormData.item_type || 'product'}
                      onChange={handleEditChange}
                      style={{ width: '100%', padding: '6px', border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd', borderRadius: '4px', fontSize: '13px', backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333', boxSizing: 'border-box' }}
                    >
                      <option value="product">Product (sold at POS)</option>
                      <option value="ingredient">Ingredient (used in recipes)</option>
                    </select>
                  </div>
                  {(editFormData.item_type || 'product') === 'ingredient' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 500, color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', fontFamily: '"Product Sans", sans-serif' }}>Unit</label>
                      <input
                        type="text"
                        name="unit"
                        value={editFormData.unit || ''}
                        onChange={handleEditChange}
                        placeholder="e.g. oz, lb, g, ml, each"
                        style={{ width: '100%', padding: '6px', border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd', borderRadius: '4px', fontSize: '13px', backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                        fontFamily: '"Product Sans", sans-serif'
                      }}>
                        Price
                      </label>
                      <input
                        type="number"
                        name="product_price"
                        step="0.01"
                        min="0"
                        value={editFormData.product_price || ''}
                        onChange={handleEditChange}
                        placeholder="Price *"
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
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                        fontFamily: '"Product Sans", sans-serif'
                      }}>
                        Cost
                      </label>
                      <input
                        type="number"
                        name="product_cost"
                        step="0.01"
                        min="0"
                        value={editFormData.product_cost || ''}
                        onChange={handleEditChange}
                        placeholder="Cost *"
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Quantity
                    </label>
                    <input
                      type="number"
                      name="current_quantity"
                      min="0"
                      value={editFormData.current_quantity || ''}
                      onChange={handleEditChange}
                      placeholder="Quantity *"
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Category
                    </label>
                    <input
                      type="text"
                      name="category"
                      value={editFormData.category || ''}
                      onChange={handleEditChange}
                      placeholder="Category (e.g., Electronics > Phones)"
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
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      Vendor
                    </label>
                    <CustomDropdown
                      value={editFormData.vendor || ''}
                      onChange={(e) => {
                        const vendor = allVendors.find(v => v.vendor_name === e.target.value)
                        setEditFormData({ 
                          ...editFormData, 
                          vendor: e.target.value,
                          vendor_id: vendor ? vendor.vendor_id : null
                        })
                      }}
                      options={[
                        { value: '', label: 'Vendor (optional)' },
                        ...allVendors.map(vendor => ({
                          value: vendor.vendor_name,
                          label: vendor.vendor_name
                        }))
                      ]}
                      placeholder="Vendor (optional)"
                      isDarkMode={isDarkMode}
                      themeColorRgb={themeColorRgb}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    {!editFormData.photo && !editPhotoPreview ? (
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s ease',
                          fontFamily: '"Product Sans", sans-serif'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.borderColor = `rgba(${themeColorRgb}, 0.5)`
                          e.target.style.backgroundColor = isDarkMode 
                            ? `rgba(${themeColorRgb}, 0.1)` 
                            : `rgba(${themeColorRgb}, 0.05)`
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'
                          e.target.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff'
                        }}
                      >
                        <Upload size={16} />
                        <span>Choose File</span>
                      </button>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditIsCroppingPhoto(false)
                            setEditShowPhotoPreview((prev) => !prev)
                          }}
                          style={{
                            width: '100%',
                            padding: '6px',
                            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '13px',
                            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                            boxSizing: 'border-box',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s ease',
                            fontFamily: '"Product Sans", sans-serif'
                          }}
                        >
                          <ImageIcon size={16} />
                          <span>Preview</span>
                        </button>
                      </div>
                    )}
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleEditPhotoChange}
                      style={{ display: 'none' }}
                    />
                  </div>

                  {(editFormData.item_type || editingProduct?.item_type) !== 'ingredient' && editingProduct?.product_id && (
                    <>
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: isDarkMode ? '1px solid #333' : '1px solid #eee' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>Sizes / Variants (e.g. Small $3, Large $5)</label>
                        {editingVariants.length > 0 && (
                          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px 0' }}>
                            {editingVariants.map((v) => (
                              <li key={v.variant_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px' }}>
                                <span style={{ flex: 1 }}>{v.variant_name} — ${Number(v.price).toFixed(2)}</span>
                                <button type="button" onClick={() => handleDeleteVariant(v.variant_id)} style={{ padding: '2px 8px', fontSize: '11px', color: '#c33', border: '1px solid #c33', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}>Remove</button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <input type="text" placeholder="Size name" value={newVariant.variant_name} onChange={(e) => setNewVariant({ ...newVariant, variant_name: e.target.value })} style={{ width: '100px', padding: '6px', border: isDarkMode ? '1px solid #404040' : '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#333' }} />
                          <input type="number" step="0.01" min="0" placeholder="Price" value={newVariant.price} onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })} style={{ width: '80px', padding: '6px', border: isDarkMode ? '1px solid #404040' : '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#333' }} />
                          <input type="number" step="0.01" min="0" placeholder="Cost" value={newVariant.cost} onChange={(e) => setNewVariant({ ...newVariant, cost: e.target.value })} style={{ width: '70px', padding: '6px', border: isDarkMode ? '1px solid #404040' : '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#333' }} />
                          <button type="button" onClick={handleAddVariant} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: `rgba(${themeColorRgb}, 0.7)`, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add size</button>
                        </div>
                      </div>
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: isDarkMode ? '1px solid #333' : '1px solid #eee' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: isDarkMode ? 'var(--text-secondary)' : '#555' }}>Ingredients used (recipe)</label>
                        {editingIngredients.length > 0 && (
                          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px 0' }}>
                            {editingIngredients.map((r) => (
                              <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '13px' }}>
                                <span style={{ flex: 1 }}>{r.ingredient_name || r.product_name} — {r.quantity_required} {r.unit}</span>
                                <button type="button" onClick={() => handleDeleteRecipeIngredient(r.id)} style={{ padding: '2px 8px', fontSize: '11px', color: '#c33', border: '1px solid #c33', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}>Remove</button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <select value={newRecipeRow.ingredient_id} onChange={(e) => setNewRecipeRow({ ...newRecipeRow, ingredient_id: e.target.value })} style={{ minWidth: '140px', padding: '6px', border: isDarkMode ? '1px solid #404040' : '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#333' }}>
                            <option value="">Select ingredient</option>
                            {inventory.filter((i) => i.item_type === 'ingredient').map((ing) => (
                              <option key={ing.product_id} value={ing.product_id}>{ing.product_name} ({ing.unit || '—'})</option>
                            ))}
                          </select>
                          <input type="number" step="0.0001" min="0.0001" placeholder="Qty" value={newRecipeRow.quantity_required} onChange={(e) => setNewRecipeRow({ ...newRecipeRow, quantity_required: e.target.value })} style={{ width: '70px', padding: '6px', border: isDarkMode ? '1px solid #404040' : '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#333' }} />
                          <input type="text" placeholder="Unit" value={newRecipeRow.unit} onChange={(e) => setNewRecipeRow({ ...newRecipeRow, unit: e.target.value })} style={{ width: '70px', padding: '6px', border: isDarkMode ? '1px solid #404040' : '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#333' }} />
                          <button type="button" onClick={handleAddRecipeIngredient} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: `rgba(${themeColorRgb}, 0.7)`, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
                        </div>
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
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
          {/* Item type filter: All | Products | Ingredients */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', marginTop: '3px' }}>
            {['all', 'product', 'ingredient'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setInventoryFilter(f)}
                style={{
                  padding: '4px 12px',
                  height: '26px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: inventoryFilter === f ? `1px solid rgba(${themeColorRgb}, 0.6)` : (isDarkMode ? '1px solid #444' : '1px solid #ccc'),
                  backgroundColor: inventoryFilter === f ? `rgba(${themeColorRgb}, 0.25)` : (isDarkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f5'),
                  color: inventoryFilter === f ? `rgba(${themeColorRgb}, 1)` : (isDarkMode ? '#ccc' : '#555'),
                  fontWeight: inventoryFilter === f ? 600 : 500,
                  cursor: 'pointer'
                }}
              >
                {f === 'all' ? 'All items' : f === 'product' ? 'Products' : 'Ingredients'}
              </button>
            ))}
          </div>
          {/* Filter Buttons */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: '8px', 
            marginBottom: '8px',
            marginTop: '3px'
          }}>
            <button
              onClick={() => handleFilterChange('category')}
              style={{
                padding: '4px 16px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                backgroundColor: filterView === 'category' 
                  ? `rgba(${themeColorRgb}, 0.7)` 
                  : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                border: filterView === 'category' 
                  ? `1px solid rgba(${themeColorRgb}, 0.5)` 
                  : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: filterView === 'category' ? 600 : 500,
                color: filterView === 'category' ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: filterView === 'category' ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
              }}
            >
              Category
            </button>
            <button
              onClick={() => handleFilterChange('vendor')}
              style={{
                padding: '4px 16px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                backgroundColor: filterView === 'vendor' 
                  ? `rgba(${themeColorRgb}, 0.7)` 
                  : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                border: filterView === 'vendor' 
                  ? `1px solid rgba(${themeColorRgb}, 0.5)` 
                  : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: filterView === 'vendor' ? 600 : 500,
                color: filterView === 'vendor' ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: filterView === 'vendor' ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
              }}
            >
              Vendor
            </button>
            <button
              onClick={() => handleFilterChange('all')}
              style={{
                padding: '4px 16px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                backgroundColor: filterView === 'all' 
                  ? `rgba(${themeColorRgb}, 0.7)` 
                  : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                border: filterView === 'all' 
                  ? `1px solid rgba(${themeColorRgb}, 0.5)` 
                  : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: filterView === 'all' ? 600 : 500,
                color: filterView === 'all' ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: filterView === 'all' ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
              }}
            >
              All
            </button>
            <div style={{ position: 'relative' }} data-create-dropdown>
              <button
                onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                style={{
                  padding: '4px 16px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  backgroundColor: showCreateDropdown 
                    ? `rgba(${themeColorRgb}, 0.7)` 
                    : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                  border: showCreateDropdown 
                    ? `1px solid rgba(${themeColorRgb}, 0.5)` 
                    : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: showCreateDropdown ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: showCreateDropdown ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
                }}
              >
                <Plus size={16} />
                Create
                <ChevronDown size={14} />
              </button>
              {showCreateDropdown && (
                <div data-create-dropdown style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                  border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  minWidth: '160px',
                  overflow: 'hidden'
                }}>
                  <button
                    onClick={() => {
                      setShowCreateProduct(true)
                      setShowCreateCategory(false)
                      setShowCreateVendor(false)
                      setShowCreateDropdown(false)
                      setEditingProduct(null)
                      setEditingCategory(null)
                      setEditingVendor(null)
                      handleCloseBarcodePreview()
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      textAlign: 'left',
                      backgroundColor: 'transparent',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <Plus size={16} />
                    Product
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateCategory(true)
                      setShowCreateProduct(false)
                      setShowCreateVendor(false)
                      setShowCreateDropdown(false)
                      setEditingProduct(null)
                      setEditingCategory(null)
                      setEditingVendor(null)
                      setCreateCategoryData({ parent_path: '', category_name: '' })
                      handleCloseBarcodePreview()
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      textAlign: 'left',
                      backgroundColor: 'transparent',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderTop: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#eee'}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <Plus size={16} />
                    Category
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateVendor(true)
                      setShowCreateProduct(false)
                      setShowCreateCategory(false)
                      setShowCreateDropdown(false)
                      setEditingProduct(null)
                      setEditingCategory(null)
                      setEditingVendor(null)
                      setCreateVendorData({
                        vendor_name: '',
                        contact_person: '',
                        email: '',
                        phone: '',
                        address: ''
                      })
                      handleCloseBarcodePreview()
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      textAlign: 'left',
                      backgroundColor: 'transparent',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderTop: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#eee'}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <Plus size={16} />
                    Vendor
                  </button>
                </div>
              )}
            </div>
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

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowBarcodeScanner(false)}
          themeColor={themeColor}
        />
      )}

      {showPhotoPreview && photoPreview && (
        <div
          onClick={() => {
            setShowPhotoPreview(false)
            setIsCroppingPhoto(false)
            setFixedContainerSize({ width: 0, height: 0 })
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10050
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: isDarkMode ? '0 12px 30px rgba(0, 0, 0, 0.5)' : '0 12px 30px rgba(0, 0, 0, 0.2)',
              maxWidth: isCroppingPhoto ? '95vw' : '90vw',
              maxHeight: isCroppingPhoto ? '95vh' : '90vh',
              width: isCroppingPhoto ? '95vw' : 'fit-content',
              minWidth: isCroppingPhoto ? '800px' : '400px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: isCroppingPhoto ? '600px' : '400px',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                Photo Preview
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                    backgroundColor: isDarkMode ? 'rgba(255, 77, 79, 0.15)' : 'rgba(255, 77, 79, 0.12)',
                    color: isDarkMode ? '#ffb3b3' : '#d13d3d',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  Remove
                </button>
                {isCroppingPhoto ? (
                  <>
                    <button
                      type="button"
                      onClick={applyPhotoCrop}
                      disabled={!cropBox.width || !cropBox.height}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: `1px solid rgba(${themeColorRgb}, 0.5)`,
                        backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                        color: '#fff',
                        cursor: cropBox.width && cropBox.height ? 'pointer' : 'not-allowed',
                        fontSize: '12px',
                        fontWeight: 600,
                        opacity: cropBox.width && cropBox.height ? 1 : 0.6
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCroppingPhoto(false)
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500
                      }}
                    >
                      Cancel Crop
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const newCropMode = !isCroppingPhoto
                      setIsCroppingPhoto(newCropMode)
                      // Initialize crop box to full image when enabling crop mode
                      if (newCropMode && cropImageRef.current) {
                        const rect = cropImageRef.current.getBoundingClientRect()
                        setPhotoDisplaySize({ width: rect.width, height: rect.height })
                        setCropBox({
                          x: 0,
                          y: 0,
                          width: rect.width,
                          height: rect.height
                        })
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    Crop
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowPhotoPreview(false)
                    setIsCroppingPhoto(false)
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', flex: 1 }}>
              <div
                ref={cropContainerRef}
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                onMouseLeave={handleCropMouseUp}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  borderRadius: '6px',
                  userSelect: 'none',
                  cursor: 'default',
                  maxWidth: 'calc(90vw - 100px)',
                  maxHeight: 'calc(90vh - 150px)',
                  margin: '0 auto'
                }}
              >
              <img
                ref={cropImageRef}
                src={photoPreview}
                alt="Preview"
                onLoad={() => {
                  if (!cropImageRef.current) return
                  // Use natural dimensions for scaling calculations
                  const naturalWidth = cropImageRef.current.naturalWidth
                  const naturalHeight = cropImageRef.current.naturalHeight
                  const rect = cropImageRef.current.getBoundingClientRect()
                  
                  // Calculate scaled dimensions that fit within modal
                  const maxW = Math.min(rect.width, window.innerWidth * 0.9 - 100)
                  const maxH = Math.min(rect.height, window.innerHeight * 0.9 - 150)
                  
                  setPhotoDisplaySize({ width: rect.width, height: rect.height })
                  
                  // If we're in crop mode, initialize crop box to full image
                  if (isCroppingPhoto) {
                    setCropBox({
                      x: 0,
                      y: 0,
                      width: rect.width,
                      height: rect.height
                    })
                  }
                }}
                style={{
                  maxWidth: 'calc(90vw - 100px)',
                  maxHeight: 'calc(90vh - 150px)',
                  width: 'auto',
                  height: 'auto',
                  borderRadius: '6px',
                  display: 'block',
                  border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: isDarkMode ? '0 0 0 1px rgba(255, 255, 255, 0.05)' : '0 0 0 1px rgba(0, 0, 0, 0.05)',
                  objectFit: 'contain'
                }}
              />
              {isCroppingPhoto && cropBox.width > 0 && cropBox.height > 0 && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: cropBox.x,
                    top: cropBox.y,
                    width: cropBox.width,
                    height: cropBox.height,
                    border: `2px solid rgba(${themeColorRgb}, 0.9)`,
                    backgroundColor: 'rgba(0, 0, 0, 0.15)',
                    boxSizing: 'border-box',
                    pointerEvents: 'auto'
                  }}
                >
                  {[
                    { id: 'nw', left: 0, top: 0, cursor: 'nwse-resize' },
                    { id: 'n', left: '50%', top: 0, transform: 'translateX(-50%)', cursor: 'ns-resize' },
                    { id: 'ne', right: 0, top: 0, cursor: 'nesw-resize' },
                    { id: 'e', right: 0, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' },
                    { id: 'se', right: 0, bottom: 0, cursor: 'nwse-resize' },
                    { id: 's', left: '50%', bottom: 0, transform: 'translateX(-50%)', cursor: 'ns-resize' },
                    { id: 'sw', left: 0, bottom: 0, cursor: 'nesw-resize' },
                    { id: 'w', left: 0, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' }
                  ].map(({ id, cursor, ...pos }) => (
                    <div
                      key={id}
                      onMouseDown={(e) => handleResizeMouseDown(e, id)}
                      style={{
                        position: 'absolute',
                        width: 10,
                        height: 10,
                        backgroundColor: `rgba(${themeColorRgb}, 0.9)`,
                        border: '1px solid #fff',
                        borderRadius: 1,
                        cursor,
                        ...pos
                      }}
                    />
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Photo Preview Modal */}
      {editShowPhotoPreview && editPhotoPreview && (
        <div
          onClick={() => {
            setEditShowPhotoPreview(false)
            setEditIsCroppingPhoto(false)
            setEditFixedContainerSize({ width: 0, height: 0 })
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10050
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: isDarkMode ? '0 12px 30px rgba(0, 0, 0, 0.5)' : '0 12px 30px rgba(0, 0, 0, 0.2)',
              maxWidth: editIsCroppingPhoto ? '95vw' : '90vw',
              maxHeight: editIsCroppingPhoto ? '95vh' : '90vh',
              width: editIsCroppingPhoto ? '95vw' : 'fit-content',
              minWidth: editIsCroppingPhoto ? '800px' : '400px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: editIsCroppingPhoto ? '600px' : '400px',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '12px', width: '100%' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                Photo Preview
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleEditRemovePhoto}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                    backgroundColor: isDarkMode ? 'rgba(255, 77, 79, 0.15)' : 'rgba(255, 77, 79, 0.12)',
                    color: isDarkMode ? '#ffb3b3' : '#d13d3d',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                >
                  Remove
                </button>
                {editIsCroppingPhoto ? (
                  <>
                    <button
                      type="button"
                      onClick={applyEditPhotoCrop}
                      disabled={!editCropBox.width || !editCropBox.height}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: `1px solid rgba(${themeColorRgb}, 0.5)`,
                        backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                        color: '#fff',
                        cursor: editCropBox.width && editCropBox.height ? 'pointer' : 'not-allowed',
                        fontSize: '12px',
                        fontWeight: 600,
                        opacity: editCropBox.width && editCropBox.height ? 1 : 0.6
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditIsCroppingPhoto(false)
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500
                      }}
                    >
                      Cancel Crop
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const newCropMode = !editIsCroppingPhoto
                      setEditIsCroppingPhoto(newCropMode)
                      if (newCropMode && editCropImageRef.current) {
                        const rect = editCropImageRef.current.getBoundingClientRect()
                        setEditPhotoDisplaySize({ width: rect.width, height: rect.height })
                        setEditCropBox({
                          x: 0,
                          y: 0,
                          width: rect.width,
                          height: rect.height
                        })
                      }
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    Crop
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditShowPhotoPreview(false)
                    setEditIsCroppingPhoto(false)
                    setEditFixedContainerSize({ width: 0, height: 0 })
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', flex: 1 }}>
              <div
                ref={editCropContainerRef}
                onMouseDown={handleEditCropMouseDown}
                onMouseMove={handleEditCropMouseMove}
                onMouseUp={handleEditCropMouseUp}
                onMouseLeave={handleEditCropMouseUp}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  borderRadius: '6px',
                  userSelect: 'none',
                  cursor: 'default',
                  maxWidth: 'calc(90vw - 100px)',
                  maxHeight: 'calc(90vh - 150px)',
                  margin: '0 auto'
                }}
              >
                <img
                  ref={editCropImageRef}
                  src={editPhotoPreview}
                  alt="Preview"
                  onLoad={() => {
                    if (!editCropImageRef.current) return
                    const rect = editCropImageRef.current.getBoundingClientRect()
                    setEditPhotoDisplaySize({ width: rect.width, height: rect.height })
                    if (editFixedContainerSize.width === 0 && editFixedContainerSize.height === 0) {
                      setEditFixedContainerSize({ width: rect.width, height: rect.height })
                    }
                    if (editIsCroppingPhoto) {
                      setEditCropBox({
                        x: 0,
                        y: 0,
                        width: rect.width,
                        height: rect.height
                      })
                    }
                  }}
                  style={{
                    maxWidth: 'calc(90vw - 100px)',
                    maxHeight: 'calc(90vh - 150px)',
                    width: 'auto',
                    height: 'auto',
                    borderRadius: '6px',
                    display: 'block',
                    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                    boxShadow: isDarkMode ? '0 0 0 1px rgba(255, 255, 255, 0.05)' : '0 0 0 1px rgba(0, 0, 0, 0.05)',
                    objectFit: 'contain'
                  }}
                />
                {editIsCroppingPhoto && editCropBox.width > 0 && editCropBox.height > 0 && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      left: editCropBox.x,
                      top: editCropBox.y,
                      width: editCropBox.width,
                      height: editCropBox.height,
                      border: `2px solid rgba(${themeColorRgb}, 0.9)`,
                      backgroundColor: 'rgba(0, 0, 0, 0.15)',
                      boxSizing: 'border-box',
                      pointerEvents: 'auto'
                    }}
                  >
                    {[
                      { id: 'nw', left: 0, top: 0, cursor: 'nwse-resize' },
                      { id: 'n', left: '50%', top: 0, transform: 'translateX(-50%)', cursor: 'ns-resize' },
                      { id: 'ne', right: 0, top: 0, cursor: 'nesw-resize' },
                      { id: 'e', right: 0, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' },
                      { id: 'se', right: 0, bottom: 0, cursor: 'nwse-resize' },
                      { id: 's', left: '50%', bottom: 0, transform: 'translateX(-50%)', cursor: 'ns-resize' },
                      { id: 'sw', left: 0, bottom: 0, cursor: 'nesw-resize' },
                      { id: 'w', left: 0, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' }
                    ].map(({ id, cursor, ...pos }) => (
                      <div
                        key={id}
                        onMouseDown={(e) => handleEditResizeMouseDown(e, id)}
                        style={{
                          position: 'absolute',
                          width: 10,
                          height: 10,
                          backgroundColor: `rgba(${themeColorRgb}, 0.9)`,
                          border: '1px solid #fff',
                          borderRadius: 1,
                          cursor,
                          ...pos
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Custom Dropdown Component
function CustomDropdown({ value, onChange, options, placeholder, required, isDarkMode, themeColorRgb, style = {} }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isClickInsideTrigger = triggerRef.current && triggerRef.current.contains(event.target)
      const isClickInsideMenu = menuRef.current && menuRef.current.contains(event.target)
      
      if (!isClickInsideTrigger && !isClickInsideMenu) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedOption = options.find(opt => opt.value === value)

  // Calculate position for fixed dropdown
  const getDropdownPosition = () => {
    if (!triggerRef.current) return { top: 0, left: 0, width: 0 }
    const rect = triggerRef.current.getBoundingClientRect()
    return {
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width
    }
  }

  const dropdownPosition = isOpen ? getDropdownPosition() : { top: 0, left: 0, width: 0 }

  return (
    <>
      <div ref={dropdownRef} style={{ position: 'relative', ...style }}>
        <div
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '100%',
            padding: '6px',
            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '13px',
            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
            transition: 'all 0.2s ease',
            outline: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            ...(isOpen && {
              borderColor: `rgba(${themeColorRgb}, 0.5)`,
              boxShadow: `0 0 0 3px rgba(${themeColorRgb}, 0.1)`
            })
          }}
          onMouseEnter={(e) => {
            if (!isOpen) {
              e.target.style.borderColor = `rgba(${themeColorRgb}, 0.3)`
            }
          }}
          onMouseLeave={(e) => {
            if (!isOpen) {
              e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'
            }
          }}
        >
          <span style={{ 
            color: selectedOption ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333') : (isDarkMode ? 'var(--text-tertiary, #999)' : '#999')
          }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown 
            size={16} 
            style={{ 
              transition: 'transform 0.2s ease',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
            }} 
          />
        </div>
      </div>
      {isOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
            zIndex: 10000,
            maxHeight: '200px',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onChange({ target: { value: option.value } })
                setIsOpen(false)
              }}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                backgroundColor: value === option.value 
                  ? `rgba(${themeColorRgb}, 0.2)` 
                  : 'transparent',
                transition: 'background-color 0.15s ease',
                borderLeft: value === option.value 
                  ? `3px solid rgba(${themeColorRgb}, 0.7)` 
                  : '3px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (value !== option.value) {
                  e.target.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                }
              }}
              onMouseLeave={(e) => {
                if (value !== option.value) {
                  e.target.style.backgroundColor = 'transparent'
                }
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default Inventory
