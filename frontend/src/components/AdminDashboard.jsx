import React, { useState, useEffect } from 'react';
import { usePermissions } from '../contexts/PermissionContext';
import { useTheme } from '../contexts/ThemeContext';
import EmployeeForm from './EmployeeForm';
import PermissionManager from './PermissionManager';

function AdminDashboard() {
  const { hasPermission } = usePermissions();
  const { themeColor, themeMode } = useTheme();
  
  // Convert hex to RGB for rgba usage
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
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
  
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employees');
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissionEmployeeId, setPermissionEmployeeId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadEmployees();
    loadRoles();
    loadSchedules();
  }, []);

  useEffect(() => {
    if (activeTab === 'schedules') {
      loadSchedules();
    }
  }, [activeTab]);

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

  const loadSchedules = async () => {
    try {
      // Calculate date range (current week + 2 weeks ahead)
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7); // Start from a week ago
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 14); // 2 weeks ahead

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const response = await fetch(`/api/employee_schedule?start_date=${startDateStr}&end_date=${endDateStr}`);
      const data = await response.json();
      setSchedules(data.data || []);
    } catch (err) {
      console.error('Failed to load schedules:', err);
      setError('Failed to load schedules');
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
      <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
        You don't have permission to access the admin dashboard.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '0', maxWidth: '100%' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          margin: 0,
          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
        }}>
          Admin Dashboard
        </h1>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {activeTab === 'employees' && hasPermission('add_employee') && (
            <button 
              onClick={handleAddEmployee}
              style={{
                padding: '10px 20px',
                backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.2)`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.9)`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
              }}
            >
              Add Employee
            </button>
          )}
          {activeTab === 'schedules' && (
            <button 
              onClick={loadSchedules}
              style={{
                padding: '10px 20px',
                backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
                color: '#fff',
                border: `1px solid rgba(${themeColorRgb}, 0.3)`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
              }}
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {error && (
        <div 
          onClick={() => setError(null)}
          style={{
            padding: '12px 16px',
            backgroundColor: isDarkMode ? 'rgba(198, 40, 40, 0.2)' : '#fee',
            border: isDarkMode ? '1px solid rgba(198, 40, 40, 0.4)' : '1px solid #fcc',
            borderRadius: '8px',
            color: isDarkMode ? '#ef5350' : '#c33',
            marginBottom: '16px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div 
          onClick={() => setSuccess(null)}
          style={{
            padding: '12px 16px',
            backgroundColor: isDarkMode ? 'rgba(46, 125, 50, 0.2)' : '#efe',
            border: isDarkMode ? '1px solid rgba(46, 125, 50, 0.4)' : '1px solid #cfc',
            borderRadius: '8px',
            color: isDarkMode ? '#81c784' : '#3c3',
            marginBottom: '16px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          {success}
        </div>
      )}

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '20px', 
        borderBottom: isDarkMode ? '2px solid var(--border-light, #333)' : '2px solid #eee',
        paddingBottom: '12px'
      }}>
        <button
          onClick={() => setActiveTab('employees')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'employees' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: activeTab === 'employees' ? '1px solid rgba(255, 255, 255, 0.3)' : `1px solid rgba(${themeColorRgb}, 0.3)`,
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: activeTab === 'employees' ? 600 : 500,
            color: '#fff',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: activeTab === 'employees' ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`
          }}
        >
          Employees
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          style={{
            padding: '10px 16px',
            backgroundColor: activeTab === 'schedules' ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: activeTab === 'schedules' ? '1px solid rgba(255, 255, 255, 0.3)' : `1px solid rgba(${themeColorRgb}, 0.3)`,
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: activeTab === 'schedules' ? 600 : 500,
            color: '#fff',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: activeTab === 'schedules' ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`
          }}
        >
          All Schedules
        </button>
      </div>

      {activeTab === 'employees' && (
        <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <thead>
            <tr style={{ 
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5',
              borderBottom: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #ddd'
            }}>
              <th style={{ 
                padding: '12px 16px', 
                textAlign: 'left', 
                fontWeight: 600,
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>ID</th>
              <th style={{ 
                padding: '12px 16px', 
                textAlign: 'left', 
                fontWeight: 600,
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>Name</th>
              <th style={{ 
                padding: '12px 16px', 
                textAlign: 'left', 
                fontWeight: 600,
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>Username</th>
              <th style={{ 
                padding: '12px 16px', 
                textAlign: 'left', 
                fontWeight: 600,
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>Email</th>
              <th style={{ 
                padding: '12px 16px', 
                textAlign: 'left', 
                fontWeight: 600,
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>Position</th>
              <th style={{ 
                padding: '12px 16px', 
                textAlign: 'left', 
                fontWeight: 600,
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>Role</th>
              <th style={{ 
                padding: '12px 16px', 
                textAlign: 'left', 
                fontWeight: 600,
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>Status</th>
              <th style={{ 
                padding: '12px 16px', 
                textAlign: 'left', 
                fontWeight: 600,
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr 
                key={employee.employee_id}
                style={{
                  borderBottom: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #eee',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f9f9f9'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <td style={{ 
                  padding: '12px 16px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  fontSize: '14px'
                }}>{employee.employee_id}</td>
                <td style={{ 
                  padding: '12px 16px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  fontSize: '14px'
                }}>{employee.first_name} {employee.last_name}</td>
                <td style={{ 
                  padding: '12px 16px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  fontSize: '14px'
                }}>{employee.username || employee.employee_code || 'N/A'}</td>
                <td style={{ 
                  padding: '12px 16px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  fontSize: '14px'
                }}>{employee.email || 'N/A'}</td>
                <td style={{ 
                  padding: '12px 16px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  fontSize: '14px'
                }}>{employee.position}</td>
                <td style={{ 
                  padding: '12px 16px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  fontSize: '14px'
                }}>{getRoleName(employee.role_id)}</td>
                <td style={{ 
                  padding: '12px 16px',
                  fontSize: '14px'
                }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    backgroundColor: employee.active 
                      ? (isDarkMode ? 'rgba(46, 125, 50, 0.2)' : '#e8f5e9')
                      : (isDarkMode ? 'rgba(198, 40, 40, 0.2)' : '#ffebee'),
                    color: employee.active
                      ? (isDarkMode ? '#81c784' : '#2e7d32')
                      : (isDarkMode ? '#ef5350' : '#c62828')
                  }}>
                    {employee.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ 
                  padding: '12px 16px'
                }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {hasPermission('edit_employee') && (
                      <button
                        onClick={() => handleEditEmployee(employee)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f0f0f0',
                          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                          borderRadius: '4px',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3d3d3d)' : '#e0e0e0'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f0f0f0'
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {hasPermission('manage_permissions') && (
                      <button
                        onClick={() => handleManagePermissions(employee.employee_id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
                          border: `1px solid rgba(${themeColorRgb}, 0.3)`,
                          borderRadius: '4px',
                          color: isDarkMode ? '#fff' : '#333',
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
                        }}
                      >
                        Permissions
                      </button>
                    )}
                    {hasPermission('delete_employee') && (
                      <button
                        onClick={() => handleDeleteEmployee(employee.employee_id)}
                        disabled={!employee.active}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: !employee.active 
                            ? (isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f0f0f0')
                            : (isDarkMode ? 'rgba(198, 40, 40, 0.2)' : '#fee'),
                          border: !employee.active
                            ? (isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd')
                            : (isDarkMode ? '1px solid rgba(198, 40, 40, 0.4)' : '1px solid #fcc'),
                          borderRadius: '4px',
                          color: !employee.active
                            ? (isDarkMode ? 'var(--text-secondary, #999)' : '#999')
                            : (isDarkMode ? '#ef5350' : '#c33'),
                          fontSize: '12px',
                          fontWeight: 500,
                          cursor: !employee.active ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          opacity: !employee.active ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (employee.active) {
                            e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(198, 40, 40, 0.3)' : '#fdd'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (employee.active) {
                            e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(198, 40, 40, 0.2)' : '#fee'
                          }
                        }}
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
      )}

      {activeTab === 'schedules' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <thead>
              <tr style={{ 
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5',
                borderBottom: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #ddd'
              }}>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: 600,
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>Employee</th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: 600,
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>Date</th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: 600,
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>Start Time</th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: 600,
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>End Time</th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: 600,
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>Hours</th>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  fontWeight: 600,
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ 
                    textAlign: 'center', 
                    padding: '40px 20px',
                    color: isDarkMode ? 'var(--text-tertiary, #999)' : '#999',
                    fontSize: '14px'
                  }}>
                    No schedules found
                  </td>
                </tr>
              ) : (
                schedules.map((schedule, index) => {
                  const startTime = schedule.start_time ? formatTime(schedule.start_time) : '';
                  const endTime = schedule.end_time ? formatTime(schedule.end_time) : '';
                  const scheduleDate = schedule.schedule_date || schedule.shift_date;
                  const dateStr = formatDate(scheduleDate);
                  
                  // Calculate hours
                  let hours = '';
                  if (schedule.start_time && schedule.end_time) {
                    const [startH, startM] = schedule.start_time.split(':').map(Number);
                    const [endH, endM] = schedule.end_time.split(':').map(Number);
                    const startMinutes = startH * 60 + startM;
                    const endMinutes = endH * 60 + endM;
                    const breakMinutes = (schedule.break_duration || 0) * 60;
                    const totalMinutes = endMinutes - startMinutes - breakMinutes;
                    const totalHours = (totalMinutes / 60).toFixed(2);
                    hours = `${totalHours} hrs`;
                  }
                  
                  return (
                    <tr 
                      key={schedule.schedule_id || schedule.scheduled_shift_id || index}
                      style={{
                        borderBottom: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #eee',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f9f9f9'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <td style={{ 
                        padding: '12px 16px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        fontSize: '14px'
                      }}>{schedule.employee_name || 'N/A'}</td>
                      <td style={{ 
                        padding: '12px 16px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        fontSize: '14px'
                      }}>{dateStr}</td>
                      <td style={{ 
                        padding: '12px 16px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        fontSize: '14px'
                      }}>{startTime}</td>
                      <td style={{ 
                        padding: '12px 16px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        fontSize: '14px'
                      }}>{endTime}</td>
                      <td style={{ 
                        padding: '12px 16px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        fontSize: '14px'
                      }}>{hours}</td>
                      <td style={{ 
                        maxWidth: '200px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        padding: '12px 16px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        fontSize: '14px'
                      }}>
                        {schedule.notes || ''}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

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



