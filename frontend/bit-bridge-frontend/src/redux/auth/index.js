// frontend/bit-bridge-frontend/src/redux/auth/index.js

import { createSlice } from '@reduxjs/toolkit'
import {
  sendUserConfirmation,
  userLogin,
  userLogout,
  userProfile,
  userSignUp,
} from '../actions/auth'

const initialState = {
  user: null,
  logged: false,
  loading: true,
  message: null,
}

// Force a fresh reference so React effects re-run reliably.
const cloneUser = (u) => {
  if (!u || typeof u !== 'object') return u
  return {
    ...u,
    user_profile: u.user_profile ? { ...u.user_profile } : u.user_profile,
    wallet: u.wallet ? { ...u.wallet } : u.wallet,
    // arrays can stay as-is unless you mutate them elsewhere
  }
}

/**
 * ✅ Normalize common backend shapes into a plain user object.
 * Handles:
 * - plain user: { first_name, ... }
 * - wrapped: { data: { ... } }
 * - JSON:API-ish: { data: { attributes: { ... } } }
 * - double-wrapped: { data: { data: { attributes: { ... } } } }
 */
const normalizeUserPayload = (payload) => {
  if (!payload) return null

  // If thunk returns { message, ... } etc, try to locate user-ish parts
  const p = payload?.data ?? payload?.user ?? payload

  // unwrap JSON:API styles if present
  const user =
    p?.attributes ||
    p?.data?.attributes ||
    p?.data?.data?.attributes ||
    p?.data ||
    p

  // If still not an object, give up
  if (!user || typeof user !== 'object') return null
  return user
}

const AuthSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    resetUser: (state) => {
      state.user = null
      state.logged = false
      state.loading = false
      state.message = null
    },

    forceLogout: (state, action) => {
      state.user = null
      state.logged = false
      state.loading = false
      state.message = action?.payload?.message || null
    },

    clearAuthMessage: (state) => {
      state.message = null
    },
  },
  extraReducers: (builder) => {
    builder
      // SIGN UP
      .addCase(userSignUp.pending, (state) => {
        state.loading = true
        state.message = null
      })
      .addCase(userSignUp.fulfilled, (state, action) => {
        const userData = normalizeUserPayload(action.payload)
        state.user = cloneUser(userData)
        state.logged = true
        state.loading = false
        state.message = null
      })
      .addCase(userSignUp.rejected, (state, action) => {
        state.message = action.payload?.message
        state.loading = false
      })

      // LOGIN
      .addCase(userLogin.pending, (state) => {
        state.loading = true
        state.message = null
      })
      .addCase(userLogin.fulfilled, (state, action) => {
        const userData = normalizeUserPayload(action.payload)
        state.user = cloneUser(userData)
        state.logged = true
        state.loading = false
        state.message = null
      })
      .addCase(userLogin.rejected, (state, action) => {
        state.message = action.payload?.message
        state.loading = false
      })

      // RESEND CONFIRMATION
      .addCase(sendUserConfirmation.pending, (state) => {
        state.loading = true
        state.message = null
      })
      .addCase(sendUserConfirmation.fulfilled, (state, action) => {
        const userData = normalizeUserPayload(action.payload)
        state.user = cloneUser(userData)
        state.loading = false
      })
      .addCase(sendUserConfirmation.rejected, (state, action) => {
        state.message = action.payload?.message || null
        state.loading = false
      })

      // USER PROFILE
      .addCase(userProfile.pending, (state) => {
        state.loading = true
        state.message = null
      })
      .addCase(userProfile.fulfilled, (state, action) => {
        const userData = normalizeUserPayload(action.payload)
        state.user = cloneUser(userData) // ✅ always new reference

        // ✅ Only mark logged=true if we actually got a user object
        state.logged = !!userData
        state.loading = false
      })
      .addCase(userProfile.rejected, (state, action) => {
        state.message = action.payload?.message
        state.logged = false
        state.loading = false
      })

      // LOGOUT
      .addCase(userLogout.fulfilled, (state) => {
        state.user = null
        state.logged = false
        state.loading = false
        state.message = null
      })
  },
})

export default AuthSlice.reducer
export const { resetUser, forceLogout, clearAuthMessage } = AuthSlice.actions
