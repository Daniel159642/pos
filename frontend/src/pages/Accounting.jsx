import { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import accountService from '../services/accountService'
import transactionService from '../services/transactionService'
import AccountTable from '../components/accounts/AccountTable'
import AccountForm from '../components/accounts/AccountForm'
import AccountFilters from '../components/accounts/AccountFilters'
import TransactionTable from '../components/transactions/TransactionTable'
import TransactionForm from '../components/transactions/TransactionForm'
import TransactionFilters from '../components/transactions/TransactionFilters'
import GeneralLedgerFilters from '../components/ledger/GeneralLedgerFilters'
import GeneralLedgerTable from '../components/ledger/GeneralLedgerTable'
import AccountLedgerCard from '../components/ledger/AccountLedgerCard'
import ProfitLossFilters from '../components/reports/ProfitLossFilters'
import ProfitLossTable from '../components/reports/ProfitLossTable'
import ComparativeProfitLossTable from '../components/reports/ComparativeProfitLossTable'
import ProfitLossChart from '../components/reports/ProfitLossChart'
import BalanceSheetFilters from '../components/reports/BalanceSheetFilters'
import BalanceSheetTable from '../components/reports/BalanceSheetTable'
import ComparativeBalanceSheetTable from '../components/reports/ComparativeBalanceSheetTable'
import BalanceSheetChart from '../components/reports/BalanceSheetChart'
import CashFlowFilters from '../components/reports/CashFlowFilters'
import CashFlowTable from '../components/reports/CashFlowTable'
import ComparativeCashFlowTable from '../components/reports/ComparativeCashFlowTable'
import CashFlowChart from '../components/reports/CashFlowChart'
import reportService from '../services/reportService'
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
            { id: 'general-ledger', label: 'General Ledger' },
            { id: 'profit-loss', label: 'Profit & Loss' },
            { id: 'balance-sheet', label: 'Balance Sheet' },
            { id: 'cash-flow', label: 'Cash Flow' },
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
        {activeTab === 'general-ledger' && <GeneralLedgerTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
        {activeTab === 'account-ledger' && <AccountLedgerTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} setActiveTab={setActiveTab} />}
        {activeTab === 'profit-loss' && <ProfitLossTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} setActiveTab={setActiveTab} />}
        {activeTab === 'balance-sheet' && <BalanceSheetTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} setActiveTab={setActiveTab} />}
        {activeTab === 'cash-flow' && <CashFlowTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} setActiveTab={setActiveTab} />}
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
            onViewLedger={(account) => {
              sessionStorage.setItem('selectedAccountId', account.id)
              setActiveTab('account-ledger')
            }}
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

