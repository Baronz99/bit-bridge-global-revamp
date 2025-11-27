// src/redux/baseUrl.js (or wherever this file lives)

export const baseUrl =
  // 👇 Staging takes priority if defined
  import.meta.env.VITE_APP_STAGING_BASE_URL ||
  // 👇 Otherwise fall back to dev base URL
  import.meta.env.VITE_APP_DEV_BASE_URL ||
  // 👇 Finally fall back to the existing production URL
  'https://bitbridgeglobal-fa54ecb89f7d.herokuapp.com/'

export const apiRoute = 'api/v1/'

// Monnify public key
// Keep existing default so we don't break anything
export const publicKey =
  import.meta.env.VITE_APP_MONNIFY_PUBLIC_KEY || 'MK_PROD_AH8EL53JW8'
