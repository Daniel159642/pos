import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { cachedFetch } from '../services/offlineSync'
import {
  LayoutDashboard,
  FolderOpen,
  Settings as SettingsIcon,
  BookOpen,
  ArrowLeftRight,
  Library,
  TrendingUp,
  Wallet,
  Workflow,
  FileText,
  Truck,
  FileBarChart,
  PanelLeft,
  Plus,
  X,
  MapPin,
  DollarSign,
  Users
} from 'lucide-react'
import accountService from '../services/accountService'

const ACCOUNTING_SETTINGS_LOCAL_KEY = 'pos_accounting_settings_local'
function getAccountingSettingsFromLocal() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCOUNTING_SETTINGS_LOCAL_KEY) : null
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function persistAccountingSettingsLocal(partial) {
  try {
    const existing = getAccountingSettingsFromLocal() || {}
    const next = { ...existing, ...partial }
    if (typeof localStorage !== 'undefined') localStorage.setItem(ACCOUNTING_SETTINGS_LOCAL_KEY, JSON.stringify(next))
  } catch (e) { console.warn('[Accounting] persist local error', e) }
}
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
import BalanceSheetFilters from '../components/reports/BalanceSheetFilters'
import BalanceSheetTable from '../components/reports/BalanceSheetTable'
import ComparativeBalanceSheetTable from '../components/reports/ComparativeBalanceSheetTable'
import CashFlowFilters from '../components/reports/CashFlowFilters'
import CashFlowTable from '../components/reports/CashFlowTable'
import ComparativeCashFlowTable from '../components/reports/ComparativeCashFlowTable'
import reportService from '../services/reportService'
import Modal from '../components/common/Modal'
import Button from '../components/common/Button'
import Input from '../components/common/Input'
import CustomDropdown from '../components/common/CustomDropdown'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { useToast } from '../contexts/ToastContext'
import AccountingDirectoryTab from './AccountingDirectoryTab'
import Invoices from './Invoices'
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
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/** Professional export filename: "Report Name_YYYY-MM-DD.ext" or "Report Name_Start_to_End.ext" */
function exportFilename(reportName, dateOrStart, endDate, ext) {
  const today = new Date().toISOString().split('T')[0]
  const base = dateOrStart && endDate
    ? `${reportName}_${dateOrStart}_to_${endDate}`
    : `${reportName}_${dateOrStart || today}`
  return `${base}.${ext}`
}

