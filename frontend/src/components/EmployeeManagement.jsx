import React, { useState, useEffect } from 'react';
import { usePermissions } from '../contexts/PermissionContext';
import ScheduleManager from './ScheduleManager';

function EmployeeManagement() {
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        color: '#999',
        fontFamily: '"Roboto Mono", monospace'
      }}>
        You don't have permission to access Employee Management.
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '24px', 
      backgroundColor: 'white', 
      minHeight: 'calc(100vh - 200px)',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('employees')}
            style={{
              padding: '10px 16px',
              backgroundColor: activeTab === 'employees' ? 'rgba(128, 0, 128, 0.7)' : 'rgba(128, 0, 128, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: activeTab === 'employees' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(128, 0, 128, 0.3)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: activeTab === 'employees' ? 600 : 500,
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: activeTab === 'employees' ? '0 4px 15px rgba(128, 0, 128, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : '0 2px 8px rgba(128, 0, 128, 0.1)'
            }}
          >
            Employees
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            style={{
              padding: '10px 16px',
              backgroundColor: activeTab === 'schedule' ? 'rgba(128, 0, 128, 0.7)' : 'rgba(128, 0, 128, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: activeTab === 'schedule' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(128, 0, 128, 0.3)',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: activeTab === 'schedule' ? 600 : 500,
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: activeTab === 'schedule' ? '0 4px 15px rgba(128, 0, 128, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : '0 2px 8px rgba(128, 0, 128, 0.1)'
            }}
          >
            Schedule Builder
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ 
        padding: '24px', 
        backgroundColor: 'white'
      }}>
        {activeTab === 'employees' && (
          <EmployeeList 
            employees={employees} 
            loading={loading} 
            error={error}
            onRefresh={loadEmployees}
          />
        )}
        {activeTab === 'schedule' && (
          <ScheduleManager />
        )}
      </div>
    </div>
  );
}

