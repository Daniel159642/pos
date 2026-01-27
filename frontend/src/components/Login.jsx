import { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import '../index.css'

function Login({ onLogin }) {
  const { themeColor } = useTheme()
  const [employeeCode, setEmployeeCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [employeesError, setEmployeesError] = useState('')

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  const themeColorRgb = hexToRgb(themeColor)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    setEmployeesError('')
    try {
      const response = await fetch('/api/employees')
      const text = await response.text()
      let data = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        console.error('Error fetching employees: invalid JSON', { status: response.status, text: text.slice(0, 200) })
        setEmployeesError(response.ok ? 'Invalid response from server.' : `Server error (${response.status}). Check that the backend is running.`)
        setEmployees([])
        setLoadingEmployees(false)
        return
      }
      if (!response.ok) {
        const msg = data?.error || data?.message || `Server error (${response.status})`
        setEmployeesError(msg)
        setEmployees([])
        setLoadingEmployees(false)
        return
      }
      setEmployees(data?.data ?? [])
    } catch (err) {
      console.error('Error fetching employees:', err)
      setEmployeesError('Could not load employees. Check that the backend server is running.')
      setEmployees([])
    } finally {
      setLoadingEmployees(false)
    }
  }

  const handleNumpadClick = (value) => {
    if (value === 'backspace') {
      setPassword((prev) => prev.slice(0, -1))
    } else {
      setPassword((prev) => (prev.length >= 6 ? prev : prev + value))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: employeeCode,
          employee_code: employeeCode,
          password
        }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        try {
          const errorJson = JSON.parse(errorText)
          setError(errorJson.message || `Server error: ${response.status}`)
        } catch {
          setError(`Server error: ${response.status} - ${errorText}`)
        }
        setLoading(false)
        return
      }

      const result = await response.json()
      if (result.success) {
        onLogin(result)
      } else {
        setError(result.message || 'Login failed')
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') {
        setError('Request timed out. Please check if the backend server is running on port 5001.')
      } else {
        setError('Connection error. Please make sure the backend server is running on port 5001.')
      }
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        padding: '20px'
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          padding: '24px 40px 40px 40px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px var(--shadow)',
          width: '100%',
          maxWidth: '400px',
          border: '1px solid var(--border-light)'
        }}
      >
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '8px',
            textAlign: 'center'
          }}
        >
          Sign in to Swift
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            marginBottom: '24px',
            textAlign: 'center'
          }}
        >
          Select employee and enter password
        </p>

        <form onSubmit={handleSubmit}>
          {employeesError && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            >
              {employeesError}
            </div>
          )}
          <div style={{ marginBottom: '20px' }}>
            <select
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              required
              disabled={loadingEmployees}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: `2px solid rgba(${themeColorRgb}, 0.4)`,
                borderRadius: '12px',
                fontSize: '15px',
                fontFamily: 'inherit',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                cursor: loadingEmployees ? 'wait' : 'pointer',
                opacity: loadingEmployees ? 0.6 : 1,
                outline: 'none',
                transition: 'all 0.2s ease',
                boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`
              }}
              onFocus={(e) => {
                e.target.style.borderColor = `rgba(${themeColorRgb}, 0.7)`
                e.target.style.boxShadow = `0 4px 12px rgba(${themeColorRgb}, 0.2)`
              }}
              onBlur={(e) => {
                e.target.style.borderColor = `rgba(${themeColorRgb}, 0.4)`
                e.target.style.boxShadow = `0 2px 8px rgba(${themeColorRgb}, 0.1)`
              }}
            >
              <option value="">
                {loadingEmployees ? 'Loading employees...' : 'Select an employee...'}
              </option>
              {employees.map((emp) => (
                <option
                  key={emp.employee_id}
                  value={emp.username || emp.employee_code || String(emp.employee_id)}
                >
                  {emp.first_name} {emp.last_name}{' '}
                  {emp.username ? `(${emp.username})` : emp.employee_code ? `(${emp.employee_code})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              textAlign: 'center',
              fontSize: '36px',
              letterSpacing: '12px',
              fontFamily: 'monospace',
              minHeight: '50px',
              padding: '15px 0',
              marginBottom: '15px',
              display: 'flex',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: i < password.length ? '#666' : 'transparent',
                  border: '2px solid #666',
                  transition: 'background-color 0.2s ease'
                }}
              />
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginTop: '15px',
              marginBottom: '8px',
              justifyContent: 'center'
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumpadClick(num.toString())}
                style={{
                  width: '80px',
                  height: '80px',
                  padding: 0,
                  fontSize: '28px',
                  fontWeight: 600,
                  backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.85)`
                  e.target.style.transform = 'scale(0.95)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
                  e.target.style.transform = 'scale(1)'
                }}
              >
                {num}
              </button>
            ))}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginBottom: '20px',
              justifyContent: 'center'
            }}
          >
            <button
              type="button"
              onClick={() => handleNumpadClick('backspace')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: '24px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto'
              }}
            >
              ⌫
            </button>
            <button
              type="button"
              onClick={() => handleNumpadClick('0')}
              style={{
                width: '80px',
                height: '80px',
                padding: 0,
                fontSize: '28px',
                fontWeight: 600,
                backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                cursor: 'pointer',
                boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.85)`
                e.target.style.transform = 'scale(0.95)'
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
                e.target.style.transform = 'scale(1)'
              }}
            >
              0
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: '16px',
                fontWeight: 500,
                color: loading ? 'var(--text-tertiary)' : 'var(--text-primary)',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto'
              }}
            >
              {loading ? '...' : 'Login'}
            </button>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: '20px', marginBottom: '0' }}>
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default Login
