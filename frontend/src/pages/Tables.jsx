import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import Table from '../components/Table'
import { 
  Database,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Calculator,
  Image,
  Shield,
  Folder,
  PanelLeft,
  Bell
} from 'lucide-react'

// Define table categories (all tables assigned; no "Other" tab)
const TABLE_CATEGORIES = {
  'Inventory & Products': [
    'inventory',
    'vendors',
    'categories',
    'product_metadata',
    'metadata_extraction_log',
    'search_history',
    'product_variants',
    'product_ingredients',
    'establishments',
    'stores',
    'store_location_settings'
  ],
  'Orders & Sales': [
    'orders',
    'order_items',
    'payment_transactions',
    'payment_methods',
    'employee_tips',
    'customers',
    'pending_returns',
    'pending_return_items',
    'transactions',
    'transaction_items',
    'payments',
    'receipt_preferences',
    'customer_display_settings',
    'customer_display_sessions',
    'customer_rewards_settings',
    'cash_register_sessions',
    'cash_transactions',
    'register_cash_settings',
    'daily_cash_counts',
    'receipt_settings',
    'receipt_templates',
    'pos_settings'
  ],
  'Shipments': [
    'shipments',
    'shipment_items',
    'shipment_discrepancies',
    'shipment_issues',
    'shipment_scan_log',
    'verification_sessions',
    'approved_shipments',
    'approved_shipment_items',
    'pending_shipments',
    'pending_shipment_items',
    'shipment_verification_settings'
  ],
  'Employees & Scheduling': [
    'employees',
    'employee_availability',
    'scheduled_shifts',
    'time_clock',
    'employee_sessions',
    'employee_schedule',
    'master_calendar',
    'calendar_subscriptions',
    'schedule_periods',
    'schedule_changes',
    'employee_positions'
  ],
  'Accounting': [
    'chart_of_accounts',
    'journal_entries',
    'journal_entry_lines',
    'fiscal_periods',
    'retained_earnings',
    'accounting_customers',
    'accounting_vendors',
    'accounts',
    'items',
    'tax_rates',
    'classes',
    'locations'
  ],
  'Notifications': [
    'schedule_notifications',
    'sms_messages',
    'sms_opt_outs',
    'sms_settings',
    'sms_templates'
  ],
  'Image Matching': ['image_identifications'],
  'Security & Permissions': [
    'roles',
    'permissions',
    'role_permissions',
    'employee_permission_overrides',
    'audit_log',
    'users'
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
  const [selectedRowIds, setSelectedRowIds] = useState(() => new Set())
  
  const [sidebarMinimized, setSidebarMinimized] = useState(false)
  const [hoveringTables, setHoveringTables] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const tablesHeaderRef = useRef(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [isInitialMount, setIsInitialMount] = useState(true)
  const sidebarRef = useRef(null)
  const contentRef = useRef(null)
  
  useEffect(() => {
    // Disable initial animation by setting flag after component is mounted
    // Use a longer delay to ensure all styles are applied first
    const timer = setTimeout(() => {
      setIsInitialMount(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [])
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

  // Hide scrollbar for table buttons
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .table-buttons-scroll::-webkit-scrollbar {
        display: none;
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  const loadTables = async () => {
    setLoadingTables(true)
    try {
      const response = await fetch('/api/tables/list')
      const result = await response.json()
      if (result.tables && result.tables.length > 0) {
        setAllTables(result.tables)
        
        // Organize tables into categories
        const organizedCategories = {}
        
        // Categorize known tables
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
        
        // Tables not in TABLE_CATEGORIES are omitted (no "Other" tab)
        
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
    setSelectedRowIds(new Set())
    
    try {
      const response = await fetch(`/api/tables/${activeTab}`)
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

  const getRowId = (row, idx) => {
    const pk = data?.primary_key || []
    if (pk.length === 1) {
      return row[pk[0]]
    }
    if (data?.rowid_column) {
      return row[data.rowid_column]
    }
    if (pk.length > 1) {
      return pk.map(col => `${col}:${String(row[col])}`).join('|')
    }
    return idx
  }

  const handleDeleteSelected = async () => {
    if (!activeTab || !data) return
    const count = selectedRowIds.size
    if (count === 0) return

    const ok = window.confirm(`Delete ${count} selected row${count === 1 ? '' : 's'} from "${activeTab}"? This cannot be undone.`)
    if (!ok) return

    try {
      const pk = data.primary_key || []
      const idList = Array.from(selectedRowIds)

      let payload = {}

      if (pk.length === 1) {
        payload = { ids: idList }
      } else if (data.rowid_column) {
        payload = { rowids: idList }
      } else if (pk.length > 1) {
        const rowMap = new Map((data.data || []).map((row, idx) => [getRowId(row, idx), row]))
        const keys = idList
          .map(id => rowMap.get(id))
          .filter(Boolean)
          .map(row => {
            const keyObj = {}
            pk.forEach(col => { keyObj[col] = row[col] })
            return keyObj
          })
        payload = { keys }
      } else {
        throw new Error('This table does not have a primary key or rowid to delete by.')
      }

      const response = await fetch(`/api/tables/${activeTab}/rows`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to delete rows')
      }

      await loadData()
    } catch (err) {
      console.error(err)
      window.alert(err.message || 'Error deleting selected rows')
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
      <div style={{ 
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
          Loading tables...
        </div>
      </div>
    )
  }

  if (Object.keys(categories).length === 0) {
    return (
      <div style={{ 
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
          No tables found in database
        </div>
      </div>
    )
  }

  // Category icons mapping
  const categoryIcons = {
    'Inventory & Products': Package,
    'Orders & Sales': ShoppingCart,
    'Shipments': Truck,
    'Employees & Scheduling': Users,
    'Accounting': Calculator,
    'Notifications': Bell,
    'Image Matching': Image,
    'Security & Permissions': Shield
  }

  const categoryTabs = Object.keys(categories).map(categoryName => ({
    id: categoryName,
    label: categoryName
  }))

  const currentCategoryTables = activeCategory ? categories[activeCategory] : []

  return (
    <div style={{ 
      display: 'flex',
      minHeight: '100vh',
      width: '100%'
    }}>
      {/* Sidebar Navigation - 1/4 of page */}
      <div 
        ref={sidebarRef}
        style={{
          position: 'fixed',
          left: 0,
          top: '56px',
          zIndex: 100,
          width: isInitialMount ? '25%' : (sidebarMinimized ? '60px' : '25%'),
          height: 'calc(100vh - 56px)',
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
          padding: isInitialMount ? '32px 10px 48px 10px' : (sidebarMinimized ? '32px 10px 48px 10px' : '32px 10px 48px 10px'),
          borderRight: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0'}`,
          transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          transition: isInitialMount ? 'none' : 'gap 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          paddingTop: '0',
          paddingBottom: '0',
          alignItems: 'stretch'
        }}>
          {/* Tables Header */}
          <div
            ref={tablesHeaderRef}
            style={{ position: 'relative' }}
            onMouseEnter={(e) => {
              setHoveringTables(true)
              setShowTooltip(true)
              if (tablesHeaderRef.current) {
                const rect = tablesHeaderRef.current.getBoundingClientRect()
                if (sidebarMinimized) {
                  setTooltipPosition({
                    top: rect.top + rect.height / 2,
                    left: rect.right + 8
                  })
                } else {
                  setTooltipPosition({
                    top: rect.bottom + 4,
                    left: rect.left
                  })
                }
              }
            }}
            onMouseLeave={() => {
              setHoveringTables(false)
              setShowTooltip(false)
            }}
          >
            <button
              onClick={() => setSidebarMinimized(!sidebarMinimized)}
              style={{
                width: isInitialMount ? '100%' : (sidebarMinimized ? '40px' : '100%'),
                height: '40px',
                padding: '0',
                margin: '0',
                border: 'none',
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isInitialMount ? 'flex-start' : (sidebarMinimized ? 'center' : 'flex-start'),
                transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), justifyContent 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                left: '0',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                transition: 'none'
              }}>
                {sidebarMinimized ? (
                  <PanelLeft size={20} style={{ width: '20px', height: '20px' }} />
                ) : (
                  hoveringTables ? (
                    <PanelLeft size={20} style={{ width: '20px', height: '20px' }} />
                  ) : (
                    <Database size={20} style={{ width: '20px', height: '20px' }} />
                  )
                )}
              </div>
              {!sidebarMinimized && (
                <span style={{
                  marginLeft: '48px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  whiteSpace: 'nowrap',
                  opacity: sidebarMinimized ? 0 : 1,
                  transition: isInitialMount ? 'none' : 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  pointerEvents: 'none'
                }}>
                  Database Tables
                </span>
              )}
            </button>
          </div>
          {showTooltip && (
            <div
              style={{
                position: 'fixed',
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
                transform: sidebarMinimized ? 'translateY(-50%)' : 'none',
                padding: '4px 8px',
                backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.85)',
                color: 'white',
                fontSize: '12px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                zIndex: 10000,
                pointerEvents: 'none'
              }}
            >
              {sidebarMinimized ? 'Open sidebar' : 'Close sidebar'}
            </div>
          )}
          {/* Category Navigation */}
          {categoryTabs.map((category) => {
            const Icon = categoryIcons[category.id] || Folder
            const isActive = activeCategory === category.id
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id)}
                style={{
                  width: isInitialMount ? '100%' : (sidebarMinimized ? '40px' : '100%'),
                  height: '40px',
                  padding: '0',
                  margin: '0',
                  border: 'none',
                  backgroundColor: isActive 
                    ? (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                    : 'transparent',
                  borderRadius: isActive ? '6px' : '0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isInitialMount ? 'flex-start' : (sidebarMinimized ? 'center' : 'flex-start'),
                  transition: isInitialMount ? 'backgroundColor 0.2s ease, borderRadius 0.2s ease' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), justifyContent 0.4s cubic-bezier(0.4, 0, 0.2, 1), backgroundColor 0.2s ease, borderRadius 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  color: isActive 
                    ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333')
                    : (isDarkMode ? 'var(--text-secondary, #ccc)' : '#666')
                }}
              >
                <div style={{
                  position: 'absolute',
                  left: '0',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  transition: 'none'
                }}>
                  <Icon size={20} style={{ width: '20px', height: '20px' }} />
                </div>
                {!sidebarMinimized && (
                  <span style={{
                    marginLeft: '48px',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 'normal',
                    whiteSpace: 'nowrap',
                    opacity: sidebarMinimized ? 0 : 1,
                    transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    pointerEvents: 'none'
                  }}>
                    {category.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area - 3/4 of page */}
      <div 
        ref={contentRef}
        style={{
          marginLeft: isInitialMount ? '25%' : (sidebarMinimized ? '60px' : '25%'),
          width: isInitialMount ? '75%' : (sidebarMinimized ? 'calc(100% - 60px)' : '75%'),
          flex: 1,
          padding: '48px 64px 64px 64px',
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
          maxWidth: isInitialMount ? '1200px' : (sidebarMinimized ? 'none' : '1200px'),
          transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {activeCategory && currentCategoryTables.length > 0 && (
          <div style={{ marginBottom: '24px', borderBottom: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd', paddingBottom: '16px' }}>
            <div style={{ position: 'relative' }}>
              <div 
                className="table-buttons-scroll"
                style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  flexWrap: 'nowrap', 
                  overflowX: 'auto', 
                  paddingBottom: '4px',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {currentCategoryTables.map(table => {
                const isActive = activeTab === table.id
                
                return (
                  <button
                    key={table.id}
                    onClick={() => setActiveTab(table.id)}
                    style={{
                      padding: '4px 16px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                      backgroundColor: isActive 
                        ? `rgba(${themeColorRgb}, 0.7)` 
                        : (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'),
                      border: isActive 
                        ? `1px solid rgba(${themeColorRgb}, 0.5)` 
                        : `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? '#fff' : (isDarkMode ? 'var(--text-primary, #fff)' : '#333'),
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: isActive ? `0 4px 15px rgba(${themeColorRgb}, 0.3)` : 'none'
                    }}
                  >
                    {table.label}
                  </button>
                )
              })}
              </div>
              {/* Left gradient fade */}
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: '4px',
                width: '20px',
                background: `linear-gradient(to right, ${isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white'} 0%, ${isDarkMode ? 'rgba(26, 26, 26, 0.3)' : 'rgba(255, 255, 255, 0.3)'} 50%, transparent 100%)`,
                pointerEvents: 'none',
                zIndex: 1
              }} />
              {/* Right gradient fade */}
              <div style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: '4px',
                width: '20px',
                background: `linear-gradient(to left, ${isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white'} 0%, ${isDarkMode ? 'rgba(26, 26, 26, 0.3)' : 'rgba(255, 255, 255, 0.3)'} 50%, transparent 100%)`,
                pointerEvents: 'none',
                zIndex: 1
              }} />
            </div>
          </div>
        )}
      
      <div style={{ overflowX: 'auto' }}>
        {loading && <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>Loading...</div>}
        {error && <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>{error}</div>}
        {!loading && !error && data && (
          data.data && data.data.length > 0 ? (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <div style={{ color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', fontSize: '13px' }}>
                  {selectedRowIds.size > 0 ? `${selectedRowIds.size} selected` : 'Select rows to delete'}
                </div>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedRowIds.size === 0}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: selectedRowIds.size === 0 ? (isDarkMode ? 'rgba(255,255,255,0.12)' : '#eee') : '#e53935',
                    color: selectedRowIds.size === 0 ? (isDarkMode ? 'rgba(255,255,255,0.5)' : '#999') : '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: selectedRowIds.size === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  Delete selected
                </button>
              </div>

              <Table
                columns={data.columns}
                data={data.data}
                enableRowSelection
                getRowId={getRowId}
                selectedRowIds={selectedRowIds}
                onSelectedRowIdsChange={setSelectedRowIds}
              />
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>No data in this table</div>
          )
        )}
        {!loading && !error && data && data.columns && data.columns.length > 0 && data.data && data.data.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>Table is empty</div>
        )}
      </div>
      </div>
    </div>
  )
}

export default Tables



