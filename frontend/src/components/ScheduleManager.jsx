import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import SimpleScheduleView from './SimpleScheduleView';
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

function getNextMonday() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  return new Date(today.setDate(today.getDate() + diff));
}

function addWeeks(date, weeks) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + (weeks * 7));
  return newDate;
}

function addDays(date, days) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function ScheduleManager() {
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
  
  const calendarRef = useRef(null);
  const [startDate, setStartDate] = useState(() => {
    const nextMonday = getNextMonday();
    return nextMonday.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const nextMonday = getNextMonday();
    const end = new Date(nextMonday);
    end.setDate(end.getDate() + 6); // End of week
    return end.toISOString().split('T')[0];
  });
  const [selectedRange, setSelectedRange] = useState(() => {
    const nextMonday = getNextMonday();
    const start = nextMonday.toISOString().split('T')[0];
    const end = new Date(nextMonday);
    end.setDate(end.getDate() + 6);
    return { start, end: end.toISOString().split('T')[0] };
  });
  const [schedule, setSchedule] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'timeline', 'employee'
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [settings, setSettings] = useState({
    algorithm: 'balanced',
    max_consecutive_days: 6,
    min_time_between_shifts: 10,
    distribute_hours_evenly: true,
    avoid_clopening: true,
    prioritize_seniority: false,
    min_employees_per_shift: 2,
    max_employees_per_shift: 5,
    default_shift_length: 8,
    preferred_start_times: ['09:00', '10:00', '14:00'],
    exclude_employees: []
  });

  const token = localStorage.getItem('sessionToken');

  useEffect(() => {
    loadTemplates();
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      // Handle both response formats
      const employeesList = data.data || data.employees || [];
      const activeEmployees = employeesList.filter(e => e.active === 1 || e.active === '1');
      setEmployees(activeEmployees);
      // Select all employees by default
      setSelectedEmployees(activeEmployees.map(e => e.employee_id));
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/schedule/templates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const generateSchedule = async () => {
    if (selectedEmployees.length === 0) {
      alert('⚠️ Please select at least one employee to schedule.');
      return;
    }

    if (!startDate || !endDate) {
      alert('⚠️ Please select both start and end dates.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert('⚠️ Start date must be before end date.');
      return;
    }

    if (!confirm(`Generate DRAFT schedule for ${selectedEmployees.length} employee(s) from ${startDate} to ${endDate}?`)) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          week_start_date: startDate,
          settings: {
            ...settings,
            selected_employees: selectedEmployees,
            excluded_employees: settings.exclude_employees || [],
            week_end_date: endDate
          }
        })
      });

      const result = await response.json();
      
      if (result.period_id) {
        const message = `✅ Draft Schedule Generated!\n\n` +
          `📊 ${result.shifts_generated || 0} shifts created\n` +
          `⏱️  Total hours: ${(result.total_hours || 0).toFixed(1)}\n` +
          `💰 Estimated cost: $${(result.estimated_cost || 0).toFixed(2)}\n\n` +
          `You can now review and edit the schedule before confirming.`;
        
        alert(message);
        loadSchedule(result.period_id);
      } else {
        alert('❌ Failed to generate schedule: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to generate schedule:', err);
      alert('❌ Failed to generate schedule: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async (periodId) => {
    try {
      const response = await fetch(`/api/schedule/${periodId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      console.log('Loaded schedule data:', data);
      console.log('Shifts count:', data.shifts?.length || 0);
      if (data.shifts && data.shifts.length > 0) {
        console.log('First shift sample:', data.shifts[0]);
      }
      setSchedule(data);
    } catch (err) {
      console.error('Failed to load schedule:', err);
    }
  };

  const copyFromTemplate = async (templateId) => {
    try {
      const response = await fetch('/api/schedule/copy-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          template_id: templateId,
          week_start_date: startDate
        })
      });

      const result = await response.json();
      
      if (result.success && result.period_id) {
        alert('✅ Schedule copied from template!');
        loadSchedule(result.period_id);
      } else {
        alert('❌ Failed to copy template: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to copy template:', err);
      alert('❌ Failed to copy template');
    }
  };

  const saveAsTemplate = async () => {
    if (!schedule) return;
    
    const name = prompt('Template name:');
    if (!name) return;

    const description = prompt('Description (optional):') || '';

    try {
      const response = await fetch(`/api/schedule/${schedule.period.period_id}/save-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          template_name: name,
          description: description
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Schedule saved as template!');
        loadTemplates();
      } else {
        alert('❌ Failed to save template: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('❌ Failed to save template');
    }
  };

  const publishSchedule = async () => {
    if (!schedule) return;
    
    if (schedule.period.status !== 'draft') {
      alert('⚠️ This schedule has already been published.');
      return;
    }
    
    if (schedule.conflicts && schedule.conflicts.length > 0) {
      const conflictList = schedule.conflicts.map(c => `• ${c.message}`).join('\n');
      const proceed = confirm(
        `⚠️ Warning: ${schedule.conflicts.length} conflict(s) detected:\n\n${conflictList}\n\nPublish anyway?`
      );
      
      if (!proceed) return;
    }

    if (!confirm('📤 Confirm and publish this schedule?\n\nThis will:\n• Send notifications to all employees\n• Add shifts to the master calendar\n• Make the schedule final (no longer editable)')) {
      return;
    }

    try {
      const response = await fetch(`/api/schedule/${schedule.period.period_id}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Schedule confirmed and published!\n\n• Employees have been notified\n• Shifts added to master calendar\n• Schedule is now final');
        loadSchedule(schedule.period.period_id);
      } else {
        alert('❌ Failed to publish schedule: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to publish schedule:', err);
      alert('❌ Failed to publish schedule');
    }
  };

  const updateShift = async (shiftId, updates) => {
    if (!schedule || schedule.period.status !== 'draft') {
      alert('⚠️ Can only edit draft schedules.');
      return;
    }

    try {
      const response = await fetch(`/api/schedule/${schedule.period.period_id}/shift`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scheduled_shift_id: shiftId,
          ...updates
        })
      });

      const result = await response.json();
      
      if (result.success) {
        loadSchedule(schedule.period.period_id);
        setEditingShift(null);
      } else {
        alert('❌ Failed to update shift: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to update shift:', err);
      alert('❌ Failed to update shift');
    }
  };

  const deleteShift = async (shiftId) => {
    if (!schedule || schedule.period.status !== 'draft') {
      alert('⚠️ Can only edit draft schedules.');
      return;
    }

    if (!confirm('Delete this shift?')) {
      return;
    }

    try {
      const response = await fetch(`/api/schedule/${schedule.period.period_id}/shift?shift_id=${shiftId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        loadSchedule(schedule.period.period_id);
      } else {
        alert('❌ Failed to delete shift: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to delete shift:', err);
      alert('❌ Failed to delete shift');
    }
  };

  const toggleEmployeeSelection = (employeeId) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const selectAllEmployees = () => {
    setSelectedEmployees(employees.map(e => e.employee_id));
  };

  const deselectAllEmployees = () => {
    setSelectedEmployees([]);
  };

  return (
    <div style={{ padding: '0', maxWidth: '100%' }}>
      {/* Schedule Generation Form */}
      <div style={{ 
        marginBottom: '30px',
        padding: '24px',
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff'
      }}>
        <form onSubmit={(e) => { e.preventDefault(); generateSchedule(); }}>
          {/* Date Range Calendar and Employee Selection */}
          <div style={{ display: 'flex', gap: '30px', marginBottom: '25px', alignItems: 'flex-start' }}>
            {/* Date Range Calendar */}
            <div style={{ flex: '0 0 400px' }}>
              <div style={{ marginBottom: '15px' }}>
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{
                    left: 'prev',
                    center: 'title',
                    right: 'next'
                  }}
                  selectable={true}
                  selectMirror={true}
                  dayMaxEvents={true}
                  select={(selectInfo) => {
                    const start = selectInfo.startStr;
                    const end = new Date(selectInfo.end);
                    end.setDate(end.getDate() - 1); // FullCalendar's end is exclusive
                    const endStr = end.toISOString().split('T')[0];
                    
                    setStartDate(start);
                    setEndDate(endStr);
                    setSelectedRange({
                      start: start,
                      end: endStr
                    });
                    
                    // Clear selection after setting dates
                    calendarRef.current?.getApi().unselect();
                  }}
                  selectOverlap={false}
                  height={300}
                  aspectRatio={1.35}
                  events={selectedRange ? [{
                    title: 'Selected Period',
                    start: selectedRange.start,
                    end: new Date(new Date(selectedRange.end).setDate(new Date(selectedRange.end).getDate() + 1)).toISOString().split('T')[0],
                    display: 'background',
                    backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
                    borderColor: `rgba(${themeColorRgb}, 0.5)`
                  }] : []}
                />
              </div>
              {startDate && endDate && (
                <div style={{ 
                  padding: '10px', 
                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff', 
                  border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000',
                  borderRadius: '0',
                  fontSize: '13px',
                  fontFamily: '"Product Sans", sans-serif',
                  marginBottom: '15px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Period: {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {(() => {
                    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
                    return ` (${days} day${days !== 1 ? 's' : ''})`;
                  })()}
                </div>
              )}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: '10px',
                marginBottom: '15px'
              }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate && e.target.value > endDate) {
                      setEndDate(e.target.value);
                    }
                    setSelectedRange({
                      start: e.target.value,
                      end: endDate || e.target.value
                    });
                  }}
                  required
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    border: 'none',
                    borderBottom: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000',
                    borderRadius: '0',
                    fontSize: '14px',
                    backgroundColor: 'transparent',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    cursor: 'pointer',
                    fontFamily: '"Product Sans", sans-serif',
                    outline: 'none'
                  }}
                />
                <span style={{
                  fontSize: '14px',
                  fontFamily: '"Product Sans", sans-serif',
                  fontWeight: 500,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  to
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    if (startDate && e.target.value < startDate) {
                      setStartDate(e.target.value);
                    }
                    setSelectedRange({
                      start: startDate || e.target.value,
                      end: e.target.value
                    });
                  }}
                  min={startDate}
                  required
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    border: 'none',
                    borderBottom: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000',
                    borderRadius: '0',
                    fontSize: '14px',
                    backgroundColor: 'transparent',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    cursor: 'pointer',
                    fontFamily: '"Product Sans", sans-serif',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Employee Selection */}
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
                <button 
                  type="button"
                  onClick={selectAllEmployees}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#fff',
                    boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                    transition: 'all 0.3s ease',
                    fontFamily: '"Product Sans", sans-serif'
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
                  Select All
                </button>
                <button 
                  type="button"
                  onClick={deselectAllEmployees}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: `1px solid rgba(${themeColorRgb}, 0.3)`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#fff',
                    boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
                    transition: 'all 0.3s ease',
                    fontFamily: '"Product Sans", sans-serif'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
                  }}
                >
                  Deselect All
                </button>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '8px',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {employees.map(emp => (
                  <label
                    key={emp.employee_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      fontFamily: '"Product Sans", sans-serif',
                      fontSize: '14px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(emp.employee_id)}
                      onChange={() => toggleEmployeeSelection(emp.employee_id)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                    />
                    <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                      {emp.first_name} {emp.last_name}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>


          {/* Advanced Settings (Collapsible) */}
          <div style={{ marginBottom: '25px' }}>
            <button 
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: showSettings ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: showSettings ? '1px solid rgba(255, 255, 255, 0.3)' : `1px solid rgba(${themeColorRgb}, 0.3)`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: '#fff',
                marginBottom: showSettings ? '15px' : '0',
                textAlign: 'left',
                boxShadow: showSettings ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
                transition: 'all 0.3s ease',
                fontFamily: '"Product Sans", sans-serif'
              }}
              onMouseEnter={(e) => {
                if (!showSettings) {
                  e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
                }
              }}
              onMouseLeave={(e) => {
                if (!showSettings) {
                  e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
                }
              }}
            >
              {showSettings ? '▼' : '▶'} Advanced Settings {showSettings ? '(Click to hide)' : '(Click to show)'}
            </button>

      {showSettings && (
        <div style={{
          padding: '20px',
          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000',
          borderRadius: '0',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
                marginTop: '15px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ 
                    margin: '0', 
                    fontSize: '15px',
                    fontFamily: '"Product Sans", sans-serif',
                    fontWeight: 600,
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Generation Settings
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: showAdvanced ? `rgba(${themeColorRgb}, 0.7)` : `rgba(${themeColorRgb}, 0.2)`,
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      border: showAdvanced ? '1px solid rgba(255, 255, 255, 0.3)' : `1px solid rgba(${themeColorRgb}, 0.3)`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#fff',
                      boxShadow: showAdvanced ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
                      transition: 'all 0.3s ease',
                      fontFamily: '"Product Sans", sans-serif'
                    }}
                    onMouseEnter={(e) => {
                      if (!showAdvanced) {
                        e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!showAdvanced) {
                        e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
                      }
                    }}
                  >
                    {showAdvanced ? 'Hide' : 'Show'} Advanced
                  </button>
                </div>
          
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '8px', 
                      fontWeight: 500, 
                      fontSize: '14px',
                      fontFamily: '"Product Sans", sans-serif',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                    }}>
              Algorithm:
                    </label>
              <select 
                value={settings.algorithm}
                onChange={(e) => setSettings({...settings, algorithm: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '10px', 
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000',
                        borderRadius: '0',
                        fontSize: '14px',
                        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        fontFamily: '"Product Sans", sans-serif'
                      }}
                    >
                      <option value="balanced">Balanced (Default)</option>
                      <option value="cost_optimized">Cost Optimized</option>
                      <option value="preference_prioritized">Preference Priority</option>
              </select>
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '8px', 
                      fontWeight: 500, 
                      fontSize: '14px',
                      fontFamily: '"Product Sans", sans-serif',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                    }}>
              Max Consecutive Days:
                    </label>
              <input 
                type="number"
                value={settings.max_consecutive_days}
                onChange={(e) => setSettings({...settings, max_consecutive_days: parseInt(e.target.value)})}
                min="1"
                max="7"
                      style={{ 
                        width: '100%', 
                        padding: '10px', 
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000',
                        borderRadius: '0',
                        fontSize: '14px',
                        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        fontFamily: '"Product Sans", sans-serif'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '8px', 
                      fontWeight: 500, 
                      fontSize: '14px',
                      fontFamily: '"Product Sans", sans-serif',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                    }}>
              Min Hours Between Shifts:
                    </label>
              <input 
                type="number"
                value={settings.min_time_between_shifts}
                onChange={(e) => setSettings({...settings, min_time_between_shifts: parseInt(e.target.value)})}
                min="8"
                max="24"
                      style={{ 
                        width: '100%', 
                        padding: '10px', 
                        border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000',
                        borderRadius: '0',
                        fontSize: '14px',
                        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        fontFamily: '"Product Sans", sans-serif'
                      }}
                    />
                  </div>

                  {showAdvanced && (
                    <>
                      <div>
                        <label style={{ 
                          display: 'block', 
                          marginBottom: '8px', 
                          fontWeight: 500, 
                          fontSize: '14px',
                          fontFamily: '"Product Sans", sans-serif',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                        }}>
                          Min Employees per Shift:
            </label>
                        <input 
                          type="number"
                          value={settings.min_employees_per_shift}
                          onChange={(e) => setSettings({...settings, min_employees_per_shift: parseInt(e.target.value)})}
                          min="1"
                          max="10"
                          style={{ 
                            width: '100%', 
                            padding: '10px', 
                            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000',
                            borderRadius: '0',
                            fontSize: '14px',
                            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                            fontFamily: '"Product Sans", sans-serif'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ 
                          display: 'block', 
                          marginBottom: '8px', 
                          fontWeight: 500, 
                          fontSize: '14px',
                          fontFamily: '"Product Sans", sans-serif',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                        }}>
                          Max Employees per Shift:
                        </label>
                        <input 
                          type="number"
                          value={settings.max_employees_per_shift}
                          onChange={(e) => setSettings({...settings, max_employees_per_shift: parseInt(e.target.value)})}
                          min="1"
                          max="20"
                          style={{ 
                            width: '100%', 
                            padding: '10px', 
                            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000',
                            borderRadius: '0',
                            fontSize: '14px',
                            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                            fontFamily: '"Product Sans", sans-serif'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ 
                          display: 'block', 
                          marginBottom: '8px', 
                          fontWeight: 500, 
                          fontSize: '14px',
                          fontFamily: '"Product Sans", sans-serif',
                          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                        }}>
                          Default Shift Length (hours):
                        </label>
                        <input 
                          type="number"
                          value={settings.default_shift_length}
                          onChange={(e) => setSettings({...settings, default_shift_length: parseInt(e.target.value)})}
                          min="4"
                          max="12"
                          style={{ 
                            width: '100%', 
                            padding: '10px', 
                            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000',
                            borderRadius: '0',
                            fontSize: '14px',
                            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                            fontFamily: '"Product Sans", sans-serif'
                          }}
                        />
                      </div>
                    </>
                  )}

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      marginTop: '10px',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
              <input 
                type="checkbox"
                checked={settings.distribute_hours_evenly}
                onChange={(e) => setSettings({...settings, distribute_hours_evenly: e.target.checked})}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
                      <span style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Distribute Hours Evenly</span>
            </label>

                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      marginTop: '10px',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
              <input 
                type="checkbox"
                checked={settings.avoid_clopening}
                onChange={(e) => setSettings({...settings, avoid_clopening: e.target.checked})}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: isDarkMode ? 'var(--theme-color, #8400ff)' : '#000' }}
                      />
                      <span style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Avoid Clopening (close then open)</span>
                    </label>

                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      marginTop: '10px',
                      fontFamily: '"Product Sans", sans-serif'
                    }}>
                      <input 
                        type="checkbox"
                        checked={settings.prioritize_seniority}
                        onChange={(e) => setSettings({...settings, prioritize_seniority: e.target.checked})}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: isDarkMode ? 'var(--theme-color, #8400ff)' : '#000' }}
                      />
                      <span style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Prioritize Seniority</span>
            </label>
                  </div>
          </div>
        </div>
      )}
          </div>

          {/* Generate Button */}
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            justifyContent: 'flex-end',
            paddingTop: '20px',
            borderTop: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #000',
            marginTop: '20px'
          }}>
            <button
              type="button"
              onClick={() => {
                setSchedule(null);
                setShowSettings(false);
              }}
              style={{
                padding: '10px 16px',
                backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: `1px solid rgba(${themeColorRgb}, 0.3)`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                color: '#fff',
                boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
                transition: 'all 0.3s ease',
                fontFamily: '"Product Sans", sans-serif'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
              }}
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={loading || selectedEmployees.length === 0}
              style={{
                padding: '10px 16px',
                cursor: (loading || selectedEmployees.length === 0) ? 'not-allowed' : 'pointer',
                backgroundColor: (loading || selectedEmployees.length === 0) ? `rgba(${themeColorRgb}, 0.3)` : `rgba(${themeColorRgb}, 0.7)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                boxShadow: (loading || selectedEmployees.length === 0) ? `0 2px 8px rgba(${themeColorRgb}, 0.1)` : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                transition: 'all 0.3s ease',
                fontFamily: '"Product Sans", sans-serif'
              }}
              onMouseEnter={(e) => {
                if (!loading && selectedEmployees.length > 0) {
                  e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
                  e.target.style.boxShadow = `0 4px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && selectedEmployees.length > 0) {
                  e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
                  e.target.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                }
              }}
            >
              {loading ? 'Generating...' : 'Generate Draft Schedule'}
            </button>
          </div>
        </form>
      </div>

      {/* Draft Schedule Display */}
      {schedule && (
        <div style={{
          marginTop: '30px',
          padding: '25px',
          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '15px',
            borderBottom: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd'
          }}>
        <div>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '24px', fontWeight: '600', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                {schedule.period.status === 'draft' ? 'Draft Schedule' : 'Published Schedule'}
              </h2>
              <p style={{ margin: '0', fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #999)' : '#666' }}>
                {schedule.period.status === 'draft' 
                  ? 'Review and edit the schedule below, then click "Confirm & Publish" when ready.'
                  : 'This schedule has been published and is now final.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {schedule.period.status === 'draft' && (
                <>
                  <button 
                    onClick={saveAsTemplate}
                    style={{ 
                      padding: '10px 16px', 
                      cursor: 'pointer',
                      backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      border: `1px solid rgba(${themeColorRgb}, 0.3)`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#fff',
                      boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
                      transition: 'all 0.3s ease',
                      fontFamily: '"Product Sans", sans-serif'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
                    }}
                  >
                    Save as Template
                  </button>
                  <button 
                    onClick={publishSchedule}
                    style={{ 
                      padding: '10px 16px', 
                      cursor: 'pointer',
                      backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#fff',
                      boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                      transition: 'all 0.3s ease',
                      fontFamily: '"Product Sans", sans-serif'
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
                    Confirm & Publish
                  </button>
                </>
              )}
              {schedule.period.status === 'published' && (
                <span style={{
                  padding: '10px 20px',
                  border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f5f5f5'
                }}>
                  Published
                </span>
              )}
            </div>
          </div>
          {/* Conflicts Alert */}
          {schedule.conflicts && schedule.conflicts.length > 0 && (
            <div style={{
              padding: '20px',
              border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
              marginBottom: '20px',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff'
            }}>
              <h3 style={{ margin: '0 0 15px 0', color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                {schedule.conflicts.length} Conflict(s) Detected
              </h3>
              {schedule.conflicts.map((conflict, i) => (
                <div key={i} style={{ 
                  marginTop: '10px',
                  padding: '10px',
                  border: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #ddd',
                  backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fafafa',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  <strong>{conflict.type}:</strong> {conflict.message}
                  {conflict.employee && <span> - {conflict.employee}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Simple Schedule View */}
          {schedule.period && (
            <SimpleScheduleView periodId={schedule.period.period_id} />
          )}
        </div>
      )}
    </div>
  );
}

// Schedule Grid Component
function ScheduleGrid({ schedule, editable, onEdit, onUpdate, onDelete, employees }) {
  const [editingShift, setEditingShift] = React.useState(null);
  const weekStart = new Date(schedule.period.week_start_date);
  const weekEnd = new Date(schedule.period.week_end_date);
  
  // Get all unique dates in the schedule period
  const dates = [];
  const currentDate = new Date(weekStart);
  while (currentDate <= weekEnd) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const getShiftsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return schedule.shifts.filter(shift => 
      shift.shift_date === dateStr
    ).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  // Removed getDayColor - using minimal white background

  const handleEdit = (shift) => {
    if (editable) {
      setEditingShift(shift);
      if (onEdit) onEdit(shift);
    }
  };

  const handleSave = (shiftId, updates) => {
    onUpdate(shiftId, updates);
    setEditingShift(null);
  };

  return (
    <div>
      {editingShift && (
        <EditShiftModal
          shift={editingShift}
          employees={employees}
          onSave={handleSave}
          onCancel={() => setEditingShift(null)}
        />
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(dates.length, 7)}, 1fr)`,
        gap: '12px',
        marginTop: '20px'
      }}>
        {dates.map((date, index) => {
          const shifts = getShiftsForDate(date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
          
          return (
            <div key={date.toISOString()} style={{
              border: '1px solid #ddd',
              padding: '12px',
              backgroundColor: '#fff',
              minHeight: '400px'
            }}>
              <div style={{ 
                marginBottom: '12px', 
                borderBottom: '1px solid #ddd', 
                paddingBottom: '8px' 
              }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>
                  {dayName}
                </h4>
                <span style={{ fontSize: '12px', fontWeight: '400' }}>
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              
              <div>
                {shifts.length === 0 ? (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    fontSize: '13px'
                  }}>
                    No shifts scheduled
                  </div>
                ) : (
                  shifts.map(shift => (
                    <div 
                      key={shift.scheduled_shift_id} 
                      style={{
                        border: '1px solid #ddd',
                        padding: '10px',
                        marginBottom: '8px',
                        cursor: editable ? 'pointer' : 'default',
                        position: 'relative'
                      }}
                      onClick={() => editable && handleEdit(shift)}
                    >
                      {editable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(shift.scheduled_shift_id);
                          }}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            padding: '2px 6px',
                            backgroundColor: 'transparent',
                            border: '1px solid #ddd',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ✕
                        </button>
                      )}
                      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                      </div>
                      <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                        {shift.first_name} {shift.last_name}
                      </div>
                      {shift.position && (
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>
                          {shift.position}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Edit Shift Modal Component
function EditShiftModal({ shift, employees, onSave, onCancel }) {
  const [formData, setFormData] = React.useState({
    employee_id: shift.employee_id,
    start_time: shift.start_time.substring(0, 5),
    end_time: shift.end_time.substring(0, 5),
    position: shift.position || '',
    notes: shift.notes || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(shift.scheduled_shift_id, {
      ...formData,
      start_time: formData.start_time + ':00',
      end_time: formData.end_time + ':00',
      shift_date: shift.shift_date
    });
  };

  return (
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
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <h2 style={{ margin: '0 0 20px 0' }}>Edit Shift</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
              Employee:
            </label>
            <select
              value={formData.employee_id}
              onChange={(e) => setFormData({...formData, employee_id: parseInt(e.target.value)})}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              {employees.map(emp => (
                <option key={emp.employee_id} value={emp.employee_id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
                Start Time:
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
                End Time:
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
              Position (optional):
            </label>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => setFormData({...formData, position: e.target.value})}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
              placeholder="e.g., cashier, manager"
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 20px',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Timeline View Component
function TimelineView({ schedule }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weekStart = new Date(schedule.period.week_start_date);

  const getShiftsForDay = (dayOffset) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    
    return schedule.shifts.filter(shift => 
      shift.shift_date === dateStr
    );
  };

  const getShiftPosition = (startTime, endTime) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startPos = (startHour + startMin / 60) * 40; // 40px per hour
    const height = ((endHour + endMin / 60) - (startHour + startMin / 60)) * 40;
    return { top: startPos, height };
  };

  return (
    <div style={{ marginTop: '20px', overflowX: 'auto' }}>
    <div style={{
      display: 'grid',
        gridTemplateColumns: '80px repeat(7, 1fr)',
        minWidth: '1200px',
        border: '1px solid #ddd',
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        {/* Hour labels */}
        <div style={{ padding: '10px', borderRight: '1px solid #ddd' }}>
          <div style={{ height: '40px' }}></div>
          {hours.map(hour => (
            <div key={hour} style={{ 
              height: '40px', 
              borderTop: '1px solid #ddd',
              padding: '4px',
              fontSize: '12px'
            }}>
              {hour}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, dayIndex) => {
          const shifts = getShiftsForDay(dayIndex);
          const date = new Date(weekStart);
          date.setDate(date.getDate() + dayIndex);
          
          return (
        <div key={day} style={{
              borderRight: '1px solid #ddd',
              position: 'relative',
              backgroundColor: '#fff'
            }}>
              <div style={{ 
          padding: '10px',
                borderBottom: '1px solid #ddd',
                fontWeight: '600',
                textAlign: 'center'
              }}>
                <div>{day}</div>
                <div style={{ fontSize: '11px', fontWeight: '400', marginTop: '2px' }}>
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
          </div>
          
              <div style={{ position: 'relative', height: '960px' }}>
                {hours.map(hour => (
                  <div key={hour} style={{ 
                    height: '40px', 
                    borderTop: '1px solid #ddd'
                  }}></div>
                ))}
                
                {shifts.map(shift => {
                  const pos = getShiftPosition(shift.start_time, shift.end_time);
                  return (
                    <div
                      key={shift.scheduled_shift_id}
                      style={{
                        position: 'absolute',
                        top: `${pos.top}px`,
                        left: '4px',
                        right: '4px',
                        height: `${pos.height}px`,
                        border: '1px solid #ddd',
                        padding: '4px',
                        fontSize: '11px',
                        overflow: 'hidden',
                        backgroundColor: '#fff'
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>
                        {shift.first_name} {shift.last_name}
                      </div>
                      <div style={{ fontSize: '10px' }}>
                        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Employee View Component
function EmployeeView({ schedule }) {
  const employees = [...new Set(schedule.shifts.map(s => ({
    id: s.employee_id,
    name: `${s.first_name} ${s.last_name}`
  })))].sort((a, b) => a.name.localeCompare(b.name));

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const weekStart = new Date(schedule.period.week_start_date);

  const getShiftsForEmployee = (employeeId) => {
    return schedule.shifts.filter(shift => shift.employee_id === employeeId)
      .sort((a, b) => a.shift_date.localeCompare(b.shift_date));
  };

  return (
    <div style={{ marginTop: '20px' }}>
      {employees.map(emp => {
        const shifts = getShiftsForEmployee(emp.id);
        const totalHours = shifts.reduce((sum, shift) => {
          const [startH, startM] = shift.start_time.split(':').map(Number);
          const [endH, endM] = shift.end_time.split(':').map(Number);
          const hours = (endH + endM/60) - (startH + startM/60);
          return sum + hours;
        }, 0);

        return (
          <div key={emp.id} style={{
            marginBottom: '20px',
            border: '1px solid #ddd',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}>
            <div style={{
              padding: '15px',
              borderBottom: '1px solid #ddd',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{emp.name}</h3>
              <div style={{ fontSize: '14px' }}>
                {shifts.length} shifts • {totalHours.toFixed(1)} hours
                </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              borderTop: '1px solid #ddd'
            }}>
              {days.map((day, index) => {
                const date = new Date(weekStart);
                date.setDate(date.getDate() + index);
                const dateStr = date.toISOString().split('T')[0];
                const dayShifts = shifts.filter(s => s.shift_date === dateStr);
                
                return (
                  <div key={day} style={{
                    padding: '10px',
                    borderRight: index < 6 ? '1px solid #ddd' : 'none',
                    minHeight: '80px'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
                      {day.substring(0, 3)}
                    </div>
                    {dayShifts.map(shift => (
                      <div key={shift.scheduled_shift_id} style={{
                        border: '1px solid #ddd',
                        padding: '6px',
                        marginBottom: '4px',
                        fontSize: '11px'
                      }}>
                        <div style={{ fontWeight: '600' }}>
                          {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                </div>
                {shift.position && (
                          <div style={{ fontSize: '10px', marginTop: '2px' }}>
                    {shift.position}
                  </div>
                )}
              </div>
            ))}
          </div>
                );
              })}
        </div>
          </div>
        );
      })}
    </div>
  );
}

export default ScheduleManager;
