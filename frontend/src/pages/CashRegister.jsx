import { useState, useEffect } from 'react'
import { usePermissions } from '../contexts/PermissionContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'

function CashRegister() {
  const { hasPermission } = usePermissions()
  const { themeColor } = useTheme()
  const { show: showToast } = useToast()
  const [sessionToken, setSessionToken] = useState(localStorage.getItem('sessionToken'))
  const [currentSession, setCurrentSession] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [showBaseCashModal, setShowBaseCashModal] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessionSummary, setSessionSummary] = useState(null)
  
  // Form states
  const [startingCash, setStartingCash] = useState('0.00')
  const [endingCash, setEndingCash] = useState('')
  const [transactionType, setTransactionType] = useState('cash_in')
  const [transactionAmount, setTransactionAmount] = useState('')
  const [transactionReason, setTransactionReason] = useState('')
  const [baseCashAmount, setBaseCashAmount] = useState('')
  const [registerId, setRegisterId] = useState(1)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadCurrentSession()
    loadRecentSessions()
  }, [])

  const loadCurrentSession = async () => {
    try {
      const response = await fetch(`/api/register/session?status=open&session_token=${sessionToken}`)
      const data = await response.json()
      if (data.success && data.data && data.data.length > 0) {
        setCurrentSession(data.data[0])
      } else {
        setCurrentSession(null)
      }
    } catch (error) {
      console.error('Error loading current session:', error)
    }
  }

  const loadRecentSessions = async () => {
    try {
      const response = await fetch(`/api/register/session?session_token=${sessionToken}`)
      const data = await response.json()
      if (data.success && data.data) {
        setSessions(data.data.slice(0, 10)) // Show last 10 sessions
      }
    } catch (error) {
      console.error('Error loading sessions:', error)
    }
  }

  const handleOpenRegister = async () => {
    if (!startingCash || parseFloat(startingCash) < 0) {
      showToast('Please enter a valid starting cash amount', 'error')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/register/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          register_id: registerId,
          starting_cash: parseFloat(startingCash),
          notes: notes
        })
      })

      const data = await response.json()
      if (data.success) {
        showToast(data.message, 'success')
        setShowOpenModal(false)
        setStartingCash('0.00')
        setNotes('')
        loadCurrentSession()
        loadRecentSessions()
      } else {
        showToast(data.message, 'error')
      }
    } catch (error) {
      showToast('Failed to open register', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseRegister = async () => {
    if (!endingCash || parseFloat(endingCash) < 0) {
      showToast('Please enter a valid ending cash amount', 'error')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/register/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          session_id: currentSession.session_id,
          ending_cash: parseFloat(endingCash),
          notes: notes
        })
      })

      const data = await response.json()
      if (data.success) {
        showToast(`Register closed. Discrepancy: $${data.discrepancy.toFixed(2)}`, 'success')
        setShowCloseModal(false)
        setEndingCash('')
        setNotes('')
        loadCurrentSession()
        loadRecentSessions()
      } else {
        showToast(data.message, 'error')
      }
    } catch (error) {
      showToast('Failed to close register', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddTransaction = async () => {
    if (!transactionAmount || parseFloat(transactionAmount) <= 0) {
      showToast('Please enter a valid transaction amount', 'error')
      return
    }

    if (!currentSession) {
      showToast('No open register session', 'error')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/register/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          session_id: currentSession.session_id,
          transaction_type: transactionType,
          amount: parseFloat(transactionAmount),
          reason: transactionReason,
          notes: notes
        })
      })

      const data = await response.json()
      if (data.success) {
        showToast('Transaction recorded successfully', 'success')
        setShowTransactionModal(false)
        setTransactionAmount('')
        setTransactionReason('')
        setNotes('')
        loadCurrentSession()
      } else {
        showToast(data.message, 'error')
      }
    } catch (error) {
      showToast('Failed to record transaction', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddBaseCash = async () => {
    if (!baseCashAmount || parseFloat(baseCashAmount) <= 0) {
      showToast('Please enter a valid base cash amount', 'error')
      return
    }

    if (!currentSession) {
      showToast('No open register session', 'error')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/register/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          session_id: currentSession.session_id,
          transaction_type: 'cash_in',
          amount: parseFloat(baseCashAmount),
          reason: 'Base cash added',
          notes: notes || 'Base cash added to register drawer'
        })
      })

      const data = await response.json()
      if (data.success) {
        showToast(`Base cash of ${formatCurrency(parseFloat(baseCashAmount))} added successfully`, 'success')
        setShowBaseCashModal(false)
        setBaseCashAmount('')
        setNotes('')
        loadCurrentSession()
      } else {
        showToast(data.message, 'error')
      }
    } catch (error) {
      showToast('Failed to add base cash', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleViewSummary = async (session) => {
    setSelectedSession(session)
    setLoading(true)

    try {
      const response = await fetch(`/api/register/summary?session_id=${session.session_id}&session_token=${sessionToken}`)
      const data = await response.json()
      if (data.success) {
        setSessionSummary(data)
        setShowSummaryModal(true)
      } else {
        showToast(data.message, 'error')
      }
    } catch (error) {
      showToast('Failed to load summary', 'error')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString()
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', color: themeColor }}>Cash Register Control</h1>

      {/* Current Session Card */}
      <div style={{
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '20px'
      }}>
        <h2 style={{ marginTop: 0, color: themeColor }}>Current Register Session</h2>
        
        {currentSession ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div>
                <strong>Register ID:</strong> {currentSession.register_id}
              </div>
              <div>
                <strong>Opened:</strong> {formatDate(currentSession.opened_at)}
              </div>
              <div>
                <strong>Opened By:</strong> {currentSession.opened_by_name}
              </div>
              <div>
                <strong>Starting Cash:</strong> {formatCurrency(currentSession.starting_cash)}
              </div>
              <div>
                <strong>Amount in Drawer:</strong> {formatCurrency(currentSession.expected_cash ?? currentSession.starting_cash)}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowBaseCashModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Base Cash
              </button>
              <button
                onClick={() => setShowTransactionModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: themeColor,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Cash Transaction
              </button>
              <button
                onClick={() => setShowCloseModal(true)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close Register
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p>No open register session</p>
            <button
              onClick={() => setShowOpenModal(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: themeColor,
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Open Register
            </button>
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div style={{
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginTop: 0, color: themeColor }}>Recent Sessions</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>Register</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Opened</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Closed</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Starting Cash</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Ending Cash</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Discrepancy</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(session => (
              <tr key={session.session_id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '10px' }}>{session.register_id}</td>
                <td style={{ padding: '10px' }}>{formatDate(session.opened_at)}</td>
                <td style={{ padding: '10px' }}>{formatDate(session.closed_at)}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>{formatCurrency(session.starting_cash)}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>{formatCurrency(session.ending_cash)}</td>
                <td style={{ 
                  padding: '10px', 
                  textAlign: 'right',
                  color: session.discrepancy > 0 ? '#28a745' : session.discrepancy < 0 ? '#dc3545' : '#000'
                }}>
                  {formatCurrency(session.discrepancy)}
                </td>
                <td style={{ padding: '10px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: session.status === 'open' ? '#17a2b8' : 
                                   session.status === 'closed' ? '#ffc107' : '#28a745',
                    color: 'white',
                    fontSize: '12px'
                  }}>
                    {session.status}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>
                  <button
                    onClick={() => handleViewSummary(session)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: themeColor,
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    View Summary
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Open Register Modal */}
      {showOpenModal && (
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
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{ marginTop: 0 }}>Open Cash Register</h2>
            <div style={{ marginBottom: '15px' }}>
              <label>Register ID:</label>
              <input
                type="number"
                value={registerId}
                onChange={(e) => setRegisterId(parseInt(e.target.value) || 1)}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>Starting Cash:</label>
              <input
                type="number"
                step="0.01"
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="0.00"
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>Notes (optional):</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '60px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowOpenModal(false)
                  setStartingCash('0.00')
                  setNotes('')
                }}
                style={{ padding: '10px 20px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleOpenRegister}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: themeColor,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Opening...' : 'Open Register'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Register Modal */}
      {showCloseModal && (
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
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{ marginTop: 0 }}>Close Cash Register</h2>
            {currentSession && (
              <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <div><strong>Starting Cash:</strong> {formatCurrency(currentSession.starting_cash)}</div>
                <div><strong>Expected Cash:</strong> {formatCurrency(currentSession.expected_cash || currentSession.starting_cash)}</div>
              </div>
            )}
            <div style={{ marginBottom: '15px' }}>
              <label>Ending Cash (actual count):</label>
              <input
                type="number"
                step="0.01"
                value={endingCash}
                onChange={(e) => setEndingCash(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="0.00"
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>Notes (optional):</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '60px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCloseModal(false)
                  setEndingCash('')
                  setNotes('')
                }}
                style={{ padding: '10px 20px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCloseRegister}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Closing...' : 'Close Register'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
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
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{ marginTop: 0 }}>Add Cash Transaction</h2>
            <div style={{ marginBottom: '15px' }}>
              <label>Transaction Type:</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              >
                <option value="cash_in">Cash In</option>
                <option value="cash_out">Cash Out</option>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>Amount:</label>
              <input
                type="number"
                step="0.01"
                value={transactionAmount}
                onChange={(e) => setTransactionAmount(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="0.00"
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>Reason:</label>
              <input
                type="text"
                value={transactionReason}
                onChange={(e) => setTransactionReason(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="e.g., Petty cash, Bank deposit"
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>Notes (optional):</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '60px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowTransactionModal(false)
                  setTransactionAmount('')
                  setTransactionReason('')
                  setNotes('')
                }}
                style={{ padding: '10px 20px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddTransaction}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: themeColor,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Adding...' : 'Add Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Base Cash Modal */}
      {showBaseCashModal && (
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
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{ marginTop: 0 }}>Add Base Cash</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Add base cash to the register drawer. This will be recorded as a cash-in transaction.
            </p>
            {currentSession && (
              <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <div><strong>Current Starting Cash:</strong> {formatCurrency(currentSession.starting_cash)}</div>
              </div>
            )}
            <div style={{ marginBottom: '15px' }}>
              <label>Base Cash Amount:</label>
              <input
                type="number"
                step="0.01"
                value={baseCashAmount}
                onChange={(e) => setBaseCashAmount(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>Notes (optional):</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '60px' }}
                placeholder="e.g., Added base cash for shift"
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowBaseCashModal(false)
                  setBaseCashAmount('')
                  setNotes('')
                }}
                style={{ padding: '10px 20px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddBaseCash}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Adding...' : 'Add Base Cash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {showSummaryModal && sessionSummary && (
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
          zIndex: 1000,
          overflow: 'auto',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0 }}>Register Session Summary</h2>
            
            {sessionSummary.session && (
              <div style={{ marginBottom: '20px' }}>
                <h3>Session Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <div><strong>Register ID:</strong> {sessionSummary.session.register_id}</div>
                  <div><strong>Status:</strong> {sessionSummary.session.status}</div>
                  <div><strong>Opened:</strong> {formatDate(sessionSummary.session.opened_at)}</div>
                  <div><strong>Closed:</strong> {formatDate(sessionSummary.session.closed_at)}</div>
                  <div><strong>Starting Cash:</strong> {formatCurrency(sessionSummary.session.starting_cash)}</div>
                  <div><strong>Ending Cash:</strong> {formatCurrency(sessionSummary.session.ending_cash)}</div>
                  <div><strong>Expected Cash:</strong> {formatCurrency(sessionSummary.session.expected_cash)}</div>
                  <div><strong>Discrepancy:</strong> 
                    <span style={{ 
                      color: sessionSummary.session.discrepancy > 0 ? '#28a745' : 
                             sessionSummary.session.discrepancy < 0 ? '#dc3545' : '#000'
                    }}>
                      {formatCurrency(sessionSummary.session.discrepancy)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {sessionSummary.sales && (
              <div style={{ marginBottom: '20px' }}>
                <h3>Sales Summary</h3>
                <div>
                  <div><strong>Total Transactions:</strong> {sessionSummary.sales.transaction_count}</div>
                  <div><strong>Total Sales:</strong> {formatCurrency(sessionSummary.sales.total_sales)}</div>
                  <div><strong>Voided Amount:</strong> {formatCurrency(sessionSummary.sales.voided_amount)}</div>
                </div>
              </div>
            )}

            {sessionSummary.transactions && sessionSummary.transactions.length > 0 && (
              <div>
                <h3>Cash Transactions</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Reason</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Employee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionSummary.transactions.map(trans => (
                      <tr key={trans.transaction_id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '10px' }}>{formatDate(trans.transaction_date)}</td>
                        <td style={{ padding: '10px' }}>{trans.transaction_type}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>{formatCurrency(trans.amount)}</td>
                        <td style={{ padding: '10px' }}>{trans.reason || 'N/A'}</td>
                        <td style={{ padding: '10px' }}>{trans.employee_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowSummaryModal(false)
                  setSessionSummary(null)
                  setSelectedSession(null)
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: themeColor,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CashRegister
