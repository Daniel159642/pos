import React, { useState, useEffect } from 'react'
import vendorService from '../services/vendorService'
import VendorTable from '../components/vendors/VendorTable'
import VendorForm from '../components/vendors/VendorForm'
import VendorFilters from '../components/vendors/VendorFilters'
import VendorDetailModal from '../components/vendors/VendorDetailModal'
import Modal from '../components/common/Modal'
import Button from '../components/common/Button'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Alert from '../components/common/Alert'

function Vendors() {
  const isDarkMode = document.documentElement.classList.contains('dark-theme')
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ page: 1, limit: 50 })
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 })
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [vendorBalance, setVendorBalance] = useState(null)
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    fetchVendors()
  }, [filters.page, filters.limit, filters.is_1099_vendor, filters.is_active, filters.search])

  async function fetchVendors() {
    setLoading(true)
    try {
      const result = await vendorService.getAllVendors(filters)
      setVendors(result.vendors || [])
      setPagination(result.pagination || { total: 0, page: 1, total_pages: 1 })
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch vendors'
      showAlert('error', msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateVendor(data) {
    try {
      await vendorService.createVendor(data)
      showAlert('success', 'Vendor created successfully')
      setIsCreateModalOpen(false)
      fetchVendors()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create vendor'
      showAlert('error', msg)
      throw err
    }
  }

  async function handleUpdateVendor(data) {
    if (!selectedVendor) return
    try {
      await vendorService.updateVendor(selectedVendor.id, data)
      showAlert('success', 'Vendor updated successfully')
      setIsEditModalOpen(false)
      setSelectedVendor(null)
      fetchVendors()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update vendor'
      showAlert('error', msg)
      throw err
    }
  }

  async function handleDeleteVendor(vendor) {
    if (!window.confirm(`Are you sure you want to delete "${vendor.vendor_name}"?`)) return
    try {
      await vendorService.deleteVendor(vendor.id)
      showAlert('success', 'Vendor deleted successfully')
      fetchVendors()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete vendor'
      showAlert('error', msg)
    }
  }

  async function handleToggleStatus(vendor) {
    try {
      await vendorService.toggleVendorStatus(vendor.id)
      showAlert('success', `Vendor ${vendor.is_active ? 'deactivated' : 'activated'} successfully`)
      fetchVendors()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to toggle vendor status'
      showAlert('error', msg)
    }
  }

  async function handleViewVendor(vendor) {
    try {
      const balance = await vendorService.getVendorBalance(vendor.id)
      setVendorBalance(balance)
      setSelectedVendor(vendor)
      setIsViewModalOpen(true)
    } catch (err) {
      showAlert('error', 'Failed to fetch vendor details')
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

  const page = pagination.page || 1
  const totalPages = pagination.total_pages || 1
  const total = pagination.total || 0

  if (loading && vendors.length === 0) {
    return (
      <div style={{ padding: '32px' }}>
        <LoadingSpinner size="lg" text="Loading vendors..." />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: isDarkMode ? '#fff' : '#111', margin: 0 }}>Vendors</h1>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: '4px' }}>Manage your vendor/supplier database</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>+ New Vendor</Button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      <VendorFilters filters={filters} onFilterChange={setFilters} onClearFilters={handleClearFilters} />

      <div
        style={{
          backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
          borderRadius: '8px',
          boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid ' + (isDarkMode ? '#3a3a3a' : '#e5e7eb'),
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <p style={{ fontSize: '14px', color: isDarkMode ? '#9ca3af' : '#6b7280', margin: 0 }}>
            Showing {vendors.length} of {total} vendors
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button type="button" size="sm" variant="secondary" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
              Previous
            </Button>
            <span style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', padding: '0 8px' }}>
              Page {page} of {totalPages}
            </span>
            <Button type="button" size="sm" variant="secondary" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px' }}>
            <LoadingSpinner size="md" text="Loading..." />
          </div>
        ) : (
          <VendorTable
            vendors={vendors}
            onView={handleViewVendor}
            onEdit={(v) => {
              setSelectedVendor(v)
              setIsEditModalOpen(true)
            }}
            onDelete={handleDeleteVendor}
            onToggleStatus={handleToggleStatus}
          />
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Vendor" size="xl">
        <VendorForm onSubmit={handleCreateVendor} onCancel={() => setIsCreateModalOpen(false)} />
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedVendor(null)
        }}
        title="Edit Vendor"
        size="xl"
      >
        <VendorForm
          vendor={selectedVendor}
          onSubmit={handleUpdateVendor}
          onCancel={() => {
            setIsEditModalOpen(false)
            setSelectedVendor(null)
          }}
        />
      </Modal>

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false)
          setSelectedVendor(null)
          setVendorBalance(null)
        }}
        title="Vendor Details"
        size="lg"
      >
        {selectedVendor && <VendorDetailModal vendor={selectedVendor} balance={vendorBalance} />}
      </Modal>
    </div>
  )
}

export default Vendors
