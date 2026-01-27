import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { 
  Settings as SettingsIcon, 
  Workflow, 
  Receipt, 
  MapPin, 
  Monitor, 
  Gift, 
  ShoppingCart, 
  MessageSquare, 
  DollarSign,
  ChevronRight,
  ChevronDown,
  PanelLeft
} from 'lucide-react'
import { FormTitle, FormLabel, FormField, inputBaseStyle, getInputFocusHandlers } from '../components/FormStyles'

function CustomDropdown({ value, onChange, options, placeholder, required, isDarkMode, themeColorRgb, style = {} }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div ref={dropdownRef} style={{ position: 'relative', ...style }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '8px 14px',
          border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
          borderRadius: '8px',
          fontSize: '14px',
          backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
          color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
          transition: 'all 0.2s ease',
          outline: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          ...(isOpen && {
            borderColor: `rgba(${themeColorRgb}, 0.5)`,
            boxShadow: `0 0 0 3px rgba(${themeColorRgb}, 0.1)`
          })
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.target.style.borderColor = `rgba(${themeColorRgb}, 0.3)`
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.target.style.borderColor = isDarkMode ? 'var(--border-color, #404040)' : '#ddd'
          }
        }}
      >
        <span style={{ 
          color: selectedOption ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333') : (isDarkMode ? 'var(--text-tertiary, #999)' : '#999')
        }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          size={16} 
          style={{ 
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
          }} 
        />
      </div>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
            border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: isDarkMode ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onChange({ target: { value: option.value } })
                setIsOpen(false)
              }}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                backgroundColor: value === option.value 
                  ? `rgba(${themeColorRgb}, 0.2)` 
                  : 'transparent',
                transition: 'background-color 0.15s ease',
                borderLeft: value === option.value 
                  ? `3px solid rgba(${themeColorRgb}, 0.7)` 
                  : '3px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (value !== option.value) {
                  e.target.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                }
              }}
              onMouseLeave={(e) => {
                if (value !== option.value) {
                  e.target.style.backgroundColor = 'transparent'
                }
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Settings() {
  const { themeMode, themeColor } = useTheme()
  const [workflowSettings, setWorkflowSettings] = useState({
    workflow_mode: 'simple',
    auto_add_to_inventory: 'true'
  })
  const [receiptSettings, setReceiptSettings] = useState({
    receipt_type: 'traditional',
    store_name: 'Store',
    store_address: '',
    store_city: '',
    store_state: '',
    store_zip: '',
    store_phone: '',
    store_email: '',
    store_website: '',
    footer_message: 'Thank you for your business!',
    return_policy: '',
    show_tax_breakdown: true,
    show_payment_method: true,
    show_signature: false
  })
  const [activeTab, setActiveTab] = useState('workflow') // 'workflow', 'receipt', 'location', 'display', 'rewards', 'pos', 'sms', or 'cash'
  const [posSettings, setPosSettings] = useState({
    num_registers: 1,
    register_type: 'one_screen'
  })
  const [storeLocationSettings, setStoreLocationSettings] = useState({
    store_name: 'Store',
    latitude: null,
    longitude: null,
    address: '',
    allowed_radius_meters: 100.0,
    require_location: true
  })
  const [displaySettings, setDisplaySettings] = useState({
    tip_enabled: false,
    tip_after_payment: false,
    tip_suggestions: [15, 18, 20, 25]
  })
  const [rewardsSettings, setRewardsSettings] = useState({
    enabled: false,
    require_email: false,
    require_phone: false,
    require_both: false,
    reward_type: 'points',
    points_per_dollar: 1.0,
    percentage_discount: 0.0,
    fixed_discount: 0.0,
    minimum_spend: 0.0
  })
  const [smsSettings, setSmsSettings] = useState({
    sms_provider: 'email',
    smtp_server: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_use_tls: 1,
    aws_access_key_id: '',
    aws_secret_access_key: '',
    aws_region: 'us-east-1',
    business_name: '',
    auto_send_rewards_earned: 1,
    auto_send_rewards_redeemed: 1
  })
  const [smsMessages, setSmsMessages] = useState([])
  const [smsTemplates, setSmsTemplates] = useState([])
  const [smsStores, setSmsStores] = useState([])
  const [selectedSmsStore, setSelectedSmsStore] = useState(1)
  const [showSendSmsModal, setShowSendSmsModal] = useState(false)
  const [sendSmsForm, setSendSmsForm] = useState({ phone_number: '', message_text: '' })
  const [cashSettings, setCashSettings] = useState({
    register_id: 1,
    cash_mode: 'total',
    total_amount: 200.00,
    denominations: {
      '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
      '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    }
  })
  const [dailyCount, setDailyCount] = useState({
    register_id: 1,
    count_date: new Date().toISOString().split('T')[0],
    count_type: 'drop',
    total_amount: 0,
    denominations: {
      '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
      '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    },
    notes: ''
  })
  const [dailyCounts, setDailyCounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [sidebarMinimized, setSidebarMinimized] = useState(false)
  const [hoveringSettings, setHoveringSettings] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const settingsHeaderRef = useRef(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [isInitialMount, setIsInitialMount] = useState(true)
  const sidebarRef = useRef(null)
  const contentRef = useRef(null)
  
  useEffect(() => {
    // Disable initial animation by setting flag after component is mounted
    const timer = setTimeout(() => {
      setIsInitialMount(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Convert hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }

  const themeColorRgb = hexToRgb(themeColor)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  useEffect(() => {
    loadSettings()
    loadReceiptSettings()
    loadStoreLocationSettings()
    loadDisplaySettings()
    loadRewardsSettings()
    loadPosSettings()
    loadSmsSettings()
    loadSmsStores()
    loadCashSettings()
    loadDailyCounts()
  }, [])

  useEffect(() => {
    if (activeTab === 'sms') {
      loadSmsSettings()
      loadSmsMessages()
      loadSmsTemplates()
    }
  }, [activeTab, selectedSmsStore])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/shipment-verification/settings')
      const data = await response.json()
      if (data.success && data.settings) {
        setWorkflowSettings(data.settings)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      setMessage({ type: 'error', text: 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }

  const loadReceiptSettings = async () => {
    try {
      const response = await fetch('/api/receipt-settings')
      const data = await response.json()
      if (data.success && data.settings) {
        setReceiptSettings({
          ...data.settings,
          receipt_type: data.settings.receipt_type || 'traditional',
          return_policy: data.settings.return_policy || '',
          show_tax_breakdown: data.settings.show_tax_breakdown === 1,
          show_payment_method: data.settings.show_payment_method === 1,
          show_signature: data.settings.show_signature === 1
        })
      }
    } catch (error) {
      console.error('Error loading receipt settings:', error)
    }
  }

  const loadStoreLocationSettings = async () => {
    try {
      const response = await fetch('/api/store-location-settings')
      const data = await response.json()
      if (data.success && data.settings) {
        setStoreLocationSettings({
          ...data.settings,
          require_location: data.settings.require_location === 1
        })
      }
    } catch (error) {
      console.error('Error loading store location settings:', error)
    }
  }

  const loadDisplaySettings = async () => {
    try {
      const response = await fetch('/api/customer-display/settings')
      const data = await response.json()
      if (data.success) {
        setDisplaySettings({
          tip_enabled: data.data.tip_enabled === 1 || data.data.tip_enabled === true,
          tip_after_payment: data.data.tip_after_payment === 1 || data.data.tip_after_payment === true,
          tip_suggestions: data.data.tip_suggestions || [15, 18, 20, 25]
        })
      }
    } catch (error) {
      console.error('Error loading display settings:', error)
    }
  }

  const loadRewardsSettings = async () => {
    try {
      const response = await fetch('/api/customer-rewards-settings')
      const data = await response.json()
      if (data.success && data.settings) {
        setRewardsSettings({
          enabled: data.settings.enabled === 1 || data.settings.enabled === true,
          require_email: data.settings.require_email === 1 || data.settings.require_email === true,
          require_phone: data.settings.require_phone === 1 || data.settings.require_phone === true,
          require_both: data.settings.require_both === 1 || data.settings.require_both === true,
          reward_type: data.settings.reward_type || 'points',
          points_per_dollar: data.settings.points_per_dollar || 1.0,
          percentage_discount: data.settings.percentage_discount || 0.0,
          fixed_discount: data.settings.fixed_discount || 0.0,
          minimum_spend: data.settings.minimum_spend || 0.0
        })
      }
    } catch (error) {
      console.error('Error loading rewards settings:', error)
    }
  }

  const loadPosSettings = async () => {
    try {
      const response = await fetch('/api/pos-settings')
      const data = await response.json()
      if (data.success && data.settings) {
        setPosSettings({
          num_registers: data.settings.num_registers || 1,
          register_type: data.settings.register_type || 'one_screen'
        })
      }
    } catch (error) {
      console.error('Error loading POS settings:', error)
    }
  }

  const loadSmsSettings = async () => {
    try {
      const response = await fetch(`/api/sms/settings/${selectedSmsStore}`)
      const data = await response.json()
      setSmsSettings({
        sms_provider: data.sms_provider || 'email',
        smtp_server: data.smtp_server || 'smtp.gmail.com',
        smtp_port: data.smtp_port || 587,
        smtp_user: data.smtp_user || '',
        smtp_password: data.smtp_password === '***' ? '' : (data.smtp_password || ''),
        smtp_use_tls: data.smtp_use_tls !== undefined ? data.smtp_use_tls : 1,
        aws_access_key_id: data.aws_access_key_id || '',
        aws_secret_access_key: data.aws_secret_access_key === '***' ? '' : (data.aws_secret_access_key || ''),
        aws_region: data.aws_region || 'us-east-1',
        business_name: data.business_name || '',
        auto_send_rewards_earned: data.auto_send_rewards_earned !== undefined ? data.auto_send_rewards_earned : 1,
        auto_send_rewards_redeemed: data.auto_send_rewards_redeemed !== undefined ? data.auto_send_rewards_redeemed : 1
      })
    } catch (error) {
      console.error('Error loading SMS settings:', error)
    }
  }

  const loadSmsStores = async () => {
    try {
      const response = await fetch('/api/sms/stores')
      const data = await response.json()
      if (Array.isArray(data) && data.length > 0) {
        setSmsStores(data)
        setSelectedSmsStore(data[0].store_id)
      }
    } catch (error) {
      console.error('Error loading SMS stores:', error)
    }
  }

  const loadSmsMessages = async () => {
    try {
      const response = await fetch(`/api/sms/messages?store_id=${selectedSmsStore}&limit=50`)
      const data = await response.json()
      if (Array.isArray(data)) {
        setSmsMessages(data)
      }
    } catch (error) {
      console.error('Error loading SMS messages:', error)
    }
  }

  const loadSmsTemplates = async () => {
    try {
      const response = await fetch(`/api/sms/templates?store_id=${selectedSmsStore}`)
      const data = await response.json()
      if (Array.isArray(data)) {
        setSmsTemplates(data)
      }
    } catch (error) {
      console.error('Error loading SMS templates:', error)
    }
  }

  const saveSmsSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/sms/settings/${selectedSmsStore}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify({
          ...smsSettings,
          session_token: sessionToken
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'SMS settings saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
        loadSmsSettings()
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save SMS settings' })
      }
    } catch (error) {
      console.error('Error saving SMS settings:', error)
      setMessage({ type: 'error', text: 'Failed to save SMS settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleSendSms = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify({
          ...sendSmsForm,
          store_id: selectedSmsStore,
          session_token: sessionToken
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'SMS sent successfully!' })
        setShowSendSmsModal(false)
        setSendSmsForm({ phone_number: '', message_text: '' })
        loadSmsMessages()
      } else {
        setMessage({ type: 'error', text: data.message || data.error || 'Failed to send SMS' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error sending SMS: ' + error.message })
    } finally {
      setSaving(false)
    }
  }

  const loadCashSettings = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch(`/api/register/cash-settings?register_id=${cashSettings.register_id}&session_token=${sessionToken}`)
      const data = await response.json()
      if (data.success && data.data) {
        if (Array.isArray(data.data) && data.data.length > 0) {
          setCashSettings({
            register_id: data.data[0].register_id || 1,
            cash_mode: data.data[0].cash_mode || 'total',
            total_amount: data.data[0].total_amount || 200.00,
            denominations: data.data[0].denominations || {
              '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
              '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
            }
          })
        } else if (!Array.isArray(data.data)) {
          setCashSettings({
            register_id: data.data.register_id || 1,
            cash_mode: data.data.cash_mode || 'total',
            total_amount: data.data.total_amount || 200.00,
            denominations: data.data.denominations || {
              '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
              '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
            }
          })
        }
      }
    } catch (error) {
      console.error('Error loading cash settings:', error)
    }
  }

  const saveCashSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const payload = {
        session_token: sessionToken,
        register_id: cashSettings.register_id,
        cash_mode: cashSettings.cash_mode,
        total_amount: cashSettings.cash_mode === 'total' ? parseFloat(cashSettings.total_amount) : null,
        denominations: cashSettings.cash_mode === 'denominations' ? cashSettings.denominations : null
      }

      const response = await fetch('/api/register/cash-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Cash settings saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
        loadCashSettings()
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save cash settings' })
      }
    } catch (error) {
      console.error('Error saving cash settings:', error)
      setMessage({ type: 'error', text: 'Failed to save cash settings' })
    } finally {
      setSaving(false)
    }
  }

  const loadDailyCounts = async () => {
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch(`/api/register/daily-count?count_date=${today}&session_token=${sessionToken}`)
      const data = await response.json()
      if (data.success && data.data) {
        setDailyCounts(data.data)
      }
    } catch (error) {
      console.error('Error loading daily counts:', error)
    }
  }

  const saveDailyCount = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      
      // Calculate total from denominations if in denominations mode
      let total = parseFloat(dailyCount.total_amount) || 0
      if (dailyCount.denominations) {
        const calculated = Object.entries(dailyCount.denominations).reduce((sum, [denom, count]) => {
          return sum + (parseFloat(denom) * parseInt(count || 0))
        }, 0)
        if (calculated > 0) {
          total = calculated
        }
      }

      const payload = {
        session_token: sessionToken,
        register_id: dailyCount.register_id,
        count_date: dailyCount.count_date,
        count_type: dailyCount.count_type,
        total_amount: total,
        denominations: dailyCount.denominations,
        notes: dailyCount.notes
      }

      const response = await fetch('/api/register/daily-count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Daily cash count saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
        loadDailyCounts()
        // Reset form
        setDailyCount({
          register_id: 1,
          count_date: new Date().toISOString().split('T')[0],
          count_type: 'drop',
          total_amount: 0,
          denominations: {
            '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0,
            '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
          },
          notes: ''
        })
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save daily count' })
      }
    } catch (error) {
      console.error('Error saving daily count:', error)
      setMessage({ type: 'error', text: 'Failed to save daily count' })
    } finally {
      setSaving(false)
    }
  }

  const calculateTotalFromDenominations = (denoms) => {
    return Object.entries(denoms).reduce((sum, [denom, count]) => {
      return sum + (parseFloat(denom) * parseInt(count || 0))
    }, 0)
  }

  const saveRewardsSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/customer-rewards-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify({
          session_token: sessionToken,
          enabled: rewardsSettings.enabled ? 1 : 0,
          require_email: rewardsSettings.require_email ? 1 : 0,
          require_phone: rewardsSettings.require_phone ? 1 : 0,
          require_both: rewardsSettings.require_both ? 1 : 0,
          reward_type: rewardsSettings.reward_type,
          points_per_dollar: parseFloat(rewardsSettings.points_per_dollar) || 1.0,
          percentage_discount: parseFloat(rewardsSettings.percentage_discount) || 0.0,
          fixed_discount: parseFloat(rewardsSettings.fixed_discount) || 0.0,
          minimum_spend: parseFloat(rewardsSettings.minimum_spend) || 0.0
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Customer rewards settings saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save rewards settings' })
      }
    } catch (error) {
      console.error('Error saving rewards settings:', error)
      setMessage({ type: 'error', text: 'Failed to save rewards settings' })
    } finally {
      setSaving(false)
    }
  }

  const savePosSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      // Save POS settings
      const posResponse = await fetch('/api/pos-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          num_registers: parseInt(posSettings.num_registers) || 1,
          register_type: posSettings.register_type || 'one_screen'
        })
      })

      const posData = await posResponse.json()
      
      // Save display settings
      const sessionToken = localStorage.getItem('sessionToken')
      const displayResponse = await fetch('/api/customer-display/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          tip_enabled: displaySettings.tip_enabled ? 1 : 0,
          tip_after_payment: displaySettings.tip_after_payment ? 1 : 0,
          tip_suggestions: displaySettings.tip_suggestions
        })
      })

      const displayData = await displayResponse.json()

      if (posData.success && displayData.success) {
        setMessage({ type: 'success', text: 'POS settings saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: posData.message || displayData.message || 'Failed to save POS settings' })
      }
    } catch (error) {
      console.error('Error saving POS settings:', error)
      setMessage({ type: 'error', text: 'Failed to save POS settings' })
    } finally {
      setSaving(false)
    }
  }

  const saveDisplaySettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const sessionToken = localStorage.getItem('sessionToken')
      const response = await fetch('/api/customer-display/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          tip_enabled: displaySettings.tip_enabled ? 1 : 0,
          tip_after_payment: displaySettings.tip_after_payment ? 1 : 0,
          tip_suggestions: displaySettings.tip_suggestions
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Display settings saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save display settings' })
      }
    } catch (error) {
      console.error('Error saving display settings:', error)
      setMessage({ type: 'error', text: 'Failed to save display settings' })
    } finally {
      setSaving(false)
    }
  }

  const saveStoreLocationSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const token = localStorage.getItem('sessionToken')
      const response = await fetch('/api/store-location-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token
        },
        body: JSON.stringify({
          session_token: token,
          ...storeLocationSettings,
          require_location: storeLocationSettings.require_location ? 1 : 0
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Store location settings saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save store location settings' })
      }
    } catch (error) {
      console.error('Error saving store location settings:', error)
      setMessage({ type: 'error', text: 'Failed to save store location settings' })
    } finally {
      setSaving(false)
    }
  }

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'))
        return
      }
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords
          
          // Try to get address from coordinates (reverse geocoding)
          let address = null
          try {
            const geoResponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
            )
            const geoData = await geoResponse.json()
            if (geoData && geoData.display_name) {
              address = geoData.display_name
            }
          } catch (err) {
            console.warn('Could not get address from coordinates:', err)
          }
          
          resolve({ latitude, longitude, address })
        },
        (error) => {
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    })
  }

  const handleSetCurrentLocation = async () => {
    try {
      setMessage({ type: 'info', text: 'Getting your current location...' })
      const location = await getCurrentLocation()
      setStoreLocationSettings({
        ...storeLocationSettings,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || storeLocationSettings.address
      })
      setMessage({ type: 'success', text: 'Location set successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to get location: ${error.message}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/shipment-verification/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(workflowSettings)
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save settings' })
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const saveReceiptSettings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/receipt-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...receiptSettings,
          receipt_type: receiptSettings.receipt_type || 'traditional',
          return_policy: receiptSettings.return_policy || '',
          show_tax_breakdown: receiptSettings.show_tax_breakdown ? 1 : 0,
          show_payment_method: receiptSettings.show_payment_method ? 1 : 0,
          show_signature: receiptSettings.show_signature ? 1 : 0
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Receipt settings saved successfully!' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save receipt settings' })
      }
    } catch (error) {
      console.error('Error saving receipt settings:', error)
      setMessage({ type: 'error', text: 'Failed to save receipt settings' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: isDarkMode ? 'var(--text-tertiary, #999)' : '#333' }}>
        <div>Loading settings...</div>
      </div>
    )
  }

  const settingsSections = [
    { id: 'workflow', label: 'Shipment Verification', icon: Workflow },
    { id: 'receipt', label: 'Receipt Settings', icon: Receipt },
    { id: 'location', label: 'Store Information', icon: MapPin },
    { id: 'rewards', label: 'Customer Rewards', icon: Gift },
    { id: 'pos', label: 'POS Settings', icon: ShoppingCart },
    { id: 'sms', label: 'SMS & Notifications', icon: MessageSquare },
    { id: 'cash', label: 'Cash Register', icon: DollarSign }
  ]

  return (
    <div style={{ 
      display: 'flex',
      minHeight: '100vh',
      width: '100%'
    }}>
      {/* Sidebar Navigation - 1/4 of page */}
      <div 
        ref={sidebarRef}
        style={{
          width: isInitialMount ? '25%' : (sidebarMinimized ? '60px' : '25%'),
          flexShrink: 0,
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
          padding: isInitialMount ? '32px 10px 48px 10px' : (sidebarMinimized ? '32px 10px 48px 10px' : '32px 10px 48px 10px'),
          minHeight: '100vh',
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          borderRight: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0'}`,
          transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden'
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          transition: isInitialMount ? 'none' : 'gap 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          paddingTop: '0',
          paddingBottom: '0',
          alignItems: 'stretch'
        }}>
          {/* Settings Header */}
          <div
            ref={settingsHeaderRef}
            style={{ position: 'relative' }}
            onMouseEnter={(e) => {
              setHoveringSettings(true)
              setShowTooltip(true)
              if (settingsHeaderRef.current) {
                const rect = settingsHeaderRef.current.getBoundingClientRect()
                if (sidebarMinimized) {
                  setTooltipPosition({
                    top: rect.top + rect.height / 2,
                    left: rect.right + 8
                  })
                } else {
                  setTooltipPosition({
                    top: rect.bottom + 4,
                    left: rect.left
                  })
                }
              }
            }}
            onMouseLeave={() => {
              setHoveringSettings(false)
              setShowTooltip(false)
            }}
          >
            <button
              onClick={() => setSidebarMinimized(!sidebarMinimized)}
              style={{
                width: isInitialMount ? '100%' : (sidebarMinimized ? '40px' : '100%'),
                height: '40px',
                padding: '0',
                margin: '0',
                border: 'none',
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isInitialMount ? 'flex-start' : (sidebarMinimized ? 'center' : 'flex-start'),
                transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), justifyContent 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                left: '0',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                transition: 'none'
              }}>
                {sidebarMinimized ? (
                  <PanelLeft size={20} style={{ width: '20px', height: '20px' }} />
                ) : (
                  hoveringSettings ? (
                    <PanelLeft size={20} style={{ width: '20px', height: '20px' }} />
                  ) : (
                    <SettingsIcon size={20} style={{ width: '20px', height: '20px' }} />
                  )
                )}
              </div>
              {!sidebarMinimized && (
                <span style={{
                  marginLeft: '48px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  whiteSpace: 'nowrap',
                  opacity: sidebarMinimized ? 0 : 1,
                  transition: isInitialMount ? 'none' : 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  pointerEvents: 'none'
                }}>
                  Settings
                </span>
              )}
            </button>
          </div>
          {showTooltip && (
            <div
              style={{
                position: 'fixed',
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
                transform: sidebarMinimized ? 'translateY(-50%)' : 'none',
                padding: '4px 8px',
                backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.85)',
                color: 'white',
                fontSize: '12px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                zIndex: 10000,
                pointerEvents: 'none'
              }}
            >
              {sidebarMinimized ? 'Open sidebar' : 'Close sidebar'}
            </div>
          )}
          {settingsSections.map((section) => {
            const Icon = section.icon
            const isActive = activeTab === section.id
            return (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                style={{
                  width: isInitialMount ? '100%' : (sidebarMinimized ? '40px' : '100%'),
                  height: '40px',
                  padding: '0',
                  margin: '0',
                  border: 'none',
                  backgroundColor: isActive 
                    ? (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                    : 'transparent',
                  borderRadius: isActive ? '6px' : '0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isInitialMount ? 'flex-start' : (sidebarMinimized ? 'center' : 'flex-start'),
                  transition: isInitialMount ? 'backgroundColor 0.2s ease, borderRadius 0.2s ease' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), justifyContent 0.4s cubic-bezier(0.4, 0, 0.2, 1), backgroundColor 0.2s ease, borderRadius 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  color: isActive 
                    ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333')
                    : (isDarkMode ? 'var(--text-secondary, #ccc)' : '#666')
                }}
              >
                <div style={{
                  position: 'absolute',
                  left: '0',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  transition: 'none'
                }}>
                  <Icon size={20} style={{ width: '20px', height: '20px' }} />
                </div>
                {!sidebarMinimized && (
                  <span style={{
                    marginLeft: '48px',
                    fontSize: '14px',
                    fontWeight: isActive ? 600 : 'normal',
                    whiteSpace: 'nowrap',
                    opacity: sidebarMinimized ? 0 : 1,
                    transition: isInitialMount ? 'none' : 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    pointerEvents: 'none'
                  }}>
                    {section.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>


      {/* Main Content Area - 3/4 of page */}
      <div 
        ref={contentRef}
        style={{
          width: isInitialMount ? '75%' : (sidebarMinimized ? 'calc(100% - 60px)' : '75%'),
          flex: 1,
          padding: '48px 64px 64px 64px',
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
          maxWidth: isInitialMount ? '1200px' : (sidebarMinimized ? 'none' : '1200px'),
          transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {message && (
          <div style={{
            padding: '16px 20px',
            marginBottom: '32px',
            borderRadius: '10px',
            backgroundColor: message.type === 'success' 
              ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9')
              : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#ffebee'),
            color: message.type === 'success' ? '#4caf50' : '#f44336',
            border: `1px solid ${message.type === 'success' ? '#4caf50' : '#f44336'}`,
            boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {message.text}
          </div>
        )}

        {/* Content */}
        <div>
          {activeTab === 'workflow' && (
            <div>
        {/* Workflow Mode Setting */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{
            marginBottom: '12px',
            fontSize: '16px',
            fontWeight: 700,
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
          }}>
            Workflow Mode
          </h2>
          <p style={{
            marginBottom: '20px',
            fontSize: '13px',
            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
            lineHeight: '1.6'
          }}>
            Choose how shipment verification works:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Simple Workflow */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              border: `2px solid ${workflowSettings.workflow_mode === 'simple' ? `rgba(${themeColorRgb}, 0.7)` : (isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0')}`,
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: workflowSettings.workflow_mode === 'simple' 
                ? (isDarkMode ? `rgba(${themeColorRgb}, 0.1)` : `rgba(${themeColorRgb}, 0.05)`)
                : 'transparent',
              transition: 'all 0.2s ease'
            }}>
              <input
                type="radio"
                name="workflow_mode"
                value="simple"
                checked={workflowSettings.workflow_mode === 'simple'}
                onChange={(e) => setWorkflowSettings({ ...workflowSettings, workflow_mode: e.target.value })}
                style={{ marginTop: '4px' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: 600,
                  marginBottom: '4px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Simple Workflow
                </div>
                <div style={{
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                  lineHeight: '1.5'
                }}>
                  Verify items, input prices → Automatically add to inventory when complete. 
                  Fast and straightforward for quick processing.
                </div>
              </div>
            </label>

            {/* Three-Step Workflow */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '16px',
              border: `2px solid ${workflowSettings.workflow_mode === 'three_step' ? `rgba(${themeColorRgb}, 0.7)` : (isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0')}`,
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: workflowSettings.workflow_mode === 'three_step' 
                ? (isDarkMode ? `rgba(${themeColorRgb}, 0.1)` : `rgba(${themeColorRgb}, 0.05)`)
                : 'transparent',
              transition: 'all 0.2s ease'
            }}>
              <input
                type="radio"
                name="workflow_mode"
                value="three_step"
                checked={workflowSettings.workflow_mode === 'three_step'}
                onChange={(e) => setWorkflowSettings({ ...workflowSettings, workflow_mode: e.target.value })}
                style={{ marginTop: '4px' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: 600,
                  marginBottom: '4px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Three-Step Workflow
                </div>
                <div style={{
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                  lineHeight: '1.5',
                  marginBottom: '8px'
                }}>
                  Step-by-step verification process:
                </div>
                <ol style={{
                  margin: '0 0 0 16px',
                  padding: 0,
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                  lineHeight: '1.8'
                }}>
                  <li><strong>Step 1:</strong> Verify items arrived and input prices</li>
                  <li><strong>Step 2:</strong> Review and confirm all pricing</li>
                  <li><strong>Step 3:</strong> Add items to inventory (put on shelf)</li>
                </ol>
              </div>
            </label>
          </div>
        </div>

        {/* Auto-add to Inventory (only for simple mode) */}
        {workflowSettings.workflow_mode === 'simple' && (
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{
              marginBottom: '12px',
              fontSize: '16px',
              fontWeight: 700,
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
            }}>
              Auto-Add to Inventory
            </h2>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={workflowSettings.auto_add_to_inventory === 'true'}
                onChange={(e) => setWorkflowSettings({
                  ...workflowSettings,
                  auto_add_to_inventory: e.target.checked ? 'true' : 'false'
                })}
              />
              <span style={{
                fontSize: '14px',
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>
                Automatically add items to inventory when verification is complete
              </span>
            </label>
            <p style={{
              marginTop: '8px',
              marginLeft: '32px',
              fontSize: '13px',
              color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
              fontStyle: 'italic'
            }}>
              When unchecked, you'll need to manually add items to inventory after verification.
            </p>
          </div>
        )}

        {/* Save Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            className="button-26 button-26--header"
            role="button"
            onClick={
              activeTab === 'workflow' ? saveSettings :
              activeTab === 'receipt' ? saveReceiptSettings :
              activeTab === 'location' ? saveStoreLocationSettings :
              activeTab === 'rewards' ? saveRewardsSettings :
              activeTab === 'pos' ? savePosSettings :
              activeTab === 'sms' ? saveSmsSettings :
              activeTab === 'cash' ? saveCashSettings :
              null
            }
            disabled={saving}
            style={{
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            <div className="button-26__content">
              <span className="button-26__text text">
                {saving 
                  ? (activeTab === 'workflow' ? 'Saving...' : activeTab === 'receipt' ? 'Saving Receipt Settings...' : activeTab === 'location' ? 'Saving Store Information...' : activeTab === 'rewards' ? 'Saving Rewards Settings...' : activeTab === 'pos' ? 'Saving POS Settings...' : activeTab === 'sms' ? 'Saving...' : activeTab === 'cash' ? 'Saving...' : 'Saving...')
                  : (activeTab === 'workflow' ? 'Save Settings' : activeTab === 'receipt' ? 'Save Receipt Settings' : activeTab === 'location' ? 'Save Store Information' : activeTab === 'rewards' ? 'Save Rewards Settings' : activeTab === 'pos' ? 'Save POS Settings' : activeTab === 'sms' ? 'Save SMS Settings' : activeTab === 'cash' ? 'Save Cash Settings' : 'Save')
                }
              </span>
            </div>
          </button>
        </div>
      </div>
      )}

      {/* Receipt Settings Tab */}
      {activeTab === 'receipt' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Receipt Type */}
            <FormField>
              <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600 }}>
                Receipt Type
              </FormTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '16px',
                  border: `2px solid ${receiptSettings.receipt_type === 'traditional' ? `rgba(${themeColorRgb}, 0.7)` : (isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0')}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: receiptSettings.receipt_type === 'traditional' 
                    ? (isDarkMode ? `rgba(${themeColorRgb}, 0.1)` : `rgba(${themeColorRgb}, 0.05)`)
                    : 'transparent',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="radio"
                    name="receipt_type"
                    value="traditional"
                    checked={receiptSettings.receipt_type === 'traditional'}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, receipt_type: e.target.value })}
                    style={{ marginTop: '4px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 600,
                      marginBottom: '4px',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                    }}>
                      Traditional Receipt
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                      lineHeight: '1.5'
                    }}>
                      Standard thermal printer format (80mm width, black & white, compact layout)
                    </div>
                  </div>
                </label>
                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '16px',
                  border: `2px solid ${receiptSettings.receipt_type === 'custom' ? `rgba(${themeColorRgb}, 0.7)` : (isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0')}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: receiptSettings.receipt_type === 'custom' 
                    ? (isDarkMode ? `rgba(${themeColorRgb}, 0.1)` : `rgba(${themeColorRgb}, 0.05)`)
                    : 'transparent',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="radio"
                    name="receipt_type"
                    value="custom"
                    checked={receiptSettings.receipt_type === 'custom'}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, receipt_type: e.target.value })}
                    style={{ marginTop: '4px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 600,
                      marginBottom: '4px',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                    }}>
                      Custom Receipt
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                      lineHeight: '1.5'
                    }}>
                      Full customization with all information, return policy, and detailed formatting
                    </div>
                  </div>
                </label>
              </div>
            </FormField>

            {/* Store Information */}
            <FormField>
              <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600 }}>
                Store Information
              </FormTitle>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Store Name"
                  value={receiptSettings.store_name}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, store_name: e.target.value })}
                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                />
                <input
                  type="text"
                  placeholder="Street Address"
                  value={receiptSettings.store_address}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, store_address: e.target.value })}
                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                  <input
                    type="text"
                    placeholder="City"
                    value={receiptSettings.store_city}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, store_city: e.target.value })}
                    style={inputBaseStyle(isDarkMode, themeColorRgb)}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={receiptSettings.store_state}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, store_state: e.target.value })}
                    style={inputBaseStyle(isDarkMode, themeColorRgb)}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                  <input
                    type="text"
                    placeholder="ZIP"
                    value={receiptSettings.store_zip}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, store_zip: e.target.value })}
                    style={inputBaseStyle(isDarkMode, themeColorRgb)}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Phone"
                  value={receiptSettings.store_phone}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, store_phone: e.target.value })}
                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={receiptSettings.store_email}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, store_email: e.target.value })}
                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                />
                <input
                  type="text"
                  placeholder="Website"
                  value={receiptSettings.store_website}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, store_website: e.target.value })}
                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                />
              </div>
            </FormField>

            {/* Footer Message */}
            <FormField>
              <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600 }}>
                Footer Message
              </FormTitle>
              <textarea
                placeholder="Thank you for your business!"
                value={receiptSettings.footer_message}
                onChange={(e) => setReceiptSettings({ ...receiptSettings, footer_message: e.target.value })}
                rows={3}
                style={{
                  ...inputBaseStyle(isDarkMode, themeColorRgb),
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  minHeight: '80px'
                }}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              />
            </FormField>

            {/* Return Policy */}
            <FormField>
              <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600 }}>
                Return Policy
              </FormTitle>
              <textarea
                placeholder="Enter your store's return policy (e.g., 'Returns accepted within 30 days with receipt')"
                value={receiptSettings.return_policy}
                onChange={(e) => setReceiptSettings({ ...receiptSettings, return_policy: e.target.value })}
                rows={4}
                style={{
                  ...inputBaseStyle(isDarkMode, themeColorRgb),
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  minHeight: '100px'
                }}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              />
              <p style={{
                marginTop: '8px',
                fontSize: '13px',
                color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                fontStyle: 'italic'
              }}>
                This will appear at the bottom of receipts
              </p>
            </FormField>

            {/* Display Options */}
            <FormField>
              <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600 }}>
                Display Options
              </FormTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={receiptSettings.show_tax_breakdown}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, show_tax_breakdown: e.target.checked })}
                  />
                  <span style={{
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Show tax breakdown on receipt
                  </span>
                </label>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={receiptSettings.show_payment_method}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, show_payment_method: e.target.checked })}
                  />
                  <span style={{
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Show payment method on receipt
                  </span>
                </label>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={receiptSettings.show_signature}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, show_signature: e.target.checked })}
                  />
                  <span style={{
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Show signature on receipt
                  </span>
                </label>
              </div>
            </FormField>

            {/* Save Button */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              marginTop: '24px'
            }}>
              <button
                type="button"
                className="button-26 button-26--header"
                role="button"
                onClick={saveReceiptSettings}
                disabled={saving}
                style={{
                  opacity: saving ? 0.6 : 1,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                <div className="button-26__content">
                  <span className="button-26__text text">
                    {saving ? 'Saving...' : 'Save Receipt Settings'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Store Information Settings Tab */}
      {activeTab === 'location' && (
        <div>
          <h2 style={{
            marginBottom: '8px',
            fontSize: '16px',
            fontWeight: 700,
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
          }}>
            Store Location Settings
          </h2>
          <p style={{
            marginBottom: '20px',
            fontSize: '13px',
            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
            lineHeight: '1.5'
          }}>
            Set your store's GPS location and allowed radius. When employees clock in or out, 
            the system will collect their location and verify they are within the specified radius 
            of the store. This prevents employees from clocking in from home or other unauthorized locations.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: 500,
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>
                Store Name
              </label>
              <input
                type="text"
                value={storeLocationSettings.store_name}
                onChange={(e) => setStoreLocationSettings({ ...storeLocationSettings, store_name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                  borderRadius: '6px',
                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: 500,
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>
                Store Address
              </label>
              <input
                type="text"
                value={storeLocationSettings.address}
                onChange={(e) => setStoreLocationSettings({ ...storeLocationSettings, address: e.target.value })}
                placeholder="Enter store address"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                  borderRadius: '6px',
                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  GPS Coordinates
                </label>
                <button
                  type="button"
                  className="button-26 button-26--header"
                  role="button"
                  onClick={handleSetCurrentLocation}
                >
                  <div className="button-26__content">
                    <span className="button-26__text text">📍 Use Current Location</span>
                  </div>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666'
                  }}>
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={storeLocationSettings.latitude || ''}
                    onChange={(e) => setStoreLocationSettings({ 
                      ...storeLocationSettings, 
                      latitude: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                    placeholder="e.g., 40.7128"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                      borderRadius: '6px',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666'
                  }}>
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={storeLocationSettings.longitude || ''}
                    onChange={(e) => setStoreLocationSettings({ 
                      ...storeLocationSettings, 
                      longitude: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                    placeholder="e.g., -74.0060"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                      borderRadius: '6px',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
              {storeLocationSettings.latitude && storeLocationSettings.longitude && (
                <p style={{
                  marginTop: '8px',
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                  fontStyle: 'italic'
                }}>
                  Location set: {storeLocationSettings.latitude.toFixed(6)}, {storeLocationSettings.longitude.toFixed(6)}
                </p>
              )}
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '6px',
                fontSize: '14px',
                fontWeight: 500,
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>
                Allowed Radius (meters)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={storeLocationSettings.allowed_radius_meters}
                onChange={(e) => setStoreLocationSettings({ 
                  ...storeLocationSettings, 
                  allowed_radius_meters: parseFloat(e.target.value) || 100.0 
                })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                  borderRadius: '6px',
                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  fontSize: '14px'
                }}
              />
              <p style={{
                marginTop: '6px',
                        fontSize: '14px',
                color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
              }}>
                Employees must be within this distance (in meters) from the store to clock in/out.
                Default: 100 meters (~328 feet)
              </p>
            </div>

            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={storeLocationSettings.require_location}
                  onChange={(e) => setStoreLocationSettings({ 
                    ...storeLocationSettings, 
                    require_location: e.target.checked 
                  })}
                />
                <span style={{
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Require location verification for clock in/out
                </span>
              </label>
              <p style={{
                marginTop: '6px',
                marginLeft: '32px',
                        fontSize: '14px',
                color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                fontStyle: 'italic'
              }}>
                When enabled, employees must be within the allowed radius to clock in/out. 
                When disabled, location is still recorded but not validated.
              </p>
            </div>

            {/* Save Button */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              marginTop: '32px',
              paddingTop: '24px',
              borderTop: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`
            }}>
              <button
                type="button"
                className="button-26 button-26--header"
                role="button"
                onClick={saveStoreLocationSettings}
                disabled={saving}
                style={{
                  opacity: saving ? 0.6 : 1,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                <div className="button-26__content">
                  <span className="button-26__text text">
                    {saving ? 'Saving...' : 'Save Location Settings'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Rewards Settings Tab */}
      {activeTab === 'rewards' && (
        <div>
          <h2 style={{
            marginBottom: '20px',
            fontSize: '16px',
            fontWeight: 700,
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
          }}>
            Customer Rewards Program
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Enable Rewards */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={rewardsSettings.enabled}
                  onChange={(e) => setRewardsSettings({ ...rewardsSettings, enabled: e.target.checked })}
                />
                <span style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Enable Customer Rewards Program
                </span>
              </label>
            </div>

            {rewardsSettings.enabled && (
              <>
                {/* Customer Info Requirements */}
                <div>
                  <h3 style={{
                    marginBottom: '12px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Customer Information Requirements
                  </h3>
                  <p style={{
                    marginBottom: '16px',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
                  }}>
                    Choose what customer information is required to participate in the rewards program:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="customer_info_requirement"
                        checked={!rewardsSettings.require_email && !rewardsSettings.require_phone && !rewardsSettings.require_both}
                        onChange={() => setRewardsSettings({
                          ...rewardsSettings,
                          require_email: false,
                          require_phone: false,
                          require_both: false
                        })}
                      />
                      <span style={{
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        No requirements (optional)
                      </span>
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="customer_info_requirement"
                        checked={rewardsSettings.require_email && !rewardsSettings.require_both}
                        onChange={() => setRewardsSettings({
                          ...rewardsSettings,
                          require_email: true,
                          require_phone: false,
                          require_both: false
                        })}
                      />
                      <span style={{
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Require email
                      </span>
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="customer_info_requirement"
                        checked={rewardsSettings.require_phone && !rewardsSettings.require_both}
                        onChange={() => setRewardsSettings({
                          ...rewardsSettings,
                          require_email: false,
                          require_phone: true,
                          require_both: false
                        })}
                      />
                      <span style={{
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Require phone number
                      </span>
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="customer_info_requirement"
                        checked={rewardsSettings.require_both}
                        onChange={() => setRewardsSettings({
                          ...rewardsSettings,
                          require_email: true,
                          require_phone: true,
                          require_both: true
                        })}
                      />
                      <span style={{
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Require both email and phone number
                      </span>
                    </label>
                  </div>
                </div>

                {/* Reward Type */}
                <div>
                  <h3 style={{
                    marginBottom: '8px',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Reward Type
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="reward_type"
                        value="points"
                        checked={rewardsSettings.reward_type === 'points'}
                        onChange={(e) => setRewardsSettings({ ...rewardsSettings, reward_type: e.target.value })}
                      />
                      <span style={{
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Points (earn points per dollar spent)
                      </span>
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="reward_type"
                        value="percentage"
                        checked={rewardsSettings.reward_type === 'percentage'}
                        onChange={(e) => setRewardsSettings({ ...rewardsSettings, reward_type: e.target.value })}
                      />
                      <span style={{
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Percentage discount
                      </span>
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="reward_type"
                        value="fixed"
                        checked={rewardsSettings.reward_type === 'fixed'}
                        onChange={(e) => setRewardsSettings({ ...rewardsSettings, reward_type: e.target.value })}
                      />
                      <span style={{
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}>
                        Fixed discount amount
                      </span>
                    </label>
                  </div>
                </div>

                {/* Reward Configuration */}
                {rewardsSettings.reward_type === 'points' && (
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                    }}>
                      Points per Dollar Spent
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={rewardsSettings.points_per_dollar}
                      onChange={(e) => setRewardsSettings({
                        ...rewardsSettings,
                        points_per_dollar: parseFloat(e.target.value) || 1.0
                      })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                        borderRadius: '6px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                )}

                {rewardsSettings.reward_type === 'percentage' && (
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                    }}>
                      Percentage Discount (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={rewardsSettings.percentage_discount}
                      onChange={(e) => setRewardsSettings({
                        ...rewardsSettings,
                        percentage_discount: parseFloat(e.target.value) || 0.0
                      })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                        borderRadius: '6px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                )}

                {rewardsSettings.reward_type === 'fixed' && (
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                    }}>
                      Fixed Discount Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={rewardsSettings.fixed_discount}
                      onChange={(e) => setRewardsSettings({
                        ...rewardsSettings,
                        fixed_discount: parseFloat(e.target.value) || 0.0
                      })}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                        borderRadius: '6px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                )}

                {/* Minimum Spend */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Minimum Spend to Earn Rewards ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rewardsSettings.minimum_spend}
                    onChange={(e) => setRewardsSettings({
                      ...rewardsSettings,
                      minimum_spend: parseFloat(e.target.value) || 0.0
                    })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                      borderRadius: '6px',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      fontSize: '14px'
                    }}
                  />
                  <p style={{
                    marginTop: '6px',
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
                  }}>
                    Customers must spend this amount or more to earn rewards (0 = no minimum)
                  </p>
                </div>

                {/* Save Button */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '24px',
                  paddingTop: '24px',
                  borderTop: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`
                }}>
                  <button
                    type="button"
                    className="button-26 button-26--header"
                    role="button"
                    onClick={saveRewardsSettings}
                    disabled={saving}
                    style={{
                      opacity: saving ? 0.6 : 1,
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <div className="button-26__content">
                      <span className="button-26__text text">
                        {saving ? 'Saving...' : 'Save Rewards Settings'}
                      </span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* POS Settings Tab */}
      {activeTab === 'pos' && (
        <div>
          <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '20px' }}>
            POS Configuration
          </FormTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Number of Registers */}
            <FormField>
              <FormLabel isDarkMode={isDarkMode}>
                Number of Registers
              </FormLabel>
              <p style={{
                marginBottom: '8px',
                fontSize: '13px',
                color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
              }}>
                How many registers or checkout stations do you have?
              </p>
              <input
                type="number"
                min="1"
                max="50"
                value={posSettings.num_registers}
                onChange={(e) => setPosSettings({
                  ...posSettings,
                  num_registers: parseInt(e.target.value) || 1
                })}
                style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              />
            </FormField>

            {/* Register Type */}
            <FormField>
              <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600 }}>
                Register Type
              </FormTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="register_type"
                    value="one_screen"
                    checked={posSettings.register_type === 'one_screen'}
                    onChange={(e) => setPosSettings({ ...posSettings, register_type: e.target.value })}
                  />
                  <span style={{
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    One Screen Register
                  </span>
                </label>
                <p style={{
                  marginLeft: '24px',
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                  marginTop: '-8px'
                }}>
                  Single display screen for both cashier and customer view.
                </p>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="register_type"
                    value="two_screen"
                    checked={posSettings.register_type === 'two_screen'}
                    onChange={(e) => setPosSettings({ ...posSettings, register_type: e.target.value })}
                  />
                  <span style={{
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Two Screen Register
                  </span>
                </label>
                <p style={{
                  marginLeft: '24px',
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                  marginTop: '-8px'
                }}>
                  Separate displays for cashier and customer.
                </p>
              </div>
            </FormField>

            {/* Customer Display Settings */}
            <div style={{
              marginTop: '32px'
            }}>
              <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600 }}>
                Customer Display Settings
              </FormTitle>
              
              <FormField>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={displaySettings.tip_enabled}
                    onChange={(e) => setDisplaySettings({ ...displaySettings, tip_enabled: e.target.checked })}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ 
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Enable tip prompts before payment
                  </span>
                </label>
              </FormField>

              <FormField>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={displaySettings.tip_after_payment}
                    onChange={(e) => setDisplaySettings({ ...displaySettings, tip_after_payment: e.target.checked })}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ 
                    fontSize: '14px',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                  }}>
                    Enable tip option after payment completion
                  </span>
                </label>
              </FormField>
            </div>

            {/* Save Button */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '24px'
            }}>
              <button
                type="button"
                className="button-26 button-26--header"
                role="button"
                onClick={savePosSettings}
                disabled={saving}
                style={{
                  opacity: saving ? 0.6 : 1,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                <div className="button-26__content">
                  <span className="button-26__text text">
                    {saving ? 'Saving...' : 'Save POS Settings'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Settings Tab */}
      {activeTab === 'sms' && (
        <div>
          <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '20px' }}>
            SMS & Notifications
          </FormTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* SMS Provider Selection */}
            <FormField>
              <FormLabel isDarkMode={isDarkMode}>
                SMS Provider
              </FormLabel>
              <select
                value={smsSettings.sms_provider || 'email'}
                onChange={(e) => setSmsSettings({...smsSettings, sms_provider: e.target.value})}
                style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '300px' }}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              >
                <option value="email">Email-to-SMS (FREE)</option>
                <option value="aws_sns">AWS SNS (~$0.006/SMS)</option>
              </select>
              <p style={{
                marginTop: '8px',
                fontSize: '13px',
                color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
              }}>
                {smsSettings.sms_provider === 'email' 
                  ? 'Free but limited reliability. Good for testing.'
                  : 'Low cost, high reliability. Recommended for production.'}
              </p>
            </FormField>

            {/* Email Settings */}
            {smsSettings.sms_provider === 'email' && (
              <>
                <FormField>
                  <FormLabel isDarkMode={isDarkMode}>
                    SMTP Server
                  </FormLabel>
                  <input
                    type="text"
                    value={smsSettings.smtp_server || 'smtp.gmail.com'}
                    onChange={(e) => setSmsSettings({...smsSettings, smtp_server: e.target.value})}
                    style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '400px' }}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                </FormField>

                <FormField>
                  <FormLabel isDarkMode={isDarkMode}>
                    SMTP Port
                  </FormLabel>
                  <input
                    type="number"
                    value={smsSettings.smtp_port || 587}
                    onChange={(e) => setSmsSettings({...smsSettings, smtp_port: parseInt(e.target.value)})}
                    style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                </FormField>

                <FormField>
                  <FormLabel isDarkMode={isDarkMode}>
                    Email Address (Gmail)
                  </FormLabel>
                  <input
                    type="email"
                    value={smsSettings.smtp_user || ''}
                    onChange={(e) => setSmsSettings({...smsSettings, smtp_user: e.target.value})}
                    placeholder="yourstore@gmail.com"
                    style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '400px' }}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                  <p style={{
                    marginTop: '4px',
                    fontSize: '13px',
                    color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
                  }}>
                    For Gmail: Enable 2FA and create an App Password
                  </p>
                </FormField>

                <FormField>
                  <FormLabel isDarkMode={isDarkMode}>
                    App Password
                  </FormLabel>
                  <input
                    type="password"
                    value={smsSettings.smtp_password || ''}
                    onChange={(e) => setSmsSettings({...smsSettings, smtp_password: e.target.value})}
                    placeholder="Enter app password"
                    style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '400px' }}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                </FormField>
              </>
            )}

            {/* AWS Settings */}
            {smsSettings.sms_provider === 'aws_sns' && (
              <>
                <FormField>
                  <FormLabel isDarkMode={isDarkMode}>
                    AWS Access Key ID
                  </FormLabel>
                  <input
                    type="text"
                    value={smsSettings.aws_access_key_id || ''}
                    onChange={(e) => setSmsSettings({...smsSettings, aws_access_key_id: e.target.value})}
                    placeholder="AKIA..."
                    style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '400px' }}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                </FormField>

                <FormField>
                  <FormLabel isDarkMode={isDarkMode}>
                    AWS Secret Access Key
                  </FormLabel>
                  <input
                    type="password"
                    value={smsSettings.aws_secret_access_key || ''}
                    onChange={(e) => setSmsSettings({...smsSettings, aws_secret_access_key: e.target.value})}
                    placeholder="Enter secret key"
                    style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '400px' }}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                </FormField>

                <FormField>
                  <FormLabel isDarkMode={isDarkMode}>
                    AWS Region
                  </FormLabel>
                  <input
                    type="text"
                    value={smsSettings.aws_region || 'us-east-1'}
                    onChange={(e) => setSmsSettings({...smsSettings, aws_region: e.target.value})}
                    placeholder="us-east-1"
                    style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  />
                </FormField>
              </>
            )}

            {/* Business Name */}
            <FormField>
              <FormLabel isDarkMode={isDarkMode}>
                Business Name
              </FormLabel>
              <input
                type="text"
                value={smsSettings.business_name || ''}
                onChange={(e) => setSmsSettings({...smsSettings, business_name: e.target.value})}
                placeholder="Your Store Name"
                style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '400px' }}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              />
            </FormField>

            {/* Auto-send Options */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={smsSettings.auto_send_rewards_earned || false}
                  onChange={(e) => setSmsSettings({...smsSettings, auto_send_rewards_earned: e.target.checked ? 1 : 0})}
                />
                <span style={{
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Auto-send SMS when customers earn rewards
                </span>
              </label>
            </div>

            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={smsSettings.auto_send_rewards_redeemed || false}
                  onChange={(e) => setSmsSettings({...smsSettings, auto_send_rewards_redeemed: e.target.checked ? 1 : 0})}
                />
                <span style={{
                  fontSize: '14px',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Auto-send SMS when customers redeem rewards
                </span>
              </label>
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '24px'
            }}>
              <button
                type="button"
                className="button-26 button-26--header"
                role="button"
                onClick={() => setShowSendSmsModal(true)}
              >
                <div className="button-26__content">
                  <span className="button-26__text text">Send Test SMS</span>
                </div>
              </button>
              <button
                type="button"
                className="button-26 button-26--header"
                role="button"
                onClick={saveSmsSettings}
                disabled={saving}
                style={{
                  opacity: saving ? 0.6 : 1,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                <div className="button-26__content">
                  <span className="button-26__text text">
                    {saving ? 'Saving...' : 'Save SMS Settings'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send SMS Modal */}
      {showSendSmsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
            padding: '30px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px'
          }}>
            <h2 style={{
              marginTop: 0,
              color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
            }}>
              Send Test SMS
            </h2>
            <form onSubmit={handleSendSms}>
              <FormField>
                <FormLabel isDarkMode={isDarkMode}>
                  Phone Number
                </FormLabel>
                <input
                  type="tel"
                  value={sendSmsForm.phone_number}
                  onChange={(e) => setSendSmsForm({...sendSmsForm, phone_number: e.target.value})}
                  placeholder="(555) 123-4567"
                  required
                  style={inputBaseStyle(isDarkMode, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                />
              </FormField>
              <FormField>
                <FormLabel isDarkMode={isDarkMode}>
                  Message
                </FormLabel>
                <textarea
                  value={sendSmsForm.message_text}
                  onChange={(e) => setSendSmsForm({...sendSmsForm, message_text: e.target.value})}
                  rows={5}
                  required
                  style={{
                    ...inputBaseStyle(isDarkMode, themeColorRgb),
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    minHeight: '100px'
                  }}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                />
                <p style={{
                  fontSize: '13px',
                  color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666',
                  marginTop: '8px'
                }}>
                  {sendSmsForm.message_text.length}/160 characters
                </p>
              </FormField>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="submit"
                  className="button-26 button-26--header"
                  role="button"
                  disabled={saving}
                  style={{
                    opacity: saving ? 0.6 : 1,
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  <div className="button-26__content">
                    <span className="button-26__text text">
                      {saving ? 'Sending...' : 'Send'}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  className="button-26 button-26--header"
                  role="button"
                  onClick={() => setShowSendSmsModal(false)}
                >
                  <div className="button-26__content">
                    <span className="button-26__text text">Cancel</span>
                  </div>
                </button>
              </div>
            </form>
          </div>
        </div>
          )}

      {activeTab === 'cash' && (
        <div>
          <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '20px' }}>
            Cash Register Management
          </FormTitle>
          {/* Register Cash Configuration */}
          <div style={{ marginBottom: '32px' }}>
            <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600 }}>
              Base Cash Configuration
            </FormTitle>

            <FormField>
              <FormLabel isDarkMode={isDarkMode}>
                Register ID
              </FormLabel>
              <input
                type="number"
                min="1"
                value={cashSettings.register_id}
                onChange={(e) => setCashSettings({...cashSettings, register_id: parseInt(e.target.value) || 1})}
                style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              />
            </FormField>

            <FormField>
              <FormLabel isDarkMode={isDarkMode}>
                Cash Mode
              </FormLabel>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="cash_mode"
                    value="total"
                    checked={cashSettings.cash_mode === 'total'}
                    onChange={(e) => setCashSettings({...cashSettings, cash_mode: e.target.value})}
                  />
                  <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Total Amount</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="cash_mode"
                    value="denominations"
                    checked={cashSettings.cash_mode === 'denominations'}
                    onChange={(e) => setCashSettings({...cashSettings, cash_mode: e.target.value})}
                  />
                  <span style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>Denominations</span>
                </label>
              </div>
            </FormField>

            {cashSettings.cash_mode === 'total' ? (
              <FormField>
                <FormLabel isDarkMode={isDarkMode}>
                  Total Amount ($)
                </FormLabel>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashSettings.total_amount}
                  onChange={(e) => setCashSettings({...cashSettings, total_amount: parseFloat(e.target.value) || 0})}
                  style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                />
              </FormField>
            ) : (
              <FormField>
                <FormLabel isDarkMode={isDarkMode}>
                  Bill and Coin Counts
                </FormLabel>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '12px'
                }}>
                  {Object.entries(cashSettings.denominations).map(([denom, count]) => (
                    <div key={denom}>
                      <label style={{
                        display: 'block',
                        marginBottom: '4px',
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666'
                      }}>
                        ${denom}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={count}
                        onChange={(e) => setCashSettings({
                          ...cashSettings,
                          denominations: {
                            ...cashSettings.denominations,
                            [denom]: parseInt(e.target.value) || 0
                          }
                        })}
                        style={inputBaseStyle(isDarkMode, themeColorRgb)}
                        {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                      />
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                  borderRadius: '6px'
                }}>
                  <strong style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                    Total: ${calculateTotalFromDenominations(cashSettings.denominations).toFixed(2)}
                  </strong>
                </div>
              </FormField>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                className="button-26 button-26--header"
                role="button"
                onClick={saveCashSettings}
                disabled={saving}
                style={{
                  opacity: saving ? 0.6 : 1,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                <div className="button-26__content">
                  <span className="button-26__text text">
                    {saving ? 'Saving...' : 'Save Cash Settings'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Daily Cash Count */}
          <div style={{
            marginTop: '32px',
            paddingTop: '32px',
            borderTop: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`
          }}>
            <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600 }}>
              Daily Cash Count / Drop
            </FormTitle>

            <FormField>
              <FormLabel isDarkMode={isDarkMode}>
                Count Type
              </FormLabel>
              <CustomDropdown
                value={dailyCount.count_type}
                onChange={(e) => setDailyCount({...dailyCount, count_type: e.target.value})}
                options={[
                  { value: 'drop', label: 'Drop' },
                  { value: 'opening', label: 'Opening' },
                  { value: 'closing', label: 'Closing' }
                ]}
                placeholder="Select count type"
                isDarkMode={isDarkMode}
                themeColorRgb={themeColorRgb}
                style={{ maxWidth: '200px' }}
              />
            </FormField>

            <FormField>
              <FormLabel isDarkMode={isDarkMode}>
                Date
              </FormLabel>
              <input
                type="date"
                value={dailyCount.count_date}
                onChange={(e) => setDailyCount({...dailyCount, count_date: e.target.value})}
                style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              />
            </FormField>

            <FormField>
              <FormLabel isDarkMode={isDarkMode}>
                Total Amount ($) - or count denominations below
              </FormLabel>
              <input
                type="number"
                step="0.01"
                min="0"
                value={dailyCount.total_amount}
                onChange={(e) => setDailyCount({...dailyCount, total_amount: parseFloat(e.target.value) || 0})}
                style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px' }}
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              />
            </FormField>

            <FormField>
              <FormLabel isDarkMode={isDarkMode}>
                Bill and Coin Counts
              </FormLabel>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px'
              }}>
                {Object.entries(dailyCount.denominations).map(([denom, count]) => (
                  <div key={denom}>
                    <label style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '14px',
                      color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666'
                    }}>
                      ${denom}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={count}
                      onChange={(e) => {
                        const newDenoms = {
                          ...dailyCount.denominations,
                          [denom]: parseInt(e.target.value) || 0
                        }
                        setDailyCount({
                          ...dailyCount,
                          denominations: newDenoms,
                          total_amount: calculateTotalFromDenominations(newDenoms)
                        })
                      }}
                      style={inputBaseStyle(isDarkMode, themeColorRgb)}
                      {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                    />
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                borderRadius: '6px'
              }}>
                <strong style={{ color: isDarkMode ? 'var(--text-primary, #fff)' : '#333' }}>
                  Calculated Total: ${calculateTotalFromDenominations(dailyCount.denominations).toFixed(2)}
                </strong>
              </div>
            </FormField>

            <FormField>
              <FormLabel isDarkMode={isDarkMode}>
                Notes (optional)
              </FormLabel>
              <textarea
                value={dailyCount.notes}
                onChange={(e) => setDailyCount({...dailyCount, notes: e.target.value})}
                style={{
                  ...inputBaseStyle(isDarkMode, themeColorRgb),
                  minHeight: '80px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                placeholder="Additional notes about this count..."
                {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              />
            </FormField>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                className="button-26 button-26--header"
                role="button"
                onClick={saveDailyCount}
                disabled={saving}
                style={{
                  opacity: saving ? 0.6 : 1,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                <div className="button-26__content">
                  <span className="button-26__text text">
                    {saving ? 'Saving...' : 'Save Daily Count'}
                  </span>
                </div>
              </button>
            </div>

            {/* Recent Counts */}
            {dailyCounts.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h4 style={{
                  marginBottom: '12px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                }}>
                  Recent Counts
                </h4>
                <div style={{
                  display: 'grid',
                  gap: '8px'
                }}>
                  {dailyCounts.slice(0, 5).map((count, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : '#f5f5f5',
                        borderRadius: '6px',
                        fontSize: '14px',
                        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span><strong>{count.count_type}</strong> - {count.count_date}</span>
                        <span>${parseFloat(count.total_amount || 0).toFixed(2)}</span>
                      </div>
                      {count.counted_by_name && (
                        <div style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666', marginTop: '4px' }}>
                          Counted by: {count.counted_by_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings

