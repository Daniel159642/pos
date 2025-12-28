import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'

function ShipmentVerificationDashboard() {
  const { themeMode } = useTheme()
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, pending, in_progress, completed
  const [showUploadModal, setShowUploadModal] = useState(false)
  
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
    switch (status) {
      case 'pending_review':
      case 'pending':
        return '#ff9800' // Orange
      case 'in_progress':
        return '#2196f3' // Blue
      case 'approved':
      case 'completed':
        return '#4caf50' // Green
      case 'completed_with_issues':
        return '#f44336' // Red
      default:
        return '#757575' // Gray
    }
  }

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return '#4caf50'
    if (percentage >= 50) return '#2196f3'
    if (percentage > 0) return '#ff9800'
    return '#e0e0e0'
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : 'transparent' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
          Shipment Verification
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              marginRight: '8px'
            }}
          >
            + New Shipment
          </button>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '8px 16px',
              backgroundColor: filter === 'all' ? '#2196f3' : (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5'),
              color: filter === 'all' ? 'white' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: filter === 'all' ? 600 : 400
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending_review')}
            style={{
              padding: '8px 16px',
              backgroundColor: filter === 'pending_review' ? '#ff9800' : (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5'),
              color: filter === 'pending_review' ? 'white' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: filter === 'pending_review' ? 600 : 400
            }}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('in_progress')}
            style={{
              padding: '8px 16px',
              backgroundColor: filter === 'in_progress' ? '#2196f3' : (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5'),
              color: filter === 'in_progress' ? 'white' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: filter === 'in_progress' ? 600 : 400
            }}
          >
            In Progress
          </button>
          <button
            onClick={() => setFilter('approved')}
            style={{
              padding: '8px 16px',
              backgroundColor: filter === 'approved' ? '#4caf50' : (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5'),
              color: filter === 'approved' ? 'white' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: filter === 'approved' ? 600 : 400
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

function ShipmentCard({ shipment, getStatusColor, getProgressColor, isDarkMode }) {
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
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
      ':hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
      }
    }}
    onClick={() => navigate(`/shipment-verification/${shipment.pending_shipment_id}`)}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)'
      e.currentTarget.style.boxShadow = isDarkMode ? '0 4px 8px rgba(0,0,0,0.5)' : '0 4px 8px rgba(0,0,0,0.15)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.boxShadow = isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
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
          backgroundColor: getStatusColor(status) + '20',
          color: getStatusColor(status),
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'capitalize'
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
  const { themeMode } = useTheme()
  const actualId = shipmentId || id
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [progress, setProgress] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [currentItem, setCurrentItem] = useState(null)
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  
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
      loadProgress()
      // Auto-refresh progress every 5 seconds
      const interval = setInterval(loadProgress, 5000)
      return () => clearInterval(interval)
    }
  }, [actualId])

  const loadProgress = async () => {
    try {
      const response = await fetch(`/api/shipments/${actualId}/progress`)
      const data = await response.json()
      setProgress(data)
    } catch (error) {
      console.error('Error loading progress:', error)
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
      
      const data = await response.json()
      setSession(data)
    } catch (error) {
      console.error('Error starting session:', error)
      alert('Failed to start verification session')
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
        `There are ${progress.progress.items_with_issues} items with issues. Complete anyway?`
      )
      if (!confirmed) return
    }
    
    const notes = window.prompt('Any final notes about this shipment?')
    
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
        alert('Shipment verified and added to inventory!')
        navigate('/shipment-verification')
      } else {
        alert(result.message || 'Failed to complete verification')
      }
    } catch (error) {
      console.error('Error completing verification:', error)
      alert('Failed to complete verification')
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
          backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5',
          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
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
        <h2 style={{ margin: '0 0 16px 0', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Shipment Verification</h2>
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
              backgroundColor: progress.completion_percentage >= 100 ? '#4caf50' : '#2196f3',
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
              }
            }}
            disabled={scanning || !manualBarcode.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: scanning ? '#ccc' : '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: scanning ? 'not-allowed' : 'pointer',
              fontWeight: 600
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
            {progress.pending_items.map(item => (
              <div key={item.pending_item_id} style={{
                padding: '12px',
                border: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #e0e0e0',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'
              }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                    {item.product_name}
                  </div>
                  <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666' }}>
                    SKU: {item.product_sku}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                    {item.quantity_verified}/{item.quantity_expected}
                  </span>
                  <button
                    onClick={() => {
                      setCurrentItem(item)
                      setShowIssueForm(true)
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ff9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Report Issue
                  </button>
                </div>
              </div>
            ))}
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

      {/* Complete Button */}
      {progress.is_complete && (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={completeVerification}
            style={{
              padding: '12px 24px',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600
            }}
          >
            Complete Verification
          </button>
        </div>
      )}

      {/* Issue Report Form Modal */}
      {showIssueForm && (
        <IssueReportForm
          item={currentItem}
          onSubmit={reportIssue}
          onCancel={() => setShowIssueForm(false)}
        />
      )}
    </div>
  )
}

function IssueReportForm({ item, onSubmit, onCancel }) {
  const { themeMode } = useTheme()
  const [issueType, setIssueType] = useState('missing')
  const [severity, setSeverity] = useState('minor')
  const [description, setDescription] = useState('')
  const [quantityAffected, setQuantityAffected] = useState(1)
  const [photo, setPhoto] = useState(null)
  
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
              backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!description.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: description.trim() ? '#2196f3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: description.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 600
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
  const { themeMode } = useTheme()
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    vendor_id: '',
    purchase_order_number: '',
    expected_delivery_date: '',
    document: null
  })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
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
            <select
              value={formData.vendor_id}
              onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
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
            >
              <option value="">Select a vendor</option>
              {vendors.map(vendor => (
                <option key={vendor.vendor_id} value={vendor.vendor_id}>
                  {vendor.vendor_name}
                </option>
              ))}
            </select>
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
                backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontWeight: 500
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !formData.vendor_id || !formData.document}
              style={{
                padding: '10px 20px',
                backgroundColor: (uploading || !formData.vendor_id || !formData.document) ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (uploading || !formData.vendor_id || !formData.document) ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              {uploading ? 'Uploading...' : 'Upload & Create Shipment'}
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

