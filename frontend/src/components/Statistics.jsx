import { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { DollarSign, TrendingUp, Award, ShoppingCart, RotateCcw, Package, Coins } from 'lucide-react'

function Statistics() {
  const { themeMode, themeColor } = useTheme()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark-theme')
  })
  
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

  const renderWeeklyChart = () => {
    if (!stats?.weekly_revenue || stats.weekly_revenue.length === 0) {
      return <div style={{ padding: '20px', textAlign: 'center', color: isDarkMode ? '#999' : '#999' }}>No revenue data</div>
    }

    const maxRevenue = Math.max(...stats.weekly_revenue.map(d => d.revenue), 1)
    const chartHeight = 180
    const svgWidth = 100
    const barWidth = 12
    const spacing = 8
    
    const axisColor = isDarkMode ? '#444' : '#ddd'
    const dayLabelColor = isDarkMode ? '#999' : '#666'
    const revenueLabelColor = isDarkMode ? '#fff' : '#333'
    const barColor = `rgba(${themeColorRgb}, ${isDarkMode ? '0.7' : '0.6'})`

    // Define two different blue shades for alternating bars
    const barColor1 = `rgba(${themeColorRgb}, ${isDarkMode ? '0.7' : '0.6'})`
    const barColor2 = `rgba(${themeColorRgb}, ${isDarkMode ? '0.5' : '0.4'})`

    return (
      <div style={{ padding: '16px', height: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', gap: '4px', overflow: 'hidden' }}>
          {stats.weekly_revenue.map((day, index) => {
            const barHeight = maxRevenue > 0 ? (day.revenue / maxRevenue) * chartHeight : 0
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
        <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#fff' : '#333', marginTop: '12px', textAlign: 'center' }}>
          Weekly Revenue (Last 7 Days)
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
    </div>
  )
}

export default Statistics
