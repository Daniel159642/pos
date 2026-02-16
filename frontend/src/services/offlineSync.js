/**
 * Offline-first fetch: read from local cache first (GET), then revalidate from network.
 * Mutations (POST/PATCH/DELETE) go to network; on failure or offline, queue for later sync.
 */
import { getApiUrl } from '../utils/backendUrl'
import {
  cacheKeyForGet,
  getCachedResponse,
  setCachedResponse,
  addPendingWrite,
  getPendingWrites,
  removePendingWrite
} from './localDb'

const CACHE_MAX_AGE_MS = 5 * 60 * 1000 // 5 min - consider cached data stale when online
const OFFLINE_CACHE_DAYS = 7 // Inventory, settings, and recent orders (cached list) kept this long when offline
const OFFLINE_CACHE_MS = OFFLINE_CACHE_DAYS * 24 * 60 * 60 * 1000

// In-memory cache for instant load when revisiting a page (avoids waiting on IndexedDB)
const memoryCache = new Map()
const MEMORY_MAX_AGE_MS = 30 * 60 * 1000 // 30 min in memory

const CACHEABLE_PATTERNS = [
  /^\/api\/inventory(\?|$)/,
  /^\/api\/orders(\?|$)/,
  /^\/api\/vendors(\?|$)/,
  /^\/api\/categories(\?|$)/,
  // Settings (saved locally for offline use)
  /^\/api\/receipt-settings(\?|$)/,
  /^\/api\/receipt-templates(\?|$)/,
  /^\/api\/pos-settings(\?|$)/,
  /^\/api\/settings-bootstrap(\?|$)/,
  /^\/api\/store-location-settings(\?|$)/,
  /^\/api\/customer-display\/settings(\?|$)/,
  /^\/api\/customer-rewards-settings(\?|$)/,
  /^\/api\/accounting\/settings(\?|$)/,
  /^\/api\/order-delivery-settings(\?|$)/,
  /^\/api\/payment-methods(\?|$)/,
  /^\/api\/register\/cash-settings(\?|$)/,
  /^\/api\/register\/session(\?|$)/,
  /^\/api\/register\/events(\?|$)/,
  /^\/api\/register\/summary(\?|$)/,
  /^\/api\/register\/daily-count(\?|$)/,
  /^\/api\/receipt-templates(\?|$)/,
  /^\/api\/pos-bootstrap(\?|$)/
]

function isCacheableUrl(url) {
  const path = url.replace(/^https?:\/\/[^/]+/, '') || url
  return CACHEABLE_PATTERNS.some((re) => re.test(path))
}

function getSessionHeaders(opts = {}) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('sessionToken') : null
  const headers = {}
  // GET requests must not send Content-Type: application/json (Flask will try to parse empty body as JSON and return 400)
  if (!opts.skipContentType) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers['X-Session-Token'] = token
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

/**
 * Fetch with offline support: GET uses cache-first then revalidate; mutations are queued when offline.
 * @param {string} url - Relative path e.g. '/api/inventory?limit=50'
 * @param {RequestInit} options - fetch options (method, body, etc.)
 * @param {{ skipCache?: boolean }} opts - skipCache: true to bypass cache for this request
 * @returns {Promise<Response>} - Response (caller should .json() etc. as usual)
 */
