// frontend/bit-bridge-frontend/src/api/auth.js

import axios from 'axios'
import { API_BASE_URL } from './config'
import client from './client'
import { getAccessToken, cookieAuthEnabled, REFRESH_TOKEN_KEY } from '../auth/tokenStore'

// Single source of truth for refresh token key (used by redux/actions/auth.js too)
export { REFRESH_TOKEN_KEY }

// --------------------
// Helpers
// --------------------
const normalizeBaseUrl = (url) =>
  url ? (url.endsWith('/') ? url.slice(0, -1) : url) : ''

/**
 * API_BASE_URL is now recommended to be ".../api/v1".
 * But Devise auth endpoints live at the ROOT:
 *   /login, /logout, /signup, /refresh, /confirmation
 *
 * So we derive ROOT_BASE_URL safely by stripping "/api/v1" if present.
 */
const normalizedApiBase = normalizeBaseUrl(API_BASE_URL)
const ROOT_BASE_URL = normalizedApiBase.replace(/\/api\/v1$/i, '')

// Read access token regardless of whether it was saved as:
// - plain JWT string
// - "Bearer <jwt>"
// - JSON string { token: "..."} or { access_token: "..." }
const readAccessToken = () => getAccessToken()

// --------------------
// Auth client (ROOT only, NOT /api/v1)
// --------------------
const authClient = axios.create({
  baseURL: ROOT_BASE_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 60_000,
  withCredentials: cookieAuthEnabled(),
})

authClient.interceptors.request.use((config) => {
  const token = readAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// --------------------
// AUTH ROUTES (ROOT / Devise)
// --------------------
export function signup(payload) {
  // POST /signup
  return authClient.post('/signup', payload)
}

export function login(payload) {
  // POST /login (Devise route)
  return authClient.post('/login', payload)
}

export function refresh(refreshToken) {
  // POST /refresh (Devise scope route)
  const headers = {}
  if (refreshToken) headers['Bit-Refresh-Token'] = refreshToken
  return authClient.post('/refresh', null, { headers })
}

export function logout() {
  // DELETE /logout
  return authClient.delete('/logout')
}

export function confirmEmail(confirmation_token) {
  // GET /confirmation?confirmation_token=...
  return authClient.get('/confirmation', {
    params: { confirmation_token },
  })
}

// --------------------
// API v1 AUTH ROUTES (Custom API login)
// --------------------
// Use this if you want to bypass Devise /login 500 issues and use Api::V1::SessionsController
export function apiLoginV1(payload) {
  // POST /api/v1/login
  return client.post('/login', payload)
}

// --------------------
// API v1 ROUTES (existing)
// --------------------
export function requestPhoneOtp(payload = {}) {
  return client.post('/phone_verification/request', payload)
}

export function verifyPhoneOtp(payload) {
  return client.post('/phone_verification/verify', payload)
}

console.log('AUTH ROOT BASE URL:', ROOT_BASE_URL)
console.log('API BASE URL:', normalizedApiBase)
