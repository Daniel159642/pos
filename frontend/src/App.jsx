import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { PermissionProvider, usePermissions } from './contexts/PermissionContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import POS from './components/POS'
import Tables from './pages/Tables'
import Returns from './pages/Returns'
import RecentOrders from './pages/RecentOrders'
import Inventory from './pages/Inventory'
import Calendar from './components/Calendar'
import AdminDashboard from './components/AdminDashboard'
import EmployeeManagement from './components/EmployeeManagement'
import Profile from './pages/Profile'
import ShipmentVerification from './pages/ShipmentVerification'
import './index.css'

function ProtectedRoute({ children, sessionToken, employee, onLogout }) {
  if (!sessionToken || !employee) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AppContent({ sessionToken, setSessionToken, employee, setEmployee, onLogout }) {
  const { fetchPermissions, setEmployee: setPermissionEmployee } = usePermissions()
  
  useEffect(() => {
    if (employee?.employee_id) {
      fetchPermissions(employee.employee_id)
      setPermissionEmployee(employee)
    }
  }, [employee?.employee_id])
  
  return (
    <Routes>
      <Route path="/login" element={
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
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
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
            <Calendar />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} onLogout={onLogout}>
          <Layout employee={employee} onLogout={onLogout}>
            <AdminDashboard />
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
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function Layout({ children, employee, onLogout }) {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 500
            }}
          >
            Dashboard
          </button>
          {(hasPermission('manage_permissions') || hasPermission('add_employee')) && (
            <button
              onClick={() => navigate('/admin')}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 500,
                color: '#d32f2f'
              }}
            >
              Admin
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => navigate('/profile')}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 500,
              color: '#666'
            }}
          >
            Profile
          </button>
          <span style={{ color: '#666' }}>Welcome, {employee?.employee_name}</span>
          <button 
            onClick={onLogout}
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
      <PermissionProvider>
        <AppContent
          sessionToken={sessionToken}
          setSessionToken={setSessionToken}
          employee={employee}
          setEmployee={setEmployee}
          onLogout={handleLogout}
        />
      </PermissionProvider>
    </BrowserRouter>
  )
}

export default App
