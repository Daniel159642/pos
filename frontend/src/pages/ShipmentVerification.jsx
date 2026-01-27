import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import BarcodeScanner from '../components/BarcodeScanner'
import { Truck, List, Clock, CheckCircle, Plus, FileText, ChevronDown, ScanBarcode, PackageOpen, X, Save, Minus, PanelLeft, AlertTriangle, Check, Camera, Package } from 'lucide-react'
import { FormTitle, FormLabel, FormField, inputBaseStyle, getInputFocusHandlers, formLabelStyle } from '../components/FormStyles'

function ShipmentVerificationDashboard() {
  const { themeMode, themeColor } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingDraftId, setEditingDraftId] = useState(() => {
    // Check if we're editing a draft from URL
    return searchParams.get('draft_id') ? parseInt(searchParams.get('draft_id')) : null
  })
  const [filter, setFilter] = useState(() => {
    // Initialize filter from URL params or default to 'all'
    return searchParams.get('filter') || 'all'
  }) // all, pending, in_progress, completed, new_shipment
  const [sidebarMinimized, setSidebarMinimized] = useState(false)
  const [hoveringShipments, setHoveringShipments] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const shipmentsHeaderRef = useRef(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [isInitialMount, setIsInitialMount] = useState(true)
  
  useEffect(() => {
    const timer = setTimeout(() => setIsInitialMount(false), 0)
    return () => clearTimeout(timer)
  }, [])
  
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

  // Sync filter and draft_id with URL params
  useEffect(() => {
    const urlFilter = searchParams.get('filter') || 'all'
    const urlDraftId = searchParams.get('draft_id')
    
    if (urlFilter !== filter) {
      setFilter(urlFilter)
    }
    
    if (urlDraftId) {
      setEditingDraftId(parseInt(urlDraftId))
    } else {
      setEditingDraftId(null)
    }
  }, [searchParams])

  useEffect(() => {
    if (filter !== 'new_shipment') {
      loadShipments()
      // Auto-refresh every 10 seconds
      const interval = setInterval(loadShipments, 10000)
      return () => clearInterval(interval)
    }
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
      case 'in_progress':
        return `rgba(${themeColorRgb}, 0.7)` // Theme color with medium-high opacity
      case 'draft':
        return `rgba(${themeColorRgb}, 0.5)` // Theme color with lower opacity for drafts
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

  // Filter sections with icons
  const filterSections = [
    { id: 'all', label: 'All', icon: List, filterValue: 'all' },
    { id: 'draft', label: 'Draft', icon: FileText, filterValue: 'draft' },
    { id: 'in_progress', label: 'In Progress', icon: PackageOpen, filterValue: 'in_progress' },
    { id: 'completed', label: 'Completed', icon: CheckCircle, filterValue: 'approved' },
    { id: 'new_shipment', label: 'New Shipment', icon: Plus, filterValue: 'new_shipment' }
  ]

  return (
    <div style={{ 
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      backgroundColor: 'white'
    }}>
      {/* Sidebar Navigation - 1/4 of page */}
      <div style={{
        width: sidebarMinimized ? '60px' : '25%',
        flexShrink: 0,
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        padding: sidebarMinimized ? '32px 10px 48px 10px' : '32px 10px 48px 10px',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        borderRight: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0'}`,
        transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          transition: 'gap 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          paddingTop: '0',
          paddingBottom: '0',
          alignItems: 'stretch'
        }}>
          {/* Shipments Header */}
          <div
            ref={shipmentsHeaderRef}
            style={{ position: 'relative' }}
            onMouseEnter={(e) => {
              setHoveringShipments(true)
              setShowTooltip(true)
              if (shipmentsHeaderRef.current) {
                const rect = shipmentsHeaderRef.current.getBoundingClientRect()
                if (sidebarMinimized) {
                  // Position to the right of the sidebar
                  setTooltipPosition({
                    top: rect.top + rect.height / 2,
                    left: rect.right + 8
                  })
                } else {
                  // Position below the header
                  setTooltipPosition({
                    top: rect.bottom + 4,
                    left: rect.left
                  })
                }
              }
            }}
            onMouseLeave={() => {
              setHoveringShipments(false)
              setShowTooltip(false)
            }}
          >
            <button
              onClick={() => setSidebarMinimized(!sidebarMinimized)}
              style={{
                width: sidebarMinimized ? '40px' : '100%',
                height: '40px',
                padding: '0',
                margin: '0',
                border: 'none',
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarMinimized ? 'center' : 'flex-start',
                transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), justifyContent 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                left: '0',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                transition: 'none'
              }}>
                {sidebarMinimized ? (
                  <PanelLeft size={20} style={{ width: '20px', height: '20px' }} />
                ) : (
                  hoveringShipments ? (
                    <PanelLeft size={20} style={{ width: '20px', height: '20px' }} />
                  ) : (
                    <Truck size={20} style={{ width: '20px', height: '20px' }} />
                  )
                )}
              </div>
              {!sidebarMinimized && (
                <span style={{
                  marginLeft: '48px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  whiteSpace: 'nowrap',
                  opacity: sidebarMinimized ? 0 : 1,
                  transition: isInitialMount ? 'none' : 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  pointerEvents: 'none'
                }}>
                  Shipments
                </span>
              )}
            </button>
          </div>
          {showTooltip && (
            <div
              style={{
                position: 'fixed',
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
                transform: sidebarMinimized ? 'translateY(-50%)' : 'none',
                padding: '4px 8px',
                backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.85)',
                color: 'white',
                fontSize: '12px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                zIndex: 10000,
                pointerEvents: 'none'
              }}
            >
              {sidebarMinimized ? 'Open sidebar' : 'Close sidebar'}
            </div>
          )}
          
          {/* Filter Navigation */}
          {filterSections.map((section) => {
            const Icon = section.icon
            const isActive = filter === section.filterValue
            return (
              <button
                key={section.id}
                onClick={() => {
                  setFilter(section.filterValue)
                  setSearchParams({ filter: section.filterValue })
                }}
                style={{
                  width: sidebarMinimized ? '40px' : '100%',
                  height: '40px',
                  padding: '0',
                  margin: '0',
                  border: 'none',
                  backgroundColor: isActive 
                    ? (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                    : 'transparent',
                  borderRadius: isActive ? '6px' : '0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarMinimized ? 'center' : 'flex-start',
                  transition: isInitialMount ? 'backgroundColor 0.2s ease, borderRadius 0.2s ease' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), justifyContent 0.4s cubic-bezier(0.4, 0, 0.2, 1), backgroundColor 0.2s ease, borderRadius 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  color: isActive 
                    ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333')
                    : (isDarkMode ? 'var(--text-secondary, #ccc)' : '#666')
                }}
              >
                <div style={{
                  position: 'absolute',
                  left: '0',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  transition: 'none'
                }}>
                  <Icon size={20} style={{ width: '20px', height: '20px' }} />
                </div>
                {!sidebarMinimized && (
                  <span style={{
                    marginLeft: '48px',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 'normal',
                    whiteSpace: 'nowrap',
                    opacity: sidebarMinimized ? 0 : 1,
                    transition: isInitialMount ? 'none' : 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    pointerEvents: 'none'
                  }}>
                    {section.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area - 3/4 of page */}
      <div style={{
        width: sidebarMinimized ? 'calc(100% - 60px)' : '75%',
        flex: 1,
        padding: '48px 64px 64px 64px',
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        maxWidth: sidebarMinimized ? 'none' : '1200px',
        transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {(filter === 'new_shipment' || editingDraftId) ? (
          <UploadShipmentForm
            onClose={() => {
              setEditingDraftId(null)
              if (filter === 'new_shipment') {
                setFilter('all')
                setSearchParams({ filter: 'all' })
              } else {
                const params = new URLSearchParams(searchParams)
                params.delete('draft_id')
                setSearchParams(params)
              }
            }}
            onSuccess={(shipmentId) => {
              setEditingDraftId(null)
              // Navigate to in_progress tab
              setFilter('in_progress')
              setSearchParams({ filter: 'in_progress' })
              loadShipments()
            }}
          />
        ) : (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '18px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>Loading shipments...</div>
              </div>
            ) : shipments.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
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
                    currentFilter={filter}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ShipmentCard({ shipment, getStatusColor, getProgressColor, isDarkMode, themeColorRgb, currentFilter }) {
  const navigate = useNavigate()
  const progress = typeof shipment.progress_percentage === 'number' 
    ? shipment.progress_percentage 
    : parseFloat(shipment.progress_percentage) || 0
  const status = shipment.status || 'in_progress'

  return (
    <div style={{
      backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
      border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
      cursor: 'pointer'
    }}
    onClick={() => {
      if (shipment.status === 'draft') {
        // For drafts, keep filter as 'draft' but add draft_id to show editing form
        navigate(`/shipment-verification?filter=draft&draft_id=${shipment.pending_shipment_id}`)
      } else {
        navigate(`/shipment-verification/${shipment.pending_shipment_id}?filter=${currentFilter || 'all'}`)
      }
    }}
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
  const [searchParams] = useSearchParams()
  const { themeMode, themeColor } = useTheme()
  const actualId = shipmentId || id
  const navigate = useNavigate()
  const sourceFilter = searchParams.get('filter') || 'all'
  const [sidebarMinimized, setSidebarMinimized] = useState(false)
  const [hoveringShipments, setHoveringShipments] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const shipmentsHeaderRef = useRef(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [isInitialMount, setIsInitialMount] = useState(true)
  const hasInteractedRef = useRef(false)
  
  useEffect(() => {
    // Keep transitions disabled for longer to prevent initial animation
    const timer = setTimeout(() => {
      setIsInitialMount(false)
    }, 500) // Longer delay to ensure no animation on page load
    return () => clearTimeout(timer)
  }, [])
  
  const handleSidebarToggle = () => {
    if (!hasInteractedRef.current) {
      hasInteractedRef.current = true
      // Enable transitions immediately when user interacts
      setIsInitialMount(false)
    }
    setSidebarMinimized(!sidebarMinimized)
  }
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
  const [showImageUploadModal, setShowImageUploadModal] = useState(false)
  const [selectedItemForImage, setSelectedItemForImage] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [verificationPhotos, setVerificationPhotos] = useState({}) // Cache verification photos
  const [imageErrors, setImageErrors] = useState({}) // Track which images failed to load
  const [loadError, setLoadError] = useState(null) // Track loading errors
  
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

  // Load product images and verification photos when progress data changes
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
            const newVerificationPhotos = {}
            
            progress.pending_items.forEach(item => {
              // Load product images
              if (item.product_id && !productImages[item.product_id]) {
                const product = allProducts.find(p => p.product_id === item.product_id)
                if (product && product.photo) {
                  newImages[item.product_id] = product.photo
                }
              }
              
              // Load verification photos
              if (item.verification_photo && !verificationPhotos[item.pending_item_id]) {
                newVerificationPhotos[item.pending_item_id] = item.verification_photo
              }
            })
            
            if (Object.keys(newImages).length > 0) {
              setProductImages(prev => ({ ...prev, ...newImages }))
            }
            
            if (Object.keys(newVerificationPhotos).length > 0) {
              setVerificationPhotos(prev => ({ ...prev, ...newVerificationPhotos }))
            }
          }
        } catch (error) {
          console.error('Error loading product images:', error)
        }
      }
      
      loadImages()
    }
  }, [progress])
  
  // Clear image errors when verification photos are detected
  useEffect(() => {
    if (progress && progress.pending_items) {
      setImageErrors(prev => {
        const newErrors = { ...prev }
        let cleared = false
        progress.pending_items.forEach(item => {
          if (item.verification_photo && newErrors[item.pending_item_id]) {
            delete newErrors[item.pending_item_id]
            cleared = true
          }
        })
        if (cleared) {
          console.log('Cleared image errors for items with verification photos')
        }
        return newErrors
      })
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
      setLoadError(null) // Clear previous errors
      // Add cache busting to ensure fresh data
      const response = await fetch(`/api/shipments/${actualId}/progress?t=${Date.now()}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Check if response has an error field
      if (data.error) {
        throw new Error(data.error)
      }
      
      // Validate data structure
      if (!data.shipment && !data.pending_items) {
        throw new Error('Invalid response: missing shipment data')
      }
      
      setProgress(data)
      if (data.shipment) {
        setCurrentWorkflowStep(data.shipment.workflow_step || (data.shipment.status === 'in_progress' ? 'verify' : null))
      }
      
      // Clear image errors for items that have verification photos - allow retry
      if (data.pending_items) {
        setImageErrors(prev => {
          const newErrors = { ...prev }
          let clearedCount = 0
          data.pending_items.forEach(item => {
            if (item.verification_photo && newErrors[item.pending_item_id]) {
              delete newErrors[item.pending_item_id]
              clearedCount++
            }
          })
          if (clearedCount > 0) {
            console.log(`Cleared ${clearedCount} image error(s) to allow retry`)
          }
          return newErrors
        })
      }
      
      return data
    } catch (error) {
      console.error('Error loading progress:', error)
      setLoadError(error.message || 'Failed to load shipment details')
      setProgress(null) // Clear progress on error
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

  const handleImageUpload = async (file, item) => {
    if (!file) return
    
    setUploadingImage(true)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const formData = new FormData()
      formData.append('photo', file)
      
      const response = await fetch(`/api/pending_items/${item.pending_item_id}/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        },
        body: formData
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Update local state with the new verification photo
        if (data.verification_photo) {
          console.log('Photo uploaded successfully:', data.verification_photo)
          setVerificationPhotos(prev => ({
            ...prev,
            [item.pending_item_id]: data.verification_photo
          }))
          // Clear any previous image errors for this item - IMPORTANT!
          setImageErrors(prev => {
            const newErrors = { ...prev }
            delete newErrors[item.pending_item_id]
            console.log('Cleared image error for item:', item.pending_item_id, 'new errors:', newErrors)
            return newErrors
          })
        }
        // Small delay to ensure state updates
        await new Promise(resolve => setTimeout(resolve, 100))
        // Reload progress to get updated data
        await loadProgress()
        setShowImageUploadModal(false)
        setSelectedItemForImage(null)
      } else {
        alert(`Failed to upload image: ${data.message || 'Unknown error'}`)
        console.error('Upload failed:', data)
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      alert(`Failed to upload image: ${error.message}`)
    } finally {
      setUploadingImage(false)
    }
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
        // Fetch all products and find the one we need (since GET /api/inventory/<id> is not supported)
        fetch(`/api/inventory`)
          .then(res => res.json())
          .then(data => {
            if (data.data) {
              const product = data.data.find(p => p.product_id === item.product_id)
              if (product && product.product_price) {
                setProductPrices(prev => ({
                  ...prev,
                  [itemId]: product.product_price
                }))
              } else if (item.unit_cost) {
                // Use unit_cost as default if no price set
                setProductPrices(prev => ({
                  ...prev,
                  [itemId]: item.unit_cost
                }))
              }
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
    // Remove any non-digit characters except decimal point
    let cleaned = value.replace(/[^\d.]/g, '')
    
    // Ensure only one decimal point
    const parts = cleaned.split('.')
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('')
    }
    
    // If it's empty, set to "0."
    if (cleaned === '') {
      setProductPrices(prev => ({
        ...prev,
        [itemId]: '0.'
      }))
      return
    }
    
    // If it doesn't have a decimal point, add one
    if (!cleaned.includes('.')) {
      cleaned = cleaned + '.'
    }
    
    // Limit to 2 decimal places
    if (cleaned.includes('.')) {
      const [integer, decimal] = cleaned.split('.')
      if (decimal && decimal.length > 2) {
        cleaned = integer + '.' + decimal.substring(0, 2)
      }
    }
    
    setProductPrices(prev => ({
      ...prev,
      [itemId]: cleaned
    }))
  }
  
  const formatPriceForDisplay = (price) => {
    if (price === '' || price === null || price === undefined) return '0.'
    // If it's already a string with decimal, return as is
    if (typeof price === 'string' && price.includes('.')) {
      return price
    }
    const num = parseFloat(price)
    if (isNaN(num)) return '0.'
    // Always show with decimal point
    const formatted = num.toFixed(2)
    return formatted
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
        {loadError ? (
          <div>
            <div style={{ color: '#f44336', marginBottom: '16px', fontSize: '18px' }}>
              ⚠️ Error loading shipment
            </div>
            <div style={{ marginBottom: '16px' }}>{loadError}</div>
            <button
              onClick={() => {
                setLoadError(null)
                loadProgress()
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div>Loading shipment details...</div>
        )}
      </div>
    )
  }

  // Exclude summary rows (TOTAL, SUBTOTAL, etc.) from vendor sheets — they are not verifiable line items
  const SUMMARY_SKUS = ['TOTAL', 'SUBTOTAL', 'GRAND TOTAL', 'TOTAL ITEMS']
  const verifiableItems = (progress.pending_items || []).filter((item) => {
    const sku = String(item.product_sku ?? '').trim().toUpperCase()
    return !SUMMARY_SKUS.includes(sku)
  })

  // Filter sections with icons
  const filterSections = [
    { id: 'all', label: 'All', icon: List, filterValue: 'all' },
    { id: 'draft', label: 'Draft', icon: FileText, filterValue: 'draft' },
    { id: 'in_progress', label: 'In Progress', icon: PackageOpen, filterValue: 'in_progress' },
    { id: 'completed', label: 'Completed', icon: CheckCircle, filterValue: 'approved' },
    { id: 'new_shipment', label: 'New Shipment', icon: Plus, filterValue: 'new_shipment' }
  ]

  return (
    <>
      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      <div style={{ 
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'white'
      }}>
      {/* Sidebar Navigation - 1/4 of page */}
      <div style={{
        width: sidebarMinimized ? '60px' : '25%',
        flexShrink: 0,
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        padding: sidebarMinimized ? '32px 10px 48px 10px' : '32px 10px 48px 10px',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        borderRight: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0'}`,
        transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          transition: 'gap 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          paddingTop: '0',
          paddingBottom: '0',
          alignItems: 'stretch'
        }}>
          {/* Shipments Header */}
          <div
            ref={shipmentsHeaderRef}
            style={{ position: 'relative' }}
            onMouseEnter={(e) => {
              setHoveringShipments(true)
              setShowTooltip(true)
              if (shipmentsHeaderRef.current) {
                const rect = shipmentsHeaderRef.current.getBoundingClientRect()
                if (sidebarMinimized) {
                  setTooltipPosition({
                    top: rect.top + rect.height / 2,
                    left: rect.right + 8
                  })
                } else {
                  setTooltipPosition({
                    top: rect.bottom + 4,
                    left: rect.left
                  })
                }
              }
            }}
            onMouseLeave={() => {
              setHoveringShipments(false)
              setShowTooltip(false)
            }}
          >
            <button
              onClick={handleSidebarToggle}
              style={{
                width: sidebarMinimized ? '40px' : '100%',
                height: '40px',
                padding: '0',
                margin: '0',
                border: 'none',
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarMinimized ? 'center' : 'flex-start',
                transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), justifyContent 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                left: '0',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                transition: 'none'
              }}>
                {sidebarMinimized ? (
                  <PanelLeft size={20} style={{ width: '20px', height: '20px' }} />
                ) : (
                  hoveringShipments ? (
                    <PanelLeft size={20} style={{ width: '20px', height: '20px' }} />
                  ) : (
                    <Truck size={20} style={{ width: '20px', height: '20px' }} />
                  )
                )}
              </div>
              {!sidebarMinimized && (
                <span style={{
                  marginLeft: '48px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  whiteSpace: 'nowrap',
                  opacity: sidebarMinimized ? 0 : 1,
                  transition: isInitialMount ? 'none' : 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  pointerEvents: 'none'
                }}>
                  Shipments
                </span>
              )}
            </button>
          </div>
          {showTooltip && (
            <div
              style={{
                position: 'fixed',
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
                transform: sidebarMinimized ? 'translateY(-50%)' : 'none',
                padding: '4px 8px',
                backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.85)',
                color: 'white',
                fontSize: '12px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                zIndex: 10000,
                pointerEvents: 'none'
              }}
            >
              {sidebarMinimized ? 'Open sidebar' : 'Close sidebar'}
            </div>
          )}
          
          {/* Filter Navigation */}
          {filterSections.map((section) => {
            const Icon = section.icon
            const isActive = section.filterValue === sourceFilter
            return (
              <button
                key={section.id}
                onClick={() => {
                  if (section.filterValue === 'new_shipment') {
                    navigate('/shipment-verification?filter=new_shipment')
                  } else {
                    navigate(`/shipment-verification?filter=${section.filterValue}`)
                  }
                }}
                style={{
                  width: sidebarMinimized ? '40px' : '100%',
                  height: '40px',
                  padding: '0',
                  margin: '0',
                  border: 'none',
                  backgroundColor: isActive 
                    ? (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                    : 'transparent',
                  borderRadius: isActive ? '6px' : '0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarMinimized ? 'center' : 'flex-start',
                  transition: isInitialMount ? 'backgroundColor 0.2s ease, borderRadius 0.2s ease' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), justifyContent 0.4s cubic-bezier(0.4, 0, 0.2, 1), backgroundColor 0.2s ease, borderRadius 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  color: isActive 
                    ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333')
                    : (isDarkMode ? 'var(--text-secondary, #ccc)' : '#666')
                }}
              >
                <div style={{
                  position: 'absolute',
                  left: '0',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  transition: 'none'
                }}>
                  <Icon size={20} style={{ width: '20px', height: '20px' }} />
                </div>
                {!sidebarMinimized && (
                  <span style={{
                    marginLeft: '48px',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 'normal',
                    whiteSpace: 'nowrap',
                    opacity: sidebarMinimized ? 0 : 1,
                    transition: isInitialMount ? 'none' : 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    pointerEvents: 'none'
                  }}>
                    {section.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area - 3/4 of page */}
      <div style={{
        width: sidebarMinimized ? 'calc(100% - 60px)' : '75%',
        flex: 1,
        padding: '48px 64px 64px 64px',
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        maxWidth: sidebarMinimized ? 'none' : '1200px',
        transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>

      {/* Manual Barcode Entry */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="text"
            placeholder="Search orders..."
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
              padding: '4px',
              width: '40px',
              height: '40px',
              backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: scanning ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              if (!scanning) {
                e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
                e.target.style.boxShadow = `0 4px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
              }
            }}
            onMouseLeave={(e) => {
              if (!scanning) {
                e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
                e.target.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
              }
            }}
            title="Scan barcode to search orders"
          >
            <ScanBarcode size={24} />
          </button>
        </div>
      </div>

      {/* Header with progress */}
      <div style={{
        marginBottom: '20px'
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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '14px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
          <div style={{ flex: 1 }}>
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
          <span>
            {progress.progress?.total_verified_quantity || 0} / {progress.progress?.total_expected_quantity || 0} items
          </span>
          <span style={{ fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            {progress.completion_percentage || 0}% Complete
          </span>
          {verifiableItems.length > 0 && (
            <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              Pending Items ({verifiableItems.length})
            </span>
          )}
          {progress.progress?.items_with_issues > 0 && (
            <span style={{ color: '#f44336' }}>
              ⚠️ {progress.progress.items_with_issues} issues
            </span>
          )}
        </div>
      </div>

      {/* Pending Items List */}
      {verifiableItems.length > 0 && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {verifiableItems.map(item => {
              // Get product image URL - try multiple possible sources
              const productId = item.product_id || item.productId
              const cachedImage = productId ? productImages[productId] : null
              const productImage = cachedImage || item.product_image || item.photo || item.image_url || null
              // Check for verification photo first, then product image
              const verificationPhoto = item.verification_photo || verificationPhotos[item.pending_item_id]
              const displayImage = verificationPhoto || productImage
              
              // Construct image URL - handle both relative paths and full paths
              let imageUrl = null
              if (displayImage) {
                if (displayImage.startsWith('http://') || displayImage.startsWith('https://')) {
                  imageUrl = displayImage
                } else if (displayImage.startsWith('/')) {
                  // Already absolute path
                  imageUrl = displayImage
                } else if (displayImage.startsWith('uploads/')) {
                  // Path starts with uploads/ - make it absolute
                  imageUrl = `/${displayImage}`
                } else {
                  // Relative path - prepend /uploads/
                  imageUrl = `/uploads/${displayImage}`
                }
              }
              
              // Debug logging - only log if there's an issue
              if (imageUrl && imageErrors[item.pending_item_id]) {
                console.log(`[Item ${item.pending_item_id}] ⚠️ Image URL exists but has error flag. Clearing error to retry...`)
                // Clear the error to allow retry
                setTimeout(() => {
                  setImageErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors[item.pending_item_id]
                    return newErrors
                  })
                }, 100)
              }
              
              const isExpanded = expandedItems[item.pending_item_id]
              const currentPrice = productPrices[item.pending_item_id] ?? (item.product_price ?? item.unit_cost ?? 0)
              const unitCost = parseFloat(item.unit_cost) || 0
              const priceFocusHandlers = getInputFocusHandlers(themeColorRgb, isDarkMode)
              
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
                  {/* Product Image - Clickable */}
                  <div 
                    onClick={() => {
                      setSelectedItemForImage(item)
                      setShowImageUploadModal(true)
                    }}
                    style={{
                      width: '60px',
                      height: '60px',
                      minWidth: '60px',
                      borderRadius: '6px',
                      backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      border: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #ddd',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.8'
                      e.currentTarget.style.transform = 'scale(1.05)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1'
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                    title="Click to add or take a photo"
                  >
                    {imageUrl ? (
                      !imageErrors[item.pending_item_id] ? (
                        <>
                          <img
                            key={`img-${item.pending_item_id}-${imageUrl}`}
                            src={imageUrl}
                            alt={item.product_name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                              maxWidth: '100%',
                              maxHeight: '100%'
                            }}
                            onError={(e) => {
                              // Mark this image as failed
                              console.error('❌ Image failed to load:', imageUrl, 'for item:', item.pending_item_id)
                              console.error('Attempted URL:', e.target?.src)
                              console.error('Error details:', e.target?.naturalWidth, e.target?.naturalHeight)
                              setImageErrors(prev => ({
                                ...prev,
                                [item.pending_item_id]: true
                              }))
                            }}
                            onLoad={(e) => {
                              console.log('✅ Image loaded successfully:', imageUrl, 'for item:', item.pending_item_id)
                              console.log('Image size:', e.target.naturalWidth, 'x', e.target.naturalHeight)
                            }}
                          />
                        {/* Camera icon overlay to indicate clickable */}
                        <div style={{
                          position: 'absolute',
                          bottom: '2px',
                          right: '2px',
                          backgroundColor: 'rgba(0, 0, 0, 0.6)',
                          borderRadius: '4px',
                          padding: '2px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2,
                          pointerEvents: 'none'
                        }}>
                          <Camera size={12} color="#fff" />
                        </div>
                        {/* Badge if verification photo exists */}
                        {verificationPhoto && (
                          <div style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            backgroundColor: `rgba(${themeColorRgb}, 0.9)`,
                            borderRadius: '50%',
                            width: '12px',
                            height: '12px',
                            border: '2px solid white',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            zIndex: 3,
                            pointerEvents: 'none'
                          }} title="Verification photo added" />
                        )}
                      </>
                      ) : (
                        // Image previously failed - show placeholder but allow retry
                        <Package 
                          size={24} 
                          style={{
                            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999'
                          }} 
                        />
                      )
                    ) : (
                      <>
                        <Package 
                          size={24} 
                          style={{
                            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999'
                          }} 
                        />
                        {/* Camera icon overlay */}
                        <div style={{
                          position: 'absolute',
                          bottom: '2px',
                          right: '2px',
                          backgroundColor: 'rgba(0, 0, 0, 0.6)',
                          borderRadius: '4px',
                          padding: '2px 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Camera size={12} color="#fff" />
                        </div>
                      </>
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
                  
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                    {item.quantity_verified}/{item.quantity_expected}
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Check In 1 Button */}
                    <button
                      onClick={() => checkInOne(item)}
                      disabled={checkingIn[item.pending_item_id] || (item.quantity_verified >= item.quantity_expected)}
                      style={{
                        padding: '4px 16px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap',
                        backgroundColor: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected) 
                          ? 'var(--bg-tertiary)' 
                          : `rgba(${themeColorRgb}, 0.7)`,
                        border: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                          ? `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`
                          : `1px solid rgba(${themeColorRgb}, 0.5)`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected) ? 500 : 600,
                        color: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected) ? 'var(--text-secondary)' : '#fff',
                        cursor: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                          ? 'none'
                          : `0 4px 15px rgba(${themeColorRgb}, 0.3)`
                      }}
                    >
                      +1
                    </button>
                    
                    {/* Check In All Button */}
                    <button
                      onClick={() => checkInAll(item)}
                      disabled={checkingIn[item.pending_item_id] || (item.quantity_verified >= item.quantity_expected)}
                      style={{
                        padding: '4px 16px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        whiteSpace: 'nowrap',
                        backgroundColor: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                          ? 'var(--bg-tertiary)'
                          : `rgba(${themeColorRgb}, 0.7)`,
                        border: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                          ? `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`
                          : `1px solid rgba(${themeColorRgb}, 0.5)`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected) ? 500 : 600,
                        color: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected) ? 'var(--text-secondary)' : '#fff',
                        cursor: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: (checkingIn[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                          ? 'none'
                          : `0 4px 15px rgba(${themeColorRgb}, 0.3)`
                      }}
                    >
                      All
                    </button>
                    
                    {/* Custom Quantity Input and Button Combined */}
                    <button
                      onClick={() => {
                        if (customQuantities[item.pending_item_id]) {
                          checkInCustom(item)
                        }
                      }}
                      disabled={checkingIn[item.pending_item_id] || !customQuantities[item.pending_item_id] || (item.quantity_verified >= item.quantity_expected)}
                      style={{
                        padding: '0',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: (checkingIn[item.pending_item_id] || !customQuantities[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                          ? 'var(--bg-tertiary)'
                          : `rgba(${themeColorRgb}, 0.7)`,
                        border: (checkingIn[item.pending_item_id] || !customQuantities[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                          ? `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`
                          : `1px solid rgba(${themeColorRgb}, 0.5)`,
                        borderRadius: '8px',
                        cursor: (checkingIn[item.pending_item_id] || !customQuantities[item.pending_item_id] || item.quantity_verified >= item.quantity_expected) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: (checkingIn[item.pending_item_id] || !customQuantities[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                          ? 'none'
                          : `0 4px 15px rgba(${themeColorRgb}, 0.3)`,
                        overflow: 'hidden'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customQuantities[item.pending_item_id]) {
                          checkInCustom(item)
                        }
                      }}
                    >
                      <input
                        type="number"
                        min="1"
                        max={item.quantity_expected - item.quantity_verified}
                        value={customQuantities[item.pending_item_id] || ''}
                        onChange={(e) => handleCustomQuantityChange(item.pending_item_id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (customQuantities[item.pending_item_id]) {
                              checkInCustom(item)
                            }
                          }
                          e.stopPropagation()
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Qty"
                        disabled={checkingIn[item.pending_item_id] || (item.quantity_verified >= item.quantity_expected)}
                        style={{
                          width: '50px',
                          padding: '4px 6px',
                          border: 'none',
                          borderRadius: '0',
                          fontSize: '12px',
                          backgroundColor: 'transparent',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          textAlign: 'center',
                          outline: 'none',
                          MozAppearance: 'textfield',
                          WebkitAppearance: 'none',
                          appearance: 'none'
                        }}
                      />
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingRight: '8px',
                        color: (checkingIn[item.pending_item_id] || !customQuantities[item.pending_item_id] || item.quantity_verified >= item.quantity_expected)
                          ? 'var(--text-secondary)'
                          : '#fff'
                      }}>
                        {checkingIn[item.pending_item_id] ? (
                          <span style={{ fontSize: '12px' }}>...</span>
                        ) : (
                          <Check size={16} />
                        )}
                      </div>
                    </button>
                    
                    {/* Report Issue Button */}
                    <button
                      onClick={() => {
                        setCurrentItem(item)
                        setShowIssueForm(true)
                      }}
                      style={{
                        padding: '0',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: `rgba(244, 67, 54, 0.7)`,
                        border: `1px solid rgba(244, 67, 54, 0.5)`,
                        borderRadius: '8px',
                        color: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: `0 4px 15px rgba(244, 67, 54, 0.3)`
                      }}
                    >
                      <AlertTriangle size={16} />
                    </button>
                  </div>
                  
                  {/* Expand/Collapse Icon - Right side */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                    transition: 'transform 0.2s ease, color 0.2s ease',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    flexShrink: 0,
                    marginLeft: '8px'
                  }}>
                    <ChevronDown size={20} />
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
                            ${(typeof unitCost === 'number' ? unitCost : parseFloat(unitCost) || 0).toFixed(2)}
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
                              type="text"
                              inputMode="decimal"
                              value={productPrices[item.pending_item_id] !== undefined 
                                ? (productPrices[item.pending_item_id] || '0.')
                                : formatPriceForDisplay(currentPrice)}
                              onChange={(e) => handlePriceChange(item.pending_item_id, e.target.value)}
                              onBlur={(e) => {
                                const value = e.target.value
                                // Ensure it always has a decimal point with 2 decimal places
                                if (value) {
                                  const num = parseFloat(value)
                                  if (!isNaN(num)) {
                                    const formatted = num.toFixed(2)
                                    handlePriceChange(item.pending_item_id, formatted)
                                  } else if (!value.includes('.')) {
                                    // If it's not a valid number but doesn't have decimal, add it
                                    handlePriceChange(item.pending_item_id, value + '.00')
                                  }
                                } else {
                                  // If empty, set to 0.00
                                  handlePriceChange(item.pending_item_id, '0.00')
                                }
                                // Apply blur handler from FormStyles
                                priceFocusHandlers.onBlur(e)
                              }}
                              onFocus={priceFocusHandlers.onFocus}
                              disabled={savingPrice[item.pending_item_id]}
                              placeholder="0.00"
                              style={{
                                width: '80px',
                                padding: '4px 8px',
                                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 500,
                                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                outline: 'none',
                                transition: 'all 0.2s ease'
                              }}
                            />
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

      {/* Image Upload Modal */}
      {showImageUploadModal && selectedItemForImage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
              Add Photo for {selectedItemForImage.product_name}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                id="image-file-input"
                onChange={(e) => {
                  const file = e.target.files[0]
                  if (file) {
                    handleImageUpload(file, selectedItemForImage)
                  }
                }}
                style={{ display: 'none' }}
              />
              
              <button
                onClick={() => document.getElementById('image-file-input').click()}
                disabled={uploadingImage}
                style={{
                  padding: '12px 20px',
                  backgroundColor: uploadingImage 
                    ? `rgba(${themeColorRgb}, 0.4)` 
                    : `rgba(${themeColorRgb}, 0.7)`,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: uploadingImage ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {uploadingImage ? (
                  <>
                    <span>⏳</span>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Camera size={16} />
                    <span>Take Photo or Choose File</span>
                  </>
                )}
              </button>
              
              <div style={{
                fontSize: '12px',
                color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                textAlign: 'center'
              }}>
                Click to take a photo with your camera or select an image file
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowImageUploadModal(false)
                  setSelectedItemForImage(null)
                }}
                disabled={uploadingImage}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#e0e0e0',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: uploadingImage ? 'not-allowed' : 'pointer',
                  fontWeight: 500
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
          onClose={() => setShowBarcodeScanner(false)}
          themeColor={themeColor}
        />
      )}
      </div>
    </div>
    </>
  )
}

function IssueReportForm({ item, onSubmit, onCancel }) {
  const { themeMode, themeColor } = useTheme()
  const [issueType, setIssueType] = useState('missing')
  const [description, setDescription] = useState('')
  const [quantityAffected, setQuantityAffected] = useState(1)
  const [photo, setPhoto] = useState(null)
  const [focusedField, setFocusedField] = useState(null)
  const [showPhotoMenu, setShowPhotoMenu] = useState(false)
  const photoMenuRef = useRef(null)
  
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

  // Close photo menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (photoMenuRef.current && !photoMenuRef.current.contains(event.target)) {
        setShowPhotoMenu(false)
      }
    }

    if (showPhotoMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPhotoMenu])

  const handleSubmit = () => {
    onSubmit({
      pending_item_id: item?.pending_item_id,
      issue_type: issueType,
      severity: 'minor', // Default severity
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
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <FormTitle isDarkMode={isDarkMode}>Report Issue</FormTitle>
        {item?.product_name && (
          <p style={{ margin: '0 0 24px 0', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
            {item.product_name}
          </p>
        )}

        <FormField>
          <FormLabel isDarkMode={isDarkMode}>Issue Type</FormLabel>
          <CustomDropdown
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            options={[
              { value: 'missing', label: 'Missing Items' },
              { value: 'damaged', label: 'Damaged' },
              { value: 'wrong_item', label: 'Wrong Item' },
              { value: 'quantity_mismatch', label: 'Quantity Mismatch' },
              { value: 'expired', label: 'Expired' },
              { value: 'quality', label: 'Quality Issue' },
              { value: 'other', label: 'Other' }
            ]}
            placeholder="Select issue type"
            isDarkMode={isDarkMode}
            themeColorRgb={themeColorRgb}
          />
        </FormField>

        <FormField>
          <FormLabel isDarkMode={isDarkMode}>Quantity Affected</FormLabel>
          <input
            type="number"
            value={quantityAffected}
            onChange={(e) => setQuantityAffected(parseInt(e.target.value) || 1)}
            min="1"
            onFocus={() => setFocusedField('quantity')}
            onBlur={() => setFocusedField(null)}
            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
            style={inputBaseStyle(isDarkMode, themeColorRgb, focusedField === 'quantity')}
          />
        </FormField>

        <FormField>
          <FormLabel isDarkMode={isDarkMode}>Description</FormLabel>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail..."
            rows="4"
            onFocus={() => setFocusedField('description')}
            onBlur={() => setFocusedField(null)}
            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
            style={{
              ...inputBaseStyle(isDarkMode, themeColorRgb, focusedField === 'description'),
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </FormField>

        <FormField>
          <FormLabel isDarkMode={isDarkMode}>Photo Evidence (optional)</FormLabel>
          <div style={{ position: 'relative' }} ref={photoMenuRef}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setPhoto(e.target.files[0])
                setShowPhotoMenu(false)
              }}
              id="photo-evidence-file-input"
              style={{ display: 'none' }}
            />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                setPhoto(e.target.files[0])
                setShowPhotoMenu(false)
              }}
              id="photo-evidence-camera-input"
              style={{ display: 'none' }}
            />
            <button
              onClick={() => setShowPhotoMenu(!showPhotoMenu)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                borderRadius: '8px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '14px',
                fontWeight: 500,
                justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `rgba(${themeColorRgb}, 0.3)`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={16} />
                <span>{photo ? photo.name : 'Add Photo'}</span>
              </div>
              {photo && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setPhoto(null)
                    const fileInput = document.getElementById('photo-evidence-file-input')
                    const cameraInput = document.getElementById('photo-evidence-camera-input')
                    if (fileInput) fileInput.value = ''
                    if (cameraInput) cameraInput.value = ''
                  }}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    border: '1px solid rgba(244, 67, 54, 0.3)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#f44336',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </button>
            {showPhotoMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                  border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                  borderRadius: '8px',
                  boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
                  zIndex: 1000,
                  overflow: 'hidden'
                }}
              >
                <div
                  onClick={() => {
                    document.getElementById('photo-evidence-camera-input')?.click()
                  }}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <Camera size={16} />
                  <span>Take Picture</span>
                </div>
                <div
                  style={{
                    height: '1px',
                    backgroundColor: isDarkMode ? 'var(--border-color, #404040)' : '#ddd',
                    margin: '0'
                  }}
                />
                <div
                  onClick={() => {
                    document.getElementById('photo-evidence-file-input')?.click()
                  }}
                  style={{
                    padding: '12px 14px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <FileText size={16} />
                  <span>Choose File</span>
                </div>
              </div>
            )}
          </div>
        </FormField>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
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
            onClick={handleSubmit}
            disabled={!description.trim()}
            style={{
              padding: '4px 16px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              backgroundColor: !description.trim() 
                ? `rgba(${themeColorRgb}, 0.4)` 
                : `rgba(${themeColorRgb}, 0.7)`,
              border: !description.trim()
                ? `1px solid rgba(${themeColorRgb}, 0.3)`
                : `1px solid rgba(${themeColorRgb}, 0.5)`,
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: !description.trim() ? 500 : 600,
              color: '#fff',
              cursor: !description.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: !description.trim()
                ? 'none'
                : `0 4px 15px rgba(${themeColorRgb}, 0.3)`
            }}
          >
            Report Issue
          </button>
        </div>
      </div>
    </div>
  )
}

// Custom Dropdown Component
function CustomDropdown({ value, onChange, options, placeholder, required, isDarkMode, themeColorRgb, style = {} }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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
  const baseBorderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'
  const hoverBorderColor = `rgba(${themeColorRgb}, 0.3)`
  const openBorderColor = `rgba(${themeColorRgb}, 0.5)`
  const activeBorderColor = isOpen ? openBorderColor : (isHovered ? hoverBorderColor : baseBorderColor)

  return (
    <div ref={dropdownRef} style={{ position: 'relative', ...style }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '8px 14px',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: activeBorderColor,
          borderRadius: '8px',
          fontSize: '14px',
          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
          transition: 'all 0.2s ease',
          outline: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          ...(isOpen && {
            boxShadow: `0 0 0 3px rgba(${themeColorRgb}, 0.1)`
          })
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
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
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
            zIndex: 1000
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
    </div>
  )
}

function UploadShipmentForm({ onClose, onSuccess }) {
  const { themeMode, themeColor } = useTheme()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showAddVendorModal, setShowAddVendorModal] = useState(false)
  const [formData, setFormData] = useState({
    vendor_id: '',
    purchase_order_number: '',
    expected_delivery_date: '',
    document: null,
    verification_mode: 'auto_add',
    tracking_number: ''
  })
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null) // { message, type: 'success' | 'error' }
  const [previewData, setPreviewData] = useState(null) // { items, file_path, filename, fileUrl, csvContent }
  const [editingItems, setEditingItems] = useState([])
  const [excelHtml, setExcelHtml] = useState(null) // HTML representation of Excel file
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null) // Index of item showing delete confirmation
  const [draftId, setDraftId] = useState(null) // ID of draft being edited
  const [savingDraft, setSavingDraft] = useState(false)
  const [minimizedItems, setMinimizedItems] = useState(new Set()) // Set of minimized item indices
  
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
    
    // Check if we need to load a draft
    const draftId = searchParams.get('draft_id')
    if (draftId) {
      loadDraft(parseInt(draftId))
    }
  }, [searchParams])

  const loadDraft = async (draftId) => {
    try {
      const response = await fetch(`/api/shipments/draft/${draftId}`)
      const data = await response.json()
      
      if (data.success && data.draft) {
        const draft = data.draft
        setDraftId(draft.draft_id)
        
        // Set form data
        setFormData(prev => ({
          ...prev,
          vendor_id: draft.vendor_id.toString(),
          purchase_order_number: draft.purchase_order_number || '',
          expected_delivery_date: draft.expected_date || '',
          tracking_number: draft.tracking_number || ''
        }))
        
        // Set preview data and editing items
        const filename = draft.file_path ? draft.file_path.split('/').pop() : 'draft.pdf'
        // Construct file URL - if file_path is like 'uploads/shipments/file.xlsx', use /uploads/shipments/file.xlsx
        let fileUrl = null
        if (draft.file_path) {
          if (draft.file_path.startsWith('http')) {
            fileUrl = draft.file_path
          } else if (draft.file_path.startsWith('uploads/')) {
            fileUrl = `/${draft.file_path}`
          } else {
            // If it's just a filename, assume it's in uploads/shipments
            fileUrl = `/uploads/shipments/${draft.file_path}`
          }
        }
        const fileExt = filename.split('.').pop().toLowerCase()
        const isExcel = ['xlsx', 'xls'].includes(fileExt)
        const isCsv = fileExt === 'csv'
        
        // Set initial preview data
        setPreviewData({
          items: draft.items,
          file_path: draft.file_path,
          filename: filename,
          fileUrl: fileUrl,
          csvContent: isCsv ? null : undefined
        })
        setEditingItems(draft.items)
        
        // Load Excel file if needed
        if (isExcel && fileUrl) {
          try {
            const fileResponse = await fetch(fileUrl)
            if (fileResponse.ok) {
              const arrayBuffer = await fileResponse.arrayBuffer()
              const XLSX = await import('xlsx')
              const data = new Uint8Array(arrayBuffer)
              const workbook = XLSX.read(data, { type: 'array' })
              
              // Get first sheet
              const firstSheetName = workbook.SheetNames[0]
              const worksheet = workbook.Sheets[firstSheetName]
              
              // Convert to HTML
              const html = XLSX.utils.sheet_to_html(worksheet)
              setExcelHtml(html)
            }
          } catch (error) {
            console.error('Error loading Excel file:', error)
            setExcelHtml(null)
          }
        } else if (isCsv && fileUrl) {
          // Load CSV file
          try {
            const fileResponse = await fetch(fileUrl)
            if (fileResponse.ok) {
              const csvText = await fileResponse.text()
              setPreviewData(prev => ({ ...prev, csvContent: csvText }))
            }
          } catch (error) {
            console.error('Error loading CSV file:', error)
          }
        }
      } else {
        setToast({ message: data.message || 'Failed to load draft', type: 'error' })
      }
    } catch (error) {
      console.error('Error loading draft:', error)
      setToast({ message: 'Error loading draft', type: 'error' })
    }
  }

  // Cleanup file URL on unmount
  useEffect(() => {
    return () => {
      if (previewData?.fileUrl) {
        URL.revokeObjectURL(previewData.fileUrl)
      }
    }
  }, [previewData])

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
    setToast(null)

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

      // First, preview the document
      const previewResponse = await fetch('/api/shipments/preview', {
        method: 'POST',
        body: uploadFormData
      })

      const previewResult = await previewResponse.json()

      if (!previewResult.success) {
        setError(previewResult.message || 'Failed to preview document')
        setUploading(false)
        return
      }

      // Create file URL for viewing
      const fileUrl = URL.createObjectURL(formData.document)
      
      // Parse Excel files for preview
      const fileExt = previewResult.filename.split('.').pop().toLowerCase()
      if (['xlsx', 'xls'].includes(fileExt)) {
        try {
          // Use FileReader to read the file
          const reader = new FileReader()
          reader.onload = async (e) => {
            try {
              // Import xlsx dynamically
              const XLSX = await import('xlsx')
              const data = new Uint8Array(e.target.result)
              const workbook = XLSX.read(data, { type: 'array' })
              
              // Get first sheet
              const firstSheetName = workbook.SheetNames[0]
              const worksheet = workbook.Sheets[firstSheetName]
              
              // Convert to HTML
              const html = XLSX.utils.sheet_to_html(worksheet)
              setExcelHtml(html)
            } catch (error) {
              console.error('Error parsing Excel file:', error)
              setExcelHtml(null)
            }
          }
          reader.readAsArrayBuffer(formData.document)
        } catch (error) {
          console.error('Error reading Excel file:', error)
        }
      } else if (fileExt === 'csv') {
        // Read CSV file
        const reader = new FileReader()
        reader.onload = (e) => {
          setPreviewData(prev => ({ ...prev, csvContent: e.target.result }))
        }
        reader.readAsText(formData.document)
      }

      // Set preview data
      setPreviewData({
        items: previewResult.items,
        file_path: previewResult.file_path,
        filename: previewResult.filename,
        fileUrl: fileUrl,
        csvContent: fileExt === 'csv' ? null : undefined // Will be set by FileReader
      })
      setEditingItems(previewResult.items.map((item, idx) => ({ ...item, _id: idx })))
      setUploading(false)
    } catch (error) {
      console.error('Error previewing shipment:', error)
      setError('Error previewing shipment. Please try again.')
      setUploading(false)
    }
  }

  const handleConfirm = async () => {
    if (!previewData) return

    setUploading(true)
    setError(null)

    try {
      const sessionToken = localStorage.getItem('sessionToken')
      
      // If this is a draft, confirm it instead of creating a new shipment
      if (draftId) {
        const confirmFormData = new FormData()
        confirmFormData.append('items', JSON.stringify(editingItems))
        confirmFormData.append('file_path', previewData.file_path)
        confirmFormData.append('vendor_id', formData.vendor_id)
        confirmFormData.append('purchase_order_number', formData.purchase_order_number)
        confirmFormData.append('expected_delivery_date', formData.expected_delivery_date)
        confirmFormData.append('tracking_number', formData.tracking_number || '')
        if (sessionToken) {
          confirmFormData.append('session_token', sessionToken)
        }

        const response = await fetch(`/api/shipments/draft/${draftId}/confirm`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          },
          body: confirmFormData
        })

        const result = await response.json()

        if (result.success) {
          // Clean up file URL
          if (previewData.fileUrl) {
            URL.revokeObjectURL(previewData.fileUrl)
          }
          
          setToast({ 
            message: `Draft confirmed! Shipment moved to in progress. ${result.items_added} items added.`, 
            type: 'success' 
          })
          setTimeout(() => {
            onSuccess(result.pending_shipment_id)
          }, 1500)
        } else {
          setError(result.message || 'Failed to confirm draft')
        }
      } else {
        // Create new shipment (original flow)
        const confirmFormData = new FormData()
        confirmFormData.append('items', JSON.stringify(editingItems))
        confirmFormData.append('file_path', previewData.file_path)
        confirmFormData.append('vendor_id', formData.vendor_id)
        confirmFormData.append('purchase_order_number', formData.purchase_order_number)
        confirmFormData.append('expected_delivery_date', formData.expected_delivery_date)
        confirmFormData.append('verification_mode', formData.verification_mode)
        confirmFormData.append('session_token', sessionToken)

        const response = await fetch('/api/shipments/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          },
          body: confirmFormData
        })

        const result = await response.json()

        if (result.success) {
          // Clean up file URL
          if (previewData.fileUrl) {
            URL.revokeObjectURL(previewData.fileUrl)
          }
          
          setToast({ 
            message: `Shipment created successfully! ${result.items_added} items added.`, 
            type: 'success' 
          })
          setTimeout(() => {
            onSuccess(result.pending_shipment_id)
          }, 1500)
        } else {
          setError(result.message || 'Failed to create shipment')
        }
      }
    } catch (error) {
      console.error('Error creating shipment:', error)
      setError('Error creating shipment. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleCancelPreview = () => {
    if (previewData?.fileUrl) {
      URL.revokeObjectURL(previewData.fileUrl)
    }
    setPreviewData(null)
    setEditingItems([])
  }

  const updateItem = (index, field, value) => {
    const updated = [...editingItems]
    updated[index] = { ...updated[index], [field]: value }
    setEditingItems(updated)
  }

  const deleteItem = (index) => {
    const updated = editingItems.filter((_, idx) => idx !== index)
    setEditingItems(updated)
    setDeleteConfirmIndex(null)
  }

  const handleDeleteClick = (index, e) => {
    e.stopPropagation()
    if (deleteConfirmIndex === index) {
      // If already showing confirmation, delete it
      deleteItem(index)
    } else {
      // Show confirmation dropdown
      setDeleteConfirmIndex(index)
    }
  }

  const toggleMinimize = (index) => {
    setMinimizedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }

  const handleSaveDraft = async () => {
    if (!formData.vendor_id) {
      setToast({ message: 'Please select a vendor', type: 'error' })
      return
    }

    if (editingItems.length === 0) {
      setToast({ message: 'No items to save', type: 'error' })
      return
    }

    setSavingDraft(true)
    setError(null)

    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const draftFormData = new FormData()
      draftFormData.append('items', JSON.stringify(editingItems))
      draftFormData.append('file_path', previewData.file_path)
      draftFormData.append('vendor_id', formData.vendor_id)
      draftFormData.append('purchase_order_number', formData.purchase_order_number)
      draftFormData.append('expected_delivery_date', formData.expected_delivery_date)
      draftFormData.append('tracking_number', formData.tracking_number || '')
      if (draftId) {
        draftFormData.append('draft_id', draftId)
      }
      if (sessionToken) {
        draftFormData.append('session_token', sessionToken)
      }

      const response = await fetch('/api/shipments/draft/save', {
        method: 'POST',
        body: draftFormData
      })

      const data = await response.json()

      if (data.success) {
        setDraftId(data.draft_id)
        setToast({ message: 'Draft saved successfully', type: 'success' })
      } else {
        setToast({ message: data.message || 'Failed to save draft', type: 'error' })
      }
    } catch (error) {
      console.error('Error saving draft:', error)
      setToast({ message: 'Error saving draft', type: 'error' })
    } finally {
      setSavingDraft(false)
    }
  }

  // If preview data exists, show preview view
  if (previewData) {
    const isPdf = previewData.filename.toLowerCase().endsWith('.pdf')
    const isExcel = ['xlsx', 'xls'].includes(previewData.filename.split('.').pop().toLowerCase())
    const isCsv = previewData.filename.toLowerCase().endsWith('.csv')

  return (
    <>
        <style>{`
          .excel-preview table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          .excel-preview td, .excel-preview th {
            border: 1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'};
            padding: 8px;
            text-align: left;
          }
          .excel-preview th {
            background-color: ${isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5'};
            font-weight: 600;
          }
          .excel-preview tr:nth-child(even) {
            background-color: ${isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#f9f9f9'};
          }
          @media (max-width: 1200px) {
            .item-fields-grid {
              grid-template-columns: 1fr !important;
            }
          }
          @media (max-width: 1024px) {
            .preview-container {
              flex-direction: column !important;
              height: auto !important;
              min-height: auto !important;
            }
            .preview-container > div {
              min-height: 400px;
              max-width: 500px;
              width: 100%;
              margin: 0 auto;
            }
            .scraped-items-container {
              max-width: 500px !important;
            }
            .file-preview-container {
              max-width: 500px !important;
            }
          }
        `}</style>
        <FormTitle isDarkMode={isDarkMode}>
          Review Data
        </FormTitle>

        {error && (
          <div style={{
            padding: '14px 16px',
            backgroundColor: isDarkMode ? 'rgba(244, 67, 54, 0.15)' : '#ffebee',
            color: isDarkMode ? '#ff6b6b' : '#c62828',
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '14px',
            border: isDarkMode ? '1px solid rgba(244, 67, 54, 0.3)' : '1px solid #ffcdd2'
          }}>
            {error}
          </div>
        )}

        <div className="preview-container" style={{
          display: 'flex',
          gap: '24px',
          height: 'calc(100vh - 250px)',
          minHeight: '600px'
        }}>
          {/* Left side: Editable data table */}
          <div className="scraped-items-container" style={{
            flex: '1',
            border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f9f9f9',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
              backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
              fontWeight: 600,
              fontSize: '14px',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
            }}>
              Items ({editingItems.length})
            </div>
            <div 
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '16px'
              }}
              onClick={() => setDeleteConfirmIndex(null)} // Close confirmation when clicking outside
            >
              <div style={{
                display: 'grid',
                gap: '12px'
              }}>
                {editingItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '16px',
                      border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                      borderRadius: '8px',
                      backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                      position: 'relative'
                    }}
                  >
                    {/* Product Name with buttons - shown when minimized */}
                    {minimizedItems.has(idx) ? (
                      <div style={{ marginBottom: '0' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                            flex: 1,
                            overflow: 'hidden',
                            position: 'relative',
                            whiteSpace: 'nowrap'
                          }}>
                            <span style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {item.product_name || 'Unnamed Product'}
                            </span>
                            <div style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: '40px',
                              background: `linear-gradient(to right, transparent, ${isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff'})`,
                              pointerEvents: 'none'
                            }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative', zIndex: 10, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleMinimize(idx)
                              }}
                              style={{
                                padding: '2px',
                                backgroundColor: 'transparent',
                                color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                              title="Expand item"
                            >
                              <Plus size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteClick(idx, e)}
                              style={{
                                padding: '2px',
                                backgroundColor: 'transparent',
                                color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                              title="Delete item"
                            >
                              <X size={16} />
                            </button>
                            
                            {/* Confirmation dropdown */}
                            {deleteConfirmIndex === idx && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  marginTop: '8px',
                                  padding: '12px',
                                  backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                                  border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                                  borderRadius: '8px',
                                  boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.15)',
                                  minWidth: '200px',
                                  zIndex: 1000
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div style={{
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                  marginBottom: '8px'
                                }}>
                                  Delete this item?
                                </div>
                                <div style={{
                                  fontSize: '12px',
                                  color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                                  marginBottom: '12px'
                                }}>
                                  This action cannot be undone.
                                </div>
                                <div style={{
                                  display: 'flex',
                                  gap: '8px',
                                  justifyContent: 'flex-end'
                                }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setDeleteConfirmIndex(null)
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5',
                                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                      border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: 500
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      deleteItem(idx)
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      backgroundColor: '#c62828',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: 500
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* SKU field with X button */}
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '4px'
                          }}>
                            <label style={{
                              fontSize: '12px',
                              color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                              display: 'flex',
                              alignItems: 'center'
                            }}>SKU</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative', zIndex: 10 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleMinimize(idx)
                                }}
                                style={{
                                  padding: '2px',
                                  backgroundColor: 'transparent',
                                  color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                                title="Minimize item"
                              >
                                <Minus size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteClick(idx, e)}
                                style={{
                                  padding: '2px',
                                  backgroundColor: 'transparent',
                                  color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                                title="Delete item"
                              >
                                <X size={16} />
                              </button>
                              
                              {/* Confirmation dropdown */}
                              {deleteConfirmIndex === idx && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '8px',
                                    padding: '12px',
                                    backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                                    border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                                    borderRadius: '8px',
                                    boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.15)',
                                    minWidth: '200px',
                                    zIndex: 1000
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                    marginBottom: '8px'
                                  }}>
                                    Delete this item?
                                  </div>
                                  <div style={{
                                    fontSize: '12px',
                                    color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                                    marginBottom: '12px'
                                  }}>
                                    This action cannot be undone.
                                  </div>
                                  <div style={{
                                    display: 'flex',
                                    gap: '8px',
                                    justifyContent: 'flex-end'
                                  }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setDeleteConfirmIndex(null)
                                      }}
                                      style={{
                                        padding: '6px 12px',
                                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5',
                                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                        border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 500
                                      }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        deleteItem(idx)
                                      }}
                                      style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#c62828',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 500
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <input
                            type="text"
                            value={item.product_sku || ''}
                            onChange={(e) => updateItem(idx, 'product_sku', e.target.value)}
                            style={{
                              ...inputBaseStyle(isDarkMode, themeColorRgb),
                              width: '100%',
                              fontSize: '14px'
                            }}
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                        </div>
                      </>
                    )}
                    
                    {!minimizedItems.has(idx) && (
                      <>
                        {/* Quantity field */}
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{
                            display: 'block',
                            fontSize: '12px',
                            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                            marginBottom: '4px'
                          }}>Quantity</label>
                          <input
                            type="number"
                            value={item.quantity_expected || 0}
                            onChange={(e) => updateItem(idx, 'quantity_expected', parseInt(e.target.value) || 0)}
                            style={{
                              ...inputBaseStyle(isDarkMode, themeColorRgb),
                              width: '100%',
                              fontSize: '14px'
                            }}
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                        </div>
                        
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{
                            display: 'block',
                            fontSize: '12px',
                            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                            marginBottom: '4px'
                          }}>Product Name</label>
                          <input
                            type="text"
                            value={item.product_name || ''}
                            onChange={(e) => updateItem(idx, 'product_name', e.target.value)}
                            style={{
                              ...inputBaseStyle(isDarkMode, themeColorRgb),
                              width: '100%',
                              fontSize: '14px'
                            }}
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                        </div>
                        <div className="item-fields-grid" style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                          gap: '12px'
                        }}>
                          <div>
                            <label style={{
                              display: 'block',
                              fontSize: '12px',
                              color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                              marginBottom: '4px',
                              whiteSpace: 'nowrap'
                            }}>Unit Cost</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_cost || 0}
                              onChange={(e) => updateItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                              style={{
                                ...inputBaseStyle(isDarkMode, themeColorRgb),
                                width: '100%',
                                fontSize: '14px'
                              }}
                              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                            />
                          </div>
                          <div>
                            <label style={{
                              display: 'block',
                              fontSize: '12px',
                              color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                              marginBottom: '4px',
                              whiteSpace: 'nowrap'
                            }}>Lot Number</label>
                            <input
                              type="text"
                              value={item.lot_number || ''}
                              onChange={(e) => updateItem(idx, 'lot_number', e.target.value)}
                              style={{
                                ...inputBaseStyle(isDarkMode, themeColorRgb),
                                width: '100%',
                                fontSize: '14px'
                              }}
                              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                            />
                          </div>
                          <div>
                            <label style={{
                              display: 'block',
                              fontSize: '12px',
                              color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                              marginBottom: '4px'
                            }}>Expiration Date</label>
                            <input
                              type="date"
                              value={item.expiration_date || ''}
                              onChange={(e) => updateItem(idx, 'expiration_date', e.target.value)}
                              style={{
                                ...inputBaseStyle(isDarkMode, themeColorRgb),
                                width: '100%',
                                fontSize: '14px',
                                padding: '7px 14px'
                              }}
                              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right side: File viewer */}
          <div className="file-preview-container" style={{
            flex: '1',
            border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f9f9f9'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
              backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
              fontWeight: 600,
              fontSize: '14px',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
            }}>
              {previewData.filename}
            </div>
            <div style={{
              height: 'calc(100% - 49px)',
              overflow: 'auto',
              padding: isPdf ? '0' : '16px'
            }}>
              {isPdf ? (
                <iframe
                  src={previewData.fileUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  title="Document preview"
                />
              ) : isExcel ? (
                excelHtml ? (
                  <div 
                    dangerouslySetInnerHTML={{ __html: excelHtml }}
                    style={{
                      backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                    }}
                    className="excel-preview"
                  />
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
                  }}>
                    <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <div>Loading Excel file preview...</div>
                  </div>
                )
              ) : isCsv ? (
                previewData.csvContent ? (
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    whiteSpace: 'pre-wrap',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    lineHeight: '1.6',
                    padding: '16px'
                  }}>
                    {previewData.csvContent}
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
                  }}>
                    <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <div>Loading CSV file...</div>
                  </div>
                )
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
                }}>
                  <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <div>File preview not available for {previewData.filename.split('.').pop().toUpperCase()} files</div>
                  <div style={{ fontSize: '12px', marginTop: '8px' }}>Please review the scraped data on the left</div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{
          padding: '16px',
          borderTop: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={handleCancelPreview}
                disabled={uploading || savingDraft}
                style={{
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  cursor: (uploading || savingDraft) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: 'none',
                  opacity: (uploading || savingDraft) ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
                disabled={uploading || savingDraft}
                style={{
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  cursor: (uploading || savingDraft) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: 'none',
                  opacity: (uploading || savingDraft) ? 0.6 : 1
            }}
          >
            {savingDraft ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
                disabled={uploading}
                className="button-26 button-26--header"
                style={{
                  opacity: uploading ? 0.6 : 1,
                  cursor: uploading ? 'not-allowed' : 'pointer'
            }}
          >
            <div className="button-26__content">
              <span className="button-26__text text">
                {uploading ? 'Confirming...' : 'Confirm'}
              </span>
            </div>
          </button>
        </div>

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
            <CheckCircle size={20} style={{ flexShrink: 0, color: `rgb(${themeColorRgb})` }} />
            <span>{toast.message}</span>
          </div>
        )}
      </>
    )
  }

  return (
    <>
        <FormTitle isDarkMode={isDarkMode}>
          Upload New Shipment
        </FormTitle>

        {error && (
          <div style={{
            padding: '14px 16px',
            backgroundColor: isDarkMode ? 'rgba(244, 67, 54, 0.15)' : '#ffebee',
            color: isDarkMode ? '#ff6b6b' : '#c62828',
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '14px',
            border: isDarkMode ? '1px solid rgba(244, 67, 54, 0.3)' : '1px solid #ffcdd2'
          }}>
            {error}
          </div>
        )}


        <form onSubmit={handleSubmit}>
          <FormField>
            <FormLabel isDarkMode={isDarkMode}>
              Vendor
            </FormLabel>
            <div style={{ display: 'flex', gap: '8px' }}>
              <CustomDropdown
                value={formData.vendor_id}
                onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                options={[
                  { value: '', label: 'Select a vendor' },
                  ...vendors.map(vendor => ({
                    value: vendor.vendor_id.toString(),
                    label: vendor.vendor_name
                  }))
                ]}
                placeholder="Select a vendor"
                required
                isDarkMode={isDarkMode}
                themeColorRgb={themeColorRgb}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowAddVendorModal(true)}
                style={{
                  padding: '8px 18px',
                  backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.85)`
                  e.target.style.boxShadow = `0 6px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)`
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
                  e.target.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                }}
              >
                + Add Vendor
              </button>
            </div>
          </FormField>

          <FormField>
            <FormLabel isDarkMode={isDarkMode}>
              Purchase Order Number
            </FormLabel>
            <input
              type="text"
              value={formData.purchase_order_number}
              onChange={(e) => setFormData({ ...formData, purchase_order_number: e.target.value })}
              placeholder="PO-2024-001"
              style={inputBaseStyle(isDarkMode, themeColorRgb)}
              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
            />
          </FormField>

          <FormField>
            <FormLabel isDarkMode={isDarkMode}>
              Expected Delivery Date
            </FormLabel>
            <input
              type="date"
              value={formData.expected_delivery_date}
              onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
              style={inputBaseStyle(isDarkMode, themeColorRgb)}
              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
            />
          </FormField>

          <FormField>
            <FormLabel isDarkMode={isDarkMode}>
              Verification Mode
            </FormLabel>
            <CustomDropdown
              value={formData.verification_mode}
              onChange={(e) => setFormData({ ...formData, verification_mode: e.target.value })}
              options={[
                { value: 'verify_whole_shipment', label: 'Verify Whole Shipment (Items added after completion)' },
                { value: 'auto_add', label: 'Auto-Add Mode (Items added immediately on check-in)' }
              ]}
              placeholder="Select verification mode"
              isDarkMode={isDarkMode}
              themeColorRgb={themeColorRgb}
              style={{ width: '100%' }}
            />
            <div style={{ 
              fontSize: '13px', 
              color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666', 
              marginTop: '8px',
              lineHeight: '1.5'
            }}>
              {formData.verification_mode === 'auto_add' 
                ? 'Items will be added to inventory as soon as you check them in'
                : 'Items will be added to inventory only after completing verification'}
            </div>
          </FormField>

          <FormField style={{ marginBottom: '32px' }}>
            <FormLabel isDarkMode={isDarkMode}>
              Shipment Document
            </FormLabel>
            <div style={{
              border: `2px dashed ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f9f9f9',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `rgba(${themeColorRgb}, 0.5)`
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f5'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'
              e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f9f9f9'
            }}
            >
              <input
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                onChange={handleFileChange}
                required
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
              {formData.document ? (
                <div>
                  <div style={{ fontSize: '16px', marginBottom: '8px', color: '#4caf50' }}>✓</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333', marginBottom: '4px' }}>
                    {formData.document.name}
                  </div>
                  <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
                    Click to change file
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                    <FileText size={32} color={isDarkMode ? '#999' : '#999'} />
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333', marginBottom: '4px' }}>
                    Click to upload or drag and drop
                  </div>
                  <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
                    Supported formats: PDF, Excel (.xlsx, .xls), CSV
                  </div>
                </div>
              )}
            </div>
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button
              type="submit"
              className="button-26 button-26--header"
              role="button"
              disabled={uploading || !formData.vendor_id || !formData.document}
              style={{
                opacity: (uploading || !formData.vendor_id || !formData.document) ? 0.6 : 1,
                cursor: (uploading || !formData.vendor_id || !formData.document) ? 'not-allowed' : 'pointer'
              }}
            >
              <div className="button-26__content">
                <span className="button-26__text text">
                  {uploading ? 'Uploading...' : 'Upload'}
                </span>
              </div>
            </button>
          </div>
        </form>

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
          <CheckCircle size={20} style={{ flexShrink: 0, color: `rgb(${themeColorRgb})` }} />
          <span>{toast.message}</span>
        </div>
      )}
    </>
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
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontFamily: '"Product Sans", sans-serif', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
            Add New Vendor
          </h3>
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
            <label style={formLabelStyle(isDarkMode)}>
              Vendor Name <span style={{ color: '#f44336' }}>*</span>
            </label>
            <input
              type="text"
              value={vendorData.vendor_name}
              onChange={(e) => setVendorData({ ...vendorData, vendor_name: e.target.value })}
              required
              placeholder="Enter vendor name"
              style={inputBaseStyle(isDarkMode, themeColorRgb)}
              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={formLabelStyle(isDarkMode)}>
              Contact Person
            </label>
            <input
              type="text"
              value={vendorData.contact_person}
              onChange={(e) => setVendorData({ ...vendorData, contact_person: e.target.value })}
              placeholder="Contact person name"
              style={inputBaseStyle(isDarkMode, themeColorRgb)}
              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={formLabelStyle(isDarkMode)}>
              Email
            </label>
            <input
              type="email"
              value={vendorData.email}
              onChange={(e) => setVendorData({ ...vendorData, email: e.target.value })}
              placeholder="vendor@example.com"
              style={inputBaseStyle(isDarkMode, themeColorRgb)}
              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={formLabelStyle(isDarkMode)}>
              Phone
            </label>
            <input
              type="tel"
              value={vendorData.phone}
              onChange={(e) => setVendorData({ ...vendorData, phone: e.target.value })}
              placeholder="(555) 123-4567"
              style={inputBaseStyle(isDarkMode, themeColorRgb)}
              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={formLabelStyle(isDarkMode)}>
              Address
            </label>
            <textarea
              value={vendorData.address}
              onChange={(e) => setVendorData({ ...vendorData, address: e.target.value })}
              placeholder="Street address, city, state, zip"
              rows={3}
              style={{
                ...inputBaseStyle(isDarkMode, themeColorRgb),
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
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
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: 'none'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !vendorData.vendor_name.trim()}
              style={{
                padding: '4px 16px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                backgroundColor: (saving || !vendorData.vendor_name.trim()) ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.7)`,
                border: `1px solid rgba(${themeColorRgb}, 0.5)`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#fff',
                cursor: (saving || !vendorData.vendor_name.trim()) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3)`
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

