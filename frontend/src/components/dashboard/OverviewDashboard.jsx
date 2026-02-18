import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { ChevronDown, X, Plus, Settings, Info, ExternalLink, BarChart2, PieChart, Users, Package, DollarSign, Percent } from 'lucide-react'
import Modal from '../common/Modal'

function MiniChart({ data, color = '#635bff', height = 120 }) {
  const safeData = Array.isArray(data) && data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0]
  const max = Math.max(...safeData, 0.01)
  const w = 280
  const h = height
  const points = safeData.map((v, i) => ({
    x: (i / Math.max(safeData.length - 1, 1)) * w,
    y: h - (v / max) * h
  }))
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" />
    </svg>
  )
}

function MiniChartWithTooltip({
  data,
  dates = [],
  title,
  color = '#635bff',
  height = 120,
  formatValue = (v) => String(v),
  comparisonValue,
  comparisonLabel = 'Previous period',
  theme: { cardBg, borderColor, textColor, mutedColor }
}) {
  const containerRef = useRef(null)
  const [hoverIndex, setHoverIndex] = useState(null)

  const safeData = Array.isArray(data) && data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0]
  const max = Math.max(...safeData, 0.01)
  const w = 280
  const h = height
  const points = safeData.map((v, i) => ({
    x: (i / Math.max(safeData.length - 1, 1)) * w,
    y: h - (v / max) * h
  }))
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  const handleMouseMove = (e) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = rect.width > 0 ? x / rect.width : 0
    const n = safeData.length
    const index = Math.min(Math.max(0, Math.round(pct * (n - 1))), n - 1)
    setHoverIndex(index)
  }

  const handleMouseLeave = () => setHoverIndex(null)

  const dateLabel = (Array.isArray(dates) && dates[hoverIndex] != null) ? dates[hoverIndex] : (hoverIndex != null ? `Point ${hoverIndex + 1}` : '')
  const valueAtPoint = hoverIndex != null ? safeData[hoverIndex] : 0

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', width: '100%', cursor: 'crosshair' }}
    >
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="none">
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" />
        {hoverIndex != null && (
          <g>
            <line
              x1={points[hoverIndex].x}
              y1={0}
              x2={points[hoverIndex].x}
              y2={h}
              stroke={mutedColor}
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity={0.8}
            />
            <circle
              cx={points[hoverIndex].x}
              cy={points[hoverIndex].y}
              r={5}
              fill={color}
              stroke={cardBg}
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
      {hoverIndex != null && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: `${(hoverIndex / Math.max(safeData.length - 1, 1)) * 100}%`,
            bottom: '100%',
            transform: 'translate(-50%, -10px)',
            minWidth: 160,
            padding: '10px 12px',
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10,
            pointerEvents: 'none'
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: textColor, marginBottom: 8 }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13, color: textColor }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              {dateLabel}
            </span>
            <span style={{ fontWeight: 600 }}>{formatValue(valueAtPoint)}</span>
          </div>
          {comparisonValue != null && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13, color: mutedColor, marginTop: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: mutedColor }} />
                {comparisonLabel}
              </span>
              <span style={{ fontWeight: 500 }}>{formatValue(comparisonValue)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Dropdown({ label, value, options, onSelect, removable = false, onRemove, isDarkMode, borderColor, bg, textColor, mutedColor }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: bg,
          border: `1px solid ${borderColor}`,
          borderRadius: 20,
          padding: '6px 12px',
          fontSize: 13,
          cursor: 'pointer',
          color: textColor,
          fontWeight: 500
        }}
      >
        {label && <span style={{ color: mutedColor, marginRight: 2 }}>{label}</span>}
        <span>{value}</span>
        <ChevronDown size={14} color={mutedColor} style={{ flexShrink: 0 }} />
      </button>
      {removable && (
        <button type="button" onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, marginLeft: -4 }}>
          <X size={14} color={mutedColor} />
        </button>
      )}
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: bg,
              border: `1px solid ${borderColor}`,
              borderRadius: 8,
              boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 10,
              minWidth: 160,
              overflow: 'hidden'
            }}
          >
            {options.map((o) => (
              <div
                key={o}
                role="button"
                tabIndex={0}
                onClick={() => { onSelect(o); setOpen(false) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { onSelect(o); setOpen(false) } }}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                  background: o === value ? (isDarkMode ? 'rgba(99,91,255,0.2)' : '#f3f0ff') : bg,
                  color: o === value ? '#635bff' : textColor
                }}
              >
                {o}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function InfoWithPopover({ description, cardBg, borderColor, textColor, mutedColor, isDarkMode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          padding: 2,
          cursor: 'pointer',
          color: mutedColor,
          borderRadius: '50%'
        }}
        aria-label="What is this?"
        aria-expanded={open}
      >
        <Info size={13} />
      </button>
      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: 6,
            width: 220,
            maxWidth: 'min(220px, 90vw)',
            padding: '10px 12px',
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: 8,
            boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 20,
            fontSize: 12,
            lineHeight: 1.4,
            color: textColor
          }}
        >
          {description}
        </div>
      )}
    </div>
  )
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)
}

