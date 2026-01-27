import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { PermissionProvider, usePermissions } from './contexts/PermissionContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { Settings, User, LogOut } from 'lucide-react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import POS from './components/POS'
import Tables from './pages/Tables'
import Returns from './pages/Returns'
import RecentOrders from './pages/RecentOrders'
import Inventory from './pages/Inventory'
import Calendar from './components/Calendar'
import CalendarSubscription from './components/CalendarSubscription'
import EmployeeManagement from './components/EmployeeManagement'
import Profile from './pages/Profile'
import ShipmentVerification from './pages/ShipmentVerification'
import StatisticsPage from './pages/Statistics'
import SettingsPage from './pages/Settings'
import Accounting from './pages/Accounting'
import CashRegister from './pages/CashRegister'
import './index.css'

function ProtectedRoute({ children, sessionToken, employee, onLogout }) {
  if (!sessionToken || !employee) {
    return <Navigate to="/login" replace />
  }
  return children
}

const loginSuccessHandler = (result, setSessionToken, setEmployee) => {
  if (result.success) {
    setSessionToken(result.session_token)
    setEmployee({
      employee_id: result.employee_id,
      employee_name: result.employee_name,
      position: result.position
    })
    localStorage.setItem('sessionToken', result.session_token)
  }
}

function AppContent({ sessionToken, setSessionToken, employee, setEmployee, onLogout }) {
  const { fetchPermissions, setEmployee: setPermissionEmployee } = usePermissions()

  useEffect(() => {
    if (employee?.employee_id) {
      fetchPermissions(employee.employee_id)
      setPermissionEmployee(employee)
    }
  }, [employee?.employee_id])

  const onLogin = (result) => loginSuccessHandler(result, setSessionToken, setEmployee)

  return (
    <Routes>
      <Route path="/login" element={
        sessionToken && employee ? (
          <Navigate to="/dashboard" replace />
        ) : (
          <Login onLogin={onLogin} />
        )
      } />
      <Route path="/dashboard" element={
        sessionToken && employee ? (
          <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
            <Layout employee={employee} onLogout={onLogout}>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        ) : (
          <Login onLogin={onLogin} />
        )
      } />
      <Route path="/pos" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <POS employeeId={employee?.employee_id} employeeName={employee?.employee_name} />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/tables" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <Tables />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/returns" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <Returns />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/recent-orders" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <RecentOrders />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/inventory" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <Inventory />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/calendar" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <Calendar employee={employee} />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/calendar-subscription" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <CalendarSubscription />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/employee-management" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <EmployeeManagement />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <Profile employeeId={employee?.employee_id} employeeName={employee?.employee_name} />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/shipment-verification" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <ShipmentVerification />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/shipment-verification/:id" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <ShipmentVerification />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/statistics" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <StatisticsPage />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <SettingsPage />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/accounting" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <Accounting />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/cash-register" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <CashRegister />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/" element={
        sessionToken && employee ? (
          <Navigate to="/dashboard" replace />
        ) : (
          <Navigate to="/login" replace />
        )
      } />
      <Route path="/onboarding" element={<Navigate to="/login" replace />} />
      <Route path="/onboarding/*" element={<Navigate to="/login" replace />} />
      <Route path="/employee-onboarding" element={<Navigate to="/login" replace />} />
      <Route path="/master-login" element={<Navigate to="/login" replace />} />
      <Route path="/sign-up" element={<Navigate to="/login" replace />} />
      <Route path="*" element={
        sessionToken && employee ? (
          <Navigate to="/dashboard" replace />
        ) : (
          <Navigate to="/login" replace />
        )
      } />
    </Routes>
  )
}

function Layout({ children, employee, onLogout }) {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary, #f5f5f5)' }}>
      <div style={{
        backgroundColor: 'var(--bg-primary, #fff)',
        borderBottom: '3px solid var(--border-color, #ddd)',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: 500,
              fontStyle: 'italic',
              fontFamily: 'Georgia, "Times New Roman", serif',
              color: '#6ba3f0'
            }}
          >
            Swift
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {(hasPermission('manage_settings') || employee?.position?.toLowerCase() === 'admin') && (
            <button
              type="button"
              className="button-26 button-26--header"
              role="button"
              onClick={() => navigate('/settings')}
              title="Settings"
            >
              <div className="button-26__content">
                <Settings size={14} style={{ marginRight: '6px', color: '#888' }} />
                <span className="button-26__text text">Settings</span>
              </div>
            </button>
          )}
          <button
            type="button"
            className="button-26 button-26--header"
            role="button"
            onClick={() => navigate('/profile')}
            title="Profile"
          >
            <div className="button-26__content">
              <User size={14} style={{ marginRight: '6px', color: '#888' }} />
              <span className="button-26__text text">Profile</span>
            </div>
          </button>
          <button
            type="button"
            className="button-26 button-26--header"
            role="button"
            onClick={onLogout}
            title="Logout"
            style={{ marginRight: '-6px' }}
          >
            <div className="button-26__content" style={{ paddingRight: '6px' }}>
              <LogOut size={14} style={{ marginRight: '6px', color: '#888' }} />
              <span className="button-26__text text">Logout</span>
            </div>
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

function App() {
  const [sessionToken, setSessionToken] = useState(localStorage.getItem('sessionToken'))
  const [employee, setEmployee] = useState(null)

  const handleLogout = () => {
    if (sessionToken) {
      fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken })
      }).catch(console.error)
    }
    setSessionToken(null)
    setEmployee(null)
    localStorage.removeItem('sessionToken')
  }

  const verifySession = async () => {
    try {
      const response = await fetch('/api/verify_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Session verification failed:', response.status, errorText)
        handleLogout()
        return
      }

      const result = await response.json()
      if (result.valid) {
        setEmployee({
          employee_id: result.employee_id,
          employee_name: result.employee_name,
          position: result.position
        })
      } else {
        handleLogout()
      }
    } catch (err) {
      console.error('Session verification failed:', err)
      handleLogout()
    }
  }

  useEffect(() => {
    if (sessionToken) {
      verifySession()
    }
  }, [])

  return (
    <BrowserRouter>
      <ThemeProvider>
        <PermissionProvider>
          <AppContent
            sessionToken={sessionToken}
            setSessionToken={setSessionToken}
            employee={employee}
            setEmployee={setEmployee}
            onLogout={handleLogout}
          />
        </PermissionProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
