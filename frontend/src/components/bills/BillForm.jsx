import React, { useState, useEffect } from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import BillLineInput from './BillLineInput'

function BillForm({
  bill,
  vendors = [],
  expenseAccounts = [],
  taxRates = [],
  customers = [],
  onSubmit,
  onCancel
}) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const today = new Date().toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    vendor_id: 0,
    bill_date: today,
    due_date: '',
    terms: 'Net 30',
    vendor_reference: '',
    memo: ''
  })
  const [lines, setLines] = useState([
    { description: '', quantity: 1, unit_cost: 0, account_id: null, tax_rate_id: undefined, billable: false, customer_id: undefined }
  ])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (bill && bill.bill) {
      const b = bill.bill
      setFormData({
        vendor_id: b.vendor_id || 0,
        bill_date: (b.bill_date || '').split('T')[0] || today,
        due_date: (b.due_date || '').split('T')[0] || '',
        terms: b.terms || 'Net 30',
        vendor_reference: b.vendor_reference || '',
        memo: b.memo || ''
      })
      const ln = (bill.lines || []).map((l) => ({
        description: l.description || '',
        quantity: l.quantity ?? 1,
        unit_cost: l.unit_cost ?? 0,
        account_id: l.account_id ?? null,
        tax_rate_id: l.tax_rate_id,
        billable: !!l.billable,
        customer_id: l.customer_id
      }))
      setLines(
        ln.length
          ? ln
          : [{ description: '', quantity: 1, unit_cost: 0, account_id: null, tax_rate_id: undefined, billable: false, customer_id: undefined }]
      )
    }
  }, [bill])

  useEffect(() => {
    if (!formData.vendor_id || !formData.bill_date) return
    const vendor = vendors.find((v) => v.id === formData.vendor_id)
    if (!vendor) return
    const billDate = new Date(formData.bill_date)
    const days = Number(vendor.payment_terms_days) || 30
    const due = new Date(billDate)
    due.setDate(due.getDate() + days)
    setFormData((prev) => ({
      ...prev,
      due_date: due.toISOString().split('T')[0],
      terms: vendor.payment_terms || 'Net 30'
    }))
  }, [formData.vendor_id, formData.bill_date, vendors])

  const handleChange = (e) => {
    const { name, value } = e.target
    let v = value
    if (name === 'vendor_id') v = value ? parseInt(value, 10) : 0
    setFormData((prev) => ({ ...prev, [name]: v }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleLineChange = (index, line) => {
    const next = [...lines]
    next[index] = line
    setLines(next)
  }

  const handleAddLine = () => {
    setLines([
      ...lines,
      { description: '', quantity: 1, unit_cost: 0, account_id: null, tax_rate_id: undefined, billable: false, customer_id: undefined }
    ])
  }

  const handleRemoveLine = (index) => {
    if (lines.length <= 1) return
    setLines(lines.filter((_, i) => i !== index))
  }

  const calculateTotals = () => {
    let subtotal = 0
    let totalTax = 0
    lines.forEach((line) => {
      const lineTotal = (line.quantity || 0) * (line.unit_cost || 0)
      subtotal += lineTotal
      if (line.tax_rate_id && Array.isArray(taxRates)) {
        const tr = taxRates.find((t) => t.id === line.tax_rate_id)
        if (tr && (tr.tax_rate != null)) {
          const rate = typeof tr.tax_rate === 'number' ? tr.tax_rate : parseFloat(tr.tax_rate) || 0
          totalTax += lineTotal * (rate / 100)
        }
      }
    })
    const total = subtotal + totalTax
    return { subtotal, totalTax, total }
  }

  const validate = () => {
    const next = {}
    if (!formData.vendor_id) next.vendor_id = 'Vendor is required'
    if (!formData.bill_date) next.bill_date = 'Bill date is required'
    if (!formData.due_date) next.due_date = 'Due date is required'
    if (!lines.length) next.lines = 'At least one line item is required'
    lines.forEach((line, i) => {
      if (!String(line.description || '').trim()) next[`line_${i}_description`] = `Line ${i + 1}: Description is required`
      if (!line.quantity || line.quantity <= 0) next[`line_${i}_quantity`] = `Line ${i + 1}: Quantity must be > 0`
      if (line.unit_cost == null || line.unit_cost < 0) next[`line_${i}_cost`] = `Line ${i + 1}: Unit cost cannot be negative`
      if (!line.account_id) next[`line_${i}_account`] = `Line ${i + 1}: Expense account is required`
      if (line.billable && !line.customer_id) next[`line_${i}_customer`] = `Line ${i + 1}: Customer is required for billable expenses`
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
        due_date: formData.due_date || undefined,
        terms: formData.terms || undefined,
        vendor_reference: formData.vendor_reference || undefined,
        memo: formData.memo || undefined,
        lines: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity || 0,
          unit_cost: l.unit_cost || 0,
          account_id: l.account_id,
          tax_rate_id: l.tax_rate_id || undefined,
          billable: !!l.billable,
          customer_id: l.billable ? l.customer_id : undefined
        }))
      })
    } catch (err) {
      console.error('Bill form submit error:', err)
    } finally {
      setLoading(false)
    }
  }

  const { subtotal, totalTax, total } = calculateTotals()

  const vendorOptions = (vendors || [])
    .filter((v) => v.is_active !== false)
    .map((v) => ({
      value: v.id,
      label: `${v.vendor_number || ''} - ${v.vendor_name || ''}`.replace(/^ - | - $/g, '').trim() || `Vendor ${v.id}`
    }))

  const selectedVendor = vendors.find((v) => v.id === formData.vendor_id)

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
        <h3 style={sectionTitle}>Bill Details</h3>
        <div style={grid2}>
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
              style={{ marginBottom: 0 }}
            />
            {selectedVendor && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: isDarkMode ? 'rgba(59,130,246,0.1)' : '#eff6ff',
                  fontSize: '14px'
                }}
              >
                <div style={{ fontWeight: 500, color: isDarkMode ? '#93c5fd' : '#1e40af' }}>{selectedVendor.vendor_name}</div>
                {selectedVendor.email && <div style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>{selectedVendor.email}</div>}
                {selectedVendor.phone && <div style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>{selectedVendor.phone}</div>}
                <div style={{ marginTop: '4px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                  Balance Owed:{' '}
                  <span style={{ fontWeight: 600, color: (selectedVendor.account_balance || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                    ${Number(selectedVendor.account_balance || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
          <Input
            label="Bill Date"
            name="bill_date"
            type="date"
            value={formData.bill_date}
            onChange={handleChange}
            required
            error={errors.bill_date}
            style={{ marginBottom: 0 }}
          />
          <Input
            label="Due Date"
            name="due_date"
            type="date"
            value={formData.due_date}
            onChange={handleChange}
            required
            error={errors.due_date}
            style={{ marginBottom: 0 }}
          />
          <Input label="Payment Terms" name="terms" value={formData.terms} onChange={handleChange} placeholder="Net 30" style={{ marginBottom: 0 }} />
          <Input
            label="Vendor Invoice/Reference #"
            name="vendor_reference"
            value={formData.vendor_reference}
            onChange={handleChange}
            placeholder="Vendor's invoice number"
            style={{ marginBottom: 0 }}
          />
        </div>
        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#d1d5db' : '#374151', marginBottom: '6px' }}>Memo</label>
          <textarea
            name="memo"
            value={formData.memo}
            onChange={handleChange}
            rows={2}
            placeholder="Bill memo or notes..."
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

      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Line Items</h3>
          <Button type="button" onClick={handleAddLine} size="sm">
            + Add Line
          </Button>
        </div>
        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
          {lines.map((line, index) => (
            <BillLineInput
              key={index}
              line={line}
              lineIndex={index}
              expenseAccounts={expenseAccounts}
              taxRates={taxRates}
              customers={customers}
              onChange={handleLineChange}
              onRemove={handleRemoveLine}
              canRemove={lines.length > 1}
            />
          ))}
        </div>
        {Object.keys(errors).some((k) => k.startsWith('line_')) && (
          <div style={{ marginBottom: '12px', fontSize: '14px', color: '#dc2626' }}>
            {Object.entries(errors)
              .filter(([k]) => k.startsWith('line_'))
              .map(([k, v]) => (
                <div key={k}>{v}</div>
              ))}
          </div>
        )}
        <div style={{ marginTop: '16px', marginLeft: 'auto', maxWidth: '280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
            <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Subtotal:</span>
            <span style={{ fontWeight: 500 }}>${Number(subtotal).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
            <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Tax:</span>
            <span style={{ fontWeight: 500 }}>${Number(totalTax).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700, borderTop: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb'), paddingTop: '12px' }}>
            <span>Total:</span>
            <span style={{ color: '#dc2626' }}>${Number(total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Saving...' : bill ? 'Update Bill' : 'Create Bill'}
        </Button>
      </div>
    </form>
  )
}

export default BillForm
