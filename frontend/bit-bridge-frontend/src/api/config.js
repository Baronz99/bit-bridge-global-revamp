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
 * ✅ Use ONE base env var everywhere.
 * Prefer:
 * VITE_API_BASE_URL=https://bitbridgeglobal.com/api/v1
 * (If you provide a root, we will append /api/v1.)
 */
const forcedBaseRaw = stripTrailingSlash(import.meta.env.VITE_API_BASE_URL)
const forcedBase =
  forcedBaseRaw ? (forcedBaseRaw.match(/\/api\/v1$/i) ? forcedBaseRaw : `${forcedBaseRaw}/api/v1`) : ''

const forcedRootRaw = stripTrailingSlash(import.meta.env.VITE_API_ROOT_URL)
const forcedRoot = forcedRootRaw ? stripApiV1Suffix(forcedRootRaw) : ''

// fallback logic
let rootUrl = forcedRoot

if (forcedBase) {
  rootUrl = stripApiV1Suffix(forcedBase)
}

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
export const API_BASE_URL = forcedBase || `${rootUrl}/api/v1`
