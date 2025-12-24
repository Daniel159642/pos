import React, { useState, useEffect } from 'react';

function EmployeeForm({ employee, roles, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    date_started: '',
    password: '',
    confirm_password: '',
    hourly_rate: '',
    salary: '',
    employment_type: 'part_time',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    notes: '',
    role_id: '',
    pin_code: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({
        username: employee.username || employee.employee_code || '',
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        position: employee.position || '',
        department: employee.department || '',
        date_started: employee.date_started || '',
        password: '',
        confirm_password: '',
        hourly_rate: employee.hourly_rate || '',
        salary: employee.salary || '',
        employment_type: employee.employment_type || 'part_time',
        address: employee.address || '',
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_phone: employee.emergency_contact_phone || '',
        notes: employee.notes || '',
        role_id: employee.role_id || '',
        pin_code: employee.pin_code || ''
      });
    }
  }, [employee]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.first_name || !formData.last_name || !formData.position || !formData.date_started) {
      setError('First name, last name, position, and date started are required');
      return;
    }

    if (!employee && !formData.password) {
      setError('Password is required for new employees');
      return;
    }

    if (formData.password && formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        username: formData.username,
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        position: formData.position,
        department: formData.department || null,
        date_started: formData.date_started,
        password: formData.password || null,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        salary: formData.salary ? parseFloat(formData.salary) : null,
        employment_type: formData.employment_type,
        address: formData.address || null,
        emergency_contact_name: formData.emergency_contact_name || null,
        emergency_contact_phone: formData.emergency_contact_phone || null,
        notes: formData.notes || null,
        role_id: formData.role_id ? parseInt(formData.role_id) : null,
        pin_code: formData.pin_code || null
      };

      let response;
      if (employee) {
        // Update existing employee
        // Don't send password if it's empty
        if (!payload.password) {
          delete payload.password;
        }
        response = await fetch(`/api/admin/employees/${employee.employee_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } else {
        // Create new employee
        response = await fetch('/api/admin/employees', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json();

      if (data.success) {
        onSave();
      } else {
        setError(data.error || 'Failed to save employee');
      }
    } catch (err) {
      setError('Failed to save employee: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{employee ? 'Edit Employee' : 'Add Employee'}</h2>
          <button className="btn-close" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label>Username *</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>First Name *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Last Name *</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Position *</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Date Started *</label>
              <input
                type="date"
                name="date_started"
                value={formData.date_started}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>{employee ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required={!employee}
              />
            </div>

            {formData.password && (
              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                />
              </div>
            )}

            <div className="form-group">
              <label>Role</label>
              <select
                name="role_id"
                value={formData.role_id}
                onChange={handleChange}
              >
                <option value="">No Role</option>
                {roles.map(role => (
                  <option key={role.role_id} value={role.role_id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>PIN Code</label>
              <input
                type="text"
                name="pin_code"
                value={formData.pin_code}
                onChange={handleChange}
                maxLength="6"
                placeholder="6-digit PIN"
              />
            </div>

            <div className="form-group">
              <label>Employment Type</label>
              <select
                name="employment_type"
                value={formData.employment_type}
                onChange={handleChange}
              >
                <option value="part_time">Part Time</option>
                <option value="full_time">Full Time</option>
                <option value="contract">Contract</option>
                <option value="temporary">Temporary</option>
              </select>
            </div>

            <div className="form-group">
              <label>Hourly Rate</label>
              <input
                type="number"
                step="0.01"
                name="hourly_rate"
                value={formData.hourly_rate}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Salary</label>
              <input
                type="number"
                step="0.01"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
              />
            </div>

            <div className="form-group full-width">
              <label>Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="2"
              />
            </div>

            <div className="form-group">
              <label>Emergency Contact Name</label>
              <input
                type="text"
                name="emergency_contact_name"
                value={formData.emergency_contact_name}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Emergency Contact Phone</label>
              <input
                type="tel"
                name="emergency_contact_phone"
                value={formData.emergency_contact_phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group full-width">
              <label>Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeForm;

