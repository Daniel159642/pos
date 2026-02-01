import React, { useState, useEffect } from 'react'

function CalendarSubscriptionPage() {
  const [urls, setUrls] = useState(null)
  const [preferences, setPreferences] = useState({
    include_shifts: true,
    include_shipments: true,
    include_meetings: true,
    include_deadlines: true,
    calendar_name: 'My Work Schedule'
  })
  const [showInstructions, setShowInstructions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadSubscriptionUrls()
  }, [])

  const getSessionToken = () => {
    return localStorage.getItem('sessionToken')
  }

  const loadSubscriptionUrls = async () => {
    setLoadError(null)
    try {
      const token = getSessionToken()
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
      const response = await fetch('/api/calendar/subscription/urls', { headers })
      const result = response.ok ? await response.json().catch(() => null) : null

      if (result?.success && result?.data && (result.data.google_url || result.data.ical_url)) {
        setUrls(result.data)
        setLoading(false)
        return
      }
      // No URLs yet: create a subscription so we get links
      const createRes = await fetch('/api/calendar/subscription/create', {
        method: 'POST',
        headers,
        body: JSON.stringify(preferences)
      })
      let createResult = null
      try {
        createResult = await createRes.json()
      } catch (_) {
        createResult = null
      }
      if (createRes.ok && createResult?.success && createResult?.data) {
        setUrls(createResult.data)
      } else {
        setLoadError(createResult?.message || (createRes.ok ? 'No links returned' : `Request failed (${createRes.status})`))
      }
    } catch (err) {
      console.error('Error loading subscription URLs:', err)
      setLoadError(err?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const retryGenerateLinks = async () => {
    setLoadError(null)
    setGenerating(true)
    try {
      const token = getSessionToken()
      if (!token) {
        setLoadError('Not logged in. Please sign in and try again.')
        return
      }
      const res = await fetch('/api/calendar/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(preferences)
      })
      let data = null
      try {
        data = await res.json()
      } catch (_) {
        data = null
      }
      if (res.ok && data?.success && data?.data) {
        setUrls(data.data)
      } else {
        const errMsg = data?.message || `Request failed (${res.status})`
        setLoadError(errMsg)
      }
    } catch (e) {
      setLoadError(e?.message || 'Request failed')
    } finally {
      setGenerating(false)
    }
  }

  const updatePreferences = async () => {
    try {
      const token = getSessionToken()
      const response = await fetch('/api/calendar/subscription/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(preferences)
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setUrls(result.data)
          alert('Calendar subscription updated!')
        }
      }
    } catch (err) {
      console.error('Error updating preferences:', err)
      alert('Error updating preferences')
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        Loading calendar subscription...
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: 'calc(100vh - 200px)' }}>
      <h1 style={{ marginBottom: '8px' }}>📅 Calendar Subscription</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Subscribe to your work calendar and never miss a shift or shipment!
      </p>

      {/* Preferences */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px' }}>What to Include</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={preferences.include_shifts}
              onChange={(e) => setPreferences({
                ...preferences,
                include_shifts: e.target.checked
              })}
            />
            <span>My Shifts</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={preferences.include_shipments}
              onChange={(e) => setPreferences({
                ...preferences,
                include_shipments: e.target.checked
              })}
            />
            <span>Assigned Shipments</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={preferences.include_meetings}
              onChange={(e) => setPreferences({
                ...preferences,
                include_meetings: e.target.checked
              })}
            />
            <span>Meetings</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={preferences.include_deadlines}
              onChange={(e) => setPreferences({
                ...preferences,
                include_deadlines: e.target.checked
              })}
            />
            <span>Deadlines & Holidays</span>
          </label>
        </div>
        
        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
            Calendar Name:
          </label>
          <input
            type="text"
            value={preferences.calendar_name}
            onChange={(e) => setPreferences({
              ...preferences,
              calendar_name: e.target.value
            })}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
        </div>
        
        <button
          onClick={updatePreferences}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          Update Preferences
        </button>
      </div>

      {!urls && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          border: '1px solid #e0e0e0'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '8px' }}>Calendar links</h2>
          <p style={{ color: '#666', marginBottom: '16px' }}>
            {loadError ? `Could not load links: ${loadError}` : 'Generate your personal calendar link to add this calendar to Google, Apple, or Outlook.'}
          </p>
          <button
            type="button"
            onClick={retryGenerateLinks}
            disabled={generating}
            style={{
              padding: '10px 20px',
              backgroundColor: generating ? '#666' : '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: generating ? 'wait' : 'pointer',
              opacity: generating ? 0.9 : 1
            }}
          >
            {generating ? 'Generating…' : 'Generate calendar links'}
          </button>
        </div>
      )}

      {urls && (
        <>
          {/* Quick Subscribe Options */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Quick Subscribe</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                border: '1px solid #eee',
                borderRadius: '4px'
              }}>
                <div style={{ fontSize: '32px' }}>📅</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>Google Calendar</h3>
                  <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                    Add to your Google Calendar with one click
                  </p>
                </div>
                <a
                  href={urls.google_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4285f4',
                    color: '#fff',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  Add to Google Calendar
                </a>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                border: '1px solid #eee',
                borderRadius: '4px'
              }}>
                <div style={{ fontSize: '32px' }}>🍎</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>Apple Calendar (iPhone/Mac)</h3>
                  <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                    Subscribe on your Apple devices
                  </p>
                </div>
                <a
                  href={urls.webcal_url}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#000',
                    color: '#fff',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 500
                  }}
                >
                  Add to Apple Calendar
                </a>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                border: '1px solid #eee',
                borderRadius: '4px'
              }}>
                <div style={{ fontSize: '32px' }}>📧</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>Outlook Calendar</h3>
                  <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                    Add to Microsoft Outlook
                  </p>
                </div>
                <button
                  onClick={() => setShowInstructions('outlook')}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#0078d4',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Get Instructions
                </button>
              </div>
            </div>
          </div>

          {/* Manual Subscription URL */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Manual Subscription</h2>
            <p style={{ color: '#666', marginBottom: '12px' }}>
              Copy this URL to subscribe in any calendar app:
            </p>
            
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}>
              <code style={{
                flex: 1,
                fontSize: '12px',
                wordBreak: 'break-all',
                color: '#333'
              }}>
                {urls.ical_url}
              </code>
              <button
                onClick={() => copyToClipboard(urls.ical_url)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#f0f0f0',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  whiteSpace: 'nowrap'
                }}
              >
                📋 Copy
              </button>
            </div>
          </div>
        </>
      )}

      {/* Instructions Modal */}
      {showInstructions === 'outlook' && (
        <div
          style={{
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
          }}
          onClick={() => setShowInstructions(null)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>How to Subscribe in Outlook</h3>
            <ol style={{ lineHeight: '1.8' }}>
              <li>Open Outlook Calendar</li>
              <li>Click "Add Calendar" → "Subscribe from web"</li>
              <li>Paste this URL: <code style={{ backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '2px' }}>{urls?.ical_url}</code></li>
              <li>Click "Import"</li>
            </ol>
            <button
              onClick={() => setShowInstructions(null)}
              style={{
                marginTop: '16px',
                padding: '10px 20px',
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Feature Info */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Benefits</h2>
        <ul style={{ lineHeight: '1.8', color: '#666' }}>
          <li>✅ Automatic updates - changes sync automatically</li>
          <li>✅ Works on all your devices</li>
          <li>✅ Reminders and notifications</li>
          <li>✅ See your schedule alongside personal events</li>
          <li>✅ No manual entry needed</li>
        </ul>
      </div>
    </div>
  )
}

export default CalendarSubscriptionPage









