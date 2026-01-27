import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import billPaymentService from '../services/billPaymentService'
import vendorService from '../services/vendorService'
import accountService from '../services/accountService'
import BillPaymentTable from '../components/billPayments/BillPaymentTable'
import BillPaymentForm from '../components/billPayments/BillPaymentForm'
import BillPaymentFilters from '../components/billPayments/BillPaymentFilters'
import Modal from '../components/common/Modal'
import Button from '../components/common/Button'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Alert from '../components/common/Alert'

function BillPaymentDetailView({ payment }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getPaymentMethodLabel = (method) => {
    const labels = {
      check: 'Check',
      ach: 'ACH/Bank Transfer',
      wire: 'Wire Transfer',
      credit_card: 'Credit Card',
      cash: 'Cash',
      other: 'Other'
    }
    return labels[method] || method
  }

  const totalApplied = payment.applications.reduce((sum, app) => sum + (app.amount_applied || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Payment Number</p>
          <p style={{ fontSize: '18px', fontWeight: 600, color: isDarkMode ? '#fff' : '#111', margin: 0 }}>
            {payment.payment.payment_number}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Status</p>
          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '14px',
            fontWeight: 600,
            backgroundColor: payment.payment.status === 'cleared' 
              ? (isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7')
              : payment.payment.status === 'void'
              ? (isDarkMode ? '#2a2a2a' : '#e5e7eb')
              : (isDarkMode ? 'rgba(234,179,8,0.2)' : '#fef9c3'),
            color: payment.payment.status === 'cleared' 
              ? '#16a34a'
              : payment.payment.status === 'void'
              ? '#6b7280'
              : '#a16207'
          }}>
            {payment.payment.status.charAt(0).toUpperCase() + payment.payment.status.slice(1)}
          </span>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Vendor</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>
            {payment.vendor?.vendor_name || 'Unknown'}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Payment Date</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>
            {new Date(payment.payment.payment_date).toLocaleDateString()}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Payment Method</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>
            {getPaymentMethodLabel(payment.payment.payment_method)}
          </p>
        </div>
        {payment.payment.reference_number && (
          <div>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>
              {payment.payment.payment_method === 'check' ? 'Check Number' : 'Reference Number'}
            </p>
            <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>
              {payment.payment.reference_number}
            </p>
          </div>
        )}
      </div>

      <div style={{
        backgroundColor: isDarkMode ? '#2a2a2a' : '#f9fafb',
        padding: '16px',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: isDarkMode ? '#ffffff' : '#374151' }}>Payment Amount:</span>
          <span style={{ fontWeight: 600, fontSize: '18px', color: isDarkMode ? '#ffffff' : '#111827' }}>
            {formatCurrency(payment.payment.payment_amount)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '14px', color: isDarkMode ? '#ffffff' : '#374151' }}>Amount Applied:</span>
          <span style={{ fontWeight: 500, color: '#16a34a' }}>{formatCurrency(totalApplied)}</span>
        </div>
        {payment.payment.unapplied_amount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: isDarkMode ? '#ffffff' : '#374151' }}>Unapplied Amount:</span>
            <span style={{ fontWeight: 500, color: '#ea580c' }}>{formatCurrency(payment.payment.unapplied_amount)}</span>
          </div>
        )}
      </div>

      {payment.applied_bills && payment.applied_bills.length > 0 && (
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#ffffff' : '#374151', marginBottom: '12px' }}>
            Applied to Bills
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}` }}>Bill #</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}` }}>Vendor Ref</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}` }}>Bill Total</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}` }}>Balance</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}` }}>Applied</th>
                </tr>
              </thead>
              <tbody>
                {payment.applied_bills.map((app) => (
                  <tr key={app.id} style={{ borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}` }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px', color: isDarkMode ? '#ffffff' : '#111827' }}>{app.bill_number}</td>
                    <td style={{ padding: '8px 12px', fontSize: '14px', color: isDarkMode ? '#ffffff' : '#111827' }}>{app.vendor_reference || '-'}</td>
                    <td style={{ padding: '8px 12px', fontSize: '14px', color: isDarkMode ? '#ffffff' : '#111827', textAlign: 'right' }}>{formatCurrency(app.total_amount)}</td>
                    <td style={{ padding: '8px 12px', fontSize: '14px', color: '#dc2626', textAlign: 'right' }}>{formatCurrency(app.balance_due)}</td>
                    <td style={{ padding: '8px 12px', fontSize: '14px', fontWeight: 500, color: '#16a34a', textAlign: 'right' }}>
                      {formatCurrency(app.amount_applied)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payment.payment.memo && (
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#ffffff' : '#374151', marginBottom: '8px' }}>Memo</h4>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#ffffff' : '#374151', backgroundColor: isDarkMode ? '#1e3a5f' : '#dbeafe', padding: '12px', borderRadius: '6px', margin: 0 }}>
            {payment.payment.memo}
          </p>
        </div>
      )}

      {payment.payment.status === 'void' && payment.payment.void_reason && (
        <div style={{
          backgroundColor: isDarkMode ? '#4a1f1f' : '#fef2f2',
          border: `1px solid ${isDarkMode ? '#7f1d1d' : '#fecaca'}`,
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>Void Information</h4>
          <p style={{ fontSize: '14px', color: '#dc2626', margin: '4px 0' }}>
            <strong>Date:</strong> {payment.payment.void_date && new Date(payment.payment.void_date).toLocaleDateString()}
          </p>
          <p style={{ fontSize: '14px', color: '#dc2626', margin: '4px 0' }}>
            <strong>Reason:</strong> {payment.payment.void_reason}
          </p>
        </div>
      )}
    </div>
  )
}

