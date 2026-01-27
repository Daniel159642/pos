import api from './api'

class CustomerService {
  constructor() {
    this.basePath = '/customers'
  }

  async getAllCustomers(filters = {}) {
    const params = new URLSearchParams()
    if (filters.customer_type) params.append('customer_type', filters.customer_type)
    if (filters.is_active !== undefined) params.append('is_active', String(filters.is_active))
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))

    const response = await api.get(`${this.basePath}?${params.toString()}`)
    return {
      customers: response.data.data || [],
      pagination: response.data.pagination || { total: 0, page: 1, limit: 50, total_pages: 1 }
    }
  }

  async getCustomerById(id) {
    const response = await api.get(`${this.basePath}/${id}`)
    return response.data.data
  }

  async createCustomer(data) {
    const response = await api.post(this.basePath, data)
    return response.data.data
  }

  async updateCustomer(id, data) {
    const response = await api.put(`${this.basePath}/${id}`, data)
    return response.data.data
  }

  async deleteCustomer(id) {
    await api.delete(`${this.basePath}/${id}`)
  }

  async toggleCustomerStatus(id) {
    const response = await api.patch(`${this.basePath}/${id}/toggle-status`)
    return response.data.data
  }

  async searchCustomers(searchTerm) {
    const response = await api.get(`${this.basePath}/search?q=${encodeURIComponent(searchTerm)}`)
    return response.data.data || []
  }

  async getCustomerBalance(id) {
    const response = await api.get(`${this.basePath}/${id}/balance`)
    return response.data.data
  }

  async getCustomerInvoices(id, limit = 10) {
    const suffix = limit ? `?limit=${limit}` : ''
    const response = await api.get(`${this.basePath}/${id}/invoices${suffix}`)
    return response.data.data || []
  }

  async getCustomerStatement(id, startDate, endDate) {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    const qs = params.toString()
    const suffix = qs ? `?${qs}` : ''
    const response = await api.get(`${this.basePath}/${id}/statement${suffix}`)
    return response.data.data
  }
}

export default new CustomerService()
