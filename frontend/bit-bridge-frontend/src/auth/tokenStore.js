// frontend/bit-bridge-frontend/src/auth/tokenStore.js

const TOKEN_KEY = 'bitglobal'
const REFRESH_TOKEN_KEY = 'refresh-token'

let accessToken = null

const legacyStorageEnabled = () => {
  const v = import.meta.env.VITE_AUTH_LEGACY_STORAGE
  if (v == null) return true
  return v === 'true'
}

const cookieAuthEnabled = () =>
  import.meta.env.VITE_AUTH_COOKIE_ENABLED === 'true'

const normalizeToken = (raw) => {
  if (!raw) return null
  const str = String(raw).trim()
  if (/^Bearer\s+/i.test(str)) return str.replace(/^Bearer\s+/i, '').trim()
  if (str.startsWith('ey')) return str.trim()
  return str.replace(/^"+|"+$/g, '').trim()
}

const getFromStorage = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const setInStorage = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // no-op
  }
}

const removeFromStorage = (key) => {
  try {
    localStorage.removeItem(key)
  } catch {
    // no-op
  }
}

const setAccessToken = (token) => {
  const clean = normalizeToken(token)
  if (!clean) return
  accessToken = clean
  if (legacyStorageEnabled()) setInStorage(TOKEN_KEY, clean)
}

const getAccessToken = () => {
  if (accessToken) return accessToken
  if (!legacyStorageEnabled()) return null

  const raw = getFromStorage(TOKEN_KEY)
  const clean = normalizeToken(raw)
  if (clean) accessToken = clean
  return clean
}

const clearAccessToken = () => {
  accessToken = null
  if (legacyStorageEnabled()) removeFromStorage(TOKEN_KEY)
}

const setRefreshToken = (token) => {
  const clean = normalizeToken(token)
  if (!clean) return
  if (legacyStorageEnabled()) setInStorage(REFRESH_TOKEN_KEY, clean)
}

const getRefreshToken = () => {
  if (!legacyStorageEnabled()) return null
  const raw = getFromStorage(REFRESH_TOKEN_KEY)
  return normalizeToken(raw)
}

const clearRefreshToken = () => {
  if (legacyStorageEnabled()) removeFromStorage(REFRESH_TOKEN_KEY)
}

const clearAuthStorage = () => {
  clearAccessToken()
  clearRefreshToken()
  removeFromStorage('email')
}

export {
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  legacyStorageEnabled,
  cookieAuthEnabled,
  setAccessToken,
  getAccessToken,
  clearAccessToken,
  setRefreshToken,
  getRefreshToken,
  clearRefreshToken,
  clearAuthStorage,
}
