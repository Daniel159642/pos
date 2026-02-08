import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useTheme } from '../contexts/ThemeContext'
import { usePermissions } from '../contexts/PermissionContext'
import { useToast } from '../contexts/ToastContext'
import { Calendar as CalendarIcon, Download, User, ChevronLeft, ChevronRight, ChevronDown, Plus, CalendarClock, X, FileText, Pencil, CheckCircle, AlertCircle, Link2 } from 'lucide-react'
import { FormLabel, FormField, FormTitle, inputBaseStyle, getInputFocusHandlers } from './FormStyles'

function getNextMonday() {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? 1 : 8 - day
  return new Date(today.setDate(today.getDate() + diff))
}

function CustomDropdown({ value, onChange, options, placeholder = 'Select…', isDarkMode, themeColorRgb, style = {} }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false)
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={dropdownRef} style={{ position: 'relative', ...style }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen((o) => !o) } }}
        style={{
          width: '100%',
          padding: '8px 14px',
          border: isOpen ? `1px solid rgba(${themeColorRgb}, 0.5)` : (isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd'),
          borderRadius: '8px',
          fontSize: '14px',
          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
          color: selected ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333') : (isDarkMode ? 'var(--text-tertiary, #999)' : '#999'),
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease',
          outline: 'none',
          boxShadow: isOpen ? `0 0 0 3px rgba(${themeColorRgb}, 0.1)` : 'none'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.borderColor = `rgba(${themeColorRgb}, 0.3)`
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
      </div>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              onClick={() => { onChange({ target: { value: opt.value } }); setIsOpen(false) }}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                backgroundColor: value === opt.value ? `rgba(${themeColorRgb}, 0.2)` : 'transparent',
                borderLeft: value === opt.value ? `3px solid rgba(${themeColorRgb}, 0.7)` : '3px solid transparent',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (value !== opt.value) e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = value === opt.value ? `rgba(${themeColorRgb}, 0.2)` : 'transparent'
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Calendar({ employee }) {
  const { themeMode, themeColor } = useTheme()
  const calendarRef = useRef(null)
  const [events, setEvents] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null) // For day selection with multiple events
  const [selectedDateEvents, setSelectedDateEvents] = useState([]) // Events for selected day
  const [eventFilters, setEventFilters] = useState({
    holiday: true,
    event: true,
    meeting: true,
    shipment: true,
    schedule: true,
    maintenance: true
  })
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  
  // Event creation state
  const [showEventModal, setShowEventModal] = useState(false)
  const [newEventDate, setNewEventDate] = useState(null)
  const [newEvent, setNewEvent] = useState({
    title: '',
    event_type: 'event',
    description: '',
    start_time: '00:00',
    end_time: '12:00',
    forEveryone: true,
    selectedEmployees: []
  })
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false)
  const [showLinkDropdown, setShowLinkDropdown] = useState(false)
  const [showScheduleBuilder, setShowScheduleBuilder] = useState(false)
  const [showDraftsList, setShowDraftsList] = useState(false)
  const [draftList, setDraftList] = useState([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  const [showEditList, setShowEditList] = useState(false)
  const [editList, setEditList] = useState([])
  const [loadingEditList, setLoadingEditList] = useState(false)
  const [confirmDeleteDraftId, setConfirmDeleteDraftId] = useState(null)
  const filterDropdownRef = useRef(null)
  const scheduleDropdownRef = useRef(null)
  const linkDropdownRef = useRef(null)
  const confirmDeleteDropdownRef = useRef(null)
  const [currentView, setCurrentView] = useState('dayGridMonth')
  const [calendarTitle, setCalendarTitle] = useState('January 2026')
  const [toast, setToast] = useState(null) // { message, type: 'success' | 'warning' }

  // Schedule builder state (use main calendar for dates; draft plots on calendar)
  const [sbStartDate, setSbStartDate] = useState(() => {
    const m = getNextMonday()
    return m.toISOString().split('T')[0]
  })
  const [sbEndDate, setSbEndDate] = useState(() => {
    const m = getNextMonday()
    const e = new Date(m)
    e.setDate(e.getDate() + 6)
    return e.toISOString().split('T')[0]
  })
  const [sbRangeClickStep, setSbRangeClickStep] = useState('start') // 'start' | 'end'
  const [sbViewDate, setSbViewDate] = useState(null) // current visible month (YYYY-MM-DD) when in schedule builder
  const [lastCalendarViewDate, setLastCalendarViewDate] = useState(null) // always track visible date so publish/push don't reset to today
  const [sbSelectedEmployees, setSbSelectedEmployees] = useState([])
  const [draftPeriodId, setDraftPeriodId] = useState(null)
  const [draftSchedule, setDraftSchedule] = useState(null)
  const [sbGenerating, setSbGenerating] = useState(false)
  const [sbPublishing, setSbPublishing] = useState(false)
  const [editingDraftShift, setEditingDraftShift] = useState(null)
  const [addingShiftForDate, setAddingShiftForDate] = useState(null)
  const [pendingShiftAdds, setPendingShiftAdds] = useState([])
  const [sbShowAdvanced, setSbShowAdvanced] = useState(false)
  const [draftExpandedWeeks, setDraftExpandedWeeks] = useState([])
  const [draftExpandedDays, setDraftExpandedDays] = useState([])
  const [draftScheduleVersion, setDraftScheduleVersion] = useState(0)
  const [isEditingPublished, setIsEditingPublished] = useState(false)
  const [pendingShiftEdits, setPendingShiftEdits] = useState({})
  const [pendingShiftDeletes, setPendingShiftDeletes] = useState([])
  const [sbSettings, setSbSettings] = useState({
    algorithm: 'balanced',
    max_consecutive_days: 6,
    min_time_between_shifts: 10,
    distribute_hours_evenly: true,
    avoid_clopening: true,
    prioritize_seniority: false,
    min_employees_per_shift: 2,
    max_employees_per_shift: 5,
    default_shift_length: 8
  })

  // Check if user is admin (full access; Employee = restricted)
  const { isAdmin } = usePermissions()
  const { show: showToast } = useToast()
  const NO_PERMISSION_MSG = "You don't have permission"
  
  // Fetch employees when event modal or schedule builder opens
  useEffect(() => {
    if ((showEventModal || showScheduleBuilder) && isAdmin) {
      fetchEmployees()
    }
  }, [showEventModal, showScheduleBuilder, isAdmin])

  // When employees load and schedule builder is open, select all by default
  useEffect(() => {
    if (showScheduleBuilder && isAdmin && employees.length > 0 && sbSelectedEmployees.length === 0) {
      setSbSelectedEmployees(employees.map(e => e.employee_id))
    }
  }, [showScheduleBuilder, isAdmin, employees])

  // Reset draft list expanded state when draft schedule changes
  useEffect(() => {
    if (draftSchedule) {
      setDraftExpandedWeeks([])
      setDraftExpandedDays([])
    }
  }, [draftSchedule?.period?.period_id])

  // Click-outside to close confirm-delete dropdown
  useEffect(() => {
    if (!confirmDeleteDraftId) return
    const handle = (e) => {
      if (confirmDeleteDropdownRef.current && !confirmDeleteDropdownRef.current.contains(e.target)) {
        setConfirmDeleteDraftId(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [confirmDeleteDraftId])

  const displayShifts = useMemo(() => {
    const sh = draftSchedule?.shifts ?? []
    const deletes = new Set(pendingShiftDeletes)
    const out = []
    for (const s of sh) {
      const id = Number(s.scheduled_shift_id)
      if (deletes.has(id)) continue
      const patch = pendingShiftEdits[id]
      const merged = patch ? { ...s, ...patch } : { ...s }
      if (patch?.employee_id && employees?.length) {
        const emp = employees.find((e) => e.employee_id === patch.employee_id)
        if (emp) {
          merged.first_name = emp.first_name
          merged.last_name = emp.last_name
        }
      }
      out.push(merged)
    }
    for (const a of pendingShiftAdds) {
      const emp = employees?.find((e) => e.employee_id === a.employee_id)
      out.push({
        tempId: a.tempId,
        shift_date: a.shift_date,
        employee_id: a.employee_id,
        start_time: a.start_time,
        end_time: a.end_time,
        position: a.position || '',
        notes: a.notes || '',
        first_name: emp?.first_name ?? '',
        last_name: emp?.last_name ?? '',
        __pendingAdd: true
      })
    }
    return out
  }, [draftSchedule?.shifts, pendingShiftEdits, pendingShiftDeletes, pendingShiftAdds, employees])

  const draftShiftsFingerprint = useMemo(() => {
    const sh = displayShifts
    return sh.map((s) => (s.tempId ? s.tempId : `${s.scheduled_shift_id}-${s.employee_id}-${s.start_time}-${s.end_time}-${s.shift_date}`)).join('|')
  }, [displayShifts])

  const draftListData = useMemo(() => {
    const p = draftSchedule?.period
    const sh = displayShifts
    if (!p?.week_start_date || !p?.week_end_date) return { days: [], weeks: [], shiftsByDate: {} }
    const start = new Date(p.week_start_date + 'T12:00:00')
    const end = new Date(p.week_end_date + 'T12:00:00')
    const days = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
    const shiftsByDate = {}
    sh.forEach((s) => {
      const dt = typeof s.shift_date === 'string' ? s.shift_date.split('T')[0] : (s.shift_date && s.shift_date.toISOString?.().split('T')[0])
      if (!dt) return
      if (!shiftsByDate[dt]) shiftsByDate[dt] = []
      shiftsByDate[dt].push(s)
    })
    const weeks = []
    if (days.length > 7) {
      for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
    }
    return { days, weeks, shiftsByDate }
  }, [draftSchedule?.period?.week_start_date, draftSchedule?.period?.week_end_date, displayShifts])

  const fetchEmployees = async () => {
    setLoadingEmployees(true)
    try {
      const response = await fetch('/api/employees')
      const data = await response.json()
      if (data.data) {
        // Filter to only active employees
        const activeEmployees = data.data.filter(emp => emp.active !== 0)
        setEmployees(activeEmployees)
      }
    } catch (err) {
      console.error('Error fetching employees:', err)
    } finally {
      setLoadingEmployees(false)
    }
  }
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setShowFilterDropdown(false)
      }
      if (scheduleDropdownRef.current && !scheduleDropdownRef.current.contains(e.target)) {
        setShowScheduleDropdown(false)
      }
      if (linkDropdownRef.current && !linkDropdownRef.current.contains(e.target)) {
        setShowLinkDropdown(false)
      }
    }
    if (showFilterDropdown || showScheduleDropdown || showLinkDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFilterDropdown, showScheduleDropdown, showLinkDropdown])
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
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
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    loadCalendarData()
  }, [])

  useEffect(() => {
    // Reload when filters change
    if (!loading) {
      loadCalendarData()
    }
  }, [eventFilters])

  // Add custom prev/next arrows and Today button
  useEffect(() => {
    const addCustomArrows = () => {
      const centerChunk = document.querySelector('.fc-header-toolbar .fc-toolbar-chunk:nth-child(2)')
      const rightChunk = document.querySelector('.fc-header-toolbar .fc-toolbar-chunk:last-child')
      const titleElement = centerChunk?.querySelector('.fc-toolbar-title')
      
      if (!centerChunk || !rightChunk || !titleElement) return
      
      // Check if Today button already exists
      if (rightChunk.querySelector('.custom-today-button')) return
      
      // Check if arrows already exist
      if (rightChunk.querySelector('.custom-nav-arrow')) return
      
      // Remove any existing prev/next buttons from center (leave title only)
      const existingButtons = centerChunk.querySelectorAll('.fc-button-group')
      existingButtons.forEach(btn => btn.remove())
      
      // Create prev arrow container
      const prevArrow = document.createElement('span')
      prevArrow.className = 'custom-nav-arrow custom-prev-arrow'
      prevArrow.style.cssText = 'cursor: pointer; padding: 0 4px; color: var(--text-primary); display: inline-flex; align-items: center; user-select: none; transition: color 0.2s ease;'
      prevArrow.onclick = navigatePrev
      
      // Create SVG for ChevronLeft icon
      const prevSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      prevSvg.setAttribute('width', '20')
      prevSvg.setAttribute('height', '20')
      prevSvg.setAttribute('viewBox', '0 0 24 24')
      prevSvg.setAttribute('fill', 'none')
      prevSvg.setAttribute('stroke', 'currentColor')
      prevSvg.setAttribute('stroke-width', '2')
      prevSvg.setAttribute('stroke-linecap', 'round')
      prevSvg.setAttribute('stroke-linejoin', 'round')
      const prevPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      prevPath.setAttribute('d', 'm15 18-6-6 6-6')
      prevSvg.appendChild(prevPath)
      prevArrow.appendChild(prevSvg)
      
      // Create next arrow container
      const nextArrow = document.createElement('span')
      nextArrow.className = 'custom-nav-arrow custom-next-arrow'
      nextArrow.style.cssText = 'cursor: pointer; padding: 0 4px; color: var(--text-primary); display: inline-flex; align-items: center; user-select: none; transition: color 0.2s ease;'
      nextArrow.onclick = navigateNext
      
      // Create SVG for ChevronRight icon
      const nextSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      nextSvg.setAttribute('width', '20')
      nextSvg.setAttribute('height', '20')
      nextSvg.setAttribute('viewBox', '0 0 24 24')
      nextSvg.setAttribute('fill', 'none')
      nextSvg.setAttribute('stroke', 'currentColor')
      nextSvg.setAttribute('stroke-width', '2')
      nextSvg.setAttribute('stroke-linecap', 'round')
      nextSvg.setAttribute('stroke-linejoin', 'round')
      const nextPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      nextPath.setAttribute('d', 'm9 18 6-6-6-6')
      nextSvg.appendChild(nextPath)
      nextArrow.appendChild(nextSvg)
      
      // Create Today button
      const todayButton = document.createElement('button')
      todayButton.className = 'custom-today-button'
      todayButton.textContent = 'Today'
      todayButton.type = 'button'
      todayButton.style.cssText = 'padding: 0; margin: 0; background: none; border: none; font-size: 14px; font-weight: 500; color: var(--text-primary); cursor: pointer; text-decoration: none; transition: text-decoration 0.2s ease;'
      todayButton.onclick = goToToday
      todayButton.onmouseenter = (e) => {
        e.target.style.textDecoration = 'underline'
      }
      todayButton.onmouseleave = (e) => {
        e.target.style.textDecoration = 'none'
      }
      todayButton.title = 'Go to Today'
      
      // Insert arrows and Today button in right chunk: prev arrow, Today button, next arrow
      rightChunk.appendChild(prevArrow)
      rightChunk.appendChild(todayButton)
      rightChunk.appendChild(nextArrow)
      
      // Style center chunk (title only)
      centerChunk.style.cssText = 'display: flex !important; align-items: center !important; justify-content: flex-start !important; gap: 2px !important;'
      
      // Style right chunk to align to the right
      rightChunk.style.cssText = 'display: flex !important; align-items: center !important; justify-content: flex-end !important; gap: 8px !important;'
    }

    // Run after calendar renders
    const timer1 = setTimeout(addCustomArrows, 100)
    const timer2 = setTimeout(addCustomArrows, 300)
    const timer3 = setTimeout(addCustomArrows, 500)
    
    // Observe for changes
    const observer = new MutationObserver(() => {
      setTimeout(addCustomArrows, 50)
    })
    const calendarElement = document.querySelector('.fc')
    if (calendarElement) {
      observer.observe(calendarElement, { childList: true, subtree: true })
    }

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      observer.disconnect()
    }
  }, [loading, events])

  const loadCalendarData = async () => {
    setLoading(true)
    try {
      const [eventsResponse, schedulesResponse] = await Promise.all([
        fetch('/api/master_calendar'),
        fetch('/api/employee_schedule')
      ])
      const [eventsData, schedulesData] = await Promise.all([
        eventsResponse.json(),
        schedulesResponse.json()
      ])
      setEvents(eventsData.data || [])
      setSchedules(schedulesData.data || [])
    } catch (err) {
      console.error('Error loading calendar data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getEventColor = (eventType) => {
    // Use theme color variations with different opacities/saturations
    const colors = {
      'holiday': `rgba(244, 67, 54, 0.9)`, // Red for holidays (keep distinct)
      'event': `rgba(${themeColorRgb}, 0.8)`, // Theme color
      'meeting': `rgba(${themeColorRgb}, 0.7)`, // Theme color variant
      'shipment': `rgba(${themeColorRgb}, 0.85)`, // Theme color variant
      'schedule': `rgba(${themeColorRgb}, 0.75)`, // Theme color variant
      'maintenance': `rgba(${themeColorRgb}, 0.6)`, // Theme color variant
      'other': `rgba(${themeColorRgb}, 0.5)` // Theme color variant
    }
    return colors[eventType] || colors['other']
  }

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  // Convert events and schedules to FullCalendar format (memoized so calendar sees updates)
  const fullCalendarEvents = useMemo(() => {
    const out = []
    events.forEach(event => {
      if (eventFilters[event.event_type]) {
        const startDate = event.event_date || event.start_datetime
        const startTime = event.start_time || '09:00:00'
        const endTime = event.end_time || '17:00:00'
        const start = new Date(`${startDate}T${startTime}`)
        const end = new Date(`${startDate}T${endTime}`)
        out.push({
          id: `event-${event.event_id || event.id}`,
          title: event.title || event.event_type,
          start: start.toISOString(),
          end: end.toISOString(),
          backgroundColor: getEventColor(event.event_type),
          borderColor: getEventColor(event.event_type),
          extendedProps: { ...event, type: 'event', eventType: event.event_type }
        })
      }
    })
    const periodStart = draftSchedule?.period?.week_start_date
    const periodEnd = draftSchedule?.period?.week_end_date
    const hideSchedulesInPeriod = isEditingPublished && periodStart && periodEnd

    if (eventFilters.schedule) {
      schedules.forEach(schedule => {
        const scheduleDate = schedule.schedule_date
        if (hideSchedulesInPeriod && scheduleDate >= periodStart && scheduleDate <= periodEnd) return
        const startTime = schedule.start_time || '09:00:00'
        const endTime = schedule.end_time || '17:00:00'
        const start = new Date(`${scheduleDate}T${startTime}`)
        const end = new Date(`${scheduleDate}T${endTime}`)
        out.push({
          id: `schedule-${schedule.schedule_id || schedule.id}`,
          title: `${schedule.employee_name || 'Employee'}: ${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`,
          start: start.toISOString(),
          end: end.toISOString(),
          backgroundColor: getEventColor('schedule'),
          borderColor: getEventColor('schedule'),
          extendedProps: { ...schedule, type: 'schedule', eventType: 'schedule' }
        })
      })
    }
    if (displayShifts?.length) {
      const draftColor = `rgba(${themeColorRgb}, 0.6)`
      const label = isEditingPublished ? 'Editing' : 'Draft'
      displayShifts.forEach(shift => {
        const st = (shift.start_time || '09:00').includes(':') && (shift.start_time || '').split(':').length === 2 ? `${shift.start_time}:00` : (shift.start_time || '09:00:00')
        const et = (shift.end_time || '17:00').includes(':') && (shift.end_time || '').split(':').length === 2 ? `${shift.end_time}:00` : (shift.end_time || '17:00:00')
        const start = new Date(`${shift.shift_date}T${st}`)
        const end = new Date(`${shift.shift_date}T${et}`)
        const name = [shift.first_name, shift.last_name].filter(Boolean).join(' ') || 'Employee'
        const sid = shift.tempId ?? shift.scheduled_shift_id
        out.push({
          id: `draft-shift-${sid}`,
          title: `${label}: ${name} ${formatTime(shift.start_time)}–${formatTime(shift.end_time)}`,
          start: start.toISOString(),
          end: end.toISOString(),
          backgroundColor: draftColor,
          borderColor: draftColor,
          classNames: ['fc-event-draft'],
          extendedProps: { ...shift, type: 'draft_shift', eventType: 'draft_shift' }
        })
      })
    }
    return out
  }, [events, schedules, draftSchedule, displayShifts, isEditingPublished, eventFilters, themeColorRgb])

  const isDateInScheduleRange = (date) => {
    if (!sbStartDate) return false
    let d
    if (typeof date === 'string') d = date
    else {
      const x = new Date(date)
      d = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    }
    if (!sbEndDate) return d === sbStartDate
    return d >= sbStartDate && d <= sbEndDate
  }

  const scheduleRangeHighlightColor = `rgba(${themeColorRgb}, 0.4)`
  const scheduleRangeBorderColor = `rgba(${themeColorRgb}, 0.7)`

  const dayCellDidMount = (arg) => {
    if (!showScheduleBuilder || !isAdmin || draftSchedule) return
    if (!isDateInScheduleRange(arg.date)) return
    const el = arg.el
    if (!el || !el.style) return
    el.style.setProperty('background', scheduleRangeHighlightColor, 'important')
    el.style.setProperty('box-shadow', `inset 0 0 0 2px ${scheduleRangeBorderColor}`, 'important')
    const frame = el.querySelector('.fc-daygrid-day-frame')
    if (frame) {
      frame.style.setProperty('background', scheduleRangeHighlightColor, 'important')
    }
  }

  const dayCellWillUnmount = (arg) => {
    const el = arg.el
    if (!el) return
    el.style.removeProperty('background')
    el.style.removeProperty('box-shadow')
    const frame = el.querySelector('.fc-daygrid-day-frame')
    if (frame) frame.style.removeProperty('background')
  }

  const handleEventClick = (clickInfo) => {
    const props = clickInfo.event.extendedProps
    if (props?.type === 'draft_shift' && showScheduleBuilder && (draftSchedule?.period?.status === 'draft' || isEditingPublished)) {
      if (props?.__pendingAdd) return
      setEditingDraftShift(props)
      setSelectedEvent(null)
      setSelectedDate(null)
      setSelectedDateEvents([])
      return
    }
    setSelectedEvent(props)
    setSelectedDate(null)
    setSelectedDateEvents([])
  }

  const handleDateClick = (dateClickInfo) => {
    const clickedDate = dateClickInfo.dateStr

    // Schedule builder: two-click range selection (start then end)
    if (showScheduleBuilder && isAdmin && !draftSchedule) {
      if (sbRangeClickStep === 'start') {
        setSbStartDate(clickedDate)
        setSbEndDate(null)
        setSbRangeClickStep('end')
      } else {
        let start = sbStartDate
        let end = clickedDate
        if (end < start) [start, end] = [end, start]
        setSbStartDate(start)
        setSbEndDate(end)
        setSbRangeClickStep('start')
      }
      return
    }

    // Normal: show day/events in panel
    if (showDraftsList) {
      setShowDraftsList(false)
      setConfirmDeleteDraftId(null)
    }
    if (showEditList) {
      setShowEditList(false)
    }
    const dayEvents = fullCalendarEvents.filter(event => {
      const eventDate = new Date(event.start)
      const clickedDateObj = new Date(clickedDate + 'T00:00:00')
      return eventDate.toDateString() === clickedDateObj.toDateString()
    })
    if (dayEvents.length > 0) {
      setSelectedDate(clickedDate)
      setSelectedDateEvents(dayEvents.map(e => e.extendedProps))
      setSelectedEvent(null)
    } else {
      setSelectedDate(clickedDate)
      setSelectedDateEvents([])
      setSelectedEvent(null)
    }
  }
  
  const handleSelect = (selectInfo) => {
    if (selectInfo && calendarRef.current) {
      calendarRef.current.getApi().unselect()
    }
  }

  const navigatePrev = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi()
      calendarApi.prev()
    }
  }

  const navigateNext = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi()
      calendarApi.next()
    }
  }

  const changeView = (viewName) => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi()
      calendarApi.changeView(viewName)
      setCurrentView(viewName)
    }
  }

  const goToToday = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi()
      calendarApi.today()
    }
  }

  const handleViewChange = (viewInfo) => {
    setCurrentView(viewInfo.view.type)
    // Update calendar title from FullCalendar's view
    if (viewInfo.view.calendar) {
      const title = viewInfo.view.title
      setCalendarTitle(title)
    }
    if (viewInfo.view?.currentStart) {
      const d = viewInfo.view.currentStart
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      setLastCalendarViewDate(str)
      if (showScheduleBuilder && isAdmin) setSbViewDate(str)
    }
  }
  
  const handleCreateEvent = async () => {
    if (!newEvent.title.trim()) {
      alert('Please enter an event title')
      return
    }
    
    if (!newEvent.forEveryone && newEvent.selectedEmployees.length === 0) {
      alert('Please select at least one employee or choose "For Everyone"')
      return
    }
    
    setCreatingEvent(true)
    try {
      const token = localStorage.getItem('sessionToken')
      const response = await fetch('/api/master_calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token
        },
        body: JSON.stringify({
          session_token: token,
          event_date: newEventDate,
          event_type: newEvent.event_type,
          title: newEvent.title,
          description: newEvent.description || null,
          start_time: newEvent.start_time || null,
          end_time: newEvent.end_time || null,
          employee_ids: newEvent.forEveryone ? [] : newEvent.selectedEmployees
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Reload calendar data
        await loadCalendarData()
        setShowEventModal(false)
        setNewEvent({
          title: '',
          event_type: 'event',
          description: '',
          start_time: '00:00',
          end_time: '12:00',
          forEveryone: true,
          selectedEmployees: []
        })
        setNewEventDate(null)
        alert('Event created successfully!')
      } else {
        alert(data.message || 'Failed to create event')
      }
    } catch (err) {
      console.error('Error creating event:', err)
      alert('Error creating event')
    } finally {
      setCreatingEvent(false)
    }
  }
  
  const handleEventFromDayClick = (event) => {
    // When clicking an event from the day view, show single event details
    setSelectedEvent(event)
    setSelectedDate(null)
    setSelectedDateEvents([])
  }

  const toggleEventFilter = (filterType) => {
    setEventFilters(prev => ({
      ...prev,
      [filterType]: !prev[filterType]
    }))
  }

  const loadDraftSchedule = async (periodId) => {
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/schedule/${periodId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      const data = await res.json()
      if (data?.period) {
        setDraftSchedule(data)
        setDraftPeriodId(data.period.period_id)
        setDraftScheduleVersion((v) => v + 1)
        return data
      }
    } catch (e) {
      console.error('Failed to load draft schedule:', e)
    }
    return null
  }

  const fetchDraftsAndShowList = async () => {
    setShowScheduleDropdown(false)
    setShowScheduleBuilder(false)
    setShowEventModal(false)
    setShowEditList(false)
    setSelectedEvent(null)
    setSelectedDate(null)
    setSelectedDateEvents([])
    setLoadingDrafts(true)
    setShowDraftsList(true)
    setDraftList([])
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch('/api/schedule/drafts', { headers: { 'Authorization': `Bearer ${token}` } })
      const data = await res.json()
      if (data?.success && Array.isArray(data.data)) {
        setDraftList(data.data)
      }
    } catch (e) {
      console.error('Failed to fetch drafts:', e)
    } finally {
      setLoadingDrafts(false)
    }
  }

  const fetchEditListAndShow = async () => {
    setShowScheduleDropdown(false)
    setShowScheduleBuilder(false)
    setShowEventModal(false)
    setShowDraftsList(false)
    setSelectedEvent(null)
    setSelectedDate(null)
    setSelectedDateEvents([])
    setLoadingEditList(true)
    setShowEditList(true)
    setEditList([])
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch('/api/schedule/published', { headers: { 'Authorization': `Bearer ${token}` } })
      const data = await res.json()
      if (data?.success && Array.isArray(data.data)) {
        setEditList(data.data)
      }
    } catch (e) {
      console.error('Failed to fetch published schedules:', e)
    } finally {
      setLoadingEditList(false)
    }
  }

  const openDraftInBuilder = async (periodId) => {
    setShowDraftsList(false)
    setShowScheduleBuilder(true)
    setShowEventModal(false)
    setSelectedEvent(null)
    setSelectedDate(null)
    setSelectedDateEvents([])
    setPendingShiftEdits({})
    setPendingShiftDeletes([])
    setPendingShiftAdds([])
    setAddingShiftForDate(null)
    setIsEditingPublished(false)
    await loadDraftSchedule(periodId)
  }

  const openPublishedForEdit = async (period) => {
    const periodId = typeof period === 'object' && period?.period_id != null ? period.period_id : period
    const weekStart = typeof period === 'object' && period?.week_start_date ? period.week_start_date : null
    setShowEditList(false)
    setShowScheduleBuilder(true)
    setShowEventModal(false)
    setSelectedEvent(null)
    setSelectedDate(null)
    setSelectedDateEvents([])
    setPendingShiftEdits({})
    setPendingShiftDeletes([])
    setPendingShiftAdds([])
    setAddingShiftForDate(null)
    setIsEditingPublished(true)
    if (weekStart && calendarRef.current) {
      const startDate = new Date(weekStart + 'T12:00:00')
      const viewStart = lastCalendarViewDate ? new Date(lastCalendarViewDate + 'T12:00:00') : null
      const alreadyInView = viewStart &&
        viewStart.getFullYear() === startDate.getFullYear() &&
        viewStart.getMonth() === startDate.getMonth()
      if (!alreadyInView) {
        calendarRef.current.getApi().gotoDate(weekStart)
      }
    }
    await loadDraftSchedule(periodId)
  }

  const deleteDraftPeriod = async (periodId) => {
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/schedule/${periodId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data?.success) {
        setDraftList((prev) => prev.filter((x) => x.period_id !== periodId))
        setConfirmDeleteDraftId(null)
      } else {
        alert(data?.message || 'Failed to delete draft')
      }
    } catch (e) {
      console.error('Failed to delete draft:', e)
      alert('Failed to delete draft')
    }
  }

  const saveDraftAndClose = async () => {
    if (!draftPeriodId || !draftSchedule || draftSchedule.period?.status !== 'draft') return
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/schedule/${draftPeriodId}/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!data?.success) {
        alert(data?.message || 'Failed to save draft')
        return
      }
      await loadDraftSchedule(draftPeriodId)
      setShowScheduleBuilder(false)
    } catch (e) {
      console.error('Failed to save draft:', e)
      alert('Failed to save draft')
    }
  }

  const discardPublishedEditsAndClose = () => {
    setPendingShiftEdits({})
    setPendingShiftDeletes([])
    setPendingShiftAdds([])
    setAddingShiftForDate(null)
    setIsEditingPublished(false)
    const m = getNextMonday()
    const end = new Date(m)
    end.setDate(end.getDate() + 6)
    setDraftSchedule(null)
    setDraftPeriodId(null)
    setSbStartDate(m.toISOString().split('T')[0])
    setSbEndDate(end.toISOString().split('T')[0])
    setSbRangeClickStep('start')
    setSbSelectedEmployees([])
    setDraftScheduleVersion(0)
    setEditingDraftShift(null)
    setShowScheduleBuilder(false)
  }

  const pushChangesAndClose = async () => {
    const hasEdits = Object.keys(pendingShiftEdits).length > 0
    const hasDeletes = pendingShiftDeletes.length > 0
    const hasAdds = pendingShiftAdds.length > 0
    if (!draftPeriodId || (!hasEdits && !hasDeletes && !hasAdds)) {
      discardPublishedEditsAndClose()
      return
    }
    const token = localStorage.getItem('sessionToken')
    try {
      for (const shiftId of pendingShiftDeletes) {
        const res = await fetch(`/api/schedule/${draftPeriodId}/shift?shift_id=${shiftId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
        const data = await res.json()
        if (!data?.success) {
          alert(data?.message || 'Failed to delete shift')
          return
        }
      }
      for (const add of pendingShiftAdds) {
        const res = await fetch(`/api/schedule/${draftPeriodId}/shift`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            employee_id: add.employee_id,
            shift_date: add.shift_date,
            start_time: add.start_time,
            end_time: add.end_time,
            break_duration: 30,
            position: add.position || null,
            notes: add.notes || null
          })
        })
        const data = await res.json()
        if (!res.ok || !data?.success) {
          alert(data?.message || 'Failed to add shift')
          return
        }
      }
      for (const [shiftId, updates] of Object.entries(pendingShiftEdits)) {
        const res = await fetch(`/api/schedule/${draftPeriodId}/shift`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ scheduled_shift_id: Number(shiftId), ...updates })
        })
        const data = await res.json()
        if (!res.ok || !data?.success) {
          alert(data?.message || 'Failed to update shift')
          return
        }
      }
      setPendingShiftEdits({})
      setPendingShiftDeletes([])
      setPendingShiftAdds([])
      setAddingShiftForDate(null)
      setIsEditingPublished(false)
      setDraftSchedule(null)
      setDraftPeriodId(null)
      setDraftScheduleVersion((v) => v + 1)
      await loadCalendarData()
      setShowScheduleBuilder(false)
      setToast({ message: 'Changes pushed. Shifts are now on the calendar.', type: 'success' })
    } catch (e) {
      console.error('Failed to push changes:', e)
      alert('Failed to push changes')
    }
  }

  const cancelDraftAndClose = async () => {
    if (isEditingPublished) {
      discardPublishedEditsAndClose()
      return
    }
    if (!draftPeriodId) {
      const m = getNextMonday()
      const end = new Date(m)
      end.setDate(end.getDate() + 6)
      setDraftSchedule(null)
      setDraftPeriodId(null)
      setSbStartDate(m.toISOString().split('T')[0])
      setSbEndDate(end.toISOString().split('T')[0])
      setSbRangeClickStep('start')
      setSbSelectedEmployees([])
      setDraftScheduleVersion(0)
      setEditingDraftShift(null)
      setAddingShiftForDate(null)
      setShowScheduleBuilder(false)
      return
    }
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/schedule/${draftPeriodId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (!data?.success) {
        alert(data?.message || 'Failed to delete draft')
        return
      }
      setDraftList((prev) => prev.filter((x) => x.period_id !== draftPeriodId))
      setConfirmDeleteDraftId(null)
      const m = getNextMonday()
      const end = new Date(m)
      end.setDate(end.getDate() + 6)
      setDraftSchedule(null)
      setDraftPeriodId(null)
      setSbStartDate(m.toISOString().split('T')[0])
      setSbEndDate(end.toISOString().split('T')[0])
      setSbRangeClickStep('start')
      setSbSelectedEmployees([])
      setDraftScheduleVersion(0)
      setEditingDraftShift(null)
      setAddingShiftForDate(null)
      setShowScheduleBuilder(false)
    } catch (e) {
      console.error('Failed to cancel draft:', e)
      alert('Failed to delete draft')
    }
  }

  const generateSchedule = async () => {
    if (!sbSelectedEmployees.length) {
      alert('Please select at least one employee.')
      return
    }
    if (!sbStartDate || !sbEndDate) {
      alert('Please set start and end dates.')
      return
    }
    if (new Date(sbStartDate) > new Date(sbEndDate)) {
      alert('Start date must be before end date.')
      return
    }
    setSbGenerating(true)
    try {
      const token = localStorage.getItem('sessionToken')
      const publishedRes = await fetch('/api/schedule/published', { headers: { 'Authorization': `Bearer ${token}` } })
      const publishedData = await publishedRes.json()
      const published = (publishedData?.success && Array.isArray(publishedData.data)) ? publishedData.data : []
      const overlaps = published.some((p) => {
        const aStart = sbStartDate
        const aEnd = sbEndDate
        const bStart = p.week_start_date || ''
        const bEnd = p.week_end_date || ''
        if (!bStart || !bEnd) return false
        return aStart <= bEnd && aEnd >= bStart
      })
      if (overlaps) {
        setSbGenerating(false)
        setToast({ message: 'This date range overlaps an existing published schedule. Please choose different dates.', type: 'warning' })
        return
      }
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          week_start_date: sbStartDate,
          settings: {
            ...sbSettings,
            selected_employees: sbSelectedEmployees,
            excluded_employees: [],
            week_end_date: sbEndDate
          }
        })
      })
      const result = await res.json()
      if (result.period_id) {
        setPendingShiftEdits({})
        setPendingShiftDeletes([])
        setPendingShiftAdds([])
        setAddingShiftForDate(null)
        setIsEditingPublished(false)
        setDraftPeriodId(result.period_id)
        await loadDraftSchedule(result.period_id)
      } else {
        alert(result.message || 'Failed to generate schedule')
      }
    } catch (e) {
      console.error('Generate schedule error:', e)
      alert('Failed to generate schedule')
    } finally {
      setSbGenerating(false)
    }
  }

  const publishSchedule = async () => {
    if (!draftPeriodId || !draftSchedule) return
    if (draftSchedule.period?.status !== 'draft') {
      alert('This schedule is already published.')
      return
    }
    setSbPublishing(true)
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/schedule/${draftPeriodId}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const result = await res.json()
      if (result.success) {
        await loadCalendarData()
        setDraftPeriodId(null)
        setDraftSchedule(null)
        setShowScheduleBuilder(false)
        setToast({ message: 'Schedule published. Shifts are now on the calendar.', type: 'success' })
      } else {
        alert(result.message || 'Failed to publish')
      }
    } catch (e) {
      console.error('Publish error:', e)
      alert('Failed to publish schedule')
    } finally {
      setSbPublishing(false)
    }
  }

  const updateDraftShift = async (shiftId, updates) => {
    const periodId = draftSchedule?.period?.period_id ?? draftPeriodId
    if (!periodId || !draftSchedule) return
    const id = Number(shiftId)
    setEditingDraftShift(null)

    if (isEditingPublished) {
      setPendingShiftEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...updates } }))
      setDraftScheduleVersion((v) => v + 1)
      return
    }
    if (draftSchedule.period?.status !== 'draft') return
    const emp = (employees || []).find((e) => e.employee_id === updates.employee_id)
    const firstName = emp?.first_name ?? ''
    const lastName = emp?.last_name ?? ''
    const prevDraft = draftSchedule

    setDraftSchedule((prev) => {
      if (!prev?.shifts) return prev
      return {
        ...prev,
        shifts: prev.shifts.map((s) =>
          Number(s.scheduled_shift_id) === id
            ? { ...s, ...updates, first_name: firstName, last_name: lastName }
            : s
        )
      }
    })
    setDraftScheduleVersion((v) => v + 1)

    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/schedule/${periodId}/shift`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ scheduled_shift_id: id, ...updates })
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || !result.success) {
        setDraftSchedule(prevDraft ? { ...prevDraft, shifts: [...(prevDraft.shifts || [])] } : null)
        setDraftScheduleVersion((v) => v + 1)
        alert(result.message || 'Failed to update shift')
      }
    } catch (e) {
      console.error('Update shift error:', e)
      setDraftSchedule(prevDraft ? { ...prevDraft, shifts: [...(prevDraft.shifts || [])] } : null)
      setDraftScheduleVersion((v) => v + 1)
      alert('Failed to update shift')
    }
  }

  const deleteDraftShift = async (shiftId) => {
    if (!draftPeriodId || !draftSchedule) return
    const id = Number(shiftId)
    setEditingDraftShift(null)
    if (isEditingPublished) {
      setPendingShiftDeletes((prev) => (prev.includes(id) ? prev : [...prev, id]))
      setPendingShiftEdits((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setDraftScheduleVersion((v) => v + 1)
      return
    }
    if (draftSchedule.period?.status !== 'draft') return
    if (!confirm('Delete this shift?')) return
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/schedule/${draftPeriodId}/shift?shift_id=${shiftId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
      const result = await res.json()
      if (result.success) await loadDraftSchedule(draftPeriodId)
      else alert(result.message || 'Failed to delete shift')
    } catch (e) {
      console.error('Delete shift error:', e)
      alert('Failed to delete shift')
    }
  }

  const addDraftShift = async (shiftDate, formData) => {
    const periodId = draftSchedule?.period?.period_id ?? draftPeriodId
    if (!periodId || !draftSchedule) return
    const st = formData.start_time.length === 5 ? formData.start_time + ':00' : formData.start_time
    const et = formData.end_time.length === 5 ? formData.end_time + ':00' : formData.end_time
    const payload = {
      shift_date: shiftDate,
      employee_id: formData.employee_id,
      start_time: st,
      end_time: et,
      position: formData.position || null,
      notes: formData.notes || null
    }
    setAddingShiftForDate(null)
    if (isEditingPublished) {
      const tempId = `add-${Date.now()}-${Math.random().toString(36).slice(2)}`
      setPendingShiftAdds((prev) => [...prev, { tempId, ...payload }])
      setDraftScheduleVersion((v) => v + 1)
      return
    }
    if (draftSchedule.period?.status !== 'draft') return
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await fetch(`/api/schedule/${periodId}/shift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...payload, break_duration: 30 })
      })
      const result = await res.json()
      if (result?.success) await loadDraftSchedule(periodId)
      else alert(result?.message || 'Failed to add shift')
    } catch (e) {
      console.error('Add shift error:', e)
      alert('Failed to add shift')
    }
  }

  const downloadEvent = async (event) => {
    if (!event.event_id) {
      alert('This event cannot be exported. Please use the calendar subscription feature.')
      return
    }
    
    try {
      const token = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/calendar/events/${event.event_id}/export`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${event.title || 'event'}.ics`
        a.click()
        window.URL.revokeObjectURL(url)
      } else {
        alert('Failed to download event')
      }
    } catch (err) {
      console.error('Error downloading event:', err)
      alert('Error downloading event')
    }
  }

  const addToCalendar = (event) => {
    const eventDate = event.event_date || event.start_datetime
    const startTime = event.start_time || '09:00:00'
    
    try {
      const start = new Date(`${eventDate}T${startTime}`)
      const end = new Date(start.getTime() + (event.end_time ? 
        (new Date(`${eventDate}T${event.end_time}`).getTime() - start.getTime()) : 
        3600000))
      
      const formatDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      }
      
      const title = encodeURIComponent(event.title || 'Event')
      const description = encodeURIComponent(event.description || '')
      const location = encodeURIComponent(event.location || '')
      
      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(start)}/${formatDate(end)}&details=${description}&location=${location}`
      
      window.open(googleUrl, '_blank')
    } catch (err) {
      console.error('Error adding to calendar:', err)
      alert('Error adding to calendar')
    }
  }

  // Full UI shell (header, nav, sidebar, filters) always renders; only calendar grid shows loading state
  return (
    <div style={{ 
      position: 'relative',
      padding: 0, 
      backgroundColor: '#ffffff', 
      height: 'calc(100vh - 56px)',
      maxWidth: '100%', 
      margin: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Main Content Area - Split Layout */}
      <div style={{
        display: 'flex',
        gap: 0,
        flex: 1,
        position: 'relative',
        flexDirection: isMobile ? 'column' : 'row-reverse',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* Right Side - Calendar */}
        <div style={{
          flex: !isMobile ? '0 1 65%' : '1 1 100%',
          transition: 'flex 0.3s ease',
          minWidth: 0,
          padding: '30px 20px 20px 20px',
          paddingRight: isMobile ? '20px' : '20px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          height: '100%'
        }}>
          {/* Custom Calendar Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
            paddingBottom: '8px'
          }}>
            {/* Left: Calendar Title */}
            <div style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              {calendarTitle}
            </div>
            
            {/* Right: Navigation Arrows and Today Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {/* Prev Arrow */}
              <span
                onClick={navigatePrev}
                style={{
                  cursor: 'pointer',
                  padding: '0 4px',
                  color: 'var(--text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  userSelect: 'none',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = themeColor
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)'
                }}
                title="Previous"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </span>
              
              {/* Today Button */}
              <button
                type="button"
                onClick={goToToday}
                style={{
                  padding: 0,
                  margin: 0,
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'text-decoration 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none'
                }}
                title="Go to Today"
              >
                Today
              </button>
              
              {/* Next Arrow */}
              <span
                onClick={navigateNext}
                style={{
                  cursor: 'pointer',
                  padding: '0 4px',
                  color: 'var(--text-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  userSelect: 'none',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = themeColor
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)'
                }}
                title="Next"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </span>
            </div>
          </div>
          
          {/* FullCalendar always visible; fade overlay when loading (like Profile weekly schedule) */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }} aria-busy={loading} aria-label={loading ? 'Loading calendar events' : 'Calendar'}>
            {loading && (
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
                  color: 'var(--text-primary, #333)'
                }}
              >
                Loading…
              </div>
            )}
            <FullCalendar
              key={showScheduleBuilder && isAdmin && !draftSchedule ? `sb-${sbStartDate || ''}-${sbEndDate || ''}` : `default-${draftScheduleVersion}-${draftShiftsFingerprint}`}
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              initialDate={showScheduleBuilder && isAdmin && sbViewDate ? sbViewDate : (lastCalendarViewDate || undefined)}
              fixedWeekCount={false}
              headerToolbar={false}
              events={fullCalendarEvents}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              select={handleSelect}
              datesSet={handleViewChange}
              height="100%"
              editable={false}
              selectable={false}
              selectMirror={false}
              dayCellDidMount={dayCellDidMount}
              dayCellWillUnmount={dayCellWillUnmount}
              dayMaxEvents={true}
              moreLinkClick="popover"
              themeSystem="standard"
              buttonText={{
                today: 'Today',
                month: 'Month',
                week: 'Week',
                day: 'Day'
              }}
            />
          </div>
        </div>

        {/* Divider Line */}
        {!isMobile && (
          <div style={{
            width: '1px',
            backgroundColor: 'var(--border-color)',
            flexShrink: 0
          }} />
        )}

        {/* Left Side - Info Panel */}
        <div
          className={showScheduleBuilder || showDraftsList || showEditList || showEventModal ? 'calendar-hide-scrollbars' : undefined}
          style={{
            position: isMobile && (selectedEvent || selectedDate) ? 'fixed' : 'relative',
            top: isMobile && (selectedEvent || selectedDate) ? 0 : 'auto',
            right: isMobile && (selectedEvent || selectedDate) ? 0 : 'auto',
            bottom: isMobile && (selectedEvent || selectedDate) ? 0 : 'auto',
            width: isMobile && (selectedEvent || selectedDate) ? '90vw' : !isMobile ? '35%' : '100%',
            maxWidth: '500px',
            minWidth: isMobile ? 'auto' : '350px',
            height: isMobile && (selectedEvent || selectedDate) ? '100vh' : '100%',
            maxHeight: isMobile && (selectedEvent || selectedDate) ? '100vh' : 'none',
            zIndex: isMobile && (selectedEvent || selectedDate) ? 999 : 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '20px',
            paddingLeft: isMobile ? '20px' : '20px',
            flex: !isMobile ? '0 1 35%' : '1 1 100%',
            minHeight: 0
          }}
        >
          {/* Overlay for mobile when panel is open */}
          {isMobile && (selectedEvent || selectedDate) && (
            <div 
              onClick={() => {
                setSelectedEvent(null)
                setSelectedDate(null)
                setSelectedDateEvents([])
              }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 998,
                animation: 'fadeIn 0.2s ease'
              }}
            />
          )}

          {/* Panel Content */}
          <div
            className={showScheduleBuilder || showDraftsList || showEditList ? 'calendar-scrollable-hide-bar' : undefined}
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '10px 20px 20px 20px',
              paddingTop: '4px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Text links at Top - Always Visible */}
            <div style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '20px',
              flexShrink: 0,
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <div ref={filterDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowFilterDropdown(!showFilterDropdown)
                  }}
                  style={{
                    padding: '8px 12px',
                    margin: 0,
                    background: showFilterDropdown ? '#e0e0e0' : '#f5f5f5',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e0e0e0'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = showFilterDropdown ? '#e0e0e0' : '#f5f5f5'
                  }}
                  title="Filter Events"
                >
                  Filter
                </button>
                {showFilterDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      minWidth: '200px',
                      width: 'max-content',
                      padding: '8px 0',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      zIndex: 1000
                    }}
                  >
                    {['holiday', 'event', 'meeting', 'shipment', 'schedule', 'maintenance'].map(type => (
                      <label
                        key={type}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 14px',
                          margin: 0,
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: 'var(--text-primary)',
                          backgroundColor: eventFilters[type] ? `rgba(${themeColorRgb}, 0.1)` : 'transparent',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = eventFilters[type] ? `rgba(${themeColorRgb}, 0.15)` : 'var(--bg-tertiary)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = eventFilters[type] ? `rgba(${themeColorRgb}, 0.1)` : 'transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={eventFilters[type]}
                          onChange={() => toggleEventFilter(type)}
                          style={{
                            cursor: 'pointer',
                            width: '16px',
                            height: '16px',
                            accentColor: themeColor,
                            flexShrink: 0
                          }}
                        />
                        <span style={{ textTransform: 'capitalize', fontWeight: eventFilters[type] ? 600 : 400 }}>
                          {type}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0]
                    setNewEventDate(today)
                    setNewEvent({
                      title: '',
                      event_type: 'event',
                      description: '',
                      start_time: '00:00',
                      end_time: '12:00',
                      forEveryone: true,
                      selectedEmployees: []
                    })
                    setShowEventModal(true)
                    setShowScheduleBuilder(false)
                    setShowDraftsList(false)
                    setShowEditList(false)
                  }}
                  style={{
                    padding: '8px 12px',
                    margin: 0,
                    background: '#f5f5f5',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e0e0e0'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5'
                  }}
                  title="Event"
                >
                  <Plus size={16} style={{ flexShrink: 0 }} />
                  Event
                </button>
              )}
              <div ref={scheduleDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAdmin) {
                      showToast(NO_PERMISSION_MSG, 'error')
                      return
                    }
                    setShowFilterDropdown(false)
                    setShowScheduleDropdown(!showScheduleDropdown)
                  }}
                    style={{
                      padding: '8px 12px',
                      margin: 0,
                      background: showScheduleDropdown ? '#e0e0e0' : '#f5f5f5',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e0e0e0'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = showScheduleDropdown ? '#e0e0e0' : '#f5f5f5'
                    }}
                    title="Schedule"
                  >
                    <CalendarClock size={16} style={{ flexShrink: 0 }} />
                    Schedule
                  </button>
                  {showScheduleDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '4px',
                        padding: '6px 0',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        minWidth: 'max-content',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setDraftSchedule(null)
                          setDraftPeriodId(null)
                          setDraftScheduleVersion(0)
                          setPendingShiftEdits({})
                          setPendingShiftDeletes([])
                          setPendingShiftAdds([])
                          setAddingShiftForDate(null)
                          setEditingDraftShift(null)
                          setIsEditingPublished(false)
                          const m = getNextMonday()
                          const end = new Date(m)
                          end.setDate(end.getDate() + 6)
                          setSbStartDate(m.toISOString().split('T')[0])
                          setSbEndDate(end.toISOString().split('T')[0])
                          setSbRangeClickStep('start')
                          setSbSelectedEmployees([])
                          setShowScheduleBuilder(true)
                          setShowEventModal(false)
                          setShowScheduleDropdown(false)
                          setShowDraftsList(false)
                          setShowEditList(false)
                          setSelectedEvent(null)
                          setSelectedDate(null)
                          setSelectedDateEvents([])
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          margin: 0,
                          background: 'none',
                          border: 'none',
                          borderRadius: 0,
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background-color 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <Plus size={16} style={{ flexShrink: 0 }} />
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={fetchDraftsAndShowList}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          margin: 0,
                          background: 'none',
                          border: 'none',
                          borderRadius: 0,
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background-color 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <FileText size={16} style={{ flexShrink: 0 }} />
                        Drafts
                      </button>
                      <button
                        type="button"
                        onClick={fetchEditListAndShow}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          margin: 0,
                          background: 'none',
                          border: 'none',
                          borderRadius: 0,
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background-color 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <Pencil size={16} style={{ flexShrink: 0 }} />
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              <button
                type="button"
                onClick={() => changeView('dayGridMonth')}
                style={{
                  padding: '8px 12px',
                  margin: 0,
                  background: currentView === 'dayGridMonth' ? '#e0e0e0' : '#f5f5f5',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0e0e0'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = currentView === 'dayGridMonth' ? '#e0e0e0' : '#f5f5f5'
                }}
                title="Month View"
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => changeView('timeGridWeek')}
                style={{
                  padding: '8px 12px',
                  margin: 0,
                  background: currentView === 'timeGridWeek' ? '#e0e0e0' : '#f5f5f5',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0e0e0'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = currentView === 'timeGridWeek' ? '#e0e0e0' : '#f5f5f5'
                }}
                title="Week View"
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => changeView('timeGridDay')}
                style={{
                  padding: '8px 12px',
                  margin: 0,
                  background: currentView === 'timeGridDay' ? '#e0e0e0' : '#f5f5f5',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0e0e0'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = currentView === 'timeGridDay' ? '#e0e0e0' : '#f5f5f5'
                }}
                title="Day View"
              >
                Day
              </button>
              <div ref={linkDropdownRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowFilterDropdown(false)
                    setShowScheduleDropdown(false)
                    setShowLinkDropdown(!showLinkDropdown)
                  }}
                  style={{
                    padding: '8px 12px',
                    margin: 0,
                    background: showLinkDropdown ? '#e0e0e0' : '#f5f5f5',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e0e0e0'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = showLinkDropdown ? '#e0e0e0' : '#f5f5f5'
                  }}
                  title="Link to calendar apps"
                >
                  <Link2 size={16} style={{ flexShrink: 0 }} />
                </button>
                {showLinkDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      padding: '6px 0',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      zIndex: 1000,
                      minWidth: 'max-content',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Link
                      to="/calendar-subscription"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        margin: 0,
                        background: 'none',
                        border: 'none',
                        borderRadius: 0,
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transition: 'background-color 0.2s ease',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                      onClick={() => setShowLinkDropdown(false)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden>
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Google
                    </Link>
                    <Link
                      to="/calendar-subscription"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        margin: 0,
                        background: 'none',
                        border: 'none',
                        borderRadius: 0,
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transition: 'background-color 0.2s ease',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                      onClick={() => setShowLinkDropdown(false)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden>
                        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor"/>
                      </svg>
                      Outlook
                    </Link>
                    <Link
                      to="/calendar-subscription"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        margin: 0,
                        background: 'none',
                        border: 'none',
                        borderRadius: 0,
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transition: 'background-color 0.2s ease',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                      onClick={() => setShowLinkDropdown(false)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }} aria-hidden>
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      Apple
                    </Link>
                    <Link
                      to="/calendar-subscription"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        margin: 0,
                        background: 'none',
                        border: 'none',
                        borderRadius: 0,
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transition: 'background-color 0.2s ease',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                      onClick={() => setShowLinkDropdown(false)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }} aria-hidden>
                        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
                      </svg>
                      Calendly
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Day/Event Info Section */}
            {!selectedEvent && !selectedDate && !showEventModal && !showScheduleBuilder && !showDraftsList && !showEditList && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 0',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                flex: 1
              }}>
                <div style={{
                  opacity: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CalendarIcon size={48} />
                </div>
              </div>
            )}

            {/* Add Event Form - Inline */}
            {showEventModal && isAdmin && (
              <div style={{ 
                flex: 1,
                padding: '0',
                paddingBottom: '0',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'hidden'
              }}>
                <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  {/* Gradient fade-out at bottom */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '20px',
                    background: `linear-gradient(to bottom, transparent, ${isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff'})`,
                    pointerEvents: 'none',
                    zIndex: 2
                  }} />
                  <div
                    className="calendar-scrollable-hide-bar"
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      border: 'none',
                      outline: 'none',
                      position: 'relative'
                    }}
                  >
                    <FormField style={{ marginBottom: '16px' }}>
                      <FormLabel isDarkMode={isDarkMode}>Date</FormLabel>
                      <input
                        type="date"
                        value={newEventDate || ''}
                        onChange={(e) => setNewEventDate(e.target.value)}
                        style={inputBaseStyle(isDarkMode, themeColorRgb)}
                        {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                        required
                      />
                    </FormField>

                    <FormField style={{ marginBottom: '16px' }}>
                      <FormLabel isDarkMode={isDarkMode}>Type</FormLabel>
                      <select
                        value={newEvent.event_type}
                        onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
                        style={inputBaseStyle(isDarkMode, themeColorRgb)}
                        {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                      >
                        <option value="event">Event</option>
                        <option value="holiday">Holiday</option>
                        <option value="meeting">Meeting</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="shipment">Shipment</option>
                        <option value="other">Other</option>
                      </select>
                    </FormField>

                    <FormField style={{ marginBottom: '16px' }}>
                      <FormLabel isDarkMode={isDarkMode} required>Title</FormLabel>
                      <input
                        type="text"
                        value={newEvent.title}
                        onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                        placeholder="Title"
                        style={inputBaseStyle(isDarkMode, themeColorRgb)}
                        {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                        required
                      />
                    </FormField>

                    <FormField style={{ marginBottom: '16px' }}>
                      <FormLabel isDarkMode={isDarkMode}>Time</FormLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <input
                          type="time"
                          value={newEvent.start_time || '00:00'}
                          onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                          style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                        />
                        <input
                          type="time"
                          value={newEvent.end_time || '12:00'}
                          onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                          style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                        />
                      </div>
                    </FormField>

                    <FormField style={{ marginBottom: '16px' }}>
                      <FormLabel isDarkMode={isDarkMode}>Description</FormLabel>
                      <textarea
                        value={newEvent.description}
                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                        placeholder="Description"
                        rows={4}
                        style={{
                          ...inputBaseStyle(isDarkMode, themeColorRgb),
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                        {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                      />
                    </FormField>

                    {/* Employee Selection */}
                    <FormField style={{ marginBottom: '16px' }}>
                      <FormLabel isDarkMode={isDarkMode}>Assign to</FormLabel>
                      <div style={{
                        padding: '12px',
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff'
                      }}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: newEvent.forEveryone ? 0 : '12px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                        }}>
                          <input
                            type="radio"
                            checked={newEvent.forEveryone}
                            onChange={() => setNewEvent({ ...newEvent, forEveryone: true, selectedEmployees: [] })}
                            style={{ cursor: 'pointer', accentColor: themeColor }}
                          />
                          <span>Everyone</span>
                        </label>
                        
                        {!newEvent.forEveryone && (
                          <div style={{
                            marginTop: '12px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                            borderRadius: '8px',
                            padding: '8px',
                            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff'
                          }}>
                            {loadingEmployees ? (
                              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                Loading employees...
                              </div>
                            ) : employees.length === 0 ? (
                              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                No employees found
                              </div>
                            ) : (
                              employees.map(emp => (
                                <label
                                  key={emp.employee_id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    color: 'var(--text-primary)',
                                    borderRadius: '4px',
                                    transition: 'background-color 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={newEvent.selectedEmployees.includes(emp.employee_id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setNewEvent({
                                          ...newEvent,
                                          selectedEmployees: [...newEvent.selectedEmployees, emp.employee_id]
                                        })
                                      } else {
                                        setNewEvent({
                                          ...newEvent,
                                          selectedEmployees: newEvent.selectedEmployees.filter(id => id !== emp.employee_id)
                                        })
                                      }
                                    }}
                                    style={{
                                      cursor: 'pointer',
                                      accentColor: themeColor
                                    }}
                                  />
                                  <span>{emp.first_name} {emp.last_name} {emp.position ? `(${emp.position})` : ''}</span>
                                </label>
                              ))
                            )}
                          </div>
                        )}
                        
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '12px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                        }}>
                          <input
                            type="radio"
                            checked={!newEvent.forEveryone}
                            onChange={() => setNewEvent({ ...newEvent, forEveryone: false, selectedEmployees: [] })}
                            style={{ cursor: 'pointer', accentColor: themeColor }}
                          />
                          <span>Specific Employees</span>
                        </label>
                      </div>
                    </FormField>

                    {/* Buttons inside scroll section */}
                    <div style={{ display: 'flex', gap: '12px', flexShrink: 0, marginBottom: '12px', marginTop: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setShowEventModal(false)}
                        style={{
                          padding: '4px 16px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          whiteSpace: 'nowrap',
                          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          boxShadow: 'none'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateEvent}
                        disabled={
                          creatingEvent ||
                          !newEvent.title.trim() ||
                          !newEventDate ||
                          (!newEvent.forEveryone && newEvent.selectedEmployees.length === 0)
                        }
                        style={{
                          flex: 1,
                          padding: '4px 16px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap',
                          backgroundColor: (creatingEvent || !newEvent.title.trim() || !newEventDate || (!newEvent.forEveryone && newEvent.selectedEmployees.length === 0)) ? 'var(--bg-tertiary)' : `rgba(${themeColorRgb}, 0.7)`,
                          border: (creatingEvent || !newEvent.title.trim() || !newEventDate || (!newEvent.forEveryone && newEvent.selectedEmployees.length === 0)) ? `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}` : `1px solid rgba(${themeColorRgb}, 0.5)`,
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: (creatingEvent || !newEvent.title.trim() || !newEventDate || (!newEvent.forEveryone && newEvent.selectedEmployees.length === 0)) ? 500 : 600,
                          color: (creatingEvent || !newEvent.title.trim() || !newEventDate || (!newEvent.forEveryone && newEvent.selectedEmployees.length === 0)) ? 'var(--text-secondary)' : '#fff',
                          cursor: (creatingEvent || !newEvent.title.trim() || !newEventDate || (!newEvent.forEveryone && newEvent.selectedEmployees.length === 0)) ? 'not-allowed' : 'pointer',
                          transition: 'all 0.3s ease',
                          boxShadow: (creatingEvent || !newEvent.title.trim() || !newEventDate || (!newEvent.forEveryone && newEvent.selectedEmployees.length === 0)) ? 'none' : `0 4px 15px rgba(${themeColorRgb}, 0.3)`
                        }}
                      >
                        {creatingEvent ? 'Creating…' : 'Create Event'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Builder */}
            {showScheduleBuilder && isAdmin && (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'hidden'
              }}>
                <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  <div
                    className="calendar-scrollable-hide-bar"
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      border: 'none',
                      outline: 'none'
                    }}
                  >
                    {!draftSchedule ? (
                    <>
                      <FormField style={{ marginBottom: '16px' }}>
                        <FormLabel isDarkMode={isDarkMode}>Start date</FormLabel>
                        <input
                          type="date"
                          value={sbStartDate || ''}
                          onChange={(e) => { setSbStartDate(e.target.value); setSbRangeClickStep('start'); }}
                          style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                        />
                      </FormField>
                      <FormField style={{ marginBottom: '16px' }}>
                        <FormLabel isDarkMode={isDarkMode}>End date</FormLabel>
                        <input
                          type="date"
                          value={sbEndDate || ''}
                          onChange={(e) => setSbEndDate(e.target.value)}
                          style={inputBaseStyle(isDarkMode, themeColorRgb)}
                          {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                        />
                        <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Or click the <strong>first date</strong> on the calendar, then the <strong>last date</strong>. The range becomes highlighted.
                        </p>
                      </FormField>
                      <FormField style={{ marginBottom: '16px' }}>
                        <FormLabel isDarkMode={isDarkMode}>Employees</FormLabel>
                        <div
                          className="calendar-scrollable-hide-bar"
                          style={{
                            maxHeight: '180px',
                            overflowY: 'auto',
                            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                            borderRadius: '8px',
                            padding: '8px',
                            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff'
                          }}
                        >
                          {loadingEmployees ? (
                            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
                          ) : employees.length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>No employees</div>
                          ) : (
                            employees.map(emp => (
                              <label
                                key={emp.employee_id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 8px',
                                  cursor: 'pointer',
                                  fontSize: '14px',
                                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                  borderRadius: '4px'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={sbSelectedEmployees.includes(emp.employee_id)}
                                  onChange={() => {
                                    setSbSelectedEmployees(prev =>
                                      prev.includes(emp.employee_id)
                                        ? prev.filter(id => id !== emp.employee_id)
                                        : [...prev, emp.employee_id]
                                    )
                                  }}
                                  style={{ cursor: 'pointer', accentColor: themeColor }}
                                />
                                <span>{emp.first_name} {emp.last_name}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </FormField>
                      {/* Advanced settings */}
                      <div style={{
                        flexShrink: 0,
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        overflow: 'hidden'
                      }}>
                        <button
                          type="button"
                          onClick={() => setSbShowAdvanced(!sbShowAdvanced)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            backgroundColor: sbShowAdvanced ? `rgba(${themeColorRgb}, 0.15)` : 'transparent',
                            border: 'none',
                            borderRadius: 0,
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background-color 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px'
                          }}
                        >
                          Advanced settings
                          {sbShowAdvanced ? (
                            <ChevronDown size={16} style={{ flexShrink: 0 }} />
                          ) : (
                            <ChevronRight size={16} style={{ flexShrink: 0 }} />
                          )}
                        </button>
                        {sbShowAdvanced && (
                          <div style={{
                            padding: '14px',
                            paddingTop: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            borderTop: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd'
                          }}>
                            <FormField style={{ marginTop: '8px', marginBottom: '8px' }}>
                              <FormLabel isDarkMode={isDarkMode}>Algorithm</FormLabel>
                              <CustomDropdown
                                value={sbSettings.algorithm}
                                onChange={(e) => setSbSettings(s => ({ ...s, algorithm: e.target.value }))}
                                options={[
                                  { value: 'balanced', label: 'Balanced' },
                                  { value: 'cost_optimized', label: 'Cost optimized' },
                                  { value: 'preference_prioritized', label: 'Preference priority' }
                                ]}
                                placeholder="Select algorithm"
                                isDarkMode={isDarkMode}
                                themeColorRgb={themeColorRgb}
                              />
                            </FormField>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <FormField style={{ marginBottom: '8px' }}>
                                <FormLabel isDarkMode={isDarkMode}>Max consecutive days</FormLabel>
                                <input
                                  type="number"
                                  min={1}
                                  max={7}
                                  value={sbSettings.max_consecutive_days}
                                  onChange={(e) => setSbSettings(s => ({ ...s, max_consecutive_days: parseInt(e.target.value, 10) || 6 }))}
                                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                />
                              </FormField>
                              <FormField style={{ marginBottom: '8px' }}>
                                <FormLabel isDarkMode={isDarkMode}>Min hours between shifts</FormLabel>
                                <input
                                  type="number"
                                  min={8}
                                  max={24}
                                  value={sbSettings.min_time_between_shifts}
                                  onChange={(e) => setSbSettings(s => ({ ...s, min_time_between_shifts: parseInt(e.target.value, 10) || 10 }))}
                                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                />
                              </FormField>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <FormField style={{ marginBottom: '8px' }}>
                                <FormLabel isDarkMode={isDarkMode}>Min employees per shift</FormLabel>
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={sbSettings.min_employees_per_shift}
                                  onChange={(e) => setSbSettings(s => ({ ...s, min_employees_per_shift: parseInt(e.target.value, 10) || 1 }))}
                                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                />
                              </FormField>
                              <FormField style={{ marginBottom: '8px' }}>
                                <FormLabel isDarkMode={isDarkMode}>Max employees per shift</FormLabel>
                                <input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={sbSettings.max_employees_per_shift}
                                  onChange={(e) => setSbSettings(s => ({ ...s, max_employees_per_shift: parseInt(e.target.value, 10) || 5 }))}
                                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                                />
                              </FormField>
                            </div>
                            <FormField style={{ marginBottom: '8px' }}>
                              <FormLabel isDarkMode={isDarkMode}>Default shift length (hours)</FormLabel>
                              <input
                                type="number"
                                min={4}
                                max={12}
                                value={sbSettings.default_shift_length}
                                onChange={(e) => setSbSettings(s => ({ ...s, default_shift_length: parseInt(e.target.value, 10) || 8 }))}
                                style={inputBaseStyle(isDarkMode, themeColorRgb)}
                                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                              />
                            </FormField>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                <input
                                  type="checkbox"
                                  checked={sbSettings.distribute_hours_evenly}
                                  onChange={(e) => setSbSettings(s => ({ ...s, distribute_hours_evenly: e.target.checked }))}
                                  style={{ cursor: 'pointer', accentColor: themeColor }}
                                />
                                <span>Distribute hours evenly</span>
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                <input
                                  type="checkbox"
                                  checked={sbSettings.avoid_clopening}
                                  onChange={(e) => setSbSettings(s => ({ ...s, avoid_clopening: e.target.checked }))}
                                  style={{ cursor: 'pointer', accentColor: themeColor }}
                                />
                                <span>Avoid clopening (close then open)</span>
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                                <input
                                  type="checkbox"
                                  checked={sbSettings.prioritize_seniority}
                                  onChange={(e) => setSbSettings(s => ({ ...s, prioritize_seniority: e.target.checked }))}
                                  style={{ cursor: 'pointer', accentColor: themeColor }}
                                />
                                <span>Prioritize seniority</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexShrink: 0, marginBottom: '12px', marginTop: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setShowScheduleBuilder(false)}
                          style={{
                            padding: '4px 16px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            whiteSpace: 'nowrap',
                            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                            border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 500,
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: 'none'
                          }}
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={generateSchedule}
                          disabled={sbGenerating || !sbSelectedEmployees.length || !sbStartDate || !sbEndDate || new Date(sbStartDate) > new Date(sbEndDate)}
                          style={{
                            flex: 1,
                            padding: '4px 16px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            whiteSpace: 'nowrap',
                            backgroundColor: (sbGenerating || !sbSelectedEmployees.length || !sbStartDate || !sbEndDate) ? 'var(--bg-tertiary)' : `rgba(${themeColorRgb}, 0.7)`,
                            border: (sbGenerating || !sbSelectedEmployees.length || !sbStartDate || !sbEndDate) ? `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}` : `1px solid rgba(${themeColorRgb}, 0.5)`,
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: (sbGenerating || !sbSelectedEmployees.length || !sbStartDate || !sbEndDate) ? 500 : 600,
                            color: (sbGenerating || !sbSelectedEmployees.length || !sbStartDate || !sbEndDate) ? 'var(--text-secondary)' : '#fff',
                            cursor: (sbGenerating || !sbSelectedEmployees.length || !sbStartDate || !sbEndDate) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: (sbGenerating || !sbSelectedEmployees.length || !sbStartDate || !sbEndDate) ? 'none' : `0 4px 15px rgba(${themeColorRgb}, 0.3)`
                          }}
                        >
                          {sbGenerating ? 'Generating…' : 'Generate Schedule'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {draftListData.days.length > 0 && (
                        <div key={`draft-list-${draftScheduleVersion}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, marginBottom: '12px' }}>
                          {draftListData.days.length <= 7 ? (
                            draftListData.days.map((dateStr) => {
                              const isOpen = draftExpandedDays.includes(dateStr)
                              const dayLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                              const dayShifts = (draftListData.shiftsByDate[dateStr] || [])
                              const canEdit = draftSchedule?.period?.status === 'draft' || isEditingPublished
                              return (
                                <div key={dateStr} style={{ border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
                                  <button
                                    type="button"
                                    onClick={() => setDraftExpandedDays((prev) => (prev.includes(dateStr) ? prev.filter((x) => x !== dateStr) : [...prev, dateStr]))}
                                    style={{
                                      width: '100%',
                                      padding: '10px 12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '8px',
                                      backgroundColor: isOpen ? `rgba(${themeColorRgb}, 0.12)` : 'transparent',
                                      border: 'none',
                                      borderRadius: 0,
                                      fontSize: '14px',
                                      fontWeight: 600,
                                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                      cursor: 'pointer',
                                      textAlign: 'left'
                                    }}
                                  >
                                    {dayLabel}
                                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  </button>
                                  {isOpen && (
                                    <div style={{ padding: '10px 12px', borderTop: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd', backgroundColor: isDarkMode ? 'var(--bg-secondary, #1a1a1a)' : '#f9f9f9' }}>
                                      {dayShifts.length === 0 ? (
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No shifts</span>
                                      ) : (
                                        dayShifts.map((s) => {
                                          const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Employee'
                                          const key = s.tempId ?? s.scheduled_shift_id
                                          const isPendingAdd = !!s.__pendingAdd
                                          return (
                                            <div
                                              key={key}
                                              role={canEdit && !isPendingAdd ? 'button' : undefined}
                                              onClick={canEdit && !isPendingAdd ? () => setEditingDraftShift({ ...s, type: 'draft_shift', eventType: 'draft_shift' }) : undefined}
                                              style={{
                                                padding: '6px 0',
                                                fontSize: '13px',
                                                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                                cursor: canEdit && !isPendingAdd ? 'pointer' : 'default',
                                                borderBottom: isDarkMode ? '1px solid var(--border-color, #333)' : '1px solid #eee'
                                              }}
                                            >
                                              {name} — {formatTime(s.start_time)}–{formatTime(s.end_time)}
                                            </div>
                                          )
                                        })
                                      )}
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => setAddingShiftForDate(dateStr)}
                                          style={{
                                            marginTop: '8px',
                                            padding: '6px 10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            color: `rgb(${themeColorRgb})`,
                                            backgroundColor: 'transparent',
                                            border: `1px dashed rgba(${themeColorRgb}, 0.5)`,
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            width: '100%'
                                          }}
                                        >
                                          <Plus size={14} />
                                          Add shift
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          ) : (
                            draftListData.weeks.map((weekDays, wi) => {
                              const isWeekOpen = draftExpandedWeeks.includes(wi)
                              return (
                                <div key={wi} style={{ border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
                                  <button
                                    type="button"
                                    onClick={() => setDraftExpandedWeeks((prev) => (prev.includes(wi) ? prev.filter((x) => x !== wi) : [...prev, wi]))}
                                    style={{
                                      width: '100%',
                                      padding: '10px 12px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '8px',
                                      backgroundColor: isWeekOpen ? `rgba(${themeColorRgb}, 0.12)` : 'transparent',
                                      border: 'none',
                                      borderRadius: 0,
                                      fontSize: '14px',
                                      fontWeight: 600,
                                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                      cursor: 'pointer',
                                      textAlign: 'left'
                                    }}
                                  >
                                    Week {wi + 1}
                                    {isWeekOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  </button>
                                  {isWeekOpen && (
                                    <div style={{ padding: '8px', borderTop: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd', backgroundColor: isDarkMode ? 'var(--bg-secondary, #1a1a1a)' : '#f9f9f9', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {weekDays.map((dateStr) => {
                                        const isDayOpen = draftExpandedDays.includes(dateStr)
                                        const dayLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                                        const dayShifts = (draftListData.shiftsByDate[dateStr] || [])
                                        const canEdit = draftSchedule?.period?.status === 'draft' || isEditingPublished
                                        return (
                                          <div key={dateStr} style={{ border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' }}>
                                            <button
                                              type="button"
                                              onClick={() => setDraftExpandedDays((prev) => (prev.includes(dateStr) ? prev.filter((x) => x !== dateStr) : [...prev, dateStr]))}
                                              style={{
                                                width: '100%',
                                                padding: '8px 10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '6px',
                                                backgroundColor: isDayOpen ? `rgba(${themeColorRgb}, 0.1)` : 'transparent',
                                                border: 'none',
                                                borderRadius: 0,
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                                cursor: 'pointer',
                                                textAlign: 'left'
                                              }}
                                            >
                                              {dayLabel}
                                              {isDayOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                            {isDayOpen && (
                                              <div style={{ padding: '8px 10px', borderTop: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd', backgroundColor: isDarkMode ? 'var(--bg-primary, #0d0d0d)' : '#fff' }}>
                                                {dayShifts.length === 0 ? (
                                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No shifts</span>
                                                ) : (
                                                  dayShifts.map((s) => {
                                                    const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Employee'
                                                    const key = s.tempId ?? s.scheduled_shift_id
                                                    const isPendingAdd = !!s.__pendingAdd
                                                    return (
                                                      <div
                                                        key={key}
                                                        role={canEdit && !isPendingAdd ? 'button' : undefined}
                                                        onClick={canEdit && !isPendingAdd ? () => setEditingDraftShift({ ...s, type: 'draft_shift', eventType: 'draft_shift' }) : undefined}
                                                        style={{
                                                          padding: '4px 0',
                                                          fontSize: '12px',
                                                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                                          cursor: canEdit && !isPendingAdd ? 'pointer' : 'default',
                                                          borderBottom: isDarkMode ? '1px solid var(--border-color, #333)' : '1px solid #eee'
                                                        }}
                                                      >
                                                        {name} — {formatTime(s.start_time)}–{formatTime(s.end_time)}
                                                      </div>
                                                    )
                                                  })
                                                )}
                                                {canEdit && (
                                                  <button
                                                    type="button"
                                                    onClick={() => setAddingShiftForDate(dateStr)}
                                                    style={{
                                                      marginTop: '6px',
                                                      padding: '4px 8px',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      gap: '4px',
                                                      fontSize: '12px',
                                                      fontWeight: 500,
                                                      color: `rgb(${themeColorRgb})`,
                                                      backgroundColor: 'transparent',
                                                      border: `1px dashed rgba(${themeColorRgb}, 0.5)`,
                                                      borderRadius: '6px',
                                                      cursor: 'pointer',
                                                      width: '100%'
                                                    }}
                                                  >
                                                    <Plus size={12} />
                                                    Add shift
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
                      {(draftSchedule.period?.status === 'draft' || isEditingPublished) && (
                        <div style={{ display: 'flex', gap: '12px', flexShrink: 0, marginBottom: '12px' }}>
                          <button
                            type="button"
                            onClick={cancelDraftAndClose}
                            title="Cancel"
                            style={{
                              width: '28px',
                              height: '28px',
                              padding: 0,
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                              border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                              borderRadius: '6px',
                              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              boxShadow: 'none'
                            }}
                          >
                            <X size={16} strokeWidth={2.5} />
                          </button>
                          {isEditingPublished ? (
                            <button
                              type="button"
                              onClick={pushChangesAndClose}
                              style={{
                                flex: 1,
                                padding: '4px 16px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                whiteSpace: 'nowrap',
                                backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                                border: `1px solid rgba(${themeColorRgb}, 0.5)`,
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3)`
                              }}
                            >
                              Push changes
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={saveDraftAndClose}
                                style={{
                                  flex: 1,
                                  padding: '4px 16px',
                                  height: '28px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  whiteSpace: 'nowrap',
                                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                  border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: 500,
                                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s ease',
                                  boxShadow: 'none'
                                }}
                              >
                                Save Draft
                              </button>
                              <button
                                type="button"
                                onClick={publishSchedule}
                                disabled={sbPublishing}
                                style={{
                                  flex: 1,
                                  padding: '4px 16px',
                                  height: '28px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  whiteSpace: 'nowrap',
                                  backgroundColor: sbPublishing ? 'var(--bg-tertiary)' : `rgba(${themeColorRgb}, 0.7)`,
                                  border: sbPublishing ? `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}` : `1px solid rgba(${themeColorRgb}, 0.5)`,
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: sbPublishing ? 500 : 600,
                                  color: sbPublishing ? 'var(--text-secondary)' : '#fff',
                                  cursor: sbPublishing ? 'not-allowed' : 'pointer',
                                  transition: 'all 0.3s ease',
                                  boxShadow: sbPublishing ? 'none' : `0 4px 15px rgba(${themeColorRgb}, 0.3)`
                                }}
                              >
                                {sbPublishing ? 'Publishing…' : 'Publish'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '32px',
                      background: 'linear-gradient(to top, var(--bg-primary), transparent)',
                      pointerEvents: 'none'
                    }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            )}

            {/* Edit draft shift modal */}
            {editingDraftShift && (
              <EditDraftShiftModal
                shift={editingDraftShift}
                employees={employees}
                onSave={(shiftId, updates) => updateDraftShift(shiftId, updates)}
                onDelete={async () => {
                  await deleteDraftShift(editingDraftShift.scheduled_shift_id)
                  setEditingDraftShift(null)
                }}
                onCancel={() => setEditingDraftShift(null)}
                themeColor={themeColor}
                themeColorRgb={themeColorRgb}
                isDarkMode={isDarkMode}
              />
            )}
            {addingShiftForDate && (
              <AddShiftModal
                shiftDate={addingShiftForDate}
                employees={employees}
                onSave={(formData) => addDraftShift(addingShiftForDate, formData)}
                onCancel={() => setAddingShiftForDate(null)}
                themeColor={themeColor}
                themeColorRgb={themeColorRgb}
                isDarkMode={isDarkMode}
              />
            )}

            {/* Drafts list - inline on page */}
            {showDraftsList && isAdmin && (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'hidden'
              }}>
                <div style={{ marginBottom: '16px', flexShrink: 0 }}>
                  <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: 0 }}>Drafts</FormTitle>
                </div>
                <div className="calendar-scrollable-hide-bar" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  {loadingDrafts ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
                  ) : draftList.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No drafts</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {draftList.map((d) => {
                        const start = d.week_start_date ? new Date(d.week_start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
                        const end = d.week_end_date ? new Date(d.week_end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
                        const isConfirmOpen = confirmDeleteDraftId === d.period_id
                        return (
                          <div
                            key={d.period_id}
                            ref={isConfirmOpen ? confirmDeleteDropdownRef : null}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 10px',
                              border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                              borderRadius: '8px',
                              backgroundColor: 'transparent',
                              position: 'relative'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => openDraftInBuilder(d.period_id)}
                              style={{
                                flex: 1,
                                padding: '4px 8px',
                                textAlign: 'left',
                                background: 'none',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              {start && end ? `${start} – ${end}` : `Draft #${d.period_id}`}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setConfirmDeleteDraftId((prev) => (prev === d.period_id ? null : d.period_id))
                              }}
                              title="Delete draft"
                              style={{
                                width: '24px',
                                height: '24px',
                                padding: 0,
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'none',
                                border: 'none',
                                borderRadius: 0,
                                color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                                cursor: 'pointer',
                                transition: 'color 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = isDarkMode ? 'var(--text-secondary, #999)' : '#666'
                              }}
                            >
                              <X size={18} strokeWidth={2.5} />
                            </button>
                            {isConfirmOpen && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  right: 0,
                                  marginTop: '4px',
                                  minWidth: '200px',
                                  padding: '12px',
                                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                                  border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                                  borderRadius: '8px',
                                  boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
                                  zIndex: 1000
                                }}
                              >
                                <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
                                  Delete this draft?
                                </p>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteDraftId(null)}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '14px',
                                      fontWeight: 500,
                                      color: 'var(--text-primary)',
                                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                      border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                                      borderRadius: '6px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteDraftPeriod(d.period_id)}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '14px',
                                      fontWeight: 600,
                                      color: '#fff',
                                      backgroundColor: 'rgba(220, 53, 69, 0.9)',
                                      border: '1px solid rgba(220, 53, 69, 0.9)',
                                      borderRadius: '6px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Confirm
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Edit list - published schedules, inline on page */}
            {showEditList && isAdmin && (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'hidden'
              }}>
                <div style={{ marginBottom: '16px', flexShrink: 0 }}>
                  <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: 0 }}>Edit schedule</FormTitle>
                </div>
                <div className="calendar-scrollable-hide-bar" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  {loadingEditList ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
                  ) : editList.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No published schedules</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {editList.map((p) => {
                        const start = p.week_start_date ? new Date(p.week_start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
                        const end = p.week_end_date ? new Date(p.week_end_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
                        return (
                          <button
                            key={p.period_id}
                            type="button"
                            onClick={() => openPublishedForEdit(p)}
                            style={{
                              width: '100%',
                              padding: '12px 14px',
                              textAlign: 'left',
                              background: 'none',
                              border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
                              borderRadius: '8px',
                              fontSize: '14px',
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                          >
                            {start && end ? `${start} – ${end}` : `Schedule #${p.period_id}`}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Day Selection - Show all events for the day */}
            {selectedDate && !selectedEvent && !showScheduleBuilder && (
              <div>
                <div style={{
                  padding: '16px 0',
                  borderBottom: `1px solid var(--border-color)`,
                  marginBottom: '16px'
                }}>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '4px'
                  }}>
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: 'var(--text-secondary)'
                  }}>
                    {selectedDateEvents.length > 0 
                      ? `${selectedDateEvents.length} event${selectedDateEvents.length !== 1 ? 's' : ''} scheduled`
                      : 'No events scheduled'}
                  </div>
                </div>

                {selectedDateEvents.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedDateEvents.map((event, index) => (
                      <div
                        key={index}
                        onClick={() => handleEventFromDayClick(event)}
                        style={{
                          padding: '16px 0',
                          paddingLeft: '16px',
                          borderLeft: `4px solid ${getEventColor(event.event_type || event.eventType)}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          borderBottom: `1px solid var(--border-light)`,
                          marginBottom: '12px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.paddingLeft = '20px'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.paddingLeft = '16px'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'start',
                          marginBottom: '8px'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              marginBottom: '4px'
                            }}>
                              {event.title || event.event_type}
                            </div>
                            {(event.start_time || event.end_time) && (
                              <div style={{
                                fontSize: '13px',
                                color: 'var(--text-secondary)'
                              }}>
                                {event.start_time && formatTime(event.start_time)}
                                {event.end_time && ` - ${formatTime(event.end_time)}`}
                              </div>
                            )}
                          </div>
                          <div style={{
                            padding: '4px 10px',
                            backgroundColor: getEventColor(event.event_type || event.eventType),
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 500,
                            borderRadius: '6px',
                            textTransform: 'capitalize',
                            whiteSpace: 'nowrap'
                          }}>
                            {event.eventType || event.type}
                          </div>
                        </div>
                        {event.description && (
                          <div style={{
                            fontSize: '13px',
                            color: 'var(--text-secondary)',
                            marginTop: '8px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}>
                            {event.description}
                          </div>
                        )}
                        {event.employee_name && (
                          <div style={{
                            fontSize: '12px',
                            color: 'var(--text-tertiary)',
                            marginTop: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <User size={12} />
                            {event.employee_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '40px 0',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)'
                  }}>
                    No events scheduled for this day
                  </div>
                )}
              </div>
            )}

            {/* Single Event Selection - Show detailed event info */}
            {selectedEvent && !showScheduleBuilder && (
              <div style={{
                padding: '0',
                borderLeft: `4px solid ${getEventColor(selectedEvent.event_type || selectedEvent.eventType)}`,
                paddingLeft: '16px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'start',
                  marginBottom: '16px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '20px', 
                      fontWeight: 600, 
                      marginBottom: '8px',
                      textTransform: 'capitalize',
                      color: 'var(--text-primary)'
                    }}>
                      {selectedEvent.title || selectedEvent.event_type}
                    </div>
                  </div>
                  <div style={{
                    padding: '6px 12px',
                    backgroundColor: getEventColor(selectedEvent.event_type || selectedEvent.eventType),
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    textTransform: 'capitalize',
                    whiteSpace: 'nowrap'
                  }}>
                    {selectedEvent.eventType || selectedEvent.type}
                  </div>
                </div>

                {/* Date & Time */}
                <div style={{
                  marginBottom: '16px',
                  paddingBottom: '16px',
                  borderBottom: `1px solid var(--border-light)`
                }}>
                  {selectedEvent.event_date && (
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      marginBottom: '8px'
                    }}>
                      {new Date(selectedEvent.event_date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </div>
                  )}
                  {(selectedEvent.start_time || selectedEvent.end_time) && (
                    <div style={{ 
                      fontSize: '14px', 
                      color: 'var(--text-secondary)'
                    }}>
                      {selectedEvent.start_time && formatTime(selectedEvent.start_time)}
                      {selectedEvent.end_time && ` - ${formatTime(selectedEvent.end_time)}`}
                    </div>
                  )}
                </div>
                
                {/* Description */}
                {selectedEvent.description && (
                  <div style={{ 
                    fontSize: '14px', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '16px',
                    paddingBottom: '16px',
                    borderBottom: `1px solid var(--border-light)`,
                    lineHeight: '1.6'
                  }}>
                    {selectedEvent.description}
                  </div>
                )}
                
                {/* Additional Info */}
                {(selectedEvent.employee_name || selectedEvent.location) && (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    marginBottom: '16px',
                    paddingBottom: '16px',
                    borderBottom: `1px solid var(--border-light)`
                  }}>
                    {selectedEvent.employee_name && (
                      <div style={{ 
                        fontSize: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Employee</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{selectedEvent.employee_name}</span>
                      </div>
                    )}
                    {selectedEvent.location && (
                      <div style={{ 
                        fontSize: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Location</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{selectedEvent.location}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Action Buttons */}
                {selectedEvent.event_id && (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <button
                      onClick={() => downloadEvent(selectedEvent)}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: `1px solid var(--border-color)`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        transition: 'all 0.2s ease',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.1)`
                        e.target.style.borderColor = themeColor
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'var(--bg-tertiary)'
                        e.target.style.borderColor = 'var(--border-color)'
                      }}
                    >
                      <Download size={16} style={{ marginRight: '8px' }} />
                      Download .ics
                    </button>
                    <button
                      onClick={() => addToCalendar(selectedEvent)}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: `1px solid var(--border-color)`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        transition: 'all 0.2s ease',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.1)`
                        e.target.style.borderColor = themeColor
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'var(--bg-tertiary)'
                        e.target.style.borderColor = 'var(--border-color)'
                      }}
                    >
                      <CalendarIcon size={16} />
                      Add to Google
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS Animations and Custom Styles */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes slideInUp {
          from {
            transform: translate(-50%, -40%);
            opacity: 0;
          }
          to {
            transform: translate(-50%, -50%);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        /* Ensure calendar fills container */
        .fc {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .fc-view-harness {
          flex: 1 !important;
          min-height: 0 !important;
        }
        /* Remove divider line above calendar grid (below header) */
        .fc .fc-toolbar,
        .fc .fc-header-toolbar {
          border-bottom: none !important;
          margin-bottom: 4px !important;
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        /* Make calendar view buttons (Month, Week, Day, Today) match Add Event – plain text, same size */
        .fc-header-toolbar .fc-button-group button,
        .fc-header-toolbar .fc-button-group button.fc-button,
        .fc-header-toolbar .fc-button-group button.fc-button-active,
        .fc-header-toolbar .fc-button-group button.fc-button-primary,
        .fc-header-toolbar .fc-today-button {
          background: none !important;
          background-color: transparent !important;
          border: none !important;
          border-color: transparent !important;
          color: var(--text-primary) !important;
          font-weight: 500 !important;
          font-size: 14px !important;
          padding: 0 !important;
          margin: 0 !important;
          cursor: pointer !important;
          box-shadow: none !important;
          text-transform: none !important;
          text-decoration: none !important;
          transition: color 0.2s ease, text-decoration 0.2s ease !important;
          border-radius: 0 !important;
        }
        .fc-header-toolbar .fc-button-group button:hover,
        .fc-header-toolbar .fc-button-group button.fc-button:hover,
        .fc-header-toolbar .fc-today-button:hover {
          background: none !important;
          background-color: transparent !important;
          border: none !important;
          color: var(--text-primary) !important;
          text-decoration: underline !important;
        }
        .fc-header-toolbar .fc-button-group button.fc-button-active,
        .fc-header-toolbar .fc-button-group button.fc-button-active.fc-button-primary {
          background: none !important;
          background-color: transparent !important;
          border: none !important;
          color: ${themeColor} !important;
          font-weight: 500 !important;
          text-decoration: underline !important;
        }
        .fc-header-toolbar .fc-button-group button:focus,
        .fc-header-toolbar .fc-button-group button.fc-button:focus,
        .fc-header-toolbar .fc-today-button:focus {
          box-shadow: none !important;
          outline: none !important;
          background: none !important;
        }
        .fc-header-toolbar .fc-button-group button:active,
        .fc-header-toolbar .fc-today-button:active {
          background: none !important;
          box-shadow: none !important;
        }
        /* Position arrows on either side of title */
        .fc-header-toolbar {
          justify-content: space-between !important;
        }
        .fc-header-toolbar .fc-toolbar-chunk:first-child {
          flex: 0 0 0 !important;
          width: 0 !important;
          min-width: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: hidden !important;
        }
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 2px !important;
          flex: 0 0 auto !important;
          margin-left: 0 !important;
        }
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group {
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button {
          padding: 2px 4px !important;
          margin: 0 !important;
          min-width: auto !important;
          width: auto !important;
          height: auto !important;
        }
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-toolbar-title {
          margin: 0 2px !important;
          padding: 0 !important;
          font-size: 18px !important;
          font-weight: 600 !important;
        }
        /* Right chunk: Month, Week, Day, Today – same spacing as Add Event / Filter */
        .fc-header-toolbar .fc-toolbar-chunk:last-child {
          margin-left: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 8px !important;
          flex: 0 0 auto !important;
        }
        .fc-header-toolbar .fc-toolbar-chunk:last-child .fc-button-group {
          display: flex !important;
          gap: 16px !important;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .fc-header-toolbar .fc-toolbar-title {
          font-size: 18px !important;
          font-weight: 600 !important;
        }
        /* Custom plain text arrows */
        .custom-nav-arrow {
          transition: color 0.2s ease !important;
        }
        .custom-nav-arrow:hover {
          color: ${themeColor} !important;
        }
        /* Remove arrow button containers completely - make them just arrows */
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-prev-button,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-next-button,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-button,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-button-primary,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-prev-button:focus,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-next-button:focus,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-prev-button:active,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-next-button:active,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-prev-button:hover,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-next-button:hover,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-button:hover,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-button:focus,
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group button.fc-button:active {
          border: none !important;
          border-width: 0 !important;
          border-style: none !important;
          border-color: transparent !important;
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
          min-width: 0 !important;
          width: auto !important;
          height: auto !important;
          line-height: 1 !important;
          display: inline-block !important;
          outline: none !important;
          outline-width: 0 !important;
          outline-style: none !important;
          outline-color: transparent !important;
          border-radius: 0 !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
        }
        .fc-header-toolbar .fc-toolbar-chunk:nth-child(2) .fc-button-group {
          display: inline-flex !important;
          gap: 0 !important;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .fc-event-draft {
          border-style: dashed !important;
        }
        /* Hide scrollbars in Create / Edit schedule / Drafts */
        .calendar-hide-scrollbars .calendar-scrollable-hide-bar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .calendar-hide-scrollbars .calendar-scrollable-hide-bar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* Toast notification (schedule published, overlap warning, etc.) */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 20px',
            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
            border: `1px solid ${isDarkMode ? 'var(--border-color, #404040)' : '#ddd'}`,
            borderRadius: '12px',
            boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.15)',
            zIndex: 10001,
            fontSize: '14px',
            fontWeight: 500,
            maxWidth: '90vw'
          }}
        >
          {toast.type === 'warning' ? (
            <AlertCircle size={20} style={{ flexShrink: 0, color: 'var(--toast-warning, #f59e0b)' }} />
          ) : (
            <CheckCircle size={20} style={{ flexShrink: 0, color: `rgb(${themeColorRgb})` }} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}

function EditDraftShiftModal({ shift, employees, onSave, onDelete, onCancel, themeColor, themeColorRgb, isDarkMode }) {
  const [formData, setFormData] = useState({
    employee_id: shift.employee_id,
    start_time: (shift.start_time || '09:00').substring(0, 5),
    end_time: (shift.end_time || '17:00').substring(0, 5),
    position: shift.position || '',
    notes: shift.notes || ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const st = formData.start_time.length === 5 ? formData.start_time + ':00' : formData.start_time
    const et = formData.end_time.length === 5 ? formData.end_time + ':00' : formData.end_time
    onSave(shift.scheduled_shift_id, {
      ...formData,
      start_time: st,
      end_time: et,
      shift_date: shift.shift_date,
      break_duration: 30
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
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '420px',
        width: '90%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        border: '1px solid var(--border-color)'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text-primary)' }}>Edit shift</h2>
        <form onSubmit={handleSubmit}>
          <FormField style={{ marginBottom: '16px' }}>
            <FormLabel isDarkMode={!!isDarkMode}>Employee</FormLabel>
            <CustomDropdown
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: parseInt(e.target.value, 10) })}
              options={(employees || []).map(emp => ({
                value: emp.employee_id,
                label: [emp.first_name, emp.last_name].filter(Boolean).join(' ') || 'Employee'
              }))}
              placeholder="Select employee"
              isDarkMode={!!isDarkMode}
              themeColorRgb={themeColorRgb}
            />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <FormField style={{ marginBottom: 0 }}>
              <FormLabel isDarkMode={!!isDarkMode}>Start</FormLabel>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                style={inputBaseStyle(!!isDarkMode, themeColorRgb)}
                {...getInputFocusHandlers(themeColorRgb, !!isDarkMode)}
                required
              />
            </FormField>
            <FormField style={{ marginBottom: 0 }}>
              <FormLabel isDarkMode={!!isDarkMode}>End</FormLabel>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                style={inputBaseStyle(!!isDarkMode, themeColorRgb)}
                {...getInputFocusHandlers(themeColorRgb, !!isDarkMode)}
                required
              />
            </FormField>
          </div>
          <FormField style={{ marginBottom: '16px' }}>
            <FormLabel isDarkMode={!!isDarkMode}>Position (optional)</FormLabel>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              style={inputBaseStyle(!!isDarkMode, themeColorRgb)}
              {...getInputFocusHandlers(themeColorRgb, !!isDarkMode)}
            />
          </FormField>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '4px 16px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                border: `1px solid rgba(${themeColorRgb}, 0.5)`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3)`
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '4px 16px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: 'none'
              }}
            >
              Cancel
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                style={{
                  flex: 1,
                  padding: '4px 16px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  backgroundColor: isDarkMode ? 'rgba(198, 40, 40, 0.1)' : 'rgba(198, 40, 40, 0.05)',
                  border: '1px solid #c62828',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#c62828',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: 'none'
                }}
              >
                Delete shift
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function AddShiftModal({ shiftDate, employees, onSave, onCancel, themeColor, themeColorRgb, isDarkMode }) {
  const [formData, setFormData] = useState({
    employee_id: null,
    start_time: '09:00',
    end_time: '17:00',
    position: '',
    notes: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.employee_id) {
      alert('Please select an employee')
      return
    }
    const st = formData.start_time.length === 5 ? formData.start_time + ':00' : formData.start_time
    const et = formData.end_time.length === 5 ? formData.end_time + ':00' : formData.end_time
    onSave({ ...formData, start_time: st, end_time: et })
  }

  const dayLabel = shiftDate ? new Date(shiftDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : ''

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
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '420px',
        width: '90%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        border: '1px solid var(--border-color)'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text-primary)' }}>Add shift{dayLabel ? ` — ${dayLabel}` : ''}</h2>
        <form onSubmit={handleSubmit}>
          <FormField style={{ marginBottom: '16px' }}>
            <FormLabel isDarkMode={!!isDarkMode}>Employee</FormLabel>
            <CustomDropdown
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: parseInt(e.target.value, 10) })}
              options={(employees || []).map(emp => ({
                value: emp.employee_id,
                label: [emp.first_name, emp.last_name].filter(Boolean).join(' ') || 'Employee'
              }))}
              placeholder="Select employee"
              isDarkMode={!!isDarkMode}
              themeColorRgb={themeColorRgb}
            />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <FormField style={{ marginBottom: 0 }}>
              <FormLabel isDarkMode={!!isDarkMode}>Start</FormLabel>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                style={inputBaseStyle(!!isDarkMode, themeColorRgb)}
                {...getInputFocusHandlers(themeColorRgb, !!isDarkMode)}
                required
              />
            </FormField>
            <FormField style={{ marginBottom: 0 }}>
              <FormLabel isDarkMode={!!isDarkMode}>End</FormLabel>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                style={inputBaseStyle(!!isDarkMode, themeColorRgb)}
                {...getInputFocusHandlers(themeColorRgb, !!isDarkMode)}
                required
              />
            </FormField>
          </div>
          <FormField style={{ marginBottom: '16px' }}>
            <FormLabel isDarkMode={!!isDarkMode}>Position (optional)</FormLabel>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              style={inputBaseStyle(!!isDarkMode, themeColorRgb)}
              {...getInputFocusHandlers(themeColorRgb, !!isDarkMode)}
            />
          </FormField>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '4px 16px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                border: `1px solid rgba(${themeColorRgb}, 0.5)`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3)`
              }}
            >
              Add shift
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '4px 16px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: 'none'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Calendar
