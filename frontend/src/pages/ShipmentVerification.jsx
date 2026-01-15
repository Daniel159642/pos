import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import BarcodeScanner from '../components/BarcodeScanner'

function ShipmentVerificationDashboard() {
  const { themeMode, themeColor } = useTheme()
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, pending, in_progress, completed
  const [showUploadModal, setShowUploadModal] = useState(false)
  
  // Convert hex to RGB
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
    loadShipments()
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadShipments, 10000)
    return () => clearInterval(interval)
  }, [filter])

  const loadShipments = async () => {
    try {
      setLoading(true)
      const status = filter === 'all' ? null : filter
      const url = status 
        ? `/api/pending_shipments?status=${status}`
        : '/api/pending_shipments'
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.data) {
        setShipments(data.data)
      }
    } catch (error) {
      console.error('Error loading shipments:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    // Use theme color for all statuses, with different opacity/intensity
    switch (status) {
      case 'pending_review':
      case 'pending':
        return `rgba(${themeColorRgb}, 0.8)` // Theme color with high opacity
      case 'in_progress':
        return `rgba(${themeColorRgb}, 0.7)` // Theme color with medium-high opacity
      case 'approved':
      case 'completed':
        return `rgba(${themeColorRgb}, 0.9)` // Theme color with very high opacity
      case 'completed_with_issues':
        return `rgba(244, 67, 54, 0.8)` // Red for issues (keep red for warnings)
      default:
        return `rgba(${themeColorRgb}, 0.5)` // Theme color with lower opacity
    }
  }

  const getProgressColor = (percentage) => {
    // Use theme color for progress bars
    if (percentage >= 100) return `rgba(${themeColorRgb}, 0.9)`
    if (percentage >= 50) return `rgba(${themeColorRgb}, 0.7)`
    if (percentage > 0) return `rgba(${themeColorRgb}, 0.6)`
    return isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#e0e0e0'
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : 'transparent' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-start', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              marginRight: '8px',
              boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
              transition: 'all 0.3s ease'
            }}
          >
            + New Shipment
          </button>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '8px 16px',
              backgroundColor: filter === 'all' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: filter === 'all' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: filter === 'all' ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
              transition: 'all 0.3s ease'
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending_review')}
            style={{
              padding: '8px 16px',
              backgroundColor: filter === 'pending_review' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: filter === 'pending_review' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: filter === 'pending_review' ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
              transition: 'all 0.3s ease'
            }}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('in_progress')}
            style={{
              padding: '8px 16px',
              backgroundColor: filter === 'in_progress' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: filter === 'in_progress' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: filter === 'in_progress' ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
              transition: 'all 0.3s ease'
            }}
          >
            In Progress
          </button>
          <button
            onClick={() => setFilter('approved')}
            style={{
              padding: '8px 16px',
              backgroundColor: filter === 'approved' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: filter === 'approved' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: filter === 'approved' ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
              transition: 'all 0.3s ease'
            }}
          >
            Completed
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '18px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>Loading shipments...</div>
        </div>
      ) : shipments.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#f5f5f5',
          borderRadius: '8px',
          color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
        }}>
          No shipments found
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: '20px'
        }}>
          {shipments.map((shipment) => (
            <ShipmentCard 
              key={shipment.pending_shipment_id} 
              shipment={shipment}
              getStatusColor={getStatusColor}
              getProgressColor={getProgressColor}
              isDarkMode={isDarkMode}
              themeColorRgb={themeColorRgb}
            />
          ))}
        </div>
      )}

      {/* Upload Shipment Modal */}
      {showUploadModal && (
        <UploadShipmentModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={(shipmentId) => {
            setShowUploadModal(false)
            loadShipments()
            // Optionally navigate to the new shipment
            if (shipmentId) {
              window.location.href = `/shipment-verification/${shipmentId}`
            }
          }}
        />
      )}
    </div>
  )
}

