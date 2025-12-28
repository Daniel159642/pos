import { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'

function Login({ onLogin }) {
  const { themeMode } = useTheme()
  const [employeeCode, setEmployeeCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: employeeCode,  // Support both username and employee_code
          employee_code: employeeCode,
          password: password
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
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px',
        border: isDarkMode ? '1px solid var(--border-color, #404040)' : 'none'
      }}>
        <h1 style={{ 
          marginTop: 0, 
          marginBottom: '30px', 
          textAlign: 'center',
          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
        }}>
          POS System Login
        </h1>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 500,
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
            }}>
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
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box',
                backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: 500,
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
            }}>
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
                border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box',
                backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px',
              marginBottom: '20px',
              backgroundColor: isDarkMode ? 'rgba(198, 40, 40, 0.2)' : '#ffebee',
              color: isDarkMode ? '#ef5350' : '#d32f2f',
              borderRadius: '4px',
              fontSize: '14px',
              border: isDarkMode ? '1px solid rgba(198, 40, 40, 0.4)' : 'none'
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
              backgroundColor: loading 
                ? (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#ccc') 
                : (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#000'),
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#333'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#000'
              }
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

