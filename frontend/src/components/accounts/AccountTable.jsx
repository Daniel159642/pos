import React from 'react'
import Button from '../common/Button'

function AccountTable({ accounts, onEdit, onDelete, onToggleStatus, onViewBalance, onViewLedger }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  const getAccountTypeColor = (type) => {
    const colors = {
      Asset: '#10b981',
      Liability: '#ef4444',
      Equity: '#3b82f6',
      Revenue: '#8b5cf6',
      Expense: '#f59e0b',
      COGS: '#eab308',
    }
    return colors[type] || (isDarkMode ? '#9ca3af' : '#6b7280')
  }

  if (accounts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
        <p>No accounts found</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse'
      }}>
        <thead>
          <tr style={{
            backgroundColor: isDarkMode ? '#1f1f1f' : '#f9fafb',
            borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`
          }}>
            <th style={{
              padding: '12px 16px',
              textAlign: 'left',
              fontSize: '12px',
              fontWeight: 500,
              color: isDarkMode ? '#9ca3af' : '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Account Number
            </th>
            <th style={{
              padding: '12px 16px',
              textAlign: 'left',
              fontSize: '12px',
              fontWeight: 500,
              color: isDarkMode ? '#9ca3af' : '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Account Name
            </th>
            <th style={{
              padding: '12px 16px',
              textAlign: 'left',
              fontSize: '12px',
              fontWeight: 500,
              color: isDarkMode ? '#9ca3af' : '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Type
            </th>
            <th style={{
              padding: '12px 16px',
              textAlign: 'left',
              fontSize: '12px',
              fontWeight: 500,
              color: isDarkMode ? '#9ca3af' : '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Balance Type
            </th>
            <th style={{
              padding: '12px 16px',
              textAlign: 'left',
              fontSize: '12px',
              fontWeight: 500,
              color: isDarkMode ? '#9ca3af' : '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Status
            </th>
            <th style={{
              padding: '12px 16px',
              textAlign: 'right',
              fontSize: '12px',
              fontWeight: 500,
              color: isDarkMode ? '#9ca3af' : '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account, index) => (
            <tr
              key={account.id}
              style={{
                backgroundColor: !account.is_active ? (isDarkMode ? '#1a1a1a' : '#f9fafb') : 'transparent',
                opacity: !account.is_active ? 0.6 : 1,
                borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (account.is_active) {
                  e.currentTarget.style.backgroundColor = isDarkMode ? '#2a2a2a' : '#f9fafb'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = !account.is_active ? (isDarkMode ? '#1a1a1a' : '#f9fafb') : 'transparent'
              }}
            >
              <td style={{
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: 500,
                color: isDarkMode ? '#ffffff' : '#111827'
              }}>
                {account.account_number || '-'}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: isDarkMode ? '#ffffff' : '#111827'
                }}>
                  {account.account_name}
                </div>
                {account.description && (
                  <div style={{
                    fontSize: '12px',
                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                    marginTop: '4px'
                  }}>
                    {account.description}
                  </div>
                )}
                {account.is_system_account && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    marginTop: '4px'
                  }}>
                    System Account
                  </span>
                )}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: getAccountTypeColor(account.account_type)
                }}>
                  {account.account_type}
                </span>
                {account.sub_type && (
                  <div style={{
                    fontSize: '12px',
                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                    marginTop: '4px'
                  }}>
                    {account.sub_type}
                  </div>
                )}
              </td>
              <td style={{
                padding: '12px 16px',
                fontSize: '14px',
                color: isDarkMode ? '#ffffff' : '#111827',
                textTransform: 'capitalize'
              }}>
                {account.balance_type}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{
                  display: 'inline-flex',
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '9999px',
                  backgroundColor: account.is_active
                    ? (isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5')
                    : (isDarkMode ? 'rgba(107, 114, 128, 0.2)' : '#f3f4f6'),
                  color: account.is_active
                    ? (isDarkMode ? '#34d399' : '#065f46')
                    : (isDarkMode ? '#9ca3af' : '#374151')
                }}>
                  {account.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td style={{
                padding: '12px 16px',
                textAlign: 'right',
                fontSize: '14px',
                fontWeight: 500
              }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    onClick={() => onViewBalance(account)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6366f1',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontSize: '14px',
                      textDecoration: 'underline'
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                  >
                    Balance
                  </button>
                  {onViewLedger && (
                    <button
                      onClick={() => onViewLedger(account)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#8b5cf6',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: '14px',
                        textDecoration: 'underline'
                      }}
                      onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                      onMouseLeave={(e) => e.target.style.opacity = '1'}
                    >
                      Ledger
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(account)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onToggleStatus(account)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#f59e0b',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                  >
                    {account.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  {!account.is_system_account && (
                    <button
                      onClick={() => onDelete(account)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: '14px'
                      }}
                      onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                      onMouseLeave={(e) => e.target.style.opacity = '1'}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AccountTable
