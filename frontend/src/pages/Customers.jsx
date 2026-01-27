import React, { useState, useEffect } from 'react'
import customerService from '../services/customerService'
import CustomerTable from '../components/customers/CustomerTable'
import CustomerForm from '../components/customers/CustomerForm'
import CustomerFilters from '../components/customers/CustomerFilters'
import CustomerDetailModal from '../components/customers/CustomerDetailModal'
import Modal from '../components/common/Modal'
import Button from '../components/common/Button'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Alert from '../components/common/Alert'

function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ page: 1, limit: 50 })
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 })
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerBalance, setCustomerBalance] = useState(null)
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    fetchCustomers()
  }, [filters.page, filters.limit, filters.customer_type, filters.is_active, filters.search])

  async function fetchCustomers() {
    setLoading(true)
    try {
      const result = await customerService.getAllCustomers(filters)
      setCustomers(result.customers || [])
      setPagination(result.pagination || { total: 0, page: 1, total_pages: 1 })
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch customers'
      showAlert('error', msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateCustomer(data) {
    try {
      await customerService.createCustomer(data)
      showAlert('success', 'Customer created successfully')
      setIsCreateModalOpen(false)
      fetchCustomers()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create customer'
      showAlert('error', msg)
      throw err
    }
  }

  async function handleUpdateCustomer(data) {
    if (!selectedCustomer) return
    try {
      await customerService.updateCustomer(selectedCustomer.id, data)
      showAlert('success', 'Customer updated successfully')
      setIsEditModalOpen(false)
      setSelectedCustomer(null)
      fetchCustomers()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update customer'
      showAlert('error', msg)
      throw err
    }
  }

  async function handleDeleteCustomer(customer) {
    const name = customer.display_name || customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.customer_number
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return
    try {
      await customerService.deleteCustomer(customer.id)
      showAlert('success', 'Customer deleted successfully')
      fetchCustomers()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete customer'
      showAlert('error', msg)
    }
  }

  async function handleToggleStatus(customer) {
    try {
      await customerService.toggleCustomerStatus(customer.id)
      showAlert('success', `Customer ${customer.is_active ? 'deactivated' : 'activated'} successfully`)
      fetchCustomers()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to toggle customer status'
      showAlert('error', msg)
    }
  }

  async function handleViewCustomer(customer) {
    try {
      const balance = await customerService.getCustomerBalance(customer.id)
      setCustomerBalance(balance)
      setSelectedCustomer(customer)
      setIsViewModalOpen(true)
    } catch (err) {
      showAlert('error', 'Failed to fetch customer details')
    }
  }

  function showAlert(type, message) {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  function handleClearFilters() {
    setFilters({ page: 1, limit: 50 })
  }

  function handlePageChange(newPage) {
    setFilters((f) => ({ ...f, page: newPage }))
  }

  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const page = pagination.page || 1
  const totalPages = pagination.total_pages || 1
  const total = pagination.total || 0

  if (loading && customers.length === 0) {
    return (
      <div style={{ padding: '32px' }}>
        <LoadingSpinner size="lg" text="Loading customers..." />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: isDarkMode ? '#fff' : '#111', margin: 0 }}>Customers</h1>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Manage your customer database</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>+ New Customer</Button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <CustomerFilters filters={filters} onFilterChange={setFilters} onClearFilters={handleClearFilters} />

      <div style={{
        backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
        borderRadius: '8px',
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${isDarkMode ? '#3a3a3a' : '#e5e7eb'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', margin: 0 }}>
            Showing {customers.length} of {total} customers
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', padding: '0 8px' }}>
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px' }}>
            <LoadingSpinner size="md" text="Loading..." />
          </div>
        ) : (
          <CustomerTable
            customers={customers}
            onView={handleViewCustomer}
            onEdit={(c) => {
              setSelectedCustomer(c)
              setIsEditModalOpen(true)
            }}
            onDelete={handleDeleteCustomer}
            onToggleStatus={handleToggleStatus}
          />
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Customer" size="xl">
        <CustomerForm onSubmit={handleCreateCustomer} onCancel={() => setIsCreateModalOpen(false)} />
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedCustomer(null) }}
        title="Edit Customer"
        size="xl"
      >
        <CustomerForm
          customer={selectedCustomer}
          onSubmit={handleUpdateCustomer}
          onCancel={() => { setIsEditModalOpen(false); setSelectedCustomer(null) }}
        />
      </Modal>

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => { setIsViewModalOpen(false); setSelectedCustomer(null); setCustomerBalance(null) }}
        title="Customer Details"
        size="lg"
      >
        {selectedCustomer && (
          <CustomerDetailModal customer={selectedCustomer} balance={customerBalance} />
        )}
      </Modal>
    </div>
  )
}

export default Customers
