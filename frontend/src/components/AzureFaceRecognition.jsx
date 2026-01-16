import { useState, useRef, useEffect } from 'react'

/**
 * Azure Face Recognition Component
 * Handles camera capture, face detection, and Azure Face API integration
 */
function AzureFaceRecognition({ 
  onFaceCaptured, 
  onError, 
  isActive, 
  mode = 'enroll', // 'enroll' or 'recognize'
  showPreview = true 
}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [stream, setStream] = useState(null)
  const [capturing, setCapturing] = useState(false)
  const [countdown, setCountdown] = useState(null)

  // Start video stream
  useEffect(() => {
    if (!isActive) {
      // Stop stream when not active
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
        setStream(null)
      }
      return
    }

    const startVideo = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        })
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          setStream(mediaStream)
        }
        setLoading(false)
      } catch (err) {
        console.error('Error accessing camera:', err)
        const errorMsg = err.name === 'NotAllowedError' 
          ? 'Camera permission denied. Please allow camera access.'
          : err.name === 'NotFoundError'
          ? 'No camera found. Please connect a camera.'
          : 'Unable to access camera. Please check permissions.'
        setError(errorMsg)
        setLoading(false)
        if (onError) onError(err)
      }
    }

    startVideo()

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [isActive, onError])

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return null

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.95)
    return imageData
  }

  const handleCapture = async () => {
    if (capturing) return

    try {
      setCapturing(true)
      setError(null)

      // Countdown before capture
      setCountdown(3)
      await new Promise(resolve => {
        const interval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(interval)
              resolve()
              return null
            }
            return prev - 1
          })
        }, 1000)
      })

      // Small delay after countdown
      await new Promise(resolve => setTimeout(resolve, 200))

      const imageData = captureImage()
      if (!imageData) {
        throw new Error('Failed to capture image')
      }

      if (onFaceCaptured) {
        await onFaceCaptured(imageData)
      }
    } catch (err) {
      console.error('Error capturing image:', err)
      setError(err.message || 'Failed to capture image')
      if (onError) onError(err)
    } finally {
      setCapturing(false)
      setCountdown(null)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Accessing camera...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#f44336' }}>
        <div>{error}</div>
        <div style={{ marginTop: '10px', fontSize: '12px' }}>
          Please check camera permissions and try again.
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: '640px' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: '100%',
          height: 'auto',
          borderRadius: '8px',
          transform: 'scaleX(-1)', // Mirror for better UX
          display: showPreview ? 'block' : 'none'
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          display: 'none'
        }}
      />
      
      {countdown !== null && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '72px',
          fontWeight: 'bold',
          color: '#fff',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          zIndex: 10
        }}>
          {countdown}
        </div>
      )}

      {isActive && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5
        }}>
          <button
            onClick={handleCapture}
            disabled={capturing || countdown !== null}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600,
              backgroundColor: capturing ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: capturing ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            {capturing ? 'Capturing...' : countdown !== null ? countdown : mode === 'enroll' ? 'Capture Face' : 'Recognize Face'}
          </button>
        </div>
      )}

      {/* Face detection guide overlay */}
      {isActive && showPreview && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '200px',
          height: '250px',
          border: '3px solid rgba(76, 175, 80, 0.8)',
          borderRadius: '8px',
          pointerEvents: 'none',
          zIndex: 1
        }} />
      )}
    </div>
  )
}

export default AzureFaceRecognition
