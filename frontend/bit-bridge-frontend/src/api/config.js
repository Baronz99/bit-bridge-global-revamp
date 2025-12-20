// src/api/config.js

// -----------------------------------------------
// BASE URL SELECTION LOGIC (Dev vs Staging)
// -----------------------------------------------
const stripTrailingSlash = (url) => {
  if (!url) return ''
  return url.replace(/\/+$/, '')
}

const MODE = import.meta.env.MODE

let baseUrl = ''

if (MODE === 'staging') {
  baseUrl =
    stripTrailingSlash(import.meta.env.VITE_APP_STAGING_BASE_URL) ||
    stripTrailingSlash(import.meta.env.VITE_APP_DEV_BASE_URL) ||
    'http://localhost:4000'
} else {
  baseUrl =
    stripTrailingSlash(import.meta.env.VITE_APP_DEV_BASE_URL) ||
    stripTrailingSlash(import.meta.env.VITE_APP_STAGING_BASE_URL) ||
    'http://localhost:3000'
}

/**
 * API base (no trailing slash)
 * Example: https://api.bitbridgeglobal.com
 */
export const API_BASE_URL = baseUrl
