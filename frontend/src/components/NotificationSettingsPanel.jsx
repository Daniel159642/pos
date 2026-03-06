/**
 * NotificationSettingsPanel – simple, manager-friendly UI for configuring
 * Email, SMS, and In-app notifications. Used in Settings > Notifications tab.
 */
import { useState } from 'react'
import { Mail, MessageSquare, Bell, ChevronDown, ChevronRight } from 'lucide-react'
import { FormLabel, inputBaseStyle, compactPrimaryButtonStyle, compactCancelButtonStyle } from './FormStyles'
import { playNewOrderSound, NOTIFICATION_SOUND_OPTIONS } from '../utils/notificationSound'
import { cachedFetch } from '../services/offlineSync'

const CATEGORIES = [
  { id: 'orders', label: 'New orders', desc: 'DoorDash, Shopify, POS orders' },
  { id: 'reports', label: 'Reports', desc: 'Scheduled or manual reports' },
  { id: 'scheduling', label: 'Scheduling', desc: 'Schedule published or changed' },
  { id: 'clockins', label: 'Clock-in / out', desc: 'Employee clock events' },
  { id: 'receipts', label: 'Receipts', desc: 'Email receipts to customers' }
]

const IN_APP_OPTIONS = [
  { id: 'recent_new_order', label: 'New order popup', description: 'Show popup when a new integration order arrives', toastType: 'success', sampleMessage: 'Order #1234 from DoorDash' }
]