function EmployeeList({ employees, loading, error, onRefresh }) {
  const [roles, setRoles] = useState([]);
  const [availability, setAvailability] = useState({});
  const [expandedRow, setExpandedRow] = useState(null);

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
    return <div style={{ padding: '40px', textAlign: 'center', color: '#999', fontFamily: '"Roboto Mono", monospace' }}>Loading employees...</div>;
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
            border: '1px solid #000',
            borderRadius: '0',
            cursor: 'pointer',
            backgroundColor: '#fff',
            fontFamily: '"Roboto Mono", monospace',
            fontSize: '14px'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ 
          backgroundColor: '#fff', 
          borderRadius: '4px', 
          overflowX: 'auto',
          overflowY: 'visible',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          width: '100%'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  borderBottom: '2px solid #dee2e6',
                  color: '#495057',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>ID</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  borderBottom: '2px solid #dee2e6',
                  color: '#495057',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Name</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  borderBottom: '2px solid #dee2e6',
                  color: '#495057',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Username</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  borderBottom: '2px solid #dee2e6',
                  color: '#495057',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Position</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  borderBottom: '2px solid #dee2e6',
                  color: '#495057',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>Role</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600, 
                  borderBottom: '2px solid #dee2e6',
                  color: '#495057',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>This Week</th>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  fontWeight: 600, 
                  borderBottom: '2px solid #dee2e6',
                  color: '#495057',
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
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa',
                      cursor: 'pointer'
                    }}
                  >
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #eee',
                      fontSize: '14px'
                    }}>{employee.employee_id}</td>
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #eee',
                      fontSize: '14px'
                    }}>
                      {employee.first_name} {employee.last_name}
                    </td>
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #eee',
                      fontSize: '14px'
                    }}>
                      {employee.username || employee.employee_code || 'N/A'}
                    </td>
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #eee',
                      fontSize: '14px'
                    }}>{employee.position}</td>
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #eee',
                      fontSize: '14px'
                    }}>{getRoleName(employee.role_id)}</td>
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #eee',
                      fontSize: '14px'
                    }}>
                      {availability[employee.employee_id] ? (
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 500 }}>
                            {availability[employee.employee_id].hours.toFixed(1)}h
                          </div>
                          <div style={{ fontSize: '11px', color: '#666' }}>
                            {availability[employee.employee_id].days} day{availability[employee.employee_id].days !== 1 ? 's' : ''}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#999', fontSize: '13px' }}>Not scheduled</span>
                      )}
                    </td>
                    <td style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #eee',
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
                          backgroundColor: 'rgba(128, 0, 128, 0.7)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          color: '#fff',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 600,
                          boxShadow: '0 4px 15px rgba(128, 0, 128, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = 'rgba(128, 0, 128, 0.8)'
                          e.target.style.boxShadow = '0 4px 20px rgba(128, 0, 128, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'rgba(128, 0, 128, 0.7)'
                          e.target.style.boxShadow = '0 4px 15px rgba(128, 0, 128, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
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
                        borderBottom: '1px solid #eee'
                      }}>
                        <div style={{
                          padding: '20px',
                          backgroundColor: '#f8f9fa',
                          borderTop: '2px solid #dee2e6'
                        }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Email</div>
                          <div style={{ fontSize: '14px', fontWeight: 500 }}>{employee.email || 'N/A'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Department</div>
                          <div style={{ fontSize: '14px', fontWeight: 500 }}>{employee.department || 'N/A'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Status</div>
                          <div style={{ fontSize: '14px', fontWeight: 500 }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '0',
                              fontSize: '12px',
                              fontWeight: 500,
                              backgroundColor: employee.active ? '#e8f5e9' : '#ffebee',
                              color: employee.active ? '#2e7d32' : '#c62828',
                              border: '1px solid #000'
                            }}>
                              {employee.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Phone</div>
                          <div style={{ fontSize: '14px', fontWeight: 500 }}>{employee.phone || 'N/A'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Date Started</div>
                          <div style={{ fontSize: '14px', fontWeight: 500 }}>
                            {employee.date_started ? new Date(employee.date_started).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Hourly Rate</div>
                          <div style={{ fontSize: '14px', fontWeight: 500 }}>
                            {employee.hourly_rate ? `$${employee.hourly_rate.toFixed(2)}` : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Employment Type</div>
                          <div style={{ fontSize: '14px', fontWeight: 500 }}>
                            {employee.employment_type ? employee.employment_type.replace('_', ' ').toUpperCase() : 'N/A'}
                          </div>
                        </div>
                        {employee.address && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Address</div>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>{employee.address}</div>
                          </div>
                        )}
                        {employee.notes && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Notes</div>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>{employee.notes}</div>
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
          <div style={{ padding: '40px', textAlign: 'center', color: '#999', fontFamily: '"Roboto Mono", monospace' }}>
            No employees found
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleBuilder({ employees }) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    employee_id: '',
    schedule_date: '',
    start_time: '09:00',
    end_time: '17:00',
    break_duration: 30,
    notes: ''
  });

  useEffect(() => {
    loadSchedules();
  }, [currentWeek]);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const weekStart = getWeekStart(currentWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const startDate = weekStart.toISOString().split('T')[0];
      const endDate = weekEnd.toISOString().split('T')[0];

      const response = await fetch(`/api/employee_schedule?start_date=${startDate}&end_date=${endDate}`);
      const data = await response.json();
      setSchedules(data.data || []);
    } catch (err) {
      console.error('Error loading schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  const getWeekDays = () => {
    const weekStart = getWeekStart(currentWeek);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentWeek(newDate);
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  const getSchedulesForDay = (date, employeeId) => {
    const dateStr = date.toISOString().split('T')[0];
    return schedules.filter(s => 
      s.schedule_date === dateStr && 
      s.employee_id === employeeId
    );
  };

  const handleCellClick = (employee, date) => {
    setSelectedEmployee(employee);
    setScheduleForm({
      ...scheduleForm,
      employee_id: employee.employee_id,
      schedule_date: date.toISOString().split('T')[0]
    });
    setShowScheduleForm(true);
  };

  const handleSaveSchedule = async () => {
    try {
      const response = await fetch('/api/employee_schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleForm)
      });

      const data = await response.json();
      if (data.success) {
        setShowScheduleForm(false);
        setScheduleForm({
          employee_id: '',
          schedule_date: '',
          start_time: '09:00',
          end_time: '17:00',
          break_duration: 30,
          notes: ''
        });
        loadSchedules();
      } else {
        alert(data.message || 'Failed to save schedule');
      }
    } catch (err) {
      console.error('Error saving schedule:', err);
      alert('Failed to save schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/employee_schedule/${scheduleId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        loadSchedules();
      } else {
        alert(data.message || 'Failed to delete schedule');
      }
    } catch (err) {
      console.error('Error deleting schedule:', err);
      alert('Failed to delete schedule');
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

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = getWeekDays();
  const activeEmployees = employees.filter(e => e.active);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading schedules...</div>;
  }

  return (
    <div>
      {/* Week Navigation */}
      <div style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigateWeek(-1)}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: '#fff',
              fontSize: '16px'
            }}
          >
            ←
          </button>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 500, minWidth: '250px', textAlign: 'center' }}>
            {days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </h2>
          <button
            onClick={() => navigateWeek(1)}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: '#fff',
              fontSize: '16px'
            }}
          >
            →
          </button>
          <button
            onClick={goToToday}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: '#f0f0f0',
              fontSize: '14px',
              marginLeft: '8px'
            }}
          >
            Today
          </button>
        </div>
      </div>

      {/* Schedule Grid */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ 
          backgroundColor: '#fff', 
          borderRadius: '4px', 
          overflowX: 'auto',
          overflowY: 'visible',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          width: '100%'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  fontWeight: 600,
                  borderBottom: '2px solid #dee2e6',
                  color: '#495057',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#f8f9fa',
                  zIndex: 10
                }}>
                  Employee
                </th>
                {days.map((day, idx) => (
                  <th 
                    key={idx}
                    style={{ 
                      padding: '12px', 
                      textAlign: 'center', 
                      fontWeight: 600,
                      borderBottom: '2px solid #dee2e6',
                      color: '#495057',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      minWidth: '120px'
                    }}
                  >
                    <div>{weekDays[idx]}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      {day.getDate()}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map((employee, empIdx) => (
                <tr 
                  key={employee.employee_id}
                  style={{ 
                    backgroundColor: empIdx % 2 === 0 ? '#fff' : '#fafafa'
                  }}
                >
                  <td style={{ 
                    padding: '8px 12px', 
                    borderBottom: '1px solid #eee',
                    fontSize: '14px',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: empIdx % 2 === 0 ? '#fff' : '#fafafa',
                    zIndex: 5,
                    fontWeight: 500
                  }}>
                    {employee.first_name} {employee.last_name}
                  </td>
                  {days.map((day, dayIdx) => {
                    const daySchedules = getSchedulesForDay(day, employee.employee_id);
                    const isToday = day.toDateString() === new Date().toDateString();
                    
                    return (
                      <td
                        key={dayIdx}
                        onClick={() => handleCellClick(employee, day)}
                        style={{
                          padding: '8px',
                          borderBottom: '1px solid #eee',
                          minHeight: '80px',
                          border: isToday ? '2px solid #000' : 'none',
                          cursor: 'pointer',
                          backgroundColor: daySchedules.length > 0 ? '#e3f2fd' : 'transparent',
                          position: 'relative'
                        }}
                        title="Click to add/edit schedule"
                      >
                        {daySchedules.map((schedule, sIdx) => (
                          <div
                            key={schedule.schedule_id}
                            style={{
                              fontSize: '11px',
                              padding: '4px',
                              marginBottom: '4px',
                              backgroundColor: '#2196F3',
                              color: '#fff',
                              borderRadius: '2px',
                              cursor: 'pointer'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete schedule: ${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}?`)) {
                                handleDeleteSchedule(schedule.schedule_id);
                              }
                            }}
                            title={`${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)} (Click to delete)`}
                          >
                            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                          </div>
                        ))}
                        {daySchedules.length === 0 && (
                          <div style={{ 
                            fontSize: '10px', 
                            color: '#999', 
                            textAlign: 'center',
                            padding: '8px'
                          }}>
                            Click to add
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Form Modal */}
      {showScheduleForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
        onClick={() => setShowScheduleForm(false)}
        >
          <div 
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
              {selectedEmployee && `${selectedEmployee.first_name} ${selectedEmployee.last_name}`} - Schedule
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                Date
              </label>
              <input
                type="date"
                value={scheduleForm.schedule_date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_date: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                Start Time
              </label>
              <input
                type="time"
                value={scheduleForm.start_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                End Time
              </label>
              <input
                type="time"
                value={scheduleForm.end_time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                Break Duration (minutes)
              </label>
              <input
                type="number"
                value={scheduleForm.break_duration}
                onChange={(e) => setScheduleForm({ ...scheduleForm, break_duration: parseInt(e.target.value) || 0 })}
                min="0"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                Notes (optional)
              </label>
              <textarea
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                rows="3"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowScheduleForm(false)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: '#fff',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSchedule}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: '#000',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 500
                }}
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeManagement;

