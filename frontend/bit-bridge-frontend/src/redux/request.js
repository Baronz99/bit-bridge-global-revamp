import client, { clearToken } from '../api/client'
import { API_ROOT_URL } from '../api/config'

// NOTE: keep using your existing helper to avoid breaking other codepaths.
// But we will sanitize token values because this repo stores JSON.stringify() tokens in some places.
import { fetchToken } from '../hooks/localStorage'
import {
  TOKEN_KEY,
  cookieAuthEnabled,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../auth/tokenStore'

// Keep same signature & behavior
const request = async (url, options = {}) => {
  const { method = 'GET', headers = {}, data, params } = options
  let numberOfTries = 0

  /**
   * Some parts of the codebase store tokens via JSON.stringify(token),
   * so fetchToken() may return `"token"` (with quotes).
   * This sanitizes that safely without breaking existing storage format.
   */
  const normalizeToken = (t) => {
    if (!t) return null
    if (typeof t !== 'string') return String(t)
    const trimmed = t.trim()
    // If it looks like JSON string (e.g. "\"abc\""), parse it
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      try {
        return JSON.parse(trimmed)
      } catch {
        // fall through
      }
    }
    return trimmed
  }

  /**
   * Get refresh token. Your repo currently uses fetchToken() in refresh header,
   * but elsewhere (auth.js) you use localStorage('refresh-token').
   * We support both so we don't break existing flows.
   */
  const getRefreshTokenLegacy = () => {
    try {
      const rt = getRefreshToken()
      return normalizeToken(rt) || normalizeToken(fetchToken())
    } catch {
      return normalizeToken(fetchToken())
    }
  }

  /**
   * Refresh token call is NOT under /api/v1 in your app (per auth.js),
   * so we call API_BASE_URL + '/refresh' directly.
   */
  const refreshAccessToken = async () => {
    const refreshToken = getRefreshTokenLegacy()
    if (!refreshToken && !cookieAuthEnabled()) {
      throw new Error('No refresh token stored')
    }

    // Ensure trailing slash behavior is safe
    const base = API_ROOT_URL?.endsWith('/') ? API_ROOT_URL.slice(0, -1) : API_ROOT_URL

    const response = await fetch(`${base}/refresh`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        // IMPORTANT: backend expects raw refresh token (not "Bearer ...") based on your auth.js
        ...(refreshToken ? { 'Bit-Refresh-Token': refreshToken } : {}),
      },
      credentials: cookieAuthEnabled() ? 'include' : 'same-origin',
    })

    if (!response.ok) {
      throw new Error(`Refresh failed (${response.status})`)
    }

    const result = await response.json()

    // Save new tokens (store raw strings, not JSON.stringify)
    if (result?.access_token) setAccessToken(result.access_token)
    if (result?.refresh_token) setRefreshToken(result.refresh_token)

    return result
  }

  const makeRequest = async () => {
    try {
      const response = await client.request({
        url: url.startsWith('/') ? url : `/${url}`,
        method,
        headers: {
          ...headers,
          // client already attaches Authorization, so we don’t need to set it here
          // (but leaving headers merge intact for callers)
        },
        data,
        params,
      })

      return response.data
    } catch (error) {
      const status = error?.response?.status

      // If 401 unauthorized -> try token refresh
      if (status === 401 && numberOfTries < 3) {
        numberOfTries++

        try {
          await refreshAccessToken()
        } catch (refreshErr) {
          // Refresh failed; clear tokens and bubble up original auth failure
          clearToken()
          try {
            localStorage.removeItem('refresh-token')
          } catch {
            // no-op
          }
          throw error
        }

        // retry original request after refresh
        return makeRequest()
      }

      throw error
    }
  }

  return makeRequest()
}

export default request
