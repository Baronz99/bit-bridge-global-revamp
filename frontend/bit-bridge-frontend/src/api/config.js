// src/api/config.js

const stripTrailingSlash = (url) => (url ? url.replace(/\/+$/, '') : '')

const MODE = import.meta.env.MODE

/**
 * ✅ Use ONE root env var everywhere.
 * Set in .env.local or Netlify:
 * VITE_API_ROOT_URL=https://bitbridge-backend-prod-5f0b6abe68d7.herokuapp.com
 */
const forcedRoot = stripTrailingSlash(import.meta.env.VITE_API_ROOT_URL)

// fallback logic
let rootUrl = forcedRoot

if (!rootUrl) {
  if (MODE === 'staging') {
    rootUrl =
      stripTrailingSlash(import.meta.env.VITE_APP_STAGING_BASE_URL) ||
      stripTrailingSlash(import.meta.env.VITE_APP_DEV_BASE_URL) ||
      'http://localhost:4000'
  } else {
    rootUrl =
      stripTrailingSlash(import.meta.env.VITE_APP_DEV_BASE_URL) ||
      stripTrailingSlash(import.meta.env.VITE_APP_STAGING_BASE_URL) ||
      'http://localhost:3000'
  }
}

// ✅ Export both root + API v1 base
export const API_ROOT_URL = rootUrl
export const API_BASE_URL = `${rootUrl}/api/v1`
