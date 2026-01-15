import { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'

function Settings() {
  const { themeMode, themeColor } = useTheme()
  const [workflowSettings, setWorkflowSettings] = useState({
    workflow_mode: 'simple',
    auto_add_to_inventory: 'true'
  })
  const [receiptSettings, setReceiptSettings] = useState({
    store_name: 'Store',
    store_address: '',
    store_city: '',
    store_state: '',
    store_zip: '',
    store_phone: '',
    store_email: '',
    store_website: '',
    footer_message: 'Thank you for your business!',
    show_tax_breakdown: true,
    show_payment_method: true
  })
  const [activeTab, setActiveTab] = useState('workflow') // 'workflow' or 'receipt'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

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
  }, [])

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
          show_tax_breakdown: data.settings.show_tax_breakdown === 1,
          show_payment_method: data.settings.show_payment_method === 1
        })
      }
    } catch (error) {
      console.error('Error loading receipt settings:', error)
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
          show_tax_breakdown: receiptSettings.show_tax_breakdown ? 1 : 0,
          show_payment_method: receiptSettings.show_payment_method ? 1 : 0
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

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ 
        marginBottom: '24px', 
        color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
        fontSize: '28px',
        fontWeight: 600
      }}>
        Settings
      </h1>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: `2px solid ${isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0'}`
      }}>
        <button
          onClick={() => setActiveTab('workflow')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'workflow' ? `3px solid rgba(${themeColorRgb}, 0.7)` : '3px solid transparent',
            color: activeTab === 'workflow' 
              ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333')
              : (isDarkMode ? 'var(--text-tertiary, #999)' : '#666'),
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'workflow' ? 600 : 400,
            transition: 'all 0.2s ease'
          }}
        >
          Shipment Verification
        </button>
        <button
          onClick={() => setActiveTab('receipt')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'receipt' ? `3px solid rgba(${themeColorRgb}, 0.7)` : '3px solid transparent',
            color: activeTab === 'receipt' 
              ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333')
              : (isDarkMode ? 'var(--text-tertiary, #999)' : '#666'),
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: activeTab === 'receipt' ? 600 : 400,
            transition: 'all 0.2s ease'
          }}
        >
          Receipt Settings
        </button>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '20px',
          borderRadius: '8px',
          backgroundColor: message.type === 'success' 
            ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#e8f5e9')
            : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#ffebee'),
          color: message.type === 'success' ? '#4caf50' : '#f44336',
          border: `1px solid ${message.type === 'success' ? '#4caf50' : '#f44336'}`
        }}>
          {message.text}
        </div>
      )}

      {activeTab === 'workflow' && (
      <div style={{
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Workflow Mode Setting */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{
            marginBottom: '12px',
            fontSize: '18px',
            fontWeight: 600,
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
          }}>
            Workflow Mode
          </h2>
          <p style={{
            marginBottom: '16px',
            fontSize: '14px',
            color: isDarkMode ? 'var(--text-tertiary, #999)' : '#666'
          }}>
            Choose how shipment verification works:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{
              marginBottom: '12px',
              fontSize: '18px',
              fontWeight: 600,
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
            onClick={activeTab === 'workflow' ? saveSettings : saveReceiptSettings}
            disabled={saving}
            style={{
              padding: '12px 24px',
              backgroundColor: saving ? (isDarkMode ? '#3a3a3a' : '#ccc') : `rgba(${themeColorRgb}, 0.7)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              boxShadow: saving ? 'none' : `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
              transition: 'all 0.3s ease',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
      )}

      {/* Receipt Settings Tab */}
      {activeTab === 'receipt' && (
        <div style={{
          backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            marginBottom: '24px',
            fontSize: '20px',
            fontWeight: 600,
            color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
          }}>
            Receipt Customization
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Store Information */}
            <div>
              <h3 style={{
                marginBottom: '12px',
                fontSize: '16px',
                fontWeight: 600,
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>
                Store Information
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Store Name"
                  value={receiptSettings.store_name}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, store_name: e.target.value })}
                  style={{
                    padding: '10px',
                    border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                    borderRadius: '6px',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    fontSize: '14px'
                  }}
                />
                <input
                  type="text"
                  placeholder="Street Address"
                  value={receiptSettings.store_address}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, store_address: e.target.value })}
                  style={{
                    padding: '10px',
                    border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                    borderRadius: '6px',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    fontSize: '14px'
                  }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                  <input
                    type="text"
                    placeholder="City"
                    value={receiptSettings.store_city}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, store_city: e.target.value })}
                    style={{
                      padding: '10px',
                      border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                      borderRadius: '6px',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      fontSize: '14px'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={receiptSettings.store_state}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, store_state: e.target.value })}
                    style={{
                      padding: '10px',
                      border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                      borderRadius: '6px',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      fontSize: '14px'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="ZIP"
                    value={receiptSettings.store_zip}
                    onChange={(e) => setReceiptSettings({ ...receiptSettings, store_zip: e.target.value })}
                    style={{
                      padding: '10px',
                      border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                      borderRadius: '6px',
                      backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Phone"
                  value={receiptSettings.store_phone}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, store_phone: e.target.value })}
                  style={{
                    padding: '10px',
                    border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                    borderRadius: '6px',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    fontSize: '14px'
                  }}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={receiptSettings.store_email}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, store_email: e.target.value })}
                  style={{
                    padding: '10px',
                    border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                    borderRadius: '6px',
                    backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    fontSize: '14px'
                  }}
                />
                <input
                  type="text"
                  placeholder="Website"
                  value={receiptSettings.store_website}
                  onChange={(e) => setReceiptSettings({ ...receiptSettings, store_website: e.target.value })}
                  style={{
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

            {/* Footer Message */}
            <div>
              <h3 style={{
                marginBottom: '12px',
                fontSize: '16px',
                fontWeight: 600,
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>
                Footer Message
              </h3>
              <textarea
                placeholder="Thank you for your business!"
                value={receiptSettings.footer_message}
                onChange={(e) => setReceiptSettings({ ...receiptSettings, footer_message: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#ddd'}`,
                  borderRadius: '6px',
                  backgroundColor: isDarkMode ? 'var(--bg-secondary, #2a2a2a)' : 'white',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Display Options */}
            <div>
              <h3 style={{
                marginBottom: '12px',
                fontSize: '16px',
                fontWeight: 600,
                color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
              }}>
                Display Options
              </h3>
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings

