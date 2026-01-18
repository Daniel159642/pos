import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import OnboardingHeader from './OnboardingHeader'

function OnboardingStep6({ onNext, onBack, preferences, setPreferences, direction = 'forward' }) {
  const { themeColor, setThemeColor } = useTheme()
  const [formData, setFormData] = useState({
    theme_color: preferences?.theme_color || themeColor || '#8400ff',
    enable_rewards: preferences?.enable_rewards || false,
    enable_tips: preferences?.enable_tips || false,
    enable_customer_display: preferences?.enable_customer_display || false,
    receipt_footer_message: preferences?.receipt_footer_message || 'Thank you for your business!'
  })
  
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(formData.theme_color)
  
  const handleNext = () => {
    setPreferences(formData)
    if (setThemeColor) {
      setThemeColor(formData.theme_color)
    }
    onNext()
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
      <OnboardingHeader step={6} direction={direction} />
      
      {/* Navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '40px'
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
  )
}

export default OnboardingStep6
