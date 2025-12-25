import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function EventCard({ event, formatTime, getEventColor }) {
  const getSessionToken = () => {
    return localStorage.getItem('sessionToken')
  }

  const downloadEvent = async () => {
    // Only download if this is a Calendar_Events event (has event_id)
    if (!event.event_id) {
      alert('This event cannot be exported. Please use the calendar subscription feature.')
      return
    }
    
    try {
      const token = getSessionToken()
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

  const addToCalendar = () => {
    // Generate add to calendar URLs
    const eventDate = event.event_date || event.start_datetime
    const startTime = event.start_time || '09:00:00'
    
    try {
      const start = new Date(`${eventDate}T${startTime}`)
      const end = new Date(start.getTime() + (event.end_time ? 
        (new Date(`${eventDate}T${event.end_time}`).getTime() - start.getTime()) : 
        3600000)) // Default 1 hour
      
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

  return (
    <div
      style={{
        padding: '12px',
        border: '1px solid #eee',
        borderRadius: '4px',
        borderLeft: `4px solid ${getEventColor(event.event_type)}`
      }}
    >
      <div style={{ fontWeight: 500, marginBottom: '4px' }}>{event.title}</div>
      <div style={{ fontSize: '12px', color: '#666' }}>
        {new Date(event.event_date || event.start_datetime).toLocaleDateString()}
        {event.start_time && ` • ${formatTime(event.start_time)}`}
      </div>
      {event.description && (
        <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
          {event.description}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button
          onClick={downloadEvent}
          style={{
            padding: '4px 8px',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          📥 Download .ics
        </button>
        <button
          onClick={addToCalendar}
          style={{
            padding: '4px 8px',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          📅 Add to Google Calendar
        </button>
      </div>
    </div>
  )
}

function Calendar() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('month') // 'month', 'week', 'day'

  useEffect(() => {
    loadCalendarData()
  }, [currentDate, viewMode])

  const loadCalendarData = async () => {
    setLoading(true)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

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

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  const getEventsForDate = (date) => {
    if (!date) return []
    
    const dateStr = date.toISOString().split('T')[0]
    const allItems = []
    
    // Add calendar events
    events.forEach(event => {
      if (event.event_date === dateStr) {
        allItems.push({
          ...event,
          type: 'event',
          color: getEventColor(event.event_type)
        })
      }
    })
    
    // Add schedules
    schedules.forEach(schedule => {
      if (schedule.schedule_date === dateStr) {
        allItems.push({
          ...schedule,
          type: 'schedule',
          color: '#2196F3',
          title: `${schedule.employee_name || 'Employee'}: ${schedule.start_time || ''} - ${schedule.end_time || ''}`
        })
      }
    })
    
    return allItems
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

  const navigateMonth = (direction) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const days = getDaysInMonth(currentDate)
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        Loading calendar...
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: 'calc(100vh - 200px)' }}>
      {/* Calendar Header */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigateMonth(-1)}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ←
          </button>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 500 }}>
            {formatDate(currentDate)}
          </h2>
          <button
            onClick={() => navigateMonth(1)}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            →
          </button>
          <button
            onClick={goToToday}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#f0f0f0',
              cursor: 'pointer',
              fontSize: '14px',
              marginLeft: '8px'
            }}
          >
            Today
          </button>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setViewMode('month')}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: viewMode === 'month' ? '#000' : '#fff',
              color: viewMode === 'month' ? '#fff' : '#000',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Month
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Week Day Headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          backgroundColor: '#e0e0e0',
          border: '1px solid #e0e0e0',
          marginBottom: '1px'
        }}>
          {weekDays.map(day => (
            <div
              key={day}
              style={{
                padding: '12px',
                textAlign: 'center',
                fontWeight: 600,
                backgroundColor: '#f5f5f5',
                fontSize: '14px',
                color: '#666'
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          backgroundColor: '#e0e0e0',
          border: '1px solid #e0e0e0'
        }}>
          {days.map((date, index) => {
            const isToday = date && 
              date.toDateString() === new Date().toDateString()
            const dayEvents = getEventsForDate(date)
            
            return (
              <div
                key={index}
                style={{
                  minHeight: '120px',
                  padding: '8px',
                  backgroundColor: '#fff',
                  border: isToday ? '2px solid #000' : 'none',
                  position: 'relative'
                }}
              >
                {date && (
                  <>
                    <div style={{
                      fontWeight: isToday ? 600 : 400,
                      fontSize: '14px',
                      marginBottom: '4px',
                      color: isToday ? '#000' : '#333'
                    }}>
                      {date.getDate()}
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      maxHeight: '90px',
                      overflowY: 'auto'
                    }}>
                      {dayEvents.slice(0, 3).map((event, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: '10px',
                            padding: '2px 4px',
                            borderRadius: '2px',
                            backgroundColor: event.color || '#9E9E9E',
                            color: '#fff',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={event.title || event.event_type}
                        >
                          {event.title || event.event_type}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div style={{
                          fontSize: '10px',
                          color: '#666',
                          fontStyle: 'italic'
                        }}>
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        marginTop: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '16px' }}>Legend</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#F44336', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '14px' }}>Holiday</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#4CAF50', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '14px' }}>Event</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#FF9800', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '14px' }}>Meeting</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#9C27B0', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '14px' }}>Shipment</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#2196F3', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '14px' }}>Schedule</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#607D8B', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '14px' }}>Maintenance</span>
          </div>
        </div>
      </div>

      {/* Event Details Sidebar (could be expanded) */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        marginTop: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Upcoming Events</h3>
          <button
            onClick={() => navigate('/calendar-subscription')}
            style={{
              padding: '6px 12px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            📅 Subscribe to Calendar
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {events.slice(0, 5).map((event, idx) => (
            <EventCard
              key={idx}
              event={event}
              formatTime={formatTime}
              getEventColor={getEventColor}
            />
          ))}
          {events.length === 0 && (
            <div style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
              No upcoming events
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Calendar



