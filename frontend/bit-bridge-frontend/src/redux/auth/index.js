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
        const userData = action.payload?.data || action.payload?.user || action.payload
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
        const userData = action.payload?.data || action.payload?.user || action.payload
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
        const userData = action.payload?.data || null
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
        const userData = action.payload?.data || action.payload
        state.user = cloneUser(userData) // ✅ always new reference
        state.logged = true
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
