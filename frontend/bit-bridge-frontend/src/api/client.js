// frontend/bit-bridge-frontend/src/api/client.js

import axios from 'axios'
import { API_BASE_URL } from './config'

/**
 * Normalize base URL to avoid double slashes
 */
const normalizeBaseUrl = (url) => (url ? url.replace(/\/+$/, '') : '')

/**
 * Keep token key consistent everywhere
 */
export const TOKEN_KEY = 'bitglobal'
export const REFRESH_TOKEN_KEY = 'refresh-token'

/**
 * Read token safely:
 * - supports plain string token
 * - supports JSON stored token: {"token":"..."} / {"access_token":"..."}
 * - strips accidental quotes and "Bearer "
 */
export const getToken = () => {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null

    // common case: token string already
    if (/^Bearer\s+/i.test(raw)) return raw.replace(/^Bearer\s+/i, '').trim()
    if (raw.startsWith('ey')) return raw.trim()

    // sometimes stored as JSON
    try {
      const obj = JSON.parse(raw)
      const t = obj?.token || obj?.access_token || obj?.jwt
      if (t) return String(t).replace(/^Bearer\s+/i, '').trim()
    } catch {
      // ignore
    }

    // fallback
    return String(raw).replace(/^"+|"+$/g, '').replace(/^Bearer\s+/i, '').trim()
  } catch {
    return null
  }
}

export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // no-op
  }
}

export const clearAuthStorage = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem('email')
  } catch {
    // no-op
  }
}

/**
 * Central Axios client
 * All /api/v1 calls should use this instance
 *
 * IMPORTANT:
 * config.js should already export API_BASE_URL like:
 *   https://.../api/v1
 * So do NOT append /api/v1 here.
 */
const client = axios.create({
  baseURL: normalizeBaseUrl(API_BASE_URL), // ✅ exactly .../api/v1
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
  withCredentials: false,
})

/**
 * Automatically attach auth token to every request
 */
client.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    config.headers.Accept = 'application/json'
    return config
  },
  (error) => Promise.reject(error)
)

/**
 * Handle 401 globally
 */
const isAuthPage = () => {
  const p = window.location.pathname
  return (
    p.startsWith('/login') ||
    p.startsWith('/signup') ||
    p.startsWith('/check-email') ||
    p.startsWith('/confirmation')
  )
}

client.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status

    if (status === 401) {
      // Only force-login redirect if the user had a token (session expired / invalid token)
      const hadToken = !!getToken()

      clearAuthStorage()

      try {
        window.dispatchEvent(new CustomEvent('bitbridge:unauthorized'))
      } catch {
        // no-op
      }

      if (hadToken && !isAuthPage()) {
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.assign(`/login?returnTo=${returnTo}`)
      }
    }

    return Promise.reject(error)
  }
)

export default client
