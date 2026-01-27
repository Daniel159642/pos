import React, { useState, useEffect } from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

const PAYMENT_TERMS_OPTIONS = [
  { value: 'Due on receipt', label: 'Due on receipt' },
  { value: 'Net 15', label: 'Net 15' },
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 45', label: 'Net 45' },
  { value: 'Net 60', label: 'Net 60' }
]

const PAYMENT_TERMS_DAYS = {
  'Due on receipt': 0,
  'Net 15': 15,
  'Net 30': 30,
  'Net 45': 45,
  'Net 60': 60
}

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'business', label: 'Business' }
]

const defaultForm = {
  customer_type: 'individual',
  company_name: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  mobile: '',
  website: '',
  billing_address_line1: '',
  billing_address_line2: '',
  billing_city: '',
  billing_state: '',
  billing_postal_code: '',
  billing_country: 'US',
  shipping_address_line1: '',
  shipping_address_line2: '',
  shipping_city: '',
  shipping_state: '',
  shipping_postal_code: '',
  shipping_country: 'US',
  payment_terms: 'Net 30',
  payment_terms_days: 30,
  credit_limit: 0,
  tax_exempt: false,
  tax_exempt_id: '',
  notes: ''
}

function CustomerForm({ customer, onSubmit, onCancel }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const [formData, setFormData] = useState({ ...defaultForm })
  const [copyBillingToShipping, setCopyBillingToShipping] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (customer) {
      setFormData({
        customer_type: customer.customer_type || 'individual',
        company_name: customer.company_name || '',
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        mobile: customer.mobile || '',
        website: customer.website || '',
        billing_address_line1: customer.billing_address_line1 || '',
        billing_address_line2: customer.billing_address_line2 || '',
        billing_city: customer.billing_city || '',
        billing_state: customer.billing_state || '',
        billing_postal_code: customer.billing_postal_code || '',
        billing_country: customer.billing_country || 'US',
        shipping_address_line1: customer.shipping_address_line1 || '',
        shipping_address_line2: customer.shipping_address_line2 || '',
        shipping_city: customer.shipping_city || '',
        shipping_state: customer.shipping_state || '',
        shipping_postal_code: customer.shipping_postal_code || '',
        shipping_country: customer.shipping_country || 'US',
        payment_terms: customer.payment_terms || 'Net 30',
        payment_terms_days: customer.payment_terms_days ?? 30,
        credit_limit: customer.credit_limit ?? 0,
        tax_exempt: !!customer.tax_exempt,
        tax_exempt_id: customer.tax_exempt_id || '',
        notes: customer.notes || ''
      })
    } else {
      setFormData({ ...defaultForm })
    }
  }, [customer])

  const handleChange = (e) => {
    const { name, value, type } = e.target
    const checked = e.target.checked

    setFormData((prev) => {
      const next = { ...prev }
      if (type === 'checkbox') {
        next[name] = checked
      } else if (name === 'payment_terms_days' || name === 'credit_limit') {
        next[name] = value === '' ? 0 : parseFloat(value) || 0
      } else {
        next[name] = value
      }
      return next
    })
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleCopyBillingToShipping = () => {
    if (!copyBillingToShipping) {
      setFormData((prev) => ({
        ...prev,
        shipping_address_line1: prev.billing_address_line1,
        shipping_address_line2: prev.billing_address_line2,
        shipping_city: prev.billing_city,
        shipping_state: prev.billing_state,
        shipping_postal_code: prev.billing_postal_code,
        shipping_country: prev.billing_country
      }))
    }
    setCopyBillingToShipping(!copyBillingToShipping)
  }

  const handlePaymentTermsChange = (e) => {
    const terms = e.target.value
    setFormData((prev) => ({
      ...prev,
      payment_terms: terms,
      payment_terms_days: PAYMENT_TERMS_DAYS[terms] ?? 30
    }))
  }

  const validate = () => {
    const newErrors = {}
    if (formData.customer_type === 'business' && !String(formData.company_name || '').trim()) {
      newErrors.company_name = 'Company name is required for business customers'
    }
    if (formData.customer_type === 'individual') {
      if (!String(formData.first_name || '').trim()) newErrors.first_name = 'First name is required for individual customers'
      if (!String(formData.last_name || '').trim()) newErrors.last_name = 'Last name is required for individual customers'
    }
    const email = String(formData.email || '').trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        customer_type: formData.customer_type,
        company_name: formData.company_name || undefined,
        first_name: formData.first_name || undefined,
        last_name: formData.last_name || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        mobile: formData.mobile || undefined,
        website: formData.website || undefined,
        billing_address_line1: formData.billing_address_line1 || undefined,
        billing_address_line2: formData.billing_address_line2 || undefined,
        billing_city: formData.billing_city || undefined,
        billing_state: formData.billing_state || undefined,
        billing_postal_code: formData.billing_postal_code || undefined,
        billing_country: formData.billing_country || undefined,
        shipping_address_line1: formData.shipping_address_line1 || undefined,
        shipping_address_line2: formData.shipping_address_line2 || undefined,
        shipping_city: formData.shipping_city || undefined,
        shipping_state: formData.shipping_state || undefined,
        shipping_postal_code: formData.shipping_postal_code || undefined,
        shipping_country: formData.shipping_country || undefined,
        payment_terms: formData.payment_terms || undefined,
        payment_terms_days: formData.payment_terms_days ?? 30,
        credit_limit: formData.credit_limit ?? 0,
        tax_exempt: !!formData.tax_exempt,
        tax_exempt_id: formData.tax_exempt_id || undefined,
        notes: formData.notes || undefined
      }
      await onSubmit(payload)
    } catch (err) {
      console.error('Form submission error:', err)
    } finally {
      setLoading(false)
    }
  }

  const sectionStyle = {
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb',
    border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
    marginBottom: '16px'
  }
  const sectionTitle = { fontSize: '16px', fontWeight: 600, color: isDarkMode ? '#fff' : '#111', marginBottom: '16px' }
  const grid2 = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }
  const grid3 = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      <div style={sectionStyle}>
        <Select
          label="Customer Type"
          name="customer_type"
          value={formData.customer_type}
          onChange={handleChange}
          options={CUSTOMER_TYPE_OPTIONS}
          required
        />
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Basic Information</h3>
        {formData.customer_type === 'business' ? (
          <Input
            label="Company Name"
            name="company_name"
            value={formData.company_name}
            onChange={handleChange}
            placeholder="ABC Corporation"
            required
            error={errors.company_name}
          />
        ) : (
          <div style={grid2}>
            <Input label="First Name" name="first_name" value={formData.first_name} onChange={handleChange} placeholder="John" required error={errors.first_name} />
            <Input label="Last Name" name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Smith" required error={errors.last_name} />
          </div>
        )}
        <div style={grid2}>
          <Input label="Email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="customer@example.com" error={errors.email} />
          <Input label="Phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="555-0001" />
        </div>
        <div style={grid2}>
          <Input label="Mobile" name="mobile" type="tel" value={formData.mobile} onChange={handleChange} placeholder="555-0002" />
          <Input label="Website" name="website" type="url" value={formData.website} onChange={handleChange} placeholder="https://example.com" />
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Billing Address</h3>
        <Input label="Address Line 1" name="billing_address_line1" value={formData.billing_address_line1} onChange={handleChange} placeholder="123 Main St" />
        <Input label="Address Line 2" name="billing_address_line2" value={formData.billing_address_line2} onChange={handleChange} placeholder="Suite 100" />
        <div style={grid3}>
          <Input label="City" name="billing_city" value={formData.billing_city} onChange={handleChange} placeholder="New York" />
          <Input label="State/Province" name="billing_state" value={formData.billing_state} onChange={handleChange} placeholder="NY" />
          <Input label="Postal Code" name="billing_postal_code" value={formData.billing_postal_code} onChange={handleChange} placeholder="10001" />
        </div>
        <Input label="Country" name="billing_country" value={formData.billing_country} onChange={handleChange} placeholder="US" />
      </div>

      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Shipping Address</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', color: isDarkMode ? '#d1d5db' : '#374151' }}>
            <input type="checkbox" checked={copyBillingToShipping} onChange={handleCopyBillingToShipping} style={{ width: '16px', height: '16px' }} />
            Same as billing
          </label>
        </div>
        <Input label="Address Line 1" name="shipping_address_line1" value={formData.shipping_address_line1} onChange={handleChange} placeholder="123 Main St" disabled={copyBillingToShipping} />
        <Input label="Address Line 2" name="shipping_address_line2" value={formData.shipping_address_line2} onChange={handleChange} placeholder="Suite 100" disabled={copyBillingToShipping} />
        <div style={grid3}>
          <Input label="City" name="shipping_city" value={formData.shipping_city} onChange={handleChange} placeholder="New York" disabled={copyBillingToShipping} />
          <Input label="State/Province" name="shipping_state" value={formData.shipping_state} onChange={handleChange} placeholder="NY" disabled={copyBillingToShipping} />
          <Input label="Postal Code" name="shipping_postal_code" value={formData.shipping_postal_code} onChange={handleChange} placeholder="10001" disabled={copyBillingToShipping} />
        </div>
        <Input label="Country" name="shipping_country" value={formData.shipping_country} onChange={handleChange} placeholder="US" disabled={copyBillingToShipping} />
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Payment & Tax Information</h3>
        <div style={grid2}>
          <Select label="Payment Terms" name="payment_terms" value={formData.payment_terms || 'Net 30'} onChange={handlePaymentTermsChange} options={PAYMENT_TERMS_OPTIONS} />
          <Input label="Credit Limit" name="credit_limit" type="number" step="0.01" value={formData.credit_limit ?? 0} onChange={handleChange} placeholder="0.00" />
        </div>
        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#d1d5db' : '#374151', cursor: 'pointer' }}>
            <input type="checkbox" name="tax_exempt" checked={!!formData.tax_exempt} onChange={handleChange} style={{ width: '16px', height: '16px' }} />
            Tax Exempt
          </label>
        </div>
        {formData.tax_exempt && (
          <div style={{ marginTop: '16px' }}>
            <Input label="Tax Exemption ID" name="tax_exempt_id" value={formData.tax_exempt_id} onChange={handleChange} placeholder="Tax exemption certificate number" />
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Additional Information</h3>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#d1d5db' : '#374151', marginBottom: '8px' }}>Internal Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            placeholder="Internal notes about this customer..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: `1px solid ${isDarkMode ? '#3a3a3a' : '#d1d5db'}`,
              borderRadius: '6px',
              backgroundColor: isDarkMode ? '#1f1f1f' : 'white',
              color: isDarkMode ? '#fff' : '#1a1a1a',
              fontSize: '14px',
              outline: 'none',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px' }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Saving...' : customer ? 'Update Customer' : 'Create Customer'}
        </Button>
      </div>
    </form>
  )
}

export default CustomerForm
