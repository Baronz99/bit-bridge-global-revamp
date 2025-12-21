// frontend/bit-bridge-frontend/src/api/auth.js

import axios from 'axios'
import { API_BASE_URL } from './config'
import client, { TOKEN_KEY } from './client'

// Single source of truth for refresh token key
export const REFRESH_TOKEN_KEY = 'refresh-token'

// --------------------
// Helpers
// --------------------
const normalizeBaseUrl = (url) =>
  url ? (url.endsWith('/') ? url.slice(0, -1) : url) : ''

const AUTH_BASE_URL = normalizeBaseUrl(API_BASE_URL)

const readAccessToken = () => {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (!raw) return null

  // plain token
  if (raw.startsWith('ey') || raw.startsWith('Bearer '))
    return raw.replace(/^Bearer\s+/i, '')

  // JSON token fallback
  try {
    const obj = JSON.parse(raw)
    return obj?.token || obj?.access_token || null
  } catch {
    return raw
  }
}

// --------------------
// Auth client (NO /api/v1)
// --------------------
const authClient = axios.create({
  baseURL: AUTH_BASE_URL, // ⚠️ NOT /api/v1
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
})

authClient.interceptors.request.use((config) => {
  const token = readAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// --------------------
// AUTH ROUTES (NON-API)
// --------------------
export function signup(payload) {
  return authClient.post('/signup', payload)
}

export function login(payload) {
  // ✅ THIS MUST HIT /login (NOT /api/v1/login)
  return authClient.post('/login', payload)
}

export function refresh(refreshToken) {
  return authClient.post('/refresh', null, {
    headers: {
      'Bit-Refresh-Token': refreshToken,
    },
  })
}

export function logout() {
  return authClient.delete('/logout')
}

export function confirmEmail(confirmation_token) {
  return authClient.get('/confirmation', {
    params: { confirmation_token },
  })
}

// --------------------
// API v1 ROUTES
// --------------------
export function requestPhoneOtp(payload = {}) {
  return client.post('/phone_verification/request', payload)
}

export function verifyPhoneOtp(payload) {
  return client.post('/phone_verification/verify', payload)
}

console.log('AUTH BASE URL:', AUTH_BASE_URL)
