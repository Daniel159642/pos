import React, { useState, useEffect } from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'

function AccountForm({ account, accounts, onSubmit, onCancel }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  const [formData, setFormData] = useState({
    account_name: '',
    account_type: '',
    balance_type: '',
    account_number: '',
    sub_type: '',
    parent_account_id: undefined,
    description: '',
    opening_balance: 0,
    opening_balance_date: '',
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (account) {
      setFormData({
        account_name: account.account_name,
        account_type: account.account_type,
        balance_type: account.balance_type,
        account_number: account.account_number || '',
        sub_type: account.sub_type || '',
        parent_account_id: account.parent_account_id,
        description: account.description || '',
        opening_balance: account.opening_balance,
        opening_balance_date: account.opening_balance_date || '',
      })
    }
  }, [account])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'parent_account_id' || name === 'opening_balance'
        ? value === '' ? undefined : Number(value)
        : value,
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.account_name.trim()) {
      newErrors.account_name = 'Account name is required'
    }

    if (!formData.account_type) {
      newErrors.account_type = 'Account type is required'
    }

    if (!formData.balance_type) {
      newErrors.balance_type = 'Balance type is required'
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

  const accountTypeOptions = [
    { value: 'Asset', label: 'Asset' },
    { value: 'Liability', label: 'Liability' },
    { value: 'Equity', label: 'Equity' },
    { value: 'Revenue', label: 'Revenue' },
    { value: 'Expense', label: 'Expense' },
    { value: 'COGS', label: 'Cost of Goods Sold' },
    { value: 'Other Income', label: 'Other Income' },
    { value: 'Other Expense', label: 'Other Expense' },
    { value: 'Cost of Goods Sold', label: 'Cost of Goods Sold' },
  ]

  const balanceTypeOptions = [
    { value: 'debit', label: 'Debit' },
    { value: 'credit', label: 'Credit' },
  ]

  const parentAccountOptions = [
    { value: '', label: 'None (Top Level)' },
    ...accounts
      .filter((acc) => acc.id !== account?.id)
      .map((acc) => ({
        value: acc.id,
        label: `${acc.account_number ? acc.account_number + ' - ' : ''}${acc.account_name}`,
      })),
  ]

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Input
          label="Account Number"
          name="account_number"
          value={formData.account_number || ''}
          onChange={handleChange}
          placeholder="e.g., 1000"
        />

        <Input
          label="Account Name"
          name="account_name"
          value={formData.account_name}
          onChange={handleChange}
          placeholder="e.g., Cash"
          required
          error={errors.account_name}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Select
          label="Account Type"
          name="account_type"
          value={formData.account_type}
          onChange={handleChange}
          options={accountTypeOptions}
          placeholder="Select account type"
          required
          error={errors.account_type}
        />

        <Select
          label="Balance Type"
          name="balance_type"
          value={formData.balance_type}
          onChange={handleChange}
          options={balanceTypeOptions}
          placeholder="Select balance type"
          required
          error={errors.balance_type}
        />
      </div>

      <Input
        label="Sub Type"
        name="sub_type"
        value={formData.sub_type || ''}
        onChange={handleChange}
        placeholder="e.g., Current Asset, Fixed Asset"
      />

      <Select
        label="Parent Account"
        name="parent_account_id"
        value={formData.parent_account_id || ''}
        onChange={handleChange}
        options={parentAccountOptions}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <Input
          label="Opening Balance"
          name="opening_balance"
          type="number"
          value={formData.opening_balance || 0}
          onChange={handleChange}
          placeholder="0.00"
        />

        <Input
          label="Opening Balance Date"
          name="opening_balance_date"
          type="date"
          value={formData.opening_balance_date || ''}
          onChange={handleChange}
        />
      </div>

      <div>
        <label style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 500,
          color: isDarkMode ? '#ffffff' : '#374151',
          marginBottom: '4px'
        }}>
          Description
        </label>
        <textarea
          name="description"
          value={formData.description || ''}
          onChange={handleChange}
          rows={3}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: `1px solid ${isDarkMode ? '#3a3a3a' : '#d1d5db'}`,
            borderRadius: '6px',
            backgroundColor: isDarkMode ? '#1f1f1f' : 'white',
            color: isDarkMode ? '#ffffff' : '#1a1a1a',
            fontSize: '14px',
            outline: 'none',
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
          placeholder="Optional description..."
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px' }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Saving...' : account ? 'Update Account' : 'Create Account'}
        </Button>
      </div>
    </form>
  )
}

export default AccountForm