/** Format number as currency for export (match UI: $1,234.56 or empty for 0) */
function exportFormatCurrency(amount, alwaysShowZero = false) {
  const n = Number(amount)
  if (Number.isNaN(n)) return alwaysShowZero ? '$0.00' : ''
  if (n === 0 && !alwaysShowZero) return ''
  if (n < 0) return `($${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Download an array-of-arrays as Excel (.xlsx) using SheetJS */
async function downloadExcel(rows, filename) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, filename)
}

// Row type styling for PDF (match UI: teal headers, grey totals)
const PDF_ROW_STYLES = {
  title: { fillColor: [45, 90, 107], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 12 },
  subtitle: { fillColor: [45, 90, 107], textColor: [255, 255, 255], fontSize: 10 },
  columnHeader: { fillColor: [197, 217, 224], textColor: [45, 74, 91], fontStyle: 'bold', fontSize: 9 },
  section: { fillColor: [45, 90, 107], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
  data: { fillColor: [255, 255, 255], textColor: [51, 51, 51], fontSize: 9 },
  subtotal: { fillColor: [232, 232, 232], textColor: [51, 51, 51], fontStyle: 'bold', fontSize: 9 },
  finalTotal: { fillColor: [232, 232, 232], textColor: [51, 51, 51], fontStyle: 'bold', fontSize: 9 },
  empty: { fillColor: [255, 255, 255], textColor: [51, 51, 51], fontSize: 9 }
}

/** Export report rows to PDF; rowTypes (optional) same length as rows: title|subtitle|columnHeader|section|data|subtotal|finalTotal|empty */
function exportReportToPdf(rows, filename, rowTypes) {
  const maxCols = Math.max(...rows.map((r) => r.length), 1)
  const body = rows.map((r) => {
    const row = [...r].map((c) => String(c ?? ''))
    while (row.length < maxCols) row.push('')
    return row
  })
  const orientation = maxCols > 3 ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const useRowTypes = Array.isArray(rowTypes) && rowTypes.length === body.length

  const headerText = filename.replace('.pdf', '').replace(/-/g, ' ')

  autoTable(doc, {
    body,
    startY: 20,
    margin: { top: 20, left: 14, right: 14 },
    styles: { fontSize: 9 },
    alternateRowStyles: useRowTypes ? undefined : { fillColor: [248, 248, 248] },
    didDrawPage: (data) => {
      doc.setFontSize(11)
      doc.setTextColor(100)
      doc.text(headerText, data.settings.margin.left, 14)
    },
    didParseCell: useRowTypes
      ? (data) => {
        const rowType = rowTypes[data.row.index] || 'data'
        const s = PDF_ROW_STYLES[rowType] || PDF_ROW_STYLES.data
        if (s.fillColor) data.cell.styles.fillColor = s.fillColor
        if (s.textColor) data.cell.styles.textColor = s.textColor
        if (s.fontStyle) data.cell.styles.fontStyle = s.fontStyle
        if (s.fontSize) data.cell.styles.fontSize = s.fontSize
      }
      : undefined,
    didDrawCell: useRowTypes
      ? (data) => {
        const rowType = rowTypes[data.row.index]
        if (rowType === 'finalTotal') {
          const y = data.cell.y + data.cell.height
          doc.setLineWidth(0.4)
          doc.setDrawColor(51, 51, 51)
          doc.line(data.cell.x, y - 1.5, data.cell.x + data.cell.width, y - 1.5)
          doc.line(data.cell.x, y - 0.5, data.cell.x + data.cell.width, y - 0.5)
        } else if (rowType === 'subtotal') {
          const y = data.cell.y
          doc.setLineWidth(0.3)
          doc.setDrawColor(150, 150, 150)
          doc.line(data.cell.x, y, data.cell.x + data.cell.width, y)
        }
      }
      : undefined
  })
  doc.save(filename)
}

function Accounting() {
  const { themeMode, themeColor } = useTheme()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [accountIdForLedgerModal, setAccountIdForLedgerModal] = useState(null)
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
  const directoryRefreshRef = useRef(null)

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
    { id: 'dashboard', label: 'Directory', icon: FolderOpen },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
    { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen },
    { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
    { id: 'general-ledger', label: 'Ledger', icon: Library },
    { id: 'financial-statements', label: 'Financial Statements', icon: FileBarChart },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'vendors', label: 'Vendors', icon: Truck }
  ]

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      ...(['dashboard', 'chart-of-accounts', 'transactions', 'vendors', 'invoices', 'general-ledger', 'financial-statements'].includes(activeTab)
        ? { height: '100%', minHeight: 0, overflow: 'hidden' }
        : { minHeight: '100vh' })
    }}>
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
        transition: isInitialMount ? 'none' : 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), margin-left 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        ...(['dashboard', 'chart-of-accounts', 'transactions', 'vendors', 'invoices', 'general-ledger', 'financial-statements'].includes(activeTab) ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' } : {})
      }}>
        {/* Error Display */}
        {error && (
          <div style={{ padding: '16px', marginBottom: '20px', backgroundColor: isDarkMode ? '#4a1a1a' : '#fee', border: `1px solid ${isDarkMode ? '#6a2a2a' : '#fcc'}`, borderRadius: '8px', color: isDarkMode ? '#ff6b6b' : '#c33', ...formFieldContainerStyle, ...(['dashboard', 'chart-of-accounts', 'transactions', 'vendors', 'invoices', 'general-ledger', 'financial-statements'].includes(activeTab) ? { flexShrink: 0 } : {}) }}>
            Error: {error}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <AccountingDirectoryTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} onDirectoryRefresh={directoryRefreshRef} themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} />
          </div>
        )}
        {activeTab === 'settings' && <SettingsTab formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} />}
        {activeTab === 'chart-of-accounts' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ChartOfAccountsTab
              formatCurrency={formatCurrency}
              getAuthHeaders={getAuthHeaders}
              themeColorRgb={themeColorRgb}
              isDarkMode={isDarkMode}
              setActiveTab={setActiveTab}
              onViewLedgerInLedgerTab={(account) => {
                setAccountIdForLedgerModal(account.id)
                setActiveTab('general-ledger')
              }}
            />
          </div>
        )}
        {activeTab === 'transactions' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TransactionsTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} />
          </div>
        )}
        {activeTab === 'general-ledger' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <GeneralLedgerTab
              dateRange={dateRange}
              formatCurrency={formatCurrency}
              getAuthHeaders={getAuthHeaders}
              themeColorRgb={themeColorRgb}
              isDarkMode={isDarkMode}
              accountIdForLedgerModal={accountIdForLedgerModal}
              onCloseAccountLedgerModal={() => setAccountIdForLedgerModal(null)}
            />
          </div>
        )}
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
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <FinancialStatementsTab
              dateRange={dateRange}
              formatCurrency={formatCurrency}
              getAuthHeaders={getAuthHeaders}
              setActiveTab={setActiveTab}
              themeColorRgb={themeColorRgb}
              isDarkMode={isDarkMode}
              directoryRefreshRef={directoryRefreshRef}
            />
          </div>
        )}
        {activeTab === 'invoices' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Invoices />
          </div>
        )}
        {activeTab === 'vendors' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <VendorsTab formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />
          </div>
        )}
      </div>
    </div>
  )
}

// Settings tab: tax by state, transaction fee rates, employee rates & weekly hours
function SettingsTab({ formatCurrency, getAuthHeaders, themeColorRgb = '132, 0, 255', isDarkMode: isDarkModeProp }) {
  const { show: showToast } = useToast()
  const local = getAccountingSettingsFromLocal()
  const defaultEdit = { default_sales_tax_pct: '', transaction_fee_rates: {}, sales_tax_by_state: {} }
  const defaultPos = { return_transaction_fee_take_loss: false, transaction_fee_mode: 'additional', transaction_fee_charge_cash: false, num_registers: 1, register_type: 'one_screen', return_tip_refund: false, require_signature_for_return: false }
  // Use local storage for instant display; never block tax-by-state on API (load from DB in background)
  const initialAccounting = local?.accounting && typeof local.accounting === 'object'
    ? { ...defaultEdit, ...local.accounting }
    : defaultEdit
  const [settings, setSettings] = useState(local?.settingsRaw ?? null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [posSettingsLoading, setPosSettingsLoading] = useState(!local?.pos)
  const [displaySettingsLoading, setDisplaySettingsLoading] = useState(!local?.display)
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [edit, setEdit] = useState(initialAccounting)
  const [employees, setEmployees] = useState([])
  const [qboConnected, setQboConnected] = useState(false)
  const [qboConnecting, setQboConnecting] = useState(false)
  const [qboSyncing, setQboSyncing] = useState(false)
  const [laborThisWeek, setLaborThisWeek] = useState({ entries: [] })
  const [employeeRateSaving, setEmployeeRateSaving] = useState(null)
  const [employeeRateEdits, setEmployeeRateEdits] = useState({})
  const [posSettings, setPosSettings] = useState(local?.pos && typeof local.pos.transaction_fee_mode === 'string' ? { ...defaultPos, ...local.pos } : defaultPos)
  const [savingPosFee, setSavingPosFee] = useState(false)
  const [tipAllocation, setTipAllocation] = useState(local?.display?.tipAllocation === 'split_all' ? 'split_all' : 'logged_in_employee') // 'logged_in_employee' | 'split_all'
  const [tipRefundFrom, setTipRefundFrom] = useState(local?.display?.tipRefundFrom === 'employee' ? 'employee' : 'store') // 'employee' | 'store'
  const [tipEnabled, setTipEnabled] = useState(!!local?.display?.tipEnabled)
  const [tipAfterPayment, setTipAfterPayment] = useState(!!local?.display?.tipAfterPayment)
  const [tipSuggestions, setTipSuggestions] = useState(Array.isArray(local?.display?.tipSuggestions) && local?.display?.tipSuggestions.length ? local?.display?.tipSuggestions.slice(0, 3) : [15, 18, 20])
  const [tipCustomInCheckout, setTipCustomInCheckout] = useState(!!local?.display?.tipCustomInCheckout)
  const [requireSignature, setRequireSignature] = useState(!!local?.display?.requireSignature)
  const [savingTipAllocation, setSavingTipAllocation] = useState(false)
  const isDarkMode = isDarkModeProp ?? document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const cardBg = isDarkMode ? '#1f1f1f' : '#f9f9f9'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  useEffect(() => {
    Promise.all([
      loadSettings(),
      loadEmployeesAndLabor(),
      loadPosSettings(),
      loadDisplaySettings(),
      loadQboStatus()
    ]).catch(() => { })
  }, [])

  // Always persist accounting settings to localStorage on any change (user edit or API load)
  useEffect(() => {
    persistAccountingSettingsLocal({
      accounting: edit,
      settingsRaw: settings,
      pos: posSettings,
      display: {
        tipAllocation,
        tipRefundFrom,
        tipEnabled,
        tipAfterPayment,
        tipSuggestions: Array.isArray(tipSuggestions) ? tipSuggestions.slice(0, 3) : [15, 18, 20],
        tipCustomInCheckout,
        requireSignature
      }
    })
  }, [edit, settings, posSettings, tipAllocation, tipRefundFrom, tipEnabled, tipAfterPayment, tipSuggestions, tipCustomInCheckout, requireSignature])

  const loadDisplaySettings = async () => {
    setDisplaySettingsLoading(true)
    try {
      const res = await cachedFetch('/api/customer-display/settings', { headers: (getAuthHeaders && getAuthHeaders()) || {} })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        const tipAlloc = d.tip_allocation === 'split_all' ? 'split_all' : 'logged_in_employee'
        const tipRefund = d.tip_refund_from === 'employee' ? 'employee' : 'store'
        const tips = Array.isArray(d.tip_suggestions) ? d.tip_suggestions.slice(0, 3) : [15, 18, 20]
        setTipAllocation(tipAlloc)
        setTipRefundFrom(tipRefund)
        setTipEnabled(d.tip_enabled === 1 || d.tip_enabled === true)
        setTipAfterPayment(d.tip_after_payment === 1 || d.tip_after_payment === true)
        setTipSuggestions(tips)
        setTipCustomInCheckout(d.tip_custom_in_checkout === 1 || d.tip_custom_in_checkout === true)
        setRequireSignature(d.signature_required === 1 || d.signature_required === true)
      }
    } catch (err) {
      console.warn('Error loading display/tip settings:', err)
    } finally {
      setDisplaySettingsLoading(false)
    }
  }

  const loadPosSettings = async () => {
    setPosSettingsLoading(true)
    try {
      const res = await cachedFetch('/api/pos-settings', { headers: (getAuthHeaders && getAuthHeaders()) || {} })
      const json = await res.json()
      if (json.success && json.settings) {
        const s = json.settings
        const next = {
          return_transaction_fee_take_loss: !!s.return_transaction_fee_take_loss,
          transaction_fee_mode: ['additional', 'included', 'none'].includes(s.transaction_fee_mode) ? s.transaction_fee_mode : 'additional',
          transaction_fee_charge_cash: !!s.transaction_fee_charge_cash,
          num_registers: s.num_registers ?? 1,
          register_type: s.register_type || 'one_screen',
          return_tip_refund: !!s.return_tip_refund,
          require_signature_for_return: !!s.require_signature_for_return
        }
        setPosSettings(next)
      }
    } catch (err) {
      console.warn('Error loading POS settings:', err)
    } finally {
      setPosSettingsLoading(false)
    }
  }

  const loadQboStatus = async () => {
    try {
      const authHeaders = getAuthHeaders && getAuthHeaders()
      const res = await fetch('/api/integrations/quickbooks/status', { headers: authHeaders || {} })
      const json = await res.json()
      if (json.success) {
        setQboConnected(json.connected)
      }
    } catch (err) {
      console.warn('Error loading QBO status:', err)
    }
  }

  const handleConnectQbo = async () => {
    setQboConnecting(true)
    try {
      const authHeaders = getAuthHeaders && getAuthHeaders()
      const res = await fetch('/api/integrations/quickbooks/connect-url', { headers: authHeaders || {} })
      const json = await res.json()
      if (json.success && json.url) {
        window.location.href = json.url
      } else {
        showToast(json.message || 'Failed to get QBO connect URL', 'error')
        setQboConnecting(false)
      }
    } catch (err) {
      showToast(err.message || 'Failed to connect QBO', 'error')
      setQboConnecting(false)
    }
  }

  const handleQboSyncAccounts = async () => {
    setQboSyncing(true)
    try {
      const authHeaders = getAuthHeaders && getAuthHeaders()
      const res = await fetch('/api/integrations/quickbooks/sync/accounts', {
        method: 'POST',
        headers: authHeaders || {}
      })
      const json = await res.json()
      if (json.success) {
        showToast(`Synced ${json.mapped_count} accounts from QuickBooks!`, 'success')
      } else {
        showToast(json.message || 'Failed to sync accounts', 'error')
      }
    } catch (err) {
      showToast(err.message || 'Failed to sync accounts', 'error')
    } finally {
      setQboSyncing(false)
    }
  }

  const savePosTransactionFeeSettings = async () => {
    setSavingPosFee(true)
    const pos = posSettings ?? defaultPos
    try {
      const headers = getAuthHeaders && getAuthHeaders()
      const res = await fetch('/api/pos-settings', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          num_registers: pos.num_registers ?? 1,
          register_type: pos.register_type || 'one_screen',
          return_transaction_fee_take_loss: !!pos.return_transaction_fee_take_loss,
          return_tip_refund: !!pos.return_tip_refund,
          require_signature_for_return: !!pos.require_signature_for_return,
          transaction_fee_mode: pos.transaction_fee_mode || 'additional',
          transaction_fee_charge_cash: !!pos.transaction_fee_charge_cash
        })
      })
      const json = await res.json()
      if (json.success) {
        showToast('Transaction fee settings saved.', 'success')
      } else {
        showToast(json.message || 'Failed to save', 'error')
      }
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error')
    } finally {
      setSavingPosFee(false)
    }
  }

  const saveTipsSettings = async () => {
    setSavingTipAllocation(true)
    const pos = posSettings ?? defaultPos
    try {
      const token = localStorage.getItem('sessionToken')
      const authHeaders = getAuthHeaders && getAuthHeaders()
      const headers = { ...(authHeaders || {}), 'Content-Type': 'application/json', 'Authorization': `Bearer ${token || ''}` }
      // 1) Customer display / tips UI settings
      const displayRes = await fetch('/api/customer-display/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tip_enabled: tipEnabled ? 1 : 0,
          tip_after_payment: tipAfterPayment ? 1 : 0,
          tip_suggestions: tipSuggestions.slice(0, 3),
          tip_custom_in_checkout: tipCustomInCheckout ? 1 : 0,
          tip_allocation: tipAllocation,
          tip_refund_from: tipRefundFrom,
          signature_required: requireSignature ? 1 : 0
        })
      })
      const displayJson = await displayRes.json()
      if (!displayJson.success) {
        showToast(displayJson.message || 'Failed to save tips settings', 'error')
        setSavingTipAllocation(false)
        return
      }
      // 2) POS settings (return tip refund + require signature for return)
      const posRes = await fetch('/api/pos-settings', {
        method: 'POST',
        headers: { ...(authHeaders || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          num_registers: pos.num_registers ?? 1,
          register_type: pos.register_type || 'one_screen',
          return_transaction_fee_take_loss: !!pos.return_transaction_fee_take_loss,
          return_tip_refund: !!pos.return_tip_refund,
          require_signature_for_return: !!pos.require_signature_for_return,
          transaction_fee_mode: pos.transaction_fee_mode || 'additional',
          transaction_fee_charge_cash: !!pos.transaction_fee_charge_cash
        })
      })
      const posJson = await posRes.json()
      if (displayJson.data) {
        setTipAllocation(displayJson.data.tip_allocation === 'split_all' ? 'split_all' : 'logged_in_employee')
        setTipRefundFrom(displayJson.data.tip_refund_from === 'employee' ? 'employee' : 'store')
        setTipEnabled(displayJson.data.tip_enabled === 1 || displayJson.data.tip_enabled === true)
        setTipAfterPayment(displayJson.data.tip_after_payment === 1 || displayJson.data.tip_after_payment === true)
        if (Array.isArray(displayJson.data.tip_suggestions)) setTipSuggestions(displayJson.data.tip_suggestions.slice(0, 3))
        setTipCustomInCheckout(displayJson.data.tip_custom_in_checkout === 1 || displayJson.data.tip_custom_in_checkout === true)
        setRequireSignature(displayJson.data.signature_required === 1 || displayJson.data.signature_required === true)
      }
      if (posJson.success) setPosSettings(prev => ({ ...(prev ?? defaultPos), return_tip_refund: !!pos.return_tip_refund, require_signature_for_return: !!pos.require_signature_for_return }))
      showToast('Tips settings saved.', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error')
    } finally {
      setSavingTipAllocation(false)
    }
  }

  const loadSettings = async () => {
    setSettingsLoading(true)
    try {
      const res = await cachedFetch('/api/accounting/settings', { headers: (getAuthHeaders && getAuthHeaders()) || {} })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        const nextEdit = {
          default_sales_tax_pct: String(d.default_sales_tax_pct ?? 8),
          transaction_fee_rates: { ...(d.transaction_fee_rates || {}) },
          sales_tax_by_state: d.sales_tax_by_state && typeof d.sales_tax_by_state === 'object' ? { ...d.sales_tax_by_state } : {}
        }
        setSettings(d)
        setEdit(nextEdit)
      }
    } catch (err) {
      console.error('Error loading settings:', err)
    } finally {
      setSettingsLoading(false)
    }
  }

  const loadEmployeesAndLabor = async () => {
    setEmployeesLoading(true)
    try {
      const now = new Date()
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      const mon = new Date(now)
      mon.setDate(diff)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      const start = mon.toISOString().slice(0, 10)
      const end = sun.toISOString().slice(0, 10)
      const authH = (getAuthHeaders && getAuthHeaders()) || {}
      const [empRes, laborRes] = await Promise.all([
        fetch('/api/employees', { headers: authH }),
        fetch(`/api/accounting/labor-summary?start_date=${start}&end_date=${end}`, { headers: authH })
      ])
      if (empRes.ok) {
        const empJson = await empRes.json()
        const list = empJson.data && Array.isArray(empJson.data) ? empJson.data : (Array.isArray(empJson) ? empJson : [])
        setEmployees(list)
      }
      if (laborRes.ok) {
        const laborJson = await laborRes.json()
        const entries = laborJson.data?.entries ?? laborJson.entries ?? []
        setLaborThisWeek({ entries })
      }
    } catch (err) {
      console.warn('Error loading employees/labor:', err)
    } finally {
      setEmployeesLoading(false)
    }
  }

  const saveAccountingSettings = async (updates) => {
    try {
      setSaving(true)
      const res = await fetch('/api/accounting/settings', {
        method: 'PATCH',
        headers: { ...((getAuthHeaders && getAuthHeaders()) || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      const json = await res.json()
      if (json.success) {
        if (json.data) {
          setSettings(json.data)
          setEdit({
            default_sales_tax_pct: String(json.data.default_sales_tax_pct ?? 8),
            transaction_fee_rates: { ...(json.data.transaction_fee_rates || {}) },
            sales_tax_by_state: json.data.sales_tax_by_state && typeof json.data.sales_tax_by_state === 'object' ? { ...json.data.sales_tax_by_state } : {}
          })
        }
        showToast('Settings saved.', 'success')
        return true
      }
      showToast(json.message || 'Failed to save', 'error')
      return false
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  const saveEmployeeRate = async (employeeId, hourlyRate) => {
    setEmployeeRateSaving(employeeId)
    try {
      const res = await fetch(`/api/admin/employees/${employeeId}`, {
        method: 'PUT',
        headers: { ...((getAuthHeaders && getAuthHeaders()) || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ hourly_rate: hourlyRate })
      })
      const json = await res.json()
      if (json.success) {
        setEmployees(prev => prev.map(e => e.employee_id === employeeId ? { ...e, hourly_rate: hourlyRate } : e))
        showToast('Employee rate updated.', 'success')
        setEmployeeRateEdits(prev => { const next = { ...prev }; delete next[employeeId]; return next })
        return true
      }
      showToast(json.error || json.message || 'Failed to update', 'error')
      return false
    } catch (err) {
      showToast('Failed to update employee rate', 'error')
      return false
    } finally {
      setEmployeeRateSaving(null)
    }
  }

  const setFeeRate = (method, value) => {
    setEdit(prev => ({
      ...prev,
      transaction_fee_rates: { ...prev.transaction_fee_rates, [method]: parseFloat(value) || 0 }
    }))
  }

  const safeEdit = edit ?? defaultEdit
  const safePosSettings = posSettings ?? defaultPos
  const rates = safeEdit.transaction_fee_rates || {}
  const feeMethods = ['credit_card', 'debit_card', 'mobile_payment', 'cash', 'check', 'store_credit']
  const cardStyle = { padding: '20px', backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: '12px' }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Tax by state */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <MapPin size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: '15px', color: textColor }}>Tax by state</span>
        </div>
        <p style={{ fontSize: '13px', color: textColor, opacity: 0.8, marginBottom: '12px' }}>
          Default tax is used when no state-specific rate is set. Add state codes (e.g. CA, NY) and tax % for each.
        </p>
        <div className={settingsLoading ? 'settings-field-loading' : ''} style={{ opacity: settingsLoading ? 0.7 : 1 }}>
          <FormField>
            <FormLabel isDarkMode={isDarkMode}>Default sales tax (%)</FormLabel>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={safeEdit.default_sales_tax_pct}
              placeholder={settingsLoading ? 'Loading…' : ''}
              onChange={e => setEdit(prev => ({ ...(prev ?? defaultEdit), default_sales_tax_pct: e.target.value }))}
              {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
              style={{ ...inputBaseStyle(isDarkMode, themeColorRgb, false), width: '120px' }}
              disabled={settingsLoading}
            />
          </FormField>
          <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: textColor }}>State overrides</div>
          {settingsLoading && Object.keys(safeEdit.sales_tax_by_state || {}).length === 0 ? (
            <div style={{ padding: '8px 0', color: textColor, opacity: 0.6, fontSize: '13px' }}>Loading…</div>
          ) : null}
          {Object.entries(safeEdit.sales_tax_by_state || {}).map(([stateCode, pct]) => (
            <div key={stateCode} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                value={stateCode}
                readOnly
                style={{ ...inputBaseStyle(isDarkMode, themeColorRgb, false), width: '64px', padding: '6px 8px', textTransform: 'uppercase' }}
              />
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={pct}
                onChange={e => setEdit(prev => {
                  const p = prev ?? defaultEdit
                  return { ...p, sales_tax_by_state: { ...(p.sales_tax_by_state || {}), [stateCode]: parseFloat(e.target.value) || 0 } }
                })}
                style={{ ...inputBaseStyle(isDarkMode, themeColorRgb, false), width: '80px', padding: '6px 8px' }}
              />
              <span style={{ fontSize: '13px', color: textColor, opacity: 0.8 }}>%</span>
              <button
                type="button"
                onClick={() => setEdit(prev => {
                  const p = prev ?? defaultEdit
                  const next = { ...(p.sales_tax_by_state || {}) }; delete next[stateCode]; return { ...p, sales_tax_by_state: next }
                })}
                style={{ padding: '6px 10px', border: 'none', borderRadius: '6px', background: isDarkMode ? '#444' : '#e0e0e0', color: textColor, cursor: 'pointer', fontSize: '12px' }}
              >
                Remove
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
            <button
              type="button"
              disabled={settingsLoading}
              onClick={() => {
                const code = prompt('State code (2 letters, e.g. CA)')
                if (code && code.trim().length === 2) {
                  const upper = code.trim().toUpperCase()
                  setEdit(prev => { const p = prev ?? defaultEdit; return { ...p, sales_tax_by_state: { ...(p.sales_tax_by_state || {}), [upper]: 0 } } })
                }
              }}
              style={{ padding: '8px 14px', marginRight: 'auto', border: `1px solid ${borderColor}`, borderRadius: '8px', background: 'transparent', color: textColor, cursor: settingsLoading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 500, opacity: settingsLoading ? 0.6 : 1 }}
            >
              + Add state
            </button>
            <Button
              variant="primary"
              disabled={saving || settingsLoading}
              onClick={async () => {
                const ok = await saveAccountingSettings({
                  default_sales_tax_pct: parseFloat(safeEdit.default_sales_tax_pct) || 0,
                  sales_tax_by_state: safeEdit.sales_tax_by_state || {}
                })
                if (ok) loadSettings()
              }}
              themeColorRgb={themeColorRgb}
              isDarkMode={isDarkMode}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Transaction fee */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <DollarSign size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: '15px', color: textColor }}>Transaction fee</span>
        </div>

        <FormTitle isDarkMode={isDarkMode} style={{ marginTop: '4px', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
          Transaction fee settings
        </FormTitle>
        <div className={posSettingsLoading ? 'settings-field-loading' : ''} style={{ marginTop: '2px', marginBottom: '16px', borderLeft: `3px solid ${borderColor}`, paddingLeft: '12px', opacity: posSettingsLoading ? 0.7 : 1, pointerEvents: posSettingsLoading ? 'none' : 'auto' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: textColor, opacity: 0.85, marginBottom: '8px' }}>Returns</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
            <input
              type="checkbox"
              checked={safePosSettings.return_transaction_fee_take_loss || false}
              onChange={e => setPosSettings(prev => ({ ...prev, return_transaction_fee_take_loss: e.target.checked }))}
              style={{ width: '18px', height: '18px', accentColor: `rgb(${themeColorRgb})` }}
            />
            <span style={{ fontSize: '14px', fontWeight: 500, color: textColor }}>Take loss on transaction fee (do not deduct from return refund)</span>
          </label>
          <div style={{ fontSize: '13px', fontWeight: 600, color: textColor, opacity: 0.85, marginBottom: '6px', marginTop: '14px' }}>At checkout</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="transaction_fee_mode"
                checked={safePosSettings.transaction_fee_mode === 'additional'}
                onChange={() => setPosSettings(prev => ({ ...prev, transaction_fee_mode: 'additional' }))}
                style={{ accentColor: `rgb(${themeColorRgb})` }}
              />
              <span style={{ fontSize: '14px', color: textColor }}>Additional fee at checkout</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="transaction_fee_mode"
                checked={safePosSettings.transaction_fee_mode === 'included'}
                onChange={() => setPosSettings(prev => ({ ...prev, transaction_fee_mode: 'included' }))}
                style={{ accentColor: `rgb(${themeColorRgb})` }}
              />
              <span style={{ fontSize: '14px', color: textColor }}>Included in product price (no separate fee)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="transaction_fee_mode"
                checked={safePosSettings.transaction_fee_mode === 'none'}
                onChange={() => setPosSettings(prev => ({ ...prev, transaction_fee_mode: 'none' }))}
                style={{ accentColor: `rgb(${themeColorRgb})` }}
              />
              <span style={{ fontSize: '14px', color: textColor }}>No fee (store absorbs)</span>
            </label>
          </div>
          {safePosSettings.transaction_fee_mode === 'additional' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginTop: '6px' }}>
              <input
                type="checkbox"
                checked={safePosSettings.transaction_fee_charge_cash || false}
                onChange={e => setPosSettings(prev => ({ ...prev, transaction_fee_charge_cash: e.target.checked }))}
                style={{ width: '18px', height: '18px', accentColor: `rgb(${themeColorRgb})` }}
              />
              <span style={{ fontSize: '14px', color: textColor }}>Charge transaction fee for cash payments</span>
            </label>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <Button
            variant="primary"
            disabled={savingPosFee}
            onClick={savePosTransactionFeeSettings}
            themeColorRgb={themeColorRgb}
            isDarkMode={isDarkMode}
          >
            {savingPosFee ? 'Saving...' : 'Save'}
          </Button>
        </div>

        <FormTitle isDarkMode={isDarkMode} style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
          Fee rates by payment method
        </FormTitle>
        <p style={{ fontSize: '13px', color: textColor, opacity: 0.8, marginBottom: '12px' }}>
          Fee rate per payment method (as decimal, e.g. 0.029 = 2.9%). Cash/check/store credit typically 0.
        </p>
        <div className={settingsLoading ? 'settings-field-loading' : ''} style={{ opacity: settingsLoading ? 0.7 : 1, pointerEvents: settingsLoading ? 'none' : 'auto' }}>
          {settingsLoading ? (
            <div style={{ padding: '12px 0', color: textColor, opacity: 0.6, fontSize: '13px' }}>Loading…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {feeMethods.map(method => (
                <div key={method} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ ...formLabelStyle(isDarkMode), marginBottom: 0, minWidth: '110px', fontSize: '13px' }}>{method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.001}
                    value={rates[method] ?? 0}
                    onChange={e => setFeeRate(method, e.target.value)}
                    {...getInputFocusHandlers(themeColorRgb, isDarkMode)}
                    style={{ ...inputBaseStyle(isDarkMode, themeColorRgb, false), width: '80px' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <Button
            variant="primary"
            disabled={saving || settingsLoading}
            onClick={async () => {
              const ok = await saveAccountingSettings({ transaction_fee_rates: safeEdit.transaction_fee_rates })
              if (ok) loadSettings()
            }}
            themeColorRgb={themeColorRgb}
            isDarkMode={isDarkMode}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Tips settings */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Wallet size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: '15px', color: textColor }}>Tips settings</span>
        </div>

        <div className={(displaySettingsLoading || posSettingsLoading) ? 'settings-field-loading' : ''} style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: '12px', marginBottom: '16px', opacity: (displaySettingsLoading || posSettingsLoading) ? 0.7 : 1, pointerEvents: (displaySettingsLoading || posSettingsLoading) ? 'none' : 'auto' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
            <input
              type="checkbox"
              checked={safePosSettings.return_tip_refund || false}
              onChange={e => setPosSettings(prev => ({ ...prev, return_tip_refund: e.target.checked }))}
              style={{ width: '18px', height: '18px', accentColor: `rgb(${themeColorRgb})` }}
            />
            <span style={{ fontSize: '14px', fontWeight: 500, color: textColor }}>Refund tip on returns (do not deduct proportional tip from refund)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
            <input
              type="checkbox"
              checked={safePosSettings.require_signature_for_return || false}
              onChange={e => setPosSettings(prev => ({ ...prev, require_signature_for_return: e.target.checked }))}
              style={{ width: '18px', height: '18px', accentColor: `rgb(${themeColorRgb})` }}
            />
            <span style={{ fontSize: '14px', fontWeight: 500, color: textColor }}>Require signature for return (customer signs and chooses print/email/no receipt before processing)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
            <input
              type="checkbox"
              checked={tipEnabled}
              onChange={e => setTipEnabled(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: `rgb(${themeColorRgb})` }}
            />
            <span style={{ fontSize: '14px', fontWeight: 500, color: textColor }}>Tip prompts before payment</span>
          </label>
          <div style={{ fontSize: '13px', fontWeight: 600, color: textColor, opacity: 0.85, marginBottom: '8px' }}>Tip suggestion amounts (%) — 3 options only (4th is No tip)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
            {(tipSuggestions.slice(0, 3)).map((p, i) => (
              <input
                key={i}
                type="number"
                min={0}
                max={100}
                step={1}
                value={p}
                onChange={e => {
                  const v = parseInt(e.target.value, 10)
                  if (isNaN(v) || v < 0 || v > 100) return
                  const next = [...tipSuggestions.slice(0, 3)]
                  next[i] = v
                  setTipSuggestions(next)
                }}
                style={{
                  width: '56px', padding: '6px 8px', fontSize: '14px', borderRadius: '6px',
                  border: `1px solid ${borderColor}`, background: cardBg, color: textColor
                }}
              />
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
            <input
              type="checkbox"
              checked={tipCustomInCheckout || false}
              onChange={e => setTipCustomInCheckout(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: `rgb(${themeColorRgb})` }}
            />
            <span style={{ fontSize: '14px', color: textColor }}>Show custom tip option in checkout</span>
          </label>
          <div style={{ fontSize: '13px', fontWeight: 600, color: textColor, opacity: 0.85, marginBottom: '6px' }}>Tip allocation</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="radio" name="tip_allocation" checked={tipAllocation === 'logged_in_employee'} onChange={() => setTipAllocation('logged_in_employee')} style={{ accentColor: `rgb(${themeColorRgb})` }} />
              <span style={{ fontSize: '14px', color: textColor }}>Allocate to logged-in employee</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="radio" name="tip_allocation" checked={tipAllocation === 'split_all'} onChange={() => setTipAllocation('split_all')} style={{ accentColor: `rgb(${themeColorRgb})` }} />
              <span style={{ fontSize: '14px', color: textColor }}>Split amongst all employees</span>
            </label>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: textColor, opacity: 0.85, marginBottom: '6px' }}>When refunding tip</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="radio" name="tip_refund_from" checked={tipRefundFrom === 'employee'} onChange={() => setTipRefundFrom('employee')} style={{ accentColor: `rgb(${themeColorRgb})` }} />
              <span style={{ fontSize: '14px', color: textColor }}>Deduct from employee(s)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="radio" name="tip_refund_from" checked={tipRefundFrom === 'store'} onChange={() => setTipRefundFrom('store')} style={{ accentColor: `rgb(${themeColorRgb})` }} />
              <span style={{ fontSize: '14px', color: textColor }}>Store absorbs cost</span>
            </label>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginTop: '8px' }}>
            <input
              type="checkbox"
              checked={requireSignature}
              onChange={e => setRequireSignature(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: `rgb(${themeColorRgb})` }}
            />
            <span style={{ fontSize: '14px', fontWeight: 500, color: textColor }}>Require signature</span>
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button
            variant="primary"
            disabled={savingTipAllocation}
            onClick={saveTipsSettings}
            themeColorRgb={themeColorRgb}
            isDarkMode={isDarkMode}
          >
            {savingTipAllocation ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Employee rates & weekly hours */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Users size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: '15px', color: textColor }}>Employee rates & hours</span>
        </div>
        <p style={{ fontSize: '13px', color: textColor, opacity: 0.8, marginBottom: '12px' }}>
          View and edit hourly rates. Hours shown are for the current week (Mon–Sun).
        </p>
        <div className={employeesLoading ? 'settings-field-loading' : ''} style={{ overflowX: 'auto', opacity: employeesLoading ? 0.7 : 1, pointerEvents: employeesLoading ? 'none' : 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${borderColor}` }}>
                <th style={{ textAlign: 'left', padding: '10px 8px', color: textColor, opacity: 0.8 }}>Employee</th>
                <th style={{ textAlign: 'right', padding: '10px 8px', color: textColor, opacity: 0.8 }}>Hourly rate ($)</th>
                <th style={{ textAlign: 'right', padding: '10px 8px', color: textColor, opacity: 0.8 }}>Hours this week</th>
                <th style={{ width: '80px' }} />
              </tr>
            </thead>
            <tbody>
              {employeesLoading && employees.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: textColor, opacity: 0.7, fontSize: '13px' }}>Loading…</td>
                </tr>
              ) : employees.map(emp => {
                const laborEntry = laborThisWeek.entries.find(e => e.employee_id === emp.employee_id)
                const hours = laborEntry?.hours ?? 0
                const rateEdit = employeeRateEdits[emp.employee_id]
                const rateDisplay = rateEdit !== undefined ? rateEdit.value : (emp.hourly_rate ?? 0)
                const dirty = rateEdit?.dirty ?? false
                return (
                  <tr key={emp.employee_id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                    <td style={{ padding: '10px 8px', color: textColor }}>{emp.first_name} {emp.last_name}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={rateDisplay}
                        onChange={e => {
                          const v = parseFloat(e.target.value) || 0
                          setEmployeeRateEdits(prev => ({ ...prev, [emp.employee_id]: { value: v, dirty: true } }))
                        }}
                        style={{ ...inputBaseStyle(isDarkMode, themeColorRgb, false), width: '80px', padding: '6px 8px', textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: textColor }}>{hours.toFixed(1)}</td>
                    <td style={{ padding: '10px 8px' }}>
                      {dirty && (
                        <button
                          type="button"
                          disabled={employeeRateSaving === emp.employee_id}
                          onClick={async () => {
                            const ok = await saveEmployeeRate(emp.employee_id, rateDisplay)
                            if (ok) setEmployeeRateEdits(prev => { const next = { ...prev }; delete next[emp.employee_id]; return next })
                          }}
                          style={{ padding: '4px 10px', border: 'none', borderRadius: '6px', background: `rgba(${themeColorRgb}, 0.9)`, color: '#fff', cursor: 'pointer', fontSize: '12px' }}
                        >
                          {employeeRateSaving === emp.employee_id ? 'Saving...' : 'Save'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {employees.length === 0 && !employeesLoading && (
          <div style={{ padding: '16px', textAlign: 'center', color: textColor, opacity: 0.8, fontSize: '14px' }}>
            No employees. Add employees in Admin to set rates.
          </div>
        )}
      </div>

      {/* QuickBooks Integration */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <FolderOpen size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: '15px', color: textColor }}>QuickBooks Online Integration</span>
        </div>
        <p style={{ fontSize: '13px', color: textColor, opacity: 0.8, marginBottom: '16px' }}>
          Connect your QuickBooks Online account to automatically sync your chart of accounts, customers, vendors, and transactions.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', borderRadius: '8px', border: `1px solid ${borderColor}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#2ca01c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
              QB
            </div>
            <div>
              <div style={{ fontWeight: 500, color: textColor, fontSize: '14px' }}>QuickBooks Online</div>
              <div style={{ fontSize: '12px', color: qboConnected ? '#2ca01c' : (isDarkMode ? '#888' : '#666'), fontWeight: qboConnected ? 600 : 400 }}>
                {qboConnected ? 'Connected' : 'Not connected'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {qboConnected && (
              <Button
                variant="primary"
                disabled={qboSyncing}
                onClick={handleQboSyncAccounts}
                themeColorRgb={themeColorRgb}
                isDarkMode={isDarkMode}
              >
                {qboSyncing ? 'Syncing...' : 'Sync Chart of Accounts'}
              </Button>
            )}
            {!qboConnected && (
              <Button
                variant="primary"
                disabled={qboConnecting}
                onClick={handleConnectQbo}
                themeColorRgb={themeColorRgb}
                isDarkMode={isDarkMode}
              >
                {qboConnecting ? 'Connecting...' : 'Connect to QuickBooks'}
              </Button>
            )}
          </div>
        </div>
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
function ChartOfAccountsTab({ formatCurrency, getAuthHeaders, themeColorRgb, isDarkMode, setActiveTab, onViewLedgerInLedgerTab }) {
  const { show: showToast } = useToast()
  const [accounts, setAccounts] = useState([])
  const [filteredAccounts, setFilteredAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({})

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)

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

  const handleViewBalance = (account) => {
    onViewLedgerInLedgerTab(account)
  }

  const handleClearFilters = () => {
    setFilters({})
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ marginBottom: '24px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: _isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>Chart of Accounts</h1>
        <p style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Your chart of accounts lists all ledger accounts (assets, liabilities, equity, revenue, expenses). Organize accounts, track balances, and run reports from here.</p>
      </div>

      <div style={{ marginBottom: '20px', flexShrink: 0 }}>
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

      <div style={{ flexShrink: 0 }}>
        <AccountFilters
          filters={filters}
          onFilterChange={setFilters}
          onClearFilters={handleClearFilters}
        />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: _isDark ? '#2a2a2a' : 'white',
          borderRadius: '8px',
          boxShadow: _isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          border: _isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
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
            gap: '16px',
            flexShrink: 0
          }}
        >
          <p style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>
            Showing {filteredAccounts.length} of {accounts.length} accounts
          </p>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
          <AccountTable
            accounts={filteredAccounts}
            loading={loading}
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
        showCloseButton={false}
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
    try {
      await transactionService.deleteTransaction(transaction.transaction.id)
      showToast('Transaction deleted successfully', 'success')
      loadTransactions()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete transaction', 'error')
    }
  }

  const handlePostTransaction = async (transaction) => {
    try {
      await transactionService.postTransaction(transaction.transaction.id)
      showToast('Transaction posted successfully', 'success')
      loadTransactions()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to post transaction', 'error')
    }
  }

  const handleUnpostTransaction = async (transaction) => {
    try {
      await transactionService.unpostTransaction(transaction.transaction.id)
      showToast('Transaction unposted successfully', 'success')
      loadTransactions()
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to unpost transaction', 'error')
    }
  }

  const handleVoidTransaction = async (transaction, reason) => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ marginBottom: '24px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: _isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>Transactions</h1>
        <p style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Record and manage journal entries</p>
      </div>

      <div style={{ marginBottom: '20px', flexShrink: 0 }}>
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

      <div style={{ flexShrink: 0 }}>
        <TransactionFilters
          filters={filters}
          onFilterChange={setFilters}
          onClearFilters={handleClearFilters}
        />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: _isDark ? '#2a2a2a' : 'white',
          borderRadius: '8px',
          boxShadow: _isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          border: _isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
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
            gap: '16px',
            flexShrink: 0
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

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
          <TransactionTable
            transactions={transactions}
            loading={loading}
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

// General Ledger Tab
function GeneralLedgerTab({ dateRange, formatCurrency, getAuthHeaders, themeColorRgb, isDarkMode, accountIdForLedgerModal, onCloseAccountLedgerModal }) {
  const [entries, setEntries] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    start_date: dateRange.start_date,
    end_date: dateRange.end_date
  })

  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [accountLedgerModalData, setAccountLedgerModalData] = useState(null)
  const [accountLedgerModalLoading, setAccountLedgerModalLoading] = useState(false)

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

  // Load account ledger for the popup when accountIdForLedgerModal is set
  useEffect(() => {
    if (!accountIdForLedgerModal) {
      setAccountLedgerModalData(null)
      return
    }
    let cancelled = false
    const loadAccountLedgerModal = async () => {
      setAccountLedgerModalLoading(true)
      setAccountLedgerModalData(null)
      try {
        const data = await transactionService.getAccountLedger(accountIdForLedgerModal, {
          start_date: dateRange.start_date,
          end_date: dateRange.end_date
        })
        if (!cancelled && data && data.account && Array.isArray(data.entries)) {
          setAccountLedgerModalData(data)
        }
      } catch (err) {
        if (!cancelled) showToast(err.response?.data?.message || 'Failed to fetch account ledger', 'error')
      } finally {
        if (!cancelled) setAccountLedgerModalLoading(false)
      }
    }
    loadAccountLedgerModal()
    return () => { cancelled = true }
  }, [accountIdForLedgerModal, dateRange.start_date, dateRange.end_date])

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
    a.download = exportFilename('General-Ledger', filters.start_date || new Date().toISOString().split('T')[0], filters.end_date, 'csv')
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
      await downloadExcel(buildGeneralLedgerRows(), exportFilename('General-Ledger', filters.start_date || new Date().toISOString().split('T')[0], filters.end_date, 'xlsx'))
      showToast('Ledger exported to Excel', 'success')
    } catch (e) {
      showToast('Excel export failed', 'error')
    }
  }

  const handleExportPdf = () => {
    if (entries.length === 0) {
      showToast('No data to export', 'error')
      return
    }
    try {
      const allRows = buildGeneralLedgerRows()
      const stringify = (row) => row.map((cell) => (cell == null ? '' : String(cell)))
      const head = [stringify(allRows[0])]
      const body = allRows.slice(1).map(stringify)
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      autoTable(doc, {
        head,
        body,
        startY: 28,
        margin: { top: 28, left: 14, right: 14 },
        styles: { fontSize: 9 },
        headStyles: { fillColor: [45, 90, 107], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        didDrawPage: (data) => {
          doc.setFontSize(16)
          doc.setTextColor(40)
          doc.text('General Ledger', data.settings.margin.left, 15)
          doc.setFontSize(10)
          if (filters.start_date && filters.end_date) {
            doc.text(`Period: ${filters.start_date} to ${filters.end_date}`, data.settings.margin.left, 22)
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.row.index === body.length - 1) {
            const y = data.cell.y + data.cell.height
            doc.setLineWidth(0.4)
            doc.setDrawColor(51, 51, 51)
            doc.line(data.cell.x, y - 1.5, data.cell.x + data.cell.width, y - 1.5)
            doc.line(data.cell.x, y - 0.5, data.cell.x + data.cell.width, y - 0.5)
          }
        }
      })
      doc.save(exportFilename('General-Ledger', filters.start_date || new Date().toISOString().split('T')[0], filters.end_date, 'pdf'))
      showToast('Ledger exported to PDF', 'success')
    } catch (e) {
      console.error('Ledger PDF export error:', e)
      showToast(e?.message || 'PDF export failed', 'error')
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, marginBottom: '24px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: _isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>Ledger</h1>
        <p style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>View all posted accounting transactions</p>
      </div>

      <div style={{ flexShrink: 0 }}>
        <GeneralLedgerFilters
          filters={filters}
          accounts={accounts}
          onFilterChange={setFilters}
          onClearFilters={handleClearFilters}
          onExport={handleExport}
          onExportExcel={handleExportExcel}
          onExportPdf={handleExportPdf}
          loading={loading}
        />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: _isDark ? '#2a2a2a' : 'white',
          borderRadius: '8px',
          boxShadow: _isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          border: _isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'
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
            gap: '16px',
            flexShrink: 0
          }}
        >
          <p style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280', margin: 0 }}>
            {loading ? 'Loading...' : `Showing ${entries.length} entries`}
            {!loading && filters.account_id ? ` for ${getSelectedAccountName()}` : ''}
            {!loading && filters.start_date && filters.end_date && ` · ${new Date(filters.start_date).toLocaleDateString()} – ${new Date(filters.end_date).toLocaleDateString()}`}
          </p>
          {!loading && entries.length > 0 && (
            <span style={{ fontSize: '14px', color: _isDark ? '#9ca3af' : '#6b7280' }}>
              Debits: ${totalDebits.toFixed(2)} · Credits: ${totalCredits.toFixed(2)}
            </span>
          )}
        </div>

        <GeneralLedgerTable
          entries={entries}
          loading={loading}
          showRunningBalance={false}
          onViewTransaction={handleViewTransaction}
          fixedHeader
        />
      </div>

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

      {/* Account Ledger popup (from Chart of Accounts → View Ledger) */}
      <Modal
        isOpen={!!accountIdForLedgerModal}
        onClose={onCloseAccountLedgerModal}
        title={accountLedgerModalData?.account ? `Account Ledger: ${accountLedgerModalData.account.account_number || ''} ${accountLedgerModalData.account.account_name ?? ''}`.trim() || 'Account Ledger' : 'Account Ledger'}
        size="lg"
      >
        {accountLedgerModalLoading ? (
          <LoadingSpinner size="lg" text="Loading account ledger..." />
        ) : accountLedgerModalData?.account && Array.isArray(accountLedgerModalData?.entries) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '85vh' }}>
            {/* Account Details + Balance Summary – always visible at top */}
            <div style={{ flexShrink: 0 }}>
              <AccountLedgerCard
                ledgerData={accountLedgerModalData}
                dateRange={{ start: dateRange.start_date, end: dateRange.end_date }}
              />
            </div>
            {/* Transactions – scrollable below */}
            <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '14px', color: textColor, opacity: 0.7, flexShrink: 0, margin: 0 }}>
                Showing <span style={{ fontWeight: '600' }}>{accountLedgerModalData.entries.length}</span> transactions
              </p>
              <div style={{ overflow: 'auto', flex: 1, minHeight: '200px', border: `1px solid ${borderColor}`, borderRadius: '8px' }}>
                <GeneralLedgerTable
                  entries={accountLedgerModalData.entries}
                  showRunningBalance={true}
                  onViewTransaction={handleViewTransaction}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <Button variant="secondary" onClick={onCloseAccountLedgerModal} themeColorRgb={themeColorRgb} isDarkMode={isDarkMode}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px', color: textColor }}>
            {accountIdForLedgerModal ? 'Failed to load account ledger or no entries in this period.' : ''}
            <div style={{ marginTop: '12px' }}>
              <Button variant="secondary" onClick={onCloseAccountLedgerModal} themeColorRgb={themeColorRgb} isDarkMode={isDarkMode}>
                Close
              </Button>
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
    a.download = exportFilename(`Account-Ledger-${accountId}`, new Date().toISOString().split('T')[0], null, 'csv')
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
      await downloadExcel(buildAccountLedgerRows(), exportFilename(`Account-Ledger-${accountId}`, new Date().toISOString().split('T')[0], null, 'xlsx'))
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
function FinancialStatementsTab({ dateRange, formatCurrency, getAuthHeaders, setActiveTab, themeColorRgb, isDarkMode, directoryRefreshRef }) {
  const [reportType, setReportType] = useState('profit-loss')
  const [generateButtonState, setGenerateButtonState] = useState({ loading: false, disabled: true, hasReportData: false })
  const [exportChoice, setExportChoice] = useState('')
  const [saving, setSaving] = useState(false)
  const generateReportRef = useRef(null)
  const _isDark = isDarkMode ?? document.documentElement.classList.contains('dark-theme')

  const exportOptions = [
    { value: 'csv', label: 'Export to CSV' },
    { value: 'excel', label: 'Export to Excel' },
    { value: 'pdf', label: 'Export to PDF' },
    { value: 'print', label: 'Print' }
  ]
  const handleExportSelect = (e) => {
    const v = e?.target?.value
    setExportChoice('')
    if (v === 'csv') generateReportRef.current?.exportToCsv()
    else if (v === 'excel') generateReportRef.current?.exportToExcel()
    else if (v === 'pdf') generateReportRef.current?.exportToPdf()
    else if (v === 'print') generateReportRef.current?.print()
  }
  const handleSaveToDirectory = () => {
    generateReportRef.current?.saveToDirectory?.()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0 }}>
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
          <Button
            type="button"
            onClick={handleSaveToDirectory}
            disabled={!generateButtonState.hasReportData || saving}
            themeColorRgb={themeColorRgb}
            isDarkMode={isDarkMode}
          >
            {saving ? 'Saving...' : 'Save to directory'}
          </Button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {reportType === 'trial-balance' && (
          <TrialBalanceTab ref={generateReportRef} onGenerateStateChange={setGenerateButtonState} dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} hideTitle themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} directoryRefreshRef={directoryRefreshRef} setSaving={setSaving} splitLayout />
        )}
        {reportType === 'profit-loss' && (
          <ProfitLossTab ref={generateReportRef} onGenerateStateChange={setGenerateButtonState} dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} setActiveTab={setActiveTab} hideTitle themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} directoryRefreshRef={directoryRefreshRef} setSaving={setSaving} splitLayout />
        )}
        {reportType === 'balance-sheet' && (
          <BalanceSheetTab ref={generateReportRef} onGenerateStateChange={setGenerateButtonState} dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} setActiveTab={setActiveTab} hideTitle themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} directoryRefreshRef={directoryRefreshRef} setSaving={setSaving} splitLayout />
        )}
        {reportType === 'cash-flow' && (
          <CashFlowTab ref={generateReportRef} onGenerateStateChange={setGenerateButtonState} dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} setActiveTab={setActiveTab} hideTitle themeColorRgb={themeColorRgb} isDarkMode={isDarkMode} directoryRefreshRef={directoryRefreshRef} setSaving={setSaving} splitLayout />
        )}
      </div>
    </div>
  )
}

