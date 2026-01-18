import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { ArrowLeft } from 'lucide-react'

function OnboardingStep4({ onNext, onBack, onSkip, direction = 'forward' }) {
  const { themeColor } = useTheme()
  const [importMethod, setImportMethod] = useState('manual') // 'csv', 'manual', 'skip'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setLoading(true)
    setError('')
    
    // Validate file type
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a CSV or Excel file')
      setLoading(false)
      return
    }
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await fetch('/api/inventory/import', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      
      if (data.success) {
        onNext()
      } else {
        setError(data.message || 'Failed to import inventory')
      }
    } catch (err) {
      setError('Network error. Please try again.')
      console.error('Import error:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleNext = () => {
    if (importMethod === 'skip') {
      onSkip()
    } else if (importMethod === 'manual') {
      onNext() // Will redirect to inventory page
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
          Import Your Inventory
        </h2>
      
      <p style={{ 
        marginBottom: '30px',
        color: 'var(--text-secondary, #666)',
        fontSize: '16px',
        lineHeight: '1.6'
      }}>
        Upload your inventory data now, or add products manually later. You can always import more later.
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {/* CSV/Excel Upload Option */}
        <div
          onClick={() => setImportMethod('csv')}
          style={{
            padding: '20px',
            border: `2px solid ${importMethod === 'csv' ? `rgba(${themeColorRgb}, 0.7)` : '#e0e0e0'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: importMethod === 'csv' 
              ? `rgba(${themeColorRgb}, 0.1)` 
              : 'var(--bg-secondary, #f5f5f5)',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <input
              type="radio"
              checked={importMethod === 'csv'}
              onChange={() => setImportMethod('csv')}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 600 }}>
                Upload CSV or Excel File
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary, #666)', fontSize: '14px' }}>
                Import products from a spreadsheet (CSV or Excel format)
              </p>
            </div>
          </div>
          
          {importMethod === 'csv' && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e0e0e0' }}>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={loading}
                style={{ display: 'none' }}
                id="inventory-upload"
              />
              <label
                htmlFor="inventory-upload"
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  backgroundColor: `rgba(${themeColorRgb}, 1)`,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 500,
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? 'Uploading...' : 'Choose File'}
              </label>
              <p style={{ margin: '10px 0 0 0', color: 'var(--text-secondary, #666)', fontSize: '13px' }}>
                CSV format: SKU, Product Name, Price, Cost, Quantity, Category (optional)
              </p>
            </div>
          )}
        </div>
        
        {/* Manual Entry Option */}
        <div
          onClick={() => setImportMethod('manual')}
          style={{
            padding: '20px',
            border: `2px solid ${importMethod === 'manual' ? `rgba(${themeColorRgb}, 0.7)` : '#e0e0e0'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: importMethod === 'manual' 
              ? `rgba(${themeColorRgb}, 0.1)` 
              : 'var(--bg-secondary, #f5f5f5)',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <input
              type="radio"
              checked={importMethod === 'manual'}
              onChange={() => setImportMethod('manual')}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 600 }}>
                Add Products Manually
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary, #666)', fontSize: '14px' }}>
                You'll be able to add products after setup is complete
              </p>
            </div>
          </div>
        </div>
        
        {/* Skip Option */}
        <div
          onClick={() => setImportMethod('skip')}
          style={{
            padding: '20px',
            border: `2px solid ${importMethod === 'skip' ? `rgba(${themeColorRgb}, 0.7)` : '#e0e0e0'}`,
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: importMethod === 'skip' 
              ? `rgba(${themeColorRgb}, 0.1)` 
              : 'var(--bg-secondary, #f5f5f5)',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <input
              type="radio"
              checked={importMethod === 'skip'}
              onChange={() => setImportMethod('skip')}
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 600 }}>
                Skip for Now
              </h3>
              <p style={{ margin: 0, color: 'var(--text-secondary, #666)', fontSize: '14px' }}>
                Set up inventory later after completing onboarding
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '6px',
          marginTop: '20px'
        }}>
          {error}
        </div>
      )}
      
      {/* Navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '40px'
      }}>
        <button
          onClick={handleNext}
          disabled={importMethod === 'csv' && loading}
          style={{
            padding: '12px 24px',
            backgroundColor: (importMethod === 'csv' && loading) ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.7)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: '#fff',
            border: (importMethod === 'csv' && loading) ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            cursor: (importMethod === 'csv' && loading) ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 600,
            boxShadow: (importMethod === 'csv' && loading)
              ? `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)`
              : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
            transition: 'all 0.3s ease',
            opacity: 1
          }}
          onMouseEnter={(e) => {
            if (!(importMethod === 'csv' && loading)) {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
              e.currentTarget.style.boxShadow = `0 6px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }
          }}
          onMouseLeave={(e) => {
            if (!(importMethod === 'csv' && loading)) {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
              e.currentTarget.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }
          }}
        >
          {importMethod === 'csv' && loading ? 'Uploading...' : 'Continue'}
        </button>
      </div>
      </div>
    </div>
  )
}

export default OnboardingStep4
