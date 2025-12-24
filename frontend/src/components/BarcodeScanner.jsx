import { useState, useEffect, useRef } from 'react'

function BarcodeScanner({ onScan, onClose, onImageScan }) {
  const [scanMode, setScanMode] = useState('hardware') // 'hardware', 'camera', or 'image'
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [isProcessingImage, setIsProcessingImage] = useState(false)
  const videoRef = useRef(null)
  const scannerRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const barcodeBufferRef = useRef('')
  const barcodeTimeoutRef = useRef(null)

  // Handle hardware scanner input (keyboard events)
  useEffect(() => {
    if (scanMode === 'hardware') {
      const handleKeyPress = (e) => {
        // Hardware scanners typically send characters very quickly
        // We buffer them and process when Enter is pressed or after a delay
        if (e.key === 'Enter') {
          const barcode = barcodeBufferRef.current.trim()
          if (barcode.length > 0) {
            handleBarcodeScanned(barcode)
            barcodeBufferRef.current = ''
          }
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          // Add character to buffer
          barcodeBufferRef.current += e.key
          
          // Clear previous timeout
          if (barcodeTimeoutRef.current) {
            clearTimeout(barcodeTimeoutRef.current)
          }
          
          // Process barcode after 100ms of no input (typical for hardware scanners)
          barcodeTimeoutRef.current = setTimeout(() => {
            const barcode = barcodeBufferRef.current.trim()
            if (barcode.length >= 8) { // Minimum barcode length
              handleBarcodeScanned(barcode)
              barcodeBufferRef.current = ''
            }
          }, 100)
        }
      }

      window.addEventListener('keydown', handleKeyPress)
      return () => {
        window.removeEventListener('keydown', handleKeyPress)
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current)
        }
      }
    }
  }, [scanMode])

  // Camera scanning using html5-qrcode
  useEffect(() => {
    if (scanMode === 'camera' && isScanning) {
      startCameraScan()
      return () => {
        stopCameraScan()
      }
    } else if (scanMode === 'camera' && !isScanning && scannerRef.current) {
      stopCameraScan()
    }
  }, [scanMode, isScanning])

  const handleBarcodeScanned = async (barcode) => {
    if (onScan) {
      onScan(barcode)
    }
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
      
      await html5QrCode.start(
        { facingMode: 'environment' }, // Use back camera on mobile
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          // Success callback
          handleBarcodeScanned(decodedText)
          stopCameraScan()
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

  const stopCameraScan = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(err => {
        console.error('Error stopping scanner:', err)
      })
      scannerRef.current = null
    }
    setIsScanning(false)
  }

  const handleManualInput = () => {
    const barcode = barcodeInput.trim()
    if (barcode.length > 0) {
      handleBarcodeScanned(barcode)
      setBarcodeInput('')
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ margin: 0 }}>Scan Barcode</h2>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Mode Selection */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => {
              setScanMode('hardware')
              stopCameraScan()
            }}
            style={{
              flex: 1,
              minWidth: '120px',
              padding: '12px',
              border: scanMode === 'hardware' ? '2px solid #000' : '2px solid #ddd',
              borderRadius: '4px',
              backgroundColor: scanMode === 'hardware' ? '#000' : '#fff',
              color: scanMode === 'hardware' ? '#fff' : '#000',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Hardware Scanner
          </button>
          <button
            onClick={() => {
              setScanMode('camera')
              setIsScanning(true)
            }}
            style={{
              flex: 1,
              minWidth: '120px',
              padding: '12px',
              border: scanMode === 'camera' ? '2px solid #000' : '2px solid #ddd',
              borderRadius: '4px',
              backgroundColor: scanMode === 'camera' ? '#000' : '#fff',
              color: scanMode === 'camera' ? '#fff' : '#000',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Camera Scanner
          </button>
          {onImageScan && (
            <button
              onClick={() => {
                setScanMode('image')
                stopCameraScan()
                fileInputRef.current?.click()
              }}
              style={{
                flex: 1,
                minWidth: '120px',
                padding: '12px',
                border: scanMode === 'image' ? '2px solid #000' : '2px solid #ddd',
                borderRadius: '4px',
                backgroundColor: scanMode === 'image' ? '#000' : '#fff',
                color: scanMode === 'image' ? '#fff' : '#000',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Take Photo
            </button>
          )}
        </div>

        {/* Hidden file input for image upload */}
        {onImageScan && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file && onImageScan) {
                setIsProcessingImage(true)
                setError(null)
                try {
                  await onImageScan(file)
                  onClose()
                } catch (err) {
                  setError(`Error processing image: ${err.message}`)
                } finally {
                  setIsProcessingImage(false)
                  // Reset input
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }
              }
            }}
          />
        )}

        {/* Hardware Scanner Mode */}
        {scanMode === 'hardware' && (
          <div>
            <div style={{
              padding: '16px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                Point your barcode scanner at the input field and scan
              </div>
              <input
                ref={inputRef}
                type="text"
                placeholder="Scan barcode here..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleManualInput()
                  }
                }}
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '16px',
                  textAlign: 'center',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              onClick={handleManualInput}
              disabled={!barcodeInput.trim()}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: barcodeInput.trim() ? '#000' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: barcodeInput.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              Add Product
            </button>
          </div>
        )}

        {/* Camera Scanner Mode */}
        {scanMode === 'camera' && (
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
                minHeight: '300px',
                borderRadius: '4px',
                overflow: 'hidden',
                backgroundColor: '#000',
                marginBottom: '16px'
              }}
            />
            {isScanning && (
              <button
                onClick={stopCameraScan}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#f44336',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Stop Scanning
              </button>
            )}
            {!isScanning && !error && (
              <button
                onClick={() => setIsScanning(true)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Start Camera
              </button>
            )}
          </div>
        )}

        {/* Image Mode - Processing */}
        {scanMode === 'image' && isProcessingImage && (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#666'
          }}>
            <div style={{ fontSize: '18px', marginBottom: '12px' }}>Processing image...</div>
            <div style={{ fontSize: '14px' }}>Identifying product...</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default BarcodeScanner