// Trial Balance Tab (Financial Statements dropdown)
const TrialBalanceTab = forwardRef(function TrialBalanceTab(
  { dateRange, formatCurrency, getAuthHeaders, hideTitle = false, themeColorRgb, isDarkMode, onGenerateStateChange, directoryRefreshRef, setSaving, splitLayout = false },
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

  // Build Trial Balance rows to match UI: A/C. Code, Account Title, Debit, Credit; Total row; Status row
  const getTrialBalanceExport = () => {
    const payload = reportData?.data ?? reportData
    const accounts = payload?.accounts ?? []
    const num = (v) => (parseFloat(v) || 0)
    const dateStr = payload?.date && String(payload.date).split('T')[0]
    const asOfDate = dateStr ? (() => { const [y, m, d] = dateStr.split('-'); return m && d && y ? `${Number(m)}/${Number(d)}/${y}` : dateStr })() : (filters.as_of_date || '')
    const getDebitCredit = (row) => {
      const bal = num(row.balance)
      const bt = (row.balance_type || '').toLowerCase()
      if (bt === 'debit') return { debit: bal >= 0 ? bal : 0, credit: bal < 0 ? Math.abs(bal) : 0 }
      if (bt === 'credit') return { debit: bal < 0 ? Math.abs(bal) : 0, credit: bal >= 0 ? bal : 0 }
      const deb = num(row.total_debits)
      const cred = num(row.total_credits)
      return deb >= cred ? { debit: deb - cred, credit: 0 } : { debit: 0, credit: cred - deb }
    }
    let sumDebit = 0
    let sumCredit = 0
    const dataRows = accounts.map((row) => {
      const { debit, credit } = getDebitCredit(row)
      sumDebit += debit
      sumCredit += credit
      return [
        row.account_number ?? '',
        row.account_name ?? '',
        exportFormatCurrency(debit),
        exportFormatCurrency(credit)
      ]
    })
    const difference = Math.abs(sumDebit - sumCredit)
    const isBalanced = difference < 0.01
    const rows = [
      ['Trial Balance'],
      [`As of ${asOfDate}`],
      [],
      ['A/C. Code', 'Account Title', 'Debit', 'Credit'],
      ...dataRows,
      ['', 'Total', exportFormatCurrency(sumDebit, true), exportFormatCurrency(sumCredit, true)],
      ['', 'Status / Difference', isBalanced ? 'Balanced' : '', exportFormatCurrency(difference, true)]
    ]
    const rowTypes = ['title', 'subtitle', 'empty', 'columnHeader', ...dataRows.map(() => 'data'), 'subtotal', 'subtotal']
    return { rows, rowTypes }
  }

  const handleExport = () => {
    if (!reportData) { showToast('No report data to export', 'error'); return }
    const { rows } = getTrialBalanceExport()
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFilename('Trial-Balance', filters.as_of_date, null, 'csv')
    a.click()
    window.URL.revokeObjectURL(url)
    showToast('Report exported to CSV', 'success')
  }

  const handleSaveToDirectory = async () => {
    if (!reportData) { showToast('No report data to save', 'error'); return }
    setSaving?.(true)
    try {
      const { rows } = getTrialBalanceExport()
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
      const res = await fetch('/api/accounting/reports/save', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          report_type: 'trial-balance',
          name: `trial-balance-${filters.as_of_date}.pdf`,
          content: csv,
          format: 'pdf'
        })
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to save')
      showToast('Report saved to directory', 'success')
      directoryRefreshRef?.current?.()
    } catch (e) {
      showToast(e.message || 'Failed to save report', 'error')
    } finally {
      setSaving?.(false)
    }
  }

  const handleExportExcel = async () => {
    if (!reportData) { showToast('No report data to export', 'error'); return }
    try {
      const { rows } = getTrialBalanceExport()
      await downloadExcel(rows, exportFilename('Trial-Balance', filters.as_of_date, null, 'xlsx'))
      showToast('Report exported to Excel', 'success')
    } catch (e) {
      showToast('Excel export failed', 'error')
    }
  }

  const handleExportPdf = () => {
    if (!reportData) { showToast('No report data to export', 'error'); return }
    try {
      const { rows, rowTypes } = getTrialBalanceExport()
      exportReportToPdf(rows, exportFilename('Trial-Balance', filters.as_of_date, null, 'pdf'), rowTypes)
      showToast('Report exported to PDF', 'success')
    } catch (e) {
      showToast(e?.message || 'PDF export failed', 'error')
    }
  }

  useImperativeHandle(ref, () => ({
    generateReport: handleGenerateReport,
    exportToCsv: handleExport,
    exportToExcel: handleExportExcel,
    exportToPdf: handleExportPdf,
    print: () => window.print(),
    saveToDirectory: handleSaveToDirectory
  }), [handleGenerateReport, handleExport, handleExportExcel, handleExportPdf, handleSaveToDirectory])

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

  const filtersSection = (
    <>
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
      </div>
      <div style={quickSelectStyle}>
        <button type="button" onClick={() => setPresetDate('today')} style={quickSelectButtonStyle}>Today</button>
        <button type="button" onClick={() => setPresetDate('end_of_month')} style={quickSelectButtonStyle}>End of Month</button>
        <button type="button" onClick={() => setPresetDate('end_of_last_month')} style={quickSelectButtonStyle}>End of Last Month</button>
        <button type="button" onClick={() => setPresetDate('end_of_quarter')} style={quickSelectButtonStyle}>End of Quarter</button>
        <button type="button" onClick={() => setPresetDate('end_of_year')} style={quickSelectButtonStyle}>End of Year</button>
        <button type="button" onClick={() => setPresetDate('end_of_last_year')} style={quickSelectButtonStyle}>End of Last Year</button>
      </div>
    </>
  )

  const reportSection = (
    <>
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
    </>
  )

  if (splitLayout) {
    return (
      <>
        <div style={{ flexShrink: 0 }}>{filtersSection}</div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{reportSection}</div>
      </>
    )
  }

  return (
    <div>
      {filtersSection}
      {reportSection}
    </div>
  )
})

