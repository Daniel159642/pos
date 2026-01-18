import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { PermissionProvider, usePermissions } from './contexts/PermissionContext'
import { ThemeProvider } from './contexts/ThemeContext'
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
import Settings from './pages/Settings'
import Accounting from './pages/Accounting'
import Onboarding from './pages/Onboarding'
import './index.css'

function ProtectedRoute({ children, sessionToken, employee, onLogout }) {
  if (!sessionToken || !employee) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AppContent({ sessionToken, setSessionToken, employee, setEmployee, onLogout }) {
  const { fetchPermissions, setEmployee: setPermissionEmployee } = usePermissions()
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const [onboardingRequired, setOnboardingRequired] = useState(false)
  
  useEffect(() => {
    if (employee?.employee_id) {
      fetchPermissions(employee.employee_id)
      setPermissionEmployee(employee)
    }
  }, [employee?.employee_id])
  
  useEffect(() => {
    // Check onboarding status on mount
    checkOnboardingStatus()
  }, [])
  
  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/onboarding/status')
      const data = await response.json()
      
      // If onboarding is completed, don't require it (allow normal login flow)
      if (!data.setup_completed) {
        setOnboardingRequired(true)
      } else {
        // Onboarding is complete, don't force onboarding
        setOnboardingRequired(false)
      }
      setOnboardingChecked(true)
    } catch (err) {
      console.error('Error checking onboarding status:', err)
      // On error, assume onboarding is required
      setOnboardingRequired(true)
      setOnboardingChecked(true)
    }
  }
  
  if (!onboardingChecked) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-secondary, #f5f5f5)'
      }}>
        <div style={{ fontSize: '18px', color: 'var(--text-secondary, #666)' }}>
          Loading...
        </div>
      </div>
    )
  }
  
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/login" element={
        onboardingRequired && !sessionToken ? (
          <Navigate to="/onboarding" replace />
        ) : (
          sessionToken && employee ? <Navigate to="/dashboard" replace /> : <Login onLogin={(result) => {
            if (result.success) {
              setSessionToken(result.session_token)
              setEmployee({
                employee_id: result.employee_id,
                employee_name: result.employee_name,
                position: result.position
              })
              localStorage.setItem('sessionToken', result.session_token)
            }
          }} />
        )
      } />
      {onboardingRequired && !sessionToken && (
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      )}
      <Route path="/dashboard" element={
        onboardingRequired ? (
          // If onboarding is required, redirect to onboarding even if logged in
          <Navigate to="/onboarding" replace />
        ) : sessionToken && employee ? (
          <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
            <Layout employee={employee} onLogout={onLogout}>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        ) : (
          <Login onLogin={(result) => {
            if (result.success) {
              setSessionToken(result.session_token)
              setEmployee({
                employee_id: result.employee_id,
                employee_name: result.employee_name,
                position: result.position
              })
              localStorage.setItem('sessionToken', result.session_token)
            }
          }} />
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
            <Settings />
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
      <Route path="/" element={
        onboardingRequired && !sessionToken ? (
          <Navigate to="/onboarding" replace />
        ) : sessionToken && employee ? (
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
        borderBottom: '1px solid var(--border-color, #ddd)',
        padding: '10px 20px',
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
              color: 'var(--theme-color, purple)'
            }}
          >
            Swift
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {(hasPermission('manage_settings') || employee?.position?.toLowerCase() === 'admin') && (
            <>
              <button
                onClick={() => navigate('/accounting')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: 'var(--text-tertiary, #666)'
                }}
              >
                Accounting
              </button>
              <button
                onClick={() => navigate('/settings')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: 'var(--text-tertiary, #666)'
                }}
              >
                Settings
              </button>
            </>
          )}
          <button
            onClick={() => navigate('/profile')}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 500,
              color: 'var(--text-tertiary, #666)'
            }}
          >
            Profile
          </button>
          <button 
            onClick={onLogout}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-secondary, #f0f0f0)',
              border: '1px solid var(--border-color, #ddd)',
              borderRadius: '4px',
              cursor: 'pointer',
              color: 'var(--text-primary, #000)'
            }}
          >
            Logout
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

  useEffect(() => {
    if (sessionToken) {
      verifySession()
    }
  }, [])

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
