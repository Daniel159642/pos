import api from './api'

class InvoiceService {
  constructor() {
    this.basePath = '/invoices'
  }

  async getAllInvoices(filters = {}) {
    const params = new URLSearchParams()
    if (filters.customer_id) params.append('customer_id', String(filters.customer_id))
    if (filters.status) params.append('status', filters.status)
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)
    if (filters.overdue_only) params.append('overdue_only', 'true')
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))

    const response = await api.get(`${this.basePath}?${params.toString()}`)
    return {
      invoices: response.data.data || [],
      pagination: response.data.pagination || { total: 0, page: 1, limit: 50, total_pages: 1 }
    }
  }

  async getInvoiceById(id) {
    const response = await api.get(`${this.basePath}/${id}`)
    return response.data.data
  }

  async createInvoice(data) {
    const response = await api.post(this.basePath, data)
    return response.data.data
  }

  async updateInvoice(id, data) {
    const response = await api.put(`${this.basePath}/${id}`, data)
    return response.data.data
  }

  async deleteInvoice(id) {
    await api.delete(`${this.basePath}/${id}`)
  }

  async markAsSent(id) {
    const response = await api.post(`${this.basePath}/${id}/send`)
    return response.data.data
  }

  async voidInvoice(id, reason) {
    const response = await api.post(`${this.basePath}/${id}/void`, { reason })
    return response.data.data
  }

  async getOverdueInvoices() {
    const response = await api.get(`${this.basePath}/overdue`)
    return response.data.data || []
  }
}

export default new InvoiceService()
