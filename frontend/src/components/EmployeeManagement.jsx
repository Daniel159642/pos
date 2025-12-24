import React, { useState, useEffect } from 'react';
import { usePermissions } from '../contexts/PermissionContext';

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
      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
        You don't have permission to access Employee Management.
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: 'calc(100vh - 100px)',
      backgroundColor: '#fff',
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto',
      width: '100%'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 500, marginBottom: '8px' }}>
          Employee Management
        </h1>
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
          Manage employees and create schedules
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #eee',
        backgroundColor: '#fafafa',
        borderRadius: '4px 4px 0 0'
      }}>
        <button
          onClick={() => setActiveTab('employees')}
          style={{
            padding: '16px 24px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'employees' ? 600 : 400,
            color: activeTab === 'employees' ? '#000' : '#666',
            borderBottom: activeTab === 'employees' ? '2px solid #000' : '2px solid transparent',
            marginBottom: '-2px'
          }}
        >
          Employees
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          style={{
            padding: '16px 24px',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'schedule' ? 600 : 400,
            color: activeTab === 'schedule' ? '#000' : '#666',
            borderBottom: activeTab === 'schedule' ? '2px solid #000' : '2px solid transparent',
            marginBottom: '-2px'
          }}
        >
          Schedule Builder
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px', backgroundColor: '#fff', borderRadius: '0 0 4px 4px' }}>
        {activeTab === 'employees' && (
          <EmployeeList 
            employees={employees} 
            loading={loading} 
            error={error}
            onRefresh={loadEmployees}
          />
        )}
        {activeTab === 'schedule' && (
          <ScheduleBuilder employees={employees} />
        )}
      </div>
    </div>
  );
}

function EmployeeList({ employees, loading, error, onRefresh }) {
  const [roles, setRoles] = useState([]);
  const [availability, setAvailability] = useState({});

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
    return <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading employees...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#d32f2f' }}>
        {error}
        <button 
          onClick={onRefresh}
          style={{
            marginLeft: '16px',
            padding: '8px 16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: '#fff'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 500 }}>Employee List</h2>
        <button
          onClick={onRefresh}
          style={{
            padding: '8px 16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: '#fff',
            fontSize: '14px'
          }}
        >
          Refresh
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', backgroundColor: '#fafafa' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Name</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Username</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Email</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Position</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Role</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Department</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>This Week</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, idx) => (
              <tr 
                key={employee.employee_id}
                style={{ 
                  borderBottom: '1px solid #eee',
                  backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa'
                }}
              >
                <td style={{ padding: '12px', fontSize: '14px' }}>{employee.employee_id}</td>
                <td style={{ padding: '12px', fontSize: '14px' }}>
                  {employee.first_name} {employee.last_name}
                </td>
                <td style={{ padding: '12px', fontSize: '14px' }}>
                  {employee.username || employee.employee_code || 'N/A'}
                </td>
                <td style={{ padding: '12px', fontSize: '14px' }}>
                  {employee.email || 'N/A'}
                </td>
                <td style={{ padding: '12px', fontSize: '14px' }}>{employee.position}</td>
                <td style={{ padding: '12px', fontSize: '14px' }}>{getRoleName(employee.role_id)}</td>
                <td style={{ padding: '12px', fontSize: '14px' }}>{employee.department || 'N/A'}</td>
                <td style={{ padding: '12px', fontSize: '14px' }}>
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
                <td style={{ padding: '12px', fontSize: '14px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    backgroundColor: employee.active ? '#e8f5e9' : '#ffebee',
                    color: employee.active ? '#2e7d32' : '#c62828'
                  }}>
                    {employee.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
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
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', backgroundColor: '#fafafa' }}>
              <th style={{ 
                padding: '12px', 
                textAlign: 'left', 
                fontSize: '14px', 
                fontWeight: 600,
                position: 'sticky',
                left: 0,
                backgroundColor: '#fafafa',
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
                    fontSize: '14px', 
                    fontWeight: 600,
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
                  borderBottom: '1px solid #eee',
                  backgroundColor: empIdx % 2 === 0 ? '#fff' : '#fafafa'
                }}
              >
                <td style={{ 
                  padding: '12px', 
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
                        minHeight: '80px',
                        border: isToday ? '2px solid #000' : '1px solid #eee',
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