// Income Statement Tab
const ProfitLossTab = forwardRef(function ProfitLossTab(
  { dateRange, formatCurrency, getAuthHeaders, setActiveTab, hideTitle = false, themeColorRgb, isDarkMode, onGenerateStateChange, directoryRefreshRef, setSaving, splitLayout = false },
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

  // Build Income Statement rows to match ProfitLossTable: same sections and labels
  const getProfitLossExport = () => {
    const num = (v) => (Number(v) || 0)
    const revBase = reportData.net_sales ?? reportData.total_revenue ?? 0
    const pct = (val) => (revBase > 0 ? (num(val) / revBase * 100).toFixed(1) + '%' : '')
    const rows = []
    const rowTypes = []
    const add = (r, t) => { rows.push(r); rowTypes.push(t) }
    add(['Income Statement'], 'title')
    add([`Period: ${new Date(reportData.start_date).toLocaleDateString()} - ${new Date(reportData.end_date).toLocaleDateString()}`], 'subtitle')
    add([], 'empty')
    add(['Account', 'Amount', '% of Revenue'], 'columnHeader')
    add([], 'empty')
    add(['Revenue'], 'section')
      ; (reportData.revenue || []).forEach(account => {
        add([`  ${account.account_number || ''} ${account.account_name}`.trim(), exportFormatCurrency(account.balance), (account.percentage_of_revenue != null ? num(account.percentage_of_revenue).toFixed(1) + '%' : pct(account.balance))], 'data')
      })
      ; (reportData.contra_revenue || []).forEach(account => {
        add([`  Less: ${account.account_name}`, exportFormatCurrency(account.balance), pct(account.balance)], 'data')
      })
    add(['Net Sales', exportFormatCurrency(reportData.net_sales ?? reportData.total_revenue, true), revBase > 0 ? '100.0%' : ''], 'subtotal')
    if ((reportData.cost_of_goods_sold || []).length > 0) {
      add(['Cost of Goods Sold'], 'section')
      reportData.cost_of_goods_sold.forEach(account => {
        add([`  ${account.account_number || ''} ${account.account_name}`.trim(), exportFormatCurrency(account.balance), pct(account.balance)], 'data')
      })
      add(['Total Cost of Goods Sold', exportFormatCurrency(reportData.total_cogs, true), pct(reportData.total_cogs)], 'subtotal')
      add(['Gross Profit', exportFormatCurrency(reportData.gross_profit, true), pct(reportData.gross_profit)], 'subtotal')
    }
    add(['Operating Expenses'], 'section')
      ; (reportData.expenses || []).forEach(account => {
        add([`  ${account.account_number || ''} ${account.account_name}`.trim(), exportFormatCurrency(account.balance), pct(account.balance)], 'data')
      })
    const opProfit = reportData.operating_profit ?? (num(reportData.gross_profit) - num(reportData.total_expenses))
    add(['Total Operating Expenses', exportFormatCurrency(reportData.total_expenses, true), pct(reportData.total_expenses)], 'subtotal')
    add(['Operating Profit (Loss)', exportFormatCurrency(opProfit, true), pct(opProfit)], 'subtotal')
    add(['Add Other Income'], 'data')
      ; (reportData.other_income || []).forEach(account => {
        add([`  ${account.account_number || ''} ${account.account_name}`.trim(), exportFormatCurrency(account.balance), pct(account.balance)], 'data')
      })
    const profitBeforeTax = reportData.profit_before_taxes ?? reportData.net_income
    add(['Profit (Loss) Before Taxes', exportFormatCurrency(profitBeforeTax, true), pct(profitBeforeTax)], 'subtotal')
    add(['Less: Tax Expense', exportFormatCurrency(reportData.tax_expense ?? 0), pct(reportData.tax_expense ?? 0)], 'data')
    add(['Net Profit (Loss)', exportFormatCurrency(reportData.net_income, true), pct(reportData.net_income)], 'finalTotal')
    return { rows, rowTypes }
  }

  const handleExport = () => {
    if (!reportData) { showToast('No report data to export', 'error'); return }
    const { rows } = getProfitLossExport()
    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFilename('Income-Statement', filters.start_date, filters.end_date, 'csv')
    a.click()
    window.URL.revokeObjectURL(url)
    showToast('Report exported to CSV', 'success')
  }

  const handleSaveToDirectory = async () => {
    if (!reportData) { showToast('No report data to save', 'error'); return }
    setSaving?.(true)
    try {
      const { rows } = getProfitLossExport()
      const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
      const res = await fetch('/api/accounting/reports/save', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          report_type: 'profit-loss',
          name: `income-statement-${filters.start_date}-to-${filters.end_date}.pdf`,
          content: csvContent,
          format: 'pdf'
        })
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to save')
      showToast('Report saved to directory', 'success')
      directoryRefreshRef?.current?.()
    } catch (e) {
      showToast(e.message || 'Failed to save report', 'error')
    } finally {
      setSaving?.(false)
    }
  }

  const handleExportExcel = async () => {
    if (!reportData) { showToast('No report data to export', 'error'); return }
    try {
      const { rows } = getProfitLossExport()
      await downloadExcel(rows, exportFilename('Income-Statement', filters.start_date, filters.end_date, 'xlsx'))
      showToast('Report exported to Excel', 'success')
    } catch (e) {
      showToast('Excel export failed', 'error')
    }
  }

  const handleExportPdf = () => {
    if (!reportData) { showToast('No report data to export', 'error'); return }
    try {
      const { rows, rowTypes } = getProfitLossExport()
      exportReportToPdf(rows, exportFilename('Income-Statement', filters.start_date, filters.end_date, 'pdf'), rowTypes)
      showToast('Report exported to PDF', 'success')
    } catch (e) {
      showToast(e?.message || 'PDF export failed', 'error')
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
    exportToPdf: handleExportPdf,
    print: () => window.print(),
    saveToDirectory: handleSaveToDirectory
  }), [handleGenerateReport, handleExport, handleExportExcel, handleExportPdf, handleSaveToDirectory])

  const filtersSection = (
    <>
      {!hideTitle && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ ...formTitleStyle(_isDark), marginBottom: '8px', fontSize: '24px' }}>Income Statement</h3>
          <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
            Income statement showing revenue, expenses, and net income
          </p>
        </div>
      )}
      <ProfitLossFilters filters={filters} onFilterChange={setFilters} />
    </>
  )

  const reportSection = (
    <>
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
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: textColor }}>Current Period Detail</h3>
                <ProfitLossTable
                  data={reportData}
                  showPercentages={true}
                  onAccountClick={handleAccountClick}
                  periodLabel={getPeriodLabel() + (comparativeData ? ` — Compared to: ${getPriorPeriodLabel()}` : '')}
                />
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
            </>
          )}
        </div>
      )}
      {!loading && !reportData && (
        <div style={{ backgroundColor: cardBg, borderRadius: '8px', border: `1px solid ${borderColor}`, padding: '48px', textAlign: 'center' }}>
          <p style={{ color: textColor, opacity: 0.7 }}>
            Select a date range above and click "Generate Report" to view your Income Statement
          </p>
        </div>
      )}
    </>
  )

  if (splitLayout) {
    return (
      <>
        <div style={{ flexShrink: 0 }}>{filtersSection}</div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{reportSection}</div>
      </>
    )
  }

  return (
    <div>
      {filtersSection}
      {reportSection}
    </div>
  )
})

