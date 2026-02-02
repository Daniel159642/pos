import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import {
  LayoutDashboard,
  Settings as SettingsIcon,
  BookOpen,
  ArrowLeftRight,
  Library,
  TrendingUp,
  Wallet,
  Workflow,
  FileText,
  Receipt,
  Users,
  Truck,
  FileBarChart,
  PanelLeft,
  Plus
} from 'lucide-react'
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
import Input from '../components/common/Input'
import CustomDropdown from '../components/common/CustomDropdown'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { useToast } from '../contexts/ToastContext'
import {
  formTitleStyle,
  formLabelStyle,
  inputBaseStyle,
  formFieldContainerStyle,
  FormTitle,
  FormLabel,
  FormField,
  getInputFocusHandlers
} from '../components/FormStyles'

/** Download an array-of-arrays as Excel (.xlsx) using SheetJS */
async function downloadExcel(rows, filename) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, filename)
}

function Accounting() {
  const { themeMode, themeColor } = useTheme()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dateRange, setDateRange] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })
  const [sidebarMinimized, setSidebarMinimized] = useState(false)
  const [hoveringAccounting, setHoveringAccounting] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [isInitialMount, setIsInitialMount] = useState(true)
  const accountingHeaderRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialMount(false), 0)
    return () => clearTimeout(timer)
  }, [])

  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark-theme'))
  useEffect(() => {
    const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark-theme'))
    checkDarkMode()
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [themeMode])

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '132, 0, 255'
  }
  const themeColorRgb = hexToRgb(themeColor)
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

  const accountingSections = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
    { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
    { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
    { id: 'general-ledger', label: 'Ledger', icon: Library },
    { id: 'financial-statements', label: 'Financial Statements', icon: FileBarChart },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'bills', label: 'Bills', icon: Receipt },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'vendors', label: 'Vendors', icon: Truck }
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Sidebar Navigation - same as Profile */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: '56px',
        zIndex: 100,
        width: sidebarMinimized ? '60px' : '25%',
        height: 'calc(100vh - 56px)',
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        padding: sidebarMinimized ? '32px 10px 48px 10px' : '32px 10px 48px 10px',
        borderRight: `1px solid ${isDarkMode ? 'var(--border-light, #333)' : '#e0e0e0'}`,
        transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'stretch' }}>
          {/* Accounting Header */}
          <div
            ref={accountingHeaderRef}
            style={{ position: 'relative' }}
            onMouseEnter={() => {
              setHoveringAccounting(true)
              setShowTooltip(true)
              if (accountingHeaderRef.current) {
                const rect = accountingHeaderRef.current.getBoundingClientRect()
                setTooltipPosition(sidebarMinimized
                  ? { top: rect.top + rect.height / 2, left: rect.right + 8 }
                  : { top: rect.bottom + 4, left: rect.left }
                )
              }
            }}
            onMouseLeave={() => { setHoveringAccounting(false); setShowTooltip(false) }}
          >
            <button
              onClick={() => setSidebarMinimized(!sidebarMinimized)}
              style={{
                width: sidebarMinimized ? '40px' : '100%',
                height: '40px',
                padding: 0,
                margin: 0,
                border: 'none',
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarMinimized ? 'center' : 'flex-start',
                transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), justifyContent 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px' }}>
                {sidebarMinimized ? <PanelLeft size={20} /> : (hoveringAccounting ? <PanelLeft size={20} /> : <LayoutDashboard size={20} />)}
              </div>
              {!sidebarMinimized && (
                <span style={{ marginLeft: '48px', fontSize: '14px', fontWeight: 600, color: isDarkMode ? 'var(--text-primary, #fff)' : '#333', whiteSpace: 'nowrap' }}>
                  Accounting
                </span>
              )}
            </button>
          </div>
          {showTooltip && (
            <div style={{
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
            }}>
              {sidebarMinimized ? 'Open sidebar' : 'Close sidebar'}
            </div>
          )}
          {accountingSections.map((section) => {
            const Icon = section.icon
            const isActive = activeTab === section.id
            return (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                style={{
                  width: sidebarMinimized ? '40px' : '100%',
                  height: '40px',
                  padding: 0,
                  margin: 0,
                  border: 'none',
                  backgroundColor: isActive ? (isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)') : 'transparent',
                  borderRadius: isActive ? '6px' : 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarMinimized ? 'center' : 'flex-start',
                  transition: isInitialMount ? 'backgroundColor 0.2s ease, borderRadius 0.2s ease' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), justifyContent 0.4s cubic-bezier(0.4, 0, 0.2, 1), backgroundColor 0.2s ease, borderRadius 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  color: isActive ? (isDarkMode ? 'var(--text-primary, #fff)' : '#333') : (isDarkMode ? 'var(--text-secondary, #ccc)' : '#666'),
                  fontWeight: isActive ? 600 : 'normal'
                }}
              >
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px' }}>
                  <Icon size={20} />
                </div>
                {!sidebarMinimized && (
                  <span style={{ marginLeft: '48px', fontSize: '14px', fontWeight: isActive ? 600 : 'normal', whiteSpace: 'nowrap' }}>
                    {section.label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content - same as Profile */}
      <div style={{
        marginLeft: sidebarMinimized ? '60px' : '25%',
        width: sidebarMinimized ? 'calc(100% - 60px)' : '75%',
        flex: 1,
        padding: '48px 64px 64px 64px',
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : 'white',
        maxWidth: sidebarMinimized ? 'none' : '1200px',
        transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Error Display */}
        {error && (
          <div style={{ padding: '16px', marginBottom: '20px', backgroundColor: isDarkMode ? '#4a1a1a' : '#fee', border: `1px solid ${isDarkMode ? '#6a2a2a' : '#fcc'}`, borderRadius: '8px', color: isDarkMode ? '#ff6b6b' : '#c33', ...formFieldContainerStyle }}>
            Error: {error}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'dashboard' && <DashboardTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
        {activeTab === 'settings' && <SettingsTab formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} />}
        {activeTab === 'chart-of-accounts' && <ChartOfAccountsTab formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} />}
        {activeTab === 'transactions' && <TransactionsTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} />}
        {activeTab === 'general-ledger' && <GeneralLedgerTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} />}
        {activeTab === 'account-ledger' && (
          <AccountLedgerTab
            key={`account-ledger-${sessionStorage.getItem('selectedAccountId') || ''}`}
            dateRange={dateRange}
            formatCurrency={formatCurrency}
            getAuthHeaders={getAuthHeaders}
            setActiveTab={setActiveTab}
            themeColorRgb={themeColorRgb}
            isDarkMode={isDarkMode}
          />
        )}
        {activeTab === 'financial-statements' && (
          <FinancialStatementsTab
            dateRange={dateRange}
            formatCurrency={formatCurrency}
            getAuthHeaders={getAuthHeaders}
            setActiveTab={setActiveTab}
            themeColorRgb={themeColorRgb}
            isDarkMode={isDarkMode}
          />
        )}
        {activeTab === 'invoices' && <InvoicesTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
        {activeTab === 'bills' && <BillsTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
        {activeTab === 'customers' && <CustomersTab formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
        {activeTab === 'vendors' && <VendorsTab formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
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
      const [trialBalanceRes, pnlRes, dashboardRes] = await Promise.all([
        fetch(`/api/accounting/trial-balance?as_of_date=${dateRange.end_date}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null),
        fetch(`/api/accounting/profit-loss?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null),
        fetch(`/api/accounting/dashboard?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`, { headers: getAuthHeaders() }).then(r => r.ok ? r.json() : null)
      ])
      const trialBalanceRows = Array.isArray(trialBalanceRes?.data?.accounts) ? trialBalanceRes.data.accounts : []
      const pnlData = pnlRes?.data || {}
      const dashboardData = dashboardRes?.pos_summary != null ? dashboardRes : null
      const laborData = dashboardRes?.labor_summary != null ? dashboardRes.labor_summary : { total_hours: 0, total_labor_cost: 0, entries: [] }
      setData({ trialBalance: trialBalanceRows, pnl: pnlData, dashboard: dashboardData, labor: laborData })
    } catch (err) {
      console.error('Error loading dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ color: textColor, padding: '40px', textAlign: 'center' }}>Loading dashboard...</div>
  }

  // Trial balance rows use total_debits / total_credits (from API)
  const totalDebits = Array.isArray(data?.trialBalance) ? data.trialBalance.reduce((sum, row) => sum + (parseFloat(row.total_debits) || 0), 0) : 0
  const totalCredits = Array.isArray(data?.trialBalance) ? data.trialBalance.reduce((sum, row) => sum + (parseFloat(row.total_credits) || 0), 0) : 0
  // P&L API returns net_income directly
  const netIncome = typeof data?.pnl?.net_income === 'number' ? data.pnl.net_income : (parseFloat(data?.pnl?.net_income) || 0)

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

      {/* POS Summary – transactions from actual POS */}
      {data?.dashboard?.pos_summary && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ color: textColor, marginBottom: '12px' }}>POS Summary (date range)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            <MetricCard title="Transactions" value={String(data.dashboard.pos_summary.transaction_count ?? 0)} color="#6366f1" cardBackgroundColor={cardBg} borderColor={borderColor} textColor={textColor} />
            <MetricCard title="Revenue" value={formatCurrency(data.dashboard.pos_summary.revenue)} color="#10b981" cardBackgroundColor={cardBg} borderColor={borderColor} textColor={textColor} />
            <MetricCard title="Tax Collected" value={formatCurrency(data.dashboard.pos_summary.tax_collected)} color="#3b82f6" cardBackgroundColor={cardBg} borderColor={borderColor} textColor={textColor} />
            <MetricCard title="CC/Processing Fees" value={formatCurrency(data.dashboard.pos_summary.transaction_fees)} color="#f59e0b" cardBackgroundColor={cardBg} borderColor={borderColor} textColor={textColor} />
            <MetricCard title="Returns" value={formatCurrency(data.dashboard.pos_summary.returns_total)} color="#ef4444" cardBackgroundColor={cardBg} borderColor={borderColor} textColor={textColor} />
            <MetricCard title="COGS" value={formatCurrency(data.dashboard.pos_summary.cogs)} color="#8b5cf6" cardBackgroundColor={cardBg} borderColor={borderColor} textColor={textColor} />
            <MetricCard title="Margin (Price − Cost)" value={formatCurrency(data.dashboard.pos_summary.margin)} color={((data.dashboard.pos_summary.margin || 0) >= 0) ? '#10b981' : '#ef4444'} cardBackgroundColor={cardBg} borderColor={borderColor} textColor={textColor} />
          </div>
        </div>
      )}

      {/* Labor – hours worked and labor cost (always show so users see the section and hint) */}
      {data?.labor && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ color: textColor, marginBottom: '12px' }}>Labor (hours worked)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <MetricCard title="Total Hours" value={String(data.labor.total_hours ?? 0)} color="#0ea5e9" cardBackgroundColor={cardBg} borderColor={borderColor} textColor={textColor} />
            <MetricCard title="Labor Cost" value={formatCurrency(data.labor.total_labor_cost)} color="#06b6d4" cardBackgroundColor={cardBg} borderColor={borderColor} textColor={textColor} />
          </div>
          <p style={{ color: textColor, opacity: 0.8, fontSize: '13px' }}>Configure hourly wage per employee in <strong>Employees</strong>.</p>
          {Array.isArray(data.labor.entries) && data.labor.entries.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <th style={{ textAlign: 'left', padding: '8px', color: textColor }}>Employee</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: textColor }}>Hours</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: textColor }}>Hourly rate</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: textColor }}>Labor cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.labor.entries.map((e, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
                      <td style={{ padding: '8px', color: textColor }}>{e.employee_name || `Employee ${e.employee_id}`}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: textColor }}>{e.hours}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: textColor }}>{formatCurrency(e.hourly_rate)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: textColor }}>{formatCurrency(e.labor_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      
      <div style={{ 
        padding: '20px',
        backgroundColor: cardBg,
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        marginTop: '24px'
      }}>
        <h3 style={{ ...formTitleStyle(isDarkMode), marginBottom: '16px', fontSize: '18px' }}>Quick Links</h3>
        <p style={{ color: textColor, opacity: 0.8, fontSize: '14px', lineHeight: '1.8' }}>
          Welcome to the Accounting System! This system uses double-entry bookkeeping principles.
          <br /><br />
          <strong>Key Features:</strong>
          <br />• Chart of Accounts with hierarchical structure
          <br />• Journal Entries with automatic balance validation
          <br />• Invoice and Bill management
          <br />• Customer and Vendor tracking
          <br />• Financial Reports (Trial Balance, Income Statement, Balance Sheet)
          <br />• Complete audit trail
        </p>
      </div>
    </div>
  )
}

