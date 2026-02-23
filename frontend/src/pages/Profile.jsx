import { useState, useEffect, useRef, useMemo } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import {
  User,
  Settings as SettingsIcon,
  Clock,
  Pencil,
  Trash2,
  PanelLeft
} from 'lucide-react'
import { FormLabel, FormField, inputBaseStyle, getInputFocusHandlers } from '../components/FormStyles'
import CustomDropdown from '../components/common/CustomDropdown'

function Profile({ employeeId, employeeName }) {
  const { themeColor, setThemeColor, themeMode, setThemeMode } = useTheme()
  const { show: showToast } = useToast()
  const [activeTab, setActiveTab] = useState('profile')
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
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [weekSchedules, setWeekSchedules] = useState([])
  const [weekOffset, setWeekOffset] = useState(0) // 0 = this week, 1 = next week, -1 = last week
  const [hoursStats, setHoursStats] = useState({ thisWeek: 0, thisMonth: 0 })
  const previousEmployeeIdRef = useRef(null)

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
  const [clockStatus, setClockStatus] = useState(null)
  const [clockLoading, setClockLoading] = useState(false)
  const [clockMessage, setClockMessage] = useState(null)

  useEffect(() => {
    if (!employeeId) return
    const isWeekChangeOnly = previousEmployeeIdRef.current === employeeId
    previousEmployeeIdRef.current = employeeId
    if (isWeekChangeOnly) {
      loadProfileData(weekOffset, { scheduleOnly: true })
    } else {
      setLoading(true)
      loadAppSettings()
      Promise.all([
        loadProfileData(weekOffset),
        loadClockStatus()
      ]).finally(() => setLoading(false))
    }
  }, [employeeId, weekOffset])

  useEffect(() => {
    // Refresh clock status every 30 seconds
    if (employeeId) {
      const interval = setInterval(() => {
        loadClockStatus()
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [employeeId])

  const loadProfileData = async (weekOffsetParam = 0, options = {}) => {
    const { scheduleOnly = false } = options
    if (scheduleOnly) {
      setScheduleLoading(true)
    }
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffsetParam * 7))
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)
    const fetchStartDate = new Date(startOfWeek)
    fetchStartDate.setDate(startOfWeek.getDate() - 28) // 4 weeks back
    const fetchEndDate = new Date(startOfWeek)
    fetchEndDate.setDate(startOfWeek.getDate() + 56)   // 8 weeks forward
    const fetchStartDateStr = fetchStartDate.toISOString().split('T')[0]
    const fetchEndDateStr = fetchEndDate.toISOString().split('T')[0]

    try {
      if (scheduleOnly) {
        const scheduleRes = await fetch(`/api/employee_schedule?employee_id=${employeeId}&start_date=${fetchStartDateStr}&end_date=${fetchEndDateStr}`)
        const scheduleData = await scheduleRes.json()
        const allSchedules = scheduleData.data || []
        const weekScheds = allSchedules
          .filter(s => {
            const dateField = s.schedule_date || s.shift_date
            if (!dateField) return false
            const sDate = new Date(dateField)
            return !isNaN(sDate.getTime()) && sDate >= startOfWeek && sDate <= endOfWeek
          })
          .sort((a, b) => new Date(a.schedule_date || a.shift_date || 0) - new Date(b.schedule_date || b.shift_date || 0))
        setWeekSchedules(weekScheds)
        return
      }

      // Full load: fetch schedule and availability in parallel
      const [scheduleRes, availRes] = await Promise.all([
        fetch(`/api/employee_schedule?employee_id=${employeeId}&start_date=${fetchStartDateStr}&end_date=${fetchEndDateStr}`),
        fetch(`/api/employee_availability?employee_id=${employeeId}`)
      ])
      const [scheduleData, availData] = await Promise.all([scheduleRes.json(), availRes.json()])
      const allSchedules = scheduleData.data || []

      const weekScheds = allSchedules
        .filter(s => {
          const dateField = s.schedule_date || s.shift_date
          if (!dateField) return false
          const sDate = new Date(dateField)
          return !isNaN(sDate.getTime()) && sDate >= startOfWeek && sDate <= endOfWeek
        })
        .sort((a, b) => new Date(a.schedule_date || a.shift_date || 0) - new Date(b.schedule_date || b.shift_date || 0))
      setWeekSchedules(weekScheds)

      const thisWeekHours = allSchedules
        .filter(s => {
          const dateField = s.schedule_date || s.shift_date
          if (!dateField || !s.hours_worked) return false
          const sDate = new Date(dateField)
          return !isNaN(sDate.getTime()) && sDate >= startOfWeek && sDate <= endOfWeek
        })
        .reduce((sum, s) => sum + (s.hours_worked || 0), 0)
      const thisMonthHours = allSchedules
        .filter(s => {
          const dateField = s.schedule_date || s.shift_date
          if (!dateField || !s.hours_worked) return false
          const sDate = new Date(dateField)
          return !isNaN(sDate.getTime()) && sDate.getMonth() === today.getMonth() && sDate.getFullYear() === today.getFullYear()
        })
        .reduce((sum, s) => sum + (s.hours_worked || 0), 0)
      setHoursStats({ thisWeek: thisWeekHours, thisMonth: thisMonthHours })

      if (availData?.data) {
        const loaded = {}
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        days.forEach(day => {
          if (availData.data[day]) {
            try {
              loaded[day] = JSON.parse(availData.data[day])
            } catch {
              loaded[day] = { available: true, start: '09:00', end: '17:00' }
            }
          } else {
            loaded[day] = { available: true, start: '09:00', end: '17:00' }
          }
        })
        setAvailability(loaded)
      }
    } catch (err) {
      console.error('Error loading profile data:', err)
    } finally {
      if (scheduleOnly) {
        setScheduleLoading(false)
      }
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
      } catch (locationError) {
        console.warn('Location error:', locationError)
        showToast('Could not get location. Clocking in without location verification.', 'warning')
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
        let msg = (data.schedule_comparison ? data.schedule_comparison.message : 'Clocked in successfully') + locationMsg;
        if (data.schedule_comparison?.wrong_hours) msg += ' (Wrong hours)';
        showToast(msg, 'success');
      } else {
        showToast(data.message || 'Failed to clock in', 'error')
      }
    } catch (err) {
      console.error('Error clocking in:', err)
      showToast('Error clocking in', 'error')
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
      } catch (locationError) {
        console.warn('Location error:', locationError)
        showToast('Could not get location. Clocking out without location verification.', 'warning')
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
        showToast(`Clocked out successfully. Hours worked: ${data.hours_worked ? data.hours_worked.toFixed(2) : 'N/A'}`, 'success');
      } else {
        showToast(data.message || 'Failed to clock out', 'error')
      }
    } catch (err) {
      console.error('Error clocking out:', err)
      showToast('Error clocking out', 'error')
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
      showToast('Settings saved successfully!', 'success')
    } catch (err) {
      console.error('Error saving app settings:', err)
      showToast('Failed to save settings', 'error')
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

  const profileSections = [
    { id: 'profile', label: 'My Hours', icon: Clock },
    { id: 'settings', label: 'App Settings', icon: SettingsIcon }
  ]

  return (
    <div style={{
      display: 'flex',
      height: activeTab === 'settings' ? '100%' : '100vh',
      minHeight: 0,
      width: '100%',
      overflow: 'hidden'
    }}>
      {/* Sidebar Navigation - 1/4 of page */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: '56px',
        zIndex: 100,
        width: sidebarMinimized ? '60px' : '25%',
        height: 'calc(100vh - 56px)',
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        padding: sidebarMinimized ? '32px 10px 48px 10px' : '32px 10px 48px 10px',
        borderRight: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0'}`,
        transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowY: 'auto',
        overflowX: 'hidden'
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

      {/* Main Content Area - 3/4 of page (like Tables: no page scroll; only inner content scrolls) */}
      <div style={{
        marginLeft: sidebarMinimized ? '60px' : '25%',
        width: sidebarMinimized ? 'calc(100% - 60px)' : '75%',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '48px 64px 64px 64px',
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        maxWidth: sidebarMinimized ? 'none' : '1200px',
        transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Tab Content - each tab fills space; profile/settings scroll here, admin scrolls inside dashboard */}
        {activeTab === 'profile' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <>
              {/* Time Clock - no container, compact */}
              <div style={{
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    marginBottom: '4px'
                  }}>
                    Time Clock
                  </div>
                  {loading && clockStatus == null ? (
                    <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999', fontStyle: 'italic' }}>
                      Loading…
                    </div>
                  ) : clockStatus?.clocked_in ? (
                    <div style={{
                      fontSize: '12px',
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666'
                    }}>
                      Clocked in since {clockStatus.clock_in_time ? new Date(clockStatus.clock_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  ) : (
                    <div style={{
                      fontSize: '12px',
                      color: isDarkMode ? 'var(--text-secondary, #999)' : '#666'
                    }}>
                      Currently clocked out
                    </div>
                  )}

                </div>
                <button
                  onClick={clockStatus?.clocked_in ? handleClockOut : handleClockIn}
                  disabled={clockLoading || (loading && clockStatus == null)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
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

              {/* Hours summary - no containers, compact inline */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '24px',
                marginBottom: '28px',
                alignItems: 'baseline'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    This Week
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a' }}>
                    {loading ? '…' : `${hoursStats.thisWeek.toFixed(1)}h`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    This Month
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a' }}>
                    {loading ? '…' : `${hoursStats.thisMonth.toFixed(1)}h`}
                  </div>
                </div>
              </div>

              {/* Schedule & Availability - directly on page, no container/tabs */}
              <div style={{ marginBottom: '32px' }}>
                {/* This Week's Schedule - week view 6am–10pm */}
                <div>
                  <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button type="button" onClick={() => setWeekOffset(prev => prev - 1)} style={{ padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a', flexShrink: 0 }}>←</button>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', textAlign: 'center' }}>
                      {weekOffset === 0 ? "This Week's Schedule" : weekOffset === 1 ? "Next Week's Schedule" : weekOffset === -1 ? "Last Week's Schedule" : (() => { const today = new Date(); const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7)); const weekEnd = new Date(startOfWeek); weekEnd.setDate(startOfWeek.getDate() + 6); return `Week of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`; })()}
                    </h2>
                    <button type="button" onClick={() => setWeekOffset(prev => prev + 1)} style={{ padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a', flexShrink: 0 }}>→</button>
                  </div>
                  {(() => {
                    const today = new Date()
                    const startOfWeek = new Date(today)
                    startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7))
                    startOfWeek.setHours(0, 0, 0, 0)
                    const initialDateStr = startOfWeek.toISOString().split('T')[0]
                    const scheduleEvents = (weekSchedules || []).map((s, i) => {
                      const dateField = s.schedule_date || s.shift_date
                      if (!dateField || !s.start_time || !s.end_time) return null
                      const dateKey = new Date(dateField).toISOString().split('T')[0]
                      const startTime = String(s.start_time).length === 5 ? s.start_time + ':00' : s.start_time
                      const endTime = String(s.end_time).length === 5 ? s.end_time + ':00' : s.end_time
                      return {
                        id: s.id != null ? String(s.id) : `s-${dateKey}-${i}`,
                        title: 'Shift',
                        start: `${dateKey}T${startTime}`,
                        end: `${dateKey}T${endTime}`
                      }
                    }).filter(Boolean)
                    const slotMin = '00:00:00'
                    const slotMax = '24:00:00'
                    return (
                      <div style={{ position: 'relative' }}>
                        {(loading || scheduleLoading) && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              borderRadius: '8px',
                              backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 10,
                              fontSize: '14px',
                              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                            }}
                          >
                            Loading…
                          </div>
                        )}
                        <div className="fc fc-theme-standard" style={{ border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff', minHeight: '320px' }}>
                          <FullCalendar
                            key={`schedule-${weekOffset}-${initialDateStr}`}
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                            initialView="timeGridWeek"
                            initialDate={initialDateStr}
                            slotMinTime={slotMin}
                            slotMaxTime={slotMax}
                            events={scheduleEvents}
                            headerToolbar={false}
                            height="auto"
                            contentHeight={320}
                            dayMaxEvents={false}
                            nowIndicator={true}
                            slotDuration="00:30:00"
                            allDaySlot={false}
                            eventDisplay="block"
                            themeSystem="standard"
                            buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day' }}
                          />
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* My Availability - same form style as Store Hours (Settings > Store Information) */}
                <FormField style={{ marginTop: '32px', marginBottom: '8px' }}>
                  <div style={{ marginBottom: '16px', fontSize: '15px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                    My Availability
                  </div>
                  {(() => {
                    const dayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
                    const dayLabels = { sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {dayOrder.map((hoursKey) => {
                          const dayHours = availability[hoursKey]
                          const isAvailable = dayHours?.available
                          return (
                            <div
                              key={hoursKey}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                flexWrap: 'wrap'
                              }}
                            >
                              <span style={{ width: '90px', flexShrink: 0, fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                {dayLabels[hoursKey]}
                              </span>
                              {isAvailable ? (
                                <>
                                  <input
                                    type="time"
                                    value={dayHours?.start || '09:00'}
                                    onChange={(e) => handleAvailabilityChange(hoursKey, 'start', e.target.value)}
                                    style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', height: '32px', minHeight: '32px', boxSizing: 'border-box' }}
                                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                  />
                                  <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>–</span>
                                  <input
                                    type="time"
                                    value={dayHours?.end || '17:00'}
                                    onChange={(e) => handleAvailabilityChange(hoursKey, 'end', e.target.value)}
                                    style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', height: '32px', minHeight: '32px', boxSizing: 'border-box' }}
                                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                  />
                                </>
                              ) : (
                                <>
                                  <div style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', height: '32px', minHeight: '32px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', cursor: 'default' }}>
                                    Unavailable
                                  </div>
                                  <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>–</span>
                                  <div style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '110px', height: '32px', minHeight: '32px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', cursor: 'default' }}>
                                    Unavailable
                                  </div>
                                </>
                              )}
                              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                <input
                                  type="checkbox"
                                  checked={isAvailable || false}
                                  onChange={(e) => handleAvailabilityChange(hoursKey, 'available', e.target.checked)}
                                  style={{ marginRight: '6px', cursor: 'pointer', width: '16px', height: '16px', accentColor: isDarkMode ? 'var(--theme-color, #8400ff)' : '#1a1a1a' }}
                                />
                                Available
                              </label>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </FormField>

                {/* Add Date + Unavailable dates - below My Availability */}
                <div style={{ marginTop: '32px' }}>
                  <button
                    type="button"
                    className="button-26 button-26--header"
                    role="button"
                    onClick={() => setShowAddDate(!showAddDate)}
                    style={{ cursor: 'pointer', marginBottom: '20px' }}
                  >
                    <div className="button-26__content">
                      <span className="button-26__text text">+ Add Date</span>
                    </div>
                  </button>
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
                          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={inputBaseStyle(isDarkMode, themeColorRgb)} {...getInputFocusHandlers(themeColorRgb, isDarkMode)} />
                        </FormField>
                        <FormField style={{ marginBottom: '12px' }}>
                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>End Date (optional - leave blank for single day)</FormLabel>
                          <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} min={newDate} style={inputBaseStyle(isDarkMode, themeColorRgb)} {...getInputFocusHandlers(themeColorRgb, isDarkMode)} />
                        </FormField>
                        <FormField style={{ marginBottom: '12px' }}>
                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Can't work from:</FormLabel>
                          <div style={{ position: 'relative', cursor: 'text' }} onClick={(e) => { const input = e.currentTarget.querySelector('input'); if (input) input.focus(); }}>
                            <input type="time" value={unavailableStartTime} onChange={(e) => setUnavailableStartTime(e.target.value)} onFocus={(e) => { setStartTimeFocused(true); getInputFocusHandlers(themeColorRgb, isDarkMode).onFocus(e); }} onBlur={(e) => { setStartTimeFocused(false); getInputFocusHandlers(themeColorRgb, isDarkMode).onBlur(e); }} style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), color: (unavailableStartTime || startTimeFocused) ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333') : 'transparent' }} />
                            {!unavailableStartTime && !startTimeFocused && <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '14px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999', fontStyle: 'italic' }}>All day</div>}
                          </div>
                        </FormField>
                        <FormField style={{ marginBottom: '12px' }}>
                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Can't work until:</FormLabel>
                          <div style={{ position: 'relative', cursor: 'text' }} onClick={(e) => { const input = e.currentTarget.querySelector('input'); if (input) input.focus(); }}>
                            <input type="time" value={unavailableEndTime} onChange={(e) => setUnavailableEndTime(e.target.value)} onFocus={(e) => { setEndTimeFocused(true); getInputFocusHandlers(themeColorRgb, isDarkMode).onFocus(e); }} onBlur={(e) => { setEndTimeFocused(false); getInputFocusHandlers(themeColorRgb, isDarkMode).onBlur(e); }} style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), color: (unavailableEndTime || endTimeFocused) ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333') : 'transparent' }} />
                            {!unavailableEndTime && !endTimeFocused && <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '14px', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999', fontStyle: 'italic' }}>All day</div>}
                          </div>
                        </FormField>
                        <FormField style={{ marginBottom: '12px' }}>
                          <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Note (optional)</FormLabel>
                          <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="e.g., Vacation, Doctor appointment" style={inputBaseStyle(isDarkMode, themeColorRgb)} {...getInputFocusHandlers(themeColorRgb, isDarkMode)} />
                        </FormField>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button type="button" className="button-26 button-26--header" role="button" onClick={() => { setShowAddDate(false); setNewDate(''); setNewEndDate(''); setNewNote(''); setUnavailableStartTime(''); setUnavailableEndTime(''); setStartTimeFocused(false); setEndTimeFocused(false); setEditingDateIndex(null); }}>
                            <div className="button-26__content"><span className="button-26__text text">Cancel</span></div>
                          </button>
                          <button type="button" className="button-26 button-26--header" role="button" onClick={handleAddUnavailableDate}>
                            <div className="button-26__content"><span className="button-26__text text">Add</span></div>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {unavailableDates.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {unavailableDates.map((item, index) => (
                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #e8e8e8', borderRadius: '8px', backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5'; e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#d0d0d0'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fafafa'; e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-light, #333)' : '#e8e8e8'; }}>
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#1a1a1a', marginBottom: '4px' }}>{new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</div>
                            {item.startTime && item.endTime ? <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginTop: '4px' }}>Can't work: {item.startTime} - {item.endTime}</div> : <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginTop: '4px' }}>All day</div>}
                            {item.note && <div style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginTop: '4px' }}>{item.note}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button onClick={() => handleEditUnavailableDate(index)} style={{ padding: '6px 10px', backgroundColor: 'transparent', border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s ease', opacity: 0.7 }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f5f5f5'; e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-light, #555)' : '#bbb'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'; }} title="Edit"><Pencil size={14} style={{ color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }} /></button>
                            <button onClick={() => handleRemoveUnavailableDate(index)} style={{ padding: '6px 10px', backgroundColor: 'transparent', border: '1px solid rgba(211, 47, 47, 0.3)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s ease', opacity: 0.7 }} onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.1)'; e.currentTarget.style.borderColor = 'rgba(211, 47, 47, 0.5)'; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(211, 47, 47, 0.3)'; }} title="Remove"><Trash2 size={14} style={{ color: '#d32f2f' }} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999', fontSize: '14px', textAlign: 'center', padding: '40px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>No unavailable dates added</div>
                  )}
                </div>

                {/* Save Availability - at bottom of page */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
                  <button
                    type="button"
                    className="button-26 button-26--header"
                    role="button"
                    onClick={handleSaveAvailability}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="button-26__content">
                      <span className="button-26__text text">Save Availability</span>
                    </div>
                  </button>
                </div>
              </div>
            </>
          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <style>{`
            .profile-app-settings-switch .ikxBAC {
              appearance: none;
              background-color: #dfe1e4;
              border-radius: 72px;
              border-style: none;
              flex-shrink: 0;
              height: 20px;
              margin: 0;
              position: relative;
              width: 30px;
            }
            .profile-app-settings-switch .ikxBAC::before {
              bottom: -6px;
              content: "";
              left: -6px;
              position: absolute;
              right: -6px;
              top: -6px;
            }
            .profile-app-settings-switch .ikxBAC,
            .profile-app-settings-switch .ikxBAC::after {
              transition: all 100ms ease-out;
            }
            .profile-app-settings-switch .ikxBAC::after {
              background-color: #fff;
              border-radius: 50%;
              content: "";
              height: 14px;
              left: 3px;
              position: absolute;
              top: 3px;
              width: 14px;
            }
            .profile-app-settings-switch input[type=checkbox] {
              cursor: default;
            }
            .profile-app-settings-switch .ikxBAC:hover {
              background-color: #c9cbcd;
              transition-duration: 0s;
            }
            .profile-app-settings-switch .ikxBAC:checked {
              background-color: var(--theme-color, #6ba3f0);
            }
            .profile-app-settings-switch .ikxBAC:checked::after {
              background-color: #fff;
              left: 13px;
            }
            .profile-app-settings-switch :focus:not(.focus-visible) {
              outline: 0;
            }
            .profile-app-settings-switch .ikxBAC:checked:hover {
              filter: brightness(0.9);
            }
          `}</style>

              <div style={{ maxWidth: '480px', width: '100%', marginLeft: 'auto', marginRight: 'auto' }}>
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
                    <FormField style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '280px' }}>
                        <CustomDropdown
                          value={themeMode}
                          onChange={(e) => handleSettingChange('theme', e.target.value)}
                          options={[
                            { value: 'light', label: 'Light' },
                            { value: 'dark', label: 'Dark' },
                            { value: 'auto', label: 'Auto' }
                          ]}
                          placeholder="Select theme"
                          isDarkMode={isDarkMode}
                          themeColorRgb={themeColorRgb}
                        />
                        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Theme Color</FormLabel>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                            <div style={{ position: 'absolute', inset: 0, background: themeColor }} />
                            <input
                              type="color"
                              value={themeColor}
                              onChange={(e) => setThemeColor(e.target.value)}
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 'none', opacity: 0, cursor: 'pointer' }}
                            />
                          </div>
                          <input
                            type="text"
                            value={themeColor}
                            onChange={(e) => setThemeColor(e.target.value)}
                            placeholder="#8400ff"
                            style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), width: '100px' }}
                            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                          />
                        </div>
                      </div>
                    </FormField>
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
                        gap: '12px',
                        cursor: 'pointer'
                      }}>
                        <div className="profile-app-settings-switch">
                          <input
                            type="checkbox"
                            className="sc-gJwTLC ikxBAC"
                            checked={appSettings.notifications}
                            onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                          />
                        </div>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                        }}>
                          Enable Notifications
                        </span>
                      </label>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer'
                      }}>
                        <div className="profile-app-settings-switch">
                          <input
                            type="checkbox"
                            className="sc-gJwTLC ikxBAC"
                            checked={appSettings.soundEnabled}
                            onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                          />
                        </div>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                        }}>
                          Enable Sounds
                        </span>
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
                    <FormField style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '280px' }}>
                        <CustomDropdown
                          value={appSettings.language}
                          onChange={(e) => handleSettingChange('language', e.target.value)}
                          options={[
                            { value: 'en', label: 'English' },
                            { value: 'es', label: 'Español' },
                            { value: 'fr', label: 'Français' }
                          ]}
                          placeholder="Select language"
                          isDarkMode={isDarkMode}
                          themeColorRgb={themeColorRgb}
                        />
                      </div>
                    </FormField>
                  </div>

                  {/* Save Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                    <button
                      type="button"
                      className="button-26 button-26--header"
                      role="button"
                      onClick={saveAppSettings}
                    >
                      <div className="button-26__content">
                        <span className="button-26__text text">Save Settings</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default Profile
