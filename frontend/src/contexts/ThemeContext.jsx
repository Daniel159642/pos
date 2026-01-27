import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  // Temporarily force blue color - pause theme color selection
  const [themeColor, setThemeColor] = useState(() => {
    // Always return blue, ignoring saved preference
    return '#6ba3f0' // Blue color
  })

  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem('app_theme_mode')
    if (saved) return saved
    
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  useEffect(() => {
    // Temporarily force blue color - pause theme color selection
    const forcedColor = '#6ba3f0'
    // Don't save to localStorage - keep it temporary
    // localStorage.setItem('app_theme_color', themeColor)
    // Update CSS variables
    const root = document.documentElement
    const rgb = hexToRgb(forcedColor)
    if (rgb) {
      root.style.setProperty('--theme-color', forcedColor)
      root.style.setProperty('--theme-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`)
    }
  }, [themeColor])

  useEffect(() => {
    localStorage.setItem('app_theme_mode', themeMode)
    const root = document.documentElement
    
    // Handle auto mode
    let effectiveMode = themeMode
    if (themeMode === 'auto') {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        effectiveMode = 'dark'
      } else {
        effectiveMode = 'light'
      }
    }
    
    // Apply theme class
    root.classList.remove('light-theme', 'dark-theme')
    root.classList.add(`${effectiveMode}-theme`)
    
    // Listen for system preference changes if in auto mode
    if (themeMode === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e) => {
        root.classList.remove('light-theme', 'dark-theme')
        root.classList.add(e.matches ? 'dark-theme' : 'light-theme')
      }
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [themeMode])

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  // Temporarily override themeColor to always be blue
  const forcedThemeColor = '#6ba3f0'
  
  return (
    <ThemeContext.Provider value={{ themeColor: forcedThemeColor, setThemeColor, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

