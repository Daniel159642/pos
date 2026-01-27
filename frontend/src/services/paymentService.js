import api from './api'

class PaymentService {
  constructor() {
    this.basePath = '/payments'
  }

  async getAllPayments(filters = {}) {
    const params = new URLSearchParams()
    if (filters.customer_id) params.append('customer_id', String(filters.customer_id))
    if (filters.payment_method) params.append('payment_method', filters.payment_method)
    if (filters.status) params.append('status', filters.status)
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))

    const response = await api.get(`${this.basePath}?${params.toString()}`)
    return {
      payments: response.data.data || [],
      pagination: response.data.pagination || { total: 0, page: 1, limit: 50, total_pages: 1 }
    }
  }

  async getPaymentById(id) {
    const response = await api.get(`${this.basePath}/${id}`)
    return response.data.data
  }

  async createPayment(data) {
    const response = await api.post(this.basePath, data)
    return response.data.data
  }

  async updatePayment(id, data) {
    const response = await api.put(`${this.basePath}/${id}`, data)
    return response.data.data
  }

  async deletePayment(id) {
    await api.delete(`${this.basePath}/${id}`)
  }

  async voidPayment(id, reason) {
    const response = await api.post(`${this.basePath}/${id}/void`, { reason })
    return response.data.data
  }

  async getCustomerOutstandingInvoices(customerId) {
    const response = await api.get(`${this.basePath}/customer/${customerId}/outstanding`)
    return response.data.data || []
  }

  async getPaymentReceipt(id) {
    const response = await api.get(`${this.basePath}/${id}/receipt`)
    return response.data.data
  }
}

export default new PaymentService()
