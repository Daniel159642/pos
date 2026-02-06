import React, { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { useToast } from '../contexts/ToastContext'
import { useTheme } from '../contexts/ThemeContext'
import { UserPlus, MoreVertical } from 'lucide-react'
import { formLabelStyle, inputBaseStyle, getInputFocusHandlers, FormField, FormLabel } from '../components/FormStyles'

const isDark = () => document.documentElement.classList.contains('dark-theme')

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '59, 130, 246'
}

export default function Customers() {
  const { show: showToast } = useToast()
  const { themeColor } = useTheme()
  const themeColorRgb = hexToRgb(themeColor)
  const [customersPage, setCustomersPage] = useState(0)
  const PAGE_SIZE = 50
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null) // 'edit' | 'points'
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({ customer_name: '', email: '', phone: '', address: '' })
  const [pointsForm, setPointsForm] = useState({ points: '', reason: '' })
  const [actionsOpenFor, setActionsOpenFor] = useState(null)
  const [dropdownAnchor, setDropdownAnchor] = useState(null)
  const [expandedCustomerId, setExpandedCustomerId] = useState(null)
  const [expandedRewards, setExpandedRewards] = useState({})
  const [loadingRewardsFor, setLoadingRewardsFor] = useState(null)
  const actionsMenuRef = useRef(null)
  const dropdownRef = useRef(null)
  const tableContainerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!actionsOpenFor) return
      const inTrigger = actionsMenuRef.current?.contains(e.target)
      const inDropdown = dropdownRef.current?.contains(e.target)
      if (!inTrigger && !inDropdown) {
        setActionsOpenFor(null)
        setDropdownAnchor(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [actionsOpenFor])

  // Reposition dropdown on scroll/resize so it stays anchored to the button
  useEffect(() => {
    if (!actionsOpenFor || !dropdownAnchor) return
    const updatePosition = () => {
      const el = actionsMenuRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setDropdownAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    const container = tableContainerRef.current
    if (container) container.addEventListener('scroll', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
      if (container) container.removeEventListener('scroll', updatePosition)
    }
  }, [actionsOpenFor, dropdownAnchor])

  const { data: customersResponse, isLoading: loading, error: customersError } = useQuery({
    queryKey: ['customers', customersPage],
    queryFn: async () => {
      const res = await fetch(`/api/customers?limit=${PAGE_SIZE}&offset=${customersPage * PAGE_SIZE}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Failed to load customers')
      return json
    },
    staleTime: 60 * 1000
  })
  const customers = customersResponse?.data ?? []
  const customersTotal = customersResponse?.total ?? 0
  useEffect(() => {
    if (customersError) showToast('Failed to load customers', 'error')
  }, [customersError, showToast])

  const filtered = React.useMemo(() => {
    if (!search.trim()) return customers
    const q = search.toLowerCase().trim()
    return customers.filter(
      (c) =>
        (c.customer_name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    )
  }, [customers, search])

  const openEdit = (customer) => {
    setSelected(customer)
    setEditForm({
      customer_name: customer.customer_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || ''
    })
    setModal('edit')
  }

  const openPoints = (customer) => {
    setSelected(customer)
    setPointsForm({ points: '', reason: '' })
    setModal('points')
  }

  const loadRewardsForCustomer = useCallback(async (customerId) => {
    if (expandedRewards[customerId]) return
    setLoadingRewardsFor(customerId)
    try {
      const res = await fetch(`/api/customers/${customerId}/rewards`)
      const json = await res.json()
      if (json.success && json.data) {
        setExpandedRewards((prev) => ({ ...prev, [customerId]: json.data }))
      }
    } catch (_) {}
    finally {
      setLoadingRewardsFor(null)
    }
  }, [expandedRewards])

  const handleRowClick = (c, e) => {
    if (e.target.closest('button') || e.target.closest('[data-actions]')) return
    const id = c.customer_id
    const next = expandedCustomerId === id ? null : id
    setExpandedCustomerId(next)
    if (next) loadRewardsForCustomer(next)
  }

  const formatDateJoined = (d) => {
    if (!d) return '—'
    try {
      const date = new Date(d)
      return isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return '—'
    }
  }

  const closeModal = () => {
    setModal(null)
    setSelected(null)
  }

  const handleSaveEdit = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${selected.customer_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      const json = await res.json()
      if (json.success) {
        showToast('Customer updated', 'success')
        closeModal()
        queryClient.invalidateQueries({ queryKey: ['customers'] })
      } else {
        showToast(json.message || 'Update failed', 'error')
      }
    } catch (e) {
      showToast('Failed to update customer', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAddPoints = async () => {
    if (!selected) return
    const points = parseInt(pointsForm.points, 10)
    if (Number.isNaN(points) || points === 0) {
      showToast('Enter a valid points amount (positive or negative)', 'warning')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${selected.customer_id}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points, reason: pointsForm.reason || undefined })
      })
      const json = await res.json()
      if (json.success) {
        showToast(
          points > 0
            ? `Added ${points} points. New balance: ${json.data?.loyalty_points ?? '—'}`
            : `Adjusted points. New balance: ${json.data?.loyalty_points ?? '—'}`,
          'success'
        )
        closeModal()
        queryClient.invalidateQueries({ queryKey: ['customers'] })
      } else {
        showToast(json.message || 'Failed to update points', 'error')
      }
    } catch (e) {
      showToast('Failed to update points', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    const name = (editForm.customer_name || '').trim()
    if (!name) {
      showToast('Customer name is required', 'warning')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: editForm.customer_name,
          email: editForm.email || undefined,
          phone: editForm.phone || undefined,
          address: editForm.address || undefined
        })
      })
      const json = await res.json()
      if (json.success) {
        showToast('Customer created', 'success')
        setModal(null)
        setEditForm({ customer_name: '', email: '', phone: '', address: '' })
        queryClient.invalidateQueries({ queryKey: ['customers'] })
      } else {
        showToast(json.message || 'Create failed', 'error')
      }
    } catch (e) {
      showToast('Failed to create customer', 'error')
    } finally {
      setSaving(false)
    }
  }

  const dark = isDark()
  const modalOverlay = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  }
  const modalBox = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '560px',
    width: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
  }

  return (
    <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto', backgroundColor: '#ffffff', minHeight: '100vh' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderBottom: '2px solid #ddd',
                borderRadius: 0,
                backgroundColor: 'transparent',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontFamily: '"Product Sans", sans-serif',
                color: '#333'
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setEditForm({ customer_name: '', email: '', phone: '', address: '' })
              setSelected(null)
              setModal('edit')
            }}
            title="Add customer"
            style={{
              padding: '4px',
              width: '40px',
              height: '40px',
              backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.8)`
              e.currentTarget.style.boxShadow = `0 4px 20px rgba(${themeColorRgb}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `rgba(${themeColorRgb}, 0.7)`
              e.currentTarget.style.boxShadow = `0 4px 15px rgba(${themeColorRgb}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
            }}
          >
            <UserPlus size={18} />
          </button>
        </div>
      </div>

      <div ref={tableContainerRef} style={{ backgroundColor: '#fff', borderRadius: '4px', overflowX: 'auto', overflowY: 'visible', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', width: '100%' }}>
        {loading ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }} aria-busy="true" aria-label="Loading customers">
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #dee2e6', color: '#495057', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #dee2e6', color: '#495057', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #dee2e6', color: '#495057', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid #dee2e6', color: '#495057', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Points</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid #dee2e6', color: '#495057', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '56px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }, (_, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}><div style={{ height: '14px', width: `${70 + (i % 3) * 10}%`, maxWidth: '140px', borderRadius: '4px', backgroundColor: '#e8e8e8' }} /></td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}><div style={{ height: '14px', width: `${60 + (i % 2) * 15}%`, maxWidth: '160px', borderRadius: '4px', backgroundColor: '#eee' }} /></td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}><div style={{ height: '14px', width: '90px', borderRadius: '4px', backgroundColor: '#eee' }} /></td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee', textAlign: 'right' }}><div style={{ height: '14px', width: '36px', marginLeft: 'auto', borderRadius: '4px', backgroundColor: '#eee' }} /></td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee', textAlign: 'right' }}><div style={{ height: '24px', width: '24px', marginLeft: 'auto', borderRadius: '6px', backgroundColor: '#eee' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
            {customers.length === 0 ? 'No customers yet. Add one to get started.' : 'No customers match your search.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #dee2e6', color: '#495057', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #dee2e6', color: '#495057', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #dee2e6', color: '#495057', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid #dee2e6', color: '#495057', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Points</th>
                <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid #dee2e6', color: '#495057', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '56px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <Fragment key={c.customer_id}>
                  <tr
                    onClick={(e) => handleRowClick(c, e)}
                    style={{
                      backgroundColor: expandedCustomerId === c.customer_id ? `rgba(${themeColorRgb}, 0.1)` : (idx % 2 === 0 ? '#fff' : '#fafafa'),
                      cursor: 'pointer'
                    }}
                  >
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: '14px', color: '#333' }}>{c.customer_name || '—'}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: '14px', color: '#333' }}>{c.email || '—'}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: '14px', color: '#333' }}>{c.phone || '—'}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: '14px', color: '#333', textAlign: 'right', fontWeight: 600 }}>
                      {c.loyalty_points != null ? Number(c.loyalty_points) : 0}
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #eee', fontSize: '14px', textAlign: 'right' }} data-actions>
                      <div ref={actionsOpenFor === c.customer_id ? actionsMenuRef : null} style={{ display: 'inline-block' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (actionsOpenFor === c.customer_id) {
                              setActionsOpenFor(null)
                              setDropdownAnchor(null)
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setDropdownAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                              setActionsOpenFor(c.customer_id)
                            }
                          }}
                          aria-label="Actions"
                          style={{
                            padding: '6px',
                            background: 'none',
                            border: 'none',
                            color: '#6b7280',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = '#374151' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6b7280' }}
                        >
                          <MoreVertical size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedCustomerId === c.customer_id && (
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <td colSpan={5} style={{ padding: '16px 12px', borderBottom: '1px solid #eee', verticalAlign: 'top' }}>
                        {loadingRewardsFor === c.customer_id ? (
                          <div style={{ fontSize: '13px', color: '#6b7280' }}>Loading details…</div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', fontSize: '14px' }}>
                            <div>
                              <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Address</div>
                              <div style={{ color: '#333' }}>{c.address && c.address.trim() ? c.address : '—'}</div>
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Date joined</div>
                              <div style={{ color: '#333' }}>{formatDateJoined(c.created_date || c.created_at)}</div>
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Points</div>
                              <div style={{ color: '#333' }}>{c.loyalty_points != null ? Number(c.loyalty_points) : 0}</div>
                            </div>
                            {expandedRewards[c.customer_id] && (
                              <>
                                <div>
                                  <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Total spent</div>
                                  <div style={{ color: '#333' }}>${Number(expandedRewards[c.customer_id].total_spent || 0).toFixed(2)}</div>
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Orders</div>
                                  <div style={{ color: '#333' }}>{expandedRewards[c.customer_id].order_count ?? 0}</div>
                                </div>
                                {expandedRewards[c.customer_id].popular_items && expandedRewards[c.customer_id].popular_items.length > 0 && (
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Popular items</div>
                                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#333' }}>
                                      {expandedRewards[c.customer_id].popular_items.slice(0, 5).map((item, i) => (
                                        <li key={i}>{item.product_name || item.product_id} (×{item.qty})</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {customersTotal > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            Page {customersPage + 1} of {Math.max(1, Math.ceil(customersTotal / PAGE_SIZE))} ({customersTotal} customers)
          </span>
          <button
            type="button"
            disabled={customersPage === 0 || loading}
            onClick={() => setCustomersPage((p) => Math.max(0, p - 1))}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              background: '#f5f5f5',
              color: (customersPage === 0 || loading) ? '#999' : '#333',
              cursor: (customersPage === 0 || loading) ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={customersPage >= Math.ceil(customersTotal / PAGE_SIZE) - 1 || loading}
            onClick={() => setCustomersPage((p) => p + 1)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              background: '#f5f5f5',
              color: (customersPage >= Math.ceil(customersTotal / PAGE_SIZE) - 1 || loading) ? '#999' : '#333',
              cursor: (customersPage >= Math.ceil(customersTotal / PAGE_SIZE) - 1 || loading) ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Actions dropdown (portal so it isn't clipped by table overflow) */}
      {actionsOpenFor && dropdownAnchor && (() => {
        const customer = filtered.find((c) => c.customer_id === actionsOpenFor)
        if (!customer) return null
        const close = () => {
          setActionsOpenFor(null)
          setDropdownAnchor(null)
        }
        return createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownAnchor.top,
              right: dropdownAnchor.right,
              minWidth: '180px',
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 9999,
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { close(); openEdit(customer) }}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 14px',
                textAlign: 'left',
                border: 'none',
                background: 'none',
                color: '#333',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => { close(); openPoints(customer) }}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 14px',
                textAlign: 'left',
                border: 'none',
                background: 'none',
                color: '#333',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              Give points / coupon
            </button>
          </div>,
          document.body
        )
      })()}

      {/* Edit modal (create or update) */}
      {modal === 'edit' && (
        <div style={modalOverlay} onClick={() => !saving && closeModal()}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontFamily: '"Product Sans", sans-serif', color: '#333' }}>
                {selected ? 'Edit customer' : 'New customer'}
              </h3>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <FormField>
                <FormLabel isDarkMode={dark} required>Name</FormLabel>
                <input
                  type="text"
                  value={editForm.customer_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, customer_name: e.target.value }))}
                  placeholder="Customer name"
                  style={inputBaseStyle(dark, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, dark)}
                />
              </FormField>
              <FormField>
                <FormLabel isDarkMode={dark}>Email</FormLabel>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  style={inputBaseStyle(dark, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, dark)}
                />
              </FormField>
              <FormField>
                <FormLabel isDarkMode={dark}>Phone</FormLabel>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="555-0000"
                  style={inputBaseStyle(dark, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, dark)}
                />
              </FormField>
              <FormField>
                <FormLabel isDarkMode={dark}>Address</FormLabel>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Street, city, state"
                  style={inputBaseStyle(dark, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, dark)}
                />
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => !saving && closeModal()}
                disabled={saving}
                style={{
                  padding: '4px 16px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: `1px solid ${dark ? 'var(--border-light, #333)' : '#ddd'}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: 'none'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={selected ? handleSaveEdit : handleCreate}
                disabled={saving}
                style={{
                  padding: '4px 16px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                  border: `1px solid rgba(${themeColorRgb}, 0.5)`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3)`
                }}
              >
                {saving ? 'Saving...' : selected ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add points / coupon modal */}
      {modal === 'points' && selected && (
        <div style={modalOverlay} onClick={() => !saving && closeModal()}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontFamily: '"Product Sans", sans-serif', color: '#333' }}>
                Give points / coupon — {selected.customer_name || 'Customer'}
              </h3>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#666' }}>
              Current balance: <strong>{selected.loyalty_points != null ? Number(selected.loyalty_points) : 0}</strong> points
            </p>
            <div style={{ marginBottom: '20px' }}>
              <FormField>
                <FormLabel isDarkMode={dark} required>Points to add (or negative to subtract)</FormLabel>
                <input
                  type="number"
                  value={pointsForm.points}
                  onChange={(e) => setPointsForm((f) => ({ ...f, points: e.target.value }))}
                  placeholder="e.g. 100 or -50"
                  style={inputBaseStyle(dark, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, dark)}
                />
              </FormField>
              <FormField>
                <FormLabel isDarkMode={dark}>Reason (optional)</FormLabel>
                <input
                  type="text"
                  value={pointsForm.reason}
                  onChange={(e) => setPointsForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Birthday coupon, Manual adjustment"
                  style={inputBaseStyle(dark, themeColorRgb)}
                  {...getInputFocusHandlers(themeColorRgb, dark)}
                />
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => !saving && closeModal()}
                disabled={saving}
                style={{
                  padding: '4px 16px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: `1px solid ${dark ? 'var(--border-light, #333)' : '#ddd'}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: 'none'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddPoints}
                disabled={saving}
                style={{
                  padding: '4px 16px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  backgroundColor: `rgba(${themeColorRgb}, 0.7)`,
                  border: `1px solid rgba(${themeColorRgb}, 0.5)`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: `0 4px 15px rgba(${themeColorRgb}, 0.3)`
                }}
              >
                {saving ? 'Updating...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
