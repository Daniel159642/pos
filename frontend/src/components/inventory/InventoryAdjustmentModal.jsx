import React, { useState } from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

function InventoryAdjustmentModal({
  item,
  onSubmit,
  onCancel
}) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const [formData, setFormData] = useState({
    item_id: item.id,
    adjustment_type: 'increase',
    quantity: 0,
    reason: '',
    unit_cost: item.average_cost || 0
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'unit_cost' ? parseFloat(value) || 0 : value
    }))

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (formData.quantity <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0'
    }

    if (formData.adjustment_type === 'decrease' && formData.quantity > item.quantity_on_hand) {
      newErrors.quantity = `Cannot decrease by ${formData.quantity}. Current quantity: ${item.quantity_on_hand}`
    }

    if (!formData.reason.trim()) {
      newErrors.reason = 'Reason is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setLoading(false)
    }
  }

  const adjustmentTypeOptions = [
    { value: 'increase', label: 'Increase (Add Stock)' },
    { value: 'decrease', label: 'Decrease (Remove Stock)' }
  ]

  const newQuantity = formData.adjustment_type === 'increase' 
    ? item.quantity_on_hand + formData.quantity
    : item.quantity_on_hand - formData.quantity

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        backgroundColor: isDarkMode ? '#1e3a5f' : '#dbeafe',
        padding: '16px',
        borderRadius: '8px'
      }}>
        <h4 style={{
          fontWeight: 600,
          color: isDarkMode ? '#ffffff' : '#111827',
          margin: 0,
          marginBottom: '8px'
        }}>
          {item.item_name}
        </h4>
        <p style={{
          fontSize: '14px',
          color: isDarkMode ? '#d1d5db' : '#374151',
          margin: 0
        }}>
          Current Quantity: <span style={{ fontWeight: 600 }}>{item.quantity_on_hand.toFixed(2)}</span> {item.unit_of_measure}
        </p>
      </div>

      <Select
        label="Adjustment Type"
        name="adjustment_type"
        value={formData.adjustment_type}
        onChange={handleChange}
        options={adjustmentTypeOptions}
        required
      />

      <Input
        label="Quantity to Adjust"
        name="quantity"
        type="number"
        step="0.01"
        value={formData.quantity || ''}
        onChange={handleChange}
        placeholder="0"
        required
        error={errors.quantity}
      />

      {formData.adjustment_type === 'increase' && (
        <Input
          label="Unit Cost (for valuation)"
          name="unit_cost"
          type="number"
          step="0.01"
          value={formData.unit_cost || 0}
          onChange={handleChange}
          placeholder="0.00"
        />
      )}

      <div>
        <label style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 500,
          color: isDarkMode ? '#ffffff' : '#374151',
          marginBottom: '4px'
        }}>
          Reason <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <textarea
          name="reason"
          value={formData.reason}
          onChange={handleChange}
          rows={3}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: errors.reason 
              ? '1px solid #dc2626' 
              : `1px solid ${isDarkMode ? '#3a3a3a' : '#d1d5db'}`,
            borderRadius: '6px',
            backgroundColor: isDarkMode ? '#1f1f1f' : 'white',
            color: isDarkMode ? '#ffffff' : '#1a1a1a',
            fontSize: '14px',
            outline: 'none',
            resize: 'vertical'
          }}
          placeholder="Physical count, damage, theft, found stock, etc."
          required
        />
        {errors.reason && (
          <p style={{ marginTop: '4px', fontSize: '14px', color: '#dc2626' }}>
            {errors.reason}
          </p>
        )}
      </div>

      <div style={{
        backgroundColor: isDarkMode ? '#2a2a2a' : '#f9fafb',
        padding: '16px',
        borderRadius: '8px'
      }}>
        <p style={{
          fontSize: '14px',
          color: isDarkMode ? '#ffffff' : '#374151',
          margin: 0
        }}>
          New Quantity After Adjustment:{' '}
          <span style={{
            marginLeft: '8px',
            fontWeight: 700,
            fontSize: '18px',
            color: newQuantity < 0 ? '#dc2626' : '#16a34a'
          }}>
            {newQuantity.toFixed(2)}
          </span> {item.unit_of_measure}
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px' }}>
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
          disabled={loading}
        >
          {loading ? 'Adjusting...' : 'Record Adjustment'}
        </Button>
      </div>
    </form>
  )
}

export default InventoryAdjustmentModal
