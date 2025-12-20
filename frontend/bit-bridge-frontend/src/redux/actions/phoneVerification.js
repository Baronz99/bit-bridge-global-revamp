// frontend/bit-bridge-frontend/src/redux/actions/phoneVerification.js

import { createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import { requestPhoneOtp, verifyPhoneOtp } from '../../api/auth'
import { userProfile } from './auth'

// Send OTP
export const sendPhoneOtp = createAsyncThunk(
  'phoneVerification/send',
  async (
    { phone_number, current_password, transaction_pin } = {},
    { rejectWithValue }
  ) => {
    try {
      const payload = {}
      if (phone_number) payload.phone_number = phone_number
      if (current_password) payload.current_password = current_password
      if (transaction_pin) payload.transaction_pin = transaction_pin

      const res = await requestPhoneOtp(payload)
      return res.data
    } catch (error) {
      const data = error.response?.data || {}
      const message =
        data?.message ||
        data?.errors?.[0] ||
        'Unable to send OTP. Please try again.'

      return rejectWithValue({
        ...data,
        message,
        http_status: error.response?.status,
        status: data?.status,
      })
    }
  }
)

// Verify OTP
export const confirmPhoneOtp = createAsyncThunk(
  'phoneVerification/verify',
  async ({ phone_number, code }, { dispatch, rejectWithValue }) => {
    try {
      const res = await verifyPhoneOtp({ phone_number, code })

      await dispatch(userProfile())
      toast('Phone number verified successfully.', { type: 'success' })

      return res.data
    } catch (error) {
      const data = error.response?.data || {}
      const message =
        data?.message ||
        data?.errors?.[0] ||
        'Verification failed. Please try again.'

      return rejectWithValue({
        ...data,
        message,
        http_status: error.response?.status,
        status: data?.status,
      })
    }
  }
)
