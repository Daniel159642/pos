import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import OnboardingStep1 from '../components/OnboardingStep1'
import OnboardingStep2 from '../components/OnboardingStep2'
import OnboardingStepPayment from '../components/OnboardingStepPayment'
import OnboardingStep4 from '../components/OnboardingStep4'
import OnboardingStep5 from '../components/OnboardingStep5'
import OnboardingStep6 from '../components/OnboardingStep6'
import OnboardingStep7 from '../components/OnboardingStep7'
import OnboardingStepPOS from '../components/OnboardingStepPOS'
import OnboardingStepRewards from '../components/OnboardingStepRewards'

function Onboarding() {
  const navigate = useNavigate()
  const { themeColor } = useTheme()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [direction, setDirection] = useState('forward')
  
  // Store all onboarding data
  const [onboardingData, setOnboardingData] = useState({
    storeInfo: null,
    taxSettings: null,
    paymentSettings: null,
    inventoryMethod: null,
    employees: null,
    preferences: null
  })
  const [completedItems, setCompletedItems] = useState([])
  
  const totalSteps = 7
  
  useEffect(() => {
    // Check if onboarding is already completed
    checkOnboardingStatus()
  }, [])
  
  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/onboarding/status')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        // Not JSON response, start from step 1
        console.warn('Non-JSON response from onboarding status API')
        setCurrentStep(1)
        setLoading(false)
        return
      }
      
      const text = await response.text()
      if (!text || text.trim() === '') {
        // Empty response, start from step 1
        setCurrentStep(1)
        setLoading(false)
        return
      }
      
      const data = JSON.parse(text)
      
      // If onboarding is completed, redirect to login
      if (data.setup_completed) {
        console.log('Onboarding completed, redirecting to login')
        navigate('/login')
        return
      }
      
      // Load saved step or start from step 1
      setCurrentStep(data.setup_step || 1)
      setLoading(false)
    } catch (err) {
      console.error('Error checking onboarding status:', err)
      // On error, just start from step 1
      setCurrentStep(1)
      setLoading(false)
    }
  }
  
  const saveStep = async (step, data) => {
    try {
      await fetch('/api/onboarding/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          step_name: getStepName(step),
          data
        })
      })
      
      // Update onboarding step
      await fetch('/api/onboarding/update-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: step + 1 })
      })
    } catch (err) {
      console.error('Error saving step:', err)
    }
  }
  
  const getStepName = (step) => {
    const stepNames = {
      1: 'store_info',
      2: 'tax_settings',
      3: 'payment',
      4: 'inventory',
      5: 'employees',
      6: 'preferences',
      7: 'review',
      8: 'pos',
      9: 'rewards'
    }
    return stepNames[step] || 'unknown'
  }
  
  const handleNext = async (stepData) => {
    // If stepData is provided (from step 1), update onboardingData first
    let dataToSave = onboardingData
    if (stepData && currentStep === 1) {
      // For step 1, we receive storeInfo directly
      dataToSave = { ...onboardingData, storeInfo: stepData }
      setOnboardingData(dataToSave)
    }
    
    // Save current step with the updated data
    await saveStep(currentStep, dataToSave)
    
    // Mark items as completed based on step
    markItemCompleted(currentStep)
    
    // If on step 2 (to-do list) and all items are completed, go to step 7 (review/confirmation)
    if (currentStep === 2) {
      // All required items: payment, employees, pos, rewards, inventory
      const requiredItems = ['payment', 'employees', 'pos', 'rewards', 'inventory']
      const allItemsCompleted = requiredItems.every(itemId => completedItems.includes(itemId))
      if (allItemsCompleted) {
        setDirection('forward')
        setCurrentStep(7) // Go to review/confirmation page
        return
      }
    }
    
    // If on step 3 (Payment), 4 (Inventory), 5 (Employees), 8 (POS), or 9 (Customer Rewards), 
    // go back to step 2 (to-do list) instead of incrementing
    if ([3, 4, 5, 8, 9].includes(currentStep)) {
      setDirection('forward')
      setCurrentStep(2)
      return
    }
    
    if (currentStep < totalSteps) {
      setDirection('forward')
      setCurrentStep(currentStep + 1)
    }
  }
  
  const handleNavigateBackToTodo = async () => {
    // Save current step and mark item as completed before navigating back
    await saveStep(currentStep, onboardingData)
    markItemCompleted(currentStep)
    setDirection('forward')
    setCurrentStep(2)
  }
  
  const handleBack = () => {
    if (currentStep > 1) {
      setDirection('backward')
      // If going back from a sub-step (3, 4, 5, 8, 9), go to step 2 (to-do list)
      if ([3, 4, 5, 8, 9].includes(currentStep)) {
        setCurrentStep(2)
      } else if (currentStep === 2) {
        // If on to-do list, go back to step 1
        setCurrentStep(1)
      } else {
        setCurrentStep(currentStep - 1)
      }
    }
  }
  
  const handleNavigateToStep = (step) => {
    setDirection('forward')
    setCurrentStep(step)
  }
  
  const markItemCompleted = (step) => {
    const stepToItemMap = {
      3: 'payment',
      4: 'inventory',
      5: 'employees',
      8: 'pos',
      9: 'rewards'
    }
    const itemId = stepToItemMap[step]
    if (itemId && !completedItems.includes(itemId)) {
      setCompletedItems(prev => [...prev, itemId])
    }
  }
  
  const handleSkip = async () => {
    // Save step with skip flag
    await saveStep(currentStep, { ...onboardingData, skipped: true })
    
    // Mark items as completed when skipped (treat skip as completion for to-do list)
    markItemCompleted(currentStep)
    
    // If on step 5 (Employees), go back to step 2 (to-do list) instead of incrementing
    if (currentStep === 5) {
      setDirection('forward')
      setCurrentStep(2)
      return
    }
    
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }
  
  const handleComplete = async () => {
    // Finalize onboarding
    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Redirect to login page - user needs to log in with the admin account that was created
        // Clear any cached onboarding state
        window.location.href = '/login'
      }
    } catch (err) {
      console.error('Error completing onboarding:', err)
    }
  }
  
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  
  const themeColorRgb = hexToRgb(themeColor)
  
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-secondary, #f5f5f5)'
      }}>
        <div style={{ fontSize: '18px', color: 'var(--text-secondary, #666)' }}>
          Loading...
        </div>
      </div>
    )
  }
  
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'transparent',
      padding: '20px 0',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Content Layer */}
      <div style={{
        position: 'relative',
        zIndex: 1
      }}>
      {/* Step Content */}
      <div>
        {currentStep === 1 && (
          <OnboardingStep1
            onNext={handleNext}
            storeInfo={onboardingData.storeInfo}
            setStoreInfo={(data) => setOnboardingData(prev => ({ ...prev, storeInfo: data }))}
            direction={direction}
          />
        )}
        
        {currentStep === 2 && (
          <OnboardingStep2
            onNext={handleNext}
            onBack={handleBack}
            onNavigateToStep={handleNavigateToStep}
            completedItems={completedItems}
            direction={direction}
          />
        )}
        
        {currentStep === 3 && (
          <OnboardingStepPayment
            onNext={handleNavigateBackToTodo}
            onBack={handleBack}
            storeEmail={onboardingData.storeInfo?.store_email}
            storeCountry="US"
            storeState={onboardingData.storeInfo?.store_state}
            direction={direction}
          />
        )}
        
        {currentStep === 4 && (
          <OnboardingStep4
            onNext={handleNavigateBackToTodo}
            onBack={handleBack}
            onSkip={handleSkip}
            direction={direction}
          />
        )}
        
        {currentStep === 5 && (
          <OnboardingStep5
            onNext={handleNavigateBackToTodo}
            onBack={handleBack}
            onSkip={handleSkip}
            direction={direction}
          />
        )}
        
        {currentStep === 6 && (
          <OnboardingStep6
            onNext={handleNext}
            onBack={handleBack}
            preferences={onboardingData.preferences}
            setPreferences={(data) => setOnboardingData(prev => ({ ...prev, preferences: data }))}
            direction={direction}
          />
        )}
        
        {currentStep === 7 && (
          <OnboardingStep7
            onComplete={handleComplete}
            onBack={handleBack}
            allData={onboardingData}
            direction={direction}
          />
        )}
        
        {currentStep === 8 && (
          <OnboardingStepPOS
            onNext={handleNavigateBackToTodo}
            onBack={handleBack}
            direction={direction}
          />
        )}
        
        {currentStep === 9 && (
          <OnboardingStepRewards
            onNext={handleNavigateBackToTodo}
            onBack={handleBack}
            direction={direction}
          />
        )}
      </div>
      </div>
    </div>
  )
}

export default Onboarding
