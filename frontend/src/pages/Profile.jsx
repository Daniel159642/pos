import { useState, useEffect } from 'react'
import { usePermissions } from '../contexts/PermissionContext'
import AdminDashboard from '../components/AdminDashboard'

function Profile({ employeeId, employeeName }) {
  const { hasPermission } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [weekSchedules, setWeekSchedules] = useState([])
  const [hoursStats, setHoursStats] = useState({ thisWeek: 0, thisMonth: 0 })
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

  useEffect(() => {
    if (employeeId) {
      loadProfileData()
    }
  }, [employeeId])

  const loadProfileData = async () => {
    setLoading(true)
    try {
      const today = new Date()
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)
      
      const startDate = startOfWeek.toISOString().split('T')[0]
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      const endDate = endOfMonth.toISOString().split('T')[0]

      // Get schedules for the month
      const scheduleRes = await fetch(`/api/employee_schedule?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`)
      const scheduleData = await scheduleRes.json()
      const allSchedules = scheduleData.data || []

      // Get this week's schedules
      const weekScheds = allSchedules
        .filter(s => {
          const sDate = new Date(s.schedule_date)
          return sDate >= startOfWeek && sDate <= endOfWeek
        })
        .sort((a, b) => new Date(a.schedule_date) - new Date(b.schedule_date))
      setWeekSchedules(weekScheds)

      // Calculate hours
      const thisWeekHours = allSchedules
        .filter(s => {
          const sDate = new Date(s.schedule_date)
          return sDate >= startOfWeek && sDate <= endOfWeek && s.hours_worked
        })
        .reduce((sum, s) => sum + (s.hours_worked || 0), 0)
      
      const thisMonthHours = allSchedules
        .filter(s => {
          const sDate = new Date(s.schedule_date)
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

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999', fontFamily: '"Product Sans", sans-serif' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ 
      padding: '24px', 
      backgroundColor: 'white', 
      minHeight: 'calc(100vh - 200px)',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Hours Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
        marginBottom: '16px'
      }}>
        <div style={{
          border: '3px solid black',
          borderRadius: '0',
          padding: '24px',
          backgroundColor: 'white'
        }}>
          <div style={{ 
            fontSize: '14px', 
            color: '#666', 
            marginBottom: '8px',
            fontFamily: '"Product Sans", sans-serif'
          }}>
            This Week
          </div>
          <div style={{ 
            fontSize: '48px', 
            fontWeight: 600,
            fontFamily: '"Product Sans", sans-serif'
          }}>
            {hoursStats.thisWeek.toFixed(1)}h
          </div>
        </div>

        <div style={{
          border: '3px solid black',
          borderRadius: '0',
          padding: '24px',
          backgroundColor: 'white'
        }}>
          <div style={{ 
            fontSize: '14px', 
            color: '#666', 
            marginBottom: '8px',
            fontFamily: '"Product Sans", sans-serif'
          }}>
            This Month
          </div>
          <div style={{ 
            fontSize: '48px', 
            fontWeight: 600,
            fontFamily: '"Product Sans", sans-serif'
          }}>
            {hoursStats.thisMonth.toFixed(1)}h
          </div>
        </div>
      </div>

      {/* Weekly Schedule */}
      <div style={{
        border: '3px solid black',
        borderRadius: '0',
        padding: '24px',
        backgroundColor: 'white',
        marginBottom: '32px',
        marginTop: '0'
      }}>
        <h2 style={{ 
          margin: '0 0 24px 0', 
          fontSize: '20px', 
          fontWeight: 600,
          fontFamily: '"Product Sans", sans-serif'
        }}>
          This Week's Schedule
        </h2>
        {weekSchedules.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {weekSchedules.map((schedule) => (
              <div 
                key={schedule.schedule_id} 
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '0',
                  fontFamily: '"Product Sans", sans-serif'
                }}
              >
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>
                    {getDayName(schedule.schedule_date)}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {formatDate(schedule.schedule_date)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 500 }}>
                    {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                  </div>
                  {schedule.hours_worked && (
                    <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                      {schedule.hours_worked.toFixed(1)}h worked
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            color: '#999', 
            fontSize: '14px', 
            textAlign: 'center', 
            padding: '40px',
            fontFamily: '"Product Sans", sans-serif'
          }}>
            No schedules for this week
          </div>
        )}
      </div>

      {/* Availability Section */}
      <div style={{
        border: '3px solid black',
        borderRadius: '0',
        padding: '24px',
        backgroundColor: 'white',
        marginBottom: '32px'
      }}>
        <h2 style={{ 
          margin: '0 0 24px 0', 
          fontSize: '20px', 
          fontWeight: 600,
          fontFamily: '"Product Sans", sans-serif'
        }}>
          Availability
        </h2>

        {/* Weekly Availability */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            fontFamily: '"Product Sans", sans-serif'
          }}>
            <div style={{ 
              fontSize: '14px', 
              color: '#666',
              fontFamily: '"Product Sans", sans-serif'
            }}>
              Weekly Availability
            </div>
            <button
              onClick={() => setEditingAvailability(!editingAvailability)}
              style={{
                padding: '6px 12px',
                backgroundColor: editingAvailability ? 'black' : 'white',
                color: editingAvailability ? 'white' : 'black',
                border: '1px solid #000',
                borderRadius: '0',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: '"Product Sans", sans-serif'
              }}
            >
              {editingAvailability ? 'Cancel' : 'Edit'}
            </button>
          </div>
          
          {!editingAvailability ? (
            <div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)',
                border: '1px solid #e0e0e0',
                borderRadius: '0',
                fontFamily: '"Product Sans", sans-serif'
              }}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <div 
                    key={day}
                    style={{
                      padding: '12px',
                      borderRight: day !== 'sunday' ? '1px solid #e0e0e0' : 'none',
                      textAlign: 'center',
                      fontSize: '14px',
                      fontWeight: 500,
                      textTransform: 'capitalize'
                    }}
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)',
                border: '1px solid #e0e0e0',
                borderTop: 'none',
                borderRadius: '0',
                fontFamily: '"Product Sans", sans-serif'
              }}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <div 
                    key={day}
                    style={{
                      padding: '12px',
                      borderRight: day !== 'sunday' ? '1px solid #e0e0e0' : 'none',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: availability[day]?.available ? '#000' : '#999',
                      whiteSpace: 'nowrap'
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
              padding: '16px',
              border: '1px solid #e0e0e0',
              borderRadius: '0',
              backgroundColor: '#fafafa',
              fontFamily: '"Product Sans", sans-serif'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, textTransform: 'capitalize', marginBottom: '4px' }}>
                      {day}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={availability[day]?.available || false}
                        onChange={(e) => handleAvailabilityChange(day, 'available', e.target.checked)}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px' }}>Available</span>
                    </label>
                    {availability[day]?.available && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '26px' }}>
                        <label style={{ fontSize: '14px' }}>From:</label>
                        <input
                          type="time"
                          value={availability[day]?.start || '09:00'}
                          onChange={(e) => handleAvailabilityChange(day, 'start', e.target.value)}
                          style={{
                            padding: '6px 8px',
                            border: '1px solid #000',
                            borderRadius: '0',
                            fontSize: '14px',
                            fontFamily: '"Product Sans", sans-serif'
                          }}
                        />
                        <label style={{ fontSize: '14px', marginLeft: '12px' }}>To:</label>
                        <input
                          type="time"
                          value={availability[day]?.end || '17:00'}
                          onChange={(e) => handleAvailabilityChange(day, 'end', e.target.value)}
                          style={{
                            padding: '6px 8px',
                            border: '1px solid #000',
                            borderRadius: '0',
                            fontSize: '14px',
                            fontFamily: '"Product Sans", sans-serif'
                          }}
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
                    padding: '10px 20px',
                    backgroundColor: 'black',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontFamily: '"Product Sans", sans-serif',
                    alignSelf: 'flex-start'
                  }}
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
            marginBottom: '16px'
          }}>
            <div style={{ 
              fontSize: '14px', 
              color: '#666',
              fontFamily: '"Product Sans", sans-serif'
            }}>
              Days I Can't Work
            </div>
            <button
              onClick={() => setShowAddDate(!showAddDate)}
              style={{
                padding: '8px 16px',
                backgroundColor: 'black',
                color: 'white',
                border: 'none',
                borderRadius: '0',
                cursor: 'pointer',
                fontSize: '14px',
                fontFamily: '"Product Sans", sans-serif'
              }}
            >
              + Add Date
            </button>
          </div>

          {showAddDate && (
            <div style={{
              padding: '16px',
              border: '1px solid #e0e0e0',
              borderRadius: '0',
              marginBottom: '16px',
              fontFamily: '"Product Sans", sans-serif'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>Start Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #000',
                      borderRadius: '0',
                      fontSize: '14px',
                      fontFamily: '"Product Sans", sans-serif'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>End Date (optional - leave blank for single day)</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    min={newDate}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #000',
                      borderRadius: '0',
                      fontSize: '14px',
                      fontFamily: '"Product Sans", sans-serif'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={allDay}
                      onChange={(e) => setAllDay(e.target.checked)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '14px' }}>All day</span>
                  </label>
                </div>
                {!allDay && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>Can't work from:</label>
                      <input
                        type="time"
                        value={unavailableStartTime}
                        onChange={(e) => setUnavailableStartTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #000',
                          borderRadius: '0',
                          fontSize: '14px',
                          fontFamily: '"Product Sans", sans-serif'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>Can't work until:</label>
                      <input
                        type="time"
                        value={unavailableEndTime}
                        onChange={(e) => setUnavailableEndTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid #000',
                          borderRadius: '0',
                          fontSize: '14px',
                          fontFamily: '"Product Sans", sans-serif'
                        }}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>Note (optional)</label>
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="e.g., Vacation, Doctor appointment"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #000',
                      borderRadius: '0',
                      fontSize: '14px',
                      fontFamily: '"Product Sans", sans-serif'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleAddUnavailableDate}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'black',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontFamily: '"Product Sans", sans-serif'
                    }}
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
                      padding: '8px 16px',
                      backgroundColor: 'white',
                      color: 'black',
                      border: '1px solid #000',
                      borderRadius: '0',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontFamily: '"Product Sans", sans-serif'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {unavailableDates.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {unavailableDates.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '0',
                    fontFamily: '"Product Sans", sans-serif'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>
                      {new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    {!item.allDay && item.startTime && item.endTime && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                        Can't work: {item.startTime} - {item.endTime}
                      </div>
                    )}
                    {item.note && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                        {item.note}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveUnavailableDate(index)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'white',
                      color: 'black',
                      border: '1px solid #000',
                      borderRadius: '0',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontFamily: '"Product Sans", sans-serif'
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              color: '#999', 
              fontSize: '14px', 
              textAlign: 'center', 
              padding: '20px',
              fontFamily: '"Product Sans", sans-serif'
            }}>
              No unavailable dates added
            </div>
          )}
        </div>
      </div>

      {/* Admin Dashboard Section - Only shown if user has admin permissions */}
      {(hasPermission('manage_permissions') || hasPermission('add_employee')) && (
        <div style={{ marginTop: '32px' }}>
          <AdminDashboard />
        </div>
      )}
    </div>
  )
}

export default Profile
