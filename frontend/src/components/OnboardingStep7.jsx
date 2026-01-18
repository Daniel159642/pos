import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import OnboardingHeader from './OnboardingHeader'

function OnboardingStep7({ onComplete, onBack, allData, direction = 'forward' }) {
  const { themeColor } = useTheme()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  const handleComplete = async () => {
    setLoading(true)
    setError('')
    
    try {
      // Save all onboarding data
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 7,
          data: allData
        })
      })
      
      const responseText = await response.text()
      let data = {}
      
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        if (responseText) {
          try {
            data = JSON.parse(responseText)
          } catch (parseErr) {
            console.error('Failed to parse completion response:', parseErr, 'Response text:', responseText)
            throw new Error(`Server returned invalid JSON. Status: ${response.status}`)
          }
        }
      } else {
        console.error('Completion response is not JSON. Status:', response.status, 'Content-Type:', contentType, 'Response:', responseText)
        throw new Error(`Server returned non-JSON response. Status: ${response.status}`)
      }
      
      if (response.ok && data.success) {
        onComplete()
      } else {
        const errorMsg = data.message || `Failed to complete onboarding (status: ${response.status})`
        console.error('Onboarding completion failed:', { status: response.status, data, responseText })
        setError(errorMsg)
      }
    } catch (err) {
      const errorMsg = err.message || 'Network error. Please try again.'
      setError(errorMsg)
      console.error('Completion error:', err)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '40px 20px',
      backgroundColor: 'transparent',
      backdropFilter: 'blur(60px) saturate(200%)',
      WebkitBackdropFilter: 'blur(60px) saturate(200%)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '16px',
      boxShadow: `0 8px 32px 0 rgba(31, 38, 135, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)`
    }}>
      <OnboardingHeader step={7} direction={direction} />
      <h2 style={{ 
        marginBottom: '10px',
        color: 'var(--text-primary, #000)',
        fontSize: '28px',
        fontWeight: 600
      }}>
        Review & Complete Setup
      </h2>
      
      <p style={{ 
        marginBottom: '30px',
        color: 'var(--text-secondary, #666)',
        fontSize: '16px',
        lineHeight: '1.6'
      }}>
        Review your settings below. Once you complete setup, you'll be able to start using your POS system!
      </p>
      
      {/* Summary */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px',
        marginBottom: '30px'
      }}>
        {/* Store Info */}
        {allData.storeInfo && (
          <div style={{
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary, #f5f5f5)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: 600 }}>
              Store Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
              <div><strong>Store Name:</strong> {allData.storeInfo.store_name}</div>
              <div><strong>Business Type:</strong> {allData.storeInfo.business_type || 'Not specified'}</div>
              <div><strong>Email:</strong> {allData.storeInfo.store_email}</div>
              <div><strong>Phone:</strong> {allData.storeInfo.store_phone}</div>
              {(allData.storeInfo.store_address || allData.storeInfo.store_city) && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>Address:</strong> {[
                    allData.storeInfo.store_address,
                    allData.storeInfo.store_city,
                    allData.storeInfo.store_state,
                    allData.storeInfo.store_zip
                  ].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Tax Settings */}
        {allData.taxSettings && (
          <div style={{
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary, #f5f5f5)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: 600 }}>
              Tax & Currency
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
              <div><strong>Currency:</strong> {allData.taxSettings.currency || 'USD'}</div>
              <div><strong>Tax Rate:</strong> {allData.taxSettings.default_tax_rate || 0}%</div>
              <div><strong>Tax Included:</strong> {allData.taxSettings.tax_included ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}
        
        {/* Payment */}
        {allData.paymentSettings && (
          <div style={{
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary, #f5f5f5)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: 600 }}>
              Payment Processing
            </h3>
            <div style={{ fontSize: '14px' }}>
              <strong>Payment Method:</strong> {
                allData.paymentSettings.payment_processor === 'stripe_connect' 
                  ? 'Stripe Connect' 
                  : allData.paymentSettings.payment_processor === 'stripe_direct'
                  ? 'Stripe Direct'
                  : 'Cash Only'
              }
            </div>
          </div>
        )}
        
        {/* Preferences */}
        {allData.preferences && (
          <div style={{
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary, #f5f5f5)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: 600 }}>
              Preferences
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
              <div><strong>Theme Color:</strong> 
                <span style={{
                  display: 'inline-block',
                  width: '20px',
                  height: '20px',
                  backgroundColor: allData.preferences.theme_color || '#8400ff',
                  borderRadius: '4px',
                  marginLeft: '8px',
                  verticalAlign: 'middle',
                  border: '1px solid #ddd'
                }}></span>
              </div>
              <div><strong>Rewards:</strong> {allData.preferences.enable_rewards ? 'Enabled' : 'Disabled'}</div>
              <div><strong>Tips:</strong> {allData.preferences.enable_tips ? 'Enabled' : 'Disabled'}</div>
              <div><strong>Customer Display:</strong> {allData.preferences.enable_customer_display ? 'Enabled' : 'Disabled'}</div>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}
      
      {/* Navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '40px'
      }}>
        <button
          onClick={onBack}
          disabled={loading}
          style={{
            padding: '10px 16px',
            backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: '#fff',
            border: loading ? `1px solid rgba(${themeColorRgb}, 0.2)` : `1px solid rgba(${themeColorRgb}, 0.3)`,
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            boxShadow: `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
            transition: 'all 0.3s ease',
            opacity: loading ? 0.5 : 1
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.3)`
              e.currentTarget.style.boxShadow = `0 4px 12px rgba(${themeColorRgb}, 0.15)`
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.2)`
              e.currentTarget.style.boxShadow = `0 2px 8px rgba(${themeColorRgb}, 0.1)`
            }
          }}
        >
          Back
        </button>
        
        <button
          onClick={handleComplete}
          disabled={loading}
          style={{
            padding: '12px 24px',
            backgroundColor: loading ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.7)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: '#fff',
            border: loading ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 600,
            boxShadow: loading
              ? `0 2px 8px rgba(${themeColorRgb}, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)`
              : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
            transition: 'all 0.3s ease',
            opacity: 1
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
              e.currentTarget.style.boxShadow = `0 6px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
              e.currentTarget.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }
          }}
        >
          {loading ? 'Completing Setup...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  )
}

export default OnboardingStep7
