// frontend/bit-bridge-frontend/src/api/auth.js

import axios from 'axios'
import { API_BASE_URL } from './config'
import client, { TOKEN_KEY } from './client'

// Keep refresh token key consistent in one place
export const REFRESH_TOKEN_KEY = 'refresh-token'

const normalizeBaseUrl = (url) => (url ? (url.endsWith('/') ? url.slice(0, -1) : url) : '')
const AUTH_BASE_URL = normalizeBaseUrl(API_BASE_URL)

const readAccessToken = () => {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (!raw) return null

  // if token was stored as plain string
  if (raw.startsWith('ey') || raw.startsWith('Bearer ')) return raw.replace(/^Bearer\s+/i, '')

  // if token was stored as JSON: {"token":"..."} or {"access_token":"..."}
  try {
    const obj = JSON.parse(raw)
    return obj?.token || obj?.access_token || obj?.jwt || null
  } catch {
    return raw
  }
}

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

// -----------------------
// Non-/api/v1 Auth routes
// -----------------------

export async function signup(payload) {
  return authClient.post('/signup', payload)
}

export async function login(payload) {
  return authClient.post('/login', payload)
}

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

// -----------------------
// Phone verification (/api/v1)
// -----------------------

export async function requestPhoneOtp(payload = {}) {
  return client.post('/phone_verification/request', payload)
}

export async function verifyPhoneOtp(payload) {
  return client.post('/phone_verification/verify', payload)
}
