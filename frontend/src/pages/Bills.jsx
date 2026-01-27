import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import billService from '../services/billService'
import vendorService from '../services/vendorService'
import accountService from '../services/accountService'
import customerService from '../services/customerService'
import BillTable from '../components/bills/BillTable'
import BillForm from '../components/bills/BillForm'
import BillFilters from '../components/bills/BillFilters'
import Modal from '../components/common/Modal'
import Button from '../components/common/Button'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Alert from '../components/common/Alert'

function BillDetailView({ bill }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  const getVendorName = (vendor) => {
    if (!vendor) return 'Unknown'
    return vendor.vendor_name || 'Unknown'
  }

  const b = bill?.bill || bill
  const lines = bill?.lines || []
  const vendor = bill?.vendor

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Bill Number</p>
          <p style={{ fontSize: '18px', fontWeight: 600, color: isDarkMode ? '#fff' : '#111', margin: 0 }}>{b.bill_number}</p>
          {b.vendor_reference && (
            <p style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Ref: {b.vendor_reference}</p>
          )}
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
              backgroundColor: b.status === 'paid' ? (isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7') : b.status === 'void' ? (isDarkMode ? '#2a2a2a' : '#e5e7eb') : b.status === 'partial' ? (isDarkMode ? 'rgba(234,179,8,0.2)' : '#fef9c3') : isDarkMode ? 'rgba(59,130,246,0.2)' : '#dbeafe',
              color: b.status === 'paid' ? '#16a34a' : b.status === 'void' ? '#6b7280' : b.status === 'partial' ? '#a16207' : '#2563eb'
            }}
          >
            {String(b.status || '').charAt(0).toUpperCase() + (b.status || '').slice(1)}
          </span>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Vendor</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{getVendorName(vendor)}</p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Bill Date</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{b.bill_date ? new Date(b.bill_date).toLocaleDateString() : '—'}</p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Due Date</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{b.due_date ? new Date(b.due_date).toLocaleDateString() : '—'}</p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Payment Terms</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{b.terms || '—'}</p>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>Line Items</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f9fafb' }}>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Description</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Account</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Qty</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Cost</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id || line.line_number} style={{ borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
                  <td style={{ padding: '8px 12px', fontSize: '14px', color: isDarkMode ? '#e5e7eb' : '#111' }}>
                    {line.description}
                    {line.billable && (
                      <span style={{ marginLeft: '8px', display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, backgroundColor: isDarkMode ? 'rgba(168,85,247,0.2)' : '#f3e8ff', color: '#7c3aed' }}>
                        Billable
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '13px', color: isDarkMode ? '#d1d5db' : '#374151' }}>
                    {line.account_number && `${line.account_number} - `}
                    {line.account_name || '—'}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: '14px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#374151' }}>{line.quantity}</td>
                  <td style={{ padding: '8px 12px', fontSize: '14px', textAlign: 'right', color: isDarkMode ? '#d1d5db' : '#374151' }}>{formatCurrency(line.unit_cost)}</td>
                  <td style={{ padding: '8px 12px', fontSize: '14px', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(line.line_total || (line.quantity || 0) * (line.unit_cost || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginLeft: 'auto', maxWidth: '320px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
          <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Subtotal:</span>
          <span style={{ fontWeight: 500 }}>{formatCurrency(b.subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
          <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Tax:</span>
          <span style={{ fontWeight: 500 }}>{formatCurrency(b.tax_amount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700, paddingTop: '12px', borderTop: '2px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
          <span>Total:</span>
          <span style={{ color: '#dc2626' }}>{formatCurrency(b.total_amount)}</span>
        </div>
        {(b.amount_paid || 0) > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '8px' }}>
              <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Amount Paid:</span>
              <span style={{ fontWeight: 500, color: '#16a34a' }}>{formatCurrency(b.amount_paid)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 600, marginTop: '4px' }}>
              <span>Balance Due:</span>
              <span style={{ color: (b.balance_due || 0) > 0 ? '#dc2626' : '#16a34a' }}>{formatCurrency(b.balance_due)}</span>
            </div>
          </>
        )}
      </div>

      {b.memo && (
        <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb', fontSize: '14px' }}>
          <span style={{ fontWeight: 600, color: isDarkMode ? '#93c5fd' : '#1e40af' }}>Memo:</span> {b.memo}
        </div>
      )}

      {b.status === 'void' && b.void_reason && (
        <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: '1px solid ' + (isDarkMode ? 'rgba(239,68,68,0.3)' : '#fecaca') }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>Void Information</h4>
          <p style={{ fontSize: '14px', color: '#991b1b', margin: '0 0 4px' }}>
            <strong>Date:</strong> {b.void_date ? new Date(b.void_date).toLocaleDateString() : '—'}
          </p>
          <p style={{ fontSize: '14px', color: '#991b1b', margin: 0 }}>
            <strong>Reason:</strong> {b.void_reason}
          </p>
        </div>
      )}
    </div>
  )
}

function Bills() {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const navigate = useNavigate()

  const [bills, setBills] = useState([])
  const [vendors, setVendors] = useState([])
  const [expenseAccounts, setExpenseAccounts] = useState([])
  const [customers, setCustomers] = useState([])
  const [taxRates, setTaxRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ page: 1, limit: 50 })
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 })
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedBill, setSelectedBill] = useState(null)
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchBills()
  }, [filters.page, filters.limit, filters.vendor_id, filters.status, filters.start_date, filters.end_date, filters.overdue_only, filters.search])

  async function fetchInitialData() {
    try {
      const [vendorsRes, accountsData, custRes, _taxRates] = await Promise.all([
        vendorService.getAllVendors({ is_active: true, limit: 500 }),
        accountService.getAllAccounts({ is_active: true }),
        customerService.getAllCustomers({ is_active: true, limit: 500 }),
        Promise.resolve([])
      ])
      setVendors(vendorsRes.vendors || [])
      const raw = Array.isArray(accountsData) ? accountsData : []
      const expenseCogs = raw.filter(
        (acc) => (acc.account_type === 'Expense' || acc.account_type === 'COGS') && (acc.is_active !== false)
      )
      setExpenseAccounts(expenseCogs)
      setCustomers(custRes.customers || [])
      setTaxRates(Array.isArray(_taxRates) ? _taxRates : [])
    } catch (err) {
      showAlert('error', 'Failed to fetch initial data')
    }
  }

  async function fetchBills() {
    setLoading(true)
    try {
      const result = await billService.getAllBills(filters)
      setBills(result.bills || [])
      const p = result.pagination || {}
      setPagination({
        total: p.total ?? 0,
        page: p.page ?? 1,
        total_pages: p.total_pages ?? p.totalPages ?? 1
      })
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch bills'
      showAlert('error', msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateBill(data) {
    try {
      await billService.createBill(data)
      showAlert('success', 'Bill created successfully')
      setIsCreateModalOpen(false)
      fetchBills()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create bill'
      showAlert('error', msg)
      throw err
    }
  }

  async function handleUpdateBill(data) {
    if (!selectedBill) return
    const b = selectedBill.bill || selectedBill
    try {
      await billService.updateBill(b.id, data)
      showAlert('success', 'Bill updated successfully')
      setIsEditModalOpen(false)
      setSelectedBill(null)
      fetchBills()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update bill'
      showAlert('error', msg)
      throw err
    }
  }

  async function handleDeleteBill(item) {
    const b = item.bill || item
    if (!window.confirm(`Are you sure you want to delete bill ${b.bill_number}?`)) return
    try {
      await billService.deleteBill(b.id)
      showAlert('success', 'Bill deleted successfully')
      fetchBills()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete bill'
      showAlert('error', msg)
    }
  }

  async function handleVoidBill(item) {
    const b = item.bill || item
    const reason = window.prompt(`Enter reason for voiding bill ${b.bill_number}:`)
    if (!reason || !reason.trim()) return
    try {
      await billService.voidBill(b.id, reason.trim())
      showAlert('success', 'Bill voided successfully')
      fetchBills()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to void bill'
      showAlert('error', msg)
    }
  }

  function handlePayBill(item) {
    navigate('/bill-payments', {
      state: { openPaymentForm: true, vendorId: (item.bill || item).vendor_id, billId: (item.bill || item).id }
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

  if (loading && bills.length === 0) {
    return (
      <div style={{ padding: '32px' }}>
        <LoadingSpinner size="lg" text="Loading bills..." />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: isDarkMode ? '#fff' : '#111', margin: 0 }}>Bills & Expenses</h1>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Record and manage vendor bills</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>+ New Bill</Button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <BillFilters filters={filters} vendors={vendors} onFilterChange={setFilters} onClearFilters={handleClearFilters} />

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
            Showing {bills.length} of {total} bills
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
          <BillTable
            bills={bills}
            onView={(item) => {
              setSelectedBill(item)
              setIsViewModalOpen(true)
            }}
            onEdit={(item) => {
              setSelectedBill(item)
              setIsEditModalOpen(true)
            }}
            onDelete={handleDeleteBill}
            onVoid={handleVoidBill}
            onPayBill={handlePayBill}
          />
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Bill" size="xl">
        <BillForm
          vendors={vendors}
          expenseAccounts={expenseAccounts}
          taxRates={taxRates}
          customers={customers}
          onSubmit={handleCreateBill}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedBill(null)
        }}
        title="Edit Bill"
        size="xl"
      >
        <BillForm
          bill={selectedBill}
          vendors={vendors}
          expenseAccounts={expenseAccounts}
          taxRates={taxRates}
          customers={customers}
          onSubmit={handleUpdateBill}
          onCancel={() => {
            setIsEditModalOpen(false)
            setSelectedBill(null)
          }}
        />
      </Modal>

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setSelectedBill(null)
        }}
        title="Bill Details"
        size="lg"
      >
        {selectedBill && <BillDetailView bill={selectedBill} />}
      </Modal>
    </div>
  )
}

export default Bills
