// frontend/bit-bridge-frontend/src/redux/phoneVerification/index.js

import { createSlice } from '@reduxjs/toolkit'
import { sendPhoneOtp, confirmPhoneOtp } from '../actions/phoneVerification'

const initialState = {
  sending: false,
  verifying: false,
  sent: false,

  error: null,
  message: null,

  fallback: null,
  reason: null,

  expiresAt: null,
  expiresInSeconds: null,

  // still stored for compatibility (backend may return it)
  resendAvailableInSeconds: null,

  requiresPassword: false,
}

const slice = createSlice({
  name: 'phoneVerification',
  initialState,
  reducers: {
    resetPhoneVerification: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendPhoneOtp.pending, (state) => {
        state.sending = true
        state.error = null
        state.message = null
        state.fallback = null
        state.reason = null
        state.requiresPassword = false
      })
      .addCase(sendPhoneOtp.fulfilled, (state, action) => {
  state.sending = false
  state.error = null

  const p = action.payload || {}
  state.message = p.message || null
  state.reason = p.reason || null
  state.fallback = p.fallback || null

  // ✅ If server says already verified, treat as "no OTP flow"
  if (p.status === 'already_verified') {
    state.sent = false
    state.expiresAt = null
    state.expiresInSeconds = null
    state.resendAvailableInSeconds = null
    state.requiresPassword = false
    return
  }

  state.sent = true
  state.expiresAt = p.expires_at || null
  state.expiresInSeconds = typeof p.expires_in_seconds === 'number' ? p.expires_in_seconds : null
  state.resendAvailableInSeconds =
    typeof p.resend_available_in_seconds === 'number' ? p.resend_available_in_seconds : null

  state.requiresPassword = false
})

      .addCase(sendPhoneOtp.rejected, (state, action) => {
        state.sending = false
        state.sent = false

        const p = action.payload || {}
        state.error = p.message || action.error?.message || 'Unable to send OTP.'

        state.reason = p.reason || null
        state.fallback = p.fallback || null

        state.requiresPassword =
          p.status === 'forbidden' ||
          p.http_status === 403 ||
          /current password/i.test(String(p.message || ''))

        // Cooldown responses may include these
        state.expiresAt = p.expires_at || null
        state.expiresInSeconds =
          typeof p.expires_in_seconds === 'number' ? p.expires_in_seconds : null
        state.resendAvailableInSeconds =
          typeof p.resend_available_in_seconds === 'number'
            ? p.resend_available_in_seconds
            : null
      })

      .addCase(confirmPhoneOtp.pending, (state) => {
        state.verifying = true
        state.error = null
        state.message = null
      })
      .addCase(confirmPhoneOtp.fulfilled, (state, action) => {
        state.verifying = false
        state.error = null
        state.message = action.payload?.message || 'Phone verified.'
      })
      .addCase(confirmPhoneOtp.rejected, (state, action) => {
        state.verifying = false
        const p = action.payload || {}
        state.error = p.message || action.error?.message || 'Verification failed.'
      })
  },
})

export const { resetPhoneVerification } = slice.actions
export default slice.reducer
