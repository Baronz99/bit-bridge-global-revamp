// src/api/config.js
import axios from 'axios'

// -----------------------------------------------
// BASE URL SELECTION LOGIC (Dev vs Staging)
// -----------------------------------------------
//
// Priority based on Vite mode:
//
//  - MODE === 'staging'
//       → use VITE_APP_STAGING_BASE_URL
//         (fallback: VITE_APP_DEV_BASE_URL → 'http://localhost:4000')
//
//  - any other mode (development, production)
//       → use VITE_APP_DEV_BASE_URL
//         (fallback: VITE_APP_STAGING_BASE_URL → 'http://localhost:3000')
//
// We also strip any trailing slashes so that things like
// `${API_BASE_URL}/api/v1/...` do not end up with double slashes.
// -----------------------------------------------

const stripTrailingSlash = (url) => {
  if (!url) return ''
  return url.replace(/\/+$/, '')
}

const MODE = import.meta.env.MODE

let baseUrl = ''

if (MODE === 'staging') {
  // Staging build (Netlify / staging mode)
  baseUrl =
    stripTrailingSlash(import.meta.env.VITE_APP_STAGING_BASE_URL) ||
    stripTrailingSlash(import.meta.env.VITE_APP_DEV_BASE_URL) ||
    'http://localhost:4000'
} else {
  // Local dev (npm run dev) and normal production build
  baseUrl =
    stripTrailingSlash(import.meta.env.VITE_APP_DEV_BASE_URL) ||
    stripTrailingSlash(import.meta.env.VITE_APP_STAGING_BASE_URL) ||
    'http://localhost:3000'
}

export const API_BASE_URL = baseUrl

// -----------------------------------------------
// AXIOS INSTANCE
// -----------------------------------------------
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // fine for token / cookie flows
})

export default api
