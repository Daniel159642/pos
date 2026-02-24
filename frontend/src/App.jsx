import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { PermissionProvider, usePermissions } from './contexts/PermissionContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider, useToast } from './contexts/ToastContext'
import { PageScrollProvider, usePageScroll } from './contexts/PageScrollContext'
import { getCurrentWindow } from '@tauri-apps/api/window'

// When Shopify OAuth completes from Tauri, backend redirects to pos://...; we navigate the webview to that path.
function DeepLinkHandler() {
  const navigate = useNavigate()
  useEffect(() => {
    if (typeof window === 'undefined' || !window.__TAURI__) return
    let unlisten
    const handleUrl = (url) => {
      if (!url || !url.startsWith('pos://')) return
      try {
        const rest = url.slice('pos://'.length)
        const path = rest.split('?')[0] || '/'
        const search = rest.includes('?') ? '?' + rest.split('?').slice(1).join('?') : ''
        navigate((path.startsWith('/') ? path : '/' + path) + search, { replace: true })
      } catch (_) { }
    }
    import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl, getCurrent }) => {
      onOpenUrl((urls) => { if (urls && urls[0]) handleUrl(urls[0]) }).then((fn) => { unlisten = fn })
      getCurrent().then((urls) => { if (urls && urls[0]) handleUrl(urls[0]) }).catch(() => { })
    }).catch(() => { })
    return () => { if (unlisten && typeof unlisten === 'function') unlisten() }
  }, [navigate])
  return null
}
import { Settings, User, LogOut, Bell } from 'lucide-react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import POS from './components/POS'
import Tables from './pages/Tables'
import RecentOrders from './pages/RecentOrders'
import Inventory from './pages/Inventory'
import Calendar from './components/Calendar'
import EmployeeManagement from './components/EmployeeManagement'
import Profile from './pages/Profile'
import ShipmentVerification from './pages/ShipmentVerification'
import StatisticsPage from './pages/Statistics'
import SettingsPage from './pages/Settings'
import { lazy, Suspense } from 'react'
const Accounting = lazy(() => import('./pages/Accounting'))
import CashRegister from './pages/CashRegister'
import Customers from './pages/Customers'
import OfflineBanner from './components/OfflineBanner'
import NotificationPanel from './components/NotificationPanel'
import { useOffline } from './contexts/OfflineContext'
import { NotificationProvider, useNotifications } from './contexts/NotificationContext'
import { cachedFetch } from './services/offlineSync'
import { getPermissionsCache } from './services/employeeRolesCache'
import './index.css'

function ProtectedRoute({ children, sessionToken, employee, sessionVerifying }) {
  if (!sessionToken) {
    return <Navigate to="/login" replace />
  }
  if (!employee) {
    if (sessionVerifying) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary, #f5f5f5)' }}>
          <div style={{ fontSize: '18px', color: 'var(--text-secondary, #666)' }}>Loading session...</div>
        </div>
      )
    }
    return <Navigate to="/login" replace />
  }
  return children
}

function AdminOnlyRedirect({ children }) {
  const { isAdmin, loading: permissionsLoading } = usePermissions()
  const navigate = useNavigate()
  const { show: showToast } = useToast()
  useEffect(() => {
    if (permissionsLoading) return
    if (!isAdmin) {
      showToast("You don't have permission", 'error')
      navigate('/dashboard', { replace: true })
    }
  }, [isAdmin, permissionsLoading, navigate, showToast])
  if (permissionsLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary, #666)' }}>
        Loading…
      </div>
    )
  }
  if (!isAdmin) return null
  return children
}

function PermissionRedirect({ permission, children }) {
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions()
  const navigate = useNavigate()
  const { show: showToast } = useToast()
  const allowed = isAdmin || (permission && hasPermission(permission))
  useEffect(() => {
    if (permissionsLoading) return
    if (!allowed) {
      showToast("You don't have permission", 'error')
      navigate('/dashboard', { replace: true })
    }
  }, [allowed, permissionsLoading, navigate, showToast])
  if (permissionsLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary, #666)' }}>
        Loading…
      </div>
    )
  }
  if (!allowed) return null
  return children
}

const EMPLOYEE_STORAGE_KEY = 'pos_employee'

