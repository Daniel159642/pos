import React from 'react'

function VendorDetailModal({ vendor, balance }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')

  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const getMethodLabel = (m) => {
    const labels = { check: 'Check', ach: 'ACH/Bank Transfer', wire: 'Wire Transfer', credit_card: 'Credit Card', cash: 'Cash', other: 'Other' }
    return labels[m] || m || 'Check'
  }

  if (!vendor) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>Vendor Information</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Vendor Number</p>
            <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{vendor.vendor_number}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Vendor Name</p>
            <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{vendor.vendor_name}</p>
          </div>
          {vendor.contact_name && (
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Contact Person</p>
              <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{vendor.contact_name}</p>
            </div>
          )}
          <div>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Status</p>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: vendor.is_active ? (isDarkMode ? 'rgba(34,197,94,0.2)' : '#dcfce7') : (isDarkMode ? '#2a2a2a' : '#e5e7eb'),
                color: vendor.is_active ? '#16a34a' : '#6b7280'
              }}
            >
              {vendor.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>Contact Information</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '14px' }}>
          {vendor.email && (
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Email</p>
              <p style={{ margin: 0, color: '#2563eb' }}>{vendor.email}</p>
            </div>
          )}
          {vendor.phone && (
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Phone</p>
              <p style={{ margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{vendor.phone}</p>
            </div>
          )}
          {vendor.website && (
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Website</p>
              <a href={vendor.website} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>{vendor.website}</a>
            </div>
          )}
        </div>
      </div>

      {vendor.address_line1 && (
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>Address</h4>
          <div style={{ fontSize: '14px', color: isDarkMode ? '#e5e7eb' : '#111' }}>
            <p style={{ margin: '0 0 4px' }}>{vendor.address_line1}</p>
            {vendor.address_line2 && <p style={{ margin: '0 0 4px' }}>{vendor.address_line2}</p>}
            {(vendor.city || vendor.state || vendor.postal_code) && (
              <p style={{ margin: '0 0 4px' }}>
                {[vendor.city, vendor.state].filter(Boolean).join(', ')} {vendor.postal_code || ''}
              </p>
            )}
            {vendor.country && <p style={{ margin: 0 }}>{vendor.country}</p>}
          </div>
        </div>
      )}

      <div>
        <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>Payment & Tax Information</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <div>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Payment Terms</p>
            <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{vendor.payment_terms || 'Net 30'}</p>
          </div>
          <div>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Payment Method</p>
            <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{getMethodLabel(vendor.payment_method)}</p>
          </div>
          {vendor.account_number && (
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Our Account Number</p>
              <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{vendor.account_number}</p>
            </div>
          )}
          <div>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>1099 Status</p>
            {vendor.is_1099_vendor ? (
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500, backgroundColor: isDarkMode ? 'rgba(234,179,8,0.2)' : '#fef9c3', color: '#a16207' }}>1099 Vendor</span>
            ) : (
              <span style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>Not a 1099 vendor</span>
            )}
          </div>
        </div>
        {vendor.is_1099_vendor && vendor.tax_id && (
          <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: isDarkMode ? 'rgba(234,179,8,0.1)' : '#fef9c3', border: '1px solid ' + (isDarkMode ? 'rgba(234,179,8,0.3)' : '#fde047') }}>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Tax ID</p>
            <p style={{ fontWeight: 500, margin: '0 0 4px', color: isDarkMode ? '#e5e7eb' : '#111' }}>{vendor.tax_id}</p>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', margin: 0 }}>Required for 1099 reporting</p>
          </div>
        )}
      </div>

      {balance && (
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>Account Summary</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Total Billed</p>
              <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#e5e7eb' : '#111' }}>{formatCurrency(balance.total_billed)}</p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Total Paid</p>
              <p style={{ fontWeight: 500, margin: 0, color: '#16a34a' }}>{formatCurrency(balance.total_paid)}</p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Balance Due</p>
              <p style={{ fontWeight: 600, fontSize: '18px', margin: 0, color: (balance.balance_due || 0) > 0 ? '#dc2626' : (isDarkMode ? '#e5e7eb' : '#111') }}>
                {formatCurrency(balance.balance_due)}
              </p>
            </div>
            {(balance.overdue_amount || 0) > 0 && (
              <div>
                <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Overdue Amount</p>
                <p style={{ fontWeight: 600, margin: 0, color: '#dc2626' }}>{formatCurrency(balance.overdue_amount)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {vendor.notes && (
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: isDarkMode ? '#e5e7eb' : '#374151', marginBottom: '12px' }}>Internal Notes</h4>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', margin: 0, padding: '12px', borderRadius: '8px', backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb' }}>{vendor.notes}</p>
        </div>
      )}
    </div>
  )
}

export default VendorDetailModal
