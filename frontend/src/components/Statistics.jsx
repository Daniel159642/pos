import { useState, useEffect, useRef } from 'react'

function Statistics() {
  // All hooks must be declared at the top, before any early returns
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
      return <div style={{ padding: '20px', textAlign: 'center', color: '#999', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No revenue data</div>
    }

    const maxRevenue = Math.max(...stats.weekly_revenue.map(d => d.revenue), 1)
    const chartHeight = 200
    const svgWidth = 400
    const barWidth = 40
    const spacing = 20

    return (
      <div style={{ padding: '8px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '100%', flexShrink: 0, boxSizing: 'border-box' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 500 }}>
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
                  fill="rgba(220, 180, 255, 0.5)"
                  rx="4"
                />
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#666"
                >
                  {day.day}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={y - 2}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#333"
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
            stroke="#ddd"
            strokeWidth="1"
          />
          
          {/* X-axis line */}
          <line
            x1={0}
            y1={chartHeight}
            x2={svgWidth}
            y2={chartHeight}
            stroke="#ddd"
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
        color: '#999'
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
        color: '#999'
      }}>
        {error}
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const renderOverview = () => {
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
        <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 500 }}>
          Overview
        </h3>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>
              {stats.total_orders || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>
              Total Orders
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>
              {stats.total_returns || 0}
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>
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

      {/* Navigation Dots */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        padding: '16px',
        borderTop: '1px solid #eee',
        backgroundColor: '#fff'
      }}>
        <button
          onClick={() => setActiveView(0)}
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: activeView === 0 ? '#4a90e2' : '#ddd',
            cursor: 'pointer',
            padding: 0,
            transition: 'background-color 0.2s'
          }}
          aria-label="Weekly Revenue"
        />
        <button
          onClick={() => setActiveView(1)}
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: activeView === 1 ? '#4a90e2' : '#ddd',
            cursor: 'pointer',
            padding: 0,
            transition: 'background-color 0.2s'
          }}
          aria-label="Overview"
        />
      </div>
    </div>
  )
}

export default Statistics

