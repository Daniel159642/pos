import React, { useState, useEffect } from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import InvoiceLineInput from './InvoiceLineInput'

function InvoiceForm({ invoice, customers = [], revenueAccounts = [], taxRates = [], onSubmit, onCancel }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const today = new Date().toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    customer_id: 0,
    invoice_date: today,
    due_date: '',
    terms: 'Net 30',
    memo: '',
    internal_notes: '',
    discount_percentage: 0
  })
  const [lines, setLines] = useState([{ description: '', quantity: 1, unit_price: 0, account_id: null, tax_rate_id: undefined, discount_percentage: 0 }])
  const [sendImmediately, setSendImmediately] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (invoice && invoice.invoice) {
      const inv = invoice.invoice
      setFormData({
        customer_id: inv.customer_id || 0,
        invoice_date: (inv.invoice_date || '').split('T')[0] || today,
        due_date: (inv.due_date || '').split('T')[0] || '',
        terms: inv.terms || 'Net 30',
        memo: inv.memo || '',
        internal_notes: inv.internal_notes || '',
        discount_percentage: inv.discount_percentage ?? 0
      })
      const ln = (invoice.lines || []).map((l) => ({
        description: l.description || '',
        quantity: l.quantity ?? 1,
        unit_price: l.unit_price ?? 0,
        account_id: l.account_id ?? null,
        tax_rate_id: l.tax_rate_id,
        discount_percentage: l.discount_percentage ?? 0
      }))
      setLines(ln.length ? ln : [{ description: '', quantity: 1, unit_price: 0, account_id: null, tax_rate_id: undefined, discount_percentage: 0 }])
    }
  }, [invoice])

  useEffect(() => {
    if (!formData.customer_id || !formData.invoice_date) return
    const customer = customers.find((c) => c.id === formData.customer_id)
    if (!customer) return
    const invDate = new Date(formData.invoice_date)
    const days = Number(customer.payment_terms_days) || 30
    const due = new Date(invDate)
    due.setDate(due.getDate() + days)
    setFormData((prev) => ({
      ...prev,
      due_date: due.toISOString().split('T')[0],
      terms: customer.payment_terms || 'Net 30'
    }))
  }, [formData.customer_id, formData.invoice_date, customers])

  const handleChange = (e) => {
    const { name, value, type } = e.target
    let v = value
    if (type === 'number') v = parseFloat(value) || 0
    else if (name === 'customer_id') v = value ? parseInt(value, 10) : 0
    setFormData((prev) => ({ ...prev, [name]: v }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleLineChange = (index, line) => {
    const next = [...lines]
    next[index] = line
    setLines(next)
  }

  const handleAddLine = () => {
    setLines([...lines, { description: '', quantity: 1, unit_price: 0, account_id: null, tax_rate_id: undefined, discount_percentage: 0 }])
  }

  const handleRemoveLine = (index) => {
    if (lines.length <= 1) return
    setLines(lines.filter((_, i) => i !== index))
  }

  const calculateTotals = () => {
    let subtotal = 0
    let totalTax = 0
    lines.forEach((line) => {
      const lineTotal = (line.quantity || 0) * (line.unit_price || 0)
      const lineDisc = line.discount_percentage ? lineTotal * (line.discount_percentage / 100) : 0
      const afterDisc = lineTotal - lineDisc
      subtotal += lineTotal
      if (line.tax_rate_id && Array.isArray(taxRates)) {
        const tr = taxRates.find((t) => t.id === line.tax_rate_id)
        if (tr && (tr.tax_rate != null)) {
          const rate = typeof tr.tax_rate === 'number' ? tr.tax_rate : parseFloat(tr.tax_rate) || 0
          totalTax += afterDisc * (rate / 100)
        }
      }
    })
    const invoiceDiscount = formData.discount_percentage ? subtotal * (formData.discount_percentage / 100) : 0
    const total = subtotal - invoiceDiscount + totalTax
    return { subtotal, totalTax, invoiceDiscount, total }
  }

  const validate = () => {
    const next = {}
    if (!formData.customer_id) next.customer_id = 'Customer is required'
    if (!formData.invoice_date) next.invoice_date = 'Invoice date is required'
    if (!formData.due_date) next.due_date = 'Due date is required'
    if (!lines.length) next.lines = 'At least one line item is required'
    lines.forEach((line, i) => {
      if (!String(line.description || '').trim()) next[`line_${i}_description`] = `Line ${i + 1}: Description is required`
      if (!line.quantity || line.quantity <= 0) next[`line_${i}_quantity`] = `Line ${i + 1}: Quantity must be > 0`
      if (line.unit_price == null || line.unit_price < 0) next[`line_${i}_price`] = `Line ${i + 1}: Unit price cannot be negative`
      if (!line.account_id) next[`line_${i}_account`] = `Line ${i + 1}: Revenue account is required`
    })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        ...formData,
        due_date: formData.due_date || undefined,
        lines: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity || 0,
          unit_price: l.unit_price || 0,
          account_id: l.account_id,
          tax_rate_id: l.tax_rate_id || undefined,
          discount_percentage: l.discount_percentage || 0
        }))
      }
      await onSubmit(payload, sendImmediately)
    } catch (err) {
      console.error('Invoice form submit error:', err)
    } finally {
      setLoading(false)
    }
  }

  const { subtotal, totalTax, invoiceDiscount, total } = calculateTotals()

  const customerOptions = (customers || [])
    .filter((c) => c.is_active !== false)
    .map((c) => ({
      value: c.id,
      label: `${c.customer_number || ''} - ${c.display_name || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer'}`
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
        <h3 style={sectionTitle}>Invoice Details</h3>
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
                <div style={{ fontWeight: 500, color: isDarkMode ? '#93c5fd' : '#1e40af' }}>{selectedCustomer.display_name || selectedCustomer.company_name || [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ')}</div>
                {selectedCustomer.email && <div style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>{selectedCustomer.email}</div>}
                {selectedCustomer.phone && <div style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>{selectedCustomer.phone}</div>}
                <div style={{ marginTop: '4px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                  Balance:{' '}
                  <span style={{ fontWeight: 600, color: (selectedCustomer.account_balance || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                    ${Number(selectedCustomer.account_balance || 0).toFixed(2)}
                  </span>
                  {selectedCustomer.credit_limit != null && Number(selectedCustomer.credit_limit) > 0 && (
                    <span style={{ marginLeft: '8px' }}>| Credit limit: ${Number(selectedCustomer.credit_limit).toFixed(2)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <Input label="Invoice Date" name="invoice_date" type="date" value={formData.invoice_date} onChange={handleChange} required error={errors.invoice_date} style={{ marginBottom: 0 }} />
          <Input label="Due Date" name="due_date" type="date" value={formData.due_date} onChange={handleChange} required error={errors.due_date} style={{ marginBottom: 0 }} />
          <Input label="Payment Terms" name="terms" value={formData.terms} onChange={handleChange} placeholder="Net 30" style={{ marginBottom: 0 }} />
          <Input label="Invoice Discount %" name="discount_percentage" type="number" step="0.01" min="0" value={formData.discount_percentage || 0} onChange={handleChange} placeholder="0" style={{ marginBottom: 0, textAlign: 'right' }} />
        </div>
        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#d1d5db' : '#374151', marginBottom: '6px' }}>Memo (visible to customer)</label>
          <textarea
            name="memo"
            value={formData.memo}
            onChange={handleChange}
            rows={2}
            placeholder="Thank you for your business..."
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
        <div style={{ marginTop: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#d1d5db' : '#374151', marginBottom: '6px' }}>Internal Notes (not visible to customer)</label>
          <textarea
            name="internal_notes"
            value={formData.internal_notes}
            onChange={handleChange}
            rows={2}
            placeholder="Internal notes..."
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
          <Button type="button" onClick={handleAddLine} size="sm">+ Add Line</Button>
        </div>
        <div style={{ overflowX: 'auto', marginBottom: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 80px 100px 140px 100px 90px 40px', gap: '8px', padding: '0 12px', fontSize: '12px', fontWeight: 500, color: isDarkMode ? '#9ca3af' : '#6b7280', minWidth: '700px' }}>
            <div>#</div>
            <div>Description</div>
            <div style={{ textAlign: 'right' }}>Qty</div>
            <div style={{ textAlign: 'right' }}>Unit Price</div>
            <div>Account</div>
            <div>Tax</div>
            <div style={{ textAlign: 'right' }}>Total</div>
            <div />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {lines.map((line, idx) => (
            <InvoiceLineInput
              key={idx}
              line={line}
              lineIndex={idx}
              revenueAccounts={revenueAccounts}
              taxRates={taxRates}
              onChange={handleLineChange}
              onRemove={handleRemoveLine}
              canRemove={lines.length > 1}
            />
          ))}
        </div>
        {Object.keys(errors).some((k) => k.startsWith('line_')) && (
          <div style={{ marginTop: '12px', fontSize: '14px', color: '#dc2626' }}>
            {Object.entries(errors)
              .filter(([k]) => k.startsWith('line_'))
              .map(([k, v]) => (
                <div key={k}>{v}</div>
              ))}
          </div>
        )}
        <div style={{ marginTop: '24px', marginLeft: 'auto', maxWidth: '320px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
            <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Subtotal:</span>
            <span style={{ fontWeight: 500 }}>${Number(subtotal).toFixed(2)}</span>
          </div>
          {formData.discount_percentage > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
              <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Discount ({formData.discount_percentage}%):</span>
              <span style={{ fontWeight: 500, color: '#dc2626' }}>-${Number(invoiceDiscount).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
            <span style={{ color: isDarkMode ? '#d1d5db' : '#374151' }}>Tax:</span>
            <span style={{ fontWeight: 500 }}>${Number(totalTax).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700, paddingTop: '12px', borderTop: '2px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb') }}>
            <span>Total:</span>
            <span style={{ color: '#2563eb' }}>${Number(total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {!invoice && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer', fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151' }}>
          <input type="checkbox" checked={sendImmediately} onChange={(e) => setSendImmediately(e.target.checked)} style={{ width: '16px', height: '16px' }} />
          Mark as sent immediately (status draft → sent)
        </label>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Saving...' : invoice ? 'Update Invoice' : 'Create Invoice'}
        </Button>
      </div>
    </form>
  )
}

export default InvoiceForm