// Balance Sheet Tab
const BalanceSheetTab = forwardRef(function BalanceSheetTab(
  { dateRange, formatCurrency, getAuthHeaders, setActiveTab, hideTitle = false, themeColorRgb, isDarkMode, onGenerateStateChange, directoryRefreshRef, setSaving, splitLayout = false },
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

  // Build Balance Sheet rows to match BalanceSheetTable: same section labels + COMMON FINANCIAL RATIO
  const getBalanceSheetExport = () => {
    const num = (v) => (Number(v) || 0)
    const rows = []
    const rowTypes = []
    const add = (r, t) => { rows.push(r); rowTypes.push(t) }
    add(['Balance Sheet'], 'title')
    add([`As of: ${new Date(reportData.as_of_date).toLocaleDateString()}`], 'subtitle')
    add([], 'empty')
    add(['ASSETS'], 'section')
    if (reportData.assets.current_assets?.length > 0) {
      add(['CURRENT ASSETS'], 'columnHeader')
      reportData.assets.current_assets.forEach((a) => add([`  ${(a.account_number || '')} ${a.account_name}`.trim(), exportFormatCurrency(a.balance, true)], 'data'))
      add(['TOTAL CURRENT ASSETS', exportFormatCurrency(reportData.assets.total_current_assets, true)], 'subtotal')
    }
    if (reportData.assets.fixed_assets?.length > 0) {
      add(['FIXED (LONG TERM) ASSETS'], 'columnHeader')
      reportData.assets.fixed_assets.forEach((a) => add([`  ${(a.account_number || '')} ${a.account_name}`.trim(), exportFormatCurrency(a.balance, true)], 'data'))
      add(['TOTAL FIXED ASSETS', exportFormatCurrency(reportData.assets.total_fixed_assets, true)], 'subtotal')
    }
    if (reportData.assets.other_assets?.length > 0) {
      add(['OTHER ASSETS'], 'columnHeader')
      reportData.assets.other_assets.forEach((a) => add([`  ${(a.account_number || '')} ${a.account_name}`.trim(), exportFormatCurrency(a.balance, true)], 'data'))
      add(['TOTAL OTHER ASSETS', exportFormatCurrency(reportData.assets.total_other_assets, true)], 'subtotal')
    }
    add(['TOTAL ASSETS', exportFormatCurrency(reportData.assets.total_assets, true)], 'finalTotal')
    add([], 'empty')
    add(['LIABILITIES AND OWNER\'S EQUITY'], 'section')
    if (reportData.liabilities.current_liabilities?.length > 0) {
      add(['CURRENT LIABILITIES'], 'columnHeader')
      reportData.liabilities.current_liabilities.forEach((a) => add([`  ${(a.account_number || '')} ${a.account_name}`.trim(), exportFormatCurrency(a.balance, true)], 'data'))
      add(['TOTAL CURRENT LIABILITIES', exportFormatCurrency(reportData.liabilities.total_current_liabilities, true)], 'subtotal')
    }
    if (reportData.liabilities.long_term_liabilities?.length > 0) {
      add(['LONG TERM LIABILITIES'], 'columnHeader')
      reportData.liabilities.long_term_liabilities.forEach((a) => add([`  ${(a.account_number || '')} ${a.account_name}`.trim(), exportFormatCurrency(a.balance, true)], 'data'))
      add(['TOTAL LONG-TERM LIABILITIES', exportFormatCurrency(reportData.liabilities.total_long_term_liabilities, true)], 'subtotal')
    }
    add(['OWNER\'S EQUITY'], 'columnHeader')
    reportData.equity.equity_accounts?.forEach((a) => add([`  ${(a.account_number || '')} ${a.account_name}`.trim(), exportFormatCurrency(a.balance, true)], 'data'))
    if (typeof reportData.equity.inventory_valuation_adjustment === 'number' && Math.abs(reportData.equity.inventory_valuation_adjustment) >= 0.005) {
      add(['  Inventory valuation adjustment', exportFormatCurrency(reportData.equity.inventory_valuation_adjustment, true)], 'data')
    }
    add(['Current Year Earnings', exportFormatCurrency(reportData.equity.current_year_earnings, true)], 'data')
    add(['TOTAL OWNER\'S EQUITY', exportFormatCurrency(reportData.equity.total_equity, true)], 'subtotal')
    const totalLE = num(reportData.liabilities.total_liabilities) + num(reportData.equity.total_equity)
    add(['TOTAL LIABILITIES AND OWNER\'S EQUITY', exportFormatCurrency(totalLE, true)], 'finalTotal')
    const totalAssets = num(reportData.assets.total_assets)
    const totalLiab = num(reportData.liabilities.total_liabilities)
    const totalEquity = num(reportData.equity.total_equity)
    const currentAssets = num(reportData.assets.total_current_assets)
    const currentLiab = num(reportData.liabilities.total_current_liabilities)
    add([], 'empty')
    add(['COMMON FINANCIAL RATIO'], 'section')
    add(['Debt Ratio (Total Liabilities / Total Assets)', totalAssets !== 0 ? (totalLiab / totalAssets).toFixed(2) : '-'], 'data')
    add(['Current Ratio (Current Assets / Current Liabilities)', currentLiab !== 0 ? (currentAssets / currentLiab).toFixed(2) : '-'], 'data')
    add(['Working Capital (Current Assets - Current Liabilities)', exportFormatCurrency(currentAssets - currentLiab, true)], 'data')
    add(['Assets-to-Equity Ratio (Total Assets / Owner\'s Equity)', totalEquity !== 0 ? (totalAssets / totalEquity).toFixed(2) : '-'], 'data')
    add(['Debt-to-Equity Ratio (Total Liabilities / Owner\'s Equity)', totalEquity !== 0 ? (totalLiab / totalEquity).toFixed(2) : '-'], 'data')
    return { rows, rowTypes }
  }

  const handleExport = () => {
    if (!reportData) { showToast('No report data to export', 'error'); return }
    const { rows } = getBalanceSheetExport()
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFilename('Balance-Sheet', filters.as_of_date, null, 'csv')
    a.click()
    window.URL.revokeObjectURL(url)
    showToast('Report exported to CSV', 'success')
  }

  const handleSaveToDirectory = async () => {
    if (!reportData) { showToast('No report data to save', 'error'); return }
    setSaving?.(true)
    try {
      const { rows } = getBalanceSheetExport()
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
      const res = await fetch('/api/accounting/reports/save', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          report_type: 'balance-sheet',
          name: `balance-sheet-${filters.as_of_date}.pdf`,
          content: csv,
          format: 'pdf'
        })
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to save')
      showToast('Report saved to directory', 'success')
      directoryRefreshRef?.current?.()
    } catch (e) {
      showToast(e.message || 'Failed to save report', 'error')
    } finally {
      setSaving?.(false)
    }
  }

  const handleExportExcel = async () => {
    if (!reportData) { showToast('No report data to export', 'error'); return }
    try {
      const { rows } = getBalanceSheetExport()
      await downloadExcel(rows, exportFilename('Balance-Sheet', filters.as_of_date, null, 'xlsx'))
      showToast('Report exported to Excel', 'success')
    } catch (e) {
      showToast('Excel export failed', 'error')
    }
  }

  const handleExportPdf = () => {
    if (!reportData) { showToast('No report data to export', 'error'); return }
    try {
      const { rows, rowTypes } = getBalanceSheetExport()
      exportReportToPdf(rows, exportFilename('Balance-Sheet', filters.as_of_date, null, 'pdf'), rowTypes)
      showToast('Report exported to PDF', 'success')
    } catch (e) {
      showToast(e?.message || 'PDF export failed', 'error')
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
    exportToPdf: handleExportPdf,
    print: () => window.print(),
    saveToDirectory: handleSaveToDirectory
  }), [handleGenerateReport, handleExport, handleExportExcel, handleExportPdf, handleSaveToDirectory])

  const filtersSection = (
    <>
      {!hideTitle && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ ...formTitleStyle(isDarkMode), marginBottom: '8px', fontSize: '24px' }}>Balance Sheet</h3>
          <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
            Statement of financial position showing assets, liabilities, and equity.
            Inventory (Current Assets) is calculated from actual store stock (quantity × cost).
          </p>
        </div>
      )}
      <BalanceSheetFilters filters={filters} onFilterChange={setFilters} />
    </>
  )

  const reportSection = (
    <>
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
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '24px', width: '100%' }}>
                <BalanceSheetTable data={reportData} onAccountClick={handleAccountClick} dateLabel={`As of ${getAsOfLabel()}`} />
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
    </>
  )

  if (splitLayout) {
    return (
      <>
        <div style={{ flexShrink: 0 }}>{filtersSection}</div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{reportSection}</div>
      </>
    )
  }

  return (
    <div>
      {filtersSection}
      {reportSection}
    </div>
  )
})

