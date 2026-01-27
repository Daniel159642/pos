import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add session token if available
    const token = localStorage.getItem('sessionToken')
    if (token) {
      config.headers['X-Session-Token'] = token
      config.headers['Authorization'] = `Bearer ${token}`
    }

    if (import.meta.env.DEV) {
      console.log('📤 Request:', config.method?.toUpperCase(), config.url)
    }

    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log('📥 Response:', response.status, response.config.url)
    }
    return response
  },
  (error) => {
    if (error.response) {
      console.error('Response error:', error.response.status, error.response.data)
      
      // Handle specific error codes
      if (error.response.status === 401) {
        // Unauthorized - could redirect to login
        localStorage.removeItem('sessionToken')
      }
    } else if (error.request) {
      console.error('No response received:', error.request)
    } else {
      console.error('Error:', error.message)
    }
    
    return Promise.reject(error)
  }
)

export default api
