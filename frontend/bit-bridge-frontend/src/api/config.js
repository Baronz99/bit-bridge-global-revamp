// frontend/bit-bridge-frontend/src/api/config.js

const stripTrailingSlash = (url) => (url ? url.replace(/\/+$/, '') : '')

/**
 * If someone accidentally sets a root like:
 *   https://server.com/api/v1
 * normalize it back to:
 *   https://server.com
 */
const stripApiV1Suffix = (url) => {
  const u = stripTrailingSlash(url)
  return u.replace(/\/api\/v1$/i, '')
}

const MODE = import.meta.env.MODE

/**
 * ✅ Use ONE root env var everywhere.
 * Set in .env.local or Netlify:
 * VITE_API_ROOT_URL=https://bitbridge-backend-prod-5f0b6abe68d7.herokuapp.com
 *
 * (Even if you mistakenly include /api/v1, this file will normalize it.)
 */
const forcedRootRaw = stripTrailingSlash(import.meta.env.VITE_API_ROOT_URL)
const forcedRoot = forcedRootRaw ? stripApiV1Suffix(forcedRootRaw) : ''

// fallback logic
let rootUrl = forcedRoot

if (!rootUrl) {
  if (MODE === 'staging') {
    rootUrl =
      stripApiV1Suffix(stripTrailingSlash(import.meta.env.VITE_APP_STAGING_BASE_URL)) ||
      stripApiV1Suffix(stripTrailingSlash(import.meta.env.VITE_APP_DEV_BASE_URL)) ||
      'http://localhost:4000'
  } else {
    rootUrl =
      stripApiV1Suffix(stripTrailingSlash(import.meta.env.VITE_APP_DEV_BASE_URL)) ||
      stripApiV1Suffix(stripTrailingSlash(import.meta.env.VITE_APP_STAGING_BASE_URL)) ||
      'http://localhost:3000'
  }
}

rootUrl = stripApiV1Suffix(stripTrailingSlash(rootUrl))

export const API_ROOT_URL = rootUrl

// ✅ Export API v1 base (guaranteed single /api/v1)
export const API_BASE_URL = `${rootUrl}/api/v1`
