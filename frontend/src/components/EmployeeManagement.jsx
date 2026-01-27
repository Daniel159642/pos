import React, { useState, useEffect } from 'react';
import { usePermissions } from '../contexts/PermissionContext';
import { useTheme } from '../contexts/ThemeContext';
import { Users } from 'lucide-react';

function EmployeeManagement() {
  const { hasPermission } = usePermissions();
  const { themeColor, themeMode } = useTheme();
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      // API returns {columns: [], data: []}
      setEmployees(data.data || []);
    } catch (err) {
      setError('Failed to load employees');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Check if user has admin permissions
  if (!hasPermission('manage_permissions') && !hasPermission('add_employee')) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999',
        fontFamily: '"Roboto Mono", monospace'
      }}>
        You don't have permission to access Employee Management.
      </div>
    );
  }

  const managementSections = [
    { id: 'employees', label: 'Employees', icon: Users }
  ]

  return (
    <div style={{ 
      display: 'flex',
      minHeight: '100vh',
      width: '100%'
    }}>
      {/* Sidebar Navigation - 1/4 of page */}
      <div style={{
        width: '25%',
        flexShrink: 0,
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        padding: '32px 4px 48px 20px',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        borderRight: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0'}`
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {managementSections.map((section) => {
            const Icon = section.icon
            const isActive = activeTab === section.id
            return (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 0',
                  backgroundColor: isActive 
                    ? (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                    : 'transparent',
                  borderRadius: isActive ? '6px' : '0',
                  border: 'none',
                  outline: 'none',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'normal',
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                <Icon size={16} />
                <span>{section.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area - 3/4 of page */}
      <div style={{
        width: '75%',
        flex: 1,
        padding: '48px 64px 64px 64px',
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        maxWidth: '1200px'
      }}>
        {/* Tab Content */}
        {activeTab === 'employees' && (
          <EmployeeList 
            employees={employees} 
            loading={loading} 
            error={error}
            onRefresh={loadEmployees}
          />
        )}
      </div>
    </div>
  );
}

function EmployeeList({ employees, loading, error, onRefresh }) {
  const { themeColor, themeMode } = useTheme();
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  const [roles, setRoles] = useState([]);
  const [availability, setAvailability] = useState({});
  const [expandedRow, setExpandedRow] = useState(null);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: 'cashier',
    date_started: new Date().toISOString().split('T')[0],
    account_type: 'pin_only', // 'pin_only' or 'clerk_master'
    pin_code: '',
    role_id: null,
    department: '',
    hourly_rate: '',
    employment_type: 'part_time'
  });
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState(null);
  
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
    loadRoles();
    loadAvailability();
  }, []);

  const loadRoles = async () => {
    try {
      const response = await fetch('/api/roles');
      const data = await response.json();
      setRoles(data.roles || []);
    } catch (err) {
      console.error('Failed to load roles:', err);
    }
  };

  const loadAvailability = async () => {
    try {
      // Get current week
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const startDate = weekStart.toISOString().split('T')[0];
      const endDate = weekEnd.toISOString().split('T')[0];

      const response = await fetch(`/api/employee_schedule?start_date=${startDate}&end_date=${endDate}`);
      const data = await response.json();
      const schedules = data.data || [];

      // Calculate hours per employee
      const availMap = {};
      schedules.forEach(schedule => {
        if (!availMap[schedule.employee_id]) {
          availMap[schedule.employee_id] = { hours: 0, days: 0 };
        }
        
        if (schedule.start_time && schedule.end_time) {
          const start = new Date(`2000-01-01T${schedule.start_time}`);
          const end = new Date(`2000-01-01T${schedule.end_time}`);
          const hours = (end - start) / (1000 * 60 * 60);
          availMap[schedule.employee_id].hours += hours;
        }
        
        availMap[schedule.employee_id].days += 1;
      });

      setAvailability(availMap);
    } catch (err) {
      console.error('Failed to load availability:', err);
    }
  };

  const getRoleName = (roleId) => {
    const role = roles.find(r => r.role_id === roleId);
    return role ? role.role_name : 'No Role';
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999', fontFamily: '"Roboto Mono", monospace' }}>Loading employees...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#d32f2f', fontFamily: '"Roboto Mono", monospace' }}>
        {error}
        <button 
          onClick={onRefresh}
          style={{
            marginLeft: '16px',
            padding: '8px 16px',
            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000',
            borderRadius: '0',
            cursor: 'pointer',
            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#000',
            fontFamily: '"Roboto Mono", monospace',
            fontSize: '14px'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const handleGeneratePin = () => {
    // Generate a 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString()
    setNewEmployee({...newEmployee, pin_code: pin})
  }

  const handleAddEmployee = async (e) => {
    e.preventDefault()
    setCreatingEmployee(true)
    setCreateError('')
    setCreateSuccess(null)

    try {
      const employeeData = {
        ...newEmployee,
        hourly_rate: newEmployee.hourly_rate ? parseFloat(newEmployee.hourly_rate) : null,
        role_id: newEmployee.role_id || null
      }

      // Remove empty optional fields
      Object.keys(employeeData).forEach(key => {
        if (employeeData[key] === '' || employeeData[key] === null) {
          delete employeeData[key]
        }
      })

      const response = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create employee')
      }

      // Show success message with PIN if generated
      setCreateSuccess({
        message: `Employee created! PIN: ${data.generated_pin || newEmployee.pin_code || '—'}`,
        employee: data.employee,
        generated_pin: data.generated_pin
      })

      // Reset form
      setNewEmployee({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        position: 'cashier',
        date_started: new Date().toISOString().split('T')[0],
        account_type: 'pin_only',
        pin_code: '',
        role_id: null,
        department: '',
        hourly_rate: '',
        employment_type: 'part_time'
      })

      // Reload employees list
      setTimeout(() => {
        onRefresh()
        setShowAddEmployeeModal(false)
        setCreateSuccess(null)
      }, 3000)

    } catch (err) {
      setCreateError(err.message || 'Failed to create employee')
    } finally {
      setCreatingEmployee(false)
    }
  }

  return (
    <div>
      {/* Add Employee Button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px' 
      }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: '24px', 
          fontWeight: 600,
          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
        }}>
          Employees
        </h2>
        <button
          onClick={() => setShowAddEmployeeModal(true)}
          style={{
            padding: '12px 24px',
            backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.85)`
            e.target.style.boxShadow = `0 6px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25)`
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
            e.target.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
          }}
        >
          + Add Employee
        </button>
      </div>

      {/* Add Employee Modal */}
      {showAddEmployeeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
            borderRadius: '12px',
            padding: '32px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 600,
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>
                Add New Employee
              </h2>
              <button
                onClick={() => {
                  setShowAddEmployeeModal(false)
                  setCreateError('')
                  setCreateSuccess(null)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                  padding: '4px 8px'
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddEmployee}>
              {/* Basic Information */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  First Name *
                </label>
                <input
                  type="text"
                  value={newEmployee.first_name}
                  onChange={(e) => setNewEmployee({...newEmployee, first_name: e.target.value})}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${isDarkMode ? 'var(--border-light, #404040)' : '#ddd'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Last Name *
                </label>
                <input
                  type="text"
                  value={newEmployee.last_name}
                  onChange={(e) => setNewEmployee({...newEmployee, last_name: e.target.value})}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${isDarkMode ? 'var(--border-light, #404040)' : '#ddd'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* PIN Section (Clerk auth temporarily disabled) */}
              {(
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    marginBottom: '8px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    PIN Code
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={newEmployee.pin_code}
                      onChange={(e) => setNewEmployee({...newEmployee, pin_code: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                      placeholder="Leave empty to auto-generate"
                      maxLength="6"
                      style={{
                        flex: 1,
                        padding: '12px',
                        border: `1px solid ${isDarkMode ? 'var(--border-light, #404040)' : '#ddd'}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleGeneratePin}
                      style={{
                        padding: '12px 20px',
                        backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Generate
                    </button>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: isDarkMode ? 'var(--text-secondary, #999)' : '#666',
                    marginTop: '4px'
                  }}>
                    {newEmployee.pin_code ? `PIN: ${newEmployee.pin_code}` : 'A 6-digit PIN will be generated automatically'}
                  </div>
                </div>
              )}

              {/* Position */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Position *
                </label>
                <select
                  value={newEmployee.position}
                  onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${isDarkMode ? 'var(--border-light, #404040)' : '#ddd'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="cashier">Cashier</option>
                  <option value="stock_clerk">Stock Clerk</option>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="assistant_manager">Assistant Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Date Started */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Date Started *
                </label>
                <input
                  type="date"
                  value={newEmployee.date_started}
                  onChange={(e) => setNewEmployee({...newEmployee, date_started: e.target.value})}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${isDarkMode ? 'var(--border-light, #404040)' : '#ddd'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Phone (optional) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${isDarkMode ? 'var(--border-light, #404040)' : '#ddd'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Role Selection */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Role (Optional)
                </label>
                <select
                  value={newEmployee.role_id || ''}
                  onChange={(e) => setNewEmployee({...newEmployee, role_id: e.target.value ? parseInt(e.target.value) : null})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${isDarkMode ? 'var(--border-light, #404040)' : '#ddd'}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">No Role</option>
                  {roles.map(role => (
                    <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                  ))}
                </select>
              </div>

              {/* Error Message */}
              {createError && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#ffebee',
                  color: '#d32f2f',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  fontSize: '14px'
                }}>
                  {createError}
                </div>
              )}

              {/* Success Message */}
              {createSuccess && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#e8f5e9',
                  color: '#2e7d32',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  fontSize: '14px'
                }}>
                  {createSuccess.message}
                  {createSuccess.generated_pin && (
                    <div style={{ marginTop: '8px', fontWeight: 600 }}>
                      PIN: {createSuccess.generated_pin}
                    </div>
                  )}
                  {createSuccess.invitation_sent && (
                    <div style={{ marginTop: '8px', fontSize: '12px' }}>
                      Employee will receive an email with onboarding instructions.
                    </div>
                  )}
                </div>
              )}

              {/* Form Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddEmployeeModal(false)
                    setCreateError('')
                    setCreateSuccess(null)
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'transparent',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    border: `1px solid ${isDarkMode ? 'var(--border-light, #404040)' : '#ddd'}`,
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingEmployee}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: creatingEmployee 
                      ? `rgba(${themeColorRgb}, 0.4)` 
                      : `rgba(${themeColorRgb}, 0.7)`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: creatingEmployee ? 'not-allowed' : 'pointer',
                    boxShadow: creatingEmployee 
                      ? 'none'
                      : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                    transition: 'all 0.3s ease'
                  }}
                >
                  {creatingEmployee ? 'Creating...' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <div style={{ 
          backgroundColor: 'var(--bg-primary, #fff)', 
          borderRadius: '4px', 
          overflowX: 'auto',
          overflowY: 'visible',
          boxShadow: '0 1px 3px var(--shadow, rgba(0,0,0,0.1))',
          width: '100%'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary, #f8f9fa)' }}>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  borderBottom: '2px solid var(--border-color, #dee2e6)',
                  color: 'var(--text-primary, #495057)',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>ID</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  borderBottom: '2px solid var(--border-color, #dee2e6)',
                  color: 'var(--text-primary, #495057)',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Name</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  borderBottom: '2px solid var(--border-color, #dee2e6)',
                  color: 'var(--text-primary, #495057)',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Username</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  borderBottom: '2px solid var(--border-color, #dee2e6)',
                  color: 'var(--text-primary, #495057)',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Position</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  borderBottom: '2px solid var(--border-color, #dee2e6)',
                  color: 'var(--text-primary, #495057)',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Role</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  borderBottom: '2px solid var(--border-color, #dee2e6)',
                  color: 'var(--text-primary, #495057)',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>This Week</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  fontWeight: 600, 
                  borderBottom: '2px solid var(--border-color, #dee2e6)',
                  color: 'var(--text-primary, #495057)',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee, idx) => (
                <React.Fragment key={employee.employee_id}>
                  <tr 
                    onClick={() => setExpandedRow(expandedRow === employee.employee_id ? null : employee.employee_id)}
                    style={{ 
                      backgroundColor: idx % 2 === 0 ? 'var(--bg-primary, #fff)' : 'var(--bg-tertiary, #fafafa)',
                      cursor: 'pointer'
                    }}
                  >
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid var(--border-light, #eee)',
                      fontSize: '14px',
                      color: 'var(--text-primary, #333)'
                    }}>{employee.employee_id}</td>
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid var(--border-light, #eee)',
                      fontSize: '14px',
                      color: 'var(--text-primary, #333)'
                    }}>
                      {employee.first_name} {employee.last_name}
                    </td>
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid var(--border-light, #eee)',
                      fontSize: '14px',
                      color: 'var(--text-primary, #333)'
                    }}>
                      {employee.username || employee.employee_code || 'N/A'}
                    </td>
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid var(--border-light, #eee)',
                      fontSize: '14px',
                      color: 'var(--text-primary, #333)'
                    }}>{employee.position}</td>
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid var(--border-light, #eee)',
                      fontSize: '14px',
                      color: 'var(--text-primary, #333)'
                    }}>{getRoleName(employee.role_id)}</td>
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid var(--border-light, #eee)',
                      fontSize: '14px',
                      color: 'var(--text-primary, #333)'
                    }}>
                      {availability[employee.employee_id] ? (
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary, #333)' }}>
                            {availability[employee.employee_id].hours.toFixed(1)}h
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary, #666)' }}>
                            {availability[employee.employee_id].days} day{availability[employee.employee_id].days !== 1 ? 's' : ''}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary, #999)', fontSize: '13px' }}>Not scheduled</span>
                      )}
                    </td>
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee',
                      textAlign: 'center'
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Action button handler - can be customized
                          console.log('Action for employee:', employee.employee_id);
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          color: '#fff',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 600,
                          boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
                          e.target.style.boxShadow = `0 4px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
                          e.target.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                        }}
                      >
                        Actions
                      </button>
                    </td>
                  </tr>
                  {expandedRow === employee.employee_id && (
                    <tr>
                      <td colSpan={7} style={{ 
                        padding: '0', 
                        borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee'
                      }}>
                        <div style={{
                          padding: '20px',
                          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f8f9fa',
                          borderTop: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #dee2e6'
                        }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginBottom: '4px' }}>Email</div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>{employee.email || 'N/A'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginBottom: '4px' }}>Department</div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>{employee.department || 'N/A'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginBottom: '4px' }}>Status</div>
                          <div style={{ fontSize: '14px', fontWeight: 500 }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '0',
                              fontSize: '12px',
                              fontWeight: 500,
                              backgroundColor: employee.active ? (isDarkMode ? 'rgba(46, 125, 50, 0.3)' : '#e8f5e9') : (isDarkMode ? 'rgba(198, 40, 40, 0.3)' : '#ffebee'),
                              color: employee.active ? (isDarkMode ? '#81c784' : '#2e7d32') : (isDarkMode ? '#ef5350' : '#c62828'),
                              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000'
                            }}>
                              {employee.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginBottom: '4px' }}>Phone</div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>{employee.phone || 'N/A'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginBottom: '4px' }}>Date Started</div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                            {employee.date_started ? new Date(employee.date_started).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginBottom: '4px' }}>Hourly Rate</div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                            {employee.hourly_rate ? `$${employee.hourly_rate.toFixed(2)}` : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginBottom: '4px' }}>Employment Type</div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                            {employee.employment_type ? employee.employment_type.replace('_', ' ').toUpperCase() : 'N/A'}
                          </div>
                        </div>
                        {employee.address && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginBottom: '4px' }}>Address</div>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>{employee.address}</div>
                          </div>
                        )}
                        {employee.notes && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666', marginBottom: '4px' }}>Notes</div>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>{employee.notes}</div>
                          </div>
                        )}
                      </div>
                        </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        </div>
        {employees.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999', fontFamily: '"Roboto Mono", monospace' }}>
            No employees found
          </div>
        )}
      </div>
    </div>
  );
}


export { EmployeeList };
export default EmployeeManagement;