function getStoredEmployee() {
  try {
    const raw = localStorage.getItem(EMPLOYEE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setStoredEmployee(employee) {
  if (employee) localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(employee))
  else localStorage.removeItem(EMPLOYEE_STORAGE_KEY)
}

const loginSuccessHandler = (result, setSessionToken, setEmployee, restoreOfflineSession) => {
  if (!result.success) return
  if (result.offline) {
    const emp = result.employee || { employee_id: result.employee_id, employee_name: result.employee_name, position: result.position }
    setSessionToken('offline')
    setEmployee(emp)
    localStorage.setItem('sessionToken', 'offline')
    setStoredEmployee(emp)
    if (restoreOfflineSession) restoreOfflineSession(emp, result.permissions)
    return
  }
  const emp = {
    employee_id: result.employee_id,
    employee_name: result.employee_name,
    position: result.position
  }
  setSessionToken(result.session_token)
  setEmployee(emp)
  localStorage.setItem('sessionToken', result.session_token)
  setStoredEmployee(emp)
}

function AppContent({ sessionToken, setSessionToken, employee, setEmployee, onLogout, sessionVerifying }) {
  const { fetchPermissions, setEmployee: setPermissionEmployee, restoreOfflineSession } = usePermissions()

  useEffect(() => {
    if (!employee?.employee_id) return
    if (sessionToken === 'offline') {
      const permissions = getPermissionsCache(employee.employee_id, true) || {}
      restoreOfflineSession(employee, permissions)
      return
    }
    fetchPermissions(employee.employee_id)
    setPermissionEmployee(employee)
  }, [employee?.employee_id, sessionToken])

  const onLogin = (result) => loginSuccessHandler(result, setSessionToken, setEmployee, restoreOfflineSession)

  return (
    <>
      <DeepLinkHandler />
      <Routes>
        <Route path="/login" element={
          sessionToken && employee ? (
            <Navigate to="/dashboard" replace />
          ) : sessionToken && sessionVerifying ? (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary, #f5f5f5)' }}>
              <div style={{ fontSize: '18px', color: 'var(--text-secondary, #666)' }}>Loading session...</div>
            </div>
          ) : (
            <Login onLogin={onLogin} />
          )
        } />
        <Route path="/dashboard" element={
          sessionToken && employee ? (
            <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
              <Layout employee={employee} onLogout={onLogout}>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          ) : sessionToken && sessionVerifying ? (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary, #f5f5f5)' }}>
              <div style={{ fontSize: '18px', color: 'var(--text-secondary, #666)' }}>Loading session...</div>
            </div>
          ) : (
            <Login onLogin={onLogin} />
          )
        } />
        <Route path="/pos" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <POS employeeId={employee?.employee_id} employeeName={employee?.employee_name} />
            </Layout>
          </ProtectedRoute>
<<<<<<< HEAD
        } />
        <Route path="/tables" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <AdminOnlyRedirect>
                <Tables />
              </AdminOnlyRedirect>
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/recent-orders" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <RecentOrders />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/inventory" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <Inventory />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <Calendar employee={employee} />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/calendar-subscription" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <CalendarSubscription />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/employee-management" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <EmployeeManagement />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <Profile employeeId={employee?.employee_id} employeeName={employee?.employee_name} />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/shipment-verification" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <ShipmentVerification />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/shipment-verification/:id" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <ShipmentVerification />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/statistics" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <StatisticsPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <SettingsPage />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/accounting" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <PermissionRedirect permission="view_financial_reports">
                <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary, #666)' }}>Loading…</div>}>
                  <Accounting />
                </Suspense>
              </PermissionRedirect>
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/cash-register" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <CashRegister />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/customers" element={
          <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
            <Layout employee={employee} onLogout={onLogout}>
              <Customers />
            </Layout>
          </ProtectedRoute>
        } />
        <Route path="/" element={
          sessionToken && employee ? (
            <Navigate to="/dashboard" replace />
          ) : sessionToken && sessionVerifying ? (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary, #f5f5f5)' }}>
              <div style={{ fontSize: '18px', color: 'var(--text-secondary, #666)' }}>Loading session...</div>
            </div>
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
          ) : sessionToken && sessionVerifying ? (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary, #f5f5f5)' }}>
              <div style={{ fontSize: '18px', color: 'var(--text-secondary, #666)' }}>Loading session...</div>
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
      </Routes>
=======
        ) : sessionToken && sessionVerifying ? (
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary, #f5f5f5)' }}>
            <div style={{ fontSize: '18px', color: 'var(--text-secondary, #666)' }}>Loading session...</div>
          </div>
        ) : (
          <Login onLogin={onLogin} />
        )
      } />
      <Route path="/pos" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <POS employeeId={employee?.employee_id} employeeName={employee?.employee_name} />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/tables" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <AdminOnlyRedirect>
              <Tables />
            </AdminOnlyRedirect>
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/recent-orders" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <RecentOrders />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/inventory" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <Inventory />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/calendar" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <Calendar employee={employee} />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/employee-management" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <EmployeeManagement />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <Profile employeeId={employee?.employee_id} employeeName={employee?.employee_name} />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/shipment-verification" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <ShipmentVerification />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/shipment-verification/:id" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <ShipmentVerification />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/statistics" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <StatisticsPage />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <SettingsPage />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/accounting" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <PermissionRedirect permission="view_financial_reports">
              <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary, #666)' }}>Loading…</div>}>
                <Accounting />
              </Suspense>
            </PermissionRedirect>
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/cash-register" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <CashRegister />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/customers" element={
        <ProtectedRoute sessionToken={sessionToken} employee={employee} sessionVerifying={sessionVerifying}>
          <Layout employee={employee} onLogout={onLogout}>
            <Customers />
          </Layout>
        </ProtectedRoute>
      } />
      <Route path="/" element={
        sessionToken && employee ? (
          <Navigate to="/dashboard" replace />
        ) : sessionToken && sessionVerifying ? (
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary, #f5f5f5)' }}>
            <div style={{ fontSize: '18px', color: 'var(--text-secondary, #666)' }}>Loading session...</div>
          </div>
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
        ) : sessionToken && sessionVerifying ? (
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary, #f5f5f5)' }}>
            <div style={{ fontSize: '18px', color: 'var(--text-secondary, #666)' }}>Loading session...</div>
          </div>
        ) : (
          <Navigate to="/login" replace />
        )
      } />
    </Routes>
>>>>>>> 8d3ae059e28b262c6e1afda8ece60f22f87e7955
    </>
  )
}

const isTauri = typeof window !== 'undefined' && window.__TAURI__

function Layout({ children, employee, onLogout }) {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const { isOnline, isSyncing, pendingCount } = useOffline()
  const { disableScroll } = usePageScroll()
  const { notifications, notificationCount, dismissNotification } = useNotifications()
  const showBanner = !isOnline || isSyncing || pendingCount > 0
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)

  const handleNotificationClick = (notification) => {
    if (notification.type === 'shipment_issue' && notification.pending_shipment_id) {
      setNotificationPanelOpen(false)
      navigate(`/shipment-verification?filter=all`, { state: { openShipmentId: notification.pending_shipment_id } })
    }
  }

  useEffect(() => {
    if (!navigator.onLine) return
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('sessionToken') : null
    cachedFetch('/api/inventory?limit=50&offset=0').then(() => { }).catch(() => { })
    cachedFetch('/api/inventory?item_type=product&include_variants=1').then(() => { }).catch(() => { })
    cachedFetch('/api/vendors').then(() => { }).catch(() => { })
    cachedFetch('/api/categories').then(() => { }).catch(() => { })
    cachedFetch('/api/pos-bootstrap').then(() => { }).catch(() => { })
    cachedFetch('/api/settings-bootstrap', { headers: { 'X-Session-Token': token || '' } }).then(() => { }).catch(() => { })
    cachedFetch('/api/receipt-settings').then(() => { }).catch(() => { })
    cachedFetch('/api/pos-settings').then(() => { }).catch(() => { })
    cachedFetch('/api/store-location-settings').then(() => { }).catch(() => { })
    if (token) {
      cachedFetch('/api/order-delivery-settings', { headers: { 'X-Session-Token': token } }).then(() => { }).catch(() => { })
      cachedFetch(`/api/register/session?session_token=${token}`).then(() => { }).catch(() => { })
      cachedFetch(`/api/register/session?status=open&session_token=${token}`).then(() => { }).catch(() => { })
    }
  }, [])

  const handleHeaderDrag = (e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
    e.stopPropagation()
    getCurrentWindow().startDragging()
  }

  const headerHeight = 52
  const contentTop = showBanner ? 88 : headerHeight

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-secondary, #f5f5f5)'
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          zIndex: 1000,
          flexShrink: 0,
          backgroundColor: 'var(--bg-primary, #fff)',
          borderBottom: '3px solid var(--border-color, #ddd)',
          padding: '12px 20px',
          paddingLeft: isTauri ? 72 : 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transform: 'translateZ(0)'
        }}
      >
        <div
          data-tauri-drag-region
          onMouseDown={isTauri ? handleHeaderDrag : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            flex: 1,
            minWidth: 0,
            userSelect: 'none',
            cursor: isTauri ? 'move' : undefined,
            paddingLeft: '48px'
          }}
        >
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '4px 12px 2px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '26px',
              fontWeight: 400,
              fontFamily: 'Tanker, sans-serif',
              letterSpacing: '1px',
              color: '#4a90e2',
              lineHeight: 1.2
            }}
          >
            SWFTLY
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {employee && (
            <>
              <button
                type="button"
                onClick={() => setNotificationPanelOpen(true)}
                title="Notifications"
                aria-label={notificationCount > 0 ? `Notifications (${notificationCount})` : 'Notifications'}
                style={{
                  padding: '4px',
                  margin: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                <Bell size={28} style={{ color: '#888' }} />
                {notificationCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      minWidth: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      boxSizing: 'border-box'
                    }}
                  >
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </button>
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
            </>
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
      <NotificationPanel
        open={notificationPanelOpen}
        onClose={() => setNotificationPanelOpen(false)}
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        onDismissNotification={dismissNotification}
      />
      <OfflineBanner />
      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: disableScroll ? 'hidden' : 'auto',
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingTop: contentTop,
          backgroundColor: 'var(--bg-secondary, #f5f5f5)'
        }}
      >
        {children}
      </main>
    </div>
  )
}

