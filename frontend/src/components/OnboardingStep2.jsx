import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import OnboardingHeader from './OnboardingHeader'
import { CreditCard, Users, ShoppingCart, Gift, Package, Check, ChevronRight } from 'lucide-react'

const TODO_ITEMS = [
  { id: 'payment', label: 'Payment processing', step: 3, icon: CreditCard },
  { id: 'employees', label: 'Employees', step: 5, icon: Users },
  { id: 'pos', label: 'POS', step: 8, icon: ShoppingCart }, // New step for POS setup
  { id: 'rewards', label: 'Customer Rewards', step: 9, icon: Gift }, // New step for Customer Rewards setup
  { id: 'inventory', label: 'Inventory', step: 4, icon: Package }
]

function OnboardingStep2({ onNext, onBack, onNavigateToStep, completedItems = [], direction = 'forward' }) {
  const { themeColor } = useTheme()
  
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  const handleItemClick = (item) => {
    if (onNavigateToStep) {
      onNavigateToStep(item.step)
    } else {
      onNext()
    }
  }
  
  const isItemCompleted = (itemId) => {
    return completedItems.includes(itemId)
  }
  
  const allItemsCompleted = () => {
    return TODO_ITEMS.every(item => isItemCompleted(item.id))
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
      <OnboardingHeader step={2} direction={direction} />
      
      <p style={{ 
        marginBottom: '30px',
        color: 'var(--text-secondary, #666)',
        fontSize: '16px',
        lineHeight: '1.6',
        textAlign: 'center'
      }}>
        Complete these setup tasks to get started. Click on any item to begin.
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {TODO_ITEMS.map((item, index) => {
          const isCompleted = isItemCompleted(item.id)
          return (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              style={{
                padding: '20px 24px',
                backgroundColor: isCompleted 
                  ? `rgba(${themeColorRgb}, 0.1)` 
                  : `rgba(255, 255, 255, 0.05)`,
                outline: `2px solid ${isCompleted ? `rgba(${themeColorRgb}, 0.4)` : `rgba(${themeColorRgb}, 0.2)`}`,
                outlineOffset: '-2px',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (!isCompleted) {
                  e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.15)`
                  e.currentTarget.style.outlineColor = `rgba(${themeColorRgb}, 0.5)`
                  e.currentTarget.style.transform = 'translateX(4px)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isCompleted) {
                  e.currentTarget.style.backgroundColor = `rgba(255, 255, 255, 0.05)`
                  e.currentTarget.style.outlineColor = `rgba(${themeColorRgb}, 0.2)`
                  e.currentTarget.style.transform = 'translateX(0)'
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                {isCompleted ? (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: `2px solid rgba(${themeColorRgb}, 1)`,
                    backgroundColor: `rgba(${themeColorRgb}, 1)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Check size={14} color="#fff" strokeWidth={2.5} />
                  </div>
                ) : (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: `rgba(${themeColorRgb}, 0.6)`
                  }}>
                    <item.icon size={24} strokeWidth={2} />
                  </div>
                )}
                <span style={{
                  fontSize: '18px',
                  fontWeight: 500,
                  color: isCompleted ? `rgba(${themeColorRgb}, 1)` : 'var(--text-primary, #000)',
                  textDecoration: isCompleted ? 'line-through' : 'none',
                  opacity: isCompleted ? 0.7 : 1
                }}>
                  {item.label}
                </span>
              </div>
              <ChevronRight 
                size={24} 
                style={{
                  opacity: 0.6,
                  flexShrink: 0,
                  color: 'var(--text-secondary, #666)'
                }}
              />
            </div>
          )
        })}
      </div>
      
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
          onClick={onNext}
          disabled={!allItemsCompleted()}
          style={{
            padding: '12px 24px',
            backgroundColor: allItemsCompleted() 
              ? `rgba(${themeColorRgb}, 0.7)` 
              : `rgba(${themeColorRgb}, 0.2)`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            cursor: allItemsCompleted() ? 'pointer' : 'not-allowed',
            fontSize: '16px',
            fontWeight: 600,
            boxShadow: allItemsCompleted()
              ? `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
              : `0 2px 8px rgba(${themeColorRgb}, 0.1)`,
            transition: 'all 0.3s ease',
            opacity: allItemsCompleted() ? 1 : 0.5
          }}
          onMouseEnter={(e) => {
            if (allItemsCompleted()) {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
              e.currentTarget.style.boxShadow = `0 6px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }
          }}
          onMouseLeave={(e) => {
            if (allItemsCompleted()) {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
              e.currentTarget.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export default OnboardingStep2
