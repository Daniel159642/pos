import React, { useState, useEffect } from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import InvoiceApplicationSelector from './InvoiceApplicationSelector'
import paymentService from '../../services/paymentService'

function PaymentForm({ customers = [], bankAccounts = [], onSubmit, onCancel, preselectedCustomerId, preselectedInvoiceId }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const today = new Date().toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    customer_id: preselectedCustomerId || 0,
    payment_date: today,
    payment_method: 'check',
    reference_number: '',
    payment_amount: 0,
    deposit_to_account_id: 0,
    memo: ''
  })
  const [outstandingInvoices, setOutstandingInvoices] = useState([])
  const [applications, setApplications] = useState([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (formData.customer_id) {
      setApplications([])
      setLoadingInvoices(true)
      paymentService
        .getCustomerOutstandingInvoices(formData.customer_id)
        .then((invoices) => setOutstandingInvoices(invoices || []))
        .catch((err) => {
          console.error('Failed to fetch outstanding invoices:', err)
          setOutstandingInvoices([])
        })
        .finally(() => setLoadingInvoices(false))
    } else {
      setOutstandingInvoices([])
      setApplications([])
    }
  }, [formData.customer_id])

  useEffect(() => {
    if (!preselectedInvoiceId || !outstandingInvoices.length) return
    const inv = outstandingInvoices.find((i) => i.id === preselectedInvoiceId)
    if (!inv) return
    const balanceDue = Number(inv.balance_due) || 0
    setApplications([{ invoice_id: inv.id, amount_applied: balanceDue }])
    setFormData((prev) => ({ ...prev, payment_amount: balanceDue }))
  }, [preselectedInvoiceId, outstandingInvoices])

  const handleChange = (e) => {
    const { name, value } = e.target
    let v = value
    if (name === 'customer_id' || name === 'deposit_to_account_id') v = value ? parseInt(value, 10) : 0
    else if (name === 'payment_amount') v = parseFloat(value) || 0
    setFormData((prev) => ({ ...prev, [name]: v }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleQuickFill = () => {
    const total = applications.reduce((sum, app) => sum + (app.amount_applied || 0), 0)
    setFormData((prev) => ({ ...prev, payment_amount: total }))
  }

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const validate = () => {
    const next = {}
    if (!formData.customer_id) next.customer_id = 'Customer is required'
    if (!formData.payment_date) next.payment_date = 'Payment date is required'
    if ((formData.payment_amount || 0) <= 0) next.payment_amount = 'Payment amount must be greater than 0'
    if (!formData.deposit_to_account_id) next.deposit_to_account_id = 'Deposit account is required'
    if (!applications.length) next.applications = 'Payment must be applied to at least one invoice'
    const totalApplied = applications.reduce((sum, app) => sum + (app.amount_applied || 0), 0)
    if (totalApplied > (formData.payment_amount || 0)) next.applications = 'Total applied cannot exceed payment amount'
    applications.forEach((app) => {
      const inv = outstandingInvoices.find((i) => i.id === app.invoice_id)
      if (inv && (app.amount_applied || 0) > (Number(inv.balance_due) || 0))
        next[`app_${app.invoice_id}`] = `Amount exceeds invoice balance of ${formatCurrency(inv.balance_due)}`
    })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await onSubmit({
        ...formData,
        applications: applications.map((a) => ({ invoice_id: a.invoice_id, amount_applied: a.amount_applied || 0 }))
      })
    } catch (err) {
      console.error('Payment form submit error:', err)
    } finally {
      setLoading(false)
    }
  }

  const customerOptions = (customers || [])
    .filter((c) => c.is_active !== false)
    .map((c) => ({
      value: c.id,
      label: `${c.customer_number || ''} - ${c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer'}`
    }))

  const paymentMethodOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'check', label: 'Check' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'debit_card', label: 'Debit Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'ach', label: 'ACH' },
    { value: 'other', label: 'Other' }
  ]

  const bankAccountOptions = (bankAccounts || []).map((acc) => ({
    value: acc.id,
    label: `${acc.account_number ? acc.account_number + ' - ' : ''}${acc.account_name}`
  }))

  const selectedCustomer = customers.find((c) => c.id === formData.customer_id)
  const sectionStyle = {
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb',
    border: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb'),
    marginBottom: '16px'
  }
  const sectionTitle = { fontSize: '16px', fontWeight: 600, color: isDarkMode ? '#fff' : '#111', marginBottom: '16px' }
  const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Payment Details</h3>
        <div style={grid2}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Select
              label="Customer"
              name="customer_id"
              value={formData.customer_id || ''}
              onChange={handleChange}
              options={customerOptions}
              placeholder="Select customer"
              required
              error={errors.customer_id}
              style={{ marginBottom: 0 }}
            />
            {selectedCustomer && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : '#eff6ff',
                  fontSize: '14px'
                }}
              >
                <p style={{ fontWeight: 500, margin: '0 0 4px', color: isDarkMode ? '#93c5fd' : '#1e40af' }}>
                  {selectedCustomer.display_name || selectedCustomer.company_name || [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ')}
                </p>
                <p style={{ margin: 0, color: isDarkMode ? '#9ca3af' : '#4b5563' }}>
                  Current Balance:{' '}
                  <span style={{ fontWeight: 600, color: (selectedCustomer.account_balance || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatCurrency(selectedCustomer.account_balance)}
                  </span>
                </p>
              </div>
            )}
          </div>
          <Input label="Payment Date" name="payment_date" type="date" value={formData.payment_date} onChange={handleChange} required error={errors.payment_date} style={{ marginBottom: 0 }} />
          <Input
            label="Payment Amount"
            name="payment_amount"
            type="number"
            step="0.01"
            min="0"
            value={formData.payment_amount || ''}
            onChange={handleChange}
            placeholder="0.00"
            required
            error={errors.payment_amount}
            style={{ marginBottom: 0, textAlign: 'right' }}
          />
          <Select
            label="Payment Method"
            name="payment_method"
            value={formData.payment_method}
            onChange={handleChange}
            options={paymentMethodOptions}
            required
            style={{ marginBottom: 0 }}
          />
          <Input
            label={formData.payment_method === 'check' ? 'Check Number' : 'Reference Number'}
            name="reference_number"
            value={formData.reference_number}
            onChange={handleChange}
            placeholder={formData.payment_method === 'check' ? 'Check #' : 'Transaction ID, confirmation #, etc.'}
            style={{ marginBottom: 0 }}
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <Select
              label="Deposit To Account"
              name="deposit_to_account_id"
              value={formData.deposit_to_account_id || ''}
              onChange={handleChange}
              options={bankAccountOptions}
              placeholder="Select bank/cash account"
              required
              error={errors.deposit_to_account_id}
              style={{ marginBottom: 0 }}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#d1d5db' : '#374151', marginBottom: '6px' }}>Memo</label>
            <textarea
              name="memo"
              value={formData.memo}
              onChange={handleChange}
              rows={2}
              placeholder="Payment memo..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#d1d5db'),
                borderRadius: '6px',
                backgroundColor: isDarkMode ? '#1f1f1f' : 'white',
                color: isDarkMode ? '#fff' : '#1a1a1a',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>
        </div>
      </div>

      {formData.customer_id > 0 && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Apply to Invoices</h3>
            {applications.length > 0 && (
              <Button type="button" size="sm" variant="secondary" onClick={handleQuickFill}>
                Auto-fill Amount
              </Button>
            )}
          </div>
          {loadingInvoices ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Loading outstanding invoices...</div>
          ) : (
            <InvoiceApplicationSelector
              outstandingInvoices={outstandingInvoices}
              paymentAmount={formData.payment_amount}
              applications={applications}
              onChange={setApplications}
            />
          )}
          {errors.applications && <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '14px', color: '#dc2626' }}>{errors.applications}</p>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={loading || applications.length === 0 || (formData.payment_amount || 0) <= 0}
        >
          {loading ? 'Recording...' : 'Record Payment'}
        </Button>
      </div>
    </form>
  )
}

export default PaymentForm