// Map order_status_breakdown + revenue/returns to payment-like rows
function buildPaymentsFromStats(stats) {
  const breakdown = stats?.order_status_breakdown ?? {}
  const rev = stats?.revenue ?? {}
  const ret = stats?.returns ?? {}
  const completed = Number(breakdown.completed ?? breakdown.paid ?? 0)
  const voided = Number(breakdown.voided ?? 0)
  const placed = Number(breakdown.placed ?? 0)
  return [
    { type: 'Successful', count: completed, amount: rev?.today ?? rev?.week ?? 0, color: '#22c55e' },
    { type: 'Refunded', count: ret?.today ?? 0, amount: ret?.today_amount ?? 0, color: '#f59e0b' },
    { type: 'Uncaptured', count: 0, amount: 0, color: '#94a3b8' },
    { type: 'Failed', count: voided, amount: 0, color: '#ef4444' },
    { type: 'Pending', count: placed, amount: 0, color: '#635bff' }
  ]
}

const MAIN_WIDGET_IDS_TOP = ['payments', 'gross_volume', 'net_volume']
const MAIN_WIDGET_IDS_BOTTOM = ['failed_payments', 'top_customers']
const DEFAULT_VISIBLE_MAIN = [...MAIN_WIDGET_IDS_TOP, ...MAIN_WIDGET_IDS_BOTTOM]

const ADDABLE_STAT_OPTIONS = [
  { id: 'weekly_revenue_chart', label: 'Weekly revenue chart', description: 'Line chart of revenue for the last 7 days', icon: BarChart2 },
  { id: 'order_status_breakdown', label: 'Order status breakdown', description: 'Count of orders by status (completed, voided, placed, etc.)', icon: PieChart },
  { id: 'top_products', label: 'Top products', description: 'Best-selling products by quantity and revenue (last 30 days)', icon: Package },
  { id: 'today_revenue', label: "Today's revenue", description: "Single card showing today's total revenue", icon: DollarSign },
  { id: 'inventory_snapshot', label: 'Inventory snapshot', description: 'Total products, low-stock count, and inventory value', icon: Package },
  { id: 'discounts_summary', label: 'Discounts summary', description: 'Discounts given today, this week, and this month', icon: Percent },
  { id: 'customers_count', label: 'Customers & rewards', description: 'Total customers and customers with loyalty points', icon: Users }
]

