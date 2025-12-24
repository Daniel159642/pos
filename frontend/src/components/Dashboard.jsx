import { useNavigate } from 'react-router-dom'
import { usePermissions } from '../contexts/PermissionContext'
import Statistics from './Statistics'

function Dashboard() {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()

  const boxes = [
    {
      id: 'statistics',
      title: 'Statistics',
      description: 'Orders, returns & revenue',
      size: 'large',
      component: Statistics,
      isComponent: true
    },
    {
      id: 'pos',
      title: 'POS',
      description: 'Point of Sale',
      size: 'large',
      onClick: () => navigate('/pos')
    },
    {
      id: 'tables',
      title: 'Tables',
      description: 'View all tables',
      size: 'medium',
      onClick: () => navigate('/tables')
    },
    {
      id: 'returns',
      title: 'Returns',
      description: 'Process returns',
      size: 'medium',
      onClick: () => navigate('/returns')
    },
    {
      id: 'recent-orders',
      title: 'Recent Orders',
      description: 'View recent orders',
      size: 'large',
      onClick: () => navigate('/recent-orders')
    },
    {
      id: 'inventory',
      title: 'Inventory',
      description: 'Manage inventory',
      size: 'medium',
      onClick: () => navigate('/inventory')
    },
    {
      id: 'calendar',
      title: 'Calendar',
      description: 'View calendar and schedules',
      size: 'medium',
      onClick: () => navigate('/calendar')
    },
    {
      id: 'shipment-verification',
      title: 'Shipment Verification',
      description: 'Verify incoming shipments and scan items',
      size: 'large',
      onClick: () => navigate('/shipment-verification')
    },
    // Admin-only boxes
    ...(hasPermission('manage_permissions') || hasPermission('add_employee') ? [{
      id: 'employee-management',
      title: 'Employee Management',
      description: 'Manage employees and schedules',
      size: 'large',
      onClick: () => navigate('/employee-management')
    }] : [])
  ]

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px',
        gridAutoRows: 'minmax(150px, auto)'
      }}>
        {boxes.map(box => {
          const Component = box.component
          const isComponentBox = box.isComponent
          
          return (
            <div
              key={box.id}
              onClick={!isComponentBox ? box.onClick : undefined}
              style={{
                gridColumn: box.size === 'large' ? 'span 2' : 'span 1',
                gridRow: box.size === 'large' ? 'span 2' : 'span 1',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '0',
                cursor: isComponentBox ? 'default' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
              onMouseEnter={!isComponentBox ? (e) => {
                e.currentTarget.style.borderColor = '#000'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
              } : undefined}
              onMouseLeave={!isComponentBox ? (e) => {
                e.currentTarget.style.borderColor = '#ddd'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              } : undefined}
            >
              {isComponentBox && Component ? (
                <>
                  <div style={{
                    padding: '20px 30px',
                    borderBottom: '1px solid #eee',
                    backgroundColor: '#fafafa'
                  }}>
                    <h2 style={{
                      margin: '0 0 5px 0',
                      fontSize: box.size === 'large' ? '24px' : '20px',
                      fontWeight: 500
                    }}>
                      {box.title}
                    </h2>
                    <p style={{
                      margin: 0,
                      color: '#666',
                      fontSize: '13px'
                    }}>
                      {box.description}
                    </p>
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                    <Component />
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{
                    margin: '0 0 10px 0',
                    fontSize: box.size === 'large' ? '32px' : '24px',
                    fontWeight: 500,
                    padding: '30px 30px 0 30px',
                    textAlign: 'center'
                  }}>
                    {box.title}
                  </h2>
                  <p style={{
                    margin: '0 0 30px 0',
                    color: '#666',
                    fontSize: '14px',
                    padding: '0 30px',
                    textAlign: 'center'
                  }}>
                    {box.description}
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Dashboard