export async function cachedFetch(url, options = {}, opts = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const fullUrl = getApiUrl(url)

  if (method === 'GET' && isCacheableUrl(url) && !opts.skipCache) {
    const key = cacheKeyForGet(fullUrl)
    const mem = memoryCache.get(key)
    if (mem && mem.updatedAt && (Date.now() - mem.updatedAt) <= MEMORY_MAX_AGE_MS) {
      const headers = new Headers()
      headers.set('Content-Type', 'application/json')
      const res = new Response(JSON.stringify(mem.data), {
        status: 200,
        headers,
        statusText: 'OK'
      })
      Object.defineProperty(res, '_fromCache', { value: true })
      if (navigator.onLine) {
        fetch(fullUrl, { ...options, headers: getSessionHeaders({ skipContentType: true }) })
          .then(async (r) => {
            if (r.ok) {
              const data = await r.json()
              memoryCache.set(key, { data, updatedAt: Date.now() })
              await setCachedResponse(key, data)
            }
          })
          .catch(() => {})
      }
      return res
    }
    const cached = await getCachedResponse(key, CACHE_MAX_AGE_MS)
    if (cached != null) {
      memoryCache.set(key, { data: cached, updatedAt: Date.now() })
      const headers = new Headers()
      headers.set('Content-Type', 'application/json')
      const res = new Response(JSON.stringify(cached), {
        status: 200,
        headers,
        statusText: 'OK'
      })
      Object.defineProperty(res, '_fromCache', { value: true })
      if (navigator.onLine) {
        fetch(fullUrl, { ...options, headers: getSessionHeaders({ skipContentType: true }) })
          .then(async (r) => {
            if (r.ok) {
              const data = await r.json()
              memoryCache.set(key, { data, updatedAt: Date.now() })
              await setCachedResponse(key, data)
            }
          })
          .catch(() => {})
      }
      return res
    }
  }

  if (!navigator.onLine) {
    if (method !== 'GET') {
      await addPendingWrite({
        method,
        url: fullUrl,
        body: options.body != null ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
        headers: getSessionHeaders()
      })
      const err = new Error('Offline: request queued for sync')
      err.queued = true
      throw err
    }
    const key = cacheKeyForGet(fullUrl)
    const memOffline = memoryCache.get(key)
    if (memOffline && memOffline.updatedAt && (Date.now() - memOffline.updatedAt) <= OFFLINE_CACHE_MS) {
      const res = new Response(JSON.stringify(memOffline.data), {
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        statusText: 'OK'
      })
      Object.defineProperty(res, '_fromCache', { value: true })
      return res
    }
    const cached = await getCachedResponse(key, OFFLINE_CACHE_MS)
    if (cached != null) {
      memoryCache.set(key, { data: cached, updatedAt: Date.now() })
      const res = new Response(JSON.stringify(cached), {
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        statusText: 'OK'
      })
      Object.defineProperty(res, '_fromCache', { value: true })
      return res
    }
    const err = new Error('Offline and no cached data')
    err.offline = true
    throw err
  }

  const res = await fetch(fullUrl, {
    ...options,
    headers: { ...getSessionHeaders({ skipContentType: method === 'GET' }), ...(options.headers || {}) }
  })

  if (method === 'GET' && res.ok && isCacheableUrl(url) && !opts.skipCache) {
    try {
      const clone = res.clone()
      const data = await clone.json()
      const key = cacheKeyForGet(fullUrl)
      memoryCache.set(key, { data, updatedAt: Date.now() })
      await setCachedResponse(key, data)
    } catch (_) {}
  }

  return res
}

/**
 * Drain pending writes (call on 'online').
 * @param {{ onSuccess?: () => void, onFailure?: (err: any) => void }} callbacks
 * @returns {Promise<{ sent: number, failed: number }>}
 */
export async function drainPendingWrites(callbacks = {}) {
  const pending = await getPendingWrites()
  let sent = 0
  let failed = 0
  const headers = getSessionHeaders()

  for (const row of pending) {
    try {
      const res = await fetch(row.url, {
        method: row.method,
        headers: { ...headers, ...(row.headers || {}) },
        body: row.body
      })
      if (res.status === 401) {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('sessionToken')
          localStorage.removeItem('pos_employee')
        }
        callbacks.onFailure?.(new Error('Session expired'))
        break
      }
      if (res.ok || (res.status >= 400 && row.method !== 'POST')) {
        await removePendingWrite(row.id)
        sent++
        callbacks.onSuccess?.()
      } else {
        failed++
      }
    } catch (e) {
      failed++
      callbacks.onFailure?.(e)
    }
  }

  return { sent, failed }
}
