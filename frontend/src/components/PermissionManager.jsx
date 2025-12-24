import { useState, useEffect } from 'react'
import { usePermissions } from '../contexts/PermissionContext'

function PermissionManager({ employeeId, onClose }) {
  const { hasPermission, employee: currentEmployee } = usePermissions()
  const [employee, setEmployee] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [allPermissions, setAllPermissions] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (employeeId) {
      loadEmployeeData()
      loadAllPermissions()
      loadRoles()
    }
  }, [employeeId])

  const loadEmployeeData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/employees/${employeeId}/permissions`)
      const data = await response.json()
      if (data.success) {
        setPermissions(data.permissions || {})
      }
    } catch (err) {
      console.error('Error loading employee permissions:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadAllPermissions = async () => {
    try {
      const response = await fetch('/api/permissions')
      const data = await response.json()
      if (data.success) {
        setAllPermissions(data.permissions || [])
      }
    } catch (err) {
      console.error('Error loading permissions:', err)
    }
  }

  const loadRoles = async () => {
    try {
      const response = await fetch('/api/roles')
      const data = await response.json()
      if (data.success) {
        setRoles(data.roles || [])
      }
    } catch (err) {
      console.error('Error loading roles:', err)
    }
  }

  const loadEmployeeInfo = async () => {
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}`)
      const data = await response.json()
      if (data.success) {
        setEmployee(data.employee)
      }
    } catch (err) {
      console.error('Error loading employee info:', err)
    }
  }

  useEffect(() => {
    if (employeeId) {
      loadEmployeeInfo()
    }
  }, [employeeId])

  const grantPermission = async (permissionName) => {
    const reason = prompt('Reason for granting this permission:')
    if (!reason) return

    try {
      const response = await fetch(`/api/employees/${employeeId}/permissions/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission_name: permissionName,
          granted_by: currentEmployee?.id || 1, // Get from current user context
          reason: reason
        })
      })
      const data = await response.json()
      if (data.success) {
        loadEmployeeData()
      }
    } catch (err) {
      console.error('Error granting permission:', err)
    }
  }

  const revokePermission = async (permissionName) => {
    const reason = prompt('Reason for revoking this permission:')
    if (!reason) return

    try {
      const response = await fetch(`/api/employees/${employeeId}/permissions/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permission_name: permissionName,
          revoked_by: currentEmployee?.id || 1, // Get from current user context
          reason: reason
        })
      })
      const data = await response.json()
      if (data.success) {
        loadEmployeeData()
      }
    } catch (err) {
      console.error('Error revoking permission:', err)
    }
  }

  const assignRole = async (roleId) => {
    try {
      const response = await fetch(`/api/employees/${employeeId}/assign_role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId })
      })
      const data = await response.json()
      if (data.success) {
        loadEmployeeData()
      }
    } catch (err) {
      console.error('Error assigning role:', err)
    }
  }

  // Group permissions by category
  const permissionsByCategory = {}
  allPermissions.forEach(perm => {
    const category = perm.permission_category || 'other'
    if (!permissionsByCategory[category]) {
      permissionsByCategory[category] = []
    }
    permissionsByCategory[category].push(perm)
  })

  // Get current permissions as a set for quick lookup
  const currentPermissionNames = new Set()
  Object.values(permissions).forEach(categoryPerms => {
    categoryPerms.forEach(perm => currentPermissionNames.add(perm.name))
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            Manage Permissions
            {employee && ` - ${employee.first_name} ${employee.last_name}`}
          </h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading && <div>Loading...</div>}

          {/* Current Permissions */}
          <div style={{ marginBottom: '30px' }}>
            <h3>Current Permissions</h3>
            {Object.entries(permissions).map(([category, perms]) => (
              <div key={category} style={{ marginBottom: '20px' }}>
                <h4 style={{ textTransform: 'capitalize', marginBottom: '10px' }}>{category}</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {perms.map(perm => (
                    <div
                      key={perm.name}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#e8f5e9',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>{perm.description || perm.name}</span>
                      <button
                        onClick={() => revokePermission(perm.name)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#f44336',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Grant Additional Permissions */}
          <div>
            <h3>Available Permissions</h3>
            {Object.entries(permissionsByCategory).map(([category, perms]) => (
              <div key={category} style={{ marginBottom: '20px' }}>
                <h4 style={{ textTransform: 'capitalize', marginBottom: '10px' }}>{category}</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {perms.map(perm => {
                    const hasPerm = currentPermissionNames.has(perm.permission_name)
                    return (
                      <div
                        key={perm.permission_id}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: hasPerm ? '#e8f5e9' : '#fff',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span>{perm.description || perm.permission_name}</span>
                        {!hasPerm && (
                          <button
                            onClick={() => grantPermission(perm.permission_name)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#4caf50',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Grant
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Assign Role */}
          <div style={{ marginTop: '30px' }}>
            <h3>Assign Role</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {roles.map(role => (
                <button
                  key={role.role_id}
                  onClick={() => assignRole(role.role_id)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600
                  }}
                >
                  {role.role_name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default PermissionManager

