import React, { useState, useEffect } from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import BillApplicationSelector from './BillApplicationSelector'
import billPaymentService from '../../services/billPaymentService'

function BillPaymentForm({
  vendors = [],
  bankAccounts = [],
  onSubmit,
  onCancel,
  preselectedVendorId,
  preselectedBillId
}) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const today = new Date().toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    vendor_id: preselectedVendorId || 0,
    payment_date: today,
    payment_method: 'check',
    reference_number: '',
    payment_amount: 0,
    paid_from_account_id: 0,
    memo: ''
  })

  const [outstandingBills, setOutstandingBills] = useState([])
  const [applications, setApplications] = useState([])
  const [loadingBills, setLoadingBills] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (formData.vendor_id) {
      fetchOutstandingBills()
    } else {
      setOutstandingBills([])
      setApplications([])
    }
  }, [formData.vendor_id])

  useEffect(() => {
    // Auto-select preselected bill
    if (preselectedBillId && outstandingBills.length > 0) {
      const bill = outstandingBills.find(b => b.id === preselectedBillId)
      if (bill) {
        setApplications([{
          bill_id: bill.id,
          amount_applied: bill.balance_due
        }])
        setFormData(prev => ({
          ...prev,
          payment_amount: bill.balance_due
        }))
      }
    }
  }, [preselectedBillId, outstandingBills])

  const fetchOutstandingBills = async () => {
    setLoadingBills(true)
    try {
      const bills = await billPaymentService.getVendorOutstandingBills(formData.vendor_id)
      setOutstandingBills(bills)
    } catch (error) {
      console.error('Failed to fetch outstanding bills:', error)
    } finally {
      setLoadingBills(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    let v = value
    if (name === 'vendor_id' || name === 'paid_from_account_id') {
      v = value ? parseInt(value, 10) : 0
    } else if (name === 'payment_amount') {
      v = parseFloat(value) || 0
    }
    setFormData(prev => ({ ...prev, [name]: v }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleQuickFill = () => {
    const total = applications.reduce((sum, app) => sum + (app.amount_applied || 0), 0)
    setFormData(prev => ({ ...prev, payment_amount: total }))
  }

  const formatCurrency = (amount) => {
    return `$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.vendor_id) {
      newErrors.vendor_id = 'Vendor is required'
    }

    if (!formData.payment_date) {
      newErrors.payment_date = 'Payment date is required'
    }

    if (formData.payment_amount <= 0) {
      newErrors.payment_amount = 'Payment amount must be greater than 0'
    }

    if (!formData.paid_from_account_id) {
      newErrors.paid_from_account_id = 'Paid from account is required'
    }

    if (applications.length === 0) {
      newErrors.applications = 'Payment must be applied to at least one bill'
    }

    const totalApplied = applications.reduce((sum, app) => sum + (app.amount_applied || 0), 0)
    if (totalApplied > formData.payment_amount) {
      newErrors.applications = 'Total applied cannot exceed payment amount'
    }

    for (const app of applications) {
      const bill = outstandingBills.find(b => b.id === app.bill_id)
      if (bill && app.amount_applied > bill.balance_due) {
        newErrors[`app_${app.bill_id}`] = `Amount exceeds bill balance of ${formatCurrency(bill.balance_due)}`
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)
    try {
      await onSubmit({
        ...formData,
        applications
      })
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setLoading(false)
    }
  }

  const vendorOptions = vendors
    .filter(v => v.is_active)
    .map((v) => ({
      value: v.id,
      label: `${v.vendor_number || ''} - ${v.vendor_name}`
    }))

  const paymentMethodOptions = [
    { value: 'check', label: 'Check' },
    { value: 'ach', label: 'ACH/Bank Transfer' },
    { value: 'wire', label: 'Wire Transfer' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'cash', label: 'Cash' },
    { value: 'other', label: 'Other' }
  ]

  const bankAccountOptions = bankAccounts.map((acc) => ({
    value: acc.id,
    label: `${acc.account_number ? acc.account_number + ' - ' : ''}${acc.account_name}`
  }))

  const selectedVendor = vendors.find(v => v.id === formData.vendor_id)

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Payment Header */}
      <div style={{
        backgroundColor: isDarkMode ? '#1f1f1f' : 'white',
        padding: '16px',
        borderRadius: '8px',
        border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: isDarkMode ? '#ffffff' : '#111827',
          marginBottom: '16px'
        }}>
          Payment Details
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Select
              label="Vendor"
              name="vendor_id"
              value={formData.vendor_id || ''}
              onChange={handleChange}
              options={vendorOptions}
              placeholder="Select vendor"
              required
              error={errors.vendor_id}
            />
            {selectedVendor && (
              <div style={{
                marginTop: '8px',
                padding: '12px',
                backgroundColor: isDarkMode ? '#1e3a5f' : '#dbeafe',
                borderRadius: '6px',
                fontSize: '14px'
              }}>
                <p style={{ fontWeight: 500, color: isDarkMode ? '#ffffff' : '#111827', margin: 0 }}>
                  {selectedVendor.vendor_name}
                </p>
                <p style={{ color: isDarkMode ? '#d1d5db' : '#6b7280', margin: '4px 0 0 0' }}>
                  Current Balance Owed: <span style={{
                    color: selectedVendor.account_balance > 0 ? '#dc2626' : '#16a34a',
                    fontWeight: 600
                  }}>
                    {formatCurrency(selectedVendor.account_balance || 0)}
                  </span>
                </p>
              </div>
            )}
          </div>

          <Input
            label="Payment Date"
            name="payment_date"
            type="date"
            value={formData.payment_date}
            onChange={handleChange}
            required
            error={errors.payment_date}
          />

          <Input
            label="Payment Amount"
            name="payment_amount"
            type="number"
            step="0.01"
            value={formData.payment_amount || ''}
            onChange={handleChange}
            placeholder="0.00"
            style={{ textAlign: 'right' }}
            required
            error={errors.payment_amount}
          />

          <Select
            label="Payment Method"
            name="payment_method"
            value={formData.payment_method}
            onChange={handleChange}
            options={paymentMethodOptions}
            required
          />

          <Input
            label={formData.payment_method === 'check' ? 'Check Number' : 'Reference Number'}
            name="reference_number"
            value={formData.reference_number}
            onChange={handleChange}
            placeholder={formData.payment_method === 'check' ? 'Check #' : 'Transaction ID, confirmation #, etc.'}
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Select
              label="Pay From Account"
              name="paid_from_account_id"
              value={formData.paid_from_account_id || ''}
              onChange={handleChange}
              options={bankAccountOptions}
              placeholder="Select bank/cash account"
              required
              error={errors.paid_from_account_id}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 500,
              color: isDarkMode ? '#ffffff' : '#374151',
              marginBottom: '4px'
            }}>
              Memo
            </label>
            <textarea
              name="memo"
              value={formData.memo}
              onChange={handleChange}
              rows={2}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: `1px solid ${isDarkMode ? '#3a3a3a' : '#d1d5db'}`,
                borderRadius: '6px',
                backgroundColor: isDarkMode ? '#1f1f1f' : 'white',
                color: isDarkMode ? '#ffffff' : '#1a1a1a',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical'
              }}
              placeholder="Payment memo..."
            />
          </div>
        </div>
      </div>

      {/* Bill Applications */}
      {formData.vendor_id > 0 && (
        <div style={{
          backgroundColor: isDarkMode ? '#1f1f1f' : 'white',
          padding: '16px',
          borderRadius: '8px',
          border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: isDarkMode ? '#ffffff' : '#111827'
            }}>
              Apply to Bills
            </h3>
            {applications.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleQuickFill}
              >
                Auto-fill Amount
              </Button>
            )}
          </div>

          {loadingBills ? (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <p style={{ color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Loading outstanding bills...</p>
            </div>
          ) : (
            <BillApplicationSelector
              outstandingBills={outstandingBills}
              paymentAmount={formData.payment_amount}
              applications={applications}
              onChange={setApplications}
            />
          )}

          {errors.applications && (
            <p style={{ marginTop: '8px', fontSize: '14px', color: '#dc2626' }}>
              {errors.applications}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <Button 
          type="button" 
          variant="secondary" 
          onClick={onCancel} 
          disabled={loading}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="primary" 
          disabled={loading || applications.length === 0 || formData.payment_amount <= 0}
        >
          {loading ? 'Recording...' : 'Record Payment'}
        </Button>
      </div>
    </form>
  )
}

export default BillPaymentForm
