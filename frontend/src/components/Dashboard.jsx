import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { usePermissions } from '../contexts/PermissionContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import Statistics from './Statistics'
import { ParticleCard } from './MagicBento'
import './MagicBento.css'

const MOBILE_BREAKPOINT = 768

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return isMobile
}

const NO_PERMISSION_MSG = "You don't have permission"

function Dashboard() {
  const navigate = useNavigate()
  const { isAdmin } = usePermissions()
  const { show: showToast } = useToast()
  const { themeColor } = useTheme()
  const isMobile = useIsMobile()
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark-theme')
  })

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark-theme'))
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])
  
  // Convert hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)

  // Left column boxes (Accounting visible to all; Employee gets toast on click)
  const leftBoxes = [
    {
      id: 'statistics',
      title: 'Statistics',
      description: 'Orders, returns & revenue',
      size: 'large',
      component: Statistics,
      componentProps: { compact: true },
      isComponent: true,
      onClick: () => navigate('/statistics')
    },
    {
      id: 'shipment-verification',
      title: 'Shipment',
      description: 'Verify incoming shipments and scan items',
      size: 'large',
      onClick: () => navigate('/shipment-verification')
    },
    {
      id: 'accounting',
      title: 'Accounting',
      description: 'Financial reports and accounting',
      size: 'large',
      onClick: () => {
        if (!isAdmin) {
          showToast(NO_PERMISSION_MSG, 'error')
          return
        }
        navigate('/accounting')
      }
    }
  ]

  // Right column boxes
  const rightBoxes = [
    {
      id: 'calendar',
      title: 'Calendar',
      description: 'View calendar and schedules',
      size: 'medium',
      onClick: () => navigate('/calendar')
    },
    {
      id: 'pos',
      title: 'POS',
      description: 'Point of Sale',
      size: 'large',
      onClick: () => navigate('/pos')
    },
    {
      id: 'recent-orders',
      title: 'Orders',
      description: 'View recent orders',
      size: 'large',
      onClick: () => navigate('/recent-orders')
    },
    {
      id: 'customers',
      title: 'Customers',
      description: 'Manage customers',
      size: 'medium',
      onClick: () => navigate('/customers')
    },
    {
      id: 'inventory',
      title: 'Inventory',
      description: 'Manage inventory',
      size: 'medium',
      onClick: () => navigate('/inventory')
    },
    {
      id: 'tables',
      title: 'Tables',
      description: 'View all tables',
      size: 'medium',
      onClick: () => {
        if (!isAdmin) {
          showToast(NO_PERMISSION_MSG, 'error')
          return
        }
        navigate('/tables')
      }
    }
  ]

  // Mobile order: row1 = Statistics (full width); row2 = POS, Orders; rest = two per row
  const allBoxesById = {}
  leftBoxes.forEach(b => { allBoxesById[b.id] = { ...b, isLeftColumn: true } })
  rightBoxes.forEach(b => { allBoxesById[b.id] = { ...b, isLeftColumn: false } })
  const mobileBoxes = [
    allBoxesById['statistics'],
    allBoxesById['pos'],
    allBoxesById['recent-orders'],
    allBoxesById['calendar'],
    allBoxesById['shipment-verification'],
    allBoxesById['customers'],
    allBoxesById['inventory'],
    allBoxesById['tables'],
    allBoxesById['accounting']
  ].filter(Boolean)

  const renderBox = (box, isLeftColumn = false, gridColumnSpan = null) => {
    const Component = box.component
    const isComponentBox = box.isComponent
    const isStatistics = box.id === 'statistics'
    const isPOS = box.id === 'pos'
    const spanCol = gridColumnSpan ?? (isLeftColumn && isStatistics ? 2 : 1)
    const spanRow = !isMobile && isLeftColumn && isStatistics ? 2 : 1
    const isMobileStatsRow = isMobile && isStatistics

    const boxContent = (
      <div
        className={`magic-bento-card magic-bento-card--border-glow ${!isComponentBox ? 'magic-bento-card--text-autohide' : ''} ${isPOS || isStatistics ? 'magic-bento-card--lighter' : ''} ${isPOS ? 'magic-bento-card--pos' : ''} ${isStatistics && !isDarkMode ? 'magic-bento-card--white' : ''} ${isStatistics ? 'magic-bento-card--statistics-outline' : ''}`}
        style={{
          cursor: 'pointer',
          minHeight: 0,
          height: '100%',
          gridColumn: spanCol > 1 ? `span ${spanCol}` : 'span 1',
          gridRow: spanRow > 1 ? `span ${spanRow}` : 'span 1',
          '--glow-color': themeColorRgb,
          '--theme-color-rgb': themeColorRgb
        }}
      >
        {isComponentBox && Component ? (
          <>
            {!isStatistics && (
              <div 
                className="magic-bento-card__header" 
                style={{ flexShrink: 0, cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (box.onClick) box.onClick()
                }}
              >
                <div 
                  className="magic-bento-card__label"
                  style={{
                    fontFamily: '-apple-system, "system-ui", "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif',
                    fontSize: '18px'
                  }}
                >
                  {box.title}
                </div>
              </div>
            )}
            <div className="magic-bento-card__content" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <Component {...(box.componentProps || {})} />
            </div>
          </>
        ) : (
          <div className="magic-bento-card__content" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'flex-end',
            alignItems: 'flex-end',
            height: '100%',
            padding: '1.25em'
          }}>
            <div 
              className="magic-bento-card__label"
              style={{
                fontFamily: '-apple-system, "system-ui", "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif',
                fontSize: '18px'
              }}
            >
              {box.title}
            </div>
          </div>
        )}
      </div>
    )

    return (
      <ParticleCard
        key={box.id}
        onClick={box.onClick}
        enableStars={false}
        enableTilt={false}
        enableMagnetism={false}
        clickEffect={true}
        particleCount={12}
        glowColor={themeColorRgb}
        disableAnimations={false}
        style={{
          minHeight: isMobileStatsRow ? 220 : 0,
          height: '100%',
          gridColumn: spanCol > 1 ? `span ${spanCol}` : 'span 1',
          gridRow: spanRow > 1 ? `span ${spanRow}` : 'span 1',
          cursor: 'pointer'
        }}
      >
        {boxContent}
      </ParticleCard>
    )
  }

  const pad = 12
  const padTop = 20
  if (isMobile) {
    return (
      <div style={{
        paddingTop: padTop,
        paddingRight: pad,
        paddingBottom: pad,
        paddingLeft: pad,
        maxWidth: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
        minHeight: '100%',
        height: 'auto',
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary, white)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          gridAutoRows: 'minmax(140px, auto)',
          alignContent: 'start'
        }}>
          {mobileBoxes.map(box => renderBox(
            box,
            box.isLeftColumn,
            box.id === 'statistics' ? 2 : null
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      paddingTop: padTop,
      paddingRight: pad,
      paddingBottom: pad,
      paddingLeft: pad,
      maxWidth: '100%',
      margin: '0 auto',
      boxSizing: 'border-box',
      height: '100%',
      minHeight: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary, white)'
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        height: '100%',
        flex: 1,
        minHeight: 0
      }}>
        {/* Left Column */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          height: '100%',
          gridTemplateRows: 'repeat(3, 1fr)',
          minHeight: 0
        }}>
          {leftBoxes.map(box => renderBox(box, true))}
        </div>

        {/* Right Column */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          height: '100%',
          gridTemplateRows: 'repeat(3, 1fr)',
          minHeight: 0
        }}>
          {rightBoxes.map(box => renderBox(box))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard

