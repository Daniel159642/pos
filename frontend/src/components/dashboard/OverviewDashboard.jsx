import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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

const CHART_TYPE_OPTIONS = [
  { id: 'line', label: 'Line' },
  { id: 'bar', label: 'Bar' },
  { id: 'area', label: 'Area' }
]

function MiniChartWithTooltip({
  data,
  dates = [],
  title,
  color = '#635bff',
  height = 120,
  formatValue = (v) => String(v),
  comparisonValue,
  comparisonLabel = 'Previous period',
  theme: { cardBg, borderColor, textColor, mutedColor },
  chartType = 'line',
  tooltipFixedPosition = false
}) {
  const containerRef = useRef(null)
  const [hoverIndex, setHoverIndex] = useState(null)
  const [tooltipPos, setTooltipPos] = useState(null)

  const safeData = Array.isArray(data) && data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0]
  const max = Math.max(...safeData, 0.01)
  const w = 280
  const h = height
  const n = safeData.length
  const points = safeData.map((v, i) => ({
    x: (i / Math.max(n - 1, 1)) * w,
    y: h - (v / max) * h
  }))
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = line + ` L ${w},${h} L 0,${h} Z`
  const barWidth = n > 0 ? (w / n) * 0.7 : 0
  const barGap = n > 0 ? (w / n) * 0.15 : 0

  const handleMouseMove = (e) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = rect.width > 0 ? x / rect.width : 0
    const index = Math.min(Math.max(0, Math.round(pct * (n - 1))), n - 1)
    setHoverIndex(index)
  }

  const handleMouseLeave = () => setHoverIndex(null)

  // When tooltipFixedPosition (e.g. inside modal), update tooltip position so it isn't clipped; use rAF to track scroll/resize
  useEffect(() => {
    if (!tooltipFixedPosition || hoverIndex == null || !containerRef.current) {
      setTooltipPos(null)
      return
    }
    const updatePos = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = n > 1 ? hoverIndex / (n - 1) : 0
      setTooltipPos({
        x: rect.left + pct * rect.width,
        y: rect.top - 10
      })
    }
    updatePos()
    const rafId = { current: null }
    const tick = () => {
      updatePos()
      rafId.current = requestAnimationFrame(tick)
    }
    rafId.current = requestAnimationFrame(tick)
    const onResize = () => updatePos()
    window.addEventListener('resize', onResize)
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
      window.removeEventListener('resize', onResize)
      setTooltipPos(null)
    }
  }, [tooltipFixedPosition, hoverIndex, n])

  const dateLabel = (Array.isArray(dates) && dates[hoverIndex] != null) ? dates[hoverIndex] : (hoverIndex != null ? `Point ${hoverIndex + 1}` : '')
  const valueAtPoint = hoverIndex != null ? safeData[hoverIndex] : 0

  const tooltipContent = hoverIndex != null && (
    <div
      role="tooltip"
      style={{
        position: tooltipFixedPosition && tooltipPos ? 'fixed' : 'absolute',
        ...(tooltipFixedPosition && tooltipPos
          ? { left: tooltipPos.x, top: tooltipPos.y, transform: 'translate(-50%, -100%)', zIndex: 10002 }
          : {
              left: `${(hoverIndex / Math.max(safeData.length - 1, 1)) * 100}%`,
              bottom: '100%',
              transform: 'translate(-50%, -10px)',
              zIndex: 10001
            }),
        minWidth: 160,
        padding: '10px 12px',
        background: cardBg,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
  )

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', width: '100%', cursor: 'crosshair' }}
    >
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="none">
        {chartType === 'area' && <path d={areaPath} fill={color} fillOpacity={0.25} />}
        {chartType === 'area' && <path d={line} fill="none" stroke={color} strokeWidth="2.5" />}
        {chartType === 'line' && <path d={line} fill="none" stroke={color} strokeWidth="2.5" />}
        {chartType === 'bar' && safeData.map((v, i) => {
          const barH = max > 0 ? (v / max) * h : 0
          const x = i * (w / n) + barGap
          return (
            <rect
              key={i}
              x={x}
              y={h - barH}
              width={barWidth}
              height={barH}
              fill={color}
              rx={2}
              ry={2}
            />
          )
        })}
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
            {chartType !== 'bar' && (
              <circle
                cx={points[hoverIndex].x}
                cy={points[hoverIndex].y}
                r={5}
                fill={color}
                stroke={cardBg}
                strokeWidth="2"
              />
            )}
            {chartType === 'bar' && (
              <rect
                x={hoverIndex * (w / n) + barGap}
                y={h - (max > 0 ? (safeData[hoverIndex] / max) * h : 0)}
                width={barWidth}
                height={max > 0 ? (safeData[hoverIndex] / max) * h : 0}
                fill={color}
                opacity={0.8}
                stroke={cardBg}
                strokeWidth="2"
                rx={2}
                ry={2}
              />
            )}
          </g>
        )}
      </svg>
      {tooltipFixedPosition && tooltipContent && tooltipPos
        ? createPortal(tooltipContent, document.body)
        : tooltipContent}
    </div>
  )
}

