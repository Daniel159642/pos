import { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'

function Accounting() {
  const { themeMode, themeColor } = useTheme()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
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

  useEffect(() => {
    loadDashboardData()
  }, [dateRange])

  const getAuthHeaders = () => {
    const token = localStorage.getItem('sessionToken')
    return {
      'Authorization': `Bearer ${token || ''}`,
      'Content-Type': 'application/json'
    }
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('sessionToken')
      if (!token) {
        setError('Your session has expired. Please log in again.')
        setLoading(false)
        return
      }
      const response = await fetch(
        `/api/accounting/dashboard?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`,
        { headers: getAuthHeaders() }
      )
      if (response.status === 401) {
        setError('Your session has expired. Please log in again.')
        setLoading(false)
        return
      }
      
      if (response.status === 403) {
        setError('You do not have permission to access accounting features. Manager or Admin access required.')
        setLoading(false)
        return
      }
      
      if (!response.ok) {
        throw new Error('Failed to load dashboard data')
      }
      
      const data = await response.json()
      setDashboardData(data)
      setError(null)
    } catch (err) {
      console.error('Error loading dashboard:', err)
      setError(err.message)
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

  if (error && error.includes('permission')) {
    return (
      <div style={{ 
        padding: '32px 24px', 
        backgroundColor: backgroundColor, 
        minHeight: 'calc(100vh - 200px)',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{
          border: `1px solid ${borderColor}`,
          borderRadius: '12px',
          padding: '40px',
          backgroundColor: cardBackgroundColor,
          boxShadow: boxShadow,
          textAlign: 'center'
        }}>
          <h2 style={{ color: textColor, marginBottom: '16px' }}>Access Denied</h2>
          <p style={{ color: textColor, opacity: 0.8 }}>
            {error}
          </p>
        </div>
      </div>
    )
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
          Accounting
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
          paddingBottom: '12px'
        }}>
          {['dashboard', 'reports', 'payroll', 'expenses', 'taxes'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: activeTab === tab ? themeColor : 'transparent',
                color: activeTab === tab ? 'white' : textColor,
                cursor: 'pointer',
                fontWeight: activeTab === tab ? 600 : 400,
                fontSize: '14px',
                textTransform: 'capitalize',
                transition: 'all 0.2s ease'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Error Display */}
        {error && !error.includes('permission') && (
          <div style={{
            padding: '16px',
            marginBottom: '20px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            color: '#c33'
          }}>
            Error: {error}
          </div>
        )}

        {/* Tab Content */}
        {loading && activeTab === 'dashboard' ? (
          <div style={{ textAlign: 'center', padding: '40px', color: textColor }}>
            Loading...
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <DashboardTab data={dashboardData} formatCurrency={formatCurrency} />}
            {activeTab === 'reports' && <ReportsTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
            {activeTab === 'payroll' && <PayrollTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
            {activeTab === 'expenses' && <ExpensesTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
            {activeTab === 'taxes' && <TaxesTab dateRange={dateRange} formatCurrency={formatCurrency} getAuthHeaders={getAuthHeaders} />}
          </>
        )}
      </div>
    </div>
  )
}

// Dashboard Tab Component
function DashboardTab({ data, formatCurrency }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const cardBackgroundColor = isDarkMode ? '#1f1f1f' : '#f9f9f9'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'

  if (!data) {
    return (
      <div style={{ 
        color: textColor, 
        padding: '40px 20px',
        textAlign: 'center',
        lineHeight: '1.8'
      }}>
        <h3 style={{ color: textColor, marginBottom: '16px', fontSize: '18px' }}>Accounting Dashboard</h3>
        <p style={{ color: textColor, opacity: 0.8, fontSize: '14px', maxWidth: '600px', margin: '0 auto' }}>
          This dashboard provides an overview of your business finances for the selected period. 
          You'll see key metrics including total revenue, expenses, payroll costs, cash position, and tax obligations. 
          Adjust the date range above to view different periods.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '16px',
        marginBottom: '24px'
      }}>
        <MetricCard 
          title="Total Revenue" 
          value={formatCurrency(data.total_revenue)}
          color="#10b981"
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          textColor={textColor}
        />
        <MetricCard 
          title="Total Expenses" 
          value={formatCurrency(data.total_expenses)}
          color="#ef4444"
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          textColor={textColor}
        />
        <MetricCard 
          title="Total Payroll" 
          value={formatCurrency(data.total_payroll)}
          color="#f59e0b"
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          textColor={textColor}
        />
        <MetricCard 
          title="Net Income" 
          value={formatCurrency(data.net_income)}
          color={data.net_income >= 0 ? "#10b981" : "#ef4444"}
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          textColor={textColor}
        />
        <MetricCard 
          title="Cash Balance" 
          value={formatCurrency(data.cash_balance)}
          color="#3b82f6"
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          textColor={textColor}
        />
        <MetricCard 
          title="Tax Collected" 
          value={formatCurrency(data.total_tax_collected)}
          color="#8b5cf6"
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          textColor={textColor}
        />
        <MetricCard 
          title="Outstanding Taxes" 
          value={formatCurrency(data.outstanding_taxes)}
          color="#ec4899"
          cardBackgroundColor={cardBackgroundColor}
          borderColor={borderColor}
          textColor={textColor}
        />
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

// Reports Tab Component
function ReportsTab({ dateRange, formatCurrency, getAuthHeaders }) {
  const [reports, setReports] = useState({ balanceSheet: null, incomeStatement: null, cashFlow: null })
  const [loading, setLoading] = useState(false)
  const [selectedReport, setSelectedReport] = useState('income') // 'income', 'balance', 'cashflow'
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const cardBg = isDarkMode ? '#1f1f1f' : '#ffffff'

  const loadReports = async () => {
    setLoading(true)
    try {
      // Load Balance Sheet
      try {
        const bsResponse = await fetch(
          `/api/accounting/balance-sheet?as_of_date=${dateRange.end_date}`,
          { headers: getAuthHeaders() }
        )
        if (bsResponse.ok) {
          const balanceSheet = await bsResponse.json()
          if (!balanceSheet.error) {
            setReports(prev => ({ ...prev, balanceSheet }))
          }
        }
      } catch (err) {
        console.error('Error loading balance sheet:', err)
      }

      // Load Income Statement
      try {
        const isResponse = await fetch(
          `/api/accounting/income-statement?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`,
          { headers: getAuthHeaders() }
        )
        if (isResponse.ok) {
          const incomeStatement = await isResponse.json()
          if (!incomeStatement.error) {
            setReports(prev => ({ ...prev, incomeStatement }))
          }
        }
      } catch (err) {
        console.error('Error loading income statement:', err)
      }

      // Load Cash Flow
      try {
        const cfResponse = await fetch(
          `/api/accounting/cash-flow?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`,
          { headers: getAuthHeaders() }
        )
        if (cfResponse.ok) {
          const cashFlow = await cfResponse.json()
          if (!cashFlow.error) {
            setReports(prev => ({ ...prev, cashFlow }))
          }
        }
      } catch (err) {
        console.error('Error loading cash flow:', err)
      }
    } catch (err) {
      console.error('Error loading reports:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [dateRange])

  if (loading) {
    return <div style={{ color: textColor, padding: '20px' }}>Loading financial reports...</div>
  }

  return (
    <div>
      {/* Report Selection Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '24px',
        borderBottom: `1px solid ${borderColor}`,
        paddingBottom: '12px'
      }}>
        <button
          onClick={() => setSelectedReport('income')}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: selectedReport === 'income' ? '#3b82f6' : 'transparent',
            color: selectedReport === 'income' ? 'white' : textColor,
            cursor: 'pointer',
            fontWeight: selectedReport === 'income' ? 600 : 400,
            fontSize: '14px'
          }}
        >
          Income Statement
        </button>
        <button
          onClick={() => setSelectedReport('balance')}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: selectedReport === 'balance' ? '#3b82f6' : 'transparent',
            color: selectedReport === 'balance' ? 'white' : textColor,
            cursor: 'pointer',
            fontWeight: selectedReport === 'balance' ? 600 : 400,
            fontSize: '14px'
          }}
        >
          Balance Sheet
        </button>
        <button
          onClick={() => setSelectedReport('cashflow')}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: selectedReport === 'cashflow' ? '#3b82f6' : 'transparent',
            color: selectedReport === 'cashflow' ? 'white' : textColor,
            cursor: 'pointer',
            fontWeight: selectedReport === 'cashflow' ? 600 : 400,
            fontSize: '14px'
          }}
        >
          Cash Flow Statement
        </button>
      </div>

      {/* Render Selected Report */}
      {selectedReport === 'income' && (
        reports.incomeStatement ? (
          <IncomeStatement report={reports.incomeStatement} formatCurrency={formatCurrency} textColor={textColor} borderColor={borderColor} cardBg={cardBg} />
        ) : (
          <div style={{ color: textColor, padding: '40px', textAlign: 'center', lineHeight: '1.8' }}>
            {loading ? (
              <div>Loading income statement...</div>
            ) : (
              <>
                <h3 style={{ color: textColor, marginBottom: '16px', fontSize: '18px' }}>Income Statement</h3>
                <p style={{ color: textColor, opacity: 0.8, fontSize: '14px', maxWidth: '600px', margin: '0 auto' }}>
                  The Income Statement (also known as Profit & Loss) shows your business's revenues, expenses, and profits over a specific period. 
                  It displays all revenue sources, cost of goods sold, operating expenses, and calculates gross profit and net income. 
                  Select a date range above to generate the report for that period.
                </p>
              </>
            )}
          </div>
        )
      )}
      {selectedReport === 'balance' && (
        reports.balanceSheet ? (
          <BalanceSheet report={reports.balanceSheet} formatCurrency={formatCurrency} textColor={textColor} borderColor={borderColor} cardBg={cardBg} />
        ) : (
          <div style={{ color: textColor, padding: '40px', textAlign: 'center', lineHeight: '1.8' }}>
            {loading ? (
              <div>Loading balance sheet...</div>
            ) : (
              <>
                <h3 style={{ color: textColor, marginBottom: '16px', fontSize: '18px' }}>Balance Sheet</h3>
                <p style={{ color: textColor, opacity: 0.8, fontSize: '14px', maxWidth: '600px', margin: '0 auto' }}>
                  The Balance Sheet provides a snapshot of your business's financial position at a specific point in time. 
                  It shows assets (what you own), liabilities (what you owe), and equity (owner's investment). 
                  The balance sheet follows the accounting equation: Assets = Liabilities + Equity. 
                  Select an "as of" date above to view the balance sheet for that date.
                </p>
              </>
            )}
          </div>
        )
      )}
      {selectedReport === 'cashflow' && (
        reports.cashFlow ? (
          <CashFlowStatement report={reports.cashFlow} formatCurrency={formatCurrency} textColor={textColor} borderColor={borderColor} cardBg={cardBg} />
        ) : (
          <div style={{ color: textColor, padding: '40px', textAlign: 'center', lineHeight: '1.8' }}>
            {loading ? (
              <div>Loading cash flow statement...</div>
            ) : (
              <>
                <h3 style={{ color: textColor, marginBottom: '16px', fontSize: '18px' }}>Cash Flow Statement</h3>
                <p style={{ color: textColor, opacity: 0.8, fontSize: '14px', maxWidth: '600px', margin: '0 auto' }}>
                  The Cash Flow Statement tracks the movement of cash in and out of your business during a specific period. 
                  It's organized into three categories: Operating Activities (day-to-day business), Investing Activities (equipment, assets), 
                  and Financing Activities (loans, owner investments). This helps you understand your business's liquidity and cash management.
                </p>
              </>
            )}
          </div>
        )
      )}
    </div>
  )
}

// Income Statement Component
function IncomeStatement({ report, formatCurrency, textColor, borderColor, cardBg }) {
  if (!report) {
    return <div style={{ color: textColor, padding: '20px' }}>No income statement data available</div>
  }
  
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  return (
    <div style={{
      backgroundColor: cardBg,
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '32px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ color: textColor, margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>INCOME STATEMENT</h2>
        <p style={{ color: textColor, opacity: 0.7, margin: 0, fontSize: '14px' }}>{report.period || 'Period'}</p>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Revenue Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `2px solid ${borderColor}` }}>
            <div style={{ color: textColor, fontWeight: 700, fontSize: '16px' }}>REVENUE</div>
            <div style={{ color: textColor }}></div>
          </div>
          {report.revenue && report.revenue.length > 0 ? (
            report.revenue.map((item, idx) => {
              const balance = parseFloat(item.balance || 0)
              const isNegative = (item.account_type === 'contra_revenue' && balance > 0) || (item.account_type === 'revenue' && balance < 0)
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', paddingLeft: '20px' }}>
                  <div style={{ color: textColor, fontSize: '14px' }}>{item.account_name || 'Revenue'}</div>
                  <div style={{ 
                    color: isNegative ? '#ef4444' : textColor, 
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    fontWeight: 500
                  }}>
                    {isNegative && balance !== 0 ? '(' : ''}{formatCurrency(Math.abs(balance))}{isNegative && balance !== 0 ? ')' : ''}
                  </div>
                </div>
              )
            })
          ) : (
            <div style={{ padding: '10px 0', paddingLeft: '20px', color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>
              Sales Revenue
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderTop: `2px solid ${borderColor}`, marginTop: '4px' }}>
            <div style={{ color: textColor, fontWeight: 700, fontSize: '15px' }}>Total Revenue</div>
            <div style={{ color: textColor, fontWeight: 700, fontFamily: 'monospace', fontSize: '15px' }}>
              {formatCurrency(report.total_revenue || 0)}
            </div>
          </div>
        </div>

        {/* COGS Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `2px solid ${borderColor}` }}>
            <div style={{ color: textColor, fontWeight: 700, fontSize: '16px' }}>COST OF GOODS SOLD</div>
            <div style={{ color: textColor }}></div>
          </div>
          {report.cogs && report.cogs.length > 0 ? (
            report.cogs.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', paddingLeft: '20px' }}>
                <div style={{ color: textColor, fontSize: '14px' }}>{item.account_name || 'Cost of Goods Sold'}</div>
                <div style={{ color: textColor, fontFamily: 'monospace', fontSize: '14px', fontWeight: 500 }}>
                  {formatCurrency(Math.abs(item.balance || 0))}
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '10px 0', paddingLeft: '20px', color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>
              Cost of Goods Sold
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderTop: `2px solid ${borderColor}`, marginTop: '4px' }}>
            <div style={{ color: textColor, fontWeight: 700, fontSize: '15px' }}>Total Cost of Goods Sold</div>
            <div style={{ color: textColor, fontWeight: 700, fontFamily: 'monospace', fontSize: '15px' }}>
              {formatCurrency(report.total_cogs || 0)}
            </div>
          </div>
        </div>

        {/* Gross Profit */}
        <div style={{ marginBottom: '24px', padding: '16px 0', borderTop: `2px solid ${borderColor}`, borderBottom: `2px solid ${borderColor}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ color: textColor, fontWeight: 700, fontSize: '16px' }}>Gross Profit</div>
            <div style={{ color: textColor, fontWeight: 700, fontSize: '16px', fontFamily: 'monospace' }}>
              {formatCurrency(report.gross_profit || 0)}
            </div>
          </div>
        </div>

        {/* Expenses Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `2px solid ${borderColor}` }}>
            <div style={{ color: textColor, fontWeight: 700, fontSize: '16px' }}>OPERATING EXPENSES</div>
            <div style={{ color: textColor }}></div>
          </div>
          {report.expenses && report.expenses.length > 0 ? (
            report.expenses.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', paddingLeft: '20px' }}>
                <div style={{ color: textColor, fontSize: '14px' }}>{item.account_name || 'Operating Expense'}</div>
                <div style={{ color: textColor, fontFamily: 'monospace', fontSize: '14px', fontWeight: 500 }}>
                  {formatCurrency(Math.abs(item.balance || 0))}
                </div>
              </div>
            ))
          ) : (
            <>
              <div style={{ padding: '10px 0', paddingLeft: '20px', color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>
                Salaries and Wages
              </div>
              <div style={{ padding: '10px 0', paddingLeft: '20px', color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>
                Rent Expense
              </div>
              <div style={{ padding: '10px 0', paddingLeft: '20px', color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>
                Utilities Expense
              </div>
              <div style={{ padding: '10px 0', paddingLeft: '20px', color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>
                Insurance Expense
              </div>
              <div style={{ padding: '10px 0', paddingLeft: '20px', color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>
                Office Supplies Expense
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderTop: `2px solid ${borderColor}`, marginTop: '4px' }}>
            <div style={{ color: textColor, fontWeight: 700, fontSize: '15px' }}>Total Operating Expenses</div>
            <div style={{ color: textColor, fontWeight: 700, fontFamily: 'monospace', fontSize: '15px' }}>
              {formatCurrency(report.total_expenses || 0)}
            </div>
          </div>
        </div>

        {/* Net Income */}
        <div style={{ 
          marginTop: '32px', 
          padding: '20px', 
          backgroundColor: document.documentElement.classList.contains('dark-theme') ? '#2a2a2a' : '#f9f9f9',
          borderRadius: '8px',
          border: `2px solid ${(report.net_income || 0) >= 0 ? '#10b981' : '#ef4444'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: textColor, fontWeight: 700, fontSize: '18px' }}>NET INCOME</div>
            <div style={{ 
              color: (report.net_income || 0) >= 0 ? '#10b981' : '#ef4444', 
              fontWeight: 700, 
              fontSize: '20px',
              fontFamily: 'monospace'
            }}>
              {formatCurrency(report.net_income || 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Balance Sheet Component
function BalanceSheet({ report, formatCurrency, textColor, borderColor, cardBg }) {
  if (!report) {
    return <div style={{ color: textColor, padding: '20px' }}>No balance sheet data available</div>
  }
  
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  return (
    <div style={{
      backgroundColor: cardBg,
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '32px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ color: textColor, margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>BALANCE SHEET</h2>
        <p style={{ color: textColor, opacity: 0.7, margin: 0, fontSize: '14px' }}>As of {report.date || 'Date'}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', maxWidth: '1000px', margin: '0 auto' }}>
        {/* Assets Column */}
        <div>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ padding: '12px 0', borderBottom: `2px solid ${borderColor}`, marginBottom: '16px' }}>
              <h3 style={{ color: textColor, margin: 0, fontSize: '18px', fontWeight: 600 }}>ASSETS</h3>
            </div>
            
            {/* Current Assets */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ padding: '10px 0', paddingLeft: '16px', color: textColor, fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Assets</div>
              {report.assets && report.assets.filter(a => {
                const balance = parseFloat(a.balance || 0)
                const isCurrentAsset = a.account_subtype === 'current_asset'
                // Show if it's a current asset and has balance OR show key accounts even if zero
                return isCurrentAsset && (balance !== 0 || ['Cash', 'Accounts Receivable', 'Inventory', 'Petty Cash', 'Prepaid Expenses'].includes(a.account_name))
              }).map((item, idx) => {
                const balance = parseFloat(item.balance || 0)
                const isAsset = item.account_type === 'asset'
                const actualBalance = isAsset ? balance : -balance
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '32px' }}>
                    <div style={{ color: textColor, fontSize: '14px' }}>{item.account_name || 'Current Asset'}</div>
                    <div style={{ color: textColor, fontFamily: 'monospace', fontSize: '14px', fontWeight: 500 }}>
                      {formatCurrency(Math.abs(actualBalance))}
                    </div>
                  </div>
                )
              })}
              {(!report.assets || report.assets.filter(a => a.account_subtype === 'current_asset').length === 0) && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '32px' }}>
                    <div style={{ color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>Cash</div>
                    <div style={{ color: textColor, opacity: 0.6, fontFamily: 'monospace', fontSize: '14px' }}>{formatCurrency(0)}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '32px' }}>
                    <div style={{ color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>Accounts Receivable</div>
                    <div style={{ color: textColor, opacity: 0.6, fontFamily: 'monospace', fontSize: '14px' }}>{formatCurrency(0)}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '32px' }}>
                    <div style={{ color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>Inventory</div>
                    <div style={{ color: textColor, opacity: 0.6, fontFamily: 'monospace', fontSize: '14px' }}>{formatCurrency(0)}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '32px' }}>
                    <div style={{ color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>Prepaid Expenses</div>
                    <div style={{ color: textColor, opacity: 0.6, fontFamily: 'monospace', fontSize: '14px' }}>{formatCurrency(0)}</div>
                  </div>
                </>
              )}
            </div>

            {/* Fixed Assets */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ padding: '10px 0', paddingLeft: '16px', color: textColor, fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fixed Assets</div>
              {report.assets && report.assets.filter(a => {
                const balance = parseFloat(a.balance || 0)
                const isFixedAsset = a.account_subtype === 'fixed_asset'
                return isFixedAsset && (balance !== 0 || ['Equipment', 'Furniture & Fixtures'].includes(a.account_name) || a.account_name.includes('Depreciation'))
              }).map((item, idx) => {
                const balance = parseFloat(item.balance || 0)
                const isAsset = item.account_type === 'asset'
                const actualBalance = isAsset ? balance : -balance
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '32px' }}>
                    <div style={{ color: textColor, fontSize: '14px' }}>{item.account_name || 'Fixed Asset'}</div>
                    <div style={{ color: textColor, fontFamily: 'monospace', fontSize: '14px', fontWeight: 500 }}>
                      {formatCurrency(Math.abs(actualBalance))}
                    </div>
                  </div>
                )
              })}
              {(!report.assets || report.assets.filter(a => a.account_subtype === 'fixed_asset').length === 0) && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '32px' }}>
                    <div style={{ color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>Equipment</div>
                    <div style={{ color: textColor, opacity: 0.6, fontFamily: 'monospace', fontSize: '14px' }}>{formatCurrency(0)}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '32px' }}>
                    <div style={{ color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>Less: Accumulated Depreciation</div>
                    <div style={{ color: textColor, opacity: 0.6, fontFamily: 'monospace', fontSize: '14px' }}>{formatCurrency(0)}</div>
                  </div>
                </>
              )}
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '12px 0', 
              borderTop: `2px solid ${borderColor}`, 
              marginTop: '16px' 
            }}>
              <div style={{ color: textColor, fontWeight: 700, fontSize: '16px' }}>Total Assets</div>
              <div style={{ color: textColor, fontWeight: 700, fontSize: '16px', fontFamily: 'monospace' }}>
                {formatCurrency(report.total_assets || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Liabilities & Equity Column */}
        <div>
          {/* Liabilities */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ padding: '12px 0', borderBottom: `2px solid ${borderColor}`, marginBottom: '16px' }}>
              <h3 style={{ color: textColor, margin: 0, fontSize: '18px', fontWeight: 600 }}>LIABILITIES</h3>
            </div>
            
            {/* Current Liabilities */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ padding: '10px 0', paddingLeft: '16px', color: textColor, fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Liabilities</div>
              {report.liabilities && report.liabilities.filter(l => {
                const balance = parseFloat(l.balance || 0)
                const isCurrentLiability = l.account_subtype === 'current_liability'
                return isCurrentLiability && (balance !== 0 || ['Accounts Payable', 'Sales Tax Payable', 'Wages Payable', 'Unearned Revenue'].includes(l.account_name))
              }).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '32px' }}>
                  <div style={{ color: textColor, fontSize: '14px' }}>{item.account_name || 'Current Liability'}</div>
                  <div style={{ color: textColor, fontFamily: 'monospace', fontSize: '14px', fontWeight: 500 }}>
                    {formatCurrency(Math.abs(item.balance || 0))}
                  </div>
                </div>
              ))}
              {(!report.liabilities || report.liabilities.filter(l => l.account_subtype === 'current_liability').length === 0) && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '32px' }}>
                    <div style={{ color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>Accounts Payable</div>
                    <div style={{ color: textColor, opacity: 0.6, fontFamily: 'monospace', fontSize: '14px' }}>{formatCurrency(0)}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '32px' }}>
                    <div style={{ color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>Sales Tax Payable</div>
                    <div style={{ color: textColor, opacity: 0.6, fontFamily: 'monospace', fontSize: '14px' }}>{formatCurrency(0)}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '32px' }}>
                    <div style={{ color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>Wages Payable</div>
                    <div style={{ color: textColor, opacity: 0.6, fontFamily: 'monospace', fontSize: '14px' }}>{formatCurrency(0)}</div>
                  </div>
                </>
              )}
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '12px 0', 
              borderTop: `2px solid ${borderColor}`, 
              marginTop: '16px' 
            }}>
              <div style={{ color: textColor, fontWeight: 700, fontSize: '16px' }}>Total Liabilities</div>
              <div style={{ color: textColor, fontWeight: 700, fontSize: '16px', fontFamily: 'monospace' }}>
                {formatCurrency(report.total_liabilities || 0)}
              </div>
            </div>
          </div>

          {/* Equity */}
          <div>
            <div style={{ padding: '12px 0', borderBottom: `2px solid ${borderColor}`, marginBottom: '16px' }}>
              <h3 style={{ color: textColor, margin: 0, fontSize: '18px', fontWeight: 600 }}>EQUITY</h3>
            </div>
            
            {report.equity && report.equity.length > 0 ? (
              report.equity.filter(e => parseFloat(e.balance || 0) !== 0 || ['Owner\'s Capital', 'Retained Earnings', 'Common Stock'].includes(e.account_name)).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '16px' }}>
                  <div style={{ color: textColor, fontSize: '14px' }}>{item.account_name || 'Equity'}</div>
                  <div style={{ color: textColor, fontFamily: 'monospace', fontSize: '14px', fontWeight: 500 }}>
                    {formatCurrency(Math.abs(item.balance || 0))}
                  </div>
                </div>
              ))
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '16px' }}>
                  <div style={{ color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>Owner's Capital</div>
                  <div style={{ color: textColor, opacity: 0.6, fontFamily: 'monospace', fontSize: '14px' }}>{formatCurrency(0)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '16px' }}>
                  <div style={{ color: textColor, opacity: 0.6, fontStyle: 'italic', fontSize: '14px' }}>Retained Earnings</div>
                  <div style={{ color: textColor, opacity: 0.6, fontFamily: 'monospace', fontSize: '14px' }}>{formatCurrency(0)}</div>
                </div>
              </>
            )}

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '12px 0', 
              borderTop: `2px solid ${borderColor}`, 
              marginTop: '16px' 
            }}>
              <div style={{ color: textColor, fontWeight: 700, fontSize: '16px' }}>Total Equity</div>
              <div style={{ color: textColor, fontWeight: 700, fontSize: '16px', fontFamily: 'monospace' }}>
                {formatCurrency(report.total_equity || 0)}
              </div>
            </div>
          </div>

          {/* Total Liabilities + Equity */}
          <div style={{ 
            marginTop: '24px',
            padding: '16px',
            backgroundColor: document.documentElement.classList.contains('dark-theme') ? '#2a2a2a' : '#f9f9f9',
            borderRadius: '8px',
            border: `2px solid ${borderColor}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: textColor, fontWeight: 700, fontSize: '16px' }}>Total Liabilities + Equity</div>
              <div style={{ color: textColor, fontWeight: 700, fontSize: '16px', fontFamily: 'monospace' }}>
                {formatCurrency(report.total_liabilities_and_equity || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Cash Flow Statement Component
function CashFlowStatement({ report, formatCurrency, textColor, borderColor, cardBg }) {
  if (!report) {
    return <div style={{ color: textColor, padding: '20px' }}>No cash flow data available</div>
  }
  
  const operating = report.operating_activities || {}
  const investing = report.investing_activities || {}
  const financing = report.financing_activities || {}
  
  return (
    <div style={{
      backgroundColor: cardBg,
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '32px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ color: textColor, margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>CASH FLOW STATEMENT</h2>
        <p style={{ color: textColor, opacity: 0.7, margin: 0, fontSize: '14px' }}>{report.period || 'Period'}</p>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Operating Activities */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ padding: '12px 0', borderBottom: `2px solid ${borderColor}`, marginBottom: '16px' }}>
            <h3 style={{ color: textColor, margin: 0, fontSize: '18px', fontWeight: 600 }}>OPERATING ACTIVITIES</h3>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '16px' }}>
            <div style={{ color: textColor }}>Cash from Sales</div>
            <div style={{ color: '#10b981', fontFamily: 'monospace' }}>
              {formatCurrency(operating.cash_from_sales || 0)}
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '16px' }}>
            <div style={{ color: textColor }}>Cash Paid for Expenses</div>
            <div style={{ color: '#ef4444', fontFamily: 'monospace' }}>
              ({formatCurrency(operating.cash_paid_expenses || 0)})
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '16px' }}>
            <div style={{ color: textColor }}>Cash Paid for Payroll</div>
            <div style={{ color: '#ef4444', fontFamily: 'monospace' }}>
              ({formatCurrency(operating.cash_paid_payroll || 0)})
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '12px 0', 
            borderTop: `2px solid ${borderColor}`, 
            marginTop: '8px',
            fontWeight: 600
          }}>
            <div style={{ color: textColor }}>Net Cash from Operating Activities</div>
            <div style={{ 
              color: (operating.net_operating_cash_flow || 0) >= 0 ? '#10b981' : '#ef4444', 
              fontFamily: 'monospace'
            }}>
              {formatCurrency(operating.net_operating_cash_flow || 0)}
            </div>
          </div>
        </div>

        {/* Investing Activities */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ padding: '12px 0', borderBottom: `2px solid ${borderColor}`, marginBottom: '16px' }}>
            <h3 style={{ color: textColor, margin: 0, fontSize: '18px', fontWeight: 600 }}>INVESTING ACTIVITIES</h3>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '16px' }}>
            <div style={{ color: textColor }}>Equipment Purchases</div>
            <div style={{ color: '#ef4444', fontFamily: 'monospace' }}>
              ({formatCurrency(Math.abs(investing.net_investing_cash_flow || 0))})
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '12px 0', 
            borderTop: `2px solid ${borderColor}`, 
            marginTop: '8px',
            fontWeight: 600
          }}>
            <div style={{ color: textColor }}>Net Cash from Investing Activities</div>
            <div style={{ 
              color: (investing.net_investing_cash_flow || 0) >= 0 ? '#10b981' : '#ef4444', 
              fontFamily: 'monospace'
            }}>
              {formatCurrency(investing.net_investing_cash_flow || 0)}
            </div>
          </div>
        </div>

        {/* Financing Activities */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ padding: '12px 0', borderBottom: `2px solid ${borderColor}`, marginBottom: '16px' }}>
            <h3 style={{ color: textColor, margin: 0, fontSize: '18px', fontWeight: 600 }}>FINANCING ACTIVITIES</h3>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: '16px' }}>
            <div style={{ color: textColor }}>Owner Investment</div>
            <div style={{ color: '#10b981', fontFamily: 'monospace' }}>
              {formatCurrency(financing.net_financing_cash_flow || 0)}
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '12px 0', 
            borderTop: `2px solid ${borderColor}`, 
            marginTop: '8px',
            fontWeight: 600
          }}>
            <div style={{ color: textColor }}>Net Cash from Financing Activities</div>
            <div style={{ 
              color: (financing.net_financing_cash_flow || 0) >= 0 ? '#10b981' : '#ef4444', 
              fontFamily: 'monospace'
            }}>
              {formatCurrency(financing.net_financing_cash_flow || 0)}
            </div>
          </div>
        </div>

        {/* Net Change and Ending Balance */}
        <div style={{ 
          marginTop: '32px',
          padding: '20px',
          backgroundColor: document.documentElement.classList.contains('dark-theme') ? '#2a2a2a' : '#f9f9f9',
          borderRadius: '8px',
          border: `2px solid ${borderColor}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <div style={{ color: textColor, fontWeight: 600 }}>Beginning Cash Balance</div>
            <div style={{ color: textColor, fontFamily: 'monospace' }}>
              {formatCurrency(report.beginning_cash_balance || 0)}
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${borderColor}`, marginTop: '8px' }}>
            <div style={{ color: textColor, fontWeight: 600 }}>Net Change in Cash</div>
            <div style={{ 
              color: (report.net_cash_flow || 0) >= 0 ? '#10b981' : '#ef4444', 
              fontWeight: 600,
              fontFamily: 'monospace'
            }}>
              {formatCurrency(report.net_cash_flow || 0)}
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '12px 0', 
            borderTop: `2px solid ${borderColor}`, 
            marginTop: '12px',
            alignItems: 'center'
          }}>
            <div style={{ color: textColor, fontWeight: 700, fontSize: '18px' }}>Ending Cash Balance</div>
            <div style={{ color: textColor, fontWeight: 700, fontSize: '18px', fontFamily: 'monospace' }}>
              {formatCurrency(report.ending_cash_balance || 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Payroll Tab Component
function PayrollTab({ dateRange, formatCurrency, getAuthHeaders }) {
  const [payrollRecords, setPayrollRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  useEffect(() => {
    loadPayroll()
  }, [dateRange])

  const loadPayroll = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/accounting/payroll?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`,
        { headers: getAuthHeaders() }
      )
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Permission denied')
        }
        throw new Error(`Failed to load payroll: ${response.status}`)
      }
      
      const data = await response.json()
      setPayrollRecords(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading payroll:', err)
      setPayrollRecords([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ color: textColor, padding: '20px' }}>Loading payroll records...</div>
  }

  if (payrollRecords.length === 0) {
    return (
      <div style={{ color: textColor, padding: '40px 20px', textAlign: 'center', lineHeight: '1.8' }}>
        <h3 style={{ color: textColor, marginBottom: '16px', fontSize: '18px' }}>Payroll Records</h3>
        <p style={{ color: textColor, opacity: 0.8, fontSize: '14px', maxWidth: '600px', margin: '0 auto' }}>
          This section displays all payroll records for employees, including gross pay, tax withholdings, and net pay. 
          Payroll records are created when employees are paid. Each record shows the pay period, employee name, 
          gross pay amount, deductions, and final net pay. Adjust the date range above to view different periods.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
              <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Employee</th>
              <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Pay Period</th>
              <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Gross Pay</th>
              <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Taxes</th>
              <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Net Pay</th>
            </tr>
          </thead>
          <tbody>
            {payrollRecords.map(record => (
              <tr key={record.payroll_id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                <td style={{ padding: '12px', color: textColor }}>{record.employee_name || 'Unknown'}</td>
                <td style={{ padding: '12px', color: textColor }}>
                  {record.pay_period_start} to {record.pay_period_end}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>
                  {formatCurrency(record.gross_pay || 0)}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', color: textColor, fontSize: '12px', opacity: 0.8 }}>
                  Fed: {formatCurrency(record.federal_income_tax_withheld || 0)}<br/>
                  SS: {formatCurrency(record.social_security_tax_withheld || 0)}<br/>
                  Med: {formatCurrency(record.medicare_tax_withheld || 0)}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>
                  {formatCurrency(record.net_pay || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Expenses Tab Component
function ExpensesTab({ dateRange, formatCurrency, getAuthHeaders }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'

  useEffect(() => {
    loadExpenses()
  }, [dateRange])

  const loadExpenses = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/accounting/expenses?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`,
        { headers: getAuthHeaders() }
      )
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Permission denied')
        }
        throw new Error(`Failed to load expenses: ${response.status}`)
      }
      
      const data = await response.json()
      setExpenses(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading expenses:', err)
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ color: textColor, padding: '20px' }}>Loading expenses...</div>
  }

  if (expenses.length === 0) {
    return (
      <div style={{ color: textColor, padding: '40px 20px', textAlign: 'center', lineHeight: '1.8' }}>
        <h3 style={{ color: textColor, marginBottom: '16px', fontSize: '18px' }}>Business Expenses</h3>
        <p style={{ color: textColor, opacity: 0.8, fontSize: '14px', maxWidth: '600px', margin: '0 auto' }}>
          Track all business expenses here, organized by category such as rent, utilities, insurance, office supplies, 
          marketing, and professional services. Each expense entry includes the date, description, amount, payment method, 
          and category. This helps you monitor spending and prepare for tax deductions. Adjust the date range above to view different periods.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
              <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Date</th>
              <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Description</th>
              <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Category</th>
              <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(expense => (
              <tr key={expense.expense_id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                <td style={{ padding: '12px', color: textColor }}>{expense.expense_date || ''}</td>
                <td style={{ padding: '12px', color: textColor }}>{expense.description || 'N/A'}</td>
                <td style={{ padding: '12px', color: textColor }}>{expense.category_name || 'Uncategorized'}</td>
                <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>
                  {formatCurrency(expense.amount || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Taxes Tab Component
function TaxesTab({ dateRange, formatCurrency, getAuthHeaders }) {
  const [taxData, setTaxData] = useState({})
  const [loading, setLoading] = useState(true)
  const [taxYear, setTaxYear] = useState(new Date().getFullYear())
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const textColor = isDarkMode ? '#ffffff' : '#1a1a1a'
  const borderColor = isDarkMode ? '#3a3a3a' : '#e0e0e0'
  const cardBg = isDarkMode ? '#2a2a2a' : 'white'

  useEffect(() => {
    loadTaxData()
  }, [dateRange, taxYear])

  const loadTaxData = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/accounting/taxes?tax_year=${taxYear}&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`,
        { headers: getAuthHeaders() }
      )
      if (!response.ok) throw new Error('Failed to load tax data')
      const data = await response.json()
      setTaxData(data)
    } catch (err) {
      console.error('Error loading tax data:', err)
      setTaxData({})
    } finally {
      setLoading(false)
    }
  }

  const generateTaxForm = async (formType, ...args) => {
    try {
      const url = `/api/accounting/tax-forms/${formType}/${args.join('/')}`
      const response = await fetch(url, { headers: getAuthHeaders() })
      if (!response.ok) throw new Error('Failed to generate form')
      const blob = await response.blob()
      const url2 = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url2
      a.download = `${formType}_${args.join('_')}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url2)
      document.body.removeChild(a)
    } catch (err) {
      alert('Failed to generate tax form: ' + err.message)
    }
  }

  if (loading) {
    return <div style={{ color: textColor, padding: '20px' }}>Loading tax data...</div>
  }

  const salesTax = taxData.sales_tax || []
  const form941 = taxData.form_941
  const form940 = taxData.form_940
  const contractorPayments = taxData.contractor_payments || []
  const contractorTotals = taxData.contractor_totals || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <label style={{ color: textColor, fontWeight: 500 }}>Tax Year:</label>
        <input
          type="number"
          value={taxYear}
          onChange={(e) => setTaxYear(parseInt(e.target.value))}
          style={{
            padding: '8px 12px',
            border: `1px solid ${borderColor}`,
            borderRadius: '6px',
            backgroundColor: isDarkMode ? '#1a1a1a' : 'white',
            color: textColor,
            fontSize: '14px',
            width: '100px'
          }}
        />
      </div>

      {/* Sales Tax Summary */}
      <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '20px', backgroundColor: cardBg }}>
        <h3 style={{ color: textColor, marginBottom: '16px', fontSize: '18px' }}>Sales Tax Summary</h3>
        {salesTax.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Jurisdiction</th>
                <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Transactions</th>
                <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Taxable Amount</th>
                <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Tax Collected</th>
              </tr>
            </thead>
            <tbody>
              {salesTax.map((tax, idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '12px', color: textColor }}>{tax.jurisdiction || 'Unknown'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>{tax.transaction_count || 0}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>
                    {formatCurrency(tax.total_taxable_amount || 0)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>
                    {formatCurrency(tax.total_tax_collected || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: textColor, opacity: 0.7 }}>No sales tax data available for this period.</p>
        )}
      </div>

      {/* Form 941 (Quarterly Federal Tax) */}
      {form941 && (
        <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '20px', backgroundColor: cardBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: textColor, margin: 0, fontSize: '18px' }}>Form 941 - Q{form941.quarter} {form941.tax_year}</h3>
            <button
              onClick={() => generateTaxForm('form941', form941.quarter, form941.tax_year)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Generate PDF
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>Number of Employees</div>
              <div style={{ color: textColor, fontSize: '20px', fontWeight: 600 }}>{form941.num_employees || 0}</div>
            </div>
            <div>
              <div style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>Total Wages</div>
              <div style={{ color: textColor, fontSize: '20px', fontWeight: 600 }}>{formatCurrency(form941.total_wages || 0)}</div>
            </div>
            <div>
              <div style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>Federal Tax Withheld</div>
              <div style={{ color: textColor, fontSize: '20px', fontWeight: 600 }}>{formatCurrency(form941.federal_tax_withheld || 0)}</div>
            </div>
            <div>
              <div style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>Social Security Tax</div>
              <div style={{ color: textColor, fontSize: '20px', fontWeight: 600 }}>{formatCurrency(form941.ss_tax_total || 0)}</div>
            </div>
            <div>
              <div style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>Medicare Tax</div>
              <div style={{ color: textColor, fontSize: '20px', fontWeight: 600 }}>{formatCurrency(form941.medicare_tax_total || 0)}</div>
            </div>
            <div>
              <div style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>Total Tax Liability</div>
              <div style={{ color: textColor, fontSize: '20px', fontWeight: 600 }}>{formatCurrency(form941.total_tax_liability || 0)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Form 940 (FUTA Tax) */}
      {form940 && (
        <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '20px', backgroundColor: cardBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: textColor, margin: 0, fontSize: '18px' }}>Form 940 - {form940.tax_year}</h3>
            <button
              onClick={() => generateTaxForm('form940', form940.tax_year)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Generate PDF
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>Number of Employees</div>
              <div style={{ color: textColor, fontSize: '20px', fontWeight: 600 }}>{form940.num_employees || 0}</div>
            </div>
            <div>
              <div style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>FUTA Wages</div>
              <div style={{ color: textColor, fontSize: '20px', fontWeight: 600 }}>{formatCurrency(form940.futa_wages || 0)}</div>
            </div>
            <div>
              <div style={{ color: textColor, opacity: 0.7, fontSize: '14px' }}>FUTA Tax</div>
              <div style={{ color: textColor, fontSize: '20px', fontWeight: 600 }}>{formatCurrency(form940.futa_tax || 0)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Contractor Payments (1099-NEC) */}
      {Object.keys(contractorTotals).length > 0 && (
        <div style={{ border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '20px', backgroundColor: cardBg }}>
          <h3 style={{ color: textColor, marginBottom: '16px', fontSize: '18px' }}>Contractor Payments (1099-NEC)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: isDarkMode ? '#1f1f1f' : '#f9f9f9' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Contractor</th>
                <th style={{ padding: '12px', textAlign: 'left', color: textColor, borderBottom: `1px solid ${borderColor}` }}>TIN</th>
                <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Payments</th>
                <th style={{ padding: '12px', textAlign: 'right', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Total Amount</th>
                <th style={{ padding: '12px', textAlign: 'center', color: textColor, borderBottom: `1px solid ${borderColor}` }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(contractorTotals).map(([name, data], idx) => (
                <tr key={idx} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '12px', color: textColor }}>{name}</td>
                  <td style={{ padding: '12px', color: textColor }}>{data.tin || 'N/A'}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>{data.count || 0}</td>
                  <td style={{ padding: '12px', textAlign: 'right', color: textColor }}>
                    {formatCurrency(data.total || 0)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => generateTaxForm('1099nec', idx + 1, taxYear)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Generate 1099-NEC
                    </button>
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

export default Accounting
