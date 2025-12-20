import { createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import client from '../../api/client'

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Something went wrong'

export const createTransaction = createAsyncThunk(
  'transaction/client-deposit',
  async (data, { rejectWithValue }) => {
    const formData = new FormData()

    data?.address && formData.append('transaction[address]', data.address)
    formData.append('transaction[amount]', data.amount)
    formData.append('transaction[transaction_type]', data.transaction_type)
    data?.bank && formData.append('transaction[bank]', data.bank)
    formData.append('transaction[coin_type]', data.coin_type)
    data?.coupon_code && formData.append('transaction[coupon_code]', data.coupon_code)

    if (data?.proof && data?.proof[0]) {
      formData.append('transaction[proof]', data.proof[0].originFileObj)
    }

    try {
      const response = await client.post('/transactions', formData, {
        // Important: let axios set the multipart boundary
        headers: { 'Content-Type': undefined },
      })

      const result = response.data
      toast(result?.message || 'Order created successfully', { type: 'success' })
      toast(result, { type: 'success' })

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
    const transactionData = { transaction: data }

    try {
      const response = await client.post('/transactions/initialize_transaction', transactionData)
      const result = response.data

      toast(result?.message || 'Order created successfully', { type: 'success' })
      toast(result, { type: 'success' })

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

    data?.address && formData.append('transaction[address]', data.address)
    formData.append('transaction[amount]', data.amount)
    formData.append('transaction[wallet_id]', data.wallet_id)
    formData.append('transaction[transaction_type]', data.transaction_type)
    data?.bank && formData.append('transaction[bank]', data.bank)
    data?.status && formData.append('transaction[status]', data.status)
    formData.append('transaction[coin_type]', data.coin_type)
    data?.coupon_code && formData.append('transaction[coupon_code]', data.coupon_code)

    if (data?.proof && data?.proof[0]) {
      formData.append('transaction[proof]', data.proof[0].originFileObj)
    }

    try {
      const response = await client.post('/transactions/create_user', formData, {
        headers: { 'Content-Type': undefined },
      })

      const result = response.data
      toast(result?.message || 'Order created successfully', { type: 'success' })
      toast(result, { type: 'success' })

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
  async (_, { rejectWithValue }) => {
    try {
      const response = await client.get('/transactions')
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

export const getUserTransactions = createAsyncThunk(
  'transaction/get-user-transactions',
  async ({ params }, { rejectWithValue }) => {
    try {
      const response = await client.get('/transactions/user', { params })
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)
