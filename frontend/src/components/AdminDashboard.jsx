import React, { useState, useEffect } from 'react';
import { usePermissions } from '../contexts/PermissionContext';
import EmployeeForm from './EmployeeForm';
import PermissionManager from './PermissionManager';

function AdminDashboard() {
  const { hasPermission } = usePermissions();
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissionEmployeeId, setPermissionEmployeeId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadEmployees();
    loadRoles();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      setEmployees(data.data || []);
    } catch (err) {
      setError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await fetch('/api/roles');
      const data = await response.json();
      setRoles(data.roles || []);
    } catch (err) {
      console.error('Failed to load roles:', err);
    }
  };

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setShowEmployeeForm(true);
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeForm(true);
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm('Are you sure you want to deactivate this employee?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/employees/${employeeId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Employee deactivated successfully');
        loadEmployees();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to deactivate employee');
      }
    } catch (err) {
      setError('Failed to deactivate employee');
    }
  };

  const handleManagePermissions = (employeeId) => {
    setPermissionEmployeeId(employeeId);
    setShowPermissions(true);
  };

  const handleEmployeeSaved = () => {
    setShowEmployeeForm(false);
    setSelectedEmployee(null);
    loadEmployees();
    setSuccess('Employee saved successfully');
    setTimeout(() => setSuccess(null), 3000);
  };

  const getRoleName = (roleId) => {
    const role = roles.find(r => r.role_id === roleId);
    return role ? role.role_name : 'No Role';
  };

  if (!hasPermission('manage_permissions') && !hasPermission('add_employee')) {
    return (
      <div className="admin-dashboard">
        <div className="error-message">
          You don't have permission to access the admin dashboard.
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="admin-dashboard">Loading...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        {hasPermission('add_employee') && (
          <button className="btn btn-primary" onClick={handleAddEmployee}>
            Add Employee
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" onClick={() => setSuccess(null)}>
          {success}
        </div>
      )}

      <div className="employees-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Position</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.employee_id}>
                <td>{employee.employee_id}</td>
                <td>{employee.first_name} {employee.last_name}</td>
                <td>{employee.username || employee.employee_code || 'N/A'}</td>
                <td>{employee.email || 'N/A'}</td>
                <td>{employee.position}</td>
                <td>{getRoleName(employee.role_id)}</td>
                <td>
                  <span className={`status-badge ${employee.active ? 'active' : 'inactive'}`}>
                    {employee.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    {hasPermission('edit_employee') && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleEditEmployee(employee)}
                      >
                        Edit
                      </button>
                    )}
                    {hasPermission('manage_permissions') && (
                      <button
                        className="btn btn-sm btn-info"
                        onClick={() => handleManagePermissions(employee.employee_id)}
                      >
                        Permissions
                      </button>
                    )}
                    {hasPermission('delete_employee') && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteEmployee(employee.employee_id)}
                        disabled={!employee.active}
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEmployeeForm && (
        <EmployeeForm
          employee={selectedEmployee}
          roles={roles}
          onSave={handleEmployeeSaved}
          onCancel={() => {
            setShowEmployeeForm(false);
            setSelectedEmployee(null);
          }}
        />
      )}

      {showPermissions && permissionEmployeeId && (
        <PermissionManager
          employeeId={permissionEmployeeId}
          onClose={() => {
            setShowPermissions(false);
            setPermissionEmployeeId(null);
          }}
        />
      )}
    </div>
  );
}

export default AdminDashboard;



