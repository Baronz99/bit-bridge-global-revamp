// frontend/bit-bridge-frontend/src/hooks/localStorage.js

// -------------------------
// Token helpers (safe + compatible)
// -------------------------

const stripQuotes = (v) => {
  if (v == null) return ''
  return String(v).replace(/^"+|"+$/g, '').trim()
}

export const setToken = (token) => {
  // store as plain string (no JSON.stringify)
  if (!token) return
  localStorage.setItem('bitglobal', stripQuotes(token))
}

export const fetchToken = () => {
  // Supports both old style (JSON stringified) and new style (plain)
  const raw = localStorage.getItem('bitglobal')
  if (!raw) return ''

  // If it looks like a JSON string token, parse it safely
  // Example: "\"abc\"" or "\"eyJ...\""
  try {
    if (raw.startsWith('"') && raw.endsWith('"')) {
      const parsed = JSON.parse(raw)
      return stripQuotes(parsed)
    }
  } catch (e) {
    // ignore and fall back
  }

  return stripQuotes(raw)
}

export const fetchRefresh = () => {
  const raw = localStorage.getItem('refresh-token')
  if (!raw) return ''
  return stripQuotes(raw)
}

export const setRefreshToken = (token) => {
  if (!token) return
  localStorage.setItem('refresh-token', stripQuotes(token))
}

export const removeToken = () => {
  localStorage.removeItem('bitglobal')
}

export const removeRefreshToken = () => {
  localStorage.removeItem('refresh-token')
}

export const clearAuth = () => {
  localStorage.removeItem('bitglobal')
  localStorage.removeItem('refresh-token')
  // keep email if you want login prefill:
  // localStorage.removeItem('email')
}

// -------------------------
// Cart helpers (unchanged behavior)
// -------------------------
export const setCart = (cartItems) => {
  localStorage.setItem('cartitem', JSON.stringify(cartItems))
}

export const getCart = () => {
  const carts = JSON.parse(localStorage.getItem('cartitem'))
  if (carts == null) return []
  return carts
}
