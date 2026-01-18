import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { ArrowLeft } from 'lucide-react'

const POSITIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'stock_clerk', label: 'Stock Clerk' }
]

function OnboardingStep5({ onNext, onBack, onSkip, direction = 'forward' }) {
  const { themeColor } = useTheme()
  const [employees, setEmployees] = useState([{
    first_name: '',
    last_name: '',
    employee_code: '',
    email: '',
    position: 'cashier',
    password: ''
  }])
  const [errors, setErrors] = useState({})
  const [openDropdowns, setOpenDropdowns] = useState({})
  const dropdownRefs = useRef({})
  
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  const addEmployee = () => {
    setEmployees(prev => [...prev, {
      first_name: '',
      last_name: '',
      employee_code: '',
      email: '',
      position: 'cashier',
      password: ''
    }])
  }
  
  const removeEmployee = (index) => {
    if (employees.length > 1) {
      setEmployees(prev => prev.filter((_, i) => i !== index))
    }
  }
  
  const updateEmployee = (index, field, value) => {
    setEmployees(prev => prev.map((emp, i) => 
      i === index ? { ...emp, [field]: value } : emp
    ))
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      Object.keys(dropdownRefs.current).forEach(key => {
        const ref = dropdownRefs.current[key]
        if (ref && !ref.contains(event.target)) {
          setOpenDropdowns(prev => ({ ...prev, [key]: false }))
        }
      })
    }

    if (Object.values(openDropdowns).some(open => open)) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdowns])

  const toggleDropdown = (index) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [index]: !prev[index]
    }))
  }

  const handlePositionSelect = (index, value) => {
    updateEmployee(index, 'position', value)
    setOpenDropdowns(prev => ({ ...prev, [index]: false }))
  }

  const getPositionLabel = (position) => {
    return POSITIONS.find(p => p.value === position)?.label || 'Position'
  }
  
  const generateEmployeeCode = (index) => {
    const codes = employees.map(e => e.employee_code).filter(c => c)
    let code = `EMP${String(index + 1).padStart(3, '0')}`
    let counter = 1
    while (codes.includes(code)) {
      code = `EMP${String(index + counter).padStart(3, '0')}`
      counter++
    }
    return code
  }
  
  const handleNext = async () => {
    // Validate at least one employee with all required fields
    const validEmployees = employees.filter(emp => 
      emp.first_name.trim() && emp.last_name.trim() && emp.password.trim()
    )
    
    if (validEmployees.length === 0) {
      setErrors({ general: 'Please add at least one employee with all required fields' })
      return
    }
    
    // Save employees (or skip if user chose to skip)
    if (validEmployees.length > 0) {
      // Employees will be saved via API or can be skipped
      onNext()
    }
  }
  
  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '40px 20px',
      position: 'relative'
    }}>
      <button
        onClick={onBack}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          padding: '8px 16px',
          backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: `rgba(${themeColorRgb}, 1)`,
          border: `1px solid rgba(${themeColorRgb}, 0.3)`,
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
          transition: 'all 0.3s ease',
          fontSize: '14px',
          fontWeight: 500,
          height: '36px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
          e.currentTarget.style.boxShadow = `0 4px 12px rgba(${themeColorRgb}, 0.15)`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
          e.currentTarget.style.boxShadow = `0 2px 8px rgba(${themeColorRgb}, 0.1)`
        }}
      >
        <ArrowLeft size={20} />
      </button>
      
      <div style={{ paddingTop: '60px' }}>
        <h2 style={{ 
          marginBottom: '30px',
          color: 'var(--text-primary, #000)',
          fontSize: '28px',
          fontWeight: 600
        }}>
          Add Your First Employees
        </h2>
      
      <p style={{ 
        marginBottom: '30px',
        color: 'var(--text-secondary, #666)',
        fontSize: '16px',
        lineHeight: '1.6'
      }}>
        Create employee accounts for your team. You can add more employees later. At least add yourself as an admin.
      </p>
      
      {errors.general && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          {errors.general}
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {employees.map((employee, index) => (
          <div key={index} style={{
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary, #f5f5f5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                Employee {index + 1}
              </h3>
              {employees.length > 1 && (
                <button
                  onClick={() => removeEmployee(index)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgba(220, 53, 69, 0.2)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    color: 'rgba(220, 53, 69, 1)',
                    border: '1px solid rgba(220, 53, 69, 0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                    boxShadow: '0 2px 8px rgba(220, 53, 69, 0.1)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(220, 53, 69, 0.3)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(220, 53, 69, 0.2)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 53, 69, 0.1)'
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  First Name <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <input
                  type="text"
                  value={employee.first_name}
                  onChange={(e) => updateEmployee(index, 'first_name', e.target.value)}
                  placeholder="John"
                  style={{
                    width: '100%',
                    padding: '8px 0',
                    border: 'none',
                    borderBottom: `1px solid rgba(${themeColorRgb}, 1)`,
                    borderRadius: '0',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    lineHeight: '1.5',
                    height: '32px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Last Name <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <input
                  type="text"
                  value={employee.last_name}
                  onChange={(e) => updateEmployee(index, 'last_name', e.target.value)}
                  placeholder="Doe"
                  style={{
                    width: '100%',
                    padding: '8px 0',
                    border: 'none',
                    borderBottom: `1px solid rgba(${themeColorRgb}, 1)`,
                    borderRadius: '0',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    lineHeight: '1.5',
                    height: '32px'
                  }}
                />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Employee Code
                </label>
                <input
                  type="text"
                  value={employee.employee_code || generateEmployeeCode(index)}
                  onChange={(e) => updateEmployee(index, 'employee_code', e.target.value.toUpperCase())}
                  placeholder={generateEmployeeCode(index)}
                  style={{
                    width: '100%',
                    padding: '8px 0',
                    border: 'none',
                    borderBottom: `1px solid rgba(${themeColorRgb}, 1)`,
                    borderRadius: '0',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    textTransform: 'uppercase',
                    lineHeight: '1.5',
                    height: '32px'
                  }}
                />
              </div>
              
              <div ref={el => { dropdownRefs.current[`position-${index}`] = el }} style={{ position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Position
                </label>
                <div
                  onClick={() => toggleDropdown(`position-${index}`)}
                  style={{
                    width: '100%',
                    padding: '8px 0',
                    border: 'none',
                    borderBottom: `1px solid rgba(${themeColorRgb}, 1)`,
                    borderRadius: '0',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    cursor: 'pointer',
                    color: employee.position ? 'var(--text-primary, #000)' : 'rgba(0, 0, 0, 0.5)',
                    lineHeight: '1.5',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ 
                    color: employee.position ? 'var(--text-primary, #000)' : 'rgba(0, 0, 0, 0.5)' 
                  }}>{getPositionLabel(employee.position)}</span>
                </div>
                {openDropdowns[`position-${index}`] && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    backgroundColor: '#fff',
                    border: `1px solid rgba(${themeColorRgb}, 0.3)`,
                    borderRadius: '4px',
                    boxShadow: `0 4px 12px rgba(0, 0, 0, 0.15)`,
                    zIndex: 1000,
                    marginTop: '4px'
                  }}>
                    {POSITIONS.map((position) => (
                      <div
                        key={position.value}
                        onClick={() => handlePositionSelect(index, position.value)}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: employee.position === position.value ? themeColor : 'var(--text-primary, #000)',
                          backgroundColor: employee.position === position.value ? `rgba(${themeColorRgb}, 0.1)` : 'transparent',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (employee.position !== position.value) {
                            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.05)`
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (employee.position !== position.value) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }
                        }}
                      >
                        {position.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Email
                </label>
                <input
                  type="email"
                  value={employee.email}
                  onChange={(e) => updateEmployee(index, 'email', e.target.value)}
                  placeholder="john@store.com"
                  style={{
                    width: '100%',
                    padding: '8px 0',
                    border: 'none',
                    borderBottom: `1px solid rgba(${themeColorRgb}, 1)`,
                    borderRadius: '0',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    lineHeight: '1.5',
                    height: '32px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500 }}>
                  Password <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <input
                  type="password"
                  value={employee.password}
                  onChange={(e) => updateEmployee(index, 'password', e.target.value)}
                  placeholder="••••••••"
                  minLength="6"
                  style={{
                    width: '100%',
                    padding: '8px 0',
                    border: 'none',
                    borderBottom: `1px solid rgba(${themeColorRgb}, 1)`,
                    borderRadius: '0',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    lineHeight: '1.5',
                    height: '32px'
                  }}
                />
              </div>
            </div>
          </div>
        ))}
        
        <button
          onClick={addEmployee}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            color: `rgba(${themeColorRgb}, 1)`,
            border: `2px dashed rgba(${themeColorRgb}, 0.5)`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 500
          }}
        >
          + Add Another Employee
        </button>
      </div>
      
      {/* Bottom Navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '40px',
        gap: '10px'
      }}>
        <button
          onClick={onSkip}
          style={{
            padding: '12px 24px',
            backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: `rgba(${themeColorRgb}, 1)`,
            border: `1px solid rgba(${themeColorRgb}, 0.3)`,
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 500,
            boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
            e.currentTarget.style.boxShadow = `0 4px 12px rgba(${themeColorRgb}, 0.15)`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
            e.currentTarget.style.boxShadow = `0 2px 8px rgba(${themeColorRgb}, 0.1)`
          }}
        >
          Skip
        </button>
        
        <button
          onClick={handleNext}
          style={{
            padding: '12px 24px',
            backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 600,
            boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
            e.currentTarget.style.boxShadow = `0 6px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
            e.currentTarget.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
          }}
        >
          Continue
        </button>
      </div>
      </div>
    </div>
  )
}

export default OnboardingStep5
