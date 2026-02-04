import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Clock,
  Calendar as CalendarIcon,
  CalendarClock,
  Truck,
  FileText,
  LayoutGrid,
  Settings as SettingsIcon,
  BarChart3,
  LogOut,
  ChevronRight,
  ShoppingCart,
  ClipboardList,
  Package,
  Plus
} from 'lucide-react'
import api from '../services/api'
import './Profile.css'

export default function Profile() {
  const navigate = useNavigate()
  const [clockStatus, setClockStatus] = useState(null)
  const [clockLoading, setClockLoading] = useState(false)
  const [clockActionLoading, setClockActionLoading] = useState(false)
  const [clockMessage, setClockMessage] = useState(null)
  const [hoursWeek, setHoursWeek] = useState(0)
  const [hoursMonth, setHoursMonth] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadClockStatus()
  }, [])

  useEffect(() => {
    loadHours()
  }, [])

  const loadClockStatus = async () => {
    setClockLoading(true)
    try {
      const res = await api.get('clock/status')
      const data = res.data
      if (data?.success) {
        setClockStatus({
          clocked_in: data.clocked_in === true,
          clock_in_time: data.clock_in_time,
          schedule_id: data.schedule_id
        })
      } else {
        setClockStatus({ clocked_in: false })
      }
    } catch {
      setClockStatus({ clocked_in: false })
    } finally {
      setClockLoading(false)
    }
  }

  const loadHours = async () => {
    setLoading(true)
    try {
      const today = new Date()
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)
      const startMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      const startWeekStr = startOfWeek.toISOString().slice(0, 10)
      const endWeekStr = endOfWeek.toISOString().slice(0, 10)
      const startMonthStr = startMonth.toISOString().slice(0, 10)
      const endMonthStr = endMonth.toISOString().slice(0, 10)
      const schedRes = await api.get(`employee_schedule?start_date=${startWeekStr}&end_date=${endMonthStr}`)
      const schedData = schedRes.data?.data || schedRes.data || []
      const weekHours = (schedData || [])
        .filter((s) => {
          const d = s.schedule_date || s.shift_date
          return d && d >= startWeekStr && d <= endWeekStr && (s.hours_worked != null)
        })
        .reduce((sum, s) => sum + (parseFloat(s.hours_worked) || 0), 0)
      const monthHours = (schedData || [])
        .filter((s) => {
          const d = s.schedule_date || s.shift_date
          return d && d >= startMonthStr && d <= endMonthStr && (s.hours_worked != null)
        })
        .reduce((sum, s) => sum + (parseFloat(s.hours_worked) || 0), 0)
      setHoursWeek(weekHours)
      setHoursMonth(monthHours)
    } catch {
      setHoursWeek(0)
      setHoursMonth(0)
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = async () => {
    setClockActionLoading(true)
    setClockMessage(null)
    try {
      const res = await api.post('clock/in', {})
      const data = res.data
      if (data?.success) {
        setClockStatus({ clocked_in: true, clock_in_time: data.clock_in_time, schedule_id: data.schedule_id })
        setClockMessage({ type: 'success', text: 'Clocked in' })
      } else {
        setClockMessage({ type: 'error', text: data?.message || 'Failed to clock in' })
      }
    } catch (err) {
      setClockMessage({ type: 'error', text: err.response?.data?.message || 'Failed to clock in' })
    } finally {
      setClockActionLoading(false)
      loadClockStatus()
      loadHours()
    }
  }

  const handleClockOut = async () => {
    setClockActionLoading(true)
    setClockMessage(null)
    try {
      const res = await api.post('clock/out', {})
      const data = res.data
      if (data?.success) {
        setClockStatus({ clocked_in: false })
        setClockMessage({ type: 'success', text: `Clocked out. Hours: ${(data.hours_worked ?? 0).toFixed(2)}` })
      } else {
        setClockMessage({ type: 'error', text: data?.message || 'Failed to clock out' })
      }
    } catch (err) {
      setClockMessage({ type: 'error', text: err.response?.data?.message || 'Failed to clock out' })
    } finally {
      setClockActionLoading(false)
      loadClockStatus()
      loadHours()
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('sessionToken')
    navigate('/')
  }

  const linkItems = [
    { to: '/shipment', label: 'Shipment', icon: Truck },
    { to: '/accounting', label: 'Accounting', icon: FileText },
    { to: '/tables', label: 'Tables', icon: LayoutGrid },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
    { to: '/statistics', label: 'Statistics', icon: BarChart3 }
  ]

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar">
          <User size={40} strokeWidth={2} />
        </div>
        <h1 className="profile-name">Profile</h1>
      </div>

      <section className="profile-section">
        <h2 className="profile-section-title">
          <Clock size={20} />
          Time Clock
        </h2>
        {clockLoading ? (
          <p className="profile-muted">Loading…</p>
        ) : (
          <>
            <p className="profile-clock-status">
              {clockStatus?.clocked_in
                ? `Clocked in since ${clockStatus.clock_in_time ? new Date(clockStatus.clock_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}`
                : 'Currently clocked out'}
            </p>
            {clockMessage && (
              <p className={`profile-message profile-message--${clockMessage.type}`}>{clockMessage.text}</p>
            )}
            <button
              type="button"
              className={`profile-clock-btn ${clockStatus?.clocked_in ? 'profile-clock-btn--out' : 'profile-clock-btn--in'}`}
              onClick={clockStatus?.clocked_in ? handleClockOut : handleClockIn}
              disabled={clockActionLoading}
            >
              {clockActionLoading ? 'Processing…' : clockStatus?.clocked_in ? 'Clock Out' : 'Clock In'}
            </button>
          </>
        )}
      </section>

      <section className="profile-section profile-hours">
        <div className="profile-hour-card">
          <span className="profile-hour-label">This Week</span>
          <span className="profile-hour-value">{loading ? '—' : `${hoursWeek.toFixed(1)}h`}</span>
        </div>
        <div className="profile-hour-card">
          <span className="profile-hour-label">This Month</span>
          <span className="profile-hour-value">{loading ? '—' : `${hoursMonth.toFixed(1)}h`}</span>
        </div>
      </section>

      <section className="profile-section">
        <h2 className="profile-section-title">Schedule</h2>
        <button type="button" className="profile-link-row" onClick={() => navigate('/calendar')}>
          <CalendarIcon size={20} />
          <span>View schedule</span>
          <ChevronRight size={20} />
        </button>
      </section>

      <section className="profile-section">
        <h2 className="profile-section-title">Availability</h2>
        <p className="profile-muted">Set your availability on the desktop app.</p>
      </section>

      <section className="profile-section">
        <h2 className="profile-section-title">Links</h2>
        <ul className="profile-links">
          {linkItems.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <button type="button" className="profile-link-row" onClick={() => navigate(to)}>
                <Icon size={20} />
                <span>{label}</span>
                <ChevronRight size={20} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="profile-section profile-logout-wrap">
        <button type="button" className="profile-logout-btn" onClick={handleLogout}>
          <LogOut size={20} />
          Logout
        </button>
      </section>

      <nav className="bottom-nav">
        <button type="button" className="nav-item nav-item--cart" aria-label="Cart" onClick={() => navigate('/checkout')}>
          <span className="nav-cart-circle">
            <ShoppingCart size={36} strokeWidth={2} />
          </span>
        </button>
        <button type="button" className="nav-item" aria-label="Orders" onClick={() => navigate('/orders')}>
          <ClipboardList size={36} strokeWidth={2} />
        </button>
        <button type="button" className="nav-item" aria-label="Calendar" onClick={() => navigate('/calendar')}>
          <CalendarIcon size={36} strokeWidth={2} />
        </button>
        <button type="button" className="nav-item" aria-label="Inventory" onClick={() => navigate('/inventory')}>
          <Package size={36} strokeWidth={2} />
        </button>
        <button type="button" className="nav-item" aria-label="Add">
          <Plus size={36} strokeWidth={2} />
        </button>
      </nav>
    </div>
  )
}