// Settings tab: sales tax %, transaction fee rates, note about hourly wages
function SettingsTab({ formatCurrency, getAuthHeaders, themeColorRgb = '132, 0, 255', isDarkMode: isDarkModeProp }) {
  const { show: showToast } = useToast()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [edit, setEdit] = useState({ default_sales_tax_pct: '', transaction_fee_rates: {} })
  const isDarkMode = isDarkModeProp ?? document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const cardBg = isDarkMode ? '#1f1f1f' : '#f9f9f9'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/accounting/settings', { headers: getAuthHeaders() })
      const json = await res.json()
      if (json.success && json.data) {
        setSettings(json.data)
        setEdit({
          default_sales_tax_pct: String(json.data.default_sales_tax_pct ?? 8),
          transaction_fee_rates: { ...(json.data.transaction_fee_rates || {}) }
        })
      }
    } catch (err) {
      console.error('Error loading settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const payload = {
        default_sales_tax_pct: parseFloat(edit.default_sales_tax_pct) || 0,
        transaction_fee_rates: edit.transaction_fee_rates
      }
      const res = await fetch('/api/accounting/settings', {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (json.success) {
        setSettings(json.data)
        showToast('Settings saved.', 'success')
      } else {
        showToast(json.message || 'Failed to save', 'error')
      }
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const setFeeRate = (method, value) => {
    setEdit(prev => ({
      ...prev,
      transaction_fee_rates: { ...prev.transaction_fee_rates, [method]: parseFloat(value) || 0 }
    }))
  }

  if (loading) return <div style={{ color: textColor, padding: '40px', textAlign: 'center' }}>Loading settings...</div>

  const rates = edit.transaction_fee_rates || {}
  const feeMethods = ['credit_card', 'debit_card', 'mobile_payment', 'cash', 'check', 'store_credit']

  return (
    <div>
      <div style={{ padding: '20px', backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: '8px', maxWidth: '560px' }}>
        <FormTitle isDarkMode={isDarkMode} style={{ fontSize: '18px', marginBottom: '16px' }}>Store accounting settings</FormTitle>
        <FormField>
          <FormLabel isDarkMode={isDarkMode}>Default sales tax (%)</FormLabel>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={edit.default_sales_tax_pct}
            onChange={e => setEdit(prev => ({ ...prev, default_sales_tax_pct: e.target.value }))}
            {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
            style={{ ...inputBaseStyle(isDarkMode, themeColorRgb, false), width: '120px' }}
          />
          <span style={{ marginLeft: '8px', color: textColor, opacity: 0.8 }}>% (e.g. 8 for 8%)</span>
        </FormField>
        <FormField>
          <FormLabel isDarkMode={isDarkMode}>Transaction fee rates (card/processing)</FormLabel>
          <p style={{ fontSize: '13px', color: textColor, opacity: 0.8, marginBottom: '8px' }}>As decimal (e.g. 0.029 = 2.9%). Cash/check/store credit typically 0.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {feeMethods.map(method => (
              <div key={method} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ ...formLabelStyle(isDarkMode), marginBottom: 0, minWidth: '110px', fontSize: '13px' }}>{method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.001"
                  value={rates[method] ?? 0}
                  onChange={e => setFeeRate(method, e.target.value)}
                  {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                  style={{ ...inputBaseStyle(isDarkMode, themeColorRgb, false), width: '80px' }}
                />
              </div>
            ))}
          </div>
        </FormField>
        <FormField>
          <div style={{ padding: '12px', backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#f3f4f6', borderRadius: '8px' }}>
            <strong style={{ color: textColor }}>Hourly wage</strong>
            <p style={{ fontSize: '13px', color: textColor, opacity: 0.8, marginTop: '4px' }}>Set each employee’s hourly rate in <strong>Employees</strong>. Labor cost on the Dashboard uses time clock hours × hourly rate.</p>
          </div>
        </FormField>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '4px 16px',
            height: '28px',
            backgroundColor: saving ? borderColor : `rgba(${themeColorRgb}, 0.7)`,
            color: '#fff',
            border: `1px solid rgba(${themeColorRgb}, 0.5)`,
            borderRadius: '8px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            fontSize: '14px',
            boxShadow: saving ? 'none' : `0 4px 15px rgba(${themeColorRgb}, 0.3)`,
            transition: 'all 0.2s ease'
          }}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
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
function ChartOfAccountsTab({ formatCurrency, getAuthHeaders, themeColorRgb, isDarkMode }) {
  const { show: showToast } = useToast()
  const [accounts, setAccounts] = useState([])
  const [filteredAccounts, setFilteredAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({})
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [accountBalance, setAccountBalance] = useState(null)

  const _isDark = isDarkMode ?? document.documentElement.classList.contains('dark-theme')
  const textColor = _isDark ? '#ffffff' : '#1a1a1a'
  const borderColor = _isDark ? '#3a3a3a' : '#e0e0e0'
  const cardBg = _isDark ? '#1f1f1f' : '#ffffff'

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
      showToast(err.response?.data?.message || 'Failed to fetch accounts', 'error')
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
      showToast('Account created successfully', 'success')
      setIsCreateModalOpen(false)
      loadAccounts()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create account', 'error')
      throw error
    }
  }

  const handleUpdateAccount = async (data) => {
    if (!selectedAccount) return
    
    try {
      await accountService.updateAccount(selectedAccount.id, data)
      showToast('Account updated successfully', 'success')
      setIsEditModalOpen(false)
      setSelectedAccount(null)
      loadAccounts()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to update account', 'error')
      throw error
    }
  }

  const handleDeleteAccount = async (account) => {
    if (!window.confirm(`Are you sure you want to delete "${account.account_name}"?`)) {
      return
    }

    try {
      await accountService.deleteAccount(account.id)
      showToast('Account deleted successfully', 'success')
      loadAccounts()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete account', 'error')
    }
  }

  const handleToggleStatus = async (account) => {
    try {
      await accountService.toggleAccountStatus(account.id)
      showToast(`Account ${account.is_active ? 'deactivated' : 'activated'} successfully`, 'success')
      loadAccounts()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to toggle account status', 'error')
    }
  }

  const handleViewBalance = async (account) => {
    try {
      const balance = await accountService.getAccountBalance(account.id)
      setAccountBalance(balance)
      setSelectedAccount(account)
      setIsBalanceModalOpen(true)
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to fetch account balance', 'error')
    }
  }

  const handleClearFilters = () => {
    setFilters({})
  }

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading accounts..." />
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: _isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>Chart of Accounts</h1>
        <p style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Your chart of accounts lists all ledger accounts (assets, liabilities, equity, revenue, expenses). Organize accounts, track balances, and run reports from here.</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search accounts..."
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderBottom: _isDark ? '2px solid #404040' : '2px solid #ddd',
                borderRadius: 0,
                backgroundColor: 'transparent',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
                color: _isDark ? '#fff' : '#333',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderBottomColor = `rgba(${themeColorRgb || '59, 130, 246'}, 0.7)`
              }}
              onBlur={(e) => {
                e.target.style.borderBottomColor = _isDark ? '#404040' : '#ddd'
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            title="Create account"
            style={{
              padding: '4px',
              width: '32px',
              height: '32px',
              backgroundColor: `rgba(${themeColorRgb || '59, 130, 246'}, 0.7)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: `0 4px 15px rgba(${themeColorRgb || '59, 130, 246'}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb || '59, 130, 246'}, 0.8)`
              e.currentTarget.style.boxShadow = `0 4px 20px rgba(${themeColorRgb || '59, 130, 246'}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb || '59, 130, 246'}, 0.7)`
              e.currentTarget.style.boxShadow = `0 4px 15px rgba(${themeColorRgb || '59, 130, 246'}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <AccountFilters
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
      />

      <div
        style={{
          backgroundColor: _isDark ? '#2a2a2a' : 'white',
          borderRadius: '8px',
          boxShadow: _isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid ' + (_isDark ? '#3a3a3a' : '#e5e7eb'),
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <p style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>
            Showing {filteredAccounts.length} of {accounts.length} accounts
          </p>
        </div>
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
function TransactionsTab({ dateRange, formatCurrency, getAuthHeaders, themeColorRgb, isDarkMode }) {
  const { show: showToast } = useToast()
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

  const _isDark = isDarkMode ?? document.documentElement.classList.contains('dark-theme')
  const textColor = _isDark ? '#ffffff' : '#1a1a1a'
  const borderColor = _isDark ? '#3a3a3a' : '#e0e0e0'
  const cardBg = _isDark ? '#1f1f1f' : '#ffffff'

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
      showToast(err.response?.data?.message || 'Failed to fetch transactions', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTransaction = async (data, postImmediately) => {
    try {
      const transaction = await transactionService.createTransaction(data)
      
      if (postImmediately) {
        await transactionService.postTransaction(transaction.transaction.id)
        showToast('Transaction created and posted successfully', 'success')
      } else {
        showToast('Transaction created successfully', 'success')
      }
      
      setIsCreateModalOpen(false)
      loadTransactions()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create transaction', 'error')
      throw error
    }
  }

  const handleUpdateTransaction = async (data) => {
    if (!selectedTransaction) return
    
    try {
      await transactionService.updateTransaction(selectedTransaction.transaction.id, data)
      showToast('Transaction updated successfully', 'success')
      setIsEditModalOpen(false)
      setSelectedTransaction(null)
      loadTransactions()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to update transaction', 'error')
      throw error
    }
  }

  const handleDeleteTransaction = async (transaction) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return
    }

    try {
      await transactionService.deleteTransaction(transaction.transaction.id)
      showToast('Transaction deleted successfully', 'success')
      loadTransactions()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete transaction', 'error')
    }
  }

  const handlePostTransaction = async (transaction) => {
    if (!window.confirm('Post this transaction? This will affect account balances.')) {
      return
    }

    try {
      await transactionService.postTransaction(transaction.transaction.id)
      showToast('Transaction posted successfully', 'success')
      loadTransactions()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to post transaction', 'error')
    }
  }

  const handleUnpostTransaction = async (transaction) => {
    if (!window.confirm('Unpost this transaction? This will reverse its effect on account balances.')) {
      return
    }

    try {
      await transactionService.unpostTransaction(transaction.transaction.id)
      showToast('Transaction unposted successfully', 'success')
      loadTransactions()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to unpost transaction', 'error')
    }
  }

  const handleVoidTransaction = async (transaction) => {
    const reason = window.prompt('Enter reason for voiding this transaction:')
    if (!reason) return

    try {
      await transactionService.voidTransaction(transaction.transaction.id, reason)
      showToast('Transaction voided successfully', 'success')
      loadTransactions()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to void transaction', 'error')
    }
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
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: _isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>Transactions</h1>
        <p style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Record and manage journal entries</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by transaction number or description..."
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderBottom: _isDark ? '2px solid #404040' : '2px solid #ddd',
                borderRadius: 0,
                backgroundColor: 'transparent',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
                color: _isDark ? '#fff' : '#333',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderBottomColor = `rgba(${themeColorRgb || '59, 130, 246'}, 0.7)`
              }}
              onBlur={(e) => {
                e.target.style.borderBottomColor = _isDark ? '#404040' : '#ddd'
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            title="New transaction"
            style={{
              padding: '4px',
              width: '32px',
              height: '32px',
              backgroundColor: `rgba(${themeColorRgb || '59, 130, 246'}, 0.7)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: `0 4px 15px rgba(${themeColorRgb || '59, 130, 246'}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb || '59, 130, 246'}, 0.8)`
              e.currentTarget.style.boxShadow = `0 4px 20px rgba(${themeColorRgb || '59, 130, 246'}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb || '59, 130, 246'}, 0.7)`
              e.currentTarget.style.boxShadow = `0 4px 15px rgba(${themeColorRgb || '59, 130, 246'}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <TransactionFilters
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
      />

      <div
        style={{
          backgroundColor: _isDark ? '#2a2a2a' : 'white',
          borderRadius: '8px',
          boxShadow: _isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid ' + (_isDark ? '#3a3a3a' : '#e5e7eb'),
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <p style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>
            Showing {transactions.length} of {pagination.total} transactions
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={filters.page === 1}
              size="sm"
              variant="secondary"
              themeColorRgb={themeColorRgb}
              isDarkMode={isDarkMode}
            >
              Previous
            </Button>
            <span style={{ padding: '0 12px', fontSize: '14px', color: _isDark ? '#d1d5db' : '#374151' }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={filters.page === pagination.totalPages}
              size="sm"
              variant="secondary"
              themeColorRgb={themeColorRgb}
              isDarkMode={isDarkMode}
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
  const cardBg = isDarkMode ? '#2a2a2a' : 'white'

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
        setInvoices(Array.isArray(data) ? data : (data?.data ?? []))
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
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', margin: 0 }}>Invoices</h1>
        <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Sales you&apos;ve sent to customers for the selected date range. Track amounts owed and payment status.</p>
      </div>
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
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: textColor, opacity: 0.8 }}>
                  No invoices found for this period.
                </td>
              </tr>
            ) : (
              invoices.map(inv => (
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// General Ledger Tab
function GeneralLedgerTab({ dateRange, formatCurrency, getAuthHeaders, themeColorRgb, isDarkMode }) {
  const [entries, setEntries] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    start_date: dateRange.start_date,
    end_date: dateRange.end_date
  })
  
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  
  const { show: showToast } = useToast()
  const _isDark = isDarkMode ?? document.documentElement.classList.contains('dark-theme')
  const textColor = _isDark ? '#ffffff' : '#1a1a1a'
  const borderColor = _isDark ? '#3a3a3a' : '#e0e0e0'
  const cardBg = _isDark ? '#1f1f1f' : '#ffffff'

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
      showToast(err.response?.data?.message || 'Failed to fetch ledger entries', 'error')
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
      showToast('Failed to fetch transaction details', 'error')
    }
  }

  const buildGeneralLedgerRows = () => {
    const headers = ['Date', 'Transaction #', 'Account', 'Description', 'Debit', 'Credit']
    const rows = entries.map(entry => {
      const debit = parseFloat(entry.debit_amount) || 0
      const credit = parseFloat(entry.credit_amount) || 0
      return [
        new Date(entry.transaction_date).toLocaleDateString(),
        entry.transaction_number,
        `${entry.account_number || ''} ${entry.account_name}`.trim(),
        entry.line_description,
        debit > 0 ? debit.toFixed(2) : '',
        credit > 0 ? credit.toFixed(2) : '',
      ]
    })
    const totalDebits = entries.reduce((sum, e) => sum + (parseFloat(e.debit_amount) || 0), 0)
    const totalCredits = entries.reduce((sum, e) => sum + (parseFloat(e.credit_amount) || 0), 0)
    rows.push(['', '', '', 'TOTALS', totalDebits.toFixed(2), totalCredits.toFixed(2)])
    return [headers, ...rows]
  }

  const handleExport = () => {
    if (entries.length === 0) {
      showToast('No data to export', 'error')
      return
    }
    const allRows = buildGeneralLedgerRows()
    const csvContent = allRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `general-ledger-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    showToast('Ledger exported to CSV', 'success')
  }

  const handleExportExcel = async () => {
    if (entries.length === 0) {
      showToast('No data to export', 'error')
      return
    }
    try {
      await downloadExcel(buildGeneralLedgerRows(), `general-ledger-${new Date().toISOString().split('T')[0]}.xlsx`)
      showToast('Ledger exported to Excel', 'success')
    } catch (e) {
      showToast('Excel export failed', 'error')
    }
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

  const totalDebits = entries.reduce((sum, e) => sum + (parseFloat(e.debit_amount) || 0), 0)
  const totalCredits = entries.reduce((sum, e) => sum + (parseFloat(e.credit_amount) || 0), 0)

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: _isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>Ledger</h1>
        <p style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>View all posted accounting transactions</p>
      </div>

      <GeneralLedgerFilters
        filters={filters}
        accounts={accounts}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
        onExport={handleExport}
        onExportExcel={handleExportExcel}
        loading={loading}
      />

      {loading ? (
        <LoadingSpinner size="lg" text="Loading ledger entries..." />
      ) : (
        <div
          style={{
            backgroundColor: _isDark ? '#2a2a2a' : 'white',
            borderRadius: '8px',
            boxShadow: _isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid ' + (_isDark ? '#3a3a3a' : '#e5e7eb'),
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <p style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>
              Showing {entries.length} entries
              {filters.account_id ? ` for ${getSelectedAccountName()}` : ''}
              {filters.start_date && filters.end_date && ` · ${new Date(filters.start_date).toLocaleDateString()} – ${new Date(filters.end_date).toLocaleDateString()}`}
            </p>
            {entries.length > 0 && (
              <span style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280' }}>
                Debits: ${totalDebits.toFixed(2)} · Credits: ${totalCredits.toFixed(2)}
              </span>
            )}
          </div>

          <GeneralLedgerTable
            entries={entries}
            showRunningBalance={false}
            onViewTransaction={handleViewTransaction}
          />
        </div>
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
function AccountLedgerTab({ dateRange, formatCurrency, getAuthHeaders, setActiveTab, themeColorRgb, isDarkMode }) {
  const [ledgerData, setLedgerData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    start_date: dateRange.start_date,
    end_date: dateRange.end_date
  })
  
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  
  const { show: showToast } = useToast()
  const _isDark = isDarkMode ?? document.documentElement.classList.contains('dark-theme')
  const textColor = _isDark ? '#ffffff' : '#1a1a1a'
  const borderColor = _isDark ? '#3a3a3a' : '#e0e0e0'
  const cardBg = _isDark ? '#1f1f1f' : '#ffffff'

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
    setLedgerData(null)
    try {
      const data = await transactionService.getAccountLedger(accountId, filters)
      if (data && data.account && Array.isArray(data.entries)) {
        setLedgerData(data)
      } else {
        showToast('Invalid account ledger response', 'error')
      }
    } catch (err) {
      console.error('Error loading account ledger:', err)
      showToast(err.response?.data?.message || 'Failed to fetch account ledger', 'error')
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
      showToast('Failed to fetch transaction details', 'error')
    }
  }

  const buildAccountLedgerRows = () => {
    if (!ledgerData?.account || !Array.isArray(ledgerData?.entries)) return []
    const headers = ['Date', 'Transaction #', 'Description', 'Debit', 'Credit', 'Balance']
    const rows = ledgerData.entries.map(entry => [
      new Date(entry.transaction_date).toLocaleDateString(),
      entry.transaction_number,
      entry.line_description,
      entry.debit_amount > 0 ? entry.debit_amount.toFixed(2) : '',
      entry.credit_amount > 0 ? entry.credit_amount.toFixed(2) : '',
      entry.running_balance?.toFixed(2) || '',
    ])
    return [
      [`Account: ${ledgerData.account?.account_number || ''} ${ledgerData.account?.account_name || ''}`],
      [`Ending Balance: $${Number(ledgerData.ending_balance).toFixed(2)}`],
      [],
      headers,
      ...rows
    ]
  }

  const handleExport = () => {
    if (!ledgerData || ledgerData.entries.length === 0) {
      showToast('No data to export', 'error')
      return
    }
    const allRows = buildAccountLedgerRows()
    const csvContent = allRows.map(row => (Array.isArray(row) ? row : [row]).map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `account-ledger-${accountId}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    showToast('Account ledger exported to CSV', 'success')
  }

  const handleExportExcel = async () => {
    if (!ledgerData || ledgerData.entries.length === 0) {
      showToast('No data to export', 'error')
      return
    }
    try {
      await downloadExcel(buildAccountLedgerRows(), `account-ledger-${accountId}-${new Date().toISOString().split('T')[0]}.xlsx`)
      showToast('Account ledger exported to Excel', 'success')
    } catch (e) {
      showToast('Excel export failed', 'error')
    }
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
      <div style={{ padding: '16px', color: textColor, backgroundColor: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fee2e2', border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca'}`, borderRadius: '8px' }}>
        No account selected. Please select an account from Chart of Accounts.
      </div>
    )
  }

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading account ledger..." />
  }

  const hasValidLedger = ledgerData?.account && Array.isArray(ledgerData?.entries)
  if (!ledgerData || !hasValidLedger) {
    return (
      <div style={{ padding: '16px', color: textColor, backgroundColor: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fee2e2', border: `1px solid ${isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca'}`, borderRadius: '8px' }}>
        Failed to load account ledger
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
          themeColorRgb={themeColorRgb}
          isDarkMode={isDarkMode}
        >
          ← Back to Accounts
        </Button>
        <div>
          <h3 style={{ ...formTitleStyle(isDarkMode), marginBottom: '4px', fontSize: '24px' }}>
            Account Ledger
          </h3>
          <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
            {ledgerData.account?.account_number && `${ledgerData.account.account_number} - `}
            {ledgerData.account?.account_name ?? '—'}
          </p>
        </div>
      </div>

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
        <h3 style={{ ...formTitleStyle(isDarkMode), fontSize: '18px', marginBottom: '16px' }}>
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

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px', visibility: 'hidden', lineHeight: 1.2 }} aria-hidden>Actions</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                type="button"
                variant="primary"
                onClick={handleClearFilters}
                style={{ flex: 1 }}
                themeColorRgb={themeColorRgb}
                isDarkMode={isDarkMode}
              >
                Clear Filters
              </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleExport}
              style={{ flex: 1 }}
              themeColorRgb={themeColorRgb}
              isDarkMode={isDarkMode}
            >
              📊 Export to CSV
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleExportExcel}
              style={{ flex: 1 }}
              themeColorRgb={themeColorRgb}
              isDarkMode={isDarkMode}
            >
              📗 Export to Excel
            </Button>
            </div>
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

// Financial Statements Tab (Income Statement, Balance Sheet, Cash Flow with dropdown)
function FinancialStatementsTab({ dateRange, formatCurrency, getAuthHeaders, setActiveTab, themeColorRgb, isDarkMode }) {
  const [reportType, setReportType] = useState('profit-loss')
  const [generateButtonState, setGenerateButtonState] = useState({ loading: false, disabled: true, hasReportData: false })
  const [exportChoice, setExportChoice] = useState('')
  const generateReportRef = useRef(null)
  const _isDark = isDarkMode ?? document.documentElement.classList.contains('dark-theme')

  const exportOptions = [
    { value: 'csv', label: 'Export to CSV' },
    { value: 'excel', label: 'Export to Excel' },
    { value: 'print', label: 'Print' }
  ]
  const handleExportSelect = (e) => {
    const v = e?.target?.value
    setExportChoice('')
    if (v === 'csv') generateReportRef.current?.exportToCsv()
    else if (v === 'excel') generateReportRef.current?.exportToExcel()
    else if (v === 'print') generateReportRef.current?.print()
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: _isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>Financial Statements</h1>
        <p style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Profit & Loss, Balance Sheet, Cash Flow, Trial Balance</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <CustomDropdown
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          options={[
            { value: 'profit-loss', label: 'Income Statement' },
            { value: 'balance-sheet', label: 'Balance Sheet' },
            { value: 'cash-flow', label: 'Cash Flow Statement' },
            { value: 'trial-balance', label: 'Trial Balance' }
          ]}
          placeholder="Report type"
          isDarkMode={isDarkMode}
          themeColorRgb={themeColorRgb || '132, 0, 255'}
          triggerVariant="button"
          triggerFullWidth
          style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
        />
        <Button
          type="button"
          onClick={() => generateReportRef.current?.generateReport()}
          disabled={generateButtonState.loading || generateButtonState.disabled}
          themeColorRgb={themeColorRgb}
          isDarkMode={isDarkMode}
        >
          {generateButtonState.loading ? 'Generating...' : 'Generate Report'}
        </Button>
        <CustomDropdown
          value={exportChoice}
          onChange={handleExportSelect}
          options={exportOptions}
          placeholder="Export"
          isDarkMode={isDarkMode}
          themeColorRgb={themeColorRgb || '132, 0, 255'}
          triggerVariant="button"
          disabled={!generateButtonState.hasReportData}
          style={{ marginBottom: 0, width: 'auto' }}
        />
      </div>

      {reportType === 'trial-balance' && (
        <TrialBalanceTab ref={generateReportRef} onGenerateStateChange={setGenerateButtonState} dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} hideTitle themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} />
      )}
      {reportType === 'profit-loss' && (
        <ProfitLossTab ref={generateReportRef} onGenerateStateChange={setGenerateButtonState} dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} setActiveTab={setActiveTab} hideTitle themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} />
      )}
      {reportType === 'balance-sheet' && (
        <BalanceSheetTab ref={generateReportRef} onGenerateStateChange={setGenerateButtonState} dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} setActiveTab={setActiveTab} hideTitle themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} />
      )}
      {reportType === 'cash-flow' && (
        <CashFlowTab ref={generateReportRef} onGenerateStateChange={setGenerateButtonState} dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} setActiveTab={setActiveTab} hideTitle themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} />
      )}
    </div>
  )
}

// Trial Balance Tab (Financial Statements dropdown)
const TrialBalanceTab = forwardRef(function TrialBalanceTab(
  { dateRange, formatCurrency, getAuthHeaders, hideTitle = false, themeColorRgb, isDarkMode, onGenerateStateChange },
  ref
) {
  const { show: showToast } = useToast()
  const [filters, setFilters] = useState({ as_of_date: dateRange.end_date })
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const _isDark = isDarkMode ?? document.documentElement.classList.contains('dark-theme')
  const textColor = _isDark ? '#ffffff' : '#1a1a1a'
  const borderColor = _isDark ? '#3a3a3a' : '#e5e7eb'
  const cardBg = _isDark ? '#1f1f1f' : '#ffffff'
  const rgb = themeColorRgb || '132, 0, 255'

  useEffect(() => {
    setFilters(prev => ({ ...prev, as_of_date: dateRange.end_date }))
  }, [dateRange.end_date])

  useEffect(() => {
    onGenerateStateChange?.({ loading, disabled: !filters.as_of_date, hasReportData: !!reportData })
  }, [loading, filters.as_of_date, onGenerateStateChange, reportData])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  const setPresetDate = (preset) => {
    const today = new Date()
    let asOfDate
    switch (preset) {
      case 'today':
        asOfDate = today
        break
      case 'end_of_month':
        asOfDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        break
      case 'end_of_last_month':
        asOfDate = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'end_of_quarter':
        asOfDate = new Date(today.getFullYear(), (Math.floor(today.getMonth() / 3) + 1) * 3, 0)
        break
      case 'end_of_year':
        asOfDate = new Date(today.getFullYear(), 11, 31)
        break
      case 'end_of_last_year':
        asOfDate = new Date(today.getFullYear() - 1, 11, 31)
        break
      default:
        return
    }
    setFilters(prev => ({ ...prev, as_of_date: asOfDate.toISOString().split('T')[0] }))
  }

  const handleGenerateReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/accounting/trial-balance?as_of_date=${encodeURIComponent(filters.as_of_date)}`,
        { headers: getAuthHeaders() }
      )
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load trial balance')
      setReportData(data)
      showToast('Trial balance generated successfully', 'success')
    } catch (err) {
      console.error('Error loading trial balance:', err)
      setReportData(null)
      showToast(err.message || 'Failed to load trial balance', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!reportData) {
      showToast('No report data to export', 'error')
      return
    }
    const payload = reportData?.data ?? reportData
    const accounts = payload.accounts ?? []
    const num = (v) => (parseFloat(v) || 0)
    const totalDebits = num(payload.total_debits)
    const totalCredits = num(payload.total_credits)
    const asOfDate = payload.date ? new Date(payload.date).toLocaleDateString() : filters.as_of_date
    const rows = [
      ['Trial Balance'],
      [`As of ${asOfDate}`],
      [],
      ['Account #', 'Account Name', 'Type', 'Debits', 'Credits', 'Balance']
    ]
    accounts.forEach((row) => {
      rows.push([
        row.account_number ?? '',
        row.account_name ?? '',
        row.account_type ?? '',
        num(row.total_debits).toFixed(2),
        num(row.total_credits).toFixed(2),
        num(row.balance).toFixed(2)
      ])
    })
    rows.push(['Total', '', '', totalDebits.toFixed(2), totalCredits.toFixed(2), ''])
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trial-balance-${filters.as_of_date}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    showToast('Report exported to CSV', 'success')
  }

  const handleExportExcel = async () => {
    if (!reportData) {
      showToast('No report data to export', 'error')
      return
    }
    const payload = reportData?.data ?? reportData
    const accounts = payload.accounts ?? []
    const num = (v) => (parseFloat(v) || 0)
    const totalDebits = num(payload.total_debits)
    const totalCredits = num(payload.total_credits)
    const asOfDate = payload.date ? new Date(payload.date).toLocaleDateString() : filters.as_of_date
    const rows = [
      ['Trial Balance'],
      [`As of ${asOfDate}`],
      [],
      ['Account #', 'Account Name', 'Type', 'Debits', 'Credits', 'Balance']
    ]
    accounts.forEach((row) => {
      rows.push([
        row.account_number ?? '',
        row.account_name ?? '',
        row.account_type ?? '',
        num(row.total_debits).toFixed(2),
        num(row.total_credits).toFixed(2),
        num(row.balance).toFixed(2)
      ])
    })
    rows.push(['Total', '', '', totalDebits.toFixed(2), totalCredits.toFixed(2), ''])
    try {
      await downloadExcel(rows, `trial-balance-${filters.as_of_date}.xlsx`)
      showToast('Report exported to Excel', 'success')
    } catch (e) {
      showToast('Excel export failed', 'error')
    }
  }

  useImperativeHandle(ref, () => ({
    generateReport: handleGenerateReport,
    exportToCsv: handleExport,
    exportToExcel: handleExportExcel,
    print: () => window.print()
  }), [handleGenerateReport, handleExport, handleExportExcel])

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    alignItems: 'end',
    marginBottom: '16px'
  }
  const dateContainerStyle = {
    padding: '4px 16px',
    minHeight: '28px',
    height: '28px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: _isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    border: _isDark ? '1px solid var(--border-light, #333)' : '1px solid #ddd',
    color: _isDark ? 'var(--text-primary, #fff)' : '#333',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    boxSizing: 'border-box',
    width: '100%',
    transition: 'border-color 0.2s ease'
  }
  const dateInputStyle = {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    fontSize: '14px',
    fontWeight: 500,
    outline: 'none',
    cursor: 'pointer',
    flex: 1,
    minWidth: 0
  }
  const quickSelectStyle = {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: '16px'
  }
  const quickSelectButtonStyle = {
    padding: '4px 16px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    backgroundColor: _isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    border: _isDark ? '1px solid var(--border-light, #333)' : '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: _isDark ? 'var(--text-primary, #fff)' : '#333',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }

  return (
    <div>
      {!hideTitle && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ ...formTitleStyle(_isDark), marginBottom: '8px', fontSize: '24px' }}>Trial Balance</h3>
          <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
            List of all accounts with debit and credit balances as of a specific date.
          </p>
        </div>
      )}
      <div style={{ marginBottom: '24px' }}>
        <div style={gridStyle}>
          <div style={{ ...dateContainerStyle, marginBottom: 0 }}>
            <span style={{ whiteSpace: 'nowrap', color: _isDark ? '#9ca3af' : '#6b7280', fontSize: '13px' }}>As of date</span>
            <input
              type="date"
              name="as_of_date"
              value={filters.as_of_date || ''}
              onChange={handleChange}
              style={dateInputStyle}
              onFocus={(e) => {
                const container = e.target.closest('div')
                if (container) container.style.borderColor = `rgba(${rgb}, 0.5)`
              }}
            onBlur={(e) => {
              const container = e.target.closest('div')
              if (container) container.style.borderColor = _isDark ? '#333' : '#ddd'
            }}
          />
        </div>
      </div>
      <div style={quickSelectStyle}>
          <button type="button" onClick={() => setPresetDate('today')} style={quickSelectButtonStyle}>Today</button>
          <button type="button" onClick={() => setPresetDate('end_of_month')} style={quickSelectButtonStyle}>End of Month</button>
          <button type="button" onClick={() => setPresetDate('end_of_last_month')} style={quickSelectButtonStyle}>End of Last Month</button>
          <button type="button" onClick={() => setPresetDate('end_of_quarter')} style={quickSelectButtonStyle}>End of Quarter</button>
          <button type="button" onClick={() => setPresetDate('end_of_year')} style={quickSelectButtonStyle}>End of Year</button>
          <button type="button" onClick={() => setPresetDate('end_of_last_year')} style={quickSelectButtonStyle}>End of Last Year</button>
        </div>
      </div>
      {loading && <LoadingSpinner size="lg" text="Generating report..." />}
      {!loading && reportData && (
        <div className="accounting-report-print-area">
          <div style={{
            backgroundColor: cardBg,
            border: `1px solid ${borderColor}`,
            borderRadius: '8px',
            padding: '24px'
          }}>
            <ReportsTabContent
              selectedReport="trial-balance"
              reportData={reportData}
              formatCurrency={formatCurrency}
              textColor={textColor}
              borderColor={borderColor}
              isDarkMode={_isDark}
            />
          </div>
        </div>
      )}
      {!loading && !reportData && (
        <div style={{ backgroundColor: cardBg, borderRadius: '8px', border: `1px solid ${borderColor}`, padding: '48px', textAlign: 'center' }}>
          <p style={{ color: textColor, opacity: 0.7 }}>
            Select a date above and click &quot;Generate Report&quot; to view your Trial Balance
          </p>
        </div>
      )}
    </div>
  )
})

// Income Statement Tab
const ProfitLossTab = forwardRef(function ProfitLossTab(
  { dateRange, formatCurrency, getAuthHeaders, setActiveTab, hideTitle = false, themeColorRgb, isDarkMode, onGenerateStateChange },
  ref
) {
  const { show: showToast } = useToast()
  const [reportData, setReportData] = useState(null)
  const [comparativeData, setComparativeData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    start_date: dateRange.start_date,
    end_date: dateRange.end_date,
    comparison_type: 'none',
  })

  const _isDark = isDarkMode ?? document.documentElement.classList.contains('dark-theme')
  const textColor = _isDark ? '#ffffff' : '#1a1a1a'
  const borderColor = _isDark ? '#3a3a3a' : '#e0e0e0'
  const cardBg = _isDark ? '#1f1f1f' : '#ffffff'

  useEffect(() => {
    // Update filters when dateRange changes
    setFilters(prev => ({
      ...prev,
      start_date: dateRange.start_date,
      end_date: dateRange.end_date
    }))
  }, [dateRange])

  useEffect(() => {
    onGenerateStateChange?.({ loading, disabled: !filters.start_date || !filters.end_date, hasReportData: !!reportData })
  }, [loading, filters.start_date, filters.end_date, onGenerateStateChange, reportData])

  const handleGenerateReport = async () => {
    setLoading(true)
    try {
      if (filters.comparison_type === 'none') {
        const res = await fetch(
          `/api/accounting/profit-loss?start_date=${encodeURIComponent(filters.start_date)}&end_date=${encodeURIComponent(filters.end_date)}`,
          { headers: getAuthHeaders() }
        )
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load report')
        setReportData(json.data)
        setComparativeData(null)
      } else {
        let priorPeriod
        if (filters.comparison_type === 'previous_period') {
          priorPeriod = reportService.calculatePriorPeriod(filters.start_date, filters.end_date)
        } else {
          priorPeriod = reportService.calculatePriorYear(filters.start_date, filters.end_date)
        }
        const params = new URLSearchParams({
          current_start: filters.start_date,
          current_end: filters.end_date,
          prior_start: priorPeriod.start,
          prior_end: priorPeriod.end
        })
        const res = await fetch(`/api/accounting/profit-loss/comparative?${params}`, { headers: getAuthHeaders() })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load report')
        setComparativeData(json.data)
        setReportData(json.data.current)
      }
      showToast('Report generated successfully', 'success')
    } catch (error) {
      console.error('Error generating report:', error)
      showToast(error.message || error.response?.data?.message || 'Failed to generate report', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!reportData) {
      showToast('No report data to export', 'error')
      return
    }

    const rows = [
      ['Income Statement'],
      [`Period: ${new Date(reportData.start_date).toLocaleDateString()} - ${new Date(reportData.end_date).toLocaleDateString()}`],
      [],
      ['Account', 'Amount', '% of Revenue'],
      [],
      ['REVENUE'],
    ]

    const num = (v) => (Number(v) || 0)
    reportData.revenue.forEach(account => {
      rows.push([
        `  ${account.account_number || ''} ${account.account_name}`,
        num(account.balance).toFixed(2),
        num(account.percentage_of_revenue).toFixed(1) + '%'
      ])
    })

    rows.push(['Total Revenue', num(reportData.total_revenue).toFixed(2), '100.0%'])
    rows.push([])

    if (reportData.cost_of_goods_sold && reportData.cost_of_goods_sold.length > 0) {
      rows.push(['COST OF GOODS SOLD'])
      reportData.cost_of_goods_sold.forEach(account => {
        rows.push([
          `  ${account.account_number || ''} ${account.account_name}`,
          num(account.balance).toFixed(2),
          num(account.percentage_of_revenue).toFixed(1) + '%'
        ])
      })
      rows.push(['Total Cost of Goods Sold', num(reportData.total_cogs).toFixed(2), (num(reportData.total_cogs) / num(reportData.total_revenue) * 100).toFixed(1) + '%'])
      rows.push(['GROSS PROFIT', num(reportData.gross_profit).toFixed(2), (num(reportData.gross_profit) / num(reportData.total_revenue) * 100).toFixed(1) + '%'])
      rows.push([])
    }

    rows.push(['EXPENSES'])
    reportData.expenses.forEach(account => {
      rows.push([
        `  ${account.account_number || ''} ${account.account_name}`,
        num(account.balance).toFixed(2),
        num(account.percentage_of_revenue).toFixed(1) + '%'
      ])
    })

    rows.push(['Total Expenses', num(reportData.total_expenses).toFixed(2), (num(reportData.total_expenses) / num(reportData.total_revenue) * 100).toFixed(1) + '%'])
    rows.push([])
    rows.push(['NET INCOME', num(reportData.net_income).toFixed(2), (num(reportData.net_income) / num(reportData.total_revenue) * 100).toFixed(1) + '%'])

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `income-statement-${filters.start_date}-to-${filters.end_date}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    showToast('Report exported to CSV', 'success')
  }

  const handleExportExcel = async () => {
    if (!reportData) {
      showToast('No report data to export', 'error')
      return
    }
    const rows = [
      ['Income Statement'],
      [`Period: ${new Date(reportData.start_date).toLocaleDateString()} - ${new Date(reportData.end_date).toLocaleDateString()}`],
      [],
      ['Account', 'Amount', '% of Revenue'],
      [],
      ['REVENUE'],
    ]
    const num = (v) => (Number(v) || 0)
    reportData.revenue.forEach(account => {
      rows.push([`  ${account.account_number || ''} ${account.account_name}`, num(account.balance).toFixed(2), num(account.percentage_of_revenue).toFixed(1) + '%'])
    })
    rows.push(['Total Revenue', num(reportData.total_revenue).toFixed(2), '100.0%'])
    rows.push([])
    if (reportData.cost_of_goods_sold?.length > 0) {
      rows.push(['COST OF GOODS SOLD'])
      reportData.cost_of_goods_sold.forEach(account => {
        rows.push([`  ${account.account_number || ''} ${account.account_name}`, num(account.balance).toFixed(2), num(account.percentage_of_revenue).toFixed(1) + '%'])
      })
      rows.push(['Total Cost of Goods Sold', num(reportData.total_cogs).toFixed(2), (num(reportData.total_cogs) / num(reportData.total_revenue) * 100).toFixed(1) + '%'])
      rows.push(['GROSS PROFIT', num(reportData.gross_profit).toFixed(2), (num(reportData.gross_profit) / num(reportData.total_revenue) * 100).toFixed(1) + '%'])
      rows.push([])
    }
    rows.push(['EXPENSES'])
    reportData.expenses.forEach(account => {
      rows.push([`  ${account.account_number || ''} ${account.account_name}`, num(account.balance).toFixed(2), num(account.percentage_of_revenue).toFixed(1) + '%'])
    })
    rows.push(['Total Expenses', num(reportData.total_expenses).toFixed(2), (num(reportData.total_expenses) / num(reportData.total_revenue) * 100).toFixed(1) + '%'])
    rows.push([])
    rows.push(['NET INCOME', num(reportData.net_income).toFixed(2), (num(reportData.net_income) / num(reportData.total_revenue) * 100).toFixed(1) + '%'])
    try {
      await downloadExcel(rows, `income-statement-${filters.start_date}-to-${filters.end_date}.xlsx`)
      showToast('Report exported to Excel', 'success')
    } catch (e) {
      showToast('Excel export failed', 'error')
    }
  }

  const handleAccountClick = (accountId) => {
    const id = accountId != null ? Number(accountId) : NaN
    if (Number.isNaN(id) || id < 1) return
    sessionStorage.setItem('selectedAccountId', String(id))
    setActiveTab('account-ledger')
  }

  const getPeriodLabel = () => {
    return `${new Date(filters.start_date).toLocaleDateString()} - ${new Date(filters.end_date).toLocaleDateString()}`
  }

  const getPriorPeriodLabel = () => {
    if (!comparativeData) return ''
    return `${new Date(comparativeData.prior.start_date).toLocaleDateString()} - ${new Date(comparativeData.prior.end_date).toLocaleDateString()}`
  }

  useImperativeHandle(ref, () => ({
    generateReport: handleGenerateReport,
    exportToCsv: handleExport,
    exportToExcel: handleExportExcel,
    print: () => window.print()
  }), [handleGenerateReport, handleExport, handleExportExcel])

  return (
    <div>
      {!hideTitle && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ ...formTitleStyle(_isDark), marginBottom: '8px', fontSize: '24px' }}>
            Income Statement
          </h3>
          <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
            Income statement showing revenue, expenses, and net income
          </p>
        </div>
      )}

      <ProfitLossFilters
        filters={filters}
        onFilterChange={setFilters}
      />

      {loading && <LoadingSpinner size="lg" text="Generating report..." />}

      {!loading && reportData && (
        <div className="accounting-report-print-area">
          {comparativeData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ComparativeProfitLossTable
                data={comparativeData}
                currentLabel={getPeriodLabel()}
                priorLabel={getPriorPeriodLabel()}
              />
              
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: textColor }}>
                  Current Period Detail
                </h3>
                <ProfitLossTable
                  data={reportData}
                  showPercentages={true}
                  onAccountClick={handleAccountClick}
                  periodLabel={getPeriodLabel() + (comparativeData ? ` — Compared to: ${getPriorPeriodLabel()}` : '')}
                />
              </div>
              <div style={{ width: '100%' }}>
                <ProfitLossChart data={reportData} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '24px', width: '100%' }}>
                <ProfitLossTable
                  data={reportData}
                  showPercentages={true}
                  onAccountClick={handleAccountClick}
                  periodLabel={getPeriodLabel()}
                />
              </div>
              <div style={{ width: '100%' }}>
                <ProfitLossChart data={reportData} />
              </div>
            </>
          )}
        </div>
      )}

      {!loading && !reportData && (
        <div style={{ 
          backgroundColor: cardBg, 
          borderRadius: '8px', 
          border: `1px solid ${borderColor}`,
          padding: '48px', 
          textAlign: 'center' 
        }}>
          <p style={{ color: textColor, opacity: 0.7 }}>
            Select a date range above and click "Generate Report" to view your Income Statement
          </p>
        </div>
      )}
    </div>
  )
})

