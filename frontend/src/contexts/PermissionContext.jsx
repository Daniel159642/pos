import { createContext, useContext, useState, useEffect } from 'react'

const PermissionContext = createContext()

export const PermissionProvider = ({ children }) => {
  const [permissions, setPermissions] = useState({})
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchPermissions = async (employeeId) => {
    if (!employeeId) return
    
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
          setPermissions(data.permissions || {})
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

  return (
    <PermissionContext.Provider value={{ 
      permissions, 
      hasPermission,
      checkPermission,
      employee,
      setEmployee,
      fetchPermissions,
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