// Transactions Tab - New Implementation with Full CRUD
function TransactionsTab({ dateRange, formatCurrency, getAuthHeaders }) {
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ 
    page: 1, 
    limit: 50,
    start_date: dateRange.start_date,
    end_date: dateRange.end_date
  })
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  
  const [alert, setAlert] = useState(null)
  
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const cardBg = isDarkMode ? '#1f1f1f' : '#ffffff'

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [filters])

  useEffect(() => {
    // Update filters when dateRange changes
    setFilters(prev => ({
      ...prev,
      start_date: dateRange.start_date,
      end_date: dateRange.end_date
    }))
  }, [dateRange])

  const loadAccounts = async () => {
    try {
      const data = await accountService.getAllAccounts()
      setAccounts(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading accounts:', err)
    }
  }

  const loadTransactions = async () => {
    try {
      setLoading(true)
      const result = await transactionService.getAllTransactions(filters)
      setTransactions(result.transactions || [])
      setPagination(result.pagination || { total: 0, page: 1, totalPages: 1 })
    } catch (err) {
      console.error('Error loading transactions:', err)
      showAlert('error', err.response?.data?.message || 'Failed to fetch transactions')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTransaction = async (data, postImmediately) => {
    try {
      const transaction = await transactionService.createTransaction(data)
      
      if (postImmediately) {
        await transactionService.postTransaction(transaction.transaction.id)
        showAlert('success', 'Transaction created and posted successfully')
      } else {
        showAlert('success', 'Transaction created successfully')
      }
      
      setIsCreateModalOpen(false)
      loadTransactions()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to create transaction')
      throw error
    }
  }

  const handleUpdateTransaction = async (data) => {
    if (!selectedTransaction) return
    
    try {
      await transactionService.updateTransaction(selectedTransaction.transaction.id, data)
      showAlert('success', 'Transaction updated successfully')
      setIsEditModalOpen(false)
      setSelectedTransaction(null)
      loadTransactions()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to update transaction')
      throw error
    }
  }

  const handleDeleteTransaction = async (transaction) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return
    }

    try {
      await transactionService.deleteTransaction(transaction.transaction.id)
      showAlert('success', 'Transaction deleted successfully')
      loadTransactions()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to delete transaction')
    }
  }

  const handlePostTransaction = async (transaction) => {
    if (!window.confirm('Post this transaction? This will affect account balances.')) {
      return
    }

    try {
      await transactionService.postTransaction(transaction.transaction.id)
      showAlert('success', 'Transaction posted successfully')
      loadTransactions()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to post transaction')
    }
  }

  const handleUnpostTransaction = async (transaction) => {
    if (!window.confirm('Unpost this transaction? This will reverse its effect on account balances.')) {
      return
    }

    try {
      await transactionService.unpostTransaction(transaction.transaction.id)
      showAlert('success', 'Transaction unposted successfully')
      loadTransactions()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to unpost transaction')
    }
  }

  const handleVoidTransaction = async (transaction) => {
    const reason = window.prompt('Enter reason for voiding this transaction:')
    if (!reason) return

    try {
      await transactionService.voidTransaction(transaction.transaction.id, reason)
      showAlert('success', 'Transaction voided successfully')
      loadTransactions()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to void transaction')
    }
  }

  const showAlert = (type, message) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleClearFilters = () => {
    setFilters({ 
      page: 1, 
      limit: 50,
      start_date: dateRange.start_date,
      end_date: dateRange.end_date
    })
  }

  const handlePageChange = (newPage) => {
    setFilters({ ...filters, page: newPage })
  }

  if (loading && transactions.length === 0) {
    return <LoadingSpinner size="lg" text="Loading transactions..." />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ color: textColor, marginBottom: '8px', fontSize: '24px', fontWeight: '600' }}>
            Transactions
          </h3>
          <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
            Record and manage journal entries
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>+ New Transaction</Button>
      </div>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <TransactionFilters
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
      />

      <div style={{ 
        backgroundColor: cardBg, 
        borderRadius: '8px', 
        border: `1px solid ${borderColor}`,
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <div style={{ 
          padding: '16px 24px', 
          borderBottom: `1px solid ${borderColor}`, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <p style={{ fontSize: '14px', color: textColor, opacity: 0.7 }}>
            Showing {transactions.length} of {pagination.total} transactions
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={filters.page === 1}
              size="sm"
              variant="secondary"
            >
              Previous
            </Button>
            <span style={{ padding: '0 12px', fontSize: '14px', color: textColor }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={filters.page === pagination.totalPages}
              size="sm"
              variant="secondary"
            >
              Next
            </Button>
          </div>
        </div>
        
        <TransactionTable
          transactions={transactions}
          onView={(transaction) => {
            setSelectedTransaction(transaction)
            setIsViewModalOpen(true)
          }}
          onEdit={(transaction) => {
            setSelectedTransaction(transaction)
            setIsEditModalOpen(true)
          }}
          onDelete={handleDeleteTransaction}
          onPost={handlePostTransaction}
          onUnpost={handleUnpostTransaction}
          onVoid={handleVoidTransaction}
        />
      </div>

      {/* Create Transaction Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Transaction"
        size="xl"
      >
        <TransactionForm
          accounts={accounts}
          onSubmit={handleCreateTransaction}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedTransaction(null)
        }}
        title="Edit Transaction"
        size="xl"
      >
        <TransactionForm
          transaction={selectedTransaction}
          accounts={accounts}
          onSubmit={handleUpdateTransaction}
          onCancel={() => {
            setIsEditModalOpen(false)
            setSelectedTransaction(null)
          }}
        />
      </Modal>

      {/* View Transaction Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setSelectedTransaction(null)
        }}
        title="Transaction Details"
        size="lg"
      >
        {selectedTransaction && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Transaction Number</p>
                <p style={{ fontWeight: '600', color: textColor }}>{selectedTransaction.transaction.transaction_number}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Date</p>
                <p style={{ fontWeight: '600', color: textColor }}>
                  {new Date(selectedTransaction.transaction.transaction_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Type</p>
                <p style={{ fontWeight: '600', color: textColor, textTransform: 'capitalize' }}>
                  {selectedTransaction.transaction.transaction_type.replace('_', ' ')}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Status</p>
                <p style={{ fontWeight: '600', color: textColor }}>
                  {selectedTransaction.transaction.is_void ? 'Voided' :
                   selectedTransaction.transaction.is_posted ? 'Posted' : 'Draft'}
                </p>
              </div>
            </div>
            
            <div>
              <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Description</p>
              <p style={{ fontWeight: '600', color: textColor }}>{selectedTransaction.transaction.description}</p>
            </div>

            {selectedTransaction.transaction.reference_number && (
              <div>
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Reference Number</p>
                <p style={{ fontWeight: '600', color: textColor }}>{selectedTransaction.transaction.reference_number}</p>
              </div>
            )}

            <div>
              <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '8px' }}>Transaction Lines</p>
              <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Account</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Description</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Debit</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransaction.lines.map((line) => (
                      <tr key={line.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: textColor }}>
                          {line.account_number && `${line.account_number} - `}
                          {line.account_name}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: textColor }}>{line.description}</td>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: textColor, textAlign: 'right' }}>
                          {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: textColor, textAlign: 'right' }}>
                          {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
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

// General Ledger Tab
function GeneralLedgerTab({ dateRange, formatCurrency, getAuthHeaders }) {
  const [entries, setEntries] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    start_date: dateRange.start_date,
    end_date: dateRange.end_date
  })
  
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  
  const [alert, setAlert] = useState(null)
  
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const cardBg = isDarkMode ? '#1f1f1f' : '#ffffff'

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    loadLedger()
  }, [filters])

  useEffect(() => {
    // Update filters when dateRange changes
    setFilters(prev => ({
      ...prev,
      start_date: dateRange.start_date,
      end_date: dateRange.end_date
    }))
  }, [dateRange])

  const loadAccounts = async () => {
    try {
      const data = await accountService.getAllAccounts({ is_active: true })
      setAccounts(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading accounts:', err)
    }
  }

  const loadLedger = async () => {
    setLoading(true)
    try {
      const data = await transactionService.getGeneralLedger(filters)
      setEntries(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading ledger:', err)
      showAlert('error', err.response?.data?.message || 'Failed to fetch ledger entries')
    } finally {
      setLoading(false)
    }
  }

  const handleViewTransaction = async (transactionId) => {
    try {
      const transaction = await transactionService.getTransactionById(transactionId)
      setSelectedTransaction(transaction)
      setIsViewModalOpen(true)
    } catch (err) {
      showAlert('error', 'Failed to fetch transaction details')
    }
  }

  const handleExport = () => {
    if (entries.length === 0) {
      showAlert('error', 'No data to export')
      return
    }

    // Create CSV content
    const headers = ['Date', 'Transaction #', 'Account', 'Description', 'Debit', 'Credit']
    const rows = entries.map(entry => [
      new Date(entry.transaction_date).toLocaleDateString(),
      entry.transaction_number,
      `${entry.account_number || ''} ${entry.account_name}`.trim(),
      entry.line_description,
      entry.debit_amount > 0 ? entry.debit_amount.toFixed(2) : '',
      entry.credit_amount > 0 ? entry.credit_amount.toFixed(2) : '',
    ])

    // Add totals row
    const totalDebits = entries.reduce((sum, e) => sum + (e.debit_amount || 0), 0)
    const totalCredits = entries.reduce((sum, e) => sum + (e.credit_amount || 0), 0)
    rows.push(['', '', '', 'TOTALS', totalDebits.toFixed(2), totalCredits.toFixed(2)])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `general-ledger-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    showAlert('success', 'Ledger exported to CSV')
  }

  const showAlert = (type, message) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleClearFilters = () => {
    setFilters({
      start_date: dateRange.start_date,
      end_date: dateRange.end_date
    })
  }

  const getSelectedAccountName = () => {
    if (!filters.account_id) return 'All Accounts'
    const account = accounts.find(a => a.id === filters.account_id)
    return account ? `${account.account_number || ''} ${account.account_name}`.trim() : 'Unknown Account'
  }

  const totalDebits = entries.reduce((sum, e) => sum + (e.debit_amount || 0), 0)
  const totalCredits = entries.reduce((sum, e) => sum + (e.credit_amount || 0), 0)

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: textColor, marginBottom: '8px', fontSize: '24px', fontWeight: '600' }}>
          General Ledger
        </h3>
        <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
          View all posted accounting transactions
        </p>
      </div>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <GeneralLedgerFilters
        filters={filters}
        accounts={accounts}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
        onExport={handleExport}
        loading={loading}
      />

      {loading ? (
        <LoadingSpinner size="lg" text="Loading ledger entries..." />
      ) : (
        <>
          <div style={{ 
            marginBottom: '16px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <div>
              <p style={{ fontSize: '14px', color: textColor, opacity: 0.7 }}>
                Showing <span style={{ fontWeight: '600' }}>{entries.length}</span> entries
                {filters.account_id && (
                  <span> for account: <span style={{ fontWeight: '600' }}>{getSelectedAccountName()}</span></span>
                )}
              </p>
              {filters.start_date && filters.end_date && (
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.5, marginTop: '4px' }}>
                  Period: {new Date(filters.start_date).toLocaleDateString()} - {new Date(filters.end_date).toLocaleDateString()}
                </p>
              )}
            </div>
            {entries.length > 0 && (
              <div style={{ fontSize: '14px', color: textColor, opacity: 0.7 }}>
                <span style={{ fontWeight: '600' }}>
                  Debits: ${totalDebits.toFixed(2)}
                </span>
                {' | '}
                <span style={{ fontWeight: '600' }}>
                  Credits: ${totalCredits.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <GeneralLedgerTable
            entries={entries}
            showRunningBalance={false}
            onViewTransaction={handleViewTransaction}
          />
        </>
      )}

      {/* View Transaction Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setSelectedTransaction(null)
        }}
        title="Transaction Details"
        size="lg"
      >
        {selectedTransaction && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Transaction Number</p>
                <p style={{ fontWeight: '600', color: textColor }}>{selectedTransaction.transaction.transaction_number}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Date</p>
                <p style={{ fontWeight: '600', color: textColor }}>
                  {new Date(selectedTransaction.transaction.transaction_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Type</p>
                <p style={{ fontWeight: '600', color: textColor, textTransform: 'capitalize' }}>
                  {selectedTransaction.transaction.transaction_type.replace('_', ' ')}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Status</p>
                <span style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  borderRadius: '12px',
                  backgroundColor: selectedTransaction.transaction.is_posted 
                    ? '#d1fae5' 
                    : '#fef3c7',
                  color: selectedTransaction.transaction.is_posted 
                    ? '#065f46' 
                    : '#92400e'
                }}>
                  {selectedTransaction.transaction.is_posted ? 'Posted' : 'Draft'}
                </span>
              </div>
            </div>
            
            <div>
              <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Description</p>
              <p style={{ fontWeight: '600', color: textColor }}>{selectedTransaction.transaction.description}</p>
            </div>

            {selectedTransaction.transaction.reference_number && (
              <div>
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Reference Number</p>
                <p style={{ fontWeight: '600', color: textColor }}>{selectedTransaction.transaction.reference_number}</p>
              </div>
            )}

            <div>
              <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '8px' }}>Transaction Lines</p>
              <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Account</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Description</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Debit</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransaction.lines.map((line) => (
                      <tr key={line.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: textColor }}>
                          {line.account_number && `${line.account_number} - `}
                          {line.account_name}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: textColor }}>{line.description}</td>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: textColor, textAlign: 'right' }}>
                          {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: textColor, textAlign: 'right' }}>
                          {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// Account Ledger Tab
function AccountLedgerTab({ dateRange, formatCurrency, getAuthHeaders, setActiveTab }) {
  const [ledgerData, setLedgerData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    start_date: dateRange.start_date,
    end_date: dateRange.end_date
  })
  
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  
  const [alert, setAlert] = useState(null)
  
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const cardBg = isDarkMode ? '#1f1f1f' : '#ffffff'

  const accountId = parseInt(sessionStorage.getItem('selectedAccountId') || '0')

  useEffect(() => {
    if (accountId) {
      loadAccountLedger()
    }
  }, [accountId, filters])

  useEffect(() => {
    // Update filters when dateRange changes
    setFilters(prev => ({
      ...prev,
      start_date: dateRange.start_date,
      end_date: dateRange.end_date
    }))
  }, [dateRange])

  const loadAccountLedger = async () => {
    if (!accountId) return
    
    setLoading(true)
    try {
      const data = await transactionService.getAccountLedger(accountId, filters)
      setLedgerData(data)
    } catch (err) {
      console.error('Error loading account ledger:', err)
      showAlert('error', err.response?.data?.message || 'Failed to fetch account ledger')
    } finally {
      setLoading(false)
    }
  }

  const handleViewTransaction = async (transactionId) => {
    try {
      const transaction = await transactionService.getTransactionById(transactionId)
      setSelectedTransaction(transaction)
      setIsViewModalOpen(true)
    } catch (err) {
      showAlert('error', 'Failed to fetch transaction details')
    }
  }

  const handleExport = () => {
    if (!ledgerData || ledgerData.entries.length === 0) {
      showAlert('error', 'No data to export')
      return
    }

    const headers = ['Date', 'Transaction #', 'Description', 'Debit', 'Credit', 'Balance']
    const rows = ledgerData.entries.map(entry => [
      new Date(entry.transaction_date).toLocaleDateString(),
      entry.transaction_number,
      entry.line_description,
      entry.debit_amount > 0 ? entry.debit_amount.toFixed(2) : '',
      entry.credit_amount > 0 ? entry.credit_amount.toFixed(2) : '',
      entry.running_balance?.toFixed(2) || '',
    ])

    const csvContent = [
      [`Account: ${ledgerData.account.account_number || ''} ${ledgerData.account.account_name}`],
      [`Ending Balance: $${ledgerData.ending_balance.toFixed(2)}`],
      [],
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `account-ledger-${accountId}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    showAlert('success', 'Account ledger exported to CSV')
  }

  const showAlert = (type, message) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters({
      ...filters,
      [name]: value || undefined,
    })
  }

  const handleClearFilters = () => {
    setFilters({
      start_date: dateRange.start_date,
      end_date: dateRange.end_date
    })
  }

  if (!accountId) {
    return (
      <div>
        <Alert type="error" message="No account selected. Please select an account from Chart of Accounts." />
      </div>
    )
  }

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading account ledger..." />
  }

  if (!ledgerData) {
    return (
      <div>
        <Alert type="error" message="Failed to load account ledger" />
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={() => {
            sessionStorage.removeItem('selectedAccountId')
            setActiveTab('chart-of-accounts')
          }}
        >
          ← Back to Accounts
        </Button>
        <div>
          <h3 style={{ color: textColor, marginBottom: '4px', fontSize: '24px', fontWeight: '600' }}>
            Account Ledger
          </h3>
          <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
            {ledgerData.account.account_number && `${ledgerData.account.account_number} - `}
            {ledgerData.account.account_name}
          </p>
        </div>
      </div>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <AccountLedgerCard
        ledgerData={ledgerData}
        dateRange={filters}
      />

      {/* Filters */}
      <div style={{
        backgroundColor: cardBg,
        padding: '16px',
        borderRadius: '8px',
        border: `1px solid ${borderColor}`,
        marginBottom: '24px',
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          marginBottom: '16px',
          color: textColor
        }}>
          Filter Transactions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <Input
            label="Start Date"
            name="start_date"
            type="date"
            value={filters.start_date || ''}
            onChange={handleFilterChange}
          />

          <Input
            label="End Date"
            name="end_date"
            type="date"
            value={filters.end_date || ''}
            onChange={handleFilterChange}
          />

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClearFilters}
              style={{ flex: 1 }}
            >
              Clear Filters
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleExport}
              style={{ flex: 1 }}
            >
              📊 Export
            </Button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '14px', color: textColor, opacity: 0.7 }}>
          Showing <span style={{ fontWeight: '600' }}>{ledgerData.entries.length}</span> transactions
        </p>
      </div>

      <GeneralLedgerTable
        entries={ledgerData.entries}
        showRunningBalance={true}
        onViewTransaction={handleViewTransaction}
      />

      {/* View Transaction Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setSelectedTransaction(null)
        }}
        title="Transaction Details"
        size="lg"
      >
        {selectedTransaction && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Transaction Number</p>
                <p style={{ fontWeight: '600', color: textColor }}>{selectedTransaction.transaction.transaction_number}</p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Date</p>
                <p style={{ fontWeight: '600', color: textColor }}>
                  {new Date(selectedTransaction.transaction.transaction_date).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div>
              <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '4px' }}>Description</p>
              <p style={{ fontWeight: '600', color: textColor }}>{selectedTransaction.transaction.description}</p>
            </div>

            <div>
              <p style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginBottom: '8px' }}>Transaction Lines</p>
              <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Account</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Description</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Debit</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransaction.lines.map((line) => (
                      <tr key={line.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: textColor }}>
                          {line.account_number && `${line.account_number} - `}
                          {line.account_name}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: textColor }}>{line.description}</td>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: textColor, textAlign: 'right' }}>
                          {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '14px', color: textColor, textAlign: 'right' }}>
                          {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// Profit & Loss Tab
function ProfitLossTab({ dateRange, formatCurrency, getAuthHeaders, setActiveTab }) {
  const [reportData, setReportData] = useState(null)
  const [comparativeData, setComparativeData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    start_date: dateRange.start_date,
    end_date: dateRange.end_date,
    comparison_type: 'none',
  })
  
  const [alert, setAlert] = useState(null)
  
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const cardBg = isDarkMode ? '#1f1f1f' : '#ffffff'

  useEffect(() => {
    // Update filters when dateRange changes
    setFilters(prev => ({
      ...prev,
      start_date: dateRange.start_date,
      end_date: dateRange.end_date
    }))
  }, [dateRange])

  const handleGenerateReport = async () => {
    setLoading(true)
    try {
      if (filters.comparison_type === 'none') {
        const data = await reportService.getProfitLoss(filters.start_date, filters.end_date)
        setReportData(data)
        setComparativeData(null)
      } else {
        let priorPeriod
        if (filters.comparison_type === 'previous_period') {
          priorPeriod = reportService.calculatePriorPeriod(filters.start_date, filters.end_date)
        } else {
          priorPeriod = reportService.calculatePriorYear(filters.start_date, filters.end_date)
        }

        const data = await reportService.getComparativeProfitLoss(
          filters.start_date,
          filters.end_date,
          priorPeriod.start,
          priorPeriod.end
        )
        
        setComparativeData(data)
        setReportData(data.current)
      }
      
      showAlert('success', 'Report generated successfully')
    } catch (error) {
      console.error('Error generating report:', error)
      showAlert('error', error.response?.data?.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!reportData) {
      showAlert('error', 'No report data to export')
      return
    }

    const rows = [
      ['Profit & Loss Statement'],
      [`Period: ${new Date(reportData.start_date).toLocaleDateString()} - ${new Date(reportData.end_date).toLocaleDateString()}`],
      [],
      ['Account', 'Amount', '% of Revenue'],
      [],
      ['REVENUE'],
    ]

    reportData.revenue.forEach(account => {
      rows.push([
        `  ${account.account_number || ''} ${account.account_name}`,
        account.balance.toFixed(2),
        (account.percentage_of_revenue || 0).toFixed(1) + '%'
      ])
    })

    rows.push(['Total Revenue', reportData.total_revenue.toFixed(2), '100.0%'])
    rows.push([])

    if (reportData.cost_of_goods_sold && reportData.cost_of_goods_sold.length > 0) {
      rows.push(['COST OF GOODS SOLD'])
      reportData.cost_of_goods_sold.forEach(account => {
        rows.push([
          `  ${account.account_number || ''} ${account.account_name}`,
          account.balance.toFixed(2),
          (account.percentage_of_revenue || 0).toFixed(1) + '%'
        ])
      })
      rows.push(['Total Cost of Goods Sold', reportData.total_cogs.toFixed(2), ((reportData.total_cogs / reportData.total_revenue) * 100).toFixed(1) + '%'])
      rows.push(['GROSS PROFIT', reportData.gross_profit.toFixed(2), ((reportData.gross_profit / reportData.total_revenue) * 100).toFixed(1) + '%'])
      rows.push([])
    }

    rows.push(['EXPENSES'])
    reportData.expenses.forEach(account => {
      rows.push([
        `  ${account.account_number || ''} ${account.account_name}`,
        account.balance.toFixed(2),
        (account.percentage_of_revenue || 0).toFixed(1) + '%'
      ])
    })

    rows.push(['Total Expenses', reportData.total_expenses.toFixed(2), ((reportData.total_expenses / reportData.total_revenue) * 100).toFixed(1) + '%'])
    rows.push([])
    rows.push(['NET INCOME', reportData.net_income.toFixed(2), ((reportData.net_income / reportData.total_revenue) * 100).toFixed(1) + '%'])

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `profit-loss-${filters.start_date}-to-${filters.end_date}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    showAlert('success', 'Report exported to CSV')
  }

  const handleAccountClick = (accountId) => {
    sessionStorage.setItem('selectedAccountId', accountId)
    setActiveTab('account-ledger')
  }

  const showAlert = (type, message) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const getPeriodLabel = () => {
    return `${new Date(filters.start_date).toLocaleDateString()} - ${new Date(filters.end_date).toLocaleDateString()}`
  }

  const getPriorPeriodLabel = () => {
    if (!comparativeData) return ''
    return `${new Date(comparativeData.prior.start_date).toLocaleDateString()} - ${new Date(comparativeData.prior.end_date).toLocaleDateString()}`
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: textColor, marginBottom: '8px', fontSize: '24px', fontWeight: '600' }}>
          Profit & Loss Statement
        </h3>
        <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
          Income statement showing revenue, expenses, and net income
        </p>
      </div>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <ProfitLossFilters
        filters={filters}
        onFilterChange={setFilters}
        onGenerate={handleGenerateReport}
        loading={loading}
      />

      {loading && <LoadingSpinner size="lg" text="Generating report..." />}

      {!loading && reportData && (
        <>
          <div style={{ 
            marginBottom: '24px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: textColor }}>
                {getPeriodLabel()}
              </h2>
              {comparativeData && (
                <p style={{ fontSize: '14px', color: textColor, opacity: 0.7, marginTop: '4px' }}>
                  Compared to: {getPriorPeriodLabel()}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="secondary" onClick={handleExport}>
                📊 Export to CSV
              </Button>
              <Button variant="secondary" onClick={() => window.print()}>
                🖨️ Print
              </Button>
            </div>
          </div>

          {comparativeData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ComparativeProfitLossTable
                data={comparativeData}
                currentLabel={getPeriodLabel()}
                priorLabel={getPriorPeriodLabel()}
              />
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
                gap: '24px' 
              }}>
                <div>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: '600', 
                    marginBottom: '16px',
                    color: textColor
                  }}>
                    Current Period Detail
                  </h3>
                  <ProfitLossTable
                    data={reportData}
                    showPercentages={true}
                    onAccountClick={handleAccountClick}
                  />
                </div>
                <ProfitLossChart data={reportData} />
              </div>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
              gap: '24px' 
            }}>
              <div style={{ gridColumn: 'span 2' }}>
                <ProfitLossTable
                  data={reportData}
                  showPercentages={true}
                  onAccountClick={handleAccountClick}
                />
              </div>
              <ProfitLossChart data={reportData} />
            </div>
          )}
        </>
      )}

      {!loading && !reportData && (
        <div style={{ 
          backgroundColor: cardBg, 
          borderRadius: '8px', 
          border: `1px solid ${borderColor}`,
          padding: '48px', 
          textAlign: 'center' 
        }}>
          <p style={{ color: textColor, opacity: 0.7, marginBottom: '16px' }}>
            Select a date range and click "Generate Report" to view your Profit & Loss Statement
          </p>
          <Button onClick={handleGenerateReport}>
            Generate Report
          </Button>
        </div>
      )}
    </div>
  )
}

// Balance Sheet Tab
function BalanceSheetTab({ dateRange, formatCurrency, getAuthHeaders, setActiveTab }) {
  const [reportData, setReportData] = useState(null)
  const [comparativeData, setComparativeData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    as_of_date: new Date().toISOString().split('T')[0],
    comparison_type: 'none'
  })
  const [alert, setAlert] = useState(null)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const cardBg = isDarkMode ? '#1f1f1f' : '#ffffff'

  const handleGenerateReport = async () => {
    setLoading(true)
    try {
      if (filters.comparison_type === 'none') {
        const data = await reportService.getBalanceSheet(filters.as_of_date)
        setReportData(data)
        setComparativeData(null)
      } else {
        const priorDate = filters.comparison_type === 'previous_month'
          ? reportService.calculatePriorMonth(filters.as_of_date)
          : reportService.calculatePriorYearDate(filters.as_of_date)
        const data = await reportService.getComparativeBalanceSheet(filters.as_of_date, priorDate)
        setComparativeData(data)
        setReportData(data.current)
      }
      showAlert('success', 'Report generated successfully')
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!reportData) {
      showAlert('error', 'No report data to export')
      return
    }
    const rows = [
      ['Balance Sheet'],
      [`As of: ${new Date(reportData.as_of_date).toLocaleDateString()}`],
      [],
      ['ASSETS']
    ]
    if (reportData.assets.current_assets?.length > 0) {
      rows.push(['Current Assets'])
      reportData.assets.current_assets.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, a.balance.toFixed(2)]))
      rows.push(['Total Current Assets', reportData.assets.total_current_assets.toFixed(2)])
    }
    if (reportData.assets.fixed_assets?.length > 0) {
      rows.push(['Fixed Assets'])
      reportData.assets.fixed_assets.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, a.balance.toFixed(2)]))
      rows.push(['Total Fixed Assets', reportData.assets.total_fixed_assets.toFixed(2)])
    }
    if (reportData.assets.other_assets?.length > 0) {
      rows.push(['Other Assets'])
      reportData.assets.other_assets.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, a.balance.toFixed(2)]))
      rows.push(['Total Other Assets', reportData.assets.total_other_assets.toFixed(2)])
    }
    rows.push(['TOTAL ASSETS', reportData.assets.total_assets.toFixed(2)])
    rows.push([])
    rows.push(['LIABILITIES'])
    if (reportData.liabilities.current_liabilities?.length > 0) {
      rows.push(['Current Liabilities'])
      reportData.liabilities.current_liabilities.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, a.balance.toFixed(2)]))
      rows.push(['Total Current Liabilities', reportData.liabilities.total_current_liabilities.toFixed(2)])
    }
    if (reportData.liabilities.long_term_liabilities?.length > 0) {
      rows.push(['Long-term Liabilities'])
      reportData.liabilities.long_term_liabilities.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, a.balance.toFixed(2)]))
      rows.push(['Total Long-term Liabilities', reportData.liabilities.total_long_term_liabilities.toFixed(2)])
    }
    rows.push(['TOTAL LIABILITIES', reportData.liabilities.total_liabilities.toFixed(2)])
    rows.push([])
    rows.push(['EQUITY'])
    reportData.equity.equity_accounts?.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, a.balance.toFixed(2)]))
    rows.push(['Current Year Earnings', reportData.equity.current_year_earnings.toFixed(2)])
    rows.push(['TOTAL EQUITY', reportData.equity.total_equity.toFixed(2)])
    rows.push([])
    rows.push(['TOTAL LIABILITIES AND EQUITY', (reportData.liabilities.total_liabilities + reportData.equity.total_equity).toFixed(2)])
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `balance-sheet-${filters.as_of_date}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    showAlert('success', 'Report exported to CSV')
  }

  const handleAccountClick = (accountId) => {
    sessionStorage.setItem('selectedAccountId', accountId)
    setActiveTab('account-ledger')
  }

  const showAlert = (type, message) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const getAsOfLabel = () => new Date(filters.as_of_date).toLocaleDateString()
  const getPriorLabel = () => (comparativeData ? new Date(comparativeData.prior.as_of_date).toLocaleDateString() : '')

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: textColor, marginBottom: '8px', fontSize: '24px', fontWeight: '600' }}>Balance Sheet</h3>
        <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
          Statement of financial position showing assets, liabilities, and equity
        </p>
      </div>
      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      <BalanceSheetFilters
        filters={filters}
        onFilterChange={setFilters}
        onGenerate={handleGenerateReport}
        loading={loading}
      />
      {loading && <LoadingSpinner size="lg" text="Generating report..." />}
      {!loading && reportData && (
        <>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: textColor }}>As of {getAsOfLabel()}</h2>
              {comparativeData && (
                <p style={{ fontSize: '14px', color: textColor, opacity: 0.7, marginTop: '4px' }}>
                  Compared to: {getPriorLabel()}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="secondary" onClick={handleExport}>📊 Export to CSV</Button>
              <Button variant="secondary" onClick={() => window.print()}>🖨️ Print</Button>
            </div>
          </div>
          {comparativeData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ComparativeBalanceSheetTable
                data={comparativeData}
                currentLabel={getAsOfLabel()}
                priorLabel={getPriorLabel()}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: textColor }}>Current Period Detail</h3>
                  <BalanceSheetTable data={reportData} onAccountClick={handleAccountClick} />
                </div>
                <BalanceSheetChart data={reportData} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <BalanceSheetTable data={reportData} onAccountClick={handleAccountClick} />
              </div>
              <BalanceSheetChart data={reportData} />
            </div>
          )}
        </>
      )}
      {!loading && !reportData && (
        <div style={{ backgroundColor: cardBg, borderRadius: '8px', border: `1px solid ${borderColor}`, padding: '48px', textAlign: 'center' }}>
          <p style={{ color: textColor, opacity: 0.7, marginBottom: '16px' }}>
            Select a date and click "Generate Report" to view your Balance Sheet
          </p>
          <Button onClick={handleGenerateReport}>Generate Report</Button>
        </div>
      )}
    </div>
  )
}

// Cash Flow Tab
function CashFlowTab({ dateRange, formatCurrency, getAuthHeaders, setActiveTab }) {
  const [reportData, setReportData] = useState(null)
  const [comparativeData, setComparativeData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    comparison_type: 'none'
  })
  const [alert, setAlert] = useState(null)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const cardBg = isDarkMode ? '#1f1f1f' : '#ffffff'

  const handleGenerateReport = async () => {
    setLoading(true)
    try {
      if (filters.comparison_type === 'none') {
        const data = await reportService.getCashFlow(filters.start_date, filters.end_date)
        setReportData(data)
        setComparativeData(null)
      } else {
        const prior = filters.comparison_type === 'previous_period'
          ? reportService.calculatePriorPeriod(filters.start_date, filters.end_date)
          : reportService.calculatePriorYear(filters.start_date, filters.end_date)
        const data = await reportService.getComparativeCashFlow(
          filters.start_date,
          filters.end_date,
          prior.start,
          prior.end
        )
        setComparativeData(data)
        setReportData(data.current)
      }
      showAlert('success', 'Report generated successfully')
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!reportData) {
      showAlert('error', 'No report data to export')
      return
    }
    const op = reportData.operating_activities || {}
    const inv = reportData.investing_activities || {}
    const fin = reportData.financing_activities || {}
    const rows = [
      ['Cash Flow Statement'],
      [`Period: ${new Date(reportData.start_date).toLocaleDateString()} - ${new Date(reportData.end_date).toLocaleDateString()}`],
      [],
      ['OPERATING ACTIVITIES'],
      ['Net Income', (op.net_income ?? 0).toFixed(2)]
    ]
    ;(op.adjustments || []).forEach((item) => rows.push([`  ${item.description}`, item.amount.toFixed(2)]))
    ;(op.working_capital_changes || []).forEach((item) => rows.push([`  ${item.description}`, item.amount.toFixed(2)]))
    rows.push(['Net Cash from Operating Activities', (op.net_cash_from_operations ?? 0).toFixed(2)])
    rows.push([])
    rows.push(['INVESTING ACTIVITIES'])
    if ((inv.items || []).length === 0) rows.push(['  No investing activities'])
    else (inv.items || []).forEach((item) => rows.push([`  ${item.description}`, item.amount.toFixed(2)]))
    rows.push(['Net Cash from Investing Activities', (inv.net_cash_from_investing ?? 0).toFixed(2)])
    rows.push([])
    rows.push(['FINANCING ACTIVITIES'])
    if ((fin.items || []).length === 0) rows.push(['  No financing activities'])
    else (fin.items || []).forEach((item) => rows.push([`  ${item.description}`, item.amount.toFixed(2)]))
    rows.push(['Net Cash from Financing Activities', (fin.net_cash_from_financing ?? 0).toFixed(2)])
    rows.push([])
    rows.push(['NET CHANGE IN CASH', (reportData.net_change_in_cash ?? 0).toFixed(2)])
    rows.push(['Beginning Cash', (reportData.beginning_cash ?? 0).toFixed(2)])
    rows.push(['ENDING CASH', (reportData.ending_cash ?? 0).toFixed(2)])
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cash-flow-${filters.start_date}-to-${filters.end_date}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    showAlert('success', 'Report exported to CSV')
  }

  const handleAccountClick = (accountId) => {
    sessionStorage.setItem('selectedAccountId', accountId)
    setActiveTab('account-ledger')
  }

  const showAlert = (type, message) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const getPeriodLabel = () => `${new Date(filters.start_date).toLocaleDateString()} - ${new Date(filters.end_date).toLocaleDateString()}`
  const getPriorLabel = () => {
    if (!comparativeData?.prior) return ''
    const p = comparativeData.prior
    return `${new Date(p.start_date).toLocaleDateString()} - ${new Date(p.end_date).toLocaleDateString()}`
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ color: textColor, marginBottom: '8px', fontSize: '24px', fontWeight: '600' }}>Cash Flow Statement</h3>
        <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
          Statement of cash flows showing operating, investing, and financing activities
        </p>
      </div>
      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      <CashFlowFilters filters={filters} onFilterChange={setFilters} onGenerate={handleGenerateReport} loading={loading} />
      {loading && <LoadingSpinner size="lg" text="Generating report..." />}
      {!loading && reportData && (
        <>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: textColor }}>{getPeriodLabel()}</h2>
              {comparativeData && <p style={{ fontSize: '14px', color: textColor, opacity: 0.7, marginTop: '4px' }}>Compared to: {getPriorLabel()}</p>}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="secondary" onClick={handleExport}>📊 Export to CSV</Button>
              <Button variant="secondary" onClick={() => window.print()}>🖨️ Print</Button>
            </div>
          </div>
          {comparativeData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ComparativeCashFlowTable data={comparativeData} currentLabel={getPeriodLabel()} priorLabel={getPriorLabel()} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: textColor }}>Current Period Detail</h3>
                  <CashFlowTable data={reportData} onAccountClick={handleAccountClick} />
                </div>
                <CashFlowChart data={reportData} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <CashFlowTable data={reportData} onAccountClick={handleAccountClick} />
              </div>
              <CashFlowChart data={reportData} />
            </div>
          )}
        </>
      )}
      {!loading && !reportData && (
        <div style={{ backgroundColor: cardBg, borderRadius: '8px', border: `1px solid ${borderColor}`, padding: '48px', textAlign: 'center' }}>
          <p style={{ color: textColor, opacity: 0.7, marginBottom: '16px' }}>Select a date range and click "Generate Report" to view your Cash Flow Statement</p>
          <Button onClick={handleGenerateReport}>Generate Report</Button>
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
