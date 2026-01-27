import React from 'react'

function CustomerDetailModal({ customer, balance }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getDisplayName = () => {
    if (customer.display_name) return customer.display_name
    if (customer.customer_type === 'business') return customer.company_name || customer.customer_number
    return `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.customer_number
  }

  const sectionStyle = { marginBottom: '24px' }
  const labelStyle = { fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }
  const valueStyle = { fontSize: '14px', fontWeight: 500, color: isDarkMode ? '#fff' : '#111' }
  const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={sectionStyle}>
        <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>
          Customer Information
        </h4>
        <div style={gridStyle}>
          <div>
            <p style={labelStyle}>Customer Number</p>
            <p style={valueStyle}>{customer.customer_number}</p>
          </div>
          <div>
            <p style={labelStyle}>Customer Type</p>
            <p style={valueStyle}>{String(customer.customer_type || '').charAt(0).toUpperCase() + (customer.customer_type || '').slice(1)}</p>
          </div>
          <div>
            <p style={labelStyle}>Name</p>
            <p style={valueStyle}>{getDisplayName()}</p>
          </div>
          <div>
            <p style={labelStyle}>Status</p>
            <span style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: customer.is_active ? (isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7') : (isDarkMode ? '#2a2a2a' : '#f3f4f6'),
              color: customer.is_active ? '#16a34a' : (isDarkMode ? '#9ca3af' : '#4b5563')
            }}>
              {customer.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>
          Contact Information
        </h4>
        <div style={gridStyle}>
          {customer.email && (
            <div>
              <p style={labelStyle}>Email</p>
              <p style={{ ...valueStyle, color: '#2563eb' }}>{customer.email}</p>
            </div>
          )}
          {customer.phone && (
            <div>
              <p style={labelStyle}>Phone</p>
              <p style={valueStyle}>{customer.phone}</p>
            </div>
          )}
          {customer.mobile && (
            <div>
              <p style={labelStyle}>Mobile</p>
              <p style={valueStyle}>{customer.mobile}</p>
            </div>
          )}
          {customer.website && (
            <div>
              <p style={labelStyle}>Website</p>
              <p style={{ ...valueStyle, color: '#2563eb' }}>{customer.website}</p>
            </div>
          )}
          {!customer.email && !customer.phone && !customer.mobile && !customer.website && (
            <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', fontStyle: 'italic' }}>No contact information</p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>
            Billing Address
          </h4>
          <div style={{ fontSize: '14px', color: isDarkMode ? '#e5e7eb' : '#374151' }}>
            {customer.billing_address_line1 && <p style={{ margin: '0 0 4px' }}>{customer.billing_address_line1}</p>}
            {customer.billing_address_line2 && <p style={{ margin: '0 0 4px' }}>{customer.billing_address_line2}</p>}
            {(customer.billing_city || customer.billing_state || customer.billing_postal_code) && (
              <p style={{ margin: '0 0 4px' }}>
                {[customer.billing_city, customer.billing_state].filter(Boolean).join(', ')} {customer.billing_postal_code || ''}
              </p>
            )}
            {customer.billing_country && <p style={{ margin: 0 }}>{customer.billing_country}</p>}
            {!customer.billing_address_line1 && (
              <p style={{ margin: 0, color: isDarkMode ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>No address provided</p>
            )}
          </div>
        </div>
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>
            Shipping Address
          </h4>
          <div style={{ fontSize: '14px', color: isDarkMode ? '#e5e7eb' : '#374151' }}>
            {customer.shipping_address_line1 && <p style={{ margin: '0 0 4px' }}>{customer.shipping_address_line1}</p>}
            {customer.shipping_address_line2 && <p style={{ margin: '0 0 4px' }}>{customer.shipping_address_line2}</p>}
            {(customer.shipping_city || customer.shipping_state || customer.shipping_postal_code) && (
              <p style={{ margin: '0 0 4px' }}>
                {[customer.shipping_city, customer.shipping_state].filter(Boolean).join(', ')} {customer.shipping_postal_code || ''}
              </p>
            )}
            {customer.shipping_country && <p style={{ margin: 0 }}>{customer.shipping_country}</p>}
            {!customer.shipping_address_line1 && (
              <p style={{ margin: 0, color: isDarkMode ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>No address provided</p>
            )}
          </div>
        </div>
      </div>

      {balance && (
        <div style={sectionStyle}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>
            Account Summary
          </h4>
          <div style={gridStyle}>
            <div>
              <p style={labelStyle}>Payment Terms</p>
              <p style={valueStyle}>{customer.payment_terms || 'Net 30'}</p>
            </div>
            <div>
              <p style={labelStyle}>Credit Limit</p>
              <p style={valueStyle}>{formatCurrency(customer.credit_limit)}</p>
            </div>
            <div>
              <p style={labelStyle}>Total Invoiced</p>
              <p style={valueStyle}>{formatCurrency(balance.total_invoiced)}</p>
            </div>
            <div>
              <p style={labelStyle}>Total Paid</p>
              <p style={{ ...valueStyle, color: '#16a34a' }}>{formatCurrency(balance.total_paid)}</p>
            </div>
            <div>
              <p style={labelStyle}>Balance Due</p>
              <p style={{
                ...valueStyle,
                fontSize: '18px',
                color: (balance.balance_due || 0) > 0 ? '#dc2626' : (isDarkMode ? '#fff' : '#111')
              }}>
                {formatCurrency(balance.balance_due)}
              </p>
            </div>
            <div>
              <p style={labelStyle}>Credit Available</p>
              <p style={{ ...valueStyle, color: '#2563eb' }}>{formatCurrency(balance.credit_available)}</p>
            </div>
          </div>
        </div>
      )}

      {customer.tax_exempt && (
        <div style={sectionStyle}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>
            Tax Information
          </h4>
          <div style={{
            padding: '12px',
            borderRadius: '6px',
            backgroundColor: isDarkMode ? 'rgba(234,179,8,0.1)' : '#fef9c3',
            border: `1px solid ${isDarkMode ? 'rgba(234,179,8,0.3)' : '#fde047'}`
          }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#fbbf24' : '#854d0e' }}>
              Tax Exempt
              {customer.tax_exempt_id && ` – ID: ${customer.tax_exempt_id}`}
            </p>
          </div>
        </div>
      )}

      {customer.notes && (
        <div style={sectionStyle}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>
            Internal Notes
          </h4>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: isDarkMode ? '#d1d5db' : '#4b5563',
            backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb',
            padding: '12px',
            borderRadius: '6px'
          }}>
            {customer.notes}
          </p>
        </div>
      )}
    </div>
  )
}

export default CustomerDetailModal
