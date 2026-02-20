import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

function BarcodeScanner({ onScan, onClose, onImageScan, themeColor = '#8400ff', inline = false }) {
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
    // Take ref and clear immediately so a second cleanup (e.g. from another effect) doesn't call stop() again
    const scanner = scannerRef.current
    scannerRef.current = null
    if (scanner) {
      try {
        await scanner.stop()
      } catch (err) {
        // Ignore "already under transition" - we only need to stop once
        if (!String(err?.message || err).includes('transition')) {
          console.error('Error stopping scanner:', err)
        }
      }
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

      // Inline (mobile): show library qrbox. Modal: no qrbox — we draw our own centered overlay.
      const qrboxConfig = inline
        ? (viewfinderWidth, viewfinderHeight) => {
            const width = Math.floor(viewfinderWidth * 0.96)
            const height = Math.floor(width * 0.38)
            return { width, height }
          }
        : undefined

      // Optimize scanner settings for Code128 linear barcodes (faster scanning)
      const config = {
        fps: 15,
        ...(qrboxConfig != null && { qrbox: qrboxConfig }),
        aspectRatio: 1.5,
        disableFlip: false,
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
    if (e.target.closest('button')) return
    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
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

  // Inline (mobile): camera only + close button attached to bottom, no card
  if (inline) {
    return (
      <div ref={modalRef} style={{ width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
        <style>{`#barcode-scanner-camera video { object-fit: cover !important; width: 100% !important; height: 100% !important; }`}</style>
        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: '#ffebee',
            color: '#d32f2f',
            borderRadius: '4px',
            marginBottom: '8px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}
        <div
          id="barcode-scanner-camera"
          style={{
            width: '100%',
            height: '280px',
            overflow: 'hidden',
            backgroundColor: '#000',
            position: 'relative',
            border: scanStatus === 'accepted'
              ? '4px solid #4caf50'
              : scanStatus === 'cooldown'
              ? '4px solid #f44336'
              : 'none',
            transition: 'border-color 0.2s ease',
            boxSizing: 'border-box'
          }}
        />
        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 0,
            padding: '14px 16px',
            border: 'none',
            borderTop: `2px solid rgba(${themeColorRgb}, 0.3)`,
            backgroundColor: `rgba(${themeColorRgb}, 0.15)`,
            color: themeColor,
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px'
          }}
        >
          Close
        </button>
      </div>
    )
  }

  const cardContent = (
    <div
      ref={modalRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: position ? `${position.x}px` : 'auto',
        top: position ? `${position.y}px` : 'auto',
        right: position ? 'auto' : '20px',
        bottom: position ? 'auto' : '20px',
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '6px',
        width: '380px',
        maxWidth: 'calc(100vw - 40px)',
        border: `1px solid rgba(${themeColorRgb}, 0.25)`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        pointerEvents: 'auto',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        boxSizing: 'border-box'
      }}
    >
      {/* Close button - white with app blue X, on top of border in top-right */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        style={{
          position: 'absolute',
          top: '-12px',
          right: '-12px',
          padding: 0,
          width: '32px',
          height: '32px',
          backgroundColor: '#fff',
          color: themeColor,
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '50%',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          flexShrink: 0
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.25)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'
        }}
      >
        <X size={18} strokeWidth={2.5} />
      </button>
      {/* Camera Scanner */}
      <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
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
          style={{
            position: 'relative',
            width: '100%',
            height: '280px',
            overflow: 'hidden',
            backgroundColor: '#000',
            borderRadius: '8px',
            border: scanStatus === 'accepted'
              ? '2px solid #4caf50'
              : scanStatus === 'cooldown'
              ? '2px solid #f44336'
              : 'none',
            transition: 'border-color 0.2s ease',
            boxSizing: 'border-box',
            flexShrink: 0
          }}
        >
          <div id="barcode-scanner-camera" style={{ width: '100%', height: '100%', minHeight: 0 }} />
          {/* Custom scan area overlay — centered; modal only (inline uses library qrbox). Corners match border status. */}
          {!inline && (() => {
            const cornerColor = scanStatus === 'accepted'
              ? '#4caf50'
              : scanStatus === 'cooldown'
              ? '#f44336'
              : 'rgba(255,255,255,0.9)'
            const cornerStyle = (top, left, right, bottom) => ({
              position: 'absolute',
              width: '36px',
              height: '36px',
              ...(top !== undefined && { top: 0, borderTop: `6px solid ${cornerColor}` }),
              ...(bottom !== undefined && { bottom: 0, borderBottom: `6px solid ${cornerColor}` }),
              ...(left !== undefined && { left: 0, borderLeft: `6px solid ${cornerColor}` }),
              ...(right !== undefined && { right: 0, borderRight: `6px solid ${cornerColor}` }),
              transition: 'border-color 0.2s ease'
            })
            return (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '88%',
                  height: '42%',
                  pointerEvents: 'none',
                  zIndex: 1,
                  boxShadow: '0 0 0 9999px rgba(255, 255, 255, 0.4)'
                }}
              >
                <div style={cornerStyle(1, 1)} />
                <div style={cornerStyle(1, undefined, 1)} />
                <div style={cornerStyle(undefined, 1, undefined, 1)} />
                <div style={cornerStyle(undefined, undefined, 1, 1)} />
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'transparent',
      zIndex: 1000,
      pointerEvents: 'none'
    }}>
      <style>{`
        #barcode-scanner-camera video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>
      {cardContent}
    </div>
  )
}

export default BarcodeScanner

