import { useState, useEffect, useCallback, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { ChevronDown } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  getEmployeesCache,
  setEmployeesCache,
  getOfflinePinHashes,
  setOfflinePinHash,
  hashPin,
  getPermissionsCache
} from '../services/employeeRolesCache'
import { apiFetch } from '../utils/apiFetch'
import '../index.css'

function Login({ onLogin }) {
  const { themeColor } = useTheme()
  const [employeeCode, setEmployeeCode] = useState('')
  const [password, setPassword] = useState('')
  const [revealLastDigit, setRevealLastDigit] = useState(false)
  const revealTimeoutRef = useRef(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [passwordJitter, setPasswordJitter] = useState(false)
  const formRef = useRef(null)

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  const themeColorRgb = hexToRgb(themeColor)

  function CustomDropdown({ value, onChange, options, placeholder = 'Select…', isDarkMode, themeColorRgb, style = {} }) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)

    useEffect(() => {
      const handleClickOutside = (e) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false)
      }
      if (isOpen) document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    const selected = options.find((o) => o.value === value)

    return (
      <div ref={dropdownRef} style={{ position: 'relative', ...style }}>
        <div
          role="button"
          tabIndex={0}
          data-dropdown-trigger
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen((o) => !o) } }}
          style={{
            position: 'relative',
            width: '100%',
            padding: '14px 16px',
            border: isOpen ? `2px solid rgba(${themeColorRgb}, 0.7)` : `2px solid rgba(${themeColorRgb}, 0.4)`,
            borderRadius: '12px',
            fontSize: '15px',
            backgroundColor: '#fff',
            color: selected ? '#111' : '#999',
            cursor: loadingEmployees ? 'wait' : 'pointer',
            opacity: loadingEmployees ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            outline: 'none',
            boxShadow: isOpen ? `0 4px 12px rgba(${themeColorRgb}, 0.2)` : `0 2px 8px rgba(${themeColorRgb}, 0.1)`
          }}
          onMouseEnter={(e) => {
            if (!isOpen && !loadingEmployees) e.currentTarget.style.borderColor = `rgba(${themeColorRgb}, 0.7)`
          }}
          onMouseLeave={(e) => {
            if (!isOpen) e.currentTarget.style.borderColor = `rgba(${themeColorRgb}, 0.4)`
          }}
        >
          <span style={{ flex: 1, textAlign: 'center' }}>{selected ? selected.label : (loadingEmployees ? 'Loading employees...' : placeholder)}</span>
          <ChevronDown size={16} style={{ position: 'absolute', right: '16px', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </div>
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 1000,
              maxHeight: '200px',
              overflowY: 'auto',
              overflowX: 'hidden'
            }}
          >
            {options.map((opt) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={value === opt.value}
                onClick={() => { onChange({ target: { value: opt.value } }); setIsOpen(false) }}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  color: '#111',
                  textAlign: 'center',
                  backgroundColor: value === opt.value ? `rgba(${themeColorRgb}, 0.2)` : 'transparent',
                  borderLeft: value === opt.value ? `3px solid rgba(${themeColorRgb}, 0.7)` : '3px solid transparent',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (value !== opt.value) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = value === opt.value ? `rgba(${themeColorRgb}, 0.2)` : 'transparent'
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  useEffect(() => {
    // Show cached employees immediately so login screen is quick
    const cached = getEmployeesCache()
    if (cached && cached.length > 0) {
      setEmployees(cached)
      setLoadingEmployees(false)
    }
    fetchEmployees()
  }, [])

  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!password) {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current)
        revealTimeoutRef.current = null
      }
      setRevealLastDigit(false)
    }
  }, [password])

  const fetchEmployees = async () => {
    try {
      const response = await apiFetch('/api/employees')
      if (!response.ok) {
        console.error('Error fetching employees: HTTP', response.status)
        const cached = getEmployeesCache()
        if (cached) return
        setEmployees([])
        return
      }
      const data = await response.json()
      const list = data.data || []
      setEmployees(list)
      setEmployeesCache(list)
    } catch (err) {
      console.error('Error fetching employees:', err)
      const cached = getEmployeesCache()
      if (cached) return
      setEmployees([])
    } finally {
      setLoadingEmployees(false)
    }
  }

  const handleNumpadClick = useCallback((value) => {
    if (value === 'backspace') {
      if (revealTimeoutRef.current) {
        clearTimeout(revealTimeoutRef.current)
        revealTimeoutRef.current = null
      }
      setRevealLastDigit(false)
      setPassword((prev) => prev.slice(0, -1))
    } else {
      if (password.length >= 6) return
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current)
      setRevealLastDigit(true)
      revealTimeoutRef.current = setTimeout(() => {
        revealTimeoutRef.current = null
        setRevealLastDigit(false)
      }, 600)
      setPassword((prev) => (prev.length >= 6 ? prev : prev + value))
    }
  }, [password])

  // Handle keyboard number input for numpad PIN
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip only when typing in text inputs (not select—allow PIN entry after choosing employee)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      // Handle number keys (0-9), including top row and numpad
      if ((e.key >= '0' && e.key <= '9') || (e.key >= 'NumPad0' && e.key <= 'NumPad9')) {
        e.preventDefault()
        const digit = e.key.startsWith('NumPad') ? e.key.replace('NumPad', '') : e.key
        handleNumpadClick(digit)
      }
      // Handle backspace
      else if (e.key === 'Backspace') {
        e.preventDefault()
        handleNumpadClick('backspace')
      }
      // Handle Enter to submit login (when not in input/textarea or dropdown)
      else if (e.key === 'Enter') {
        if (e.target.closest('[data-dropdown-trigger]')) return
        e.preventDefault()
        formRef.current?.requestSubmit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleNumpadClick])

  const tryOfflineLogin = async () => {
    const list = getEmployeesCache(true)
    if (!list || !employeeCode.trim() || !password) return false
    const emp = list.find(
      (e) =>
        String(e.username || '').toLowerCase() === String(employeeCode).trim().toLowerCase() ||
        String(e.employee_code || '') === String(employeeCode).trim()
    )
    if (!emp) return false
    const hashes = getOfflinePinHashes()
    const storedHash = hashes[String(emp.employee_id)]
    if (!storedHash) return false
    const inputHash = await hashPin(password)
    if (!inputHash) return false
    let diff = 0
    if (inputHash.length !== storedHash.length) return false
    for (let i = 0; i < inputHash.length; i++) diff |= inputHash.charCodeAt(i) ^ storedHash.charCodeAt(i)
    if (diff !== 0) return false
    const permissions = getPermissionsCache(emp.employee_id, true) || {}
    const employee = {
      employee_id: emp.employee_id,
      employee_name: emp.employee_name || [emp.first_name, emp.last_name].filter(Boolean).join(' ') || emp.username || String(emp.employee_id),
      position: emp.position || 'employee'
    }
    onLogin({
      success: true,
      offline: true,
      employee,
      permissions,
      session_token: 'offline'
    })
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Instant path: if we can verify PIN locally, show app immediately then get real session in background
    if (employeeCode.trim() && password) {
      const didLocal = await tryOfflineLogin()
      if (didLocal) {
        setLoading(false)
        if (navigator.onLine) {
          apiFetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: employeeCode, employee_code: employeeCode, password })
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((result) => { if (result?.success) onLogin(result) })
            .catch(() => {})
        }
        return
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await apiFetch('/api/login', {
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
        setError('')
        setPasswordJitter(true)
        setTimeout(() => {
          setPasswordJitter(false)
          setPassword('')
        }, 600)
        setLoading(false)
        return
      }

      const result = await response.json()
      if (result.success) {
        try {
          const pinHash = await hashPin(password)
          if (pinHash) setOfflinePinHash(result.employee_id, pinHash)
        } catch (_) {}
        onLogin(result)
      } else {
        setError('')
        setPasswordJitter(true)
        setTimeout(() => {
          setPasswordJitter(false)
          setPassword('')
        }, 600)
      }
    } catch (err) {
      clearTimeout(timeoutId)
      const isOffline = !navigator.onLine || err.name === 'TypeError' || err.name === 'AbortError'
      if (isOffline) {
        const didOffline = await tryOfflineLogin()
        if (didOffline) {
          setLoading(false)
          return
        }
        setError("Can't sign in offline. Use this device online first, then try again when offline.")
      } else {
        if (err.name === 'AbortError') {
          setError('Request timed out. Please check if the backend server is running on port 5001.')
        } else {
          setError('Connection error. Please make sure the backend server is running on port 5001.')
        }
      }
      setPassword('')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  const isTauri = typeof window !== 'undefined' && (window.__TAURI__ || window.__TAURI_INTERNALS__)
  const handleHeaderDrag = (e) => {
    if (e.target.closest('button')) return
    try {
      getCurrentWindow().startDragging()
    } catch (_) {}
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      {isTauri && (
        <div
          data-tauri-drag-region
          onMouseDown={handleHeaderDrag}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            width: '100%',
            zIndex: 10000,
            height: 52,
            paddingLeft: 72,
            userSelect: 'none',
            cursor: 'move',
            transform: 'translateZ(0)'
          }}
        />
      )}
      <div
        style={{
          flex: 1,
          width: '100%',
          padding: '24px',
          paddingTop: isTauri ? 76 : 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
      <h1
        style={{
          fontSize: '22px',
          fontWeight: 600,
          color: '#111',
          marginBottom: '8px',
          textAlign: 'center'
        }}
      >
        Sign in to Delancey
      </h1>
      <p
        style={{
          fontSize: '14px',
          color: '#555',
          marginBottom: '24px',
          textAlign: 'center'
        }}
      >
        Select employee and enter password
      </p>

      <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '320px' }}>
        <div style={{ marginBottom: '20px', width: '100%' }}>
          <CustomDropdown
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            options={loadingEmployees ? [] : employees.map((emp) => ({
              value: emp.username || emp.employee_code,
              label: [emp.first_name, emp.last_name].filter(Boolean).join(' ').trim() || emp.username || emp.employee_code || String(emp.employee_id)
            }))}
            placeholder={loadingEmployees ? 'Loading employees...' : 'Select an employee...'}
            isDarkMode={false}
            themeColorRgb={themeColorRgb}
            style={{ width: '100%' }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            minHeight: '50px',
            marginBottom: '15px',
            paddingBottom: '8px',
            borderBottom: '2px solid #333',
            width: '100%',
            maxWidth: '200px'
          }}
        >
          <span
            className={passwordJitter ? 'password-jitter' : ''}
            style={{
              fontFamily: 'monospace',
              fontSize: '28px',
              letterSpacing: '8px',
              color: '#111',
              textAlign: 'center',
              display: 'inline-block'
            }}
          >
            {password.split('').map((char, i) =>
              i === password.length - 1 && revealLastDigit ? char : '•'
            ).join('')}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginTop: '15px',
            marginBottom: '8px',
            width: '100%',
            maxWidth: '264px'
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
            width: '100%',
            maxWidth: '264px'
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
              color: '#111',
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
              color: loading ? '#999' : '#111',
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

      </form>
      </div>
    </div>
  )
}

export default Login
