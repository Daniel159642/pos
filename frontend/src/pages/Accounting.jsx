import { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import accountService from '../services/accountService'
import AccountTable from '../components/accounts/AccountTable'
import AccountForm from '../components/accounts/AccountForm'
import AccountFilters from '../components/accounts/AccountFilters'
import Modal from '../components/common/Modal'
import Button from '../components/common/Button'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Alert from '../components/common/Alert'

function Accounting() {
  const { themeMode, themeColor } = useTheme()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dateRange, setDateRange] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })

  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const backgroundColor = isDarkMode ? '#1a1a1a' : '#f5f5f5'
  const cardBackgroundColor = isDarkMode ? '#2a2a2a' : 'white'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const boxShadow = isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'

  const getAuthHeaders = () => {
    const token = localStorage.getItem('sessionToken')
    return {
      'X-Session-Token': token || '',
      'Authorization': `Bearer ${token || ''}`,
      'Content-Type': 'application/json'
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  return (
    <div style={{ 
      padding: '32px 24px', 
      backgroundColor: backgroundColor, 
      minHeight: 'calc(100vh - 200px)',
      maxWidth: '1400px',
      margin: '0 auto',
      transition: 'background-color 0.3s ease'
    }}>
      <div style={{
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '28px',
        backgroundColor: cardBackgroundColor,
        boxShadow: boxShadow,
        transition: 'background-color 0.3s ease, border-color 0.3s ease'
      }}>
        <h1 style={{ 
          margin: '0 0 24px 0', 
          fontSize: '28px', 
          fontWeight: 600,
          color: textColor,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
        }}>
          Accounting System
        </h1>

        {/* Date Range Selector */}
        <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ color: textColor, fontWeight: 500 }}>Date Range:</label>
          <input
            type="date"
            value={dateRange.start_date}
            onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
            style={{
              padding: '8px 12px',
              border: `1px solid ${borderColor}`,
              borderRadius: '6px',
              backgroundColor: isDarkMode ? '#1a1a1a' : 'white',
              color: textColor,
              fontSize: '14px'
            }}
          />
          <span style={{ color: textColor }}>to</span>
          <input
            type="date"
            value={dateRange.end_date}
            onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
            style={{
              padding: '8px 12px',
              border: `1px solid ${borderColor}`,
              borderRadius: '6px',
              backgroundColor: isDarkMode ? '#1a1a1a' : 'white',
              color: textColor,
              fontSize: '14px'
            }}
          />
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '24px',
          borderBottom: `1px solid ${borderColor}`,
          paddingBottom: '12px',
          flexWrap: 'wrap'
        }}>
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'chart-of-accounts', label: 'Chart of Accounts' },
            { id: 'transactions', label: 'Transactions' },
            { id: 'invoices', label: 'Invoices' },
            { id: 'bills', label: 'Bills' },
            { id: 'customers', label: 'Customers' },
            { id: 'vendors', label: 'Vendors' },
            { id: 'reports', label: 'Reports' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: activeTab === tab.id ? themeColor : 'transparent',
                color: activeTab === tab.id ? 'white' : textColor,
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 600 : 400,
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div style={{
            padding: '16px',
            marginBottom: '20px',
            backgroundColor: isDarkMode ? '#4a1a1a' : '#fee',
            border: `1px solid ${isDarkMode ? '#6a2a2a' : '#fcc'}`,
            borderRadius: '8px',
            color: isDarkMode ? '#ff6b6b' : '#c33'
          }}>
            Error: {error}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'dashboard' && <DashboardTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
        {activeTab === 'chart-of-accounts' && <ChartOfAccountsTab formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
        {activeTab === 'transactions' && <TransactionsTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
        {activeTab === 'invoices' && <InvoicesTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
        {activeTab === 'bills' && <BillsTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
        {activeTab === 'customers' && <CustomersTab formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
        {activeTab === 'vendors' && <VendorsTab formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
        {activeTab === 'reports' && <ReportsTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
      </div>
    </div>
  )
}

// Dashboard Tab
function DashboardTab({ dateRange, formatCurrency, getAuthHeaders }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const cardBg = isDarkMode ? '#1f1f1f' : '#f9f9f9'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  useEffect(() => {
    loadDashboard()
  }, [dateRange])

  const loadDashboard = async () => {
    try {
      setLoading(true)
      // Call new accounting API endpoints
      const [trialBalance, pnl] = await Promise.all([
        fetch(`/api/accounting/trial-balance?as_of_date=${dateRange.end_date}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null),
        fetch(`/api/accounting/profit-loss?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null)
      ])
      
      setData({ trialBalance, pnl })
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ color: textColor, padding: '40px', textAlign: 'center' }}>Loading dashboard...</div>
  }

  const totalDebits = data?.trialBalance?.reduce((sum, row) => sum + (parseFloat(row.debit_balance) || 0), 0) || 0
  const totalCredits = data?.trialBalance?.reduce((sum, row) => sum + (parseFloat(row.credit_balance) || 0), 0) || 0
  const netIncome = data?.pnl?.reduce((sum, row) => {
    const amount = parseFloat(row.amount) || 0
    return sum + (row.account_type === 'Revenue' || row.account_type === 'Other Income' ? amount : -amount)
  }, 0) || 0

  return (
    <div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '16px',
        marginBottom: '24px'
      }}>
        <MetricCard 
          title="Total Debits" 
          value={formatCurrency(totalDebits)}
          color="#10b981"
          cardBackgroundColor={cardBg}
          borderColor={borderColor}
          textColor={textColor}
        />
        <MetricCard 
          title="Total Credits" 
          value={formatCurrency(totalCredits)}
          color="#3b82f6"
          cardBackgroundColor={cardBg}
          borderColor={borderColor}
          textColor={textColor}
        />
        <MetricCard 
          title="Net Income" 
          value={formatCurrency(netIncome)}
          color={netIncome >= 0 ? "#10b981" : "#ef4444"}
          cardBackgroundColor={cardBg}
          borderColor={borderColor}
          textColor={textColor}
        />
        <MetricCard 
          title="Balance Check" 
          value={Math.abs(totalDebits - totalCredits) < 0.01 ? "✓ Balanced" : "⚠ Unbalanced"}
          color={Math.abs(totalDebits - totalCredits) < 0.01 ? "#10b981" : "#ef4444"}
          cardBackgroundColor={cardBg}
          borderColor={borderColor}
          textColor={textColor}
        />
      </div>
      
      <div style={{ 
        padding: '20px',
        backgroundColor: cardBg,
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        marginTop: '24px'
      }}>
        <h3 style={{ color: textColor, marginBottom: '16px' }}>Quick Links</h3>
        <p style={{ color: textColor, opacity: 0.8, fontSize: '14px', lineHeight: '1.8' }}>
          Welcome to the Accounting System! This system uses double-entry bookkeeping principles.
          <br /><br />
          <strong>Key Features:</strong>
          <br />• Chart of Accounts with hierarchical structure
          <br />• Journal Entries with automatic balance validation
          <br />• Invoice and Bill management
          <br />• Customer and Vendor tracking
          <br />• Financial Reports (Trial Balance, P&L, Balance Sheet)
          <br />• Complete audit trail
        </p>
      </div>
    </div>
  )
}

function MetricCard({ title, value, color, cardBackgroundColor, borderColor, textColor }) {
  return (
    <div style={{
      padding: '20px',
      backgroundColor: cardBackgroundColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ 
        fontSize: '12px', 
        color: textColor, 
        opacity: 0.7, 
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {title}
      </div>
      <div style={{ 
        fontSize: '24px', 
        fontWeight: 600, 
        color: textColor 
      }}>
        {value}
      </div>
    </div>
  )
}

// Chart of Accounts Tab - New Implementation with Full CRUD
function ChartOfAccountsTab({ formatCurrency, getAuthHeaders }) {
  const [accounts, setAccounts] = useState([])
  const [filteredAccounts, setFilteredAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({})
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [accountBalance, setAccountBalance] = useState(null)
  
  const [alert, setAlert] = useState(null)
  
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const cardBg = isDarkMode ? '#1f1f1f' : '#ffffff'

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [accounts, filters])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const data = await accountService.getAllAccounts()
      setAccounts(Array.isArray(data) ? data : [])
      setFilteredAccounts(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading accounts:', err)
      showAlert('error', err.response?.data?.message || 'Failed to fetch accounts')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...accounts]

    if (filters.account_type) {
      filtered = filtered.filter((acc) => acc.account_type === filters.account_type)
    }

    if (filters.is_active !== undefined) {
      filtered = filtered.filter((acc) => acc.is_active === filters.is_active)
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(
        (acc) =>
          acc.account_name?.toLowerCase().includes(searchLower) ||
          acc.account_number?.toLowerCase().includes(searchLower)
      )
    }

    setFilteredAccounts(filtered)
  }

  const handleCreateAccount = async (data) => {
    try {
      await accountService.createAccount(data)
      showAlert('success', 'Account created successfully')
      setIsCreateModalOpen(false)
      loadAccounts()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to create account')
      throw error
    }
  }

  const handleUpdateAccount = async (data) => {
    if (!selectedAccount) return
    
    try {
      await accountService.updateAccount(selectedAccount.id, data)
      showAlert('success', 'Account updated successfully')
      setIsEditModalOpen(false)
      setSelectedAccount(null)
      loadAccounts()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to update account')
      throw error
    }
  }

  const handleDeleteAccount = async (account) => {
    if (!window.confirm(`Are you sure you want to delete "${account.account_name}"?`)) {
      return
    }

    try {
      await accountService.deleteAccount(account.id)
      showAlert('success', 'Account deleted successfully')
      loadAccounts()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to delete account')
    }
  }

  const handleToggleStatus = async (account) => {
    try {
      await accountService.toggleAccountStatus(account.id)
      showAlert('success', `Account ${account.is_active ? 'deactivated' : 'activated'} successfully`)
      loadAccounts()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to toggle account status')
    }
  }

  const handleViewBalance = async (account) => {
    try {
      const balance = await accountService.getAccountBalance(account.id)
      setAccountBalance(balance)
      setSelectedAccount(account)
      setIsBalanceModalOpen(true)
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to fetch account balance')
    }
  }

  const showAlert = (type, message) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleClearFilters = () => {
    setFilters({})
  }

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading accounts..." />
  }

  return (
    <div>
      <div style={{ 
        marginBottom: '24px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <div>
          <h3 style={{ color: textColor, margin: 0, fontSize: '24px', fontWeight: 600 }}>
            Chart of Accounts
          </h3>
          <p style={{ color: textColor, opacity: 0.7, marginTop: '4px', fontSize: '14px' }}>
            Manage your accounting accounts
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          + New Account
        </Button>
      </div>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <AccountFilters
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
      />

      <div style={{
        backgroundColor: cardBg,
        borderRadius: '8px',
        border: `1px solid ${borderColor}`,
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${borderColor}`
        }}>
          <p style={{
            fontSize: '14px',
            color: textColor,
            opacity: 0.7,
            margin: 0
          }}>
            Showing {filteredAccounts.length} of {accounts.length} accounts
          </p>
        </div>
        <div style={{ padding: '24px' }}>
          <AccountTable
            accounts={filteredAccounts}
            onEdit={(account) => {
              setSelectedAccount(account)
              setIsEditModalOpen(true)
            }}
            onDelete={handleDeleteAccount}
            onToggleStatus={handleToggleStatus}
            onViewBalance={handleViewBalance}
          />
        </div>
      </div>

      {/* Create Account Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Account"
        size="lg"
      >
        <AccountForm
          accounts={accounts}
          onSubmit={handleCreateAccount}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* Edit Account Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedAccount(null)
        }}
        title="Edit Account"
        size="lg"
      >
        <AccountForm
          account={selectedAccount}
          accounts={accounts}
          onSubmit={handleUpdateAccount}
          onCancel={() => {
            setIsEditModalOpen(false)
            setSelectedAccount(null)
          }}
        />
      </Modal>

      {/* Account Balance Modal */}
      <Modal
        isOpen={isBalanceModalOpen}
        onClose={() => {
          setIsBalanceModalOpen(false)
          setAccountBalance(null)
          setSelectedAccount(null)
        }}
        title="Account Balance"
        size="md"
      >
        {accountBalance && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '14px', color: textColor, opacity: 0.7, margin: '0 0 4px 0' }}>
                Account Name
              </p>
              <p style={{ fontSize: '18px', fontWeight: 600, color: textColor, margin: 0 }}>
                {accountBalance.accountName}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '14px', color: textColor, opacity: 0.7, margin: '0 0 4px 0' }}>
                Balance Type
              </p>
              <p style={{ fontSize: '16px', color: textColor, margin: 0, textTransform: 'capitalize' }}>
                {accountBalance.balanceType}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '14px', color: textColor, opacity: 0.7, margin: '0 0 4px 0' }}>
                Current Balance
              </p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: '#3b82f6', margin: 0 }}>
                {formatCurrency(accountBalance.balance || 0)}
              </p>
            </div>
            {accountBalance.asOfDate && (
              <div>
                <p style={{ fontSize: '14px', color: textColor, opacity: 0.7, margin: '0 0 4px 0' }}>
                  As of Date
                </p>
                <p style={{ fontSize: '14px', color: textColor, margin: 0 }}>
                  {new Date(accountBalance.asOfDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// Transactions Tab
function TransactionsTab({ dateRange, formatCurrency, getAuthHeaders }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  useEffect(() => {
    loadTransactions()
  }, [dateRange])

  const loadTransactions = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/accounting/transactions?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`,
        { headers: getAuthHeaders() }
      )
      if (response.ok) {
        const data = await response.json()
        setTransactions(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ color: textColor, padding: '20px' }}>Loading transactions...</div>
  }

  return (
    <div>
      <h3 style={{ color: textColor, marginBottom: '16px' }}>Journal Entries</h3>
      {transactions.length === 0 ? (
        <div style={{ color: textColor, padding: '40px', textAlign: 'center' }}>
          No transactions found for this period.
        </div>
      ) : (
        <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Transaction #</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Description</th>
                <th style={{ padding: '12px', textAlign: 'center', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => (
                <tr key={txn.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '12px', color: textColor }}>{txn.transaction_date}</td>
                  <td style={{ padding: '12px', color: textColor }}>{txn.transaction_number}</td>
                  <td style={{ padding: '12px', color: textColor }}>{txn.transaction_type}</td>
                  <td style={{ padding: '12px', color: textColor }}>{txn.description || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: textColor }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: txn.is_posted ? '#10b981' : '#f59e0b',
                      color: 'white',
                      fontSize: '12px'
                    }}>
                      {txn.is_posted ? 'Posted' : 'Draft'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Invoices Tab
function InvoicesTab({ dateRange, formatCurrency, getAuthHeaders }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  useEffect(() => {
    loadInvoices()
  }, [dateRange])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/accounting/invoices?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`,
        { headers: getAuthHeaders() }
      )
      if (response.ok) {
        const data = await response.json()
        setInvoices(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ color: textColor, padding: '20px' }}>Loading invoices...</div>
  }

  return (
    <div>
      <h3 style={{ color: textColor, marginBottom: '16px' }}>Invoices</h3>
      {invoices.length === 0 ? (
        <div style={{ color: textColor, padding: '40px', textAlign: 'center' }}>
          No invoices found for this period.
        </div>
      ) : (
        <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Invoice #</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Customer</th>
                <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Total</th>
                <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Balance</th>
                <th style={{ padding: '12px', textAlign: 'center', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '12px', color: textColor }}>{inv.invoice_number}</td>
                  <td style={{ padding: '12px', color: textColor }}>{inv.invoice_date}</td>
                  <td style={{ padding: '12px', color: textColor }}>{inv.customer_name || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>{formatCurrency(inv.total_amount || 0)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>{formatCurrency(inv.balance_due || 0)}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: textColor }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: inv.status === 'paid' ? '#10b981' : inv.status === 'partial' ? '#f59e0b' : '#6b7280',
                      color: 'white',
                      fontSize: '12px'
                    }}>
                      {inv.status || 'draft'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Bills Tab
function BillsTab({ dateRange, formatCurrency, getAuthHeaders }) {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  useEffect(() => {
    loadBills()
  }, [dateRange])

  const loadBills = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/accounting/bills?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`,
        { headers: getAuthHeaders() }
      )
      if (response.ok) {
        const data = await response.json()
        setBills(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading bills:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ color: textColor, padding: '20px' }}>Loading bills...</div>
  }

  return (
    <div>
      <h3 style={{ color: textColor, marginBottom: '16px' }}>Bills</h3>
      {bills.length === 0 ? (
        <div style={{ color: textColor, padding: '40px', textAlign: 'center' }}>
          No bills found for this period.
        </div>
      ) : (
        <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Bill #</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Vendor</th>
                <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Total</th>
                <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Balance</th>
                <th style={{ padding: '12px', textAlign: 'center', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(bill => (
                <tr key={bill.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '12px', color: textColor }}>{bill.bill_number}</td>
                  <td style={{ padding: '12px', color: textColor }}>{bill.bill_date}</td>
                  <td style={{ padding: '12px', color: textColor }}>{bill.vendor_name || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>{formatCurrency(bill.total_amount || 0)}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>{formatCurrency(bill.balance_due || 0)}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: textColor }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: bill.status === 'paid' ? '#10b981' : bill.status === 'partial' ? '#f59e0b' : '#6b7280',
                      color: 'white',
                      fontSize: '12px'
                    }}>
                      {bill.status || 'draft'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Customers Tab
function CustomersTab({ formatCurrency, getAuthHeaders }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/accounting/customers', { headers: getAuthHeaders() })
      if (response.ok) {
        const data = await response.json()
        setCustomers(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading customers:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ color: textColor, padding: '20px' }}>Loading customers...</div>
  }

  return (
    <div>
      <h3 style={{ color: textColor, marginBottom: '16px' }}>Customers</h3>
      {customers.length === 0 ? (
        <div style={{ color: textColor, padding: '40px', textAlign: 'center' }}>
          No customers found.
        </div>
      ) : (
        <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Customer #</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(customer => (
                <tr key={customer.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '12px', color: textColor }}>{customer.customer_number}</td>
                  <td style={{ padding: '12px', color: textColor }}>{customer.display_name}</td>
                  <td style={{ padding: '12px', color: textColor }}>{customer.email || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>{formatCurrency(customer.account_balance || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Vendors Tab
function VendorsTab({ formatCurrency, getAuthHeaders }) {
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  useEffect(() => {
    loadVendors()
  }, [])

  const loadVendors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/accounting/vendors', { headers: getAuthHeaders() })
      if (response.ok) {
        const data = await response.json()
        setVendors(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error loading vendors:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ color: textColor, padding: '20px' }}>Loading vendors...</div>
  }

  return (
    <div>
      <h3 style={{ color: textColor, marginBottom: '16px' }}>Vendors</h3>
      {vendors.length === 0 ? (
        <div style={{ color: textColor, padding: '40px', textAlign: 'center' }}>
          No vendors found.
        </div>
      ) : (
        <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Vendor #</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(vendor => (
                <tr key={vendor.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '12px', color: textColor }}>{vendor.vendor_number}</td>
                  <td style={{ padding: '12px', color: textColor }}>{vendor.vendor_name}</td>
                  <td style={{ padding: '12px', color: textColor }}>{vendor.email || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>{formatCurrency(vendor.account_balance || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Reports Tab
function ReportsTab({ dateRange, formatCurrency, getAuthHeaders }) {
  const [selectedReport, setSelectedReport] = useState('trial-balance')
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const cardBg = isDarkMode ? '#1f1f1f' : '#ffffff'

  const loadReport = async () => {
    try {
      setLoading(true)
      let url = ''
      if (selectedReport === 'trial-balance') {
        url = `/api/accounting/trial-balance?as_of_date=${dateRange.end_date}`
      } else if (selectedReport === 'profit-loss') {
        url = `/api/accounting/profit-loss?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`
      } else if (selectedReport === 'balance-sheet') {
        url = `/api/accounting/balance-sheet?as_of_date=${dateRange.end_date}`
      } else if (selectedReport === 'aging') {
        url = `/api/accounting/aging?as_of_date=${dateRange.end_date}`
      }
      
      if (url) {
        const response = await fetch(url, { headers: getAuthHeaders() })
        if (response.ok) {
          const data = await response.json()
          setReportData(data)
        }
      }
    } catch (err) {
      console.error('Error loading report:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedReport) {
      loadReport()
    }
  }, [selectedReport, dateRange])

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', gap: '8px' }}>
        {['trial-balance', 'profit-loss', 'balance-sheet', 'aging'].map(report => (
          <button
            key={report}
            onClick={() => setSelectedReport(report)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: selectedReport === report ? '#3b82f6' : 'transparent',
              color: selectedReport === report ? 'white' : textColor,
              cursor: 'pointer',
              fontWeight: selectedReport === report ? 600 : 400,
              fontSize: '14px',
              textTransform: 'capitalize'
            }}
          >
            {report.replace('-', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: textColor, padding: '40px', textAlign: 'center' }}>Loading report...</div>
      ) : reportData ? (
        <div style={{
          backgroundColor: cardBg,
          border: `1px solid ${borderColor}`,
          borderRadius: '8px',
          padding: '24px'
        }}>
          <h3 style={{ color: textColor, marginBottom: '16px' }}>
            {selectedReport.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </h3>
          <pre style={{ color: textColor, fontSize: '12px', overflow: 'auto' }}>
            {JSON.stringify(reportData, null, 2)}
          </pre>
        </div>
      ) : (
        <div style={{ color: textColor, padding: '40px', textAlign: 'center' }}>
          Select a report type above to view financial reports.
        </div>
      )}
    </div>
  )
}

export default Accounting
