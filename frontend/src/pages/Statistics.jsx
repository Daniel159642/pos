import { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import Statistics from '../components/Statistics'

function StatisticsPage() {
  const { themeMode } = useTheme()
  
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
  
  const backgroundColor = isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'var(--bg-primary, #ffffff)'
  const textColor = isDarkMode ? 'var(--text-primary, #fff)' : '#333'
  
  return (
    <div style={{ 
      minHeight: '100vh',
      width: '100%',
      backgroundColor: backgroundColor,
      padding: '48px 64px 64px 64px',
      maxWidth: '1600px',
      margin: '0 auto'
    }}>
      <div style={{ 
        width: '100%',
        minHeight: 'calc(100vh - 200px)'
      }}>
        <Statistics />
      </div>
    </div>
  )
}

export default StatisticsPage