export default function OverviewDashboard() {
  const { themeColor } = useTheme()
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark-theme'))
  const [stats, setStats] = useState(null)
  const [topCustomers, setTopCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateRange, setDateRange] = useState('Last 7 days')
  const [granularity, setGranularity] = useState('Daily')
  const [compare, setCompare] = useState('Previous period')
  const [showCompare, setShowCompare] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [visibleMainWidgets, setVisibleMainWidgets] = useState(() => {
    try {
      const saved = localStorage.getItem('overview_visible_main_widgets')
      if (saved) {
        const parsed = JSON.parse(saved)
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_VISIBLE_MAIN
      }
    } catch (_) {}
    return DEFAULT_VISIBLE_MAIN
  })
  const [addedWidgetIds, setAddedWidgetIds] = useState(() => {
    try {
      const saved = localStorage.getItem('overview_added_widgets')
      if (saved) {
        const parsed = JSON.parse(saved)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch (_) {}
    return []
  })

  useEffect(() => {
    const check = () => setIsDarkMode(document.documentElement.classList.contains('dark-theme'))
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('overview_added_widgets', JSON.stringify(addedWidgetIds))
    } catch (_) {}
  }, [addedWidgetIds])

  useEffect(() => {
    try {
      localStorage.setItem('overview_visible_main_widgets', JSON.stringify(visibleMainWidgets))
    } catch (_) {}
  }, [visibleMainWidgets])

  const handleRemoveMainWidget = (id) => {
    const next = visibleMainWidgets.filter((x) => x !== id)
    setVisibleMainWidgets(next)
    try {
      localStorage.setItem('overview_visible_main_widgets', JSON.stringify(next))
    } catch (_) {}
  }

  const handleAddWidget = (id) => {
    if (!addedWidgetIds.includes(id)) {
      const next = [...addedWidgetIds, id]
      setAddedWidgetIds(next)
      try {
        localStorage.setItem('overview_added_widgets', JSON.stringify(next))
      } catch (_) {}
    }
    setAddModalOpen(false)
  }

  const handleRemoveAddedWidget = (id) => {
    const next = addedWidgetIds.filter((x) => x !== id)
    setAddedWidgetIds(next)
    try {
      localStorage.setItem('overview_added_widgets', JSON.stringify(next))
    } catch (_) {}
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      fetch('/api/dashboard/statistics').then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load statistics')))),
      fetch('/api/dashboard/top_customers?limit=5').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] }))
    ])
      .then(([statsData, customersData]) => {
        if (!cancelled) {
          setStats(statsData?.error ? null : statsData)
          setTopCustomers(Array.isArray(customersData?.data) ? customersData.data : [])
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Error loading overview') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const bg = isDarkMode ? '#1a1a1a' : '#f6f8fa'
  const cardBg = isDarkMode ? '#2a2a2a' : '#fff'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e8e8ee'
  const textColor = isDarkMode ? '#e8e8e8' : '#1a1a2e'
  const mutedColor = isDarkMode ? '#9ca3af' : '#6b7280'
  const chartColor = themeColor && themeColor.startsWith('#') ? themeColor : '#635bff'

  const weekly = stats?.weekly_revenue ?? []
  const chartGross = weekly.map((d) => d.revenue ?? 0)
  const chartNet = weekly.map((d) => (d.revenue ?? 0) - 0) // net = gross - refunds per day; we don't have per-day refunds, so same as gross for now
  const dates = weekly.length >= 2 ? weekly.map((d) => d.day || d.date?.slice(5) || '') : ['', '', '', '', '', '', '']
  const revWeek = stats?.revenue?.week ?? 0
  const revMonth = stats?.revenue?.month ?? 0
  const prevPeriod = dateRange === 'Last 7 days' ? 0 : revMonth * 0.5 // placeholder previous period
  const netWeek = revWeek - (stats?.returns?.today_amount ?? 0) // rough net
  const payments = stats ? buildPaymentsFromStats(stats) : []

  if (loading) {
    return (
      <div style={{ background: bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <span style={{ color: mutedColor, fontSize: 14 }}>Loading overview…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <span style={{ color: '#ef4444', fontSize: 14 }}>{error}</span>
      </div>
    )
  }

  return (
    <div style={{ background: bg, minHeight: '100vh', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Dropdown
              label="Date range"
              value={dateRange}
              options={['Today', 'Last 7 days', 'Last 4 weeks', 'Last 3 months', 'Last 12 months']}
              onSelect={setDateRange}
              isDarkMode={isDarkMode}
              borderColor={borderColor}
              bg={cardBg}
              textColor={textColor}
              mutedColor={mutedColor}
            />
            <Dropdown
              value={granularity}
              options={['Hourly', 'Daily', 'Weekly', 'Monthly']}
              onSelect={setGranularity}
              isDarkMode={isDarkMode}
              borderColor={borderColor}
              bg={cardBg}
              textColor={textColor}
              mutedColor={mutedColor}
            />
            {showCompare && (
              <Dropdown
                label="Compare"
                value={compare}
                options={['Previous period', 'Previous year']}
                onSelect={setCompare}
                removable
                onRemove={() => setShowCompare(false)}
                isDarkMode={isDarkMode}
                borderColor={borderColor}
                bg={cardBg}
                textColor={textColor}
                mutedColor={mutedColor}
              />
            )}
            {!showCompare && (
              <button
                type="button"
                onClick={() => setShowCompare(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: `1px dashed ${borderColor}`,
                  borderRadius: 20,
                  padding: '6px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: mutedColor
                }}
              >
                <Plus size={13} /> Compare
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                cursor: 'pointer',
                color: textColor,
                fontWeight: 600
              }}
            >
              <Plus size={14} /> Add
            </button>
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: editMode ? chartColor : cardBg,
                border: `1px solid ${editMode ? chartColor : borderColor}`,
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                cursor: 'pointer',
                color: editMode ? '#fff' : textColor,
                fontWeight: 500
              }}
            >
              <Settings size={14} /> {editMode ? 'Done' : 'Edit'}
            </button>
          </div>
        </div>

        {editMode && (
          <p style={{ fontSize: 13, color: mutedColor, marginBottom: 16 }}>
            Tap the × on any stat card below to remove it from the page. Click Done when finished.
          </p>
        )}

        {/* Top Row */}
        {MAIN_WIDGET_IDS_TOP.filter((id) => visibleMainWidgets.includes(id)).length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${MAIN_WIDGET_IDS_TOP.filter((id) => visibleMainWidgets.includes(id)).length}, 1fr)`,
              gap: 0,
              background: cardBg,
              borderRadius: 12,
              border: `1px solid ${borderColor}`,
              marginBottom: 16,
              overflow: 'hidden'
            }}
          >
            {visibleMainWidgets.includes('payments') && (
              <div style={{ position: 'relative', padding: '20px 24px', borderRight: `1px solid ${borderColor}` }}>
                {editMode && (
                  <button type="button" onClick={() => handleRemoveMainWidget('payments')} style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Remove Payments"><X size={16} /></button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: textColor }}>Payments</span>
                  <InfoWithPopover description="Breakdown of payment types: successful, refunded, uncaptured, failed, and pending. Amounts reflect the selected date range." cardBg={cardBg} borderColor={borderColor} textColor={textColor} mutedColor={mutedColor} isDarkMode={isDarkMode} />
                  <ExternalLink size={13} color={mutedColor} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {payments.map((p) => (
                    <div key={p.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                        <span style={{ fontSize: 13, color: mutedColor }}>{p.count} {p.type}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {visibleMainWidgets.includes('gross_volume') && (
              <div style={{ position: 'relative', padding: '20px 24px', borderRight: visibleMainWidgets.includes('net_volume') ? `1px solid ${borderColor}` : 'none', display: 'flex', flexDirection: 'column' }}>
                {editMode && (
                  <button type="button" onClick={() => handleRemoveMainWidget('gross_volume')} style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Remove Gross volume"><X size={16} /></button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: textColor }}>Gross volume</span>
                    <InfoWithPopover description="Total revenue (before refunds or fees) for the selected period. The chart shows daily or weekly values over time." cardBg={cardBg} borderColor={borderColor} textColor={textColor} mutedColor={mutedColor} isDarkMode={isDarkMode} />
                  </div>
                  <a href="/statistics" style={{ display: 'flex', alignItems: 'center', gap: 4, background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: textColor, fontWeight: 500, textDecoration: 'none' }}>
                    <ExternalLink size={11} /> Explore
                  </a>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: textColor }}>{formatCurrency(revWeek)}</div>
                <div style={{ fontSize: 12, color: mutedColor, marginBottom: 12 }}>{formatCurrency(prevPeriod)} previous period</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, fontSize: 10, color: mutedColor }}>{formatCurrency(Math.max(...chartGross, 0.01))}</div>
                    <MiniChartWithTooltip
                      data={chartGross}
                      dates={dates}
                      title="Gross volume"
                      height={100}
                      color={chartColor}
                      formatValue={formatCurrency}
                      comparisonValue={prevPeriod}
                      comparisonLabel="Previous period"
                      theme={{ cardBg, borderColor, textColor, mutedColor }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: mutedColor }}>{dates[0] || '—'}</span>
                      <span style={{ fontSize: 10, color: mutedColor }}>{formatCurrency(Math.min(...chartGross, 0))}</span>
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, right: 0 }}><span style={{ fontSize: 10, color: mutedColor }}>{dates[dates.length - 1] || '—'}</span></div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 8, borderTop: `1px solid ${isDarkMode ? '#3a3a3a' : '#f3f4f6'}` }}>
                  <span style={{ fontSize: 11, color: mutedColor }}>Updated from platform</span>
                  <a href="/statistics" style={{ fontSize: 12, color: chartColor, cursor: 'pointer', fontWeight: 500, textDecoration: 'none' }}>More details</a>
                </div>
              </div>
            )}
            {visibleMainWidgets.includes('net_volume') && (
              <div style={{ position: 'relative', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
                {editMode && (
                  <button type="button" onClick={() => handleRemoveMainWidget('net_volume')} style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Remove Net volume"><X size={16} /></button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: textColor }}>Net volume</span>
                  <InfoWithPopover description="Revenue after refunds for the selected period. The chart shows daily or weekly net values over time." cardBg={cardBg} borderColor={borderColor} textColor={textColor} mutedColor={mutedColor} isDarkMode={isDarkMode} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: textColor }}>{formatCurrency(netWeek)}</div>
                <div style={{ fontSize: 12, color: mutedColor, marginBottom: 12 }}>{formatCurrency(prevPeriod)} previous period</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, fontSize: 10, color: mutedColor }}>{formatCurrency(Math.max(...chartNet, 0.01))}</div>
                    <MiniChartWithTooltip
                      data={chartNet}
                      dates={dates}
                      title="Net volume"
                      height={100}
                      color={chartColor}
                      formatValue={formatCurrency}
                      comparisonValue={prevPeriod}
                      comparisonLabel="Previous period"
                      theme={{ cardBg, borderColor, textColor, mutedColor }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: mutedColor }}>{dates[0] || '—'}</span>
                      <span style={{ fontSize: 10, color: mutedColor }}>{formatCurrency(Math.min(...chartNet, 0))}</span>
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, right: 0 }}><span style={{ fontSize: 10, color: mutedColor }}>{dates[dates.length - 1] || '—'}</span></div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 8, borderTop: `1px solid ${isDarkMode ? '#3a3a3a' : '#f3f4f6'}` }}>
                  <span style={{ fontSize: 11, color: mutedColor }}>Updated from platform</span>
                  <a href="/statistics" style={{ fontSize: 12, color: chartColor, cursor: 'pointer', fontWeight: 500, textDecoration: 'none' }}>More details</a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Row */}
        {MAIN_WIDGET_IDS_BOTTOM.filter((id) => visibleMainWidgets.includes(id)).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${MAIN_WIDGET_IDS_BOTTOM.filter((id) => visibleMainWidgets.includes(id)).length}, 1fr)`, gap: 16 }}>
            {visibleMainWidgets.includes('failed_payments') && (
              <div
                style={{
                  position: 'relative',
                  background: cardBg,
                  borderRadius: 12,
                  border: `1px solid ${borderColor}`,
                  padding: '20px 24px'
                }}
              >
                {editMode && (
                  <button type="button" onClick={() => handleRemoveMainWidget('failed_payments')} style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Remove Failed payments"><X size={16} /></button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: textColor }}>Failed payments</span>
                  <InfoWithPopover description="Count of voided or failed orders. These are transactions that did not complete successfully." cardBg={cardBg} borderColor={borderColor} textColor={textColor} mutedColor={mutedColor} isDarkMode={isDarkMode} />
                </div>
                <div style={{ border: `2px dashed ${borderColor}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: mutedColor, fontSize: 14 }}>
                  {((stats?.order_status_breakdown?.voided ?? 0) > 0) ? `${stats.order_status_breakdown.voided} voided order(s)` : 'No data'}
                </div>
              </div>
            )}
            {visibleMainWidgets.includes('top_customers') && (
              <div
                style={{
                  position: 'relative',
                  background: cardBg,
                  borderRadius: 12,
                  border: `1px solid ${borderColor}`,
                  padding: '20px 24px'
                }}
              >
                {editMode && (
                  <button type="button" onClick={() => handleRemoveMainWidget('top_customers')} style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Remove Top customers"><X size={16} /></button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: textColor }}>Top customers by spend</span>
                    <InfoWithPopover description="Customers ranked by total spend across all time. Shows name, email, and total amount spent." cardBg={cardBg} borderColor={borderColor} textColor={textColor} mutedColor={mutedColor} isDarkMode={isDarkMode} />
                    <ExternalLink size={13} color={mutedColor} />
                  </div>
                  <span style={{ fontSize: 12, color: mutedColor }}>All time</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {topCustomers.length === 0 ? (
                    <div style={{ border: `2px dashed ${borderColor}`, borderRadius: 12, padding: 24, textAlign: 'center', color: mutedColor, fontSize: 14 }}>No customer spend data yet</div>
                  ) : (
                    topCustomers.map((c, i) => (
                      <div key={c.customer_id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{c.customer_name || c.name || '—'}</div>
                          <div style={{ fontSize: 12, color: chartColor }}>{c.email || '—'}</div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{formatCurrency(c.total_spend ?? c.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Added statistics section — always visible; added stats go here */}
        <div style={{ marginTop: 24 }}>
          {addedWidgetIds.length === 0 ? (
            <div
              style={{
                background: cardBg,
                border: `1px dashed ${borderColor}`,
                borderRadius: 12,
                padding: 32,
                textAlign: 'center',
                color: mutedColor,
                fontSize: 14
              }}
            >
              No added statistics. Click <strong>Add</strong> above to choose statistics to show here.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {addedWidgetIds.map((id) => {
                const opt = ADDABLE_STAT_OPTIONS.find((o) => o.id === id)
                if (!opt) return null
                const Icon = opt.icon
                return (
                  <div
                    key={id}
                    style={{
                      background: cardBg,
                      borderRadius: 12,
                      border: `1px solid ${borderColor}`,
                      padding: '20px 24px',
                      position: 'relative'
                    }}
                  >
                    {editMode && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAddedWidget(id)}
                        style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          zIndex: 2,
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: 28,
                          height: 28,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        aria-label="Remove"
                      >
                        <X size={16} />
                      </button>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      {Icon && <Icon size={18} color={chartColor} />}
                      <span style={{ fontSize: 14, fontWeight: 600, color: textColor }}>{opt.label}</span>
                    </div>
                    {id === 'weekly_revenue_chart' && (
                      <div style={{ height: 100 }}>
                        <MiniChartWithTooltip
                          data={chartGross}
                          dates={dates}
                          title="Weekly revenue"
                          height={80}
                          color={chartColor}
                          formatValue={formatCurrency}
                          comparisonValue={prevPeriod}
                          comparisonLabel="Previous period"
                          theme={{ cardBg, borderColor, textColor, mutedColor }}
                        />
                      </div>
                    )}
                    {id === 'order_status_breakdown' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {Object.entries(stats?.order_status_breakdown ?? {}).map(([status, count]) => (
                          <div key={status} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: textColor }}>
                            <span>{status}</span>
                            <span>{count} order(s)</span>
                          </div>
                        ))}
                        {Object.keys(stats?.order_status_breakdown ?? {}).length === 0 && <span style={{ fontSize: 13, color: mutedColor }}>No data</span>}
                      </div>
                    )}
                    {id === 'top_products' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(stats?.top_products ?? []).slice(0, 5).map((p, i) => (
                          <div key={p.product_id || i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: textColor }}>
                            <span>{p.product_name}</span>
                            <span>{p.total_quantity} sold · {formatCurrency(p.total_revenue)}</span>
                          </div>
                        ))}
                        {(stats?.top_products ?? []).length === 0 && <span style={{ fontSize: 13, color: mutedColor }}>No data</span>}
                      </div>
                    )}
                    {id === 'today_revenue' && (
                      <div style={{ fontSize: 24, fontWeight: 700, color: textColor }}>{formatCurrency(stats?.revenue?.today ?? 0)}</div>
                    )}
                    {id === 'inventory_snapshot' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: textColor }}>
                        <div>Total products: <strong>{stats?.inventory?.total_products ?? 0}</strong></div>
                        <div>Low stock (≤10): <strong>{stats?.inventory?.low_stock ?? 0}</strong></div>
                        <div>Inventory value: <strong>{formatCurrency(stats?.inventory?.total_value)}</strong></div>
                      </div>
                    )}
                    {id === 'discounts_summary' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: textColor }}>
                        <div>Today: {formatCurrency(stats?.discount?.today)}</div>
                        <div>This week: {formatCurrency(stats?.discount?.week)}</div>
                        <div>This month: {formatCurrency(stats?.discount?.month)}</div>
                      </div>
                    )}
                    {id === 'customers_count' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: textColor }}>
                        <div>Total customers: <strong>{stats?.customers_total ?? 0}</strong></div>
                        <div>With loyalty points: <strong>{stats?.customers_in_rewards ?? 0}</strong></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add statistics" size="lg">
        <p style={{ fontSize: 14, color: mutedColor, marginBottom: 20 }}>
          Choose a statistic to add to your overview page. Added items appear in the &quot;Added statistics&quot; section below.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ADDABLE_STAT_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const isAdded = addedWidgetIds.includes(opt.id)
            return (
              <div
                key={opt.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '12px 16px',
                  background: isDarkMode ? (isAdded ? 'rgba(99,91,255,0.15)' : '#1f1f1f') : (isAdded ? '#f3f0ff' : '#f9fafb'),
                  border: `1px solid ${borderColor}`,
                  borderRadius: 8,
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    {Icon && <Icon size={20} color={chartColor} style={{ flexShrink: 0 }} />}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: textColor }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>{opt.description}</div>
                    </div>
                  </div>
                  {isAdded ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: chartColor, flexShrink: 0 }}>Added</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddWidget(opt.id)}
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: chartColor,
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontSize: 13,
                        cursor: 'pointer',
                        color: '#fff',
                        fontWeight: 600
                      }}
                    >
                      <Plus size={14} /> Add
                    </button>
                  )}
                </div>
                {/* Preview under each option */}
                <div style={{
                  padding: '12px',
                  background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
                  borderRadius: 6,
                  border: `1px solid ${borderColor}`,
                  minHeight: 56
                }}>
                  {opt.id === 'weekly_revenue_chart' && (
                    <div style={{ height: 56, width: '100%' }}>
                      <MiniChartWithTooltip
                        data={chartGross}
                        dates={dates}
                        title="Weekly revenue"
                        height={56}
                        color={chartColor}
                        formatValue={formatCurrency}
                        comparisonValue={prevPeriod}
                        comparisonLabel="Previous period"
                        theme={{ cardBg, borderColor, textColor, mutedColor }}
                      />
                    </div>
                  )}
                  {opt.id === 'order_status_breakdown' && (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56 }}>
                      {Object.entries(stats?.order_status_breakdown ?? {}).slice(0, 6).map(([status, count]) => {
                        const max = Math.max(...Object.values(stats?.order_status_breakdown ?? { 0: 1 }), 1)
                        const h = (count / max) * 48
                        return (
                          <div key={status} title={`${status}: ${count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: '100%', height: h, minHeight: count ? 4 : 0, background: chartColor, borderRadius: '4px 4px 0 0' }} />
                            <span style={{ fontSize: 9, color: mutedColor, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(status).slice(0, 6)}</span>
                          </div>
                        )
                      })}
                      {Object.keys(stats?.order_status_breakdown ?? {}).length === 0 && (
                        <span style={{ fontSize: 12, color: mutedColor }}>No data</span>
                      )}
                    </div>
                  )}
                  {opt.id === 'top_products' && (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56 }}>
                      {(stats?.top_products ?? []).slice(0, 5).map((p, i) => {
                        const maxQ = Math.max(...(stats?.top_products ?? []).map((x) => x.total_quantity || 0), 1)
                        const h = ((p.total_quantity || 0) / maxQ) * 48
                        return (
                          <div key={p.product_id || i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <div style={{ width: '100%', height: h, minHeight: (p.total_quantity || 0) ? 4 : 0, background: chartColor, borderRadius: '4px 4px 0 0' }} />
                            <span style={{ fontSize: 9, color: mutedColor, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p.product_name || '').slice(0, 8)}</span>
                          </div>
                        )
                      })}
                      {(stats?.top_products ?? []).length === 0 && <span style={{ fontSize: 12, color: mutedColor }}>No data</span>}
                    </div>
                  )}
                  {opt.id === 'today_revenue' && (
                    <div style={{ fontSize: 22, fontWeight: 700, color: textColor }}>{formatCurrency(stats?.revenue?.today ?? 0)}</div>
                  )}
                  {opt.id === 'inventory_snapshot' && (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: textColor }}>
                      <span>Products: <strong>{stats?.inventory?.total_products ?? 0}</strong></span>
                      <span>Low stock: <strong>{stats?.inventory?.low_stock ?? 0}</strong></span>
                      <span>Value: <strong>{formatCurrency(stats?.inventory?.total_value)}</strong></span>
                    </div>
                  )}
                  {opt.id === 'discounts_summary' && (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: textColor }}>
                      <span>Today: {formatCurrency(stats?.discount?.today)}</span>
                      <span>Week: {formatCurrency(stats?.discount?.week)}</span>
                      <span>Month: {formatCurrency(stats?.discount?.month)}</span>
                    </div>
                  )}
                  {opt.id === 'customers_count' && (
                    <div style={{ display: 'flex', gap: 20, fontSize: 12, color: textColor }}>
                      <span>Total: <strong>{stats?.customers_total ?? 0}</strong></span>
                      <span>With points: <strong>{stats?.customers_in_rewards ?? 0}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
