import axios from 'axios'

const client = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT access token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, attempt silent token refresh then retry original request
let isRefreshing = false
let refreshQueue: ((token: string) => void)[] = []

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise((resolve) => {
        refreshQueue.push((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`
          resolve(client(original))
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const res = await axios.post('/api/auth/token/refresh/', { refresh: refreshToken })
      const newToken = res.data.access
      localStorage.setItem('access_token', newToken)

      // Flush queued requests
      refreshQueue.forEach((cb) => cb(newToken))
      refreshQueue = []

      original.headers.Authorization = `Bearer ${newToken}`
      return client(original)
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)

export default client
