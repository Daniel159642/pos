import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  ClipboardList,
  Package,
  Plus,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  X,
  CalendarClock,
  FileText,
  Pencil,
  Link2
} from 'lucide-react'
import api from '../services/api'
import ProfileButton from '../components/ProfileButton'
import './Calendar.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EVENT_TYPES = ['holiday', 'event', 'meeting', 'shipment', 'schedule', 'maintenance']
const EVENT_COLORS = {
  schedule: 'var(--accent-blue)',
  shipment: '#0ea5e9',
  holiday: '#ef4444',
  event: 'var(--accent)',
  meeting: '#8b5cf6',
  maintenance: '#f59e0b',
  other: 'var(--text-muted)'
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const part = (timeStr + '').trim()
  const [h, m] = part.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${(m || '00').padStart(2, '0')} ${ampm}`
}

function toYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthStartEnd(date) {
  const y = date.getFullYear()
  const m = date.getMonth()
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)
  return { start: toYMD(start), end: toYMD(end) }
}

function getDaysInMonth(date) {
  const y = date.getFullYear()
  const m = date.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  const startPad = first.getDay()
  const days = []
  for (let i = 0; i < startPad; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d))
  return days
}

function getWeekDays(ymd) {
  const d = new Date(ymd + 'T12:00:00')
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const out = []
  for (let i = 0; i < 7; i++) {
    const x = new Date(start)
    x.setDate(start.getDate() + i)
    out.push(toYMD(x))
  }
  return out
}

export default function Calendar() {
  const navigate = useNavigate()
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => toYMD(new Date()))
  const [viewMode, setViewMode] = useState('month') // 'month' | 'week' | 'day'
  const [events, setEvents] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [eventFilters, setEventFilters] = useState({
    holiday: true,
    event: true,
    meeting: true,
    shipment: true,
    schedule: true,
    maintenance: true
  })
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false)
  const [showLinkDropdown, setShowLinkDropdown] = useState(false)
  const filterRef = useRef(null)
  const scheduleRef = useRef(null)
  const linkRef = useRef(null)

  const [showEventModal, setShowEventModal] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: '',
    event_type: 'event',
    description: '',
    start_time: '09:00',
    end_time: '17:00',
    forEveryone: true,
    selectedEmployees: []
  })
  const [newEventDate, setNewEventDate] = useState(() => toYMD(new Date()))
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [employees, setEmployees] = useState([])
  const [showEventDetail, setShowEventDetail] = useState(null)

  const [showScheduleCreate, setShowScheduleCreate] = useState(false)
  const [scheduleStart, setScheduleStart] = useState('')
  const [scheduleEnd, setScheduleEnd] = useState('')
  const [scheduleGenerating, setScheduleGenerating] = useState(false)
  const [showDraftsList, setShowDraftsList] = useState(false)
  const [draftList, setDraftList] = useState([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  const [showEditList, setShowEditList] = useState(false)
  const [editList, setEditList] = useState([])
  const [loadingEditList, setLoadingEditList] = useState(false)

  const [subscriptionUrls, setSubscriptionUrls] = useState(null)
  const [loadingSubscription, setLoadingSubscription] = useState(false)

  const { start, end } = getMonthStartEnd(viewDate)
  const days = getDaysInMonth(viewDate)
  const weekDays = getWeekDays(selectedDate)

  useEffect(() => {
    loadData()
  }, [start, end])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterDropdown(false)
      if (scheduleRef.current && !scheduleRef.current.contains(e.target)) setShowScheduleDropdown(false)
      if (linkRef.current && !linkRef.current.contains(e.target)) setShowLinkDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [eventsRes, schedRes] = await Promise.all([
        api.get(`master_calendar?start_date=${start}&end_date=${end}`),
        api.get(`employee_schedule?start_date=${start}&end_date=${end}`)
      ])
      const eventsData = eventsRes.data?.data || eventsRes.data || []
      const schedData = schedRes.data?.data || schedRes.data || []
      setEvents(Array.isArray(eventsData) ? eventsData : [])
      setSchedules(Array.isArray(schedData) ? schedData : [])
    } catch (e) {
      setError('Could not load calendar')
      setEvents([])
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const res = await api.get('employees')
      const data = res.data?.data || res.data || []
      setEmployees(Array.isArray(data) ? data.filter((e) => e.active !== 0) : [])
    } catch {
      setEmployees([])
    }
  }

  const prevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  const nextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))
  const prevWeek = () => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    setSelectedDate(toYMD(d))
    if (viewMode === 'month') setViewDate(d)
  }
  const nextWeek = () => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    setSelectedDate(toYMD(d))
    if (viewMode === 'month') setViewDate(d)
  }
  const goToday = () => {
    const today = new Date()
    setViewDate(today)
    setSelectedDate(toYMD(today))
  }

  const toggleFilter = (type) => {
    setEventFilters((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  const filteredEvents = events.filter((e) => eventFilters[e.event_type] !== false)
  const filteredSchedules = eventFilters.schedule ? schedules : []

  const dayEvents = filteredEvents.filter((e) => (e.event_date || e.start_datetime || '').toString().slice(0, 10) === selectedDate)
  const daySchedules = filteredSchedules.filter((s) => (s.schedule_date || '').toString().slice(0, 10) === selectedDate)

  const hasEventsOnDate = (ymd) =>
    filteredEvents.some((e) => (e.event_date || e.start_datetime || '').toString().slice(0, 10) === ymd) ||
    filteredSchedules.some((s) => (s.schedule_date || '').toString().slice(0, 10) === ymd)

  const openAddEvent = () => {
    setNewEventDate(selectedDate)
    setNewEvent({
      title: '',
      event_type: 'event',
      description: '',
      start_time: '09:00',
      end_time: '17:00',
      forEveryone: true,
      selectedEmployees: []
    })
    setShowEventModal(true)
    fetchEmployees()
  }

  const handleCreateEvent = async (e) => {
    e.preventDefault()
    if (!newEvent.title.trim()) return
    setCreatingEvent(true)
    try {
      const token = localStorage.getItem('sessionToken')
      await api.post('master_calendar', {
        session_token: token,
        event_date: newEventDate,
        event_type: newEvent.event_type,
        title: newEvent.title.trim(),
        description: newEvent.description || null,
        start_time: newEvent.start_time || null,
        end_time: newEvent.end_time || null,
        employee_ids: newEvent.forEveryone ? [] : newEvent.selectedEmployees
      })
      await loadData()
      setShowEventModal(false)
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create event')
    } finally {
      setCreatingEvent(false)
    }
  }

  const fetchDrafts = async () => {
    setShowScheduleDropdown(false)
    setLoadingDrafts(true)
    setShowDraftsList(true)
    setDraftList([])
    try {
      const res = await api.get('schedule/drafts')
      const data = res.data?.data || res.data || []
      setDraftList(Array.isArray(data) ? data : [])
    } catch {
      setDraftList([])
    } finally {
      setLoadingDrafts(false)
    }
  }

  const fetchPublished = async () => {
    setShowScheduleDropdown(false)
    setLoadingEditList(true)
    setShowEditList(true)
    setEditList([])
    try {
      const res = await api.get('schedule/published')
      const data = res.data?.data || res.data || []
      setEditList(Array.isArray(data) ? data : [])
    } catch {
      setEditList([])
    } finally {
      setLoadingEditList(false)
    }
  }

  const handleGenerateSchedule = async (e) => {
    e.preventDefault()
    if (!scheduleStart || !scheduleEnd) return
    setScheduleGenerating(true)
    try {
      await api.post('schedule/generate', {
        week_start_date: scheduleStart,
        settings: { week_end_date: scheduleEnd }
      })
      await loadData()
      setShowScheduleCreate(false)
      setScheduleStart('')
      setScheduleEnd('')
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate schedule')
    } finally {
      setScheduleGenerating(false)
    }
  }

  const openSubscriptionDropdown = async () => {
    setShowLinkDropdown(true)
    if (subscriptionUrls == null) {
      setLoadingSubscription(true)
      try {
        const res = await api.get('calendar/subscription/urls')
        setSubscriptionUrls(res.data?.data || res.data || {})
      } catch {
        setSubscriptionUrls({})
      } finally {
        setLoadingSubscription(false)
      }
    }
  }

  const googleCalendarUrl = (ev) => {
    const date = ev.event_date || ev.start_datetime || selectedDate
    const st = (ev.start_time || '09:00').toString().slice(0, 5).replace(':', '')
    const et = (ev.end_time || '17:00').toString().slice(0, 5).replace(':', '')
    const start = `${date.replace(/-/g, '')}T${st}00`
    const end = `${date.replace(/-/g, '')}T${et}00`
    const title = encodeURIComponent(ev.title || ev.event_type || 'Event')
    const details = encodeURIComponent(ev.description || '')
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`
  }

  const monthTitle = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <ProfileButton />
        <h1 className="calendar-title">Calendar</h1>
      </div>

      <div className="calendar-toolbar">
        <button type="button" className="calendar-nav-btn" onClick={viewMode === 'month' ? prevMonth : prevWeek} aria-label="Previous">
          <ChevronLeft size={24} />
        </button>
        <button type="button" className="calendar-month-label" onClick={goToday}>
          {viewMode === 'month' ? monthTitle : viewMode === 'week' ? `Week of ${weekDays[0]}` : selectedDate}
        </button>
        <button type="button" className="calendar-nav-btn" onClick={viewMode === 'month' ? nextMonth : nextWeek} aria-label="Next">
          <ChevronRight size={24} />
        </button>
      </div>

      <div className="calendar-buttons-row">
        <div ref={filterRef} className="calendar-dropdown-wrap">
          <button
            type="button"
            className={`calendar-action-btn ${showFilterDropdown ? 'calendar-action-btn--open' : ''}`}
            onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowScheduleDropdown(false); setShowLinkDropdown(false) }}
          >
            Filter
            <ChevronDown size={16} />
          </button>
          {showFilterDropdown && (
            <div className="calendar-dropdown">
              {EVENT_TYPES.map((type) => (
                <label key={type} className="calendar-dropdown-item">
                  <input type="checkbox" checked={eventFilters[type]} onChange={() => toggleFilter(type)} />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="calendar-action-btn" onClick={openAddEvent}>
          <Plus size={16} />
          Event
        </button>

        <div ref={scheduleRef} className="calendar-dropdown-wrap">
          <button
            type="button"
            className={`calendar-action-btn ${showScheduleDropdown ? 'calendar-action-btn--open' : ''}`}
            onClick={() => { setShowScheduleDropdown(!showScheduleDropdown); setShowFilterDropdown(false); setShowLinkDropdown(false) }}
          >
            <CalendarClock size={16} />
            Schedule
            <ChevronDown size={14} />
          </button>
          {showScheduleDropdown && (
            <div className="calendar-dropdown">
              <button type="button" className="calendar-dropdown-btn" onClick={() => { setShowScheduleCreate(true); setShowScheduleDropdown(false) }}>
                <Plus size={16} />
                Create
              </button>
              <button type="button" className="calendar-dropdown-btn" onClick={fetchDrafts}>
                <FileText size={16} />
                Drafts
              </button>
              <button type="button" className="calendar-dropdown-btn" onClick={fetchPublished}>
                <Pencil size={16} />
                Edit
              </button>
            </div>
          )}
        </div>

        <div className="calendar-view-toggle">
          <button type="button" className={`calendar-view-btn ${viewMode === 'month' ? 'calendar-view-btn--active' : ''}`} onClick={() => setViewMode('month')}>Month</button>
          <button type="button" className={`calendar-view-btn ${viewMode === 'week' ? 'calendar-view-btn--active' : ''}`} onClick={() => setViewMode('week')}>Week</button>
          <button type="button" className={`calendar-view-btn ${viewMode === 'day' ? 'calendar-view-btn--active' : ''}`} onClick={() => setViewMode('day')}>Day</button>
        </div>

        <div ref={linkRef} className="calendar-dropdown-wrap">
          <button
            type="button"
            className={`calendar-action-btn calendar-action-btn--icon ${showLinkDropdown ? 'calendar-action-btn--open' : ''}`}
            onClick={openSubscriptionDropdown}
            title="Subscribe"
          >
            <Link2 size={18} />
          </button>
          {showLinkDropdown && (
            <div className="calendar-dropdown calendar-dropdown--right">
              {loadingSubscription ? (
                <div className="calendar-dropdown-item">Loading…</div>
              ) : subscriptionUrls?.webcal_url ? (
                <>
                  <div className="calendar-dropdown-item calendar-dropdown-item--label">Subscribe in your calendar app:</div>
                  <button
                    type="button"
                    className="calendar-dropdown-btn"
                    onClick={() => {
                      navigator.clipboard?.writeText(subscriptionUrls.webcal_url || subscriptionUrls.ical_url || '')
                    }}
                  >
                    Copy link
                  </button>
                </>
              ) : (
                <div className="calendar-dropdown-item">Subscribe URL not available.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {viewMode === 'month' && (
        <>
          <div className="calendar-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w} className="calendar-weekday">{w}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} className="calendar-day calendar-day--empty" />
              const ymd = toYMD(d)
              const isSelected = ymd === selectedDate
              const isToday = ymd === toYMD(new Date())
              const hasEvents = hasEventsOnDate(ymd)
              return (
                <button
                  key={ymd}
                  type="button"
                  className={`calendar-day ${isSelected ? 'calendar-day--selected' : ''} ${isToday ? 'calendar-day--today' : ''} ${hasEvents ? 'calendar-day--has-events' : ''}`}
                  onClick={() => setSelectedDate(ymd)}
                >
                  <span className="calendar-day-num">{d.getDate()}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {viewMode === 'week' && (
        <div className="calendar-week-strip">
          {weekDays.map((ymd) => {
            const isSelected = ymd === selectedDate
            const isToday = ymd === toYMD(new Date())
            const d = new Date(ymd + 'T12:00:00')
            const hasEvents = hasEventsOnDate(ymd)
            return (
              <button
                key={ymd}
                type="button"
                className={`calendar-week-day ${isSelected ? 'calendar-week-day--selected' : ''} ${isToday ? 'calendar-week-day--today' : ''} ${hasEvents ? 'calendar-week-day--has-events' : ''}`}
                onClick={() => setSelectedDate(ymd)}
              >
                <span className="calendar-week-day-name">{WEEKDAYS[d.getDay()].slice(0, 2)}</span>
                <span className="calendar-week-day-num">{d.getDate()}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="calendar-day-title">
        {selectedDate === toYMD(new Date()) ? 'Today' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
      </div>

      {error && <div className="calendar-error">{error}</div>}

      <div className="calendar-list-wrap">
        {loading ? (
          <p className="calendar-muted">Loading…</p>
        ) : dayEvents.length === 0 && daySchedules.length === 0 ? (
          <p className="calendar-muted">No events this day.</p>
        ) : (
          <ul className="calendar-list">
            {daySchedules.map((s) => (
              <li
                key={`s-${s.schedule_id ?? s.id}`}
                className="calendar-event"
                style={{ borderLeftColor: EVENT_COLORS.schedule }}
                onClick={() => setShowEventDetail({ type: 'schedule', ...s })}
              >
                <Clock size={16} className="calendar-event-icon" />
                <div className="calendar-event-body">
                  <span className="calendar-event-title">{s.employee_name || 'Shift'}</span>
                  <span className="calendar-event-time">{formatTime(s.start_time)} – {formatTime(s.end_time)}</span>
                </div>
              </li>
            ))}
            {dayEvents.map((e) => (
              <li
                key={`e-${e.calendar_id ?? e.event_id ?? e.id}`}
                className="calendar-event"
                style={{ borderLeftColor: EVENT_COLORS[e.event_type] || EVENT_COLORS.other }}
                onClick={() => setShowEventDetail({ type: 'event', ...e })}
              >
                <CalendarIcon size={16} className="calendar-event-icon" />
                <div className="calendar-event-body">
                  <span className="calendar-event-title">{e.title || e.event_type}</span>
                  {(e.start_time || e.end_time) && (
                    <span className="calendar-event-time">{formatTime(e.start_time)} – {formatTime(e.end_time)}</span>
                  )}
                  {e.description && <span className="calendar-event-desc">{e.description}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add Event Modal */}
      {showEventModal && (
        <div className="calendar-modal-overlay" onClick={() => setShowEventModal(false)}>
          <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h2 className="calendar-modal-title">Add Event</h2>
              <button type="button" className="calendar-modal-close" onClick={() => setShowEventModal(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateEvent} className="calendar-form">
              <label className="calendar-form-label">Date</label>
              <input type="date" className="calendar-form-input" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} required />
              <label className="calendar-form-label">Title *</label>
              <input type="text" className="calendar-form-input" value={newEvent.title} onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))} required />
              <label className="calendar-form-label">Type</label>
              <select className="calendar-form-input" value={newEvent.event_type} onChange={(e) => setNewEvent((p) => ({ ...p, event_type: e.target.value }))}>
                {EVENT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
              <label className="calendar-form-label">Description</label>
              <textarea className="calendar-form-input calendar-form-textarea" value={newEvent.description} onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))} rows={2} />
              <div className="calendar-form-row">
                <div className="calendar-form-group">
                  <label className="calendar-form-label">Start</label>
                  <input type="time" className="calendar-form-input" value={newEvent.start_time} onChange={(e) => setNewEvent((p) => ({ ...p, start_time: e.target.value }))} />
                </div>
                <div className="calendar-form-group">
                  <label className="calendar-form-label">End</label>
                  <input type="time" className="calendar-form-input" value={newEvent.end_time} onChange={(e) => setNewEvent((p) => ({ ...p, end_time: e.target.value }))} />
                </div>
              </div>
              <label className="calendar-form-label">
                <input type="checkbox" checked={newEvent.forEveryone} onChange={(e) => setNewEvent((p) => ({ ...p, forEveryone: e.target.checked }))} />
                For everyone
              </label>
              {!newEvent.forEveryone && (
                <>
                  <div className="calendar-form-label">Assign to</div>
                  {employees.slice(0, 20).map((emp) => (
                    <label key={emp.employee_id} className="calendar-form-label calendar-form-label--inline">
                      <input
                        type="checkbox"
                        checked={newEvent.selectedEmployees.includes(emp.employee_id)}
                        onChange={(e) => {
                          if (e.target.checked) setNewEvent((p) => ({ ...p, selectedEmployees: [...p.selectedEmployees, emp.employee_id] }))
                          else setNewEvent((p) => ({ ...p, selectedEmployees: p.selectedEmployees.filter((id) => id !== emp.employee_id) }))
                        }}
                      />
                      {emp.first_name} {emp.last_name}
                    </label>
                  ))}
                </>
              )}
              <div className="calendar-form-actions">
                <button type="button" className="calendar-btn calendar-btn--secondary" onClick={() => setShowEventModal(false)}>Cancel</button>
                <button type="submit" className="calendar-btn calendar-btn--primary" disabled={creatingEvent}>{creatingEvent ? 'Creating…' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {showEventDetail && (
        <div className="calendar-modal-overlay" onClick={() => setShowEventDetail(null)}>
          <div className="calendar-modal calendar-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h2 className="calendar-modal-title">{showEventDetail.type === 'schedule' ? 'Shift' : (showEventDetail.title || showEventDetail.event_type)}</h2>
              <button type="button" className="calendar-modal-close" onClick={() => setShowEventDetail(null)}><X size={24} /></button>
            </div>
            <div className="calendar-event-detail">
              {showEventDetail.type === 'schedule' && (
                <>
                  <p><strong>{showEventDetail.employee_name || 'Shift'}</strong></p>
                  <p className="calendar-event-detail-time">{formatTime(showEventDetail.start_time)} – {formatTime(showEventDetail.end_time)}</p>
                </>
              )}
              {showEventDetail.type === 'event' && (
                <>
                  <p><strong>{showEventDetail.title || showEventDetail.event_type}</strong></p>
                  <p className="calendar-event-detail-type">{showEventDetail.event_type}</p>
                  {(showEventDetail.start_time || showEventDetail.end_time) && (
                    <p className="calendar-event-detail-time">{formatTime(showEventDetail.start_time)} – {formatTime(showEventDetail.end_time)}</p>
                  )}
                  {showEventDetail.description && <p className="calendar-event-detail-desc">{showEventDetail.description}</p>}
                  <a href={googleCalendarUrl(showEventDetail)} target="_blank" rel="noopener noreferrer" className="calendar-btn calendar-btn--primary calendar-btn--block">
                    Add to Google Calendar
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Create Modal */}
      {showScheduleCreate && (
        <div className="calendar-modal-overlay" onClick={() => setShowScheduleCreate(false)}>
          <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h2 className="calendar-modal-title">New Schedule</h2>
              <button type="button" className="calendar-modal-close" onClick={() => setShowScheduleCreate(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleGenerateSchedule} className="calendar-form">
              <label className="calendar-form-label">Week start</label>
              <input type="date" className="calendar-form-input" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} required />
              <label className="calendar-form-label">Week end</label>
              <input type="date" className="calendar-form-input" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} required />
              <div className="calendar-form-actions">
                <button type="button" className="calendar-btn calendar-btn--secondary" onClick={() => setShowScheduleCreate(false)}>Cancel</button>
                <button type="submit" className="calendar-btn calendar-btn--primary" disabled={scheduleGenerating}>{scheduleGenerating ? 'Generating…' : 'Generate'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drafts List Modal */}
      {showDraftsList && (
        <div className="calendar-modal-overlay" onClick={() => setShowDraftsList(false)}>
          <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h2 className="calendar-modal-title">Drafts</h2>
              <button type="button" className="calendar-modal-close" onClick={() => setShowDraftsList(false)}><X size={24} /></button>
            </div>
            <div className="calendar-list-wrap">
              {loadingDrafts ? <p className="calendar-muted">Loading…</p> : draftList.length === 0 ? <p className="calendar-muted">No drafts.</p> : (
                <ul className="calendar-list">
                  {draftList.map((d) => (
                    <li key={d.period_id} className="calendar-event">
                      <span>{d.week_start_date} – {d.week_end_date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit (Published) List Modal */}
      {showEditList && (
        <div className="calendar-modal-overlay" onClick={() => setShowEditList(false)}>
          <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h2 className="calendar-modal-title">Published Schedules</h2>
              <button type="button" className="calendar-modal-close" onClick={() => setShowEditList(false)}><X size={24} /></button>
            </div>
            <div className="calendar-list-wrap">
              {loadingEditList ? <p className="calendar-muted">Loading…</p> : editList.length === 0 ? <p className="calendar-muted">None.</p> : (
                <ul className="calendar-list">
                  {editList.map((p) => (
                    <li key={p.period_id} className="calendar-event">
                      <span>{p.week_start_date} – {p.week_end_date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <button type="button" className="nav-item nav-item--cart" aria-label="Cart" onClick={() => navigate('/checkout')}>
          <span className="nav-cart-circle"><ShoppingCart size={36} strokeWidth={2} /></span>
        </button>
        <button type="button" className="nav-item" aria-label="Orders" onClick={() => navigate('/orders')}><ClipboardList size={36} strokeWidth={2} /></button>
        <button type="button" className="nav-item nav-item--active" aria-label="Calendar" onClick={() => navigate('/calendar')}><CalendarIcon size={36} strokeWidth={2} /></button>
        <button type="button" className="nav-item" aria-label="Inventory" onClick={() => navigate('/inventory')}><Package size={36} strokeWidth={2} /></button>
        <button type="button" className="nav-item" aria-label="Add"><Plus size={36} strokeWidth={2} /></button>
      </nav>
    </div>
  )
}
