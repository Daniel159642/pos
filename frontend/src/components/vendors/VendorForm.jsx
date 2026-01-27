import React, { useState, useEffect } from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

const PAYMENT_TERMS_OPTIONS = [
  { value: 'Due on receipt', label: 'Due on receipt' },
  { value: 'Net 15', label: 'Net 15' },
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 45', label: 'Net 45' },
  { value: 'Net 60', label: 'Net 60' },
  { value: 'Net 90', label: 'Net 90' }
]

const PAYMENT_TERMS_DAYS = {
  'Due on receipt': 0,
  'Net 15': 15,
  'Net 30': 30,
  'Net 45': 45,
  'Net 60': 60,
  'Net 90': 90
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'check', label: 'Check' },
  { value: 'ach', label: 'ACH/Bank Transfer' },
  { value: 'wire', label: 'Wire Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' }
]

const defaultForm = {
  vendor_name: '',
  contact_name: '',
  email: '',
  phone: '',
  website: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'US',
  payment_terms: 'Net 30',
  payment_terms_days: 30,
  account_number: '',
  tax_id: '',
  is_1099_vendor: false,
  payment_method: 'check',
  notes: ''
}

function VendorForm({ vendor, onSubmit, onCancel }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const [formData, setFormData] = useState({ ...defaultForm })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (vendor) {
      setFormData({
        vendor_name: vendor.vendor_name || '',
        contact_name: vendor.contact_name || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        website: vendor.website || '',
        address_line1: vendor.address_line1 || '',
        address_line2: vendor.address_line2 || '',
        city: vendor.city || '',
        state: vendor.state || '',
        postal_code: vendor.postal_code || '',
        country: vendor.country || 'US',
        payment_terms: vendor.payment_terms || 'Net 30',
        payment_terms_days: vendor.payment_terms_days ?? 30,
        account_number: vendor.account_number || '',
        tax_id: vendor.tax_id || '',
        is_1099_vendor: !!vendor.is_1099_vendor,
        payment_method: vendor.payment_method || 'check',
        notes: vendor.notes || ''
      })
    } else {
      setFormData({ ...defaultForm })
    }
  }, [vendor])

  const handleChange = (e) => {
    const { name, value, type } = e.target
    const checked = e.target.checked
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : name === 'payment_terms_days' ? (parseInt(value, 10) || 0) : value
    }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handlePaymentTermsChange = (e) => {
    const terms = e.target.value
    const days = PAYMENT_TERMS_DAYS[terms] ?? 30
    setFormData((prev) => ({ ...prev, payment_terms: terms, payment_terms_days: days }))
  }

  const validate = () => {
    const next = {}
    if (!(formData.vendor_name || '').trim()) next.vendor_name = 'Vendor name is required'
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) next.email = 'Invalid email format'
    if (formData.is_1099_vendor && formData.tax_id) {
      if (!/^\d{2}-\d{7}$|^\d{3}-\d{2}-\d{4}$/.test(formData.tax_id)) {
        next.tax_id = 'Tax ID must be XX-XXXXXXX (EIN) or XXX-XX-XXXX (SSN)'
      }
    }
    if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
      next.website = 'Website must start with http:// or https://'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await onSubmit(formData)
    } catch (err) {
      console.error('Vendor form submit error:', err)
    } finally {
      setLoading(false)
    }
  }

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
        <h3 style={sectionTitle}>Vendor Information</h3>
        <div style={grid2}>
          <Input label="Vendor Name" name="vendor_name" value={formData.vendor_name} onChange={handleChange} placeholder="ABC Supply Company" required error={errors.vendor_name} style={{ marginBottom: 0 }} />
          <Input label="Contact Person" name="contact_name" value={formData.contact_name} onChange={handleChange} placeholder="John Smith" style={{ marginBottom: 0 }} />
          <Input label="Email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="vendor@example.com" error={errors.email} style={{ marginBottom: 0 }} />
          <Input label="Phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="555-0100" style={{ marginBottom: 0 }} />
          <div style={{ gridColumn: '1 / -1' }}>
            <Input label="Website" name="website" type="url" value={formData.website} onChange={handleChange} placeholder="https://example.com" error={errors.website} style={{ marginBottom: 0 }} />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Address</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Address Line 1" name="address_line1" value={formData.address_line1} onChange={handleChange} placeholder="123 Main St" style={{ marginBottom: 0 }} />
          <Input label="Address Line 2" name="address_line2" value={formData.address_line2} onChange={handleChange} placeholder="Suite 100" style={{ marginBottom: 0 }} />
          <div style={grid2}>
            <Input label="City" name="city" value={formData.city} onChange={handleChange} placeholder="New York" style={{ marginBottom: 0 }} />
            <Input label="State/Province" name="state" value={formData.state} onChange={handleChange} placeholder="NY" style={{ marginBottom: 0 }} />
            <Input label="Postal Code" name="postal_code" value={formData.postal_code} onChange={handleChange} placeholder="10001" style={{ marginBottom: 0 }} />
            <Input label="Country" name="country" value={formData.country} onChange={handleChange} placeholder="US" style={{ marginBottom: 0 }} />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Payment Information</h3>
        <div style={grid2}>
          <Select label="Payment Terms" name="payment_terms" value={formData.payment_terms} onChange={handlePaymentTermsChange} options={PAYMENT_TERMS_OPTIONS} style={{ marginBottom: 0 }} />
          <Select label="Preferred Payment Method" name="payment_method" value={formData.payment_method} onChange={handleChange} options={PAYMENT_METHOD_OPTIONS} style={{ marginBottom: 0 }} />
          <div style={{ gridColumn: '1 / -1' }}>
            <Input label="Our Account Number" name="account_number" value={formData.account_number} onChange={handleChange} placeholder="Account # with this vendor" style={{ marginBottom: 0 }} />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Tax Information</h3>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#e5e7eb' : '#374151' }}>
            <input type="checkbox" name="is_1099_vendor" checked={formData.is_1099_vendor} onChange={handleChange} style={{ width: '16px', height: '16px' }} />
            <span>1099 Vendor (requires year-end reporting)</span>
          </label>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px', marginLeft: '24px' }}>Check if you'll need to file a 1099 form for this vendor</p>
        </div>
        {formData.is_1099_vendor && (
          <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: isDarkMode ? 'rgba(234,179,8,0.1)' : '#fef9c3', border: '1px solid ' + (isDarkMode ? 'rgba(234,179,8,0.3)' : '#fde047') }}>
            <Input label="Tax ID (EIN or SSN)" name="tax_id" value={formData.tax_id} onChange={handleChange} placeholder="XX-XXXXXXX or XXX-XX-XXXX" error={errors.tax_id} style={{ marginBottom: 0 }} />
            <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '8px', marginBottom: 0 }}>Format: XX-XXXXXXX (EIN) or XXX-XX-XXXX (SSN)</p>
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Additional Information</h3>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#d1d5db' : '#374151', marginBottom: '6px' }}>Internal Notes</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={4}
          placeholder="Internal notes about this vendor..."
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Saving...' : vendor ? 'Update Vendor' : 'Create Vendor'}</Button>
      </div>
    </form>
  )
}

export default VendorForm