// Balance Sheet Tab
const BalanceSheetTab = forwardRef(function BalanceSheetTab(
  { dateRange, formatCurrency, getAuthHeaders, setActiveTab, hideTitle = false, themeColorRgb, isDarkMode, onGenerateStateChange },
  ref
) {
  const { show: showToast } = useToast()
  const [reportData, setReportData] = useState(null)
  const [comparativeData, setComparativeData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    as_of_date: new Date().toISOString().split('T')[0],
    comparison_type: 'none'
  })
  const _isDark = isDarkMode ?? document.documentElement.classList.contains('dark-theme')
  const textColor = _isDark ? '#ffffff' : '#1a1a1a'
  const borderColor = _isDark ? '#3a3a3a' : '#e0e0e0'
  const cardBg = _isDark ? '#1f1f1f' : '#ffffff'

  useEffect(() => {
    onGenerateStateChange?.({ loading, disabled: !filters.as_of_date, hasReportData: !!reportData })
  }, [loading, filters.as_of_date, onGenerateStateChange, reportData])

  const handleGenerateReport = async () => {
    setLoading(true)
    try {
      if (filters.comparison_type === 'none') {
        const res = await fetch(
          `/api/accounting/balance-sheet?as_of_date=${encodeURIComponent(filters.as_of_date)}`,
          { headers: getAuthHeaders() }
        )
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load report')
        setReportData(json.data)
        setComparativeData(null)
      } else {
        const priorDate = filters.comparison_type === 'previous_month'
          ? reportService.calculatePriorMonth(filters.as_of_date)
          : reportService.calculatePriorYearDate(filters.as_of_date)
        const params = new URLSearchParams({ current_date: filters.as_of_date, prior_date: priorDate })
        const res = await fetch(`/api/accounting/balance-sheet/comparative?${params}`, { headers: getAuthHeaders() })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load report')
        setComparativeData(json.data)
        setReportData(json.data.current)
      }
      showToast('Report generated successfully', 'success')
    } catch (error) {
      showToast(error.message || error.response?.data?.message || 'Failed to generate report', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!reportData) {
      showToast('No report data to export', 'error')
      return
    }
    const rows = [
      ['Balance Sheet'],
      [`As of: ${new Date(reportData.as_of_date).toLocaleDateString()}`],
      [],
      ['ASSETS']
    ]
    const num = (v) => (Number(v) || 0)
    if (reportData.assets.current_assets?.length > 0) {
      rows.push(['Current Assets'])
      reportData.assets.current_assets.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, num(a.balance).toFixed(2)]))
      rows.push(['Total Current Assets', num(reportData.assets.total_current_assets).toFixed(2)])
    }
    if (reportData.assets.fixed_assets?.length > 0) {
      rows.push(['Fixed Assets'])
      reportData.assets.fixed_assets.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, num(a.balance).toFixed(2)]))
      rows.push(['Total Fixed Assets', num(reportData.assets.total_fixed_assets).toFixed(2)])
    }
    if (reportData.assets.other_assets?.length > 0) {
      rows.push(['Other Assets'])
      reportData.assets.other_assets.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, num(a.balance).toFixed(2)]))
      rows.push(['Total Other Assets', num(reportData.assets.total_other_assets).toFixed(2)])
    }
    rows.push(['TOTAL ASSETS', num(reportData.assets.total_assets).toFixed(2)])
    rows.push([])
    rows.push(['LIABILITIES'])
    if (reportData.liabilities.current_liabilities?.length > 0) {
      rows.push(['Current Liabilities'])
      reportData.liabilities.current_liabilities.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, num(a.balance).toFixed(2)]))
      rows.push(['Total Current Liabilities', num(reportData.liabilities.total_current_liabilities).toFixed(2)])
    }
    if (reportData.liabilities.long_term_liabilities?.length > 0) {
      rows.push(['Long-term Liabilities'])
      reportData.liabilities.long_term_liabilities.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, num(a.balance).toFixed(2)]))
      rows.push(['Total Long-term Liabilities', num(reportData.liabilities.total_long_term_liabilities).toFixed(2)])
    }
    rows.push(['TOTAL LIABILITIES', num(reportData.liabilities.total_liabilities).toFixed(2)])
    rows.push([])
    rows.push(['EQUITY'])
    reportData.equity.equity_accounts?.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, num(a.balance).toFixed(2)]))
    if (typeof reportData.equity.inventory_valuation_adjustment === 'number' && Math.abs(reportData.equity.inventory_valuation_adjustment) >= 0.005) {
      rows.push(['  Inventory valuation adjustment', num(reportData.equity.inventory_valuation_adjustment).toFixed(2)])
    }
    rows.push(['Current Year Earnings', num(reportData.equity.current_year_earnings).toFixed(2)])
    rows.push(['TOTAL EQUITY', num(reportData.equity.total_equity).toFixed(2)])
    rows.push([])
    rows.push(['TOTAL LIABILITIES AND EQUITY', (num(reportData.liabilities.total_liabilities) + num(reportData.equity.total_equity)).toFixed(2)])
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `balance-sheet-${filters.as_of_date}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    showToast('Report exported to CSV', 'success')
  }

  const handleExportExcel = async () => {
    if (!reportData) {
      showToast('No report data to export', 'error')
      return
    }
    const rows = [
      ['Balance Sheet'],
      [`As of: ${new Date(reportData.as_of_date).toLocaleDateString()}`],
      [],
      ['ASSETS']
    ]
    const num = (v) => (Number(v) || 0)
    if (reportData.assets.current_assets?.length > 0) {
      rows.push(['Current Assets'])
      reportData.assets.current_assets.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, num(a.balance).toFixed(2)]))
      rows.push(['Total Current Assets', num(reportData.assets.total_current_assets).toFixed(2)])
    }
    if (reportData.assets.fixed_assets?.length > 0) {
      rows.push(['Fixed Assets'])
      reportData.assets.fixed_assets.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, num(a.balance).toFixed(2)]))
      rows.push(['Total Fixed Assets', num(reportData.assets.total_fixed_assets).toFixed(2)])
    }
    if (reportData.assets.other_assets?.length > 0) {
      rows.push(['Other Assets'])
      reportData.assets.other_assets.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, num(a.balance).toFixed(2)]))
      rows.push(['Total Other Assets', num(reportData.assets.total_other_assets).toFixed(2)])
    }
    rows.push(['TOTAL ASSETS', num(reportData.assets.total_assets).toFixed(2)])
    rows.push([])
    rows.push(['LIABILITIES'])
    if (reportData.liabilities.current_liabilities?.length > 0) {
      rows.push(['Current Liabilities'])
      reportData.liabilities.current_liabilities.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, num(a.balance).toFixed(2)]))
      rows.push(['Total Current Liabilities', num(reportData.liabilities.total_current_liabilities).toFixed(2)])
    }
    if (reportData.liabilities.long_term_liabilities?.length > 0) {
      rows.push(['Long-term Liabilities'])
      reportData.liabilities.long_term_liabilities.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, num(a.balance).toFixed(2)]))
      rows.push(['Total Long-term Liabilities', num(reportData.liabilities.total_long_term_liabilities).toFixed(2)])
    }
    rows.push(['TOTAL LIABILITIES', num(reportData.liabilities.total_liabilities).toFixed(2)])
    rows.push([])
    rows.push(['EQUITY'])
    reportData.equity.equity_accounts?.forEach((a) => rows.push([`  ${a.account_number || ''} ${a.account_name}`, num(a.balance).toFixed(2)]))
    if (typeof reportData.equity.inventory_valuation_adjustment === 'number' && Math.abs(reportData.equity.inventory_valuation_adjustment) >= 0.005) {
      rows.push(['  Inventory valuation adjustment', num(reportData.equity.inventory_valuation_adjustment).toFixed(2)])
    }
    rows.push(['Current Year Earnings', num(reportData.equity.current_year_earnings).toFixed(2)])
    rows.push(['TOTAL EQUITY', num(reportData.equity.total_equity).toFixed(2)])
    rows.push([])
    rows.push(['TOTAL LIABILITIES AND EQUITY', (num(reportData.liabilities.total_liabilities) + num(reportData.equity.total_equity)).toFixed(2)])
    try {
      await downloadExcel(rows, `balance-sheet-${filters.as_of_date}.xlsx`)
      showToast('Report exported to Excel', 'success')
    } catch (e) {
      showToast('Excel export failed', 'error')
    }
  }

  const handleAccountClick = (accountId) => {
    const id = accountId != null ? Number(accountId) : NaN
    if (Number.isNaN(id) || id < 1) return
    sessionStorage.setItem('selectedAccountId', String(id))
    setActiveTab('account-ledger')
  }

  const getAsOfLabel = () => new Date(filters.as_of_date).toLocaleDateString()
  const getPriorLabel = () => (comparativeData ? new Date(comparativeData.prior.as_of_date).toLocaleDateString() : '')

  useImperativeHandle(ref, () => ({
    generateReport: handleGenerateReport,
    exportToCsv: handleExport,
    exportToExcel: handleExportExcel,
    print: () => window.print()
  }), [handleGenerateReport, handleExport, handleExportExcel])

  return (
    <div>
      {!hideTitle && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ ...formTitleStyle(isDarkMode), marginBottom: '8px', fontSize: '24px' }}>Balance Sheet</h3>
          <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
            Statement of financial position showing assets, liabilities, and equity.
            Inventory (Current Assets) is calculated from actual store stock (quantity × cost).
          </p>
        </div>
      )}
      <BalanceSheetFilters
        filters={filters}
        onFilterChange={setFilters}
      />
      {loading && <LoadingSpinner size="lg" text="Generating report..." />}
      {!loading && reportData && (
        <div className="accounting-report-print-area">
          {comparativeData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ComparativeBalanceSheetTable
                data={comparativeData}
                currentLabel={getAsOfLabel()}
                priorLabel={getPriorLabel()}
              />
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ ...formTitleStyle(isDarkMode), fontSize: '18px', marginBottom: '16px' }}>Current Period Detail</h3>
                <BalanceSheetTable data={reportData} onAccountClick={handleAccountClick} dateLabel={`As of ${getAsOfLabel()} — Compared to: ${getPriorLabel()}`} />
              </div>
              <div style={{ width: '100%' }}>
                <BalanceSheetChart data={reportData} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '24px', width: '100%' }}>
                <BalanceSheetTable data={reportData} onAccountClick={handleAccountClick} dateLabel={`As of ${getAsOfLabel()}`} />
              </div>
              <div style={{ width: '100%' }}>
                <BalanceSheetChart data={reportData} />
              </div>
            </>
          )}
        </div>
      )}
      {!loading && !reportData && (
        <div style={{ backgroundColor: cardBg, borderRadius: '8px', border: `1px solid ${borderColor}`, padding: '48px', textAlign: 'center' }}>
          <p style={{ color: textColor, opacity: 0.7 }}>
            Select a date above and click "Generate Report" to view your Balance Sheet
          </p>
        </div>
      )}
    </div>
  )
})

// Cash Flow Tab
const CashFlowTab = forwardRef(function CashFlowTab(
  { dateRange, formatCurrency, getAuthHeaders, setActiveTab, hideTitle = false, themeColorRgb, isDarkMode, onGenerateStateChange },
  ref
) {
  const { show: showToast } = useToast()
  const [reportData, setReportData] = useState(null)
  const [comparativeData, setComparativeData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    comparison_type: 'none'
  })
  const _isDark = isDarkMode ?? document.documentElement.classList.contains('dark-theme')
  const textColor = _isDark ? '#ffffff' : '#1a1a1a'
  const borderColor = _isDark ? '#3a3a3a' : '#e0e0e0'
  const cardBg = _isDark ? '#1f1f1f' : '#ffffff'

  useEffect(() => {
    onGenerateStateChange?.({ loading, disabled: !filters.start_date || !filters.end_date, hasReportData: !!reportData })
  }, [loading, filters.start_date, filters.end_date, onGenerateStateChange, reportData])

  const handleGenerateReport = async () => {
    setLoading(true)
    try {
      if (filters.comparison_type === 'none') {
        const res = await fetch(
          `/api/accounting/cash-flow?start_date=${encodeURIComponent(filters.start_date)}&end_date=${encodeURIComponent(filters.end_date)}`,
          { headers: getAuthHeaders() }
        )
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load report')
        setReportData(json.data)
        setComparativeData(null)
      } else {
        const prior = filters.comparison_type === 'previous_period'
          ? reportService.calculatePriorPeriod(filters.start_date, filters.end_date)
          : reportService.calculatePriorYear(filters.start_date, filters.end_date)
        const params = new URLSearchParams({
          current_start: filters.start_date,
          current_end: filters.end_date,
          prior_start: prior.start,
          prior_end: prior.end
        })
        const res = await fetch(`/api/accounting/cash-flow/comparative?${params}`, { headers: getAuthHeaders() })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load report')
        setComparativeData(json.data)
        setReportData(json.data.current)
      }
      showToast('Report generated successfully', 'success')
    } catch (error) {
      showToast(error.message || error.response?.data?.message || 'Failed to generate report', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!reportData) {
      showToast('No report data to export', 'error')
      return
    }
    const op = reportData.operating_activities || {}
    const inv = reportData.investing_activities || {}
    const fin = reportData.financing_activities || {}
    const num = (v) => (Number(v) || 0)
    const rows = [
      ['Cash Flow Statement'],
      [`Period: ${new Date(reportData.start_date).toLocaleDateString()} - ${new Date(reportData.end_date).toLocaleDateString()}`],
      [],
      ['OPERATING ACTIVITIES'],
      ['Net Income', num(op.net_income).toFixed(2)]
    ]
    ;(op.adjustments || []).forEach((item) => rows.push([`  ${item.description}`, num(item.amount).toFixed(2)]))
    ;(op.working_capital_changes || []).forEach((item) => rows.push([`  ${item.description}`, num(item.amount).toFixed(2)]))
    rows.push(['Net Cash from Operating Activities', num(op.net_cash_from_operations).toFixed(2)])
    rows.push([])
    rows.push(['INVESTING ACTIVITIES'])
    if ((inv.items || []).length === 0) rows.push(['  No investing activities'])
    else (inv.items || []).forEach((item) => rows.push([`  ${item.description}`, num(item.amount).toFixed(2)]))
    rows.push(['Net Cash from Investing Activities', num(inv.net_cash_from_investing).toFixed(2)])
    rows.push([])
    rows.push(['FINANCING ACTIVITIES'])
    if ((fin.items || []).length === 0) rows.push(['  No financing activities'])
    else (fin.items || []).forEach((item) => rows.push([`  ${item.description}`, num(item.amount).toFixed(2)]))
    rows.push(['Net Cash from Financing Activities', num(fin.net_cash_from_financing).toFixed(2)])
    rows.push([])
    rows.push(['NET CHANGE IN CASH', num(reportData.net_change_in_cash).toFixed(2)])
    rows.push(['Beginning Cash', num(reportData.beginning_cash).toFixed(2)])
    rows.push(['ENDING CASH', num(reportData.ending_cash).toFixed(2)])
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cash-flow-${filters.start_date}-to-${filters.end_date}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    showToast('Report exported to CSV', 'success')
  }

  const handleExportExcel = async () => {
    if (!reportData) {
      showToast('No report data to export', 'error')
      return
    }
    const op = reportData.operating_activities || {}
    const inv = reportData.investing_activities || {}
    const fin = reportData.financing_activities || {}
    const num = (v) => (Number(v) || 0)
    const rows = [
      ['Cash Flow Statement'],
      [`Period: ${new Date(reportData.start_date).toLocaleDateString()} - ${new Date(reportData.end_date).toLocaleDateString()}`],
      [],
      ['OPERATING ACTIVITIES'],
      ['Net Income', num(op.net_income).toFixed(2)]
    ]
    ;(op.adjustments || []).forEach((item) => rows.push([`  ${item.description}`, num(item.amount).toFixed(2)]))
    ;(op.working_capital_changes || []).forEach((item) => rows.push([`  ${item.description}`, num(item.amount).toFixed(2)]))
    rows.push(['Net Cash from Operating Activities', num(op.net_cash_from_operations).toFixed(2)])
    rows.push([])
    rows.push(['INVESTING ACTIVITIES'])
    if ((inv.items || []).length === 0) rows.push(['  No investing activities'])
    else (inv.items || []).forEach((item) => rows.push([`  ${item.description}`, num(item.amount).toFixed(2)]))
    rows.push(['Net Cash from Investing Activities', num(inv.net_cash_from_investing).toFixed(2)])
    rows.push([])
    rows.push(['FINANCING ACTIVITIES'])
    if ((fin.items || []).length === 0) rows.push(['  No financing activities'])
    else (fin.items || []).forEach((item) => rows.push([`  ${item.description}`, num(item.amount).toFixed(2)]))
    rows.push(['Net Cash from Financing Activities', num(fin.net_cash_from_financing).toFixed(2)])
    rows.push([])
    rows.push(['NET CHANGE IN CASH', num(reportData.net_change_in_cash).toFixed(2)])
    rows.push(['Beginning Cash', num(reportData.beginning_cash).toFixed(2)])
    rows.push(['ENDING CASH', num(reportData.ending_cash).toFixed(2)])
    try {
      await downloadExcel(rows, `cash-flow-${filters.start_date}-to-${filters.end_date}.xlsx`)
      showToast('Report exported to Excel', 'success')
    } catch (e) {
      showToast('Excel export failed', 'error')
    }
  }

  const handleAccountClick = (accountId) => {
    const id = accountId != null ? Number(accountId) : NaN
    if (Number.isNaN(id) || id < 1) return
    sessionStorage.setItem('selectedAccountId', String(id))
    setActiveTab('account-ledger')
  }

  const getPeriodLabel = () => `${new Date(filters.start_date).toLocaleDateString()} - ${new Date(filters.end_date).toLocaleDateString()}`
  const getPriorLabel = () => {
    if (!comparativeData?.prior) return ''
    const p = comparativeData.prior
    return `${new Date(p.start_date).toLocaleDateString()} - ${new Date(p.end_date).toLocaleDateString()}`
  }

  useImperativeHandle(ref, () => ({
    generateReport: handleGenerateReport,
    exportToCsv: handleExport,
    exportToExcel: handleExportExcel,
    print: () => window.print()
  }), [handleGenerateReport, handleExport, handleExportExcel])

  return (
    <div>
      {!hideTitle && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ ...formTitleStyle(isDarkMode), marginBottom: '8px', fontSize: '24px' }}>Cash Flow Statement</h3>
          <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
            Statement of cash flows showing operating, investing, and financing activities
          </p>
        </div>
      )}
      <CashFlowFilters filters={filters} onFilterChange={setFilters} />
      {loading && <LoadingSpinner size="lg" text="Generating report..." />}
      {!loading && reportData && (
        <div className="accounting-report-print-area">
          {comparativeData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ComparativeCashFlowTable data={comparativeData} currentLabel={getPeriodLabel()} priorLabel={getPriorLabel()} />
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ ...formTitleStyle(isDarkMode), fontSize: '18px', marginBottom: '16px' }}>Current Period Detail</h3>
                <CashFlowTable data={reportData} onAccountClick={handleAccountClick} periodLabel={`${getPeriodLabel()} — Compared to: ${getPriorLabel()}`} />
              </div>
              <div style={{ width: '100%' }}>
                <CashFlowChart data={reportData} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '24px', width: '100%' }}>
                <CashFlowTable data={reportData} onAccountClick={handleAccountClick} periodLabel={getPeriodLabel()} />
              </div>
              <div style={{ width: '100%' }}>
                <CashFlowChart data={reportData} />
              </div>
            </>
          )}
        </div>
      )}
      {!loading && !reportData && (
        <div style={{ backgroundColor: cardBg, borderRadius: '8px', border: `1px solid ${borderColor}`, padding: '48px', textAlign: 'center' }}>
          <p style={{ color: textColor, opacity: 0.7 }}>Select a date range above and click "Generate Report" to view your Cash Flow Statement</p>
        </div>
      )}
    </div>
  )
})

// Bills Tab
function BillsTab({ dateRange, formatCurrency, getAuthHeaders }) {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const cardBg = isDarkMode ? '#2a2a2a' : 'white'

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
        setBills(Array.isArray(data) ? data : (data?.data ?? []))
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
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', margin: 0 }}>Bills</h1>
        <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Amounts you owe to vendors for the selected date range. Track due dates and payment status.</p>
      </div>
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
            {bills.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: textColor, opacity: 0.8 }}>
                  No bills found for this period.
                </td>
              </tr>
            ) : (
              bills.map(bill => (
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Customers Tab – uses same source as Customers page (/api/customers) so data matches
function CustomersTab({ formatCurrency, getAuthHeaders }) {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const cardBg = isDarkMode ? '#2a2a2a' : 'white'

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/customers', { headers: getAuthHeaders() })
      if (response.ok) {
        const json = await response.json()
        const raw = Array.isArray(json.data) ? json.data : (json.columns && Array.isArray(json.data) ? json.data : [])
        setCustomers(raw.map(row => ({
          id: row.customer_id ?? row.id,
          customer_number: String(row.customer_id ?? row.customer_number ?? row.id ?? ''),
          display_name: row.customer_name ?? row.display_name ?? row.name ?? '-',
          email: row.email ?? '',
          phone: row.phone ?? '',
          address: row.address ?? '',
          account_balance: row.account_balance ?? 0
        })))
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
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', margin: 0 }}>Customers</h1>
        <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Same list as the main Customers page. Use for accounting context and linking to invoices.</p>
      </div>
      <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
              <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Customer #</th>
              <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Name</th>
              <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Email</th>
              <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Phone</th>
              <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: textColor, opacity: 0.8 }}>
                  No customers found. Add customers from the main Customers section.
                </td>
              </tr>
            ) : (
              customers.map(customer => (
                <tr key={customer.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '12px', color: textColor }}>{customer.customer_number}</td>
                  <td style={{ padding: '12px', color: textColor }}>{customer.display_name}</td>
                  <td style={{ padding: '12px', color: textColor }}>{customer.email || '-'}</td>
                  <td style={{ padding: '12px', color: textColor }}>{customer.phone || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>{formatCurrency(customer.account_balance || 0)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
  const cardBg = isDarkMode ? '#2a2a2a' : 'white'

  useEffect(() => {
    loadVendors()
  }, [])

  const loadVendors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/accounting/vendors', { headers: getAuthHeaders() })
      if (response.ok) {
        const data = await response.json()
        setVendors(Array.isArray(data) ? data : (data?.data ?? []))
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
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', margin: 0 }}>Vendors</h1>
        <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Suppliers you purchase from. Track contact info and balances. Bills are linked to vendors.</p>
      </div>
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
            {vendors.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: textColor, opacity: 0.8 }}>
                  No vendors found.
                </td>
              </tr>
            ) : (
              vendors.map(vendor => (
                <tr key={vendor.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '12px', color: textColor }}>{vendor.vendor_number}</td>
                  <td style={{ padding: '12px', color: textColor }}>{vendor.vendor_name}</td>
                  <td style={{ padding: '12px', color: textColor }}>{vendor.email || '-'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>{formatCurrency(vendor.account_balance || 0)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Report content renderer: Trial Balance, Income Statement, Balance Sheet, Aging
function ReportsTabContent({ selectedReport, reportData, formatCurrency, textColor, borderColor, isDarkMode }) {
  const payload = reportData?.data ?? reportData
  const num = (v) => (parseFloat(v) || 0)

  if (selectedReport === 'trial-balance' && payload?.accounts) {
    const accounts = payload.accounts
    // Date from API response = as_of_date from report settings (avoid timezone shift by formatting YYYY-MM-DD directly)
    const dateStr = payload.date && String(payload.date).split('T')[0]
    const reportDate = dateStr ? (() => {
      const [y, m, d] = dateStr.split('-')
      return m && d && y ? `${Number(m)}/${Number(d)}/${y}` : dateStr
    })() : '—'
    // Match Balance Sheet: teal/blue-grey headers, light grey totals
    const mainHeaderBg = isDarkMode ? '#2d4a5a' : '#2d5a6b'
    const subHeaderBg = isDarkMode ? '#3a5566' : '#c5d9e0'
    const totalRowBg = isDarkMode ? '#2a3a45' : '#e8e8e8'
    const trialBorder = isDarkMode ? '#3a4a55' : '#d0d0d0'
    const rowBg = isDarkMode ? '#1f2a33' : '#fff'
    const getDebitCredit = (row) => {
      const bal = num(row.balance)
      const bt = (row.balance_type || '').toLowerCase()
      if (bt === 'debit') {
        return { debit: bal >= 0 ? bal : 0, credit: bal < 0 ? Math.abs(bal) : 0 }
      }
      if (bt === 'credit') {
        return { debit: bal < 0 ? Math.abs(bal) : 0, credit: bal >= 0 ? bal : 0 }
      }
      const deb = num(row.total_debits)
      const cred = num(row.total_credits)
      return deb >= cred ? { debit: deb - cred, credit: 0 } : { debit: 0, credit: cred - deb }
    }
    let sumDebit = 0
    let sumCredit = 0
    const rows = accounts.map((row) => {
      const { debit, credit } = getDebitCredit(row)
      sumDebit += debit
      sumCredit += credit
      return { ...row, _debit: debit, _credit: credit }
    })
    const totalDebits = sumDebit
    const totalCredits = sumCredit
    const difference = Math.abs(totalDebits - totalCredits)
    const isBalanced = difference < 0.01
    const formatAmt = (n) => (n === 0 ? '' : formatCurrency(n))
    const thStyle = {
      padding: '10px 12px',
      fontSize: '13px',
      fontWeight: 700,
      color: '#fff',
      backgroundColor: mainHeaderBg,
      border: `1px solid ${trialBorder}`,
      borderTop: 'none',
      textTransform: 'uppercase',
      letterSpacing: '0.02em'
    }
    const tdCell = {
      padding: '6px 12px',
      fontSize: '14px',
      color: textColor,
      border: `1px solid ${trialBorder}`,
      borderTop: 'none',
      backgroundColor: rowBg
    }
    const totalRowStyle = {
      padding: '10px 12px',
      fontSize: '14px',
      fontWeight: 700,
      color: textColor,
      backgroundColor: totalRowBg,
      border: `1px solid ${trialBorder}`,
      borderTop: `2px solid ${trialBorder}`
    }
    return (
      <div style={{ backgroundColor: isDarkMode ? '#1f2a33' : '#fff', padding: '16px', borderRadius: '8px', border: `1px solid ${trialBorder}` }}>
        <div style={{ backgroundColor: mainHeaderBg, color: '#fff', padding: '12px 16px', marginBottom: '0', border: `1px solid ${trialBorder}`, borderBottom: 'none', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>Trial Balance</div>
          <div style={{ fontSize: '13px', opacity: 0.95, marginTop: '4px' }}>As of {reportDate}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>A/C. Code</th>
                <th style={{ ...thStyle, textAlign: 'left', borderLeft: 'none' }}>Account Title</th>
                <th style={{ ...thStyle, textAlign: 'right', borderLeft: 'none' }}>Debit</th>
                <th style={{ ...thStyle, textAlign: 'right', borderLeft: 'none' }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td style={{ ...tdCell }}>{row.account_number ?? ''}</td>
                  <td style={{ ...tdCell, borderLeft: 'none' }}>{row.account_name ?? ''}</td>
                  <td style={{ ...tdCell, textAlign: 'right', borderLeft: 'none' }}>{formatAmt(row._debit)}</td>
                  <td style={{ ...tdCell, textAlign: 'right', borderLeft: 'none' }}>{formatAmt(row._credit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...totalRowStyle }}></td>
                <td style={{ ...totalRowStyle, borderLeft: 'none' }}>Total</td>
                <td style={{ ...totalRowStyle, textAlign: 'right', borderLeft: 'none' }}>{formatCurrency(totalDebits)}</td>
                <td style={{ ...totalRowStyle, textAlign: 'right', borderLeft: 'none' }}>{formatCurrency(totalCredits)}</td>
              </tr>
              <tr>
                <td style={{ ...totalRowStyle, borderTop: 'none' }}></td>
                <td style={{ ...totalRowStyle, borderLeft: 'none', borderTop: 'none' }}>Status / Difference</td>
                <td style={{ ...totalRowStyle, textAlign: 'right', borderLeft: 'none', borderTop: 'none' }}>{isBalanced ? 'Balanced' : ''}</td>
                <td style={{ ...totalRowStyle, textAlign: 'right', borderLeft: 'none', borderTop: 'none' }}>{formatCurrency(difference)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  if (selectedReport === 'profit-loss' && payload) {
    const revenue = payload.revenue ?? []
    const cogs = payload.cost_of_goods_sold ?? []
    const expenses = payload.expenses ?? []
    const totalRevenue = num(payload.total_revenue)
    const grossProfit = num(payload.gross_profit)
    const totalExpenses = num(payload.total_expenses)
    const netIncome = num(payload.net_income)
    const periodLabel = payload.start_date && payload.end_date
      ? `${new Date(payload.start_date).toLocaleDateString()} – ${new Date(payload.end_date).toLocaleDateString()}`
      : ''
    return (
      <div>
        {periodLabel && (
          <p style={{ color: textColor, opacity: 0.85, marginBottom: '16px', fontSize: '14px' }}>Period: {periodLabel}</p>
        )}
        <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                <td style={{ padding: '8px 12px', color: textColor, fontWeight: 600 }}>Revenue</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: textColor }}></td>
              </tr>
              {revenue.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '6px 12px 6px 24px', color: textColor }}>{row.account_number} {row.account_name}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(num(row.balance))}</td>
                </tr>
              ))}
              <tr style={{ borderBottom: `1px solid ${borderColor}`, fontWeight: 600 }}>
                <td style={{ padding: '10px 12px', color: textColor }}>Total Revenue</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(totalRevenue)}</td>
              </tr>
              {cogs.length > 0 && (
                <>
                  <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                    <td style={{ padding: '8px 12px', color: textColor, fontWeight: 600 }}>Cost of Goods Sold</td>
                    <td style={{ padding: '8px 12px' }}></td>
                  </tr>
                  {cogs.map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
                      <td style={{ padding: '6px 12px 6px 24px', color: textColor }}>{row.account_number} {row.account_name}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(num(row.balance))}</td>
                    </tr>
                  ))}
                  <tr style={{ borderBottom: `1px solid ${borderColor}`, fontWeight: 600 }}>
                    <td style={{ padding: '10px 12px', color: textColor }}>Gross Profit</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(grossProfit)}</td>
                  </tr>
                </>
              )}
              <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                <td style={{ padding: '8px 12px', color: textColor, fontWeight: 600 }}>Expenses</td>
                <td style={{ padding: '8px 12px' }}></td>
              </tr>
              {expenses.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '6px 12px 6px 24px', color: textColor }}>{row.account_number} {row.account_name}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(num(row.balance))}</td>
                </tr>
              ))}
              <tr style={{ borderBottom: `1px solid ${borderColor}`, fontWeight: 600 }}>
                <td style={{ padding: '10px 12px', color: textColor }}>Total Expenses</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(totalExpenses)}</td>
              </tr>
              <tr style={{ backgroundColor: isDarkMode ? '#252525' : '#e8e8e8', fontWeight: 700, borderTop: `2px solid ${borderColor}` }}>
                <td style={{ padding: '12px', color: textColor }}>Net Income</td>
                <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>{formatCurrency(netIncome)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (selectedReport === 'balance-sheet' && payload) {
    const a = payload.assets ?? {}
    const l = payload.liabilities ?? {}
    const e = payload.equity ?? {}
    const assets = [].concat(a.current_assets ?? [], a.fixed_assets ?? [], a.other_assets ?? [])
    const liabilities = [].concat(l.current_liabilities ?? [], l.long_term_liabilities ?? [])
    const equity = e.equity_accounts ?? []
    const totalAssets = num(a.total_assets)
    const totalLiabilities = num(l.total_liabilities)
    const totalEquity = num(e.total_equity)
    const asOfDate = (payload.as_of_date || payload.date) ? new Date(payload.as_of_date || payload.date).toLocaleDateString() : '—'
    const renderAccountRows = (rows) =>
      (rows || []).map((row, i) => (
        <tr key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
          <td style={{ padding: '6px 12px 6px 24px', color: textColor }}>{row.account_number} {row.account_name}</td>
          <td style={{ padding: '6px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(num(row.balance))}</td>
        </tr>
      ))
    return (
      <div>
        <p style={{ color: textColor, opacity: 0.85, marginBottom: '16px', fontSize: '14px' }}>As of {asOfDate}</p>
        <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <tbody>
              <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                <td style={{ padding: '8px 12px', color: textColor, fontWeight: 600 }}>Assets</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: textColor }}></td>
              </tr>
              {renderAccountRows(assets)}
              <tr style={{ borderBottom: `1px solid ${borderColor}`, fontWeight: 600 }}>
                <td style={{ padding: '10px 12px', color: textColor }}>Total Assets</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(totalAssets)}</td>
              </tr>
              <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                <td style={{ padding: '8px 12px', color: textColor, fontWeight: 600 }}>Liabilities</td>
                <td style={{ padding: '8px 12px' }}></td>
              </tr>
              {renderAccountRows(liabilities)}
              <tr style={{ borderBottom: `1px solid ${borderColor}`, fontWeight: 600 }}>
                <td style={{ padding: '10px 12px', color: textColor }}>Total Liabilities</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(totalLiabilities)}</td>
              </tr>
              <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                <td style={{ padding: '8px 12px', color: textColor, fontWeight: 600 }}>Equity</td>
                <td style={{ padding: '8px 12px' }}></td>
              </tr>
              {renderAccountRows(equity)}
              <tr style={{ borderBottom: `1px solid ${borderColor}`, fontWeight: 600 }}>
                <td style={{ padding: '10px 12px', color: textColor }}>Total Equity</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: textColor }}>{formatCurrency(totalEquity)}</td>
              </tr>
              <tr style={{ backgroundColor: isDarkMode ? '#252525' : '#e8e8e8', fontWeight: 700, borderTop: `2px solid ${borderColor}` }}>
                <td style={{ padding: '12px', color: textColor }}>Total Liabilities & Equity</td>
                <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>{formatCurrency(totalLiabilities + totalEquity)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (selectedReport === 'aging' && Array.isArray(payload)) {
    if (payload.length === 0) {
      return <p style={{ color: textColor, opacity: 0.85 }}>No aging data for this date.</p>
    }
    const keys = Object.keys(payload[0] || {})
    return (
      <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
              {keys.map(k => (
                <th key={k} style={{ padding: '10px 12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>
                  {k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payload.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
                {keys.map(k => (
                  <td key={k} style={{ padding: '10px 12px', color: textColor }}>
                    {typeof row[k] === 'number' ? (Number.isInteger(row[k]) ? row[k] : num(row[k]).toFixed(2)) : String(row[k] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Fallback: show structured data if shape not recognized
  return (
    <pre style={{ color: textColor, fontSize: '12px', overflow: 'auto', margin: 0 }}>
      {JSON.stringify(reportData, null, 2)}
    </pre>
  )
}

export default Accounting
