import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { DollarSign, RotateCcw, ChevronDown } from 'lucide-react'

const STAT_OPTIONS = [
  { id: 'weekly_revenue', label: 'Weekly Revenue (Last 7 Days)' },
  { id: 'monthly_revenue', label: 'Monthly Revenue (Last 12 Months)' },
  { id: 'order_status', label: 'Order Status Breakdown' },
  { id: 'top_products', label: 'Top Products (Last 30 Days)' }
]

const FORMAT_OPTIONS = {
  weekly_revenue: [
    { id: 'bar', label: 'Bar chart' },
    { id: 'line', label: 'Line chart' },
    { id: 'area', label: 'Area chart' },
    { id: 'table', label: 'Table' }
  ],
  monthly_revenue: [
    { id: 'bar', label: 'Bar chart' },
    { id: 'line', label: 'Line chart' },
    { id: 'area', label: 'Area chart' },
    { id: 'table', label: 'Table' }
  ],
  order_status: [
    { id: 'bar', label: 'Bar chart' },
    { id: 'table', label: 'Table' }
  ],
  top_products: [
    { id: 'bar', label: 'Bar chart' },
    { id: 'table', label: 'Table' }
  ]
}

function Statistics({ compact = false }) {
  const { themeMode, themeColor } = useTheme()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark-theme')
  })
  const [selectedStat, setSelectedStat] = useState('weekly_revenue')
  const [selectedFormat, setSelectedFormat] = useState('bar')
  const [formatOpen, setFormatOpen] = useState(false)
  const [statOpen, setStatOpen] = useState(false)
  const dropdownRef = useRef(null)
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  // Update dark mode state when theme changes
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
    loadStats()
  }, [])

  useEffect(() => {
    const formats = FORMAT_OPTIONS[selectedStat] || []
    const hasCurrent = formats.some((f) => f.id === selectedFormat)
    if (!hasCurrent && formats.length) setSelectedFormat(formats[0].id)
  }, [selectedStat, selectedFormat])

  useEffect(() => {
    const onOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setStatOpen(false)
        setFormatOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const formatOptions = FORMAT_OPTIONS[selectedStat] || []

  const loadStats = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/dashboard/statistics')
      if (!response.ok) {
        throw new Error('Failed to load statistics')
      }
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError('Error loading statistics')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const StatCard = ({ title, value, subtitle, icon, color }) => {
    const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff'
    const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
    const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
    const subtitleColor = isDarkMode ? '#999' : '#666'
    
    return (
      <div style={{
        backgroundColor: cardBg,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '24px',
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {icon && (
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            fontSize: '32px',
            opacity: 0.1
          }}>
            {icon}
          </div>
        )}
        <div style={{
          fontSize: '28px',
          fontWeight: 700,
          color: color || textColor,
          marginBottom: '8px',
          lineHeight: 1.2
        }}>
          {value}
        </div>
        <div style={{
          fontSize: '13px',
          fontWeight: 500,
          color: subtitleColor,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {title}
          {subtitle && (
            <span style={{
              fontSize: '12px',
              color: subtitleColor,
              marginLeft: '8px',
              textTransform: 'none'
            }}>
              {subtitle}
            </span>
          )}
        </div>
      </div>
    )
  }

  const renderWeeklyChart = (titleBelowAxis = null) => {
    if (!stats?.weekly_revenue || stats.weekly_revenue.length === 0) {
      return <div style={{ padding: '20px', textAlign: 'center', color: isDarkMode ? '#999' : '#999' }}>No revenue data</div>
    }

    const maxRevenue = Math.max(...stats.weekly_revenue.map(d => d.revenue), 1)
    const isCompact = !!titleBelowAxis
    const chartHeight = isCompact ? 120 : 180
    const axisColor = isDarkMode ? '#444' : '#ddd'
    const dayLabelColor = isDarkMode ? '#999' : '#666'
    const barColor1 = `rgba(${themeColorRgb}, ${isDarkMode ? '0.7' : '0.6'})`
    const barColor2 = `rgba(${themeColorRgb}, ${isDarkMode ? '0.5' : '0.4'})`
    const barScale = titleBelowAxis ? 0.65 : 1
    const effectiveMax = maxRevenue / barScale

    const containerPadding = isCompact ? '0 12px 4px' : '16px'
    const titleMarginTop = isCompact ? '4px' : '12px'

    return (
      <div style={{ padding: containerPadding, height: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: `${chartHeight}px`, gap: '4px', overflow: 'hidden' }}>
          {stats.weekly_revenue.map((day, index) => {
            const barHeight = maxRevenue > 0 ? (day.revenue / effectiveMax) * chartHeight : 0
            const isEven = index % 2 === 0
            const currentBarColor = isEven ? barColor1 : barColor2

            return (
              <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '100%',
                  height: `${barHeight}px`,
                  backgroundColor: currentBarColor,
                  borderRadius: '12px 12px 0 0',
                  minHeight: barHeight > 0 ? '4px' : '0',
                  transition: 'height 0.3s ease',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {barHeight > 30 && (
                    <div style={{
                      position: 'absolute',
                      fontSize: '9px',
                      color: '#fff',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                    }}>
                      ${Math.round(day.revenue)}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: dayLabelColor, fontWeight: 500 }}>
                  {day.day}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#fff' : '#333', marginTop: titleMarginTop, textAlign: 'center' }}>
          {titleBelowAxis ?? 'Weekly Revenue (Last 7 Days)'}
        </div>
      </div>
    )
  }

  const renderMonthlyChart = () => {
    if (!stats?.monthly_revenue || stats.monthly_revenue.length === 0) {
      return <div style={{ padding: '20px', textAlign: 'center', color: isDarkMode ? '#999' : '#999' }}>No revenue data</div>
    }

    const maxRevenue = Math.max(...stats.monthly_revenue.map(d => d.revenue), 1)
    const chartHeight = 180
    const chartWidth = 400
    const pointRadius = 4
    const lineColor = `rgba(${themeColorRgb}, ${isDarkMode ? '0.8' : '0.7'})`
    const fillColor = `rgba(${themeColorRgb}, ${isDarkMode ? '0.15' : '0.1'})`
    const monthLabelColor = isDarkMode ? '#999' : '#666'
    
    const points = stats.monthly_revenue.map((month, index) => {
      const x = (index / (stats.monthly_revenue.length - 1)) * chartWidth
      const y = chartHeight - (month.revenue / maxRevenue) * chartHeight
      return { x, y, month, revenue: month.revenue }
    })

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const areaPath = `${pathData} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`

    return (
      <div style={{ padding: '16px', height: '100%' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#fff' : '#333', marginBottom: '16px' }}>
          Monthly Revenue (Last 12 Months)
        </div>
        <div style={{ position: 'relative', height: '180px', marginBottom: '24px' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
            {/* Area fill */}
            <path d={areaPath} fill={fillColor} />
            {/* Line */}
            <path d={pathData} fill="none" stroke={lineColor} strokeWidth="2" />
            {/* Points */}
            {points.map((point, i) => (
              <g key={i}>
                <circle cx={point.x} cy={point.y} r={pointRadius} fill={lineColor} />
                <text
                  x={point.x}
                  y={chartHeight + 16}
                  textAnchor="middle"
                  fontSize="9"
                  fill={monthLabelColor}
                >
                  {point.month.month_name}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    )
  }

  const renderOrderStatusBreakdown = () => {
    if (!stats?.order_status_breakdown) {
      return <div style={{ padding: '20px', textAlign: 'center', color: isDarkMode ? '#999' : '#999' }}>No data</div>
    }

    const statuses = Object.entries(stats.order_status_breakdown)
    const total = statuses.reduce((sum, [, count]) => sum + count, 0)
    
    if (total === 0) {
      return <div style={{ padding: '20px', textAlign: 'center', color: isDarkMode ? '#999' : '#999' }}>No orders</div>
    }

    const colors = [
      `rgba(${themeColorRgb}, 0.8)`,
      `rgba(${themeColorRgb}, 0.6)`,
      `rgba(${themeColorRgb}, 0.4)`,
      `rgba(${themeColorRgb}, 0.3)`,
      `rgba(${themeColorRgb}, 0.2)`
    ]

    const textColor = isDarkMode ? '#fff' : '#333'
    const labelColor = isDarkMode ? '#999' : '#666'

    return (
      <div style={{ padding: '16px', height: '100%' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: textColor, marginBottom: '16px' }}>
          Order Status Breakdown
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {statuses.map(([status, count], index) => {
            const percentage = ((count / total) * 100).toFixed(1)
            const color = colors[index % colors.length]
            
            return (
              <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: textColor, textTransform: 'capitalize' }}>
                    {status.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: textColor }}>
                    {count} ({percentage}%)
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    backgroundColor: color,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderTopProducts = () => {
    if (!stats?.top_products || stats.top_products.length === 0) {
      return <div style={{ padding: '20px', textAlign: 'center', color: isDarkMode ? '#999' : '#999' }}>No product data</div>
    }

    const textColor = isDarkMode ? '#fff' : '#333'
    const labelColor = isDarkMode ? '#999' : '#666'
    const borderColor = isDarkMode ? '#333' : '#e0e0e0'

    return (
      <div style={{ padding: '16px', height: '100%' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: textColor, marginBottom: '16px' }}>
          Top Products (Last 30 Days)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
          {stats.top_products.map((product, index) => (
            <div key={product.product_id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f9f9',
              borderRadius: '8px',
              border: `1px solid ${borderColor}`
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: textColor, marginBottom: '4px' }}>
                  #{index + 1} {product.product_name}
                </div>
                <div style={{ fontSize: '11px', color: labelColor }}>
                  {product.total_quantity} sold • {formatCurrency(product.total_revenue)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderRevenueBar = (data, labelKey, valueKey, title) => {
    if (!data || data.length === 0) {
      return <div style={{ padding: '24px', textAlign: 'center', color: isDarkMode ? '#999' : '#666' }}>No data</div>
    }
    const maxVal = Math.max(...data.map((d) => d[valueKey]), 1)
    const chartHeight = 200
    const barColor1 = `rgba(${themeColorRgb}, ${isDarkMode ? '0.7' : '0.6'})`
    const barColor2 = `rgba(${themeColorRgb}, ${isDarkMode ? '0.5' : '0.4'})`
    const labelColor = isDarkMode ? '#999' : '#666'
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#fff' : '#333', marginBottom: '16px' }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: chartHeight }}>
          {data.map((item, i) => {
            const h = maxVal > 0 ? (item[valueKey] / maxVal) * chartHeight : 0
            return (
              <div key={item[labelKey] || i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '100%',
                  height: `${Math.max(h, 4)}px`,
                  backgroundColor: i % 2 === 0 ? barColor1 : barColor2,
                  borderRadius: '8px 8px 0 0',
                  minHeight: '4px',
                  position: 'relative'
                }}>
                  {h > 28 && (
                    <span style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: '#fff', fontWeight: 600 }}>${Math.round(item[valueKey])}</span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: labelColor }}>{item[labelKey]}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderRevenueLine = (data, labelKey, valueKey, title, withArea = false) => {
    if (!data || data.length === 0) {
      return <div style={{ padding: '24px', textAlign: 'center', color: isDarkMode ? '#999' : '#666' }}>No data</div>
    }
    const maxVal = Math.max(...data.map((d) => d[valueKey]), 1)
    const w = 500
    const h = 220
    const lineColor = `rgba(${themeColorRgb}, ${isDarkMode ? '0.8' : '0.7'})`
    const fillColor = `rgba(${themeColorRgb}, ${isDarkMode ? '0.2' : '0.15'})`
    const labelColor = isDarkMode ? '#999' : '#666'
    const pts = data.map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * w
      const y = h - 40 - (d[valueKey] / maxVal) * (h - 50)
      return { x, y, ...d }
    })
    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const areaD = `${pathD} L ${w} ${h} L 0 ${h} Z`
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#fff' : '#333', marginBottom: '16px' }}>{title}</div>
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
          {withArea && <path d={areaD} fill={fillColor} />}
          <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill={lineColor} />
              <text x={p.x} y={h - 8} textAnchor="middle" fontSize="10" fill={labelColor}>{p[labelKey]}</text>
            </g>
          ))}
        </svg>
      </div>
    )
  }

  const renderRevenueArea = (data, labelKey, valueKey, title) => {
    return renderRevenueLine(data, labelKey, valueKey, title, true)
  }

  const renderRevenueTable = (data, labelKey, valueKey, title) => {
    if (!data || data.length === 0) {
      return <div style={{ padding: '24px', textAlign: 'center', color: isDarkMode ? '#999' : '#666' }}>No data</div>
    }
    const textColor = isDarkMode ? '#fff' : '#333'
    const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: textColor, marginBottom: '16px' }}>{title}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${borderColor}`, color: textColor }}>Period</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: `2px solid ${borderColor}`, color: textColor }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${borderColor}`, color: textColor }}>{row[labelKey]}</td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${borderColor}`, color: textColor, textAlign: 'right' }}>{formatCurrency(row[valueKey])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderStatusBar = () => {
    const d = stats?.order_status_breakdown
    if (!d || Object.keys(d).length === 0) {
      return <div style={{ padding: '24px', textAlign: 'center', color: isDarkMode ? '#999' : '#666' }}>No data</div>
    }
    const entries = Object.entries(d)
    const total = entries.reduce((s, [, c]) => s + c, 0)
    const labelColor = isDarkMode ? '#999' : '#666'
    const colors = [`rgba(${themeColorRgb}, 0.8)`, `rgba(${themeColorRgb}, 0.6)`, `rgba(${themeColorRgb}, 0.4)`, `rgba(${themeColorRgb}, 0.3)`]
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#fff' : '#333', marginBottom: '16px' }}>Order Status Breakdown</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {entries.map(([status, count], i) => {
            const pct = total ? ((count / total) * 100).toFixed(1) : 0
            return (
              <div key={status}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: isDarkMode ? '#fff' : '#333', textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? '#fff' : '#333' }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height: '10px', backgroundColor: isDarkMode ? '#333' : '#eee', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', backgroundColor: colors[i % colors.length], borderRadius: '6px' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderStatusTable = () => {
    const d = stats?.order_status_breakdown
    if (!d || Object.keys(d).length === 0) {
      return <div style={{ padding: '24px', textAlign: 'center', color: isDarkMode ? '#999' : '#666' }}>No data</div>
    }
    const entries = Object.entries(d)
    const total = entries.reduce((s, [, c]) => s + c, 0)
    const textColor = isDarkMode ? '#fff' : '#333'
    const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: textColor, marginBottom: '16px' }}>Order Status Breakdown</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${borderColor}`, color: textColor }}>Status</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: `2px solid ${borderColor}`, color: textColor }}>Count</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: `2px solid ${borderColor}`, color: textColor }}>%</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([status, count]) => {
                const pct = total ? ((count / total) * 100).toFixed(1) : 0
                return (
                  <tr key={status}>
                    <td style={{ padding: '10px 12px', borderBottom: `1px solid ${borderColor}`, color: textColor, textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '10px 12px', borderBottom: `1px solid ${borderColor}`, color: textColor, textAlign: 'right' }}>{count}</td>
                    <td style={{ padding: '10px 12px', borderBottom: `1px solid ${borderColor}`, color: textColor, textAlign: 'right' }}>{pct}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderProductsBar = () => {
    const data = stats?.top_products || []
    if (data.length === 0) {
      return <div style={{ padding: '24px', textAlign: 'center', color: isDarkMode ? '#999' : '#666' }}>No product data</div>
    }
    const maxQty = Math.max(...data.map((p) => p.total_quantity), 1)
    const chartHeight = Math.min(320, data.length * 36)
    const barColor = `rgba(${themeColorRgb}, ${isDarkMode ? '0.6' : '0.5'})`
    const labelColor = isDarkMode ? '#999' : '#666'
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#fff' : '#333', marginBottom: '16px' }}>Top Products (Last 30 Days)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.map((p, i) => {
            const w = maxQty ? (p.total_quantity / maxQty) * 100 : 0
            return (
              <div key={p.product_id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: '0 0 140px', fontSize: '12px', color: labelColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product_name}</div>
                <div style={{ flex: 1, height: '24px', backgroundColor: isDarkMode ? '#333' : '#eee', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${w}%`, height: '100%', backgroundColor: barColor, borderRadius: '6px' }} />
                </div>
                <div style={{ flex: '0 0 70px', fontSize: '12px', fontWeight: 600, color: isDarkMode ? '#fff' : '#333', textAlign: 'right' }}>{p.total_quantity} sold</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderProductsTable = () => {
    const data = stats?.top_products || []
    if (data.length === 0) {
      return <div style={{ padding: '24px', textAlign: 'center', color: isDarkMode ? '#999' : '#666' }}>No product data</div>
    }
    const textColor = isDarkMode ? '#fff' : '#333'
    const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: textColor, marginBottom: '16px' }}>Top Products (Last 30 Days)</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${borderColor}`, color: textColor }}>#</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: `2px solid ${borderColor}`, color: textColor }}>Product</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: `2px solid ${borderColor}`, color: textColor }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: `2px solid ${borderColor}`, color: textColor }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p, i) => (
                <tr key={p.product_id}>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${borderColor}`, color: textColor }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${borderColor}`, color: textColor }}>{p.product_name}</td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${borderColor}`, color: textColor, textAlign: 'right' }}>{p.total_quantity}</td>
                  <td style={{ padding: '10px 12px', borderBottom: `1px solid ${borderColor}`, color: textColor, textAlign: 'right' }}>{formatCurrency(p.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderCustomView = () => {
    if (selectedStat === 'weekly_revenue') {
      const data = stats?.weekly_revenue || []
      const labelKey = 'day'
      const valueKey = 'revenue'
      const title = 'Weekly Revenue (Last 7 Days)'
      if (selectedFormat === 'bar') return renderRevenueBar(data, labelKey, valueKey, title)
      if (selectedFormat === 'line') return renderRevenueLine(data, labelKey, valueKey, title)
      if (selectedFormat === 'area') return renderRevenueArea(data, labelKey, valueKey, title)
      return renderRevenueTable(data, labelKey, valueKey, title)
    }
    if (selectedStat === 'monthly_revenue') {
      const data = stats?.monthly_revenue || []
      const labelKey = 'month_name'
      const valueKey = 'revenue'
      const title = 'Monthly Revenue (Last 12 Months)'
      if (selectedFormat === 'bar') return renderRevenueBar(data, labelKey, valueKey, title)
      if (selectedFormat === 'line') return renderRevenueLine(data, labelKey, valueKey, title)
      if (selectedFormat === 'area') return renderRevenueArea(data, labelKey, valueKey, title)
      return renderRevenueTable(data, labelKey, valueKey, title)
    }
    if (selectedStat === 'order_status') {
      if (selectedFormat === 'bar') return renderStatusBar()
      return renderStatusTable()
    }
    if (selectedStat === 'top_products') {
      if (selectedFormat === 'bar') return renderProductsBar()
      return renderProductsTable()
    }
    return null
  }

  if (loading) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: isDarkMode ? '#fff' : '#999'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>Loading statistics...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: isDarkMode ? '#ff4444' : '#cc0000'
      }}>
        {error}
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const cardBg = isDarkMode ? '#2a2a2a' : '#ffffff'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  if (compact) {
    const maxRevenue = Math.max(...(stats?.weekly_revenue || []).map(d => d.revenue), 1)
    const barScale = 0.65
    const effectiveMax = maxRevenue / barScale
    const dayLabelColor = isDarkMode ? '#999' : '#666'
    const barColor1 = `rgba(${themeColorRgb}, ${isDarkMode ? '0.7' : '0.6'})`
    const barColor2 = `rgba(${themeColorRgb}, ${isDarkMode ? '0.5' : '0.4'})`

    if (!stats?.weekly_revenue || stats.weekly_revenue.length === 0) {
      return (
        <div style={{ padding: '12px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDarkMode ? '#999' : '#666', fontSize: '14px' }}>
          No revenue data
        </div>
      )
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        padding: '6px 10px 6px'
      }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
          {stats.weekly_revenue.map((day, index) => {
            const barPct = maxRevenue > 0 ? Math.min(100, (day.revenue / effectiveMax) * 100) : 0
            const isEven = index % 2 === 0
            const barColor = isEven ? barColor1 : barColor2
            return (
              <div
                key={day.date}
                style={{
                  flex: 1,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '4px'
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${barPct}%`,
                    minHeight: barPct > 0 ? '4px' : 0,
                    backgroundColor: barColor,
                    borderRadius: '10px 10px 0 0',
                    transition: 'height 0.3s ease',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}
                >
                  {barPct > 25 && (
                    <span style={{ fontSize: '9px', fontWeight: 600, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                      ${Math.round(day.revenue)}
                    </span>
                  )}
                </div>
                <div style={{ flexShrink: 0, fontSize: '10px', color: dayLabelColor, fontWeight: 500 }}>
                  {day.day}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ flexShrink: 0, fontSize: '13px', fontWeight: 600, color: isDarkMode ? '#fff' : '#333', textAlign: 'center', marginTop: '2px' }}>
          Last Seven Days
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      width: '100%',
      overflowY: 'hidden',
      overflowX: 'hidden',
      padding: '0'
    }}>
      {/* Today's Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '20px'
      }}>
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats.revenue?.today || 0)}
          icon={<DollarSign size={32} />}
          color={`rgba(${themeColorRgb}, 1)`}
        />
        <StatCard
          title="Today's Returns"
          value={stats.returns?.today || 0}
          subtitle={stats.returns?.today_amount ? `Amount: ${formatCurrency(stats.returns.today_amount)}` : undefined}
          icon={<RotateCcw size={32} />}
          color={`rgba(${themeColorRgb}, 1)`}
        />
      </div>

      {/* Weekly Revenue Chart */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '24px'
      }}>
        <div style={{
          backgroundColor: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: '12px',
          boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          minHeight: '280px',
          overflow: 'hidden'
        }}>
          {renderWeeklyChart()}
        </div>
      </div>

      <div style={{
        marginTop: '32px',
        paddingTop: '28px',
        borderTop: `1px solid ${borderColor}`
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: isDarkMode ? '#fff' : '#1a1a1a',
          marginBottom: '20px',
          letterSpacing: '0.3px'
        }}>
          Customizable dashboard
        </h2>
        <div ref={dropdownRef} style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#999' : '#666', display: 'block', marginBottom: '4px' }}>Statistic</label>
            <button
              type="button"
              onClick={() => { setStatOpen((o) => !o); setFormatOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '220px',
                padding: '10px 14px',
                backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                border: `1px solid ${borderColor}`,
                borderRadius: '10px',
                color: isDarkMode ? '#fff' : '#333',
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.06)'
              }}
            >
              {STAT_OPTIONS.find((o) => o.id === selectedStat)?.label ?? 'Select'}
              <ChevronDown size={16} style={{ marginLeft: 'auto', opacity: 0.7, transform: statOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {statOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                minWidth: '220px',
                backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                border: `1px solid ${borderColor}`,
                borderRadius: '10px',
                boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 100,
                overflow: 'hidden'
              }}>
                {STAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setSelectedStat(opt.id); setStatOpen(false) }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: selectedStat === opt.id ? (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : 'transparent',
                      border: 'none',
                      color: isDarkMode ? '#fff' : '#333',
                      fontSize: '14px',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#999' : '#666', display: 'block', marginBottom: '4px' }}>Format</label>
            <button
              type="button"
              onClick={() => { setFormatOpen((o) => !o); setStatOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '160px',
                padding: '10px 14px',
                backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                border: `1px solid ${borderColor}`,
                borderRadius: '10px',
                color: isDarkMode ? '#fff' : '#333',
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.06)'
              }}
            >
              {formatOptions.find((o) => o.id === selectedFormat)?.label ?? 'Select'}
              <ChevronDown size={16} style={{ marginLeft: 'auto', opacity: 0.7, transform: formatOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {formatOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                minWidth: '160px',
                backgroundColor: isDarkMode ? '#2a2a2a' : '#fff',
                border: `1px solid ${borderColor}`,
                borderRadius: '10px',
                boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 100,
                overflow: 'hidden'
              }}>
                {formatOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setSelectedFormat(opt.id); setFormatOpen(false) }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: selectedFormat === opt.id ? (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : 'transparent',
                      border: 'none',
                      color: isDarkMode ? '#fff' : '#333',
                      fontSize: '14px',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{
          backgroundColor: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: '12px',
          boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          minHeight: '320px',
          overflow: 'hidden'
        }}>
          {renderCustomView()}
        </div>
      </div>
    </div>
  )
}

export default Statistics
