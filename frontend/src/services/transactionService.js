import api from './api'

class TransactionService {
  constructor() {
    this.basePath = '/transactions'
  }

  async getAllTransactions(filters = {}) {
    const params = new URLSearchParams()
    
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)
    if (filters.account_id) params.append('account_id', String(filters.account_id))
    if (filters.transaction_type) params.append('transaction_type', filters.transaction_type)
    if (filters.is_posted !== undefined) params.append('is_posted', String(filters.is_posted))
    if (filters.is_void !== undefined) params.append('is_void', String(filters.is_void))
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))

    const response = await api.get(`${this.basePath}?${params.toString()}`)
    return {
      transactions: response.data.data || [],
      pagination: response.data.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 }
    }
  }

  async getTransactionById(id) {
    const response = await api.get(`${this.basePath}/${id}`)
    return response.data.data
  }

  async createTransaction(data) {
    const response = await api.post(this.basePath, data)
    return response.data.data
  }

  async updateTransaction(id, data) {
    const response = await api.put(`${this.basePath}/${id}`, data)
    return response.data.data
  }

  async deleteTransaction(id) {
    await api.delete(`${this.basePath}/${id}`)
  }

  async postTransaction(id) {
    const response = await api.post(`${this.basePath}/${id}/post`)
    return response.data.data
  }

  async unpostTransaction(id) {
    const response = await api.post(`${this.basePath}/${id}/unpost`)
    return response.data.data
  }

  async voidTransaction(id, reason) {
    const response = await api.post(`${this.basePath}/${id}/void`, { reason })
    return response.data.data
  }

  async getGeneralLedger(filters = {}) {
    const params = new URLSearchParams()
    if (filters.account_id) params.append('account_id', String(filters.account_id))
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)

    const response = await api.get(`${this.basePath}/general-ledger?${params.toString()}`)
    return response.data.data || []
  }

  async getAccountLedger(accountId, filters = {}) {
    const params = new URLSearchParams()
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)

    const response = await api.get(`${this.basePath}/account-ledger/${accountId}?${params.toString()}`)
    return response.data.data
  }
}

export default new TransactionService()
