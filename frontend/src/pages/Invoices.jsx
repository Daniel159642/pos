import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import invoiceService from '../services/invoiceService'
import customerService from '../services/customerService'
import accountService from '../services/accountService'
import InvoiceTable from '../components/invoices/InvoiceTable'
import InvoiceForm from '../components/invoices/InvoiceForm'
import InvoiceFilters from '../components/invoices/InvoiceFilters'
import Modal from '../components/common/Modal'
import Button from '../components/common/Button'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Alert from '../components/common/Alert'

function InvoiceDetailView({ invoice }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  const getCustomerName = (customer) => {
    if (!customer) return 'Unknown'
    return customer.display_name || customer.company_name || [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim() || 'Customer'
  }
  const inv = invoice?.invoice || invoice
  const lines = invoice?.lines || []
  const customer = invoice?.customer

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Invoice Number</p>
          <p style={{ fontSize: '18px', fontWeight: 600, color: isDarkMode ? '#fff' : '#111', margin: 0 }}>{inv.invoice_number}</p>
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
              backgroundColor: inv.status === 'paid' ? (isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7') : inv.status === 'overdue' ? (isDarkMode ? 'rgba(239,68,68,0.2)' : '#fee2e2') : inv.status === 'partial' ? (isDarkMode ? 'rgba(234,179,8,0.2)' : '#fef9c3') : isDarkMode ? 'rgba(59,130,246,0.2)' : '#dbeafe',
              color: inv.status === 'paid' ? '#16a34a' : inv.status === 'overdue' ? '#dc2626' : inv.status === 'partial' ? '#a16207' : '#2563eb'
            }}
          >
            {String(inv.status || '').charAt(0).toUpperCase() + (inv.status || '').slice(1)}
          </span>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Customer</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{getCustomerName(customer)}</p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Invoice Date</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{new Date(inv.invoice_date).toLocaleDateString()}</p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Due Date</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{new Date(inv.due_date).toLocaleDateString()}</p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Payment Terms</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{inv.terms || '—'}</p>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>Line Items</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f9fafb' }}>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Description</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Qty</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Price</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id || line.line_number} style={{ borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                  <td style={{ padding: '8px 12px', fontSize: '14px', color: isDarkMode ? '#e5e7eb' : '#111' }}>{line.description}</td>
                  <td style={{ padding: '8px 12px', fontSize: '14px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#374151' }}>{line.quantity}</td>
                  <td style={{ padding: '8px 12px', fontSize: '14px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#374151' }}>{formatCurrency(line.unit_price)}</td>
                  <td style={{ padding: '8px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(line.line_total_with_tax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginLeft: 'auto', maxWidth: '320px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
          <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Subtotal:</span>
          <span style={{ fontWeight: 500 }}>{formatCurrency(inv.subtotal)}</span>
        </div>
        {(inv.discount_amount || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
            <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Discount:</span>
            <span style={{ fontWeight: 500, color: '#dc2626' }}>-{formatCurrency(inv.discount_amount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
          <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Tax:</span>
          <span style={{ fontWeight: 500 }}>{formatCurrency(inv.tax_amount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700, paddingTop: '12px', borderTop: '2px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
          <span>Total:</span>
          <span style={{ color: '#2563eb' }}>{formatCurrency(inv.total_amount)}</span>
        </div>
        {(inv.amount_paid || 0) > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '8px' }}>
              <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Amount Paid:</span>
              <span style={{ fontWeight: 500, color: '#16a34a' }}>{formatCurrency(inv.amount_paid)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 600, marginTop: '4px' }}>
              <span>Balance Due:</span>
              <span style={{ color: (inv.balance_due || 0) > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(inv.balance_due)}</span>
            </div>
          </>
        )}
      </div>

      {(inv.billing_address_line1 || inv.shipping_address_line1) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {inv.billing_address_line1 && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '8px' }}>Billing Address</h4>
              <div style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#4b5563' }}>
                <p style={{ margin: '0 0 4px' }}>{inv.billing_address_line1}</p>
                {inv.billing_address_line2 && <p style={{ margin: '0 0 4px' }}>{inv.billing_address_line2}</p>}
                <p style={{ margin: 0 }}>
                  {[inv.billing_city, inv.billing_state].filter(Boolean).join(', ')} {inv.billing_postal_code || ''}
                </p>
                {inv.billing_country && <p style={{ margin: 0 }}>{inv.billing_country}</p>}
              </div>
            </div>
          )}
          {inv.shipping_address_line1 && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '8px' }}>Shipping Address</h4>
              <div style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#4b5563' }}>
                <p style={{ margin: '0 0 4px' }}>{inv.shipping_address_line1}</p>
                {inv.shipping_address_line2 && <p style={{ margin: '0 0 4px' }}>{inv.shipping_address_line2}</p>}
                <p style={{ margin: 0 }}>
                  {[inv.shipping_city, inv.shipping_state].filter(Boolean).join(', ')} {inv.shipping_postal_code || ''}
                </p>
                {inv.shipping_country && <p style={{ margin: 0 }}>{inv.shipping_country}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {inv.memo && (
        <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb', fontSize: '14px' }}>
          <span style={{ fontWeight: 600, color: isDarkMode ? '#93c5fd' : '#1e40af' }}>Memo:</span> {inv.memo}
        </div>
      )}
    </div>
  )
}

function Invoices() {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [revenueAccounts, setRevenueAccounts] = useState([])
  const [taxRates, setTaxRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ page: 1, limit: 50 })
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 })
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [filters.page, filters.limit, filters.customer_id, filters.status, filters.start_date, filters.end_date, filters.overdue_only, filters.search])

  async function fetchInitialData() {
    try {
      const [custRes, accountsData, _taxRates] = await Promise.all([
        customerService.getAllCustomers({ is_active: true, limit: 500 }),
        accountService.getAllAccounts({ account_type: 'Revenue', is_active: true }),
        Promise.resolve([])
      ])
      setCustomers(custRes.customers || [])
      setRevenueAccounts(Array.isArray(accountsData) ? accountsData : [])
      setTaxRates(Array.isArray(_taxRates) ? _taxRates : [])
    } catch (err) {
      showAlert('error', 'Failed to fetch initial data')
    }
  }

  async function fetchInvoices() {
    setLoading(true)
    try {
      const result = await invoiceService.getAllInvoices(filters)
      setInvoices(result.invoices || [])
      setPagination(result.pagination || { total: 0, page: 1, total_pages: 1 })
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch invoices'
      showAlert('error', msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateInvoice(data, sendImmediately) {
    try {
      const created = await invoiceService.createInvoice(data)
      if (sendImmediately) {
        await invoiceService.markAsSent(created.invoice?.id ?? created.id)
        showAlert('success', 'Invoice created and marked as sent')
      } else {
        showAlert('success', 'Invoice created successfully')
      }
      setIsCreateModalOpen(false)
      fetchInvoices()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create invoice'
      showAlert('error', msg)
      throw err
    }
  }

  async function handleUpdateInvoice(data) {
    if (!selectedInvoice) return
    const inv = selectedInvoice.invoice || selectedInvoice
    try {
      await invoiceService.updateInvoice(inv.id, data)
      showAlert('success', 'Invoice updated successfully')
      setIsEditModalOpen(false)
      setSelectedInvoice(null)
      fetchInvoices()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update invoice'
      showAlert('error', msg)
      throw err
    }
  }

  async function handleDeleteInvoice(item) {
    const inv = item.invoice || item
    if (!window.confirm(`Are you sure you want to delete invoice ${inv.invoice_number}?`)) return
    try {
      await invoiceService.deleteInvoice(inv.id)
      showAlert('success', 'Invoice deleted successfully')
      fetchInvoices()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete invoice'
      showAlert('error', msg)
    }
  }

  async function handleSendInvoice(item) {
    const inv = item.invoice || item
    if (!window.confirm(`Mark invoice ${inv.invoice_number} as sent?`)) return
    try {
      await invoiceService.markAsSent(inv.id)
      showAlert('success', 'Invoice marked as sent')
      fetchInvoices()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send invoice'
      showAlert('error', msg)
    }
  }

  async function handleVoidInvoice(item) {
    const inv = item.invoice || item
    const reason = window.prompt(`Enter reason for voiding invoice ${inv.invoice_number}:`)
    if (!reason || !reason.trim()) return
    try {
      await invoiceService.voidInvoice(inv.id, reason.trim())
      showAlert('success', 'Invoice voided successfully')
      fetchInvoices()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to void invoice'
      showAlert('error', msg)
    }
  }

  function handleRecordPayment(item) {
    const inv = item?.invoice || item
    if (!inv?.id || !inv?.customer_id) return
    navigate('/payments', {
      state: { openPaymentForm: true, customerId: inv.customer_id, invoiceId: inv.id }
    })
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

  if (loading && invoices.length === 0) {
    return (
      <div style={{ padding: '32px' }}>
        <LoadingSpinner size="lg" text="Loading invoices..." />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: isDarkMode ? '#fff' : '#111', margin: 0 }}>Invoices</h1>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Create and manage sales invoices</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>+ New Invoice</Button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <InvoiceFilters filters={filters} customers={customers} onFilterChange={setFilters} onClearFilters={handleClearFilters} />

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
            Showing {invoices.length} of {total} invoices
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
          <InvoiceTable
            invoices={invoices}
            onView={(item) => {
              setSelectedInvoice(item)
              setIsViewModalOpen(true)
            }}
            onEdit={(item) => {
              setSelectedInvoice(item)
              setIsEditModalOpen(true)
            }}
            onDelete={handleDeleteInvoice}
            onSend={handleSendInvoice}
            onVoid={handleVoidInvoice}
            onRecordPayment={handleRecordPayment}
          />
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Invoice" size="xl">
        <InvoiceForm
          customers={customers}
          revenueAccounts={revenueAccounts}
          taxRates={taxRates}
          onSubmit={handleCreateInvoice}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedInvoice(null)
        }}
        title="Edit Invoice"
        size="xl"
      >
        <InvoiceForm
          invoice={selectedInvoice}
          customers={customers}
          revenueAccounts={revenueAccounts}
          taxRates={taxRates}
          onSubmit={handleUpdateInvoice}
          onCancel={() => {
            setIsEditModalOpen(false)
            setSelectedInvoice(null)
          }}
        />
      </Modal>

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setSelectedInvoice(null)
        }}
        title="Invoice Details"
        size="lg"
      >
        {selectedInvoice && <InvoiceDetailView invoice={selectedInvoice} />}
      </Modal>
    </div>
  )
}

export default Invoices
