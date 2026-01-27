import api from './api'

class BillService {
  constructor() {
    this.basePath = '/bills'
  }

  async getAllBills(filters = {}) {
    const params = new URLSearchParams()
    if (filters.vendor_id) params.append('vendor_id', String(filters.vendor_id))
    if (filters.status) params.append('status', filters.status)
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)
    if (filters.overdue_only) params.append('overdue_only', 'true')
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))

    const response = await api.get(`${this.basePath}?${params.toString()}`)
    return {
      bills: response.data.data || [],
      pagination: response.data.pagination || { total: 0, page: 1, limit: 50, total_pages: 1 }
    }
  }

  async getBillById(id) {
    const response = await api.get(`${this.basePath}/${id}`)
    return response.data.data
  }

  async createBill(data) {
    const response = await api.post(this.basePath, data)
    return response.data.data
  }

  async updateBill(id, data) {
    const response = await api.put(`${this.basePath}/${id}`, data)
    return response.data.data
  }

  async deleteBill(id) {
    await api.delete(`${this.basePath}/${id}`)
  }

  async voidBill(id, reason) {
    const response = await api.post(`${this.basePath}/${id}/void`, { reason })
    return response.data.data
  }

  async getOverdueBills() {
    const response = await api.get(`${this.basePath}/overdue`)
    return response.data.data || []
  }
}

export default new BillService()
