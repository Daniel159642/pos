import { useEffect, useRef, useState } from 'react'
import './CameraScanner.css'

const CAMERA_ID = 'checkout-barcode-camera'

export default function CameraScanner({ onScan, onClose }) {
  const scannerRef = useRef(null)
  const [cameraError, setCameraError] = useState(null)

  useEffect(() => {
    let html5QrCode = null

    const start = async () => {
      setCameraError(null)
      let Html5Qrcode
      try {
        const mod = await import('html5-qrcode')
        Html5Qrcode = mod.Html5Qrcode
      } catch (e) {
        setCameraError('Camera library not loaded')
        return
      }

      const element = document.getElementById(CAMERA_ID)
      if (!element) return

      html5QrCode = new Html5Qrcode(CAMERA_ID)
      scannerRef.current = html5QrCode
      const qrboxConfig = (viewfinderWidth) => {
        const width = Math.floor(viewfinderWidth * 0.94)
        const height = Math.floor(width * 0.4)
        return { width, height }
      }
      const config = {
        fps: 15,
        qrbox: qrboxConfig,
        aspectRatio: 1.5,
      }
      if (Html5Qrcode.Html5QrcodeSupportedFormats) {
        config.formatsToSupport = [
          Html5Qrcode.Html5QrcodeSupportedFormats.CODE_128,
          Html5Qrcode.Html5QrcodeSupportedFormats.EAN_13,
          Html5Qrcode.Html5QrcodeSupportedFormats.EAN_8,
          Html5Qrcode.Html5QrcodeSupportedFormats.UPC_A,
          Html5Qrcode.Html5QrcodeSupportedFormats.UPC_E,
          Html5Qrcode.Html5QrcodeSupportedFormats.QR_CODE,
        ]
      }

      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (onScan) onScan(decodedText)
          },
          () => {}
        )
      } catch (err) {
        setCameraError(err?.message || 'Camera error')
      }
    }

    start()
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [onScan])

  return (
    <div className="camera-scanner">
      {cameraError && (
        <div className="camera-scanner-error">{cameraError}</div>
      )}
      <div id={CAMERA_ID} className="camera-scanner-view" />
      <button
        type="button"
        className="camera-scanner-close"
        onClick={onClose}
        aria-label="Close scanner"
      >
        Close
      </button>
    </div>
  )
}
