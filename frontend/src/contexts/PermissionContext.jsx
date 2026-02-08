import { createContext, useContext, useState, useEffect } from 'react'
import { getPermissionsCache, setPermissionsCache } from '../services/employeeRolesCache'

const PermissionContext = createContext()

export const PermissionProvider = ({ children }) => {
  const [permissions, setPermissions] = useState({})
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchPermissions = async (employeeId) => {
    if (!employeeId) return

    // Restore from local cache immediately so UI is ready without waiting
    const cached = getPermissionsCache(employeeId)
    if (cached && typeof cached === 'object') {
      setPermissions(cached)
    }

    setLoading(true)
    try {
      const response = await fetch('/api/my/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const perms = data.permissions || {}
          setPermissions(perms)
          setPermissionsCache(employeeId, perms)
        }
      }
    } catch (err) {
      console.error('Error fetching permissions:', err)
    } finally {
      setLoading(false)
    }
  }

  const hasPermission = (permissionName) => {
    if (!permissionName) return false
    
    // Check all categories for the permission
    for (let category in permissions) {
      const found = permissions[category]?.find(
        p => p.name === permissionName
      )
      if (found) return true
    }
    return false
  }

  // Admin = full access; Employee = restricted (two main positions)
  const isAdmin = Boolean(
    employee?.position?.toLowerCase() === 'admin' ||
    hasPermission('manage_permissions') ||
    hasPermission('add_employee')
  )

  const checkPermission = async (employeeId, permissionName) => {
    try {
      const response = await fetch('/api/check_permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          permission_name: permissionName
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        return data.has_permission || false
      }
      return false
    } catch (err) {
      console.error('Error checking permission:', err)
      return false
    }
  }

  /** Restore employee + permissions from local cache (e.g. after offline login). No API call. */
  const restoreOfflineSession = (emp, perms) => {
    if (emp) setEmployee(emp)
    if (perms != null) setPermissions(perms)
  }

  return (
    <PermissionContext.Provider value={{ 
      permissions, 
      hasPermission,
      isAdmin,
      checkPermission,
      employee,
      setEmployee,
      fetchPermissions,
      restoreOfflineSession,
      loading
    }}>
      {children}
    </PermissionContext.Provider>
  )
}

export const usePermissions = () => {
  const context = useContext(PermissionContext)
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider')
  }
  return context
}

export const ProtectedComponent = ({ permission, children, fallback = null }) => {
  const { hasPermission } = usePermissions()
  
  if (!permission) {
    return children
  }
  
  if (!hasPermission(permission)) {
    return fallback
  }
  
  return children
}











