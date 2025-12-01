// frontend/bit-bridge-frontend/src/api/auth.js

import axios from 'axios'
import { createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import { API_BASE_URL } from './config'

// --- BASE URL FOR AUTH ---
// We normalise in case envs have a trailing slash.
const normalizeBaseUrl = (url) => {
  if (!url) return ''
  return url.endsWith('/') ? url.slice(0, -1) : url
}

const AUTH_BASE_URL = normalizeBaseUrl(API_BASE_URL)

// --- AUTH API HELPERS (direct axios calls) ---

// Signup hits: POST `${AUTH_BASE_URL}/signup`
export async function signup(payload) {
  return axios.post(`${AUTH_BASE_URL}/signup`, payload)
}

// Login hits: POST `${AUTH_BASE_URL}/login`
export async function login(payload) {
  return axios.post(`${AUTH_BASE_URL}/login`, payload)
}

// --- REFRESH ACCESS TOKEN (Redux thunk) ---
// Uses POST `${AUTH_BASE_URL}/refresh`
// Sends the refresh token in the Bit-Refresh-Token header
export const refreshAccessToken = createAsyncThunk(
  'auth/refresh-token',
  async (_, { rejectWithValue }) => {
    try {
      const refreshToken = localStorage.getItem('refresh-token')

      if (!refreshToken) {
        return rejectWithValue({ message: 'No refresh token stored' })
      }

      const response = await axios.post(`${AUTH_BASE_URL}/refresh`, null, {
        headers: {
          'Bit-Refresh-Token': refreshToken,
        },
      })

      const data = response.data
      const newAccessToken = data.access_token
      const newRefreshToken = data.refresh_token

      if (newAccessToken) {
        localStorage.setItem('bitglobal', newAccessToken)
      }
      if (newRefreshToken) {
        localStorage.setItem('refresh-token', newRefreshToken)
      }

      return data
    } catch (error) {
      console.error('Refresh token error:', error)

      // Clear any bad tokens so user can log in cleanly
      localStorage.removeItem('bitglobal')
      localStorage.removeItem('refresh-token')

      const message =
        error.response?.data?.message || 'Session expired. Please log in again.'

      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

// --- LOGOUT (Redux thunk) ---
// Calls DELETE `${AUTH_BASE_URL}/logout` and ALWAYS clears localStorage tokens
export const userLogout = createAsyncThunk('auth/logout', async () => {
  const token = localStorage.getItem('bitglobal')

  try {
    // Call Devise logout endpoint: DELETE /logout
    await axios.delete(`${AUTH_BASE_URL}/logout`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Logout error:', error)
    return { success: false }
  } finally {
    // Always clear tokens on the client
    localStorage.removeItem('bitglobal')
    localStorage.removeItem('refresh-token')
    localStorage.removeItem('email')
  }
})

/* ------------------------------------------------------------------
   Onboarding API helpers
   These talk to the Rails routes under:

   namespace :api do
     namespace :v1 do
       resources :users do
         collection do
           patch :onboarding_basic
           patch :onboarding_use_case
         end
       end
     end
   end
-------------------------------------------------------------------*/

// PATCH /api/v1/users/onboarding_basic
export async function updateOnboardingBasics(payload) {
  const token = localStorage.getItem('bitglobal')

  return axios.patch(`${AUTH_BASE_URL}/api/v1/users/onboarding_basic`, payload, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

// PATCH /api/v1/users/onboarding_use_case
export async function updateOnboardingUseCase(payload) {
  const token = localStorage.getItem('bitglobal')

  return axios.patch(`${AUTH_BASE_URL}/api/v1/users/onboarding_use_case`, payload, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
