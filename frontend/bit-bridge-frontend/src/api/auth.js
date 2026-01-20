// frontend/bit-bridge-frontend/src/api/auth.js

import { API_BASE_URL } from './config'
import client from './client'
import refreshClient from './refreshClient'
import { REFRESH_TOKEN_KEY } from '../auth/tokenStore'

// Single source of truth for refresh token key (used by redux/actions/auth.js too)
export { REFRESH_TOKEN_KEY }

// --------------------
// AUTH ROUTES (ROOT / Devise)
// --------------------
export function signup(payload) {
  // POST /api/v1/signup
  return client.post('/signup', payload)
}

export function login(payload) {
  // POST /api/v1/login (API route)
  return client.post('/login', payload)
}

export function refresh(refreshToken) {
  // POST /api/v1/refresh
  const headers = {}
  if (refreshToken) headers['Bit-Refresh-Token'] = refreshToken
  return refreshClient.post('/refresh', null, { headers })
}

export function logout() {
  // DELETE /api/v1/logout
  return client.delete('/logout')
}

export function confirmEmail(confirmation_token) {
  // GET /api/v1/confirmation?confirmation_token=...
  return client.get('/confirmation', {
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

console.log('API BASE URL:', API_BASE_URL)
