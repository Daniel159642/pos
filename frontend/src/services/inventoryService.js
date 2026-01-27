import api from './api'

class InventoryService {
  constructor() {
    this.basePath = '/inventory'
  }

  async getAllItems(filters = {}) {
    const params = new URLSearchParams()
    
    if (filters.item_type) params.append('item_type', filters.item_type)
    if (filters.is_active !== undefined) params.append('is_active', String(filters.is_active))
    if (filters.low_stock) params.append('low_stock', 'true')
    if (filters.category_id) params.append('category_id', String(filters.category_id))
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.limit) params.append('limit', String(filters.limit))

    const response = await api.get(`${this.basePath}/items?${params.toString()}`)
    return {
      items: response.data.data || [],
      pagination: response.data.pagination || { total: 0, page: 1, limit: 50, total_pages: 1 }
    }
  }

  async getItemById(id) {
    const response = await api.get(`${this.basePath}/items/${id}`)
    return response.data.data
  }

  async createItem(data) {
    const response = await api.post(`${this.basePath}/items`, data)
    return response.data.data
  }

  async updateItem(id, data) {
    const response = await api.put(`${this.basePath}/items/${id}`, data)
    return response.data.data
  }

  async deleteItem(id) {
    await api.delete(`${this.basePath}/items/${id}`)
  }

  async adjustInventory(data) {
    const response = await api.post(`${this.basePath}/adjust`, data)
    return response.data.data
  }

  async getLowStockItems() {
    const response = await api.get(`${this.basePath}/low-stock`)
    return response.data.data || []
  }

  async getInventoryValue() {
    const response = await api.get(`${this.basePath}/value`)
    return response.data.data.total_inventory_value || 0
  }

  async getInventoryReport() {
    const response = await api.get(`${this.basePath}/report`)
    return response.data.data || []
  }

  async getItemHistory(id, limit) {
    const params = limit ? `?limit=${limit}` : ''
    const response = await api.get(`${this.basePath}/items/${id}/history${params}`)
    return response.data.data || []
  }
}

export default new InventoryService()
