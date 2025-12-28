import { useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

function Calendar() {
  const calendarRef = useRef(null)
  const [events, setEvents] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventFilters, setEventFilters] = useState({
    holiday: true,
    event: true,
    meeting: true,
    shipment: true,
    schedule: true,
    maintenance: true
  })

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
    const colors = {
      'holiday': '#F44336',
      'event': '#4CAF50',
      'meeting': '#FF9800',
      'shipment': '#9C27B0',
      'schedule': '#2196F3',
      'maintenance': '#607D8B',
      'other': '#9E9E9E'
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
          backgroundColor: '#2196F3',
          borderColor: '#2196F3',
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
  }

  const handleDateClick = (dateClickInfo) => {
    // Optional: handle date clicks
    console.log('Date clicked:', dateClickInfo.dateStr)
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
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        Loading calendar...
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', backgroundColor: 'white', minHeight: 'calc(100vh - 200px)', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Event Filters */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '16px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '4px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center'
      }}>
        <span style={{ fontWeight: 600, marginRight: '8px' }}>Filter Events:</span>
        {['holiday', 'event', 'meeting', 'shipment', 'schedule', 'maintenance'].map(type => (
          <label 
            key={type}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            <input
              type="checkbox"
              checked={eventFilters[type]}
              onChange={() => toggleEventFilter(type)}
              style={{ 
                cursor: 'pointer', 
                width: '16px', 
                height: '16px'
              }}
            />
            <span style={{ textTransform: 'capitalize' }}>{type}</span>
          </label>
        ))}
      </div>

      {/* FullCalendar */}
      <div style={{ marginBottom: '20px' }}>
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
          height="auto"
          editable={false}
          selectable={false}
          dayMaxEvents={true}
          moreLinkClick="popover"
        />
      </div>

      {/* Selected Event Details */}
      {selectedEvent && (
        <div style={{
          border: '3px solid black',
          borderRadius: '0',
          padding: '24px',
          marginTop: '20px',
          backgroundColor: 'white'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '20px',
              fontWeight: 600
            }}>
              {selectedEvent.title || selectedEvent.event_type}
            </h3>
            <button
              onClick={() => setSelectedEvent(null)}
              style={{
                padding: '6px 12px',
                backgroundColor: 'white',
                color: 'black',
                border: '1px solid #000',
                borderRadius: '0',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Close
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              padding: '16px',
              border: '1px solid #e0e0e0',
              borderRadius: '0',
              borderLeft: `4px solid ${getEventColor(selectedEvent.event_type || selectedEvent.eventType)}`
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'start',
                marginBottom: '8px'
              }}>
                <div>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 500, 
                    marginBottom: '4px',
                    textTransform: 'capitalize'
                  }}>
                    {selectedEvent.title || selectedEvent.event_type}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#666',
                    textTransform: 'capitalize'
                  }}>
                    {selectedEvent.eventType || selectedEvent.type}
                    {selectedEvent.start_time && ` • ${formatTime(selectedEvent.start_time)}`}
                    {selectedEvent.end_time && ` - ${formatTime(selectedEvent.end_time)}`}
                  </div>
                  {selectedEvent.event_date && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Date: {new Date(selectedEvent.event_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div style={{
                  padding: '4px 8px',
                  backgroundColor: getEventColor(selectedEvent.event_type || selectedEvent.eventType),
                  color: 'white',
                  fontSize: '11px',
                  borderRadius: '0',
                  textTransform: 'capitalize'
                }}>
                  {selectedEvent.eventType || selectedEvent.type}
                </div>
              </div>
              {selectedEvent.description && (
                <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
                  {selectedEvent.description}
                </div>
              )}
              {selectedEvent.employee_name && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Employee: {selectedEvent.employee_name}
                </div>
              )}
              {selectedEvent.location && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Location: {selectedEvent.location}
                </div>
              )}
              
              {/* Action Buttons */}
              {selectedEvent.event_id && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    onClick={() => downloadEvent(selectedEvent)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    📥 Download .ics
                  </button>
                  <button
                    onClick={() => addToCalendar(selectedEvent)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#f0f0f0',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    📅 Add to Google Calendar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Calendar
