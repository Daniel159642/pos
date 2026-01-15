import React, { useState, useEffect } from 'react';

function AvailabilitySubmission({ employeeId }) {
  const [availability, setAvailability] = useState({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  });
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('sessionToken');

  useEffect(() => {
    loadAvailability();
  }, [employeeId]);

  const loadAvailability = async () => {
    try {
      const response = await fetch(`/api/availability/submit?employee_id=${employeeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Note: This endpoint might not exist yet, so we'll handle the error gracefully
      // The submit endpoint will handle creating new availability
    } catch (err) {
      console.log('No existing availability found, starting fresh');
    }
  };

  const addTimeSlot = (day) => {
    const newSlot = {
      start_time: '09:00',
      end_time: '17:00',
      type: 'available'
    };
    
    setAvailability({
      ...availability,
      [day]: [...availability[day], newSlot]
    });
  };

  const removeTimeSlot = (day, index) => {
    const newAvail = {...availability};
    newAvail[day].splice(index, 1);
    setAvailability(newAvail);
  };

  const updateTimeSlot = (day, index, field, value) => {
    const newAvail = {...availability};
    newAvail[day][index][field] = value;
    setAvailability(newAvail);
  };

  const submitAvailability = async () => {
    setLoading(true);
    
    const formatted = [];
    
    Object.keys(availability).forEach(day => {
      availability[day].forEach(slot => {
        formatted.push({
          day: day,
          start_time: slot.start_time + ':00',  // Add seconds
          end_time: slot.end_time + ':00',
          type: slot.type
        });
      });
    });

    try {
      const response = await fetch('/api/availability/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ availability: formatted })
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Availability submitted successfully!');
      } else {
        alert('Failed to submit availability: ' + (result.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to submit availability:', err);
      alert('Failed to submit availability');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>My Availability</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Set your recurring weekly availability. You can add multiple time slots per day.
      </p>

      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
        <div key={day} style={{
          marginBottom: '20px',
          padding: '15px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#fafafa'
        }}>
          <h3 style={{ marginTop: '0', textTransform: 'capitalize' }}>
            {day.charAt(0).toUpperCase() + day.slice(1)}
          </h3>
          
          {availability[day].map((slot, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '10px',
              padding: '10px',
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}>
              <input 
                type="time"
                value={slot.start_time}
                onChange={(e) => updateTimeSlot(day, index, 'start_time', e.target.value)}
                style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <span>to</span>
              <input 
                type="time"
                value={slot.end_time}
                onChange={(e) => updateTimeSlot(day, index, 'end_time', e.target.value)}
                style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              
              <select
                value={slot.type}
                onChange={(e) => updateTimeSlot(day, index, 'type', e.target.value)}
                style={{ padding: '5px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="available">Available</option>
                <option value="preferred">Preferred</option>
                <option value="unavailable">Unavailable</option>
              </select>
              
              <button 
                onClick={() => removeTimeSlot(day, index)}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Remove
              </button>
            </div>
          ))}
          
          <button 
            onClick={() => addTimeSlot(day)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + Add Time Slot
          </button>
        </div>
      ))}

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <button 
          onClick={submitAvailability}
          disabled={loading}
          style={{
            padding: '12px 24px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Submitting...' : 'Submit Availability'}
        </button>
      </div>
    </div>
  );
}

export default AvailabilitySubmission;








