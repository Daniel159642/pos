import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'

function Statistics() {
  // All hooks must be declared at the top, before any early returns
  const { themeMode, themeColor } = useTheme()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeView, setActiveView] = useState(0) // 0 = Weekly Revenue, 1 = Overview
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [mouseStart, setMouseStart] = useState(null)
  const [mouseEnd, setMouseEnd] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)
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
    
    // Check initially
    checkDarkMode()
    
    // Watch for class changes
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    
    return () => observer.disconnect()
  }, [themeMode])

  // Minimum swipe distance (in pixels)
  const minSwipeDistance = 50

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

  const renderWeeklyChart = () => {
    if (!stats || !stats.weekly_revenue || stats.weekly_revenue.length === 0) {
      return <div style={{ padding: '20px', textAlign: 'center', color: isDarkMode ? '#fff' : '#999', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No revenue data</div>
    }

    const maxRevenue = Math.max(...stats.weekly_revenue.map(d => d.revenue), 1)
    const chartHeight = 200
    const svgWidth = 400
    const barWidth = 40
    const spacing = 20
    
    // Theme-aware colors
    const axisColor = isDarkMode ? '#fff' : '#ddd'
    const dayLabelColor = isDarkMode ? '#fff' : '#666'
    const revenueLabelColor = isDarkMode ? '#fff' : '#333'
    const titleColor = isDarkMode ? '#fff' : '#333'
    // Bar color uses theme color
    const barColor = isDarkMode ? `rgba(${themeColorRgb}, 0.6)` : `rgba(${themeColorRgb}, 0.5)`

    return (
      <div style={{ padding: '8px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '100%', flexShrink: 0, boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 500, color: titleColor }}>
          Weekly Revenue
        </h3>
        <div style={{ overflow: 'hidden', width: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${chartHeight + 25}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible', maxWidth: '100%', minHeight: '200px' }}>
            {/* Bars */}
            {stats.weekly_revenue.map((day, index) => {
              const barHeight = maxRevenue > 0 ? (day.revenue / maxRevenue) * chartHeight : 0
              const x = spacing + index * (barWidth + spacing)
              const y = chartHeight - barHeight
              
              return (
                <g key={day.date}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={barColor}
                  rx="4"
                />
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fontSize="9"
                  fill={dayLabelColor}
                >
                  {day.day}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={y - 2}
                  textAnchor="middle"
                  fontSize="8"
                  fill={revenueLabelColor}
                  fontWeight="500"
                >
                  ${day.revenue.toFixed(0)}
                  </text>
                </g>
              )
            })}
          
          {/* Y-axis line */}
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={chartHeight}
            stroke={axisColor}
            strokeWidth="1"
          />
          
          {/* X-axis line */}
          <line
            x1={0}
            y1={chartHeight}
            x2={svgWidth}
            y2={chartHeight}
            stroke={axisColor}
            strokeWidth="1"
          />
          </svg>
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
        Loading...
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
        color: isDarkMode ? '#fff' : '#999'
      }}>
        {error}
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const renderOverview = () => {
    const titleColor = isDarkMode ? '#fff' : '#333'
    const valueColor = isDarkMode ? '#fff' : '#333'
    const labelColor = isDarkMode ? '#e0e0e0' : '#666'
    
    return (
      <div style={{
        padding: '8px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minWidth: '100%',
        flexShrink: 0,
        boxSizing: 'border-box'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 500, color: titleColor }}>
          Overview
        </h3>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 600, color: valueColor, marginBottom: '4px' }}>
              {stats.total_orders || 0}
            </div>
            <div style={{ fontSize: '11px', color: labelColor }}>
              Total Orders
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 600, color: valueColor, marginBottom: '4px' }}>
              {stats.total_returns || 0}
            </div>
            <div style={{ fontSize: '11px', color: labelColor }}>
              Total Returns
            </div>
          </div>
        </div>
      </div>
    )
  }

  const onTouchStart = (e) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && activeView < 1) {
      setIsTransitioning(true)
      setActiveView(activeView + 1)
      setTimeout(() => setIsTransitioning(false), 300)
    }
    if (isRightSwipe && activeView > 0) {
      setIsTransitioning(true)
      setActiveView(activeView - 1)
      setTimeout(() => setIsTransitioning(false), 300)
    }
  }

  // Mouse drag support for desktop
  const onMouseDown = (e) => {
    setIsDragging(true)
    setMouseEnd(null)
    setMouseStart(e.clientX)
  }

  const onMouseMove = (e) => {
    if (!isDragging) return
    setMouseEnd(e.clientX)
  }

  const onMouseUp = () => {
    if (!isDragging) return
    setIsDragging(false)
    
    if (mouseStart && mouseEnd) {
      const distance = mouseStart - mouseEnd
      const isLeftSwipe = distance > minSwipeDistance
      const isRightSwipe = distance < -minSwipeDistance

      if (isLeftSwipe && activeView < 1) {
        setIsTransitioning(true)
        setActiveView(activeView + 1)
        setTimeout(() => setIsTransitioning(false), 300)
      }
      if (isRightSwipe && activeView > 0) {
        setIsTransitioning(true)
        setActiveView(activeView - 1)
        setTimeout(() => setIsTransitioning(false), 300)
      }
    }
    
    setMouseStart(null)
    setMouseEnd(null)
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Viewer Content with Sliding */}
      <div 
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div style={{
          display: 'flex',
          height: '100%',
          width: '200%',
          transform: `translateX(-${activeView * 50}%)`,
          transition: isTransitioning ? 'transform 0.3s ease-out' : 'none'
        }}>
          {/* Weekly Revenue View */}
          <div style={{
            width: '50%',
            height: '100%',
            overflow: 'auto',
            flexShrink: 0
          }}>
            {renderWeeklyChart()}
          </div>

          {/* Overview View */}
          <div style={{
            width: '50%',
            height: '100%',
            overflow: 'auto',
            flexShrink: 0
          }}>
            {renderOverview()}
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '12px',
        padding: '16px',
        backgroundColor: 'transparent'
      }}>
        <button
          onClick={() => setActiveView(0)}
          style={{
            padding: '6px 12px',
            border: 'none',
            backgroundColor: 'transparent',
            color: activeView === 0 ? 'var(--text-primary, #333)' : 'var(--text-tertiary, #999)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: activeView === 0 ? 600 : 400,
            transition: 'all 0.2s',
            textDecoration: activeView === 0 ? 'underline' : 'none'
          }}
          aria-label="Chart"
        >
          Chart
        </button>
        <button
          onClick={() => setActiveView(1)}
          style={{
            padding: '6px 12px',
            border: 'none',
            backgroundColor: 'transparent',
            color: activeView === 1 ? 'var(--text-primary, #333)' : 'var(--text-tertiary, #999)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: activeView === 1 ? 600 : 400,
            transition: 'all 0.2s',
            textDecoration: activeView === 1 ? 'underline' : 'none'
          }}
          aria-label="Overview"
        >
          Overview
        </button>
      </div>
    </div>
  )
}

export default Statistics

