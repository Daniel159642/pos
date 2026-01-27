import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import paymentService from '../services/paymentService'
import customerService from '../services/customerService'
import accountService from '../services/accountService'
import PaymentTable from '../components/payments/PaymentTable'
import PaymentForm from '../components/payments/PaymentForm'
import PaymentFilters from '../components/payments/PaymentFilters'
import Modal from '../components/common/Modal'
import Button from '../components/common/Button'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Alert from '../components/common/Alert'

function PaymentDetailView({ payment }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  const methodLabels = { cash: 'Cash', check: 'Check', credit_card: 'Credit Card', debit_card: 'Debit Card', bank_transfer: 'Bank Transfer', ach: 'ACH', other: 'Other' }
  const getMethodLabel = (method) => methodLabels[method] || method || 'Other'

  const pmt = payment?.payment || payment
  const apps = payment?.applications || []
  const appliedInvoices = payment?.applied_invoices || []
  const totalApplied = apps.reduce((sum, a) => sum + (a.amount_applied || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Payment Number</p>
          <p style={{ fontSize: '18px', fontWeight: 600, color: isDarkMode ? '#fff' : '#111', margin: 0 }}>{pmt.payment_number}</p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Status</p>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '14px',
              fontWeight: 600,
              backgroundColor: pmt.status === 'deposited' ? (isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7') : pmt.status === 'void' ? (isDarkMode ? '#2a2a2a' : '#e5e7eb') : isDarkMode ? 'rgba(59,130,246,0.2)' : '#dbeafe',
              color: pmt.status === 'deposited' ? '#16a34a' : pmt.status === 'void' ? '#6b7280' : '#2563eb'
            }}
          >
            {String(pmt.status || '').charAt(0).toUpperCase() + (pmt.status || '').slice(1)}
          </span>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Customer</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{payment?.customer?.display_name || payment?.customer?.company_name || 'Unknown'}</p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Payment Date</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{new Date(pmt.payment_date).toLocaleDateString()}</p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Payment Method</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{getMethodLabel(pmt.payment_method)}</p>
        </div>
        {pmt.reference_number && (
          <div>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Reference Number</p>
            <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{pmt.reference_number}</p>
          </div>
        )}
      </div>

      <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
          <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Payment Amount:</span>
          <span style={{ fontWeight: 600, fontSize: '18px' }}>{formatCurrency(pmt.payment_amount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
          <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Amount Applied:</span>
          <span style={{ fontWeight: 500, color: '#16a34a' }}>{formatCurrency(totalApplied)}</span>
        </div>
        {(pmt.unapplied_amount || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Unapplied Amount:</span>
            <span style={{ fontWeight: 500, color: '#ea580c' }}>{formatCurrency(pmt.unapplied_amount)}</span>
          </div>
        )}
      </div>

      {appliedInvoices.length > 0 && (
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>Applied to Invoices</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Invoice #</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Invoice Total</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Balance</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Applied</th>
                </tr>
              </thead>
              <tbody>
                {appliedInvoices.map((app) => {
                  const inv = app.invoice || {}
                  const appl = app.application || {}
                  return (
                    <tr key={appl.id || inv.id} style={{ borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                      <td style={{ padding: '8px 12px', fontSize: '14px', color: isDarkMode ? '#e5e7eb' : '#111' }}>{inv.invoice_number}</td>
                      <td style={{ padding: '8px 12px', fontSize: '14px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#374151' }}>{formatCurrency(inv.total_amount)}</td>
                      <td style={{ padding: '8px 12px', fontSize: '14px', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(inv.balance_due)}</td>
                      <td style={{ padding: '8px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 500, color: '#16a34a' }}>{formatCurrency(appl.amount_applied)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pmt.memo && (
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '8px' }}>Memo</h4>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', margin: 0, padding: '12px', borderRadius: '6px', backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : '#eff6ff' }}>{pmt.memo}</p>
        </div>
      )}

      {pmt.status === 'void' && pmt.void_reason && (
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: '1px solid ' + (isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca') }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>Void Information</h4>
          <p style={{ fontSize: '14px', color: '#991b1b', margin: '0 0 4px' }}>
            <strong>Date:</strong> {pmt.void_date ? new Date(pmt.void_date).toLocaleDateString() : '—'}
          </p>
          <p style={{ fontSize: '14px', color: '#991b1b', margin: 0 }}>
            <strong>Reason:</strong> {pmt.void_reason}
          </p>
        </div>
      )}
    </div>
  )
}

function Payments() {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const location = useLocation()
  const locationState = location.state || {}

  const [payments, setPayments] = useState([])
  const [customers, setCustomers] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ page: 1, limit: 50 })
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 })
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    fetchInitialData()
    if (locationState.openPaymentForm) setIsCreateModalOpen(true)
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [filters.page, filters.limit, filters.customer_id, filters.payment_method, filters.status, filters.start_date, filters.end_date, filters.search])

  async function fetchInitialData() {
    try {
      const [custRes, accountsData] = await Promise.all([
        customerService.getAllCustomers({ is_active: true, limit: 500 }),
        accountService.getAllAccounts({ is_active: true })
      ])
      setCustomers(custRes.customers || [])
      const raw = Array.isArray(accountsData) ? accountsData : []
      const bankAndCash = raw.filter((acc) => {
        if (acc.account_type !== 'Asset') return false
        const st = (acc.sub_type || '').toLowerCase()
        const name = (acc.account_name || '').toLowerCase()
        return (
          st.includes('cash') ||
          st.includes('bank') ||
          name.includes('cash') ||
          name.includes('checking') ||
          name.includes('savings')
        )
      })
      setBankAccounts(bankAndCash)
    } catch (err) {
      showAlert('error', 'Failed to fetch initial data')
    }
  }

  async function fetchPayments() {
    setLoading(true)
    try {
      const result = await paymentService.getAllPayments(filters)
      setPayments(result.payments || [])
      setPagination(result.pagination || { total: 0, page: 1, total_pages: 1 })
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch payments'
      showAlert('error', msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreatePayment(data) {
    try {
      await paymentService.createPayment(data)
      showAlert('success', 'Payment recorded successfully')
      setIsCreateModalOpen(false)
      fetchPayments()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create payment'
      showAlert('error', msg)
      throw err
    }
  }

  async function handleVoidPayment(item) {
    const pmt = item.payment || item
    const reason = window.prompt(`Enter reason for voiding payment ${pmt.payment_number}:`)
    if (!reason || !reason.trim()) return
    try {
      await paymentService.voidPayment(pmt.id, reason.trim())
      showAlert('success', 'Payment voided successfully')
      fetchPayments()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to void payment'
      showAlert('error', msg)
    }
  }

  async function handleDeletePayment(item) {
    const pmt = item.payment || item
    if (!window.confirm(`Are you sure you want to delete payment ${pmt.payment_number}?`)) return
    try {
      await paymentService.deletePayment(pmt.id)
      showAlert('success', 'Payment deleted successfully')
      fetchPayments()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete payment'
      showAlert('error', msg)
    }
  }

  function showAlert(type, message) {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  function handleClearFilters() {
    setFilters({ page: 1, limit: 50 })
  }

  function handlePageChange(newPage) {
    setFilters((f) => ({ ...f, page: newPage }))
  }

  const page = pagination.page || 1
  const totalPages = pagination.total_pages || 1
  const total = pagination.total || 0

  if (loading && payments.length === 0) {
    return (
      <div style={{ padding: '32px' }}>
        <LoadingSpinner size="lg" text="Loading payments..." />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: isDarkMode ? '#fff' : '#111', margin: 0 }}>Payments</h1>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Record and manage customer payments</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>+ Record Payment</Button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <PaymentFilters filters={filters} customers={customers} onFilterChange={setFilters} onClearFilters={handleClearFilters} />

      <div
        style={{
          backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
          borderRadius: '8px',
          boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb'),
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', margin: 0 }}>
            Showing {payments.length} of {total} payments
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button type="button" size="sm" variant="secondary" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
              Previous
            </Button>
            <span style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', padding: '0 8px' }}>
              Page {page} of {totalPages}
            </span>
            <Button type="button" size="sm" variant="secondary" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px' }}>
            <LoadingSpinner size="md" text="Loading..." />
          </div>
        ) : (
          <PaymentTable
            payments={payments}
            onView={(item) => {
              setSelectedPayment(item)
              setIsViewModalOpen(true)
            }}
            onVoid={handleVoidPayment}
            onDelete={handleDeletePayment}
          />
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Record Payment" size="xl">
        <PaymentForm
          customers={customers}
          bankAccounts={bankAccounts}
          onSubmit={handleCreatePayment}
          onCancel={() => setIsCreateModalOpen(false)}
          preselectedCustomerId={locationState.customerId}
          preselectedInvoiceId={locationState.invoiceId}
        />
      </Modal>

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setSelectedPayment(null)
        }}
        title="Payment Details"
        size="lg"
      >
        {selectedPayment && <PaymentDetailView payment={selectedPayment} />}
      </Modal>
    </div>
  )
}

export default Payments