// Cash Flow Tab
const CashFlowTab = forwardRef(function CashFlowTab(
  { dateRange, formatCurrency, getAuthHeaders, setActiveTab, hideTitle = false, themeColorRgb, isDarkMode, onGenerateStateChange, directoryRefreshRef, setSaving, splitLayout = false },
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

  // Build Cash Flow rows to match CashFlowTable: Cash at beginning, sections (receipts/paid), Net Increase, Cash at end
  const getCashFlowExport = () => {
    const op = reportData.operating_activities || {}
    const inv = reportData.investing_activities || {}
    const fin = reportData.financing_activities || {}
    const num = (v) => (Number(v) || 0)
    const receipts = (s) => s.cash_receipts_from || []
    const paid = (s) => s.cash_paid_for || []
    const rows = []
    const rowTypes = []
    const add = (r, t) => { rows.push(r); rowTypes.push(t) }
    add(['Cash Flow Statement'], 'title')
    add([`Period: ${new Date(reportData.start_date).toLocaleDateString()} - ${new Date(reportData.end_date).toLocaleDateString()}`], 'subtitle')
    add([], 'empty')
    add(['Activity', 'Amount'], 'columnHeader')
    add(['Cash at beginning of year', exportFormatCurrency(reportData.beginning_cash ?? 0, true)], 'data')
    const renderSection = (title, section, netLabel, netAmount) => {
      add([title], 'section')
      add(['Cash receipts from:'], 'columnHeader')
      const rec = receipts(section)
      if (rec.length === 0) add(['  No receipts'], 'data')
      else rec.forEach((item) => add([`  ${item.description || ''}`, exportFormatCurrency(item.amount)], 'data'))
      add(['Cash paid for:'], 'columnHeader')
      const pay = paid(section)
      if (pay.length === 0) add(['  No payments'], 'data')
      else pay.forEach((item) => add([`  ${item.description || ''}`, exportFormatCurrency(item.amount)], 'data'))
      add([netLabel, exportFormatCurrency(netAmount, true)], 'subtotal')
    }
    renderSection('Operations', op, 'Net Cash Flow from Operations', op.net_cash_from_operations ?? 0)
    renderSection('Investing Activities', inv, 'Net Cash Flow from Investing Activities', inv.net_cash_from_investing ?? 0)
    renderSection('Financing Activities', fin, 'Net Cash Flow from Financing Activities', fin.net_cash_from_financing ?? 0)
    add(['Net Increase in Cash', exportFormatCurrency(reportData.net_change_in_cash ?? 0, true)], 'finalTotal')
    add(['Cash at end of year', exportFormatCurrency(reportData.ending_cash ?? 0, true)], 'data')
    return { rows, rowTypes }
  }

  const handleExport = () => {
    if (!reportData) { showToast('No report data to export', 'error'); return }
    const { rows } = getCashFlowExport()
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFilename('Cash-Flow-Statement', filters.start_date, filters.end_date, 'csv')
    a.click()
    window.URL.revokeObjectURL(url)
    showToast('Report exported to CSV', 'success')
  }

  const handleSaveToDirectory = async () => {
    if (!reportData) { showToast('No report data to save', 'error'); return }
    setSaving?.(true)
    try {
      const { rows } = getCashFlowExport()
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
      const res = await fetch('/api/accounting/reports/save', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          report_type: 'cash-flow',
          name: `cash-flow-${filters.start_date}-to-${filters.end_date}.pdf`,
          content: csv,
          format: 'pdf'
        })
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to save')
      showToast('Report saved to directory', 'success')
      directoryRefreshRef?.current?.()
    } catch (e) {
      showToast(e.message || 'Failed to save report', 'error')
    } finally {
      setSaving?.(false)
    }
  }

  const handleExportExcel = async () => {
    if (!reportData) { showToast('No report data to export', 'error'); return }
    try {
      const { rows } = getCashFlowExport()
      await downloadExcel(rows, exportFilename('Cash-Flow-Statement', filters.start_date, filters.end_date, 'xlsx'))
      showToast('Report exported to Excel', 'success')
    } catch (e) {
      showToast('Excel export failed', 'error')
    }
  }

  const handleExportPdf = () => {
    if (!reportData) { showToast('No report data to export', 'error'); return }
    try {
      const { rows, rowTypes } = getCashFlowExport()
      exportReportToPdf(rows, exportFilename('Cash-Flow-Statement', filters.start_date, filters.end_date, 'pdf'), rowTypes)
      showToast('Report exported to PDF', 'success')
    } catch (e) {
      showToast(e?.message || 'PDF export failed', 'error')
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
    exportToPdf: handleExportPdf,
    print: () => window.print(),
    saveToDirectory: handleSaveToDirectory
  }), [handleGenerateReport, handleExport, handleExportExcel, handleExportPdf, handleSaveToDirectory])

  const filtersSection = (
    <>
      {!hideTitle && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ ...formTitleStyle(_isDark), marginBottom: '8px', fontSize: '24px' }}>Cash Flow Statement</h3>
          <p style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>
            Statement of cash flows showing operating, investing, and financing activities
          </p>
        </div>
      )}
      <CashFlowFilters filters={filters} onFilterChange={setFilters} />
    </>
  )

  const reportSection = (
    <>
      {loading && <LoadingSpinner size="lg" text="Generating report..." />}
      {!loading && reportData && (
        <div className="accounting-report-print-area">
          {comparativeData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ComparativeCashFlowTable data={comparativeData} currentLabel={getPeriodLabel()} priorLabel={getPriorLabel()} />
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ ...formTitleStyle(_isDark), fontSize: '18px', marginBottom: '16px' }}>Current Period Detail</h3>
                <CashFlowTable data={reportData} onAccountClick={handleAccountClick} periodLabel={`${getPeriodLabel()} — Compared to: ${getPriorLabel()}`} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '24px', width: '100%' }}>
                <CashFlowTable data={reportData} onAccountClick={handleAccountClick} periodLabel={getPeriodLabel()} />
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
    </>
  )

  if (splitLayout) {
    return (
      <>
        <div style={{ flexShrink: 0 }}>{filtersSection}</div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{reportSection}</div>
      </>
    )
  }

  return (
    <div>
      {filtersSection}
      {reportSection}
    </div>
  )
})

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div style={{ marginBottom: '24px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '16px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', margin: 0 }}>Vendors</h1>
        <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Suppliers you purchase from. Track contact info and balances. Bills are linked to vendors.</p>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', border: `1px solid ${borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9', boxShadow: isDarkMode ? '0 1px 0 #3a3a3a' : '0 1px 0 #e0e0e0' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Vendor #</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: textColor, opacity: 0.8 }}>
                    Loading…
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
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
