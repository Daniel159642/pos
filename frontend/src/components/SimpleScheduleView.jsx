import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

function SimpleScheduleView({ periodId }) {
  const calendarRef = useRef(null)
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    loadSchedule();
  }, [periodId]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('sessionToken');
      const response = await fetch(`/api/schedule/${periodId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load schedule');
      }
      
      const data = await response.json();
      console.log('SimpleScheduleView - Loaded schedule:', data);
      console.log('Shifts count:', data.shifts?.length || 0);
      if (data.shifts && data.shifts.length > 0) {
        console.log('First shift:', data.shifts[0]);
      }
      setSchedule(data);
    } catch (error) {
      console.error('Error loading schedule:', error);
      alert('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Convert schedule shifts to FullCalendar events
  const getFullCalendarEvents = () => {
    if (!schedule || !schedule.shifts) {
      console.log('No schedule or shifts:', { schedule, hasShifts: schedule?.shifts?.length });
      return [];
    }

    console.log('Converting shifts to events:', schedule.shifts.length);
    const events = schedule.shifts.map(shift => {
      // Ensure time has seconds if not present
      const startTime = shift.start_time.includes(':') && shift.start_time.split(':').length === 2 
        ? `${shift.start_time}:00` 
        : shift.start_time;
      const endTime = shift.end_time.includes(':') && shift.end_time.split(':').length === 2 
        ? `${shift.end_time}:00` 
        : shift.end_time;
      
      const start = new Date(`${shift.shift_date}T${startTime}`);
      const end = new Date(`${shift.shift_date}T${endTime}`);
      
      console.log('Shift:', shift.shift_date, startTime, '->', start, end);

      // Generate a color based on employee ID for visual distinction
      const colors = [
        '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
        '#fee140', '#30cfd0', '#a8edea', '#ff9a9e', '#ffecd2',
        '#fcb69f', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
        '#feca57', '#ff9ff3', '#54a0ff'
      ];
      const colorIndex = shift.employee_id % colors.length;
      const backgroundColor = colors[colorIndex];

      return {
        id: `shift-${shift.scheduled_shift_id}`,
        title: `${shift.first_name} ${shift.last_name}${shift.position ? ` - ${shift.position}` : ''}`,
        start: start.toISOString(),
        end: end.toISOString(),
        backgroundColor: backgroundColor,
        borderColor: backgroundColor,
        extendedProps: {
          ...shift,
          type: 'shift'
        }
      };
    });
    
    console.log('Generated events:', events.length);
    return events;
  };

  const handleEventClick = (clickInfo) => {
    setSelectedEvent(clickInfo.event.extendedProps);
  };

  const handleDateClick = (dateClickInfo) => {
    // Optional: handle date clicks for adding new shifts
    console.log('Date clicked:', dateClickInfo.dateStr);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        Loading schedule...
      </div>
    );
  }

  if (!schedule) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        Schedule not found
      </div>
    );
  }

  return (
    <div style={{ padding: '0', maxWidth: '100%' }}>
      {/* Schedule Header */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '16px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ 
            margin: '0 0 5px 0', 
            fontSize: '20px', 
            fontWeight: 600 
          }}>
            Schedule
          </h2>
          <p style={{ 
            margin: 0, 
            fontSize: '14px', 
            color: '#666' 
          }}>
            {new Date(schedule.period.week_start_date).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })} - {new Date(schedule.period.week_end_date).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {schedule.shifts?.length || 0} shifts scheduled
          </span>
          <button 
            onClick={() => window.print()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#fff',
              border: '1px solid #000',
              borderRadius: '0',
              cursor: 'pointer',
              fontSize: '14px',
              fontFamily: '"Roboto Mono", monospace'
            }}
          >
            Print
          </button>
        </div>
      </div>

      {/* FullCalendar */}
      <div style={{ marginBottom: '20px' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          initialDate={schedule.period.week_start_date}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridWeek,timeGridWeek,timeGridDay'
          }}
          events={getFullCalendarEvents()}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          height="auto"
          editable={false}
          selectable={false}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          weekends={true}
        />
      </div>

      {/* Selected Event Details */}
      {selectedEvent && (
        <div style={{
          border: '3px solid black',
          borderRadius: '0',
          padding: '24px',
          marginTop: '20px',
          backgroundColor: 'white'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '20px',
              fontWeight: 600
            }}>
              Shift Details
            </h3>
            <button
              onClick={() => setSelectedEvent(null)}
              style={{
                padding: '6px 12px',
                backgroundColor: 'white',
                color: 'black',
                border: '1px solid #000',
                borderRadius: '0',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: '"Roboto Mono", monospace'
              }}
            >
              Close
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              padding: '16px',
              border: '1px solid #e0e0e0',
              borderRadius: '0',
              borderLeft: '4px solid #2196F3'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'start',
                marginBottom: '8px'
              }}>
                <div>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 500, 
                    marginBottom: '4px'
                  }}>
                    {selectedEvent.first_name} {selectedEvent.last_name}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#666'
                  }}>
                    {formatTime(selectedEvent.start_time)} - {formatTime(selectedEvent.end_time)}
                  </div>
                  {selectedEvent.shift_date && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Date: {new Date(selectedEvent.shift_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div style={{
                  padding: '4px 8px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  fontSize: '11px',
                  borderRadius: '0',
                  textTransform: 'capitalize'
                }}>
                  Shift
                </div>
              </div>
              {selectedEvent.position && (
                <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
                  Position: {selectedEvent.position}
                </div>
              )}
              {selectedEvent.notes && (
                <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
                  Notes: {selectedEvent.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SimpleScheduleView;
