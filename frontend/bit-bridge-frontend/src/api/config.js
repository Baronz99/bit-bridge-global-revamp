// src/api/config.js
import axios from 'axios'

// -----------------------------------------------
// BASE URL SELECTION LOGIC (Dev, Staging, Fallback)
// -----------------------------------------------
//
// Priority:
// 1. VITE_APP_STAGING_BASE_URL → used when running staging
// 2. VITE_APP_DEV_BASE_URL     → used in local normal dev
// 3. Fallback to http://localhost:4000 (safe staging default)
//
// NOTE:
// - We ignore VITE_API_BASE_URL because it's outdated
// - We remove trailing slashes to avoid double-slash errors
// -----------------------------------------------

function pickBaseUrl() {
  const staging = import.meta.env.VITE_APP_STAGING_BASE_URL
  if (staging && staging.length > 0) {
    return staging.replace(/\/+$/, '') // trim trailing slash
  }

  const dev = import.meta.env.VITE_APP_DEV_BASE_URL
  if (dev && dev.length > 0) {
    return dev.replace(/\/+$/, '') // trim trailing slash
  }

  // final fallback → staging port
  return 'http://localhost:4000'
}

export const API_BASE_URL = pickBaseUrl()

// -----------------------------------------------
// AXIOS INSTANCE
// -----------------------------------------------
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // safe default for Devise JWT refresh
})

export default api
