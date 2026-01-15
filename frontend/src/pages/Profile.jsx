import { useState, useEffect } from 'react'
import { usePermissions } from '../contexts/PermissionContext'
import { useTheme } from '../contexts/ThemeContext'
import AdminDashboard from '../components/AdminDashboard'
import FaceRecognition from '../components/FaceRecognition'

function Profile({ employeeId, employeeName }) {
  const { hasPermission } = usePermissions()
  const { themeColor, setThemeColor, themeMode, setThemeMode } = useTheme()
  const [activeTab, setActiveTab] = useState('profile')
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  const [loading, setLoading] = useState(true)
  const [weekSchedules, setWeekSchedules] = useState([])
  const [weekOffset, setWeekOffset] = useState(0) // 0 = this week, 1 = next week, -1 = last week
  const [hoursStats, setHoursStats] = useState({ thisWeek: 0, thisMonth: 0 })
  
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
  const [availability, setAvailability] = useState({
    monday: { available: true, start: '09:00', end: '17:00' },
    tuesday: { available: true, start: '09:00', end: '17:00' },
    wednesday: { available: true, start: '09:00', end: '17:00' },
    thursday: { available: true, start: '09:00', end: '17:00' },
    friday: { available: true, start: '09:00', end: '17:00' },
    saturday: { available: false, start: '09:00', end: '17:00' },
    sunday: { available: false, start: '09:00', end: '17:00' }
  })
  const [unavailableDates, setUnavailableDates] = useState([])
  const [showAddDate, setShowAddDate] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newNote, setNewNote] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [unavailableStartTime, setUnavailableStartTime] = useState('')
  const [unavailableEndTime, setUnavailableEndTime] = useState('')
  const [editingAvailability, setEditingAvailability] = useState(false)
  const [appSettings, setAppSettings] = useState({
    theme: 'light',
    notifications: true,
    soundEnabled: true,
    autoRefresh: true,
    refreshInterval: 30,
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    language: 'en'
  })
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [clockStatus, setClockStatus] = useState(null)
  const [clockLoading, setClockLoading] = useState(false)
  const [clockMessage, setClockMessage] = useState(null)
  const [showFaceRecognition, setShowFaceRecognition] = useState(false)
  const [faceRegistered, setFaceRegistered] = useState(false)
  const [faceVerifying, setFaceVerifying] = useState(false)
  const [currentFaceDescriptor, setCurrentFaceDescriptor] = useState(null)
  const [verificationAttempted, setVerificationAttempted] = useState(false)
  const [registrationStatus, setRegistrationStatus] = useState('idle') // idle, detecting, ready, registering, registered

  useEffect(() => {
    if (employeeId) {
      loadProfileData(weekOffset)
      loadAppSettings()
      loadClockStatus()
      checkFaceRegistration()
    }
  }, [employeeId, weekOffset])

  const checkFaceRegistration = async () => {
    try {
      const token = localStorage.getItem('sessionToken')
      const response = await fetch('/api/face/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setFaceRegistered(data.has_face || false)
      }
    } catch (err) {
      console.error('Error checking face registration:', err)
    }
  }

  useEffect(() => {
    // Refresh clock status every 30 seconds
    if (employeeId) {
      const interval = setInterval(() => {
        loadClockStatus()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [employeeId])

  const loadProfileData = async (weekOffsetParam = 0) => {
    setLoading(true)
    try {
      const today = new Date()
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffsetParam * 7))
      startOfWeek.setHours(0, 0, 0, 0)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)
      
      const startDate = startOfWeek.toISOString().split('T')[0]
      // Fetch a wider range (2 months back, 3 months forward) to support week navigation
      const fetchStartDate = new Date(startOfWeek)
      fetchStartDate.setDate(startOfWeek.getDate() - 60) // 2 months back
      const fetchEndDate = new Date(startOfWeek)
      fetchEndDate.setDate(startOfWeek.getDate() + 90) // 3 months forward
      
      const fetchStartDateStr = fetchStartDate.toISOString().split('T')[0]
      const fetchEndDateStr = fetchEndDate.toISOString().split('T')[0]

      // Get schedules for a wider range
      const scheduleRes = await fetch(`/api/employee_schedule?employee_id=${employeeId}&start_date=${fetchStartDateStr}&end_date=${fetchEndDateStr}`)
      const scheduleData = await scheduleRes.json()
      const allSchedules = scheduleData.data || []
      

      // Get this week's schedules
      const weekScheds = allSchedules
        .filter(s => {
          const dateField = s.schedule_date || s.shift_date
          if (!dateField) return false
          const sDate = new Date(dateField)
          if (isNaN(sDate.getTime())) return false
          return sDate >= startOfWeek && sDate <= endOfWeek
        })
        .sort((a, b) => {
          const dateA = new Date(a.schedule_date || a.shift_date || 0)
          const dateB = new Date(b.schedule_date || b.shift_date || 0)
          return dateA - dateB
        })
      setWeekSchedules(weekScheds)
      

      // Calculate hours
      const thisWeekHours = allSchedules
        .filter(s => {
          const dateField = s.schedule_date || s.shift_date
          if (!dateField) return false
          const sDate = new Date(dateField)
          if (isNaN(sDate.getTime())) return false
          return sDate >= startOfWeek && sDate <= endOfWeek && s.hours_worked
        })
        .reduce((sum, s) => sum + (s.hours_worked || 0), 0)
      
      const thisMonthHours = allSchedules
        .filter(s => {
          const dateField = s.schedule_date || s.shift_date
          if (!dateField) return false
          const sDate = new Date(dateField)
          if (isNaN(sDate.getTime())) return false
          return sDate.getMonth() === today.getMonth() && 
                 sDate.getFullYear() === today.getFullYear() && 
                 s.hours_worked
        })
        .reduce((sum, s) => sum + (s.hours_worked || 0), 0)

      setHoursStats({ thisWeek: thisWeekHours, thisMonth: thisMonthHours })

      // Load availability
      try {
        const availRes = await fetch(`/api/employee_availability?employee_id=${employeeId}`)
        if (availRes.ok) {
          const availData = await availRes.json()
          if (availData.data) {
            const loaded = {}
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            days.forEach(day => {
              if (availData.data[day]) {
                try {
                  const parsed = JSON.parse(availData.data[day])
                  loaded[day] = parsed
                } catch {
                  loaded[day] = { available: true, start: '09:00', end: '17:00' }
                }
              } else {
                loaded[day] = { available: true, start: '09:00', end: '17:00' }
              }
            })
            setAvailability(loaded)
          }
        }
      } catch (err) {
        console.error('Error loading availability:', err)
      }
    } catch (err) {
      console.error('Error loading profile data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAvailabilityChange = (day, field, value) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }))
  }

  const handleSaveAvailability = async () => {
    try {
      const formatted = {}
      Object.keys(availability).forEach(day => {
        formatted[day] = JSON.stringify(availability[day])
      })

      const response = await fetch('/api/employee_availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          ...formatted
        })
      })
      const data = await response.json()
      if (data.success) {
        alert('Availability saved')
      } else {
        alert('Failed to save availability')
      }
    } catch (err) {
      console.error('Error saving availability:', err)
      alert('Failed to save availability')
    }
  }

  const handleAddUnavailableDate = () => {
    if (!newDate) return
    const startDate = new Date(newDate)
    if (isNaN(startDate.getTime())) {
      alert('Please enter a valid date')
      return
    }

    // If end date is provided, create entries for all days in range
    const datesToAdd = []
    if (newEndDate && newEndDate >= newDate) {
      const endDate = new Date(newEndDate)
      const currentDate = new Date(startDate)
      
      while (currentDate <= endDate) {
        datesToAdd.push({
          date: currentDate.toISOString().split('T')[0],
          note: newNote,
          allDay: allDay,
          startTime: allDay ? null : unavailableStartTime,
          endTime: allDay ? null : unavailableEndTime
        })
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else {
      // Single date
      datesToAdd.push({
        date: newDate,
        note: newNote,
        allDay: allDay,
        startTime: allDay ? null : unavailableStartTime,
        endTime: allDay ? null : unavailableEndTime
      })
    }

    setUnavailableDates(prev => [...prev, ...datesToAdd])
    setNewDate('')
    setNewEndDate('')
    setNewNote('')
    setAllDay(true)
    setUnavailableStartTime('')
    setUnavailableEndTime('')
    setShowAddDate(false)
  }

  const handleRemoveUnavailableDate = (index) => {
    setUnavailableDates(prev => prev.filter((_, i) => i !== index))
  }

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const getDayName = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  }

  const loadAppSettings = () => {
    try {
      const saved = localStorage.getItem(`app_settings_${employeeId}`)
      if (saved) {
        setAppSettings(JSON.parse(saved))
      }
    } catch (err) {
      console.error('Error loading app settings:', err)
    }
  }

  const loadClockStatus = async () => {
    try {
      const token = localStorage.getItem('sessionToken')
      const response = await fetch('/api/clock/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setClockStatus(data)
      }
    } catch (err) {
      console.error('Error loading clock status:', err)
    }
  }

  const handleFaceDetected = async (faceData) => {
    if (!faceData || !faceData.descriptor) {
      setRegistrationStatus('idle')
      return
    }
    
    setCurrentFaceDescriptor(faceData.descriptor)
    
    // Update registration status
    if (!faceVerifying) {
      setRegistrationStatus('ready') // Face detected and ready to register
    }
    
    // If verifying, verify the face (but throttle to avoid spamming API)
    if (faceVerifying && !verificationAttempted) {
      setVerificationAttempted(true)
      await verifyFace(faceData.descriptor)
      // Reset after 2 seconds to allow retry
      setTimeout(() => setVerificationAttempted(false), 2000)
    }
  }

  const verifyFace = async (descriptor) => {
    try {
      setClockMessage({ type: 'info', text: 'Verifying face...' })
      
      const token = localStorage.getItem('sessionToken')
      const response = await fetch('/api/face/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ face_descriptor: descriptor })
      })
      
      const data = await response.json()
      
      if (data.success && data.verified) {
        // Face verified, proceed with clock in/out
        // NOTE: Both face recognition and button click use the same performClockIn/performClockOut
        // functions, which call the same API endpoints and save to the same employee_schedule table.
        // Face recognition is just an additional verification step before clocking in/out.
        setFaceVerifying(false)
        setShowFaceRecognition(false)
        setVerificationAttempted(false)
        
        // Determine action based on current clock status
        const wasClockedIn = clockStatus?.clocked_in
        if (wasClockedIn) {
          // Calls same function as button click - saves to employee_schedule table
          await performClockOut()
        } else {
          // Calls same function as button click - saves to employee_schedule table
          await performClockIn()
        }
      } else if (data.success && !data.verified) {
        setClockMessage({
          type: 'error',
          text: `Face verification failed. Match: ${(data.similarity * 100).toFixed(1)}% (needs ≥60%)`
        })
        setTimeout(() => setClockMessage(null), 5000)
        setVerificationAttempted(false) // Allow retry
      }
    } catch (err) {
      console.error('Error verifying face:', err)
      setClockMessage({ type: 'error', text: 'Error verifying face' })
      setTimeout(() => setClockMessage(null), 5000)
      setVerificationAttempted(false) // Allow retry
    }
  }

  const registerFace = async (descriptor) => {
    if (!descriptor) {
      setClockMessage({ type: 'error', text: 'No face detected. Please position yourself in front of the camera.' })
      setTimeout(() => setClockMessage(null), 5000)
      return
    }
    
    try {
      setRegistrationStatus('registering')
      setClockMessage({ type: 'info', text: 'Registering face...' })
      
      const token = localStorage.getItem('sessionToken')
      const response = await fetch('/api/face/register', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ face_descriptor: descriptor })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setFaceRegistered(true)
        setRegistrationStatus('registered')
        setShowFaceRecognition(false)
        setCurrentFaceDescriptor(null)
        setClockMessage({
          type: 'success',
          text: 'Face registered successfully! You can now use face verification for clock in/out.'
        })
        setTimeout(() => setClockMessage(null), 5000)
        checkFaceRegistration() // Refresh status
      } else {
        setRegistrationStatus('ready')
        setClockMessage({ type: 'error', text: data.message || 'Failed to register face' })
        setTimeout(() => setClockMessage(null), 5000)
      }
    } catch (err) {
      console.error('Error registering face:', err)
      setRegistrationStatus('ready')
      setClockMessage({ type: 'error', text: 'Error registering face' })
      setTimeout(() => setClockMessage(null), 5000)
    }
  }

  const performClockIn = async () => {
    setClockLoading(true)
    setClockMessage(null)
    try {
      const token = localStorage.getItem('sessionToken')
      const response = await fetch('/api/clock/in', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()
      if (data.success) {
        setClockStatus({ clocked_in: true, clock_in_time: data.clock_in_time })
        setClockMessage({
          type: 'success',
          text: data.schedule_comparison ? data.schedule_comparison.message : 'Clocked in successfully',
          comparison: data.schedule_comparison
        })
        setTimeout(() => setClockMessage(null), 5000)
      } else {
        setClockMessage({ type: 'error', text: data.message || 'Failed to clock in' })
        setTimeout(() => setClockMessage(null), 5000)
      }
    } catch (err) {
      console.error('Error clocking in:', err)
      setClockMessage({ type: 'error', text: 'Error clocking in' })
      setTimeout(() => setClockMessage(null), 5000)
    } finally {
      setClockLoading(false)
      loadClockStatus()
    }
  }

  // This function is used by BOTH button click and face recognition methods
  // Both methods save identical data to the employee_schedule table
  const performClockOut = async () => {
    setClockLoading(true)
    setClockMessage(null)
    try {
      const token = localStorage.getItem('sessionToken')
      const response = await fetch('/api/clock/out', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()
      if (data.success) {
        setClockStatus({ clocked_in: false })
        setClockMessage({
          type: 'success',
          text: `Clocked out successfully. Hours worked: ${data.hours_worked ? data.hours_worked.toFixed(2) : 'N/A'}`
        })
        setTimeout(() => setClockMessage(null), 5000)
      } else {
        setClockMessage({ type: 'error', text: data.message || 'Failed to clock out' })
        setTimeout(() => setClockMessage(null), 5000)
      }
    } catch (err) {
      console.error('Error clocking out:', err)
      setClockMessage({ type: 'error', text: 'Error clocking out' })
      setTimeout(() => setClockMessage(null), 5000)
    } finally {
      setClockLoading(false)
      loadClockStatus()
    }
  }

  const handleClockIn = async () => {
    if (faceRegistered) {
      // Show face recognition for verification
      setFaceVerifying(true)
      setShowFaceRecognition(true)
    } else {
      // No face registered, proceed without verification
      await performClockIn()
    }
  }

  const handleClockOut = async () => {
    if (faceRegistered) {
      // Show face recognition for verification
      setFaceVerifying(true)
      setShowFaceRecognition(true)
    } else {
      // No face registered, proceed without verification
      await performClockOut()
    }
  }

  const saveAppSettings = () => {
    try {
      localStorage.setItem(`app_settings_${employeeId}`, JSON.stringify(appSettings))
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 3000)
    } catch (err) {
      console.error('Error saving app settings:', err)
      alert('Failed to save settings')
    }
  }

  const handleSettingChange = (key, value) => {
    // Handle theme mode separately (global, not per employee)
    if (key === 'theme') {
      setThemeMode(value)
      return
    }
    
    setAppSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  if (loading) {
    return (
      <div style={{ 
        padding: '60px', 
        textAlign: 'center', 
        color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999', 
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        fontSize: '16px'
      }}>
        Loading...
      </div>
    )
  }

  const hasAdminAccess = hasPermission('manage_permissions') || hasPermission('add_employee')

  return (
    <div style={{ 
      padding: '32px 24px', 
      backgroundColor: 'var(--bg-secondary, #f5f5f5)', 
      minHeight: 'calc(100vh - 200px)',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Tab Selector */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px' 
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '10px 16px',
              backgroundColor: activeTab === 'profile' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: activeTab === 'profile' ? '1px solid rgba(255, 255, 255, 0.3)' : `1px solid rgba(${themeColorRgb}, 0.3)`,
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: activeTab === 'profile' ? 600 : 500,
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: activeTab === 'profile' ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'profile') {
                e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
                e.currentTarget.style.boxShadow = `0 4px 12px rgba(${themeColorRgb}, 0.2)`
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'profile') {
                e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
                e.currentTarget.style.boxShadow = `0 2px 8px rgba(${themeColorRgb}, 0.1)`
              }
            }}
          >
            Profile Settings
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '10px 16px',
              backgroundColor: activeTab === 'settings' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: activeTab === 'settings' ? '1px solid rgba(255, 255, 255, 0.3)' : `1px solid rgba(${themeColorRgb}, 0.3)`,
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: activeTab === 'settings' ? 600 : 500,
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: activeTab === 'settings' ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'settings') {
                e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
                e.currentTarget.style.boxShadow = `0 4px 12px rgba(${themeColorRgb}, 0.2)`
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'settings') {
                e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
                e.currentTarget.style.boxShadow = `0 2px 8px rgba(${themeColorRgb}, 0.1)`
              }
            }}
          >
            App Settings
          </button>
          {hasAdminAccess && (
            <button
              onClick={() => setActiveTab('admin')}
              style={{
                padding: '10px 16px',
                backgroundColor: activeTab === 'admin' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: activeTab === 'admin' ? '1px solid rgba(255, 255, 255, 0.3)' : `1px solid rgba(${themeColorRgb}, 0.3)`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: activeTab === 'admin' ? 600 : 500,
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: activeTab === 'admin' ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`
              }}
              onMouseEnter={(e) => {
                if (activeTab !== 'admin') {
                  e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
                  e.currentTarget.style.boxShadow = `0 4px 12px rgba(${themeColorRgb}, 0.2)`
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== 'admin') {
                  e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
                  e.currentTarget.style.boxShadow = `0 2px 8px rgba(${themeColorRgb}, 0.1)`
                }
              }}
            >
              Admin
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <>
          {/* Clock In/Out Button */}
          <div style={{
            marginBottom: '24px',
            padding: '20px',
            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
            borderRadius: '12px',
            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
            boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  marginBottom: '8px'
                }}>
                  Time Clock
                </div>
                {clockStatus?.clocked_in ? (
                  <div style={{
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-secondary, #999)' : '#666'
                  }}>
                    Clocked in since {clockStatus.clock_in_time ? new Date(clockStatus.clock_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                ) : (
                  <div style={{
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-secondary, #999)' : '#666'
                  }}>
                    Currently clocked out
                  </div>
                )}
                {clockMessage && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    backgroundColor: clockMessage.type === 'success' 
                      ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)')
                      : clockMessage.type === 'info'
                      ? (isDarkMode ? 'rgba(33, 150, 243, 0.2)' : 'rgba(33, 150, 243, 0.1)')
                      : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)'),
                    color: clockMessage.type === 'success'
                      ? (isDarkMode ? '#81c784' : '#2e7d32')
                      : clockMessage.type === 'info'
                      ? (isDarkMode ? '#64b5f6' : '#1976d2')
                      : (isDarkMode ? '#ef5350' : '#c62828'),
                    border: `1px solid ${clockMessage.type === 'success'
                      ? (isDarkMode ? 'rgba(76, 175, 80, 0.3)' : 'rgba(76, 175, 80, 0.2)')
                      : clockMessage.type === 'info'
                      ? (isDarkMode ? 'rgba(33, 150, 243, 0.3)' : 'rgba(33, 150, 243, 0.2)')
                      : (isDarkMode ? 'rgba(244, 67, 54, 0.3)' : 'rgba(244, 67, 54, 0.2)')}`
                  }}>
                    {clockMessage.text}
                    {clockMessage.comparison && clockMessage.comparison.status !== 'no_schedule' && (
                      <div style={{ marginTop: '4px', fontSize: '12px' }}>
                        {clockMessage.comparison.status === 'late' && (
                          <span style={{ color: isDarkMode ? '#ff9800' : '#f57c00' }}>
                            ⚠ Late by {clockMessage.comparison.minutes_late} minutes
                          </span>
                        )}
                        {clockMessage.comparison.status === 'early' && (
                          <span style={{ color: isDarkMode ? '#2196f3' : '#1976d2' }}>
                            ✓ Early by {Math.abs(clockMessage.comparison.minutes_late || 0)} minutes
                          </span>
                        )}
                        {clockMessage.comparison.wrong_hours && (
                          <span style={{ color: isDarkMode ? '#f44336' : '#c62828' }}>
                            ⚠ Working at wrong hours
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={clockStatus?.clocked_in ? handleClockOut : handleClockIn}
                disabled={clockLoading}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: clockStatus?.clocked_in 
                    ? (isDarkMode ? 'rgba(244, 67, 54, 0.8)' : '#f44336')
                    : `rgba(${themeColorRgb}, 0.8)`,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: clockLoading ? 'not-allowed' : 'pointer',
                  opacity: clockLoading ? 0.6 : 1,
                  transition: 'all 0.3s ease',
                  boxShadow: `0 2px 8px ${clockStatus?.clocked_in 
                    ? (isDarkMode ? 'rgba(244, 67, 54, 0.3)' : 'rgba(244, 67, 54, 0.2)')
                    : `rgba(${themeColorRgb}, 0.3)`}`
                }}
                onMouseEnter={(e) => {
                  if (!clockLoading) {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = clockStatus?.clocked_in
                      ? (isDarkMode ? '0 4px 12px rgba(244, 67, 54, 0.4)' : '0 4px 12px rgba(244, 67, 54, 0.3)')
                      : `0 4px 12px rgba(${themeColorRgb}, 0.4)`
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = clockStatus?.clocked_in
                    ? (isDarkMode ? 'rgba(244, 67, 54, 0.3)' : 'rgba(244, 67, 54, 0.2)')
                    : `rgba(${themeColorRgb}, 0.3)`
                }}
              >
                {clockLoading ? 'Processing...' : (clockStatus?.clocked_in ? 'Clock Out' : 'Clock In')}
              </button>
              {!faceRegistered && (
                <button
                  onClick={() => {
                    setShowFaceRecognition(true)
                    setFaceVerifying(false)
                  }}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#fff',
                    backgroundColor: `rgba(${themeColorRgb}, 0.6)`,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Register Face
                </button>
              )}
            </div>
          </div>

          {/* Face Recognition Modal */}
          {showFaceRecognition && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000
            }}
            onClick={() => {
              if (!faceVerifying) {
                setShowFaceRecognition(false)
              }
            }}
            >
              <div style={{
                backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '640px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px'
                }}>
                  <h2 style={{
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: 600,
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    {faceVerifying ? 'Face Verification' : 'Face Registration'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowFaceRecognition(false)
                      setFaceVerifying(false)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                      padding: '0',
                      width: '30px',
                      height: '30px'
                    }}
                  >
                    ×
                  </button>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                  <FaceRecognition
                    isActive={showFaceRecognition}
                    onFaceDetected={handleFaceDetected}
                    onError={(err) => {
                      console.error('Face recognition error:', err)
                      setClockMessage({ type: 'error', text: 'Face recognition error' })
                    }}
                    threshold={0.6}
                  />
                </div>

                {!faceVerifying && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    alignItems: 'center'
                  }}>
                    {currentFaceDescriptor ? (
                      <>
                        <div style={{
                          padding: '12px 20px',
                          backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)',
                          color: isDarkMode ? '#81c784' : '#2e7d32',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 500,
                          textAlign: 'center'
                        }}>
                          ✓ Face detected! Ready to register.
                        </div>
                        <button
                          onClick={() => registerFace(currentFaceDescriptor)}
                          disabled={registrationStatus === 'registering'}
                          style={{
                            padding: '12px 24px',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#fff',
                            backgroundColor: registrationStatus === 'registering' 
                              ? '#999' 
                              : `rgba(${themeColorRgb}, 0.8)`,
                            border: 'none',
                            borderRadius: '8px',
                            cursor: registrationStatus === 'registering' ? 'not-allowed' : 'pointer',
                            opacity: registrationStatus === 'registering' ? 0.6 : 1
                          }}
                        >
                          {registrationStatus === 'registering' ? 'Registering...' : 'Register This Face'}
                        </button>
                      </>
                    ) : (
                      <div style={{
                        padding: '12px 20px',
                        backgroundColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : 'rgba(255, 152, 0, 0.1)',
                        color: isDarkMode ? '#ffb74d' : '#f57c00',
                        borderRadius: '8px',
                        fontSize: '14px',
                        textAlign: 'center'
                      }}>
                        Position your face in front of the camera...
                      </div>
                    )}
                  </div>
                )}

                {faceVerifying && (
                  <div style={{
                    textAlign: 'center',
                    padding: '16px'
                  }}>
                    <div style={{
                      padding: '12px 20px',
                      backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : 'rgba(33, 150, 243, 0.1)',
                      color: isDarkMode ? '#64b5f6' : '#1976d2',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      marginBottom: '12px'
                    }}>
                      {verificationAttempted ? 'Verifying your face...' : 'Please look at the camera'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hours Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div style={{
          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '28px',
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
          boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'transform 0.2s, box-shadow 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.12)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
        }}
        >
          <div style={{ 
            fontSize: '13px', 
            color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', 
            marginBottom: '12px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
          }}>
            This Week
          </div>
          <div style={{ 
            fontSize: '42px', 
            fontWeight: 700,
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            lineHeight: '1.2'
          }}>
            {hoursStats.thisWeek.toFixed(1)}h
          </div>
        </div>

        <div style={{
          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
          borderRadius: '12px',
          padding: '28px',
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
          boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'transform 0.2s, box-shadow 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.12)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
        }}
        >
          <div style={{ 
            fontSize: '13px', 
            color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', 
            marginBottom: '12px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
          }}>
            This Month
          </div>
          <div style={{ 
            fontSize: '42px', 
            fontWeight: 700,
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            lineHeight: '1.2'
          }}>
            {hoursStats.thisMonth.toFixed(1)}h
          </div>
        </div>
      </div>

      {/* Weekly Schedule */}
      <div style={{
        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '28px',
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        marginBottom: '32px',
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5'
              e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-light, #333)' : '#ccc'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#e0e0e0'
            }}
          >
            ←
          </button>
          <h2 style={{ 
            margin: 0, 
            fontSize: '22px', 
            fontWeight: 600,
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            textAlign: 'center'
          }}>
            {(() => {
              const today = new Date()
              const startOfWeek = new Date(today)
              startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7))
              
              if (weekOffset === 0) {
                return "This Week's Schedule"
              } else if (weekOffset === 1) {
                return "Next Week's Schedule"
              } else if (weekOffset === -1) {
                return "Last Week's Schedule"
              } else {
                const weekStartStr = startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const weekEnd = new Date(startOfWeek)
                weekEnd.setDate(startOfWeek.getDate() + 6)
                const weekEndStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                return `Week of ${weekStartStr} - ${weekEndStr}`
              }
            })()}
          </h2>
          <button
            onClick={() => setWeekOffset(prev => prev + 1)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px',
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5'
              e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-light, #333)' : '#ccc'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#e0e0e0'
            }}
          >
            →
          </button>
        </div>
        {(() => {
          // Organize schedules by date in the week
          const today = new Date()
          const startOfWeek = new Date(today)
          startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7))
          startOfWeek.setHours(0, 0, 0, 0)
          
          // Create a map of schedules by date (YYYY-MM-DD format)
          const scheduleByDate = {}
          weekSchedules.forEach(schedule => {
            const dateField = schedule.schedule_date || schedule.shift_date
            if (dateField) {
              const sDate = new Date(dateField)
              if (!isNaN(sDate.getTime())) {
                const dateKey = sDate.toISOString().split('T')[0] // YYYY-MM-DD
                scheduleByDate[dateKey] = schedule
              }
            }
          })
          
          const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          
          // Generate dates for each day of the week
          const weekDays = []
          for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek)
            dayDate.setDate(startOfWeek.getDate() + i)
            const dateKey = dayDate.toISOString().split('T')[0]
            weekDays.push({
              date: dayDate,
              dateKey: dateKey,
              schedule: scheduleByDate[dateKey] || null
            })
          }
          
          return (
            <div style={{
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'
            }}>
              {/* Header */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)',
                borderBottom: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5'
              }}>
                {weekDays.map((dayInfo, index) => {
                  const isToday = dayInfo.date.toDateString() === new Date().toDateString()
                  const dayName = dayInfo.date.toLocaleDateString('en-US', { weekday: 'short' })
                  
                  return (
                    <div 
                      key={dayInfo.dateKey}
                      style={{
                        padding: '12px 8px',
                        borderRight: index < 6 ? (isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0') : 'none',
                        textAlign: 'center',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#555',
                        backgroundColor: isToday ? (isDarkMode ? `rgba(${themeColorRgb}, 0.2)` : `rgba(${themeColorRgb}, 0.1)`) : 'transparent'
                      }}
                    >
                      {dayName}
                      <div style={{ fontSize: '11px', fontWeight: 400, marginTop: '4px', opacity: 0.7 }}>
                        {dayInfo.date.getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Schedule Content */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
              }}>
                {weekDays.map((dayInfo, index) => {
                  const schedule = dayInfo.schedule
                  const hasSchedule = schedule && schedule.start_time && schedule.end_time
                  
                  return (
                    <div 
                      key={dayInfo.dateKey}
                      style={{
                        padding: '20px 8px',
                        borderRight: index < 6 ? (isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0') : 'none',
                        textAlign: 'center',
                        minHeight: '80px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'
                      }}
                    >
                      {hasSchedule ? (
                        <>
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: 600, 
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
                            marginBottom: '4px'
                          }}>
                            {formatTime(schedule.start_time)}
                          </div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                            marginBottom: '4px'
                          }}>
                            to
                          </div>
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: 600, 
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a'
                          }}>
                            {formatTime(schedule.end_time)}
                          </div>
                        </>
                      ) : (
                        <div style={{ 
                          fontSize: '13px', 
                          color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999',
                          fontStyle: 'italic'
                        }}>
                          Off
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Availability Section */}
      <div style={{
        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
        borderRadius: '12px',
        padding: '28px',
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        marginBottom: '32px',
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{ 
          margin: '0 0 28px 0', 
          fontSize: '22px', 
          fontWeight: 600,
          color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
        }}>
          Availability
        </h2>

        {/* Weekly Availability */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
          }}>
            <div style={{ 
              fontSize: '15px', 
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
              fontWeight: 500,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
            }}>
              Weekly Availability
            </div>
            <button
              onClick={() => setEditingAvailability(!editingAvailability)}
              style={{
                padding: '8px 16px',
                backgroundColor: editingAvailability ? (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#666') : (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#1a1a1a'),
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!editingAvailability) {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#333'
                }
              }}
              onMouseLeave={(e) => {
                if (!editingAvailability) {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#1a1a1a'
                }
              }}
            >
              {editingAvailability ? 'Cancel' : 'Edit'}
            </button>
          </div>
          
          {!editingAvailability ? (
            <div style={{
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'
            }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)',
                borderBottom: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5'
              }}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <div 
                    key={day}
                    style={{
                      padding: '14px 8px',
                      borderRight: day !== 'sunday' ? (isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0') : 'none',
                      textAlign: 'center',
                      fontSize: '13px',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#555'
                    }}
                  >
                    {day.substring(0, 3)}
                  </div>
                ))}
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
              }}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <div 
                    key={day}
                    style={{
                      padding: '16px 8px',
                      borderRight: day !== 'sunday' ? (isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0') : 'none',
                      textAlign: 'center',
                      fontSize: '13px',
                      color: availability[day]?.available ? (isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a') : (isDarkMode ? 'var(--text-tertiary, #999)' : '#999'),
                      whiteSpace: 'nowrap',
                      fontWeight: availability[day]?.available ? 500 : 400
                    }}
                  >
                    {availability[day]?.available 
                      ? `${availability[day]?.start || '09:00'} - ${availability[day]?.end || '17:00'}`
                      : 'Unavailable'
                    }
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              padding: '24px',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <div key={day} style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    padding: '16px',
                    backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
                    borderRadius: '8px',
                    border: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #e8e8e8'
                  }}>
                    <div style={{ 
                      fontSize: '15px', 
                      fontWeight: 600, 
                      textTransform: 'capitalize', 
                      marginBottom: '4px',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a'
                    }}>
                      {day}
                    </div>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}>
                      <input
                        type="checkbox"
                        checked={availability[day]?.available || false}
                        onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                        style={{ 
                          cursor: 'pointer', 
                          width: '18px', 
                          height: '18px',
                          accentColor: isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'
                        }}
                      />
                      <span style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Available</span>
                    </label>
                    {availability[day]?.available && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        marginLeft: '28px',
                        flexWrap: 'wrap'
                      }}>
                        <label style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', fontWeight: 500 }}>From:</label>
                        <input
                          type="time"
                          value={availability[day]?.start || '09:00'}
                          onChange={(e) => handleAvailabilityChange(day, 'start', e.target.value)}
                          style={{
                            padding: '8px 12px',
                            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : 'white',
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'}
                          onBlur={(e) => e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ccc'}
                        />
                        <label style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', fontWeight: 500, marginLeft: '8px' }}>To:</label>
                        <input
                          type="time"
                          value={availability[day]?.end || '17:00'}
                          onChange={(e) => handleAvailabilityChange(day, 'end', e.target.value)}
                          style={{
                            padding: '8px 12px',
                            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : 'white',
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'}
                          onBlur={(e) => e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ccc'}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    handleSaveAvailability()
                    setEditingAvailability(false)
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '12px 24px',
                    backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#1a1a1a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                    alignSelf: 'flex-start',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#333'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#1a1a1a'}
                >
                  Save All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Unavailable Dates */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <div style={{ 
              fontSize: '15px', 
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
              fontWeight: 500,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
            }}>
              Days I Can't Work
            </div>
            <button
              onClick={() => setShowAddDate(!showAddDate)}
              style={{
                padding: '8px 16px',
                backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#1a1a1a',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#333'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#1a1a1a'}
            >
              + Add Date
            </button>
          </div>

          {showAddDate && (
            <div style={{
              padding: '24px',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
              borderRadius: '8px',
              marginBottom: '20px',
              backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ 
                    fontSize: '14px', 
                    display: 'block', 
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : 'white',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'}
                    onBlur={(e) => e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ccc'}
                  />
                </div>
                <div>
                  <label style={{ 
                    fontSize: '14px', 
                    display: 'block', 
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    End Date (optional - leave blank for single day)
                  </label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    min={newDate}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : 'white',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'}
                    onBlur={(e) => e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ccc'}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}>
                    <input
                      type="checkbox"
                      checked={allDay}
                      onChange={(e) => setAllDay(e.target.checked)}
                      style={{ 
                        cursor: 'pointer', 
                        width: '18px', 
                        height: '18px',
                        accentColor: isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'
                      }}
                    />
                    <span style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>All day</span>
                  </label>
                </div>
                {!allDay && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ 
                        fontSize: '14px', 
                        display: 'block', 
                        marginBottom: '8px',
                        fontWeight: 500,
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Can't work from:
                      </label>
                      <input
                        type="time"
                        value={unavailableStartTime}
                        onChange={(e) => setUnavailableStartTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : 'white',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'}
                        onBlur={(e) => e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ccc'}
                      />
                    </div>
                    <div>
                      <label style={{ 
                        fontSize: '14px', 
                        display: 'block', 
                        marginBottom: '8px',
                        fontWeight: 500,
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Can't work until:
                      </label>
                      <input
                        type="time"
                        value={unavailableEndTime}
                        onChange={(e) => setUnavailableEndTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : 'white',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'}
                        onBlur={(e) => e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ccc'}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label style={{ 
                    fontSize: '14px', 
                    display: 'block', 
                    marginBottom: '8px',
                    fontWeight: 500,
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Note (optional)
                  </label>
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="e.g., Vacation, Doctor appointment"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : 'white',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'}
                    onBlur={(e) => e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ccc'}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={handleAddUnavailableDate}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#1a1a1a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#333'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#1a1a1a'}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddDate(false)
                      setNewDate('')
                      setNewEndDate('')
                      setNewNote('')
                      setAllDay(true)
                      setUnavailableStartTime('')
                      setUnavailableEndTime('')
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : 'white',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5'
                      e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-light, #333)' : '#999'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : 'white'
                      e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ccc'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {unavailableDates.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {unavailableDates.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    border: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #e8e8e8',
                    borderRadius: '8px',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5'
                    e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#d0d0d0'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'
                    e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-light, #333)' : '#e8e8e8'
                  }}
                >
                  <div>
                    <div style={{ 
                      fontSize: '15px', 
                      fontWeight: 600,
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
                      marginBottom: '4px'
                    }}>
                      {new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    {!item.allDay && item.startTime && item.endTime && (
                      <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginTop: '4px' }}>
                        Can't work: {item.startTime} - {item.endTime}
                      </div>
                    )}
                    {item.note && (
                      <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginTop: '4px' }}>
                        {item.note}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveUnavailableDate(index)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
                      color: '#d32f2f',
                      border: '1px solid #d32f2f',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#ffebee'
                      e.currentTarget.style.borderColor = '#c62828'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white'
                      e.currentTarget.style.borderColor = '#d32f2f'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999', 
              fontSize: '14px', 
              textAlign: 'center', 
              padding: '40px 20px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
            }}>
              No unavailable dates added
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {activeTab === 'settings' && (
        <div>
          <div style={{
            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
            borderRadius: '12px',
            padding: '28px',
            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
            marginBottom: '32px',
            boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h2 style={{ 
              margin: '0 0 28px 0', 
              fontSize: '22px', 
              fontWeight: 600,
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
            }}>
              Application Settings
            </h2>

            {settingsSaved && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: '#4caf50',
                color: 'white',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
              }}>
                Settings saved successfully!
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Theme Settings */}
              <div style={{
                padding: '20px',
                border: '1px solid var(--border-light, #e8e8e8)',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-tertiary, #fafafa)'
              }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1a1a1a)',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                }}>
                  Appearance
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: 'var(--text-secondary, #333)',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                  }}>
                    <span>Theme</span>
                    <select
                      value={themeMode}
                      onChange={(e) => handleSettingChange('theme', e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid var(--border-color, #ccc)',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                        backgroundColor: 'var(--bg-primary, white)',
                        color: 'var(--text-primary, #333)',
                        cursor: 'pointer',
                        minWidth: '120px'
                      }}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="auto">Auto</option>
                    </select>
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                  }}>
                    <span>Theme Color</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="color"
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value)}
                        style={{
                          width: '60px',
                          height: '36px',
                          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          padding: '2px'
                        }}
                      />
                      <input
                        type="text"
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value)}
                        placeholder="#8400ff"
                        style={{
                          padding: '8px 12px',
                          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          width: '100px'
                        }}
                      />
                    </div>
                  </label>
                </div>
              </div>

              {/* Notification Settings */}
              <div style={{
                padding: '20px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e8e8e8',
                borderRadius: '8px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'
              }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                }}>
                  Notifications & Sounds
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}>
                    <span>Enable Notifications</span>
                    <input
                      type="checkbox"
                      checked={appSettings.notifications}
                      onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                      style={{
                        cursor: 'pointer',
                        width: '18px',
                        height: '18px',
                        accentColor: isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'
                      }}
                    />
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}>
                    <span>Enable Sounds</span>
                    <input
                      type="checkbox"
                      checked={appSettings.soundEnabled}
                      onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                      style={{
                        cursor: 'pointer',
                        width: '18px',
                        height: '18px',
                        accentColor: isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Data Refresh Settings */}
              <div style={{
                padding: '20px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e8e8e8',
                borderRadius: '8px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'
              }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                }}>
                  Data Refresh
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}>
                    <span>Auto Refresh</span>
                    <input
                      type="checkbox"
                      checked={appSettings.autoRefresh}
                      onChange={(e) => handleSettingChange('autoRefresh', e.target.checked)}
                      style={{
                        cursor: 'pointer',
                        width: '18px',
                        height: '18px',
                        accentColor: isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'
                      }}
                    />
                  </label>
                  {appSettings.autoRefresh && (
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '14px',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                    }}>
                      <span>Refresh Interval (seconds)</span>
                      <input
                        type="number"
                        min="10"
                        max="300"
                        step="10"
                        value={appSettings.refreshInterval}
                        onChange={(e) => handleSettingChange('refreshInterval', parseInt(e.target.value))}
                        style={{
                          padding: '8px 12px',
                          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          width: '100px',
                          textAlign: 'right'
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Date & Time Format */}
              <div style={{
                padding: '20px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e8e8e8',
                borderRadius: '8px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'
              }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                }}>
                  Date & Time Format
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                  }}>
                    <span>Date Format</span>
                    <select
                      value={appSettings.dateFormat}
                      onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        cursor: 'pointer',
                        minWidth: '150px'
                      }}
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      <option value="DD MMM YYYY">DD MMM YYYY</option>
                    </select>
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                  }}>
                    <span>Time Format</span>
                    <select
                      value={appSettings.timeFormat}
                      onChange={(e) => handleSettingChange('timeFormat', e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        cursor: 'pointer',
                        minWidth: '120px'
                      }}
                    >
                      <option value="12h">12 Hour</option>
                      <option value="24h">24 Hour</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* Language Settings */}
              <div style={{
                padding: '20px',
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e8e8e8',
                borderRadius: '8px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'
              }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                }}>
                  Language
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                  }}>
                    <span>Language</span>
                    <select
                      value={appSettings.language}
                      onChange={(e) => handleSettingChange('language', e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        cursor: 'pointer',
                        minWidth: '120px'
                      }}
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* Save Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={saveAppSettings}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#1a1a1a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#333'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#1a1a1a'}
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'admin' && hasAdminAccess && (
        <div>
          <AdminDashboard />
        </div>
      )}
    </div>
  )
}

export default Profile
