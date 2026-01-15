import { useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useTheme } from '../contexts/ThemeContext'

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
  
  // Check if user is admin
  const isAdmin = employee?.position?.toLowerCase() === 'admin' || employee?.position?.toLowerCase() === 'manager'
  
  // Fetch employees when modal opens
  useEffect(() => {
    if (showEventModal && isAdmin) {
      fetchEmployees()
    }
  }, [showEventModal, isAdmin])
  
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
    loadCalendarData()
  }, [])

  useEffect(() => {
    // Reload when filters change
    if (!loading) {
      loadCalendarData()
    }
  }, [eventFilters])

  const loadCalendarData = async () => {
    setLoading(true)
    try {
      // Load calendar events
      const eventsResponse = await fetch(`/api/master_calendar`)
      const eventsData = await eventsResponse.json()
      setEvents(eventsData.data || [])

      // Load schedules
      const schedulesResponse = await fetch(`/api/employee_schedule`)
      const schedulesData = await schedulesResponse.json()
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

  // Convert events and schedules to FullCalendar format
  const getFullCalendarEvents = () => {
    const fullCalendarEvents = []

    // Add calendar events
    events.forEach(event => {
      if (eventFilters[event.event_type]) {
        const startDate = event.event_date || event.start_datetime
        const startTime = event.start_time || '09:00:00'
        const endTime = event.end_time || '17:00:00'
        
        const start = new Date(`${startDate}T${startTime}`)
        const end = new Date(`${startDate}T${endTime}`)

        fullCalendarEvents.push({
          id: `event-${event.event_id || event.id}`,
          title: event.title || event.event_type,
          start: start.toISOString(),
          end: end.toISOString(),
          backgroundColor: getEventColor(event.event_type),
          borderColor: getEventColor(event.event_type),
          extendedProps: {
            ...event,
            type: 'event',
            eventType: event.event_type
          }
        })
      }
    })

    // Add schedules
    if (eventFilters.schedule) {
      schedules.forEach(schedule => {
        const scheduleDate = schedule.schedule_date
        const startTime = schedule.start_time || '09:00:00'
        const endTime = schedule.end_time || '17:00:00'
        
        const start = new Date(`${scheduleDate}T${startTime}`)
        const end = new Date(`${scheduleDate}T${endTime}`)

        fullCalendarEvents.push({
          id: `schedule-${schedule.schedule_id || schedule.id}`,
          title: `${schedule.employee_name || 'Employee'}: ${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`,
          start: start.toISOString(),
          end: end.toISOString(),
          backgroundColor: getEventColor('schedule'),
          borderColor: getEventColor('schedule'),
          extendedProps: {
            ...schedule,
            type: 'schedule',
            eventType: 'schedule'
          }
        })
      })
    }

    return fullCalendarEvents
  }

  const handleEventClick = (clickInfo) => {
    setSelectedEvent(clickInfo.event.extendedProps)
    setSelectedDate(null)
    setSelectedDateEvents([])
  }

  const handleDateClick = (dateClickInfo) => {
    const clickedDate = dateClickInfo.dateStr
    
    // Get all events for this day
    const allEvents = getFullCalendarEvents()
    const dayEvents = allEvents.filter(event => {
      const eventDate = new Date(event.start)
      const clickedDateObj = new Date(clickedDate + 'T00:00:00')
      
      return eventDate.toDateString() === clickedDateObj.toDateString()
    })
    
    if (dayEvents.length > 0) {
      // Show all events for this day
      setSelectedDate(clickedDate)
      setSelectedDateEvents(dayEvents.map(e => e.extendedProps))
      setSelectedEvent(null)
    } else {
      // No events for this day
      setSelectedDate(clickedDate)
      setSelectedDateEvents([])
      setSelectedEvent(null)
    }
  }
  
  const handleSelect = (selectInfo) => {
    // Handle date range selection - just clear selection, don't open modal
    if (selectInfo && calendarRef.current) {
      const calendarApi = calendarRef.current.getApi()
      calendarApi.unselect()
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

  if (loading) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        color: 'var(--text-tertiary)',
        backgroundColor: 'var(--bg-primary)'
      }}>
        Loading calendar...
      </div>
    )
  }

  return (
    <div style={{ 
      position: 'relative',
      padding: '20px', 
      backgroundColor: 'var(--bg-secondary)', 
      minHeight: 'calc(100vh - 200px)', 
      maxWidth: '1600px', 
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Main Content Area */}
      <div style={{
        display: 'flex',
        gap: '20px',
        flex: 1,
        position: 'relative',
        flexDirection: isMobile ? 'column' : 'row'
      }}>
        {/* Calendar Section */}
        <div style={{
          flex: !isMobile ? '0 1 65%' : '1 1 100%',
          transition: 'flex 0.3s ease',
          minWidth: 0
        }}>
          {/* Event Filters and Add Event Button */}
          <div style={{ 
            marginBottom: '20px', 
            padding: '16px', 
            backgroundColor: 'var(--bg-primary)', 
            borderRadius: '8px',
            border: `1px solid var(--border-color)`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 4px var(--shadow)'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <span style={{ 
                fontWeight: 600, 
                marginRight: '8px', 
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}>
                Filter Events:
              </span>
            {['holiday', 'event', 'meeting', 'shipment', 'schedule', 'maintenance'].map(type => (
              <label 
                key={type}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: eventFilters[type] ? `rgba(${themeColorRgb}, 0.1)` : 'transparent',
                  border: `1px solid ${eventFilters[type] ? themeColor : 'var(--border-color)'}`,
                  transition: 'all 0.2s ease'
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
                    accentColor: themeColor
                  }}
                />
                <span style={{ textTransform: 'capitalize', fontWeight: eventFilters[type] ? 500 : 400 }}>
                  {type}
                </span>
              </label>
            ))}
            </div>
            {isAdmin && (
              <button
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
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: themeColor,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.opacity = '0.9'
                  e.target.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.opacity = '1'
                  e.target.style.transform = 'translateY(0)'
                }}
              >
                ➕ Add Event
              </button>
            )}
          </div>

          {/* FullCalendar */}
          <div style={{ 
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '8px',
            border: `1px solid var(--border-color)`,
            padding: '16px',
            boxShadow: '0 2px 4px var(--shadow)'
          }}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              events={getFullCalendarEvents()}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              select={handleSelect}
              height="auto"
              editable={false}
              selectable={false}
              selectMirror={false}
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

        {/* Side Panel - Always Open */}
        <div style={{
          position: isMobile && (selectedEvent || selectedDate) ? 'fixed' : 'relative',
          top: isMobile && (selectedEvent || selectedDate) ? 0 : 'auto',
          right: isMobile && (selectedEvent || selectedDate) ? 0 : 'auto',
          bottom: isMobile && (selectedEvent || selectedDate) ? 0 : 'auto',
          width: isMobile && (selectedEvent || selectedDate) ? '90vw' : !isMobile ? '35%' : '100%',
          maxWidth: '500px',
          minWidth: isMobile ? 'auto' : '350px',
          height: isMobile && (selectedEvent || selectedDate) ? '100vh' : 'auto',
          maxHeight: isMobile && (selectedEvent || selectedDate) ? '100vh' : 'calc(100vh - 140px)',
          backgroundColor: 'var(--bg-primary)',
          border: `1px solid var(--border-color)`,
          borderRadius: '8px',
          boxShadow: '0 4px 12px var(--shadow)',
          zIndex: isMobile && (selectedEvent || selectedDate) ? 999 : 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
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
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px'
              }}>
                {/* Empty State - No selection */}
                {!selectedEvent && !selectedDate && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '60px 20px',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)',
                    minHeight: '300px'
                  }}>
                    <div style={{
                      fontSize: '48px',
                      marginBottom: '16px',
                      opacity: 0.5
                    }}>
                      📅
                    </div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      marginBottom: '8px'
                    }}>
                      No Selection
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: 'var(--text-tertiary)'
                    }}>
                      Click on a day or event to view details
                    </div>
                  </div>
                )}

                {/* Day Selection - Show all events for the day */}
                {selectedDate && !selectedEvent && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{
                      padding: '16px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      border: `2px solid var(--border-color)`,
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
                              padding: '16px',
                              border: `1px solid var(--border-light)`,
                              borderRadius: '8px',
                              borderLeft: `4px solid ${getEventColor(event.event_type || event.eventType)}`,
                              backgroundColor: 'var(--bg-secondary)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                              e.currentTarget.style.borderColor = getEventColor(event.event_type || event.eventType)
                              e.currentTarget.style.transform = 'translateX(4px)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
                              e.currentTarget.style.borderColor = 'var(--border-light)'
                              e.currentTarget.style.transform = 'translateX(0)'
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
                                marginTop: '8px'
                              }}>
                                👤 {event.employee_name}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        padding: '40px',
                        textAlign: 'center',
                        color: 'var(--text-tertiary)',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: `1px solid var(--border-light)`
                      }}>
                        No events scheduled for this day
                      </div>
                    )}
                  </div>
                )}

                {/* Single Event Selection - Show detailed event info */}
                {selectedEvent && (
                  <div style={{
                    padding: '20px',
                    border: `1px solid var(--border-light)`,
                    borderRadius: '8px',
                    borderLeft: `4px solid ${getEventColor(selectedEvent.event_type || selectedEvent.eventType)}`,
                    backgroundColor: 'var(--bg-secondary)'
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
                          width: '100%'
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
                        📥 Download .ics
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
                          width: '100%'
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
                        📅 Add to Google Calendar
                      </button>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
      </div>

      {/* Event Creation Modal */}
      {showEventModal && isAdmin && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease'
          }}
          onClick={() => setShowEventModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              animation: 'slideInRight 0.3s ease'
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
                color: 'var(--text-primary)'
              }}>
                Create New Event
              </h2>
              <button
                onClick={() => setShowEventModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'var(--bg-tertiary)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-primary)'
                }}>
                  Event Date *
                </label>
                <input
                  type="date"
                  value={newEventDate || ''}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid var(--border-color)`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-primary)'
                }}>
                  Event Type *
                </label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid var(--border-color)`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="event">Event</option>
                  <option value="holiday">Holiday</option>
                  <option value="meeting">Meeting</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="shipment">Shipment</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-primary)'
                }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Enter event title"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid var(--border-color)`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--text-primary)'
                  }}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={newEvent.start_time || '00:00'}
                    defaultValue="00:00"
                    onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid var(--border-color)`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--text-primary)'
                  }}>
                    End Time
                  </label>
                  <input
                    type="time"
                    value={newEvent.end_time || '12:00'}
                    defaultValue="12:00"
                    onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid var(--border-color)`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-primary)'
                }}>
                  Description
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Enter event description (optional)"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid var(--border-color)`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Employee Selection */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-primary)'
                }}>
                  Event For
                </label>
                <div style={{
                  padding: '12px',
                  border: `1px solid var(--border-color)`,
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-secondary)'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: newEvent.forEveryone ? 0 : '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--text-primary)'
                  }}>
                    <input
                      type="radio"
                      checked={newEvent.forEveryone}
                      onChange={() => setNewEvent({ ...newEvent, forEveryone: true, selectedEmployees: [] })}
                      style={{
                        cursor: 'pointer',
                        accentColor: themeColor
                      }}
                    />
                    <span>Everyone</span>
                  </label>
                  
                  {!newEvent.forEveryone && (
                    <div style={{
                      marginTop: '12px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: `1px solid var(--border-light)`,
                      borderRadius: '4px',
                      padding: '8px'
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
                    color: 'var(--text-primary)'
                  }}>
                    <input
                      type="radio"
                      checked={!newEvent.forEveryone}
                      onChange={() => setNewEvent({ ...newEvent, forEveryone: false, selectedEmployees: [] })}
                      style={{
                        cursor: 'pointer',
                        accentColor: themeColor
                      }}
                    />
                    <span>Specific Employees</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={handleCreateEvent}
                  disabled={
                    creatingEvent || 
                    !newEvent.title.trim() || 
                    !newEventDate ||
                    (!newEvent.forEveryone && newEvent.selectedEmployees.length === 0)
                  }
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: (
                      creatingEvent || 
                      !newEvent.title.trim() || 
                      !newEventDate ||
                      (!newEvent.forEveryone && newEvent.selectedEmployees.length === 0)
                    ) ? 'var(--bg-tertiary)' : themeColor,
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: (
                      creatingEvent || 
                      !newEvent.title.trim() || 
                      !newEventDate ||
                      (!newEvent.forEveryone && newEvent.selectedEmployees.length === 0)
                    ) ? 'not-allowed' : 'pointer',
                    opacity: (
                      creatingEvent || 
                      !newEvent.title.trim() || 
                      !newEventDate ||
                      (!newEvent.forEveryone && newEvent.selectedEmployees.length === 0)
                    ) ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {creatingEvent ? 'Creating...' : 'Create Event'}
                </button>
                <button
                  onClick={() => setShowEventModal(false)}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: `1px solid var(--border-color)`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = 'var(--bg-secondary)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'var(--bg-tertiary)'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
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
      `}</style>
    </div>
  )
}

export default Calendar