function BillPayments() {
  const location = useLocation()
  const locationState = location.state

  const [payments, setPayments] = useState([])
  const [vendors, setVendors] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ page: 1, limit: 50 })
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    fetchInitialData()
    
    if (locationState?.openPaymentForm) {
      setIsCreateModalOpen(true)
    }
  }, [])

  useEffect(() => {
    fetchPayments()
  }, [filters])

  const fetchInitialData = async () => {
    try {
      const [vendorsData, accountsData] = await Promise.all([
        vendorService.getAllVendors({ is_active: true }),
        accountService.getAllAccounts({ is_active: true })
      ])
      
      setVendors(vendorsData.vendors || [])
      
      const bankAndCash = (accountsData || []).filter(acc => 
        acc.account_type === 'Asset' && (
          acc.sub_type?.toLowerCase().includes('cash') ||
          acc.sub_type?.toLowerCase().includes('bank') ||
          acc.account_name.toLowerCase().includes('cash') ||
          acc.account_name.toLowerCase().includes('checking') ||
          acc.account_name.toLowerCase().includes('savings')
        )
      )
      setBankAccounts(bankAndCash)
    } catch (error) {
      showAlert('error', 'Failed to fetch initial data')
    }
  }

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const result = await billPaymentService.getAllPayments(filters)
      setPayments(result.payments || [])
      setPagination(result.pagination || { total: 0, page: 1, totalPages: 1 })
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to fetch bill payments')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePayment = async (data) => {
    try {
      await billPaymentService.createPayment(data)
      showAlert('success', 'Bill payment recorded successfully')
      setIsCreateModalOpen(false)
      fetchPayments()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to create bill payment')
      throw error
    }
  }

  const handleVoidPayment = async (payment) => {
    const reason = window.prompt(`Enter reason for voiding payment ${payment.payment.payment_number}:`)
    if (!reason) return

    try {
      await billPaymentService.voidPayment(payment.payment.id, reason)
      showAlert('success', 'Bill payment voided successfully')
      fetchPayments()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to void payment')
    }
  }

  const handleDeletePayment = async (payment) => {
    if (!window.confirm(`Are you sure you want to delete payment ${payment.payment.payment_number}?`)) {
      return
    }

    try {
      await billPaymentService.deletePayment(payment.payment.id)
      showAlert('success', 'Bill payment deleted successfully')
      fetchPayments()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to delete payment')
    }
  }

  const handlePrintCheck = async (payment) => {
    try {
      const checkData = await billPaymentService.getCheckData(payment.payment.id)
      console.log('Check data:', checkData)
      showAlert('error', 'Check printing not yet implemented')
    } catch (error) {
      showAlert('error', 'Failed to get check data')
    }
  }

  const showAlert = (type, message) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleClearFilters = () => {
    setFilters({ page: 1, limit: 50 })
  }

  const handlePageChange = (newPage) => {
    setFilters({ ...filters, page: newPage })
  }

  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  if (loading && payments.length === 0) {
    return <LoadingSpinner size="lg" text="Loading bill payments..." />
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: 700, color: isDarkMode ? '#ffffff' : '#111827', margin: 0 }}>
            Bill Payments
          </h1>
          <p style={{ fontSize: '16px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>
            Record and manage vendor bill payments
          </p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>+ Pay Bills</Button>
      </div>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <BillPaymentFilters
        filters={filters}
        vendors={vendors}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
      />

      <div style={{
        backgroundColor: isDarkMode ? '#1f1f1f' : 'white',
        borderRadius: '8px',
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', margin: 0 }}>
            Showing {payments.length} of {pagination.total} bill payments
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
            <span style={{ padding: '4px 12px', fontSize: '14px', color: isDarkMode ? '#ffffff' : '#111827' }}>
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
        
        <BillPaymentTable
          payments={payments}
          onView={(payment) => {
            setSelectedPayment(payment)
            setIsViewModalOpen(true)
          }}
          onVoid={handleVoidPayment}
          onDelete={handleDeletePayment}
          onPrintCheck={handlePrintCheck}
        />
      </div>

      {/* Create Payment Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Pay Bills"
        size="xl"
      >
        <BillPaymentForm
          vendors={vendors}
          bankAccounts={bankAccounts}
          onSubmit={handleCreatePayment}
          onCancel={() => setIsCreateModalOpen(false)}
          preselectedVendorId={locationState?.vendorId}
          preselectedBillId={locationState?.billId}
        />
      </Modal>

      {/* View Payment Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setSelectedPayment(null)
        }}
        title="Bill Payment Details"
        size="lg"
      >
        {selectedPayment && (
          <BillPaymentDetailView payment={selectedPayment} />
        )}
      </Modal>
    </div>
  )
}

export default BillPayments
