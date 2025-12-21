// frontend/bit-bridge-frontend/src/api/auth.js

import axios from 'axios'
import { API_BASE_URL } from './config'
import client, { TOKEN_KEY } from './client'

// Keep refresh token key consistent in one place
export const REFRESH_TOKEN_KEY = 'refresh-token'

const normalizeBaseUrl = (url) => (url ? (url.endsWith('/') ? url.slice(0, -1) : url) : '')
const AUTH_BASE_URL = normalizeBaseUrl(API_BASE_URL)

// -------------------------
// Token reader (best-effort)
// -------------------------
const readAccessToken = () => {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (!raw) return null

  // plain token or "Bearer <token>"
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (s.startsWith('Bearer ')) return s.replace(/^Bearer\s+/i, '')
    if (s.startsWith('ey')) return s
  }

  // JSON storage fallback
  try {
    const obj = JSON.parse(raw)
    return obj?.token || obj?.access_token || obj?.jwt || null
  } catch {
    return raw
  }
}

// -------------------------
// Non-/api/v1 Auth client
// (refresh/logout/confirmation)
// -------------------------
const authClient = axios.create({
  baseURL: AUTH_BASE_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
})

authClient.interceptors.request.use(
  (config) => {
    const token = readAccessToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// -------------------------
// Helpers
// -------------------------
const unwrapUserPayload = (payload) => {
  // supports: { user: { email, password, ... } } OR { email, password, ... }
  if (payload && typeof payload === 'object' && payload.user && typeof payload.user === 'object') {
    return payload.user
  }
  return payload || {}
}

// -------------------------
// /api/v1 Auth routes (IMPORTANT)
// These must be /api/v1 to match your frontend client + API namespace
// -------------------------
export async function signup(payload) {
  const data = unwrapUserPayload(payload)
  // adjust keys if your backend expects different field names
  return client.post('/signup', data)
}

export async function login(payload) {
  const data = unwrapUserPayload(payload)
  return client.post('/login', {
    email: data.email,
    password: data.password,
  })
}

// -------------------------
// Non-/api/v1 Auth routes
// Keep these on AUTH_BASE_URL unless you’ve moved them under /api/v1 too
// -------------------------
export async function refresh(refreshToken) {
  return authClient.post('/refresh', null, {
    headers: {
      'Bit-Refresh-Token': refreshToken,
    },
  })
}

export async function logout() {
  return authClient.delete('/logout')
}

export async function confirmEmail(confirmation_token) {
  return authClient.get('/confirmation', {
    params: { confirmation_token },
    headers: { Accept: 'application/json' },
  })
}

// -------------------------
// Phone verification (/api/v1)
// -------------------------
export async function requestPhoneOtp(payload = {}) {
  return client.post('/phone_verification/request', payload)
}

export async function verifyPhoneOtp(payload) {
  return client.post('/phone_verification/verify', payload)
}