export default function NotificationSettingsPanel({
  isDarkMode,
  themeColorRgb,
  showToast,
  channelSettings,
  setChannelSettings,
  onSaveChannel,
  channelSaving,
  showTestEmailInput,
  setShowTestEmailInput,
  testEmailInput,
  setTestEmailInput,
  testEmailSending,
  setTestEmailSending,
  notificationSettings,
  persistNotificationSettings,
  newOrderToastOptions,
  persistNewOrderToastOptions
}) {
  const [emailSetupOpen, setEmailSetupOpen] = useState(false)
  const [smsSetupOpen, setSmsSetupOpen] = useState(false)

  const prefs = channelSettings?.notification_preferences || {}

  const handleTestEmail = async () => {
    const email = testEmailInput.trim()
    if (!email) return
    if (channelSettings.email_provider === 'gmail' && (!channelSettings.smtp_user || !channelSettings.smtp_password || channelSettings.smtp_password === '***')) {
      showToast('Enter Gmail address and App Password first', 'error')
      return
    }
    setTestEmailSending(true)
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await cachedFetch('/api/notifications/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token || '' },
        body: JSON.stringify({
          to_address: email,
          store_id: 1,
          session_token: token,
          email_provider: channelSettings.email_provider,
          smtp_server: channelSettings.smtp_server,
          smtp_port: channelSettings.smtp_port || 587,
          smtp_user: channelSettings.smtp_user,
          smtp_password: channelSettings.smtp_password && channelSettings.smtp_password !== '***' ? channelSettings.smtp_password : undefined,
          business_name: channelSettings.business_name || 'POS'
        })
      })
      const data = await res.json()
      showToast(data.success ? 'Test email sent!' : (data.message || 'Failed to send'), data.success ? 'success' : 'error')
      if (data.success) { setShowTestEmailInput(false); setTestEmailInput('') }
    } catch (e) {
      showToast(e?.message || 'Error sending test email', 'error')
    } finally {
      setTestEmailSending(false)
    }
  }

  const handleTestSms = async () => {
    const phone = window.prompt('Phone number (10 digits) for test SMS:')
    if (!phone) return
    try {
      const token = localStorage.getItem('sessionToken')
      const res = await cachedFetch('/api/notifications/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token || '' },
        body: JSON.stringify({ phone_number: phone.replace(/\D/g, '').slice(-10), store_id: 1, session_token: token })
      })
      const data = await res.json()
      showToast(data.success ? 'Test SMS sent!' : (data.message || 'Failed to send'), data.success ? 'success' : 'error')
    } catch (e) {
      showToast(e?.message || 'Error sending test SMS', 'error')
    }
  }

  const cardStyle = {
    padding: '20px',
    borderRadius: '12px',
    border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #e5e7eb',
    backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#fff',
    marginBottom: '20px'
  }

  const sectionTitle = (icon, title) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
      {icon}
      <span style={{ fontSize: '16px', fontWeight: 700, color: isDarkMode ? 'var(--text-primary)' : '#1f2937' }}>{title}</span>
    </div>
  )

  const toggle = (category, channel) => {
    const next = { ...channelSettings, notification_preferences: { ...prefs } }
    const cat = next.notification_preferences[category] || {}
    next.notification_preferences[category] = { ...cat, [channel]: !cat[channel] }
    setChannelSettings(next)
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', width: '100%' }}>
      <p style={{ fontSize: '14px', color: isDarkMode ? 'var(--text-secondary)' : '#6b7280', marginBottom: '24px' }}>
        Configure how your store gets notified: <strong>email</strong>, <strong>SMS</strong>, and <strong>in-app</strong> reminders. Turn on only what you need.
      </p>

      {/* ——— Email ——— */}
      <div style={cardStyle}>
        {sectionTitle(<Mail size={20} style={{ color: '#2563eb' }} />, 'Email notifications')}
        <p style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#6b7280', marginBottom: '16px' }}>
          Send order alerts, reports, and receipts by email. Use Gmail for testing, then switch to AWS SES for production.
        </p>

        <button
          type="button"
          onClick={() => setEmailSetupOpen(!emailSetupOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 0',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: isDarkMode ? 'var(--text-secondary)' : '#4b5563',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          {emailSetupOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Email setup (Gmail or AWS SES)
        </button>

        {emailSetupOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', paddingTop: '8px' }}>
            <div>
              <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Provider</FormLabel>
              <select
                value={channelSettings.email_provider}
                onChange={(e) => setChannelSettings({ ...channelSettings, email_provider: e.target.value })}
                style={inputBaseStyle(isDarkMode, themeColorRgb)}
              >
                <option value="gmail">Gmail (testing)</option>
                <option value="aws_ses">AWS SES (production)</option>
              </select>
            </div>
            {channelSettings.email_provider === 'gmail' && (
              <>
                <div>
                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>Gmail address</FormLabel>
                  <input
                    type="email"
                    value={channelSettings.smtp_user || ''}
                    onChange={(e) => setChannelSettings({ ...channelSettings, smtp_user: e.target.value })}
                    placeholder="your@gmail.com"
                    style={inputBaseStyle(isDarkMode, themeColorRgb)}
                  />
                  <p style={{ fontSize: '11px', color: isDarkMode ? 'var(--text-tertiary)' : '#9ca3af', marginTop: '4px' }}>Enable 2FA and create an App Password at Google Account → Security</p>
                </div>
                <div>
                  <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>App password</FormLabel>
                  <input
                    type="password"
                    value={channelSettings.smtp_password === '***' ? '' : (channelSettings.smtp_password || '')}
                    onChange={(e) => setChannelSettings({ ...channelSettings, smtp_password: e.target.value })}
                    placeholder={channelSettings.smtp_password === '***' ? 'Leave blank to keep current' : '16-character app password'}
                    style={inputBaseStyle(isDarkMode, themeColorRgb)}
                  />
                </div>
              </>
            )}
            {channelSettings.email_provider === 'aws_ses' && (
              <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary)' : '#9ca3af' }}>AWS credentials are entered in the SMS section below (same keys work for SES).</p>
            )}
          </div>
        )}

        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '10px', display: 'block' }}>Send email for</FormLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {CATEGORIES.map(({ id, label, desc }) => (
            <label key={id} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={!!prefs[id]?.email}
                onChange={() => toggle(id, 'email')}
                style={{ accentColor: themeColorRgb, width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary)' : '#374151' }}>{label}</span>
              <span style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary)' : '#9ca3af' }}>— {desc}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px', alignItems: 'center' }}>
          <button type="button" disabled={channelSaving} onClick={onSaveChannel} style={compactPrimaryButtonStyle(themeColorRgb, channelSaving)}>
            {channelSaving ? 'Saving…' : 'Save email & SMS settings'}
          </button>
          {showTestEmailInput ? (
            <>
              <input
                type="email"
                placeholder="Email to send test to"
                value={testEmailInput}
                onChange={(e) => setTestEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTestEmail(); if (e.key === 'Escape') setShowTestEmailInput(false) }}
                autoFocus
                style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '200px', padding: '6px 10px' }}
              />
              <button type="button" disabled={testEmailSending || !testEmailInput.trim()} onClick={handleTestEmail} style={compactPrimaryButtonStyle(themeColorRgb, testEmailSending)}>Send</button>
              <button type="button" onClick={() => { setShowTestEmailInput(false); setTestEmailInput('') }} style={compactCancelButtonStyle(isDarkMode)}>Cancel</button>
            </>
          ) : (
            <button type="button" onClick={() => setShowTestEmailInput(true)} style={compactCancelButtonStyle(isDarkMode)}>Test email</button>
          )}
        </div>
      </div>

      {/* ——— SMS ——— */}
      <div style={cardStyle}>
        {sectionTitle(<MessageSquare size={20} style={{ color: '#059669' }} />, 'SMS notifications')}
        <p style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#6b7280', marginBottom: '16px' }}>
          Send text alerts via AWS SNS (~$0.006/SMS). Same AWS credentials as production email.
        </p>

        <button
          type="button"
          onClick={() => setSmsSetupOpen(!smsSetupOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 0',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: isDarkMode ? 'var(--text-secondary)' : '#4b5563',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          {smsSetupOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          AWS credentials (SNS + SES)
        </button>

        {smsSetupOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', paddingTop: '8px' }}>
            <div>
              <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>AWS Access Key ID</FormLabel>
              <input
                type="text"
                value={channelSettings.aws_access_key_id === '***' ? '' : (channelSettings.aws_access_key_id || '')}
                onChange={(e) => setChannelSettings({ ...channelSettings, aws_access_key_id: e.target.value })}
                placeholder={channelSettings.aws_access_key_id === '***' ? 'Leave blank to keep current' : 'AKIA...'}
                style={inputBaseStyle(isDarkMode, themeColorRgb)}
              />
            </div>
            <div>
              <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>AWS Secret Access Key</FormLabel>
              <input
                type="password"
                value={channelSettings.aws_secret_access_key === '***' ? '' : (channelSettings.aws_secret_access_key || '')}
                onChange={(e) => setChannelSettings({ ...channelSettings, aws_secret_access_key: e.target.value })}
                placeholder={channelSettings.aws_secret_access_key === '***' ? 'Leave blank to keep current' : 'Secret key'}
                style={inputBaseStyle(isDarkMode, themeColorRgb)}
              />
            </div>
            <div>
              <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '6px' }}>AWS Region</FormLabel>
              <input
                type="text"
                value={channelSettings.aws_region || 'us-east-1'}
                onChange={(e) => setChannelSettings({ ...channelSettings, aws_region: e.target.value })}
                placeholder="us-east-1"
                style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '140px' }}
              />
            </div>
          </div>
        )}

        <FormLabel isDarkMode={isDarkMode} style={{ marginBottom: '10px', display: 'block' }}>Send SMS for</FormLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {CATEGORIES.filter(c => c.id !== 'receipts').map(({ id, label, desc }) => (
            <label key={id} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={!!prefs[id]?.sms}
                onChange={() => toggle(id, 'sms')}
                style={{ accentColor: themeColorRgb, width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '14px', fontWeight: 500, color: isDarkMode ? 'var(--text-primary)' : '#374151' }}>{label}</span>
              <span style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary)' : '#9ca3af' }}>— {desc}</span>
            </label>
          ))}
        </div>

        <div style={{ marginTop: '16px' }}>
          <button type="button" onClick={handleTestSms} style={compactCancelButtonStyle(isDarkMode)}>Test SMS</button>
        </div>
      </div>

      {/* ——— In-app ——— */}
      <div style={cardStyle}>
        {sectionTitle(<Bell size={20} style={{ color: isDarkMode ? 'var(--text-secondary)' : '#6b7280' }} />, 'In-app reminders & notifications')}
        <p style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#6b7280', marginBottom: '16px' }}>
          Popups and the notification bell in the app header. No email or SMS—just alerts inside the app.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {IN_APP_OPTIONS.map((opt) => (
            <div
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                padding: '14px 16px',
                borderRadius: '10px',
                border: isDarkMode ? '1px solid var(--border-light)' : '1px solid #e5e7eb',
                backgroundColor: isDarkMode ? 'var(--bg-tertiary)' : '#f9fafb'
              }}
            >
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary)' : '#111', marginBottom: '2px' }}>{opt.label}</div>
                <div style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-secondary)' : '#6b7280' }}>{opt.description}</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={notificationSettings[opt.id] !== false}
                  onChange={(e) => persistNotificationSettings({ ...notificationSettings, [opt.id]: e.target.checked })}
                  style={{ accentColor: themeColorRgb, width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#374151' }}>{notificationSettings[opt.id] !== false ? 'On' : 'Off'}</span>
              </label>
              {opt.id === 'recent_new_order' && notificationSettings.recent_new_order !== false && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px', paddingTop: '12px', borderTop: isDarkMode ? '1px solid var(--border-light)' : '1px solid #e5e7eb' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={newOrderToastOptions.play_sound}
                      onChange={(e) => persistNewOrderToastOptions({ ...newOrderToastOptions, play_sound: e.target.checked })}
                      style={{ accentColor: themeColorRgb, width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '13px', color: isDarkMode ? 'var(--text-primary)' : '#374151' }}>Play sound when a new order arrives</span>
                  </label>
                  {newOrderToastOptions.play_sound && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                      <select
                        value={newOrderToastOptions.sound_type ?? 'default'}
                        onChange={(e) => persistNewOrderToastOptions({ ...newOrderToastOptions, sound_type: e.target.value })}
                        style={{ ...inputBaseStyle(isDarkMode, themeColorRgb), maxWidth: '160px', padding: '6px 10px' }}
                      >
                        {NOTIFICATION_SOUND_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDarkMode ? 'var(--text-secondary)' : '#6b7280' }}>
                        Volume
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={newOrderToastOptions.volume ?? 0.5}
                          onChange={(e) => persistNewOrderToastOptions({ ...newOrderToastOptions, volume: parseFloat(e.target.value) })}
                          style={{ width: '80px', accentColor: themeColorRgb }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (opt.id === 'recent_new_order' && newOrderToastOptions.play_sound && newOrderToastOptions.sound_type !== 'none') {
                    playNewOrderSound({ sound_type: newOrderToastOptions.sound_type ?? 'default', volume: newOrderToastOptions.volume ?? 0.5 })
                  }
                  showToast(opt.sampleMessage, opt.toastType)
                }}
                style={compactCancelButtonStyle(isDarkMode)}
              >
                Test
              </button>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '12px', color: isDarkMode ? 'var(--text-tertiary)' : '#9ca3af', marginTop: '12px' }}>In-app settings are saved automatically.</p>
      </div>
    </div>
  )
}