function App() {
  const [sessionToken, setSessionToken] = useState(localStorage.getItem('sessionToken'))
  const [employee, setEmployee] = useState(() => (localStorage.getItem('sessionToken') ? getStoredEmployee() : null))
  // Only show "Loading session..." when we have a token but no cached employee; otherwise show app immediately
  const [sessionVerifying, setSessionVerifying] = useState(() => {
    const token = localStorage.getItem('sessionToken')
    const emp = token ? getStoredEmployee() : null
    return !!(token && !emp)
  })

  const handleLogout = () => {
    if (sessionToken && sessionToken !== 'offline') {
      fetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken })
      }).catch(console.error)
    }
    setSessionToken(null)
    setEmployee(null)
    setSessionVerifying(false)
    localStorage.removeItem('sessionToken')
    setStoredEmployee(null)
  }

  const verifySession = async () => {
    if (!sessionToken) {
      setSessionVerifying(false)
      return
    }
    if (sessionToken === 'offline') {
      if (navigator.onLine) {
        // Back online with offline-only session — server requires a real session for register/settings etc.
        handleLogout()
        setSessionVerifying(false)
        return
      }
      const cached = getStoredEmployee()
      if (cached) setEmployee(cached)
      setSessionVerifying(false)
      return
    }
    if (!navigator.onLine) {
      const cached = getStoredEmployee()
      if (cached) {
        setEmployee(cached)
      } else {
        handleLogout()
      }
      setSessionVerifying(false)
      return
    }
    // Verify in background; don't set sessionVerifying(true) so UI stays visible when we have cached employee
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
        const emp = {
          employee_id: result.employee_id,
          employee_name: result.employee_name,
          position: result.position
        }
        setEmployee(emp)
        setStoredEmployee(emp)
      } else {
        handleLogout()
      }
    } catch (err) {
      console.error('Session verification failed:', err)
      const cached = getStoredEmployee()
      if (cached) {
        setEmployee(cached)
      } else {
        handleLogout()
      }
    } finally {
      setSessionVerifying(false)
    }
  }

  useEffect(() => {
    if (sessionToken) {
      verifySession()
    } else {
      setSessionVerifying(false)
    }
  }, [])

  // When app comes back online with an offline-only session, require re-login for server features (e.g. cash register)
  useEffect(() => {
    const onOnline = () => {
      if (localStorage.getItem('sessionToken') === 'offline') {
        setSessionToken(null)
        setEmployee(null)
        setSessionVerifying(false)
        localStorage.removeItem('sessionToken')
        setStoredEmployee(null)
      }
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <PageScrollProvider>
            <NotificationProvider>
              <PermissionProvider initialEmployee={employee}>
                <AppContent
                  sessionToken={sessionToken}
                  setSessionToken={setSessionToken}
                  employee={employee}
                  setEmployee={setEmployee}
                  onLogout={handleLogout}
                  sessionVerifying={sessionVerifying}
                />
              </PermissionProvider>
            </NotificationProvider>
          </PageScrollProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
