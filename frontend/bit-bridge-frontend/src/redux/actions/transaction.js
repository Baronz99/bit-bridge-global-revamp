import { createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import client from '../../api/client'

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  (Array.isArray(error?.response?.data?.errors) ? error.response.data.errors.join(', ') : null) ||
  error?.message ||
  'Something went wrong'

/**
 * Normalize wallet selector:
 * - we do NOT use usdt anymore
 * - accept "usdt" from any legacy UI and treat as "usd"
 */
const normalizeWalletType = (wt) => {
  const v = (wt || '').toString().trim().toLowerCase()
  if (!v) return null
  if (v === 'usdt') return 'usd'
  if (v === 'usd' || v === 'ngn') return v
  return null
}

export const createTransaction = createAsyncThunk(
  'transaction/client-deposit',
  async (data, { rejectWithValue }) => {
    const formData = new FormData()

    // optional wallet selector (ngn|usd)
    const walletType = normalizeWalletType(data?.wallet_type || data?.currency)
    if (walletType) formData.append('transaction[wallet_type]', walletType)

    data?.address && formData.append('transaction[address]', data.address)
    formData.append('transaction[amount]', data.amount)
    formData.append('transaction[transaction_type]', data.transaction_type)
    data?.bank && formData.append('transaction[bank]', data.bank)
    data?.coin_type && formData.append('transaction[coin_type]', data.coin_type)
    data?.coupon_code && formData.append('transaction[coupon_code]', data.coupon_code)

    if (data?.proof && data?.proof[0]) {
      formData.append('transaction[proof]', data.proof[0].originFileObj)
    }

    try {
      const response = await client.post('/transactions', formData, {
        // Let axios set the multipart boundary
        headers: { 'Content-Type': undefined },
      })

      const result = response.data
      toast(result?.message || 'Transaction created successfully', { type: 'success' })
      return result
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

export const initializeMonifyPayment = createAsyncThunk(
  'transaction/initialize_payment',
  async (data, { rejectWithValue }) => {
    // Monnify funding is NGN Bridge only for now
    const transactionData = { transaction: { ...data, currency: 'NGN' } }

    try {
      const response = await client.post('/transactions/initialize_transaction', transactionData)
      const result = response.data

      // NOTE: the backend response here is mostly the monnify payload
      // Keep toast minimal (avoid dumping huge objects)
      toast('Awaiting bank transfer. Complete the transfer using the account details shown.', {
        type: 'info',
      })
      return result
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

export const createUserTransaction = createAsyncThunk(
  'transaction/user-deposit',
  async (data, { rejectWithValue }) => {
    const formData = new FormData()

    const walletType = normalizeWalletType(data?.wallet_type || data?.currency)
    if (walletType) formData.append('transaction[wallet_type]', walletType)

    data?.address && formData.append('transaction[address]', data.address)
    formData.append('transaction[amount]', data.amount)
    data?.wallet_id && formData.append('transaction[wallet_id]', data.wallet_id)
    formData.append('transaction[transaction_type]', data.transaction_type)
    data?.bank && formData.append('transaction[bank]', data.bank)
    data?.status && formData.append('transaction[status]', data.status)
    data?.coin_type && formData.append('transaction[coin_type]', data.coin_type)
    data?.coupon_code && formData.append('transaction[coupon_code]', data.coupon_code)

    if (data?.proof && data?.proof[0]) {
      formData.append('transaction[proof]', data.proof[0].originFileObj)
    }

    try {
      const response = await client.post('/transactions/create_user', formData, {
        headers: { 'Content-Type': undefined },
      })

      const result = response.data
      toast(result?.message || 'Transaction created successfully', { type: 'success' })
      return result
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

export const updateTransaction = createAsyncThunk(
  'transaction/update-transaction',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await client.patch(`/transactions/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const getTransactions = createAsyncThunk(
  'transaction/get-transactions',
  async (options = {}, { rejectWithValue }) => {
    try {
      const response = await client.get('/transactions', {
        params: options?.params || {},
      })
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const getTransaction = createAsyncThunk(
  'transaction/get-transaction',
  async (id, { rejectWithValue }) => {
    try {
      const response = await client.get(`/transactions/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

/**
 * Fetch user transactions with optional filters:
 * params: {
 *   transaction_type?: 'deposit'|'withdrawal',
 *   status?: 'pending'|'approved'|...,
 *   wallet_type?: 'ngn'|'usd'
 * }
 */
export const getUserTransactions = createAsyncThunk(
  'transaction/get-user-transactions',
  async ({ params }, { rejectWithValue }) => {
    try {
      const p = { ...(params || {}) }
      if (p.wallet_type) {
        const wt = normalizeWalletType(p.wallet_type)
        if (wt) p.wallet_type = wt
        else delete p.wallet_type
      }

      const response = await client.get('/transactions/user', { params: p })
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)
