import { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import Table from '../components/Table'
import Tabs from '../components/Tabs'

// Define table categories
const TABLE_CATEGORIES = {
  'Inventory & Products': ['inventory', 'vendors'],
  'Orders & Sales': [
    'orders', 
    'order_items', 
    'payment_transactions', 
    'payment_methods',
    'employee_tips',
    'sales', 
    'customers'
  ],
  'Shipments': [
    'shipments', 
    'shipment_items', 
    'pending_shipments', 
    'pending_shipment_items', 
    'shipment_discrepancies',
    'shipment_issues',
    'shipment_scan_log',
    'verification_sessions'
  ],
  'Returns': ['pending_returns', 'pending_return_items'],
  'Employees & Scheduling': [
    'employees',
    'employee_availability_unified',
    'scheduled_shifts_unified',
    'time_clock',
    'employee_sessions'
  ],
  'Calendar & Events': [
    'calendar_events_unified',
    'Calendar_Subscriptions',
    'Event_Attendees',
    'Event_Reminders'
  ],
  'Schedule Management': [
    'Schedule_Periods',
    'Schedule_Requirements',
    'Schedule_Templates',
    'Time_Off_Requests',
    'Schedule_Changes',
    'Schedule_Notifications',
    'Employee_Positions'
  ],
  'Legacy Scheduling Tables': [
    'employee_schedule',
    'employee_availability',
    'Scheduled_Shifts',
    'Employee_Shifts',
    'master_calendar',
    'Calendar_Events',
    'Shipment_Schedule'
  ],
  'Accounting': [
    'chart_of_accounts', 
    'journal_entries', 
    'journal_entry_lines', 
    'fiscal_periods', 
    'retained_earnings'
  ],
  'Audit & Logs': ['audit_log'],
  'Legacy Audit Tables': ['activity_log'],
  'Image Matching': ['image_identifications'],
  'Security & Permissions': [
    'roles', 
    'permissions', 
    'role_permissions', 
    'employee_permission_overrides'
  ],
  'Customer Display': [
    'transactions',
    'transaction_items',
    'payments',
    'receipt_preferences',
    'customer_display_settings',
    'customer_display_sessions'
  ]
}

function Tables() {
  const { themeColor, themeMode } = useTheme()
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  const [allTables, setAllTables] = useState([])
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [activeTab, setActiveTab] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingTables, setLoadingTables] = useState(true)
  const [error, setError] = useState(null)
  
  // Determine if dark mode is active
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark-theme')
  })
  
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
    loadTables()
  }, [])

  useEffect(() => {
    if (activeTab) {
      loadData()
    }
  }, [activeTab])

  const loadTables = async () => {
    setLoadingTables(true)
    try {
      const response = await fetch('/api/tables/list')
      const result = await response.json()
      if (result.tables && result.tables.length > 0) {
        setAllTables(result.tables)
        
        // Organize tables into categories
        const organizedCategories = {}
        const uncategorized = []
        
        // First, categorize known tables
        Object.entries(TABLE_CATEGORIES).forEach(([categoryName, tableNames]) => {
          const categoryTables = tableNames
            .filter(tableName => result.tables.includes(tableName))
            .map(tableName => ({
              id: tableName,
              label: formatTableName(tableName)
            }))
          
          if (categoryTables.length > 0) {
            organizedCategories[categoryName] = categoryTables
          }
        })
        
        // Find uncategorized tables
        result.tables.forEach(tableName => {
          let found = false
          Object.values(TABLE_CATEGORIES).forEach(categoryTables => {
            if (categoryTables.includes(tableName)) {
              found = true
            }
          })
          if (!found) {
            uncategorized.push({
              id: tableName,
              label: formatTableName(tableName)
            })
          }
        })
        
        // Add uncategorized category if there are any
        if (uncategorized.length > 0) {
          organizedCategories['Other'] = uncategorized
        }
        
        // Convert to array format for Tabs component
        const categoryTabs = Object.keys(organizedCategories).map(categoryName => ({
          id: categoryName,
          label: categoryName
        }))
        
        setCategories(organizedCategories)
        
        // Set first category and first table as active
        if (categoryTabs.length > 0) {
          const firstCategory = categoryTabs[0].id
          setActiveCategory(firstCategory)
          const firstTable = organizedCategories[firstCategory][0]
          if (firstTable) {
            setActiveTab(firstTable.id)
          }
        }
      }
    } catch (err) {
      setError('Error loading tables')
      console.error(err)
    } finally {
      setLoadingTables(false)
    }
  }

  const formatTableName = (tableName) => {
    // Handle special formatting for unified tables
    const specialNames = {
      'employee_availability_unified': 'Employee Availability',
      'scheduled_shifts_unified': 'Scheduled Shifts',
      'calendar_events_unified': 'Calendar Events',
      'payment_methods': 'Payment Methods',
      'employee_tips': 'Employee Tips',
      'shipment_issues': 'Shipment Issues',
      'shipment_scan_log': 'Shipment Scan Log',
      'verification_sessions': 'Verification Sessions',
      'customer_display_settings': 'Customer Display Settings',
      'customer_display_sessions': 'Customer Display Sessions',
      'receipt_preferences': 'Receipt Preferences'
    }
    
    if (specialNames[tableName]) {
      return specialNames[tableName]
    }
    
    // Handle CamelCase tables
    if (tableName.includes('_') || tableName === tableName.toLowerCase()) {
      return tableName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    } else {
      // Handle CamelCase (e.g., Schedule_Periods)
      return tableName
        .split(/(?=[A-Z])|_/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    }
  }

  const loadData = async () => {
    if (!activeTab) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/${activeTab}`)
      const result = await response.json()
      if (result.error) {
        setError(result.error)
        setData(null)
      } else {
        setData(result)
      }
    } catch (err) {
      setError('Error loading data')
      console.error(err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId)
    // Set first table in category as active
    if (categories[categoryId] && categories[categoryId].length > 0) {
      setActiveTab(categories[categoryId][0].id)
    }
  }

  if (loadingTables) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
        Loading tables...
      </div>
    )
  }

  if (Object.keys(categories).length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
        No tables found in database
      </div>
    )
  }

  const categoryTabs = Object.keys(categories).map(categoryName => ({
    id: categoryName,
    label: categoryName
  }))

  const currentCategoryTables = activeCategory ? categories[activeCategory] : []

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Tabs tabs={categoryTabs} activeTab={activeCategory} onTabChange={handleCategoryChange} />
      </div>
      
      {activeCategory && currentCategoryTables.length > 0 && (
        <div style={{ marginBottom: '20px', borderBottom: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {currentCategoryTables.map(table => {
              const isLegacy = activeCategory && activeCategory.includes('Legacy')
              
              return (
                <button
                  key={table.id}
                  onClick={() => setActiveTab(table.id)}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: activeTab === table.id ? `rgba(${themeColorRgb}, 0.7)` : (isLegacy ? 'rgba(128, 128, 128, 0.2)' : `rgba(${themeColorRgb}, 0.2)`),
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: activeTab === table.id ? '1px solid rgba(255, 255, 255, 0.3)' : (isLegacy ? '1px solid rgba(128, 128, 128, 0.3)' : `1px solid rgba(${themeColorRgb}, 0.3)`),
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: activeTab === table.id ? 600 : 500,
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: activeTab === table.id ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
                    opacity: isLegacy ? 0.7 : 1
                  }}
                >
                  {table.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
      
      <div style={{ padding: '20px', overflowX: 'auto' }}>
        {loading && <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>Loading...</div>}
        {error && <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>{error}</div>}
        {!loading && !error && data && (
          data.data && data.data.length > 0 ? (
            <Table columns={data.columns} data={data.data} />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>No data in this table</div>
          )
        )}
        {!loading && !error && data && data.columns && data.columns.length > 0 && data.data && data.data.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>Table is empty</div>
        )}
      </div>
    </div>
  )
}

export default Tables



