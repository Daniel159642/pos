import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Image } from 'lucide-react'

function Table({ columns, data, onEdit, enableRowSelection = false, getRowId, selectedRowIds, onSelectedRowIdsChange, actionsAsEllipsis = false, ellipsisMenuItems, themeColorRgb = '132, 0, 255', onRowClick, highlightedRowId, stickyHeader = false }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark-theme')
  })
  const [pendingConfirm, setPendingConfirm] = useState(null) // { item, row } when showing confirm sub-view

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark-theme'))
    }
    
    checkDarkMode()
    
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
    
    return () => observer.disconnect()
  }, [])

  const [openDropdownRowKey, setOpenDropdownRowKey] = useState(null)
  const [dropdownAnchor, setDropdownAnchor] = useState(null)
  const actionsDropdownRef = useRef(null)
  const ellipsisDropdownRef = useRef(null)

  useEffect(() => {
    if (openDropdownRowKey == null) return
    const handleClickOutside = (e) => {
      const inTrigger = actionsDropdownRef.current?.contains(e.target)
      const inMenu = ellipsisDropdownRef.current?.contains(e.target)
      if (!inTrigger && !inMenu) {
        setOpenDropdownRowKey(null)
        setDropdownAnchor(null)
        setPendingConfirm(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdownRowKey])

  const tableWrapperRef = useRef(null)

  // Reposition dropdown on scroll/resize so it stays anchored to the button
  useEffect(() => {
    if (openDropdownRowKey == null || !dropdownAnchor) return
    const updatePosition = () => {
      const el = actionsDropdownRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setDropdownAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    const wrapper = tableWrapperRef.current
    if (wrapper) wrapper.addEventListener('scroll', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
      if (wrapper) wrapper.removeEventListener('scroll', updatePosition)
    }
  }, [openDropdownRowKey, dropdownAnchor])
  
  const formatValue = (value, column, row) => {
    if (value === null || value === undefined) return ''
    
    // Handle actions column - return empty, actions are rendered separately
    if (column === 'actions') return ''
    
    // Handle photo/image columns
    if (column === 'photo' || column.includes('image') || column.includes('photo')) {
      if (!value) return '📦'
      // Construct image URL - handle both relative paths and full paths
      let imageUrl = null
      if (value.startsWith('http://') || value.startsWith('https://')) {
        imageUrl = value
      } else if (value.startsWith('/')) {
        imageUrl = value
      } else if (value.startsWith('uploads/')) {
        imageUrl = `/${value}`
      } else {
        imageUrl = `/uploads/${value}`
      }
      return (
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img
            src={imageUrl}
            alt={row?.product_name || 'Product'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.parentElement.innerHTML = '<span style="color: #999; font-size: 16px;">📦</span>'
            }}
          />
        </div>
      )
    }
    
    // Format currency fields
    if (column.includes('price') || column.includes('cost') || column.includes('total') || 
        column.includes('amount') || column.includes('fee') || column.includes('balance') ||
        column.includes('income') || column.includes('expense') || column.includes('revenue')) {
      if (typeof value === 'number') {
        return `$${value.toFixed(2)}`
      }
      if (typeof value === 'string' && !isNaN(parseFloat(value))) {
        return `$${parseFloat(value).toFixed(2)}`
      }
    }
    
    // Format percentage fields
    if (column.includes('rate') && typeof value === 'number') {
      return `${(value * 100).toFixed(2)}%`
    }
    
    // Format dates/timestamps
    if (column.includes('date') || column.includes('time') || column.includes('timestamp')) {
      if (value) {
        try {
          // Handle SQLite datetime format (YYYY-MM-DD HH:MM:SS) as local time
          // If it's already a Date object, use it directly
          let date
          if (value instanceof Date) {
            date = value
          } else if (typeof value === 'string') {
            // PostgreSQL datetime format: "YYYY-MM-DD HH:MM:SS"
            // Parse as local time (not UTC) to avoid timezone conversion issues
            const dateStr = value.trim()
            // Match YYYY-MM-DD HH:MM:SS format (with optional T, microseconds, timezone)
            const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})[T\s]+(\d{2}:\d{2}:\d{2})/)
            if (match) {
              // Parse as local time components
              const datePart = match[1]  // YYYY-MM-DD
              const timePart = match[2]  // HH:MM:SS
              const [year, month, day] = datePart.split('-').map(Number)
              const [hour, minute, second] = timePart.split(':').map(Number)
              date = new Date(year, month - 1, day, hour, minute, second || 0)
            } else {
              // Try standard Date parsing (but this might have timezone issues)
              date = new Date(value)
            }
          } else {
            date = new Date(value)
          }
          
          if (!isNaN(date.getTime())) {
            return date.toLocaleString()
          }
        } catch (e) {
          // Not a valid date
        }
      }
    }
    
    // Format numbers
    if (typeof value === 'number') {
      return value % 1 !== 0 ? value.toFixed(2) : value.toString()
    }
    
    // Format boolean
    if (typeof value === 'boolean' || value === 0 || value === 1) {
      return value ? 'Yes' : 'No'
    }
    
    return String(value)
  }

  const isNumeric = (value) => {
    return typeof value === 'number' || 
           (typeof value === 'string' && !isNaN(value) && !isNaN(parseFloat(value)))
  }

  const getCellStyle = (col, value) => {
    const baseStyle = { 
      padding: '8px 12px', 
      borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee',
      fontSize: '14px',
      color: isDarkMode ? 'var(--text-primary, #fff)' : '#333'
    }
    
    // Photo/image columns should be centered
    if (col === 'photo' || col.includes('image') || col.includes('photo')) {
      return { ...baseStyle, textAlign: 'center', width: '60px' }
    }
    
    if (col.includes('price') || col.includes('cost') || col.includes('total') || 
        col.includes('amount') || col.includes('fee') || col.includes('balance') ||
        col.includes('income') || col.includes('expense') || col.includes('revenue')) {
      return { ...baseStyle, textAlign: 'right', fontFamily: 'monospace' }
    }
    
    if (isNumeric(value)) {
      return { ...baseStyle, textAlign: 'right' }
    }
    
    return baseStyle
  }

  const resolvedGetRowId = getRowId || ((row, idx) => idx)
  const selectedSet = selectedRowIds instanceof Set ? selectedRowIds : new Set(selectedRowIds || [])

  const visibleRowIds = data.map((row, idx) => resolvedGetRowId(row, idx))
  const allVisibleSelected = visibleRowIds.length > 0 && visibleRowIds.every(id => selectedSet.has(id))
  const someVisibleSelected = visibleRowIds.some(id => selectedSet.has(id)) && !allVisibleSelected

  const updateSelected = (nextSet) => {
    if (onSelectedRowIdsChange) onSelectedRowIdsChange(nextSet)
  }

  const toggleSelectAllVisible = () => {
    const next = new Set(selectedSet)
    if (allVisibleSelected) {
      visibleRowIds.forEach(id => next.delete(id))
    } else {
      visibleRowIds.forEach(id => next.add(id))
    }
    updateSelected(next)
  }

  const toggleRow = (rowId) => {
    const next = new Set(selectedSet)
    if (next.has(rowId)) next.delete(rowId)
    else next.add(rowId)
    updateSelected(next)
  }

  return (
    <div
      ref={tableWrapperRef}
      style={{ 
        backgroundColor: isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff', 
        borderRadius: '4px', 
        overflowX: 'auto',
        overflowY: 'visible',
        boxShadow: isDarkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
        width: '100%'
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
        <thead style={stickyHeader ? { position: 'sticky', top: 0, zIndex: 10 } : undefined}>
          <tr>
            {enableRowSelection && (
              <th
                style={{
                  padding: 0,
                  textAlign: 'center',
                  fontWeight: 600,
                  borderBottom: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #dee2e6',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#495057',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: '48px',
                  verticalAlign: 'middle',
                  boxShadow: isDarkMode ? '0 1px 0 0 var(--border-color, #404040)' : '0 1px 0 0 #dee2e6'
                }}
              >
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: isDarkMode ? 'rgba(26, 26, 26, 0.88)' : 'rgba(248, 249, 250, 0.88)',
                    backdropFilter: 'blur(6px) saturate(130%)',
                    WebkitBackdropFilter: 'blur(6px) saturate(130%)',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected
                    }}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all rows"
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              </th>
            )}
            {columns.map(col => (
              <th
                key={col}
                style={{
                  padding: 0,
                  textAlign: (col === 'photo' || col.includes('image') || col.includes('photo') || col === 'actions') ? 'center' : 'left',
                  fontWeight: 600,
                  borderBottom: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #dee2e6',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#495057',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: (col === 'photo' || col.includes('image') || col.includes('photo')) ? '60px' : (col === 'actions' ? '100px' : 'auto'),
                  verticalAlign: 'middle',
                  boxShadow: isDarkMode ? '0 1px 0 0 var(--border-color, #404040)' : '0 1px 0 0 #dee2e6'
                }}
              >
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: isDarkMode ? 'rgba(26, 26, 26, 0.88)' : 'rgba(248, 249, 250, 0.88)',
                    backdropFilter: 'blur(6px) saturate(130%)',
                    WebkitBackdropFilter: 'blur(6px) saturate(130%)',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: (col === 'photo' || col.includes('image') || col.includes('photo') || col === 'actions') ? 'center' : 'flex-start'
                  }}
                >
                  {col === 'photo' ? (
                    <Image size={16} />
                  ) : col === 'actions' ? 'Actions' : col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
              </th>
            ))}
            {onEdit && !columns.includes('actions') && (
              <th
                style={{
                  padding: 0,
                  textAlign: 'center',
                  fontWeight: 600,
                  borderBottom: isDarkMode ? '2px solid var(--border-color, #404040)' : '2px solid #dee2e6',
                  color: isDarkMode ? 'var(--text-primary, #fff)' : '#495057',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: '100px',
                  verticalAlign: 'middle',
                  boxShadow: isDarkMode ? '0 1px 0 0 var(--border-color, #404040)' : '0 1px 0 0 #dee2e6'
                }}
              >
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: isDarkMode ? 'rgba(26, 26, 26, 0.88)' : 'rgba(248, 249, 250, 0.88)',
                    backdropFilter: 'blur(6px) saturate(130%)',
                    WebkitBackdropFilter: 'blur(6px) saturate(130%)',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  Actions
                </div>
              </th>
            )}
          </tr>
        </thead>
      <tbody>
        {data.map((row, idx) => {
          const rowId = resolvedGetRowId(row, idx)
          const isHighlighted = highlightedRowId != null && rowId === highlightedRowId
          return (
          <tr
            key={rowId}
            style={{
              backgroundColor: isHighlighted
                ? `rgba(${themeColorRgb}, 0.22)`
                : (idx % 2 === 0 ? (isDarkMode ? 'var(--bg-primary, #1a1a1a)' : '#fff') : (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#fafafa')),
              cursor: (onEdit || onRowClick) ? 'pointer' : 'default'
            }}
            onClick={(e) => {
              if (onRowClick && !e.target.closest('input[type="checkbox"]')) {
                onRowClick(row, idx)
              }
            }}
            onDoubleClick={() => {
              if (onEdit) {
                onEdit(row)
              }
            }}
          >
            {enableRowSelection && (
              <td style={{
                padding: '8px 12px',
                borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee',
                textAlign: 'center'
              }}>
                <input
                  type="checkbox"
                  checked={selectedSet.has(resolvedGetRowId(row, idx))}
                  onChange={() => toggleRow(resolvedGetRowId(row, idx))}
                  aria-label="Select row"
                  style={{ cursor: 'pointer' }}
                />
              </td>
            )}
            {columns.map(col => (
              <td key={col} style={getCellStyle(col, row[col])}>
                {col === 'actions' ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    {actionsAsEllipsis && ellipsisMenuItems ? (
                      <div
                        ref={openDropdownRowKey === resolvedGetRowId(row, idx) ? actionsDropdownRef : undefined}
                        style={{ position: 'relative', display: 'inline-block' }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const rowKey = resolvedGetRowId(row, idx)
                            if (openDropdownRowKey === rowKey) {
                              setOpenDropdownRowKey(null)
                              setDropdownAnchor(null)
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setDropdownAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                              setOpenDropdownRowKey(rowKey)
                            }
                          }}
                          aria-label="Actions"
                          aria-expanded={openDropdownRowKey === resolvedGetRowId(row, idx)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: openDropdownRowKey === resolvedGetRowId(row, idx) ? (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#eee') : 'transparent',
                            color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '18px',
                            lineHeight: 1,
                            transition: 'color 0.2s, background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (openDropdownRowKey !== resolvedGetRowId(row, idx)) {
                              e.target.style.color = isDarkMode ? '#fff' : '#333'
                              e.target.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#eee'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (openDropdownRowKey !== resolvedGetRowId(row, idx)) {
                              e.target.style.color = isDarkMode ? 'var(--text-secondary, #ccc)' : '#666'
                              e.target.style.backgroundColor = 'transparent'
                            }
                          }}
                        >
                          ⋮
                        </button>
                      </div>
                    ) : onEdit ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(row)
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: `rgba(${themeColorRgb || '107, 163, 240'}, 0.1)`,
                          color: `rgba(${themeColorRgb || '107, 163, 240'}, 1)`,
                          border: `1px solid rgba(${themeColorRgb || '107, 163, 240'}, 0.3)`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = `rgba(${themeColorRgb || '107, 163, 240'}, 0.2)`
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = `rgba(${themeColorRgb || '107, 163, 240'}, 0.1)`
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                ) : (
                  formatValue(row[col], col, row)
                )}
              </td>
            ))}
            {onEdit && !columns.includes('actions') && (
              <td style={{ 
                padding: '8px 12px', 
                borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee',
                textAlign: 'center',
                position: 'relative'
              }}>
                {actionsAsEllipsis ? (
                  <div
                    ref={openDropdownRowKey === resolvedGetRowId(row, idx) ? actionsDropdownRef : undefined}
                    style={{ position: 'relative', display: 'inline-block' }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const rowKey = resolvedGetRowId(row, idx)
                        if (openDropdownRowKey === rowKey) {
                          setOpenDropdownRowKey(null)
                          setDropdownAnchor(null)
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setDropdownAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                          setOpenDropdownRowKey(rowKey)
                        }
                      }}
                      aria-label="Actions"
                      aria-expanded={openDropdownRowKey === resolvedGetRowId(row, idx)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: openDropdownRowKey === resolvedGetRowId(row, idx) ? (isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#eee') : 'transparent',
                        color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#666',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '18px',
                        lineHeight: 1,
                        transition: 'color 0.2s, background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (openDropdownRowKey !== resolvedGetRowId(row, idx)) {
                          e.target.style.color = isDarkMode ? '#fff' : '#333'
                          e.target.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#eee'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (openDropdownRowKey !== resolvedGetRowId(row, idx)) {
                          e.target.style.color = isDarkMode ? 'var(--text-secondary, #ccc)' : '#666'
                          e.target.style.backgroundColor = 'transparent'
                        }
                      }}
                    >
                      ⋮
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onEdit(row)}
                    aria-label="Actions"
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#4a90e2',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#357abd'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#4a90e2'}
                  >
                    Edit
                  </button>
                )}
              </td>
            )}
          </tr>
          )
        })}
      </tbody>
    </table>

      {/* Ellipsis dropdown (portal so it isn't clipped by table overflow) */}
      {openDropdownRowKey != null && dropdownAnchor && (() => {
        const rowIndex = data.findIndex((row, idx) => resolvedGetRowId(row, idx) === openDropdownRowKey)
        const row = rowIndex >= 0 ? data[rowIndex] : null
        if (!row) return null
        const menuItems = (typeof ellipsisMenuItems === 'function' ? ellipsisMenuItems(row) : ellipsisMenuItems) ?? (onEdit ? [{ label: 'Edit', onClick: (r) => onEdit(r) }] : [])
        const close = () => {
          setOpenDropdownRowKey(null)
          setDropdownAnchor(null)
          setPendingConfirm(null)
        }
        const pc = pendingConfirm
        const showingConfirm = !!pc

        const handleItemClick = (item, r) => {
          if (item.confirm) {
            setPendingConfirm({ item, row: r })
          } else {
            const res = item.onClick(r)
            if (res && typeof res.then === 'function') {
              res.then(close).catch(() => {})
            } else {
              close()
            }
          }
        }

        const handleConfirmClick = async () => {
          if (!pc) return
          try {
            const p = pc.item.onClick(pc.row)
            if (p && typeof p.then === 'function') {
              await p
            }
          } finally {
            close()
          }
        }

        return createPortal(
          <div
            ref={ellipsisDropdownRef}
            role="menu"
            style={{
              position: 'fixed',
              top: dropdownAnchor.top,
              right: dropdownAnchor.right,
              minWidth: showingConfirm ? '200px' : '120px',
              backgroundColor: isDarkMode ? 'var(--bg-secondary, #2d2d2d)' : '#fff',
              border: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #dee2e6',
              borderRadius: '6px',
              boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 9999,
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {showingConfirm ? (
              <>
                <div style={{ padding: '10px 14px', fontSize: '13px', color: isDarkMode ? 'var(--text-secondary, #ccc)' : '#555', borderBottom: isDarkMode ? '1px solid var(--border-light, #333)' : '1px solid #eee' }}>
                  {typeof pc.item.confirmMessage === 'function' ? pc.item.confirmMessage(pc.row) : pc.item.confirmMessage}
                </div>
                <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setPendingConfirm(null)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '13px',
                      border: isDarkMode ? '1px solid var(--border-color, #404040)' : '1px solid #ddd',
                      background: isDarkMode ? 'var(--bg-tertiary)' : '#f5f5f5',
                      color: isDarkMode ? 'var(--text-primary)' : '#333',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmClick}
                    style={{
                      padding: '6px 12px',
                      fontSize: '13px',
                      border: 'none',
                      background: pc.item.confirmDanger ? '#c62828' : `rgba(${themeColorRgb}, 0.7)`,
                      color: '#fff',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {pc.item.confirmButtonLabel || 'Confirm'}
                  </button>
                </div>
              </>
            ) : (
              menuItems.map((item, i) => (
                <button
                  key={i}
                  role="menuitem"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleItemClick(item, row)
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    border: 'none',
                    background: 'none',
                    color: isDarkMode ? 'var(--text-primary, #fff)' : '#333',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = isDarkMode ? 'var(--bg-tertiary, #3a3a3a)' : '#f0f0f0'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent'
                  }}
                >
                  {item.label}
                </button>
              ))
            )}
          </div>,
          document.body
        )
      })()}
    </div>
  )
}

export default Table