function Dropdown({ label, value, options, onSelect, removable = false, onRemove, isDarkMode, borderColor, bg, textColor, mutedColor, chartColor }) {
  const [open, setOpen] = useState(false)
  const themeColor = chartColor || '#635bff'
  const themeColorRgb = themeColor.startsWith('#') ? 
    `${parseInt(themeColor.slice(1, 3), 16)}, ${parseInt(themeColor.slice(3, 5), 16)}, ${parseInt(themeColor.slice(5, 7), 16)}` :
    '99, 91, 255'
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
                  background: o === value ? (isDarkMode ? `rgba(${themeColorRgb}, 0.2)` : `rgba(${themeColorRgb}, 0.1)`) : bg,
                  color: o === value ? themeColor : textColor
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
  const [editMode, setEditMode] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [detailModalStatId, setDetailModalStatId] = useState(null) // 'gross_volume' | 'net_volume' | null
  const [draggedId, setDraggedId] = useState(null)
  const [draggedFrom, setDraggedFrom] = useState(null) // 'main' | 'added'
  const [dragOverId, setDragOverId] = useState(null)
  const [chartTypeByStatId, setChartTypeByStatId] = useState(() => {
    try {
      const saved = localStorage.getItem('overview_chart_type')
      if (saved) {
        const parsed = JSON.parse(saved)
        return typeof parsed === 'object' && parsed !== null ? parsed : {}
      }
    } catch (_) {}
    return {}
  })
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

  useEffect(() => {
    try {
      localStorage.setItem('overview_chart_type', JSON.stringify(chartTypeByStatId))
    } catch (_) {}
  }, [chartTypeByStatId])

  const setChartTypeForStat = (statId, type) => {
    setChartTypeByStatId((prev) => ({ ...prev, [statId]: type }))
  }

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

  const handleDragStart = (e, id, from) => {
    if (!editMode) {
      e.preventDefault()
      return
    }
    // Don't start drag if clicking on a button or link
    if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'A' || e.target.closest('a')) {
      e.preventDefault()
      return
    }
    setDraggedId(id)
    setDraggedFrom(from)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    e.currentTarget.style.opacity = '0.5'
  }

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1'
    setDragOverId(null)
    // Don't reset draggedId/draggedFrom here - let handleDrop do it, but reset if drag was cancelled
    if (e.dataTransfer.dropEffect === 'none') {
      setDraggedId(null)
      setDraggedFrom(null)
    }
  }

  const handleDragOver = (e, targetId) => {
    if (!editMode || !draggedId) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (targetId && draggedId !== targetId) {
      setDragOverId(targetId)
    }
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDrop = (e, targetId, targetFrom) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverId(null)
    
    if (!editMode || !draggedId || draggedId === targetId || draggedFrom !== targetFrom) {
      setDraggedId(null)
      setDraggedFrom(null)
      return
    }
    
    if (draggedFrom === 'main' && targetFrom === 'main') {
      // Reorder main widgets
      const newOrder = [...visibleMainWidgets]
      const draggedIndex = newOrder.indexOf(draggedId)
      const targetIndex = newOrder.indexOf(targetId)
      if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
        newOrder.splice(draggedIndex, 1)
        newOrder.splice(targetIndex, 0, draggedId)
        setVisibleMainWidgets(newOrder)
        try {
          localStorage.setItem('overview_visible_main_widgets', JSON.stringify(newOrder))
        } catch (_) {}
      }
    } else if (draggedFrom === 'added' && targetFrom === 'added') {
      // Reorder added widgets
      const newOrder = [...addedWidgetIds]
      const draggedIndex = newOrder.indexOf(draggedId)
      const targetIndex = newOrder.indexOf(targetId)
      if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
        newOrder.splice(draggedIndex, 1)
        newOrder.splice(targetIndex, 0, draggedId)
        setAddedWidgetIds(newOrder)
        try {
          localStorage.setItem('overview_added_widgets', JSON.stringify(newOrder))
        } catch (_) {}
      }
    }
    setDraggedId(null)
    setDraggedFrom(null)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const dateRangeParam = dateRange.toLowerCase().replace(/\s+/g, '_')
    const granularityParam = granularity.toLowerCase()
    Promise.all([
      fetch(`/api/dashboard/statistics?date_range=${encodeURIComponent(dateRangeParam)}&granularity=${encodeURIComponent(granularityParam)}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load statistics')))),
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
  }, [dateRange, granularity])

  const bg = isDarkMode ? '#1a1a1a' : '#f6f8fa'
  const cardBg = isDarkMode ? '#2a2a2a' : '#fff'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e8e8ee'
  const textColor = isDarkMode ? '#e8e8e8' : '#1a1a2e'
  const mutedColor = isDarkMode ? '#9ca3af' : '#6b7280'
  const chartColor = themeColor && themeColor.startsWith('#') ? themeColor : '#635bff'

  const removeButtonStyle = {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
    background: 'rgba(255, 255, 255, 0.95)',
    color: chartColor,
    border: `1px solid ${chartColor}`,
    borderRadius: '50%',
    width: 20,
    height: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)'
  }
  const onRemoveButtonHover = (e, enter) => {
    const t = e.currentTarget
    if (enter) {
      t.style.background = chartColor
      t.style.color = '#fff'
    } else {
      t.style.background = '#fff'
      t.style.color = chartColor
    }
  }

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
              chartColor={chartColor}
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
              chartColor={chartColor}
            />
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

        {/* Top Row */}
        {visibleMainWidgets.filter((id) => MAIN_WIDGET_IDS_TOP.includes(id)).length > 0 && (
          <div
            onDragOver={(e) => { if (editMode && draggedId) { e.preventDefault(); e.stopPropagation() } }}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${visibleMainWidgets.filter((id) => MAIN_WIDGET_IDS_TOP.includes(id)).length}, 1fr)`,
              gap: 0,
              background: cardBg,
              borderRadius: 12,
              border: `1px solid ${borderColor}`,
              marginBottom: 16,
              overflow: 'hidden'
            }}
          >
            {visibleMainWidgets.filter((id) => MAIN_WIDGET_IDS_TOP.includes(id)).map((id, idx, arr) => {
              if (id === 'payments') {
                return (
                  <div
                    key={id}
                    draggable={editMode}
                    onDragStart={(e) => handleDragStart(e, id, 'main')}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, id, 'main')}
                    style={{
                      position: 'relative',
                      padding: '20px 24px',
                      borderRight: idx < arr.length - 1 ? `1px solid ${borderColor}` : 'none',
                      cursor: editMode ? 'move' : 'default',
                      opacity: draggedId === id ? 0.5 : 1,
                      border: dragOverId === id && draggedId !== id ? `2px dashed ${chartColor}` : 'none',
                      transition: 'border 0.2s'
                    }}
                  >
                    {editMode && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveMainWidget('payments') }} onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.stopPropagation()} style={removeButtonStyle} onMouseEnter={(e) => onRemoveButtonHover(e, true)} onMouseLeave={(e) => onRemoveButtonHover(e, false)} aria-label="Remove Payments"><X size={12} strokeWidth={2.5} /></button>
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
                )
              }
              return null
            })}
            {visibleMainWidgets.includes('gross_volume') && (
              <div
                draggable={editMode}
                onDragStart={(e) => handleDragStart(e, 'gross_volume', 'main')}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, 'gross_volume')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'gross_volume', 'main')}
                style={{
                  position: 'relative',
                  padding: '20px 24px',
                  borderRight: visibleMainWidgets.includes('net_volume') ? `1px solid ${borderColor}` : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: editMode ? 'move' : 'default',
                  opacity: draggedId === 'gross_volume' ? 0.5 : 1,
                  border: dragOverId === 'gross_volume' && draggedId !== 'gross_volume' ? `2px dashed ${chartColor}` : 'none',
                  transition: 'border 0.2s'
                }}
              >
                {editMode && (
                  <button type="button" onClick={() => handleRemoveMainWidget('gross_volume')} onDragStart={(e) => e.stopPropagation()} style={removeButtonStyle} onMouseEnter={(e) => onRemoveButtonHover(e, true)} onMouseLeave={(e) => onRemoveButtonHover(e, false)} aria-label="Remove Gross volume"><X size={12} strokeWidth={2.5} /></button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: textColor }}>Gross volume</span>
                    <InfoWithPopover description="Total revenue (before refunds or fees) for the selected period. The chart shows daily or weekly values over time." cardBg={cardBg} borderColor={borderColor} textColor={textColor} mutedColor={mutedColor} isDarkMode={isDarkMode} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailModalStatId('gross_volume')}
                    onDragStart={(e) => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: textColor, fontWeight: 500 }}
                  >
                    <ExternalLink size={11} /> Explore
                  </button>
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
                      chartType={chartTypeByStatId.gross_volume || 'line'}
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
                  <button type="button" onClick={() => setDetailModalStatId('gross_volume')} onDragStart={(e) => e.stopPropagation()} style={{ fontSize: 12, color: chartColor, cursor: 'pointer', fontWeight: 500, background: 'none', border: 'none', padding: 0 }}>More details</button>
                </div>
              </div>
            )}
            {visibleMainWidgets.includes('net_volume') && (
              <div
                draggable={editMode}
                onDragStart={(e) => handleDragStart(e, 'net_volume', 'main')}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, 'net_volume')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'net_volume', 'main')}
                style={{
                  position: 'relative',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: editMode ? 'move' : 'default',
                  opacity: draggedId === 'net_volume' ? 0.5 : 1,
                  border: dragOverId === 'net_volume' && draggedId !== 'net_volume' ? `2px dashed ${chartColor}` : 'none',
                  transition: 'border 0.2s'
                }}
              >
                {editMode && (
                  <button type="button" onClick={() => handleRemoveMainWidget('net_volume')} onDragStart={(e) => e.stopPropagation()} style={removeButtonStyle} onMouseEnter={(e) => onRemoveButtonHover(e, true)} onMouseLeave={(e) => onRemoveButtonHover(e, false)} aria-label="Remove Net volume"><X size={12} strokeWidth={2.5} /></button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: textColor }}>Net volume</span>
                    <InfoWithPopover description="Revenue after refunds for the selected period. The chart shows daily or weekly net values over time." cardBg={cardBg} borderColor={borderColor} textColor={textColor} mutedColor={mutedColor} isDarkMode={isDarkMode} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailModalStatId('net_volume')}
                    onDragStart={(e) => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: textColor, fontWeight: 500 }}
                  >
                    <ExternalLink size={11} /> Explore
                  </button>
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
                      chartType={chartTypeByStatId.net_volume || 'line'}
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
                  <button type="button" onClick={() => setDetailModalStatId('net_volume')} onDragStart={(e) => e.stopPropagation()} style={{ fontSize: 12, color: chartColor, cursor: 'pointer', fontWeight: 500, background: 'none', border: 'none', padding: 0 }}>More details</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Row */}
        {visibleMainWidgets.filter((id) => MAIN_WIDGET_IDS_BOTTOM.includes(id)).length > 0 && (
          <div
            onDragOver={(e) => { if (editMode && draggedId) { e.preventDefault(); e.stopPropagation() } }}
            style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleMainWidgets.filter((id) => MAIN_WIDGET_IDS_BOTTOM.includes(id)).length}, 1fr)`, gap: 16 }}
          >
            {visibleMainWidgets.filter((id) => MAIN_WIDGET_IDS_BOTTOM.includes(id)).map((id) => {
              if (id === 'failed_payments') {
                return (
                  <div
                    key={id}
                    draggable={editMode}
                    onDragStart={(e) => handleDragStart(e, 'failed_payments', 'main')}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, 'failed_payments')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 'failed_payments', 'main')}
                    style={{
                      position: 'relative',
                      background: cardBg,
                      borderRadius: 12,
                      border: dragOverId === 'failed_payments' && draggedId !== 'failed_payments' ? `2px dashed ${chartColor}` : `1px solid ${borderColor}`,
                      padding: '20px 24px',
                      cursor: editMode ? 'move' : 'default',
                      opacity: draggedId === 'failed_payments' ? 0.5 : 1,
                      transition: 'border 0.2s'
                    }}
                  >
                    {editMode && (
                      <button type="button" onClick={() => handleRemoveMainWidget('failed_payments')} onDragStart={(e) => e.stopPropagation()} style={removeButtonStyle} onMouseEnter={(e) => onRemoveButtonHover(e, true)} onMouseLeave={(e) => onRemoveButtonHover(e, false)} aria-label="Remove Failed payments"><X size={12} strokeWidth={2.5} /></button>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: textColor }}>Failed payments</span>
                      <InfoWithPopover description="Count of voided or failed orders. These are transactions that did not complete successfully." cardBg={cardBg} borderColor={borderColor} textColor={textColor} mutedColor={mutedColor} isDarkMode={isDarkMode} />
                    </div>
                    <div style={{ border: `2px dashed ${borderColor}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: mutedColor, fontSize: 14 }}>
                      {((stats?.order_status_breakdown?.voided ?? 0) > 0) ? `${stats.order_status_breakdown.voided} voided order(s)` : 'No data'}
                    </div>
                  </div>
                )
              }
              if (id === 'top_customers') {
                return (
              <div
                key={id}
                draggable={editMode}
                onDragStart={(e) => handleDragStart(e, 'top_customers', 'main')}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, 'top_customers')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'top_customers', 'main')}
                style={{
                  position: 'relative',
                  background: cardBg,
                  borderRadius: 12,
                  border: dragOverId === 'top_customers' && draggedId !== 'top_customers' ? `2px dashed ${chartColor}` : `1px solid ${borderColor}`,
                  padding: '20px 24px',
                  cursor: editMode ? 'move' : 'default',
                  opacity: draggedId === 'top_customers' ? 0.5 : 1,
                  transition: 'border 0.2s'
                }}
              >
                {editMode && (
                  <button type="button" onClick={() => handleRemoveMainWidget('top_customers')} onDragStart={(e) => e.stopPropagation()} style={removeButtonStyle} onMouseEnter={(e) => onRemoveButtonHover(e, true)} onMouseLeave={(e) => onRemoveButtonHover(e, false)} aria-label="Remove Top customers"><X size={12} strokeWidth={2.5} /></button>
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
                )
              }
              return null
            })}
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
            <div
              onDragOver={(e) => { if (editMode && draggedId) { e.preventDefault(); e.stopPropagation() } }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}
            >
              {addedWidgetIds.map((id) => {
                const opt = ADDABLE_STAT_OPTIONS.find((o) => o.id === id)
                if (!opt) return null
                const Icon = opt.icon
                return (
                  <div
                    key={id}
                    draggable={editMode}
                    onDragStart={(e) => handleDragStart(e, id, 'added')}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, id, 'added')}
                    style={{
                      background: cardBg,
                      borderRadius: 12,
                      border: dragOverId === id && draggedId !== id ? `2px dashed ${chartColor}` : `1px solid ${borderColor}`,
                      padding: '20px 24px',
                      position: 'relative',
                      cursor: editMode ? 'move' : 'default',
                      opacity: draggedId === id ? 0.5 : 1,
                      transition: 'border 0.2s'
                    }}
                  >
                    {editMode && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAddedWidget(id)}
                        onDragStart={(e) => e.stopPropagation()}
                        style={removeButtonStyle}
                        onMouseEnter={(e) => onRemoveButtonHover(e, true)}
                        onMouseLeave={(e) => onRemoveButtonHover(e, false)}
                        aria-label="Remove"
                      >
                        <X size={12} strokeWidth={2.5} />
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
                          chartType={chartTypeByStatId.gross_volume || 'line'}
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

      {/* Stat detail modal: chart on left, info on right */}
      <Modal
        isOpen={!!detailModalStatId}
        onClose={() => setDetailModalStatId(null)}
        title={detailModalStatId === 'gross_volume' ? 'Gross volume' : detailModalStatId === 'net_volume' ? 'Net volume' : ''}
        size="xl"
      >
        {detailModalStatId && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
                <span style={{ fontSize: 13, color: mutedColor }}>Chart type</span>
                <Dropdown
                  value={CHART_TYPE_OPTIONS.find((o) => o.id === (chartTypeByStatId[detailModalStatId] || 'line'))?.label ?? 'Line'}
                  options={CHART_TYPE_OPTIONS.map((o) => o.label)}
                  onSelect={(label) => {
                    const opt = CHART_TYPE_OPTIONS.find((o) => o.label === label)
                    if (opt) setChartTypeForStat(detailModalStatId, opt.id)
                  }}
                  isDarkMode={isDarkMode}
                  borderColor={borderColor}
                  bg={cardBg}
                  textColor={textColor}
                  mutedColor={mutedColor}
                />
              </div>
              <div style={{ height: 320, minHeight: 320, flexShrink: 0 }}>
                {detailModalStatId === 'gross_volume' && (
                  <MiniChartWithTooltip
                    data={chartGross}
                    dates={dates}
                    title="Gross volume"
                    height={300}
                    color={chartColor}
                    formatValue={formatCurrency}
                    comparisonValue={prevPeriod}
                    comparisonLabel="Previous period"
                    theme={{ cardBg, borderColor, textColor, mutedColor }}
                    chartType={chartTypeByStatId.gross_volume || 'line'}
                    tooltipFixedPosition
                  />
                )}
                {detailModalStatId === 'net_volume' && (
                  <MiniChartWithTooltip
                    data={chartNet}
                    dates={dates}
                    title="Net volume"
                    height={300}
                    color={chartColor}
                    formatValue={formatCurrency}
                    comparisonValue={prevPeriod}
                    comparisonLabel="Previous period"
                    theme={{ cardBg, borderColor, textColor, mutedColor }}
                    chartType={chartTypeByStatId.net_volume || 'line'}
                    tooltipFixedPosition
                  />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: mutedColor, flexShrink: 0 }}>
                <span>{dates[0] || '—'}</span>
                <span>{dates[dates.length - 1] || '—'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingLeft: 16, borderLeft: `1px solid ${borderColor}` }}>
              <div>
                <div style={{ fontSize: 13, color: mutedColor, marginBottom: 8 }}>
                  {detailModalStatId === 'gross_volume' && 'Total revenue (before refunds or fees) for the selected period. The chart shows daily or weekly values over time.'}
                  {detailModalStatId === 'net_volume' && 'Revenue after refunds for the selected period. The chart shows daily or weekly net values over time.'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: mutedColor }}>Current period</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: textColor }}>
                    {detailModalStatId === 'gross_volume' && formatCurrency(revWeek)}
                    {detailModalStatId === 'net_volume' && formatCurrency(netWeek)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: mutedColor }}>Previous period</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: textColor }}>{formatCurrency(prevPeriod)}</span>
                </div>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 16, fontSize: 12, color: mutedColor }}>
                Updated from platform
              </div>
            </div>
          </div>
        )}
      </Modal>

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
                  background: cardBg,
                  borderRadius: 12,
                  border: `1px solid ${borderColor}`,
                  padding: '20px 24px',
                  position: 'relative'
                }}
              >
                {isAdded ? (
                  <button
                    type="button"
                    disabled
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: chartColor,
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'default',
                      color: '#fff',
                      fontWeight: 600,
                      opacity: 0.7
                    }}
                  >
                    Added
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAddWidget(opt.id)}
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: chartColor,
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      color: '#fff',
                      fontWeight: 600,
                      zIndex: 1
                    }}
                  >
                    <Plus size={12} /> Add
                  </button>
                )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    {Icon && <Icon size={18} color={chartColor} />}
                    <span style={{ fontSize: 14, fontWeight: 600, color: textColor }}>{opt.label}</span>
                  </div>
                  {opt.id === 'weekly_revenue_chart' && (
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
                        chartType={chartTypeByStatId.gross_volume || 'line'}
                      />
                    </div>
                  )}
                  {opt.id === 'order_status_breakdown' && (
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
                  {opt.id === 'top_products' && (
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
                  {opt.id === 'today_revenue' && (
                    <div style={{ fontSize: 24, fontWeight: 700, color: textColor }}>{formatCurrency(stats?.revenue?.today ?? 0)}</div>
                  )}
                  {opt.id === 'inventory_snapshot' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: textColor }}>
                      <div>Total products: <strong>{stats?.inventory?.total_products ?? 0}</strong></div>
                      <div>Low stock (≤10): <strong>{stats?.inventory?.low_stock ?? 0}</strong></div>
                      <div>Inventory value: <strong>{formatCurrency(stats?.inventory?.total_value)}</strong></div>
                    </div>
                  )}
                  {opt.id === 'discounts_summary' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: textColor }}>
                      <div>Today: {formatCurrency(stats?.discount?.today)}</div>
                      <div>This week: {formatCurrency(stats?.discount?.week)}</div>
                      <div>This month: {formatCurrency(stats?.discount?.month)}</div>
                    </div>
                  )}
                  {opt.id === 'customers_count' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: textColor }}>
                      <div>Total customers: <strong>{stats?.customers_total ?? 0}</strong></div>
                      <div>With loyalty points: <strong>{stats?.customers_in_rewards ?? 0}</strong></div>
                    </div>
                  )}
              </div>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
