import { useState, useEffect, useRef } from 'react'

function BarcodeScanner({ onScan, onClose, onImageScan, themeColor = '#8400ff' }) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState(null)
  const [position, setPosition] = useState(null) // null means centered, {x, y} means positioned
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [scanStatus, setScanStatus] = useState('ready') // 'ready', 'accepted', 'cooldown'
  const scannerRef = useRef(null)
  const modalRef = useRef(null)
  const scanCooldownRef = useRef(false)
  const resumeTimeoutRef = useRef(null)

  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)

  const handleBarcodeScanned = async (barcode) => {
    // Simple logic: if cooldown is active, ignore ALL scans immediately
    if (scanCooldownRef.current) {
      console.log('Scan ignored - cooldown active')
      return
    }
    
    console.log('Processing scan:', barcode)
    
    // Set cooldown FIRST - before anything else - to block all subsequent scans
    scanCooldownRef.current = true
    
    // Show green (accepted) status
    setScanStatus('accepted')
    
    // Call the scan handler - don't wait for it, let it process asynchronously
    // This ensures the scanner keeps running and doesn't get stuck
    if (onScan) {
      // Fire and forget - don't block scanner resume
      Promise.resolve(onScan(barcode)).catch(err => {
        console.error('Error in scan handler:', err)
      })
    }
    
    // Switch to red (cooldown) after brief green flash
    setTimeout(() => {
      setScanStatus('cooldown')
    }, 200)
    
    // Reset cooldown after 0.8 seconds - ready for next scan
    setTimeout(() => {
      scanCooldownRef.current = false
      // Switch back to white (ready)
      setScanStatus('ready')
      console.log('Scanner ready for next scan')
    }, 800)
  }

  const stopCameraScan = async () => {
    // Clear any pending resume timeouts
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current)
      resumeTimeoutRef.current = null
    }
    
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
      scannerRef.current = null
    }
    setIsScanning(false)
  }

  const startCameraScan = async () => {
    try {
      setError(null)
      
      // Check if html5-qrcode is available
      let Html5Qrcode
      if (typeof window !== 'undefined' && window.Html5Qrcode) {
        Html5Qrcode = window.Html5Qrcode
      } else {
        // Try to load dynamically
        try {
          const html5QrcodeModule = await import('html5-qrcode')
          Html5Qrcode = html5QrcodeModule.Html5Qrcode
          // Store in window for future use
          if (typeof window !== 'undefined') {
            window.Html5Qrcode = Html5Qrcode
          }
        } catch (err) {
          console.error('Failed to load html5-qrcode:', err)
          setError('Camera scanning library not available. Install: npm install html5-qrcode')
          setIsScanning(false)
          return
        }
      }

      const html5QrCode = new Html5Qrcode('barcode-scanner-camera')
      
      // Optimize scanner settings for Code128 linear barcodes (faster scanning)
      const config = {
        fps: 15,  // Higher FPS (was 10) - scans more frames per second for faster detection
        qrbox: { width: 400, height: 200 },  // Wider box for linear barcodes (was 350x250)
        aspectRatio: 1.5,  // Better aspect ratio for horizontal linear barcodes (was 1.4)
        disableFlip: false,  // Allow rotation if needed
        // Try to optimize for Code128 if supported
        ...(Html5Qrcode && Html5Qrcode.Html5QrcodeSupportedFormats ? {
          formatsToSupport: [
            Html5Qrcode.Html5QrcodeSupportedFormats.CODE_128,
            Html5Qrcode.Html5QrcodeSupportedFormats.EAN_13,
            Html5Qrcode.Html5QrcodeSupportedFormats.EAN_8,
            Html5Qrcode.Html5QrcodeSupportedFormats.UPC_A,
            Html5Qrcode.Html5QrcodeSupportedFormats.UPC_E,
            Html5Qrcode.Html5QrcodeSupportedFormats.QR_CODE
          ]
        } : {})
      }
      
      await html5QrCode.start(
        { facingMode: 'environment' }, // Use back camera on mobile
        config,
        (decodedText) => {
          // Success callback - handleBarcodeScanned will process without stopping camera
          handleBarcodeScanned(decodedText)
        },
        (errorMessage) => {
          // Error callback (ignore, just keep scanning)
        }
      )
      
      scannerRef.current = html5QrCode
    } catch (err) {
      console.error('Camera scan error:', err)
      setError(`Camera error: ${err.message}`)
      setIsScanning(false)
    }
  }

  // Auto-start camera scanning when component mounts
  useEffect(() => {
    setIsScanning(true)
    return () => {
      stopCameraScan()
    }
  }, [])

  // Camera scanning using html5-qrcode
  useEffect(() => {
    if (isScanning) {
      startCameraScan()
      return () => {
        stopCameraScan()
      }
    } else if (!isScanning && scannerRef.current) {
      stopCameraScan()
    }
  }, [isScanning])

  // Drag handlers
  const handleMouseDown = (e) => {
    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
      // If position is null (bottom-right), calculate current position
      if (position === null) {
        setPosition({
          x: rect.left,
          y: rect.top
        })
      }
      setIsDragging(true)
    }
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y
        
        // Keep modal within viewport bounds
        const maxX = window.innerWidth - (modalRef.current?.offsetWidth || 500)
        const maxY = window.innerHeight - (modalRef.current?.offsetHeight || 400)
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'transparent',
      zIndex: 1000,
      pointerEvents: 'none' // Allow clicks to pass through overlay
    }}>
      <div 
        ref={modalRef}
        style={{
          position: 'absolute',
          left: position ? `${position.x}px` : 'auto',
          top: position ? `${position.y}px` : 'auto',
          right: position ? 'auto' : '20px',
          bottom: position ? 'auto' : '20px',
          transform: position ? 'none' : 'none',
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '12px',
          maxWidth: '600px',
          width: '100%',
          border: `1px solid rgba(${themeColorRgb}, 0.3)`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          pointerEvents: 'auto', // Modal itself can receive clicks
          cursor: isDragging ? 'grabbing' : 'default'
        }}
      >
        <div 
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginBottom: '8px',
            cursor: 'grab',
            userSelect: 'none'
          }}
          onMouseDown={handleMouseDown}
        >
          <button
            onClick={onClose}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: themeColor
            }}
          >
            ×
          </button>
        </div>

        {/* Camera Scanner */}
        <div>
          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: '#ffebee',
              color: '#d32f2f',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
          <div
            id="barcode-scanner-camera"
            style={{
              width: '100%',
              minHeight: '280px',
              maxHeight: '320px',
              borderRadius: '0',
              overflow: 'hidden',
              backgroundColor: '#000',
              border: scanStatus === 'accepted' 
                ? '4px solid #4caf50' 
                : scanStatus === 'cooldown' 
                ? '4px solid #f44336' 
                : '4px solid #fff',
              transition: 'border-color 0.2s ease',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default BarcodeScanner

