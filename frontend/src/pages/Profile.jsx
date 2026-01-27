import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '../contexts/PermissionContext'
import { useTheme } from '../contexts/ThemeContext'
import AdminDashboard from '../components/AdminDashboard'
import { 
  User, 
  Settings as SettingsIcon, 
  Shield,
  Users,
  Clock,
  Pencil,
  Trash2,
  PanelLeft
} from 'lucide-react'
import { EmployeeList } from '../components/EmployeeManagement'
import { FormLabel, FormField, inputBaseStyle, getInputFocusHandlers } from '../components/FormStyles'

function Profile({ employeeId, employeeName }) {
  const { hasPermission, employee } = usePermissions()
  const { themeColor, setThemeColor, themeMode, setThemeMode } = useTheme()
  const [activeTab, setActiveTab] = useState('profile')
  const [scheduleTab, setScheduleTab] = useState('schedule') // 'schedule' or 'availability'
  const [sidebarMinimized, setSidebarMinimized] = useState(false)
  const [hoveringProfile, setHoveringProfile] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const profileHeaderRef = useRef(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [isInitialMount, setIsInitialMount] = useState(true)
  
  useEffect(() => {
    const timer = setTimeout(() => setIsInitialMount(false), 0)
    return () => clearTimeout(timer)
  }, [])
  
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
  const [editingDateIndex, setEditingDateIndex] = useState(null) // Track which date is being edited
  const [newDate, setNewDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newNote, setNewNote] = useState('')
  const [unavailableStartTime, setUnavailableStartTime] = useState('')
  const [unavailableEndTime, setUnavailableEndTime] = useState('')
  const [startTimeFocused, setStartTimeFocused] = useState(false)
  const [endTimeFocused, setEndTimeFocused] = useState(false)
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
  const [employees, setEmployees] = useState([])
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const [employeesError, setEmployeesError] = useState(null)

  const hasAdminAccess = hasPermission('manage_permissions') || hasPermission('add_employee') || employee?.position?.toLowerCase() === 'admin'

  const loadEmployees = async () => {
    setEmployeesLoading(true)
    setEmployeesError(null)
    try {
      const response = await fetch('/api/employees')
      const data = await response.json()
      setEmployees(data.data || [])
    } catch (err) {
      setEmployeesError('Failed to load employees')
      console.error(err)
    } finally {
      setEmployeesLoading(false)
    }
  }

  useEffect(() => {
    if (employeeId) {
      loadProfileData(weekOffset)
      loadAppSettings()
      loadClockStatus()
    }
    if (hasAdminAccess) {
      loadEmployees()
    }
  }, [employeeId, weekOffset, hasAdminAccess])

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
          startTime: unavailableStartTime || null,
          endTime: unavailableEndTime || null
        })
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else {
      // Single date
      datesToAdd.push({
        date: newDate,
        note: newNote,
        startTime: unavailableStartTime || null,
        endTime: unavailableEndTime || null
      })
    }

    // If editing, replace the date instead of adding
    if (editingDateIndex !== null) {
      setUnavailableDates(prev => {
        const updated = [...prev]
        // Remove the old date
        updated.splice(editingDateIndex, 1)
        // Insert new dates at the same position
        updated.splice(editingDateIndex, 0, ...datesToAdd)
        return updated
      })
      setEditingDateIndex(null)
    } else {
      setUnavailableDates(prev => [...prev, ...datesToAdd])
    }

    setNewDate('')
    setNewEndDate('')
    setNewNote('')
    setUnavailableStartTime('')
    setUnavailableEndTime('')
    setStartTimeFocused(false)
    setEndTimeFocused(false)
    setShowAddDate(false)
  }

  const handleRemoveUnavailableDate = (index) => {
    setUnavailableDates(prev => prev.filter((_, i) => i !== index))
  }

  const handleEditUnavailableDate = (index) => {
    const item = unavailableDates[index]
    if (!item) return
    
    // Set form values with the date's data
    setNewDate(item.date)
    setNewEndDate('') // Start with single date, user can add end date if needed
    setNewNote(item.note || '')
    setUnavailableStartTime(item.startTime || '')
    setUnavailableEndTime(item.endTime || '')
    setStartTimeFocused(false)
    setEndTimeFocused(false)
    
    // Store the index being edited (don't remove the date yet)
    setEditingDateIndex(index)
    
    // Open the form
    setShowAddDate(true)
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

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'))
        return
      }
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          
          // Try to get address from coordinates (reverse geocoding)
          let address = null
          try {
            // Using a free reverse geocoding service
            const geoResponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
            )
            const geoData = await geoResponse.json()
            if (geoData && geoData.display_name) {
              address = geoData.display_name
            }
          } catch (err) {
            console.warn('Could not get address from coordinates:', err)
          }
          
          resolve({ latitude, longitude, address })
        },
        (error) => {
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    })
  }

  const performClockIn = async () => {
    setClockLoading(true)
    setClockMessage(null)
    try {
      // Get current location
      let locationData = { latitude: null, longitude: null, address: null }
      try {
        locationData = await getCurrentLocation()
        setClockMessage({ type: 'info', text: 'Location obtained, clocking in...' })
      } catch (locationError) {
        console.warn('Location error:', locationError)
        setClockMessage({ 
          type: 'warning', 
          text: 'Could not get location. Clocking in without location verification.' 
        })
      }
      
      const token = localStorage.getItem('sessionToken')
      const response = await fetch('/api/clock/in', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          address: locationData.address
        })
      })
      const data = await response.json()
      if (data.success) {
        setClockStatus({ clocked_in: true, clock_in_time: data.clock_in_time })
        const locationMsg = data.location_validation?.message 
          ? ` ${data.location_validation.message}` 
          : ''
        setClockMessage({
          type: 'success',
          text: (data.schedule_comparison ? data.schedule_comparison.message : 'Clocked in successfully') + locationMsg,
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

  const performClockOut = async () => {
    setClockLoading(true)
    setClockMessage(null)
    try {
      // Get current location
      let locationData = { latitude: null, longitude: null, address: null }
      try {
        locationData = await getCurrentLocation()
        setClockMessage({ type: 'info', text: 'Location obtained, clocking out...' })
      } catch (locationError) {
        console.warn('Location error:', locationError)
        setClockMessage({ 
          type: 'warning', 
          text: 'Could not get location. Clocking out without location verification.' 
        })
      }
      
      const token = localStorage.getItem('sessionToken')
      const response = await fetch('/api/clock/out', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          address: locationData.address
        })
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
    await performClockIn()
  }

  const handleClockOut = async () => {
    await performClockOut()
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

  const profileSections = [
    { id: 'profile', label: 'My Hours', icon: Clock },
    { id: 'settings', label: 'App Settings', icon: SettingsIcon },
    ...(hasAdminAccess ? [
      { id: 'employees', label: 'Employees', icon: Users },
      { id: 'admin', label: 'Admin', icon: Shield }
    ] : [])
  ]

  return (
    <div style={{ 
      display: 'flex',
      minHeight: '100vh',
      width: '100%'
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
          {/* Profile Header */}
          <div
            ref={profileHeaderRef}
            style={{ position: 'relative' }}
            onMouseEnter={(e) => {
              setHoveringProfile(true)
              setShowTooltip(true)
              if (profileHeaderRef.current) {
                const rect = profileHeaderRef.current.getBoundingClientRect()
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
              setHoveringProfile(false)
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
                  hoveringProfile ? (
                    <PanelLeft size={20} style={{ width: '20px', height: '20px' }} />
                  ) : (
                    <User size={20} style={{ width: '20px', height: '20px' }} />
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
                  Profile
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
          {profileSections.map((section) => {
            const Icon = section.icon
            const isActive = activeTab === section.id
            return (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
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
            </div>
          </div>

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

      {/* Schedule & Availability Tabs */}
      <div style={{
        marginBottom: '32px'
      }}>
        {/* Tab Buttons */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0'
        }}>
          <button
            onClick={() => setScheduleTab('schedule')}
            style={{
              padding: '12px 24px',
              backgroundColor: scheduleTab === 'schedule' 
                ? (isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5')
                : 'transparent',
              border: 'none',
              borderBottom: scheduleTab === 'schedule' 
                ? `2px solid rgba(${themeColorRgb}, 0.8)`
                : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: scheduleTab === 'schedule' ? 600 : 400,
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              transition: 'all 0.2s',
              marginBottom: '-1px'
            }}
            onMouseEnter={(e) => {
              if (scheduleTab !== 'schedule') {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5'
              }
            }}
            onMouseLeave={(e) => {
              if (scheduleTab !== 'schedule') {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            Schedule
          </button>
          <button
            onClick={() => setScheduleTab('availability')}
            style={{
              padding: '12px 24px',
              backgroundColor: scheduleTab === 'availability' 
                ? (isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5')
                : 'transparent',
              border: 'none',
              borderBottom: scheduleTab === 'availability' 
                ? `2px solid rgba(${themeColorRgb}, 0.8)`
                : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: scheduleTab === 'availability' ? 600 : 400,
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              transition: 'all 0.2s',
              marginBottom: '-1px'
            }}
            onMouseEnter={(e) => {
              if (scheduleTab !== 'availability') {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5'
              }
            }}
            onMouseLeave={(e) => {
              if (scheduleTab !== 'availability') {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            Availability
          </button>
        </div>

        {/* Schedule Tab Content */}
        {scheduleTab === 'schedule' && (
          <div>
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
        )}

        {/* Availability Tab Content */}
        {scheduleTab === 'availability' && (
          <div>

        {/* Weekly Availability */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
          }}>
            <button
              onClick={() => setShowAddDate(!showAddDate)}
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
                boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                transition: 'all 0.3s ease'
              }}
            >
              + Add Date
            </button>
            {editingAvailability && (
              <button
                onClick={() => {
                  handleSaveAvailability()
                  setEditingAvailability(false)
                }}
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
                  boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                  transition: 'all 0.3s ease'
                }}
              >
                Save All
              </button>
            )}
            <button
              onClick={() => setEditingAvailability(!editingAvailability)}
              style={{
                padding: '10px 20px',
                backgroundColor: editingAvailability 
                  ? `rgba(${themeColorRgb}, 0.2)`
                  : `rgba(${themeColorRgb}, 0.7)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                boxShadow: editingAvailability 
                  ? `0 2px 8px rgba(${themeColorRgb}, 0.1)`
                  : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                transition: 'all 0.3s ease'
              }}
            >
              {editingAvailability ? 'Cancel' : 'Edit'}
            </button>
          </div>
          
          {(() => {
            // Generate current week days (same structure as schedule)
            const today = new Date()
            const startOfWeek = new Date(today)
            startOfWeek.setDate(today.getDate() - today.getDay())
            startOfWeek.setHours(0, 0, 0, 0)
            
            // Map day names to availability keys
            const dayNameToAvailabilityKey = {
              'sunday': 'sunday',
              'monday': 'monday',
              'tuesday': 'tuesday',
              'wednesday': 'wednesday',
              'thursday': 'thursday',
              'friday': 'friday',
              'saturday': 'saturday'
            }
            
            // Generate dates for each day of the week
            const weekDays = []
            for (let i = 0; i < 7; i++) {
              const dayDate = new Date(startOfWeek)
              dayDate.setDate(startOfWeek.getDate() + i)
              const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
              weekDays.push({
                date: dayDate,
                availabilityKey: dayNameToAvailabilityKey[dayName] || dayName,
                dayName: dayName
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
                          key={dayInfo.availabilityKey}
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
                  
                  {/* Availability Content */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
                  }}>
                    {weekDays.map((dayInfo, index) => {
                      const dayAvailability = availability[dayInfo.availabilityKey]
                      const isAvailable = dayAvailability?.available
                      
                      return (
                        <div 
                          key={dayInfo.availabilityKey}
                          style={{
                            padding: editingAvailability ? '12px 8px' : '20px 8px',
                            borderRight: index < 6 ? (isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0') : 'none',
                            textAlign: 'center',
                            minHeight: editingAvailability ? 'auto' : '80px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: editingAvailability ? '8px' : '0',
                            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'
                          }}
                        >
                          {editingAvailability ? (
                            <>
                              <label style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                cursor: 'pointer',
                                userSelect: 'none',
                                fontSize: '12px',
                                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                              }}>
                                <input
                                  type="checkbox"
                                  checked={isAvailable || false}
                                  onChange={(e) => handleAvailabilityChange(dayInfo.availabilityKey, 'available', e.target.checked)}
                                  style={{ 
                                    cursor: 'pointer', 
                                    width: '16px', 
                                    height: '16px',
                                    accentColor: isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'
                                  }}
                                />
                                <span>Available</span>
                              </label>
                              {isAvailable && (
                                <>
                                  <input
                                    type="time"
                                    value={dayAvailability?.start || '09:00'}
                                    onChange={(e) => handleAvailabilityChange(dayInfo.availabilityKey, 'start', e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '6px 8px',
                                      border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                                      backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
                                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                      transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'}
                                    onBlur={(e) => e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ccc'}
                                  />
                                  <div style={{ fontSize: '11px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>to</div>
                                  <input
                                    type="time"
                                    value={dayAvailability?.end || '17:00'}
                                    onChange={(e) => handleAvailabilityChange(dayInfo.availabilityKey, 'end', e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '6px 8px',
                                      border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ccc',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
                                      backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
                                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                      transition: 'border-color 0.2s'
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a'}
                                    onBlur={(e) => e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ccc'}
                                  />
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              {isAvailable ? (
                                <>
                                  <div style={{ 
                                    fontSize: '14px', 
                                    fontWeight: 600, 
                                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
                                    marginBottom: '4px'
                                  }}>
                                    {formatTime(dayAvailability.start || '09:00')}
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
                                    {formatTime(dayAvailability.end || '17:00')}
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
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
            )
          })()}
        </div>

        {/* Unavailable Dates */}
        <div>

          {showAddDate && (
            <div style={{
              padding: '24px',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0',
              borderRadius: '8px',
              marginBottom: '20px',
              backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <FormField style={{ marginBottom: '12px' }}>
                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Start Date</FormLabel>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    style={inputBaseStyle(isDarkMode, themeColorRgb)}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                </FormField>
                
                <FormField style={{ marginBottom: '12px' }}>
                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>End Date (optional - leave blank for single day)</FormLabel>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    min={newDate}
                    style={inputBaseStyle(isDarkMode, themeColorRgb)}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                </FormField>
                
                <FormField style={{ marginBottom: '12px' }}>
                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Can't work from:</FormLabel>
                  <div 
                    style={{ position: 'relative', cursor: 'text' }}
                    onClick={(e) => {
                      const input = e.currentTarget.querySelector('input')
                      if (input) input.focus()
                    }}
                  >
                    <input
                      type="time"
                      value={unavailableStartTime}
                      onChange={(e) => setUnavailableStartTime(e.target.value)}
                      onFocus={(e) => {
                        setStartTimeFocused(true)
                        getInputFocusHandlers(themeColorRgb, isDarkMode).onFocus(e)
                      }}
                      onBlur={(e) => {
                        setStartTimeFocused(false)
                        getInputFocusHandlers(themeColorRgb, isDarkMode).onBlur(e)
                      }}
                      style={{
                        ...inputBaseStyle(isDarkMode, themeColorRgb),
                        color: (unavailableStartTime || startTimeFocused) ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333') : 'transparent'
                      }}
                    />
                    {!unavailableStartTime && !startTimeFocused && (
                      <div style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999',
                        fontStyle: 'italic'
                      }}>
                        All day
                      </div>
                    )}
                  </div>
                </FormField>
                
                <FormField style={{ marginBottom: '12px' }}>
                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Can't work until:</FormLabel>
                  <div 
                    style={{ position: 'relative', cursor: 'text' }}
                    onClick={(e) => {
                      const input = e.currentTarget.querySelector('input')
                      if (input) input.focus()
                    }}
                  >
                    <input
                      type="time"
                      value={unavailableEndTime}
                      onChange={(e) => setUnavailableEndTime(e.target.value)}
                      onFocus={(e) => {
                        setEndTimeFocused(true)
                        getInputFocusHandlers(themeColorRgb, isDarkMode).onFocus(e)
                      }}
                      onBlur={(e) => {
                        setEndTimeFocused(false)
                        getInputFocusHandlers(themeColorRgb, isDarkMode).onBlur(e)
                      }}
                      style={{
                        ...inputBaseStyle(isDarkMode, themeColorRgb),
                        color: (unavailableEndTime || endTimeFocused) ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333') : 'transparent'
                      }}
                    />
                    {!unavailableEndTime && !endTimeFocused && (
                      <div style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none',
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999',
                        fontStyle: 'italic'
                      }}>
                        All day
                      </div>
                    )}
                  </div>
                </FormField>
                
                <FormField style={{ marginBottom: '12px' }}>
                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Note (optional)</FormLabel>
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="e.g., Vacation, Doctor appointment"
                    style={inputBaseStyle(isDarkMode, themeColorRgb)}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                </FormField>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="button-26 button-26--header"
                    role="button"
                    onClick={() => {
                      setShowAddDate(false)
                      setNewDate('')
                      setNewEndDate('')
                      setNewNote('')
                      setUnavailableStartTime('')
                      setUnavailableEndTime('')
                      setStartTimeFocused(false)
                      setEndTimeFocused(false)
                      setEditingDateIndex(null) // Clear editing state on cancel
                    }}
                  >
                    <div className="button-26__content">
                      <span className="button-26__text text">Cancel</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="button-26 button-26--header"
                    role="button"
                    onClick={handleAddUnavailableDate}
                  >
                    <div className="button-26__content">
                      <span className="button-26__text text">Add</span>
                    </div>
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
                    {item.startTime && item.endTime ? (
                      <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginTop: '4px' }}>
                        Can't work: {item.startTime} - {item.endTime}
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginTop: '4px' }}>
                        All day
                      </div>
                    )}
                    {item.note && (
                      <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginTop: '4px' }}>
                        {item.note}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={() => handleEditUnavailableDate(index)}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: 'transparent',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease',
                        opacity: 0.7
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1'
                        e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5'
                        e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-light, #555)' : '#bbb'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.7'
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'
                      }}
                      title="Edit"
                    >
                      <Pencil size={14} style={{ color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }} />
                    </button>
                    <button
                      onClick={() => handleRemoveUnavailableDate(index)}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(211, 47, 47, 0.3)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease',
                        opacity: 0.7
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1'
                        e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.1)'
                        e.currentTarget.style.borderColor = 'rgba(211, 47, 47, 0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.7'
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.borderColor = 'rgba(211, 47, 47, 0.3)'
                      }}
                      title="Remove"
                    >
                      <Trash2 size={14} style={{ color: '#d32f2f' }} />
                    </button>
                  </div>
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
        )}
      </div>
        </>
      )}

      {activeTab === 'settings' && (
        <div>
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
            <div>
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '16px',
                fontWeight: 600,
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a',
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
            <div>
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
            <div>
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
            <div>
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
            <div>
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
      )}

      {activeTab === 'employees' && hasAdminAccess && (
        <div>
          <EmployeeList 
            employees={employees}
            loading={employeesLoading}
            error={employeesError}
            onRefresh={loadEmployees}
          />
        </div>
      )}

      {activeTab === 'admin' && hasAdminAccess && (
        <div>
          <AdminDashboard />
        </div>
      )}
      </div>
    </div>
  )
}

export default Profile
