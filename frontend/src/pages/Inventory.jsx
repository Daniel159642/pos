import React, { useState, useEffect } from 'react'
import inventoryService from '../services/inventoryService'
import accountService from '../services/accountService'
import ItemTable from '../components/inventory/ItemTable'
import ItemForm from '../components/inventory/ItemForm'
import ItemFilters from '../components/inventory/ItemFilters'
import InventoryAdjustmentModal from '../components/inventory/InventoryAdjustmentModal'
import Modal from '../components/common/Modal'
import Button from '../components/common/Button'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Alert from '../components/common/Alert'

function ItemDetailView({ item }) {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  const formatCurrency = (amount) => {
    const n = Number(amount)
    if (Number.isNaN(n)) return '$0.00'
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const inventoryValue = item.quantity_on_hand * item.average_cost
  const isLowStock = item.quantity_on_hand <= item.reorder_point && item.reorder_point > 0
  const profitMargin = item.sales_price > 0 && item.average_cost > 0
    ? ((item.sales_price - item.average_cost) / item.sales_price * 100).toFixed(1)
    : 0
  const profitAmount = item.sales_price - item.average_cost

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Item Number</p>
          <p style={{ fontWeight: 600, margin: 0, color: isDarkMode ? '#ffffff' : '#111827' }}>{item.item_number}</p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Item Type</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#ffffff' : '#111827', textTransform: 'capitalize' }}>
            {item.item_type.replace('_', ' ')}
          </p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Barcode</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#ffffff' : '#111827' }}>{item.barcode || '-'}</p>
        </div>
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Unit of Measure</p>
          <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#ffffff' : '#111827' }}>{item.unit_of_measure}</p>
        </div>
      </div>

      {item.description && (
        <div>
          <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Description</p>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#ffffff' : '#374151', margin: 0 }}>{item.description}</p>
        </div>
      )}

      <div style={{
        backgroundColor: isDarkMode ? '#2a2a2a' : '#f9fafb',
        padding: '16px',
        borderRadius: '8px'
      }}>
        <h4 style={{
          fontSize: '14px',
          fontWeight: 600,
          color: isDarkMode ? '#ffffff' : '#374151',
          marginBottom: '12px'
        }}>
          Pricing
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {item.item_type === 'inventory' && (
            <>
              <div>
                <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Purchase Cost</p>
                <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#ffffff' : '#111827' }}>
                  {formatCurrency(item.purchase_cost)}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Average Cost</p>
                <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#ffffff' : '#111827' }}>
                  {formatCurrency(item.average_cost)}
                </p>
              </div>
            </>
          )}
          <div>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Sales Price</p>
            <p style={{ fontWeight: 600, fontSize: '18px', margin: 0, color: isDarkMode ? '#ffffff' : '#111827' }}>
              {formatCurrency(item.sales_price)}
            </p>
          </div>
          {item.item_type === 'inventory' && (
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Margin</p>
              <p style={{ fontWeight: 500, color: '#16a34a', margin: 0 }}>
                {formatCurrency(profitAmount)} ({profitMargin}%)
              </p>
            </div>
          )}
        </div>
      </div>

      {item.item_type === 'inventory' && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          border: `1px solid ${isLowStock ? (isDarkMode ? '#7f1d1d' : '#fde047') : (isDarkMode ? '#3a3a3a' : '#e5e7eb')}`,
          backgroundColor: isLowStock 
            ? (isDarkMode ? '#4a1f1f' : '#fef9c3')
            : (isDarkMode ? '#2a2a2a' : '#f9fafb')
        }}>
          <h4 style={{
            fontSize: '14px',
            fontWeight: 600,
            color: isDarkMode ? '#ffffff' : '#374151',
            marginBottom: '12px'
          }}>
            Stock Information
            {isLowStock && (
              <span style={{ marginLeft: '8px', color: isDarkMode ? '#fca5a5' : '#a16207' }}>
                ⚠️ Low Stock
              </span>
            )}
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Quantity on Hand</p>
              <p style={{ fontWeight: 700, fontSize: '24px', color: '#2563eb', margin: 0 }}>
                {item.quantity_on_hand.toFixed(2)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Inventory Value</p>
              <p style={{ fontWeight: 600, fontSize: '18px', margin: 0, color: isDarkMode ? '#ffffff' : '#111827' }}>
                {formatCurrency(inventoryValue)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Reorder Point</p>
              <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#ffffff' : '#111827' }}>
                {item.reorder_point.toFixed(2)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Reorder Quantity</p>
              <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#ffffff' : '#111827' }}>
                {item.reorder_quantity.toFixed(2)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Cost Method</p>
              <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#ffffff' : '#111827' }}>
                {item.cost_method}
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <p style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}>Tax Settings</p>
        <p style={{ fontWeight: 500, margin: 0, color: isDarkMode ? '#ffffff' : '#111827' }}>
          {item.is_taxable ? 'Taxable' : 'Non-Taxable'}
        </p>
      </div>
    </div>
  )
}

function Inventory() {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  
  const [items, setItems] = useState([])
  const [revenueAccounts, setRevenueAccounts] = useState([])
  const [expenseAccounts, setExpenseAccounts] = useState([])
  const [assetAccounts, setAssetAccounts] = useState([])
  const [taxRates, setTaxRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ page: 1, limit: 50 })
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [inventoryValue, setInventoryValue] = useState(0)
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    fetchInitialData()
    fetchInventoryValue()
  }, [])

  useEffect(() => {
    fetchItems()
  }, [filters])

  const fetchInitialData = async () => {
    try {
      const accountsData = await accountService.getAllAccounts({ is_active: true })
      
      const revenue = (accountsData || []).filter(acc => acc.account_type === 'Revenue')
      const expense = (accountsData || []).filter(acc => 
        acc.account_type === 'Expense' || acc.account_type === 'COGS' || acc.account_type === 'Cost of Goods Sold'
      )
      const assets = (accountsData || []).filter(acc => 
        acc.account_type === 'Asset' && (
          acc.sub_type?.toLowerCase().includes('inventory') ||
          acc.account_name.toLowerCase().includes('inventory')
        )
      )
      
      setRevenueAccounts(revenue)
      setExpenseAccounts(expense)
      setAssetAccounts(assets)
      
      // TODO: Fetch tax rates when API is ready
      setTaxRates([])
    } catch (error) {
      showAlert('error', 'Failed to fetch initial data')
    }
  }

  const fetchItems = async () => {
    setLoading(true)
    try {
      const result = await inventoryService.getAllItems(filters)
      setItems(result.items || [])
      setPagination(result.pagination || { total: 0, page: 1, totalPages: 1 })
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to fetch items')
    } finally {
      setLoading(false)
    }
  }

  const fetchInventoryValue = async () => {
    try {
      const value = await inventoryService.getInventoryValue()
      setInventoryValue(value)
    } catch (error) {
      console.error('Failed to fetch inventory value')
    }
  }

  const handleCreateItem = async (data) => {
    try {
      await inventoryService.createItem(data)
      showAlert('success', 'Item created successfully')
      setIsCreateModalOpen(false)
      fetchItems()
      fetchInventoryValue()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to create item')
      throw error
    }
  }

  const handleUpdateItem = async (data) => {
    if (!selectedItem) return
    
    try {
      await inventoryService.updateItem(selectedItem.id, data)
      showAlert('success', 'Item updated successfully')
      setIsEditModalOpen(false)
      setSelectedItem(null)
      fetchItems()
      fetchInventoryValue()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to update item')
      throw error
    }
  }

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.item_name}"?`)) {
      return
    }

    try {
      await inventoryService.deleteItem(item.id)
      showAlert('success', 'Item deleted successfully')
      fetchItems()
      fetchInventoryValue()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to delete item')
    }
  }

  const handleAdjustInventory = async (data) => {
    try {
      await inventoryService.adjustInventory(data)
      showAlert('success', 'Inventory adjusted successfully')
      setIsAdjustModalOpen(false)
      setSelectedItem(null)
      fetchItems()
      fetchInventoryValue()
    } catch (error) {
      showAlert('error', error.response?.data?.message || 'Failed to adjust inventory')
      throw error
    }
  }

  const showAlert = (type, message) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleClearFilters = () => {
    setFilters({ page: 1, limit: 50 })
  }

  const handlePageChange = (newPage) => {
    setFilters({ ...filters, page: newPage })
  }

  if (loading && items.length === 0) {
    return <LoadingSpinner size="lg" text="Loading inventory..." />
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: 700, color: isDarkMode ? '#ffffff' : '#111827', margin: 0 }}>
            Inventory
          </h1>
          <p style={{ fontSize: '16px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>
            Manage products and track stock levels
          </p>
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', margin: 0 }}>
              Total Inventory Value
            </p>
            <p style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#2563eb',
              margin: 0
            }}>
              ${inventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>+ New Item</Button>
        </div>
      </div>

      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <ItemFilters
        filters={filters}
        onFilterChange={setFilters}
        onClearFilters={handleClearFilters}
      />

      <div style={{
        backgroundColor: isDarkMode ? '#1f1f1f' : 'white',
        borderRadius: '8px',
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', margin: 0 }}>
            Showing {items.length} of {pagination.total} items
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={filters.page === 1}
              size="sm"
              variant="secondary"
            >
              Previous
            </Button>
            <span style={{ padding: '4px 12px', fontSize: '14px', color: isDarkMode ? '#ffffff' : '#111827' }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={filters.page === pagination.totalPages}
              size="sm"
              variant="secondary"
            >
              Next
            </Button>
          </div>
        </div>
        
        <ItemTable
          items={items}
          onView={(item) => {
            setSelectedItem(item)
            setIsViewModalOpen(true)
          }}
          onEdit={(item) => {
            setSelectedItem(item)
            setIsEditModalOpen(true)
          }}
          onAdjust={(item) => {
            setSelectedItem(item)
            setIsAdjustModalOpen(true)
          }}
          onDelete={handleDeleteItem}
        />
      </div>

      {/* Modals */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Item"
        size="xl"
      >
        <ItemForm
          revenueAccounts={revenueAccounts}
          expenseAccounts={expenseAccounts}
          assetAccounts={assetAccounts}
          taxRates={taxRates}
          onSubmit={handleCreateItem}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedItem(null)
        }}
        title="Edit Item"
        size="xl"
      >
        <ItemForm
          item={selectedItem}
          revenueAccounts={revenueAccounts}
          expenseAccounts={expenseAccounts}
          assetAccounts={assetAccounts}
          taxRates={taxRates}
          onSubmit={handleUpdateItem}
          onCancel={() => {
            setIsEditModalOpen(false)
            setSelectedItem(null)
          }}
        />
      </Modal>

      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false)
          setSelectedItem(null)
        }}
        title="Adjust Inventory"
        size="md"
      >
        {selectedItem && (
          <InventoryAdjustmentModal
            item={selectedItem}
            onSubmit={handleAdjustInventory}
            onCancel={() => {
              setIsAdjustModalOpen(false)
              setSelectedItem(null)
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setSelectedItem(null)
        }}
        title="Item Details"
        size="lg"
      >
        {selectedItem && (
          <ItemDetailView item={selectedItem} />
        )}
      </Modal>
    </div>
  )
}

export default Inventory
