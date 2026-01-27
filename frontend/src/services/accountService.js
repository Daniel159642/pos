import api from './api'

class AccountService {
  constructor() {
    this.basePath = '/accounts'
  }

  async getAllAccounts(filters = {}) {
    const params = new URLSearchParams()
    
    if (filters.account_type) params.append('account_type', filters.account_type)
    if (filters.is_active !== undefined) params.append('is_active', String(filters.is_active))
    if (filters.parent_account_id) params.append('parent_account_id', String(filters.parent_account_id))
    if (filters.search) params.append('search', filters.search)

    const response = await api.get(`${this.basePath}?${params.toString()}`)
    return response.data.data || response.data
  }

  async getAccountById(id) {
    const response = await api.get(`${this.basePath}/${id}`)
    return response.data.data
  }

  async createAccount(data) {
    const response = await api.post(this.basePath, data)
    return response.data.data
  }

  async updateAccount(id, data) {
    const response = await api.put(`${this.basePath}/${id}`, data)
    return response.data.data
  }

  async deleteAccount(id) {
    await api.delete(`${this.basePath}/${id}`)
  }

  async getAccountTree(rootId) {
    const params = rootId ? `?rootId=${rootId}` : ''
    const response = await api.get(`${this.basePath}/tree${params}`)
    return response.data.data
  }

  async getAccountChildren(id) {
    const response = await api.get(`${this.basePath}/${id}/children`)
    return response.data.data
  }

  async getAccountBalance(id, asOfDate) {
    const params = asOfDate ? `?asOfDate=${asOfDate}` : ''
    const response = await api.get(`${this.basePath}/${id}/balance${params}`)
    return response.data.data
  }

  async toggleAccountStatus(id) {
    const response = await api.patch(`${this.basePath}/${id}/toggle-status`)
    return response.data.data
  }
}

export default new AccountService()
