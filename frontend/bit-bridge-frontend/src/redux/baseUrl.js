// src/redux/baseUrl.js

// Use the same base URL selection logic as the rest of the app
import { API_BASE_URL } from '../api/config'

// Ensure baseUrl always ends with exactly one trailing slash
const withTrailingSlash = (url) => {
  if (!url) return ''
  return url.endsWith('/') ? url : `${url}/`
}

// This is what all legacy Redux auth calls (login, signup, etc.) will use.
// It now stays perfectly in sync with API_BASE_URL used by the newer API helpers.
export const baseUrl = withTrailingSlash(API_BASE_URL)

// Rails API namespace (unchanged)
export const apiRoute = 'api/v1/'

// Monnify public key (unchanged)
// Keep existing default so we don't break anything.
export const publicKey =
  import.meta.env.VITE_APP_MONNIFY_PUBLIC_KEY || 'MK_PROD_AH8EL53JW8'
