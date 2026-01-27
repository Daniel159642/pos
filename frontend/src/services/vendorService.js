import api from './api'

class VendorService {
  constructor() {
    this.basePath = '/vendors'
  }

  async getAllVendors(filters = {}) {
    const params = new URLSearchParams()
    if (filters.is_1099_vendor !== undefined) params.append('is_1099_vendor', String(filters.is_1099_vendor))
    if (filters.is_active !== undefined) params.append('is_active', String(filters.is_active))
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))

    const response = await api.get(`${this.basePath}?${params.toString()}`)
    return {
      vendors: response.data.data || [],
      pagination: response.data.pagination || { total: 0, page: 1, limit: 50, total_pages: 1 }
    }
  }

  async getVendorById(id) {
    const response = await api.get(`${this.basePath}/${id}`)
    return response.data.data
  }

  async createVendor(data) {
    const response = await api.post(this.basePath, data)
    return response.data.data
  }

  async updateVendor(id, data) {
    const response = await api.put(`${this.basePath}/${id}`, data)
    return response.data.data
  }

  async deleteVendor(id) {
    await api.delete(`${this.basePath}/${id}`)
  }

  async toggleVendorStatus(id) {
    const response = await api.patch(`${this.basePath}/${id}/toggle-status`)
    return response.data.data
  }

  async searchVendors(searchTerm) {
    const response = await api.get(`${this.basePath}/search?q=${encodeURIComponent(searchTerm)}`)
    return response.data.data || []
  }

  async getVendorBalance(id) {
    const response = await api.get(`${this.basePath}/${id}/balance`)
    return response.data.data
  }

  async getVendorBills(id, limit = 10) {
    const response = await api.get(`${this.basePath}/${id}/bills?limit=${limit}`)
    return response.data.data || []
  }

  async get1099Vendors() {
    const response = await api.get(`${this.basePath}/1099`)
    return response.data.data || []
  }

  async getVendorStatement(id, startDate, endDate) {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    const qs = params.toString()
    const response = await api.get(`${this.basePath}/${id}/statement${qs ? '?' + qs : ''}`)
    return response.data.data
  }
}

export default new VendorService()
