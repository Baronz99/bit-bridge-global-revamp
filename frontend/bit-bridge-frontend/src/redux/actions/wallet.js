import { createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/client'

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.errors?.join?.(', ') ||
  error?.message ||
  'Something went wrong'

/**
 * ✅ Bridge wallet (NGN) - legacy behaviour
 * GET /wallets/user
 */
export const getWallet = createAsyncThunk('wallet/get-wallet', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/wallets/user')
    return res.data
  } catch (error) {
    return rejectWithValue({ message: getErrorMessage(error) })
  }
})

/**
 * ✅ Tunnel wallet (USD) activation
 * POST /wallets/tunnel/activate
 * Creates/returns USD wallet (never USDT).
 */
export const activateTunnel = createAsyncThunk('wallet/activate-tunnel', async (_, { rejectWithValue }) => {
  try {
    const res = await api.post('/wallets/tunnel/activate')
    return res.data
  } catch (error) {
    return rejectWithValue({ message: getErrorMessage(error) })
  }
})

/**
 * ✅ Convert NGN → USD (PIN-gated)
 * POST /wallets/tunnel/convert
 * Body: { amount_ngn, transaction_pin }
 */
export const convertNgnToUsd = createAsyncThunk(
  'wallet/convert-ngn-to-usd',
  async ({ amount_ngn, transaction_pin }, { rejectWithValue }) => {
    try {
      const res = await api.post('/wallets/tunnel/convert', {
        amount_ngn,
        transaction_pin,
      })
      return res.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

/**
 * ƒo. Send money to BitBridge user (NGN)
 * POST /wallets/send_money
 * Body: { phone_number, amount, transaction_pin, description }
 */
export const sendMoneyToUser = createAsyncThunk(
  'wallet/send-money-to-user',
  async ({ phone_number, amount, transaction_pin, description }, { rejectWithValue }) => {
    try {
      const res = await api.post('/wallets/send_money', {
        phone_number,
        amount,
        transaction_pin,
        description,
      })
      return res.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)
