import axios from 'axios'
import { API_BASE_URL } from './config'
import {
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  getAccessToken,
  clearAccessToken,
  clearAuthStorage as clearAuthStorageStore,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  cookieAuthEnabled,
} from '../auth/tokenStore'

/**
 * Normalize base URL to avoid double slashes
 */
const normalizeBaseUrl = (url) => (url ? url.replace(/\/+$/, '') : '')
const stripApiV1Suffix = (url) => normalizeBaseUrl(url).replace(/\/api\/v1$/i, '')

const ROOT_BASE_URL = stripApiV1Suffix(API_BASE_URL)

let refreshPromise = null

const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken()
  if (!refreshToken && !cookieAuthEnabled()) {
    throw new Error('No refresh token stored')
  }

  const response = await fetch(`${ROOT_BASE_URL}/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(refreshToken ? { 'Bit-Refresh-Token': refreshToken } : {}),
    },
    credentials: cookieAuthEnabled() ? 'include' : 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`Refresh failed (${response.status})`)
  }

  const raw = (await response.text()).trim()
  let parsed = null
  try {
    parsed = raw ? JSON.parse(raw) : null
  } catch {
    parsed = null
  }

  const parsedToken =
    typeof parsed === 'string'
      ? parsed
      : parsed && (parsed.access_token || parsed.token || parsed.jwt)

  const token = (parsedToken || raw || '').replace(/^"|"$/g, '') || null

  if (token) setAccessToken(token)
  if (parsed?.refresh_token) setRefreshToken(parsed.refresh_token)

  return {
    access_token: token,
    refresh_token: parsed?.refresh_token,
  }
}

/**
 * Keep token key consistent everywhere
 */
export { TOKEN_KEY, REFRESH_TOKEN_KEY }

/**
 * Read token safely:
 * - supports plain string token
 * - supports JSON stored token: {"token":"..."} / {"access_token":"..."}
 * - strips accidental quotes and "Bearer "
 */
export const getToken = () => getAccessToken()

export const clearToken = () => {
  clearAccessToken()
}

export const clearAuthStorage = () => {
  clearAuthStorageStore()
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
  withCredentials: cookieAuthEnabled(),
})

/**
 * Automatically attach auth token to every request
 */
client.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    config.headers.Accept = 'application/json'
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (typeof config.headers?.set === 'function') {
        config.headers.set('Content-Type', undefined)
      } else {
        delete config.headers?.['Content-Type']
        delete config.headers?.['content-type']
      }
    }
    try {
      window.dispatchEvent(new Event('bitbridge:activity'))
    } catch {
      // no-op
    }
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

const isPaymentVerificationPage = () => {
  const p = window.location.pathname
  return (
    p.includes('/confirm-payment') ||
    p.startsWith('/checkout') ||
    p.startsWith('/confirmation-order') ||
    p.startsWith('/app-redirect')
  )
}

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status

    const expired =
      error?.response?.data?.message === 'Signature has expired' ||
      error?.response?.data?.error === 'Signature has expired'

    if (status === 401 || expired) {
      // Only force-login redirect if the user had a token (session expired / invalid token)
      const hadToken = !!getToken()
      const originalRequest = error?.config

      if (hadToken && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true
        try {
          if (!refreshPromise) {
            refreshPromise = refreshAccessToken().finally(() => {
              refreshPromise = null
            })
          }
          const refreshed = await refreshPromise
          if (refreshed?.access_token) {
            originalRequest.headers = originalRequest.headers || {}
            originalRequest.headers.Authorization = `Bearer ${refreshed.access_token}`
          }
          return client.request(originalRequest)
        } catch {
          // fall through to logout handling
        }
      }

      if (isPaymentVerificationPage()) {
        console.info('[auth] suppressed logout on payment verification page')
        return Promise.reject(error)
      }

      clearAuthStorage()

      try {
        window.dispatchEvent(new CustomEvent('bitbridge:unauthorized'))
      } catch {
        // no-op
      }

      if (hadToken && !isAuthPage()) {
        const returnTo = window.location.pathname + window.location.search
        const params = new URLSearchParams({
          reason: 'session_expired',
          returnTo,
        })
        window.location.assign(`/login?${params.toString()}`)
      }
    }

    return Promise.reject(error)
  }
)

export default client
