import { useState, useEffect } from 'react'
import { usePermissions } from '../contexts/PermissionContext'
import AdminDashboard from '../components/AdminDashboard'

function Profile({ employeeId, employeeName }) {
  const { hasPermission } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState([])
  const [hoursStats, setHoursStats] = useState({ total: 0, thisWeek: 0, thisMonth: 0 })
  const [availability, setAvailability] = useState({})
  const [upcomingSchedules, setUpcomingSchedules] = useState([])
  const [pendingConfirmations, setPendingConfirmations] = useState([])

  useEffect(() => {
    if (employeeId) {
      loadProfileData()
    }
  }, [employeeId])

  const loadProfileData = async () => {
    setLoading(true)
    try {
      // Load schedules
      const today = new Date()
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      
      const startDate = startOfWeek.toISOString().split('T')[0]
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

      // Get schedules
      const scheduleRes = await fetch(`/api/employee_schedule?employee_id=${employeeId}&start_date=${startDate}&end_date=${endDate}`)
      const scheduleData = await scheduleRes.json()
      const allSchedules = scheduleData.data || []
      setSchedules(allSchedules)

      // Calculate hours
      const totalHours = allSchedules
        .filter(s => s.hours_worked)
        .reduce((sum, s) => sum + (s.hours_worked || 0), 0)
      
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

      setHoursStats({ total: totalHours, thisWeek: thisWeekHours, thisMonth: thisMonthHours })

      // Get upcoming schedules (next 7 days)
      const upcoming = allSchedules
        .filter(s => {
          const sDate = new Date(s.schedule_date)
          return sDate >= today && s.status === 'scheduled'
        })
        .sort((a, b) => new Date(a.schedule_date) - new Date(b.schedule_date))
        .slice(0, 5)
      setUpcomingSchedules(upcoming)

      // Get pending confirmations (schedules that need confirmation)
      const pending = allSchedules
        .filter(s => {
          const sDate = new Date(s.schedule_date)
          return sDate >= today && s.status === 'scheduled' && (!s.confirmed || s.confirmed === 0)
        })
        .sort((a, b) => new Date(a.schedule_date) - new Date(b.schedule_date))
      setPendingConfirmations(pending)

      // Load availability
      const availRes = await fetch(`/api/employee_availability?employee_id=${employeeId}`)
      if (availRes.ok) {
        const availData = await availRes.json()
        setAvailability(availData.data || {})
      }
    } catch (err) {
      console.error('Error loading profile data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmSchedule = async (scheduleId) => {
    try {
      const response = await fetch(`/api/employee_schedule/${scheduleId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      if (data.success) {
        loadProfileData()
      } else {
        alert(data.message || 'Failed to confirm schedule')
      }
    } catch (err) {
      console.error('Error confirming schedule:', err)
      alert('Failed to confirm schedule')
    }
  }

  const handleSaveAvailability = async (availabilityData) => {
    try {
      const response = await fetch('/api/employee_availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          ...availabilityData
        })
      })
      const data = await response.json()
      if (data.success) {
        setAvailability(data.data || {})
        alert('Availability saved successfully')
      } else {
        alert(data.message || 'Failed to save availability')
      }
    } catch (err) {
      console.error('Error saving availability:', err)
      alert('Failed to save availability')
    }
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

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        Loading profile...
      </div>
    )
  }

  return (
    <div style={{ 
      padding: '24px', 
      backgroundColor: '#f5f5f5', 
      minHeight: 'calc(100vh - 200px)',
      maxWidth: '100%',
      overflowX: 'hidden'
    }}>
      <h1 style={{ marginBottom: '24px', fontSize: '28px', fontWeight: 600 }}>
        My Profile
      </h1>

      {/* Bento Box Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
        gap: '16px',
        gridAutoRows: 'minmax(200px, auto)',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Hours Summary - Large Card */}
        <BentoCard style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 500, opacity: 0.9 }}>Total Hours</h3>
              <div style={{ fontSize: '48px', fontWeight: 700, lineHeight: 1 }}>
                {hoursStats.total.toFixed(1)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>This Week</div>
                <div style={{ fontSize: '20px', fontWeight: 600 }}>{hoursStats.thisWeek.toFixed(1)}h</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>This Month</div>
                <div style={{ fontSize: '20px', fontWeight: 600 }}>{hoursStats.thisMonth.toFixed(1)}h</div>
              </div>
            </div>
          </div>
        </BentoCard>

        {/* Pending Confirmations - Medium Card */}
        <BentoCard>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Pending Confirmations</h3>
          {pendingConfirmations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '100%', overflowY: 'auto' }}>
              {pendingConfirmations.slice(0, 3).map((schedule) => (
                <div key={schedule.schedule_id} style={{
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                    {formatDate(schedule.schedule_date)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                  </div>
                  <button
                    onClick={() => handleConfirmSchedule(schedule.schedule_id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#000',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    Confirm
                  </button>
                </div>
              ))}
              {pendingConfirmations.length > 3 && (
                <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
                  +{pendingConfirmations.length - 3} more
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
              No pending confirmations
            </div>
          )}
        </BentoCard>

        {/* Upcoming Schedule - Medium Card */}
        <BentoCard>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Upcoming Schedule</h3>
          {upcomingSchedules.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '100%', overflowY: 'auto' }}>
              {upcomingSchedules.map((schedule) => (
                <div key={schedule.schedule_id} style={{
                  padding: '10px',
                  backgroundColor: '#e3f2fd',
                  borderRadius: '6px',
                  fontSize: '13px'
                }}>
                  <div style={{ fontWeight: 500, marginBottom: '2px' }}>
                    {formatDate(schedule.schedule_date)}
                  </div>
                  <div style={{ color: '#666', fontSize: '12px' }}>
                    {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
              No upcoming schedules
            </div>
          )}
        </BentoCard>

        {/* Availability Input - Large Card */}
        <BentoCard style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>My Availability</h3>
          <AvailabilityInput 
            availability={availability} 
            onSave={handleSaveAvailability}
          />
        </BentoCard>

        {/* Recent Hours - Medium Card */}
        <BentoCard>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Recent Hours</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '100%', overflowY: 'auto' }}>
            {schedules
              .filter(s => s.hours_worked)
              .sort((a, b) => new Date(b.schedule_date) - new Date(a.schedule_date))
              .slice(0, 5)
              .map((schedule) => (
                <div key={schedule.schedule_id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{formatDate(schedule.schedule_date)}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>
                      {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, color: '#667eea' }}>
                    {schedule.hours_worked?.toFixed(1)}h
                  </div>
                </div>
              ))}
            {schedules.filter(s => s.hours_worked).length === 0 && (
              <div style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                No hours recorded yet
              </div>
            )}
          </div>
        </BentoCard>
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

function BentoCard({ children, span = 4, style = {} }) {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      border: '1px solid #e9ecef',
      minWidth: 0,
      maxWidth: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box',
      ...style
    }}>
      {children}
    </div>
  )
}

function AvailabilityInput({ availability, onSave }) {
  const [formData, setFormData] = useState({
    monday: { available: true, start: '09:00', end: '17:00' },
    tuesday: { available: true, start: '09:00', end: '17:00' },
    wednesday: { available: true, start: '09:00', end: '17:00' },
    thursday: { available: true, start: '09:00', end: '17:00' },
    friday: { available: true, start: '09:00', end: '17:00' },
    saturday: { available: false, start: '09:00', end: '17:00' },
    sunday: { available: false, start: '09:00', end: '17:00' }
  })

  useEffect(() => {
    if (availability && Object.keys(availability).length > 0) {
      setFormData(prev => ({ ...prev, ...availability }))
    }
  }, [availability])

  const handleChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }))
  }

  const handleSave = () => {
    onSave(formData)
  }

  const days = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
  ]

  return (
    <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gap: '12px', width: '100%' }}>
        {days.map((day) => (
          <div key={day.key} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px',
            flexWrap: 'wrap',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ minWidth: '80px', fontSize: '14px', fontWeight: 500, flexShrink: 0 }}>
              {day.label}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={formData[day.key].available}
                onChange={(e) => handleChange(day.key, 'available', e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px' }}>Available</span>
            </label>
            {formData[day.key].available && (
              <>
                <input
                  type="time"
                  value={formData[day.key].start}
                  onChange={(e) => handleChange(day.key, 'start', e.target.value)}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '13px',
                    flexShrink: 0
                  }}
                />
                <span style={{ fontSize: '13px', color: '#666', flexShrink: 0 }}>to</span>
                <input
                  type="time"
                  value={formData[day.key].end}
                  onChange={(e) => handleChange(day.key, 'end', e.target.value)}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '13px',
                    flexShrink: 0
                  }}
                />
              </>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        style={{
          marginTop: '16px',
          padding: '10px 20px',
          backgroundColor: '#000',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 500
        }}
      >
        Save Availability
      </button>
    </div>
  )
}

export default Profile

