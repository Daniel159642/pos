import React, { useState, useEffect } from 'react'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import TransactionLineInput from './TransactionLineInput'

function TransactionForm({ transaction, accounts, onSubmit, onCancel }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    transaction_type: 'journal_entry',
    reference_number: '',
    description: '',
  })

  const [lines, setLines] = useState([
    { account_id: 0, debit_amount: 0, credit_amount: 0, description: '' },
    { account_id: 0, debit_amount: 0, credit_amount: 0, description: '' },
  ])

  const [postImmediately, setPostImmediately] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (transaction) {
      setFormData({
        transaction_date: transaction.transaction.transaction_date.split('T')[0],
        transaction_type: transaction.transaction.transaction_type,
        reference_number: transaction.transaction.reference_number || '',
        description: transaction.transaction.description,
      })
      setLines(transaction.lines.map(line => ({
        account_id: line.account_id,
        debit_amount: line.debit_amount,
        credit_amount: line.credit_amount,
        description: line.description,
      })))
    }
  }, [transaction])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleLineChange = (index, line) => {
    const newLines = [...lines]
    newLines[index] = line
    setLines(newLines)
  }

  const handleAddLine = () => {
    setLines([...lines, { account_id: 0, debit_amount: 0, credit_amount: 0, description: '' }])
  }

  const handleRemoveLine = (index) => {
    if (lines.length > 2) {
      const newLines = lines.filter((_, i) => i !== index)
      setLines(newLines)
    }
  }

  const calculateTotals = () => {
    const totalDebits = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0)
    const totalCredits = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0)
    const difference = totalDebits - totalCredits
    const isBalanced = Math.abs(difference) < 0.01

    return { totalDebits, totalCredits, difference, isBalanced }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.transaction_date) {
      newErrors.transaction_date = 'Transaction date is required'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    if (lines.length < 2) {
      newErrors.lines = 'At least 2 transaction lines are required'
    }

    // Validate each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.account_id) {
        newErrors[`line_${i}_account`] = `Line ${i + 1}: Account is required`
      }
      if (line.debit_amount === 0 && line.credit_amount === 0) {
        newErrors[`line_${i}_amount`] = `Line ${i + 1}: Either debit or credit is required`
      }
      if (!line.description || !line.description.trim()) {
        newErrors[`line_${i}_description`] = `Line ${i + 1}: Description is required`
      }
    }

    const { isBalanced } = calculateTotals()
    if (!isBalanced) {
      newErrors.balance = 'Transaction is not balanced. Debits must equal credits.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)
    try {
      await onSubmit(
        {
          ...formData,
          lines: lines.map((line) => ({
            account_id: line.account_id,
            debit_amount: line.debit_amount || 0,
            credit_amount: line.credit_amount || 0,
            description: line.description,
          })),
        },
        postImmediately
      )
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setLoading(false)
    }
  }

  const { totalDebits, totalCredits, difference, isBalanced } = calculateTotals()

  const transactionTypeOptions = [
    { value: 'journal_entry', label: 'Journal Entry' },
    { value: 'adjustment', label: 'Adjustment' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'bill', label: 'Bill' },
    { value: 'payment', label: 'Payment' },
    { value: 'sales_receipt', label: 'Sales Receipt' },
  ]

  const sectionStyle = {
    backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
    padding: '20px',
    borderRadius: '8px',
    border: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
    marginBottom: '20px'
  }

  const totalsStyle = {
    backgroundColor: isDarkMode ? '#1a1a1a' : '#f9fafb',
    padding: '16px',
    borderRadius: '8px',
    marginTop: '16px'
  }

  const totalsGridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 120px 120px',
    gap: '12px',
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '12px'
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Transaction Header */}
      <div style={sectionStyle}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          marginBottom: '16px',
          color: isDarkMode ? '#ffffff' : '#1a1a1a'
        }}>
          Transaction Details
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input
            label="Transaction Date"
            name="transaction_date"
            type="date"
            value={formData.transaction_date}
            onChange={handleChange}
            required
            error={errors.transaction_date}
          />

          <Select
            label="Transaction Type"
            name="transaction_type"
            value={formData.transaction_type}
            onChange={handleChange}
            options={transactionTypeOptions}
            required
          />

          <Input
            label="Reference Number"
            name="reference_number"
            value={formData.reference_number}
            onChange={handleChange}
            placeholder="Optional reference"
          />

          <Input
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Transaction description"
            required
            error={errors.description}
          />
        </div>
      </div>

      {/* Transaction Lines */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ 
            fontSize: '18px', 
            fontWeight: '600',
            color: isDarkMode ? '#ffffff' : '#1a1a1a'
          }}>
            Transaction Lines
          </h3>
          <Button type="button" onClick={handleAddLine} size="sm">
            + Add Line
          </Button>
        </div>

        {/* Column Headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 120px 120px 1fr 40px',
          gap: '12px',
          padding: '8px 12px',
          fontSize: '12px',
          fontWeight: '600',
          color: isDarkMode ? '#9ca3af' : '#6b7280',
          marginBottom: '8px'
        }}>
          <div>#</div>
          <div>Account</div>
          <div style={{ textAlign: 'right' }}>Debit</div>
          <div style={{ textAlign: 'right' }}>Credit</div>
          <div>Description</div>
          <div></div>
        </div>

        {/* Lines */}
        <div>
          {lines.map((line, index) => (
            <TransactionLineInput
              key={index}
              line={line}
              lineIndex={index}
              accounts={accounts}
              onChange={handleLineChange}
              onRemove={handleRemoveLine}
              canRemove={lines.length > 2}
            />
          ))}
        </div>

        {/* Show line errors */}
        {Object.keys(errors).some(key => key.startsWith('line_')) && (
          <div style={{ marginTop: '12px', fontSize: '14px', color: '#ef4444' }}>
            {Object.entries(errors)
              .filter(([key]) => key.startsWith('line_'))
              .map(([key, value]) => (
                <div key={key}>{value}</div>
              ))}
          </div>
        )}

        {/* Totals */}
        <div style={totalsStyle}>
          <div style={totalsGridStyle}>
            <div style={{ textAlign: 'right' }}>Totals:</div>
            <div style={{ textAlign: 'right', fontSize: '16px' }}>
              ${totalDebits.toFixed(2)}
            </div>
            <div style={{ textAlign: 'right', fontSize: '16px' }}>
              ${totalCredits.toFixed(2)}
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            {isBalanced ? (
              <span style={{ color: '#10b981', fontWeight: '600' }}>
                ✓ Transaction is balanced
              </span>
            ) : (
              <span style={{ color: '#ef4444', fontWeight: '600' }}>
                ✗ Out of balance by ${Math.abs(difference).toFixed(2)}
              </span>
            )}
          </div>

          {errors.balance && (
            <p style={{ marginTop: '8px', textAlign: 'center', fontSize: '14px', color: '#ef4444' }}>
              {errors.balance}
            </p>
          )}
        </div>
      </div>

      {/* Post Immediately Option */}
      {!transaction && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type="checkbox"
            id="post_immediately"
            checked={postImmediately}
            onChange={(e) => setPostImmediately(e.target.checked)}
            style={{
              width: '16px',
              height: '16px',
              cursor: 'pointer'
            }}
          />
          <label 
            htmlFor="post_immediately" 
            style={{ 
              marginLeft: '8px', 
              fontSize: '14px',
              color: isDarkMode ? '#d1d5db' : '#374151',
              cursor: 'pointer'
            }}
          >
            Post transaction immediately (affects account balances)
          </label>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={loading || !isBalanced}>
          {loading ? 'Saving...' : transaction ? 'Update Transaction' : 'Create Transaction'}
        </Button>
      </div>
    </form>
  )
}

export default TransactionForm
