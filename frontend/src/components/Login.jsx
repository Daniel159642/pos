import { useState } from 'react'

function Login({ onLogin }) {
  const [employeeCode, setEmployeeCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: employeeCode,  // Support both username and employee_code
          employee_code: employeeCode,
          password: password
        })
      })

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
      setError('Connection error. Please make sure the backend server is running on port 5001.')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{ marginTop: 0, marginBottom: '30px', textAlign: 'center' }}>
          POS System Login
        </h1>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              Username / Employee Code
            </label>
            <input
              type="text"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px',
              marginBottom: '20px',
              backgroundColor: '#ffebee',
              color: '#d32f2f',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#ccc' : '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login

