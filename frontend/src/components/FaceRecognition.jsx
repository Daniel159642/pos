import { useState, useRef, useEffect } from 'react'
import * as faceapi from 'face-api.js'

function FaceRecognition({ onFaceDetected, onError, isActive, threshold = 0.6 }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [faceDetected, setFaceDetected] = useState(false)
  const [detectionInterval, setDetectionInterval] = useState(null)

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoading(true)
        // Try loading from /models first, then fallback to CDN
        const MODEL_URL = '/models'
        
        try {
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          ])
        } catch (err) {
          // Fallback to CDN if local models not found
          console.warn('Local models not found, trying CDN...', err)
          const CDN_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL),
          ])
        }
        
        setModelsLoaded(true)
        setLoading(false)
      } catch (err) {
        console.error('Error loading face-api models:', err)
        setError('Failed to load face recognition models. Please ensure models are in /public/models folder.')
        setLoading(false)
        if (onError) onError(err)
      }
    }

    loadModels()
  }, [onError])

  // Start video stream
  useEffect(() => {
    if (!isActive || !modelsLoaded) return

    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        })
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        console.error('Error accessing camera:', err)
        setError('Unable to access camera. Please check permissions.')
        if (onError) onError(err)
      }
    }

    startVideo()

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks()
        tracks.forEach(track => track.stop())
      }
      if (detectionInterval) {
        clearInterval(detectionInterval)
      }
    }
  }, [isActive, modelsLoaded])

  // Face detection loop
  useEffect(() => {
    if (!isActive || !modelsLoaded || !videoRef.current) return

    const detectFace = async () => {
      if (!videoRef.current || !canvasRef.current) return

      try {
        const detections = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor()

        if (detections) {
          setFaceDetected(true)
          
          // Draw face detection box
          const canvas = canvasRef.current
          const displaySize = {
            width: videoRef.current.videoWidth,
            height: videoRef.current.videoHeight
          }
          
          faceapi.matchDimensions(canvas, displaySize)
          const resizedDetections = faceapi.resizeResults(detections, displaySize)
          
          const ctx = canvas.getContext('2d')
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          
          // Draw detection box
          const box = resizedDetections.detection.box
          ctx.strokeStyle = '#00ff00'
          ctx.lineWidth = 2
          ctx.strokeRect(box.x, box.y, box.width, box.height)
          
          // Call callback with face descriptor
          if (onFaceDetected) {
            onFaceDetected({
              descriptor: Array.from(detections.descriptor),
              detection: detections.detection
            })
          }
        } else {
          setFaceDetected(false)
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d')
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      } catch (err) {
        console.error('Error detecting face:', err)
      }
    }

    // Start detection loop (every 100ms)
    const interval = setInterval(detectFace, 100)
    setDetectionInterval(interval)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, modelsLoaded, onFaceDetected])

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading face recognition models...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#f44336' }}>
        <div>{error}</div>
        <div style={{ marginTop: '10px', fontSize: '12px' }}>
          Note: face-api.js models need to be downloaded and placed in /public/models folder
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: '100%',
          maxWidth: '640px',
          height: 'auto',
          borderRadius: '8px',
          transform: 'scaleX(-1)' // Mirror for better UX
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          transform: 'scaleX(-1)' // Mirror to match video
        }}
      />
      {faceDetected && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(76, 175, 80, 0.9)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 600
        }}>
          ✓ Face Detected
        </div>
      )}
    </div>
  )
}

export default FaceRecognition