function ShipmentCard({ shipment, getStatusColor, getProgressColor, isDarkMode, themeColorRgb }) {
  const navigate = useNavigate()
  const progress = shipment.progress_percentage || 0
  const status = shipment.status || 'pending_review'

  return (
    <div style={{
      backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
      border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
      cursor: 'pointer'
    }}
    onClick={() => navigate(`/shipment-verification/${shipment.pending_shipment_id}`)}
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: '16px'
      }}>
        <div>
          <h3 style={{ 
            margin: 0, 
            fontSize: '18px', 
            fontWeight: 600,
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
            marginBottom: '4px'
          }}>
            {shipment.vendor_name || 'Unknown Vendor'}
          </h3>
          <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
            PO: {shipment.purchase_order_number || 'N/A'}
          </div>
        </div>
        <div style={{
          padding: '4px 12px',
          borderRadius: '12px',
          backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
          color: getStatusColor(status),
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'capitalize',
          border: `1px solid ${getStatusColor(status)}`
        }}>
          {status.replace('_', ' ')}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          marginBottom: '6px',
          fontSize: '14px',
          color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
        }}>
          <span>Progress</span>
          <span style={{ fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            {progress.toFixed(1)}%
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#e0e0e0',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${Math.min(progress, 100)}%`,
            height: '100%',
            backgroundColor: getProgressColor(progress),
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div>
          <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginBottom: '4px' }}>
            Items
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            {shipment.total_verified || 0} / {shipment.total_expected || 0}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginBottom: '4px' }}>
            Total Items
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            {shipment.total_items || 0}
          </div>
        </div>
      </div>

      {/* Issues Badge */}
      {shipment.issue_count > 0 && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          backgroundColor: isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          fontSize: '13px',
          fontWeight: 500,
          marginBottom: '12px'
        }}>
          ⚠️ {shipment.issue_count} {shipment.issue_count === 1 ? 'issue' : 'issues'}
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
        color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999',
        paddingTop: '12px',
        borderTop: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #e0e0e0'
      }}>
        <div>
          {shipment.uploaded_by_name && (
            <span>Uploaded by {shipment.uploaded_by_name}</span>
          )}
        </div>
        <div>
          {shipment.upload_timestamp && (
            <span>
              {new Date(shipment.upload_timestamp).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ShipmentVerificationDetail({ shipmentId }) {
  const { id } = useParams()
  const { themeMode, themeColor } = useTheme()
  const actualId = shipmentId || id
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [progress, setProgress] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [currentItem, setCurrentItem] = useState(null)
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [customQuantities, setCustomQuantities] = useState({}) // Track custom quantity inputs per item
  const [checkingIn, setCheckingIn] = useState({}) // Track which items are being checked in
  const [productImages, setProductImages] = useState({}) // Cache product images
  const [expandedItems, setExpandedItems] = useState({}) // Track which items have dropdown expanded
  const [productPrices, setProductPrices] = useState({}) // Track edited prices per item
  const [savingPrice, setSavingPrice] = useState({}) // Track which items are saving price
  const [workflowSettings, setWorkflowSettings] = useState({ workflow_mode: 'simple', auto_add_to_inventory: 'true' })
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState(null) // 'verify', 'confirm_pricing', 'ready_for_inventory'
  const [loadingSettings, setLoadingSettings] = useState(true)
  
  // Convert hex to RGB
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
    if (actualId) {
      loadWorkflowSettings()
      loadProgress()
      // Auto-refresh progress every 5 seconds
      const interval = setInterval(loadProgress, 5000)
      return () => clearInterval(interval)
    }
  }, [actualId])

  // Update workflow step when progress changes
  useEffect(() => {
    if (progress && progress.shipment) {
      setCurrentWorkflowStep(progress.shipment.workflow_step || (progress.shipment.status === 'in_progress' ? 'verify' : null))
    }
  }, [progress])

  // Load product images when progress data changes
  useEffect(() => {
    if (progress && progress.pending_items) {
      const loadImages = async () => {
        // Get all products from inventory API instead of individual GET requests
        // (The /api/inventory/<id> endpoint only supports PUT, not GET)
        try {
          const response = await fetch(`/api/inventory`)
          if (response.ok) {
            const data = await response.json()
            const allProducts = data.data || []
            
            // Create a map of product_id -> photo
            const newImages = {}
            progress.pending_items
              .filter(item => item.product_id && !productImages[item.product_id])
              .forEach(item => {
                const product = allProducts.find(p => p.product_id === item.product_id)
                if (product && product.photo) {
                  newImages[item.product_id] = product.photo
                }
              })
            
            if (Object.keys(newImages).length > 0) {
              setProductImages(prev => ({ ...prev, ...newImages }))
            }
          }
        } catch (error) {
          console.error('Error loading product images:', error)
        }
      }
      
      loadImages()
    }
  }, [progress])

  const loadWorkflowSettings = async () => {
    try {
      const response = await fetch('/api/shipment-verification/settings')
      const data = await response.json()
      if (data.success && data.settings) {
        setWorkflowSettings(data.settings)
      }
    } catch (error) {
      console.error('Error loading workflow settings:', error)
    } finally {
      setLoadingSettings(false)
    }
  }

  const loadProgress = async () => {
    try {
      // Add cache busting to ensure fresh data
      const response = await fetch(`/api/shipments/${actualId}/progress?t=${Date.now()}`)
      const data = await response.json()
      setProgress(data)
      if (data.shipment) {
        setCurrentWorkflowStep(data.shipment.workflow_step || (data.shipment.status === 'in_progress' ? 'verify' : null))
      }
      return data
    } catch (error) {
      console.error('Error loading progress:', error)
      return null
    }
  }

  const startSession = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const deviceId = `device_${Date.now()}` // Simple device ID
      
      const response = await fetch(`/api/shipments/${actualId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ 
          device_id: deviceId,
          session_token: sessionToken
        })
      })
      
      if (!response.ok) {
        let errorData
        try {
          const text = await response.text()
          errorData = text ? JSON.parse(text) : { message: `Server error: ${response.status}` }
        } catch (e) {
          errorData = { message: `Server error: ${response.status}` }
        }
        console.error('Error starting session:', response.status, errorData)
        alert(`Failed to start session: ${errorData.message || 'Unknown error'}`)
        return
      }
      
      let data
      try {
        const text = await response.text()
        data = text ? JSON.parse(text) : { success: false }
      } catch (e) {
        console.error('Failed to parse response:', e)
        alert('Failed to parse server response')
        return
      }
      
      if (data.success !== false) {
        setSession(data)
      } else {
        alert(`Failed to start session: ${data.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error starting session:', error)
      alert(`Failed to start verification session: ${error.message}`)
    }
  }

  const handleBarcodeScan = async (barcode) => {
    if (!session) {
      await startSession()
      return
    }

    setScanning(true)
    
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/shipments/${actualId}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          barcode: barcode,
          session_id: session.session_id,
          device_id: `device_${Date.now()}`,
          session_token: sessionToken
        })
      })
      
      const result = await response.json()
      
      if (result.status === 'success') {
        // Show success feedback
        alert(`✓ ${result.item.product_name} - ${result.quantity_verified}/${result.quantity_expected}`)
        
        if (result.fully_verified) {
          alert('Item fully verified!')
        }
      } else if (result.status === 'duplicate') {
        alert('Item already verified')
      } else if (result.status === 'unknown') {
        alert('Item not in shipment - Report issue?')
        setCurrentItem({ barcode: barcode })
        setShowIssueForm(true)
      }
      
      loadProgress()
    } catch (error) {
      console.error('Error scanning:', error)
      alert('Failed to process scan')
    } finally {
      setScanning(false)
    }
  }

  const checkInItem = async (item, quantity) => {
    if (!session) {
      await startSession()
      return
    }

    const itemId = item.pending_item_id
    setCheckingIn(prev => ({ ...prev, [itemId]: true }))

    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const currentVerified = item.quantity_verified || 0
      const remainingQuantity = item.quantity_expected - currentVerified
      const quantityToCheckIn = Math.min(quantity, remainingQuantity)

      if (quantityToCheckIn <= 0) {
        setCheckingIn(prev => ({ ...prev, [itemId]: false }))
        return
      }

      // Calculate new verified quantity
      const newQuantityVerified = currentVerified + quantityToCheckIn

      // Use the direct update endpoint instead of simulating scans
      const response = await fetch(`/api/pending_items/${itemId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          quantity_verified: newQuantityVerified,
          session_token: sessionToken
        })
      })

      if (!response.ok) {
        let errorData
        try {
          const text = await response.text()
          errorData = text ? JSON.parse(text) : { message: `Server error: ${response.status}` }
        } catch (e) {
          errorData = { message: `Server error: ${response.status}` }
        }
        console.error('Error updating item:', response.status, errorData)
        alert(`Failed to check in item: ${errorData.message || 'Unknown error'}`)
        setCheckingIn(prev => ({ ...prev, [itemId]: false }))
        await loadProgress() // Reload to get latest state
        return
      }

      let result
      try {
        const text = await response.text()
        result = text ? JSON.parse(text) : { success: false, message: 'Empty response from server' }
      } catch (e) {
        console.error('Failed to parse response:', e)
        alert('Failed to parse server response')
        setCheckingIn(prev => ({ ...prev, [itemId]: false }))
        await loadProgress()
        return
      }
      
      if (result.success) {
        // Wait a bit for the backend to process
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Reload progress to get updated counts
        let updatedProgress = null
        for (let retry = 0; retry < 3; retry++) {
          updatedProgress = await loadProgress()
          await new Promise(resolve => setTimeout(resolve, 200))
          
          // Check if the progress actually updated
          if (updatedProgress && updatedProgress.pending_items) {
            const updatedItem = updatedProgress.pending_items.find(pi => pi.pending_item_id === itemId)
            if (updatedItem && updatedItem.quantity_verified >= newQuantityVerified) {
              break // Progress was updated, we can stop retrying
            }
          }
        }
      } else {
        console.error('Failed to check in:', result.message || 'Unknown error')
        await loadProgress() // Still reload to get latest state
      }
      
      setCheckingIn(prev => ({ ...prev, [itemId]: false }))
    } catch (error) {
      console.error('Error checking in item:', error)
      setCheckingIn(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const checkInOne = (item) => {
    checkInItem(item, 1)
  }

  const checkInAll = (item) => {
    const remainingQuantity = item.quantity_expected - item.quantity_verified
    if (remainingQuantity > 0) {
      checkInItem(item, remainingQuantity)
    }
  }

  const checkInCustom = (item) => {
    const customQty = customQuantities[item.pending_item_id] || 1
    checkInItem(item, parseInt(customQty) || 1)
    setCustomQuantities(prev => ({ ...prev, [item.pending_item_id]: '' }))
  }

  const handleCustomQuantityChange = (itemId, value) => {
    setCustomQuantities(prev => ({ ...prev, [itemId]: value }))
  }

  const toggleItemDropdown = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }))
    // Initialize price if not set
    if (!productPrices[itemId]) {
      const item = progress?.pending_items?.find(pi => pi.pending_item_id === itemId)
      if (item && item.product_id) {
        // Fetch current product price if product exists
        fetch(`/api/inventory/${item.product_id}`)
          .then(res => res.json())
          .then(data => {
            if (data.data && data.data.product_price) {
              setProductPrices(prev => ({
                ...prev,
                [itemId]: data.data.product_price
              }))
            } else if (item.unit_cost) {
              // Use unit_cost as default if no price set
              setProductPrices(prev => ({
                ...prev,
                [itemId]: item.unit_cost
              }))
            }
          })
          .catch(() => {
            // If fetch fails, use unit_cost as default
            if (item.unit_cost) {
              setProductPrices(prev => ({
                ...prev,
                [itemId]: item.unit_cost
              }))
            }
          })
      } else if (item?.unit_cost) {
        // If no product_id yet, use unit_cost
        setProductPrices(prev => ({
          ...prev,
          [itemId]: item.unit_cost
        }))
      }
    }
  }

  const handlePriceChange = (itemId, value) => {
    setProductPrices(prev => ({
      ...prev,
      [itemId]: value
    }))
  }

  const saveProductPrice = async (item) => {
    const itemId = item.pending_item_id
    const productId = item.product_id
    
    if (!productId) {
      alert('Product not yet created in inventory. Price will be set when item is checked in.')
      return
    }

    const newPrice = parseFloat(productPrices[itemId])
    if (isNaN(newPrice) || newPrice < 0) {
      alert('Please enter a valid price')
      return
    }

    setSavingPrice(prev => ({ ...prev, [itemId]: true }))

    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/inventory/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          product_price: newPrice,
          session_token: sessionToken
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Show success message
        const successMsg = `Price updated to $${newPrice.toFixed(2)}`
        console.log(successMsg)
        // Reload progress to get updated data
        await loadProgress()
      } else {
        alert(result.message || 'Failed to update price')
      }
    } catch (error) {
      console.error('Error saving price:', error)
      alert('Failed to save price. Please try again.')
    } finally {
      setSavingPrice(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const reportIssue = async (issueData) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const formData = new FormData()
      formData.append('pending_item_id', issueData.pending_item_id || '')
      formData.append('issue_type', issueData.issue_type)
      formData.append('description', issueData.description)
      formData.append('quantity_affected', issueData.quantity_affected)
      formData.append('severity', issueData.severity)
      formData.append('session_token', sessionToken)
      
      if (issueData.photo) {
        formData.append('photo', issueData.photo)
      }
      
      const response = await fetch(`/api/shipments/${actualId}/issues`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
        body: formData
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert('Issue reported successfully')
        setShowIssueForm(false)
        loadProgress()
      }
    } catch (error) {
      console.error('Error reporting issue:', error)
      alert('Failed to report issue')
    }
  }

  const completeVerification = async () => {
    if (progress?.progress?.items_with_issues > 0) {
      const confirmed = window.confirm(
        `There are ${progress.progress.items_with_issues} items with issues. Continue anyway?`
      )
      if (!confirmed) return
    }
    
    const notes = window.prompt('Any notes about this shipment?')
    
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/shipments/${actualId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ 
          notes: notes,
          session_token: sessionToken
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Reload progress to get updated step
        await loadProgress()
        
        const workflowMode = workflowSettings.workflow_mode || 'simple'
        
        if (workflowMode === 'simple') {
          alert('Shipment verified and added to inventory!')
          navigate('/shipment-verification')
        } else {
          // Three-step workflow
          if (result.step === 'confirm_pricing') {
            alert('Step 1 complete! Now review and confirm pricing for all items.')
          } else if (result.step === 'ready_for_inventory') {
            alert('Step 2 complete! Ready to add items to inventory.')
          }
        }
      } else {
        alert(result.message || 'Failed to complete step')
      }
    } catch (error) {
      console.error('Error completing verification:', error)
      alert('Failed to complete step')
    }
  }

  const addToInventory = async () => {
    const notes = window.prompt('Any final notes before adding to inventory?')
    
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/shipments/${actualId}/add-to-inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ 
          notes: notes,
          session_token: sessionToken
        })
      })
      
      let result
      try {
        const text = await response.text()
        result = text ? JSON.parse(text) : { success: false }
      } catch (e) {
        result = { success: false, message: 'Failed to parse response' }
      }
      
      if (result.success) {
        alert('Items added to inventory successfully!')
        navigate('/shipment-verification')
      } else {
        alert(result.message || 'Failed to add to inventory')
      }
    } catch (error) {
      console.error('Error adding to inventory:', error)
      alert('Failed to add to inventory')
    }
  }

  if (!progress) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#333' }}>
        <div>Loading shipment details...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <button
        onClick={() => navigate('/shipment-verification')}
        style={{
          marginBottom: '20px',
          padding: '8px 16px',
          backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          cursor: 'pointer',
          color: '#fff',
          fontWeight: 600,
          fontSize: '14px',
          boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
          transition: 'all 0.3s ease'
        }}
      >
        ← Back to Shipments
      </button>

      {/* Header with progress */}
      <div style={{
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Workflow Step Indicators (for three-step workflow) */}
        {workflowSettings.workflow_mode === 'three_step' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              gap: '8px'
            }}>
              {['verify', 'confirm_pricing', 'ready_for_inventory'].map((step, idx) => {
                const stepNames = {
                  'verify': 'Step 1: Verify & Price',
                  'confirm_pricing': 'Step 2: Confirm Pricing',
                  'ready_for_inventory': 'Step 3: Add to Inventory'
                }
                const isActive = currentWorkflowStep === step
                const isCompleted = (step === 'verify' && (currentWorkflowStep === 'confirm_pricing' || currentWorkflowStep === 'ready_for_inventory')) ||
                                  (step === 'confirm_pricing' && currentWorkflowStep === 'ready_for_inventory')
                
                return (
                  <div key={step} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: isCompleted ? `rgba(${themeColorRgb}, 0.9)` : 
                                     isActive ? `rgba(${themeColorRgb}, 0.7)` : 
                                     isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#e0e0e0',
                      color: (isCompleted || isActive) ? '#fff' : (isDarkMode ? 'var(--text-tertiary, #999)' : '#999'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: '14px',
                      border: `2px solid ${isActive ? `rgba(${themeColorRgb}, 0.9)` : 'transparent'}`
                    }}>
                      {isCompleted ? '✓' : (idx + 1)}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? `rgba(${themeColorRgb}, 0.9)` : (isDarkMode ? 'var(--text-tertiary, #999)' : '#666'),
                      flex: 1,
                      minWidth: 0
                    }}>
                      {stepNames[step]}
                    </div>
                    {idx < 2 && (
                      <div style={{
                        flex: 1,
                        height: '2px',
                        backgroundColor: isCompleted ? `rgba(${themeColorRgb}, 0.5)` : (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#e0e0e0'),
                        margin: '0 8px'
                      }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        
        <div style={{ marginBottom: '12px' }}>
          <div style={{
            width: '100%',
            height: '12px',
            backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#e0e0e0',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress.completion_percentage || 0}%`,
              height: '100%',
              backgroundColor: progress.completion_percentage >= 100 
                ? `rgba(${themeColorRgb}, 0.9)` 
                : `rgba(${themeColorRgb}, 0.7)`,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
          <span>
            {progress.progress?.total_verified_quantity || 0} / {progress.progress?.total_expected_quantity || 0} items
          </span>
          <span style={{ fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            {progress.completion_percentage || 0}% Complete
          </span>
          {progress.progress?.items_with_issues > 0 && (
            <span style={{ color: '#f44336' }}>
              ⚠️ {progress.progress.items_with_issues} issues
            </span>
          )}
        </div>
      </div>

      {/* Manual Barcode Entry */}
      <div style={{
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Scan Barcode</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Enter barcode manually or scan"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && manualBarcode.trim()) {
                handleBarcodeScan(manualBarcode.trim())
                setManualBarcode('')
              }
            }}
            style={{
              flex: 1,
              padding: '10px',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
            }}
          />
          <button
            onClick={() => {
              if (manualBarcode.trim()) {
                handleBarcodeScan(manualBarcode.trim())
                setManualBarcode('')
              } else {
                setShowBarcodeScanner(true)
              }
            }}
            disabled={scanning}
            style={{
              padding: '10px 20px',
              backgroundColor: scanning ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.7)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: scanning ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: scanning ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: scanning ? `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)` : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
              transition: 'all 0.3s ease'
            }}
          >
            {scanning ? 'Processing...' : 'Scan'}
          </button>
        </div>
      </div>

      {/* Pending Items List */}
      {progress.pending_items && progress.pending_items.length > 0 && (
        <div style={{
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            Pending Items ({progress.pending_items.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {progress.pending_items.map(item => {
              // Get product image URL - try multiple possible sources
              const productId = item.product_id || item.productId
              const cachedImage = productId ? productImages[productId] : null
              const productImage = cachedImage || item.product_image || item.photo || item.image_url || null
              const imageUrl = productImage ? (productImage.startsWith('http') || productImage.startsWith('/') ? productImage : `/uploads/${productImage}`) : null
              
              const isExpanded = expandedItems[item.pending_item_id]
              const currentPrice = productPrices[item.pending_item_id] ?? (item.product_price ?? item.unit_cost ?? 0)
              const unitCost = item.unit_cost ?? 0
              
              return (
              <div key={item.pending_item_id} style={{
                border: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #e0e0e0',
                borderRadius: '4px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa',
                overflow: 'hidden'
              }}>
                {/* Main Item Row - Clickable */}
                <div 
                  onClick={() => toggleItemDropdown(item.pending_item_id)}
                  style={{
                    padding: '12px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    cursor: 'pointer',
                    backgroundColor: isExpanded 
                      ? (isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#f0f0f0')
                      : (isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'),
                    transition: 'background-color 0.2s ease'
                  }}
                >
                  {/* Product Image */}
                  <div style={{
                    width: '60px',
                    height: '60px',
                    minWidth: '60px',
                    borderRadius: '6px',
                    backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #ddd'
                  }}>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.product_name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          // Hide image on error, show placeholder
                          e.target.style.display = 'none'
                          e.target.parentElement.innerHTML = '<span style="color: var(--text-tertiary, #999); font-size: 24px;">📦</span>'
                        }}
                      />
                    ) : (
                      <span style={{
                        color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999',
                        fontSize: '24px'
                      }}>
                        📦
                      </span>
                    )}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      {item.product_name}
                    </div>
                    <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
                      SKU: {item.product_sku}
                    </div>
                  </div>
                  
                  {/* Expand/Collapse Icon */}
                  <div style={{
                    color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                    fontSize: '18px',
                    transition: 'transform 0.2s ease',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}>
                    ▼
                  </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                    {item.quantity_verified}/{item.quantity_expected}
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Check In 1 Button */}
                    <button
                      onClick={() => checkInOne(item)}
                      disabled={checkingIn[item.pending_item_id] || (item.quantity_verified >= item.quantity_expected)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected) 
                          ? `rgba(${themeColorRgb}, 0.3)` 
                          : `rgba(${themeColorRgb}, 0.7)`,
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        cursor: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected) ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        boxShadow: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                          ? `0 2px 8px rgba(${themeColorRgb}, 0.2)`
                          : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                        transition: 'all 0.3s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      +1
                    </button>
                    
                    {/* Check In All Button */}
                    <button
                      onClick={() => checkInAll(item)}
                      disabled={checkingIn[item.pending_item_id] || (item.quantity_verified >= item.quantity_expected)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                          ? `rgba(${themeColorRgb}, 0.3)`
                          : `rgba(${themeColorRgb}, 0.7)`,
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        cursor: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected) ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        boxShadow: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                          ? `0 2px 8px rgba(${themeColorRgb}, 0.2)`
                          : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                        transition: 'all 0.3s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      All
                    </button>
                    
                    {/* Custom Quantity Input and Button */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        max={item.quantity_expected - item.quantity_verified}
                        value={customQuantities[item.pending_item_id] || ''}
                        onChange={(e) => handleCustomQuantityChange(item.pending_item_id, e.target.value)}
                        placeholder="Qty"
                        disabled={checkingIn[item.pending_item_id] || (item.quantity_verified >= item.quantity_expected)}
                        style={{
                          width: '50px',
                          padding: '4px 6px',
                          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '12px',
                          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          textAlign: 'center'
                        }}
                      />
                      <button
                        onClick={() => checkInCustom(item)}
                        disabled={checkingIn[item.pending_item_id] || !customQuantities[item.pending_item_id] || (item.quantity_verified >= item.quantity_expected)}
                        style={{
                          padding: '6px 10px',
                          backgroundColor: (checkingIn[item.pending_item_id] || !customQuantities[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                            ? `rgba(${themeColorRgb}, 0.3)`
                            : `rgba(${themeColorRgb}, 0.7)`,
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          color: '#fff',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '6px',
                          cursor: (checkingIn[item.pending_item_id] || !customQuantities[item.pending_item_id] || item.quantity_verified >= item.quantity_expected) ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                          boxShadow: (checkingIn[item.pending_item_id] || !customQuantities[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                            ? `0 2px 8px rgba(${themeColorRgb}, 0.2)`
                            : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                          transition: 'all 0.3s ease',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {checkingIn[item.pending_item_id] ? '...' : 'Check'}
                      </button>
                    </div>
                    
                    {/* Report Issue Button */}
                    <button
                      onClick={() => {
                        setCurrentItem(item)
                        setShowIssueForm(true)
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: `rgba(244, 67, 54, 0.7)`,
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        boxShadow: `0 4px 15px rgba(244, 67, 54, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                        transition: 'all 0.3s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Issue
                    </button>
                  </div>
                </div>
                </div>
                
                {/* Expandable Details Dropdown */}
                {isExpanded && (
                  <div style={{
                    padding: '16px',
                    borderTop: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #e0e0e0',
                    backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff'
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px',
                      marginBottom: '16px'
                    }}>
                      {/* Product Details */}
                      <div>
                        <div style={{
                          fontSize: '12px',
                          color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                          marginBottom: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Product Details
                        </div>
                        <div style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                          <div style={{ marginBottom: '4px' }}>
                            <strong>Name:</strong> {item.product_name}
                          </div>
                          <div style={{ marginBottom: '4px' }}>
                            <strong>SKU:</strong> {item.product_sku || 'N/A'}
                          </div>
                          {item.barcode && (
                            <div style={{ marginBottom: '4px' }}>
                              <strong>Barcode:</strong> {item.barcode}
                            </div>
                          )}
                          {item.lot_number && (
                            <div style={{ marginBottom: '4px' }}>
                              <strong>Lot #:</strong> {item.lot_number}
                            </div>
                          )}
                          {item.expiration_date && (
                            <div>
                              <strong>Expiration:</strong> {item.expiration_date}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Cost and Price */}
                      <div>
                        <div style={{
                          fontSize: '12px',
                          color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                          marginBottom: '8px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Pricing
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{
                            fontSize: '14px',
                            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                            marginBottom: '4px'
                          }}>
                            Cost (Unit):
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                          }}>
                            ${unitCost.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div style={{
                            fontSize: '14px',
                            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                            marginBottom: '4px'
                          }}>
                            Selling Price:
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={currentPrice}
                              onChange={(e) => handlePriceChange(item.pending_item_id, e.target.value)}
                              disabled={savingPrice[item.pending_item_id]}
                              style={{
                                flex: 1,
                                padding: '6px 8px',
                                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '16px',
                                fontWeight: 600,
                                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                maxWidth: '120px'
                              }}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                saveProductPrice(item)
                              }}
                              disabled={savingPrice[item.pending_item_id] || !item.product_id}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: (savingPrice[item.pending_item_id] || !item.product_id)
                                  ? `rgba(${themeColorRgb}, 0.3)`
                                  : `rgba(${themeColorRgb}, 0.7)`,
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                color: '#fff',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '4px',
                                cursor: (savingPrice[item.pending_item_id] || !item.product_id) ? 'not-allowed' : 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {savingPrice[item.pending_item_id] ? 'Saving...' : !item.product_id ? 'Save Later' : 'Save Price'}
                            </button>
                          </div>
                          {!item.product_id && (
                            <div style={{
                              fontSize: '11px',
                              color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999',
                              marginTop: '4px',
                              fontStyle: 'italic'
                            }}>
                              Product will be created when checked in
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Quantity Info */}
                      <div>
                        <div style={{
                          fontSize: '12px',
                          color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                          marginBottom: '8px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Quantity
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{
                            fontSize: '14px',
                            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                            marginBottom: '4px'
                          }}>
                            Expected:
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                          }}>
                            {item.quantity_expected}
                          </div>
                        </div>
                        <div>
                          <div style={{
                            fontSize: '14px',
                            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                            marginBottom: '4px'
                          }}>
                            Verified:
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            color: item.quantity_verified >= item.quantity_expected
                              ? `rgba(${themeColorRgb}, 0.9)`
                              : (isDarkMode ? 'var(--text-primary, #fff)' : '#333')
                          }}>
                            {item.quantity_verified || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Issues Summary */}
      {progress.issues && progress.issues.length > 0 && (
        <div style={{
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            Reported Issues ({progress.issues.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {progress.issues.map(issue => (
              <div key={issue.issue_id} style={{
                padding: '12px',
                border: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #e0e0e0',
                borderRadius: '4px',
                borderLeft: `4px solid ${
                  issue.severity === 'critical' ? '#f44336' :
                  issue.severity === 'major' ? '#ff9800' : '#2196f3'
                }`,
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                    {issue.issue_type.replace('_', ' ')}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: issue.severity === 'critical' ? (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#ffebee') : (isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#fff3e0'),
                    color: issue.severity === 'critical' ? '#c62828' : '#e65100',
                    fontSize: '12px',
                    textTransform: 'capitalize'
                  }}>
                    {issue.severity}
                  </span>
                </div>
                <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginBottom: '4px' }}>
                  {issue.product_name}
                </div>
                <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                  {issue.description}
                </div>
                <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999', marginTop: '8px' }}>
                  Reported by {issue.reported_by_name} on {new Date(issue.reported_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow Action Buttons */}
      {progress.is_complete && (() => {
        const workflowMode = workflowSettings.workflow_mode || 'simple'
        const step = currentWorkflowStep || 'verify'
        
        // Simple workflow: Show "Complete & Add to Inventory" button
        if (workflowMode === 'simple') {
          return (
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={completeVerification}
                style={{
                  padding: '12px 24px',
                  backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                  transition: 'all 0.3s ease'
                }}
              >
                Complete & Add to Inventory
              </button>
            </div>
          )
        }
        
        // Three-step workflow: Show different buttons based on step
        if (workflowMode === 'three_step') {
          if (step === 'verify' || !step) {
            // Step 1: Complete verification (move to step 2)
            return (
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={completeVerification}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 600,
                    boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                    transition: 'all 0.3s ease'
                  }}
                >
                  Complete Step 1: Verify & Price → Next Step
                </button>
              </div>
            )
          } else if (step === 'confirm_pricing') {
            // Step 2: Confirm pricing (move to step 3)
            return (
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                    Step 2: Confirm Pricing
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
                    Review all item prices above. Click the button below when you're ready to proceed to adding items to inventory.
                  </p>
                </div>
                <button
                  onClick={completeVerification}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 600,
                    boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                    transition: 'all 0.3s ease'
                  }}
                >
                  Confirm Pricing → Next Step
                </button>
              </div>
            )
          } else if (step === 'ready_for_inventory') {
            // Step 3: Add to inventory
            return (
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                    Step 3: Add to Inventory
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
                    All items have been verified and priced. Click the button below to add items to inventory (put them on the shelf).
                  </p>
                </div>
                <button
                  onClick={addToInventory}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: '#fff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 600,
                    boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                    transition: 'all 0.3s ease'
                  }}
                >
                  Add to Inventory (Put on Shelf)
                </button>
              </div>
            )
          }
        }
        
        // Default fallback
        return (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={completeVerification}
              style={{
                padding: '12px 24px',
                backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 600,
                boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                transition: 'all 0.3s ease'
              }}
            >
              Complete Verification
            </button>
          </div>
        )
      })()}

      {/* Issue Report Form Modal */}
      {showIssueForm && (
        <IssueReportForm
          item={currentItem}
          onSubmit={reportIssue}
          onCancel={() => setShowIssueForm(false)}
        />
      )}

      {/* Barcode Scanner Popup */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={(barcode) => {
            handleBarcodeScan(barcode)
            setShowBarcodeScanner(false)
          }}
          onClose={() => setShowBarcodeScanner(false)}
          themeColor={themeColor}
        />
      )}
    </div>
  )
}

function IssueReportForm({ item, onSubmit, onCancel }) {
  const { themeMode, themeColor } = useTheme()
  const [issueType, setIssueType] = useState('missing')
  const [severity, setSeverity] = useState('minor')
  const [description, setDescription] = useState('')
  const [quantityAffected, setQuantityAffected] = useState(1)
  const [photo, setPhoto] = useState(null)
  
  // Convert hex to RGB
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

  const handleSubmit = () => {
    onSubmit({
      pending_item_id: item?.pending_item_id,
      issue_type: issueType,
      severity: severity,
      description: description,
      quantity_affected: quantityAffected,
      photo: photo
    })
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Report Issue</h3>
        {item?.product_name && (
          <p style={{ margin: '0 0 16px 0', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
            {item.product_name}
          </p>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            Issue Type:
          </label>
          <select
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
            }}
          >
            <option value="missing">Missing Items</option>
            <option value="damaged">Damaged</option>
            <option value="wrong_item">Wrong Item</option>
            <option value="quantity_mismatch">Quantity Mismatch</option>
            <option value="expired">Expired</option>
            <option value="quality">Quality Issue</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            Severity:
          </label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
            }}
          >
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            Quantity Affected:
          </label>
          <input
            type="number"
            value={quantityAffected}
            onChange={(e) => setQuantityAffected(parseInt(e.target.value) || 1)}
            min="1"
            style={{
              width: '100%',
              padding: '8px',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            Description:
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail..."
            rows="4"
            style={{
              width: '100%',
              padding: '8px',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'inherit',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            Photo Evidence (optional):
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setPhoto(e.target.files[0])}
            style={{
              width: '100%',
              padding: '8px',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
              transition: 'all 0.3s ease'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!description.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: !description.trim() ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.7)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: !description.trim() ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: !description.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: !description.trim() ? `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)` : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
              transition: 'all 0.3s ease'
            }}
          >
            Report Issue
          </button>
        </div>
      </div>
    </div>
  )
}

function UploadShipmentModal({ onClose, onSuccess }) {
  const { themeMode, themeColor } = useTheme()
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showAddVendorModal, setShowAddVendorModal] = useState(false)
  const [formData, setFormData] = useState({
    vendor_id: '',
    purchase_order_number: '',
    expected_delivery_date: '',
    document: null,
    verification_mode: 'verify_whole_shipment'
  })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
  // Convert hex to RGB
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
    loadVendors()
  }, [])

  const loadVendors = async () => {
    try {
      const response = await fetch('/api/vendors')
      const data = await response.json()
      if (data.data) {
        setVendors(data.data)
      }
    } catch (error) {
      console.error('Error loading vendors:', error)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Check file type
      const validTypes = ['.pdf', '.xlsx', '.xls', '.csv']
      const fileExt = '.' + file.name.split('.').pop().toLowerCase()
      if (!validTypes.includes(fileExt)) {
        setError('Invalid file type. Please upload PDF, Excel, or CSV file.')
        return
      }
      setFormData({ ...formData, document: file })
      setError(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formData.vendor_id) {
      setError('Please select a vendor')
      return
    }

    if (!formData.document) {
      setError('Please select a document to upload')
      return
    }

    setUploading(true)

    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const uploadFormData = new FormData()
      uploadFormData.append('document', formData.document)
      uploadFormData.append('vendor_id', formData.vendor_id)
      uploadFormData.append('purchase_order_number', formData.purchase_order_number)
      uploadFormData.append('expected_delivery_date', formData.expected_delivery_date)
      uploadFormData.append('verification_mode', formData.verification_mode)
      uploadFormData.append('session_token', sessionToken)

      const response = await fetch('/api/shipments/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        },
        body: uploadFormData
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(`Shipment created successfully! ${result.items_added} items added.`)
        setTimeout(() => {
          onSuccess(result.pending_shipment_id)
        }, 1500)
      } else {
        setError(result.message || 'Failed to upload shipment')
      }
    } catch (error) {
      console.error('Error uploading shipment:', error)
      setError('Error uploading shipment. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Upload New Shipment</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
              padding: '0',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '12px',
            backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9',
            color: '#2e7d32',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              Vendor <span style={{ color: '#f44336' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={formData.vendor_id}
                onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                required
                style={{
                  flex: 1,
                  padding: '10px',
                  border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}
              >
                <option value="">Select a vendor</option>
                {vendors.map(vendor => (
                  <option key={vendor.vendor_id} value={vendor.vendor_id}>
                    {vendor.vendor_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddVendorModal(true)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
                  transition: 'all 0.3s ease'
                }}
              >
                + Add Vendor
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              Purchase Order Number
            </label>
            <input
              type="text"
              value={formData.purchase_order_number}
              onChange={(e) => setFormData({ ...formData, purchase_order_number: e.target.value })}
              placeholder="PO-2024-001"
              style={{
                width: '100%',
                padding: '10px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              Expected Delivery Date
            </label>
            <input
              type="date"
              value={formData.expected_delivery_date}
              onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              Verification Mode
            </label>
            <select
              value={formData.verification_mode}
              onChange={(e) => setFormData({ ...formData, verification_mode: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            >
              <option value="verify_whole_shipment">Verify Whole Shipment (Items added after completion)</option>
              <option value="auto_add">Auto-Add Mode (Items added immediately on check-in)</option>
            </select>
            <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '4px' }}>
              {formData.verification_mode === 'auto_add' 
                ? 'Items will be added to inventory as soon as you check them in'
                : 'Items will be added to inventory only after completing verification'}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              Shipment Document <span style={{ color: '#f44336' }}>*</span>
            </label>
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              onChange={handleFileChange}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            />
            <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', marginTop: '4px' }}>
              Supported formats: PDF, Excel (.xlsx, .xls), CSV
            </div>
            {formData.document && (
              <div style={{ marginTop: '8px', fontSize: '14px', color: '#4caf50' }}>
                ✓ Selected: {formData.document.name}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              style={{
                padding: '10px 20px',
                backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
                transition: 'all 0.3s ease'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !formData.vendor_id || !formData.document}
              style={{
                padding: '10px 20px',
                backgroundColor: (uploading || !formData.vendor_id || !formData.document) ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.7)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#fff',
                border: (uploading || !formData.vendor_id || !formData.document) ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: (uploading || !formData.vendor_id || !formData.document) ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                boxShadow: (uploading || !formData.vendor_id || !formData.document) ? `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)` : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                transition: 'all 0.3s ease'
              }}
            >
              {uploading ? 'Uploading...' : 'Upload & Create Shipment'}
            </button>
          </div>
        </form>
      </div>

      {/* Add Vendor Modal */}
      {showAddVendorModal && (
        <AddVendorModal
          onClose={() => setShowAddVendorModal(false)}
          onSuccess={(vendorId) => {
            setShowAddVendorModal(false)
            loadVendors()
            setFormData({ ...formData, vendor_id: vendorId.toString() })
          }}
        />
      )}
    </div>
  )
}

function AddVendorModal({ onClose, onSuccess }) {
  const { themeMode, themeColor } = useTheme()
  const [vendorData, setVendorData] = useState({
    vendor_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  
  // Convert hex to RGB
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!vendorData.vendor_name.trim()) {
      setError('Vendor name is required')
      return
    }

    setSaving(true)

    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          vendor_name: vendorData.vendor_name.trim(),
          contact_person: vendorData.contact_person.trim() || null,
          email: vendorData.email.trim() || null,
          phone: vendorData.phone.trim() || null,
          address: vendorData.address.trim() || null
        })
      })

      const result = await response.json()

      if (result.success) {
        onSuccess(result.vendor_id)
      } else {
        setError(result.message || 'Failed to create vendor')
      }
    } catch (error) {
      console.error('Error creating vendor:', error)
      setError('Error creating vendor. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1001
    }}>
      <div style={{
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Add New Vendor</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
              padding: '0',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              Vendor Name <span style={{ color: '#f44336' }}>*</span>
            </label>
            <input
              type="text"
              value={vendorData.vendor_name}
              onChange={(e) => setVendorData({ ...vendorData, vendor_name: e.target.value })}
              required
              placeholder="Enter vendor name"
              style={{
                width: '100%',
                padding: '10px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              Contact Person
            </label>
            <input
              type="text"
              value={vendorData.contact_person}
              onChange={(e) => setVendorData({ ...vendorData, contact_person: e.target.value })}
              placeholder="Contact person name"
              style={{
                width: '100%',
                padding: '10px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              Email
            </label>
            <input
              type="email"
              value={vendorData.email}
              onChange={(e) => setVendorData({ ...vendorData, email: e.target.value })}
              placeholder="vendor@example.com"
              style={{
                width: '100%',
                padding: '10px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              Phone
            </label>
            <input
              type="tel"
              value={vendorData.phone}
              onChange={(e) => setVendorData({ ...vendorData, phone: e.target.value })}
              placeholder="(555) 123-4567"
              style={{
                width: '100%',
                padding: '10px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              Address
            </label>
            <textarea
              value={vendorData.address}
              onChange={(e) => setVendorData({ ...vendorData, address: e.target.value })}
              placeholder="Street address, city, state, zip"
              rows="3"
              style={{
                width: '100%',
                padding: '10px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '10px 20px',
                backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
                transition: 'all 0.3s ease'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !vendorData.vendor_name.trim()}
              style={{
                padding: '10px 20px',
                backgroundColor: (saving || !vendorData.vendor_name.trim()) ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.7)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#fff',
                border: (saving || !vendorData.vendor_name.trim()) ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: (saving || !vendorData.vendor_name.trim()) ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                boxShadow: (saving || !vendorData.vendor_name.trim()) ? `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)` : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                transition: 'all 0.3s ease'
              }}
            >
              {saving ? 'Creating...' : 'Create Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ShipmentVerification() {
  const { id } = useParams()
  
  if (id) {
    return <ShipmentVerificationDetail shipmentId={parseInt(id)} />
  }
  
  return <ShipmentVerificationDashboard />
}

