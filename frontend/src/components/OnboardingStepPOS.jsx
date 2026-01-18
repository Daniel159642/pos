import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import OnboardingHeader from './OnboardingHeader'
import { ArrowLeft } from 'lucide-react'

function OnboardingStepPOS({ onNext, onBack, direction = 'forward' }) {
  const { themeColor } = useTheme()
  const [numRegisters, setNumRegisters] = useState('1')
  const [registerType, setRegisterType] = useState('one_screen') // 'one_screen' or 'two_screen'
  const [tipEnabled, setTipEnabled] = useState(false)
  const [receiptFooterMessage, setReceiptFooterMessage] = useState('Thank you for your business!')
  const [returnPolicy, setReturnPolicy] = useState('')
  const [error, setError] = useState('')
  
  // Convert hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  // Skip loading existing settings during onboarding - just use defaults
  // Settings will be saved to the database through the onboarding API flow
  
  const handleNext = () => {
    // Validate number of registers
    const numRegistersInt = parseInt(numRegisters)
    if (isNaN(numRegistersInt) || numRegistersInt < 1) {
      setError('Please enter a valid number of registers (at least 1)')
      return
    }
    
    // All data will be saved through the onboarding API by the parent component
    // Just call onNext to continue - the parent will save the data
    onNext()
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
          padding: '8px',
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
        <ArrowLeft size={20} />
      </button>
      
      <div style={{ paddingTop: '60px' }}>
        <h2 style={{ 
          marginBottom: '30px',
          color: 'var(--text-primary, #000)',
          fontSize: '28px',
          fontWeight: 600
        }}>
          POS Setup
        </h2>
      
        <p style={{ 
          marginBottom: '30px',
          color: 'var(--text-secondary, #666)',
          fontSize: '16px',
          lineHeight: '1.6'
        }}>
          Configure your point of sale system settings. You can always change this later in settings.
        </p>
        
        {/* Number of Registers */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ 
            marginBottom: '15px',
            color: 'var(--text-primary, #000)',
            fontSize: '22px',
            fontWeight: 600
          }}>
            Number of Registers
          </h3>
          
          <p style={{ 
            marginBottom: '15px',
            color: 'var(--text-secondary, #666)',
            fontSize: '14px',
            lineHeight: '1.6'
          }}>
            How many registers or checkout stations do you have?
          </p>
          
          <input
            type="number"
            value={numRegisters}
            onChange={(e) => setNumRegisters(e.target.value)}
            min="1"
            max="50"
            placeholder="Number of registers"
            style={{
              width: '100%',
              padding: '12px',
              border: `1px solid rgba(${themeColorRgb}, 0.3)`,
              borderRadius: '8px',
              fontSize: '16px',
              backgroundColor: 'var(--bg-secondary, #f5f5f5)',
              outline: 'none',
              transition: 'border 0.2s'
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = `1px solid rgba(${themeColorRgb}, 0.7)`
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = `1px solid rgba(${themeColorRgb}, 0.3)`
            }}
          />
        </div>
        
        {/* Register Type */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ 
            marginBottom: '15px',
            color: 'var(--text-primary, #000)',
            fontSize: '22px',
            fontWeight: 600
          }}>
            Register Type
          </h3>
          
          <p style={{ 
            marginBottom: '20px',
            color: 'var(--text-secondary, #666)',
            fontSize: '14px',
            lineHeight: '1.6'
          }}>
            Select the type of registers you have.
          </p>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            {/* One Screen Option */}
            <div
              onClick={() => setRegisterType('one_screen')}
              style={{
                padding: '20px',
                border: `2px solid ${registerType === 'one_screen' ? `rgba(${themeColorRgb}, 0.7)` : '#e0e0e0'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: registerType === 'one_screen' 
                  ? `rgba(${themeColorRgb}, 0.1)` 
                  : 'var(--bg-secondary, #f5f5f5)',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <input
                  type="radio"
                  checked={registerType === 'one_screen'}
                  onChange={() => setRegisterType('one_screen')}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 600 }}>
                    One Screen Register
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary, #666)', fontSize: '14px' }}>
                    Single display screen for both cashier and customer view.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Two Screen Option */}
            <div
              onClick={() => setRegisterType('two_screen')}
              style={{
                padding: '20px',
                border: `2px solid ${registerType === 'two_screen' ? `rgba(${themeColorRgb}, 0.7)` : '#e0e0e0'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: registerType === 'two_screen' 
                  ? `rgba(${themeColorRgb}, 0.1)` 
                  : 'var(--bg-secondary, #f5f5f5)',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <input
                  type="radio"
                  checked={registerType === 'two_screen'}
                  onChange={() => setRegisterType('two_screen')}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 600 }}>
                    Two Screen Register
                  </h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary, #666)', fontSize: '14px' }}>
                    Separate displays for cashier and customer.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Customer Tips */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ 
            marginBottom: '15px',
            color: 'var(--text-primary, #000)',
            fontSize: '22px',
            fontWeight: 600
          }}>
            Customer Tips
          </h3>
          
          <div style={{
            padding: '20px',
            border: `1px solid ${tipEnabled ? `rgba(${themeColorRgb}, 0.3)` : '#ddd'}`,
            borderRadius: '8px',
            backgroundColor: tipEnabled ? `rgba(${themeColorRgb}, 0.05)` : 'var(--bg-secondary, #f5f5f5)',
            transition: 'all 0.2s'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '16px',
              color: 'var(--text-primary, #000)'
            }}>
              <input
                type="checkbox"
                checked={tipEnabled}
                onChange={(e) => setTipEnabled(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              Allow customer tips
            </label>
            <p style={{ margin: '10px 0 0 0', color: 'var(--text-secondary, #666)', fontSize: '14px' }}>
              Enable customers to add tips during checkout. Tips can be prompted before or after payment.
            </p>
          </div>
        </div>
        
        {/* Receipt Customization */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ 
            marginBottom: '15px',
            color: 'var(--text-primary, #000)',
            fontSize: '22px',
            fontWeight: 600
          }}>
            Receipt Customization
          </h3>
          
          <p style={{ 
            marginBottom: '15px',
            color: 'var(--text-secondary, #666)',
            fontSize: '14px',
            lineHeight: '1.6'
          }}>
            Customize the message that appears at the bottom of your receipts.
          </p>
          
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: 500,
            fontSize: '14px',
            color: 'var(--text-primary, #000)'
          }}>
            Footer Message
          </label>
          <textarea
            value={receiptFooterMessage}
            onChange={(e) => setReceiptFooterMessage(e.target.value)}
            placeholder="Thank you for your business!"
            rows={3}
            style={{
              width: '100%',
              padding: '12px',
              border: `1px solid rgba(${themeColorRgb}, 0.3)`,
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              backgroundColor: 'var(--bg-secondary, #f5f5f5)',
              outline: 'none',
              resize: 'vertical',
              transition: 'border 0.2s'
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = `1px solid rgba(${themeColorRgb}, 0.7)`
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = `1px solid rgba(${themeColorRgb}, 0.3)`
            }}
          />
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary, #666)', fontSize: '13px' }}>
            This message will appear at the bottom of all receipts.
          </p>
        </div>
        
        {/* Return Policy */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ 
            marginBottom: '15px',
            color: 'var(--text-primary, #000)',
            fontSize: '22px',
            fontWeight: 600
          }}>
            Return Policy
          </h3>
          
          <p style={{ 
            marginBottom: '15px',
            color: 'var(--text-secondary, #666)',
            fontSize: '14px',
            lineHeight: '1.6'
          }}>
            Specify your store's return policy. This will appear on receipts.
          </p>
          
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: 500,
            fontSize: '14px',
            color: 'var(--text-primary, #000)'
          }}>
            Return Policy Text
          </label>
          <textarea
            value={returnPolicy}
            onChange={(e) => setReturnPolicy(e.target.value)}
            placeholder="Enter your store's return policy (e.g., 'Returns accepted within 30 days with receipt')"
            rows={4}
            style={{
              width: '100%',
              padding: '12px',
              border: `1px solid rgba(${themeColorRgb}, 0.3)`,
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              backgroundColor: 'var(--bg-secondary, #f5f5f5)',
              outline: 'none',
              resize: 'vertical',
              transition: 'border 0.2s'
            }}
            onFocus={(e) => {
              e.currentTarget.style.border = `1px solid rgba(${themeColorRgb}, 0.7)`
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = `1px solid rgba(${themeColorRgb}, 0.3)`
            }}
          />
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary, #666)', fontSize: '13px' }}>
            This return policy will appear at the bottom of all receipts.
          </p>
        </div>
        
        {/* Error/Success Messages */}
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
        
        
        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '40px',
          gap: '15px'
        }}>
          <button
            onClick={onBack}
            style={{
              padding: '10px 16px',
              backgroundColor: `rgba(${themeColorRgb}, 0.2)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: `1px solid rgba(${themeColorRgb}, 0.3)`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
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
            Back
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
              transition: 'all 0.3s ease',
              opacity: 1
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

export default OnboardingStepPOS