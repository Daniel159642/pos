import { useState, useEffect } from 'react'
import Table from './components/Table'
import Tabs from './components/Tabs'
import Login from './components/Login'
import POS from './components/POS'
import Calendar from './components/Calendar'

const TABS = [
  { id: 'inventory', label: 'Inventory', category: 'inventory' },
  { id: 'vendors', label: 'Vendors', category: 'inventory' },
  { id: 'shipments', label: 'Shipments', category: 'inventory' },
  { id: 'pending_shipments', label: 'Pending Shipments', category: 'inventory' },
  { id: 'shipment_discrepancies', label: 'Discrepancies', category: 'inventory' },
  { id: 'orders', label: 'Orders', category: 'sales' },
  { id: 'order_items', label: 'Order Items', category: 'sales' },
  { id: 'payment_transactions', label: 'Payments', category: 'sales' },
  { id: 'customers', label: 'Customers', category: 'sales' },
  { id: 'employees', label: 'Employees', category: 'hr' },
  { id: 'employee_schedule', label: 'Schedule', category: 'hr' },
  { id: 'time_clock', label: 'Time Clock', category: 'hr' },
  { id: 'employee_sessions', label: 'Sessions', category: 'hr' },
  { id: 'chart_of_accounts', label: 'Chart of Accounts', category: 'accounting' },
  { id: 'journal_entries', label: 'Journal Entries', category: 'accounting' },
  { id: 'journal_entry_lines', label: 'Journal Lines', category: 'accounting' },
  { id: 'fiscal_periods', label: 'Fiscal Periods', category: 'accounting' },
  { id: 'retained_earnings', label: 'Retained Earnings', category: 'accounting' },
  { id: 'audit_log', label: 'Audit Log', category: 'system' },
  { id: 'master_calendar', label: 'Calendar', category: 'system' }
]

const CATEGORIES = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'sales', label: 'Sales' },
  { id: 'hr', label: 'HR' },
  { id: 'accounting', label: 'Accounting' },
  { id: 'system', label: 'System' }
]

function App() {
  const [sessionToken, setSessionToken] = useState(localStorage.getItem('sessionToken'))
  const [employee, setEmployee] = useState(null)
  const [activeCategory, setActiveCategory] = useState('pos')
  const [activeTab, setActiveTab] = useState('pos')
  const [viewMode, setViewMode] = useState('pos') // 'pos' or 'tables'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (sessionToken) {
      verifySession()
    }
  }, [])

  useEffect(() => {
    if (sessionToken && employee && viewMode === 'tables') {
      loadData()
    }
  }, [activeTab, sessionToken, employee, viewMode])

  const verifySession = async () => {
    try {
      const response = await fetch('/api/verify_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken })
      })
      const result = await response.json()
      if (result.valid) {
        setEmployee(result)
      } else {
        handleLogout()
      }
    } catch (err) {
      console.error('Session verification failed:', err)
      handleLogout()
    }
  }

  const handleLogin = (loginResult) => {
    if (loginResult.success) {
      setSessionToken(loginResult.session_token)
      setEmployee({
        employee_id: loginResult.employee_id,
        employee_name: loginResult.employee_name,
        position: loginResult.position
      })
      localStorage.setItem('sessionToken', loginResult.session_token)
    }
  }

  const handleLogout = () => {
    if (sessionToken) {
      fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken })
      })
    }
    setSessionToken(null)
    setEmployee(null)
    localStorage.removeItem('sessionToken')
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/${activeTab}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      })
      if (!response.ok) {
        throw new Error('Failed to load data')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError('Error loading data: ' + err.message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredTabs = TABS.filter(tab => tab.category === activeCategory)

  if (!sessionToken || !employee) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={{ 
        backgroundColor: '#fff', 
        borderBottom: '1px solid #ddd',
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 500 }}>POS System</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => setViewMode(viewMode === 'pos' ? 'tables' : 'pos')}
            style={{
              padding: '6px 12px',
              backgroundColor: viewMode === 'pos' ? '#000' : '#f0f0f0',
              color: viewMode === 'pos' ? '#fff' : '#000',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            {viewMode === 'pos' ? 'Switch to Tables' : 'Switch to POS'}
          </button>
          <span style={{ color: '#666' }}>Welcome, {employee.employee_name}</span>
          <button 
            onClick={handleLogout}
            style={{
              padding: '6px 12px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {viewMode === 'tables' && (
        <div style={{ 
          backgroundColor: '#fff', 
          borderBottom: '1px solid #ddd',
          padding: '10px 20px'
        }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id)
                const firstTab = TABS.find(t => t.category === cat.id)
                if (firstTab) setActiveTab(firstTab.id)
              }}
              style={{
                padding: '8px 16px',
                marginRight: '8px',
                backgroundColor: activeCategory === cat.id ? '#000' : '#f0f0f0',
                color: activeCategory === cat.id ? '#fff' : '#666',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: activeCategory === cat.id ? 500 : 400
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {viewMode === 'pos' ? (
        <POS employeeId={employee.employee_id} employeeName={employee.employee_name} />
      ) : activeTab === 'master_calendar' ? (
        <Calendar />
      ) : (
        <>
          <Tabs tabs={filteredTabs} activeTab={activeTab} onTabChange={setActiveTab} />
          <div style={{ padding: '20px', overflowX: 'auto' }}>
            {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading...</div>}
            {error && <div style={{ padding: '40px', textAlign: 'center', color: '#d32f2f' }}>{error}</div>}
            {!loading && !error && data && (
              data.data && data.data.length > 0 ? (
                <Table columns={data.columns} data={data.data} />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No data</div>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default App

