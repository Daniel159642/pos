import { useNavigate } from 'react-router-dom'
import { usePermissions } from '../contexts/PermissionContext'
import Statistics from './Statistics'
import { ParticleCard } from './MagicBento'
import './MagicBento.css'

function Dashboard() {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()

  // Left column boxes
  const leftBoxes = [
    {
      id: 'statistics',
      title: 'Statistics',
      description: 'Orders, returns & revenue',
      size: 'large',
      component: Statistics,
      isComponent: true
    },
    {
      id: 'shipment-verification',
      title: 'Shipment',
      description: 'Verify incoming shipments and scan items',
      size: 'large',
      onClick: () => navigate('/shipment-verification')
    },
    {
      id: 'inventory',
      title: 'Inventory',
      description: 'Manage inventory',
      size: 'medium',
      onClick: () => navigate('/inventory')
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
      title: 'Recent Orders',
      description: 'View recent orders',
      size: 'large',
      onClick: () => navigate('/recent-orders')
    },
    {
      id: 'returns',
      title: 'Returns',
      description: 'Process returns',
      size: 'medium',
      onClick: () => navigate('/returns')
    },
    // Admin-only boxes
    ...(hasPermission('manage_permissions') || hasPermission('add_employee') ? [{
      id: 'employee-management',
      title: 'Management',
      description: 'Manage employees and schedules',
      size: 'large',
      onClick: () => navigate('/employee-management')
    }] : []),
    {
      id: 'tables',
      title: 'Tables',
      description: 'View all tables',
      size: 'medium',
      onClick: () => navigate('/tables')
    }
  ]

  const renderBox = (box, isLeftColumn = false) => {
    const Component = box.component
    const isComponentBox = box.isComponent
    const isStatistics = box.id === 'statistics'
    const isPOS = box.id === 'pos'
    
    const boxContent = (
      <div
        className={`magic-bento-card magic-bento-card--border-glow ${!isComponentBox ? 'magic-bento-card--text-autohide' : ''}`}
        style={{
          cursor: isComponentBox ? 'default' : 'pointer',
          minHeight: 0,
          height: '100%',
          gridColumn: isLeftColumn && isStatistics ? 'span 2' : 'span 1',
          gridRow: isLeftColumn && isStatistics ? 'span 2' : 'span 1',
          '--glow-color': '132, 0, 255',
          backgroundColor: isPOS ? 'rgba(132, 0, 255, 0.1)' : undefined
        }}
      >
        {isComponentBox && Component ? (
          <>
            <div className="magic-bento-card__header" style={{ flexShrink: 0 }}>
              <div className="magic-bento-card__label">{box.title}</div>
            </div>
            <div className="magic-bento-card__content" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <Component />
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
              style={
                (box.id === 'employee-management' || box.id === 'shipment-verification' || box.id === 'calendar' || box.id === 'returns')
                  ? {
                      fontStyle: 'italic',
                      fontFamily: 'Georgia, "Times New Roman", serif',
                      fontSize: '18px'
                    }
                  : {}
              }
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
        onClick={!isComponentBox ? box.onClick : undefined}
        enableStars={false}
        enableTilt={false}
        enableMagnetism={false}
        clickEffect={!isComponentBox}
        particleCount={12}
        glowColor="132, 0, 255"
        disableAnimations={false}
        style={{
          minHeight: 0,
          height: '100%',
          gridColumn: isLeftColumn && isStatistics ? 'span 2' : 'span 1',
          gridRow: isLeftColumn && isStatistics ? 'span 2' : 'span 1',
          cursor: isComponentBox ? 'default' : 'pointer'
        }}
      >
        {boxContent}
      </ParticleCard>
    )
  }

  return (
    <div style={{ 
      padding: '12px', 
      maxWidth: '100%', 
      margin: '0 auto',
      boxSizing: 'border-box',
      height: 'calc(100vh - 80px)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'white'
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

