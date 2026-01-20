// frontend/bit-bridge-frontend/src/redux/actions/auth.js

import { createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import client, { clearToken } from '../../api/client'
import refreshClient from '../../api/refreshClient'
import { signup as apiSignup, login as apiLogin } from '../../api/auth'
import {
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  cookieAuthEnabled,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearAuthStorage,
  legacyStorageEnabled,
} from '../../auth/tokenStore'

import UserService from '../../service/user-service'

// -------------------------
// LocalStorage Keys
// -------------------------
const ACCESS_TOKEN_KEY = TOKEN_KEY || 'bitglobal'
const LAST_EMAIL_KEY = 'email'
const RECENT_EMAILS_KEY = 'recent_emails'
const MAX_RECENTS = 5

// -------------------------
// Helpers
// -------------------------
const cleanToken = (token) => {
  if (!token) return ''
  return String(token).replace(/^Bearer\s+/i, '').replace(/^"+|"+$/g, '').trim()
}

const saveAccessToken = (token) => {
  const clean = cleanToken(token)
  if (!clean) return
  setAccessToken(clean)
}

const saveRefreshToken = (token) => {
  const clean = cleanToken(token)
  if (!clean) return
  setRefreshToken(clean)
}

const getRecentEmails = () => {
  try {
    const raw = localStorage.getItem(RECENT_EMAILS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter(Boolean) : []
  } catch {
    return []
  }
}

const saveEmailToRecents = (email) => {
  const clean = String(email || '').trim().toLowerCase()
  if (!clean) return

  localStorage.setItem(LAST_EMAIL_KEY, clean)
  const existing = getRecentEmails()
  const next = [clean, ...existing.filter((e) => e !== clean)].slice(0, MAX_RECENTS)
  localStorage.setItem(RECENT_EMAILS_KEY, JSON.stringify(next))
}

const clearAuthStorageLegacy = () => {
  clearAuthStorage()
  if (legacyStorageEnabled()) {
    try {
      localStorage.removeItem(LAST_EMAIL_KEY)
    } catch {
      // no-op
    }
  }
  // keep recent_emails
}

const getErrorMessage = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.status?.message ||
  error?.response?.data?.message ||
  (typeof error?.response?.data === 'string' ? error.response.data : null) ||
  error?.message ||
  fallback

// Small helper: a friendlier auth error message for login
const getLoginToastMessage = (error) => {
  const status = error?.response?.status

  // Wrong credentials
  if (status === 401 || status === 403) return 'Invalid email or password.'

  // Try backend messages if present
  const backendMsg =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    (typeof error?.response?.data === 'string' ? error.response.data : null)

  if (backendMsg) return backendMsg

  // Network / server issues
  if (!status) return 'Network error. Please check your connection and try again.'
  if (status >= 500) return 'Server error. Please try again shortly.'

  return 'Login failed. Please try again.'
}

// -------------------------
// SIGN UP (POST /signup)
// -------------------------
export const userSignUp = createAsyncThunk(
  'sign-up/user-signUp',
  async (data, { rejectWithValue }) => {
    try {
      const response = await apiSignup(data)
      const result = response.data

      // Sometimes token comes via Authorization: Bearer <token>
      const authorizationHeader = response?.headers?.authorization
      let accessToken = null
      if (authorizationHeader?.startsWith('Bearer ')) {
        accessToken = authorizationHeader.split(' ')[1]
      }

      const email = data?.user?.email
      if (email) saveEmailToRecents(email)
      if (accessToken) saveAccessToken(accessToken)

      return result
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to Sign up')
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

// -------------------------
// LOGIN (POST /login)
// -------------------------
export const userLogin = createAsyncThunk(
  'login/user-login',
  async (data, { rejectWithValue }) => {
    try {
      // 1) login (/api/v1/login)
      const response = await apiLogin(data)
      const result = response.data

      const accessToken = result?.token || result?.access_token
      const refreshToken =
        response?.headers?.['bit-refresh-token'] || result?.refresh_token

      if (accessToken) saveAccessToken(accessToken)
      else console.warn('No access token in login response body')

      if (refreshToken) saveRefreshToken(refreshToken)
      else console.warn('No refresh token found on login response')

      const email = data?.user?.email
      if (email) saveEmailToRecents(email)

      // 2) ✅ immediately fetch full profile using the token we just stored
      // client interceptor will attach Authorization header automatically
      let fullUser = null
      try {
        const profileRes = await client.get('/users/user_profile')
        const top = profileRes?.data
        const payload = top?.data ?? top

        fullUser =
          payload?.attributes ||
          payload?.data?.attributes ||
          payload?.data?.data?.attributes ||
          payload?.data ||
          payload
      } catch (e) {
        console.warn('Profile hydrate after login failed:', e?.response?.status || e?.message)
      }

      toast(result?.message || 'Logged in', { type: 'success' })

      // 3) return a consistent shape so reducers don’t lose fields
      return {
        ...result,
        user: fullUser || result?.user || result,
      }
    } catch (error) {
      const raw = error?.response?.data
      const rawString = typeof raw === 'string' ? raw : ''

      const needsConfirm =
        rawString.includes('confirm your email') ||
        String(error?.response?.data?.message || '').includes('confirm your email')

      if (needsConfirm) {
        try {
          const email = data?.user?.email
          if (email) saveEmailToRecents(email)

          await client.get('/users/resend_confirmation_token', { params: { email } })
          toast('Account not confirmed. A confirmation email has been sent.', { type: 'success' })
        } catch {
          toast('Error resending confirmation email', { type: 'error' })
        }

        toast('Account not confirmed', { type: 'error' })
        return rejectWithValue({ message: 'Account not confirmed' })
      }

      // ✅ Friendly login toast (instead of "Request failed with status code 401")
      const msg = getLoginToastMessage(error)
      toast(msg, { type: 'error' })
      return rejectWithValue({ message: msg })
    }
  }
)

// -------------------------
// REFRESH TOKEN (POST /api/v1/refresh)
// -------------------------
export const refreshAccessToken = createAsyncThunk(
  'auth/refresh-token',
  async (_, { rejectWithValue }) => {
    try {
      const refreshToken = getRefreshToken()
      if (!refreshToken && !cookieAuthEnabled())
        return rejectWithValue({ message: 'No refresh token stored' })

      const res = await refreshClient.post('/refresh', null, {
        headers: {
          ...(refreshToken ? { 'Bit-Refresh-Token': refreshToken } : {}),
        },
      })
      const data = res?.data || {}

      const newAccessToken = data?.access_token || data?.token
      const newRefreshToken = data?.refresh_token

      if (newAccessToken) saveAccessToken(newAccessToken)
      if (newRefreshToken) saveRefreshToken(newRefreshToken)

      return data
    } catch (error) {
      clearToken()
      clearAuthStorageLegacy()

      const message = getErrorMessage(error, 'Session expired. Please log in again.')
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

// -------------------------
// CONFIRMATION (GET /api/v1/confirmation?confirmation_token=...)
// -------------------------
export const userConfirmation = createAsyncThunk(
  'user/user-confirmation',
  async (token, { rejectWithValue }) => {
    try {
      const res = await client.get('/confirmation', {
        params: { confirmation_token: token },
      })
      const data = res?.data || {}
      toast('Email Confirmed', { type: 'success' })

      if (data?.access_token) saveAccessToken(data.access_token)
      if (data?.refresh_token) saveRefreshToken(data.refresh_token)

      return data
    } catch (error) {
      const message = getErrorMessage(error, 'Something went wrong')
      return rejectWithValue({ message })
    }
  }
)

// -------------------------
// SEND CONFIRMATION (GET /api/v1/users/resend_confirmation_token)
// -------------------------
export const sendUserConfirmation = createAsyncThunk(
  'user/send-user-confirmation',
  async (email, { rejectWithValue }) => {
    try {
      if (!email) return rejectWithValue({ message: 'Email is required' })
      saveEmailToRecents(email)

      const response = await client.get('/users/resend_confirmation_token', { params: { email } })
      return response.data
    } catch (error) {
      const message = getErrorMessage(error, 'Something went wrong')
      return rejectWithValue({ message })
    }
  }
)

// -------------------------
// PROFILE UPDATE (PATCH /api/v1/users/user_update)
// -------------------------
export const userProfileUpdate = createAsyncThunk(
  'user/user-update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await client.patch('/users/user_update', data)
      return response.data
    } catch (error) {
      const message = getErrorMessage(error, 'Something broke')
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

// -------------------------
// BASIC PROFILE / KYC (PATCH /api/v1/users/basic_profile)
// -------------------------
export const updateBasicProfile = createAsyncThunk(
  'user/basic-profile',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.patch('/users/basic_profile', data)
      const result = response.data
      toast(result?.message || 'Profile updated successfully', { type: 'success' })
      return result
    } catch (error) {
      const message = getErrorMessage(error, 'Something broke')
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

// -------------------------
// PASSWORD UPDATE (PATCH /api/v1/users/user_password_update)
// -------------------------
export const userPasswordUpdate = createAsyncThunk(
  'user/password-update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await client.patch('/users/user_password_update', data)
      return response.data
    } catch (error) {
      const message = getErrorMessage(error, 'Something went wrong')
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

// -------------------------
// DELETE (DELETE /api/v1/users/:id)
// -------------------------
export const userDelete = createAsyncThunk('user/account-delete', async (id, { rejectWithValue }) => {
  try {
    const response = await client.delete(`/users/${id}`)
    return response.data
  } catch (error) {
    const message = getErrorMessage(error, 'Something went wrong')
    toast(message, { type: 'error' })
    return rejectWithValue({ message })
  }
})

// -------------------------
// USER PROFILE FETCH (direct)
// -------------------------
export const userProfile = createAsyncThunk(
  'auth/user-profile',
  async (_, { rejectWithValue }) => {
    try {
      const res = await client.get('/users/user_profile')

      const top = res?.data
      const payload = top?.data ?? top

      const user =
        payload?.attributes ||
        payload?.data?.attributes ||
        payload?.data?.data?.attributes ||
        payload?.data ||
        payload

      return user
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Something went wrong'
      return rejectWithValue({ message })
    }
  }
)

// -------------------------
// LOGOUT (DELETE /api/v1/logout)
// -------------------------
export const userLogout = createAsyncThunk('logout/user-logout', async (_, { rejectWithValue }) => {
  try {
    await client.delete('/logout').catch(() => {})

    clearAuthStorageLegacy()
    clearToken()
    toast('Logged out', { type: 'success' })
    return { success: true }
  } catch (error) {
    clearAuthStorageLegacy()
    clearToken()
    const message = getErrorMessage(error, 'Logged out')
    return rejectWithValue({ message })
  }
})

// -------------------------
// PASSWORD RESET (GET /api/v1/users/password_reset)
// -------------------------
export const userPasswordReset = createAsyncThunk('user/password-reset', async ({ email }) => {
  try {
    const response = await client.get('/users/password_reset', { params: { email } })
    return response
  } catch (error) {
    console.log(error)
  }
})

export const changePasswordReset = createAsyncThunk('user/change-password', async (data) => {
  try {
    const response = await client.patch('/users/update_password', data)
    return response
  } catch (error) {
    console.log(error)
  }
})
